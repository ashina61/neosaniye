# ABD İzleyici Yayın Saati Deneyi (us-audience-3-slots-v2)

Kanal ~%69 ABD izleyicili. Bu deney, gelir optimizasyonundan önce izlenme,
abone ve algoritma verisi toplamak için yayın saatlerini 14 gün boyunca
SABİT üç UTC slotuna kilitler. **v2 revizyonu:** slotlar ABD Doğu (ET) saatine
göre SABAH / ÖĞLEDEN SONRA / AKŞAM pencerelerine taşındı ve üçü de AYNI UTC
gününe alındı (eski 02:00 slotunun "ertesi güne taşma" karmaşası kaldırıldı).

| Alan | Değer |
|---|---|
| Başlangıç | **2026-07-22** (UTC, yeni slotların ilk tam günü) |
| Süre | 14 gün (bitiş: 2026-08-05 UTC) |
| Slotlar (UTC) | **13:00 · 18:00 · 23:00** |
| ABD Doğu (ET) karşılığı | 08:00/09:00 · 13:00/14:00 · 18:00/19:00 (EST/EDT) → SABAH · ÖĞLEDEN SONRA · AKŞAM |
| ABD Pasifik (PT) karşılığı | 05:00/06:00 · 10:00/11:00 · 15:00/16:00 (PST/PDT) |
| Türkiye karşılığı (yaz, UTC+3) | 16:00 · 21:00 · 02:00 (ertesi gün) |
| Strateji | fixed-three-daily-slots — deney boyunca saat DEĞİŞTİRİLMEZ |

**Neden bu saatler?** GitHub cron yalnızca UTC kabul eder ve yaz/kış (DST)
geçişini otomatik yapmaz. Slotlar hem EST (kış, UTC-5) hem EDT (yaz, UTC-4)
altında iyi ET pencerelerine (sabah/öğleden sonra/akşam) düşecek şekilde seçildi;
böylece yıl boyunca saat elle değiştirilmeden ABD izleyicisine denk gelir.

## Uygulama notları

- Cron'lar `.github/workflows/daily-short.yml` içinde tek workflow'ta:
  `2 13 * * *`, `2 18 * * *`, `2 23 * * *`. Dakika **+2 offset** bilinçlidir:
  GitHub tam saat (XX:00) tick'lerini bu kanalda iki kez yuttu; slot kimliği
  yine 13:00/18:00/23:00 olarak kaydedilir.
- **Üç slot da aynı UTC gününde** olduğundan `contentDate` = slotun UTC tarihi;
  eski 02:00 taşma özel durumu kalktı. (`src/pipeline/scheduleExperiment.js`
  yine de ileride saat < 06:00 bir slot eklenirse genel bir "önceki içerik günü"
  kuralı taşır.)
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
