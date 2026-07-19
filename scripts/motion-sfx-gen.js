#!/usr/bin/env node
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const run = promisify(execFile);

/**
 * NEO MOTION — CTA SES EFEKTLERİ (tamamen programatik sentez, ffmpeg lavfi).
 * Harici/telifli dosya YOK. Hepsi -18..-14 dBFS civarı, kısa, TTS'i bastırmaz.
 * Kullanım: npm run motion:sfx
 */

const OUT = path.join('assets', 'motion', 'sfx');
const MAN = path.join('assets', 'motion', 'manifests');

// Her SFX: ffmpeg filtre zinciri (lavfi kaynak → şekillendirme). 48kHz mono.
const SFX = {
  // Yumuşak tık: kısa pembe gürültü patlaması + hızlı kapanış.
  soft_click: "anoisesrc=d=0.09:c=pink:a=0.5,highpass=f=900,lowpass=f=6000,afade=t=in:st=0:d=0.005,afade=t=out:st=0.03:d=0.06,volume=-9dB",
  // Pop: yukarı süpüren kısa sinüs.
  pop: "aevalsrc='0.6*sin(2*PI*(420+3600*t)*t)':d=0.12:s=48000,afade=t=in:st=0:d=0.005,afade=t=out:st=0.05:d=0.07,volume=-10dB",
  // Zil tık: yüksek sinüs + hızlı üstel sönüm.
  bell_tick: "aevalsrc='0.6*sin(2*PI*1180*t)*exp(-16*t)':d=0.28:s=48000,highpass=f=600,volume=-9dB",
  // Swipe: bant-geçiren süpürülen gürültü.
  swipe: "anoisesrc=d=0.22:c=white:a=0.5,bandpass=f=1800:width_type=h:w=1200,afade=t=in:st=0:d=0.02,afade=t=out:st=0.1:d=0.12,volume=-12dB",
  // Onay: iki tonlu kısa jingle (660→880Hz).
  confirmation: "aevalsrc='0.5*sin(2*PI*(660+220*gte(t,0.14))*t)':d=0.32:s=48000,afade=t=in:st=0:d=0.01,afade=t=out:st=0.22:d=0.1,volume=-10dB",
};

await mkdir(OUT, { recursive: true });
await mkdir(MAN, { recursive: true });

const manifests = [];
for (const [id, filter] of Object.entries(SFX)) {
  const file = path.join(OUT, `${id}.wav`);
  await run('ffmpeg', ['-nostdin', '-y', '-v', 'error', '-f', 'lavfi', '-i', filter,
    '-ac', '1', '-ar', '48000', '-c:a', 'pcm_s16le', file]);
  // Peak ölçümü (güvenlik: clipping olmasın).
  const { stderr } = await run('ffmpeg', ['-nostdin', '-i', file, '-af', 'volumedetect', '-f', 'null', '-'])
    .catch((e) => ({ stderr: e.stderr || '' }));
  const peak = /max_volume:\s*(-?[\d.]+)\s*dB/.exec(stderr || '');
  const peakDb = peak ? parseFloat(peak[1]) : null;
  console.log(`✓ ${id}.wav  peak=${peakDb}dB`);
  manifests.push({
    id, type: 'sfx', file: `sfx/${id}.wav`, origin: 'programmatically-generated',
    author: 'NeoSaniye', license: 'proprietary-original', externalSource: null,
    synthesis: 'ffmpeg-lavfi', peakDb, version: 1,
  });
}

await writeFile(path.join(MAN, 'sfx-manifest.json'), JSON.stringify({ generatedAt: new Date().toISOString(), assets: manifests }, null, 2));
console.log(`\n${manifests.length} SFX üretildi → ${OUT}`);
