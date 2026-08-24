/**
 * THE ACQUISITION LAYER HAS TO REJECT THE WRONG PICTURE **AND ACCEPT THE RIGHT
 * ONE**, and the second half is the half that is easy to lose.
 *
 * A gate that refuses everything passes every rejection test ever written and is
 * worthless. Half of these tests are therefore acceptances — including one that
 * exists only to fail loudly if the semantic floor is ever tightened to the
 * point where nothing can get through it.
 *
 * The fixtures are real files from this repository's own corpus, because the
 * defects this layer exists to prevent were all found in real files.
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

import {briefFrom, briefProblems, BRIEF_FIELDS} from '../acquire/brief.mjs';
import {judgeLicence} from '../acquire/licence.mjs';
import {scoreSemantic, semanticVerdict, SEMANTIC_FLOOR} from '../acquire/score/semantic.mjs';
import {scoreQuality, qualityVerdict} from '../acquire/score/quality.mjs';
import {scoreComposition} from '../acquire/score/composition.mjs';
import {hamming, makeLedger, perceptualHash} from '../acquire/dedupe.mjs';
import {cacheKey} from '../acquire/cache.mjs';
import {NEEDS_A_PICTURE, settle, usableRungs} from '../acquire/ladder.mjs';
import {PROVIDERS} from '../acquire/providers/index.mjs';
import generated, {disclosureFor, promptFor} from '../acquire/providers/generated.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const fixture = (name) => readFile(path.join(ROOT, 'episodes', 'antikythera', 'assets', name));

const brief = (over = {}) => ({
  episode: 'test',
  line: 'l1',
  says: 'a line',
  domain: 'mechanism',
  subject: 'mechanism',
  purpose: 'show the working parts',
  representation: 'photo',
  must_show: ['the working parts'],
  preferred_orientation: 'either',
  preferred_composition: 'the mechanism exposed, parts distinguishable',
  historical_constraints: null,
  scientific_constraints: null,
  acceptable_substitutes: 'none',
  reject_if: ['a different mechanism of the same family'],
  license_requirements: 'free for commercial use and derivatives',
  queries: ['mechanism'],
  ...over,
});

/* ---------------------------------------------------------------- the brief */

test('a brief carries every field the acquisition contract requires', () => {
  const b = briefFrom(
    {line: 'x', says: 'a strait twenty-one miles across', subject: 'strait', domain: 'geography', searches: ['Strait of Hormuz']},
    {episode: 'hormuz'},
  );
  for (const field of BRIEF_FIELDS) assert.ok(field in b, `missing ${field}`);
  assert.equal(briefProblems(b).length, 0, briefProblems(b).join('; '));
});

test('constraints are decided per domain, not asserted everywhere', () => {
  const geography = briefFrom({line: 'a', subject: 's', domain: 'geography'}, {});
  const process = briefFrom({line: 'b', subject: 's', domain: 'process'}, {});
  assert.equal(geography.historical_constraints, null, 'a strait has no period to be wrong about');
  assert.ok(process.historical_constraints, 'a forge does');
  assert.ok(process.scientific_constraints, 'and a forge has physics too');
});

/* ------------------------------------------------------------ the semantics */

test('ACCEPTS a picture whose human description matches the brief', () => {
  const candidate = {
    provider: 'local',
    id: 'a',
    title: 'mechanism fragment',
    description: 'corroded green bronze mechanism fragment with visible gear teeth on a dark museum ground',
    reviewed: {relevance: 9, accuracy: 9, subject: 9},
    fromEpisode: 'test',
    castIn: ['l1'],
  };
  const scores = scoreSemantic(candidate, brief());
  assert.equal(scores.evidence, 'human review of this brief');
  assert.ok(semanticVerdict(scores, brief()).ok, 'the right picture must pass, or the gate is a wall');
});

test('REJECTS a beautiful picture of the wrong subject', () => {
  const candidate = {
    provider: 'local',
    id: 'b',
    title: 'Full moon in night sky',
    description: 'a full moon against a black night sky, no foreground',
    reviewed: null,
  };
  const scores = scoreSemantic(candidate, brief());
  const verdict = semanticVerdict(scores, brief());
  assert.equal(verdict.ok, false);
  assert.match(verdict.why, /not a picture of/);
});

test("a reviewer's SCORES do not travel to a role they were not written for", () => {
  /**
   * The defect this file exists for. `museum-dark.jpg` was scored 9 as a dark
   * museum ground for Antikythera; read as a property of the file, that 9
   * carried it into five other episodes as a megalith, a harbour, a strait, a
   * heart and a forge.
   */
  const lamp = {
    provider: 'local',
    id: 'c',
    title: 'Roman lamp, reconstructed view',
    description: 'a reconstructed Roman oil lamp on a plain dark ground',
    reviewed: {relevance: 9, accuracy: 9, subject: 9},
    fromEpisode: 'antikythera',
    castIn: ['museum'],
  };
  const elsewhere = brief({episode: 'human-heart', line: 'twopumps', subject: 'humanHeart', domain: 'anatomy', must_show: ['the whole named structure']});
  const scores = scoreSemantic(lamp, elsewhere);
  assert.notEqual(scores.evidence, 'human review of this brief');
  assert.ok(scores.relevance < SEMANTIC_FLOOR, `a Roman lamp scored ${scores.relevance} as a human heart`);
  assert.equal(semanticVerdict(scores, elsewhere).ok, false);
});

