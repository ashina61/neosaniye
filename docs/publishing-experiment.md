# 14-Day US Audience Publishing Experiment (us-audience-3-slots-v1)

Kanal ~%69 ABD izleyicili. Bu deney, gelir optimizasyonundan önce izlenme,
abone ve algoritma verisi toplamak için yayın saatlerini 14 gün boyunca
SABİT üç UTC slotuna kilitler.

| Alan | Değer |
|---|---|
| Başlangıç | **2026-07-19** (UTC, ilk tam 3-slot günü) |
| Süre | 14 gün (bitiş: 2026-08-02 UTC) |
| Slotlar (UTC) | **15:00 · 20:00 · 02:00** |
| Türkiye karşılığı (yaz, UTC+3) | 18:00 · 23:00 · 05:00 |
| Strateji | fixed-three-daily-slots — deney boyunca saat DEĞİŞTİRİLMEZ |

## Uygulama notları

- Cron'lar `.github/workflows/daily-short.yml` içinde tek workflow'ta:
  `2 15 * * *`, `2 20 * * *`, `2 2 * * *`. Dakika **+2 offset** bilinçlidir:
  GitHub tam saat (XX:00) tick'lerini bu kanalda iki kez yuttu; slot kimliği
  yine 15:00/20:00/02:00 olarak kaydedilir.
- **02:00 UTC koşusu takvimde ertesi güne düşer** ama içerik günü olarak bir
  önceki UTC gününün 3. slotudur — kayıtlarda `contentDate` alanı bunu taşır
  (`src/pipeline/scheduleExperiment.js`).
- Slot tespiti deterministiktir: cron event'inde "en son geçen slot" esas
  alınır (slotlar 5+ saat aralıklı olduğundan gecikme yanlış slota düşüremez).
  Manuel run'lar `manual` etiketlenir veya workflow input'undan slot seçilir.
- Saatleri otomatik optimize eden hiçbir mekanizma yoktur; sistem yalnızca
  veri toplar (`scheduleExperiment` metadata + `data/qc-history.jsonl`).
- YouTube Analytics API bağlanana kadar izlenme metrikleri **null** kalır —
  sahte veri üretilmez (`src/analytics/experimentMetrics.js` adaptörü hazır).

## Test sonunda karşılaştırılacak metrikler (slot başına)

- Medyan ilk 24 saat görüntüleme
- Medyan average percentage viewed
- Viewed vs swiped away oranı
- 1.000 görüntüleme başına abone
- 1.000 görüntüleme başına etkileşim (beğeni+yorum)
- QC skoruna göre normalize edilmiş izlenme
- Konu ve format etkisi (slotlara dağılan formatlar ayrıca incelenir)

**Karar kuralı:** Başarı YALNIZCA görüntüleme sayısına göre İLAN EDİLMEZ.
Medyan kullanılır; slot başına en az 7 örnek yoksa `insufficient-sample`
işaretlenir ve kazanan seçilmez. Tek viral video bir slotu kazanan yapmaz.
Rapor üretici: `buildSlotComparisonReport()` (deney sonunda elle çağrılır;
otomatik saat değiştirme YOKTUR).
