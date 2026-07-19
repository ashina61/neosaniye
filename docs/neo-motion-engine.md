# Neo Motion Engine v1

Videoya bindirilen, tamamen bize ait CTA animasyonları (Abone Ol / Beğen /
Bildirim / Yorum / Takip / Kaydet). Referans videolar birebir kopyalanmadı;
aynı işlevi gören özgün NeoSaniye tasarım dili. **ASS/libass vektör + tek ffmpeg
post-pass**, sıfır bağımlılık, harici/telifli asset YOK, deterministik.

## Mimari

```
render → [Neo Motion: select → safe-area → validate → render → verify] → preflight → QC → upload
```

Kod: `src/motion/{ctaEngine,ctaSelector,ctaSafeArea,ctaValidator,ctaRenderer,ctaTemplates}.js`
CTA, preflight/QC ÖNCESİ uygulanır (final MP4 CTA'lı olur). **Fail-safe:** CTA'nın
herhangi bir adımı hata verirse ana video korunur, CTA atlanır, sebep raporlanır —
ana render hatası ile CTA hatası ayrıdır, engine asla throw etmez.

## 6 özgün şablon

| ID | Tip | Etiket | İkon (ASS vektör) | Hareket |
|---|---|---|---|---|
| neo_subscribe_minimal | subscribe | ABONE OL | + | soldan süzülme + fade |
| neo_subscribe_pulse | subscribe | ABONE OL | + | + turkuaz nabız halkası |
| neo_like_pop | like | BEĞEN | ♥ | kalp pop (scale 40→118→100) |
| neo_bell_ring | bell | BİLDİRİM AÇ | 🔔(vektör) | zil sallanma (\frz ±10°) |
| neo_comment_slide | comment | YORUM YAP | 💬(vektör) | balon + metin alttan süzülür |
| neo_follow_compact | follow | TAKİP ET | + | kompakt hızlı fade |

Tasarım: koyu cam kart (14px yuvarlak köşe) + sol turkuaz aksan bar + Montserrat
SemiBold etiket. 384×112px, mobilde okunur, altyazıyı/ana konuyu kapatmaz.
Türkçe karakterler doğru (İ, Ğ, ...); font yoksa DejaVu fallback.

## CTA seçim mantığı (deterministik, editoryal)

`ctaSelector` — aynı seed (videoId/konu) + aynı config → aynı CTA (tekrar tutarlı):
- mode `editorial`: olasılık kapısı (varsayılan 0.35); `always`/`off` de var.
- Video < `minVideoDurationSec` (20s) → CTA yok.
- Başlangıç ∈ [`earliestStartSec` (8s, ilk 5sn kesin yasak), süre − buffer − CTA süresi].
- Süre ∈ `durationRangeSec` (1.8–2.8s), video başına en fazla 1.
- Anti-tekrar: son videonun tipi mümkünse tekrar edilmez (`getRecentCtaTypes`).
- Outro varsa çakışmaz (geri çekilir; sığmazsa `timeline-conflict`).
- CTA gereksizse `skipped` + sebep: `video-too-short|no-safe-area|disabled|
  probability-skip|editorial-skip|timeline-conflict|validation-failed`.

## Güvenli alan

`ctaSafeArea` şu bölgelerden kaçınır: üst hook (~470px), altyazı bandı
(`captionMarginV`+170px), alt platform UI (`captionBottomSafePx`), sağ Shorts
ikon şeridi (~150px), verilirse yüz/ana konu kutusu. Konumlar: `lower_third_left`,
`bottom_left`, `center_left`, `lower_third_right`, `bottom_center`, `auto`.
**Uygun yer yoksa null → CTA görseli kapatmak yerine güvenle atlanır.**

## SFX (programatik, bize ait)

`scripts/motion-sfx-gen.js` → ffmpeg lavfi ile 5 SFX sentezi (harici dosya yok):
`soft_click, pop, bell_tick, swipe, confirmation`. Hepsi ≤ −13 dBFS (TTS'i
bastırmaz), tip → SFX eşlemesi CTA amacına uygun. `sfxVolume` (0.3) ile miks;
CTA kapalıysa SFX de yok. Peak/loudness gen sırasında ölçülür.

## Doğrulama (QC)

`ctaValidator`: plan (ilk 5sn, sınır, süre, safe-area, ekran-dışı, ikon şeridi)
+ **render sonrası SSIM farkı** ile CTA katmanının gerçekten işlendiği doğrulanır
(fark yoksa `cta-layer-not-present` failure → CTA'sız orijinal korunur).

## Manifest & lisans

`assets/motion/manifests/{cta,sfx}-manifest.json` — her asset
`origin: programmatically-generated`, `license: proprietary-original`,
`externalSource: null`. Tümü bize ait / programatik.

## Rapor entegrasyonu

`production-report.json` → `motion` bloğu: `enabled, ctaRequested, ctaApplied,
ctaId, ctaType, startSec, durationSec, position, selectionReason, safeAreaPassed,
sfxId, warnings, failures`. `report.json` + video kaydı + qc-history'ye de
(`ctaApplied, ctaType`) yazılır (geriye uyumlu, append-only bozulmaz).

## CLI

```bash
npm run motion:sfx             # SFX üret (assets/motion/sfx)
npm run motion:preview         # 6 CTA demo videosu + contact sheet (artifacts/motion)
npm run motion:debug-safe-area # güvenli alan + kaçınılan bölgeler görseli
```

## Config (`config.motion`)

`MOTION_ENABLED`, `MOTION_CTA_ENABLED`, `MOTION_CTA_MODE` (editorial|always|off),
`MOTION_CTA_PROB`, `MOTION_CTA_TYPES`, `MOTION_CTA_MIN_DUR`, `MOTION_CTA_EARLIEST`,
`MOTION_CTA_DUR_MIN/MAX`, `MOTION_CTA_SFX`, `MOTION_CTA_SFX_VOL`... (hepsi env-ezilebilir).
Kapalıyken (`MOTION_ENABLED=0`) pipeline eski çıktısıyla birebir aynı davranır.

## Bilinen sınırlamalar (v1)

- CTA post-pass video akışını yeniden kodlar (crf 18, ~görsel-kayıpsız) — CTA
  uygulanan videolarda +1 encode maliyeti. CTA uygulanmayanlarda dosya değişmez.
- İkonlar ASS vektör (temiz ama basit geometri); v2'de daha zengin motion.
- Yüz/ana-konu bounding box entegrasyonu opsiyonel (verilirse kullanılır; v1'de
  otomatik yüz tespiti yok).
- Legacy `subPrompt` motion açıkken kapanır (çift abone-uyarısı olmasın).

## v2 önerileri

- Yüz/subject tespiti (mevcut görsel meta) ile dinamik konum.
- Şablon başına ince ses tasarımı + hafif haptic-vari mikro animasyonlar.
- A/B: CTA tipi/konumu ↔ abone dönüşümü (qc-history verisiyle).
- İçeriğe duyarlı CTA seçimi (ör. "nasıl yapılır" → Kaydet, tartışmalı → Yorum).
