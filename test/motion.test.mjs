/**
 * THE MOTION HELPERS, AT THE LENGTHS SHOTS ACTUALLY ARE.
 *
 * These take numbers and return numbers, which is what makes them cheap to
 * test — and there is one specific thing worth guarding. Every keyframe a
 * helper builds must be in order. A flat frame count mixed in among fractions
 * of the duration stays in order right up until a shot is short, and then
 * Remotion's interpolate throws and takes the whole render with it. That is
 * exactly how a two-second shot broke a reel of nine seven-second ones.
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * focusHunt, ported from engine/motion.ts.
 *
 * Duplicating the key layout would let the two drift, so the test reads the
 * source and pulls the numbers out of it: what is asserted is the ORDER of the
 * keys the real function builds, at every length a shot can be.
 */
function focusHuntKeys(durationInFrames, {clearBy = 21, dipAt = 0.3, dipBack = 0.42} = {}) {
  const span = Math.max(2, durationInFrames);
  const clear = Math.max(1, Math.min(clearBy, Math.round(span * 0.2)));
  const dipStart = Math.max(clear + 1, Math.round(span * dipAt));
  const dipEnd = Math.max(dipStart + 2, Math.round(span * dipBack));
  return [0, clear, dipStart, (dipStart + dipEnd) / 2, dipEnd, Math.max(dipEnd + 1, span)];
}

test('focus hunt keys stay in order at every shot length', () => {
  // 45 is the planner's floor and 118 its ceiling; the range below covers both
  // and the pathological short cases underneath them.
  for (let duration = 2; duration <= 240; duration += 1) {
    const keys = focusHuntKeys(duration);
    for (let i = 1; i < keys.length; i += 1) {
      assert.ok(
        keys[i] > keys[i - 1],
        `duration ${duration}: key ${i} (${keys[i]}) must be greater than ${keys[i - 1]} — got [${keys}]`,
      );
    }
  }
});

test('a shot never spends more than a fifth of itself arriving', () => {
  // The defect this replaces: a flat 21-frame opening on a 45-frame shot meant
  // the lens was still finding focus most of the way through it.
  for (const duration of [45, 60, 90, 118, 215]) {
    const [, clear] = focusHuntKeys(duration);
    assert.ok(clear <= duration * 0.2 + 0.5, `duration ${duration}: opening ${clear} is too long`);
  }
});

test('the port above still matches the engine', async () => {
  // If someone edits the real one and not this, say so here rather than in a
  // render three weeks later.
  const source = await readFile(path.join(ROOT, 'engine', 'motion.ts'), 'utf8');
  const body = source.slice(source.indexOf('export function focusHunt'));
  for (const fragment of [
    'Math.max(2, durationInFrames)',
    'Math.max(1, Math.min(clearBy, Math.round(span * 0.2)))',
    'Math.max(clear + 1, Math.round(span * dipAt))',
    'Math.max(dipStart + 2, Math.round(span * dipBack))',
  ]) {
    assert.ok(body.includes(fragment), `engine/motion.ts no longer contains "${fragment}"`);
  }
});
