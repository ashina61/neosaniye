Bu depo **dikey suç belgeseli reel fabrikası**dır: bir motor, çok bölüm.

Tek cümlelik yasa: **MOTOR BÖLÜMÜ TANIMAZ.** `engine/` içindeki hiçbir satır bir
dosya adı, bir bölüm kimliği veya bir hikâye bilmez. Bölüm bir klasördür —
kod değişikliği değil. İkinci bölüm eklemek `episodes/` altına bir klasör
açmaktır, motora dokunmak değil.

Klasörü `npm run new -- --id=<id> --title="…" --mood=<mood>` açar: brief
şablonu, kesim ve yer tutucular. İlk saniyeden geçerli bir bölüm çıkar —
sonra ALTI SATIRI yazarsın, gerisi türetilir.

Giriş noktası `npm run render -- --episode=<id>`. Otomatik koşu TEK
workflow: `.github/workflows/reel.yml`. Push/PR'da ucuz kapı (`check`);
"Run workflow" ile fabrika (`make`): **seslendir → görsel → render**, her adım
açılıp kapanabilir. Ayrı workflow değiller çünkü tek bir zincir: seslendirmeyi
yenilemek kesimi, kesim de görsellerin sahne kimliklerini değiştirir.

## Sıfırıncı yasa: SES SAATTİR

Seslendirme bir katman değil, ZAMAN ÇİZELGESİDİR. Sahne süreleri MP3'ün
içindeki satır sınırlarından ÖLÇÜLÜR — tahmin edilmez.

**Konuşmak ve ÖLÇMEK iki ayrı adımdır.** Konuşmak bir sağlayıcıya aittir
(ElevenLabs, OpenAI, mikrofon, biri); ölçmek `scripts/lib/measure.mjs`'e aittir
ve HER ŞEYDE çalışır. Duraklar dosyanın içindedir; onları bulmak API değil örnek
ister. Tek bir sağlayıcının zaman damgasına bağlanırsan, o sağlayıcı hata
verdiği gün saat de gider.

Ölçüm sessiz koşuları bulur ve en uzun (satır − 1) tanesini alır. "Eşiği geçen
her sessizlik" değil: anlatıcı cümlenin ortasında da nefes alır, ve yanlış
sınırı almak ondan sonraki HER satırı yanlış resmin üstüne koyar — üstelik reel
yine render olur. Kaç sınır olduğu bilinir, o yüzden sayı sorulur, eşik değil.
Dosyanın başındaki sessizlik sınır sayılmaz. Hiç durak bulunamazsa iş
UYDURULMAZ, reddedilir.

`npm run voice -- --episode=<id> [--measure]` bütün metni TEK seferde okutur (satır satır
okutmak, kenarlarında farklı miktarda hava olan altı klip verir; oysa ölçülen
şey satırlar ARASINDAKİ boşluktur), karakter hizalamasından her satırın
penceresini çıkarır ve `audio/vo.json` yazar. Planlayıcı o pencereleri keser;
satır içindeki parçalar pencereyi kelime ağırlığına göre böler ve artık kalan
kare SON parçaya gider — böylece toplam tam olarak pencereye eşittir ve reel
kendi anlatısından kaymaz.

`vo.json` yoksa süreler `kelime / 2.7 * 30` ile TAHMİN edilir ve koşu bunu
ekrana yazar. Tahminle kesilmiş bir reel taslaktır; sessizce bitmiş görünmemeli.
Ses dosyası da `vo.json` da COMMIT EDİLİR. Render taze checkout yapıyor ve
config `audio:` diyor — dosya orada olmazsa doğrulama düşer. `vo.json` da
gitmek zorunda: config'teki her süre ona göre kesildi.

Piper satır satır okur ve klipleri BİZ birleştiririz; orada sınırlar ölçüm
değil aritmetiktir, çünkü sessizliği koyan biziz. Kural aynı: sınır klibin
SONUDUR.

## Zincir

