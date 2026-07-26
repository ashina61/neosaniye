import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { actorEvents, buildActorAss, ACTOR_TYPES } from '../src/visual/actors.js';
import { beatToActors, planActors } from '../src/visual/beatToActors.js';

const run = promisify(execFile);
const hasFfmpeg = await run('ffmpeg', ['-version']).then(() => true).catch(() => false);
const FOCUS = { x: 0.62, y: 0.48, confidence: 2.1 };

// ---------------- AKTÖR ÜRETİMİ ----------------
test('her aktör tipi ASS üretir, çöp değer sızdırmaz', () => {
  const samples = {
    trail: { path: [[0.2, 0.6], [0.5, 0.5], [0.8, 0.6]] },
    walker: { path: [[0.2, 0.6], [0.5, 0.5], [0.8, 0.6]], followers: 2 },
    flow_arrow: { from: [0.3, 0.7], to: [0.6, 0.3], temp: 'hot' },
    ring: { at: [0.5, 0.5] },
    fill_meter: { at: [0.5, 0.6], ratio: 0.8 },
    readout: { value: 30, unit: 'C' },
    chain: { nodes: [{ at: [0.3, 0.3], label: 'A' }, { at: [0.7, 0.6], label: 'B' }] },
  };
  for (const type of ACTOR_TYPES) {
    const ev = actorEvents({ type, start: 0, end: 4, ...samples[type] });
    assert.ok(ev.length > 0, `${type} hiç event üretmedi`);
    const joined = ev.join('');
    assert.ok(!joined.includes('undefined'), `${type}: "undefined" sızdı`);
    assert.ok(!joined.includes('NaN'), `${type}: "NaN" sızdı`);
  }
});

test('geçersiz/eksik aktör çökmez, boş döner', () => {
  assert.deepEqual(actorEvents({ type: 'yok', start: 0, end: 3 }), []);
  assert.deepEqual(actorEvents({ type: 'trail', start: 0, end: 3, path: [[0.5, 0.5]] }), []);
  assert.deepEqual(actorEvents({ type: 'trail', start: 5, end: 2, path: [[0, 0], [1, 1]] }), []);
  assert.equal(buildActorAss([]), '');
});

test('iz KAPANMAZ: her segment ayrı dörtgen (hayalet çizgi regresyonu)', () => {
  // Tek çok-noktalı yol libass tarafından kapatılıyor ve izin sonundan
  // başına dönen bir çizgi görünüyordu. Segment sayısı = nokta-1 olmalı.
  const ev = actorEvents({ type: 'trail', start: 0, end: 4,
    path: [[0.2, 0.6], [0.4, 0.5], [0.6, 0.55], [0.8, 0.5]] });
  assert.equal(ev.length, 3, `segment sayısı yanlış: ${ev.length}`);
  for (const line of ev) {
    // Her segment 4 köşeli kapalı bir dörtgen; içinde 3 'l' olmalı.
    assert.equal((line.match(/ l /g) || []).length, 3, 'segment dörtgen değil');
  }
});

test('iz zamanla BÜYÜR: segmentler sırayla başlar', () => {
  const ev = actorEvents({ type: 'trail', start: 1, end: 5,
    path: [[0.1, 0.5], [0.4, 0.5], [0.7, 0.5], [0.9, 0.5]] });
  const starts = ev.map((l) => l.split(',')[1]);
  const uniq = new Set(starts);
  assert.equal(uniq.size, starts.length, 'segmentler aynı anda beliriyor (iz büyümüyor)');
});

// ---------------- "7500 NE?" KURALI ----------------
test('readout TEK BAŞINA çizilmez (havada kalan sayaç)', () => {
  const ass = buildActorAss([{ type: 'readout', value: 7500, unit: 'X', start: 1, end: 5 }]);
  assert.equal(ass, '', 'destekleyici süreç yokken sayaç çizildi');
});

