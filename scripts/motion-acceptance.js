#!/usr/bin/env node
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { renderCta } from '../src/motion/ctaRenderer.js';
import { computeSafeArea } from '../src/motion/ctaSafeArea.js';
import { config } from '../src/config.js';

const run = promisify(execFile);
const ROOT = path.join('artifacts', 'motion', 'acceptance');
const VID = path.join(ROOT, 'videos');
const SHOT = path.join(ROOT, 'screenshots');
for (const d of [ROOT, VID, SHOT]) await mkdir(d, { recursive: true });

const FONT = `${config.video.fontsDir}/Montserrat-SemiBold.ttf`;
const START = 20.0;   // CTA başlangıcı (sabit, kare çıkarımı öngörülebilir olsun)
const DUR = 2.4;      // CTA süresi
const VLEN = 32;      // test videosu uzunluğu

// Sahte "TTS + müzik" ses yatağı (lavfi tek çıkışlı): 1kHz voice + 220Hz müzik.
const AUDIO_BED =
  "sine=frequency=1000:duration=32,volume=-14dB[voice];" +
  "sine=frequency=220:duration=32,volume=-19dB[mus];" +
  "[voice][mus]amix=inputs=2:normalize=0";

/** Sahte altyazı drawtext (kaynak piksele yakılır — koruma testi için). */
function caption(text, y) {
  return `drawtext=fontfile=${FONT}:text='${text}':x=(w-tw)/2:y=${y}:fontsize=54:` +
    `fontcolor=white:borderw=4:bordercolor=black@0.9`;
}

// 6 arka plan — istenen çeşitlilik. captionBox/subjectBox safe-area'ya beslenir.
const BACKGROUNDS = {
  bright: { desc: 'Açık/parlak görüntü', vf: 'gradients=s=1080x1920:c0=0xEDEFF0:c1=0xC9D2D6:x0=0:y0=0:x1=1080:y1=1920,noise=alls=6:allf=t' },
  dark: { desc: 'Koyu görüntü', vf: 'gradients=s=1080x1920:c0=0x0A0E11:c1=0x161C22:x0=0:y0=0:x1=540:y1=1920' },
  botcap: { desc: 'Alt bölgede yoğun altyazı', vf: `gradients=s=1080x1920:c0=0x22303A:c1=0x0E1519,${caption('BU KRİSTAL IŞIĞI', 1360)},${caption('İKİYE BÖLÜYORDU', 1430)}`,
    captionBox: { x: 90, y: 1340, w: 900, h: 170 } },
  midcap: { desc: 'Orta bölgede altyazı', vf: `gradients=s=1080x1920:c0=0x2A2320:c1=0x120E0C,${caption('İŞTE GERÇEK BURADA', 900)}`,
    captionBox: { x: 120, y: 880, w: 840, h: 90 } },
  fastcut: { desc: 'Hızlı sahne geçişi', vf: 'testsrc2=s=1080x1920:r=30,hue=h=t*220:s=1.3' },
  subject: { desc: 'Alt bölgede ana nesne/yüz', vf: 'gradients=s=1080x1920:c0=0x1A2228:c1=0x0C1013,drawbox=x=360:y=1250:w=360:h=470:color=0xE8C9A0@0.9:t=fill,drawbox=x=360:y=1250:w=360:h=470:color=0x3BD0C8:t=4',
    subjectBox: { x: 340, y: 1230, w: 400, h: 500 } },
};

// Render matrisi: her şablon → tip + arka plan (çeşitliliği kapsar).
const MATRIX = [
  { templateId: 'neo_subscribe_minimal', type: 'subscribe', bg: 'bright' },
  { templateId: 'neo_subscribe_pulse', type: 'subscribe', bg: 'dark' },
  { templateId: 'neo_like_pop', type: 'like', bg: 'botcap' },
  { templateId: 'neo_bell_ring', type: 'bell', bg: 'midcap' },
  { templateId: 'neo_comment_slide', type: 'comment', bg: 'fastcut' },
  { templateId: 'neo_follow_compact', type: 'follow', bg: 'subject' },
];

async function probe(file) {
  const { stdout } = await run('ffprobe', ['-v', 'error', '-show_entries',
    'format=duration:stream=codec_type,width,height,r_frame_rate,pix_fmt,channels,duration',
    '-of', 'json', file]);
  const j = JSON.parse(stdout);
  const v = (j.streams || []).find((s) => s.codec_type === 'video') || {};
  const a = (j.streams || []).find((s) => s.codec_type === 'audio') || {};
  const [n, d] = String(v.r_frame_rate || '0/1').split('/').map(Number);
  return {
    duration: +parseFloat(j.format?.duration || 0).toFixed(3),
    vDur: v.duration ? +parseFloat(v.duration).toFixed(3) : null,
    aDur: a.duration ? +parseFloat(a.duration).toFixed(3) : null,
    width: v.width, height: v.height, fps: d ? +(n / d).toFixed(2) : null,
    pixFmt: v.pix_fmt, channels: a.channels,
  };
}

