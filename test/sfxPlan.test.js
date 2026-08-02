import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSfxPlan } from '../src/audio/sfxPlan.js';

test('fills a weak one-cue editor plan into spaced story beats', () => {
  const times = [4, 8, 13, 18, 24, 30, 36, 42];
  const plan = normalizeSfxPlan(['whoosh', null, null, null, null, null, null, null], times);
  const used = plan.map((type, i) => ({ type, time: times[i] })).filter((cue) => cue.type);
  assert.equal(used.length, 3);
  assert.ok(used.every((cue, i) => i === 0 || cue.time - used[i - 1].time >= 4));
  assert.ok(new Set(used.map((cue) => cue.type)).size >= 2);
});

test('never exceeds the cue cap or places effects closer than the configured gap', () => {
  const plan = normalizeSfxPlan(['impact', 'whoosh', 'shimmer', 'riser', 'impact'], [5, 6, 12, 18, 24], {
    minCues: 3, maxCues: 4, minGapSeconds: 4,
  });
  const used = plan.map((type, i) => ({ type, time: [5, 6, 12, 18, 24][i] })).filter((cue) => cue.type);
  assert.ok(used.length <= 4);
  assert.ok(used.every((cue, i) => i === 0 || cue.time - used[i - 1].time >= 4));
});
