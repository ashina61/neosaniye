Bu depo **dikey suç belgeseli reel fabrikası**dır: bir motor, çok bölüm.

Tek cümlelik yasa: **MOTOR BÖLÜMÜ TANIMAZ.** `engine/` içindeki hiçbir satır bir
dosya adı, bir bölüm kimliği veya bir hikâye bilmez. Bölüm bir klasördür —
kod değişikliği değil. İkinci bölüm eklemek `episodes/` altına bir klasör
açmaktır, motora dokunmak değil.

Giriş noktası `npm run render -- --episode=<id>`. Otomatik koşu
`.github/workflows/render-episode.yml` (workflow_dispatch, `episode_id` girdisi).

## Zincir

```
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
engine/sceneTypes/*.tsx + Plate     → plakalar, hareket, gölge
        ↓
out/<id>.mp4
```

## Değişmez kurallar

1. **DOSYA ADI CONFIG'TEDİR, KODDA DEĞİL.** Şablon `assets.character` gibi bir
   ROL okur; o rolün hangi dosya olduğu bölümün işidir.
   `test/enginePurity.test.mjs` motorun içinde geçen her dosya uzantısını,
   her `episodes/` yolunu ve her bölüm kimliğini düşürür.
2. **DÖRT PAYLAŞILAN ŞABLON.** `portal-zoom-reveal`, `parallax-punch`,
   `stacked-reveal`, `split-shift`. Bir bölüm kendi şablonunu
   `episodes/<id>/scenes/index.tsx` içinde kaydedebilir; paylaşılan dörde
   bölüme özel bir şey eklenmez.
3. **DERİNLİK DOSYADA DEĞİL, İKİ PLAKANIN BİRBİRİNE GÖRE HAREKETİNDEDİR.**
   Karakter arka plandan DAHA SERT yaklaşır (eşit ölçek zoom'dur, farklı ölçek
   derinliktir) ve ikisi de YERDEKİ AYNI NOKTA etrafında ölçeklenir
   (`groundX`/`groundY`). Ortak çapa kaçarsa özne zeminden kayar — bu efektin
   bozulmasının bir numaralı yolu.
4. **GÖLGE AYRI BİR ASSET DEĞİLDİR.** Karakterin kendi dosyası siyaha boyanır,
   ayaklarından aşağı çevrilir ve zemine yatırılır. Karakter gönderen bölüm
   gölgesini bedava gönderir.
5. **ÖZNE PLAKASI ÇERÇEVEYİ KAPLAMAZ.** Tam kadraj plaka duvar içindir;
   bir insan `plateWidth` + `footX`/`footY` ile boyutlanır ve ayakları
   üzerinde durur. 1080x1920'e esnetilen bir cutout tüm kareyi doldurur ve
   önünde hiçbir şey hareket edemez — derinlik ölür.
6. **FİLM İŞLEMESİ TEK YERDEN GELİR.** Grain, grunge, tarama çizgileri,
   vignette, gate weave ve grade `engine/FilmLook.tsx` içindedir. Hiçbir şablon
   kendi grain'ini yazmaz; sahne yalnız `gradeOverride` ile bölümün grade'ini
   ezer.
7. **HER DEĞER PROPTUR.** Şablonun içinde gizli sabit bırakılmaz; sayılar
   `params` üzerinden gelir ve `num('key', fallback)` ile okunur. Fallback
   çerçeve boyutuna göre hesaplanır, bölüme göre değil.
8. **KARE SAYILARI SAHNENİN KENDİ BAŞLANGICINA GÖREDİR.** `onScreenText.atFrame`
   ve `params` içindeki bütün kare değerleri sahne sıfırından sayılır — reel
   sıfırından değil. Sahne başlangıçları `sceneOffsets` ile toplanır, config'te
   iki kez yazılmaz.
9. **ŞEMA TEK UYGULAMADIR.** `engine/schema.mjs` düz JavaScript'tir çünkü hem
   doğrulayıcı script hem render bundle AYNI doğrulamayı çalıştırmak
   zorundadır. Tipler `engine/schema.ts` içindedir. İkiye ayrılırsa config
   doğrulamayı geçer ve render'ı çökertir.
10. **BİLİNMEYEN SAHNE TİPİ SESSİZCE ATLANMAZ.** Kırmızı bir MISSING TEMPLATE
    kartı çizilir ve doğrulayıcı zaten render'dan önce düşürür.

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
- **DERİNLİK OYNATILIR** — 3D yok, plugin yok: ortak çapaya oturtulmuş iki
  plaka, öznenin kendisinden yapılan gölge, ayaklarda dönen ölçek.

## Doğrulama

`npm run validate` render yapmadan üç saniyede cevap verir: şema, sahne tipi ve
her asset'in diskte olup olmadığı. Eksik bir PNG'de ölen render bundle'ı,
tarayıcıyı ve kuyruk slotunu çoktan ödemiştir.
`npm test` motor saflığını, şemayı, registry tutarlılığını ve depodaki her
bölümü kapıda tutar.
