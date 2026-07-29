# NeoSaniye Shorts Factory

NeoSaniye, tek bir data-driven Remotion composition kullanarak 40–45 saniyelik dikey belgesel videoları üretir. Görsel yönü tarihî editoryal cut-paper collage'dır; Remotion yalnızca üretilen sahneleri hareketlendirir, kısa başlıkları ekler ve sesi miksler.

## Çıktı

- 1080×1920
- 30 FPS
- 40–45 saniye
- H.264 MP4
- Geleneksel altyazı yerine kısa scene headline ve label'ları

## Factory aşamaları

```text
topic + facts
  → story JSON
  → 8–12 generated collage scene
  → Remotion content module
  → voice, timing, music and SFX
  → typecheck
  → MP4 render
```

Her aşama `content/generated/current-story.json` üzerinden ilerler. Yeni bir konu için yeni bir Remotion videosu kopyalanmaz.

## Komutlar

Bağımlılıkları kurup Remotion Studio'yu açmak için:

```bash
npm install
npm start
```

Factory aşamalarını ayrı ayrı çalıştırmak için:

```bash
npm run factory:preflight
npm run story:generate
npm run images:generate
npm run story:compile
npm run audio
npm run typecheck
npm run render
```

Preflight; en az bir kullanılabilir story ve image provider bulunduğunu, `edge-tts`, `ffmpeg`, `ffprobe` komutlarını ve style reference dosyasını provider çağrısı yapılmadan kontrol eder. Sonuç `out/factory/preflight.json` dosyasına yazılır.

Tam zincir:

```bash
npm run factory
```

`npm run audio:bed`, herhangi bir harici servis kullanmadan `music.wav`, `impact.wav`, `snap.wav` ve `chime.wav` dosyalarını yerel olarak üretir. `npm run audio` buna ek olarak Edge TTS ile voice ve timing üretir.

> `story:generate`, `images:generate`, `audio`, `render` ve `factory` komutları harici servis, kota veya yoğun işlem kullanabilir. Bilinçli olarak manuel çalıştırılmalıdır.

## Konu ayarları

```bash
export VIDEO_TOPIC="The world's first traffic signal exploded"
export VIDEO_LANGUAGE="en" # en veya tr
export VIDEO_SCENE_COUNT="10" # 8–12
export VIDEO_FACTS="Verified facts supplied by the editor"
```

## Provider fallback

Story ve image provider sıraları environment variable ile değiştirilebilir:

```bash
export STORY_PROVIDER_CHAIN="gemini,groq,cerebras,github-models,mistral,cloudflare,openrouter"
export IMAGE_PROVIDER_CHAIN="gemini,openai,bfl,stability,pollinations,cloudflare,together"
```

Eksik provider anahtarları atlanır. Kota, ödeme ve geçici provider hatalarında sıradaki yapılandırılmış provider denenir.

Başarılı scene görselleri her üretimden sonra story dosyasına kaydedilir. Kesilen bir görsel üretimini geçerli dosyaları yeniden harcamadan sürdürmek için aynı komutu tekrar çalıştırın. Belirli sahneleri veya zorunlu yeniden üretimi seçmek için:

```bash
IMAGE_SCENE_IDS="scene-03,scene-07" npm run images:generate
IMAGE_FORCE=true IMAGE_SCENE_IDS="scene-03" npm run images:generate
```

## GitHub Actions

- `NeoSaniye Vox Factory — Manual Only`: story'den MP4'e kadar ana üretim zinciri.
- `Generate Story Assets — No Upload`: seçili asset adaylarını üretip karşılaştırma artifact'i hazırlar.

Workflow'lar yalnızca `workflow_dispatch` ile manuel başlatılır. Repoda yayınlama veya sosyal platformlara upload mantığı bulunmaz.

## VOX Documentary Engine

Yeni, eski factory'den izole edilen checkpoint tabanlı mod Türkçe konu girdisini araştırma, senaryo, ses, beat, görsel plan, prompt, placeholder, Remotion verisi ve QC artifact'lerine dönüştürür:

```bash
npm run vox:generate -- --topic "Dünyanın ilk trafik ışığı" --duration 40 --no-upload
```

Ücretli servis çağrısı yapmadan bütün planlama zincirini denetlemek için `--dry-run` kullanın. `--resume`, checksum'u değişmeyen başarılı aşamaları atlar; `--force` yeniden üretir. `--from images`, `--only qc`, `--provider`, `--seed`, `--language` ve `--project output/first-traffic-light` desteklenir. Yerel sessiz ses ve SVG görseller yalnızca geliştirme fallback'idir; QC bunları production-ready saymaz. Upload kodu yoktur ve manuel onay zorunludur.

Şu an doğrulanmış offline araştırma yalnızca ilk trafik ışığı acceptance fixture'ı için sağlanır. Diğer konular, bir live research provider eklenene kadar doğrulanmış iddia üretmeden açık ve eyleme dönük bir hata ile durur. `VOX_ENABLE_SCENE_HEADLINES` varsayılan olarak kapalıdır; narration caption ve yalnızca visual plan tarafından açıkça belirtilen tarih, yer, ad veya sayı label'ları ayrı katmanlardır.
