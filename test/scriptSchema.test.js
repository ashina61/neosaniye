import test from 'node:test';
import assert from 'node:assert/strict';
import { SCRIPT_SCHEMA, buildNarrationLengthRepair } from '../src/script/generateScript.js';

test('script schema requires enough scene beats for the narration duration policy', () => {
  const scenes = SCRIPT_SCHEMA.properties.scenes;
  const narration = scenes.items.properties.narration.description;

  assert.equal(scenes.minItems, 10);
  assert.equal(scenes.maxItems, 11);
  assert.match(narration, /scene 1: 8-10 words; later scenes: 11-14 words/);
});

test('narration length repair includes the rejected narration and a concrete target', () => {
  const repair = buildNarrationLengthRepair(
    { scenes: [{ narration: 'The first fact needs trimming.' }, { narration: 'The second fact must remain accurate.' }] },
    { words: 153, code: 'NARRATION_TOO_LONG', direction: 'shorten' },
    { minNarrationWords: 105, maxNarrationWords: 135 },
  );

  assert.match(repair, /153 spoken narration words/);
  assert.match(repair, /EXACTLY about 120 words/);
  assert.match(repair, /1\. The first fact needs trimming\./);
  assert.match(repair, /2\. The second fact must remain accurate\./);
  assert.match(repair, /Remove only repetition/);
});
