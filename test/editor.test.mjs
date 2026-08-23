/**
 * THE REEL AS A WHOLE — a test suite for the failure no per-shot check can see.
 *
 * "Slideshow" is not a property any shot has. Ten shots that each pass every
 * check in this repo can still be a slideshow, because what makes it one is
 * that they are the SAME shot ten times, and sameness only exists between
 * things. These tests build reels rather than shots.
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {editReel, informationDensity, motionDensity, readingFrames, rhythm, signatureOf, slideshow} from '../scripts/lib/editor.mjs';
import {directCut, cutMix} from '../scripts/lib/cut.mjs';
import {temporalProblems} from '../scripts/lib/temporal.mjs';
import {boundsOf, clippingProblems} from '../scripts/lib/critique.mjs';
import {countWindow, gearTrainLayout, gearsMesh, trainInsideFrame} from '../engine/state.mjs';

/** One shot: a photograph, a slow push, a caption. The reel's whole vocabulary. */
const shot = (i, over = {}) => ({
  id: `s${i}`,
  sceneType: 'composite',
  durationInFrames: 78,
  assets: {photo: 'assets/a.jpg'},
  params: {
    caption: ['a line of narration'],
    captionFrame: 6,
    cameraMove: 'push',
    pushFrom: 1,
    pushTo: 1.2,
    plateWidth: 0.9,
    accent: '#c8d94a',
  },
  ...over,
});

const reel = (scenes) => ({fps: 30, width: 1080, height: 1920, scenes});

/* ── ANTI-SLIDESHOW ────────────────────────────────────────────────────── */

test('ten identical shots are a slideshow, however well each one scores', () => {
  const found = slideshow(Array.from({length: 10}, (_, i) => shot(i)));
  assert.ok(found, 'ten of the same shot were not reported as a slideshow');
  assert.ok(found.share >= 0.6);
  assert.equal(editReel(reel(Array.from({length: 10}, (_, i) => shot(i)))).errors.length, 1);
});

test('a reel that varies its shots is not a slideshow', () => {
  const scenes = [
    shot(0),
    shot(1, {durationInFrames: 40, params: {...shot(1).params, cameraMove: 'pull', pushFrom: 1.3, pushTo: 1}}),
    shot(2, {assets: {}, diagram: {type: 'timeline', from: 2, events: [{at: 1901}, {at: 1951}]}}),
    shot(3, {durationInFrames: 130, params: {...shot(3).params, cameraMove: 'pan', panX: 180, plateWidth: 0.5}}),
    shot(4, {assets: {}, sceneType: 'title-slate', params: {title: 'FOURTEEN HUNDRED', titleFrame: 8}}),
    shot(5, {durationInFrames: 52, params: {...shot(5).params, cameraMove: 'hold'}}),
  ];
  assert.equal(slideshow(scenes), null);
  assert.equal(editReel(reel(scenes)).errors.length, 0);
});

test('a shot where literally nothing happens is an error, not a note', () => {
  const dead = {id: 'dead', sceneType: 'composite', durationInFrames: 120, assets: {photo: 'a.jpg'}, params: {}};
  const {errors} = editReel(reel([shot(0), dead, shot(2)]));
  assert.ok(errors.some((e) => e.includes('nothing happens in it')), errors.join(' | '));
});

/* ── ANTI-MOTION-NOISE ─────────────────────────────────────────────────── */

test('four things landing together is one unreadable moment, not four beats', () => {
  const noisy = shot(0, {
    props: [
      {kind: 'card', from: 20},
      {kind: 'plaque', from: 21},
      {kind: 'wire', from: 22},
    ],
    params: {...shot(0).params, captionFrame: 20, motif: 'coins', motifFrame: 21},
  });
  const [density] = motionDensity([noisy]);
  assert.ok(density.busiest >= 4, `busiest cluster was ${density.busiest}`);
  const {warnings} = editReel(reel([noisy, shot(1), shot(2), shot(3)]));
  assert.ok(warnings.some((w) => w.includes('unreadable moment')), warnings.join(' | '));
});

test('the same events, spread out, are beats rather than noise', () => {
  const paced = shot(0, {
    durationInFrames: 140,
    props: [
      {kind: 'card', from: 20},
      {kind: 'plaque', from: 55},
      {kind: 'wire', from: 95},
    ],
  });
  const [density] = motionDensity([paced]);
  assert.equal(density.busiest, 1);
  assert.equal(density.beats, 4);
});

/* ── RHYTHM ────────────────────────────────────────────────────────────── */

test('a reel where every shot is the same length has no rhythm', () => {
  const beat = rhythm(Array.from({length: 8}, () => ({durationInFrames: 78})));
  assert.ok(beat.variation < 0.18, `variation was ${beat.variation}`);
  const scenes = Array.from({length: 8}, (_, i) => shot(i, {assets: {photo: `a${i}.jpg`}}));
  assert.ok(editReel(reel(scenes)).warnings.some((w) => w.startsWith('rhythm:')));
});

