import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync } from 'node:fs';

const run = promisify(execFile);
const BUF = { maxBuffer: 12 * 1024 * 1024 };

/**
 * RENDER SONRASI GERÇEK ÇIKTI DOĞRULAMASI.
 *
 * Kaynak gerçek: FINAL MP4 — metadata veya editPlan değil. Bir SFX'in "adı
 * planda geçiyor" diye uygulandığı SAYILMAZ; ses gerçekten miks edildi mi,
 * duyulur mu, çıktının kendisinden ÖLÇÜLÜR (cue öncesi vs cue anı enerji farkı).
 *
 * Hata kodları (upload'u SERT engeller — warning-mod override BUNU AŞAMAZ):
 *   SFX_ASSET_MISSING              cue için asset yok/çözülemedi
 *   SFX_NOT_MIXED                  asset var ama filtre grafiğine hiç girmemiş
 *   SFX_INAUDIBLE                  miks edilmiş ama cue anında duyulur enerji yok
 *   SFX_REPETITION_EXCESSIVE       aynı SFX video boyunca aşırı tekrar
 *   SFX_OUTPUT_VERIFICATION_FAILED ffprobe/ffmpeg ölçümü yapılamadı (fail-closed)
 */

// Duyulabilirlik eşiği: cue anındaki tepe (max) enerji, hemen önceki tabana
// göre en az bu kadar dB yükselmeli. Geçici (transient) vuruş için makul alt sınır.
export const SFX_AUDIBLE_MIN_DELTA_DB = 3.0;
// A generic floor is insufficient for payoff cues: they must be distinguishable
// in the final AAC, not merely present in the graph.
export const SFX_AUDIBLE_MIN_DELTA_BY_TYPE = {
  impact: 5.0,
  shimmer: 4.0,
  whoosh: 4.0,
  confirmation: 5.0,
};
// Tek SFX'in bir videoda azami tekrarı (aşılırsa REPETITION_EXCESSIVE).
export const SFX_MAX_REPEAT_PER_VIDEO = 4;
// Near-silent asset eşiği: WAV'ın tepe seviyesi bunun altındaysa "sessiz" sayılır.
export const NEAR_SILENT_MAX_DB = -50;
const WIN = 0.30;        // near-silent asset ölçüm penceresi
// Cue enerjisi anlık değildir: riser ~0.9s tırmanır, shimmer kuyruğu ~0.5s. Cue
// öncesi taban kısa (0.30s) ölçülür; cue "sırası" SFX enerji süresini kapsayacak
// kadar geniş (0.55s) — eşik yine 3 dB, yalnız pencere adil.
const BEFORE_WIN = 0.30;
const DURING_WIN = 0.55;

/** Bir ses segmentinin {meanDb, maxDb} değerlerini ölçer (volumedetect). */
export async function measureSegmentDb(file, startSec, durSec = WIN, audioFilter = 'volumedetect') {
  const ss = Math.max(0, startSec).toFixed(3);
  // NOT: '-v error' volumedetect'in info seviyesindeki istatistiklerini gizler;
  // '-hide_banner' kullan ki mean/max_volume satırları stderr'e düşsün.
  const { stderr } = await run('ffmpeg', [
    '-nostdin', '-hide_banner',
    '-ss', ss, '-t', Math.max(0.05, durSec).toFixed(3), '-i', file,
    '-vn', '-af', audioFilter, '-f', 'null', '-',
  ], BUF).catch((e) => ({ stderr: e.stderr || '' }));
  const mean = /mean_volume:\s*(-?[\d.]+)\s*dB/.exec(stderr || '');
  const max = /max_volume:\s*(-?[\d.]+)\s*dB/.exec(stderr || '');
  return {
    meanDb: mean ? parseFloat(mean[1]) : null,
    maxDb: max ? parseFloat(max[1]) : null,
  };
}

