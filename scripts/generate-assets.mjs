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
 * Subjects and objects are asked for on a flat green screen and then keyed, so
 * they arrive with REAL transparency. Without it a "cut-out" is a rectangle
 * sitting on the background and every parallax scene shows its corners.
 */
const CHROMA = '#00b140';
const CHROMA_INSTRUCTION =
  'the subject completely isolated and centred on a flat uniform bright chroma-key green screen background, ' +
  'nothing else in the picture, the whole subject inside the frame with clear margin on every side, nothing cropped';

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
 * CHROMA KEY — green out, alpha in.
 *
 * Greenness is measured against the stronger of red and blue rather than
 * against a fixed colour, so it survives the uneven lighting a diffusion model
 * puts on its backdrop. The soft band between the two thresholds is what keeps
 * hair and cloth edges from turning into a cut-with-scissors outline, and the
 * despill pulls the green reflection back out of those same edge pixels.
 */
async function keyToAlpha(buffer) {
  const {data, info} = await sharp(buffer).ensureAlpha().raw().toBuffer({resolveWithObject: true});
  const HARD = 56;
  const SOFT = 14;

  for (let i = 0; i < data.length; i += info.channels) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const other = Math.max(r, b);
    const excess = g - other;

    if (excess >= HARD) {
      data[i + 3] = 0;
    } else if (excess > SOFT) {
      const alpha = Math.round((255 * (HARD - excess)) / (HARD - SOFT));
      data[i + 3] = alpha;
      data[i + 1] = Math.round(other + (g - other) * (alpha / 255));
    }
  }

  return sharp(data, {raw: {width: info.width, height: info.height, channels: info.channels}}).png().toBuffer();
}

async function buildAsset(name, recipe, kinds, style, negative) {
  const kind = kinds[recipe.kind];
  if (!kind) throw new Error(`unknown kind "${recipe.kind}"`);

  const width = recipe.width ?? kind.width;
  const height = recipe.height ?? kind.height;
  const parts = [recipe.prompt, style];
  if (kind.alpha) parts.push(CHROMA_INSTRUCTION);
  if (negative) parts.push(`avoid: ${negative}`);

  const raw = await fetchImage(parts.join('. '), width, height, seedFor(name));

  if (!kind.alpha) {
    return sharp(raw).resize(width, height, {fit: 'cover', position: 'attention'}).png().toBuffer();
  }

  const keyed = await keyToAlpha(raw);
  // Trim the transparent margin so the file's bottom edge IS the subject's
  // feet — that is what footY in the config is anchoring to.
  const trimmed = await sharp(keyed)
    .trim({background: {r: 0, g: 0, b: 0, alpha: 0}, threshold: 6})
    .toBuffer()
    .catch(() => keyed);

  return sharp(trimmed)
    .resize(width, height, {fit: 'inside', withoutEnlargement: false})
    .png()
    .toBuffer();
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
      const png = await buildAsset(name, recipe, recipes.kinds ?? {}, recipes.style ?? '', recipes.negative ?? '');
      const kind = recipes.kinds?.[recipe.kind];
      if (kind?.alpha) {
        const solid = await opaqueFraction(png);
        // A green screen that keyed away entirely means the model ignored the
        // backdrop instruction. Writing it would leave an invisible subject and
        // a scene that renders empty, which is far worse than a loud failure.
        if (solid < 0.04) throw new Error(`keyed away to nothing (${(solid * 100).toFixed(1)}% opaque)`);
        if (solid > 0.97) throw new Error(`nothing keyed out (${(solid * 100).toFixed(1)}% opaque)`);
      }
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
