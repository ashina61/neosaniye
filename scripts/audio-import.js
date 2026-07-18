#!/usr/bin/env node
import path from 'node:path';
import os from 'node:os';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { runImport } from '../src/audio/importAudio.js';

/**
 * CC0/Public Domain ses kütüphanesi ithalatı.
 *
 * Kullanım:
 *   npm run audio:import              # gerçek import (indirir, doğrular, yazar)
 *   npm run audio:import:dry          # dry-run: indirir + doğrular, HİÇBİR ŞEY yazmaz
 *   node scripts/audio-import.js --source sample-pi   # tek kaynak
 *
 * Kaynaklar config/audio-sources.json'da SABİT commit SHA ile kilitlidir.
 * Ağ gerektirir — unit testlere bağlı değildir (testler fixture kullanır).
 */

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const onlySource = args.includes('--source') ? args[args.indexOf('--source') + 1] : null;

const cacheDir = await mkdtemp(path.join(os.tmpdir(), 'audio-import-'));
try {
  const { summary, manifest, rejected } = await runImport({ dryRun, onlySource, cacheDir });

  console.log('\n===== İTHALAT ÖZETİ =====');
  for (const s of summary.sources) console.log(`  ${s.id}: ${s.status}`);
  console.log(`  kabul: ${summary.accepted.length} | red: ${summary.rejectedCount} | duplicate atlandı: ${summary.skippedDuplicate}`);
  const byType = {};
  for (const a of summary.accepted) byType[a.type] = (byType[a.type] || 0) + 1;
  console.log(`  tür dağılımı (bu çalıştırma): ${JSON.stringify(byType)}`);
  if (dryRun) {
    console.log('  DRY-RUN: hiçbir dosya/manifest yazılmadı.');
  } else {
    console.log(`  manifest toplamı: ${manifest.assets.length} asset, ${rejected.rejected.length} red kaydı`);
    await writeReadme(manifest, rejected);
    console.log('  assets/audio/README.md güncellendi');
  }
} finally {
  await rm(cacheDir, { recursive: true, force: true });
}

/** İnsan-okur kütüphane raporu (assets/audio/README.md). */
async function writeReadme(manifest, rejected) {
  const srcCfg = JSON.parse(await readFile('config/audio-sources.json', 'utf8'));
  const bySource = {};
  for (const a of manifest.assets) (bySource[a.sourceRepository] ||= []).push(a);
  const lines = [
    '# NeoSaniye CC0 Ses Kütüphanesi',
    '',
    'Bu klasördeki TÜM dosyalar açıkça CC0 1.0 / Public Domain lisanslı kaynaklardan,',
    'sabit commit SHA doğrulamasıyla ithal edilmiş ve Shorts için optimize edilmiştir',
    '(48kHz stereo mp3, loudness normalize). Kaynak dosyalar değiştirilmemiştir.',
    '',
    `Son ithalat: ${manifest.generatedAt} · Toplam: ${manifest.assets.length} asset · Red: ${rejected.rejected.length}`,
    '',
    'Yeniden üretme: `npm run audio:import` (kaynak kilidi: `config/audio-sources.json`)',
    '',
    '## Kaynaklar',
    '',
  ];
  for (const s of srcCfg.sources) {
    lines.push(`### ${s.id} ${s.enabled ? '' : '(devre dışı)'}`);
    lines.push(`- Repo: ${s.repository}`);
    lines.push(`- Commit: \`${s.commit}\``);
    lines.push(`- Lisans: ${s.expectedLicense || '—'} · Kanıt: ${s.licenseEvidence?.licenseFile || 'README beyanı'}${s.licenseEvidence?.note ? ` — ${s.licenseEvidence.note}` : ''}`);
    lines.push(`- Kabul edilen yollar: ${s.allowedPaths?.length ? s.allowedPaths.join(', ') : '—'}`);
    lines.push(`- Reddedilen yollar: ${s.rejectedPaths?.length ? s.rejectedPaths.join(', ') : '—'}`);
    lines.push(`- Atıf gerekli mi: hayır (CC0/PD)`);
    lines.push('');
  }
  lines.push('## Dosyalar', '');
  lines.push('| ID | Tür | Süre | Mood | SHA-256 (kaynak) |', '|---|---|---|---|---|');
  for (const a of manifest.assets) {
    lines.push(`| ${a.id} | ${a.type} | ${a.durationSeconds}s | ${(a.moods || []).join('+')} | \`${a.sha256.slice(0, 16)}…\` |`);
  }
  lines.push('', '## Reddedilenler', '', 'Gerekçeler: `manifests/rejected-assets.json`', '');
  await writeFile('assets/audio/README.md', lines.join('\n'));
}
