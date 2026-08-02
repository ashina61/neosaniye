import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCanonicalTimeline, expandTimelineForMedia, validateCanonicalTimeline } from '../src/pipeline/canonicalTimeline.js';

const scenes = [{ narration: 'Alpha beta.' }, { narration: 'Gamma delta.' }];

test('prefers observed narration timing and covers full narration', () => {
  const timeline = buildCanonicalTimeline({
    scenes,
    duration: 4,
    timingSource: 'edge-tts-boundary',
    wordTimings: [
      { word: 'Alpha', start: 0.1, end: 0.7 }, { word: 'beta.', start: 0.8, end: 1.5 },
      { word: 'Gamma', start: 1.8, end: 2.5 }, { word: 'delta.', start: 2.6, end: 3.8 },
    ],
  });
  assert.equal(timeline.source, 'edge-tts-boundary');
  assert.equal(timeline.scenes[0].end, 1.8);
  assert.equal(timeline.scenes.at(-1).end, 4);
  assert.deepEqual(validateCanonicalTimeline(timeline), []);
});

test('uses explicit fallback when real timings are absent', () => {
  const timeline = buildCanonicalTimeline({ scenes, duration: 4, wordTimings: [] });
  assert.equal(timeline.fallbackUsed, true);
  assert.equal(timeline.source, 'estimated-word-count-fallback');
  assert.deepEqual(validateCanonicalTimeline(timeline), []);
});

test('media expansion is monotonic, non-overlapping and scene aligned', () => {
  const timeline = buildCanonicalTimeline({ scenes, duration: 4, wordTimings: [] });
  const expanded = expandTimelineForMedia(timeline, [{ scene: 0 }, { scene: 0 }, { scene: 1 }]);
  assert.equal(expanded.items.length, 3);
  assert.equal(expanded.items[1].start, expanded.items[0].end);
  assert.equal(expanded.items.at(-1).end, 4);
  assert.ok(expanded.items.every((x) => x.duration > 0));
});
