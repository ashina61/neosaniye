#!/usr/bin/env node
/**
 * A CONTACT SHEET OF THE REEL ITSELF.
 *
 * The sister of `assets:review`, and it exists for the same reason: the only
 * way to know whether a shot works is to LOOK at it, and looking must not cost
 * a full render. Every visual defect this repo has actually shipped — the frame
 * darkened four times over, the title creeping until the type softened, glow
 * pinned to scene coordinates sliding off the lamp it was lighting, evidence
 * cards burying each other — passed validation, passed the tests, and was
 * obvious in one still.
 *
 * So: a handful of stills spread across the reel, laid out in a grid, in about
 * a minute instead of the twenty a render costs.
 *
 *   npm run frames -- --episode=<id> [--per=2] [--out=path]
 *
 * `--per` is stills per scene. One lands mid-shot; two or more spread across
 * it, which is what you want for anything that MOVES — a motif that piles up, a
 * route that draws itself and a count that climbs all look like nothing at all
 * in a single frame.
 */
import {mkdir, rm, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {bundle} from '@remotion/bundler';
import {renderStill, selectComposition} from '@remotion/renderer';
import sharp from 'sharp';
import {sceneOffsets, validateEpisodeConfig} from '../engine/schema.mjs';
import {auditTiles, frameDistance, measureFrame} from './lib/audit.mjs';
import {ROOT, episodeDir, loadConfig, parseArgs, pruneOptionalAssets, writeSceneOverrides} from './lib/episode.mjs';

const COLS = 4;
const CELL_W = 300;

async function main() {
  const args = parseArgs();
  const episodeId = typeof args.episode === 'string' ? args.episode : null;
  if (!episodeId) {
    console.error('Usage: npm run frames -- --episode=<episode-id> [--per=2] [--out=path.png]');
    process.exit(1);
  }
  const per = Math.max(1, Number(args.per ?? 2));

  const {config} = await loadConfig(episodeId);
  const problems = validateEpisodeConfig(config);
  if (problems.length) {
    console.error(`✗ ${episodeId} — config invalid:`);
    for (const problem of problems) console.error(`   · ${problem}`);
    process.exit(1);
  }

  await pruneOptionalAssets(config, episodeId);
  await writeSceneOverrides(episodeId);

  console.log('bundling engine…');
  const serveUrl = await bundle({
    entryPoint: path.join(ROOT, 'engine', 'index.ts'),
    publicDir: episodeDir(episodeId),
    onProgress: () => undefined,
  });

  const inputProps = {config};
  const browserExecutable = process.env.REMOTION_BROWSER_EXECUTABLE || undefined;
  const composition = await selectComposition({serveUrl, id: 'Episode', inputProps, browserExecutable});

  // Scene-relative sampling, not an even sweep of the reel: a two-second slate
  // and a seven-second composite deserve the same attention, and an even sweep
  // gives the long one four stills and the short one none.
  const offsets = sceneOffsets(config);
  const shots = [];
  config.scenes.forEach((scene, index) => {
    for (let i = 0; i < per; i += 1) {
      const at = (i + 1) / (per + 1);
      shots.push({
        scene: scene.id,
        label: `${scene.id} ${Math.round(at * 100)}%`,
        frame: Math.min(composition.durationInFrames - 1, offsets[index] + Math.round(scene.durationInFrames * at)),
      });
    }
  });

  const tmp = path.join(ROOT, 'out', `.frames-${episodeId}`);
  await mkdir(tmp, {recursive: true});

  const tiles = [];
  for (const [index, shot] of shots.entries()) {
    const file = path.join(tmp, `${String(index).padStart(3, '0')}.png`);
    process.stdout.write(`  ${shot.label} … `);
    await renderStill({
      composition,
      serveUrl,
      output: file,
      frame: shot.frame,
      inputProps,
      browserExecutable,
      overwrite: true,
    });
    console.log(`frame ${shot.frame}`);
    tiles.push({file, ...shot});
  }

  const cellH = Math.round((CELL_W * composition.height) / composition.width);
  const rows = Math.ceil(tiles.length / COLS);
  const width = CELL_W * Math.min(COLS, tiles.length);
  const height = cellH * rows;

  /**
   * AND WHILE THE TILES ARE OPEN, MEASURE THEM.
   *
   * The sheet is still the authority — a person looking at it is the only thing
   * that catches a newspaper floating in front of a portico. But a person does
   * not notice that two samples of one scene are identical, and that is exactly
   * the defect the laws describe in words and nothing enforced.
   */
  const composited = [];
  const measured = [];
  const byScene = new Map();
  for (const [index, tile] of tiles.entries()) {
    const image = sharp(tile.file);
    measured.push({label: tile.label, scene: tile.scene, stats: await measureFrame(image), file: tile.file});
    const seen = byScene.get(tile.scene);
    if (seen) seen.push(tile.file);
    else byScene.set(tile.scene, [tile.file]);
    composited.push({
      input: await image.clone().resize(CELL_W, cellH, {fit: 'cover'}).png().toBuffer(),
      left: (index % COLS) * CELL_W,
      top: Math.floor(index / COLS) * cellH,
    });
  }

  // One distance per scene, on its first two samples. Attached to the first
  // sample so the warning names a tile the reader can find on the sheet.
  for (const [scene, files] of byScene) {
    if (files.length < 2) continue;
    const distance = await frameDistance(sharp(files[0]), sharp(files[1]));
    const target = measured.find((m) => m.scene === scene);
    if (target) target.distance = distance;
  }

  const out = path.resolve(typeof args.out === 'string' ? args.out : path.join(ROOT, 'out', `${episodeId}-frames.png`));
  await writeFile(
    out,
    await sharp({create: {width, height, channels: 3, background: '#101010'}}).composite(composited).png().toBuffer(),
  );
  await rm(tmp, {recursive: true, force: true});

  console.log(`\n→ ${path.relative(ROOT, out)}  — ${tiles.length} still(s). Open it.`);

  const notes = auditTiles(measured);
  if (notes.length) {
    console.log(`\n${notes.length} thing(s) to look at first:`);
    for (const note of notes) console.log(`  ⚠ ${note}`);
  } else {
    console.log('\nNothing measured as blank, flat or motionless. Still look at it.');
  }
}

main().catch((error) => {
  console.error(error?.stack || error?.message || error);
  process.exit(1);
});
