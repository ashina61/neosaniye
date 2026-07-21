import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { renderVideo } from '../src/video/renderVideo.js';
import { verifyFinalMedia } from '../src/pipeline/finalMediaVerification.js';
import { buildCanonicalTimeline, expandTimelineForMedia } from '../src/pipeline/canonicalTimeline.js';
import { buildVariantEditPlan } from '../src/video/productionPlan.js';
import { config } from '../src/config.js';

const run = promisify(execFile);

test('production render proves motion, captions, SFX and final CTA from encoded media', { timeout: 120_000 }, async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'production-variants-'));
  const original = { outro: config.video.outro, tailSeconds: config.video.tailSeconds, subPrompt: config.video.subPrompt, music: config.video.music };
  try {
    config.video.outro = false; config.video.tailSeconds = 0; config.video.subPrompt = false; config.video.music = false;
    const audioPath = path.join(dir, 'voice.wav');
    await run('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=310:sample_rate=48000:duration=20', '-ac', '2', audioPath]);
    const media = [];
    for (let i = 0; i < 3; i += 1) {
      const clip = path.join(dir, `moving-${i}.mp4`);
      await run('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', `testsrc2=size=108x192:rate=6:duration=4,format=yuv420p,hue=h=${i * 47}`, '-c:v', 'libx264', clip]);
      media.push({ path: clip, type: 'video', scene: i, source: 'local' });
    }
    const scenes = [
      { narration: 'A real moving opening creates an immediate visual hook.' },
      { narration: 'A second scene changes material midway through the sentence.' },
      { narration: 'The final reveal leads into a visible subscribe prompt.' },
    ];
    const words = scenes.flatMap((scene) => scene.narration.replace(/[.]/g, '').split(/\s+/));
    const wordTimings = words.map((word, i) => ({ word, start: i * 20 / words.length, end: (i + 0.78) * 20 / words.length }));
    const timeline = buildCanonicalTimeline({ scenes, wordTimings, duration: 20, timingSource: 'controlled' });
    const expanded = expandTimelineForMedia(timeline, media);
    const outPath = path.join(dir, 'balanced.mp4');
    const rendered = await renderVideo({ audioPath, wordTimings, media, scenes, timeline: expanded, editPlan: buildVariantEditPlan(media, 'balanced'), language: 'en', musicSeed: 'controlled', sfxGain: 8, outPath }, { workDir: path.join(dir, 'work'), width: 108, height: 192, fps: 6 });
    const verification = await verifyFinalMedia({ file: outPath, cues: rendered.sfxCues, plan: { ...rendered.renderPlan, maxConsecutiveStatic: 0 }, outDir: dir });
    assert.equal(verification.ok, true, JSON.stringify({ failures: verification.failures, sfx: verification.sfx }));
    assert.ok(verification.movingSegments >= 3);
    assert.ok(verification.sfx.audibleCount >= 2);
    assert.equal(verification.cta.visible, true);
    assert.equal(verification.captions.present, true);
  } finally {
    Object.assign(config.video, original);
    await rm(dir, { recursive: true, force: true });
  }
});