```
episodes/<id>/brief.json            → altı satır + HER SATIRIN KOREOGRAFİSİ
        ↓
scripts/voice-episode.mjs           → vo.mp3|wav + vo.json (ÖLÇÜM)
        ↓
scripts/lib/story.mjs               → NE OLDUĞU (vuruş tipi, görsel fikir, ritim)
        ↓
scripts/lib/assetdirector.mjs       → GÖSTERİLEBİLİR Mİ (puan, yeniden rol, RED)
        ↓
scripts/lib/representation.mjs      → NASIL GÖSTERİLİR (foto, hibrit, prosedürel)
        ↓
scripts/lib/visual.mjs              → HİYERARŞİ, kadraj, tek tipografi sistemi
        ↓
scripts/lib/director.mjs            → NE ZAMAN OLACAĞI (vuruşlar, kamera, kota)
        ↓
scripts/lib/cut.mjs                 → HER DİKÜŞ NE (sert kesim bir cevaptır)
        ↓
episodes/<id>/scene-config.json     → bölümün tek gerçeği (sahneler, süreler, look)
        ↓
scripts/lib/temporal.mjs            → HER KAREDE geçerli mi (durum makinesi)
        ↓
scripts/lib/editor.mjs              → bu bir REEL mi (ritim, yoğunluk, slayt)
        ↓
scripts/lib/critique.mjs            → sıkıcı reel'i GÖREN kontrol
        ↓
scripts/render-episode.mjs          → doğrula → publicDir = episodes/<id> → bundle
        ↓
engine/Root.tsx (calculateMetadata) → fps/en/boy/süre config'ten gelir
        ↓
engine/Episode.tsx                  → <Sequence> zinciri, sahne başına FilmLook
        ↓
engine/Camera.ts                    → çekim başına TEK kamera; katman payını depth'ten alır
        ↓
engine/sceneTypes/registry.ts       → sceneType → şablon
        ↓
engine/sceneTypes/*.tsx             → plakalar, hareket, gölge
engine/draw/*.tsx                   → ışık, kâğıt, işaretleme, tipografi
engine/draw/Kinetic.tsx             → kelime kelime iniş, VURGU kelimesi, sayaç
engine/draw/Diagram.tsx             → meshleyen dişliler, zaman çizelgesi, yörünge
engine/state.mjs                    → frame N'de ne var; çizen ve doğrulayan aynı fonksiyon
        ↓
out/<id>.mp4
```

## Sıfırıncı yasa, ikinci hâli: KOREOGRAFİYİ YAZAN DÜŞÜNÜR

Referansın yöntemi bir düşünme adımı içerir: modele "her satır için sahneyi,
ekrandaki kelimeleri, duygusal vuruşu, BİR İMZA ANİMASYONU ve gereken assetleri
söyle" denir; sonra sahne başına ayrı bir istem gelir ve kareleri tek tek verir
— "0-46'da 1.0'dan 1.16'ya, 62'ye kadar kaynak, sonra ayrış". Koreografiyi
model kurar.

Bu depo iki hafta boyunca onun yerine `rand()` kullandı. Plaketin nereye
gideceğine, kameranın itip itmeyeceğine, hangi şablonun geleceğine zar karar
verdi. Sonuç iki türlü bozuktu: her bölüm bir öncekinin fotoğrafları
değiştirilmiş hâliydi, VE kompozisyon saçmalıyordu — bir üniversite
portikosunun önünde havada duran bir gazete, çünkü onu oraya kimse koymadı.

O yüzden brief artık her satır için `shot` taşır: `template`, tek cümlelik
`signature` (bu çekimin var olma sebebi olan TEK hareket), `camera`
(`from`→`to`; itiş ile geri çekilme iki ayrı çekimdir), ve `props` — çizilen
nesneler, kesirlerle: `size` karenin genişliğinin oranı, `x`/`y` merkezi,
`at` çekimin neresinde indiği, `depth` itişten aldığı pay. Kesir girer, piksel
çıkar: yönetmen "karenin onda sekizi" der, karenin 1080 olduğunu yalnız
derleyici bilir.

Planlayıcı bunu DERLER, ikinci kez düşünmez. Yazılmış olan kazanır; kurallar ve
zar yalnız yazılmamış olanın yedeğidir. Ve **boş bir `props` dizisi bir
karardır** — çıplak çekim diğerlerini var eden şeydir, ona zar atılmaz.

