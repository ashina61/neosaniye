import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_LOOK,
  resolveAssets,
  sceneOffsets,
  totalDurationInFrames,
  validateEpisodeConfig,
} from '../engine/schema.mjs';

const scene = (over = {}) => ({
  id: 's1',
  sceneType: 'parallax-punch',
  durationInFrames: 90,
  assets: {background: 'assets/bg.png'},
  ...over,
});

const config = (over = {}) => ({
  id: 'ep',
  fps: 30,
  width: 1080,
  height: 1920,
  look: DEFAULT_LOOK,
  scenes: [scene()],
  ...over,
});

test('a well-formed config has no problems', () => {
  assert.deepEqual(validateEpisodeConfig(config()), []);
});

test('scenes are laid end to end, and the reel is their sum', () => {
  const c = config({
    scenes: [scene({id: 'a', durationInFrames: 120}), scene({id: 'b', durationInFrames: 90}), scene({id: 'c', durationInFrames: 60})],
  });
  assert.deepEqual(sceneOffsets(c), [0, 120, 210]);
  assert.equal(totalDurationInFrames(c), 270);
});

test('a config with no scenes is rejected rather than rendered blank', () => {
  assert.ok(validateEpisodeConfig(config({scenes: []})).some((p) => p.startsWith('scenes:')));
});

test('duplicate scene ids are caught', () => {
  const problems = validateEpisodeConfig(config({scenes: [scene({id: 'x'}), scene({id: 'x'})]}));
  assert.ok(problems.some((p) => p.includes('duplicate id "x"')));
});

test('an asset path that escapes the episode folder is rejected', () => {
  for (const bad of ['/etc/passwd.png', '../other-episode/assets/a.png']) {
    const problems = validateEpisodeConfig(config({scenes: [scene({assets: {background: bad}})]}));
    assert.ok(
      problems.some((p) => p.includes('episode-relative')),
      `expected "${bad}" to be rejected as non-episode-relative`,
    );
  }
});

test('on-screen text that starts after its scene ends is caught', () => {
  const problems = validateEpisodeConfig(
    config({scenes: [scene({durationInFrames: 60, onScreenText: [{text: 'late', atFrame: 60}]})]}),
  );
  assert.ok(problems.some((p) => p.includes('starts after the scene ends')));
});

test('on-screen text frames are scene-relative, so an early frame is fine', () => {
  const problems = validateEpisodeConfig(
    config({scenes: [scene({id: 'a'}), scene({id: 'b', onScreenText: [{text: 'ok', atFrame: 5}]})]}),
  );
  assert.deepEqual(problems, []);
});

test('every problem is reported, not just the first', () => {
  const problems = validateEpisodeConfig({id: '', fps: 0, width: 0, height: 0, look: null, scenes: [{}]});
  assert.ok(problems.length >= 5, `expected a full list, got ${problems.length}: ${problems.join(' | ')}`);
});

test('a zero-length scene cannot slip through', () => {
  const problems = validateEpisodeConfig(config({scenes: [scene({durationInFrames: 0})]}));
  assert.ok(problems.some((p) => p.includes('durationInFrames')));
});

test('an optional role is used when present and dropped when absent', () => {
  // The reason this exists: a scene that wants a figure is worthless without
  // one, but making the figure required means the day the generator hands back
  // an empty room the whole reel stops rendering. Optional roles make that not
  // a choice — the scene degrades and the episode still renders.
  const assets = {background: 'bg.png', '?character': 'man.png'};
  assert.deepEqual(resolveAssets(assets), {background: 'bg.png', character: 'man.png'});
  assert.deepEqual(resolveAssets(assets, (f) => f === 'man.png'), {background: 'bg.png'});
});

test('a required role is never dropped, however missing it is', () => {
  assert.deepEqual(resolveAssets({background: 'bg.png'}, () => true), {background: 'bg.png'});
});

test('the ? is stripped so templates never see it', () => {
  assert.deepEqual(Object.keys(resolveAssets({'?haze': 'h.png'})), ['haze']);
});

/**
 * An empty title slate is invisible to everything downstream — it renders, it
 * is the right length, and it looks intended. Same class as an unknown scene
 * type, so it is refused in the same place: the one validator both the CLI and
 * the render bundle run.
 */
test('a title-slate with nothing on it is refused', () => {
  const slate = (params, extra = {}) =>
    config({scenes: [scene({sceneType: 'title-slate', params, ...extra})]});
  assert.match(validateEpisodeConfig(slate({})).join(' '), /empty card/);
  assert.match(validateEpisodeConfig(slate({title: '   '})).join(' '), /empty card/);
  assert.deepEqual(validateEpisodeConfig(slate({title: 'FIFTEEN FEET'})), []);
  assert.deepEqual(validateEpisodeConfig(slate({kicker: 'BOSTON'})), []);
  assert.deepEqual(
    validateEpisodeConfig(slate({}, {onScreenText: [{text: 'SIX HOURS', atFrame: 10, durationInFrames: 20}]})),
    [],
    'a card carrying typed words is not empty',
  );
});

test('motion timings mean nothing without motion itself', () => {
  const withLayer = (layer) =>
    config({scenes: [scene({assets: {clip: 'assets/clip-01.mp4'}, layers: [{role: 'clip', ...layer}]})]});
  assert.deepEqual(validateEpisodeConfig(withLayer({motion: true, motionFrom: 2, motionSpeed: 0.5})), []);
  assert.match(validateEpisodeConfig(withLayer({motionFrom: 2})).join(' '), /only mean something/);
  assert.match(validateEpisodeConfig(withLayer({motion: true, motionSpeed: 0})).join(' '), /greater than 0/);
  assert.match(validateEpisodeConfig(withLayer({motion: 'yes'})).join(' '), /must be true or false/);
});
