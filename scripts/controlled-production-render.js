import path from 'node:path';
import { mkdir } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { renderProductionVariants } from '../src/video/renderVariants.js';
import { buildCanonicalTimeline } from '../src/pipeline/canonicalTimeline.js';
import { config } from '../src/config.js';

const run = promisify(execFile);
const outDir = path.resolve(process.argv[2] || 'output/controlled-production');
const assetsDir = path.join(outDir, '.controlled-assets');
await mkdir(assetsDir, { recursive: true });
config.video.outro = false;
config.video.tailSeconds = 0;
config.video.subPrompt = false;

const audioPath = path.join(assetsDir, 'narration.wav');
await run('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=310:sample_rate=48000:duration=20', '-ac', '2', audioPath]);
const media = [];
for (let i = 0; i < 6; i += 1) {
  const clip = path.join(assetsDir, `moving-${i}.mp4`);
  await run('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', `testsrc2=size=180x320:rate=10:duration=4,format=yuv420p,hue=h=${i * 47}`, '-c:v', 'libx264', clip]);
  media.push({ path: clip, type: 'video', scene: Math.floor(i / 2), source: 'controlled-local-video', assetId: `controlled-${i}` });
}
const scenes = [
  { narration: 'A genuine moving opening creates an immediate visual hook.' },
  { narration: 'Each long sentence switches to different material halfway through.' },
  { narration: 'The final reveal ends with a visible subscribe button.' },
];
const words = scenes.flatMap((scene) => scene.narration.replace(/[.]/g, '').split(/\s+/));
const wordTimings = words.map((word, i) => ({ word, start: i * 20 / words.length, end: (i + 0.78) * 20 / words.length }));
const timeline = buildCanonicalTimeline({ scenes, wordTimings, duration: 20, timingSource: 'controlled' });
const result = await renderProductionVariants({
  audioPath, wordTimings, media, scenes, timeline, language: 'en',
  musicSeed: 'controlled-production', sfxGain: 5,
}, { outDir, width: 180, height: 320, fps: 10 });
console.log(JSON.stringify({ ok: result.ok, outDir, variants: result.variants }, null, 2));