İki ölçü, ikisi de kontak sayfasından öğrenildi: bir nesne **ait olduğu yerde**
durur (gazetenin altında bir yüzey vardır, plaket kaptığı şeyin altında asılır,
havada duran her şey resmin üstüne yapıştırılmış bir grafiktir ve öyle görünür),
ve **öznesi ise kareyi doldurur** — karenin %40'ındaki bir ön sayfa, telefonda
otuz altı piksellik manşetiyle bir çıkartmadır. Ama tam kadraj bir gazete de
bütün bir gazete OLAMAZ: sahte tram bloğu gri bir levhaya, sahte sütunlar gri
çizgilere döner. Yakın çekim sayfanın ÜSTÜNÜ gösterir — logo, çizgi, manşet —
ve sütunlar karenin altından taşar.

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

   **VE BU KANUN `props` İLE UYGULANIR.** Referans reel ~20 asset üstünde
   duruyor ve yalnız DÖRDÜ arka plan; kalan on altısı plaket, gazete, kart,
   tel-kafes, ışık huzmesi — hepsi grafik. Bu hat altı arka plan yapıp bölüm
   sanıyordu ve kalan on dördünü satamayacak bir fotoğraf aramasından satın
   almaya çalışıyordu; oysa `Plaque`, `WireFrame` ve `Beam` `engine/draw/`
   içinde bitmiş hâlde duruyordu, SIFIR şablona bağlı. Artık sahne `props`
   dizisi taşır: dosyasız katman, aynı derinlik, aynı çapa. Motiften farkı şu —
   motif kareye çakılıdır çünkü cümle HAKKINDA bir grafiktir; prop odanın
   içindeki bir nesnedir, o yüzden itişten payını alır.

   İki kural, motiflerinkiyle aynı: **söyleyecek bir şeyi olacak** (plaket
   satırın kendi etiketini, kart kendi başlığını taşır; yalnız `wire` ve `beam`
   saf grafiktir ve en çok onlar kısılır), ve **peş peşe aynısı gelmez**. Ama
   hiçbir çekim eli boş kalmaz: kural ile zar aynı anda ters düşerse iki saf
   grafik sırayla girer — eli boş çekim zaten bu işin bitirmeye çalıştığı şey.

   Masthead bir gazetenin ADIDIR, cümle değil: satırın `footer`'ını oraya koyup
   yirmi iki karakterde kesince manşet "THERE WAS NO MACHINE Y" diye çıktı.
   Cümle MANŞETTİR. Ve çizilen her nesne kareye SIĞAR — punto `fitSize` ile
   kısılır, x ise kendi genişliğini içeride tutacak şekilde kenetlenir, yoksa
   "Hanover · 1956" plaketi "Hanover · 19" olarak teslim edilir.
3. **PREMIUM GÖRÜNTÜ FOTOĞRAFTA DEĞİL, ÜSTÜNE ÇİZİLEN KATMANDADIR.** Fotoğrafta
   lamba vardır, ışığı yoktur: `Glow` ampule screen blend'li dört radyal
   gradyan koyar ve plaka zoom'lanırken ONUNLA BİRLİKTE ölçeklenir — sahne
   koordinatına çakılı bir ışık lambadan kayar ve lens parlamasına döner.
   `Annotation` kendini çizer (fade değil), `WordStack` satırları tek tek
   indirir, `focusHunt` çekimi kesmez buldurur ve çizilen ışığa defokusu
   söyler; yumuşak gradyan bulanıklıktan etkilenmediği için aksi halde
   yumuşamış karede keskin durur.

   **VE PLANLAYICI BUNU İSTEMEK ZORUNDA.** Kanun motorda eksiksiz duruyordu ve
   planlayıcı `glowSize`'ı SIFIR kez set ediyordu: bu hattın çıkardığı her
   çekim bir fotoğraf, yavaş bir itiş ve biraz sisti; devam çekimleri sisi bile
   almıyordu — boş bir `params`, ki bitmiş bir render için "bomboş video"
   denince kastedilen tam olarak budur. Işık bütün bölüm boyunca TEK yandan
   gelir: odadaki ışığın kaynağı vardır, her kesimde yan değiştiren bir ana
   ışığın kaynağı değil titremesi vardır. Ve kaynak KADRAJIN DIŞINDADIR —
   `Glow`'un en içteki katmanı beyaz sıcak ÇEKİRDEKTİR ve ampulün üstüne
   gider; altında lamba olmayan açık karede o çekirdek ışık değil, odada asılı
   duran beyaz bir toptur.
