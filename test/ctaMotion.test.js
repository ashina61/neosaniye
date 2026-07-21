import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { selectCta } from '../src/motion/ctaSelector.js';
import { computeSafeArea } from '../src/motion/ctaSafeArea.js';
import { validatePlan, verifyRendered, verifyOutput } from '../src/motion/ctaValidator.js';
import { buildCtaAss, TEMPLATE_IDS } from '../src/motion/ctaTemplates.js';
import { applyCta } from '../src/motion/ctaEngine.js';
import { config } from '../src/config.js';

const run = promisify(execFile);
const hasFfmpeg = await run('ffmpeg', ['-version']).then(() => true).catch(() => false);

function withMotion(over, fn) {
  const orig = JSON.parse(JSON.stringify({ motion: config.motion }));
  Object.assign(config.motion, over.motion || {});
  if (over.cta) Object.assign(config.motion.cta, over.cta);
  return (async () => {
    try { return await fn(); }
    finally { config.motion.enabled = orig.motion.enabled; Object.assign(config.motion.cta, orig.motion.cta); }
  })();
}

const CTA_CFG = { ...config.motion.cta };

// ---- SEÇİCİ ----
test('CTA disabled → skipped:disabled', () => {
  const r = selectCta({ seed: 'x', durationSec: 40 }, { ...CTA_CFG, enabled: false });
  assert.equal(r.applied, false);
  assert.equal(r.reason, 'disabled');
});

test('video kısa → skipped:video-too-short', () => {
  const r = selectCta({ seed: 'x', durationSec: 9.9 }, { ...CTA_CFG, mode: 'always', minVideoDurationSec: 20, alwaysMinVideoDurationSec: 10 });
  assert.equal(r.reason, 'video-too-short');
});

test('always modunda 13.8sn video için kompakt subscribe CTA uygulanır', () => {
  const cfg = {
    ...CTA_CFG, mode: 'always', allowedTypes: ['subscribe'], minVideoDurationSec: 20,
    alwaysMinVideoDurationSec: 10, earliestStartSec: 8, latestEndBufferSec: 2,
  };
  const r = selectCta({ seed: 'bee-short', durationSec: 13.8 }, cfg);
  assert.equal(r.applied, true);
  assert.equal(r.type, 'subscribe');
  assert.ok(r.durationSec >= 1.8 && r.durationSec <= 2.1);
  assert.ok(r.startSec + r.durationSec <= 11.8 + 0.01, 'CTA son 2 saniye bufferını ihlal etti');
  assert.ok(r.startSec >= 5, 'CTA hook içine girdi');
});

test('seed determinizmi: aynı seed → aynı seçim', () => {
  const cfg = { ...CTA_CFG, mode: 'always' };
  const a = selectCta({ seed: 'pigeons-1', durationSec: 38 }, cfg);
  const b = selectCta({ seed: 'pigeons-1', durationSec: 38 }, cfg);
  assert.deepEqual(a, b);
  const c = selectCta({ seed: 'different', durationSec: 38 }, cfg);
  // Farklı seed genelde farklı seçim (tip veya zaman).
  assert.ok(a.templateId !== c.templateId || a.startSec !== c.startSec);
});

test('timeline sınırları: başlangıç ≥ earliest, bitiş ≤ süre-buffer', () => {
  const cfg = { ...CTA_CFG, mode: 'always', earliestStartSec: 8, latestEndBufferSec: 2 };
  for (const seed of ['a', 'b', 'c', 'd', 'e']) {
    const r = selectCta({ seed, durationSec: 35 }, cfg);
    assert.ok(r.startSec >= 8, `başlangıç ${r.startSec} < 8`);
    assert.ok(r.startSec + r.durationSec <= 35 - 2 + 0.01);
    assert.ok(r.startSec >= 5); // ilk 5sn yasak
  }
});

test('outro çakışması: CTA outro\'ya taşarsa geri çekilir veya atlanır', () => {
  const cfg = { ...CTA_CFG, mode: 'always', earliestStartSec: 8 };
  const r = selectCta({ seed: 'outro-test', durationSec: 35, outroStartSec: 20 }, cfg);
  if (r.applied) assert.ok(r.startSec + r.durationSec <= 20 + 0.01, 'CTA outro içine girdi');
});

test('anti-tekrar: son kullanılan tip mümkünse tekrar seçilmez', () => {
  const cfg = { ...CTA_CFG, mode: 'always', allowedTypes: ['subscribe', 'like'] };
  const r = selectCta({ seed: 'z', durationSec: 35, recentCtaTypes: ['subscribe'] }, cfg);
  // Alternatif (like) varken subscribe tekrar edilmemeli — çoğu seed için.
  assert.ok(['subscribe', 'like'].includes(r.type));
});

