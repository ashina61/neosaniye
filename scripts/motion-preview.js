#!/usr/bin/env node
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { buildCtaAss, TEMPLATE_IDS } from '../src/motion/ctaTemplates.js';
import { computeSafeArea } from '../src/motion/ctaSafeArea.js';
import { config } from '../src/config.js';

const run = promisify(execFile);

/**
 * NEO MOTION — önizleme araçları.
 *   npm run motion:preview           → 6 CTA'yı tek demo videoda + contact sheet
 *   npm run motion:debug-safe-area   → güvenli alan + kaçınılan bölgeler görseli
 * Ağ gerektirmez; saf ffmpeg. Çıktı: artifacts/motion/
 */

const OUT = path.join('artifacts', 'motion');
await mkdir(OUT, { recursive: true });
const mode = process.argv[2] === '--debug-safe-area' ? 'debug' : 'preview';

// Şablon → temsili tip (etiket/ikon farkı görünsün).
const TPL_TYPE = {
  neo_subscribe_minimal: 'subscribe', neo_subscribe_pulse: 'subscribe',
  neo_like_pop: 'like', neo_bell_ring: 'bell',
  neo_comment_slide: 'comment', neo_follow_compact: 'follow',
};

const bg = config.video?.styleBible?.bg0 || '0f1113';
const box = computeSafeArea({ position: 'lower_third_left' });

async function makeClip(templateId, file) {
  const type = TPL_TYPE[templateId];
  // Etiket başlık (şablon adı) + CTA.
  const ass = buildCtaAss({ templateId, type, box, startSec: 0.4, durSec: 2.4, width: 1080, height: 1920 });
  const assPath = path.join(OUT, `${templateId}.ass`);
  await writeFile(assPath, ass, 'utf8');
  const title = `drawtext=text='${templateId}':x=(w-tw)/2:y=140:fontsize=40:fontcolor=0x3BD0C8:` +
    `fontfile=${config.video.fontsDir}/Montserrat-SemiBold.ttf`;
  await run('ffmpeg', ['-nostdin', '-y', '-v', 'error',
    '-f', 'lavfi', '-i', `color=c=0x${bg}:s=1080x1920:d=3.2:r=30`,
    '-vf', `${title},ass=${assPath}:fontsdir=${config.video.fontsDir}`,
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', file]);
}

if (mode === 'debug') {
  // Güvenli alan kutusu + kaçınılan bölgeler (yarı saydam) tek karede.
  const b = box;
  const captionTop = 1920 - (config.video.captionMarginV || 460) - 170;
  const draw = [
    `drawbox=x=0:y=0:w=1080:h=470:color=red@0.25:t=fill`, // hook
    `drawbox=x=0:y=${captionTop}:w=1080:h=170:color=yellow@0.25:t=fill`, // altyazı
    `drawbox=x=0:y=${1920 - 220}:w=1080:h=220:color=orange@0.25:t=fill`, // alt UI
    `drawbox=x=${1080 - 150}:y=0:w=150:h=1920:color=purple@0.25:t=fill`, // sağ ikon
    b ? `drawbox=x=${b.x}:y=${b.y}:w=${b.w}:h=${b.h}:color=0x3BD0C8:t=6` : 'null', // CTA kutusu
  ].join(',');
  const out = path.join(OUT, 'safe-area-debug.png');
  await run('ffmpeg', ['-nostdin', '-y', '-v', 'error', '-f', 'lavfi', '-i', `color=c=0x${bg}:s=1080x1920`,
    '-vf', draw, '-frames:v', '1', out]);
  console.log(`✓ güvenli alan görseli: ${out}`);
  console.log(`  CTA kutusu: ${JSON.stringify(box)}`);
  process.exit(0);
}

// PREVIEW: 6 klip üret, birleştir, contact sheet çıkar.
const clips = [];
for (const id of TEMPLATE_IDS) {
  const f = path.join(OUT, `clip-${id}.mp4`);
  await makeClip(id, f);
  clips.push(f);
  console.log(`✓ ${id}`);
}
const listFile = path.join(OUT, 'concat.txt');
await writeFile(listFile, clips.map((c) => `file '${path.resolve(c)}'`).join('\n'));
const demo = path.join(OUT, 'cta-preview.mp4');
await run('ffmpeg', ['-nostdin', '-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', listFile,
  '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', demo]);

// Contact sheet: her klipten tepe karesi (1.4s), 2x3 döşeme, küçültülmüş.
const frames = [];
for (const id of TEMPLATE_IDS) {
  const fr = path.join(OUT, `frame-${id}.png`);
  await run('ffmpeg', ['-nostdin', '-y', '-v', 'error', '-ss', '1.4', '-i', path.join(OUT, `clip-${id}.mp4`),
    '-frames:v', '1', fr]);
  frames.push(fr);
}
const sheet = path.join(OUT, 'cta-contact-sheet.png');
await run('ffmpeg', ['-nostdin', '-y', '-v', 'error',
  ...frames.flatMap((f) => ['-i', f]),
  '-filter_complex', `[0][1][2][3][4][5]xstack=inputs=6:layout=0_0|w0_0|w0+w1_0|0_h0|w0_h0|w0+w1_h0,scale=1080:-1[v]`,
  '-map', '[v]', '-frames:v', '1', sheet]);
console.log(`\n✓ demo: ${demo}\n✓ contact sheet: ${sheet}`);