4. **BİR ÇEKİM FOTOĞRAF DEĞİL, KATMAN YIĞINIDIR.** Referans kit bunu bitiriyor:
   açılış karesi gökyüzü + farklı hızda kayan iki KESİLMİŞ bulut + KESİLMİŞ bina
   + figür + çerçeve + kâğıt dokusu. Yedi parça, hiçbiri bütün bir resim değil.
   Arka plan bile parçalardan kurulur. `composite` şablonu istenen kadar katman
   alır ve hepsi TEK bir sayıya bağlıdır: **depth**. 0 gökyüzüdür, kamera
   itişinden pay almaz; 1 çapadaki öznedir, itişin tamamını alır; 0.5 bina
   yarısını alır. Parallax, mekân hissi, düz plakanın düz görünmekten çıkması —
   hepsi o tek sayıdan doğar. Her katman AYNI çapa etrafında ölçeklenir; ayrı
   merkez verilirse katmanlar bir oda gibi tutunmaz, birbirinin üstünde kayar.

   **YIĞIN BRIEF'TE BAŞLAR.** Bu kanun uzun süre yalnız motorda yazılıydı ve
   motor onu uyguluyordu — ama kimse yığın vermiyordu. `write-episode.mjs`
   yazardan tek bir `image` cümlesi istiyor, `pieces` ise "opsiyonel, kullanmasan
   daha iyi" diye geçiyordu; sonuç, altı satırlık bir bölümün ALTI PNG olmasıydı
   ve devam çekimleri aynı plakayı tekrar gösteriyordu. On bir sahne, sekiz
   dosya, dördü bir öncekinin aynısı. O yüzden `pieces` artık ZORUNLU: her satır
   arka planı ve önünde duran 2-4 TEK NESNEYİ söyler, ve bir satır hariç hepsi
   yığın vermezse brief REDDEDİLİR. Bir parça kesilip kendi derinliğine
   konacaktır, o yüzden zaten resim olan bir şey ("masadaki adamlar") parça
   olamaz: çoğul özne dikdörtgene, "şu kadar X" konfetiye keser.

   **AMA PARÇA ANCAK TEDARİK VARSA KONUR.** `"cutouts": true` demeyen bir
   brief'te hiçbir parça yerleştirilmez, ve varsayılan kapalıdır. Sebebi kalite
   değil TEDARİK: temiz bir kesim gerekir ve bu hattın kaynağı yoktur.
   Commons'ta nesnelerin kesimi değil, odaların içindeki nesnelerin fotoğrafı
   vardır — parkta çekilmiş bir bank keylendiğinde dikdörtgen döner, "büyüteç"
   araması ise kusursuz keylenmiş bir çamaşır makinesi kapağı döner. Hiçbir
   eşik ikincisine yetişemez; o bir tedarik sorununun kalite sorunu kılığıdır.
   Referans kit bu duvara çarpmadı çünkü fotoğraf araması kullanmadı: icat
   edilmesi gereken her şey ısmarlama ÜRETİLDİ ve arka planı temizlendi.
   Üretici bağlandığı gün tek kelime açılır, aşağıdaki her şey aynen çalışır.

   Parça yokken zemin itişi KENDİ alır (0.72-0.95). Sığ derinlik parçalar
   duvarı geçebilsin diyedir; parça yokken aynı sayı hiçbir şeyin kıpırdamaması
   demektir — kamera itişinin %4'ünde duran bir çekim, üstünde grain olan bir
   fotoğraftır.

   Parça plakası kareyi KAPLAYAMAZ (bkz. kanun 8) ve bunu motor garanti eder,
   config söz vermez: katman yalnız `height` ister, genişlik asset'in en-boyunu
   izler, ve yatay bir tuval üzerine çizilmiş 970px'lik bir parça 1080px'lik
   karede 1500px genişliğe çıkar. Tavan DERİNLİĞE göredir — düz bir tavan uzak
   ve yakın parçayı aynı boya indirir, yani yığını görünmez yapar.
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

18. **KAMERA İTİŞİ OLAY DEĞİLDİR; ZEMİNDİR.** Bu deponun üçüncü en pahalı
    dersi ve tek karede görülüyordu: dört buçuk saniyelik bir çekim, içeriği
    "bir fotoğraf, 1.0'dan 1.46'ya bir itiş, biraz sis". Üçte birinde ve üçte
    ikisinde alınan iki kare birbirinden ayırt edilemiyordu. Son reel'in yedi
    çekiminden DÖRDÜNDE caption boştu; o dördünde dört buçuk saniyede ekranda
    olan biten şey: resim %13 büyüdü.

    Bir OLAY, karesini gösterebileceğin bir varıştır: kelimelerin inmesi, bir
    kartın masaya düşmesi, bir tel-kafesin özneye kapanması, bir sayının
    tırmanmaya başlaması, bir işaretin kendini çizmesi, kameranın darbe alması.

    Her çekim EN AZ İKİ olay alır, çekimin boyuna yayılmış, ilki erken. 40
    kareden kısa olan bir çekim bir flaştır ve bir tane alır; altı saniyeden
    uzun olan beşten fazlasını almaz — kanun "önemli olanı oynat", "her şeyi
    oynat" değil.

    Bunu `scripts/lib/director.mjs` planlar, `scripts/lib/critique.mjs`
    kontrol eder — olayı sıfır olan çekim HATA, bir olan UYARI — ve şablonlar
    kareleri `params`'tan okuyup çizer. Üçü de gerek: motor bütün kelimeleri
    biliyordu ve planlayıcı hiçbirini istemiyordu.

