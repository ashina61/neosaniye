#!/usr/bin/env node
/**
 * WHERE THE NEXT SIX LINES COME FROM.
 *
 * `write-episode.mjs` turns a topic into a script, and everything after it is
 * derived. But the topic itself was always a person staring at a wall, and a
 * pipeline that can render an episode a day fed by a person who thinks of one a
 * week is a pipeline running at a seventh of itself.
 *
 * Reddit already ranks stories by whether they stop a scroll, which is the one
 * thing this factory cannot measure about itself. So it is a good FEEDER. It is
 * not a good source, and the difference is this file:
 *
 *   A TOPIC IS NOT A STORY, IT IS A SUPPLY LINE.
 *
 * The most upvoted post of the week is worthless here if nothing in it can be
 * photographed. Law 2 says people and places are PHOTOGRAPHS — they come off
 * Commons, and Commons has the Catalan Atlas, the Djinguereber Mosque and a
 * 1969 police bulletin. It does not have your uncle's shift, an anonymous
 * construction worker, or anything that happened last Tuesday. A topic with no
 * named, archived subject renders as six grey placeholder plates with narration
 * over them, and it renders SILENTLY — validate passes, the reel exists, and it
 * is empty. That failure is expensive and it is invisible, so it is caught
 * HERE, before a topic is ever written into a brief.
 *
 * What survives the filter is narrow on purpose and it is the shape the whole
 * machine was built around: A NAMED THING, A DATE, AND AN OUTCOME.
 *
 *   node scripts/find-topics.mjs
 *   node scripts/find-topics.mjs --sub=UnresolvedMysteries --t=year --top=15
 *   node scripts/find-topics.mjs --file=dump.json          # offline, saved JSON
 *
 * The network half is deliberately thin. Reddit blocks datacentre IPs as often
 * as it serves them, so a saved dump is a first-class input rather than a
 * fallback: the judgement is the valuable part of this file, and it must run
 * where the fetch cannot.
 */
import {readFile, readdir} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {ROOT, parseArgs} from './lib/episode.mjs';

/**
 * THE SUBREDDITS THAT ACTUALLY FEED THIS MACHINE.
 *
 * Chosen by supply, not by size. Every one of these ranks posts that name a
 * thing with an archive behind it. The big ones that were left out were left
 * out for cause: r/AskReddit is anecdotes, r/pics is somebody's photograph
 * (which is to say, somebody's copyright), r/nextfuckinglevel is FOOTAGE, and
 * footage is a format this engine does not have — it stacks stills and draws
 * over them. A reel of a man working cannot be assembled out of plates.
 */
const SUBS = [
  'todayilearned',
  'UnresolvedMysteries',
  'CatastrophicFailure',
  'AskHistorians',
  'HistoryAnecdotes',
  'ForgottenWeapons',
];

const MOODS = ['gold-heat', 'cold-noir', 'green-rot', 'ash-grey'];

/** Reddit asks that automated clients identify themselves. */
const UA = 'crime-reels/1.0 (topic feeder; https://github.com/ashina61/neosaniye)';

/**
 * Capitalised words that are not names. Without this every title that opens
 * with "The" or contains "In" scores as though it named something.
 */
const NOT_A_NAME = new Set(
  ('the a an and or but of in on at to for from by with as is was were are be been being this that these those his her their its it he she they we you i ' +
    'til today learned after before when while during until since about into over under between among through across against near ' +
    'why how what who where which than then there here also just only even still ever never always most more less first last next new old')
    .split(' '),
);

/**
 * THE VERBS THE PLANNER CAN DRAW.
 *
 * Law 14: a plate says who and where, a motif says WHAT HAPPENED. A topic whose
 * strongest word is "was" gives six lines of captions and nothing for the motif
 * layer to play, which is the difference between a documentary and a slideshow
 * with grain on it. So an outcome verb in the title is worth points — it is the
 * evidence that there is a second act.
 */
const OUTCOME =
  /\b(vanish|disappear|collaps|sank|sunk|sink|burn|burnt|explod|destroy|kill|murder|die|died|death|buri|excavat|discover|found|uncover|steal|stole|stolen|rob|forg|fake|hoax|escap|survive|abandon|banned|ban|hang|execut|betray|surrender|starv|drown|crash|derail|melt|freeze|froze|flood|erupt|poison|smuggl|vanished|wreck|ruin|lost|hunt|chase|arrest|convict|acquit|confess|rescu|refus|invent|build|built|carv|paid|paid|sold|sell|gave|give)\w*\b/i;

