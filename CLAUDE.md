Bu depo **dikey suç belgeseli reel fabrikası**dır: bir motor, çok bölüm.

Tek cümlelik yasa: **MOTOR BÖLÜMÜ TANIMAZ.** `engine/` içindeki hiçbir satır bir
dosya adı, bir bölüm kimliği veya bir hikâye bilmez. Bölüm bir klasördür —
kod değişikliği değil. İkinci bölüm eklemek `episodes/` altına bir klasör
açmaktır, motora dokunmak değil.

Giriş noktası `npm run render -- --episode=<id>`. Otomatik koşu
`.github/workflows/render-episode.yml` (workflow_dispatch, `episode_id` girdisi).

## Sıfırıncı yasa: SES SAATTİR

Seslendirme bir katman değil, ZAMAN ÇİZELGESİDİR. Sahne süreleri MP3'ün
içindeki satır sınırlarından ÖLÇÜLÜR — tahmin edilmez.

`npm run voice -- --episode=<id>` bütün metni TEK seferde okutur (satır satır
okutmak, kenarlarında farklı miktarda hava olan altı klip verir; oysa ölçülen
şey satırlar ARASINDAKİ boşluktur), karakter hizalamasından her satırın
penceresini çıkarır ve `audio/vo.json` yazar. Planlayıcı o pencereleri keser;
satır içindeki parçalar pencereyi kelime ağırlığına göre böler ve artık kalan
kare SON parçaya gider — böylece toplam tam olarak pencereye eşittir ve reel
kendi anlatısından kaymaz.

