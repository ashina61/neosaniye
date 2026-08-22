/**
 * THE PLANNER MUST NOT BE SURPRISED BY A TOPIC.
 *
 * Every other test in this repo checks a rule. This one checks that the factory
 * SURVIVES — that whatever a person or a model writes into a brief, the planner
 * either compiles it into a valid config or refuses it with a sentence naming
 * the line. Never a stack trace, never a config that validates and renders
 * wrong, and never a silent NaN.
 *
 * These are not hypotheticals. Every case below either broke the planner or
 * slipped past it when it was first run:
 *
 *   A layer written `{"role": "x"}` and nothing else produced `"depth": null`,
 *   because `Number(undefined) ?? 0.2` is NaN — `??` catches null and undefined
 *   and NaN is neither. Seven placements were written that way.
 *
 *   A brief naming `../../../../etc/passwd` as its artwork produced
 *   `assets/../../../../etc/passwd`, and the episode folder is the render's
 *   public directory, so that path does not fail — it RESOLVES.
 *
 *   An unknown prop kind travelled into scene-config.json and failed two steps
 *   later at validation, which then blamed a generated file nobody wrote.
 *
 * The briefs are planned in a temp directory rather than under `episodes/`, so
 * a hostile fixture never becomes something the other suites walk into.
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {mkdtemp, mkdir, writeFile, readFile, rm} from 'node:fs/promises';
import {promisify} from 'node:util';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateEpisodeConfig} from '../engine/schema.mjs';

const run = promisify(execFile);
const ROOT = path.dirname(fileURLToPath(import.meta.url)).replace(/\/test$/, '');
const PLANNER = path.join(ROOT, 'scripts', 'plan-episode.mjs');

const shot = (extra = {}) => ({
  template: 'composite',
  signature: 'a thing happens',
  camera: {from: 1, to: 1.3},
  props: [],
  ...extra,
});
const line = (slug, vo, extra = {}) => ({slug, vo, image: 'a surface', pieces: [], shot: shot(), ...extra});
const six = (extra = {}, vo = 'A thing happened here today.') =>
  [1, 2, 3, 4, 5, 6].map((i) => line(`s${i}`, vo, extra));

/** Plan a brief in a throwaway shelf. Returns the config, or the refusal. */
async function plan(lines) {
  const shelf = await mkdtemp(path.join(os.tmpdir(), 'reel-shelf-'));
  const dir = path.join(shelf, 'probe');
  try {
    await mkdir(dir, {recursive: true});
    await writeFile(
      path.join(dir, 'brief.json'),
      JSON.stringify({id: 'probe', title: 'p', mood: 'ash-grey', style: 's', lines}),
    );
    try {
      await run('node', [PLANNER, '--episode=probe'], {cwd: ROOT, env: {...process.env, EPISODES_DIR: shelf}});
    } catch (error) {
      return {refused: String(error.stderr ?? error.message ?? '')};
    }
    return {config: JSON.parse(await readFile(path.join(dir, 'scene-config.json'), 'utf8'))};
  } finally {
    await rm(shelf, {recursive: true, force: true});
  }
}

/** Every scene must be renderable: valid, positive length, no NaN placement. */
function assertRenderable(config, what) {
  assert.ok(config, `${what}: nothing was planned`);
  assert.deepEqual(validateEpisodeConfig(config), [], `${what}: config does not validate`);
  for (const scene of config.scenes) {
    assert.ok(scene.durationInFrames > 0, `${what}: ${scene.id} has ${scene.durationInFrames} frames`);
    for (const layer of scene.layers ?? []) {
      for (const [key, value] of Object.entries(layer)) {
        if (typeof value === 'number') assert.ok(Number.isFinite(value), `${what}: ${scene.id} layer ${key} is ${value}`);
      }
    }
    for (const file of Object.values(scene.assets ?? {})) {
      assert.ok(!String(file).includes('..') && !String(file).startsWith('/'), `${what}: ${file} escapes the episode`);
    }
  }
}

