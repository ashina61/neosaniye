import test from 'node:test';
import assert from 'node:assert/strict';
import {buildRemotionSpec, classifyRemotionTemplate} from '../src/video/buildRemotionSpec.js';

test('classifies reusable premium motion scene templates', () => {
  const scenes = [
    {narration: 'A conman sold the impossible.'},
    {narration: 'He printed official letters and sealed documents.'},
    {narration: 'The ship crossed the Atlantic from Britain to Honduras.'},
    {narration: 'Exactly 250 settlers boarded the vessel.'},
    {narration: 'Families paid cash and bought worthless land.'},
    {narration: 'Disease spread and the settlement collapsed.'},
    {narration: 'The final truth shocked everyone.'},
  ];
  assert.equal(classifyRemotionTemplate(scenes[0], 0, scenes.length), 'hook-reveal');
  assert.equal(classifyRemotionTemplate(scenes[1], 1, scenes.length), 'document');
  assert.equal(classifyRemotionTemplate(scenes[2], 2, scenes.length), 'map-route');
  assert.equal(classifyRemotionTemplate(scenes[3], 3, scenes.length), 'stat-slot');
  assert.equal(classifyRemotionTemplate(scenes[4], 4, scenes.length), 'transaction');
  assert.equal(classifyRemotionTemplate(scenes[5], 5, scenes.length), 'consequence');
  assert.equal(classifyRemotionTemplate(scenes[6], 6, scenes.length), 'final-twist');
});

test('visual story planner templates survive into procedural compositions', () => {
  const scenes = [
    {narration: 'Opening beat'},
    {narration: 'Air moves through hidden chambers', story_template: 'mechanism'},
    {narration: 'The route bends around the coast', story_template: 'navigation'},
    {narration: 'Thousands fill the structure', story_template: 'quantity'},
    {narration: 'The record changed here', story_template: 'timeline'},
    {narration: 'Closing beat'},
  ];
  assert.equal(classifyRemotionTemplate(scenes[1], 1, scenes.length), 'explainer-diagram');
  assert.equal(classifyRemotionTemplate(scenes[2], 2, scenes.length), 'map-route');
  assert.equal(classifyRemotionTemplate(scenes[3], 3, scenes.length), 'stat-slot');
  assert.equal(classifyRemotionTemplate(scenes[4], 4, scenes.length), 'document');
});

test('builds sequential, overlap-free, procedural-only production spec', () => {
  const script = {
    topic: 'The fake nation of Poyais',
    title: 'He sold a country that did not exist',
    language: 'en',
    hook_text: 'He sold a country',
    finale_text: 'the journey was real',
    emphasis_words: ['official', '250', 'collapsed'],
    scenes: [
      {narration: 'A man sold a country that never existed.', keywords: ['conman', 'country']},
      {narration: 'He printed official documents and government seals.', keywords: ['document', 'seal']},
      {narration: 'Exactly 250 settlers crossed the Atlantic.', keywords: ['250', 'Atlantic']},
      {narration: 'The settlement collapsed from disease and hunger.', keywords: ['collapse', 'disease']},
      {narration: 'The country was fake but the journey was real.', keywords: ['fake', 'journey']},
    ],
  };
  const timeline = {scenes: [{duration: 3}, {duration: 4}, {duration: 4}, {duration: 4}, {duration: 5}]};
  const spec = buildRemotionSpec({script, audio: {duration: 20}, timeline});
  assert.equal(spec.version, 2);
  assert.equal(spec.meta.visualPolicy, 'procedural-only');
  assert.equal(spec.meta.captionPolicy, 'none');
  assert.equal(spec.meta.durationInFrames, 600);
  assert.equal(spec.scenes.length, 5);
  assert.deepEqual(spec.scenes.map((scene) => scene.fromFrame), [0, 90, 210, 330, 450]);
  assert.equal(spec.scenes[2].template, 'stat-slot');
  assert.equal(spec.scenes[2].stat, '250');
  assert.equal(spec.scenes.at(-1).template, 'final-twist');
  assert.equal(spec.audio.musicVolume, 0.18);
  assert.ok(spec.scenes.every((scene) => scene.visual?.motif));
  assert.ok(spec.scenes.every((scene) => !('assets' in scene)));
  for (let i = 1; i < spec.scenes.length; i += 1) {
    assert.equal(spec.scenes[i].fromFrame, spec.scenes[i - 1].fromFrame + spec.scenes[i - 1].durationInFrames);
  }
});

test('fails closed when no script scenes exist', () => {
  assert.throws(() => buildRemotionSpec({script: {scenes: []}}), /REMOTION_SPEC_SCENES_REQUIRED/);
});
