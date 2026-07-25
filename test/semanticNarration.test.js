import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { classifyBeat, directSemantics } from '../src/visual/semanticDirector.js';
import { buildSemanticAss, beatEvents } from '../src/visual/semanticShots.js';
import { assessVisualNarration } from '../src/pipeline/visualNarrationQC.js';
import { perceptualHash, hammingDistance, isTooSimilar } from '../src/media/imageHash.js';

const run = promisify(execFile);
const hasFfmpeg = await run('ffmpeg', ['-version']).then(() => true).catch(() => false);
const SAFE = { subtitleSafeArea: { top: 0.08, bottom: 0.25, left: 0.06, right: 0.06 } };

// ---------------- SINIFLANDIRMA ----------------
test('süreç cümlesi sıralı adımlara ayrılır (özne kaybolmaz)', () => {
  const b = classifyBeat('Coral releases chemical signals that travel through water and reach nearby fish');
  assert.equal(b.kind, 'process');
  assert.ok(b.payload.steps.length >= 3, `adım sayısı: ${b.payload.steps.length}`);
  // Regresyon: fiili bölücü yapmak ilk adımın öznesini yutuyordu.
  assert.match(b.payload.steps[0], /CORAL/, `ilk adımda özne yok: ${b.payload.steps[0]}`);
});

test('mekanizma cümlesi süreç sayılır (konum değil)', () => {
  const b = classifyBeat('Sunlight hits the water which splits into colors that scatter across the reef');
  assert.equal(b.kind, 'process');
});

test('karşılaştırma iki tarafa ayrılır, artık kelime kalmaz', () => {
  const b = classifyBeat('Reef fish are twice as fast as their predators in open water');
  assert.equal(b.kind, 'compare');
  assert.ok(b.payload.left && b.payload.right);
  assert.doesNotMatch(b.payload.right, /\s(in|the|as|their)$/i, `sonda bağlaç kaldı: ${b.payload.right}`);
});

test('sayı ve yüzde yakalanır', () => {
  assert.equal(classifyBeat('Over 4000 species live inside this reef').kind, 'number');
  const pct = classifyBeat('Nearly 90 percent of these reefs could vanish');
  assert.equal(pct.kind, 'number');
  assert.equal(pct.payload.isPercent, true);
});

test('konum: genel isim yerine ÖZEL AD seçilir', () => {
  const b = classifyBeat('These reefs sit off the coast of Australia in warm shallow water');
  assert.equal(b.kind, 'location');
  assert.equal(b.payload.place, 'AUSTRALIA', 'genel isim (COAST) seçilmiş');
});

test('yapısı olmayan dolgu cümlesi HİÇBİR ŞEY üretmez (dekoratif dolgu yok)', () => {
  assert.equal(classifyBeat('It was a quiet ordinary afternoon'), null);
  assert.equal(classifyBeat('Beautiful'), null);
});

test('directVideo: dolgu sahneler atlanır, kapsama raporlanır', () => {
  const tl = [
    'Coral releases signals that travel through water and reach fish',
    'It was a quiet ordinary afternoon',
    'Over 4000 species live inside this reef',
  ].map((n, i) => ({ narration: n, index: i, start: i * 3, end: i * 3 + 3 }));
  const { beats, stats } = directSemantics(tl);
  assert.equal(beats.length, 2);
  assert.equal(stats.none, 1);
  assert.ok(stats.coverage > 0.6);
});

// ---------------- RENDER ----------------
test('her semantik tip ASS event üretir', () => {
  const kinds = {
    process: { steps: ['STEP ONE', 'STEP TWO', 'STEP THREE'] },
    compare: { left: 'LEFT SIDE', right: 'RIGHT SIDE', axis: 'TWICE' },
    number: { value: 90, unit: 'PERCENT', isPercent: true },
    location: { place: 'AUSTRALIA' },
    behavior: { subject: 'FISH', action: 'SIGNALS' },
  };
  for (const [kind, payload] of Object.entries(kinds)) {
    const ev = beatEvents({ kind, payload, start: 0, end: 4 }, SAFE);
    assert.ok(ev.length > 0, `${kind} hiç event üretmedi`);
    assert.ok(!ev.join('').includes('undefined'), `${kind}: "undefined" sızdı`);
    assert.ok(!ev.join('').includes('NaN'), `${kind}: "NaN" sızdı`);
  }
});

test('boş/eksik beat çökmez, boş ASS döner', () => {
  assert.equal(buildSemanticAss([]), '');
  assert.deepEqual(beatEvents({ kind: 'bilinmeyen', payload: {} }), []);
  assert.deepEqual(beatEvents({ kind: 'process', payload: { steps: ['TEK'] } }, SAFE), []);
});

test('semantik katman altyazı bandına GİRMEZ', () => {
  const ass = buildSemanticAss([
    { kind: 'process', payload: { steps: ['BIR', 'IKI', 'UC', 'DORT'] }, start: 0, end: 5 },
    { kind: 'number', payload: { value: 4000, unit: 'SPECIES' }, start: 5, end: 9 },
  ], { cfg: SAFE });
  const ys = [...ass.matchAll(/\\pos\((-?\d+),(-?\d+)\)/g)].map((m) => Number(m[2]));
  assert.ok(ys.length > 0, 'konum bulunamadı');
  const bandTop = 1920 * 0.75; // alt %25 = altyazı bandı
  const inBand = ys.filter((y) => y > bandTop);
  assert.equal(inBand.length, 0, `altyazı bandına giren ${inBand.length} öğe (${inBand.join(',')})`);
});