test('a script in any shape still plans', async () => {
  /**
   * A topic decides the WORDS, and the words are the only input. So the words
   * get to be anything: one syllable, no spaces at all, a different script, an
   * emoji, nothing but punctuation. None of these should need a code change and
   * none of them may produce a broken reel.
   */
  const shapes = {
    'one-word lines': six({}, 'Yes.'),
    'a word with no spaces in it': six({}, `${'A'.repeat(180)}.`),
    'nothing but figures': six({}, '1939 1945 60000000 1 2 3.'),
    'accented latin': six({}, 'İkinci Dünya Savaşı çığ gibi büyüdü ve şehirler yandı.'),
    'a non-latin script': six({}, '一九三九年戰爭開始了。'),
    'emoji in the narration': six({}, 'It began 🔥 and then 💀 nothing was left.'),
    'punctuation only': six({}, '... --- ,,, ;;; !!! ???'),
  };
  for (const [what, lines] of Object.entries(shapes)) {
    const {config, refused} = await plan(lines);
    assert.ok(!refused, `${what}: refused a perfectly ordinary script — ${refused}`);
    assertRenderable(config, what);
  }
});

test('a brief that leaves things out still plans', async () => {
  // The choreography is the author's to write and the author is human. Every
  // optional field must be genuinely optional, all the way down to a layer that
  // is nothing but a role — which is the one that produced `"depth": null`.
  const gaps = {
    'no shot at all': [1, 2, 3, 4, 5, 6].map((i) => ({slug: `s${i}`, vo: 'A thing happened.', image: 'x', pieces: []})),
    'an empty shot': six({shot: {}}),
    'no camera': six({shot: {template: 'composite', signature: 's'}}),
    'a layer with only a role and a file': six({shot: shot({layers: [{role: 'a', asset: 'a.png'}]})}),
    'one line, not six': [line('only', 'A single line is the whole reel.')],
    'fifteen lines': Array.from({length: 15}, (_, i) => line(`s${i}`, 'A thing happened here today.')),
  };
  for (const [what, lines] of Object.entries(gaps)) {
    const {config, refused} = await plan(lines);
    assert.ok(!refused, `${what}: refused — ${refused}`);
    assertRenderable(config, what);
  }
});

test('numbers a hand typed wrong are clamped, not obeyed', async () => {
  // A brief is written by hand and a hand types 1.5 where it meant 0.15, or
  // leaves the camera where it started. None of that may reach the frame as a
  // layer scaled off the screen or a shot that runs backwards.
  const wild = {
    'a camera that goes backwards and enormous': six({shot: shot({camera: {from: -4, to: 9999}})}),
    'a camera that does not move': six({shot: shot({camera: {from: 1, to: 1}})}),
    'depth past one': six({shot: shot({layers: [{role: 'a', asset: 'a.png', depth: 1.5}]})}),
    'a layer of zero height': six({shot: shot({layers: [{role: 'a', asset: 'a.png', height: 0}]})}),
    'text placed off the frame': six({
      shot: shot({text: {x: 9, y: -3, size: 44, at: 5, every: -2, scrim: 8}}),
      caption: ['a thing', 'happened here'],
    }),
    'a prop that lands after the scene ends': six({shot: shot({props: [{kind: 'plaque', text: 'thing', size: 0.3, at: 1}]})}),
  };
  for (const [what, lines] of Object.entries(wild)) {
    const {config, refused} = await plan(lines);
    assert.ok(!refused, `${what}: refused — ${refused}`);
    assertRenderable(config, what);
  }
});

