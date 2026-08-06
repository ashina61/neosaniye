#!/usr/bin/env node
/**
 * GENERATE ONE EPISODE'S ARTWORK — and then get out of the way.
 *
 * This script is NOT part of the render. It runs on its own, writes PNGs into
 * episodes/<id>/assets/, and the workflow commits them. From that moment the
 * artwork is an ordinary file on disk: the render never calls a generator, the
 * validator checks the file the way it checks any other, and a generator that
 * starts returning garbage next month breaks THIS step rather than a render.
 *
 * That separation is the whole lesson of the previous pipeline, which generated
 * its pictures during the run and therefore could never be trusted twice.
 *
 *   node scripts/generate-assets.mjs --episode=zodiac-1969 [--force] [--only=a.png,b.png]
 *
 * Recipes live in episodes/<id>/assets.json — prompts are the episode's
 * business, exactly like the file names are.
 */
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import sharp from 'sharp';
import {ROOT, episodeDir, exists, parseArgs} from './lib/episode.mjs';
import {clearPlaceholders, readPlaceholders} from './lib/placeholders.mjs';

/** Keyless by default. Point elsewhere with IMAGE_BASE_URL if you have a key. */
const BASE_URL = process.env.IMAGE_BASE_URL || 'https://image.pollinations.ai/prompt/';
const MODEL = process.env.IMAGE_MODEL || 'flux';
const ATTEMPTS = 4;

/**
 * What a cut-out is asked for, on top of the episode's own `styleAlpha`.
 *
 * Kept short and put FIRST, ahead of the subject description, because the
 * instruction that loses is the one that arrives last. The episode's film-look
 * style is deliberately NOT applied to these: asking for grain and 1969
 * available light is asking for a room, and a room has no backdrop to key.
 * The period treatment is added to the whole frame at render time by FilmLook,
 * so baking it into a cut-out was never buying anything anyway.
 */
const CUTOUT_INSTRUCTION =
  'a single object photographed alone against a completely plain empty seamless studio backdrop of one flat solid colour, ' +
  'nothing else in the picture at all, no room, no floor, no horizon, no scenery, no props, ' +
  'the whole subject well inside the frame with a clear empty margin on all four sides';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Same name, same picture, every run. */
function seedFor(name) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < name.length; i += 1) {
    h ^= name.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h % 1_000_000;
}

async function fetchImage(prompt, width, height, seed) {
  // Diffusion models want dimensions on a multiple of 64, and asking for the
  // final size directly costs quality on tall frames — request a sane box and
  // let sharp do the last resize.
  const long = Math.min(1280, Math.max(width, height));
  const short = Math.round((long * Math.min(width, height)) / Math.max(width, height));
  const [reqW, reqH] = width >= height ? [long, short] : [short, long];
  const round64 = (n) => Math.max(256, Math.round(n / 64) * 64);

  const url =
    `${BASE_URL}${encodeURIComponent(prompt)}` +
    `?width=${round64(reqW)}&height=${round64(reqH)}&seed=${seed}` +
    `&model=${encodeURIComponent(MODEL)}&nologo=true&safe=false`;

  let lastError;
  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: process.env.IMAGE_API_KEY ? {Authorization: `Bearer ${process.env.IMAGE_API_KEY}`} : {},
        signal: AbortSignal.timeout(180_000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const buffer = Buffer.from(await response.arrayBuffer());
      // A provider under load answers 200 with an error page; a real photo is
      // never this small, and sharp will reject it if it is not an image.
      if (buffer.length < 20_000) throw new Error(`response too small (${buffer.length} bytes)`);
      await sharp(buffer).metadata();
      return buffer;
    } catch (error) {
      lastError = error;
      if (attempt < ATTEMPTS) await sleep(2000 * 2 ** (attempt - 1));
    }
  }
  throw new Error(`${ATTEMPTS} attempts failed — ${lastError?.message ?? lastError}`);
}

