#!/usr/bin/env node
/**
 * KEY EVERYTHING IN `raw/` INTO `assets/`.
 *
 *   node scripts/broll-key.mjs --episode=<id> [--tolerance=55] [--only=file.png]
 *
 * Backgrounds are copied through untouched — a backdrop is meant to be a full
 * rectangle. Midground and foreground layers are keyed and trimmed to their
 * own subject, because a cut-out that keeps the generator's empty margins is
 * positioned by those margins instead of by itself.
 *
 * IT SAYS WHAT IT DID, per file, with the share of the frame it kept. A keyer
 * that silently returns a hole instead of a shape is the worst thing in a
 * pipeline like this: every asset looks processed and half of them are wrong.
 */
import {copyFile, mkdir, readFile, readdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {ROOT, episodeDir, exists, parseArgs} from './lib/episode.mjs';
import {keyOut, trimToSubject} from './lib/key.mjs';

async function main() {
  const args = parseArgs();
  const id = typeof args.episode === 'string' ? args.episode : null;
  if (!id) {
    console.error('Usage: node scripts/broll-key.mjs --episode=<episode-id>');
    process.exit(1);
  }
  const dir = episodeDir(id);
  const raw = path.join(dir, 'raw');
  const out = path.join(dir, 'assets');
  await mkdir(out, {recursive: true});

  const plan = JSON.parse(await readFile(path.join(dir, 'shots.json'), 'utf8'));
  const only = typeof args.only === 'string' ? new Set(args.only.split(',')) : null;
  const tolerance = Number(args.tolerance ?? 55);

  const present = new Set((await readdir(raw).catch(() => [])).filter((f) => /\.(png|jpe?g|webp)$/i.test(f)));
  const missing = [];
  let done = 0;

  for (const item of plan.wanted) {
    if (only && !only.has(item.file)) continue;
    // Accept any extension the generator gave us, keyed to the stem.
    const stem = item.file.replace(/\.png$/, '');
    const source = [...present].find((f) => f.replace(/\.[^.]+$/, '') === stem);
    if (!source) {
      missing.push(item.file);
      continue;
    }

    const buffer = await readFile(path.join(raw, source));
    if (item.kind === 'bg') {
      // A backdrop is a rectangle. Fit it to the frame and leave it alone.
      await sharp(buffer)
        .resize(item.size[0], item.size[1], {fit: 'cover', position: 'attention'})
        .png({compressionLevel: 9})
        .toFile(path.join(out, item.file));
      console.log(`  ${item.file.padEnd(34)} arka plan → ${item.size[0]}x${item.size[1]}`);
      done += 1;
      continue;
    }

    try {
      const {png, kept} = await keyOut(buffer, {tolerance});
      const trimmed = await trimToSubject(png);
      await writeFile(path.join(out, item.file), trimmed);
      const meta = await sharp(trimmed).metadata();
      const warn = kept > 0.94 ? '  ⚠ neredeyse hiçbir şey silinmedi — zemin düz mü?' : '';
      console.log(`  ${item.file.padEnd(34)} keylendi · %${(kept * 100).toFixed(0)} kaldı · ${meta.width}x${meta.height}${warn}`);
      done += 1;
    } catch (error) {
      console.log(`  ${item.file.padEnd(34)} ✗ ${error.message}`);
    }
  }

  console.log(`\n${done}/${plan.wanted.length} hazır.`);
  if (missing.length) {
    console.log(`\nEksik ${missing.length} görsel (raw/ içine bu adlarla at):`);
    for (const file of missing) console.log(`  · ${file}`);
    console.log(`\nPromptları: ${path.relative(ROOT, path.join(dir, 'PROMPTS.md'))}`);
  } else {
    console.log(`Hepsi tamam → npm run broll:render -- --episode=${id}`);
  }
}

main().catch((error) => {
  console.error(`✗ ${error?.stack ?? error?.message ?? error}`);
  process.exit(1);
});