test('video başına en fazla 1 CTA (selector tek plan döner)', () => {
  const r = selectCta({ seed: 'once', durationSec: 40 }, { ...CTA_CFG, mode: 'always' });
  assert.equal(typeof r.templateId, 'string');
  assert.ok(!Array.isArray(r.templateId));
});

// ---- GÜVENLİ ALAN ----
test('safe-area: varsayılan yerleşim altyazı/hook/ikon şeridiyle çakışmaz', () => {
  const box = computeSafeArea({ position: 'auto' });
  assert.ok(box, 'güvenli alan bulunamadı');
  assert.ok(box.y >= 470); // hook altında
  assert.ok(box.x + box.w <= 1080 - 140); // sağ ikon şeridine girmez
});

test('safe-area: altyazı bandı yüksekse (marginV küçük) o bölge korunur', () => {
  // Altyazı bandı üstte olacak şekilde marginV büyük → CTA alt-sol yine bulunur.
  const box = computeSafeArea({ position: 'lower_third_left', captionMarginV: 460 });
  assert.ok(box);
  const captionTop = 1920 - 460 - 170;
  // CTA kutusu altyazı bandını (captionTop..captionTop+170) kesmez.
  assert.ok(box.y + box.h <= captionTop || box.y >= captionTop + 170);
});

test('safe-area: yer yoksa null döner (CTA atlanır, kapatmaz)', () => {
  // Aşırı geniş kaçınma: kart genişliğini ekrandan büyük yap → hiçbir yere sığmaz.
  const box = computeSafeArea({ position: 'auto', cardW: 2000 });
  assert.equal(box, null);
});

// ---- VALİDATOR ----
test('validatePlan: ilk 5sn / sınır dışı / süre hatalarını yakalar', () => {
  const cfg = config.motion.cta;
  const sa = computeSafeArea({ position: 'auto' });
  const early = validatePlan({ applied: true, startSec: 3, durationSec: 2.2 }, { duration: 35, cfg, safeArea: sa });
  assert.ok(early.failures.includes('cta-in-first-5s'));
  const oob = validatePlan({ applied: true, startSec: 34, durationSec: 2.2 }, { duration: 35, cfg, safeArea: sa });
  assert.ok(oob.failures.includes('cta-out-of-bounds'));
  const good = validatePlan({ applied: true, startSec: 15, durationSec: 2.2 }, { duration: 35, cfg, safeArea: sa });
  assert.equal(good.ok, true);
  const noSa = validatePlan({ applied: true, startSec: 15, durationSec: 2.2 }, { duration: 35, cfg, safeArea: null });
  assert.ok(noSa.failures.includes('no-safe-area'));
});

// ---- ŞABLON ÜRETİMİ + DİL YERELLEŞTİRME ----
test('6 şablon geçerli ASS üretir (varsayılan İngilizce etiket + çizim)', () => {
  const box = computeSafeArea({ position: 'auto' });
  const types = { neo_subscribe_minimal: 'subscribe', neo_subscribe_pulse: 'subscribe', neo_like_pop: 'like', neo_bell_ring: 'bell', neo_comment_slide: 'comment', neo_follow_compact: 'follow' };
  for (const id of TEMPLATE_IDS) {
    const ass = buildCtaAss({ templateId: id, type: types[id], box, startSec: 10, durSec: 2.4, width: 1080, height: 1920 });
    assert.ok(ass.includes('[Events]'));
    assert.ok(ass.includes('Dialogue:'));
    assert.ok(/\\p1/.test(ass), 'vektör çizim yok');
  }
  // Varsayılan içerik dili İngilizce → LIKE (Türkçe BEĞEN DEĞİL). Bee hatası #1.
  const like = buildCtaAss({ templateId: 'neo_like_pop', type: 'like', box, startSec: 10, durSec: 2.4 });
  assert.ok(like.includes('LIKE'), 'İngilizce LIKE etiketi yok');
  assert.ok(!like.includes('BEĞEN'), 'İngilizce videoda Türkçe BEĞEN çıktı!');
  // Uzun İngilizce etiket ("TURN ON NOTIFICATIONS") kart genişleyince sığar.
  const bell = buildCtaAss({ templateId: 'neo_bell_ring', type: 'bell', box: { x: box.x, y: box.y, w: 640, h: 112 }, startSec: 10, durSec: 2.4 });
  assert.ok(bell.includes('TURN ON NOTIFICATIONS'));
});

test('dil=tr açıkça verilince Türkçe etiket üretilir', () => {
  const box = computeSafeArea({ position: 'auto' });
  const like = buildCtaAss({ templateId: 'neo_like_pop', type: 'like', box, startSec: 10, durSec: 2.4, language: 'tr' });
  assert.ok(like.includes('BEĞEN'), 'Türkçe içerikte BEĞEN yok');
});

