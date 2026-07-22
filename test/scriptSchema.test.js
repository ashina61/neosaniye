import test from 'node:test';
import assert from 'node:assert/strict';
import { SCRIPT_SCHEMA } from '../src/script/generateScript.js';

test('script schema requires enough scene beats for the narration duration policy', () => {
  const scenes = SCRIPT_SCHEMA.properties.scenes;
  const narration = scenes.items.properties.narration.description;

  assert.equal(scenes.minItems, 10);
  assert.equal(scenes.maxItems, 11);
  assert.match(narration, /scene 1: 8-10 words; later scenes: 11-14 words/);
});
