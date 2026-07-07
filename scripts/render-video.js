#!/usr/bin/env node
/**
 * Faz 4 test aracı: bir "job" JSON'undan video render eder.
 *
 * Kullanım:
 *   node scripts/render-video.js job.json
 *
 * job.json şeması:
 *   {
 *     "audioPath": "output/foo/foo.mp3",
 *     "wordTimings": [{ "word": "Hi", "start": 0.1, "end": 0.4 }, ...],
 *     "media": [{ "path": "output/foo/media/01-video.mp4", "type": "video" }, ...],
 *     "outPath": "output/foo/foo.mp4"
 *   }
 *
 * Ön koşul: ffmpeg + ffprobe kurulu (apt-get install ffmpeg).
 */
import { readFile } from 'node:fs/promises';
import { renderVideo } from '../src/video/renderVideo.js';

const jobPath = process.argv[2];
if (!jobPath) {
  console.error('kullanım: node scripts/render-video.js <job.json>');
  process.exit(2);
}

const job = JSON.parse(await readFile(jobPath, 'utf8'));
const result = await renderVideo(job);
console.log('Video render edildi:');
console.log('  dosya :', result.outPath);
console.log('  süre  :', result.duration.toFixed(2), 'sn');
console.log('  boyut :', `${result.width}x${result.height}`);
console.log('  klip  :', result.clips, 'parça');

process.exit(0);
