#!/usr/bin/env node
/**
 * ASSEMBLE AND RENDER.
 *
 *   node scripts/broll-render.mjs --episode=<id> [--plan]
 *
 * Cuts every beat to its measured voiceover window and hands the whole thing to
 * the three-layer engine. If a beat's assets are not on disk yet it says so and
 * stops — a reel rendered with half its cut-outs missing looks finished and is
 * not, which is the single most expensive way for this pipeline to fail.
 */
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {bundle} from '@remotion/bundler';
import {renderMedia, selectComposition} from '@remotion/renderer';
import {ROOT, episodeDir, exists, parseArgs} from './lib/episode.mjs';

const FPS = 30;

async function main() {
  const args = parseArgs();
  const id = typeof args.episode === 'string' ? args.episode : null;
  if (!id) {
    console.error('Usage: node scripts/broll-render.mjs --episode=<episode-id>');
    process.exit(1);
  }
  const dir = episodeDir(id);
  const brief = JSON.parse(await readFile(path.join(dir, 'brief.json'), 'utf8'));
  const plan = JSON.parse(await readFile(path.join(dir, 'shots.json'), 'utf8'));
  const voice = JSON.parse(await readFile(path.join(dir, 'audio', 'vo.json'), 'utf8').catch(() => 'null'));

  /**
   * THE WINDOWS. Measured if a voiceover has been through the clock; estimated
   * from word count if not — and it SAYS which, because a reel cut to guesses
   * is a draft and must not look like a finished one.
   */
  let windows;
  if (voice?.lines?.length === plan.beats.length) {
    windows = voice.lines.map((line) => [Math.round(line.start * FPS), Math.round(line.end * FPS)]);
    console.log(`clock: ${voice.audio} — ${voice.how}, ${voice.duration.toFixed(1)}s`);
  } else {
    let at = 0;
    windows = plan.beats.map((beat) => {
      const words = (beat.vo || '').split(/\s+/).filter(Boolean).length;
      const len = Math.max(45, Math.round((words / 2.7) * FPS) + 10);
      const span = [at, at + len];
      at += len;
      return span;
    });
    console.log('clock: TAHMİNİ — seslendirme yok, süreler kelime sayısından. Bu bir taslak.');
  }

  const beats = plan.beats.map((beat, i) => ({
    ...beat,
    bg: beat.bg ? {...beat.bg, file: `assets/${beat.bg.file}`} : null,
    mid: beat.mid.map((l) => ({...l, file: `assets/${l.file}`})),
    fore: beat.fore.map((l) => ({...l, file: `assets/${l.file}`})),
    from: windows[i][0],
    to: windows[i][1],
  }));

  const missing = [];
  for (const beat of beats) {
    for (const layer of [beat.bg, ...beat.mid, ...beat.fore].filter(Boolean)) {
      if (!(await exists(path.join(dir, layer.file)))) missing.push(layer.file);
    }
  }
  const background = brief.background ? 'assets/background.png' : undefined;
  if (background && !(await exists(path.join(dir, background)))) missing.push(background);

  const data = {
    background,
    accent: brief.look?.accent ?? '#E04329',
    ink: brief.look?.ink ?? '#1A1A1A',
    audio: voice?.audio,
    music: (await exists(path.join(dir, 'audio', 'music.mp3'))) ? 'audio/music.mp3' : undefined,
    musicGain: 0.2,
    beats,
    end: windows[windows.length - 1][1],
  };
  await writeFile(path.join(dir, 'broll.json'), `${JSON.stringify(data, null, 2)}\n`, 'utf8');

  console.log(`${id}: ${beats.length} beat, ${(data.end / FPS).toFixed(1)}s`);
  for (const [i, beat] of beats.entries()) {
    console.log(
      `  ${String(i + 1).padStart(2)}  ${(beat.from / FPS).toFixed(2)}–${(beat.to / FPS).toFixed(2)}s  ` +
        `${beat.mid.length} orta + ${beat.fore.length} ön   ${beat.vo.slice(0, 46)}`,
    );
  }

  if (missing.length) {
    console.error(`\n✗ ${missing.length} görsel eksik — render durdu:`);
    for (const file of [...new Set(missing)]) console.error(`   · ${file}`);
    console.error(`\n   Promptları: episodes/${id}/PROMPTS.md`);
    console.error(`   raw/ içine attıktan sonra: npm run broll:key -- --episode=${id}`);
    process.exit(1);
  }
  if (args.plan) return;

  const [w, h] = plan.frame;
  const serveUrl = await bundle({
    entryPoint: path.join(ROOT, 'engine', 'broll', 'index.tsx'),
    publicDir: dir,
    onProgress: () => undefined,
  });
  const browserExecutable = process.env.REMOTION_BROWSER_EXECUTABLE || undefined;
  const composition = await selectComposition({serveUrl, id: 'Broll', inputProps: {data}, browserExecutable});

  await mkdir(path.join(ROOT, 'out'), {recursive: true});
  const out = path.join(ROOT, 'out', `${id}.mp4`);
  let last = -1;
  await renderMedia({
    composition: {...composition, width: w, height: h},
    serveUrl,
    codec: 'h264',
    outputLocation: out,
    inputProps: {data},
    crf: Number(args.crf ?? 22),
    pixelFormat: 'yuv420p',
    concurrency: Number(process.env.REMOTION_CONCURRENCY ?? 3),
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
