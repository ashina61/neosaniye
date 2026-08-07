/**
 * THE ONE STEP THAT IS AUTHORSHIP.
 *
 * Everything downstream of the brief is derived; the six lines are written.
 * That makes this the only place a rule can be broken by something that is not
 * a bug — a model returning nine lines has not malfunctioned, it has just
 * written nine lines, and the result is a sixty-eight-second reel where every
 * cut feels slow.
 *
 * A prompt is a request, not a guarantee. So the shape is CHECKED, and a brief
 * that does not hold to it is refused rather than written.
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {jsonFrom, problemsWith, promptFor} from '../scripts/write-episode.mjs';

const line = (slug, vo) => ({slug, vo, image: 'a wide empty landscape'});
const good = {
  lines: [
    line('open', 'In thirteen twenty-four a king walked out of Mali for Mecca.'),
    line('route', 'The road ran four thousand miles across the Sahara.'),
    line('caravan', 'The caravan was so long that accounts still argue about it.'),
    line('mecca', 'He reached the holy city with an empire of gold.'),
    line('cairo', 'In Cairo he gave it away and the price collapsed.'),
    line('close', 'It had not recovered twelve years later.'),
  ],
};

test('a brief that holds to the shape passes', () => {
  assert.deepEqual(problemsWith(good), []);
});

test('nine lines is refused — that is a sixty-eight second reel', () => {
  const nine = {lines: [...good.lines, line('a', 'One.'), line('b', 'Two.'), line('c', 'Three.')]};
  const problems = problemsWith(nine);
  assert.ok(problems.some((p) => /9 lines/.test(p)), problems.join(' | '));
});

test('a line over fifteen words is two lines', () => {
  const long = {
    lines: [
      ...good.lines.slice(1),
      line('open', 'He is often called the richest man who ever lived and what can be measured is only the damage he left behind him.'),
    ],
  };
  assert.ok(problemsWith(long).some((p) => /words — over fifteen/.test(p)));
});

test('a script that runs long overall is refused even if every line is short', () => {
  // Thirty seconds of narration is about eighty words. Six lines of sixteen
  // each passes every per-line check and is still a minute of talking.
  const wordy = {
    lines: good.lines.map((l, i) =>
      line(`l${i}`, 'one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen'),
    ),
  };
  assert.ok(problemsWith(wordy).some((p) => /thirty seconds/.test(p)), problemsWith(wordy).join(' | '));
});

test('every line has to say what we are looking at, and own its own slug', () => {
  const noImage = {lines: good.lines.map((l, i) => (i === 2 ? {slug: l.slug, vo: l.vo} : l))};
  assert.ok(problemsWith(noImage).some((p) => /no image/.test(p)));

  const duplicate = {lines: good.lines.map((l, i) => (i === 3 ? {...l, slug: 'open'} : l))};
  assert.ok(problemsWith(duplicate).some((p) => /used twice/.test(p)));
});

test('JSON is dug out of whatever the model wrapped it in', () => {
  // Fences, a preamble, a sign-off — all of it happens, and none of it is a
  // reason to lose a script that is otherwise fine.
  const payload = '{"lines":[{"vo":"x"}]}';
  for (const wrapper of [
    payload,
    '```json\n' + payload + '\n```',
    '```\n' + payload + '\n```',
    'Here you go:\n\n' + payload + '\n\nHope that helps!',
  ]) {
    assert.deepEqual(jsonFrom(wrapper), {lines: [{vo: 'x'}]}, `failed on: ${wrapper.slice(0, 24)}`);
  }
  assert.throws(() => jsonFrom('no object here'), /no JSON object/);
});

test('the prompt carries the rules, not just the topic', () => {
  // If these fall out of the prompt, the model stops being told the things
  // that cost this repo the most to learn — and nothing else would notice.
  const prompt = promptFor('the pharaoh they tried to erase', 'hatshepsut', 'ash-grey');
  assert.match(prompt, /the pharaoh they tried to erase/);
  assert.match(prompt, /EXACTLY SIX/);
  assert.match(prompt, /80 words TOTAL/);
  assert.match(prompt, /no line over 15 words/);
  assert.match(prompt, /REALLY\n\s*EXISTS/);
  assert.match(prompt, /Write VERBS/);
  assert.match(prompt, /pause after it/);
});
