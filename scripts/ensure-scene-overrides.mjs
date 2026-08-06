#!/usr/bin/env node
/**
 * Writes the generated scene-override module if it is not already there.
 *
 * Wired as `pretypecheck` and `prestudio` so neither command can be run against
 * a fresh checkout that has never rendered anything — which is exactly what CI
 * is, every single time.
 */
import {ensureSceneOverrides} from './lib/episode.mjs';

const created = await ensureSceneOverrides();
if (created) console.log('wrote engine/episodeScenes.generated.ts (empty — no episode selected)');
