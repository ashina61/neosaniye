#!/usr/bin/env node
/**
 * STAND-INS, so an episode can be cut before its artwork exists.
 *
 * The files are derived from the episode's own scene-config.json rather than
 * from a list in here — a list in a script is the same leak as a file name in
 * the engine, just one directory further out. Whatever the config references is
 * what gets written, at the size its recipe asks for.
 *
 * Real artwork later overwrites these by name. Nothing in the config changes.
 *
 *   node scripts/make-placeholder-assets.mjs --episode=<id> [--force]
 */
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {OPTIONAL_ROLE} from '../engine/schema.mjs';
import {ROOT, episodeDir, exists, loadConfig, parseArgs} from './lib/episode.mjs';
import {markPlaceholders} from './lib/placeholders.mjs';

/** Roles that fill the frame; everything else is an object standing in space. */
const FULL_FRAME = new Set(['background', 'wall']);

function hue(name) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < name.length; i += 1) {
    h ^= name.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h % 360;
}

function card(name, width, height, alpha) {
  const h = hue(name);
  const label = name.replace(/\.[a-z]+$/i, '');
  const fontSize = Math.round(Math.min(width, height) * 0.075);
  const body = alpha
    ? `<rect x="${width * 0.06}" y="${height * 0.06}" width="${width * 0.88}" height="${height * 0.88}"
         rx="${width * 0.04}" fill="hsl(${h} 24% 62%)"/>`
    : `<rect width="${width}" height="${height}" fill="hsl(${h} 18% 34%)"/>
       <rect width="${width}" height="${height}" fill="url(#g)"/>`;

  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
       <defs>
         <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
           <stop offset="0" stop-color="hsl(${h} 22% 52%)" stop-opacity="0.9"/>
           <stop offset="1" stop-color="hsl(${(h + 40) % 360} 20% 16%)" stop-opacity="0.9"/>
         </linearGradient>
       </defs>
       ${body}
       <text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle"
             font-family="monospace" font-size="${fontSize}" fill="rgba(0,0,0,0.72)">${label}</text>
       <text x="50%" y="${height * 0.5 + fontSize * 1.4}" text-anchor="middle" dominant-baseline="middle"
             font-family="monospace" font-size="${Math.round(fontSize * 0.62)}" fill="rgba(0,0,0,0.5)">${width}x${height}</text>
     </svg>`,
  );
}

async function main() {
  const args = parseArgs();
  const episodeId = typeof args.episode === 'string' ? args.episode : null;
  if (!episodeId) {
    console.error('Usage: node scripts/make-placeholder-assets.mjs --episode=<episode-id> [--force]');
    process.exit(1);
  }

  const dir = episodeDir(episodeId);
  const {config} = await loadConfig(episodeId);

  // Sizes come from the generation recipe when the episode has one, so a
  // placeholder frames the shot the way the real artwork will.
  const recipes = await readFile(path.join(dir, 'assets.json'), 'utf8')
    .then(JSON.parse)
    .catch(() => null);

  /** file -> {width, height, alpha}, first reference wins. */
  const wanted = new Map();
  for (const scene of config.scenes ?? []) {
    for (const [role, file] of Object.entries(scene.assets ?? {})) {
      if (typeof file !== 'string' || wanted.has(file)) continue;
      // NEVER STAND IN FOR AN OPTIONAL ROLE. A "?role" exists precisely so the
      // scene can do without it, and it does that WELL — the composite drops
      // the layer and loses some depth. A labelled grey card in the middle of
      // the shot is strictly worse than the thing that was designed to happen,
      // and it also hides the fact that the artwork was never drawn.
      if (role.startsWith(OPTIONAL_ROLE)) continue;
      const name = path.basename(file);
      const recipe = recipes?.assets?.[name];
      const kind = recipe ? recipes?.kinds?.[recipe.kind] : null;
      wanted.set(file, {
        width: recipe?.width ?? kind?.width ?? (FULL_FRAME.has(role) ? config.width : Math.round(config.width * 0.76)),
        height: recipe?.height ?? kind?.height ?? (FULL_FRAME.has(role) ? config.height : Math.round(config.height * 0.6)),
        alpha: kind ? Boolean(kind.alpha) : !FULL_FRAME.has(role),
      });
    }
  }

  const written = [];
  for (const [file, spec] of wanted) {
    const target = path.join(dir, file);
    if (!args.force && (await exists(target))) continue;
    await mkdir(path.dirname(target), {recursive: true});
    const png = await sharp(card(path.basename(file), spec.width, spec.height, spec.alpha)).png().toBuffer();
    await writeFile(target, png);
    written.push(path.basename(file));
    console.log(`  ${file} ${spec.width}x${spec.height}${spec.alpha ? ' (alpha)' : ''}`);
  }

  // Leave a note saying which files are stand-ins. Without it a failed draw
  // looks exactly like a finished episode: the placeholder is still on disk,
  // so the validator passes and a reel of grey boxes renders happily.
  await markPlaceholders(dir, written);

  console.log(
    `✓ ${written.length} placeholder(s) written, ${wanted.size - written.length} already present ` +
      `→ ${path.relative(ROOT, dir)}/assets`,
  );
}

main().catch((error) => {
  console.error(error?.stack || error?.message || error);
  process.exit(1);
});
