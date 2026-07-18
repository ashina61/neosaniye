#!/usr/bin/env node
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { preflightCheck } from '../src/pipeline/preflight.js';
import { runRetentionQC, uploadGate } from '../src/pipeline/retentionQC.js';
import { config } from '../src/config.js';

const run = promisify(execFile);

/**
 * QC DRY-RUN — upload YOK, ağ YOK. Kalite kapısını uçtan uca yerelde dener:
 *   1) verilen MP4 (veya sentetik fixture) üzerinde teknik preflight,
 *   2) fixture editoryal veriyle retention QC,
 *   3) production-report.json/md üretimi + upload uygunluk kararı.
 *
 * Kullanım:
 *   node scripts/qc-dryrun.js                 # sentetik fixture üretir
 *   node scripts/qc-dryrun.js output/x/x.mp4  # gerçek üretilmiş videoyla
 *   RETENTION_QC_MODE=strict node scripts/qc-dryrun.js   # strict modu dene
 */

const argPath = process.argv[2] || null;
const outDir = path.join('output', 'qc-dryrun');
await mkdir(outDir, { recursive: true });

let videoPath = argPath;
if (!videoPath) {
  videoPath = path.join(outDir, 'fixture.mp4');
  console.log('▶ Fixture video üretiliyor (36s, 1080x1920, hareketli desen + ses)...');
  await run('ffmpeg', [
    '-y',
    '-f', 'lavfi', '-i', 'testsrc2=size=1080x1920:rate=30:duration=36',
    '-f', 'lavfi', '-i', 'sine=frequency=330:duration=36',
    '-filter:a', 'volume=8dB', // sinüs kaynağı ~-22 LUFS → hedef -14'e taşır
    '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-shortest', videoPath,
  ], { maxBuffer: 20 * 1024 * 1024 });
} else if (!existsSync(videoPath)) {
  console.error(`Dosya yok: ${videoPath}`);
  process.exit(1);
}

console.log(`▶ Teknik preflight: ${videoPath}`);
const pf = await preflightCheck(videoPath, { expectedDuration: argPath ? undefined : 36 });
console.log(`  ok=${pf.ok} | issues: ${pf.issues.length ? pf.issues.join(' | ') : '-'}`);
if (pf.warnings.length) console.log(`  uyarılar: ${pf.warnings.join(' | ')}`);

// Editoryal fixture: gerçek pipeline'da bu veriler script/TTS/medya fazlarından
// gelir; dry-run'da temsilî ama gerçekçi bir set kullanılır.
const words = [];
let t = 0.35;
for (const w of ('this machine should not exist divers found it in a shipwreck but no one ' +
  'knew what it was until x-rays revealed thirty bronze gears turns out the greeks ' +
  'built a computer and one gear still keeps a secret').split(' ')) {
  words.push({ word: w, start: t, end: t + 0.38 });
  t += 0.52;
}
const editorialInput = {
  script: {
    hook_text: "This machine shouldn't exist",
    finale_text: 'One gear still keeps its secret.',
    format: 'story',
    scenes: [
      { narration: 'This machine counted the stars.' },
      { narration: 'Divers found it in a shipwreck, but no one knew what it was.' },
      { narration: 'Inside were thirty bronze gears, until X-rays revealed more.' },
      { narration: 'It predicted eclipses decades ahead.' },
      { narration: 'Turns out the Greeks built a computer.' },
      { narration: 'Nothing this complex appears again for a thousand years.' },
      { narration: 'And one gear still keeps a secret.' },
    ],
  },
  wordTimings: words,
  emphasisWords: ['gears', 'computer'],
  itemSeconds: [3.2, 3.6, 3.6, 3.6, 3.6, 3.6, 3.6, 3.6, 3.8, 3.8],
  itemTypes: ['video', 'photo', 'photo', 'video', 'photo', 'photo', 'video', 'photo', 'video', 'photo'],
  itemSources: ['stock', 'archive', 'ai', 'stock', 'gfx', 'ai', 'stock', 'archive', 'stock', 'ai'],
  editPlan: {
    boundaries: [
      { transition: 'cut', sfx: 'whoosh' },
      { transition: 'fade', sfx: 'none' },
      { transition: 'cut', sfx: 'impact' },
      { transition: 'cut', sfx: 'whoosh' },
    ],
    subscribeScene: 7,
  },
  duration: pf.technical.durationSeconds || 36,
  lufs: pf.technical.lufs ?? -14,
  audioPresent: pf.technical.audioStreamPresent,
};

console.log(`▶ Retention QC (mod: ${config.retention.mode}, eşik: ${config.retention.minScore})...`);
const qc = await runRetentionQC(editorialInput, outDir, {
  technical: pf.technical,
  technicalPassed: pf.ok,
  uploadRequested: false, // DRY-RUN: upload asla istenmez
  platforms: {
    youtube: Boolean(config.youtube.clientId && config.youtube.refreshToken),
    instagram: Boolean(config.meta.userToken || config.meta.igLoginToken),
    facebook: Boolean(config.meta.userToken || (config.meta.pageToken && config.meta.pageId)),
  },
});

const gate = uploadGate({ preflightOk: pf.ok, qc });
console.log('\n===== QC DRY-RUN SONUCU =====');
console.log(`skor                 : ${qc.score}/100`);
console.log(`technicalReady       : ${qc.report?.technicalReady} (mod: ${config.preflight.mode})`);
console.log(`editorialReady       : ${qc.report?.editorialReady}`);
console.log(`productionReady      : ${qc.report?.productionReady}`);
console.log(`uploadAllowedByPolicy: ${qc.report?.uploadAllowedByPolicy} (qc modu: ${config.retention.mode})`);
console.log(`qcExecution          : ${qc.report?.qcExecution.status}${qc.error ? ` (${qc.error})` : ''}`);
console.log(`teknik preflight     : ${pf.ok ? 'GEÇTİ' : 'KALDI: ' + pf.issues.join(' | ')}`);
console.log(`upload kapısı        : ${gate ? 'AÇIK (ama dry-run, upload yok)' : 'KAPALI'}`);
console.log(`uygunluk             : ${JSON.stringify(qc.report?.uploadEligibility)}`);
console.log(`rapor (json)      : ${path.join(outDir, 'production-report.json')}`);
console.log(`rapor (md)        : ${path.join(outDir, 'production-report.md')}`);
