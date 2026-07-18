# Retention Editoryal Kuralları (Viking düzeltmesi)

`viking-sunstone-navigation.mp4` 74/100 aldı. O tek videoyu yamamak yerine,
insan gözüyle görülen editoryal/görsel-anlamsal sorunlar **pipeline düzeyinde,
deterministik ve test edilebilir** kurallara çevrildi. QC modu/eşiği (warning /
85), cron, 14 günlük deney, upload gate, müzik importu ve analytics metadata'ya
DOKUNULMADI.

## Yeni deterministik sinyaller (hepsi metrics'te raporlanır)

| Sinyal | Modül | Kural |
|---|---|---|
| **Pattern interrupt** | `editorialSignals.countPatternInterrupts` | Güçlü kesinti = yeni kaynak / harekete geçiş / gfx / duyulur sfx-reveal. Aynı görselin tempo için cut'la bölünmesi SAYILMAZ. 30-35sn için min 3, ideal 5. |
| **Görsel tempo** | `retentionQC` | ort. görsel olay aralığı ≤ 3.2s, en uzun statik ≤ 4.0s (eskiden 3.4 / 4.5). |
| **Semantik alaka** | `media/semanticRelevance` | Stok görsel anlatımla örtüşmeli; `forbidden_mismatches` (ör. Viking videosunda "cyclist") reddedilir. Alakasız stok "bulundu diye" seçilmez. |
| **Mekanizma görseli** | `editorialSignals.detectMechanismCoverage` | "How it works" anlatısı varsa en az bir açıklayıcı görsel (gfx/diagram/oklar) zorunlu; salt B-roll yetmez. |
| **Ses tasarımı** | `editorialSignals.sfxQuality` | Duyulur sfx 3-5 (min 3, max 6), aralarında ≥3s, çeşitli. Sayı doldurmak için rastgele whoosh puan kazandırmaz. |
| **Erken CTA** | `retentionQC` | Abone/CTA ilk %70'te ise GERÇEK puan cezası (yalnız uyarı değil). Tercihen kaldır. |
| **Hook okunabilirlik** | `video/readability.assessHookReadability` | ≤7 kelime, 360x640 ön izlemede görünür px ≥ eşik; render'da büyük **kalın sans-serif (Montserrat Black), BÜYÜK HARF, opak zemin kutusu**. |
| **Altyazı okunabilirlik** | `video/readability.assessCaptionReadability` | Güvenli alanda OLSA BİLE mobil görünür px düşükse yakalanır; render kenarlığı 1.6→2.6, gölge güçlendirildi. |
| **Olgusal kesinlik** | `editorialSignals.classifyFactualCertainty` | Cümle bazlı: kaynaksız mutlak iddia ("definitely/proven") → overclaim; "may/experiments suggest/debated" ile yumuşatılmalı. |

Eşikler `config.retention`'da (env ile ezilebilir). Puan bütçesi 100 ve 7
kategori (hook/tempo/merak/altyazı/çeşitlilik/ses/final) korundu — yeni sinyaller
ilgili kategorilere katıldı; rapor şeması geriye dönük uyumlu (yalnızca yeni
metrik alanları eklendi).

## Eski vs Yeni akış (deterministik QC simülasyonu)

`node scripts/viking-qc-compare.js` — çıktı `artifacts/viking-qc/old-vs-new-comparison.txt`.

| Metrik | ESKİ (≈74 raporlandı, yeni QC'de 62) | YENİ akış |
|---|---|---|
| Skor | 62/100 | **91/100 (≥85)** |
| Sahne/plan | 6 | 11 |
| Ort. görsel olay aralığı | 5.83s | 3.14s |
| En uzun statik | 6.0s | 3.6s |
| Pattern interrupt | (uzun/tekdüze) | 11 |
| SFX | 1 | 4 |
| Semantik mismatch | 1 (bisikletli) | 0 |
| Mekanizma görseli | yok | var (ışık→ayrılma→yön diagramı) |

> Not: Yeni QC eski videoyu 74 değil 62 puanlıyor çünkü mekanizma/alaka/SFX/CTA
> cezaları eklendi — kural artık daha sıkı ve bu kasıtlı.

## Önerilen Viking akışı (SFX cue planı zaman koduyla)

11 anlamlı görsel olay; mekanizma 4 diagram adımına bölünmüş; loop hook↔finale.

| Sn | Sahne | Görsel | SFX |
|---|---|---|---|
| 0.0–3.0 | Hook: "Vikings found the hidden sun" | gemi + büyük kalın hook | whoosh (hook girişi) |
| 3.0–6.2 | Kapalı gökyüzü, kaybolan güneş | stok deniz/bulut | — |
| 6.2–9.2 | Sunstone yakın plan | gerçek arşiv kristal | shimmer (kristal reveal) |
| 9.2–16 | Işık girer → ikiye ayrılır → parlaklık | **gfx diagram (4 adım)** | — |
| 16–22.4 | Gizli güneş yönü oku | gfx yön oku | — |
| 22.4–25.6 | Viking navigatör / rota | stok | riser (yön reveal) |
| 25.6–31.6 | Harita rota çizgisi + deneysel | gfx harita + stok | — |
| 31.6–34.5 | Gemi rotaya döner + loop | stok gemi | impact (çözülme) |

Payoff/loop: finale "by finding the sun they could not see" hook sorusunu
kapatır; kapanış gemi karesi ilk gemi karesine bağlanır.

## Gerçek render notu (dürüst)

Bu videoyu bu ortamda yeniden RENDER edemedim: TTS ve stok/görsel API'leri
sandbox ağında kapalı. Yukarıdaki eski/yeni karşılaştırma deterministik QC
simülasyonudur (gerçek plan verisi üzerinde). Yeni kurallar bir sonraki gerçek
üretimde (veya elle `workflow_dispatch`) devreye girer; asıl render sonrası
`production-report.json` yeni metrikleri ve contact sheet'i içerecektir.
