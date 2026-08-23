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
import {critiqueEpisode, eventsOf} from '../scripts/lib/critique.mjs';

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
