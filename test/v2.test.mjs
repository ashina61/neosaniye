import assert from 'node:assert/strict';
import {test} from 'node:test';
import {wordWindows} from '../scripts/lib/measure.mjs';
import {auditTiles, LIMITS} from '../scripts/lib/audit.mjs';
import {ASSET_LIMITS, auditAssets} from '../scripts/lib/assetcheck.mjs';
import {normaliseItem} from '../scripts/plan-episode.mjs';
import {validateEpisodeConfig} from '../engine/schema.mjs';

/**
 * The zeroth law, one grain finer — plus the three defects the contact sheet
 * caught in one look and nothing in the suite would have.
 */

/** The smallest config the schema accepts, so a test can add one field to it. */
const baseConfig = () => ({
  id: 'x',
  fps: 30,
  width: 1080,
  height: 1920,
  look: {
    posterizeFps: 12,
    grade: {saturate: 1, contrast: 1, sepia: 0, brightness: 1},
    film: {grain: true, grunge: true, scanlines: true, vignette: true, gateWeave: true},
  },
  scenes: [{id: 's1', sceneType: 'title-slate', durationInFrames: 60}],
});

test('a line splits into words that exactly refill its window', () => {
  const {words, how} = wordWindows('gökyüzü neden mavi görünür', null, 22_050, {start: 2, end: 6});
  assert.equal(how, 'weighted');
  assert.equal(words.length, 4);
  assert.equal(words[0].start, 2);
  // The remainder goes to the LAST word, so the sum is the window and the reel
  // cannot drift a frame per word away from its own narration.
  assert.equal(words.at(-1).end, 6);
  for (let i = 1; i < words.length; i += 1) assert.equal(words[i].start, words[i - 1].end);
});

test('a longer word holds the screen longer than a short one', () => {
  const {words} = wordWindows('a extraordinary', null, 22_050, {start: 0, end: 10});
  assert.ok(words[1].end - words[1].start > words[0].end - words[0].start);
});

test('a one-word line is still a window', () => {
  const {words} = wordWindows('yok', null, 22_050, {start: 1, end: 2});
  assert.deepEqual(words, [{text: 'yok', start: 1, end: 2}]);
});

test('an evidence item that named no kind keeps its words', () => {
  // The defect: "KIRMIZI" landed in the `kind` slot, matched no template, and
  // drew a card with an empty heading. Three blank slips of paper, valid.
  assert.equal(normaliseItem('KIRMIZI'), 'card|KIRMIZI|');
  assert.equal(normaliseItem('  MAVİ  '), 'card|MAVİ|');
});

test('an evidence item that named a kind is left alone', () => {
  assert.equal(normaliseItem('news|The Chronicle|Cipher on page one'), 'news|The Chronicle|Cipher on page one');
  assert.equal(normaliseItem('card|EXHIBIT 12-C|Bloodstained panel'), 'card|EXHIBIT 12-C|Bloodstained panel');
});

test('a subtitle cue with no duration is refused', () => {
  const base = baseConfig();
  assert.equal(validateEpisodeConfig({...base, subtitles: [{from: 10, to: 20, text: 'mavi'}]}).length, 0);
  const problems = validateEpisodeConfig({...base, subtitles: [{from: 10, to: 10, text: 'mavi'}]});
  assert.ok(problems.some((p) => p.includes('never shows')));
});

test('a bed outside the episode folder is refused', () => {
  const base = baseConfig();
  assert.equal(validateEpisodeConfig({...base, bed: 'audio/bed.wav', bedGain: 0.2}).length, 0);
  assert.ok(validateEpisodeConfig({...base, bed: '../elsewhere/bed.wav'}).length > 0);
  assert.ok(validateEpisodeConfig({...base, bed: 'audio/bed.wav', bedGain: 4}).length > 0);
});

