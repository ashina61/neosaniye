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

## Şablon kapıları — üç turda üç kez aynı sınıf hata çıktı

Bu oturumda beş şablon elle düzeltildi ve her turda aynı sınıf hata çıktı: alt
bant boş kaldı, aksan tavanı aştı, nesne kartın altında kalıp görünmedi, kağıt
katmanları zemini örttü. Dördü de tiplerden görünmüyor. İki kapı kuruldu.

### 1. Statik kapı — `npm test`, bedava

`test/registry.test.mjs`:

- **her şablon cümlenin NESNESİNİ çiziyor** (`payload.shape`). Beyaz liste
  gerekçeli: `evidence_board` hariç tutuluyor çünkü o beat'in şekli genelde
  zaman sözcüğünden geliyor ("night" → star) ve cümlenin gerçek nesnesi TARİH.
- **her şablonda BÜYÜK bir katman hareket ediyor** (`drift`/`parallax`/`zoomThrough`).
- **nesne büyük kartın ALTINDA kalmıyor** — JSX'te `<Cutout … shape={payload.shape}`
  konumu `<TornCard`tan sonra olmalı.

Kapı ilk koşuda **üç gerçek boşluk** buldu: `split_compare`, `archival_timeline`
ve `data_annotate`'te hiç büyük hareket yoktu. Üçü de düzeltildi.

**İlk sürüm iki YANLIŞ alarm da verdi ve ikisi de testin kendi hatasıydı:**
`collage_build` kendi dosyasında olduğu için gövdesi bulunamıyordu, ve
`hero_cutout`ta `const hasSubject = Boolean(payload.shape || …)` satırı JSX'ten
önce geldiği için "kartın altında" sanıldı. Test hassaslaştırıldı.

### 2. Görsel kapı — `npm run gate:templates`, ~20 sn

`pipeline/template-gate.mjs` her şablonu AYNI sentetik payload'la tek kare
render edip ölçüyor. Eşikler: doluluk ≥ %8, aksan ≤ %8 (AGENTS.md tavanı).

Eşik HEDEFE değil, "kabul edilemez"e konuyor: bir kapı ulaşılmamış hedefe göre
kurulursa her koşuda kırmızı yanar ve okunmaz hâle gelir. Hedef (%31) rapor
satırında gösteriliyor.

İlk tam ölçüm:

    hero_cutout       31.6   hedefte      archival_timeline   8.5
    wide_establish    30.2                data_annotate       9.0
    headline_card     27.3                map_route           9.9
    split_compare     25.5                pull_quote         12.2
    evidence_board    24.7                star_field         12.2

Render workflow'unda render'dan ÖNCE koşuyor ve `continue-on-error` — kapı bir
ÖLÇÜM, yayın engeli değil.

## Ne söylüyorsak o nesne gelecek — ve hareket edecek

Şablonlar denetlendi ve iki boşluk ölçüldü:

| boşluk | şablon | Cooper'da etkilenen sahne |
|---|---|---|
| `payload.shape`i HİÇ çizmiyor | `map_route`, `stick_beat` | 2 |
| BÜYÜK katman hareketi yok | `stick_beat` | 1 |

`evidence_board` da `shape` çizmiyor ama bu DOĞRU: o beat'in şekli `star`
("night"), oysa cümlenin gerçek nesnesi tarih ve onu takvim yaprağı taşıyor.
`NOT_PHOTOGRAPHABLE` zaten aynı sebeple hero olarak reddediyor.

