/**
 * THE CASTING WORKFLOW HAS TO ACCEPT A GOOD FILE AND REFUSE A BAD ONE, and it
 * has to ask a person whenever it is not entitled to decide.
 *
 * The accept path is tested here rather than in the live manifest for a reason
 * that is itself part of the design: a supplied file is judged partly on what
 * the human says it is, and the only honest way to exercise acceptance is with
 * a fixture whose description is TRUE of it. Writing a false description into
 * the real casting manifest to make a green tick appear would be the exact
 * dishonesty this layer exists to prevent.
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readFile, rm, stat, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import sharp from 'sharp';

import {CONFIRM_MARGIN, preserve, provenanceVerdict, scoreAgainst} from '../acquire/ingest.mjs';
import {STATUS, briefId, countsOf, emptyProvenance, PROVENANCE_FIELDS} from '../acquire/casting.mjs';
import {requirementsFor, slugOf} from '../acquire/shot.mjs';
import {normalise} from '../acquire/normalise.mjs';
import {briefPlate, compositionPreview} from '../acquire/preview.mjs';
import {scoreQuality} from '../acquire/score/quality.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const fixture = (name) => readFile(path.join(ROOT, 'episodes', 'antikythera', 'assets', name));

const shot = {
  shots: ['s01-x'],
  frame: {width: 1080, height: 1920, aspect: '9:16'},
  camera: {maxPush: 1.4, moves: ['push'], panRange: [0, 0], anchorX: 540, anchorY: 1056},
  captionBand: {top: 1312, bottom: 1581},
  subjectBox: {left: 185, right: 895, top: 361, bottom: 1312},
  demands: [],
};

const brief = (over = {}) => ({
  id: 'test/line',
  episode: 'test',
  line: 'line',
  shot: ['s01-x'],
  subject: 'moon',
  says: 'the moon rose over the wreck',
  domain: 'celestial',
  purpose: 'show the named body',
  representation: 'photo',
  must_show: ['moon'],
  preferred_orientation: 'either',
  preferred_composition: 'the body against sky, negative space around it for a slow push',
  historical_constraints: null,
  scientific_constraints: null,
  reject_if: ['an artist impression presented as an observation'],
  license_requirements: 'free for commercial use and derivatives',
  queries: ['moon'],
  status: 'OPEN',
  provenance: emptyProvenance(),
  shotRequirements: shot,
  ...over,
});

/* --------------------------------------------------------- shot geometry */

test('shot requirements are the WORST case across every shot a line serves', () => {
  const scenes = [
    {id: 's01-x', sceneType: 'composite', params: {pushFrom: 1, pushTo: 1.1, captionY: 200, captionSize: 60, caption: ['a']}},
    {id: 's01-x-b', sceneType: 'composite', params: {pushFrom: 1, pushTo: 1.6, captionY: 1400, captionSize: 60, caption: ['a']}},
  ];
  const req = requirementsFor(scenes);
  assert.equal(req.camera.maxPush, 1.6, 'the hardest push governs');
  assert.ok(req.captionBand.top <= 200 - 24, 'the caption band is the union, not the last one');
  assert.ok(req.captionBand.bottom >= 1400 + 60);
  assert.ok(req.demands.some((d) => /1[78]00px/.test(d)), 'resolution is demanded from the push');
});

test('a scene id resolves to the line it serves', () => {
  assert.equal(slugOf('s04-nolift-c'), 'nolift');
  assert.equal(slugOf('s01-blocks'), 'blocks');
});

test('the subject box excludes the caption band', () => {
  const req = requirementsFor([
    {id: 's01-x', sceneType: 'composite', params: {pushFrom: 1, pushTo: 1.2, captionY: 1400, captionSize: 70, caption: ['a', 'b']}},
  ]);
  assert.ok(req.subjectBox.bottom <= req.captionBand.top, 'the words win, so the subject stops above them');
});

/* ------------------------------------------------------------- the states */

test('the status lifecycle has a distinct state for missing provenance', () => {
  assert.ok(STATUS.includes('PROVENANCE_REQUIRED'));
  assert.ok(STATUS.includes('OPEN') && STATUS.includes('ACCEPTED') && STATUS.includes('REJECTED'));
});

test('a right picture with no provenance is not a rejection', () => {
  const verdict = provenanceVerdict({...emptyProvenance()});
  assert.equal(verdict.ok, false);
  assert.equal(verdict.status, 'PROVENANCE_REQUIRED', 'it needs a fact, not a different picture');
  assert.match(verdict.why, /none will be inferred/);
});

test('a stated non-free licence IS a rejection', () => {
  const verdict = provenanceVerdict({source: 'X', sourceUrl: 'https://x', creator: 'A', license: 'CC BY-NC 4.0'});
  assert.equal(verdict.status, 'REJECTED');
});

test('a complete free licence is accepted and says whether credit is owed', () => {
  const verdict = provenanceVerdict({
    source: 'Wikimedia Commons',
    sourceUrl: 'https://commons.wikimedia.org/x',
    creator: 'A. Photographer',
    license: 'CC BY-SA 4.0',
  });
  assert.equal(verdict.ok, true);
  assert.equal(verdict.needsCredit, true);
});

test('every provenance field a supplier must fill is named', () => {
  for (const f of ['source', 'sourceUrl', 'creator', 'license', 'licenseUrl', 'retrievalDate', 'notes']) {
    assert.ok(PROVENANCE_FIELDS.includes(f), `missing ${f}`);
  }
});

