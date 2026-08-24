/**
 * THE DNA CHECK HAS TO CATCH DRIFT AND IGNORE VARIETY.
 *
 * Those are the two halves, and the second is the one that kills a consistency
 * system. A check that flags a map for not looking like a heart makes the five
 * episodes identical, which is the explicit failure this phase must avoid:
 *
 *   CONSISTENT DESIGN LANGUAGE, not IDENTICAL ANIMATION.
 *
 * So half of these tests assert that a heart, a map and a forge — different
 * primitives, different motion, different subjects — all pass, and the other
 * half assert that a reel which quietly invents a colour, a font or a fifth
 * stroke weight does not.
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';

import {CAMERA, COLOUR, DNA, DNA_VERSION, MOTION, STROKE, TRANSITION, TYPE} from '../visual-system/dna.mjs';
import {FORBIDDEN_NAME_PATTERNS, REGISTRY, findComponent, knownComponent} from '../visual-system/components.mjs';
import {dnaProblems, dnaSummary} from '../scripts/lib/dna.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const episode = async (id) => JSON.parse(await readFile(path.join(ROOT, 'episodes', id, 'scene-config.json'), 'utf8'));

const reel = (scenes, over = {}) => ({id: 'x', fps: 30, width: 1080, height: 1920, scenes, ...over});
const shot = (over = {}) => ({
  id: 's1',
  sceneType: 'composite',
  durationInFrames: 120,
  params: {caption: ['a line'], captionX: 84, captionSize: 80, captionAlign: 'left', accent: '#f2b53a', ...over},
});

/* --------------------------------------------------------------- the DNA */

test('the DNA is versioned and the file agrees with the constant', async () => {
  const file = (await readFile(path.join(ROOT, 'visual-system', 'VERSION'), 'utf8')).trim();
  assert.equal(file, DNA_VERSION, 'visual-system/VERSION and DNA_VERSION must not drift apart');
  assert.match(DNA_VERSION, /^\d+\.\d+\.\d+$/);
});

test('there are exactly three type families and they do not overlap', () => {
  const families = Object.values(TYPE.families);
  assert.equal(families.length, 3);
  assert.equal(new Set(families).size, 3, 'two families spelled the same way is one family');
});

test('the stroke scale has four technical steps, in order', () => {
  const steps = [STROKE.construction, STROKE.detail, STROKE.object, STROKE.emphasis];
  assert.deepEqual([...steps].sort((a, b) => a - b), steps, 'a scale that is not ordered is not a scale');
});

test('the marker register is recorded as a deviation, not blessed as a system', () => {
  const marker = STROKE.registers.marker;
  assert.equal(marker.status, 'KNOWN_DEVIATION');
  assert.ok(marker.why && marker.remediation && marker.since, 'a deviation needs a reason, a remedy and a date');
  assert.ok(!('scale' in marker), 'enumerating the literals would turn drift into system by renaming it');
});

