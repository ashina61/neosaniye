/**
 * TEMPORAL CONSISTENCY — a visual must have a valid state at EVERY frame.
 *
 * Not at the frames somebody happened to sample. The slot reel's double-value
 * frame survived two rounds of review because a contact sheet takes four
 * stills out of sixty and the broken state lived in the ones between; the mask
 * that was put over it afterwards hid the evidence without changing the fact.
 *
 * So these tests walk every frame and assert the invariant, and they call the
 * SAME function the component draws with — a test that re-implements the
 * mechanism is a test of the re-implementation.
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  contains,
  counterValue,
  gearAngle,
  gearsMesh,
  insideFrame,
  slotReadableCount,
  slotState,
} from '../engine/state.mjs';
import {gearTrainLayout} from '../scripts/lib/temporal.mjs';

/* ── THE SLOT REEL ─────────────────────────────────────────────────────── */

const REEL = {from: 6, spin: 40, count: 5};

test('NEVER two readable values — the defect, asserted on every frame', () => {
  for (let frame = 0; frame <= REEL.from + REEL.spin + 30; frame += 1) {
    const readable = slotReadableCount(frame, REEL);
    assert.ok(readable <= 1, `frame ${frame}: ${readable} values readable at once`);
  }
});

test('a value is readable for long enough to be read', () => {
  let readable = 0;
  for (let frame = 0; frame <= REEL.from + REEL.spin; frame += 1) {
    if (slotReadableCount(frame, REEL) === 1) readable += 1;
  }
  // A reel that is unreadable for most of its spin is a blur with extra steps.
  assert.ok(readable > REEL.spin * 0.5, `only ${readable} of ${REEL.spin} frames showed a value`);
});

test('the reel settles on the answer and stays there', () => {
  const last = REEL.count - 1;
  for (const frame of [REEL.from + REEL.spin, REEL.from + REEL.spin + 1, REEL.from + REEL.spin + 200]) {
    const state = slotState(frame, last, REEL);
    assert.equal(state.phase, 'settled');
    assert.equal(state.offset, 0);
    assert.ok(state.readable);
  }
});

test('nothing shows its answer before the reel starts', () => {
  for (let i = 0; i < REEL.count; i += 1) {
    assert.equal(slotState(0, i, REEL).readable, false);
  }
});

test('a value exits completely before the next begins to enter', () => {
  // The property the whole mechanism rests on: no frame has two rows inside
  // the window at all, readable or not.
  for (let frame = REEL.from; frame <= REEL.from + REEL.spin; frame += 1) {
    let inWindow = 0;
    for (let i = 0; i < REEL.count; i += 1) {
      if (Math.abs(slotState(frame, i, REEL).offset) < 1) inWindow += 1;
    }
    assert.ok(inWindow <= 1, `frame ${frame}: ${inWindow} rows inside the window`);
  }
});

test('every row gets a turn — the reel is a choice, not a fade to the answer', () => {
  const seen = new Set();
  for (let frame = REEL.from; frame <= REEL.from + REEL.spin; frame += 1) {
    for (let i = 0; i < REEL.count; i += 1) if (slotState(frame, i, REEL).readable) seen.add(i);
  }
  assert.equal(seen.size, REEL.count, `only ${seen.size} of ${REEL.count} values were ever shown`);
});

/* ── COUNTERS ──────────────────────────────────────────────────────────── */

test('a counter never goes backwards', () => {
  let previous = -Infinity;
  for (let frame = 0; frame <= 120; frame += 1) {
    const value = counterValue(frame, {from: 10, over: 40, to: 30});
    assert.ok(value >= previous, `frame ${frame}: ${value} after ${previous}`);
    previous = value;
  }
});

test('a counter lands EXACTLY on its figure', () => {
  // 29 on a claim about thirty gears has quietly falsified the claim.
  assert.equal(counterValue(50, {from: 10, over: 40, to: 30}), 30);
  assert.equal(counterValue(500, {from: 10, over: 40, to: 30}), 30);
  assert.equal(counterValue(10, {from: 10, over: 40, to: 30}), 0);
});

test('a counter never overshoots on the way', () => {
  for (let frame = 0; frame <= 60; frame += 1) {
    assert.ok(counterValue(frame, {from: 4, over: 40, to: 30}) <= 30);
  }
});

/* ── GEARS ─────────────────────────────────────────────────────────────── */

test('a meshed wheel turns the other way, at the inverse of the tooth counts', () => {
  const drive = gearAngle(30, {fps: 30, rate: 20, driven: true});
  const half = gearAngle(30, {fps: 30, rate: 20, driveTeeth: 32, teeth: 16});
  assert.ok(drive > 0 && half < 0, 'a meshed wheel must turn the opposite way');
  // Half the teeth, twice the angle.
  assert.ok(Math.abs(Math.abs(half) - drive * 2) < 0.001, `${half} against ${drive}`);
});

test('the laid-out train actually meshes', () => {
  const gears = gearTrainLayout(30);
  const drive = gears[0];
  for (const gear of gears.slice(1)) {
    assert.ok(
      gearsMesh(drive, gear, {aspect: 1920 / 1080}),
      `a wheel at ${gear.x.toFixed(2)},${gear.y.toFixed(2)} r=${gear.radius.toFixed(2)} does not touch the driven wheel`,
    );
  }
});

/* ── CONTAINMENT ───────────────────────────────────────────────────────── */

test('a ring drawn round a subject contains it', () => {
  assert.ok(contains({cx: 540, cy: 800, radius: 320}, {cx: 540, cy: 800, radius: 260}));
  assert.equal(contains({cx: 540, cy: 800, radius: 200}, {cx: 540, cy: 800, radius: 260}), false);
});

test('a ring inside the frame is inside the frame', () => {
  const frame = {width: 1080, height: 1920};
  assert.ok(insideFrame({cx: 540, cy: 800, radius: 400}, frame));
  // The moon's orbit, as it shipped: centred high with a radius that took its
  // top off the composition.
  assert.equal(insideFrame({cx: 540, cy: 300, radius: 400}, frame), false);
});