/**
 * KEY OUT THE BACKDROP — whatever colour it turned out to be.
 *
 * The first version measured GREENNESS, which quietly made the whole step
 * depend on a diffusion model obeying an instruction to paint a chroma screen.
 * It does not: asked for a 1969 documentary photograph of a man, it draws a
 * room, because that is the stronger instruction. Every keyed asset came back
 * 100% opaque and was refused.
 *
 * So this measures nothing about colour. It grows a region inward from the
 * FRAME EDGES, which is the one thing that is reliably backdrop, and stops
 * where the picture changes. Two tolerances, because a real backdrop is neither
 * perfectly flat nor arbitrarily varied:
 *
 *   LOCAL   a pixel joins if it resembles the neighbour it spread from. This is
 *           what lets a soft studio gradient be followed all the way in.
 *   GLOBAL  and it must still resemble the border it started from, so the
 *           region cannot creep through a gradient into the subject.
 *
 * Because it spreads only from the edges, a colour ENCLOSED by the subject is
 * safe: a white shirt on a white backdrop keeps its shirt. That is the case a
 * threshold on colour alone always gets wrong.
 */
export async function keyBackdrop(buffer, {local = 26, global: globalTol = 96, holes = false} = {}) {
  const {data, info} = await sharp(buffer).ensureAlpha().raw().toBuffer({resolveWithObject: true});
  const {width, height, channels} = info;
  const at = (x, y) => (y * width + x) * channels;

  // The backdrop is whatever the border mostly is. Median, not mean, so one
  // dark corner or a stray highlight does not drag the reference off.
  const border = [];
  for (let x = 0; x < width; x += 1) border.push(at(x, 0), at(x, height - 1));
  for (let y = 0; y < height; y += 1) border.push(at(0, y), at(width - 1, y));
  const median = (offset) => {
    const values = border.map((i) => data[i + offset]).sort((a, b) => a - b);
    return values[values.length >> 1];
  };
  const seed = [median(0), median(1), median(2)];

  const diff = (i, r, g, b) =>
    Math.max(Math.abs(data[i] - r), Math.abs(data[i + 1] - g), Math.abs(data[i + 2] - b));

  const backdrop = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let head = 0;
  let tail = 0;

  const seedPixel = (x, y) => {
    const id = y * width + x;
    if (backdrop[id]) return;
    if (diff(at(x, y), seed[0], seed[1], seed[2]) > globalTol) return;
    backdrop[id] = 1;
    queue[tail++] = id;
  };
  for (let x = 0; x < width; x += 1) seedPixel(x, 0), seedPixel(x, height - 1);
  for (let y = 0; y < height; y += 1) seedPixel(0, y), seedPixel(width - 1, y);

  while (head < tail) {
    const id = queue[head++];
    const x = id % width;
    const y = (id / width) | 0;
    const from = at(x, y);
    const [fr, fg, fb] = [data[from], data[from + 1], data[from + 2]];

    const spread = (nx, ny) => {
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) return;
      const nid = ny * width + nx;
      if (backdrop[nid]) return;
      const n = at(nx, ny);
      if (diff(n, fr, fg, fb) > local) return;
      if (diff(n, seed[0], seed[1], seed[2]) > globalTol) return;
      backdrop[nid] = 1;
      queue[tail++] = nid;
    };
    spread(x + 1, y), spread(x - 1, y), spread(x, y + 1), spread(x, y - 1);
  }

  // Eat one pixel into the subject. The boundary ring is half backdrop by the
  // time it is sampled, and leaving it behind draws a coloured halo around the
  // cut-out that is obvious the moment it sits on a different background.
  const grown = Uint8Array.from(backdrop);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const id = y * width + x;
      if (backdrop[id]) continue;
      if (
        (x > 0 && backdrop[id - 1]) ||
        (x < width - 1 && backdrop[id + 1]) ||
        (y > 0 && backdrop[id - width]) ||
        (y < height - 1 && backdrop[id + width])
      ) {
        grown[id] = 1;
      }
    }
  }

  // OPT-IN: also key backdrop the fill could never reach, because the subject
  // encloses it. An empty picture frame is the case that forces this — its
  // window is backdrop, walled off by the frame, and left opaque it covers
  // whatever the frame is supposed to be framing. Off by default: matching on
  // colour alone anywhere in the picture is exactly what eats a white shirt.
  if (holes) {
    for (let id = 0; id < grown.length; id += 1) {
      if (!grown[id] && diff(id * channels, seed[0], seed[1], seed[2]) <= Math.min(local, 24)) {
        grown[id] = 1;
      }
    }
  }

  for (let id = 0; id < grown.length; id += 1) {
    if (grown[id]) data[id * channels + 3] = 0;
  }

  const raw = {width, height, channels};
  const rgb = await sharp(data, {raw}).removeAlpha().raw().toBuffer();
  // Feather the edge. A hard binary alpha reads as cut with scissors.
  const alpha = await sharp(data, {raw}).extractChannel(3).blur(1.2).raw().toBuffer();

  return sharp(rgb, {raw: {width, height, channels: 3}})
    .joinChannel(alpha, {raw: {width, height, channels: 1}})
    .png()
    .toBuffer();
}

