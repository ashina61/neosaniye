/**
 * THE CRITIQUE HAS TO CATCH WHAT SHIPPED, AND ONLY WHAT SHIPPED.
 *
 * Half of these tests are the defects it exists to find. The other half are the
 * false alarms it raised on its first run, and they matter just as much: a
 * check that flags the portal — the most kinetic template in the engine — as "a
 * photograph with grain on it" is a check people learn to scroll past, and then
 * the real findings go with it.
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {boundsOf, contrastProblems, critiqueEpisode, eventsOf, throughTheCamera} from '../scripts/lib/critique.mjs';

const reel = (scenes) => ({id: 'x', fps: 30, width: 1080, height: 1920, scenes});
const shot = (over = {}) => ({
  id: 's1',
  sceneType: 'composite',
  durationInFrames: 130,
  layers: [{role: 'bg', depth: 0.1}, {role: 'near', depth: 0.9}],
  params: {caption: ['a line'], captionFrame: 10},
  ...over,
});

const has = (list, needle) => list.some((m) => m.includes(needle));

test('a shot in which nothing happens is an error', () => {
  const {errors} = critiqueEpisode(reel([shot({params: {}})]));
  assert.ok(has(errors, 'nothing happens'), errors.join('\n'));
});

test('a shot on one event is a warning, not a failure — a hold is allowed', () => {
  const {errors, warnings} = critiqueEpisode(reel([shot()]));
  assert.deepEqual(errors, []);
  assert.ok(has(warnings, 'one event'));
});

test('an event scheduled past the cut is an error', () => {
  const {errors} = critiqueEpisode(
    reel([shot({durationInFrames: 58, params: {caption: ['x'], captionFrame: 69}})]),
  );
  assert.ok(has(errors, 'plays for nobody'), errors.join('\n'));
});

test('the on-screen text layer counts as something happening', () => {
  const events = eventsOf({
    sceneType: 'parallax-punch',
    durationInFrames: 120,
    params: {},
    onScreenText: [{text: 'never questioned', atFrame: 14}],
  });
  assert.equal(events.length, 1);
  assert.equal(events[0].kind, 'onScreenText');
});

test('a portal flight is a camera move, not a still', () => {
  const {warnings} = critiqueEpisode(
    reel([
      {
        id: 'p',
        sceneType: 'portal-zoom-reveal',
        durationInFrames: 60,
        params: {throughEndFrame: 40, wallScaleEnd: 6.4, caption: ['x'], captionFrame: 42},
      },
    ]),
  );
  assert.ok(!has(warnings, 'photograph with grain'), warnings.join('\n'));
});

test("a slate's creep is its camera", () => {
  const {warnings} = critiqueEpisode(
    reel([
      {
        id: 'c',
        sceneType: 'title-slate',
        durationInFrames: 78,
        params: {title: 'FOURTEEN HUNDRED', titleFrame: 6, creep: 1.09, mark: 'oval', markFrame: 40},
      },
    ]),
  );
  assert.ok(!has(warnings, 'photograph with grain'), warnings.join('\n'));
});

test('a one-layer composite is called out — depth needs something to be relative to', () => {
  const {warnings} = critiqueEpisode(reel([shot({layers: [{role: 'bg', depth: 0.1}], props: []})]));
  assert.ok(has(warnings, 'nothing can move in front of anything'));
});

test('a stack whose layers share a depth will scale as one plate', () => {
  const {warnings} = critiqueEpisode(
    reel([shot({layers: [{role: 'a', depth: 0.5}, {role: 'b', depth: 0.55}]})]),
  );
  assert.ok(has(warnings, 'same depth'));
});

test('a caption that runs off the bottom of the frame is reported', () => {
  const {warnings} = critiqueEpisode(
    reel([shot({params: {caption: ['a', 'b', 'c', 'd'], captionFrame: 8, captionY: 1500, captionSize: 90}})]),
  );
  assert.ok(has(warnings, 'safe area'));
});

test('an emphasis that is not in the caption emphasises nothing, and says so', () => {
  const {warnings} = critiqueEpisode(
    reel([shot({params: {caption: ['a lump of', 'corroded metal'], captionFrame: 8, captionEmphasis: 'statues'}})]),
  );
  assert.ok(has(warnings, 'nothing will be emphasised'));
});

test('three of one transition is a tic, and it is reported once', () => {
  const scenes = ['flare', 'flare', 'flare', 'flare'].map((kind, i) => shot({id: `s${i}`, transition: {kind}}));
  const found = critiqueEpisode(reel(scenes)).warnings.filter((m) => m.startsWith('transition:'));
  assert.equal(found.length, 1, found.join('\n'));
  assert.ok(found[0].includes('4 shots running'));
});

test('a reel of composites is not a tic — composite is the general case', () => {
  const scenes = [0, 1, 2, 3].map((i) => shot({id: `s${i}`}));
  assert.ok(!has(critiqueEpisode(reel(scenes)).warnings, 'template:'));
});

test('three title cards running IS a tic', () => {
  const scenes = [0, 1, 2].map((i) => ({
    id: `s${i}`,
    sceneType: 'title-slate',
    durationInFrames: 80,
    params: {title: 'X', titleFrame: 6, creep: 1.08, mark: 'oval', markFrame: 40},
  }));
  assert.ok(has(critiqueEpisode(reel(scenes)).warnings, 'template:'));
});

test('an impact shares a beat on purpose — it is caused by the thing landing', () => {
  const {warnings} = critiqueEpisode(
    reel([shot({props: [{kind: 'card', from: 20}], params: {caption: ['x'], captionFrame: 8, shakeAt: [20]}})]),
  );
  assert.ok(!has(warnings, 'one beat, not two'), warnings.join('\n'));
});

test('things already standing at frame zero are not two events colliding', () => {
  const {warnings} = critiqueEpisode(
    reel([shot({props: [{kind: 'beam', from: 0}, {kind: 'plaque', from: 0}]})]),
  );
  assert.ok(!has(warnings, 'one beat, not two'), warnings.join('\n'));
});

test('the pace of the whole reel is measured, not just each shot', () => {
  const slow = critiqueEpisode(reel([shot({durationInFrames: 200}), shot({id: 's2', durationInFrames: 200})]));
  assert.ok(has(slow.warnings, 'per shot'));
  assert.equal(slow.stats.scenes, 2);
  assert.ok(slow.stats.eventsPerSecond > 0);
});

/**
 * THE THREE THAT SHIPPED THROUGH EVERY OTHER CHECK IN THIS FILE.
 *
 * Each of them was inside the frame, inside the safe area, the right size, not
 * colliding with anything and valid at every frame. Each was also obviously
 * wrong in one still, which is the whole reason these exist.
 */
