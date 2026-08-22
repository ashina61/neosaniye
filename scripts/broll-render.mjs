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
import {mkdir, readFile, readdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {bundle} from '@remotion/bundler';
import {renderMedia, selectComposition} from '@remotion/renderer';
import {ROOT, episodeDir, exists, parseArgs} from './lib/episode.mjs';

const FPS = 30;

/** A Chromium already installed on this machine, or undefined to let Remotion
 *  fetch its own. */
async function findBrowser() {
  const roots = ['/opt/pw-browsers'];
  // headless_shell FIRST, across every install, before falling back to a full
  // Chrome: the full binary dropped old headless mode and refuses to launch
  // this way, so finding it first is finding the one that does not work.
  for (const leaf of ['chrome-linux/headless_shell', 'chrome-linux/chrome']) {
    for (const root of roots) {
      for (const entry of await readdir(root).catch(() => [])) {
        const candidate = path.join(root, entry, leaf);
        if (await exists(candidate)) return candidate;
      }
    }
  }
  return undefined;
}

/** The first of these that is actually on disk, as an episode-relative path. */
async function first(dir, candidates) {
  for (const rel of candidates) if (await exists(path.join(dir, rel))) return rel;
  return null;
}

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

  /**
   * `--allow-missing` cuts the film with the pictures that ARE here.
   *
   * Not a convenience: between writing a brief and having fifteen images there
   * is a day, and the timing, the graphics and the captions are all decidable
   * in that day. A cut you can look at before you go shopping is how you find
   * out that a beat does not need the picture you were about to ask for.
   */
  const allowMissing = args['allow-missing'] === true || args['allow-missing'] === 'true';
  const missing = [];
  for (const beat of beats) {
    for (const layer of [beat.bg, ...beat.mid, ...beat.fore].filter(Boolean)) {
      if (!(await exists(path.join(dir, layer.file)))) missing.push(layer.file);
    }
  }
  let background = brief.background ? 'assets/background.png' : undefined;
  if (background && !(await exists(path.join(dir, background)))) {
    missing.push(background);
    if (allowMissing) background = undefined;
  }

  const data = {
    background,
    accent: brief.look?.accent ?? '#E04329',
    ink: brief.look?.ink ?? '#1A1A1A',
    paper: brief.look?.paper ?? '#F4F1E8',
    ground: brief.look?.ground ?? '#DAD9D5',
    label: brief.look?.label ?? brief.title,
    grain: brief.look?.grain,
    vignette: brief.look?.vignette,
    audio: voice?.audio,
    // A score if the episode has one, a room tone if it has only that. Either
    // way SOMETHING is under the voice: a reel carrying narration alone drops
    // into absolute digital silence between sentences, and the ear reads that
    // as the sound cutting out, not as a pause.
    music: (await first(dir, ['audio/music.mp3', 'audio/score.wav', 'audio/bed.wav'])) ?? undefined,
    musicGain: Number(args.musicGain ?? 0.26),
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

  if (missing.length && !allowMissing) {
    console.error(`\n✗ ${missing.length} görsel eksik — render durdu:`);
    for (const file of [...new Set(missing)]) console.error(`   · ${file}`);
    console.error(`\n   Promptları: episodes/${id}/PROMPTS.md`);
    console.error(`   raw/ içine attıktan sonra: npm run broll:key -- --episode=${id}`);
    console.error(`   Sadece kesimi görmek için: --allow-missing`);
    process.exit(1);
  }
  if (missing.length) {
    const gone = new Set(missing);
    console.log(`⚠ TASLAK: ${gone.size} görsel yok, o katmanlar boş geçiliyor.`);
    for (const beat of beats) {
      if (beat.bg && gone.has(beat.bg.file)) beat.bg = null;
      beat.mid = beat.mid.filter((l) => !gone.has(l.file));
      beat.fore = beat.fore.filter((l) => !gone.has(l.file));
    }
  }
  if (args.plan) return;

  const [w, h] = plan.frame;
  const serveUrl = await bundle({
    entryPoint: path.join(ROOT, 'engine', 'broll', 'index.tsx'),
    publicDir: dir,
    onProgress: () => undefined,
  });
  /**
   * THE BROWSER IS ALREADY HERE.
   *
   * Left to itself Remotion downloads its own headless shell on first render,
   * and on a machine whose egress policy does not list that host the whole run
   * dies at 403 — after the bundle, after the plan, at the last step. There is
   * a Chromium on this image; use it.
   */
  const browserExecutable =
    process.env.REMOTION_BROWSER_EXECUTABLE ||
    (await findBrowser());
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
