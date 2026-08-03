import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildBeatSheet,
  contentWindow,
  listFragments,
  locatePhrase,
  numberPhrase,
  pullOnScreenText,
} from '../src/story/beatSheet.js';
import {assignRig} from '../src/story/rigs.js';

const LINES = [
  'In 2000, a small startup called Netflix pitched Blockbuster to buy them out.',
  'They asked for fifty million dollars and Blockbuster laughed them out of the room.',
  'So Netflix built the opposite. No late fees. No stores. Customer first.',
  'Ten years later, Blockbuster closed a thousand stores and declared bankruptcy.',
  'Today Netflix drives forty five billion dollars a year in revenue.',
  'This was the most expensive no in history.',
];

const script = () => ({
  topic: 'Netflix and Blockbuster',
  title: 'The most expensive no in history',
  language: 'en',
  emphasis_words: ['laughed', 'bankruptcy'],
  scenes: LINES.map((narration) => ({narration})),
});

const evenTimeline = (lines = LINES, span = 5) => ({
  source: 'edge-tts',
  duration: lines.length * span,
  words: [],
  scenes: lines.map((narration, index) => ({
    scene: index,
    start: index * span,
    end: (index + 1) * span,
    duration: span,
    narration,
  })),
});

test('her seslendirme satırı bir rig kazanır; uçlar sabit, orta kısım kelimelerden gelir', () => {
  const rigs = [];
  LINES.forEach((line, index) => rigs.push(assignRig(line, index, LINES.length, rigs)));
  assert.deepEqual(rigs, [
    'portal-zoom',
    'villain-punch',
    'paper-drop',
    'grounded-punch',
    'money-room',
    'finale-clone',
  ]);
});

test('aynı mekanik üç beat üst üste çalışamaz', () => {
  const line = 'The company collapsed and the doors closed for good.';
  const previous = ['grounded-punch', 'grounded-punch'];
  const rig = assignRig(line, 3, 9, previous);
  assert.notEqual(rig, 'grounded-punch');
});

test('ekrandaki kelimeler satırın birebir parçasıdır', () => {
  const {beats} = buildBeatSheet({script: script(), timeline: evenTimeline(), fps: 30});
  for (const beat of beats) {
    assert.ok(beat.captions.length > 0, `${beat.id} ekrana hiç kelime koymadı`);
    for (const caption of beat.captions) {
      assert.ok(
        beat.line.toLowerCase().includes(caption.text.toLowerCase()),
        `uydurulmuş metin: "${caption.text}" — satırda geçmiyor: ${beat.line}`,
      );
    }
  }
});

test('prop bir metni gösteriyorsa altyazı aynı şeyi tekrar etmez', () => {
  const {beats} = buildBeatSheet({script: script(), timeline: evenTimeline(), fps: 30});
  const portal = beats[0];
  const villain = beats[1];
  const papers = beats[2];

  assert.equal(portal.props.slotWord, 'IN 2000');
  assert.ok(portal.captions.every((caption) => !/2000/.test(caption.text)));

  assert.equal(villain.props.slotWord, 'FIFTY MILLION DOLLARS');
  assert.ok(villain.captions.every((caption) => !/fifty million/i.test(caption.text)));
  assert.ok(villain.captions.some((caption) => /laughed/i.test(caption.text)));

  assert.deepEqual(papers.props.cardTexts, ['NO LATE FEES', 'NO STORES', 'CUSTOMER FIRST']);
  assert.ok(papers.captions.some((caption) => /built the opposite/i.test(caption.text)));
});

test('yerleşimler ölçülmüş konuşma zamanından alınır', () => {
  const words = [
    {word: 'This', start: 0.0, end: 0.2},
    {word: 'was', start: 0.2, end: 0.4},
    {word: 'the', start: 0.4, end: 0.5},
    {word: 'most', start: 1.5, end: 1.8},
    {word: 'expensive', start: 1.8, end: 2.4},
    {word: 'no', start: 2.4, end: 2.7},
    {word: 'in', start: 2.7, end: 2.8},
    {word: 'history', start: 2.8, end: 3.4},
  ];
  const located = locatePhrase(words, 'most expensive', 0, 4);
  assert.ok(located?.measured);
  assert.equal(located.start, 1.5);

  const lines = ['This was the most expensive no in history.'];
  const {beats, measuredCaptions} = buildBeatSheet({
    script: {scenes: lines.map((narration) => ({narration}))},
    timeline: {source: 'whisper', duration: 4, words, scenes: [{scene: 0, start: 0, end: 4, duration: 4}]},
    fps: 30,
  });
  assert.ok(measuredCaptions > 0, 'hiçbir yerleşim ölçülmedi');
  // Ekrana çıkan parça "the most expensive"; ilk kelimesi 0.4sn'de söyleniyor.
  assert.equal(beats[0].captions[0].text, 'the most expensive');
  assert.equal(beats[0].captions[0].atFrame, 12);
});

test('beat pencereleri zaman çizelgesinden gelir, tahminden değil', () => {
  const timeline = {
    source: 'edge-tts',
    duration: 21,
    words: [],
    scenes: [
      {scene: 0, start: 0, end: 2.5, duration: 2.5},
      {scene: 1, start: 2.5, end: 9, duration: 6.5},
      {scene: 2, start: 9, end: 21, duration: 12},
    ],
  };
  const {beats} = buildBeatSheet({
    script: {scenes: LINES.slice(0, 3).map((narration) => ({narration}))},
    timeline,
    fps: 30,
  });
  assert.deepEqual(beats.map((beat) => beat.fromFrame), [0, 75, 270]);
  assert.deepEqual(beats.map((beat) => beat.durationInFrames), [75, 195, 360]);
});

test('rig propları beatin kendi uzunluğundan türetilir', () => {
  const short = buildBeatSheet({
    script: {scenes: [{narration: LINES[0]}, {narration: LINES[5]}]},
    timeline: evenTimeline(LINES.slice(0, 2), 3),
    fps: 30,
  }).beats[0];
  const long = buildBeatSheet({
    script: {scenes: [{narration: LINES[0]}, {narration: LINES[5]}]},
    timeline: evenTimeline(LINES.slice(0, 2), 9),
    fps: 30,
  }).beats[0];

  assert.ok(long.props.throughEndFrame > short.props.throughEndFrame);
  assert.ok(short.props.detachFrame < short.props.throughEndFrame);
  assert.ok(short.props.pushEndFrame < short.props.detachFrame);
});

test('metin çıkarıcı yardımcıları', () => {
  assert.equal(numberPhrase('They asked for fifty million dollars'), 'fifty million dollars');
  assert.equal(numberPhrase('Nothing measurable here'), null);
  assert.deepEqual(listFragments('No late fees. No stores. Customer first.'), [
    'No late fees',
    'No stores',
    'Customer first',
  ]);
  assert.equal(contentWindow('This was the most expensive no in history'), 'the most expensive');
  assert.deepEqual(
    pullOnScreenText('The settlement collapsed from disease and hunger.', {max: 1}).map((f) => f.text),
    ['The settlement collapsed'],
  );
});

test('satır yoksa fail-closed', () => {
  assert.throws(() => buildBeatSheet({script: {scenes: []}}), /BEAT_SHEET_LINES_REQUIRED/);
});
