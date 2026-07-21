import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { verifySfxInOutput } from './outputVerify.js';

const run = promisify(execFile);
const BUF = { maxBuffer: 40 * 1024 * 1024 };

async function durationOf(file) {
  const { stdout } = await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file]);
  return Number.parseFloat(stdout) || 0;
}

async function accentPixels(file, at, width = 270, height = 480) {
  const { stdout } = await run('ffmpeg', ['-v', 'error', '-ss', at.toFixed(3), '-i', file, '-frames:v', '1', '-vf', `scale=${width}:${height}`, '-pix_fmt', 'rgb24', '-f', 'rawvideo', 'pipe:1'], { ...BUF, encoding: 'buffer' });
  let count = 0;
  for (let i = 0; i + 2 < stdout.length; i += 3) {
    const r = stdout[i]; const g = stdout[i + 1]; const b = stdout[i + 2];
    if (r >= 25 && r <= 110 && g >= 145 && b >= 140 && Math.abs(g - b) < 80) count += 1;
  }
  return count;
}

async function rawFrame(file, at, width = 135, height = 240) {
  const { stdout } = await run('ffmpeg', ['-v', 'error', '-ss', Math.max(0, at).toFixed(3), '-i', file, '-frames:v', '1', '-vf', `scale=${width}:${height}`, '-pix_fmt', 'rgb24', '-f', 'rawvideo', 'pipe:1'], { ...BUF, encoding: 'buffer' });
  return stdout;
}

async function proveMovingWindows(file, windows = []) {
  const proved = [];
  for (const window of windows) {
    const a = await rawFrame(file, window.start + Math.min(0.18, (window.end - window.start) / 4));
    const b = await rawFrame(file, Math.min(window.end - 0.05, window.start + 0.72));
    const n = Math.min(a.length, b.length);
    let changed = 0;
    for (let i = 0; i < n; i += 3) {
      if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 36) changed += 1;
    }
    const ratio = n ? changed / (n / 3) : 0;
    if (ratio >= 0.025) proved.push({ ...window, changedPixelRatio: +ratio.toFixed(4) });
  }
  return proved;
}

async function captionPixels(file, at, width = 270, height = 480) {
  if (!Number.isFinite(at)) return 0;
  const frame = await rawFrame(file, at, width, height);
  let count = 0;
  const y0 = Math.floor(height * 0.57);
  const y1 = Math.floor(height * 0.83);
  for (let y = y0; y < y1; y += 1) for (let x = 8; x < width - 8; x += 1) {
    const i = (y * width + x) * 3;
    if (frame[i] > 205 && frame[i + 1] > 205 && frame[i + 2] > 205) count += 1;
  }
  return count;
}

async function sceneChanges(file) {
  const { stderr = '' } = await run('ffmpeg', ['-hide_banner', '-i', file, '-vf', "select='gt(scene,0.22)',showinfo", '-an', '-f', 'null', '-'], BUF).catch((e) => ({ stderr: e.stderr || '' }));
  return (stderr.match(/Parsed_showinfo[^\n]*pts_time:/g) || []).length;
}

async function audioTruth(file) {
  const { stderr = '' } = await run('ffmpeg', ['-hide_banner', '-i', file, '-vn', '-af', 'ebur128=peak=true', '-f', 'null', '-'], BUF).catch((e) => ({ stderr: e.stderr || '' }));
  const integrated = [...stderr.matchAll(/I:\s*(-?[\d.]+) LUFS/g)].at(-1);
  const peak = [...stderr.matchAll(/Peak:\s*(-?[\d.]+) dBFS/g)].at(-1);
  return { integratedLufs: integrated ? Number(integrated[1]) : null, truePeakDbfs: peak ? Number(peak[1]) : null };
}

async function makeVisualEvidence(file, outDir, duration, name) {
  const frameDir = path.join(outDir, `${name}-frames`);
  await mkdir(frameDir, { recursive: true });
  await run('ffmpeg', ['-y', '-v', 'error', '-i', file, '-vf', 'fps=1/3,scale=270:-1', path.join(frameDir, 'frame-%02d.jpg')], BUF);
  const ctaFrame = path.join(outDir, `${name}-cta.jpg`);
  await run('ffmpeg', ['-y', '-v', 'error', '-ss', Math.max(0, duration - 0.55).toFixed(3), '-i', file, '-frames:v', '1', ctaFrame], BUF);
  return { frameDir, ctaFrame };
}

export async function verifyFinalMedia({ file, cues = [], plan, outDir, name = 'balanced', createEvidence = false }) {
  const duration = await durationOf(file);
  const ctaAt = Math.max(0, duration - 0.55);
  const [accentCount, changes, audio, sfx, provedMotion, captionCount] = await Promise.all([
    accentPixels(file, ctaAt), sceneChanges(file), audioTruth(file), verifySfxInOutput(file, cues),
    proveMovingWindows(file, plan?.movingWindows || []), captionPixels(file, plan?.firstCaptionAt),
  ]);
  const audibleSfx = sfx.cues.filter((x) => x.verified).length;
  const ctaVisible = accentCount >= 180;
  const captionsPresent = Boolean(plan?.captionsIncluded && plan.captionEventCount > 0 && captionCount >= 20);
  const failures = [];
  if (duration < 18 || duration > 30) failures.push('DURATION_OUTSIDE_18_30');
  if (provedMotion.length < 3) failures.push('MOVING_SEGMENTS_NOT_PROVEN');
  if ((plan?.maxConsecutiveStatic ?? 99) > 2) failures.push('STATIC_RUN_GT_2');
  if (audibleSfx < 2) failures.push('AUDIBLE_SFX_LT_2');
  if (!ctaVisible) failures.push('CTA_NOT_VISIBLE_IN_FINAL_1_5S');
  if (!captionsPresent) failures.push('CAPTIONS_NOT_PRESENT');
  const evidence = createEvidence ? await makeVisualEvidence(file, outDir, duration, name) : null;
  return {
    ok: failures.length === 0, file, duration, sceneChanges: changes,
    movingSegments: provedMotion.length, movingSegmentEvidence: provedMotion,
    maxConsecutiveStatic: plan?.maxConsecutiveStatic ?? null,
    cta: { visible: ctaVisible, sampledAt: ctaAt, accentPixels: accentCount },
    captions: { present: captionsPresent, safeArea: plan?.captionsSafeArea !== false, sampledAt: plan?.firstCaptionAt ?? null, brightPixels: captionCount },
    audio, sfx: { ...sfx, audibleCount: audibleSfx }, evidence, failures,
  };
}

export async function writeVerification(file, data) {
  await writeFile(file, JSON.stringify(data, null, 2));
}

export async function makeContactSheet(video, output) {
  if (!existsSync(video)) throw new Error(`CONTACT_SHEET_VIDEO_MISSING:${video}`);
  await run('ffmpeg', ['-y', '-v', 'error', '-i', video, '-vf', 'fps=1/3,scale=270:-1,tile=4x3:padding=8:margin=8:color=0x11161f', '-frames:v', '1', output], BUF);
}
