/**
 * THE CLOCK.
 *
 * The reference build says it three times: the voiceover file is not a layer,
 * it is the TIMELINE — "every scene's length was cut to fit its gaps", "I cut
 * every scene to the pauses between these lines". Every duration in this repo
 * used to come from `words / 2.7 * 30`, which is a guess standing in for a
 * measurement, and it is why nine scenes once came out at the same length.
 *
 * So the maths that turns an alignment into scene lengths has to be right to
 * the frame. If it drifts, the words come away from their own pictures, and
 * that is not something a still frame will ever show you.
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {JOIN, scriptOf, windowsFor} from '../scripts/voice-episode.mjs';
import {splitWindow} from '../scripts/plan-episode.mjs';

/**
 * A synthetic alignment: every character takes `per` seconds, and the blank
 * line between paragraphs is a real pause. That is enough to check the index
 * arithmetic, which is the only part that can be wrong.
 */
function alignment(text, per = 0.05) {
  const characters = [...text];
  const starts = characters.map((_, i) => Number((i * per).toFixed(6)));
  const ends = characters.map((_, i) => Number(((i + 1) * per).toFixed(6)));
  return {characters, character_start_times_seconds: starts, character_end_times_seconds: ends};
}

const LINES = ['One two three.', 'Four five.', 'Six seven eight nine.'];

test('the script is one pass, one paragraph per line', () => {
  // Line-by-line synthesis gives clips with different amounts of air at their
  // edges, and the gaps BETWEEN lines are exactly what is being measured.
  const script = scriptOf(LINES.map((vo) => ({vo})));
  assert.equal(script, LINES.join(JOIN));
  assert.equal(script.split(JOIN).length, 3);
});

test('every line gets its own window, in order, with no overlap', () => {
  const script = LINES.join(JOIN);
  const windows = windowsFor(LINES, alignment(script));

  assert.equal(windows.length, 3);
  for (const [i, w] of windows.entries()) {
    assert.equal(w.text, LINES[i]);
    assert.ok(w.end > w.start, `line ${i + 1}: ${w.start}–${w.end} is not a window`);
    if (i) assert.equal(w.start, windows[i - 1].end, `line ${i + 1} must start where line ${i} ended`);
  }
});

test('the reel starts at zero and runs to the end of the file', () => {
  // A first line that starts late leaves the reel opening on silence; a last
  // line that ends early clips the final word off the render.
  const script = LINES.join(JOIN);
  const align = alignment(script);
  const windows = windowsFor(LINES, align);
  const total = align.character_end_times_seconds[align.character_end_times_seconds.length - 1];

  assert.equal(windows[0].start, 0);
  assert.equal(windows[windows.length - 1].end, total);
});

test('the silence between lines belongs to the line that follows it', () => {
  // A cut lands on the breath BEFORE a sentence, not in the middle of the one
  // that just finished.
  const script = LINES.join(JOIN);
  const align = alignment(script, 0.1);
  const windows = windowsFor(LINES, align);

  // Line 1's spoken text ends before line 2's first character starts; the pause
  // in between must sit inside line 2's window, not line 1's.
  const secondStarts = align.character_start_times_seconds[LINES[0].length + JOIN.length];
  assert.ok(windows[1].start < secondStarts, 'line 2 must own the pause before it');
  assert.equal(windows[0].end, windows[1].start);
});

test('fragments divide their line exactly — the reel never drifts', () => {
  // Rounding each fragment on its own loses a frame here and there, and over a
  // reel that is how the last line ends up cut off.
  for (const [start, end] of [
    [0, 3.4],
    [3.4, 7.13],
    [12.02, 12.55],
  ]) {
    const fragments = ['a short one', 'a considerably longer fragment than the first', 'mid'];
    const cuts = splitWindow(fragments, start, end);
    const expected = Math.round(end * 30) - Math.round(start * 30);
    assert.equal(
      cuts.reduce((a, b) => a + b, 0),
      expected,
      `${start}–${end}s must come to exactly ${expected} frames, got ${cuts.join('+')}`,
    );
    for (const frames of cuts) assert.ok(frames >= 1, 'no fragment may be zero frames');
  }
});

test('a longer fragment gets more of the window', () => {
  const cuts = splitWindow(['one', 'one two three four five six'], 0, 6);
  assert.ok(cuts[1] > cuts[0], `expected the longer phrase to hold longer, got ${cuts.join('+')}`);
});

test('one fragment takes the whole window', () => {
  assert.deepEqual(splitWindow(['the only thing said here'], 2, 4), [60]);
});