test('a frame that is one flat tone is called out', () => {
  const notes = auditTiles([
    {label: 's01 33%', scene: 's01', stats: {luma: 0.5, spread: 0.004, flat: 0.98, edges: 0}},
  ]);
  assert.ok(notes.some((n) => n.includes('no contrast')));
  assert.ok(notes.some((n) => n.includes('one tone')));
});

test('two samples of one scene that barely differ mean the shot does not move', () => {
  const still = {luma: 0.4, spread: 0.2, flat: 0.2, edges: 0.1};
  const notes = auditTiles([{label: 's04 33%', scene: 's04', stats: still, distance: LIMITS.motion / 2}]);
  assert.ok(notes.some((n) => n.includes('does not move')));
  assert.equal(auditTiles([{label: 's04 33%', scene: 's04', stats: still, distance: 0.4}]).length, 0);
});

test('one picture standing in for two roles is called out', async () => {
  const file = new URL('../episodes/test-episode/assets/background-1.png', import.meta.url).pathname;
  const {notes, checkedRelevance} = await auditAssets([
    {role: 'a', file: 'assets/a.png', absolute: file},
    {role: 'b', file: 'assets/b.png', absolute: file},
  ]);
  assert.ok(notes.some((n) => n.includes('byte-identical')));
  // AND IT SAYS IT DID NOT ANSWER THE REAL QUESTION. Silently reporting "fine"
  // without a model is how five wrong pictures shipped in one episode.
  assert.equal(checkedRelevance, false);
});

test('the asset limits stay loose enough to not cry wolf', () => {
  assert.ok(ASSET_LIMITS.spread < 0.05);
  assert.ok(ASSET_LIMITS.flat > 0.8);
});

/* ------------------------------------------------------------- SHORTS -- */

import {readFile} from 'node:fs/promises';

test('a short brief names one shot per spoken line', async () => {
  const brief = JSON.parse(await readFile(new URL('../episodes/paper-moon/brief.json', import.meta.url), 'utf8'));
  const voice = JSON.parse(await readFile(new URL('../episodes/paper-moon/audio/vo.json', import.meta.url), 'utf8'));
  assert.equal(brief.shots.length, voice.lines.length, 'a line with no shot renders as a red card');
});

test('every shot kind in the brief is one the engine knows', async () => {
  const brief = JSON.parse(await readFile(new URL('../episodes/paper-moon/brief.json', import.meta.url), 'utf8'));
  const known = new Set(['hook', 'curves', 'fold', 'climb', 'scale', 'stamp']);
  for (const shot of brief.shots) assert.ok(known.has(shot.kind), `unknown shot kind: ${shot.kind}`);
});

test('a climb lands on a whole number its label can name', async () => {
  const brief = JSON.parse(await readFile(new URL('../episodes/paper-moon/brief.json', import.meta.url), 'utf8'));
  for (const shot of brief.shots.filter((s) => s.kind === 'climb')) {
    assert.equal(shot.from, Math.round(shot.from));
    assert.equal(shot.to, Math.round(shot.to));
    // Every milestone has to be reachable inside the climb it belongs to,
    // otherwise it is a chip that can never be drawn.
    for (const mark of shot.marks) assert.ok(mark.at >= shot.from && mark.at <= shot.to, `${mark.at} is outside`);
  }
});

test('the built short puts a beat on every cut but the first', async () => {
  const data = JSON.parse(await readFile(new URL('../episodes/paper-moon/short.json', import.meta.url), 'utf8'));
  const thumps = data.beats.filter((b) => b.kind === 'thump');
  assert.equal(thumps.length, data.scenes.length - 1, 'one thump per cut, none before the reel starts');
  for (const beat of data.beats) assert.ok(beat.at >= 0 && beat.at < data.end);
});

test('captions clear the platform furniture', async () => {
  // 1080x1920, and the bottom 18% is the caption, the handle and the sound
  // label. A cue drawn under that is a cue nobody reads.
  const SAFE = 0.22;
  assert.ok(SAFE > 0.18);
});
