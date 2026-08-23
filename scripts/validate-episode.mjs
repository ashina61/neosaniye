#!/usr/bin/env node
/**
 * VALIDATE — schema, asset existence, and whether anything actually happens.
 *
 * This exists to fail in three seconds instead of three minutes. A render that
 * dies on a missing PNG has already paid for a bundle, a browser and a queue
 * slot; a typo in a file name should never cost that.
 *
 * The second half is newer and answers the question the first half cannot. A
 * config can be perfectly well formed, name files that all exist, sum to the
 * right length, and describe seven photographs being slowly scaled — every reel
 * this pipeline shipped passed the schema check. So `critiqueEpisode` looks for
 * dead shots, events scheduled after the cut, captions outside the safe area
 * and devices used three times running.
 *
 * ERRORS fail the run. WARNINGS print, because a held shot and a long closing
 * card are occasionally the point; `--strict` promotes them, which is what CI
 * should run.
 *
 * With no --episode it checks every episode in the folder.
 */
import {readFile, readdir, stat} from 'node:fs/promises';
import path from 'node:path';
import {ROOT, episodeDir, exists, loadConfig, parseArgs} from './lib/episode.mjs';
import {readPlaceholders} from './lib/placeholders.mjs';

import {BUILT_IN_SCENE_TYPES, validateEpisodeConfig} from '../engine/schema.mjs';
import {critiqueEpisode} from './lib/critique.mjs';

async function validateEpisode(episodeId) {
  const problems = [];
  const absentOptional = [];
  const dir = episodeDir(episodeId);

  let config;
  try {
    ({config} = await loadConfig(episodeId));
  } catch (error) {
    return {problems: [error.message], absentOptional: []};
  }

  problems.push(...validateEpisodeConfig(config));
  if (config?.id && config.id !== episodeId) {
    problems.push(`id: config says "${config.id}" but the folder is "${episodeId}"`);
  }

  // SCENE TYPE — a typo here renders a red MISSING TEMPLATE card instead of a
  // scene, which is loud at playback and silent at build time. An episode that
  // ships its own templates under scenes/ may name anything it registers there.
  const custom = await readFile(path.join(dir, 'scenes', 'index.tsx'), 'utf8').catch(() => '');
  for (const [index, scene] of (config?.scenes ?? []).entries()) {
    const type = scene?.sceneType;
    if (typeof type !== 'string') continue;
    if (BUILT_IN_SCENE_TYPES.includes(type) || custom.includes(`'${type}'`) || custom.includes(`"${type}"`)) {
      continue;
    }
    problems.push(
      `scenes[${index}].sceneType: "${type}" is not a built-in template ` +
        `(${BUILT_IN_SCENE_TYPES.join(', ')}) and this episode registers no template of that name`,
    );
  }

  // THE NARRATION IS NOT OPTIONAL ONCE THE CONFIG NAMES IT. A missing audio
  // file 404s inside the bundle and Remotion CANCELS the render — the same way
  // a missing PNG does, and just as silently until the very end.
  if (typeof config?.audio === 'string') {
    const resolved = path.join(dir, config.audio);
    if (!(await exists(resolved))) {
      problems.push(`audio: file not found — ${path.relative(ROOT, resolved)}`);
    }
  }

  // ASSET EXISTENCE — the whole reason this script is worth having.
  for (const [index, scene] of (config?.scenes ?? []).entries()) {
    for (const [role, file] of Object.entries(scene?.assets ?? {})) {
      if (typeof file !== 'string') continue;
      const resolved = path.join(dir, file);
      if (!(await exists(resolved))) {
        // `?role` means the scene is built to do without it. Say so, do not fail.
        if (role.startsWith('?')) {
          absentOptional.push(`${scene.id}.${role.slice(1)} (${file})`);
          continue;
        }
        problems.push(`scenes[${index}].assets.${role}: file not found — ${path.relative(ROOT, resolved)}`);
        continue;
      }
      const info = await stat(resolved);
      if (!info.isFile() || info.size === 0) {
        problems.push(`scenes[${index}].assets.${role}: empty or not a file — ${path.relative(ROOT, resolved)}`);
      }
    }
  }

  // AND THEN THE OTHER QUESTION: is there anything in it?
  const {errors, warnings, stats} = critiqueEpisode(config);
  problems.push(...errors);

  return {problems, absentOptional, warnings, stats};
}

async function main() {
  const args = parseArgs();
  /** Promote warnings to failures. What CI runs; not what a person runs. */
  const strict = args.strict === true || args.strict === 'true';

  let episodes;
  if (typeof args.episode === 'string') {
    episodes = [args.episode];
  } else {
    const entries = await readdir(process.env.EPISODES_DIR || path.join(ROOT, 'episodes'), {withFileTypes: true});
    episodes = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  }

  if (!episodes.length) {
    console.error('No episodes found under episodes/.');
    process.exit(1);
  }

  let failed = 0;
  for (const episodeId of episodes) {
    const {problems, absentOptional, warnings = [], stats} = await validateEpisode(episodeId);
    if (strict && warnings.length) problems.push(...warnings);
    if (problems.length) {
      failed += 1;
      console.error(`\n✗ ${episodeId} — ${problems.length} problem(s):`);
      for (const problem of problems) console.error(`   · ${problem}`);
    } else {
      const {config} = await loadConfig(episodeId);
      const frames = config.scenes.reduce((total, scene) => total + scene.durationInFrames, 0);
      console.log(
        `✓ ${episodeId} — ${config.scenes.length} scene(s), ${frames} frames ` +
          `(${(frames / config.fps).toFixed(2)}s @ ${config.fps}fps, ${config.width}x${config.height})`,
      );
      // Valid, but not necessarily finished. A stand-in renders as happily as
      // real artwork, so the count has to be said rather than discovered.
      const stubs = await readPlaceholders(episodeDir(episodeId));
      if (stubs.length) {
        console.log(`  ⚠ ${stubs.length} of these assets are still stand-ins: ${stubs.join(', ')}`);
      }
      // Not a failure, but the scene is playing without something it was
      // written to use, and that is worth saying out loud every single time.
      if (absentOptional.length) {
        console.log(`  · ${absentOptional.length} optional asset(s) absent: ${absentOptional.join(', ')}`);
      }
      if (stats) {
        console.log(
          `  motion  ${stats.events} event(s), ${stats.eventsPerSecond}/s, ` +
            `${stats.secondsPerShot}s per shot`,
        );
      }
      // Said every time, not hidden behind a flag: a warning nobody reads is a
      // defect that ships, and all of these have shipped.
      for (const warning of warnings) console.log(`  ⚠ ${warning}`);
    }
  }

  if (failed) {
    console.error(`\n${failed} episode(s) failed validation.`);
    process.exit(1);
  }
  console.log(`\nAll ${episodes.length} episode(s) valid.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
