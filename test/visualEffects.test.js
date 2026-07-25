import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { toPx, regionToPx, avoidSubtitle, regionHitsSubtitle, clamp01 } from '../src/visual/coords.js';
import { buildEffectsAss, effectEvents } from '../src/visual/effects.js';

const run = promisify(execFile);
const hasFfmpeg = await run('ffmpeg', ['-version']).then(() => true).catch(() => false);

// ---- KOORDİNAT SİSTEMİ ----
test('normalize → 1080x1920 piksel', () => {
  assert.deepEqual(toPx(0.5, 0.5), { x: 540, y: 960 });
  assert.deepEqual(toPx(0, 0), { x: 0, y: 0 });
  assert.deepEqual(toPx(1, 1), { x: 1080, y: 1920 });
});

test('regionToPx ekran dışına taşmaz (kırpılır)', () => {
  const r = regionToPx({ x: 0.9, y: 0.9, width: 0.5, height: 0.5 });
  assert.ok(r.x + r.w <= 1080, `x+w=${r.x + r.w}`);
  assert.ok(r.y + r.h <= 1920, `y+h=${r.y + r.h}`);
});

test('avoidSubtitle: altyazı bandındaki nokta yukarı çekilir', () => {
  // bottom safe 0.25 → banttan (y>0.75) düşen nokta yukarı iter.
  const p = avoidSubtitle(0.5, 0.9, {});
  assert.equal(p.collided, true);
  assert.ok(p.y <= 0.75, `y=${p.y} hâlâ bantta`);
});

test('regionHitsSubtitle: alt banda giren bölge yakalanır', () => {
  assert.equal(regionHitsSubtitle({ x: 0.1, y: 0.7, width: 0.3, height: 0.2 }), true);
  assert.equal(regionHitsSubtitle({ x: 0.1, y: 0.2, width: 0.3, height: 0.2 }), false);
});

test('clamp01 sınırlar', () => {
  assert.equal(clamp01(-1), 0); assert.equal(clamp01(2), 1); assert.equal(clamp01(0.4), 0.4);
});

// ---- EFEKT ÜRETİMİ ----
test('buildEffectsAss vektör çizim üretir, "undefined" İÇERMEZ', () => {
  const ass = buildEffectsAss([
    { type: 'highlight_circle', x: 0.5, y: 0.35, start: 0.3, end: 2.5 },
    { type: 'arrow_pointer', x: 0.5, y: 0.35, start: 0.5, end: 2.5 },
    { type: 'label_pop', text: 'Chromatophores', x: 0.5, y: 0.6, start: 0.4, end: 2.5 },
  ]);
  assert.ok(ass.includes('[Events]'));
  assert.ok(/\\p1/.test(ass), 'vektör çizim yok');
  assert.ok(!ass.includes('undefined'), '"undefined" sızdı');
  assert.ok(ass.includes('CHROMATOPHORES'), 'etiket metni yok');
});

test('spotlight iclip ile hedefi oyar', () => {
  const ass = buildEffectsAss([{ type: 'spotlight', x: 0.5, y: 0.34, start: 0, end: 3 }]);
  assert.ok(ass.includes('\\iclip('), 'iclip yok — spotlight oymuyor');
});

test('number_counter adımlı sayar (birden çok event)', () => {
  const ev = effectEvents({ type: 'number_counter', value: 30, suffix: '30+ gears', x: 0.5, y: 0.3, start: 0, end: 3 });
  assert.ok(ev.length >= 6, `sayaç adımı az: ${ev.length}`);
  assert.ok(ev.join('\n').includes('30'), 'hedef değer yok');
});

test('desteklenmeyen/clip-seviyesi tip → ASS event üretmez', () => {
  assert.equal(effectEvents({ type: 'zoom_to_region', start: 0, end: 2 }).length, 0);
  assert.equal(buildEffectsAss([]), '');
});

test('caption_emphasis safe-area: y=0.9 verilse bile bant dışına çekilir', () => {
  const ass = buildEffectsAss([{ type: 'label_pop', text: 'test', x: 0.5, y: 0.95, start: 0, end: 2 }]);
  // pos y değeri < 1440 (0.75*1920) olmalı (alt banda girmemeli)
  const m = ass.match(/\\pos\(\d+,(\d+)\)/);
  assert.ok(m && Number(m[1]) <= 1440, `etiket alt banda düştü: ${m && m[1]}`);
});

// ---- GERÇEK RENDER (ffmpeg) ----
test('efektler gerçek videoya bindirilir + katman görünür (SSIM farkı)', { skip: !hasFfmpeg && 'ffmpeg yok' }, async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 've-'));
  try {
    const base = path.join(dir, 'base.mp4');
    await run('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'color=c=0x123040:s=1080x1920:d=3:r=24',
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', base]);
    const assPath = path.join(dir, 'fx.ass');
    await writeFile(assPath, buildEffectsAss([
      { type: 'spotlight', x: 0.5, y: 0.35, start: 0, end: 3 },
      { type: 'highlight_circle', x: 0.5, y: 0.35, start: 0.3, end: 3 },
      { type: 'arrow_pointer', x: 0.5, y: 0.35, start: 0.4, end: 3 },
    ]));
    const out = path.join(dir, 'out.mp4');
    const esc = assPath.replace(/\\/g, '/').replace(/:/g, '\\:');
    await run('ffmpeg', ['-y', '-v', 'error', '-i', base, '-vf', `ass=${esc}:fontsdir=assets/fonts,format=yuv420p`,
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', out], { cwd: process.cwd(), maxBuffer: 20 * 1024 * 1024 });
    // Katman gerçekten var mı: orijinal vs efektli kare SSIM < 1.
    const { stderr } = await run('ffmpeg', ['-nostdin', '-ss', '1.5', '-i', base, '-ss', '1.5', '-i', out,
      '-frames:v', '1', '-filter_complex', '[0:v][1:v]ssim', '-f', 'null', '-'],
      { maxBuffer: 8 * 1024 * 1024 }).catch((e) => ({ stderr: e.stderr || '' }));
    const m = /All:\s*([\d.]+)/.exec(stderr || '');
    assert.ok(m, 'SSIM ölçülemedi');
    assert.ok(parseFloat(m[1]) < 0.999, `efekt katmanı görünmüyor (SSIM ${m[1]})`);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