async function buildAsset(name, recipe, kinds, recipes) {
  const kind = kinds[recipe.kind];
  if (!kind) throw new Error(`unknown kind "${recipe.kind}"`);

  const width = recipe.width ?? kind.width;
  const height = recipe.height ?? kind.height;

  // A cut-out and a backdrop want opposite pictures, so they do not share a
  // style. The framing instruction leads; the description follows.
  const parts = kind.alpha
    ? [CUTOUT_INSTRUCTION, recipe.prompt, recipes.styleAlpha]
    : [recipe.prompt, recipes.style];
  if (recipes.negative) parts.push(`avoid: ${recipes.negative}`);

  const prompt = parts.filter(Boolean).join('. ');
  const seed = seedFor(name);

  if (!kind.alpha) {
    const raw = await fetchImage(prompt, width, height, seed);
    return sharp(raw).resize(width, height, {fit: 'cover', position: 'attention'}).png().toBuffer();
  }

  // A diffusion model asked for an object on an empty backdrop sometimes draws
  // the room anyway, and that picture has nothing to key. It is a roll of the
  // dice rather than a broken prompt, so a rejected draw is re-rolled on a
  // derived seed — still deterministic, just a different one.
  let refusal;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const raw = await fetchImage(prompt, width, height, seed + attempt * 7919);
    const keyed = await keyBackdrop(raw, {holes: Boolean(recipe.keyHoles)});

    // A cut-out that keyed away to nothing, or that kept everything, renders as
    // an empty scene or as a rectangle with visible corners. Neither is worth
    // writing, and both look fine until the reel is watched.
    const solid = await opaqueFraction(keyed);
    if (solid < 0.04 || solid > 0.97) {
      refusal =
        solid < 0.04
          ? `keyed away to nothing (${(solid * 100).toFixed(1)}% opaque)`
          : `nothing keyed out (${(solid * 100).toFixed(1)}% opaque)`;
      continue;
    }

    // Trim the transparent margin so the file's bottom edge IS the subject's
    // feet — that is what footY in the config is anchoring to.
    const trimmed = await sharp(keyed)
      .trim({background: {r: 0, g: 0, b: 0, alpha: 0}, threshold: 6})
      .toBuffer()
      .catch(() => keyed);

    return sharp(trimmed).resize(width, height, {fit: 'inside', withoutEnlargement: false}).png().toBuffer();
  }

  throw new Error(`${refusal} — 3 draws refused`);
}

/**
 * Should this asset be drawn?
 *
 * "The file is already there" is NOT enough to skip, and getting that wrong
 * makes the whole step a no-op: an episode is scaffolded with stand-ins, the
 * stand-ins are committed, and then every single asset looks present. The run
 * goes green having drawn nothing, and the reel is still grey boxes.
 *
 * A stand-in is a hole with a PNG in it. The ledger is what tells them apart,
 * so the ledger — not the file system — decides.
 */
export function shouldDraw({onDisk, isStandIn, force}) {
  if (force) return true;
  if (!onDisk) return true;
  return isStandIn;
}

