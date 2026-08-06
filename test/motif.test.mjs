/**
 * THE DRAWN LAYER, AND THE RULES THAT KEEP IT MEANING SOMETHING.
 *
 * A motif is the only thing in a shot changing on purpose, so it is also the
 * fastest way to wreck a reel: put one on every scene and the eye stops
 * following any of them. The rules below are the difference between a
 * documentary and a screensaver, and every one of them was written after
 * looking at a contact sheet where it had been broken.
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {motifFor, fitsScene} from '../scripts/plan-episode.mjs';
import {MOTIF_KINDS, validateEpisodeConfig} from '../engine/schema.mjs';

const config = (params) => ({
  id: 'x',
  fps: 30,
  width: 1080,
  height: 1920,
  look: {
    posterizeFps: 12,
    grade: {saturate: 1, contrast: 1, sepia: 0, brightness: 1},
    film: {grain: true, grunge: true, scanlines: true, vignette: true, gateWeave: true},
  },
  scenes: [{id: 's1', sceneType: 'composite', durationInFrames: 100, params}],
});

test('an unknown motif is caught, never silently drawn as nothing', () => {
  // The same law as an unknown scene type: a typo that draws nothing and says
  // nothing about it is how a shot ends up a still picture with a caption.
  const problems = validateEpisodeConfig(config({motif: 'sparkles'}));
  assert.equal(problems.length, 1);
  assert.match(problems[0], /params\.motif/);
  for (const kind of MOTIF_KINDS) {
    assert.deepEqual(validateEpisodeConfig(config({motif: kind})), [], `${kind} must be accepted`);
  }
  assert.deepEqual(validateEpisodeConfig(config({})), [], 'a scene with no motif is the normal case');
});

test('the line has to say it', () => {
  assert.equal(motifFor({vo: 'He spent a fortune on the way.'}, [], 'composite'), 'coins');
  assert.equal(motifFor({vo: 'The caravan crossed the desert.'}, [], 'composite'), 'route');
  assert.equal(motifFor({vo: 'Nobody knows what he looked like.'}, [], 'composite'), '');
});

test('the same drawing never runs twice', () => {
  // A repeated motif stops reading as meaning and starts reading as a template.
  const line = {vo: 'He gave away gold in every district.'};
  assert.equal(motifFor(line, [''], 'composite'), 'coins');
  assert.notEqual(motifFor(line, ['coins'], 'composite'), 'coins');
});

test('never three decorated shots in a row', () => {
  // The plain shot is what makes the decorated ones land.
  const line = {vo: 'He spent a fortune.'};
  assert.equal(motifFor(line, ['route', 'tally'], 'composite'), '', 'two before it means this one is left alone');
  assert.equal(motifFor(line, ['route', ''], 'composite'), 'coins', 'a gap resets it');
});

test('a type card keeps its middle', () => {
  // A route arcs across the centre; on a slate that is a line through the title.
  assert.equal(fitsScene('route', 'title-slate'), false);
  assert.equal(fitsScene('tally', 'title-slate'), false);
  assert.equal(fitsScene('coins', 'title-slate'), true);
  assert.equal(fitsScene('route', 'composite'), true);

  // And it takes a DIFFERENT one rather than none — the search carries on.
  assert.equal(motifFor({vo: 'The pilgrimage cost him everything he had.'}, [], 'title-slate'), 'coins');
});

test('the brief overrules the inference, in both directions', () => {
  assert.equal(motifFor({vo: 'Nothing here suggests anything.', motif: 'embers'}, [], 'composite'), 'embers');
  assert.equal(motifFor({vo: 'He spent a fortune.', motif: 'none'}, [], 'composite'), '');
});