test('a hook that cuts fast and a verdict that holds is rhythm', () => {
  const beat = rhythm([34, 40, 52, 78, 96, 130].map((f) => ({durationInFrames: f})));
  assert.ok(beat.variation > 0.18 && beat.variation < 0.85, `variation was ${beat.variation}`);
});

/* ── INFORMATION DENSITY ───────────────────────────────────────────────── */

test('a caption that arrives with under a second left was never read', () => {
  const late = shot(0, {
    durationInFrames: 64,
    params: {...shot(0).params, caption: ['it sat in a', 'museum drawer'], captionFrame: 40},
  });
  const [info] = informationDensity([late]);
  assert.equal(info.readable, false);
  assert.ok(info.words === 6);
});

test('the planner and the editor agree on how long words need', () => {
  // The check and the schedule must use one number; two numbers is a checker
  // arguing with the thing it checks.
  const frames = readingFrames(6, 30);
  const ok = shot(0, {
    durationInFrames: 64,
    params: {...shot(0).params, caption: ['it sat in a', 'museum drawer'], captionFrame: 64 - frames},
  });
  assert.equal(informationDensity([ok])[0].readable, true);
});

/* ── THE CUT DIRECTOR ──────────────────────────────────────────────────── */

test('HARD_CUT is an answer, not the absence of one', () => {
  const decision = directCut({
    previous: shot(0, {assets: {photo: 'a.jpg'}}),
    next: shot(1, {assets: {photo: 'b.jpg'}}),
    beat: 'DETAIL',
    rand: () => 0.5,
  });
  assert.equal(decision.kind, 'HARD_CUT');
  assert.equal(decision.execution, null);
  assert.ok(decision.because.length > 0, 'a hard cut still has to say why');
});

test('two shots of one subject rhyme, and a rhyme is never decorated', () => {
  const decision = directCut({
    previous: shot(0, {assets: {photo: 'assets/moon.jpg'}}),
    next: shot(1, {assets: {photo: 'assets/moon.jpg'}}),
    beat: 'REVEAL',
    rand: () => 0.5,
  });
  assert.equal(decision.kind, 'MATCH_CUT');
  assert.equal(decision.execution, null, 'a wipe over a match cut hides the thing that makes it work');
});

test('a circle onto a circle is a match cut', () => {
  const gears = {id: 'a', sceneType: 'composite', durationInFrames: 60, diagram: {type: 'gearSystem', count: 30}, params: {}};
  const orbit = {id: 'b', sceneType: 'composite', durationInFrames: 60, diagram: {type: 'orbit'}, params: {}};
  assert.equal(directCut({previous: gears, next: orbit, beat: 'PAYOFF', rand: () => 0.5}).kind, 'MATCH_CUT');
});

test('a shared accent is NOT a match cut — six match cuts is no match cuts', () => {
  const a = {id: 'a', sceneType: 'composite', durationInFrames: 60, diagram: {type: 'timeline'}, params: {accent: '#c8d94a'}};
  const b = {id: 'b', sceneType: 'composite', durationInFrames: 60, diagram: {type: 'gearSystem'}, params: {accent: '#c8d94a'}};
  const decision = directCut({previous: a, next: b, beat: 'DETAIL', rand: () => 0.5});
  assert.equal(decision.kind, 'HARD_CUT');
  assert.ok(decision.because.includes('graphic continuity'));
});

test('past the cap, the excess goes back to hard cuts', () => {
  const decision = directCut({
    previous: shot(0, {assets: {photo: 'a.jpg'}}),
    next: shot(1, {assets: {photo: 'b.jpg'}}),
    beat: 'REVEAL',
    rand: () => 0.5,
    used: {FLASH: 2, OBJECT_WIPE: 2},
    total: 10,
  });
  assert.equal(decision.kind, 'HARD_CUT');
});

test('a reel is counted by how much of it is plain', () => {
  const mix = cutMix([{kind: 'HARD_CUT'}, {kind: 'MATCH_CUT'}, {kind: 'FLASH'}, {kind: 'HARD_CUT'}]);
  assert.equal(mix.hardRatio, 0.75);
  assert.equal(mix.tally.HARD_CUT, 2);
});

/* ── TEMPORAL CONSISTENCY, THROUGH THE VALIDATOR ───────────────────────── */

test('a reel still spinning at the cut is an error', () => {
  const {errors} = temporalProblems(
    reel([{id: 'slate', sceneType: 'title-slate', durationInFrames: 40, params: {spinTo: 'THIRTY', spinReel: ['TEN', 'TWENTY'], titleFrame: 10, spinFrames: 60}}]),
  );
  assert.ok(errors.some((e) => e.includes('never lands')), errors.join(' | '));
});

