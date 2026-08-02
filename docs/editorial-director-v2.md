# Editorial Director V2 — "İnsan gibi edit yapan sistem"

Amaç değişti: video üreten yazılım değil, **retention'ı tek metrik alan bir
Shorts editörü** gibi düşünen sistem. Her karar "YouTube'da bunu insanlar sonuna
kadar izler mi?" sorusuna göre. Tüm sinyaller deterministik (LLM tahmini yok);
üretici tarafta (script/DP/kurgu) promptlar bu editör zihniyetine çekildi.

## Yeni deterministik katmanlar

| Katman | Modül | Ne yapar |
|---|---|---|
| **Sahne Yönetmeni** | `pipeline/sceneDirector.js` | Her plan için amaç (Question/Mystery/Evidence/Reveal/Twist/Answer/Payoff), hedef duygu, görsel hedef, pattern interrupt, kamera hareketi, **retention riski** (low/med/high). |
| **İnsan gözü simülasyonu** | `editorCritique.attentionForecast` | Plan başına: sıkılma riski, **kaydırma riski**, şaşırma olası mı, yeniden dikkat kesilir mi. "attention dips / HIGH swipe risk / hooks attention". |
| **Retention Editörü (oto-eleştiri)** | `pipeline/editorCritique.js` | En zayıf/en güçlü sahne, **en sıkıcı an**, görsel tekrar (aynı-kaynak dizisi + AI oranı), anlatım tekrarı, en iyi iyileştirme. |
| **Loop / film yapısı** | `retentionQC` | Finale hook sorusunu kapatıyor mu (kelime örtüşmesi) → `metrics.loop.closed`. |
| **Görsel tekrar** | `retentionQC` | En uzun aynı-kaynak dizisi + AI oranı; AI-AI-AI (≥4) veya AI oranı >0.6 fix üretir. |

Hepsi `production-report.json` içinde: `editorCritique`, `attentionForecast`,
`metrics.loop`, `metrics.visualRepetition`, `metrics.patternInterrupts`,
`metrics.sceneCards` (sahne kartları). `production-report.md` insan-okur bir
**"🎬 Editör Eleştirisi"** bölümü içerir.

## Kalite hedefi 90 (upload kapısı DEĞİL)

- `minScore = 85`: SERT upload kapısı (strict modda). **Değişmedi** — cron
  güvenliği için 85'te kaldı, gece yayınını kilitlemez.
- `qualityTarget = 90`: **editoryal** hedef. Skor bunun altındaysa video yine
  yayınlanabilir ama rapor `belowQualityTarget: true` + öncelikli
  `improvementPlan` (ilk 3 düzeltme) üretir. "İyi değil, harika" barı.

## Üretici taraf (prompt zihniyeti)

- **generateScript**: 8-11 kısa beat, zorunlu ark Question→Mystery→Evidence→
  Reveal→Twist→Answer→Payoff→**Loop**; her beat YENİ bilgi; hook↔finale loop.
- **visualDirector**: "her plan neden izlensin?" sorusu; diagram taksonomisi
  (bilim→adım diagramı, tarih→harita, uzay→yörünge, hayvan→anatomi); shot-scale
  çeşitliliği zorunlu; AI-only dizisi yasak; her cümle gösterilebilir olmalı.
- **editorDirector**: her SFX'in AMACI (reveal→shimmer, question→whoosh,
  danger→impact, riser→reveal öncesi, answer→impact); müzik editör gibi (hook
  yükseliş, reveal drop, twist duraklama, payoff çözülme).

## Dürüst sınır

Bu ortamda video **render edilemiyor** (TTS + stok/görsel API'leri sandbox
ağında kapalı). Bu yüzden yalnızca UYGULANAN KURALLAR ve deterministik QC
davranışı raporlanır; gerçek kare/contact sheet render bir sonraki gerçek
üretimde (`workflow_dispatch` veya cron) `production-report.json`'a yansır.
`scripts/viking-qc-compare.js` eski/yeni yapıyı gerçek plan verisiyle
karşılaştırır (izlenme simülasyonu değil, QC değerlendirmesi).

## Beklenen retention etkisi (teknik gerekçe)

- **Tempo ≤3.2s + pattern interrupt**: Shorts'ta göz 3sn'de yeni uyaran arar;
  uzun statik plan = kaydırma. Ölçüm artık sadece cut değil, GERÇEK yeni-bilgi.
- **Semantik alaka + mekanizma diagramı**: cümleyle örtüşmeyen görsel (Viking'de
  bisikletli) "anlam kopuşu" yaratır → izleyici düşer. Diagram, açıklamayı
  gösterince merak kapanır ve izlemeye devam eder.
- **Loop**: finale hook'a bağlanınca video "tekrar izlenir/sonuna kadar izlenir"
  hissi verir; YouTube'un ana retention sinyali.
- **Görsel çeşitlilik (AI-run kırma)**: aynı estetik = slayt hissi = düşüş.
- **Oto-eleştiri + kalite hedefi 90**: sistem kendi en zayıf sahnesini işaret
  edip iyileştirme üretir → zamanla ortalama retention yükselir.
