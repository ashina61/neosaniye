import test from 'node:test';
import assert from 'node:assert/strict';
import {buildReelSpec, renderBeatSheetMarkdown} from '../src/video/buildReelSpec.js';

const script = {
  topic: 'The fake nation of Poyais',
  title: 'He sold a country that did not exist',
  language: 'en',
  emphasis_words: ['official', 'collapsed'],
  scenes: [
    {narration: 'In 1822, a soldier sold a country that never existed.'},
    {narration: 'He printed official documents and government seals.'},
    {narration: 'Exactly 250 settlers crossed the Atlantic and paid for the land.'},
    {narration: 'The settlement collapsed from disease and hunger.'},
    {narration: 'The country was fake but the journey was real.'},
  ],
};

const timeline = {
  source: 'edge-tts',
  duration: 20,
  words: [],
  scenes: [
    {scene: 0, start: 0, end: 3, duration: 3},
    {scene: 1, start: 3, end: 7, duration: 4},
    {scene: 2, start: 7, end: 11, duration: 4},
    {scene: 3, start: 11, end: 15, duration: 4},
    {scene: 4, start: 15, end: 20, duration: 5},
  ],
};

const sfxLibrary = {
  'camera-shutter': {path: 'runs/x/sfx/camera-shutter.wav', durationInFrames: 20, volume: 0.68},
  'whoosh-long': {path: 'runs/x/sfx/whoosh-long.wav', durationInFrames: 63},
  'whoosh-entrance': {path: 'runs/x/sfx/whoosh-entrance.wav'},
  impact: {path: 'runs/x/sfx/impact.wav'},
  paper: {path: 'runs/x/sfx/paper.wav'},
  'focus-hunt': {path: 'runs/x/sfx/focus-hunt.wav'},
  heartbeat: {path: 'runs/x/sfx/heartbeat.wav'},
  cash: {path: 'runs/x/sfx/cash.wav'},
  'neon-buzz': {path: 'runs/x/sfx/neon-buzz.wav'},
  'final-boom': {path: 'runs/x/sfx/final-boom.wav'},
};

test('kare hassasiyetli reel spec üretir', () => {
  const spec = buildReelSpec({script, audio: {duration: 20}, timeline, sfxLibrary});
  assert.equal(spec.version, 2);
  assert.equal(spec.meta.durationInFrames, 600);
  assert.equal(spec.beats.length, 5);
  assert.deepEqual(spec.beats.map((beat) => beat.fromFrame), [0, 90, 210, 330, 450]);
  assert.equal(spec.beats[0].rig, 'portal-zoom');
  assert.equal(spec.beats.at(-1).rig, 'finale-clone');
  assert.equal(spec.beats.at(-1).clonedFrom, 'grounded-punch');
});

test('motor ayarları film görünümünü ve stop-motion adımını taşır', () => {
  const spec = buildReelSpec({script, audio: {duration: 20}, timeline});
  assert.equal(spec.engine.posterizeFps, 12);
  assert.equal(spec.engine.film.grain, true);
  assert.equal(spec.engine.film.weave, true);
  for (const beat of spec.beats) {
    for (const key of ['saturate', 'contrast', 'sepia', 'brightness']) {
      assert.equal(typeof beat.grade[key], 'number', `${beat.id} grade.${key} eksik`);
    }
  }
});

test('ses efektleri rigin olayına yerleşir, kota doldurmaz', () => {
  const spec = buildReelSpec({script, audio: {duration: 20}, timeline, sfxLibrary});
  const opener = spec.beats[0];
  assert.deepEqual(opener.sfx.map((cue) => cue.family), ['camera-shutter', 'whoosh-long']);
  assert.equal(opener.sfx[1].atFrame, opener.props.pushEndFrame);
  for (const beat of spec.beats) {
    for (const cue of beat.sfx) {
      assert.ok(cue.atFrame >= 0 && cue.atFrame < beat.durationInFrames, `${beat.id} cue beat dışında`);
    }
  }
});

test('kütüphanede olmayan efekt sessizce atlanır, uydurma yol üretilmez', () => {
  const spec = buildReelSpec({script, audio: {duration: 20}, timeline, sfxLibrary: {}});
  assert.deepEqual(spec.beats.flatMap((beat) => beat.sfx), []);
});

test('medya rigin istediği rollere bağlanır', () => {
  const mediaItems = [
    {path: '/abs/a.jpg', type: 'photo', scene: 0, publicPath: 'runs/x/media-00.jpg'},
    {path: '/abs/b.jpg', type: 'photo', scene: 0, publicPath: 'runs/x/media-01.jpg'},
    {path: '/abs/c.jpg', type: 'photo', scene: 0, publicPath: 'runs/x/media-02.jpg'},
    {path: '/abs/d.jpg', type: 'photo', scene: 3, publicPath: 'runs/x/media-03.jpg'},
  ];
  const spec = buildReelSpec({script, audio: {duration: 20}, timeline, mediaItems});
  assert.deepEqual(spec.beats[0].assets.map((asset) => asset.role), ['plate', 'character', 'texture']);
  assert.equal(spec.beats[0].assets[0].path, 'runs/x/media-00.jpg');
  // Tek görsel dönen sahne de ayakta kalır — rig kalan katmanları kendi çizer.
  assert.deepEqual(spec.beats[3].assets.map((asset) => asset.role), ['plate']);
  assert.deepEqual(spec.beats[1].assets, []);
});

test('müzik konuşma penceresinde kısılır', () => {
  const spec = buildReelSpec({script, audio: {duration: 20}, timeline});
  assert.ok(spec.audio.musicDuckVolume < spec.audio.musicVolume);
  assert.deepEqual(spec.audio.duckWindows[0], [0, 90]);
  assert.equal(spec.audio.duckWindows.length, 5);
});

test('ölçülen ve tahmin edilen yerleşimler raporlanır', () => {
  const spec = buildReelSpec({script, audio: {duration: 20}, timeline});
  assert.equal(spec.timing.source, 'edge-tts');
  // Bu zaman çizelgesinde kelime zamanı yok: hepsi tahmin olmak zorunda.
  assert.equal(spec.timing.measuredCaptions, 0);
  assert.ok(spec.timing.estimatedCaptions > 0);
});

test('beat sheet insan tarafından okunabilir şekilde yazılır', () => {
  const spec = buildReelSpec({script, audio: {duration: 20}, timeline, sfxLibrary});
  const markdown = renderBeatSheetMarkdown(spec);
  assert.match(markdown, /# Beat sheet/);
  assert.match(markdown, /portal-zoom/);
  for (const beat of spec.beats) {
    assert.ok(markdown.includes(beat.line), `beat sheet ${beat.id} satırını taşımıyor`);
  }
});

test('satır yoksa fail-closed', () => {
  assert.throws(() => buildReelSpec({script: {scenes: []}}), /REEL_SPEC_LINES_REQUIRED/);
});