test('uzun etiket kutuya sığdırılır (satır bölme)', () => {
  const ev = beatEvents({
    kind: 'compare',
    payload: { left: 'REEF FISH', right: 'FAST AS THEIR PREDATORS', axis: 'TWICE' },
    start: 0, end: 4,
  }, SAFE);
  const joined = ev.join('\n');
  assert.match(joined, /\\N/, 'uzun etiket satıra bölünmedi');
});

// ---------------- ALGISAL HASH ----------------
test('aynı görselin hash mesafesi 0, farklı görselinki büyük', { skip: !hasFfmpeg && 'ffmpeg yok' }, async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'sh-'));
  try {
    const a = path.join(dir, 'a.png');
    const b = path.join(dir, 'b.png');
    await run('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i',
      'testsrc2=s=270x480:d=1', '-frames:v', '1', a]);
    await run('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i',
      'color=c=black:s=270x480:d=1', '-frames:v', '1', b]);
    const ha = await perceptualHash(a);
    const hb = await perceptualHash(b);
    assert.equal(hammingDistance(ha, ha), 0, 'aynı görsel 0 olmalı');
    assert.ok(hammingDistance(ha, hb) > 0, 'farklı görseller ayırt edilemedi');
    assert.equal(isTooSimilar(ha, [ha], 10).tooSimilar, true, 'kopya yakalanmadı');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('okunamayan dosya hash kapısını kilitlemez', async () => {
  assert.equal(await perceptualHash('/yok/boyle/bir/dosya.jpg'), null);
  assert.equal(isTooSimilar(null, [1n], 10).tooSimilar, false);
});

// ---------------- QC KAPISI ----------------
test('QC: tek görselin tekrarı YAKALANIR (asıl regresyon)', () => {
  // Gerçek başarısızlık: 10 sahne, hepsi neredeyse aynı kare.
  const same = 'ffffffffffffffff';
  const items = Array.from({ length: 10 }, () => ({ visualHash: same, assetId: 'x' }));
  const r = assessVisualNarration({ items, beats: [], motionPlan: new Array(10).fill({}), duration: 39 });
  assert.equal(r.passed, false);
  assert.ok(r.failures.some((f) => f.startsWith('VISUAL_VARIETY_TOO_LOW')), JSON.stringify(r.failures));
  assert.equal(r.metrics.uniqueVisuals, 1);
});

test('QC: çeşitli görsel + semantik anlatım GEÇER', () => {
  const items = Array.from({ length: 11 }, (_, i) => ({
    visualHash: (BigInt(i) * 0x1111111111111111n % (2n ** 64n)).toString(16),
    assetId: `a${i}`,
  }));
  const beats = [
    { kind: 'process', index: 0, start: 1.0 },
    { kind: 'number', index: 2, start: 8 },
    { kind: 'compare', index: 4, start: 15 },
    { kind: 'location', index: 6, start: 22 },
  ];
  const r = assessVisualNarration({ items, beats, motionPlan: new Array(11).fill({}), duration: 39 });
  assert.equal(r.passed, true, JSON.stringify(r.failures));
  assert.equal(r.metrics.hookEvent, true);
  assert.equal(r.metrics.distinctKinds, 4);
});

test('QC: ilk 3sn olayı yoksa uyarır', () => {
  const items = Array.from({ length: 12 }, (_, i) => ({ assetId: `a${i}` }));
  const beats = [{ kind: 'number', index: 3, start: 12 }, { kind: 'process', index: 5, start: 18 },
    { kind: 'compare', index: 7, start: 24 }, { kind: 'location', index: 9, start: 30 }];
  const r = assessVisualNarration({ items, beats, motionPlan: new Array(12).fill({}), duration: 39 });
  assert.equal(r.metrics.hookEvent, false);
  assert.ok(r.warnings.some((w) => /ilk 3/.test(w)), JSON.stringify(r.warnings));
});

// ---------------- GERÇEK RENDER ----------------
test('semantik katman gerçekten videoya biner (SSIM farkı)', { skip: !hasFfmpeg && 'ffmpeg yok' }, async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'sr-'));
  try {
    const base = path.join(dir, 'base.mp4');
    await run('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i',
      'color=c=0x0E2A38:s=1080x1920:d=4:r=24', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', base]);
    const assPath = path.join(dir, 'sem.ass');
    await writeFile(assPath, buildSemanticAss([
      { kind: 'process', payload: { steps: ['CORAL RELEASES SIGNALS', 'TRAVEL THROUGH WATER', 'REACH NEARBY FISH'] }, start: 0, end: 4 },
    ], { cfg: SAFE }));
    const out = path.join(dir, 'out.mp4');
    const esc = assPath.replace(/\\/g, '/').replace(/:/g, '\\:');
    await run('ffmpeg', ['-y', '-v', 'error', '-i', base, '-vf',
      `ass=${esc}:fontsdir=assets/fonts,format=yuv420p`, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', out],
    { cwd: process.cwd(), maxBuffer: 20 * 1024 * 1024 });
    const { stderr } = await run('ffmpeg', ['-nostdin', '-ss', '3', '-i', base, '-ss', '3', '-i', out,
      '-frames:v', '1', '-filter_complex', '[0:v][1:v]ssim', '-f', 'null', '-'],
    { maxBuffer: 8 * 1024 * 1024 }).catch((e) => ({ stderr: e.stderr || '' }));
    const m = /All:\s*([\d.]+)/.exec(stderr || '');
    assert.ok(m, 'SSIM ölçülemedi');
    assert.ok(parseFloat(m[1]) < 0.999, `semantik katman görünmüyor (SSIM ${m[1]})`);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