// ---- ENGINE (fail-safe) ----
test('engine: motion kapalı → orijinal video korunur, ctaApplied:false', async () => {
  await withMotion({ motion: { enabled: false } }, async () => {
    const res = await applyCta({ videoPath: '/x/orig.mp4', workDir: '/tmp', duration: 40, seed: 's' });
    assert.equal(res.videoPath, '/x/orig.mp4');
    assert.equal(res.report.ctaApplied, false);
    assert.equal(res.report.selectionReason, 'disabled');
  });
});

test('engine: probability-skip → orijinal korunur', async () => {
  await withMotion({ cta: { mode: 'editorial', probability: 0 } }, async () => {
    const res = await applyCta({ videoPath: '/x/orig.mp4', workDir: '/tmp', duration: 40, seed: 's' });
    assert.equal(res.videoPath, '/x/orig.mp4');
    assert.equal(res.report.ctaApplied, false);
    assert.equal(res.report.selectionReason, 'probability-skip');
  });
});

// ---- GERÇEK RENDER (ffmpeg gerekir) ----
test('engine: gerçek videoya CTA uygulanır, katman doğrulanır, rapor alanları dolar', { skip: !hasFfmpeg && 'ffmpeg yok' }, async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'cta-e2e-'));
  try {
    const bg = path.join(dir, 'bg.mp4');
    await run('ffmpeg', ['-nostdin', '-y', '-v', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=1080x1920:rate=30:duration=32',
      '-f', 'lavfi', '-i', 'sine=frequency=220:duration=32', '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', bg]);
    await withMotion({ motion: { enabled: true }, cta: { mode: 'always', enabled: true } }, async () => {
      const res = await applyCta({ videoPath: bg, workDir: dir, duration: 32, seed: 'e2e-1' });
      assert.equal(res.report.ctaApplied, true);
      assert.ok(res.videoPath !== bg, 'CTA\'lı yeni yol dönmedi');
      assert.ok(existsSync(res.videoPath));
      // İstenen rapor alanları.
      for (const k of ['enabled', 'ctaApplied', 'ctaId', 'ctaType', 'startSec', 'durationSec', 'position', 'selectionReason', 'safeAreaPassed']) {
        assert.ok(k in res.report, `rapor alanı eksik: ${k}`);
      }
      assert.equal(res.report.safeAreaPassed, true);
      assert.ok(await verifyOutput(res.videoPath));
      // Katman gerçekten var mı (SSIM farkı).
      const vr = await verifyRendered(bg, res.videoPath, res.report.startSec + res.report.durationSec / 2);
      assert.equal(vr.applied, true);
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('engine: determinizm — aynı seed aynı CTA seçimi (gerçek render)', { skip: !hasFfmpeg && 'ffmpeg yok' }, async () => {
  await withMotion({ motion: { enabled: true }, cta: { mode: 'always', enabled: true } }, async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'cta-det-'));
    try {
      const bg = path.join(dir, 'bg.mp4');
      await run('ffmpeg', ['-nostdin', '-y', '-v', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=1080x1920:rate=30:duration=30',
        '-f', 'lavfi', '-i', 'sine=frequency=220:duration=30', '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', bg]);
      const a = await applyCta({ videoPath: bg, workDir: path.join(dir, 'a'), duration: 30, seed: 'same' });
      const b = await applyCta({ videoPath: bg, workDir: path.join(dir, 'b'), duration: 30, seed: 'same' });
      assert.equal(a.report.ctaId, b.report.ctaId);
      assert.equal(a.report.startSec, b.report.startSec);
      assert.equal(a.report.ctaType, b.report.ctaType);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

test('engine: SFX asseti yoksa CTA yine uygulanır (graceful, video-only)', { skip: !hasFfmpeg && 'ffmpeg yok' }, async () => {
  await withMotion({ motion: { enabled: true }, cta: { mode: 'always', enabled: true, sfx: true, assetsDir: '/nonexistent/motion' } }, async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'cta-nosfx-'));
    try {
      const bg = path.join(dir, 'bg.mp4');
      await run('ffmpeg', ['-nostdin', '-y', '-v', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=1080x1920:rate=30:duration=30',
        '-f', 'lavfi', '-i', 'sine=frequency=220:duration=30', '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', bg]);
      const res = await applyCta({ videoPath: bg, workDir: dir, duration: 30, seed: 'nosfx' });
      assert.equal(res.report.ctaApplied, true);
      assert.equal(res.report.sfxId, null); // SFX bulunamadı ama CTA uygulandı
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
