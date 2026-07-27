import test from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp, rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {classifyBeat, directSemantics} from '../src/visual/semanticDirector.js';
import {assessVisualNarration} from '../src/pipeline/visualNarrationQC.js';
import {perceptualHash, hammingDistance, isTooSimilar} from '../src/media/imageHash.js';

const run = promisify(execFile);
const hasFfmpeg = await run('ffmpeg', ['-version']).then(() => true).catch(() => false);

test('süreç, karşılaştırma, sayı ve konum cümleleri sınıflandırılır', () => {
  assert.equal(classifyBeat('Coral releases signals that travel through water and reach fish').kind, 'process');
  assert.equal(classifyBeat('Reef fish are twice as fast as their predators').kind, 'compare');
  assert.equal(classifyBeat('Over 4000 species live inside this reef').kind, 'number');
  assert.equal(classifyBeat('These reefs sit off the coast of Australia').payload.place, 'AUSTRALIA');
});

test('yapısı olmayan dolgu cümlesi semantik beat üretmez', () => {
  assert.equal(classifyBeat('It was a quiet ordinary afternoon'), null);
  assert.equal(classifyBeat('Beautiful'), null);
});

test('directSemantics yalnız gösterilebilir cümleleri planlar', () => {
  const timeline = [
    'Coral releases signals that travel through water and reach fish',
    'It was a quiet ordinary afternoon',
    'Over 4000 species live inside this reef',
  ].map((narration, index) => ({narration, index, start: index * 3, end: index * 3 + 3}));
  const {beats, stats} = directSemantics(timeline);
  assert.equal(beats.length, 2);
  assert.equal(stats.none, 1);
  assert.ok(stats.coverage > 0.6);
});

test('görsel anlatım QC tek görsel tekrarını yakalar', () => {
  const items = Array.from({length: 10}, () => ({visualHash: 'ffffffffffffffff', assetId: 'same'}));
  const report = assessVisualNarration({items, beats: [], motionPlan: new Array(10).fill({}), duration: 39});
  assert.equal(report.passed, false);
  assert.ok(report.failures.some((item) => item.startsWith('VISUAL_VARIETY_TOO_LOW')));
  assert.equal(report.metrics.uniqueVisuals, 1);
});

test('çeşitli plan ve farklı semantik şablonlar QC kapısını geçer', () => {
  const items = Array.from({length: 11}, (_, index) => ({
    visualHash: (BigInt(index) * 0x1111111111111111n % (2n ** 64n)).toString(16),
    assetId: `asset-${index}`,
  }));
  const beats = [
    {kind: 'process', index: 0, start: 1},
    {kind: 'number', index: 2, start: 8},
    {kind: 'compare', index: 4, start: 15},
    {kind: 'location', index: 6, start: 22},
  ];
  const report = assessVisualNarration({items, beats, motionPlan: new Array(11).fill({}), duration: 39});
  assert.equal(report.passed, true, JSON.stringify(report.failures));
  assert.equal(report.metrics.hookEvent, true);
  assert.equal(report.metrics.distinctKinds, 4);
});

test('algısal hash aynı ve farklı görselleri ayırır', {skip: !hasFfmpeg && 'ffmpeg yok'}, async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'neosaniye-hash-'));
  try {
    const first = path.join(dir, 'first.png');
    const second = path.join(dir, 'second.png');
    await run('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'testsrc2=s=270x480:d=1', '-frames:v', '1', first]);
    await run('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'color=c=black:s=270x480:d=1', '-frames:v', '1', second]);
    const firstHash = await perceptualHash(first);
    const secondHash = await perceptualHash(second);
    assert.equal(hammingDistance(firstHash, firstHash), 0);
    assert.ok(hammingDistance(firstHash, secondHash) > 0);
    assert.equal(isTooSimilar(firstHash, [firstHash], 10).tooSimilar, true);
  } finally {
    await rm(dir, {recursive: true, force: true});
  }
});