test('a drawing the same value as its ground is reported, not shipped', () => {
  const heart = {
    id: 's1',
    sceneType: 'composite',
    durationInFrames: 120,
    params: {fieldColours: ['#d9a13c', '#8a5a18', '#241505']},
    diagram: {type: 'anatomyFlow', accent: '#f2b53a', muted: '#cfc6ae'},
  };
  const {errors} = contrastProblems(reel([heart]));
  assert.ok(errors.some((e) => e.includes('no contrast')), errors.join('\n'));
});

test('the same drawing on a ground pulled down passes', () => {
  const heart = {
    id: 's1',
    sceneType: 'composite',
    durationInFrames: 120,
    params: {fieldColours: ['#382a10', '#2f1f08', '#1a0f04']},
    diagram: {type: 'anatomyFlow', accent: '#f2b53a', muted: '#cfc6ae'},
  };
  const {errors, warnings} = contrastProblems(reel([heart]));
  assert.equal(errors.length, 0, errors.join('\n'));
  assert.equal(warnings.length, 0, warnings.join('\n'));
});

test('a drawing over a surviving photograph is not judged on the field alone', () => {
  const hybrid = {
    id: 's1',
    sceneType: 'composite',
    durationInFrames: 120,
    layers: [{role: 'bg', depth: 0.2, asset: 'x'}],
    params: {fieldColours: ['#d9a13c', '#8a5a18', '#241505']},
    diagram: {type: 'anatomyFlow', accent: '#f2b53a', muted: '#cfc6ae'},
  };
  assert.equal(contrastProblems(reel([hybrid])).errors.length, 0);
});

test('a pan that takes the drawing off the edge is measured, not assumed away', () => {
  const size = {width: 1080, height: 1920};
  const section = (panX) => ({
    id: 's1',
    sceneType: 'composite',
    durationInFrames: 120,
    params: {anchorX: 799, anchorY: 576, pushFrom: 1.2, pushTo: 1.24, panX},
    diagram: {type: 'crossSection'},
  });
  const at = (scene) => throughTheCamera(scene, boundsOf(scene, size).filter((b) => b.camera), size);

  // The camera reaches the box at all — the whole point. A checker that
  // measured the section at rest reported this shot as fine and shipped it with
  // its right half outside the picture.
  const still = at(section(0))[0];
  const panned = at(section(262))[0];
  assert.ok(panned.right > still.right, 'the pan moves the measured box');

  // The share the drawing takes now keeps that pan inside the frame …
  assert.ok(panned.right <= 1080, `the 262px pan fits (${panned.right.toFixed(0)})`);
  // … and a pan large enough to break it is still caught.
  assert.ok(at(section(700))[0].right > 1080, 'a pan too big for the drawing is reported');
});

test('the budget the planner writes is what the checker reads', () => {
  const scene = {
    id: 's1',
    sceneType: 'composite',
    durationInFrames: 120,
    params: {anchorX: 799, anchorY: 576, pushFrom: 1.2, pushTo: 1.24, panX: 262, diagramCamera: 0},
    diagram: {type: 'crossSection'},
  };
  const size = {width: 1080, height: 1920};
  const boxes = boundsOf(scene, size).filter((b) => b.camera);
  const moved = throughTheCamera(scene, boxes, size);
  assert.ok(moved.every((b) => b.right <= 1080 && b.left >= 0), 'a zero budget leaves the drawing where it was composed');
});

test('a share of a portal is still a portal', () => {
  const scene = {
    id: 's1',
    sceneType: 'composite',
    durationInFrames: 120,
    params: {anchorX: 540, anchorY: 960, pushFrom: 1, pushTo: 6.4},
    diagram: {type: 'crossSection'},
  };
  const size = {width: 1080, height: 1920};
  const moved = throughTheCamera(scene, boundsOf(scene, size).filter((b) => b.camera), size);
  // 0.3 of 6.4 is 2.6, at which a section is a stripe. The cap holds it to 1.18.
  const grew = (moved[0].right - moved[0].left) / (1080 * 0.76);
  assert.ok(grew <= 1.19, `the drawing grew ${grew.toFixed(2)}x`);
});