test('a brief that cannot be compiled is refused by SENTENCE, never by stack', async () => {
  /**
   * The other half of not being surprised. Some briefs are genuinely
   * impossible, and the failure has to name the line that caused it — a stack
   * trace points at the planner, which is never the thing that needs changing.
   */
  const impossible = {
    'artwork outside the episode': [six({shot: shot({layers: [{role: 'a', asset: '../../../../etc/passwd'}]})}), /not a file name/],
    'an absolute path': [six({shot: shot({layers: [{role: 'a', asset: '/etc/hosts'}]})}), /not a file name/],
    'a prop kind nobody draws': [six({shot: shot({props: [{kind: 'banana', text: 'thing', size: 0.3}]})}), /not one of/],
  };
  for (const [what, [lines, expected]] of Object.entries(impossible)) {
    const {config, refused} = await plan(lines);
    assert.ok(refused, `${what}: was compiled when it should have been refused`);
    assert.match(refused, /the brief cannot be compiled/, `${what}: refused without saying the brief is at fault`);
    assert.match(refused, expected, `${what}: the refusal does not say why`);
    assert.ok(!/ {4}at .*\.mjs:\d+/.test(refused), `${what}: refused with a stack trace\n${refused}`);
    assert.equal(config, undefined);
  }
});

test('a brief the write step never saw is still told what it got wrong', async () => {
  /**
   * `npm run write` holds a brief to every rule here. A brief EDITED BY HAND
   * skips that step, and the planner used to compile whatever it was handed:
   * fifteen lines planned into a sixty-second reel without a word, which is the
   * exact failure the six-line rule exists to prevent.
   *
   * Warnings, not refusals — every episode in this repo predates half these
   * rules and all of them still render. The job is that nobody finds out from
   * the finished mp4.
   */
  const shelf = await mkdtemp(path.join(os.tmpdir(), 'reel-shelf-'));
  const dir = path.join(shelf, 'probe');
  try {
    await mkdir(dir, {recursive: true});
    const lines = Array.from({length: 15}, (_, i) =>
      line(`s${i}`, 'A thing happened here today in this place.', {pieces: [], shot: shot()}),
    );
    await writeFile(
      path.join(dir, 'brief.json'),
      JSON.stringify({id: 'probe', title: 'p', mood: 'ash-grey', style: 's', lines}),
    );
    const {stdout} = await run('node', [PLANNER, '--episode=probe'], {
      cwd: ROOT,
      env: {...process.env, EPISODES_DIR: shelf},
    });
    assert.match(stdout, /15 lines, must be exactly 6/);
    assert.match(stdout, /thirty seconds of narration/);
    // And it planned anyway, because a warning that stops the work is a gate.
    assert.match(stdout, /STORYBOARD/);
  } finally {
    await rm(shelf, {recursive: true, force: true});
  }
});

test('an episode id is a name, not a path', async () => {
  // Every script here reads and WRITES inside whatever `episodeDir` returns.
  const {episodeDir} = await import('../scripts/lib/episode.mjs');
  for (const bad of ['../secrets', '/etc', 'a/b', '..', '']) {
    assert.throws(() => episodeDir(bad), /not an episode id/, `"${bad}" should be refused`);
  }
  assert.ok(episodeDir('ww2').endsWith('/ww2'));
});

test('the sentence chooses the cut, and beats the anti-repeat rule doing it', async () => {
  /**
   * A cut is punctuation, and it was the last editorial decision nothing was
   * making: templates, motifs and grade all read the line, and the transition
   * was drawn from a hat. That put a slam on a quiet line and a soft focus-hunt
   * on the hardest beat in the reel.
   *
   * The anti-repeat rule is right about a DERIVED cut and wrong about an earned
   * one. It won at first, and the closing line of an episode — "sixty million
   * people were dead" — matched `flare`, was denied it because the shot before
   * had flared, and the verdict of the whole reel arrived on venetian blinds.
   */
  const {cutFor} = await import('../scripts/plan-episode.mjs');
  const all = ['slam', 'slip', 'flare', 'rack', 'blinds'];
  const die = () => 0.5;

  const kind = (vo, previous = null) => cutFor({vo}, previous, all, die).kind;
  assert.equal(kind('German tanks crossed the Polish border.'), 'slam');
  assert.equal(kind('Britain and France gave Berlin two days.'), 'slip');
  assert.equal(kind('By that evening two empires were at war.'), 'flare');
  assert.equal(kind('Nobody outside the labs noticed.'), 'rack');

  // Earned, and taken even when the shot before took it too.
  assert.equal(kind('Six years later sixty million people were dead.', 'flare'), 'flare');
  // But a line that earns SEVERAL takes the one that is not a repeat.
  assert.equal(kind('They crossed the border and nobody noticed.', 'slam'), 'rack');

  // A hard arrival cuts short; a noticing takes longer.
  assert.ok(cutFor({vo: 'The tanks crossed.'}, null, all, die).frames <= 8);
  assert.ok(cutFor({vo: 'Nobody noticed it.'}, null, all, die).frames >= 9);

  // And a directed cut is simply obeyed.
  assert.deepEqual(cutFor({vo: 'anything', shot: {cut: 'blinds', cutFrames: 20}}, 'blinds', all, die), {
    kind: 'blinds',
    frames: 20,
  });
});

