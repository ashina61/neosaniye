/**
 * The licence filter, which is the part of fetching with legal consequences.
 *
 * Commons hosts FREE files, not public ones. Much of it is CC BY or CC BY-SA,
 * which require credit wherever the work is published; some of it is
 * non-commercial or no-derivatives, which a monetised reel may not use at all.
 * Getting this wrong does not break a render — it breaks a licence, silently,
 * and only becomes visible when somebody complains.
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {best, isFree, queriesFor} from '../scripts/fetch-commons.mjs';

const meta = (short, terms = '') => ({LicenseShortName: {value: short}, UsageTerms: {value: terms}});

test('public domain and CC0 are free', () => {
  for (const l of ['Public domain', 'CC0', 'PD-old', 'PD-US-expired']) {
    assert.ok(isFree(meta(l)), `${l} should be usable`);
  }
});

test('CC BY and CC BY-SA are free — and are why CREDITS.md exists', () => {
  for (const l of ['CC BY 4.0', 'CC BY-SA 3.0', 'CC BY-SA 4.0']) {
    assert.ok(isFree(meta(l)), `${l} should be usable`);
  }
});

test('non-commercial and no-derivatives are refused', () => {
  // A reel is a derivative work and may well be monetised.
  for (const l of ['CC BY-NC 4.0', 'CC BY-ND 4.0', 'CC BY-NC-SA 3.0']) {
    assert.equal(isFree(meta(l)), false, `${l} must be refused`);
  }
});

test('fair use and all-rights-reserved are refused', () => {
  assert.equal(isFree(meta('Fair use')), false);
  assert.equal(isFree(meta('Copyrighted', 'All rights reserved')), false);
  assert.equal(isFree(meta('')), false, 'an unknown licence is not a free one');
});

const page = (id, width, height, short) => ({
  title: `File:${id}.jpg`,
  imageinfo: [{width, height, mime: 'image/jpeg', url: `u/${id}`, extmetadata: meta(short)}],
});

test('flags, logos and wiki furniture are not pictures of anything', () => {
  // They pass every numeric check and score BETTER than the photograph, because
  // a flag is a clean rectangle. Only the title gives them away.
  const chosen = best(
    [
      page('Flag of Mali', 3000, 2000, 'CC0'),
      page('Commons-logo', 2000, 2000, 'CC BY-SA 4.0'),
      page('Djinguereber mosque at dusk', 1600, 2400, 'CC BY-SA 4.0'),
    ],
    1080 / 1920,
  );
  assert.match(chosen.page.title, /mosque/);
});

test('a non-free candidate is never chosen, however good it is', () => {
  const chosen = best([page('huge', 4000, 6000, 'CC BY-NC 4.0'), page('ok', 1200, 1800, 'CC0')], 1080 / 1920);
  assert.match(chosen.page.title, /ok/);
});

test('anything too small to fill the frame is skipped', () => {
  assert.equal(best([page('tiny', 400, 600, 'CC0')], 1080 / 1920), null);
});

test('a long search is followed by a shorter one, never replaced by it', () => {
  // The commonest way this comes back empty-handed is a search that is TOO
  // precise: four words joined by AND, one of them missing from the file's
  // description, and the whole result sinks.
  assert.deepEqual(queriesFor('Catalan Atlas Mansa Musa'), ['Catalan Atlas Mansa Musa', 'Catalan Atlas']);
  // Precision is never given away for free — the narrow search is still first.
  assert.equal(queriesFor('Sahara sand dunes sunrise')[0], 'Sahara sand dunes sunrise');
  // Two words are specific enough already; halving them finds anything at all.
  assert.deepEqual(queriesFor('Djinguereber Mosque'), ['Djinguereber Mosque']);
});

test('a recipe may give the fallbacks itself', () => {
  // For when the second choice is a different thing, not a broader one.
  assert.deepEqual(queriesFor(['Catalan Atlas Mansa Musa', 'medieval portolan chart']), [
    'Catalan Atlas Mansa Musa',
    'medieval portolan chart',
  ]);
  assert.deepEqual(queriesFor(''), [], 'no search is not an empty search');
});

test('a huge irrelevant photograph never outranks the thing that was asked for', () => {
  /**
   * The real failure, twice over. A search for "Go board game stones" came back
   * with SCRABBLE TILES; the corrected search for "Weiqi goban" came back with a
   * Christmas sign. Both were enormous files from prolific uploaders, and
   * scoring on size and shape alone threw away the only signal that knows what
   * a picture is OF — Commons' own relevance ranking, which we were re-sorting
   * into oblivion.
   */
  const ranked = (id, index, width, height) => ({
    ...page(id, width, height, 'CC BY-SA 4.0'),
    index,
  });

  const chosen = best(
    [
      ranked('Go 13x13 board', 1, 1600, 2400),
      ranked('Weihnachten Schriftzug MERRY XMAS', 2, 6000, 9000),
    ],
    1080 / 1920,
  );
  assert.match(chosen.page.title, /Go 13x13/, 'the top hit must win, not the biggest file');

  // Relevance leads, it does not tyrannise: between two comparably ranked
  // results the bigger, better-shaped one is still the right pick.
  const tie = best([ranked('small but first', 1, 1000, 1500), ranked('big and second', 1, 2400, 3600)], 1080 / 1920);
  assert.match(tie.page.title, /big and second/);

  // An unranked page is treated as LAST, never as first — guessing that a
  // result with no rank is a top hit is the same bug wearing a different hat.
  const unranked = best([ranked('ranked first', 1, 1200, 1800), page('no rank at all', 6000, 9000, 'CC0')], 1080 / 1920);
  assert.match(unranked.page.title, /ranked first/);

  // Rank leads; it does not tyrannise. A top-ranked PANORAMA in a portrait
  // plate is a stripe of its own middle, and the shape penalty is unbounded
  // where the size term is capped — so a well-shaped runner-up still takes it.
  const shaped = best([ranked('top hit panorama', 1, 4000, 1000), ranked('second but upright', 2, 1400, 2400)], 1080 / 1920);
  assert.match(shaped.page.title, /upright/);
});

test('shape closest to the slot wins over raw size', () => {
  // A panorama dropped into a portrait plate is cropped to a stripe of its own
  // middle, which is usually the least interesting part of it.
  const chosen = best([page('pano', 4000, 1000, 'CC0'), page('tall', 1400, 2400, 'CC0')], 1080 / 1920);
  assert.match(chosen.page.title, /tall/);
});
