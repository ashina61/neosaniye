/**
 * THE DIRECTOR IS THE PART THAT DECIDES WHETHER ANYTHING HAPPENS.
 *
 * Every other guard in this repo checks that a config is well formed and that
 * its files exist. A reel can pass all of them and still be seven photographs
 * being slowly scaled, which is what it was. So these tests are about the one
 * property none of the others can see: that a shot does something, more than
 * once, at times a viewer can read.
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  beatSchedule,
  cameraMove,
  chooseReveal,
  directShot,
  emphasisOf,
  escalation,
  eventBudget,
  withoutRepeats,
} from '../scripts/lib/director.mjs';

/** The planner's stream, reproduced so a test is deterministic like a reel is. */
function seeded(seed) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return () => {
    h = Math.imul(h ^ (h >>> 15), h | 1) >>> 0;
    h ^= h + Math.imul(h ^ (h >>> 7), h | 61);
    return ((h ^ (h >>> 14)) >>> 0) / 4294967296;
  };
}

test('a shot is never given fewer than two things to do', () => {
  for (const frames of [45, 60, 90, 135, 200]) {
    assert.ok(eventBudget(frames) >= 2, `${frames} frames got ${eventBudget(frames)} events`);
  }
  // …and a flash is allowed to be one thing, because two events in a second
  // and a half is a stutter rather than a shot.
  assert.equal(eventBudget(30), 1);
});

test('a shot is never given so many that nobody can read it', () => {
  assert.ok(eventBudget(600) <= 5);
});

test('the first event is early and the last one lands before the cut', () => {
  const rand = seeded('beats');
  for (const frames of [50, 80, 140, 210]) {
    const beats = beatSchedule(frames, eventBudget(frames), rand);
    assert.ok(beats[0] <= Math.max(12, frames * 0.1), `first beat at ${beats[0]} of ${frames}`);
    assert.ok(
      beats[beats.length - 1] <= frames * 0.86,
      `last beat at ${beats[beats.length - 1]} of ${frames} — the cut takes it`,
    );
  }
});

test('events do not bunch into one event with a stutter', () => {
  const rand = seeded('gaps');
  for (const frames of [60, 100, 180]) {
    const beats = beatSchedule(frames, eventBudget(frames), rand);
    for (let i = 1; i < beats.length; i += 1) {
      assert.ok(beats[i] - beats[i - 1] >= 6, `beats ${beats[i - 1]} and ${beats[i]} are the same moment`);
    }
  }
});

test('the emphasis is the figure with the thing it counts', () => {
  assert.equal(emphasisOf('The stone weighs 1,000 tons'), '1,000 tons');
  assert.equal(emphasisOf('for fifty years before anyone looked inside'), 'fifty years');
  assert.equal(emphasisOf('Nothing this complex was built again for fourteen hundred years'), 'fourteen hundred years');
});

test('a bare number keeps its unit off the stop list', () => {
  // "twenty of the" is not a fact. The unit only comes along when it is one.
  assert.equal(emphasisOf('the ash went twenty miles up'), 'twenty miles');
  assert.equal(emphasisOf('in 1901 divers found a wreck'), '1901');
});

test('with no figure the emphasis is a name, and never merely the first word', () => {
  assert.equal(emphasisOf('Among the statues lay Kasparov'), 'Kasparov');
  // The opening word is capitalised because it opens a sentence, so it does not
  // win the NAME pass — a real name later in the line does.
  assert.equal(emphasisOf('Divers found the Antikythera wreck'), 'Antikythera');
});

test('an empty line asks for no emphasis rather than inventing one', () => {
  assert.equal(emphasisOf(''), '');
  assert.equal(emphasisOf('   '), '');
});

test('nothing is used three times running', () => {
  const rand = seeded('repeat');
  const recent = ['rise', 'rise'];
  for (let i = 0; i < 40; i += 1) {
    assert.notEqual(withoutRepeats(['rise', 'wipe', 'blur'], recent, rand), 'rise');
  }
});

test('a rhyme is allowed — the rule is three, not two', () => {
  const rand = seeded('rhyme');
  const seen = new Set();
  for (let i = 0; i < 60; i += 1) seen.add(withoutRepeats(['rise', 'wipe'], ['rise'], rand));
  assert.ok(seen.has('rise'), 'forbidding a repeat outright makes a reel alternate mechanically');
});

test('a reveal is always one the type layer knows', () => {
  const rand = seeded('reveals');
  const known = new Set(['rise', 'wipe', 'blur', 'char', 'punch']);
  for (let i = 0; i < 50; i += 1) assert.ok(known.has(chooseReveal(rand, [])));
});

test('a short shot is never asked to pan', () => {
  const rand = seeded('pan');
  for (let i = 0; i < 40; i += 1) {
    const move = cameraMove({rand, recent: [], durationInFrames: 40, intensity: 0.5});
    assert.notEqual(move.kind, 'pan', 'a pan nobody has time to see is a plate vibrating');
  }
});

test('no camera move ever scales a fill plate below the frame', () => {
  const rand = seeded('scale');
  for (let i = 0; i < 200; i += 1) {
    const {params} = cameraMove({rand, recent: [], durationInFrames: 90, intensity: i / 200});
    assert.ok(params.pushFrom >= 1, `pushFrom ${params.pushFrom}`);
    assert.ok(params.pushTo >= 1, `pushTo ${params.pushTo}`);
  }
});

test('a pan starts oversize, or it pans onto nothing', () => {
  const rand = seeded('panscale');
  for (let i = 0; i < 300; i += 1) {
    const {kind, params} = cameraMove({rand, recent: [], durationInFrames: 120, intensity: 0.6});
    if (kind !== 'pan') continue;
    assert.ok(params.pushFrom > 1.05, `a pan at ${params.pushFrom} shows the void at the edge`);
  }
});

test('the reel escalates, and opens strong', () => {
  assert.ok(escalation(0, 12) > 0.8, 'the opening has to earn the next two seconds');
  assert.equal(escalation(11, 12), 1);
  assert.ok(escalation(6, 12) > escalation(3, 12), 'shot seven should be a little bigger than shot four');
});

test('a shot that carries nothing is given something to do', () => {
  const rand = seeded('empty');
  const plan = directShot({durationInFrames: 130, index: 3, total: 12, rand, wants: [], recent: {}});
  assert.ok(plan.fill.length >= 2, `a dead 4.3s shot got ${plan.fill.length} fillers`);
  for (const kind of plan.fill) {
    assert.ok(plan.at[kind] !== undefined, `${kind} was chosen and never scheduled`);
  }
});

test('a shot that already works is not decorated', () => {
  const rand = seeded('full');
  const plan = directShot({
    durationInFrames: 60,
    index: 2,
    total: 12,
    rand,
    wants: ['caption', 'prop0', 'motif'],
    recent: {},
  });
  assert.equal(plan.fill.length, 0, 'adding a wireframe to a shot with three events is over-animating');
});

test('what the shot already carries gets the earliest beats', () => {
  const rand = seeded('order');
  const plan = directShot({
    durationInFrames: 140,
    index: 1,
    total: 10,
    rand,
    wants: ['caption'],
    recent: {},
  });
  const filled = plan.fill.map((k) => plan.at[k]);
  for (const at of filled) {
    assert.ok(at > plan.at.caption, 'the words are why the shot is this long — they do not queue behind a mark');
  }
});
