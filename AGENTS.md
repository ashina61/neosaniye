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
- **Bir aile ancak SİLUETİ AYNI OKUNAN nesneleri toplayabilir.** Tek bir
  `vehicle` ailesi "aircraft" cümlesine kamyon çizdirdi; tek bir `object`
  ailesi bomba/paraşüt/çanta/silah/anahtarın hepsine aynı yuvarlak kutuyu
  çizdirdi. Aileyi fazla geniş tutmak, aileyi kurma sebebini yok eder.
- **Anlatı, çizilecek nesnenin ADINI geçirmeli.** Şekil somut isimden türüyor,
  fiilden değil: "he jumped" çizilemez, "he jumped with a parachute" çizilir.
  Harita da iki yer adı ister: "a ticket to Seattle" değil, "a ticket from
  Portland to Seattle". İkisi de anlatıyı bozmuyor, netleştiriyor.

## Okunabilirlik

- **Başlık HER ŞEYDEN ÖNCE girer ve sahne boyunca kalır.** Dört şablonda
  başlığın opaklığı ilgisiz bir öğenin girişine bağlıydı (`hero_cutout`'ta
  cue 2/5 = 3 saniyelik sahnede 1.36. saniye); okumaya 1.6 saniye kalıyordu ve
  6 kelimelik büyük harf başlık ~1.5 saniye okuma ister. Metin OKUNACAK şeydir;
  ilk giren o olmalı.
- Kelime/saniye **1.7**, sahne tabanı **3.6 sn** (`MIN_SECONDS`). İkisi de
  kullanıcı raporuyla düşürüldü ("ekran takip edilemiyor okunamıyor"):
  2.5 → 2.0 → 1.7 ve 1.2 → 3.0 → 3.6. Eski 1.2 tabanı teknik bir alt sınırdı
  (kesmenin gürültü olarak okunmadığı nokta), editoryal bir tercih değil.
  Seslendirme eklenirse ikisi de gevşetilebilir — o zaman kısıt okuma değil
  konuşma hızı olur.
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
- Sahne tabanı için bkz. **Okunabilirlik** bölümü. (Burada ayrı bir sayı
  yazıyordu — 3.0 — ve Okunabilirlik bölümü 3.6 diyordu. Aynı kuralı iki yerde
  tutmanın bu depodaki bilinen bedeli; belge de koddan muaf değil.)
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

## Görsel malzeme: parça parça, tek kare değil

Varsayılan yol **B**: sahne başına bir **plaka** (boş kağıt zemin) ve 2-4 **parça**
(düz magenta zeminde tek nesne). `CollageBuild` şablonu bunları katman katman,
anlatı sırasıyla diziyor.

```
npm run beats -- content/story-<ad>.json
npm run flow:pack                  # out/flow-pack/ — prompt'lar + ASSET-LIST.txt
# üretilen görselleri collage-raw/ altına ASSET-LIST'teki adlarla koy
npm run collage                    # magenta → alfa, storyboard'a bağla
npm run sheet                      # tek kareye bak (render'a girmeden)
```

- **Neden tek bitmiş kare değil**: bitmiş kolajı Remotion AYIRAMAZ, öğeler
  piksele gömülüdür. Yapılabilecek tek şey kareyi bütün olarak kaydırmak, ki o
  da düz animasyon demek. Parçalar ayrı gelince bu deponun hareket motoru
  devreye giriyor: kamera gerçekten kilitli, tarih ve sayı değişmiyor (metni
  Remotion çiziyor), çıktı deterministik. A yolunda (Flow i2v) üçü de ÖLÇÜMLE
  elde edilemedi.
