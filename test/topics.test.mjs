/**
 * THE FILTER THAT KEEPS THE FACTORY FED WITH THINGS IT CAN SHOOT.
 *
 * A topic that cannot be photographed does not fail loudly. It renders: six
 * grey placeholder plates with narration over them, past the validator, past
 * the tests, out the other end as a finished file. That is the most expensive
 * failure this repo has, because it costs a whole run to discover and it looks
 * like success until somebody watches it.
 *
 * So the refusals are the part under test. A popular anecdote beating a modest
 * shootable topic is not a ranking quirk — it is the pipeline pointed at
 * something it has no pictures for.
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PASS, cleanTitle, judge, moodFor, namesIn, postsFrom, rank, slugFor} from '../scripts/find-topics.mjs';
import {episodeDir} from '../scripts/lib/episode.mjs';

const shootable = 'TIL that the Tacoma Narrows Bridge collapsed four months after it opened in 1940';

test('a named, dated topic with an outcome clears the bar', () => {
  const verdict = judge(shootable, {votes: 4000});
  assert.equal(verdict.refused, null);
  assert.ok(verdict.score >= PASS, `scored ${verdict.score}, needs ${PASS}: ${verdict.reasons.join(' · ')}`);
});

test('TIL and other ceremony comes off the front', () => {
  assert.equal(cleanTitle('TIL that a thing happened'), 'a thing happened');
  assert.equal(cleanTitle('[Update] TIL: a thing happened'), 'a thing happened');
});

test('an anecdote is refused however many upvotes it has', () => {
  const verdict = judge('TIL my grandfather worked on the Hoover Dam and never talked about it', {votes: 90_000});
  assert.match(verdict.refused ?? '', /first person/);
  assert.equal(verdict.score, 0);
});

test('a question is refused — it is not an event', () => {
  assert.match(judge('What is the creepiest thing you have ever seen?').refused ?? '', /question/);
  assert.match(judge('Why did the Roman Empire fall').refused ?? '', /question/);
});

test('nothing named and no date is refused — there is nothing to fetch', () => {
  assert.match(judge('Some interesting facts about clouds').refused ?? '', /nothing named/);
});

/**
 * The supply law, in one case. fetch-commons refuses anything that is not
 * free, so a topic from last decade arrives with empty hands however good a
 * story it is — and it must not outrank one from 1919 that can be shot.
 */
test('a recent topic loses to the same story dated a century earlier', () => {
  const modern = judge('TIL that the Costa Concordia capsized off Giglio in 2012 killing 32 people', {votes: 20_000});
  const old = judge('TIL that the Costa Concordia capsized off Giglio in 1912 killing 32 people', {votes: 20_000});
  assert.equal(modern.refused, null, 'it is shootable, just badly supplied');
  assert.ok(modern.score < old.score, `${modern.score} is not under ${old.score}`);
  assert.ok(modern.reasons.some((r) => /scarce/.test(r)));
});

test('the year is a date, not the verdict number', () => {
  const dated = judge('The Sodder house burned in Fayetteville in 1945');
  assert.ok(!dated.reasons.some((r) => /verdict line/.test(r)), dated.reasons.join(' · '));
  const counted = judge('The Sodder house burned in Fayetteville in 1945 and five children vanished');
  assert.ok(counted.reasons.some((r) => /verdict line/.test(r)), counted.reasons.join(' · '));
});

test('the first word is capitalised by grammar, not by being a name', () => {
  assert.deepEqual(namesIn('Sponge divers found the Antikythera mechanism'), ['Antikythera']);
});

/** An id is a name, not a path — episodeDir is the authority and it throws. */
test('a slug is always a legal episode id', () => {
  for (const title of [
    'TIL the Tacoma Narrows Bridge collapsed in 1940',
    '"Mother Shipton\'s" prophecy — 1641?!',
    'a b c',
  ]) {
    const id = slugFor(cleanTitle(title));
    assert.doesNotThrow(() => episodeDir(id), `"${id}" is not a legal id`);
  }
  assert.equal(slugFor(cleanTitle('TIL the Tacoma Narrows Bridge collapsed in 1940')), 'tacoma-narrows-1940');
});

test('the mood comes from what the topic is about', () => {
  assert.equal(moodFor('Mansa Musa gave away his gold in Cairo'), 'gold-heat');
  assert.equal(moodFor('the wreck lay under sixty metres of sea'), 'green-rot');
  assert.equal(moodFor('Vesuvius buried the town in ash'), 'ash-grey');
  assert.equal(moodFor('the killer sent a cipher to the police'), 'cold-noir');
});

test('a reddit listing and a plain list of titles read the same way', () => {
  const listing = {
    data: {
      children: [
        {data: {title: 'TIL a thing', subreddit: 'todayilearned', ups: 12, permalink: '/r/x/1', num_comments: 3}},
        {data: {title: 'TIL another', subreddit: 'todayilearned', ups: 4, permalink: '/r/x/2'}},
      ],
    },
  };
  const fromApi = postsFrom(listing);
  assert.equal(fromApi.length, 2);
  assert.equal(fromApi[0].votes, 12);
  assert.equal(fromApi[0].url, 'https://reddit.com/r/x/1');
  assert.deepEqual(
    postsFrom('one title\n\n  two titles  \n').map((p) => p.title),
    ['one title', 'two titles'],
  );
});

test('ranking drops the refused, dedupes and puts the best first', () => {
  const ranked = rank([
    {title: 'What should I watch tonight?', votes: 50_000},
    {title: shootable, votes: 100},
    {title: shootable, votes: 100},
    {title: 'TIL the Antikythera mechanism was found in 1901 by sponge divers', votes: 100},
  ]);
  assert.equal(ranked.length, 2, 'the question is out and the duplicate is folded');
  assert.ok(ranked[0].score >= ranked[1].score);
  assert.ok(ranked.every((r) => r.id && r.mood));
});
