import { appendFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * QC GEÇMİŞİ — gözlem katmanı (append-only).
 *
 * Her üretimden sonra production-report.json'un analiz için gereken özeti
 * data/qc-history.jsonl dosyasına TEK SATIR olarak eklenir (JSON Lines).
 * Amaç: skor ↔ gerçek izlenme bağını kurmadan önce veri biriktirmek.
 *
 * Kurallar:
 *  - Önceki kayıtlar asla silinmez/yeniden yazılmaz (yalnızca append).
 *  - Aynı videoId ikinci kez eklenmez.
 *  - Yazma tek write çağrısıdır (satır bütünlüğü bozulmaz).
 *  - Hata durumunda ASLA throw edilmez: {ok:false, error} döner ve açıkça
 *    loglanır — geçmiş kaydı başarısız diye yayın akışı bozulmaz.
 *  - Secret/kişisel veri içermez (yalnızca skor/karar/uyarı alanları).
 */

const DEFAULT_FILE = () => path.join(process.env.STATE_DIR || 'data', 'qc-history.jsonl');

/** production-report + üretim bağlamından geçmiş satırını kurar (saf).
 *  scheduleExperiment alanları opsiyoneldir — eski kayıtlar bu alanlar
 *  olmadan geçerli kalır (geriye dönük uyumlu, yalnızca ekleme). */
export function buildQcHistoryEntry(report, {
  videoId, topic, format, durationSeconds,
  scheduleExperimentId, scheduledSlot, scheduledPublishAt, actualPublishAt,
} = {}) {
  const s = report.scores || {};
  return {
    videoId: videoId ?? null,
    scheduleExperimentId: scheduleExperimentId ?? null,
    scheduledSlot: scheduledSlot ?? null,
    scheduledPublishAt: scheduledPublishAt ?? null,
    actualPublishAt: actualPublishAt ?? null,
    createdAt: report.createdAt ?? new Date().toISOString(),
    topic: topic ?? null,
    format: format ?? null,
    durationSeconds: report.metrics?.durationSeconds ?? durationSeconds ?? null,
    retentionScore: report.retentionScore ?? null,
    hookScore: s.hook ?? null,
    visualPacingScore: s.visualPacing ?? null,
    curiosityScore: s.curiosity ?? null,
    captionScore: s.captions ?? null,
    visualVarietyScore: s.visualVariety ?? null,
    audioDesignScore: s.audioDesign ?? null,
    payoffAndLoopScore: s.payoffAndLoop ?? null,
    patternInterrupts: report.metrics?.patternInterrupts ?? null,
    overallRetentionRisk: report.editorCritique?.overallRetentionRisk ?? null,
    belowQualityTarget: report.belowQualityTarget ?? null,
    ctaApplied: report.motion?.ctaApplied ?? null,
    ctaType: report.motion?.ctaType ?? null,
    technicalReady: report.technicalReady ?? null,
    editorialReady: report.editorialReady ?? null,
    productionReady: report.productionReady ?? null,
    qcMode: report.qcMode ?? report.mode ?? null,
    policyOverride: report.uploadEligibility?.policyOverride ?? null,
    uploadEligibility: report.uploadEligibility ?? null,
    warnings: report.warnings ?? [],
    failures: report.failures ?? [],
  };
}

/**
 * Satırı geçmiş dosyasına ekler.
 * @returns {Promise<{ok:boolean, appended:boolean, reason?:string, error?:string}>}
 */
export async function appendQcHistory(entry, { file = DEFAULT_FILE() } = {}) {
  try {
    // Mevcut kayıtları tarayıp videoId tekrarını engelle. Bozuk satırlar
    // atlanır ama DOKUNULMAZ — dosya asla yeniden yazılmaz.
    let existing = '';
    try {
      existing = await readFile(file, 'utf8');
    } catch (err) {
      if (err.code !== 'ENOENT') throw err; // dosya yoksa ilk kayıt; başka hata gerçek hatadır
    }
    if (entry.videoId) {
      for (const line of existing.split('\n')) {
        if (!line.trim()) continue;
        try {
          if (JSON.parse(line).videoId === entry.videoId) {
            return { ok: true, appended: false, reason: `videoId zaten kayıtlı (${entry.videoId})` };
          }
        } catch {
          // bozuk satır: dedup taramasında atla, dosyada olduğu gibi bırak
        }
      }
    }
    await mkdir(path.dirname(file), { recursive: true });
    // Tek satır + tek write: append modunda satır bütünlüğü korunur.
    const line = JSON.stringify(entry) + '\n';
    await appendFile(file, line, 'utf8');
    return { ok: true, appended: true };
  } catch (err) {
    // Sessiz yutma yok — ama gözlem kaydı yayın akışını asla çökertmez.
    console.error(`[qc-history] KAYIT BAŞARISIZ (${file}): ${err.message}`);
    return { ok: false, appended: false, error: err.message };
  }
}