19. **BİR CÜMLE BİR ÇEKİM DEĞİLDİR, VE BU KURAL UYGULANIR.** `MAX_SPOKEN`
    yıllarca temenniydi: bölme yalnızca virgülde ve bağlaçta olduğu için
    virgülsüz bir cümle ne kadar uzunsa o kadar tek parça geliyordu. Altı
    satırın beşi tek başına 4.5 saniyelik birer çekim oldu. Artık virgül yoksa
    da bölünür — en iyi yer bir cümlecik sınırıdır, tek yer değildir, ve hiç
    olmaması çekimi tutmak için gerekçe değildir.

20. **CÜMLENİN BİR KELİMESİ DİĞERLERİ GİBİ DEĞİLDİR.** "Taş 1.000 TON
    ağırlığında" cümlesinin var olma sebebi tek bir kelimedir. O kelime aksan
    rengini, puntoyu, darbeyi ve çizilen işareti alır; geri kalanı yolundan
    çekilir. Çıplak sayı bir şey söylemez — SAYDIĞI ŞEYLE gelir, yoksa "YİRMİ"
    yazan bir kart mil'i çöpe atmıştır. Ve her kelimesi vurgulu bir satırın
    vurgusu yoktur, bağırması vardır.

    Vurgu ekrandaki KELİMELERDEN çıkarılır, cümleden değil: elle yazılmış bir
    caption'ın vurgusu caption'da yoksa tip katmanı hiçbir şey bulamaz ve bunu
    kimseye söylemez. Satır kırımı da vurgunun etrafında seçilir — iki satıra
    bölünmüş bir rakam vurgulanamaz.

21. **YANLIŞ GÖRSEL, GÜZEL HAREKETLE KURTARILMAZ.** Bu deponun dördüncü ve en
    utandırıcı dersi: bir Yunan batığı hakkındaki reel, sarı bir deniz salyangozu
    makrosuyla açıldı; müze çekmecesi yerine Viktorya dönemi bir konsol gösterdi;
    modern bir kasabanın hava fotoğrafıyla kapandı. Altı arka planın ÜÇÜ yanlış
    resimdi. Hepsi diskteydi, doğru boyuttaydı, iyi pozlanmıştı ve deponun o
    günkü BÜTÜN kontrollerini geçti.

    Bir varlık, OYNADIĞI ROLE göre puanlanır. Beş eksen dosyadan ölçülür
    (çözünürlük, pozlama, kontrast, 9:16 kırpımından ne kadarı kalır, itilecek
    yapı var mı); beş eksen ANLAMSALDIR ve histogramda yoktur — bir dolabın
    MÜZE dolabı olup olmadığı dünya hakkında bir sorudur, dosya hakkında değil.
    O yarı `episodes/<id>/assets.review.json` içinde, bakan birinin yazdığı
    yerde durur.

    **ANLAM PUANI KAPIDIR, ortalama değil.** Yanlış şeyin kusursuz fotoğrafı 7
    değildir; kullanılamaz. Beş yeşil teknik ekseni ortalamaya katmak, konsolun
    müze deposu olarak yayınlanmasının tam olarak sebebidir.

    Ve **REDDETMEK BİR SONUÇTUR.** Kabul edilebilir bir görsel yoksa satır
    sessizce yanlış bir fotoğrafa razı olmaz: `ASSET_REQUIRED` brief'i yazılır,
    çekim çizilmiş bir zemin üzerinde TİPOGRAFİK bir çekime dönüşür. Belgesel
    çekim yokken böyle yapar, ve sonuç kurgulanmış görünür — yanlış fotoğraf
    ise kazınmış görünür.

22. **HER AYGIT KENDİ PAYINA RAZI OLUR.** "Üst üste üç kez" kuralı, bir aygıtın
    reel'in yüzde sekseninde ARALIKLI olarak kullanılmasını göremez: son kesimde
    on kamera hareketinin sekizi geri çekilmeydi ve hiçbiri üç kere arka arkaya
    gelmemişti. Artık kota BÜTÜN reel üzerinden sayılır — hiçbir kamera ailesi
    ~%30'u, hiçbir geçiş ~%25'i aşmaz — ve taşma zara değil, EN AZ KULLANILANA
    gider. Kamera hareketi de zardan değil VURUŞTAN seçilir: reveal iter, verdict
    durur.

    Geçiş kareyi karartıyorsa (blinds, flare, rack) kısa çekimde hiç kullanılmaz,
    ve hiçbir varış çekimin sekizde birinden fazlasını yiyemez — brief elle
    yazmış olsa bile. Bu bir tercih değil, emniyet kuralıdır: 4.5 saniyelik bir
    çekim için yazılmış 11 karelik rack, çekim 1.9 saniyeye indiğinde okunabilir
    ilk karenin beşte birini siler.

