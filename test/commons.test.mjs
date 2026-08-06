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
import {best, isFree} from '../scripts/fetch-commons.mjs';

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

test('a non-free candidate is never chosen, however good it is', () => {
  const chosen = best([page('huge', 4000, 6000, 'CC BY-NC 4.0'), page('ok', 1200, 1800, 'CC0')], 1080 / 1920);
  assert.match(chosen.page.title, /ok/);
});

test('anything too small to fill the frame is skipped', () => {
  assert.equal(best([page('tiny', 400, 600, 'CC0')], 1080 / 1920), null);
});

test('shape closest to the slot wins over raw size', () => {
  // A panorama dropped into a portrait plate is cropped to a stripe of its own
  // middle, which is usually the least interesting part of it.
  const chosen = best([page('pano', 4000, 1000, 'CC0'), page('tall', 1400, 2400, 'CC0')], 1080 / 1920);
  assert.match(chosen.page.title, /tall/);
});
