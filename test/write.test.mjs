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

// A SHOT IS A STACK, so the fixture is one too. This used to be six lines with
// one landscape each and it passed every check in the file — which is exactly
// how the pipeline shipped a reel of six photographs and called it a
// storyboard.
// And a DIRECTED one. A brief that says what the shot is but not how it moves
// leaves the camera and the composition to a seeded die, which is how six
// different topics came out as six versions of the same reel.
// WHAT THE PROP SAYS COMES OUT OF THE LINE, so the fixture takes it from there
// too. The first version put one plaque reading "Mali · 1324" on all six lines
// and the check caught it on the line about the Sahara — correctly, because a
// caption that names something the narrator never says is a second voice.
const shot = (label, signature = 'the caravan crests the dune and the camera falls back off it') => ({
  template: 'composite',
  signature,
  camera: {from: 1.0, to: 1.34, focus: 'hunt'},
  props: [{kind: 'plaque', text: label, size: 0.34, x: 0.3, y: 0.78, depth: 0.6, at: 0.2}],
});

const line = (slug, vo, pieces = ['camel standing in profile', 'man in robes standing']) => ({
  slug,
  vo,
  image: 'a wide empty landscape',
  pieces,
  // The first long word of the line, which is by construction one of its own.
  shot: shot(vo.split(/\s+/).find((w) => w.replace(/[^a-zA-Z]/g, '').length > 4) ?? 'road'),
});
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
  const noImage = {lines: good.lines.map((l, i) => (i === 2 ? {slug: l.slug, vo: l.vo, shot: l.shot} : l))};
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

test('a reel of flat photographs is refused — a shot is a stack', () => {
  // The failure this check exists for: six lines, one photograph each, every
  // other rule satisfied. It renders, it validates, and it is a slideshow.
  // Nothing in front of the backdrop AT ALL — no pieces, no standing layers,
  // no drawn props. However the stack is declared, this brief declares none.
  const bare = (l) => ({slug: l.slug, vo: l.vo, image: l.image, shot: {...l.shot, props: []}});
  const flat = {lines: good.lines.map(bare)};
  assert.ok(problemsWith(flat).some((p) => /6 lines have nothing in front/.test(p)), problemsWith(flat).join(' | '));

  // ONE bare line is a rest, not a pattern — a reel that never lets a frame be
  // still is as tiring as one that is never anything else.
  const oneBare = {lines: good.lines.map((l, i) => (i === 3 ? bare(l) : l))};
  assert.deepEqual(problemsWith(oneBare), []);
});

test('a piece has to be ONE object, because it gets cut out', () => {
  // Both of these key badly and in different ways: a scene keys to a rectangle,
  // a plural keys to confetti. Neither can be given a depth and stood in front
  // of anything.
  const scene = {lines: good.lines.map((l, i) => (i === 0 ? {...l, pieces: ['men around a table']} : l))};
  assert.ok(problemsWith(scene).some((p) => /is two things|is a scene/.test(p)), problemsWith(scene).join(' | '));

  const plural = {lines: good.lines.map((l, i) => (i === 0 ? {...l, pieces: ['a row of chairs']} : l))};
  assert.ok(problemsWith(plural).some((p) => /is a scene/.test(p)), problemsWith(plural).join(' | '));

  const joined = {lines: good.lines.map((l, i) => (i === 0 ? {...l, pieces: ['a camel and its driver']} : l))};
  assert.ok(problemsWith(joined).some((p) => /is two things/.test(p)), problemsWith(joined).join(' | '));
});

test('five pieces is a crowded frame', () => {
  const many = {
    lines: good.lines.map((l, i) =>
      i === 0 ? {...l, pieces: ['camel', 'drum', 'staff', 'sack', 'lantern']} : l,
    ),
  };
  assert.ok(problemsWith(many).some((p) => /5 pieces/.test(p)), problemsWith(many).join(' | '));
});

test('what a drawn object SAYS comes out of the line', () => {
  /**
   * The reference reel's three front pages read NO LATE FEES, NO STORES,
   * CUSTOMER FIRST while the narrator says "No late fees. No stores. Customer
   * first." — the same words at the same moment, which is why they land. A
   * headline that paraphrases the line is a second, quieter voice arguing with
   * the first one, and nothing else in this repo would ever notice.
   */
  const stray = {
    lines: good.lines.map((l, i) =>
      i === 0 ? {...l, shot: {...l.shot, props: [{kind: 'plaque', text: 'AN EMPIRE OF SALT', size: 0.3}]}} : l,
    ),
  };
  assert.ok(problemsWith(stray).some((p) => /never says .*"salt"/.test(p)), problemsWith(stray).join(' | '));

  // Numbers are exempt: a line saying "thirteen twenty-four" earns a plaque
  // reading 1324, and spelling it out on brass would be absurd.
  const figures = {
    lines: good.lines.map((l, i) =>
      i === 0 ? {...l, shot: {...l.shot, props: [{kind: 'plaque', text: 'Mali · 1324', size: 0.3}]}} : l,
    ),
  };
  assert.deepEqual(problemsWith(figures), []);
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
  // The lesson that cost the most to learn and was the last to reach the
  // prompt: the writer was told pieces were optional, so it never sent any,
  // so every scene was one photograph.
  assert.match(prompt, /A SHOT IS NOT A PHOTOGRAPH/);
  assert.match(prompt, /REQUIRED on every line but one/);
});