23. **EKSİK GÖRSEL ÇÖZÜLECEK BİR PROBLEMDİR; YANLIŞ FOTOĞRAF KULLANMA İZNİ
    DEĞİL.** Sistem asla "resmim yok, rastgele bir resim koyayım" diye
    düşünmez. Sıra bellidir: tam doğru varlık → yüksek güvenli alternatif →
    üretilmiş görsel → PROSEDÜREL yeniden inşa → diyagram → tasarlanmış
    tipografi → bilinçli soyut.

    **ANLAM SERT BİR KAPIDIR.** İlgi ya da tarihsel doğruluk 8'in altındaysa
    varlık REDDEDİLİR — teknik eksenlerin hepsi yeşil olsa bile. "Yaklaşık
    doğru" bu deponun en pahalı hatasıdır: Antikythera'nın röntgeni yerine
    antika pirinç kadranlı bir alet kullanıldı, aile doğru nesne yanlıştı, ve
    belgesel bir iddia olmayan bir şeyle resmedildi.

    Cevap daha iyi bir arama değildi. Mekanizmayı ÇİZMEK, yeniden inşa olduğunu
    söylemek ve dişlileri gerçekten döndürmekti.

24. **PROSEDÜREL GÖRSEL BİRİNCİ SINIF GÖRSELDİR.** Yedek değil: doğru meshleyen
    bir dişli takımı, yanlış makinenin kötü bir fotoğrafından daha iyi bir
    KAHRAMAN çekimdir; elli boş yılın zaman çizelgesi, bir dolabın stok
    fotoğrafından daha iyidir. Seçim "diskte ne var"a göre değil, NEYİ DAHA İYİ
    ANLATTIĞINA göre yapılır — ve tersi de geçerlidir: gerçek fotoğraf en güçlü
    doğru temsil olduğunda o kazanır, ikisi birlikte daha güçlüyse hibrit kazanır.

    Üç kural clipart'tan ayırır: **mühendislik çizimidir** (kareden türeyen
    çizgi kalınlıkları, mono etiketler, tescil işaretleri, tek aksan tek nötr),
    **kendini çizer** (fade değil), ve yeniden inşa edilen her şey bunu KAREDE
    SÖYLER — `SCHEMATIC RECONSTRUCTION · NOT TO SCALE`. Kayıt gibi sunulan bir
    çizim, yanlış fotoğraftan daha kötü bir yalandır: izleyici onu kontrol
    edemez.

25. **NEDENSEL HAREKET.** A hareket eder, B hareket eder, C hareket eder — bu
    dekorasyondur. A döner → B onu döndürdüğü için döner → sayaç otuza varır →
    bütün dişliler yanar: bu motion design'dır. Dişli takımında oran
    fizikseldir (diş sayılarının tersi), yani meshleme sahte değildir.

26. **KIRPILMA GÖZLE DEĞİL HESAPLA BULUNUR.** Ay'ın kesikli yörüngesi iki render
    boyunca karenin üstünden taşıyordu ve buradaki her kontrolü geçti, çünkü
    hiçbiri neyin nerede olduğunu bilmiyordu. Artık her çizilen nesnenin,
    caption'ın ve diyagramın sınır kutusu hesaplanır: kareden taşarsa HATA,
    güvenli alandan taşarsa UYARI.

## İş bölümü — bu deponun en pahalı dersi

Önceki hat (`collage-factory-son`) **görsel malzemeyi üretemediği için**
terk edildi: bedava üreticiler masaya konmuş kitap fotoğrafı ve bozuk yazı
verdi; prosedürel siluetler tabela piktogramı olmaktan çıkmadı.

Bu hat aynı duvara çarpmaz çünkü malzeme koda sokulmaz:

- **GÖRSEL BÖLÜMÜN İÇİNDEDİR** — `episodes/<id>/assets/`. Render bir üreticiyi
  ÇAĞIRMAZ; diskteki dosyayı okur. Doğrulayıcı hepsinin diskte ve boş
  olmadığını render'dan önce kontrol eder.
