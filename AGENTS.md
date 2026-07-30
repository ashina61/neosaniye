# NeoSaniye Factory Rules

## Görsel yön

- Tek görsel yön: **editoryal kesik-kağıt kolaj** (Vox / video-essay dili).
- Çıktı **1080x1920, 30 fps, 9:16**. Referans malzeme 16:9 yazıyor; biz Shorts
  kanalıyız, dikey bağlayıcıdır.
- Palet `src/design/tokens.ts` içinde ve **ölçülerek** belirlendi (referans
  videonun 17 çekiminden piksel sayımı). Renk eklenmez, token değiştirilir.
- **Tek aksan rengi** (altın `#D2A03C`) ve cimri kullanılır: karenin en fazla
  %8'i. Referansta ölçülen %3.6. `verify-render.py` bunu denetler.
- Alternatif stil, ikinci palet, ikinci font ailesi eklenmez.

## Neyi kod çizer, neyi görsel modeli üretir

Bu ayrım mimarinin merkezinde:

- **Kod çizer**: harita, rota, zaman çizelgesi, grafik, ok, marker dairesi,
  ikon ızgarası, tipografi, çöp adam figürleri, kağıt dokusu, gölge, kontur.
  Referans videonun çekimlerinin yaklaşık üçte ikisinde hiç fotoğraf yok.
  Bir görsel modeli doğru bir ok ya da okunur bir harita çizemez; kod çizer.
- **Görsel modeli üretir**: yalnızca halftone fotoğraf cutout'ları (kişi, yer,
  nesne), alfa kanallı.
- **Arşiv kataloğu getirir**: `pipeline/fetch-archive.mjs` — Wikimedia Commons
  ve Library of Congress, anahtarsız ve kotasız. Gerçek fotoğraf, uydurma değil.
  Yalnızca kamu malı / CC BY / CC BY-SA kabul edilir; **ND ve NC reddedilir**
  (ND türev yasaklar ve biz kesip kolaja koyuyoruz; NC para kazanan kanalda
  kullanılamaz). Atıf `content/credits.json`e yazılır ve CC BY/BY-SA için
  yayın açıklamasına konması ZORUNLUDUR.

## Yeni konu nasıl çalıştırılır

```
cp content/story.json content/story-<ad>.json     # başlığı ve narration'ı değiştir
npm run beats -- content/story-<ad>.json          # storyboard üret + raporu OKU
npx remotion render src/index.ts Short out/x.mp4 --codec=h264 --crf=18 --pixel-format=yuv420p
```

`npm run beats` çıktısındaki **semantik kapsama** satırı yeni konuda ilk
bakılacak yer. %40'ın altındaysa yüksek sesle uyarır: o durumda sahnelerin çoğu
şablonun jenerik siluetine düşer ve çizimler anlatımla ilgisiz olur. Çözüm ya
anlatıda somut nesne adı geçirmek ya da `pipeline/subject.mjs` sözlüğüne o
konunun nesne ailesini eklemek — TEK bir nesne değil, AİLE.

Konuya özgü kod ya da konuya özgü bileşen yazılmaz; bu kural sözlüğü de kapsar.
Sözlük bir kez tek konuya göre yazıldı ve farklı bir konuda kapsama 0/19 ölçüldü
— hiçbir hata vermeden. `test/beats.test.mjs` artık dört alakasız konuda kapsama
eşiğini denetliyor.

## Çizilen şey cümleden gelir, şablondan gelmez

- Şablon **beat türünü** cevaplar (olgu mu, yer mi, ölçek mi). Hangi NESNENİN
  çizileceği AYRI bir karardır ve `pipeline/subject.mjs` verir.
- Şekil listesi üç dosyada: `subject.mjs` (üretici), `Cutout.tsx` (çizen),
  `types.ts` (sözleşme). Üçü birebir aynı olmak zorunda ve test denetler —
  ayrışırsa bilinmeyen şekil sessizce **kutu** olarak çizilir.
