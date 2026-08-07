/**
 * FINDING THE CUTS IN THE AUDIO ITSELF.
 *
 * The clock used to depend on one vendor returning per-character timings, which
 * means the day that vendor errors, the clock is gone. It does not have to: the
 * pauses are IN THE FILE. Speaking belongs to a provider; measuring belongs
 * here, and works on anything — a synthesiser with no timestamps, a microphone,
 * a file somebody sent over.
 *
 * The one thing this must not do is find the WRONG pauses, because that puts
 * every line after it against the wrong picture, and no still frame will ever
 * show you that.
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {findBoundaries, loudness, windowsFromBoundaries} from '../scripts/lib/measure.mjs';

const RATE = 16_000;

/**
 * Synthetic narration: alternating speech and silence, in seconds.
 * `[0.8, 0.4, 1.2]` is speech, silence, speech.
 */
function pcm(spans, {noise = 0.004} = {}) {
  const total = Math.round(spans.reduce((a, b) => a + b, 0) * RATE);
  const out = new Int16Array(total);
  let cursor = 0;
  spans.forEach((seconds, i) => {
    const length = Math.round(seconds * RATE);
    const speaking = i % 2 === 0;
    for (let n = 0; n < length && cursor < total; n += 1, cursor += 1) {
      // Real silence is never digital zero — a recording has a noise floor, and
      // a finder that only survives true zeros is useless on an actual take.
      const amplitude = speaking ? 0.32 : noise;
      out[cursor] = Math.round(Math.sin((cursor / RATE) * 2 * Math.PI * 180) * amplitude * 32767);
    }
  });
  return out;
}

const near = (actual, expected, tolerance, what) =>
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${what}: expected ~${expected}s, got ${actual.toFixed(3)}s (tolerance ${tolerance}s)`,
  );

test('the cuts land where the narrator stopped', () => {
  //  speech 2s | pause 0.6 | speech 1.5 | pause 0.5 | speech 2s
  const samples = pcm([2, 0.6, 1.5, 0.5, 2]);
  const boundaries = findBoundaries(loudness(samples, RATE), 20, 2);

  assert.equal(boundaries.length, 2);
  near(boundaries[0], 2.0, 0.1, 'first cut');
  near(boundaries[1], 4.1, 0.1, 'second cut');
});

test('the boundary is the START of the pause, not its middle', () => {
  // The silence belongs to the line that FOLLOWS it, so a cut lands on the
  // breath before a sentence rather than in the middle of the one that ended.
  const samples = pcm([1.5, 1.0, 1.5]);
  const [cut] = findBoundaries(loudness(samples, RATE), 20, 1);
  near(cut, 1.5, 0.08, 'cut');
});

test('only the LONGEST pauses count — a narrator breathes mid-sentence too', () => {
  // Five gaps, three of them real boundaries. A threshold alone would return
  // all five and shift every line after the first.
  const samples = pcm([1.5, 0.12, 0.8, 0.7, 1.4, 0.1, 0.6, 0.65, 1.5, 0.6, 1.2]);
  const boundaries = findBoundaries(loudness(samples, RATE), 20, 3);

  assert.equal(boundaries.length, 3);
  // Ascending, always — they are re-sorted after being ranked by length.
  for (let i = 1; i < boundaries.length; i += 1) {
    assert.ok(boundaries[i] > boundaries[i - 1], `boundaries must be in time order: ${boundaries}`);
  }
  // The two 0.1s breaths must NOT have been chosen.
  for (const cut of boundaries) {
    assert.ok(Math.abs(cut - 1.5) > 0.2 && Math.abs(cut - 4.52) > 0.2, `picked a breath at ${cut}`);
  }
});

test('silence at the top of the file is not a boundary', () => {
  // Taking it would push every line one place along — the worst possible
  // failure here, because the reel still renders and every word is wrong.
  const samples = pcm([0, 0.9, 2, 0.5, 2]);
  const boundaries = findBoundaries(loudness(samples, RATE), 20, 1);
  assert.equal(boundaries.length, 1);
  near(boundaries[0], 2.9, 0.12, 'the only real cut');
});

test('a reading with no pauses is refused, not guessed at', () => {
  // Better to say "the lines ran together, record it again" than to invent
  // boundaries and hand back a reel that is quietly out of sync.
  const samples = pcm([4]);
  assert.deepEqual(findBoundaries(loudness(samples, RATE), 20, 3), []);
});

test('windows cover the file end to end with no gaps', () => {
  const windows = windowsFromBoundaries(['one', 'two', 'three'], [2.0, 4.1], 6.2);
  assert.equal(windows[0].start, 0);
  assert.equal(windows[windows.length - 1].end, 6.2);
  for (let i = 1; i < windows.length; i += 1) {
    assert.equal(windows[i].start, windows[i - 1].end, 'a window must start where the last one ended');
  }
});

/**
 * THE OTHER PATH: clips we joined ourselves.
 *
 * Measuring recovers where a narrator paused. But when the pauses are OURS —
 * per-line synthesis, joined here — the boundaries are arithmetic, and knowing
 * beats recovering. Both paths have to agree on the one rule that matters: the
 * silence belongs to the line that follows it.
 */
import {joinWithGaps, readWav, writeWav} from '../scripts/lib/wav.mjs';

const clip = (seconds, rate = 22050) => {
  const samples = new Int16Array(Math.round(seconds * rate));
  for (let i = 0; i < samples.length; i += 1) samples[i] = Math.round(Math.sin(i / 40) * 9000);
  return samples;
};

test('joined clips put every boundary at the end of a clip', () => {
  const rate = 22050;
  const {boundaries, duration} = joinWithGaps([clip(2), clip(1.5), clip(3)], rate, 0.5);

  assert.equal(boundaries.length, 2, 'three clips, two seams');
  assert.equal(boundaries[0], 2, 'the first seam is where the first clip stopped');
  assert.equal(boundaries[1], 4, '2 + 0.5 gap + 1.5');
  assert.equal(duration, 7.5, '2 + 1.5 + 3 + two 0.5 gaps');
});

test('one clip has no seams and no gap', () => {
  const {boundaries, duration} = joinWithGaps([clip(4)], 22050, 0.5);
  assert.deepEqual(boundaries, []);
  assert.equal(duration, 4);
});

test('a wav survives a round trip, header chunks and all', () => {
  // Reading back at a fixed 44-byte offset works until an encoder writes a
  // LIST chunk, and then metadata is read as audio — every sample shifted, and
  // downstream of that, every cut in the reel.
  const samples = clip(0.25);
  const back = readWav(writeWav(samples, 22050));
  assert.equal(back.length, samples.length);
  for (let i = 0; i < samples.length; i += 977) assert.equal(back[i], samples[i], `sample ${i}`);
});
