#!/usr/bin/env node
/**
 * RENDER A CODE-DRAWN SHORT.
 *
 *   node scripts/render-short.mjs --episode=paper-moon [--crf=26]
 *
 * The scene boundaries are the MEASURED line windows in `audio/vo.json`. There
 * is one clock: the words on screen and the pictures under them come off the
 * same file, so a scene cannot drift away from the sentence it illustrates.
 */
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {bundle} from '@remotion/bundler';
import {renderMedia, selectComposition} from '@remotion/renderer';
import {ROOT, episodeDir, exists, parseArgs} from './lib/episode.mjs';

const FPS = 30;

async function main() {
  const args = parseArgs();
  const id = typeof args.episode === 'string' ? args.episode : 'paper-moon';
  const dir = episodeDir(id);
  const voice = JSON.parse(await readFile(path.join(dir, 'audio', 'vo.json'), 'utf8'));

  const marks = [0, ...voice.lines.map((line) => Math.round(line.end * FPS))];
  /**
   * EVERY WORD CARRIES THE LINE IT CAME FROM.
   *
   * Guessing the sentence boundary from the gap between two words fails at the
   * exact place it matters: this narrator leaves 0.38s between lines, which is
   * 11 frames, and any threshold loose enough to survive a fast reading is also
   * loose enough to run two sentences together. The boundary is KNOWN here —
   * so it is carried rather than inferred, and a caption can never show the
   * tail of one sentence under the head of the next.
   */
  const words = voice.lines.flatMap((line, index) =>
    (line.words ?? [])
      .filter((word) => /[\p{L}\p{N}]/u.test(word.text))
      .map((word) => ({
        text: word.text.replace(/[.,;:]$/, ''),
        line: index,
        from: Math.round(word.start * FPS),
        to: Math.max(Math.round(word.start * FPS) + 1, Math.round(word.end * FPS)),
      })),
  );

  const bed = (await exists(path.join(dir, 'audio', 'bed.wav'))) ? 'audio/bed.wav' : undefined;
  const data = {audio: voice.audio, bed, bedGain: 0.1, marks, words};
  await writeFile(path.join(dir, 'short.json'), `${JSON.stringify(data, null, 2)}\n`, 'utf8');

  console.log(`${id}: ${marks.length - 1} scene(s), ${words.length} word(s), ${(marks.at(-1) / FPS).toFixed(1)}s`);
  if (args.plan) return;

  const serveUrl = await bundle({
    entryPoint: path.join(ROOT, 'engine', 'shorts', 'index.tsx'),
    publicDir: dir,
    onProgress: () => undefined,
  });
  const browserExecutable = process.env.REMOTION_BROWSER_EXECUTABLE || undefined;
  const inputProps = {data};
  const composition = await selectComposition({serveUrl, id: 'Short', inputProps, browserExecutable});

  await mkdir(path.join(ROOT, 'out'), {recursive: true});
  const out = path.join(ROOT, 'out', `${id}.mp4`);
  let last = -1;
  await renderMedia({
    composition,
    serveUrl,
    codec: 'h264',
    outputLocation: out,
    inputProps,
    crf: Number(args.crf ?? 26),
    pixelFormat: 'yuv420p',
    concurrency: Number(process.env.REMOTION_CONCURRENCY ?? 4),
    browserExecutable,
    onProgress: ({progress}) => {
      const percent = Math.floor(progress * 100);
      if (percent > last && percent % 25 === 0) (last = percent), console.log(`  ${percent}%`);
    },
  });
  console.log(`✓ ${path.relative(ROOT, out)}`);
}

main().catch((error) => {
  console.error(`✗ ${error?.stack ?? error?.message ?? error}`);
  process.exit(1);
});