test('a counter that cannot reach its figure before the cut is an error', () => {
  const {errors} = temporalProblems(
    reel([{id: 'c', sceneType: 'composite', durationInFrames: 40, diagram: {type: 'gearSystem', count: 30, countTo: 30, from: 4, over: 90}, params: {}}]),
  );
  assert.ok(errors.some((e) => e.includes('never reaches 30')), errors.join(' | '));
});

test('an orbit that leaves the frame is an error', () => {
  const {errors} = temporalProblems(
    reel([{id: 'o', sceneType: 'composite', durationInFrames: 90, diagram: {type: 'orbit', cx: 0.5, cy: 0.15, radius: 0.42}, params: {}}]),
  );
  assert.ok(errors.some((e) => e.includes('leaves the frame')), errors.join(' | '));
});

/* ── GEOMETRY: NOTHING THROUGH THE WORDS, NOTHING OFF THE EDGE ─────────── */

test('the laid-out gear train is wholly inside the frame', () => {
  // Two wheels shipped cut in half by the right edge, because the bounds check
  // only ran on DECLARED gears and the planner deletes them.
  for (const count of [8, 12, 20, 30, 44]) {
    assert.ok(trainInsideFrame(gearTrainLayout(count)), `a train of ${count} left the frame`);
  }
});

test('fitting the train into the frame does not break the mesh', () => {
  // Scaling about the hub is the one transform that cannot: every radius and
  // every centre distance moves by the same factor.
  const gears = gearTrainLayout(30);
  for (const gear of gears.slice(1)) {
    assert.ok(gearsMesh(gears[0], gear, {aspect: 1920 / 1080}), 'a fitted wheel stopped touching the hub');
  }
});

test('a graphic drawn through a sentence is an error', () => {
  const {errors} = clippingProblems(
    reel([
      {
        id: 'verdict',
        sceneType: 'title-slate',
        durationInFrames: 130,
        params: {title: 'FOURTEEN HUNDRED', titleFrame: 10, titleY: 960, titleSize: 124},
        props: [{kind: 'wire', shape: 'rect', x: 540, y: 960, width: 400, from: 8}],
      },
    ]),
  );
  assert.ok(errors.some((e) => e.includes('drawn through slate title')), errors.join(' | '));
});

test('a mark on the emphasis word is typography, not a collision', () => {
  // A highlight is drawn ON the word; touching the type is its whole function.
  const {errors} = clippingProblems(
    reel([
      {
        id: 'line',
        sceneType: 'composite',
        durationInFrames: 90,
        params: {caption: ['a line'], captionY: 400, captionSize: 88, mark: 'strike', markX: 84, markY: 400, markWidth: 300, markHeight: 90},
      },
    ]),
  );
  assert.equal(errors.length, 0, errors.join(' | '));
});

test('a derived gear train is measured, not skipped', () => {
  // The check used to run only when the config declared its wheels, which the
  // planner never does — live on the case that never happens.
  const boxes = boundsOf(
    {id: 'g', sceneType: 'composite', durationInFrames: 90, diagram: {type: 'gearSystem', count: 30}, params: {}},
    {width: 1080, height: 1920},
  );
  assert.ok(boxes.filter((b) => b.what.startsWith('diagram gear')).length >= 3);
});

/* ── THE COUNT LANDS BEFORE THE CUT ────────────────────────────────────── */

test('the count window is pulled inside the shot', () => {
  // from 0, over 26 puts the default landing at frame 60 of a 58-frame shot,
  // and the reel shipped showing 29 on a claim about thirty gears.
  const win = countWindow({from: 0, over: 26}, 58);
  assert.ok(win.start + win.over <= 58 - 6, `lands at ${win.start + win.over} of 58`);
});

test('a counter that lands after the cut is an error, measured on the real window', () => {
  const {errors} = temporalProblems(
    reel([
      {
        id: 'g',
        sceneType: 'composite',
        durationInFrames: 58,
        diagram: {type: 'gearSystem', count: 30, countTo: 30, from: 0, over: 26, countFrom: 13, countOver: 90},
        params: {},
      },
    ]),
  );
  assert.ok(errors.some((e) => e.includes('never reaches 30')), errors.join(' | '));
});

test('the window the planner writes satisfies the check', () => {
  const diagram = {type: 'gearSystem', count: 30, countTo: 30, from: 0, over: 26};
  const win = countWindow(diagram, 58);
  const {errors} = temporalProblems(
    reel([
      {
        id: 'g',
        sceneType: 'composite',
        durationInFrames: 58,
        diagram: {...diagram, countFrom: win.start, countOver: win.over},
        params: {},
      },
    ]),
  );
  assert.deepEqual(errors, []);
});