test('readout besleyen süreçle BİRLİKTE çizilir', () => {
  const ass = buildActorAss([
    { type: 'fill_meter', at: [0.5, 0.6], ratio: 1, start: 1, end: 5 },
    { type: 'readout', value: 7500, unit: 'X', start: 1, end: 5 },
  ]);
  assert.ok(ass.includes('7,500') || ass.includes('7500'), 'sayaç çizilmedi');
});

test('besleyen süreç ÇOK UZAKTAYSA sayaç yine çizilmez', () => {
  const ass = buildActorAss([
    { type: 'fill_meter', at: [0.5, 0.6], ratio: 1, start: 1, end: 3 },
    { type: 'readout', value: 500, start: 20, end: 24 }, // 19sn sonra, ilgisiz
  ]);
  // Ölçek çubuğu kendi başına meşrudur ve çizilir; ELENMESİ GEREKEN sayıdır.
  assert.ok(ass.length > 0, 'ölçek çubuğu da elendi');
  assert.ok(!ass.includes('>500'), 'ilgisiz süreç sayacı geçerli kıldı');
  assert.ok(!/,,500$/m.test(ass), 'sayaç metni çizildi');
});

// ---------------- KÖPRÜ: BEAT → AKTÖR ----------------
test('davranış beat\'i ölçülmüş odak VARSA yol koreografisi üretir', () => {
  const actors = beatToActors({ kind: 'behavior', payload: { subject: 'FISH', action: 'TURNS' },
    start: 0, end: 5, focus: FOCUS });
  const types = actors.map((a) => a.type);
  assert.ok(types.includes('trail'), 'iz yok');
  assert.ok(types.includes('walker'), 'yürüyen özne yok');
  // Yolun VARIŞ noktası ölçülen odak olmalı (uydurma değil).
  const trail = actors.find((a) => a.type === 'trail');
  const son = trail.path.at(-1);
  assert.ok(Math.abs(son[0] - FOCUS.x) < 0.02, `varış x odakla eşleşmiyor: ${son[0]}`);
});

test('odak ÖLÇÜLMEDİYSE yol uydurulmaz', () => {
  const actors = beatToActors({ kind: 'behavior', payload: { subject: 'FISH', action: 'TURNS' },
    start: 0, end: 5 }); // focus yok
  assert.deepEqual(actors, [], 'ölçüm olmadan konum uyduruldu');
});

test('sayı beat\'i sayaç + besleyen ölçek üretir', () => {
  const actors = beatToActors({ kind: 'number', payload: { value: 4000, unit: 'SPECIES' },
    start: 2, end: 6 });
  const types = actors.map((a) => a.type);
  assert.ok(types.includes('readout') && types.includes('fill_meter'),
    'sayaç besleyen süreç olmadan üretildi');
});

test('süreç beat\'i zincir üretir; compare/location KART yolunda kalır', () => {
  const chain = beatToActors({ kind: 'process',
    payload: { steps: ['BIR', 'IKI', 'UC'] }, start: 0, end: 5 });
  assert.equal(chain[0].type, 'chain');
  assert.equal(chain[0].nodes.length, 3);
  assert.deepEqual(beatToActors({ kind: 'compare', payload: { left: 'A', right: 'B' }, start: 0, end: 4 }), []);
  assert.deepEqual(beatToActors({ kind: 'location', payload: { place: 'JAPAN' }, start: 0, end: 4 }), []);
});

test('planActors: aktör ve kart yolları AYRIŞIR, sahne kaybolmaz', () => {
  const beats = [
    { kind: 'behavior', payload: { subject: 'A', action: 'B' }, start: 0, end: 4, focus: FOCUS },
    { kind: 'number', payload: { value: 30, unit: 'C' }, start: 5, end: 9 },
    { kind: 'location', payload: { place: 'JAPAN' }, start: 10, end: 14 },
  ];
  const { actors, cardBeats, stats } = planActors(beats);
  assert.ok(actors.length > 0);
  assert.equal(cardBeats.length, 1, 'location kart yoluna düşmedi');
  assert.equal(cardBeats[0].kind, 'location');
  assert.equal(stats.actorScenes, 2);
});

