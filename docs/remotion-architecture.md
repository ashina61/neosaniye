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
  ├─ hook_text
  ├─ finale_text
  ├─ emphasis_words
  └─ scenes[]
        ↓
TTS + wordTimings
        ↓
CanonicalTimeline
        ↓
media items + edit plan
        ↓
buildRemotionSpec()
        ↓
production.json
        ↓
NeoSaniyeDynamicShort
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
6. `ProductionSpec` yazmak,
7. Remotion CLI ile final MP4 oluşturmak,
8. QC için render metadata döndürmek,
9. geçici public asset klasörünü temizlemek.

### `buildRemotionSpec(input)`

Dosya: `src/video/buildRemotionSpec.js`

Mevcut script, timeline, medya ve edit planını konuya bağımlı olmayan sahne
şablonlarına çevirir. Çıktı, renderın tek makine-okunur planı olan
`production.json` dosyasıdır.

## 4. ProductionSpec

Temel alanlar:

```text
version
meta
  topic
  title
  language
  fps
  width
  height
  durationInFrames
audio
  voicePath
  musicPath
  ambiencePath
theme
scenes[]
  id
  template
  fromFrame
  durationInFrames
  narration
  headline
  kicker
  stat
  emphasis
  assets[]
  sfx[]
  transition
  dark
```

Yeni bir konu için React dosyası yazılmaz. Konu yalnız veri üretir; şablonlar
paylaşılan bileşenlerdir.

## 5. Remotion paketi

`remotion/` bağımsız ve sürümleri sabitlenmiş bir npm paketidir. Root paketinin
React bağımlılığı yoktur; render bağımlılıkları bu klasörde yaşar.

Ana composition:

```text
NeoSaniyeDynamicShort
```

Composition metadata'sı `production.json` içinden süre, çözünürlük ve fps okur.

## 6. Sahne seçimi

Sınıflandırıcı aşağıdaki sırayla karar verir:

1. ilk beat → `hook-reveal`
2. son beat → `final-twist`
3. belge/kanıt → `document`
4. büyük sayı/ölçek → `stat-slot`
5. rota/coğrafya → `map-route`
6. para/değer değişimi → `transaction`
7. mekanizma/adımlar → `explainer-diagram`
8. sonuç/felaket → `consequence`
9. kişi/özne dosyası → `portrait-dossier`
10. kanıt yetersizse → `collage-generic`

Sınıflandırma geliştirilirken belirsiz bir sahneyi zorla özel şablona atamak yerine
`collage-generic` kullanılır.

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