test('a title the author wrote is the card, whole', async () => {
  /**
   * The number is EXTRACTED so a line can earn a slate without one being typed.
   * Extracting it from a title that WAS typed is a different thing, and it
   * loses whatever the extractor does not recognise: an episode closing on
   * "FOURTEEN HUNDRED" delivered a card reading HUNDRED, because the spelled
   * number list ran ten, eleven, twelve, twenty — no teens at all.
   */
  const {config} = await plan([
    line('open', 'A thing happened here today.'),
    {
      slug: 'verdict',
      vo: 'Nothing this complex was built again for fourteen hundred years.',
      image: 'a dark field',
      pieces: [],
      kicker: '1901 · 1951',
      title: 'FOURTEEN HUNDRED',
      footer: 'years before anything like it',
      shot: {template: 'title-slate', signature: 'the verdict', camera: {from: 1.16, to: 1}},
    },
  ]);
  const slate = config.scenes.find((s) => s.id.includes('verdict'));
  assert.equal(slate.params.title, 'FOURTEEN HUNDRED');
  // Whatever device the figure arrives on, it arrives entire.
  assert.equal(slate.params.spinTo ?? slate.params.countTo ?? slate.params.title, 'FOURTEEN HUNDRED');
});

/**
 * A SLATE WITH NOTHING ON IT.
 *
 * The template is typography: two rules, a kicker, a figure set large. Given a
 * line with nothing to set it draws the rules and holds on an empty field for
 * two seconds — renders, validates, right length, and reads as a deliberate
 * beat of silence to everyone who did not write it. Pompeii shipped one.
 */
test('a directed slate is given the line\'s own figure', async () => {
  const lines = six();
  lines[2] = line('wave', 'The wave stood fifteen feet high and kept moving.', {
    shot: shot({template: 'title-slate'}),
  });
  const {config, refused} = await plan(lines);
  assert.ok(!refused, refused);
  const slate = config.scenes.find((s) => s.sceneType === 'title-slate' && s.id.startsWith('s03'));
  assert.ok(slate, 'the directed slate did not survive planning');
  assert.equal(slate.params.title, 'FIFTEEN FEET', 'the beat used to decide whether a slate got its number');
});

test('the rotation may not choose a slate it has nothing to put on', async () => {
  const {config, refused} = await plan(six({}, 'Something happened and then it stopped.'));
  assert.ok(!refused, refused);
  for (const scene of config.scenes) {
    if (scene.sceneType !== 'title-slate') continue;
    const said = [scene.params?.title, scene.params?.kicker, scene.params?.footer].map((v) => String(v ?? '').trim());
    assert.ok(said.some(Boolean), `${scene.id} is a slate with nothing on it`);
  }
});

test('words written for a beat become the slate itself, not a caption under it', async () => {
  const lines = six();
  lines[3] = line('fall', 'Pumice fell for hours and the roofs gave.', {
    onScreen: 'SIX HOURS',
    shot: shot({template: 'title-slate'}),
  });
  const {config, refused} = await plan(lines);
  assert.ok(!refused, refused);
  const slate = config.scenes.find((s) => s.id.startsWith('s04') && s.sceneType === 'title-slate');
  assert.equal(slate.params.title, 'SIX HOURS');
  assert.ok(!slate.onScreenText?.length, 'it is drawn twice on the same card');
});
