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

// ---------------- GERÇEK HARİTA ----------------
test('gerçek coğrafya: yer adı doğru enlem/boylama çözülür', async () => {
  const { resolvePlace } = await import('../src/visual/geo.js');
  const au = resolvePlace('AUSTRALIA');
  assert.equal(au.country, 'Australia');
  // Avustralya ~133°D, ~24°G — sahte ızgarada bu doğrulama mümkün değildi.
  assert.ok(au.lon > 110 && au.lon < 155, `boylam yanlış: ${au.lon}`);
  assert.ok(au.lat < -10 && au.lat > -40, `enlem yanlış: ${au.lat}`);
  const jp = resolvePlace('JAPAN');
  assert.ok(jp.lon > 125 && jp.lon < 146, `Japonya boylamı yanlış: ${jp.lon}`);
  assert.ok(jp.lat > 24 && jp.lat < 46, `Japonya enlemi yanlış: ${jp.lat}`);
});

test('tanınmayan yer adı için harita ÇİZİLMEZ (uydurma yok)', async () => {
  const { resolvePlace, buildMapPaths } = await import('../src/visual/geo.js');
  assert.equal(resolvePlace('ZORTAVIA'), null);
  assert.equal(buildMapPaths('ZORTAVIA', { w: 640, h: 320 }), null);
  assert.deepEqual(beatEvents({ kind: 'location', payload: { place: 'ZORTAVIA' }, start: 0, end: 3 }, SAFE), []);
});

test('harita işareti panel içinde ve hedef ülke vurgulanır', async () => {
  const { buildMapPaths } = await import('../src/visual/geo.js');
  const m = buildMapPaths('AUSTRALIA', { w: 644, h: 340 });
  assert.ok(m.target, 'hedef ülke poligonu yok');
  assert.ok(m.marker.x >= 0 && m.marker.x <= 644, `işaret x panel dışında: ${m.marker.x}`);
  assert.ok(m.marker.y >= 0 && m.marker.y <= 340, `işaret y panel dışında: ${m.marker.y}`);
  assert.match(m.land, /^m -?\d+ -?\d+/, 'kara yolu ASS çizim biçiminde değil');
});

// ---------------- ODAK TESPİTİ ----------------
test('odak: nesnenin GERÇEK konumunu bulur', { skip: !hasFfmpeg && 'ffmpeg yok' }, async () => {
  const { detectFocus } = await import('../src/visual/focusDetect.js');
  const dir = await mkdtemp(path.join(os.tmpdir(), 'fd-'));
  try {
    // Bilinen konuma (merkez 0.694, 0.536) turuncu disk koy.
    const img = path.join(dir, 'disk.png');
    await run('ffmpeg', ['-y', '-v', 'error',
      '-f', 'lavfi', '-i', 'color=c=0x1a3a4a:s=1080x1920',
      '-f', 'lavfi', '-i', 'color=c=0xFF8800:s=260x260',
      '-filter_complex',
      "[1:v]format=yuva420p,geq=lum='p(X,Y)':a='if(lt(hypot(X-130,Y-130),125),255,0)'[d];[0:v][d]overlay=620:900",
      '-frames:v', '1', img], { maxBuffer: 20 * 1024 * 1024 });
    const f = await detectFocus(img);
    assert.ok(f, 'net bir nesne bulunamadı');
    const err = Math.hypot(f.x - (620 + 130) / 1080, f.y - (900 + 130) / 1920);
    assert.ok(err < 0.06, `odak nesneden uzak: sapma ${err.toFixed(3)}`);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('odak: her yeri eşit dokulu karede SUSAR (daire çizilmez)', { skip: !hasFfmpeg && 'ffmpeg yok' }, async () => {
  const { detectFocus } = await import('../src/visual/focusDetect.js');
  const dir = await mkdtemp(path.join(os.tmpdir(), 'fd2-'));
  try {
    const img = path.join(dir, 'uniform.png');
    await run('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'testsrc2=s=1080x1920:d=1',
      '-frames:v', '1', img]);
    assert.equal(await detectFocus(img), null, 'belirsiz karede daire çizmeye kalktı');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('odak halkası KAYDIRILMAZ: sığmıyorsa hiç çizilmez', () => {
  // Regresyon: güvenli-bant kırpması halkayı nesnenin ~100px yukarısına
  // taşıyıp "daire nesnenin üstünde değil" hatasını üretiyordu.
  const mk = (y) => beatEvents({
    kind: 'behavior', payload: { subject: 'FISH', action: 'TURNS' },
    start: 0, end: 4, focus: { x: 0.5, y, confidence: 2 },
  }, SAFE);
  const ok = mk(0.5);
  assert.ok(ok.length > 0, 'geçerli konumda halka çizilmedi');
  const posY = Number(/\\pos\(\d+,(\d+)\)/.exec(ok.join('\n'))[1]);
  assert.equal(posY, Math.round(0.5 * 1920), `halka kaydırıldı: ${posY}`);
  // Altyazı bandının derininde: kaydırmak yerine hiç çizme.
  assert.deepEqual(mk(0.93), [], 'altyazı bandındaki nesne için halka çizildi');
  assert.deepEqual(mk(0.02), [], 'logo bandındaki nesne için halka çizildi');
});
