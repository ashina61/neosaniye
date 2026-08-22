/**
 * THE REFUSALS, WHICH ARE THE WHOLE FILE.
 *
 * Publishing is the one step that cannot be undone by deleting a file, so what
 * is under test here is not that an upload works — it is that the three states
 * which render happily and are NOT finished reels never reach a channel.
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {describe, problemsWithRelease, tagsFor, titleFor} from '../scripts/publish-episode.mjs';

const finished = {
  video: {file: 'out/x.mp4', size: 4_000_000},
  placeholders: [],
  measured: true,
  credits: 'Boston 1919 — photographer unknown, public domain, via Wikimedia Commons',
  commons: true,
  privacy: 'private',
};

const brief = {
  id: 'great-molasses-1919',
  title: 'The wave that was not water',
  lines: [
    {vo: "In January 1919 a steel tank in Boston's North End burst."},
    {vo: 'Two million gallons of molasses ran down Commercial Street.'},
    {vo: 'The company paid six hundred thousand dollars and blamed anarchists.'},
  ],
};

test('a finished, measured, credited reel has nothing against it', () => {
  assert.deepEqual(problemsWithRelease(finished), []);
});

/**
 * The expensive one. Stand-ins render, validate, and produce a real mp4 of a
 * real length — the ledger is the machine already saying in writing that the
 * artwork is not finished, and publishing past that note is the mistake this
 * repo keeps paying for, only automated.
 */
test('stand-in artwork is refused — a grey box reel is not a reel', () => {
  const problems = problemsWithRelease({...finished, placeholders: ['s01-tank-bg.png', 's02-street-bg.png']});
  assert.equal(problems.length, 1);
  assert.match(problems[0], /stand-ins/);
});

test('a cut made from a word count is a draft and stays unpublished', () => {
  assert.match(problemsWithRelease({...finished, measured: false}).join(' '), /word count/);
});

/** Commons is free, not public: the credit is a licence condition. */
test('Commons pictures without CREDITS.md are refused', () => {
  assert.match(problemsWithRelease({...finished, credits: ''}).join(' '), /credit has to travel/);
  assert.deepEqual(problemsWithRelease({...finished, credits: '', commons: false}), [], 'drawn artwork owes nobody a credit');
});

test('an empty or missing render is refused', () => {
  assert.match(problemsWithRelease({...finished, video: null}).join(' '), /no rendered mp4/);
  assert.match(problemsWithRelease({...finished, video: {file: 'out/x.mp4', size: 812}}).join(' '), /not a reel/);
});

test('privacy is one of three words', () => {
  assert.match(problemsWithRelease({...finished, privacy: 'everyone'}).join(' '), /not one of/);
  for (const privacy of ['private', 'unlisted', 'public']) {
    assert.deepEqual(problemsWithRelease({...finished, privacy}), []);
  }
});

test('the feed title is the name plus the hook, inside YouTube\'s hundred', () => {
  const title = titleFor(brief);
  assert.ok(title.length <= 100, `${title.length} characters`);
  assert.match(title, /#Shorts$/);
  assert.match(title, /The wave that was not water/);

  const long = titleFor({title: 'A very long episode name that eats most of the line by itself', lines: [{vo: 'In January 1919 a steel tank in the North End of the city of Boston burst without warning.'}]});
  assert.ok(long.length <= 100, `${long.length} characters`);
  assert.match(long, /#Shorts$/);
});

test('the description carries the script and the credit', () => {
  const body = describe(brief, 'Boston 1919 — public domain, via Wikimedia Commons');
  assert.match(body, /steel tank/);
  assert.match(body, /Wikimedia Commons/);
  assert.ok(body.length <= 5000);
  assert.match(describe(brief, ''), /Every frame in this reel is drawn/);
});

test('tags come out of the script, not a list somebody keeps', () => {
  const tags = tagsFor(brief);
  assert.ok(tags.includes('boston'), tags.join(', '));
  assert.ok(tags.includes('1919'), tags.join(', '));
});
