# Neo Motion Engine v1 — Görsel Kabul Testi Raporu

> **Dürüst kapsam notu:** Sandbox'ta gerçek NeoSaniye videoları YOK (`output/`
> gitignore'lu, GitHub runner'da üretiliyor, 139MB artifact indirilemez). Bu
> yüzden spec'in izin verdiği yol izlendi: 6 çeşitliliği kapsayan **temsili test
> arka planı** (parlak / koyu / alt-altyazı-yoğun / orta-altyazı / hızlı-geçiş /
> alt-bölge-nesne). Canlı config'e (editorial / 0.35) DOKUNULMADI; "always"
> yalnızca lokal test render'ında kullanıldı.

## Render matrisi (6 şablon, 6 farklı zemin)

| Şablon | Zemin | Konum | SFX | Puan |
|---|---|---|---|---|
| neo_subscribe_minimal | parlak/açık | lower_third_left | confirmation | **95** |
| neo_subscribe_pulse | koyu | lower_third_left | confirmation | **96** |
| neo_like_pop | alt-altyazı yoğun | lower_third_left | pop | **95** |
| neo_bell_ring | orta-altyazı | lower_third_left | bell_tick | **94** |
| neo_comment_slide | hızlı geçiş (renk barları) | lower_third_left | soft_click | **93** |
| neo_follow_compact | alt-bölge nesne | lower_third_left | confirmation | **94** |

**Ortalama: 94.5 / 100** — tümü ≥90 (Production ready bandı).

## Otomatik teknik kontroller (off vs on, 6/6)

| Kontrol | Sonuç |
|---|---|
| FPS değişimi | 30→30 **değişmedi** (6/6) |
| Çözünürlük | 1080x1920 **değişmedi** (6/6) |
| Pixel format | yuv420p **değişmedi** (6/6) |
| Ses kanalı | 2→2 **değişmedi** (6/6) |
| Süre farkı (ekstra kuyruk) | Δ=0.000s **eklenmedi** (6/6) |
| A/V sync | gap 0.073s (kaynak-içi, off'ta da aynı; tolerans 0.8s) ✓ |
| Black frame introduced | 0 (6/6) |
| Freeze | statik zemin artefaktı; CTA'nın eklediği donma yok |
| Max peak | −23.7 … −30 dBFS → **clipping yok** (6/6) |
| Altyazı korunması (SSIM) | botcap **0.9985**, midcap **0.9996** → altyazı bozulmadı |
| Altyazı çakışması | botcap/midcap **False** (6/6) |
| Ana nesne çakışması | subject **False** |
| Sağ ikon şeridi ihlali | **False** (6/6) |

## Puan gerekçeleri (Okunabilirlik 20 / Yerleşim 20 / Hareket 20 / Tasarım 15 / Ses 10 / Akış 15)

- **subscribe_pulse (96, en iyi):** Koyu zeminde beyaz metin + turkuaz nabız
  halkası mükemmel kontrast; hareket dikkat çekiyor ama rahatsız etmiyor.
- **subscribe_minimal (95):** Parlak zeminde koyu cam kart dark-on-light
  kontrastı sağlıyor; slide+fade akıcı. Metin biraz küçük (−2 okunabilirlik).
- **like_pop (95):** Kalp pop animasyonu net; kart alt-altyazının ÜSTÜNDE,
  hiç çakışmıyor (kanıt: capOverlap=False, SSIM 0.9985).
- **bell_ring (94):** Zil ikonu tanınır, sallanma ince; orta-altyazının altında
  temiz. Sallanma biraz fazla ince (−3 hareket).
- **comment_slide (93, en zayıf):** En zorlu zemin (renk barları). Koyu kart
  yine de okunuyor ama en düşük kontrast senaryosu (−4 okunabilirlik).
  soft_click −30dB → telefonda hafif kalabilir (küçük not).
- **follow_compact (94):** Kompakt kart alt-bölge nesnenin üstünde, çakışma yok.

## Bulunan sorunlar

- **Kritik/bloklayıcı sorun YOK.** Çakışma, taşma, sync bozulması, clipping,
  kalite değişimi, ekstra süre — hiçbiri yok.
- **Küçük gözlem (opsiyonel):** Kartlar/metin telefonda "yeterli ama ideal
  değil" boyutta; +%10-12 boyut artışı okunabilirliği güçlendirir. Bloklayıcı
  değil — v1 kabulünü etkilemez, v1.1 önerisi olarak bırakıldı (kullanıcı
  onayına). comment_slide SFX (−30dB) bir tık yükseltilebilir.

## Küçük düzeltme yapıldı mı?

**Hayır.** Tüm kabul kriterleri karşılandığından (aşağı bak) ve kullanıcı v1
tasarımını yeni kabul ettiğinden, boyut gibi öznel bir değişiklik zorla
uygulanmadı; opsiyonel öneri olarak raporlandı.

## Kabul kriterleri kontrolü

| Kriter | Durum |
|---|---|
| Hiçbir örnekte altyazı çakışması | ✅ |
| Hiçbir örnekte sağ platform UI ihlali | ✅ |
| Hiçbir CTA < 80 puan | ✅ (min 93) |
| Ortalama ≥ 88 | ✅ (94.5) |
| A/V sync bozulmamış | ✅ |
| FPS/çözünürlük/süre beklenmedik değişim yok | ✅ |
| SFX peak güvenli | ✅ (≤ −23.7dB) |
| CTA kapalı regresyon korunmuş | ✅ (off = dokunulmamış kaynak) |
| Motion hatası ana render'ı düşürmüyor | ✅ (engine fail-safe, birim testli) |

## KARAR: **PRODUCTION-READY = YES**

- **En iyi CTA:** neo_subscribe_pulse (96)
- **En zayıf CTA:** neo_comment_slide (93, yine de production bandında)
- **Önerilen canlı probability:** **0.35 korunsun** (mevcut). CTA'lar
  müdahaleci değil; 1/3 oran yorgunluk yaratmadan görünürlük sağlar.
- **İlk 20 canlı üretim için rollout:** editorial/0.35 aynen kalsın; "always"
  KULLANILMASIN. İlk ~20 videoda `production-report.json → motion` bloğu ve
  qc-history `ctaApplied/ctaType` izlensin; 2-3 gerçek videoyu YouTube Studio'da
  gerçek içerik üstünde gözle doğrula; sorun yoksa probability sabit kalsın
  (istenirse kademeli 0.40-0.45 denenebilir).

## Boyut/render maliyeti notu

Teknik zeminlerdeki dosya boyutları (parlak 1.1GB, hızlı-geçiş 51MB) sentetik
`noise`/`testsrc2` artefaktıdır — gerçek ~35MB NeoSaniye videosunu temsil etmez.
Çoğu şablonda boyut Δ ≈ +0.3MB; gerçek videoda CTA post-pass maliyeti modest
(+1 encode, crf18 ~görsel-kayıpsız). Motion pass süresi test zeminlerinde
~7-8sn/video.
