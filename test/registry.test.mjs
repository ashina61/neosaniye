/**
 * The built-in list, the registry and the TypeScript union are three places
 * that name the same four templates. This test is what stops them drifting —
 * drift here means the validator blesses a scene type nothing can render.
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {BUILT_IN_SCENE_TYPES} from '../engine/schema.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('the registry maps every built-in scene type', async () => {
  const source = await readFile(path.join(ROOT, 'engine/sceneTypes/registry.ts'), 'utf8');
  for (const type of BUILT_IN_SCENE_TYPES) {
    assert.match(source, new RegExp(`'${type}'`), `registry.ts does not register "${type}"`);
  }
});

test('the TypeScript union lists exactly the built-in scene types', async () => {
  const source = await readFile(path.join(ROOT, 'engine/schema.ts'), 'utf8');
  const union = source.match(/export type BuiltInSceneType =([\s\S]*?);/)?.[1];
  assert.ok(union, 'BuiltInSceneType union not found in schema.ts');
  const listed = [...union.matchAll(/'([a-z-]+)'/g)].map((match) => match[1]);
  assert.deepEqual(listed.sort(), [...BUILT_IN_SCENE_TYPES].sort());
});

test('every built-in template has a file of its own', async () => {
  const source = await readFile(path.join(ROOT, 'engine/sceneTypes/registry.ts'), 'utf8');
  // Templates are the PascalCase siblings; './types' is the shared prop type.
  const imports = [...source.matchAll(/from '\.\/([A-Z]\w+)'/g)].map((match) => match[1]);
  assert.equal(
    imports.length,
    BUILT_IN_SCENE_TYPES.length,
    `expected one template import per built-in type, got: ${imports.join(', ')}`,
  );
});