/**
 * A number worth putting in line six — law: the verdict line says the number.
 *
 * A quantity, not a digit. The first version of this matched any digits at all,
 * which meant every dated title scored for its own year twice, and matched bare
 * "years" and "miles", which are units standing on their own with nothing in
 * front of them. Years are stripped before this runs.
 */
const MAGNITUDE =
  /\b(\d[\d,.]*|million|billion|thousand|hundred|dozens?|(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|twenty|thirty|forty|fifty|sixty)\s+(?!of\b)[a-z]+)\b/i;

const YEAR = /\b(1[0-9]{3}|20[0-2][0-9])\b/g;
/** Centuries and decades count as a date too — "the 1840s", "17th century". */
const PERIOD = /\b(\d{1,2}(st|nd|rd|th)\s+century|\d{4}s|BC|BCE|AD|CE|medieval|ancient|roman|victorian|ottoman|byzantine)\b/i;

/**
 * The first-person refusal, and the single most important line in the file.
 *
 * Reddit's best-performing posts are overwhelmingly somebody telling you a
 * thing that happened to them. There is no archive of that. Nothing in it can
 * be fetched, so every plate falls back to a generated one, and law 2 already
 * paid for what generated people look like: signage pictograms. The topic is
 * refused rather than scored low, because a high-scoring anecdote would
 * otherwise beat a modest topic that this machine can actually shoot.
 */
const FIRST_PERSON = /(^|[\s"'(])(i|i'm|i've|my|me|myself|we|we're|our|us|mine)([\s,.'!?)"]|$)/i;
const ASKING = /^(what|why|how|who|when|where|which|should|would|could|can|do|does|did|is|are|am|will|if)\b/i;

/** Reddit prefixes that are ceremony, not content. */
const NOISE = /^\s*(til(?:\s+that)?|tifu|eli5|psa|update|\[.*?\]|\(.*?\))\s*[:,-]?\s*/i;

export function cleanTitle(raw) {
  let title = String(raw ?? '').replace(/\s+/g, ' ').trim();
  // Twice: "[Update] TIL that ..." is two layers of ceremony.
  title = title.replace(NOISE, '').replace(NOISE, '');
  return title.replace(/\s*[—-]\s*$/, '').trim();
}

