#!/usr/bin/env node
/**
 * SEPTEMBER 1939, RENDERED.
 *
 *   node scripts/render-war.mjs [--seconds=49] [--crf=20]
 */
import {mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {bundle} from '@remotion/bundler';
import {renderMedia, selectComposition} from '@remotion/renderer';
import {ROOT, episodeDir, exists, parseArgs} from './lib/episode.mjs';

const FPS = 30;

async function main() {
  const args = parseArgs();
  const id = typeof args.episode === 'string' ? args.episode : 'sept-1939';
  const dir = episodeDir(id);
  const seconds = Number(args.seconds ?? 49);
  const data = {
    score: (await exists(path.join(dir, 'audio', 'score.wav'))) ? 'audio/score.wav' : undefined,
    end: Math.round(seconds * FPS),
  };
  await writeFile(path.join(dir, 'war.json'), `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  console.log(`${id}: ${seconds}s${data.score ? ' + score' : ' (no score)'}`);
  if (args.plan) return;

  const serveUrl = await bundle({
    entryPoint: path.join(ROOT, 'engine', 'war', 'index.tsx'),
    publicDir: dir,
    onProgress: () => undefined,
  });
  const browserExecutable = process.env.REMOTION_BROWSER_EXECUTABLE || undefined;
  const composition = await selectComposition({serveUrl, id: 'War', inputProps: {data}, browserExecutable});

  await mkdir(path.join(ROOT, 'out'), {recursive: true});
  const out = path.join(ROOT, 'out', `${id}.mp4`);
  let last = -1;
  await renderMedia({
    composition,
    serveUrl,
    codec: 'h264',
    outputLocation: out,
    inputProps: {data},
    crf: Number(args.crf ?? 20),
    pixelFormat: 'yuv420p',
    concurrency: Number(process.env.REMOTION_CONCURRENCY ?? 3),
    browserExecutable,
    onProgress: ({progress}) => {
      const p = Math.floor(progress * 100);
      if (p > last && p % 20 === 0) (last = p), console.log(`  ${p}%`);
    },
  });
  console.log(`✓ ${path.relative(ROOT, out)}`);
}

main().catch((error) => {
  console.error(`✗ ${error?.stack ?? error?.message ?? error}`);
  process.exit(1);
});
