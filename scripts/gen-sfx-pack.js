#!/usr/bin/env node
/**
 * SFX BAŞLANGIÇ PAKETİ — assets/sfx/<tip>/ havuzuna varyasyonlu, ORİJİNAL
 * (ffmpeg sentez) ses efektleri üretir. Telif riski yok (proprietary-original).
 * Amaç: havuz boş kalmasın, "hep aynı geçiş sesi" bitsin. Kullanıcı sonra
 * üstüne telifsiz gerçek foley (Freesound CC0 / Pixabay / YouTube Audio Library)
 * ekleyebilir; sistem hepsini rotasyona sokar.
 *
 * Çalıştır: node scripts/gen-sfx-pack.js
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const run = promisify(execFile);
const ROOT = 'assets/sfx';

/** Tek bir SFX'i lavfi zincirinden üretip mono 44.1kHz WAV yazar. */
async function make(dir, name, args) {
  await mkdir(path.join(ROOT, dir), { recursive: true });
  const out = path.join(ROOT, dir, name);
  await run('ffmpeg', ['-y', '-v', 'error', ...args, '-ac', '1', '-ar', '44100',
    '-af', (args.includes('-af') ? 'anull' : 'alimiter=limit=0.97'), out], { maxBuffer: 12 * 1024 * 1024 })
    .catch(async () => {
      // -af zaten zincirde ise ekstra -af eklemeden yaz.
      await run('ffmpeg', ['-y', '-v', 'error', ...args, '-ac', '1', '-ar', '44100', out], { maxBuffer: 12 * 1024 * 1024 });
    });
  console.log('  ✓', path.join(dir, name));
}

// ---- WHOOSH (geçiş süpürmesi) — merkez frekans + vibrato varyasyonu ----
const whooshes = [[650, 7], [900, 6], [1200, 8], [1500, 5]];
for (let i = 0; i < whooshes.length; i += 1) {
  const [f, v] = whooshes[i];
  await make('whoosh', `whoosh-${i + 1}.wav`, [
    '-f', 'lavfi', '-i', 'anoisesrc=d=0.55:c=pink:a=0.75',
    '-af', `bandpass=f=${f}:w=700,vibrato=f=${v}:d=0.6,afade=t=in:st=0:d=0.16,` +
      'afade=t=out:st=0.28:d=0.27,aecho=0.6:0.35:45:0.3,volume=1.7,alimiter=limit=0.97',
  ]);
}

// ---- IMPACT (vuruş/twist) — sub frekans varyasyonu ----
const impacts = [44, 55, 66];
for (let i = 0; i < impacts.length; i += 1) {
  const sub = impacts[i];
  await make('impact', `impact-${i + 1}.wav`, [
    '-f', 'lavfi', '-i', `sine=frequency=${sub}:duration=0.9`,
    '-f', 'lavfi', '-i', `sine=frequency=${sub * 2}:duration=0.5`,
    '-f', 'lavfi', '-i', 'anoisesrc=d=0.05:c=white:a=0.8',
    '-filter_complex',
    '[0]afade=t=out:st=0.05:d=0.8,volume=2.2[sub];' +
      '[1]afade=t=out:st=0.03:d=0.4,volume=1.6[body];' +
      '[2]highpass=f=1800,afade=t=out:st=0.005:d=0.045,volume=0.6[clk];' +
      '[sub][body][clk]amix=inputs=3:normalize=0,aecho=0.7:0.4:40|75:0.35|0.2,alimiter=limit=0.97[o]',
    '-map', '[o]',
  ]);
}

// ---- RISER (gerilim tırmanışı) — uzunluk + highpass varyasyonu ----
const risers = [[0.9, 350], [1.0, 500], [0.8, 250]];
for (let i = 0; i < risers.length; i += 1) {
  const [d, hp] = risers[i];
  await make('riser', `riser-${i + 1}.wav`, [
    '-f', 'lavfi', '-i', `anoisesrc=d=${d}:c=pink:a=0.6`,
    '-af', `highpass=f=${hp},lowpass=f=7000,vibrato=f=10:d=0.5,` +
      `afade=t=in:st=0:d=${(d - 0.15).toFixed(2)},afade=t=out:st=${(d - 0.12).toFixed(2)}:d=0.12,` +
      'aecho=0.5:0.3:35:0.3,volume=1.3,alimiter=limit=0.97',
  ]);
}

// ---- SHIMMER (parlak/olumlu an) — akor varyasyonu ----
const shimmers = [[1567, 2093, 3136], [1319, 1760, 2637], [1760, 2349, 3520]];
for (let i = 0; i < shimmers.length; i += 1) {
  const [a, b, c] = shimmers[i];
  await make('shimmer', `shimmer-${i + 1}.wav`, [
    '-f', 'lavfi', '-i', `sine=frequency=${a}:duration=0.7`,
    '-f', 'lavfi', '-i', `sine=frequency=${b}:duration=0.7`,
    '-f', 'lavfi', '-i', `sine=frequency=${c}:duration=0.7`,
    '-filter_complex',
    '[0][1][2]amix=inputs=3:normalize=0,tremolo=f=8:d=0.5,' +
      'afade=t=in:st=0:d=0.02,afade=t=out:st=0.18:d=0.5,' +
      'aecho=0.6:0.45:80|140:0.4|0.25,volume=0.8,alimiter=limit=0.97[o]',
    '-map', '[o]',
  ]);
}

// ---- CLICK (UI tık) — frekans varyasyonu ----
const clicks = [1000, 1300];
for (let i = 0; i < clicks.length; i += 1) {
  const f = clicks[i];
  await make('click', `click-${i + 1}.wav`, [
    '-f', 'lavfi', '-i', `sine=frequency=${f}:duration=0.06`,
    '-f', 'lavfi', '-i', 'anoisesrc=d=0.03:c=white:a=0.6',
    '-filter_complex',
    '[0]afade=t=out:st=0.015:d=0.045,volume=1.2[t];' +
      '[1]highpass=f=3000,afade=t=out:st=0.004:d=0.026,volume=0.7[n];' +
      '[t][n]amix=inputs=2:normalize=0,aecho=0.4:0.2:25:0.18,alimiter=limit=0.97[o]',
    '-map', '[o]',
  ]);
}

console.log('\n✅ SFX başlangıç paketi üretildi (assets/sfx/).');