/** Capitalised mid-sentence words and acronyms — the things Commons can find. */
export function namesIn(title) {
  const words = title.split(/[\s,;:.!?()"]+/).filter(Boolean);
  const names = [];
  for (const [i, word] of words.entries()) {
    const bare = word.replace(/[^A-Za-z'-]/g, '');
    if (bare.length < 2) continue;
    if (NOT_A_NAME.has(bare.toLowerCase())) continue;
    const acronym = /^[A-Z]{2,}$/.test(bare);
    const capital = /^[A-Z][a-z]/.test(bare);
    // The first word of a title is capitalised by grammar, not by being a name.
    if (!acronym && (!capital || i === 0)) continue;
    names.push(bare);
  }
  return [...new Set(names)];
}

/**
 * JUDGE ONE TITLE.
 *
 * Returns the topic as it would be handed to the writer, plus the reasons it
 * scored — printed rather than hidden, because the point of this step is to
 * teach whoever runs it what a shootable topic looks like. A refusal is not a
 * low score: it is a topic the machine cannot photograph at all.
 */
export function judge(rawTitle, meta = {}) {
  const topic = cleanTitle(rawTitle);
  const names = namesIn(topic);
  const years = topic.match(YEAR) ?? [];
  const words = topic.split(/\s+/).filter(Boolean);

  const verdict = {
    topic,
    sub: meta.sub ?? null,
    url: meta.url ?? null,
    votes: Number(meta.votes) || 0,
    names,
    refused: null,
    score: 0,
    reasons: [],
  };

  if (meta.over_18) verdict.refused = 'nsfw';
  else if (!topic) verdict.refused = 'empty once the prefix came off';
  else if (FIRST_PERSON.test(topic)) verdict.refused = 'first person — an anecdote has no archive to photograph';
  else if (topic.endsWith('?') || ASKING.test(topic)) verdict.refused = 'a question, not an event';
  else if (words.length > 32) verdict.refused = `${words.length} words — a hook is one line`;
  else if (!names.length && !years.length && !PERIOD.test(topic))
    verdict.refused = 'nothing named and no date — there is nothing to fetch';

  if (verdict.refused) return verdict;

  const add = (points, reason) => {
    verdict.score += points;
    verdict.reasons.push(`${points > 0 ? '+' : ''}${points} ${reason}`);
  };

  if (names.length) add(Math.min(3, names.length), `names ${names.slice(0, 3).join(', ')}`);
  if (years.length) add(3, `dated ${years[0]}`);
  else if (PERIOD.test(topic)) add(2, 'has a period');
  if (OUTCOME.test(topic)) add(2, `something happens — "${topic.match(OUTCOME)[0]}"`);
  // The year is a date, not a quantity; counting it here scored it twice.
  if (MAGNITUDE.test(topic.replace(YEAR, ' '))) add(1, 'has a number for the verdict line');
  if (words.length <= 18) add(1, 'short enough to be the hook');

  /**
   * MODERN IS A SUPPLY PROBLEM, NOT A TASTE ONE. A photograph of something from
   * 2016 exists and belongs to the person who took it; fetch-commons refuses
   * anything that is not free, so a recent topic arrives with empty hands.
   */
  const newest = years.length ? Math.max(...years.map(Number)) : 0;
  if (newest >= 1990) add(-4, `${newest} — free photographs of the moment itself are scarce`);

  // Reddit's own ranking, logged flat. It is evidence the hook works and
  // nothing more: a 90k-upvote anecdote is still refused above.
  const votes = Number(meta.votes) || 0;
  if (votes > 1000) add(Math.min(2, Math.round(Math.log10(votes / 1000) * 2) / 2 + 0.5), `${votes.toLocaleString('en-US')} upvotes`);

  return verdict;
}

/** Passing is not a compliment — it is the floor at which a brief is worth writing. */
export const PASS = 6;

const MOOD_WORDS = [
  ['gold-heat', /\b(gold|golden|treasure|rich|wealth|fortune|empire|king|queen|crown|jewel|diamond|coin|mint|palace|silk|caravan)\w*\b/i],
  ['green-rot', /\b(sea|ocean|ship|wreck|sank|sunk|dive|diver|underwater|swamp|jungle|tomb|cave|excavat|rot|moss|flood|river|lake)\w*\b/i],
  ['ash-grey', /\b(fire|burn|ash|volcano|eruption|war|bomb|siege|plague|ruin|collaps|blizzard|snow|frozen|famine|dust|smoke)\w*\b/i],
  ['cold-noir', /\b(murder|killer|missing|vanish|disappear|police|detective|case|unsolved|body|crime|cipher|witness|trial|prison|heist|forgery|hoax)\w*\b/i],
];

export function moodFor(topic) {
  for (const [mood, pattern] of MOOD_WORDS) if (pattern.test(topic)) return mood;
  return 'cold-noir';
}

/**
 * An id is a NAME, not a path (see episodeDir), and it is also a folder someone
 * has to type. Built from what the topic actually names, plus its year, because
 * "antikythera" tells you what is in the folder and "til-that-in-1901" does not.
 */
export function slugFor(topic, names = namesIn(topic)) {
  const year = (topic.match(YEAR) ?? [])[0];
  const stem = names.length
    ? names.slice(0, 2).join('-')
    : topic
        .split(/\s+/)
        .filter((w) => w.length > 3 && !NOT_A_NAME.has(w.toLowerCase()))
        .slice(0, 2)
        .join('-');
  const slug = `${stem}${year ? `-${year}` : ''}`
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 28)
    .replace(/-$/, '');
  return slug || 'untitled';
}

/**
 * PULL POSTS OUT OF WHATEVER JSON WE WERE GIVEN.
 *
 * A listing from the API, a saved `.json` of one, an array of listings, or a
 * plain array of titles. Being forgiving here is what makes the offline path
 * usable — the person saving a dump should not have to know Reddit's shape.
 */
export function postsFrom(payload, sub = null) {
  if (typeof payload === 'string') {
    return payload
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((title) => ({title, sub, votes: 0, url: null}));
  }
  if (Array.isArray(payload)) return payload.flatMap((entry) => postsFrom(entry, sub));
  const children = payload?.data?.children;
  if (!Array.isArray(children)) return [];
  return children
    .map((child) => child?.data)
    .filter(Boolean)
    .map((post) => ({
      title: post.title ?? '',
      sub: post.subreddit ?? sub,
      votes: post.ups ?? post.score ?? 0,
      comments: post.num_comments ?? 0,
      over_18: Boolean(post.over_18),
      url: post.permalink ? `https://reddit.com${post.permalink}` : null,
    }));
}

async function fetchSub(sub, {sort = 'top', t = 'year', limit = 50} = {}) {
  const url =
    `https://www.reddit.com/r/${encodeURIComponent(sub)}/${sort}.json` +
    `?t=${encodeURIComponent(t)}&limit=${Math.min(100, Number(limit) || 50)}&raw_json=1`;
  const response = await fetch(url, {headers: {'User-Agent': UA, Accept: 'application/json'}, signal: AbortSignal.timeout(30_000)});
  if (!response.ok) throw new Error(`r/${sub} → HTTP ${response.status}`);
  return postsFrom(await response.json(), sub);
}

/** Judge every post, drop the refused, best first. Ties break on votes. */
export function rank(posts) {
  const seen = new Set();
  const kept = [];
  for (const post of posts) {
    const verdict = judge(post.title, post);
    if (verdict.refused) continue;
    const key = verdict.topic.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    verdict.id = slugFor(verdict.topic, verdict.names);
    verdict.mood = moodFor(verdict.topic);
    kept.push(verdict);
  }
  return kept.sort((a, b) => b.score - a.score || b.votes - a.votes);
}

async function existingEpisodes() {
  try {
    const entries = await readdir(path.join(ROOT, 'episodes'), {withFileTypes: true});
    return new Set(entries.filter((e) => e.isDirectory()).map((e) => e.name));
  } catch {
    return new Set();
  }
}

async function main() {
  const args = parseArgs();
  const wanted = typeof args.sub === 'string' ? args.sub.split(',').map((s) => s.trim()).filter(Boolean) : SUBS;
  const top = Number(args.top) || 12;

  let posts = [];
  const failures = [];

  if (typeof args.file === 'string') {
    const raw = await readFile(path.resolve(args.file), 'utf8');
    posts = postsFrom(args.file.endsWith('.json') ? JSON.parse(raw) : raw, args.sub || null);
  } else {
    for (const sub of wanted) {
      try {
        posts.push(...(await fetchSub(sub, {sort: args.sort, t: args.t, limit: args.limit})));
      } catch (error) {
        failures.push(`r/${sub}: ${error?.message ?? error}`);
      }
    }
  }

  if (!posts.length) {
    console.error('✗ nothing to judge.');
    for (const failure of failures) console.error(`   · ${failure}`);
    console.error(
      '\n   Reddit blocks datacentre addresses as often as it answers them, so this is\n' +
        '   normal in CI or a sandbox. Save a listing where the network works —\n' +
        '     curl -A browser "https://www.reddit.com/r/todayilearned/top.json?t=year&limit=50" > dump.json\n' +
        '   and judge it here:\n' +
        '     npm run topics -- --file=dump.json\n' +
        '   A file with one title per line works too.',
    );
    process.exit(1);
  }

  const ranked = rank(posts);
  const taken = await existingEpisodes();
  const passing = ranked.filter((r) => r.score >= PASS);
  const refused = posts.map((post) => judge(post.title, post)).filter((v) => v.refused);

  if (args.json) {
    console.log(JSON.stringify(passing.slice(0, top), null, 2));
    return;
  }

  console.log(`${posts.length} posts → ${ranked.length} shootable → ${passing.length} worth writing (score ≥ ${PASS})\n`);

  /**
   * WHAT WAS THROWN AWAY, AND WHY. Printed rather than swallowed: the whole
   * value of this step is that it teaches what a shootable topic looks like,
   * and a filter that silently eats nine posts in ten teaches nothing.
   */
  if (refused.length) {
    const tally = new Map();
    for (const {refused: why} of refused) tally.set(why, (tally.get(why) ?? 0) + 1);
    console.log(`  refused ${refused.length}: ${[...tally].map(([why, n]) => `${n} × ${why}`).join(' · ')}\n`);
    if (args.refused) {
      for (const verdict of refused) console.log(`    ✗ ${verdict.topic.slice(0, 88)}\n        ${verdict.refused}`);
      console.log('');
    }
  }
  for (const failure of failures) console.log(`  ! ${failure}`);
  if (failures.length) console.log('');

  for (const candidate of passing.slice(0, top)) {
    const clash = taken.has(candidate.id) ? '  ← id already used, pick another' : '';
    console.log(`  ${String(candidate.score).padStart(2)}  ${candidate.topic}`);
    console.log(`      ${candidate.reasons.join(' · ')}`);
    console.log(`      npm run write -- --id=${candidate.id} --topic="${candidate.topic.replace(/"/g, "'")}" --mood=${candidate.mood}${clash}`);
    if (candidate.url) console.log(`      ${candidate.url}`);
    console.log('');
  }

  if (!passing.length) {
    console.log('  Nothing cleared the bar. That is a result, not a bug — most of what ranks');
    console.log('  on Reddit is an anecdote, a question, or something that happened too');
    console.log('  recently to have a free photograph of it. Try --t=all or another sub.');
  }
}

// Only when run as a command; the tests import the judgement.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`✗ ${error?.message ?? error}`);
    process.exit(1);
  });
}
