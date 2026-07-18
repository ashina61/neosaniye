/**
 * DENEY METRİK ADAPTÖRÜ — us-audience-3-slots-v1
 *
 * YouTube Analytics API henüz bağlı DEĞİL (kullanıcı OAuth kapsamını
 * yenilemedi). Bu modül:
 *  - SAHTE VERİ ÜRETMEZ — mevcut olmayan her metrik null'dur.
 *  - API bağlandığında yalnızca collectSlotMetrics içinin doldurulması
 *    yeterli olacak temiz bir arayüz tanımlar; akışın geri kalanı değişmez.
 */

/** Bir videonun deney metrik iskeleti. API yoksa alanlar null kalır. */
export function emptySlotMetrics() {
  return {
    views1h: null,
    views6h: null,
    views24h: null,
    likes24h: null,
    comments24h: null,
    subscribersGained: null,
    averageViewDurationSeconds: null,
    averagePercentageViewed: null,
    viewedVsSwipedAwayRatio: null,
    collectedAt: null,
    source: null, // 'youtube-analytics' olduğunda gerçek veridir
  };
}

/**
 * Veri toplama arayüzü. YouTube Analytics bağlandığında burası
 * yt-analytics.readonly ile doldurulur; şimdilik dürüstçe boş döner.
 * @param {string} videoId YouTube video ID
 * @returns {Promise<object>} emptySlotMetrics şeması
 */
export async function collectSlotMetrics(videoId) { // eslint-disable-line no-unused-vars
  return emptySlotMetrics();
}

const median = (nums) => {
  const v = nums.filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (!v.length) return null;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : +((v[mid - 1] + v[mid]) / 2).toFixed(2);
};

/**
 * DENEY SONU KARŞILAŞTIRMA RAPORU (saf; kayıt listesi üzerinde çalışır).
 * Tek viral videoya göre kazanan İLAN ETMEZ: medyan + örnek sayısı raporlar,
 * sampleCount < minSample olan slotlar 'insufficient-sample' işaretlenir.
 *
 * @param {Array} records - {scheduledSlot, metrics:{views24h,...}, retentionScore, hookScore, format, topic}
 * @param {{minSample?:number}} opts
 */
export function buildSlotComparisonReport(records, { minSample = 7 } = {}) {
  const bySlot = {};
  for (const r of records || []) {
    const slot = r.scheduledSlot;
    if (!slot || slot === 'manual') continue; // manuel run'lar deneyi kirletmez
    (bySlot[slot] ||= []).push(r);
  }
  const slots = {};
  for (const [slot, rows] of Object.entries(bySlot)) {
    const m = (f) => rows.map((r) => r.metrics?.[f]).filter((x) => Number.isFinite(x));
    const views24 = m('views24h');
    const subs = rows
      .filter((r) => Number.isFinite(r.metrics?.subscribersGained) && r.metrics?.views24h > 0)
      .map((r) => (r.metrics.subscribersGained / r.metrics.views24h) * 1000);
    const engagement = rows
      .filter((r) => Number.isFinite(r.metrics?.likes24h) && r.metrics?.views24h > 0)
      .map((r) => ((r.metrics.likes24h + (r.metrics.comments24h || 0)) / r.metrics.views24h) * 1000);
    // QC skoruna göre normalize: izlenme / (skor/100) — kalite farkını dengeler.
    const normalized = rows
      .filter((r) => Number.isFinite(r.metrics?.views24h) && Number.isFinite(r.retentionScore) && r.retentionScore > 0)
      .map((r) => r.metrics.views24h / (r.retentionScore / 100));
    slots[slot] = {
      sampleCount: rows.length,
      sufficientSample: rows.length >= minSample,
      medianViews24h: median(views24),
      medianAvgPercentageViewed: median(m('averagePercentageViewed')),
      medianViewedVsSwipedAway: median(m('viewedVsSwipedAwayRatio')),
      medianSubsPer1000Views: median(subs),
      medianEngagementPer1000Views: median(engagement),
      medianQcNormalizedViews24h: median(normalized),
      formats: [...new Set(rows.map((r) => r.format).filter(Boolean))],
      note: rows.length < minSample ? 'insufficient-sample — kazanan ilan edilemez' : null,
    };
  }
  return {
    experimentId: 'us-audience-3-slots-v1',
    generatedAt: new Date().toISOString(),
    minSample,
    slots,
    verdictPolicy: 'medyan + yeterli örnek; tek viral video kazanan yapmaz; konu/format etkisi formats alanından ayrıca incelenir',
  };
}
