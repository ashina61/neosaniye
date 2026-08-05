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

const episodeIds = (await readdir(EPISODES, {withFileTypes: true}))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

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
        assert.ok(info, `${scene.id}.${role} -> ${file} is missing`);
        assert.ok(info.size > 0, `${scene.id}.${role} -> ${file} is empty`);
      }
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