- **ÜRETİM AYRI BİR ADIMDIR.** `scripts/generate-assets.mjs` +
  `reel.yml`'ın görsel adımı çizer ve **commit eder**;
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

27. **BİR GÖRSEL HER KAREDE GEÇERLİ BİR DURUMDA OLMAK ZORUNDA.** Slot reel
    kesintisiz kayıyordu, yani iki değer arasındaki HER an ikisi de pencerenin
    içindeydi — kuralların arasında üst üste binmiş iki dilim kelime. İlk
    "düzeltme" pencere kenarlarına yumuşak bir maskeydi: bozuk durumu görmeyi
    zorlaştırır, bozukluğu bırakır. Okunamayan bir durum da bir durumdur.

    Kontak sayfası altmış kareden dördünü alır; kusur diğer elli altısında
    yaşadı ve iki tur incelemeden sağ çıktı. **Baktığın karelerin ARASINDA
    yaşayan bir kusur, hepsine bakan bir kontrol ister.**

    `engine/state.mjs` düz JavaScript'tir, `schema.mjs` ile aynı sebeple: çizen
    ile doğrulayan AYNI fonksiyonu çağırmak zorunda. Kendi kopyasını yazan bir
    doğrulayıcı, er ya da geç başka bir şeyi doğrular — nitekim sayaç
    `countTo` ile çiziliyor, `counterValue` ile kontrol ediliyordu ve 58
    karelik bir çekim "otuz dişli" iddiasının üstüne 29 yazarak teslim edildi.

    Mekanizma değişti, maske değil: reel artık bir SPLIT-FLAP'tir — bir değer
    TAMAMEN çıkmadan sonraki girmez. Kontroller `scripts/lib/temporal.mjs`
    içinde ve her kareyi yürür: reel tek değer gösterir, sayaç geri gitmez ve
    tam sayısına iner, dişliler gerçekten meshler, halka öznesini içine alır,
    zaman çizelgesi sıralıdır, kesimden sonraya hiçbir şey kurulmaz.

28. **HER KESİM BİR KARARDIR VE `HARD_CUT` BİR CEVAPTIR.** Önceki katman her
    diküşe bir VARIŞ seçiyordu — hangisi, kotayla, üst üste üç kez değil. Hiç
    sormadığı şey diküşün varış İSTEYİP istemediğiydi. Belgesel kurgusunun
    grameri sert kesimdir; kesimlerin çoğunun sade olması, sade olmayan üçünün
    anlam taşımasını sağlayan şeydir. Her diküşü süslenmiş bir reel'in noktalama
    işareti kalmamıştır.

    `scripts/lib/cut.mjs` önce EDİTORYAL kararı verir (`HARD_CUT`, `MATCH_CUT`,
    `OBJECT_WIPE`, `MASK`, `MORPH`, `DIRECTIONAL`, `FADE`, `FLASH`), sonra
    yürütmeyi `directTransition`'a ısmarlar — emniyet kuralları orada kalır. Sert
    olmayan bir kesim AMAÇ taşımak zorundadır; söylenecek amaç yoksa cevap sert
    kesimdir.

    **VE İKİ ÇEKİM GERÇEKTEN KAFİYELİYSE DİKÜŞ SERT KALIR.** Çember üstüne
    çember, cetvel üstüne cetvel, aynı plaka üstüne kendisi: en güçlü geçiş
    hiçbir şeyden yapılmıştır ve üstüne bir wipe koymak onu var eden şeyi siler.
    Ama ortak aksan rengi kafiye DEĞİLDİR: ilk sürüm onu kafiye sayıp dokuz
    diküşün altısına MATCH_CUT verdi, ve altı match cut hiç match cut yok
    demektir.

29. **HİÇBİR GRAFİK BİR CÜMLENİN İÇİNDEN GEÇMEZ.** Kırpılma bir nesnenin karede
    olup olmadığını sorar; bu, İKİ nesnenin aynı yerde olup olmadığını sorar —
    aynı kanunun diğer yarısı ve teslim edilen yarısı. Kesikli bir çerçeve
    "FOURTEEN HUNDRED"ün içinden geçip footer'ı çizerek çıktı; bir çentik motifi
    zaman çizelgesinin ilk tiklerinin üstüne yığıldı. İkisi de tek karede
    belliydi ve her kontrolden geçti, çünkü her kontrol BİR nesnenin nerede
    olduğunu biliyordu ve hiçbiri ikisini karşılaştırmıyordu.

    Tipografi kazanır. Çizilen nesne bir fotoğrafın arkasında ya da bir cetvelin
    yanında durabilir; bir cümlenin içinden geçemez. Planlayıcı nesneyi tip
    bandının dışına taşır, taşıyacak yer yoksa DÜŞÜRÜR — duracak yeri olmayan bir
    grafik grafik değil, dağınıklıktır. Ve bir şey kapalı bir şeyin üstüne
    konmaz: mekanizması olan bir çekime "boş kalmasın" diye halka eklenmez.

