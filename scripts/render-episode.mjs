#!/usr/bin/env node
/**
 * RENDER — bundle the engine, hand it one episode's config, write an mp4.
 *
 * The one architectural decision worth reading: Remotion resolves `staticFile`
 * against a PUBLIC DIRECTORY, and here that directory is the episode folder
 * itself. So "assets/character-1.png" in a config means that episode's file,
 * every episode is isolated by construction, and no asset ever has to be copied
 * or renamed to be rendered.
 */
import {mkdir} from 'node:fs/promises';
import path from 'node:path';
import {bundle} from '@remotion/bundler';
import {renderMedia, selectComposition} from '@remotion/renderer';
import {validateEpisodeConfig} from '../engine/schema.mjs';
import {ROOT, episodeDir, loadConfig, parseArgs, writeSceneOverrides} from './lib/episode.mjs';

async function main() {
  const args = parseArgs();
  const episodeId = typeof args.episode === 'string' ? args.episode : null;
  if (!episodeId) {
    console.error('Usage: npm run render -- --episode=<episode-id> [--out=path.mp4]');
    process.exit(1);
  }

  const {config} = await loadConfig(episodeId);

  // Validate before spending a bundle on it — same check the CI job runs.
  const problems = validateEpisodeConfig(config);
  if (problems.length) {
    console.error(`✗ ${episodeId} — config invalid:`);
    for (const problem of problems) console.error(`   · ${problem}`);
    process.exit(1);
  }

  const overrides = await writeSceneOverrides(episodeId);
  if (overrides) console.log(`scene overrides: ${path.relative(ROOT, overrides)}`);

  const outPath = path.resolve(
    typeof args.out === 'string' ? args.out : path.join(ROOT, 'out', `${episodeId}.mp4`),
  );
  await mkdir(path.dirname(outPath), {recursive: true});

  console.log(`bundling engine…`);
  const serveUrl = await bundle({
    entryPoint: path.join(ROOT, 'engine', 'index.ts'),
    publicDir: episodeDir(episodeId),
    onProgress: () => undefined,
  });

  const inputProps = {config};
  // The browser override has to be given to BOTH calls: selectComposition
  // launches its own browser to read calculateMetadata, and passing it only to
  // renderMedia leaves that first launch trying to download Chromium.
  const browserExecutable = process.env.REMOTION_BROWSER_EXECUTABLE || undefined;
  const composition = await selectComposition({serveUrl, id: 'Episode', inputProps, browserExecutable});

  console.log(
    `rendering ${episodeId}: ${config.scenes.length} scene(s), ` +
      `${composition.durationInFrames} frames ` +
      `(${(composition.durationInFrames / composition.fps).toFixed(2)}s @ ${composition.fps}fps, ` +
      `${composition.width}x${composition.height})`,
  );

  let lastPercent = -1;
  await renderMedia({
    composition,
    serveUrl,
    codec: 'h264',
    outputLocation: outPath,
    inputProps,
    crf: Number(args.crf ?? 18),
    pixelFormat: 'yuv420p',
    concurrency: Number(process.env.REMOTION_CONCURRENCY ?? 2),
    // CI images ship their own Chromium; honouring it avoids a download the
    // runner may not be allowed to make.
    browserExecutable,
    onProgress: ({progress}) => {
      const percent = Math.floor(progress * 100);
      if (percent > lastPercent && percent % 10 === 0) {
        lastPercent = percent;
        console.log(`  ${percent}%`);
      }
    },
  });

  console.log(`✓ ${path.relative(ROOT, outPath)}`);
}

main().catch((error) => {
  console.error(error?.stack || error?.message || error);
  process.exit(1);
});
