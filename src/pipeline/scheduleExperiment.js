/**
 * ABD-İZLEYİCİ YAYIN SAATİ DENEYİ — us-audience-3-slots-v2
 *
 * Kanal ~%69 ABD izleyicili; gelir optimizasyonundan önce izlenme/abone/
 * algoritma verisi toplamak için günde 3 SABİT UTC slotu test edilir. Slotlar
 * ABD Doğu saatine göre SABAH / ÖĞLEDEN SONRA / AKŞAM pencerelerine denk gelir:
 *   13:00 / 18:00 / 23:00 UTC.
 *   - 13:00 UTC → ET 08:00 (EST) / 09:00 (EDT)  → SABAH
 *   - 18:00 UTC → ET 13:00 (EST) / 14:00 (EDT)  → ÖĞLEDEN SONRA
 *   - 23:00 UTC → ET 18:00 (EST) / 19:00 (EDT)  → AKŞAM
 * GitHub cron yalnızca UTC'dir (yaz/kış otomatik geçiş yok); slotlar hem EST
 * hem EDT altında iyi ET pencerelerine düşecek şekilde seçildi. Üç slot da AYNI
 * UTC gününde kaldığından eski 02:00 slotunun "ertesi güne taşma" karmaşası yok.
 *
 * Deney boyunca saatler DEĞİŞTİRİLMEZ; bu modül yalnızca tespit + etiket
 * üretir, hiçbir şeyi otomatik optimize etmez.
 */

export const EXPERIMENT = {
  id: 'us-audience-3-slots-v2',
  timezone: 'UTC',
  slots: ['13:00', '18:00', '23:00'],
  experimentStartDate: '2026-07-22', // yeni ABD-optimize slotların ilk tam günü
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

  // İÇERİK GÜNÜ: mevcut slotların üçü de aynı UTC gününde (13:00/18:00/23:00),
  // bu yüzden içerik günü = slotun UTC tarihi. Genel kural (ileride bir slot UTC
  // gece yarısından önceye, saat < 06:00'a alınırsa): erken sabah UTC slotu bir
  // önceki UTC içerik gününün son slotu sayılır.
  const anchor = scheduledAt || now;
  const slotHour = slot !== 'manual' ? Number(slot.split(':')[0]) : null;
  const contentDate = slotHour !== null && slotHour < 6
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