- **MAGENTA ZEMİN TERK EDİLDİ — iki canlı çalıştırmada da tutmadı.** 1. turda
  5 görselin beşinde zemin magenta değildi (köşe skorları 0-37, eşik 87).
  Prompt düzeltildi (çelişkili "no colour" kaldırıldı, özne başa alındı,
  "chroma-key screen" dendi) ve 2. tur yine %0.0 verdi — ama bu sefer ölçüm
  asıl sorunu gösterdi: **magenta ZEMİNDE değil ÖZNENİN İÇİNDEYDİ** (kenar
  medyanı 0/-5, MERKEZ medyanı 16/42; kesilen parçalarda opak piksellerin
  %82'si pembe). Yani "magenta" kelimesini duymak özneyi kirletiyor.
  Prompt artık **düz beyaz stüdyo zemini** istiyor ve beklenen mod `matte`.
  Gerekçe ölçülmüş: aynı turda tek temiz parça beyaz zeminli portreydi
  (pembe %0.0, kroma 5.8) ve matte onu kusursuz kesti.
- **Modelden yalnızca FOTOĞRAFLANABİLİR nesne istenir.** Reçetelerin destek
  listeleri bant/damga/ip/iğne/altı-çizme istiyordu; beşini de kod çiziyor
  (`paper/Fixings.tsx`, `paper/Marks.tsx`). Bunlar sadece israf değil zararlı:
  başarısız olan parçalar tam olarak bunlardı, çünkü model soyut bir kağıt
  tarifini SAHNE olarak yorumluyor. `CODE_DRAWS` süzgeci onları eliyor.
- **Eksik parça hata değil**: `npm run collage` ne bulursa onu bağlar, malzemesi
  olmayan sahne mevcut kod-çizimli şablonuyla kalır. Tek sahneyle deneme yapmak
  bu yüzden mümkün.
- **A yolu yedek olarak duruyor**: `NN-kind-FALLBACK-single-frame.txt` +
  `NN-kind-MOTION.txt` + `npm run clips`. O sahne build-on yapmaz.
- `chroma` modu `keep_largest_blob` ÇAĞIRMAZ. O fonksiyon `matte` modu için
  yazıldı ve burada iki bozulma birden üretti (ikisi de kanıt karesinde
  görüldü): öznenin kopuk parçasını siliyor (test figüründe baş düştü) ve kapalı
  boşlukları anahtar rengiyle dolduruyor (ekranın ortasına mor disk;
  o parçanın opak piksellerinin %62'si magenta ölçüldü). Yerine `drop_speckles`
  (küçük lekeyi at, kalan HER bileşeni tut, boşluğa dokunma) + `despill`.
  `test/cutout.test.mjs` üçünü de denetliyor.
- **Anahtar renk MAGENTA'dır, "doygunluk" değil.** `chroma_alpha` önce
  `max-min > eşik` olan HER pikseli arka plan sayıyordu; yani kırmızı bir mühür
  (kroma 0.67) da silinirdi. Ölçüt magenta'nın tanımı olmalı: `min(R,B) - G`.
  Aynı hata `despill`'de de vardı (her opak pikseli griye çeviriyordu).
  Kullanıcının referans kolajında renkli harita, kırmızı mühür ve hardal bant
  var — kesik-kağıt dilinin aksanları tam olarak onlar. **Parça renkli olabilir;
  yalnızca magenta olamaz.**
- **Tasarlanmış bir kareden ayrıştırılan parçalar kendi yerini taşır**
  (`layers.pieces[].box`, kanvasa göre 0..1). Yuvalara dağıtmak kompozisyonu yok
  eder. `box` varsa kontur da kapatılır: orijinaldeki kesim kenarının üstüne
  ikinci bir kenar binmesin.
- **PROMPT KENDİ KENDİNİ YİYEBİLİR — ölçüldü.** İlk canlı çalıştırmada 5
  görselin BEŞİ de magenta zemin üretmedi (köşe medyanı skorları 0-37, eşik 87)
  ve hepsi alfa doğrulamasından düştü. İki sebep, ikisi de prompt'ta:
  zemin cümlesinden hemen önce *"Desaturated… **No colour**"* yazıyordu
  (modele önce "renk olmasın" deyip sonra neon magenta istemek), ve cümle
  *"A single hand-cut paper collage element: a man"* diye başlıyordu — model
  ADAM değil, bir yüzeyde duran YIRTIK KAĞIT çizdi. **Özne cümlenin başında
  olmalı**, zemin talimatı da modelin bildiği bir şeye benzetilmeli
  ("chroma-key screen, like a green screen but magenta") ve başarısızlık biçimi
  adıyla reddedilmeli ("NOT a photograph of paper lying on a surface").
- **Yedek mod zinciri var ama bedava değil.** `ingest-collage.mjs` sırayla
  chroma → matte → ink deniyor. Aynı 5 görselde ölçüm: chroma 0/5, matte 5/5,
  ink 3/5. AMA matte'in geçtiği 5 parçanın yalnızca 2'si GÖRSEL OLARAK
  kullanılabilirdi — pembe zeminli olanlarda pembe "özne" sanılıp korundu.
  Sayısal kapıyı geçmek kesiğin doğru olduğu anlamına gelmiyor; bu yüzden
  chroma dışında bir mod kazandığında adım yüksek sesle uyarıyor.
- **Düz bir kareyi geri katmanlara ayırmak GÜVENİLİR DEĞİL** ve denendi: bir
  referans kolajda hero maskesi ancak elle kutu vererek çıkarılabildi, sancak
  direği hero'ya bağlandığı için otomatik taşma-doldurma sızdı, plakadaki delik
  difüzyonla doldurulunca yumuşak bir leke bıraktı. Sonuç izlenebilir ama her
  yeni kare yeni elle ayar ister — yani konuya özgü kod. **Parçalar baştan ayrı
  üretilmeli;** B yolunun varlık sebebi bu.

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
- **1.7 kelime/saniye** (`WORDS_PER_SECOND`), beat başına en az 5 kelime
  (`MIN_WORDS_PER_BEAT`) ve sahne başına en az **3.6 saniye** (`MIN_SECONDS`,
  `build-storyboard.mjs`). PDF'in değeri 2.5 ve o değer SESLENDİRİLMİŞ anlatı
  için doğru — dinleyicinin gözü serbesttir. Bizde seslendirme yok, aynı metni
  GÖZ okuyor. Kullanıcı iki kez "değişim çok hızlı" dedi ve değer 2.5 → 2.0 →
  1.7 diye indi. Seslendirme eklendiğinde 2.5'e geri çıkmalı ve beat süreleri
  gerçek ses dosyasından ölçülmeli.
- Okunabilirliğin ölçülen kök sebebi SÜRE DEĞİLDİ: başlık, ilgisiz bir öğenin
  girişine bağlıydı ve 3 saniyelik sahnede 1.36. saniyede beliriyordu. Başlık
  her şablonda İLK girer (`at: 0.1`) ve sahne boyunca kalır.
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
