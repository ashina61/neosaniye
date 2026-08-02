#!/usr/bin/env node
/**
 * Faz 4 test aracı: bir job JSON dosyasını NeoSaniye Remotion motoruyla işler.
 *
 * Kullanım:
 *   npm run remotion:install
 *   node scripts/render-video.js job.json
 *
 * Zorunlu job alanları:
 *   audioPath, scenes, media, mediaScene, timeline, outPath
 *
 * ffmpeg/ffprobe yalnız ses süresi ve final teknik doğrulaması için gereklidir;
 * görüntü montajını Remotion yapar.
 */
import {readFile} from 'node:fs/promises';
import {renderVideo} from '../src/video/renderVideo.js';

const jobPath = process.argv[2];
if (!jobPath) {
  console.error('kullanım: node scripts/render-video.js <job.json>');
  process.exit(2);
}

const job = JSON.parse(await readFile(jobPath, 'utf8'));
const result = await renderVideo(job);
console.log('Remotion video render edildi:');
console.log('  dosya :', result.outPath);
console.log('  süre  :', result.duration.toFixed(2), 'sn');
console.log('  boyut :', `${result.width}x${result.height}`);
console.log('  sahne :', result.clips);
console.log('  plan  :', result.productionSpecPath);