test('a title alone can never clear the semantic floor on its own', () => {
  const candidate = {provider: 'x', id: 'd', title: 'mechanism working parts gear', description: null, reviewed: null};
  const scores = scoreSemantic(candidate, brief());
  assert.ok(scores.relevance < SEMANTIC_FLOOR, 'a filename is a claim about a picture, not the picture');
});

test('a candidate whose own description matches a rejection criterion is refused by its own words', () => {
  const candidate = {
    provider: 'x',
    id: 'e',
    title: 'gears',
    description: 'a different mechanism of the same family, a modern clock movement',
    reviewed: null,
  };
  const scores = scoreSemantic(candidate, brief());
  assert.ok(scores.relevance <= 3);
  assert.ok(scores.notes.some((n) => /rejection criterion/.test(n)));
});

/* -------------------------------------------------------------- the licence */

test('non-commercial and no-derivatives are refused outright', () => {
  for (const licence of ['CC BY-NC 4.0', 'CC BY-NC-SA 4.0', 'CC BY-ND 4.0']) {
    const call = judgeLicence({licence, creator: 'A', source: 'X', sourceUrl: 'https://x'});
    assert.equal(call.ok, false, `${licence} must be refused`);
  }
});

test('public domain without provenance is not public domain', () => {
  assert.equal(judgeLicence({licence: 'Public domain'}).ok, false);
  assert.equal(judgeLicence({licence: 'Public domain', source: 'Library of Congress', sourceUrl: 'https://loc.gov/x'}).ok, true);
});

test('CC BY without a creator cannot be credited, so it cannot be used', () => {
  assert.equal(judgeLicence({licence: 'CC BY 4.0', source: 'X', sourceUrl: 'https://x'}).ok, false);
  assert.equal(judgeLicence({licence: 'CC BY 4.0', creator: 'A. Photographer', source: 'X', sourceUrl: 'https://x'}).ok, true);
});

test('a contradictory record is resolved by a person, not guessed', () => {
  const call = judgeLicence({
    licence: 'CC BY 2.0',
    creator: 'All rights reserved, Julian Watters, 2016-03-16',
    source: 'Wikimedia Commons',
    sourceUrl: 'https://commons.wikimedia.org/x',
  });
  assert.equal(call.ok, false);
  assert.match(call.why, /contradictory/);
});

/* -------------------------------------------------------------- the picture */

test('quality is measured from the file, and one unusable axis is fatal', async () => {
  const blownOut = await fixture('lab-wall.jpg');
  const q = await scoreQuality(sharp, blownOut, brief());
  assert.equal(qualityVerdict(q).ok, false, 'a blown-out plate must not pass');
  assert.ok(q.notes.some((n) => /blown out/.test(n)));
});

test('a sharp, well-exposed file passes the quality gate', async () => {
  const good = await fixture('moon-sky.jpg');
  const q = await scoreQuality(sharp, good, brief());
  assert.equal(qualityVerdict(q).ok, true, JSON.stringify(q.axes));
});

test('composition is judged against the shot that was planned', async () => {
  const buffer = await fixture('moon-sky.jpg');
  const q = await scoreQuality(sharp, buffer, brief());
  const centred = await scoreComposition(sharp, buffer, brief({preferred_composition: 'centred, the whole structure in frame'}), q);
  const offset = await scoreComposition(sharp, buffer, brief({preferred_composition: 'subject to one side, negative space for type'}), q);
  assert.notEqual(centred.axes.placement, offset.axes.placement, 'the same file scores differently against different shots');
});

/* ------------------------------------------------------------ deduplication */

test('a re-encoded copy of the same photograph is a near-duplicate', async () => {
  const original = await fixture('moon-sky.jpg');
  const copy = await sharp(original).resize(400).jpeg({quality: 55}).toBuffer();
  assert.ok(hamming(await perceptualHash(sharp, original), await perceptualHash(sharp, copy)) <= 10);
});

test('two different photographs are not', async () => {
  const a = await perceptualHash(sharp, await fixture('moon-sky.jpg'));
  const b = await perceptualHash(sharp, await fixture('storage-drawers.jpg'));
  assert.ok(hamming(a, b) > 10);
});

test('the ledger refuses the same asset twice and demotes the same composition', async () => {
  const ledger = makeLedger();
  const buffer = await fixture('moon-sky.jpg');
  const phash = await perceptualHash(sharp, buffer);
  const candidate = {provider: 'local', id: 'z'};
  const composition = {measured: {massX: 0.5, massY: 0.5, spread: 0.3}};
  assert.equal(ledger.check({candidate, buffer, phash, composition}).duplicate, null);
  ledger.record({candidate, buffer, phash, composition, line: 'first'});

  const again = ledger.check({candidate, buffer, phash, composition});
  assert.equal(again.reject, true);
  assert.match(again.duplicate, /same asset/);

  const other = ledger.check({
    candidate: {provider: 'local', id: 'y'},
    buffer: await fixture('storage-drawers.jpg'),
    phash: await perceptualHash(sharp, await fixture('storage-drawers.jpg')),
    composition,
  });
  assert.equal(other.reject, false, 'the same framing is a preference, not a refusal');
  assert.match(other.duplicate, /same composition/);
});