30. **KESİMİN İNDİĞİ KARE BOŞ OLAMAZ.** Kendini çizen bir diyagram sıfırıncı
    karede hiçbir şeydir, yani içine yapılan her kesim karanlıkta yüzen birkaç
    kopuk zikzak yayına iniyordu: mekanizmanın gelişi değil, moloz. Cevap
    draw-on'dan vazgeçmek değil — solarak açılan bir diyagram slayttır. Cevap
    şu: bir teknik ressam dişlerden BAŞLAMAZ. Önce pitch çemberleri ve merkez
    işaretleri KURULUR, çizim onların üstüne yapılır. Kesim kurulmuş geometrik
    bir figüre iner, mekanizma onun üstüne kendini çizer, ve inşa çizgileri
    gerçek paftada olduğu gibi altta soluk kalır.

    Aynı kural fotoğrafsız bir kareye düşen IŞIK için de geçerlidir: `Glow`'un
    en içteki katmanı beyaz sıcak çekirdektir ve ampule aittir. Altında plaka
    olmayan çekimde çekirdek çizilmez; kareye ulaşan şey kaynağın SAÇILMASIDIR.

## Doğrulama

`npm run validate` render yapmadan üç saniyede cevap verir: şema, sahne tipi ve
her asset'in diskte olup olmadığı. Eksik bir PNG'de ölen render bundle'ı,
tarayıcıyı ve kuyruk slotunu çoktan ödemiştir.
`npm test` motor saflığını, şemayı, registry tutarlılığını, yönetmeni,
eleştirmeni ve depodaki her bölümü kapıda tutar.

`npm run validate` artık İKİ ayrı soruya cevap veriyor. Birincisi "render olur
mu": şema, sahne tipi, diskteki dosyalar. Bu deponun teslim ettiği HER reel bu
soruyu geçti. İkincisi "içinde bir şey var mı": ölü çekim, kesimden sonraya
kurulmuş olay, güvenli alanın dışına taşan caption, tek katmanlı composite,
caption'da bulunmayan vurgu, üst üste üç kez kullanılan aygıt. `--strict`
uyarıları hataya çevirir; CI onu koşar.

Ama bu deponun gördüğü her görsel kusur — kareyi dört kez karartmak, tipografiyi
yumuşatana kadar zoom'lamak, lambadan kayan ışık, birbirini gömen kartlar, tam
kadraj portalın üstüne çizilen harita yayı — doğrulamayı da testleri de geçti ve
tek bir karede belliydi. O yüzden BAKMAK ucuzdur:

- `npm run frames -- --episode=<id> [--per=2]` reel'den birkaç kare alır ve
  ızgara yapar. Sahneye göre örnekler: iki saniyelik bir slate ile yedi
  saniyelik bir composite aynı ilgiyi hak eder. `--per=2` şart olan yerdir —
  yığılan bir motif, kendini çizen bir yol ve tırmanan bir sayı tek karede
  hiçbir şey göstermez.
- `npm run frames -- --episode=<id> --at=0,0.33,0.66,0.94` çekimin kesimin
  indiği karesini de alır. `--per` eşit aralıklarla örnekler ve sıfırıncı kareyi
  ASLA görmez — oysa bu deponun teslim ettiği kusurların yarısı orada yaşıyordu:
  siyah açan bir geçiş, henüz gelmemiş bir caption, boş gökyüzünde duran bir ışık
  topu, mekanizma yerine moloz. `--keep` ızgarayı değil tek tek kareleri bırakır;
  ızgara genel bakıştır, inceleme değil.
- `npm run assets:review -- --episode=<id>` cutout'ları dama tahtasına dizer.

Ve `npm run validate` artık BEŞ soru soruyor. Dördüncüsü "her karede tutarlı
mı" (`scripts/lib/temporal.mjs`), beşincisi "bu bir REEL mi, yoksa arka arkaya
on çekim mi" (`scripts/lib/editor.mjs`). Sonuncusu tek bir çekimin sahip
olabileceği bir özellik değildir: "slayt gösterisi" ancak şeylerin ARASINDA
vardır, ve her biri her kontrolden geçen on çekim hâlâ bir slayt gösterisi
olabilir.
