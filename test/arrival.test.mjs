/**
 * THE THREE THINGS THE REFERENCE BUILD HAD AND THIS ONE DID NOT.
 *
 * A figure that SPINS to a stop rather than only climbing; a highlight made by
 * duplicating and recolouring artwork already on disk; and a grade that bends
 * with the beat. None of them is expensive — all three were simply missing, and
 * what keeps them honest is the rule attached to each: earned, not decorated.
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateEpisodeConfig} from '../engine/schema.mjs';

const config = (scene) => ({
  id: 'x',
  fps: 30,
  width: 1080,
  height: 1920,
  look: {
    posterizeFps: 12,
    grade: {saturate: 1, contrast: 1, sepia: 0, brightness: 1},
    film: {grain: true, grunge: true, scanlines: true, vignette: true, gateWeave: true},
  },
  scenes: [{id: 's1', sceneType: 'composite', durationInFrames: 100, ...scene}],
});

test('a recoloured, flickering copy of a layer is a legal layer', () => {
  const problems = validateEpisodeConfig(
    config({
      assets: {cash: 'assets/cash.png'},
      layers: [
        {role: 'cash', depth: 0.8},
        {
          role: 'cash',
          depth: 0.8,
          recolour: 'sepia(1) saturate(5) hue-rotate(18deg)',
          flicker: [
            [23, 29],
            [32, 62],
          ],
        },
      ],
    }),
  );
  assert.deepEqual(problems, []);
});

test('hold keyframes must be pairs, and must go forwards', () => {
  // A bare list of numbers reads as valid, draws nothing, and says nothing
  // about it — the same failure as an unknown scene type.
  for (const flicker of [[23, 29], [[23]], [[29, 23]], [['a', 'b']], [[1, 2, 3]]]) {
    const problems = validateEpisodeConfig(
      config({assets: {cash: 'assets/cash.png'}, layers: [{role: 'cash', flicker}]}),
    );
    assert.equal(problems.length, 1, `${JSON.stringify(flicker)} should be refused`);
    assert.match(problems[0], /flicker/);
  }
});

test('a scene may bend the episode grade without restating all of it', () => {
  // gradeOverride is a PARTIAL — the sombre beat pulls saturation down and
  // inherits everything else, so an episode still has one grade.
  const problems = validateEpisodeConfig(
    config({gradeOverride: {saturate: 0.5, contrast: 1.16}}),
  );
  assert.deepEqual(problems, []);
});

/**
 * The planner's own rules. Imported rather than restated, because a rule that
 * is written down twice is a rule that will disagree with itself.
 */
const planner = await import('../scripts/plan-episode.mjs');

test('an episode picks ONE way for numbers to arrive', async () => {
  // Counting makes the size of a figure felt, a slot reel makes the choice
  // felt. Both in one reel and neither means anything — so it is chosen once,
  // from the episode seed, and every slate in that reel obeys it.
  const {readFile} = await import('node:fs/promises');
  const config = JSON.parse(await readFile('episodes/mansa-musa/scene-config.json', 'utf8'));
  const spinning = config.scenes.filter((s) => s.params?.spinTo).length;
  const counting = config.scenes.filter((s) => s.params?.countTo).length;
  assert.ok(spinning === 0 || counting === 0, `one reel used both: ${spinning} slot, ${counting} count`);
});

test('a highlight is earned by the sentence, never applied to everything', () => {
  // Same law as the motifs: on every shot it is a filter; on the one line about
  // treasure it IS the line.
  const pieces = ['camel standing in profile'];
  assert.equal(planner.earnsHighlight({vo: 'camels carrying gold by the hundredweight', pieces}), true);
  assert.equal(planner.earnsHighlight({vo: 'the caravan was so long nobody could count it', pieces}), false);

  // And it needs something to light: the trick is a recoloured copy of a PIECE,
  // so a shot with no pieces has nothing to copy.
  assert.equal(planner.earnsHighlight({vo: 'camels carrying gold by the hundredweight'}), false);
  assert.equal(planner.earnsHighlight({vo: '', pieces}), false);
});
