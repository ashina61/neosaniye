# NeoSaniye Remotion Architecture

Bu belge üretim sisteminin tek güncel teknik kaynağıdır.

## 1. Sınırlar

- Görsel montaj motoru: yalnız Remotion.
- FFmpeg/ffprobe: medya ölçümü, ses yardımcı işlemleri ve final teknik doğrulama.
- Ayrı ASS/libass overlay, outro veya CTA post-pass yoktur.
- Renderer seçimi/fallback bayrağı yoktur.
- Public render hatası fail-closed davranır.

## 2. Veri akışı

```text
script
  ├─ emphasis_words
  └─ scenes[].narration      # seslendirme satırları = kaynak kod
        ↓
TTS + wordTimings
        ↓
CanonicalTimeline           # ölçülmüş beat pencereleri
        ↓
buildBeatSheet()            # satır → rig + birebir kelimeler + proplar
        ↓
media items                 # bulunan fotoğraflar rig rollerine bağlanır
        ↓
buildReelSpec()
        ↓
production.json + beat-sheet.md
        ↓
NeoSaniyeReel
        ↓
final MP4
        ↓
preflight / finalVideoValidator / publish gates
```

## 3. Kararlı arayüzler

### `renderVideo(job)`

Dosya: `src/video/renderVideo.js`

Orkestratörün tek render girişidir. Uygulama ayrıntısı içermez; işi
`renderRemotion(job)` fonksiyonuna devreder.

### `renderRemotion(job)`

Dosya: `src/video/renderRemotion.js`

Sorumlulukları:

1. ses, sahne ve output girdilerini doğrulamak,
2. koşuya özel public asset klasörü oluşturmak,
3. ses/görsel/ambiyansı Remotion public alanına kopyalamak,
4. sağlanan müziği kullanmak veya özgün procedural müzik üretmek,
5. özgün SFX paketini üretmek,
6. `ReelSpec` (`production.json`) ve okunabilir `beat-sheet.md` yazmak,
7. Remotion CLI ile final MP4 oluşturmak,
8. QC için render metadata döndürmek,
9. geçici public asset klasörünü temizlemek.

### `buildBeatSheet(input)`

Dosya: `src/story/beatSheet.js`

Seslendirme satırlarını beat'lere çevirir. Her satır için: rigi seçer, ekrana
çıkacak birebir fragmanları çeker, bunları ölçülmüş kelime zamanlarına oturtur,
rig proplarını beatin kendi uzunluğundan türetir.

Prop bir metni gösteriyorsa (plaket, slot makinesi, gazete manşeti) o metin
altyazı katmanından düşülür; aynı kelime kadrajda iki kez yazmaz.

### `buildReelSpec(input)`

Dosya: `src/video/buildReelSpec.js`

Beat sheet'i, medya bağlamalarını ve SFX kütüphanesini renderın tek
makine-okunur planı olan `production.json` dosyasına çevirir; yanına insan
okuması için `beat-sheet.md` yazar.

## 4. ReelSpec

Temel alanlar:

```text
version: 2
meta
  topic, title, language, fps, width, height, durationInFrames
engine
  posterizeFps        # 12 — stop-motion adımı
  gateWeavePx, weaveScale
  grade               # saturate, contrast, sepia, brightness
  film                # scanlines, grain, grunge, vignette, weave
audio
  voicePath, musicPath, ambiencePath
  musicVolume, musicDuckVolume, duckWindows[]
beats[]
  id
  rig                 # imza hareketi
  role                # setup | rejection | turn | fall | payoff | button
  line                # seslendirme satırı — kaynak kod
  fromFrame, durationInFrames
  captions[]          # birebir fragmanlar + söylendiği kare
  assets[]            # role: plate | character | prop | texture
  sfx[]               # rigin olayına yerleşmiş cue'lar
  props               # rigin bütün ayarlanabilir değerleri
  grade
  clonedFrom          # reskin ise kaynak rig
timing
  source, measuredCaptions, estimatedCaptions
```

Yeni bir konu için React dosyası yazılmaz. Konu yalnız veri üretir; rigler
paylaşılan bileşenlerdir.

## 5. Remotion paketi

`remotion/` bağımsız ve sürümleri sabitlenmiş bir npm paketidir. Root paketinin
React bağımlılığı yoktur; render bağımlılıkları bu klasörde yaşar.

Ana composition:

```text
NeoSaniyeReel
```

Composition metadata'sı `production.json` içinden süre, çözünürlük ve fps okur.

## 6. Rig seçimi

`src/story/rigs.js` aşağıdaki sırayla karar verir:

1. ilk satır → `portal-zoom`
2. son satır → `finale-clone`
3. ret/alay/dayatma sinyali → `villain-punch`
4. para/sayı/zafer sinyali → `money-room`
5. düşüş/kapanış/çöküş sinyali → `grounded-punch`
6. liste okuyan satır → `paper-drop`
7. sinyal yoksa konuma göre `grounded-punch` / `money-room`

Üstüne tek koruma: aynı mekanik üst üste üç beat çalışamaz. İkinci tekrar motif,
üçüncüsü hatadır — tekrarda sıradaki alternatif rig seçilir.

Rig ekleme sırası: önce mevcut bir rigi klonlayıp yeniden giydirmeyi dene
(`finale-clone` bunun örneğidir); yeni mekanik yalnız gerçekten yeni bir görsel
olay gerekiyorsa yazılır.

## 7. Ses

- Voice: mevcut TTS motorundan gelir.
- Music: sağlanan lisanslı parça veya `makeMusicBed()` procedural üretimi.
- SFX: `makeRemotionSfxPack()` tarafından deterministik üretilir.
- Cue zamanı sahnenin frame başlangıcına göre hesaplanır.
- Aynı plan ve aynı seed aynı sonucu üretir.

## 8. Kalite kapıları

Render sonrası doğrulama zinciri korunur:

- dosya varlığı ve boyutu,
- decode,
- video ve ses akışı,
- dikey çözünürlük,
- süre uyumu,
- siyah ekran,
- donma,
- tam sessizlik,
- timeline sırası,
- analiz edilen/publish edilecek dosya hash eşleşmesi,
- kaynak ve lisans manifesti.

Editoryal QC rapor üretir; teknik kapı çalışamazsa geçti sayılmaz.

## 9. GitHub Actions

### `daily-short.yml`

Canlı üretim workflow'udur. Root ve Remotion paketlerini kurar, mimari testleri ve
TypeScript kontrolünü geçirir, sonra mevcut pipeline'ı çalıştırır.

### `remotion-fixture.yml`

Pull request doğrulamasıdır. Test ses paketini üretir, fixture composition render
eder, ffprobe ve siyah/donma/sessizlik taramasını çalıştırır.

## 10. Yasaklanan eski yollar

Aşağıdakiler mimariye geri eklenmez:

- `RENDER_ENGINE=ffmpeg|remotion`
- renderer router ve kalite fallback'i
- `filter_complex` ile ana montaj
- xfade tabanlı sahne zinciri
- ASS semantic/actor/effect katmanları
- post-render CTA
- ayrı outro renderer
- shadow patch scripti

`test/remotionOnly.test.js` bu sınırların bir bölümünü otomatik kilitler.