- Eşleşme **cümledeki sıraya** göre, sözlüğün yazılış sırasına göre değil.
- Cümlede somut nesne yoksa şekil verilmez ve şablon varsayılanına düşer.
  Uydurma nesne çizmek yalan görseldir.
- **Olumsuzlama**: nesne çizilir ve üstü çizilir (`MarkerCross`). Olumsuzlama
  fiile bağlıysa çarpı ATILMAZ — "the canoe was never moving" cümlesinde
  olumsuzlanan hareket, kano değil.
- Vurgu (altın bar) cümlenin somut nesnesine gider; "en uzun kelime" kuralı
  yalnızca yedektir.
- **Image-to-video modeli kullanılmaz.** Build-on assembly (öğelerin boş kağıt
  zeminden tek tek girmesi) `src/motion/stepped.ts` içinde kodla yapılır.
  Referans prompt'un istediği "kamera kilitli, yerleşen öğe bir daha oynamaz"
  davranışı kodda bedava; bir video modelinden dilenmesi gerekmiyor.

## Hareket

- Stop-motion kadansı: `stepped()` kareyi 12 fps adımına oturtur. Ölçülerek
  doğrulandı (30fps'de 60 karede 24 ayrı konum, tutma deseni 3,2,3,2).
- **Kompozisyon kilitli.** Sahne başına en fazla İKİ katmana `drift()` verilir.
  Her katman oynarsa sonuç kayan slayt gösterisi olur; referansta ölçülen
  davranış arka planın/metnin/okun tamamen sabit kalmasıydı.
- Kamera hareketi yok: zoom, pan, tilt, dolly hiçbiri.
- Sahneler arasında **sert kesme**. Çapraz geçiş, fade, wipe kullanılmaz.
- **Sahne tabanı 3.0 saniye** (`MIN_SECONDS`). Eski taban 1.2 idi ve o teknik
  bir alt sınırdı (kesmenin gürültü olarak okunmadığı nokta), editoryal bir
  tercih değil. Seslendirme yokken izleyici hem okuyor hem bakıyor; kullanıcı
  iki kez "değişim çok hızlı" dedi. Seslendirme eklenirse bu taban düşürülebilir.
- **Girişler sabit saniyeye yazılmaz, `cue(seconds, i, n)` ile sahne süresine
  yayılır.** Sabit takvim ölçülerek yanlış çıktı: 2.8 saniyelik `map_route`
  sahnesinin son 2.25 saniyesinde değişim %0.00, ve videonun 20 donmuş
  aralığının 9'u tek o sahnedendi.
- **Her sahnede BÜYÜK bir katman hareket eder.** 8px'lik rota çizgisi ya da 9px
  çizgiden çizilmiş çöp adam teknik olarak hareket eder ama izleyici için olay
  değildir — 1080 genişlikte karenin binde birini kaplar. Cutout'u olmayan
  şablonlarda sürüklenen şey en büyük nesne olmak zorunda (harita plakası,
  zemin kartı).

## Film katmanı

`src/film/` rehberin "build the film-look engine once" kuralının karşılığı.
Kolajı tek yapıma bağlayan şey öğelerin benzemesi değil, hepsinin AYNI filmden
geçmesi.

- `treatment.tsx` → `<FilmTreatment />`. **Short.tsx'te tek bir yerde**, tüm
  `Sequence`lerin dışında. Sahne içine taşınmaz: 19 sahne 19 farklı film olur.
- Katmanların **tamamı statiktir**, tek istisna pozlama titremesi. Sebebi
  doğrulayıcı: kompozisyon kilidi tol=6 ile ölçülüyor, animasyonlu tam kare
  efekti onu doğrudan düşürür. Titreme genliği bu yüzden 0.018 (krem zeminde
  4.1 seviye) ve 12fps adımına oturuyor.
- **Gate weave (kare geneli sallanma) kasıtlı olarak YOK**: o gerçek bir kamera
  kaymasıdır ve "kamera hareketi yok" kuralı ölçümle konuldu.
- `CastShadow` = cutout'un kendisinden gölge (kopyala, `brightness(0)`, ayak
  hattından yatır, blur, %45). Ayrı gölge varlığı üretilmez.
  - Dönüşüm sırası `skewX(...) scaleY(-length)`; TERSİ yazılırsa kayma tam
    yükseklikle hesaplanır ve gölge 850 px'lik bir çubuk olur (render'da görüldü).
  - Yalnızca **zeminde duran** özneye uygulanır. Kağıda yapıştırılmış fotoğrafın
    gölgesi `LAYER_SHADOW`'dur; ona uzanan gölge verilince kartın dışına taşan,
    hiçbir şeye ait olmayan bir üçgen çıkıyor.
