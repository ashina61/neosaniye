/**
 * Every episode in the repo must be renderable. This is the same gate the
 * validate workflow runs, kept in the test suite so a broken config fails
 * before anyone spends a render on it.
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readdir, readFile, stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {BUILT_IN_SCENE_TYPES, validateEpisodeConfig} from '../engine/schema.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EPISODES = path.join(ROOT, 'episodes');

/**
 * A V1 EPISODE IS A FOLDER WITH A `scene-config.json` IN IT.
 *
 * The repo now ships two shapes. A `shorts` episode is drawn entirely in code
 * and has no scene config to validate — it carries a brief and a measured
 * voiceover and nothing else. Demanding a v1 config from every folder under
 * `episodes/` failed three tests for a folder that was never going to have one,
 * which is the gate reporting on itself rather than on the work.
 */
const allFolders = (await readdir(EPISODES, {withFileTypes: true}))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

const episodeIds = [];
for (const id of allFolders) {
  const hasConfig = await stat(path.join(EPISODES, id, 'scene-config.json'))
    .then(() => true)
    .catch(() => false);
  if (hasConfig) episodeIds.push(id);
}

test('the repo ships at least one episode', () => {
  assert.ok(episodeIds.length > 0);
});

for (const id of episodeIds) {
  test(`${id}: config is valid`, async () => {
    const raw = await readFile(path.join(EPISODES, id, 'scene-config.json'), 'utf8');
    const config = JSON.parse(raw);
    assert.deepEqual(validateEpisodeConfig(config), []);
    assert.equal(config.id, id, 'config id must match the folder name');
  });

  test(`${id}: every referenced asset exists and is not empty`, async () => {
    const config = JSON.parse(await readFile(path.join(EPISODES, id, 'scene-config.json'), 'utf8'));
    for (const scene of config.scenes) {
      for (const [role, file] of Object.entries(scene.assets ?? {})) {
        const full = path.join(EPISODES, id, file);
        const info = await stat(full).catch(() => null);
        // `?role` is used when present and done without when absent.
        if (!info && role.startsWith('?')) continue;
        assert.ok(info, `${scene.id}.${role} -> ${file} is missing`);
        assert.ok(info.size > 0, `${scene.id}.${role} -> ${file} is empty`);
      }
    }
  });

  test(`${id}: the generation recipe covers every asset the config names`, async () => {
    const recipes = await readFile(path.join(EPISODES, id, 'assets.json'), 'utf8')
      .then(JSON.parse)
      .catch(() => null);
    if (!recipes) return; // An episode whose artwork is supplied by hand.

    const config = JSON.parse(await readFile(path.join(EPISODES, id, 'scene-config.json'), 'utf8'));
    const kinds = recipes.kinds ?? {};
    const referenced = new Set();
    for (const scene of config.scenes) {
      for (const file of Object.values(scene.assets ?? {})) referenced.add(path.basename(file));
    }

    for (const name of referenced) {
      const recipe = recipes.assets?.[name];
      assert.ok(recipe, `no recipe in assets.json for "${name}" — the generator would never draw it`);
      assert.ok(recipe.prompt?.trim(), `recipe for "${name}" has no prompt`);
      assert.ok(kinds[recipe.kind], `recipe for "${name}" has unknown kind "${recipe.kind}"`);
    }

    // The reverse leak: a recipe nobody uses costs a draw every run.
    for (const name of Object.keys(recipes.assets ?? {})) {
      assert.ok(referenced.has(name), `assets.json draws "${name}" but no scene references it`);
    }
  });

  test(`${id}: every scene type can be rendered by something`, async () => {
    const config = JSON.parse(await readFile(path.join(EPISODES, id, 'scene-config.json'), 'utf8'));
    const custom = await readFile(path.join(EPISODES, id, 'scenes', 'index.tsx'), 'utf8').catch(() => '');
    for (const scene of config.scenes) {
      const known = BUILT_IN_SCENE_TYPES.includes(scene.sceneType) || custom.includes(`'${scene.sceneType}'`);
      assert.ok(known, `${scene.id}: no template registered for sceneType "${scene.sceneType}"`);
    }
  });
}
