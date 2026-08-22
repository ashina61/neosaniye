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
import {alignBoundaries, findBoundaries, loudness, silences, windowsFromBoundaries} from '../scripts/lib/measure.mjs';

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

test('the cuts land just before the next line speaks', () => {
  //  speech 2s | pause 0.6 | speech 1.5 | pause 0.5 | speech 2s
  const samples = pcm([2, 0.6, 1.5, 0.5, 2]);
  const boundaries = findBoundaries(loudness(samples, RATE), 20, 2);

  assert.equal(boundaries.length, 2);
  near(boundaries[0], 2.44, 0.08, 'first cut');
  near(boundaries[1], 4.44, 0.08, 'second cut');
});

test('the length of a pause does not move the cut', () => {
  /**
   * THE RULE THIS REPLACES was "the boundary is the start of the pause", and it
   * was wrong in a way that only shows up on a good recording: the pause was
   * handed whole to the incoming line, so every shot opened with however long
   * the narrator happened to hold. On a take read with clean two-second beats —
   * which is exactly what the recording sheet asks for, because that is what
   * makes the pauses findable — thirteen shots each opened on two seconds of
   * silent picture.
   *
   * So the cut sits a FIXED lead before the next line speaks. Reading with
   * longer pauses now makes the measurement easier and changes nothing else.
   */
  const short = findBoundaries(loudness(pcm([1.5, 0.6, 1.5]), RATE), 20, 1)[0];
  const long = findBoundaries(loudness(pcm([1.5, 2.4, 1.5]), RATE), 20, 1)[0];

  near(short, 1.5 + 0.6 - 0.16, 0.08, 'short pause');
  near(long, 1.5 + 2.4 - 0.16, 0.08, 'long pause');
  // Four times the pause, and the gap between the cut and the next word is the
  // same both times.
  near(1.5 + 0.6 - short, 1.5 + 2.4 - long, 0.03, 'lead is constant');
});

test('the lead never reaches back into the sentence that just ended', () => {
  // On a pause shorter than the lead, stepping back a fixed amount would put
  // the cut inside the previous line's last word.
  const [cut] = findBoundaries(loudness(pcm([1.5, 0.12, 1.5]), RATE), 20, 1, {minPauseMs: 60});
  assert.ok(cut >= 1.5, `cut at ${cut} is inside the previous line`);
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
  near(boundaries[0], 3.24, 0.12, 'the only real cut');
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

test('joined clips cut by the same rule the measurer uses', () => {
  // Two paths, one convention. Differ here and a reel cut from a synthesised
  // draft sits a breath away from the same reel cut from a real recording, in
  // every shot, for no reason anyone watching could name.
  const rate = 22050;
  const {boundaries, duration} = joinWithGaps([clip(2), clip(1.5), clip(3)], rate, 0.5);

  assert.equal(boundaries.length, 2, 'three clips, two seams');
  assert.equal(boundaries[0], 2.34, 'a 0.16s lead before the second clip speaks');
  assert.equal(boundaries[1], 4.34, '2 + 0.5 + 1.5 + 0.5 − 0.16');
  assert.equal(duration, 7.5, '2 + 1.5 + 3 + two 0.5 gaps');
});

test('a gap shorter than the lead is split rather than overrun', () => {
  const {boundaries} = joinWithGaps([clip(1), clip(1)], 22050, 0.2);
  assert.equal(boundaries[0], 1.1, 'half of a 0.2s gap, not 0.16 back from its end');
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

/**
 * CHOOSING THE RIGHT SILENCES, NOT THE LONGEST ONES.
 *
 * This is the failure that cost a whole take. A real thirteen-line reading came
 * back with five shots at speaking rates between 0.65 and 7.5 words per second,
 * and the run reported success: the windows still tiled the file end to end, so
 * everything downstream was happy and every picture after the first bad cut sat
 * against the wrong sentence.
 *
 * The cause was not the detector. It was the rule: rank the pauses by length,
 * take the longest N. A line with a full stop in the middle of it has an
 * internal pause the same size as the one at its end, so on any natural read
 * the ranking is a coin toss.
 */
test('a pause inside a line does not steal the cut', () => {
  //  A long first line with a full stop in it, then two short ones. The
  //  mid-line pause is LONGER than the real break that follows it, which is
  //  exactly what a narrator does when a sentence ends inside a paragraph.
  const samples = pcm([1.6, 0.9, 1.6, 0.5, 1.2, 0.5, 1.2]);
  const lines = [
    'Bu geminin bir adı var ama önemli değil. Altı aydır demirde bekleyen yüz elli tankerden biri.',
    'Hürmüz Boğazı. En dar yerinde otuz üç.',
    'Kapı hâlâ kapalı bugün.',
  ];
  const duration = 7.5;
  const found = alignBoundaries(silences(loudness(samples, RATE), 20), lines, duration);

  assert.equal(found.length, 2);
  // The 0.9s pause at 1.6s is inside the first line and must NOT be taken.
  assert.ok(found[0] > 3.0, `took the mid-line pause at ${found[0].toFixed(2)}s`);
  // The cut sits a lead before the next line speaks, so it is near the END of
  // each 0.5s pause: 4.1→4.6 and 5.8→6.3.
  near(found[0], 4.44, 0.12, 'first real break');
  near(found[1], 6.14, 0.12, 'second real break');

  // And the blunt rule gets it wrong on the same input, which is why this
  // function exists.
  const blunt = findBoundaries(loudness(samples, RATE), 20, 2);
  assert.ok(blunt[0] < 3.0, 'the longest-pause rule should still be picking the mid-line pause');
});

test('every line ends up at a speaking rate a person could produce', () => {
  // The check that would have caught it. Nobody reads at 7.5 words a second or
  // at 0.65, so a window claiming either is a cut in the wrong place.
  const samples = pcm([1.6, 0.9, 1.6, 0.5, 1.2, 0.5, 1.2]);
  const lines = [
    'Bu geminin bir adı var ama önemli değil. Altı aydır demirde bekleyen yüz elli tankerden biri.',
    'Hürmüz Boğazı. En dar yerinde otuz üç.',
    'Kapı hâlâ kapalı bugün.',
  ];
  const duration = 7.5;
  const windows = windowsFromBoundaries(
    lines,
    alignBoundaries(silences(loudness(samples, RATE), 20), lines, duration),
    duration,
  );
  for (const w of windows) {
    const rate = w.text.split(/\s+/).filter(Boolean).length / (w.end - w.start);
    assert.ok(rate > 1.0 && rate < 6.0, `${rate.toFixed(2)} words/sec is not a reading`);
  }
});

test('with no candidates at all it returns nothing rather than inventing cuts', () => {
  assert.deepEqual(alignBoundaries([], ['bir', 'iki', 'üç'], 6), []);
  assert.deepEqual(alignBoundaries([{cut: 2, length: 0.5}], ['bir', 'iki', 'üç'], 6), []);
});