async function measureAudio(file) {
  const { stderr } = await run('ffmpeg', ['-nostdin', '-i', file, '-af', 'volumedetect', '-f', 'null', '-'])
    .catch((e) => ({ stderr: e.stderr || '' }));
  const peak = /max_volume:\s*(-?[\d.]+)\s*dB/.exec(stderr || '');
  return { maxPeakDb: peak ? parseFloat(peak[1]) : null };
}

async function detect(file, filter, re) {
  const { stderr } = await run('ffmpeg', ['-nostdin', '-i', file, '-vf', filter, '-f', 'null', '-'],
    { maxBuffer: 16 * 1024 * 1024 }).catch((e) => ({ stderr: e.stderr || '' }));
  return (String(stderr).match(re) || []).length;
}

/** CTA kutusu dışındaki bölge korunmuş mu (altyazı kaybı testi) — off vs on SSIM. */
async function regionPreserved(off, on, atSec, cropRegion) {
  const { stderr } = await run('ffmpeg', ['-nostdin', '-ss', atSec.toFixed(2), '-i', off,
    '-ss', atSec.toFixed(2), '-i', on, '-frames:v', '1',
    '-filter_complex', `[0:v]crop=${cropRegion}[a];[1:v]crop=${cropRegion}[b];[a][b]ssim`, '-f', 'null', '-'],
    { maxBuffer: 8 * 1024 * 1024 }).catch((e) => ({ stderr: e.stderr || '' }));
  const m = /All:\s*([\d.]+)/.exec(stderr || '');
  return m ? +parseFloat(m[1]).toFixed(4) : null;
}

const results = [];
for (const item of MATRIX) {
  const bg = BACKGROUNDS[item.bg];
  const t0 = Date.now();
  // 1) Arka plan videosu (CTA kapalı kontrol) — kaynak. bg.vf bir lavfi
  // SOURCE grafiğidir (gradients/testsrc + drawtext/drawbox), doğrudan input.
  const off = path.join(VID, `${item.templateId}-off.mp4`);
  await run('ffmpeg', ['-nostdin', '-y', '-v', 'error',
    '-f', 'lavfi', '-i', bg.vf,
    '-f', 'lavfi', '-i', AUDIO_BED,
    '-map', '0:v', '-map', '1:a', '-t', String(VLEN),
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p',
    '-r', '30', '-c:a', 'aac', '-b:a', '160k', '-ac', '2', off]);
  const offSize = (await stat(off)).size;

  // 2) Safe-area (caption/subject box'ları hesaba kat).
  const box = computeSafeArea({ position: 'auto', subjectBox: bg.subjectBox });
  // 3) CTA render (always/test — canlı config'e dokunmadan doğrudan renderCta).
  const on = path.join(VID, `${item.templateId}-on.mp4`);
  const mp0 = Date.now();
  const r = await renderCta({
    inputVideo: off, outputVideo: on,
    plan: { templateId: item.templateId, type: item.type, startSec: START, durationSec: DUR },
    box, workDir: VID, width: 1080, height: 1920, duration: VLEN,
  });
  const motionPassMs = Date.now() - mp0;
  const onSize = (await stat(on)).size;

  // 4) Teknik kontroller (off vs on).
  const [po, pn, ao] = await Promise.all([probe(off), probe(on), measureAudio(on)]);
  const blackOn = await detect(on, 'blackdetect=d=0.3:pix_th=0.06', /black_start/g);
  const blackOff = await detect(off, 'blackdetect=d=0.3:pix_th=0.06', /black_start/g);
  const freezeOn = await detect(on, 'freezedetect=n=-60dB:d=2', /freeze_start/g);
  // Altyazı/nesne korunmuş mu: CTA kutusu DIŞINDA bir bölgeyi karşılaştır.
  const capRegion = bg.captionBox
    ? `${bg.captionBox.w}:${bg.captionBox.h}:${bg.captionBox.x}:${bg.captionBox.y}`
    : '1080:200:0:900';
  const preservedSsim = await regionPreserved(off, on, START + DUR / 2, capRegion);
  // CTA kutusu ile caption/subject box çakışması.
  const overlaps = (a, b) => a && b && !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);
  const captionOverlap = overlaps(box, bg.captionBox);
  const subjectOverlap = overlaps(box, bg.subjectBox);
  const rightIcon = box && (box.x + box.w > 1080 - 140);

  // 5) 3 kare: giriş / tam / çıkış.
  const shots = {};
  for (const [name, ts] of [['entry', START + 0.15], ['full', START + DUR / 2], ['exit', START + DUR - 0.12]]) {
    const p = path.join(SHOT, `${item.templateId}-${name}.png`);
    await run('ffmpeg', ['-nostdin', '-y', '-v', 'error', '-ss', ts.toFixed(2), '-i', on, '-frames:v', '1', p]);
    shots[name] = p;
  }

  results.push({
    templateId: item.templateId, ctaType: item.type, video: `${item.bg} (${bg.desc})`,
    position: box?.position || null, safeArea: box, startSec: START, durationSec: DUR,
    sfxId: r.sfxId, captionBox: bg.captionBox || null, subjectBox: bg.subjectBox || null,
    renderMs: Date.now() - t0, motionPassMs, inputSizeMB: +(offSize / 1e6).toFixed(2),
    outputSizeMB: +(onSize / 1e6).toFixed(2), sizeDeltaMB: +((onSize - offSize) / 1e6).toFixed(2),
    technical: {
      fps: { off: po.fps, on: pn.fps, unchanged: po.fps === pn.fps },
      resolution: { off: `${po.width}x${po.height}`, on: `${pn.width}x${pn.height}`, unchanged: po.width === pn.width && po.height === pn.height },
      pixFmt: { off: po.pixFmt, on: pn.pixFmt, unchanged: po.pixFmt === pn.pixFmt },
      channels: { off: po.channels, on: pn.channels, unchanged: po.channels === pn.channels },
      duration: { off: po.duration, on: pn.duration, delta: +(pn.duration - po.duration).toFixed(3) },
      avSyncGap: pn.vDur !== null && pn.aDur !== null ? +(pn.vDur - pn.aDur).toFixed(3) : null,
      maxPeakDb: ao.maxPeakDb,
      blackFramesIntroduced: blackOn - blackOff,
      freezeSegments: freezeOn,
      captionRegionPreservedSsim: preservedSsim,
      captionOverlap, subjectOverlap, rightIconViolation: rightIcon,
    },
    warnings: r.ok ? [] : ['render-failed'], failures: r.ok ? [] : [r.error],
    ok: r.ok,
  });
  console.log(`✓ ${item.templateId} @ ${item.bg} — pass ${motionPassMs}ms, peak ${ao.maxPeakDb}dB, capSSIM ${preservedSsim}, capOverlap ${captionOverlap}`);
}