test('every mood register has accents, and the union is the palette', () => {
  const moods = Object.entries(COLOUR.moods);
  assert.ok(moods.length >= 4);
  for (const [name, mood] of moods) {
    assert.ok(mood.accents.length, `${name} has no accents`);
    assert.ok(mood.why, `${name} does not say what it is for`);
    for (const accent of mood.accents) assert.match(accent, /^#[0-9a-f]{6}$/i);
  }
  for (const [, mood] of moods) for (const a of mood.accents) assert.ok(COLOUR.accents.includes(a));
});

test('every motion family states a reason, a duration range and an easing', () => {
  for (const [name, family] of Object.entries(MOTION.families)) {
    assert.ok(family.why, `${name} has no reason — a family without a why is a category of effect`);
    assert.ok(family.members.length, `${name} is empty`);
    assert.equal(family.durationFrames.length, 2);
    assert.ok(family.durationFrames[0] < family.durationFrames[1]);
    assert.ok(MOTION.easing.includes(family.easing), `${name} eases with "${family.easing}", which is not a channel curve`);
  }
});

/* ---------------------------------------------------- the registry is real */

test('every registered component names a file and a purpose', () => {
  for (const entry of REGISTRY) {
    assert.ok(entry.name && entry.file && entry.purpose, `${entry.name ?? '?'} is incompletely registered`);
  }
});

test('no registered component name is a fork-by-naming', () => {
  for (const entry of REGISTRY) {
    for (const pattern of FORBIDDEN_NAME_PATTERNS) {
      assert.ok(!pattern.test(entry.name), `"${entry.name}" matches a fork pattern`);
    }
  }
});

test('the fork patterns catch the real cases and spare the innocent ones', () => {
  const forked = ['Arrow2', 'NewArrow', 'BetterArrow', 'ArrowFinal', 'ArrowV2', 'ArrowAlt', 'MyArrow'];
  for (const name of forked) {
    assert.ok(FORBIDDEN_NAME_PATTERNS.some((p) => p.test(name)), `"${name}" should be refused`);
  }
  // The words that merely start with the same letters.
  for (const name of ['Newspaper', 'Alternator', 'Copyright', 'Finalise']) {
    assert.ok(!FORBIDDEN_NAME_PATTERNS.some((p) => p.test(name)), `"${name}" is not a fork`);
  }
});

test('the registry can be searched by name, which is its whole purpose', () => {
  assert.ok(knownComponent('Arrow'));
  assert.ok(knownComponent('ScaleHaulagePlate'));
  assert.equal(findComponent('Arrow').file, 'engine/draw/sheet.tsx');
  assert.equal(findComponent('NoSuchThing'), null);
});

/* ------------------------------------------------- drift is caught … */

test('two accents in one reel is two designs', () => {
  const {errors} = dnaProblems(reel([shot(), shot({accent: '#d94f3d'})]));
  assert.ok(errors.some((e) => /accent/.test(e)), errors.join('\n'));
});

test('an invented colour is not a register', () => {
  const {warnings} = dnaProblems(reel([shot({accent: '#00ff00'})]));
  assert.ok(warnings.some((w) => /belongs to no mood register/.test(w)));
});

test('a caption margin that disagrees with the reel is reported', () => {
  const {warnings} = dnaProblems(reel([shot(), shot({captionX: 81})]));
  assert.ok(warnings.some((w) => /margin is not consistent/.test(w)));
});

test('an entrance that is in no family is refused', () => {
  const {errors} = dnaProblems(reel([shot({captionReveal: 'sparkle'})]));
  assert.ok(errors.some((e) => /no motion family/.test(e)));
});

test('a camera move outside the six families is refused', () => {
  const scenes = Array.from({length: 6}, (_, i) => shot({cameraMove: i ? 'push' : 'barrel-roll'}));
  const {errors} = dnaProblems(reel(scenes));
  assert.ok(errors.some((e) => /not a channel family/.test(e)));
});

test('a darkening arrival on a short shot is refused', () => {
  const scene = {...shot(), durationInFrames: 40, transition: {kind: 'blinds'}};
  const {errors} = dnaProblems(reel([scene]));
  assert.ok(errors.some((e) => /darkens the frame/.test(e)));
});

test('a reel that decorates every seam is reported', () => {
  const scenes = Array.from({length: 6}, () => ({...shot(), transition: {kind: 'slip'}}));
  const {warnings} = dnaProblems(reel(scenes));
  assert.ok(warnings.some((w) => /has no punctuation left/.test(w)));
});

test('a drawing on a ground it cannot be seen against is an error', () => {
  const scene = {
    ...shot(),
    params: {...shot().params, fieldColours: ['#d9a13c', '#8a5a18', '#241505']},
    diagram: {type: 'anatomyFlow', accent: '#f2b53a', muted: '#cfc6ae'},
  };
  const {errors} = dnaProblems(reel([scene]));
  assert.ok(errors.some((e) => /against its ground/.test(e)));
});

/* ------------------------------------------- … and variety is NOT caught */

test('the five benchmark episodes conform: different subjects, one language', async () => {
  for (const id of ['baalbek', 'roman-concrete', 'hormuz', 'human-heart', 'medieval-sword']) {
    const {errors} = dnaProblems(await episode(id));
    assert.deepEqual(errors, [], `${id} broke the DNA:\n${errors.join('\n')}`);
  }
});

test('the antikythera regression still conforms', async () => {
  const {errors} = dnaProblems(await episode('antikythera'));
  assert.deepEqual(errors, [], errors.join('\n'));
});

test('a heart and a map use DIFFERENT primitives and the SAME language', async () => {
  const heart = await episode('human-heart');
  const hormuz = await episode('hormuz');
  const kinds = (c) => new Set((c.scenes ?? []).map((s) => s.diagram?.type).filter(Boolean));
  const heartKinds = kinds(heart);
  const mapKinds = kinds(hormuz);
  // Different representations …
  assert.ok(heartKinds.has('anatomyFlow'), 'the heart is drawn as a circulation');
  assert.ok(mapKinds.has('map'), 'the strait is drawn as a map');
  assert.equal([...heartKinds].filter((k) => mapKinds.has(k)).length, 0, 'and they share no primitive');
  // … one language.
  assert.deepEqual(dnaProblems(heart).errors, []);
  assert.deepEqual(dnaProblems(hormuz).errors, []);
});

test('the check reports where the DNA says so, not just that something is wrong', () => {
  const {warnings} = dnaProblems(reel([shot(), shot({captionX: 81})]));
  assert.ok(warnings.some((w) => /TYPE\.margin/.test(w)), 'a finding must name the rule it broke');
});

test('a summary says whether it conforms without turning it into a score', () => {
  const clean = dnaSummary(reel([shot()]));
  assert.equal(clean.conforms, true);
  assert.equal(clean.version, DNA_VERSION);
  assert.ok(!('score' in clean), 'a consistency check that reports a number teaches nobody what to change');
});

test('the whole DNA is reachable from one import', () => {
  for (const key of ['TYPE', 'COLOUR', 'STROKE', 'ANNOTATION', 'IMAGE', 'COMPOSITION', 'MOTION', 'TRANSITION', 'CAMERA']) {
    assert.ok(DNA[key], `DNA.${key} is missing`);
  }
});