// ---------------- GERÇEK RENDER ----------------
test('aktör katmanı gerçekten videoya biner (SSIM farkı)', { skip: !hasFfmpeg && 'ffmpeg yok' }, async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'act-'));
  try {
    const base = path.join(dir, 'base.mp4');
    await run('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i',
      'color=c=0x3a2c1e:s=1080x1920:d=5:r=24', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', base]);
    const assPath = path.join(dir, 'a.ass');
    await writeFile(assPath, buildActorAss([
      { type: 'trail', path: [[0.16, 0.66], [0.4, 0.58], [0.7, 0.62]], start: 0.2, end: 5 },
      { type: 'walker', path: [[0.16, 0.66], [0.4, 0.58], [0.7, 0.62]], start: 0.2, end: 5, followers: 2 },
    ]));
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
    assert.ok(parseFloat(m[1]) < 0.999, `aktör katmanı görünmüyor (SSIM ${m[1]})`);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('yol YUMUŞAK yay olmalı, keskin V zikzağı değil', () => {
  // Regresyon: ilk sürümde yol hedefin YAKIN tarafından başlıyordu; yatay
  // açıklık daralınca dikey salınım baskın gelip keskin bir "V" üretiyordu.
  for (const fx of [0.2, 0.4, 0.6, 0.85]) {
    const [{ path }] = beatToActors({ kind: 'behavior', payload: { subject: 'A', action: 'B' },
      start: 0, end: 6, focus: { x: fx, y: 0.5, confidence: 2 } });
    // X monoton ilerlemeli (geri dönüş yok).
    const dirs = new Set();
    for (let i = 1; i < path.length; i += 1) dirs.add(Math.sign(path[i][0] - path[i - 1][0]));
    assert.equal(dirs.size, 1, `x yönü değişiyor (zikzak): ${JSON.stringify(path)}`);
    // Ardışık segmentler arasındaki yön değişimi küçük olmalı (keskin dönüş yok).
    // NOT: fark [-π,π]'ye NORMALİZE edilmeli — sağdan sola giden yolda atan2
    // ±π civarında sarıyor ve ham fark 6.14 rad gibi sahte bir "keskin dönüş"
    // üretiyor (bu testin ilk hâlindeki hata buydu, koddaki değil).
    const norm = (d) => Math.abs(Math.atan2(Math.sin(d), Math.cos(d)));
    for (let i = 2; i < path.length; i += 1) {
      const a1 = Math.atan2(path[i - 1][1] - path[i - 2][1], path[i - 1][0] - path[i - 2][0]);
      const a2 = Math.atan2(path[i][1] - path[i - 1][1], path[i][0] - path[i - 1][0]);
      const d = norm(a2 - a1);
      assert.ok(d < 0.9, `keskin dönüş (${d.toFixed(2)} rad) — yol V şeklinde`);
    }
  }
});

test('yol her odak için hedefte BİTER (kayma yok)', () => {
  for (const [fx, fy] of [[0.2, 0.3], [0.5, 0.5], [0.85, 0.65]]) {
    const [{ path }] = beatToActors({ kind: 'behavior', payload: { subject: 'A', action: 'B' },
      start: 0, end: 6, focus: { x: fx, y: fy, confidence: 2 } });
    const son = path.at(-1);
    assert.ok(Math.abs(son[0] - fx) < 0.001 && Math.abs(son[1] - fy) < 0.001,
      `varış (${son}) odaktan (${fx},${fy}) kaydı`);
  }
});

test('yürüme/işaretleme fiilleri davranış sayılır (amiral örnek)', async () => {
  const { classifyBeat } = await import('../src/visual/semanticDirector.js');
  // İlk sürümde BEHAVIOR_RE'de "walk" yoktu → tam da hedeflenen örnek
  // davranış sayılmıyor, iz koreografisi hiç üretilmiyordu.
  for (const c of [
    'A single termite walks out and marks the ground behind it',
    'The workers follow that chemical line underground',
    'Ants carry leaves back to the nest',
  ]) {
    assert.equal(classifyBeat(c)?.kind, 'behavior', `davranış sayılmadı: "${c}"`);
  }
});
