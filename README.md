# NeoSaniye

Editoryal kesik-kağıt kolaj tarzında dikey belgesel Shorts üreten fabrika.
Render motoru **Remotion**; kompozisyonların büyük kısmı **kodla çizilir**.

Yayınlama yok: bu repoda upload mantığı bulunmaz, workflow'lar yalnızca manuel.

## Neden bu mimari

Referans malzeme (bir "paper collage documentary" iş akışı) her beat için bir
görsel ürettirip sonra bir **image-to-video** modeliyle canlandırıyor. O modelin
istediği davranış şöyle tarif ediliyor:

> kamera tamamen kilitli · zoom yok, pan yok · hiçbir öğe yerleştikten sonra
> bir daha hareket etmez · 7. saniyede kare verilen görselle birebir eşleşir

Bu bir yaratıcılık talebi değil, **determinizm** talebi — ve i2v modelleri bu üç
kuralı düzenli olarak ihlal eder. Remotion'da kamera zaten senin: kaymayı
yazmazsan kaymaz. O yüzden build-on assembly kodda yapılıyor
(`src/motion/stepped.ts`), bir video modelinden dilenmiyor.

Referans video ölçüldüğünde bu tercih doğrulandı: çekimlerinin yaklaşık üçte
ikisinde hiç fotoğraf yok (çöp adam, tipografi, ok, halka, harita, ızgara), ve
çekim içi hareket "kompozisyon çakılı + bir iki katman ağır ağır kayıyor"dan
ibaret. İkisi de kod işi.

## Akış

```
content/story.json          Fern stili sürekli anlatı (tek blok)
        │
        │  npm run beats      pipeline/build-storyboard.mjs
        │                     2.5 kelime/sn → beat → beat türü → sahne şablonu
        ▼
content/storyboard.json     sahne listesi, süreler, payload
        │
        │  npm run render     Remotion
        ▼
out/neosaniye.mp4           1080x1920, 30 fps
        │
        │  python3 pipeline/verify-render.py out/neosaniye.mp4
        ▼
ölçüm raporu                kompozisyon kilidi, 12fps kadans, aksan payı,
                            güvenli alan, kamera sabitliği
```

Render sırasında hiçbir karar verilmez. Bütün kararlar storyboard'da,
derleyici tarafından önceden alınır — çıktının deterministik olması için.

## Komutlar

| komut | ne yapar |
|---|---|
| `npm run beats` | `story.json` → `storyboard.json` (ağa çıkmaz) |
| `npm run studio` | Remotion stüdyosu, canlı önizleme |
| `npm run render` | `Short` kompozisyonunu render eder |
| `npm run typecheck` | TypeScript denetimi |
| `npm test` | beat matematiği ve sınıflandırma testleri |
| `npx remotion render src/index.ts StyleSheet out/sheet.mp4` | stil sayfası |

`StyleSheet` kompozisyonu her şablondan 3 saniye gösterir. Tasarım sistemi bir
yerde bozulduğunda hangi şablonda bozulduğunu tek videoda görmek için var.

## Dizinler

```
src/design/tokens.ts      palet, tip ölçeği, güvenli alan, dikey bantlar
src/motion/stepped.ts     12fps adım, build-on giriş, katman kayması
src/paper/                kağıt primitifleri (zemin, cutout, tip, işaretler, çöp adam)
src/scenes/               12 sahne şablonu + beat türü sözleşmesi
src/Short.tsx             sıralayıcı (konu bilgisi içermez)
pipeline/beats.mjs        Fern beat matematiği + sınıflandırma + şablon eşlemesi
pipeline/verify-render.py çıktıyı referans ölçümlerine karşı denetler
public/fonts/             Roboto Condensed (Apache-2.0), EB Garamond (OFL)
```

## Render motoru notu

Remotion normalde Chromium'unu `remotion.media`'dan indirir. Bu ortamın ağ
politikası o hostu engelliyor; `remotion.config.ts` makinede kurulu bir
Chromium'u arıyor ve bulursa onu kullanıyor. `REMOTION_BROWSER` ile elle de
verilebilir.

Ölçülen hız: ~0.27 sn/kare (1080x1920), yani 50 saniyelik video ≈ 7 dakika.

## Görseller

Şablonlar `payload.images` yoksa **prosedürel siluetle** çalışır, yani tasarım
sistemi ve hareket ücretli API çağrılmadan doğrulanabilir. Gerçek halftone
fotoğraf cutout'ları (alfa kanallı PNG) aynı bileşene `src` olarak girer.

Alfa kanallı cutout üretmek hâlâ çözülmesi gereken adım: görsel modellerinin
çoğu şeffaf arka plan vermiyor, arka plan silme adımı gerekiyor.

## Kurallar

`AGENTS.md` bağlayıcıdır. Özeti: tek görsel yön, tek aksan rengi, konu başına
kod yazılmaz, `Math.random` yasak, upload eklenmez, workflow manuel.
