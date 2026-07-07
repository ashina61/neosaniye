#!/usr/bin/env node
/**
 * Faz 6 test aracı: bir mp4'ü YouTube'a yükler (metadata Gemini ile üretilir).
 *
 * Kullanım:
 *   node scripts/upload-youtube.js <video.mp4> <script.json>
 *
 * Ön koşul: .env içinde YOUTUBE_CLIENT_ID / SECRET / REFRESH_TOKEN (bkz.
 * docs/youtube-oauth-setup.md) ve metadata için GEMINI_API_KEY.
 * Gizlilik için: YOUTUBE_PRIVACY=private ile önce test etmen önerilir.
 */
import { readFile } from 'node:fs/promises';
import { buildMetadata } from '../src/youtube/buildMetadata.js';
import { uploadVideo } from '../src/youtube/uploadVideo.js';

const [videoPath, scriptPath] = process.argv.slice(2);
if (!videoPath || !scriptPath) {
  console.error('kullanım: node scripts/upload-youtube.js <video.mp4> <script.json>');
  process.exit(2);
}

const script = JSON.parse(await readFile(scriptPath, 'utf8'));

console.log('Metadata üretiliyor...');
const meta = await buildMetadata(script);
console.log('  başlık:', meta.title);

console.log('Yükleniyor...');
const { videoId, url } = await uploadVideo({ videoPath, ...meta });
console.log('Yüklendi! ->', url, `(id: ${videoId})`);

process.exit(0);
