/**
 * 14 GÜNLÜK YAYIN SAATİ DENEYİ — us-audience-3-slots-v1
 *
 * Kanal ~%69 ABD izleyicili; gelir optimizasyonundan önce izlenme/abone/
 * algoritma verisi toplamak için günde 3 SABİT UTC slotu test edilir:
 *   15:00 / 20:00 / 02:00 UTC (TR yaz saati: 18:00 / 23:00 / 05:00).
 * Deney boyunca saatler DEĞİŞTİRİLMEZ; bu modül yalnızca tespit + etiket
 * üretir, hiçbir şeyi otomatik optimize etmez.
 *
 * 02:00 UTC koşusu takvimde ertesi güne düşer ama İÇERİK GÜNÜ olarak bir
 * önceki UTC gününün 3. slotudur (contentDate alanı bunu netleştirir).
 */

export const EXPERIMENT = {
  id: 'us-audience-3-slots-v1',
  timezone: 'UTC',
  slots: ['15:00', '20:00', '02:00'],
  experimentStartDate: '2026-07-19', // ilk tam 3-slot günü
  experimentDurationDays: 14,
  strategy: 'fixed-three-daily-slots',
  primaryAudience: 'US',
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** UTC YYYY-MM-DD. */
function utcDate(d) {
  return d.toISOString().slice(0, 10);
}

/** Deney bitene kadar 'active'; sonrasında 'completed' (otomatik saat değişimi YOK). */
export function experimentStatus(now = new Date()) {
  const start = new Date(`${EXPERIMENT.experimentStartDate}T00:00:00Z`);
  if (now < start) return 'pending';
  const end = new Date(start.getTime() + EXPERIMENT.experimentDurationDays * DAY_MS);
  return now < end ? 'active' : 'completed';
}

/**
 * Slot tespiti — deterministik:
 *  - Manuel run'da slot input ile açıkça seçilmediyse 'manual' (otomatik slot
 *    diye YANLIŞ etiketlenmez).
 *  - Cron (schedule) event'inde: en son geçen slot zamanı esas alınır —
 *    GitHub'ın dakikalar/onlarca dakika gecikmesi tolere edilir; slotlar
 *    5+ saat aralıklı olduğundan yanlış slota düşmek mümkün değildir.
 *
 * @param {Date} now
 * @param {{eventName?:string, manualSlot?:string}} opts
 * @returns {{slot:string, scheduledPublishAt:string|null, contentDate:string, experiment:object}}
 */
export function detectSlot(now = new Date(), {
  eventName = process.env.GITHUB_EVENT_NAME,
  manualSlot = process.env.SCHEDULE_SLOT,
} = {}) {
  const explicit = EXPERIMENT.slots.includes(manualSlot) ? manualSlot : null;
  const isCron = eventName === 'schedule';

  let slot = 'manual';
  let scheduledAt = null;
  if (explicit) {
    slot = explicit;
  } else if (isCron) {
    // En son geçen slot: her slotun bugünkü (veya dünkü) oluşumundan bu yana
    // geçen süreyi hesapla, en küçüğü kazanır (gecikme her zaman ileri yönde).
    let best = null;
    for (const s of EXPERIMENT.slots) {
      const [h, m] = s.split(':').map(Number);
      const at = new Date(now);
      at.setUTCHours(h, m, 0, 0);
      if (at > now) at.setTime(at.getTime() - DAY_MS); // bugünkü oluşum ileride → dünkü
      const elapsedMin = (now - at) / 60000;
      if (!best || elapsedMin < best.elapsedMin) best = { slot: s, at, elapsedMin };
    }
    slot = best.slot;
    scheduledAt = best.at;
  }

  if (slot !== 'manual' && !scheduledAt) {
    // Elle seçilmiş slot: planlanan zaman = o slotun en son geçen oluşumu.
    const [h, m] = slot.split(':').map(Number);
    scheduledAt = new Date(now);
    scheduledAt.setUTCHours(h, m, 0, 0);
    if (scheduledAt > now) scheduledAt.setTime(scheduledAt.getTime() - DAY_MS);
  }

  // İÇERİK GÜNÜ: 02:00 slotu bir önceki UTC gününün 3. slotu sayılır.
  const anchor = scheduledAt || now;
  const contentDate = slot === '02:00'
    ? utcDate(new Date(anchor.getTime() - DAY_MS))
    : utcDate(anchor);

  return {
    slot,
    scheduledPublishAt: scheduledAt ? scheduledAt.toISOString() : null,
    contentDate,
    experiment: {
      id: EXPERIMENT.id,
      timezone: EXPERIMENT.timezone,
      scheduledSlot: slot,
      contentDate,
      experimentStartDate: EXPERIMENT.experimentStartDate,
      experimentDurationDays: EXPERIMENT.experimentDurationDays,
      strategy: EXPERIMENT.strategy,
      primaryAudience: EXPERIMENT.primaryAudience,
      status: experimentStatus(now),
    },
  };
}