// Contact sheet: 6 satır × 3 kare (giriş/tam/çıkış), etiketli.
const rows = [];
for (const res of results) {
  const label = `${res.templateId} | ${res.video.split(' ')[0]} | ${res.position}`;
  rows.push({ res, label });
}
// Her şablon için 3 kareyi yatay birleştir + üst etiket; sonra dikey istifle.
const rowImgs = [];
for (const { res } of results) {
  const rowPng = path.join(SHOT, `row-${res.templateId}.png`);
  const labels = ['giriş', 'tam', 'çıkış'];
  const ins = ['entry', 'full', 'exit'].flatMap((n) => ['-i', path.join(SHOT, `${res.templateId}-${n}.png`)]);
  const draw = labels.map((l, i) =>
    `[${i}:v]scale=340:604,drawbox=x=0:y=0:w=340:h=44:color=black@0.75:t=fill,` +
    `drawtext=fontfile=${FONT}:text='${res.templateId} ${l} ${START}s ${res.position}':x=8:y=12:fontsize=15:fontcolor=0x3BD0C8[c${i}]`).join(';');
  await run('ffmpeg', ['-nostdin', '-y', '-v', 'error', ...ins,
    '-filter_complex', `${draw};[c0][c1][c2]hstack=inputs=3[v]`, '-map', '[v]', '-frames:v', '1', rowPng]);
  rowImgs.push(rowPng);
}
const sheet = path.join(ROOT, 'acceptance-contact-sheet.png');
await run('ffmpeg', ['-nostdin', '-y', '-v', 'error', ...rowImgs.flatMap((f) => ['-i', f]),
  '-filter_complex', `${rowImgs.map((_, i) => `[${i}:v]`).join('')}vstack=inputs=${rowImgs.length}[v]`,
  '-map', '[v]', '-frames:v', '1', sheet]);

await writeFile(path.join(ROOT, 'acceptance-report.json'),
  JSON.stringify({ generatedAt: new Date().toISOString(), note: 'Sandbox\'ta gerçek NeoSaniye videosu yok; temsili çeşitlilik arka planları kullanıldı (bright/dark/botcap/midcap/fastcut/subject).', results }, null, 2));
console.log(`\n✓ contact sheet: ${sheet}`);
console.log(`✓ report: ${path.join(ROOT, 'acceptance-report.json')}`);