`vo.json` yoksa süreler `kelime / 2.7 * 30` ile TAHMİN edilir ve koşu bunu
ekrana yazar. Tahminle kesilmiş bir reel taslaktır; sessizce bitmiş görünmemeli.
`vo.json` commit edilir (config'teki her süre ona göre kesildi), `vo.mp3`
edilmez.

## Zincir

```
episodes/<id>/brief.json            → altı satır, ~80 kelime, otuz saniye
        ↓
scripts/voice-episode.mjs           → vo.mp3 + vo.json (ÖLÇÜM)
        ↓
episodes/<id>/scene-config.json     → bölümün tek gerçeği (sahneler, süreler, look)
        ↓
scripts/render-episode.mjs          → doğrula → publicDir = episodes/<id> → bundle
        ↓
engine/Root.tsx (calculateMetadata) → fps/en/boy/süre config'ten gelir
        ↓
engine/Episode.tsx                  → <Sequence> zinciri, sahne başına FilmLook
        ↓
engine/sceneTypes/registry.ts       → sceneType → şablon
        ↓
engine/sceneTypes/*.tsx             → plakalar, hareket, gölge
engine/draw/*.tsx                   → ışık, kâğıt, işaretleme, tipografi
        ↓
out/<id>.mp4
```

## Değişmez kurallar

1. **DOSYA ADI CONFIG'TEDİR, KODDA DEĞİL.** Şablon `assets.character` gibi bir
   ROL okur; o rolün hangi dosya olduğu bölümün işidir.
   `test/enginePurity.test.mjs` motorun içinde geçen her dosya uzantısını,
   her `episodes/` yolunu ve her bölüm kimliğini düşürür.
2. **İNSAN VE MEKÂN FOTOĞRAFTIR, GERİ KALAN HER ŞEY ÇİZİLİR.** Bu deponun en
   pahalı ikinci dersi. Işık, gölge, kâğıt, gazete, kart, plaket, altı çizgi,
   oval, tel-kafes, tipografi ve noktalama `engine/draw/` içinde KODLA çizilir.
   Üreticiye yalnız insan, mekân ve doku sorulur. Prosedürel bir insan tabela
   piktogramıdır; prosedürel bir gazete ise sadece tipografidir ve belgesel
   grafiği zaten odur. Gazeteyi, eskizi, bot izini üreticiye yıkmayı denedik —
   patlayanlar tam onlar oldu.
3. **PREMIUM GÖRÜNTÜ FOTOĞRAFTA DEĞİL, ÜSTÜNE ÇİZİLEN KATMANDADIR.** Fotoğrafta
   lamba vardır, ışığı yoktur: `Glow` ampule screen blend'li dört radyal
   gradyan koyar ve plaka zoom'lanırken ONUNLA BİRLİKTE ölçeklenir — sahne
   koordinatına çakılı bir ışık lambadan kayar ve lens parlamasına döner.
   `Annotation` kendini çizer (fade değil), `WordStack` satırları tek tek
   indirir, `focusHunt` çekimi kesmez buldurur ve çizilen ışığa defokusu
   söyler; yumuşak gradyan bulanıklıktan etkilenmediği için aksi halde
   yumuşamış karede keskin durur.
4. **BİR ÇEKİM FOTOĞRAF DEĞİL, KATMAN YIĞINIDIR.** Referans kit bunu bitiriyor:
   açılış karesi gökyüzü + farklı hızda kayan iki KESİLMİŞ bulut + KESİLMİŞ bina
   + figür + çerçeve + kâğıt dokusu. Yedi parça, hiçbiri bütün bir resim değil.
   Arka plan bile parçalardan kurulur. `composite` şablonu istenen kadar katman
   alır ve hepsi TEK bir sayıya bağlıdır: **depth**. 0 gökyüzüdür, kamera
   itişinden pay almaz; 1 çapadaki öznedir, itişin tamamını alır; 0.5 bina
   yarısını alır. Parallax, mekân hissi, düz plakanın düz görünmekten çıkması —
   hepsi o tek sayıdan doğar. Her katman AYNI çapa etrafında ölçeklenir; ayrı
   merkez verilirse katmanlar bir oda gibi tutunmaz, birbirinin üstünde kayar.
5. **YEDİ PAYLAŞILAN ŞABLON.** `portal-zoom-reveal`, `parallax-punch`,
   `stacked-reveal`, `split-shift`, `title-slate`, `evidence-board`, artı
   `composite` — diğerlerinin özel hâli olduğu genel şablon. `title-slate` ve
   `evidence-board`
   grafik önceliklidir: hiç fotoğraf istemeden çalışır, yani eksik bir asset'te
   ölmezler. Bir bölüm kendi şablonunu `episodes/<id>/scenes/index.tsx` içinde
   kaydedebilir; paylaşılan altıya bölüme özel bir şey eklenmez.
6. **DERİNLİK DOSYADA DEĞİL, İKİ PLAKANIN BİRBİRİNE GÖRE HAREKETİNDEDİR.**
   Karakter arka plandan DAHA SERT yaklaşır (eşit ölçek zoom'dur, farklı ölçek
   derinliktir) ve ikisi de YERDEKİ AYNI NOKTA etrafında ölçeklenir
   (`groundX`/`groundY`). Ortak çapa kaçarsa özne zeminden kayar — bu efektin
   bozulmasının bir numaralı yolu.
7. **GÖLGE AYRI BİR ASSET DEĞİLDİR.** Karakterin kendi dosyası siyaha boyanır,
   ayaklarından aşağı çevrilir ve zemine yatırılır. Karakter gönderen bölüm
   gölgesini bedava gönderir.
8. **ÖZNE PLAKASI ÇERÇEVEYİ KAPLAMAZ.** Tam kadraj plaka duvar içindir;
   bir insan `plateWidth` + `footX`/`footY` ile boyutlanır ve ayakları
   üzerinde durur. 1080x1920'e esnetilen bir cutout tüm kareyi doldurur ve
   önünde hiçbir şey hareket edemez — derinlik ölür.
9. **FİLM İŞLEMESİ TEK YERDEN GELİR.** Grain, grunge, tarama çizgileri,
   vignette, gate weave ve grade `engine/FilmLook.tsx` içindedir. Hiçbir şablon
   kendi grain'ini yazmaz; sahne yalnız `gradeOverride` ile bölümün grade'ini
   ezer.
10. **HER DEĞER PROPTUR.** Şablonun içinde gizli sabit bırakılmaz; sayılar
   `params` üzerinden gelir ve `num('key', fallback)` ile okunur. Fallback
   çerçeve boyutuna göre hesaplanır, bölüme göre değil.
11. **KARE SAYILARI SAHNENİN KENDİ BAŞLANGICINA GÖREDİR.** `onScreenText.atFrame`
   ve `params` içindeki bütün kare değerleri sahne sıfırından sayılır — reel
   sıfırından değil. Sahne başlangıçları `sceneOffsets` ile toplanır, config'te
   iki kez yazılmaz.
12. **ŞEMA TEK UYGULAMADIR.** `engine/schema.mjs` düz JavaScript'tir çünkü hem
   doğrulayıcı script hem render bundle AYNI doğrulamayı çalıştırmak
   zorundadır. Tipler `engine/schema.ts` içindedir. İkiye ayrılırsa config
   doğrulamayı geçer ve render'ı çökertir.
13. **BİLİNMEYEN SAHNE TİPİ SESSİZCE ATLANMAZ.** Kırmızı bir MISSING TEMPLATE
    kartı çizilir ve doğrulayıcı zaten render'dan önce düşürür.
14. **FOTOĞRAF KİM VE NEREDE'Yİ SÖYLER; NE OLDU'YU MOTİF SÖYLER.** Bir plaka
    "sonra para geldi" diyemez. `engine/draw/Motif.tsx` cümlenin FİİLİNİ oynar:
    `coins` düşer ve YIĞILIR (yığın tabanda geniştir ve büyümesi cümlenin
    kendisidir), `route` kendini çizer, `rise` sayar, `tally` çentik atar,
    `rays` ve `embers` atmosfer verir. Karede bilerek değişen tek şey odur, o
    yüzden göz onu izler. Üç kural: satır bunu SÖYLEMİŞ olacak, aynı çizim
    peş peşe iki kez gelmez, üst üste üç sahne süslenmez — çıplak sahne
    diğerlerini var eden şeydir. Motif kareye çakılıdır, kamera itişinden pay
    almaz; odaya bağlanırsa grafik olmaktan çıkar, kayan bir aksesuar olur. Ve
    tip kartının ortası yazınındır: `route` ile `tally` slate'e girmez.

15. **BİR SAYI YA TIRMANIR YA DURUR; İKİSİ BİRDEN OLMAZ.** `countTo` sayının
    BÜYÜKLÜĞÜNÜ hissettirir, `spinTo` SEÇİLMİŞ olduğunu — başka bir şey de
    olabilirdi, bu çıktı. Hangisi olduğu bölümün seed'inden bir kez seçilir;
    aynı reel'de ikisi de kullanılırsa hiçbiri anlam taşımaz. Slot, slate'in
    ÜSTÜNE değil, başlığın kendi yerine çizilir — üstüne çizilirse sayı
    kicker'ın ve footer'ın içinden geçer.
16. **VURGU, GÖLGE NUMARASININ RENKLİ HÂLİDİR.** Aynı dosyanın ikinci kopyası,
    üstüne tam oturur, `recolour` ile boyanır ve `flicker` ile HOLD
    keyframe'lerde yanıp söner — asla fade değil; rampa koyarsan floresan
    çakması dissolve'a döner. Yeni asset yok. Cümle altından/ateşten
    bahsetmiyorsa vurgu da yok: her sahnede olan bir vurgu filtredir.
17. **GRADE CÜMLENİN PARÇASIDIR.** Kapanış ve kül sahnelerinde renk çekilir,
    kontrast artar; altın ve ihtişamda ısınır. Üç kayıt, dokuz değil — her
    sahnesi ayrı derecelenmiş bir reel'in grade'i yoktur, titremesi vardır.

## İş bölümü — bu deponun en pahalı dersi

Önceki hat (`collage-factory-son`) **görsel malzemeyi üretemediği için**
terk edildi: bedava üreticiler masaya konmuş kitap fotoğrafı ve bozuk yazı
verdi; prosedürel siluetler tabela piktogramı olmaktan çıkmadı.

Bu hat aynı duvara çarpmaz çünkü malzeme koda sokulmaz:

- **GÖRSEL BÖLÜMÜN İÇİNDEDİR** — `episodes/<id>/assets/`. Render bir üreticiyi
  ÇAĞIRMAZ; diskteki dosyayı okur. Doğrulayıcı hepsinin diskte ve boş
  olmadığını render'dan önce kontrol eder.
- **ÜRETİM AYRI BİR ADIMDIR.** `scripts/generate-assets.mjs` +
  `.github/workflows/generate-assets.yml` görselleri çizer ve **commit eder**;
  o andan sonra sıradan bir dosyadırlar. Reçeteler `episodes/<id>/assets.json`
  içindedir — istem de dosya adı gibi bölümün işidir. Bu ayrım şart: üretici
  bozulursa üretim adımı patlar, bitmiş bir bölüm sessizce değişmez. Aynı
  isim aynı seed'i verir, yani tekrar çalıştırmak aynı resmi getirir.
- **HAREKET MOTORUN İÇİNDEDİR** — `engine/motion.ts` sayı alır, sayı döndürür;
  ne çizdiğini bilmez. Bu yüzden ikinci bölüm bedavadır.
- **DERİNLİK OYNATILIR** — 3D yok, plugin yok: ortak çapaya oturtulmuş katmanlar,
  öznenin kendisinden yapılan gölge, ayaklarda dönen ölçek.
- **EKSİK ASSET REEL'İ DURDURMAZ** — `"?character"` diye yazılan rol diskteyse
  kullanılır, yoksa sahne onsuz çalışır. Figür isteyen bir sahne figürsüz
  değersizdir ama figürü zorunlu yapmak, üreticinin kötü gün geçirdiği gün
  bütün reel'i durdurur; sahne kendini indirir.

## Doğrulama

`npm run validate` render yapmadan üç saniyede cevap verir: şema, sahne tipi ve
her asset'in diskte olup olmadığı. Eksik bir PNG'de ölen render bundle'ı,
tarayıcıyı ve kuyruk slotunu çoktan ödemiştir.
`npm test` motor saflığını, şemayı, registry tutarlılığını ve depodaki her
bölümü kapıda tutar.

Ama bu deponun gördüğü her görsel kusur — kareyi dört kez karartmak, tipografiyi
yumuşatana kadar zoom'lamak, lambadan kayan ışık, birbirini gömen kartlar, tam
kadraj portalın üstüne çizilen harita yayı — doğrulamayı da testleri de geçti ve
tek bir karede belliydi. O yüzden BAKMAK ucuzdur:

- `npm run frames -- --episode=<id> [--per=2]` reel'den birkaç kare alır ve
  ızgara yapar. Sahneye göre örnekler: iki saniyelik bir slate ile yedi
  saniyelik bir composite aynı ilgiyi hak eder. `--per=2` şart olan yerdir —
  yığılan bir motif, kendini çizen bir yol ve tırmanan bir sayı tek karede
  hiçbir şey göstermez.
- `npm run assets:review -- --episode=<id>` cutout'ları dama tahtasına dizer.