/* ------------------------------------------------------------------- cache */

test('the cache key is provider, id and variant — not the request', () => {
  const a = cacheKey({provider: 'commons', id: '42', variant: 'default'});
  const b = cacheKey({provider: 'commons', id: '42', variant: 'default'});
  const c = cacheKey({provider: 'commons', id: '42', variant: 'thumb'});
  const d = cacheKey({provider: 'openverse', id: '42', variant: 'default'});
  assert.equal(a, b, 'the same asset requested twice is one cache entry');
  assert.notEqual(a, c);
  assert.notEqual(a, d);
});

/* ------------------------------------------------------------------ ladder */

test('a line that needs a picture never settles silently on typography', () => {
  for (const domain of NEEDS_A_PICTURE) {
    const settled = settle({brief: brief({domain}), accepted: null, drawn: null});
    assert.equal(settled.resolution, 'REPRESENTATION_REQUIRED', `${domain} fell through to type`);
    assert.equal(settled.ok, false);
  }
});

test('an abstract claim may settle on typography, and that is not a hole', () => {
  const settled = settle({brief: brief({domain: 'abstract'}), accepted: null, drawn: null});
  assert.equal(settled.resolution, 'typography');
  assert.equal(settled.ok, true);
});

test('a drawing is a legitimate answer, not a failure', () => {
  const settled = settle({brief: brief({domain: 'scale'}), accepted: null, drawn: 'scaleHaulage'});
  assert.equal(settled.resolution, 'procedural');
  assert.equal(settled.ok, true);
});

test('an unreachable rung is reported as unreachable, not as empty', () => {
  const availability = [
    {id: 'local', available: true},
    ...['commons', 'openverse', 'pexels', 'pixabay', 'loc', 'archive', 'europeana', 'nasa'].map((id) => ({id, available: false})),
  ];
  const rungs = usableRungs(availability);
  const external = rungs.find((r) => r.id === 'external-photo');
  assert.equal(external.usable, false);
  assert.match(external.because, /unavailable/);
  assert.equal(rungs.find((r) => r.id === 'reviewed-local').usable, true);
});

/* --------------------------------------------------------------- providers */

test('every provider satisfies the same four-function contract', () => {
  for (const provider of PROVIDERS) {
    for (const fn of ['search', 'download', 'metadata', 'license', 'available']) {
      assert.equal(typeof provider[fn], 'function', `${provider.id} is missing ${fn}`);
    }
    assert.ok(provider.name && provider.homepage, `${provider.id} has no identity`);
  }
});

test('providers needing a key declare which one', () => {
  for (const provider of PROVIDERS.filter((p) => p.needsKey)) {
    assert.match(provider.needsKey, /^[A-Z0-9_]+$/, `${provider.id} must name an env var`);
  }
});

/* ------------------------------------------------------- generated assets */

test('a generated reconstruction says it is one', () => {
  assert.equal(disclosureFor(brief({domain: 'scale'})), 'ILLUSTRATIVE RECONSTRUCTION');
  assert.equal(disclosureFor(brief({domain: 'process'})), 'ILLUSTRATIVE RECONSTRUCTION');
  assert.equal(
    disclosureFor(brief({domain: 'geography', historical_constraints: null})),
    'ILLUSTRATION · NOT A PHOTOGRAPH',
    'a place that exists today is illustrated, not reconstructed',
  );
});

test('a generated candidate records prompt, provider, model and date', async () => {
  const [candidate] = await generated.search('x', {brief: brief({domain: 'scale'})});
  for (const field of ['prompt', 'provider', 'model', 'generatedAt', 'disclosure']) {
    assert.ok(candidate.generation[field], `generation record is missing ${field}`);
  }
  assert.match(candidate.title, /ILLUSTRATIVE RECONSTRUCTION/);
  assert.match(candidate.description, /ILLUSTRATIVE RECONSTRUCTION/);
});

test('the rejection criteria become the generator\'s negative prompt', () => {
  const {negative} = promptFor(brief({reject_if: ['modern construction', 'generic quarry']}));
  assert.match(negative, /modern construction/);
  assert.match(negative, /generic quarry/);
});

test('a generated asset is never settled as a photograph', () => {
  const settled = settle({brief: brief({domain: 'scale'}), accepted: {rung: 4}, drawn: null});
  assert.equal(settled.resolution, 'generated illustration');
  assert.notEqual(settled.resolution, 'photograph');
});

test('rung four is closed, and says why, when nothing is configured', async () => {
  const verdict = await generated.available();
  if (!process.env.IMAGE_API_URL && !process.env.IMAGE_API_KEY) {
    assert.equal(verdict.ok, false);
    assert.equal(verdict.why, 'unconfigured');
    assert.match(verdict.detail, /IMAGE_API_URL/);
  }
});