async function measureCueDelta(file, at, requested, durationSec) {
  // The confirmation is a deliberately narrow two-tone cue. Full-band peak
  // comparison measures whichever narration syllable is loudest instead of the
  // cue; inspect the cue's own 500–1200 Hz band in both windows.
  const cueType = String(requested || '').replace(/^cta:/, '');
  const isConfirmation = cueType === 'confirmation';
  // Whoosh is synthesized as a 850 Hz / 700 Hz-wide band-pass sweep.  Its
  // full-band peak is commonly a narration consonant, which can make equal
  // before/during programme peaks look like a 0 dB SFX result.  Measure the
  // cue's own occupied band, exactly as confirmation already does.
  const isWhoosh = cueType === 'whoosh';
  const filter = (isConfirmation || isWhoosh) ? 'bandpass=f=850:w=700,volumedetect' : 'volumedetect';
  if (String(requested || '') !== 'riser') {
    const before = await measureSegmentDb(file, Math.max(0, at - BEFORE_WIN - 0.05), BEFORE_WIN, filter);
    const during = await measureSegmentDb(file, at - 0.05, DURING_WIN, filter);
    return { delta: before.maxDb === null || during.maxDb === null ? null : +(during.maxDb - before.maxDb).toFixed(2) };
  }

  // A riser is a 0.9s envelope, not a transient.  Require two adjacent later
  // windows to rise above their local pre-cue bed; inspecting only its attack
  // creates a false negative even when the reveal is audible.
  const before = await measureSegmentDb(file, Math.max(0, at - BEFORE_WIN - 0.05), BEFORE_WIN);
  if (before.maxDb === null) return { delta: null };
  const windows = [0.25, 0.5, Math.max(0.55, (durationSec || 0.9) - 0.25)];
  const deltas = [];
  for (const offset of windows) {
    const segment = await measureSegmentDb(file, at + offset, 0.22);
    if (segment.maxDb !== null) deltas.push(+(segment.maxDb - before.maxDb).toFixed(2));
  }
  const audible = deltas.filter((delta) => delta > 0);
  return { delta: deltas.length ? Math.max(...deltas) : null, riserDeltas: deltas, riserAudible: audible.length >= 2 };
}

/** Bir WAV asset'i near-silent mı (üretim hatası/boş sentez)? */
export async function isNearSilentAsset(file) {
  if (!file || !existsSync(file)) return { silent: true, maxDb: null, reason: 'missing' };
  const { maxDb } = await measureSegmentDb(file, 0, 3).catch(() => ({ maxDb: null }));
  if (maxDb === null) return { silent: false, maxDb: null, reason: 'unmeasured' }; // ölçülemedi → engelleme
  return { silent: maxDb < NEAR_SILENT_MAX_DB, maxDb, reason: maxDb < NEAR_SILENT_MAX_DB ? 'near-silent' : 'ok' };
}

/**
 * FINAL MP4'ten SFX cue'larını doğrular. Her cue için cue-öncesi taban ile cue
 * anındaki tepe enerjiyi ölçer; fark eşiği aşmıyorsa SFX_INAUDIBLE.
 *
 * @param {string} outputPath  final MP4 (gerçek çıktı)
 * @param {Array<{atSeconds:number, sfxId?:string, requested?:string, assetPath?:string|null, mixedInGraph?:boolean}>} cues
 * @returns {Promise<{ok:boolean, cues:object[], failures:string[], repetition:object}>}
 */