- `Plate.tsx` → `OnBlackPlate`: siyah zeminli malzemeyi alfa OLMADAN
  kompozitler (`screen` + kontrast kırma + kenar tüyleme). Üçünden biri
  atlanırsa teknik çalışmaz. Sağlayıcıların döndürdüğü opak JPEG'ler için tek
  yol bu.
- `choreography.ts`: `cue`, `parallax` (0.6× derinlik), `zoomThrough`,
  `focusHunt`, `peel`, `holdJitter`. Hepsi saf fonksiyon ve `test/film.test.mjs`
  bunları tsc ile derleyip DAVRANIŞINI ölçer — metin araması değil.

## Metin

- Etiket en fazla 4 kelime (`LABEL_MAX_WORDS`). Uzun etiket hem görsel
  modelinde hem kompozisyonda bozulur.
- Klasik akan altyazı yok. Sahne başlığı, etiket ve alıntı kartı kullanılır.
- Anlam taşıyan hiçbir öğe `SAFE_BOX` dışına çıkmaz — Shorts arayüzü alt
  330 px, sağ 150 px, üst 150 px'i yiyor.
- Vurgu `*yıldız*` ile işaretlenir, `Highlight` altın barı çizer.

## Anlatı

- Fern DNA'sı: sürekli anlatı, tek blok. Cold open tarih + yer + tek somut
  eylemle açar. Her cümle tek fikir taşır, çünkü her cümle bir görsel beat olur.
- **2.0 kelime/saniye** ve beat başına en az 5 kelime. PDF'in değeri 2.5 ve o
  değer SESLENDİRİLMİŞ anlatı için doğru — dinleyicinin gözü serbesttir. Bizde
  seslendirme yok, aynı metni GÖZ okuyor. Seslendirme eklendiğinde 2.5'e geri
  çıkmalı ve beat süreleri gerçek ses dosyasından ölçülmeli.
- Son satır cliffhanger: 12 kelimeden kısa ve **bölünmez**.
- Beat türü → sahne şablonu eşlemesi `pipeline/beats.mjs` içinde. Soyut beat
  çöp adam alır, olgusal beat halftone cutout alır.
- Tek şablon sahnelerin %34'ünden fazlasını kaplamamalı.

## Determinizm

- `Math.random` yasak. Varyasyon `rand(seed)` ile üretilir.
- Render sırasında karar verilmez: bütün kararlar `content/storyboard.json`'da,
  derleyici tarafından önceden alınır.
- Aynı girdi → aynı kare. Test bunu doğrular.

## Yayın ve otomasyon

- **Upload mantığı eklenmez.** YouTube, Meta, hiçbir platform.
- Workflow'lar kullanıcı açıkça istemedikçe **yalnızca manuel** (`workflow_dispatch`).
  Cron yok, `push` tetikleyicisi yok.
- Kullanıcı açıkça söylemedikçe workflow çalıştırılmaz, render alınmaz, ücretli
  API çağrılmaz.
- Eksik sağlayıcı anahtarı atlanır. Kota/sağlayıcı hatası sıradaki sağlayıcıya
  düşer, işi patlatmaz.

## Konu başına kod yazılmaz

Eski repodaki hata buydu: `Scene01Hook.tsx`…`Scene07Payoff.tsx` diye konuya
gömülü bileşenler. Her yeni konu elle kodlama gerektiriyordu. Sahne şablonları
konuya değil **beat türüne** bağlıdır; yeni konu yalnızca `content/story.json`
değişikliğidir.