/** How much of the picture survived the key — a fully keyed frame is a failure. */
async function opaqueFraction(buffer) {
  const {data, info} = await sharp(buffer).ensureAlpha().raw().toBuffer({resolveWithObject: true});
  let solid = 0;
  let total = 0;
  for (let i = 3; i < data.length; i += info.channels) {
    total += 1;
    if (data[i] > 200) solid += 1;
  }
  return total ? solid / total : 0;
}

async function main() {
  const args = parseArgs();
  const episodeId = typeof args.episode === 'string' ? args.episode : null;
  if (!episodeId) {
    console.error('Usage: node scripts/generate-assets.mjs --episode=<episode-id> [--force] [--only=a.png,b.png]');
    process.exit(1);
  }

  const dir = episodeDir(episodeId);
  const recipeFile = path.join(dir, 'assets.json');
  let recipes;
  try {
    recipes = JSON.parse(await readFile(recipeFile, 'utf8'));
  } catch (error) {
    console.error(`No usable assets.json for "${episodeId}": ${error.message}`);
    process.exit(1);
  }

  const outDir = path.join(dir, 'assets');
  await mkdir(outDir, {recursive: true});

  const only = typeof args.only === 'string' ? new Set(args.only.split(',').map((s) => s.trim())) : null;
  const entries = Object.entries(recipes.assets ?? {}).filter(([name]) => !only || only.has(name));
  const standIns = new Set(await readPlaceholders(dir));

  const made = [];
  const skipped = [];
  const failed = [];

  const plan = [];
  for (const [name, recipe] of entries) {
    const draw = shouldDraw({
      onDisk: await exists(path.join(outDir, name)),
      isStandIn: standIns.has(name),
      force: Boolean(args.force),
    });
    if (draw) plan.push([name, recipe]);
    else skipped.push(name);
  }

  if (args['dry-run']) {
    console.log(`Would draw ${plan.length}, skip ${skipped.length} (already real artwork).`);
    for (const [name] of plan) console.log(`  + ${name}${standIns.has(name) ? ' (replacing a stand-in)' : ''}`);
    return;
  }

  for (const [name, recipe] of plan) {
    const target = path.join(outDir, name);
    process.stdout.write(`  ${name} … `);
    try {
      const png = await buildAsset(name, recipe, recipes.kinds ?? {}, recipes);
      await writeFile(target, png);
      made.push(name);
      console.log(`ok (${Math.round(png.length / 1024)} kB)`);
    } catch (error) {
      failed.push(`${name}: ${error.message}`);
      console.log(`FAILED — ${error.message}`);
    }
  }

  // Whatever really got drawn is no longer a stand-in.
  await clearPlaceholders(dir, made);

  const remaining = await readPlaceholders(dir);
  console.log(
    `\n${made.length} generated, ${skipped.length} already real, ${failed.length} failed ` +
      `→ ${path.relative(ROOT, outDir)}`,
  );
  if (remaining.length) console.log(`${remaining.length} asset(s) are still stand-ins: ${remaining.join(', ')}`);

  // A run that draws nothing while stand-ins remain has not succeeded, it has
  // failed silently — which is precisely how a reel of grey boxes gets built,
  // committed and rendered with a green tick on every step.
  if (!made.length && !failed.length && remaining.length) {
    console.error(`\nDrew nothing, yet ${remaining.length} asset(s) are still stand-ins.`);
    process.exit(1);
  }

  if (!made.length && !failed.length) return; // Everything is already real artwork.

  if (failed.length) {
    console.error('\nFailed assets (re-run to retry just these — existing files are skipped):');
    for (const line of failed) console.error(`   · ${line}`);
    // EXIT CODES, so the workflow can commit the good ones AND still go red:
    //   2  some drawn, some failed — keep what worked, report the rest
    //   1  nothing came out at all — there is nothing to commit
    process.exit(made.length ? 2 : 1);
  }
}

// Only when run as a command. Tests import shouldDraw from here, and an
// unguarded main() would start drawing the moment they do.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error?.stack || error?.message || error);
    process.exit(1);
  });
}
