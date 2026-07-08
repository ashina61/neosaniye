#!/usr/bin/env node
/**
 * Telifsiz müzik indirici (opsiyonel yardımcı).
 *
 * assets/music/ klasörünü telifsiz parçalarla doldurur. Kaynak URL'ler:
 *   1) MUSIC_URLS env (virgülle ayrılmış doğrudan indirme linkleri), veya
 *   2) data/music-urls.json (["https://...mp3", ...]).
 *
 * En sağlam ve YouTube-güvenli yöntem: YouTube Studio → Ses Kitaplığı'ndan
 * (Audio Library) birkaç parça indirip doğrudan assets/music/ içine koymaktır;
 * bu parçalar YouTube'da telif hak talebi almaz. Bu script sadece otomasyon
 * isteyenler içindir ve HİÇBİR koşulda boru hattını kırmaz (best-effort).
 *
 * Kullanım:
 *   MUSIC_URLS="https://a.mp3,https://b.mp3" node scripts/fetch-music.js
 *   node scripts/fetch-music.js   # data/music-urls.json varsa onu kullanır
 */
import { mkdir, writeFile, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const OUT_DIR = process.env.VIDEO_MUSIC_DIR || 'assets/music';
const exts = ['.mp3', '.m4a', '.wav', '.ogg', '.aac', '.opus'];

async function loadUrls() {
  const fromEnv = (process.env.MUSIC_URLS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (fromEnv.length) return fromEnv;
  try {
    const json = JSON.parse(await readFile('data/music-urls.json', 'utf8'));
    if (Array.isArray(json)) return json.filter(Boolean);
  } catch {
    /* yok */
  }
  return [];
}

async function existingCount() {
  try {
    const files = await readdir(OUT_DIR);
    return files.filter((f) => exts.includes(path.extname(f).toLowerCase())).length;
  } catch {
    return 0;
  }
}

async function download(url, dest) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 60000);
  try {
    const res = await fetch(url, { signal: ctrl.signal, redirect: 'follow' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 10000) throw new Error('çok küçük/boş dosya');
    await writeFile(dest, buf);
    return buf.length;
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  const have = await existingCount();
  if (have > 0) {
    console.log(`[music] ${OUT_DIR} zaten ${have} parça içeriyor, indirme atlandı.`);
    return;
  }
  const urls = await loadUrls();
  if (!urls.length) {
    console.log(
      '[music] Kaynak yok (MUSIC_URLS veya data/music-urls.json). ' +
        'İpucu: YouTube Ses Kitaplığı parçalarını assets/music/ içine koy. ' +
        'Müzik olmadan sentetik pad kullanılır.',
    );
    return;
  }
  await mkdir(OUT_DIR, { recursive: true });
  let ok = 0;
  for (let i = 0; i < urls.length; i += 1) {
    const ext = exts.find((e) => urls[i].toLowerCase().includes(e)) || '.mp3';
    const dest = path.join(OUT_DIR, `track-${String(i + 1).padStart(2, '0')}${ext}`);
    try {
      const bytes = await download(urls[i], dest);
      ok += 1;
      console.log(`[music] indirildi: ${path.basename(dest)} (${(bytes / 1e6).toFixed(1)} MB)`);
    } catch (err) {
      console.warn(`[music] atlandı ${urls[i]}: ${err.message}`);
    }
  }
  console.log(`[music] ${ok}/${urls.length} parça hazır.`);
}

main().catch((err) => {
  console.warn('[music] beklenmedik hata (yok sayıldı):', err.message);
  process.exit(0); // asla boru hattını kırma
});