Düzeltildi:
- `map_route` → rotanın üstüne cümlenin nesnesi iğneleniyor ("bought a one-way
  ticket" beat'inde harita rotayı anlatıyordu, bileti anlatmıyordu).
- `stick_beat` → nesne çöp adamın yanına giriyor **ve** `drift` alıyor; bu
  şablonda hiç büyük hareket yoktu, oysa deponun kendi kuralı "her sahnede
  BÜYÜK bir katman hareket eder".

**Yazarken bir katman sırası hatası ölçümle yakalandı:** nesneyi `PaperBase`in
İLK çocuğu olarak koymuştum ve `TornCard` üstünü tamamen örttü — render'da
nesne hiç görünmedi (doluluk 8.4). Kompozisyonun en üstüne taşınınca 12.1.

## Kareyi dolduran şey BİLGİ değil, MALZEME

Kullanıcı "tüm sayfaları yapmamışsınız ki, sadece hook çizilmiş" dedi ve haklıydı.
Kare beş yatay dilime bölünüp doluluk ölçüldü:

    headline_card ("found three bundles")  15.7  39.7  29.9   0.0  13.7
    hero_cutout   ("there was a bomb")      1.6  26.0  33.8   5.3  15.4
    evidence_board (kanıt masası)          12.6  17.4  32.0  42.3  50.4

Dördüncü dilim eski şablonlarda **%0.0**. Sebep iki katmanlı:

1. `VERTICAL_BANDS.bottom` güvenli alanın %30'uydu ve hiçbir şablon
   kullanmıyordu → hero %52'den %66'ya, bottom %30'dan %16'ya.
2. Kanıt masası **altı öğe** diziyor, ötekiler tek kartı ortaya koyuyordu.

**Boşluğu uydurma bilgiyle doldurmak yasak** ("dekoratif vs semantik"). Ama
referans karede boşluğu dolduran şey zaten bilgi değil: **üst üste binmiş
kağıtlar**. Stil bloğu da tam bunu istiyor — *"torn paper edges … offset accent
strokes … soft cutout drop shadows"*. Yani katman ve vuruş uydurma değil,
stilin kendisi.

`src/paper/Strata.tsx` ikisini de kodda çiziyor: `PaperStrata` (yırtık kenarlı,
kadrajı taşan, deterministik sayfalar) ve `OffsetStroke` (hero'nun arkasından
taşan kırmızı vuruş). Sıfır kota.

`OffsetStroke` KÜÇÜK tutuluyor: aksan tavanı %8, referansta ölçülen %3.6.
7. turda aynı vuruş modelden istendiğinde dev kırmızı blok geldi ve %11.2
ölçüldü; kodda çizilince oran garanti.

### Arşiv işaretleri — malzemeden sonra BİLGİ

Katmanlar 16.4'ü 21.1'e çıkardı ama kanıt masasının 31.0'ı uzaktaydı. Aradaki
fark malzeme değil, **öğe çeşitliliği**. `src/paper/ArchiveMarks.tsx` bunu
uydurmadan kapatıyor — iki öğe, ikisi de gerçek veriden:

- **dönem damgası**: anlatının kendi yılı. `build-storyboard.mjs` beat
  metinlerinden çıkarıp `storyboard.era`ya yazıyor; **anlatıda yıl geçmiyorsa
  alan yazılmıyor ve damga hiç çizilmiyor**. Dönem uydurmak, uydurma nesne
  çizmekle aynı sınıf yalan olurdu.
- **dosya sekmesi**: sahnenin sırası. Arşiv kolajının en yaygın öğesi ve
  uydurma değil — sahne gerçekten o sırada.

Referansta ikisinin de karşılığı var: posta damgası tarihi, BUCKINGHAMSHIRE
etiketi bölgeyi taşıyor.

### Dev rakam — beat'in KENDİ sayısı

Kanıt masasının doluluğunu taşıyan asıl öğe dev tipografi ("24 / NOV / 1971",
karenin üçte biri). `bigFigure` (build-storyboard.mjs) o öğeyi anlatının kendi
verisinden çıkarıyor ve `payload.figure`a yazıyor:

    "two hundred thousand dollars"  → 200,000
    "for eighteen days"             → 18
    "In Seattle the passengers"     → SEATTLE

Cümlede sayı ya da özel isim yoksa alan YAZILMAZ ve `FigureCard` çizilmez.
`evidence_board` hariç tutuluyor: o zaten tarihi taşıyor.

Cooper anlatısında 7/19 sahnede gerçek veri çıktı.

### AKSAN TAVANI: kodda çizmek oranı garanti ETMİYOR

`OffsetStroke`un ilk sürümü hero kartının TAM BOYUTUNDA bir blok çiziyordu ve
hero bandı %66'ya çıkınca kareyi yuttu. Ölçüm: **kırmızı payı %25.9**, tavan %8,
referansta %3.6.

Bu, 7. turda modeli eleştirdiğim hatanın birebir aynısı — orada "ONE hot red
signal accent" cümlesi dev kırmızı blok olarak çizilmiş ve %11.2 ölçülmüştü.
**Kodda çizmek oranı garanti etmiyor; oranı garanti eden şey ölçüm.**

Vuruş artık şerit (kalınlık sabit, kenar boyunca): %25.9 → %0.83.

### Ölçülen doluluk (aksan düzeltildikten SONRA)

    bomba başlangıç        16.4   (kırmızı %0.00)
    bomba şimdi            20.9   (kırmızı %1.19)
    "200,000" sahnesi      31.1   (kırmızı %0.00)
    "18" sahnesi           10.5   (kırmızı %0.83)
    hedef (kanıt masası)   31.0   (kırmızı %0.10)

**DÜRÜST NOT:** ara ölçümde "18" sahnesi 34.5 görünüyordu ve o rakam SAHTEYDİ —
dolduran şey dev kırmızı bloğun kendisiydi. Aksan düzeltilince 10.5'e indi.
Dev rakamı olan sahneler hedefe ulaşıyor (31.1), olmayanlar hâlâ yarı yolda.

**Yazarken iki hatamı ölçüm yakaladı:** ilk katman tonları (#E6DFCE/#EFEADC/
#F3F1E8) zeminin kendi lekelerini örtüp kareyi SOLDURDU — katman zeminden ayırt
edilebilmeli, yoksa dolduruyor gibi görünüp siliyor. Ve `LowerRegister`
`hero_cutout`'ta başlığın üstüne bindi, çünkü o şablon başlığı alt banda koyuyor.

## Tek tıkta video: konu seç → Actions → MP4

`.github/workflows/render.yml` — **manuel**, cron yok, upload yok.

    topic          content/story-*.json
    provider_chain gemini,pollinations   (429 → pollinations devralır)
    images         evet/hayır            (hayır = tamamen prosedürel)
    archive        evet/hayır            (Wikimedia + LoC, anahtarsız)
    quality        final | preview

Sıra: storyboard → **görsel bütçesi** → arşiv → üretim → segmentasyon → alfa
kapısı → storyboard'a bağlama → render → **sessizlik ölçümü** → doğrulama.

**Eski hâli ESKİ HATTI çalıştırıyordu** (`npm run cutouts --live`, sahne başına
tek cutout): segmentasyon yok, bütçe yok, `flow:pack` hiç çağrılmıyor. Yani bu
oturumda ölçülerek düzeltilen hiçbir şey render hattına girmiyordu.

**SES VE ALTYAZI YOK, VE BU ÖLÇÜLÜYOR — kapı ilk denemede kendi render'ımızı
düşürdü.** `storyboard.audio` yazılmadığı sürece `<Audio>` hiç render edilmiyor,
altyazı zaten hiç yoktu. Ama "eklemedik" demekle "yok" demek aynı şey değil:
yerelde ölçüldü ve Remotion `<Audio>` olmadan da **boş bir AAC izi** ekliyordu
(ses akışı sayısı 1). Render artık `--muted` ile koşuyor; aynı ölçüm 0 veriyor.
`ffprobe` kapısı duruyor, çünkü kapı olmasaydı bu hata sessizce yayına giderdi.

**Sağlayıcı çökerse video YİNE ÇIKAR.** Üretim, arşiv ve kesim adımlarının üçü
de `continue-on-error`; bütçedeki sahneler prosedürel siluete düşer. Ölçüldü:
15 şablonun 13'ü fotoğrafsız da tam çiziyor.

Cooper anlatısında ölçülen gerçek sayı: **video başına 8 görsel** (19 beat,
7'si bütçede, plakalar kapalı).

## Görsel bütçesi: bir Short kaç görsel ister

Sayıldı, çünkü ölçek sistemin şeklini belirliyor.

74 saniyelik bir Short = **19 beat**. Eski hâl her beat için görsel istiyordu:
B yolunda 21 parça, A yolunda 17 kare. Günde 1 Short = **ayda 630 görsel**.
Ölçülen başarı oranı: 7. turda 0/5 kullanılabilir, 6. turda kesim 5/5 temiz ama
ÖZNE 0/5 doğru. O ölçekte elle ayıklama imkânsız.

**Ama 15 şablonun 13'ü fotoğrafsız da tam çiziyor** — ya tamamen kod
(`map_route`, `grid_scale`, `data_annotate`, `archival_timeline`,
`split_compare`), ya prosedürel siluete düşüyor. Yalnızca `collage_build` ve
`archive_clip` malzemeye MUHTAÇ. Yani sistem bugün **sıfır görselle** eksiksiz
bir Short üretebiliyor; fotoğraf bir bağımlılık değil, bir **yükseltme**.

Bütçe referansın kendi oranından geliyor (bu belgede zaten ölçülüydü):
*"referans videonun çekimlerinin yaklaşık üçte ikisinde hiç fotoğraf yok."*

    PHOTO_BUDGET_RATIO = 1/3      → 19 beat için 7 görsel
    ayda 630 değil, ayda ~180

`build-flow-pack.mjs` bütçeyi UYGULUYOR: bütçe dışı beat için promt dosyası
**yazılmıyor**, yoksa üretim adımı onu da kuyruğa alır ve bütçe kağıt üstünde
kalır. Sıralama: önce malzemeye muhtaç sahneler, sonra `PHOTO_WORTH` şekilleri
(figure, building, vehicle, aircraft, rail, vessel, terrain).

`PHOTO_WORTH` dışında kalanlar bilinçli: belge, damga, harita, tablo, yıldız —
bunları kod daha iyi çiziyor ve ölçüldü (`evidence_board`: tarih, damga, tarife,
gravür harita, hepsi kodda ve kusursuz). Onlar için fotoğraf istemek kotayı
modelin **en kötü olduğu yere** harcamak olurdu.

## Kompoze kare promtu: motorun sahne kalıbı

Kullanıcının verdiği üç örnek promt aynı kalıbı kullanıyor ve kalıp **TEK AKAN
CÜMLE**, virgülle bağlı:

> "A single torn calendar page dominates the frame **as the hero element**,
> hand-torn from aged newsprint, **carrying the stamp-printed label NOV 24 1971
> in condensed black type inside a red rubber-stamp box**, pinned at a slight
> angle to a bare archival paper surface, one strip of masking tape at its
> corner and a faint coffee-ring stain nearby **as the only supporting
> elements**, wide empty margins around it."

ÖLÇÜLDÜ: stil bloğu **birebir**, closer da yalnızca izin verilen 16:9 → 9:16
farkıyla **birebir**. Sapan tek yer sahne cümlesiydi ve dört sapması vardı:

1. **"Vertical 9:16 editorial documentary paper collage." ön eki.** Örneklerin
   hiçbirinde yok. Kategori adını en başa koymak özneyi geriye itiyor — bu
   deponun parça promtunda birebir aynı hata ölçüldü ("A single hand-cut paper
   collage element: a man" → çıkan şey adam değil yırtık kağıttı). En-boy zaten
   closer'da.
2. **Dört ayrı cümle.** Nokta ağırlığı böler; virgül öğeleri aynı sahnenin
   parçası olarak bağlar.
3. **"as the hero element" ve "as the only supporting elements" işaretleri
   yoktu.** İkincisi kalabalığı kesen ifade — "no clutter" kuralının olumlu
   hâli.
4. **Etiket ayrı cümledeydi** (`A short stamp label reads "…"`). Örnekler
   etiketi hero'nun İÇİNE gömüyor ve NASIL göründüğünü de söylüyor.

Kalıp artık `test/beats.test.mjs` ile ölçülüyor, çünkü bu depoda stil bloğu iki
kez sessizce kaydı.

## Evrensel hareket promtu bir ŞARTNAME — motor ona göre ölçülür

`out/flow-pack/UNIVERSAL-VIDEO-PROMPT.txt` yalnızca i2v modeline verilen metin
değil; **bu deponun hareket motorunun sözleşmesi**. İki maddesi kesin ve artık
`test/film.test.mjs` ikisini de ölçüyor:

- *"No element moves again after it lands."*
- *"By 7 seconds the frame exactly matches the provided image"*, ardından
  7-10. saniyede *"everything holds position, nothing changes location"*.

**İKİSİ DE İHLAL EDİLİYORDU, ölçüldü:**

1. `drift` sürüklenmeyi sahnenin TAMAMINA yayıyordu; 6 saniyelik bir sahnede
   son %25'te katman hâlâ 3.2 px kayıyordu. Artık `HOLD_FROM` (0.70) oranında
   tamamlanıp KİLİTLENİYOR. `curlAmount` zaten aynı eşiği kullanıyordu; ikisinin
   aynı sayıyı kullanması şart, yoksa köşe kalkarken katman hâlâ kayar.
2. `cue` girişleri sahnenin %86'sına yayıyor ve 10 saniyelik bir
   `evidence_board` sahnesinde son öğe 7.29'da girip 7.69'da yerleşiyordu —
   kurulum tutuş fazına taşıyordu. `cue` artık `span` parametresi alıyor;
   promtu izleyen şablon `HOLD_FROM` geçiyor, son öğe 7.20'de yerleşiyor.

**%86 GLOBAL OLARAK DÜŞÜRÜLMEDİ** ve bu bilinçli: o değer "ölü kuyruk" ölçümüyle
kondu (map_route 2.8 sn sahnesinin son 2.25 saniyesinde değişim %0.00). Kuyruğu
dolduran şey artık geç giren bir öğe değil, TUTUŞ FAZININ KENDİSİ — köşe
kalkması ve nefes. O fazı olmayan 14 şablon eski davranışta kalıyor.

Promtun kilit maddeleri de teste bağlandı (`evrensel hareket promtu kilit
maddelerini taşır`), çünkü bu depoda stil bloğu iki kez sessizce kaydı.

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

## Referans kare söküldü: karede TEK fotoğraf var

Kullanıcının kalite çıtası olarak verdiği Aylesbury karesi (8 AUG 1963)
öğelerine ayrıldığında şu çıkıyor:

| öğe | ne o | kim çizer |
|---|---|---|
| dev yırtık takvim "8 / AUG / 1963" | tipografi | `DateTear` |
| "8 AUG 1963 9-AM BUCKS" posta damgası | tipografi | `PostmarkRing` |
| BUCKINGHAMSHIRE altın etiket | tipografi | `LabelCard` |
| gravür ilçe haritası + yer adları | çizgi + tipografi | `evidence_board` |
| L.N.W.R. tarife kupürü | tipografi (tablo) | `RecordClip` |
| bant, pirinç raptiye, kırmızı ip | çizim | `Fixings` |
| Aylesbury istasyonu | **tek fotoğraf** | model / arşiv |

Karede fotoğraf BİR TANE ve kabaca alanın onda biri; geri kalanı yazı, çizgi
ve kağıt. **Hat o karenin TAMAMINI görsel modelinden istiyordu ve iki kere
kaybediyordu**: model takvim yerine manken çiziyor (6. tur, 5/5) ve okunur harf
hiç basamıyor (4 plakanın 4'ünde uydurma manşet). Bu depo zaten "kod çizer:
harita, rota, zaman çizelgesi, tipografi" diyordu — eksik olan kural değil,
`src/paper/Evidence.tsx`teki üç bileşendi.

`evidence_board` şablonunun yerleşimi referanstan ÖLÇÜLDÜ (kutu oranları
`src/scenes/index.tsx` içinde yazılı). İlk sürüm oranları SAFE_BOX'a
uygulamıştı ve karenin alt %40'ı boş kaldı; oranlar artık kanvasa uygulanıyor.

**VERİ UYDURULMAZ.** `evidence_board` sözleşmesi TAM tarih istiyor (gün + ay +
yıl, üçü de cümlede geçmeli); yoksa şablon reddedilir ve `cold_open` eski
şablonlarına düşer. `postmark` ve `record` alanları derleyici tarafından
DOLDURULMUYOR — damga saati ya da tarife satırı anlatıda yoksa uydurulamaz.

## Görsel malzeme: parça parça, tek kare değil

Varsayılan yol **B**: sahne başına 2-4 **parça** (kare başına tek baskın nesne;
zemini ne olursa olsun, kesme işini `segment.py` yapıyor). Kağıt zemini kod
çiziyor (`PaperAged`); modelden plaka istemek varsayılan olarak KAPALI.
`CollageBuild` şablonu parçaları katman katman, anlatı sırasıyla diziyor.

```
npm run beats -- content/story-<ad>.json
npm run flow:pack                  # out/flow-pack/ — prompt'lar + ASSET-LIST.txt
# üretilen görselleri collage-raw/ altına ASSET-LIST'teki adlarla koy
npm run collage                    # segmentasyon → alfa, storyboard'a bağla
npm run sheet                      # tek kareye bak (render'a girmeden)
```

- **Neden tek bitmiş kare değil**: bitmiş kolajı Remotion AYIRAMAZ, öğeler
  piksele gömülüdür. Yapılabilecek tek şey kareyi bütün olarak kaydırmak, ki o
  da düz animasyon demek. Parçalar ayrı gelince bu deponun hareket motoru
  devreye giriyor: kamera gerçekten kilitli, tarih ve sayı değişmiyor (metni
  Remotion çiziyor), çıktı deterministik. A yolunda (Flow i2v) üçü de ÖLÇÜMLE
  elde edilemedi.
- **ZEMİNİ MODELDEN İSTEMEK BÜSBÜTÜN TERK EDİLDİ — kesme işi bize geçti (5. tur).**
  Beş tur boyunca parça promtu modelden temiz bir zemin istedi (önce magenta,
  sonra düz beyaz). 5. turun ölçümü (a83d56d ile koşan run, sağlayıcı
  Pollinations/FLUX): **beş görselin beşinde de dış %4 şeridinde beyaz piksel
  oranı %0.0.** Aynı turda büyük harfle yazılmış iki talimat daha tutmadı —
  plaka "ABSOLUTELY NO WRITING OF ANY KIND" yasağına rağmen uydurma manşetle
  geldi, portre "black censor bar" talimatına rağmen barsız geldi.
  Üç açık talimat, tek tur, üçü de boşa. Bu bir promt kusuru değil: bedava
  uçtaki schnell sınıfı FLUX guidance-damıtılmış, o sınıfta "no X" biçimindeki
  talimatın yönlendirme gücü pratikte sıfır. Altıncı turda promta daha çok
  büyük harf eklemek altıncı kez aynı duvara çarpmaktı.
  **Çözüm modelle kavga etmek değil, işi ondan almak:** `pipeline/segment.py`
  (rembg / `isnet-general-use`) özneyi zeminden BAĞIMSIZ kesiyor. Aynı beş
  görselde ölçüldü — 5. turun kendi çıktılarında:
  `02-fact-a` %36.6, `01-cold_open-a` %17.7, `01-cold_open-b` %62.6 kaplama,
  üçünde de dış çeper %0.0. Model yaşlanmış arşiv sayfası çizmeyi seviyor ve o
  sayfa malzeme olarak zaten istediğimiz şey; bırak çizsin, özneyi biz kaldır.
  Mod zinciri artık `seg → matte → chroma → ink`, beklenen mod `seg`.
- **ALFA KAPISI SIKILDI — "geçti" demek "kesildi" demek değildi.** Eski tavan
  %94'tü ve 5. turda matte beş görselin beşinde de geçti: `02-fact-a` %90.9
  opak, yani neredeyse tam dikdörtgen, ve öylece storyboard'a bağlandı.
  Yeni kapı: opak ≤ %78 **ve** dış çeper ≤ %15. Çeper ölçüsü ayrı duruyor
  çünkü kesilmemiş bir dikdörtgen çeperi doldurur (ölçülen: %40'a kadar),
  gerçek bir kesikte çeper boştur (ölçülen: %0.0). Test:
  `test/cutout.test.mjs` → "kesilmemiş dikdörtgen alfa doğrulamasından geçmez".
- **PLAKA ARTIK MODELDEN İSTENMİYOR (varsayılan kapalı).** 4. ve 5. turda
  üretilen 4 plakanın 4'ü de uydurma manşet metniyle geldi
  ("YOOLNI IIILNIIRIGLLLID"), birinde ayrıca bir yüz vardı — 5. tur o metni
  yasaklayan promtla koştu. Ayrıca bayrak hiç okunmuyordu: workflow
  `--include-plates` geçiyor, `generate-cutouts.mjs` yalnızca `--no-plates`
  arıyordu, yani girdi ne olursa olsun plaka üretiliyor ve kotanın yarısı
  oraya gidiyordu. Yaşlanmış yüzeyi artık **kod** çiziyor: `PaperAged`
  (`src/paper/PaperBase.tsx`). Ölçüldü — zemin bölgesinin geniş ölçek leke
  std'si 11.70 → 16.81. İlk sürüm `feTurbulence` ile kurulmuştu ve ölçümde
  hiçbir şey yapmadığı görüldü (11.70 → 11.72, ikinci denemede 11.33: yalnızca
  düz koyulaşma), o yüzden leke alanı DOM'da, `rand(seed)` ile deterministik.
- **ÖZNE, BEAT'İN KENDİ SÖZCÜKLERİNİ TAŞIR.** `subjectFor` eşleşen isim
  dışında her şeyi atıyordu: "a man in a dark suit" → "a man: documentary
  photograph of a person". 5. turda o promtun çizdiği şey genç bir kadın
  portresiydi — cümle adamı tarif ediyordu, hat tarifi çöpe atıyordu.
  Artık öndeki sıfatlar ve arkadaki ilk niteleyici öbek cümleden birebir
  alınıyor, öbek üç sözcük ve daha uzunsa sözlüğün genel tarifi hiç eklenmiyor.
  Artikel uyumu da düzeldi ("a attendant" → "an attendant", "a money" → "money").
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