export async function verifySfxInOutput(outputPath, cues = []) {
  const failures = new Set();
  const out = [];
  if (!outputPath || !existsSync(outputPath)) {
    return { ok: false, cues: [], failures: ['SFX_OUTPUT_VERIFICATION_FAILED'], repetition: {} };
  }

  // Tekrar sayımı (aynı SFX kimliği kaç cue'da).
  const repeatCount = {};
  for (const c of cues) {
    const id = c.sfxId || c.requested || 'unknown';
    repeatCount[id] = (repeatCount[id] || 0) + 1;
  }
  const excessive = Object.entries(repeatCount).filter(([, n]) => n > SFX_MAX_REPEAT_PER_VIDEO);
  if (excessive.length) failures.add('SFX_REPETITION_EXCESSIVE');

  for (const c of cues) {
    const at = Number(c.atSeconds);
    const requested = c.sfxId || c.requested || null;
    // Asset ve miks durumu render ANINDA renderer tarafından bildirilir (temp
    // WAV'lar render sonrası silinir; burada yeniden stat edilmez). editPlan'dan
    // gelen "yalnızca isim" cue'larında bu bayraklar yok → miks edilmemiş sayılır.
    const assetResolved = c.assetResolved === true || Boolean(c.assetPath && existsSync(c.assetPath));
    const mixed = c.mixedInGraph === true && assetResolved; // grafikte gerçekten var mı

    const rec = {
      atSeconds: Number.isFinite(at) ? +at.toFixed(2) : null,
      requested,
      assetResolved,
      mixed,
      audibleDeltaDb: null,
      verified: false,
      code: null,
    };

    if (!assetResolved) {
      rec.code = 'SFX_ASSET_MISSING';
      failures.add('SFX_ASSET_MISSING');
      out.push(rec);
      continue;
    }
    if (!mixed) {
      rec.code = 'SFX_NOT_MIXED';
      failures.add('SFX_NOT_MIXED');
      out.push(rec);
      continue;
    }
    if (!Number.isFinite(at)) { out.push(rec); continue; }

    // Cue öncesi taban (biten pencere) vs cue "sırası" tepe (SFX enerji süresini
    // kapsar) — GERÇEK çıktıdan. Pencere adil; eşik (3 dB) değişmedi.
    const measured = await measureCueDelta(outputPath, at, requested, c.durationSec).catch(() => ({ delta: null }));
    if (measured.delta === null) {
      rec.code = 'SFX_OUTPUT_VERIFICATION_FAILED';
      failures.add('SFX_OUTPUT_VERIFICATION_FAILED');
      out.push(rec);
      continue;
    }
    rec.audibleDeltaDb = measured.delta;
    if (measured.riserDeltas) rec.riserDeltas = measured.riserDeltas;
    const cueType = String(requested || '').replace(/^cta:/, '');
    rec.minAudibleDeltaDb = SFX_AUDIBLE_MIN_DELTA_BY_TYPE[cueType] || SFX_AUDIBLE_MIN_DELTA_DB;
    rec.verified = rec.audibleDeltaDb >= rec.minAudibleDeltaDb && (requested !== 'riser' || measured.riserAudible);
    if (!rec.verified) { rec.code = 'SFX_INAUDIBLE'; failures.add('SFX_INAUDIBLE'); }
    out.push(rec);
  }

  return {
    ok: failures.size === 0,
    cues: out,
    failures: [...failures],
    repetition: { counts: repeatCount, excessive: excessive.map(([id, n]) => ({ sfxId: id, count: n })) },
  };
}

/**
 * CTA çıktı doğrulaması — yerleşim gerçeği + katman varlığı + dil.
 * bbox deterministik çizim kutusudur (gerçekten oraya çizildi); kenar payı,
 * altyazı/UI çakışması ve dil eşleşmesi kontrol edilir.
 *
 * @param {object} o { box:{x,y,w,h}, width, height, layerPresent, resolvedLanguage,
 *   requestedLanguage, label, avoidZones:[{name,x,y,w,h}], safeMarginPx }
 * @returns {{ok:boolean, failures:string[], report:object}}
 */
export function verifyCtaOutput(o = {}) {
  const failures = [];
  const width = o.width || 1080;
  const height = o.height || 1920;
  const margin = o.safeMarginPx ?? 40;
  const box = o.box || null;
  const report = {
    bbox: box ? { x: box.x, y: box.y, w: box.w, h: box.h } : null,
    edgeMargins: null,
    withinSafeMargin: null,
    captionOverlap: null,
    uiOverlap: null,
    layerPresent: o.layerPresent !== false,
    resolvedLanguage: o.resolvedLanguage || null,
    requestedLanguage: o.requestedLanguage || null,
    languageMatch: null,
    label: o.label || null,
  };

  // Dil eşleşmesi (İngilizce içerikte Türkçe CTA = SERT engel).
  if (o.requestedLanguage) {
    report.languageMatch = o.resolvedLanguage === o.requestedLanguage;
    if (!report.languageMatch) failures.push('CTA_LANGUAGE_MISMATCH');
  }

  if (o.layerPresent === false) failures.push('CTA_LAYER_NOT_PRESENT');

  if (box) {
    const left = box.x;
    const right = width - (box.x + box.w);
    const top = box.y;
    const bottom = height - (box.y + box.h);
    report.edgeMargins = { left, right, top, bottom };
    report.withinSafeMargin = left >= margin && right >= margin && top >= margin && bottom >= margin;
    if (!report.withinSafeMargin) failures.push('CTA_OUTSIDE_SAFE_MARGIN');

    const zones = o.avoidZones || [];
    const cap = zones.find((z) => /caption|altyaz/i.test(z.name));
    const ui = zones.filter((z) => /ui|icon|strip|right|bottom|şerit/i.test(z.name));
    report.captionOverlap = cap ? intersects(box, cap) : false;
    report.uiOverlap = ui.some((z) => intersects(box, z));
    if (report.captionOverlap) failures.push('CTA_CAPTION_OVERLAP');
    if (report.uiOverlap) failures.push('CTA_UI_OVERLAP');
  }

  return { ok: failures.length === 0, failures, report };
}

function intersects(a, b) {
  return !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);
}
