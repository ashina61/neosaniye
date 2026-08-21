#!/usr/bin/env node
/**
 * ONE CONTINUOUS ZOOM, RENDERED.
 *
 *   node scripts/render-zoom.mjs --episode=paper-moon [--seconds=30]
 *
 * No voiceover and no vo.json: this shape is scored, not narrated. The only
 * clock is the fold count, and the music was written to land on it.
 */
import {mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {bundle} from '@remotion/bundler';
import {renderMedia, selectComposition} from '@remotion/renderer';
import {ROOT, episodeDir, exists, parseArgs} from './lib/episode.mjs';

const FPS = 30;

async function main() {
  const args = parseArgs();
  const id = typeof args.episode === 'string' ? args.episode : 'paper-moon';
  const dir = episodeDir(id);
  const seconds = Number(args.seconds ?? 30);

  const data = {
    score: (await exists(path.join(dir, 'audio', 'score.wav'))) ? 'audio/score.wav' : undefined,
    base: 0.1,
    ratio: 2,
    folds: 42,
    end: Math.round(seconds * FPS),
    title: {pre: 'bir kağıdı', big: '42', post: 'kez katlarsan'},
    close: {pre: 'ama katlayamazsın', big: '12', post: 'dünya rekoru'},
  };
  await writeFile(path.join(dir, 'zoom.json'), `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  console.log(`${id}: ${data.folds} folds over ${seconds}s${data.score ? ' + score' : ' (no score)'}`);
  if (args.plan) return;

  const serveUrl = await bundle({
    entryPoint: path.join(ROOT, 'engine', 'shorts', 'zoom-root.tsx'),
    publicDir: dir,
    onProgress: () => undefined,
  });
  const browserExecutable = process.env.REMOTION_BROWSER_EXECUTABLE || undefined;
  const composition = await selectComposition({serveUrl, id: 'Zoom', inputProps: {data}, browserExecutable});

  await mkdir(path.join(ROOT, 'out'), {recursive: true});
  const out = path.join(ROOT, 'out', `${id}-zoom.mp4`);
  let last = -1;
  await renderMedia({
    composition,
    serveUrl,
    codec: 'h264',
    outputLocation: out,
    inputProps: {data},
    crf: Number(args.crf ?? 22),
    pixelFormat: 'yuv420p',
    concurrency: Number(process.env.REMOTION_CONCURRENCY ?? 4),
    browserExecutable,
    onProgress: ({progress}) => {
      const p = Math.floor(progress * 100);
      if (p > last && p % 25 === 0) (last = p), console.log(`  ${p}%`);
    },
  });
  console.log(`✓ ${path.relative(ROOT, out)}`);
}

main().catch((error) => {
  console.error(`✗ ${error?.stack ?? error?.message ?? error}`);
  process.exit(1);
});