/* ------------------------------------------------------------- the gates */

test('ACCEPTS a supplied file whose description is true of the brief', async () => {
  const buffer = await fixture('moon-sky.jpg');
  const described = {...brief(), humanDescription: 'a full moon in a night sky over india, no foreground'};
  const quality = await scoreQuality(sharp, buffer, described);
  const scored = await scoreAgainst({sharp, buffer, brief: described, quality});
  assert.equal(scored.verdict.ok, true, `the right picture must pass: ${scored.verdict.why}`);
  assert.ok(scored.rank > 7, `rank was ${scored.rank}`);
});

test('REFUSES the same file against a brief it is not a picture of', async () => {
  const buffer = await fixture('moon-sky.jpg');
  const wrong = {
    ...brief({subject: 'megalith', domain: 'scale', says: 'three blocks no crane could lift', must_show: ['megalith', 'a person or a known object in the same plane as a size reference']}),
    humanDescription: 'a full moon in a night sky over india, no foreground',
  };
  const quality = await scoreQuality(sharp, buffer, wrong);
  const scored = await scoreAgainst({sharp, buffer, brief: wrong, quality});
  assert.equal(scored.verdict.ok, false);
  assert.ok(quality.score > 7, 'and it fails on subject while being a good photograph');
});

test('a file with no description cannot be cast at all', async () => {
  const buffer = await fixture('moon-sky.jpg');
  const silent = brief();
  const quality = await scoreQuality(sharp, buffer, silent);
  const scored = await scoreAgainst({sharp, buffer, brief: silent, quality});
  assert.equal(scored.verdict.ok, false, 'a filename is not testimony; somebody has to say what it is');
});

/* -------------------------------------------------------- the confirmation */

test('the confirmation margin is tight enough to catch the lamp case', () => {
  // The brief's own examples: 9.2 vs 8.9 may auto-suggest; 9.3 vs 9.1 must ask.
  assert.ok(9.2 - 8.9 >= CONFIRM_MARGIN, 'a three-tenths preference is a real preference');
  assert.ok(9.3 - 9.1 < CONFIRM_MARGIN, 'two tenths is noise, and casting on noise is a coin toss');
});

/* ------------------------------------------------------- originals are safe */

test('the original is copied by content hash and never modified', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'casting-'));
  try {
    const source = path.join(dir, 'whatever-they-called-it.jpg');
    await writeFile(source, await fixture('moon-sky.jpg'));
    const before = await stat(source);
    const first = await preserve({name: 'whatever-they-called-it.jpg', path: source});
    const second = await preserve({name: 'a-different-name.jpg', path: source});
    assert.equal(first.hash, second.hash, 'the same bytes are the same asset whatever they are called');
    assert.equal(second.reused, true, 'and the second copy is not made twice');
    const after = await stat(source);
    assert.equal(before.size, after.size, 'the file a human supplied is not touched');
  } finally {
    await rm(dir, {recursive: true, force: true});
  }
});

test('normalisation writes somewhere else and reports what it did', async () => {
  const buffer = await fixture('moon-sky.jpg');
  const out = await normalise(sharp, {buffer, brief: brief(), hash: 'testhash', options: {}});
  assert.equal(out.originalUntouched, true);
  assert.ok(out.processed.includes(path.join('assets', 'processed')));
  assert.ok(out.steps.length, 'it says what it did');
  assert.ok(out.width >= 1080 * 1.4 - 1, 'sized for the push, not for the frame');
  await rm(out.processed, {force: true});
});

test('background removal is recorded as asked-for, never inferred', async () => {
  const buffer = await fixture('moon-sky.jpg');
  const out = await normalise(sharp, {buffer, brief: brief(), hash: 'testalpha', options: {removeBackground: true}});
  assert.equal(out.format, 'png', 'alpha needs a format that carries it');
  assert.ok(out.steps.some((s) => /no automatic keying/.test(s)), 'and it says it did not key anything');
  await rm(out.processed, {force: true});
});

/* ------------------------------------------------------------- the preview */

test('a composition preview is generated at frame size', async () => {
  const buffer = await fixture('moon-sky.jpg');
  const {preview, width, height} = await compositionPreview(sharp, {buffer, brief: brief(), hash: 'testprev'});
  const meta = await sharp(await readFile(preview)).metadata();
  assert.equal(meta.width, width);
  assert.equal(meta.height, height);
  assert.equal(width, 1080);
  assert.equal(height, 1920);
  await rm(preview, {force: true});
});

test('a brief with no file yet still gets a plate to shoot against', async () => {
  const {plate} = await briefPlate(sharp, brief());
  const meta = await sharp(await readFile(plate)).metadata();
  assert.equal(meta.width, 1080);
  await rm(plate, {force: true});
});

/* -------------------------------------------------------------- bookkeeping */

test('ids are stable and readable', () => {
  assert.equal(briefId('baalbek', 'blocks'), 'baalbek/blocks');
});

test('counts separate what is blocking from what would merely strengthen', () => {
  const c = countsOf([
    {priority: 'BLOCKING', status: 'OPEN'},
    {priority: 'would strengthen', status: 'ACCEPTED'},
    {priority: 'would strengthen', status: 'OPEN'},
  ]);
  assert.deepEqual(c, {total: 3, blocking: 1, wouldStrengthen: 2, optional: 0, stillNeeded: 2});
});
