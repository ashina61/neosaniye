#!/usr/bin/env node
/**
 * V2 — BUILD AND RENDER A FULL-BLEED REEL.
 *
 *   node scripts/reel2.mjs --episode=<id> [--out=path.mp4] [--crf=28]
 *
 * One picture per spoken line, filling the frame, cut to the measured windows
 * in `audio/vo.json`; the words inside those windows become the burnt-in
 * caption. There is one clock and everything reads from it — which is the whole
 * of the bug that made Remotion's own template land every image a second early.
 *
 * Pictures come from the episode's own `scene-config.json`, because that is
 * already the file that says which image belongs to which line. Nothing here
 * generates artwork: images are files on disk, exactly as in v1.
 */
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {bundle} from '@remotion/bundler';
import {renderMedia, selectComposition} from '@remotion/renderer';
import {ROOT, episodeDir, exists, parseArgs} from './lib/episode.mjs';
import {wordWindows} from './lib/measure.mjs';

const FPS = 30;

/**
 * THE PICTURE A LINE IS ABOUT.
 *
 * A scene names several assets — a wall behind, a fragment in front. The one
 * worth filling the frame with is the DEEPEST layer, the subject, not the
 * backdrop it was standing against: a full-frame shot has no room for a
 * background, so showing the background is showing nothing.
 */
function pictureOf(scene) {
  const layers = scene.layers ?? [];
  if (layers.length) {
    const best = [...layers].sort((a, b) => (b.depth ?? 1) - (a.depth ?? 1))[0];
    const file = best?.role ? scene.assets?.[best.role] ?? scene.assets?.[`?${best.role}`] : null;
    if (file) return file;
  }
  const values = Object.values(scene.assets ?? {});
  return values.length ? String(values[values.length - 1]) : null;
}

async function main() {
  const args = parseArgs();
  const episodeId = typeof args.episode === 'string' ? args.episode : null;
  if (!episodeId) {
    console.error('Usage: node scripts/reel2.mjs --episode=<episode-id> [--out=path.mp4]');
    process.exit(1);
  }

  const dir = episodeDir(episodeId);
  const voice = JSON.parse(await readFile(path.join(dir, 'audio', 'vo.json'), 'utf8').catch(() => 'null'));
  if (!voice?.lines?.length) {
    throw new Error(
      `${episodeId} has no audio/vo.json — v2 is cut to the measured narration, so there is nothing to cut to.\n` +
        `   Run: VOICE_PROVIDER=espeak npm run voice -- --episode=${episodeId}`,
    );
  }
  const config = JSON.parse(await readFile(path.join(dir, 'scene-config.json'), 'utf8'));

  /**
   * ONE PICTURE PER LINE, IN ORDER.
   *
   * A line whose scene was split into continuation shots still gets ONE image:
   * the whole point of this shape is that a photograph filling the frame and
   * moving for six seconds is stronger than the same photograph shown twice
   * from two corners.
   */
  const pictures = [];
  const seen = new Set();
  for (const scene of config.scenes ?? []) {
    const file = pictureOf(scene);
    if (!file) continue;
    const slug = scene.id.replace(/-b$/, '');
    if (seen.has(slug)) continue;
    seen.add(slug);
    pictures.push(file);
  }

  const missing = [];
  const shots = [];
  for (const [index, line] of voice.lines.entries()) {
    const file = pictures[index] ?? pictures[pictures.length - 1];
    if (!file) continue;
    if (!(await exists(path.join(dir, file)))) {
      missing.push(`${line.slug}: ${file}`);
      continue;
    }
    shots.push({image: file, from: Math.round(line.start * FPS), to: Math.round(line.end * FPS)});
  }

  if (!shots.length) {
    throw new Error(
      `${episodeId}: none of the pictures its config names are on disk, so every frame would be black.\n` +
        '   v2 is a photograph filling the frame — without photographs there is no shot to make.',
    );
  }
  if (missing.length) {
    console.log(`⚠ ${missing.length} line(s) have no picture on disk and were dropped:`);
    for (const note of missing) console.log(`   · ${note}`);
  }

  /**
   * WORDS, MEASURED IF THE VOICE RUN LEFT ANY AND SPLIT BY WEIGHT IF NOT.
   *
   * Splitting here rather than rewriting `vo.json` on the way past: an episode
   * voiced before word windows existed is a FINISHED episode, and re-measuring
   * it would move the line boundaries its scenes were already cut to. A v2 pass
   * must not be able to change what v1 renders.
   */
  const words = voice.lines.flatMap((line) =>
    (line.words?.length ? line.words : wordWindows(line.text, null, 22_050, line).words)
      .filter((word) => /[\p{L}\p{N}]/u.test(word.text))
      .map((word) => ({
        text: word.text.replace(/[.,;:]$/, ''),
        from: Math.round(word.start * FPS),
        to: Math.max(Math.round(word.start * FPS) + 1, Math.round(word.end * FPS)),
      })),
  );

  const bed = (await exists(path.join(dir, 'audio', 'bed.wav'))) ? 'audio/bed.wav' : undefined;
  const data = {
    title: config.title,
    audio: voice.audio ?? 'audio/vo.mp3',
    bed,
    bedGain: 0.14,
    shots,
    words,
  };

  await mkdir(path.join(ROOT, 'out'), {recursive: true});
  await writeFile(path.join(dir, 'reel2.json'), `${JSON.stringify(data, null, 2)}\n`, 'utf8');

  console.log(`${episodeId}: ${shots.length} shot(s), ${words.length} word(s), ${(voice.duration ?? 0).toFixed(1)}s`);
  for (const [index, shot] of shots.entries()) {
    console.log(`  ${String(index + 1).padStart(2)}  ${(shot.from / FPS).toFixed(2)}–${(shot.to / FPS).toFixed(2)}s  ${shot.image}`);
  }

  if (args.plan) return;

  console.log('\nbundling…');
  const serveUrl = await bundle({
    entryPoint: path.join(ROOT, 'engine', 'v2', 'index.tsx'),
    publicDir: dir,
    onProgress: () => undefined,
  });

  const browserExecutable = process.env.REMOTION_BROWSER_EXECUTABLE || undefined;
  const inputProps = {data};
  const composition = await selectComposition({serveUrl, id: 'Reel', inputProps, browserExecutable});

  const outPath = path.resolve(
    typeof args.out === 'string' ? args.out : path.join(ROOT, 'out', `${episodeId}-v2.mp4`),
  );
  console.log(`rendering ${composition.durationInFrames} frames (${(composition.durationInFrames / FPS).toFixed(1)}s)…`);

  let last = -1;
  await renderMedia({
    composition,
    serveUrl,
    codec: 'h264',
    outputLocation: outPath,
    inputProps,
    crf: Number(args.crf ?? 26),
    pixelFormat: 'yuv420p',
    concurrency: Number(process.env.REMOTION_CONCURRENCY ?? 4),
    browserExecutable,
    onProgress: ({progress}) => {
      const percent = Math.floor(progress * 100);
      if (percent > last && percent % 20 === 0) {
        last = percent;
        console.log(`  ${percent}%`);
      }
    },
  });

  console.log(`✓ ${path.relative(ROOT, outPath)}`);
}

main().catch((error) => {
  console.error(`✗ ${error?.message ?? error}`);
  process.exit(1);
});
