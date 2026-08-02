# NeoSaniye — Remotion Shorts Factory

NeoSaniye; konu seçimi, İngilizce mini-belgesel senaryosu, TTS, kaynak görseller,
özgün müzik/SFX, Remotion motion-graphics renderı, teknik kalite kapıları ve
YouTube/Instagram/Facebook yayınını tek otomatik hatta birleştirir.

## Tek render motoru

Görüntü montajı artık yalnızca **Remotion** ile yapılır. Eski FFmpeg montaj,
ASS/libass overlay, post-render CTA, outro ve renderer-switch yolları kaldırılmıştır.

FFmpeg ve ffprobe hâlâ şu yardımcı işler için kullanılır:

- ses/görsel dosyalarını teknik olarak okumak,
- süre ve akış bilgisini ölçmek,
- final MP4'te siyah ekran, donma, sessizlik ve decode hatası taramak.

Bunlar kurgu motoru değildir; final görüntüyü Remotion üretir.

## Üretim akışı

```text
performans verisi / konu havuzu
        ↓
İngilizce script + hook + finale
        ↓
kanonik TTS zaman çizelgesi
        ↓
görsel hikâye planı + konu kimliği
        ↓
AI / stok / arşiv kaynak görselleri
        ↓
ProductionSpec (production.json)
        ↓
Remotion collage motion-graphics render
        ↓
preflight + final MP4 + yayın kapıları
        ↓
YouTube / Instagram / Facebook
```

## Görsel dil

Motor konuya göre aynı sahneyi kopyalamaz. Senaryodaki her beat aşağıdaki genel
şablonlardan uygun olana çevrilir:

- hook reveal
- portrait dossier
- document highlight
- map route
- statistic slot
- explainer diagram
- transaction
- consequence
- final twist
- generic collage

Ortak marka dili: krem kâğıt dokusu, yüksek kontrastlı cutout'lar, altın vurgu,
teal yardımcı renk, yırtık kartlar, analog film dokusu, kinetic typography,
parallax ve kontrollü focus/whip geçişleri.

## Süre sözleşmesi

Script ve TTS katmanları kısa parça üretimine izin vermez. Varsayılan hedefler:

- anlatım: `CONTENT_MIN_WORDS`–`CONTENT_MAX_WORDS`
- final süre: `CONTENT_MIN_SECONDS`–`CONTENT_MAX_SECONDS`
- ideal mini-belgesel bandı: `CONTENT_IDEAL_MIN_SECONDS`–`CONTENT_IDEAL_MAX_SECONDS`

Ölçülmüş TTS süre dışındaysa medya ve render maliyetine girilmeden koşu durur.

## Kurulum

```bash
npm ci
npm run remotion:install
pip install -r requirements.txt
sudo apt-get install -y ffmpeg
cp .env.example .env
```

Remotion Studio:

```bash
npm run remotion:studio
```

## Üretim

Yayın yapmadan tam üretim:

```bash
npm run produce:dry
```

Yayın isteğiyle üretim:

```bash
npm run produce -- --upload
```

Yayın isteği tek başına yeterli değildir. Final MP4 teknik kapıları geçmezse hiçbir
platforma gönderilmez.

Bir `job.json` dosyasını doğrudan render etmek:

```bash
npm run video -- job.json
```

Zorunlu temel alanlar: `audioPath`, `scenes`, `media`, `mediaScene`, `timeline`,
`outPath`.

## Testler

```bash
npm run test:remotion
npm test
npm run remotion:typecheck
npm run remotion:fixture
```

`test/remotionOnly.test.js`, eski renderer veya ASS/CTA katmanları tekrar eklenirse
CI'yi düşürür. Fixture workflow'u ayrıca 1080×1920 H.264/AAC video üretir ve
siyah/donma/sessizlik taraması yapar.

## GitHub Actions

### Günlük üretim

`.github/workflows/daily-short.yml`

- 13:02 UTC
- 18:02 UTC
- 23:02 UTC

Cron koşuları yayın talebiyle çalışır. Manuel koşuda upload kutusu varsayılan olarak
kapalıdır. Workflow Node 22, Python, FFmpeg/ffprobe ve izole Remotion paketini kurar;
önce mimari testleri geçirir, sonra üretime başlar.

### Renderer doğrulaması

`.github/workflows/remotion-fixture.yml`

Her pull request'te Remotion-only mimariyi, Node testlerini, TypeScript'i, fixture
renderını ve final MP4 teknik taramasını doğrular.

## Proje yapısı

```text
remotion/
  src/
    Root.tsx
    DynamicShort.tsx
    ProductionSpec.ts
    components/
    scenes/

src/
  script/             # konu ve senaryo
  tts/                # TTS + kelime zamanlaması
  media/              # AI / stok / arşiv kaynakları
  video/
    buildRemotionSpec.js
    renderRemotion.js
    renderVideo.js     # kararlı dış arayüz → Remotion
  pipeline/            # QC, yayın kapıları, kayıt ve orkestrasyon
  youtube/             # metadata, upload, captions
  social/              # Meta cross-post

scripts/
  generate-and-publish.js
  render-video.js
  audit-final-video.js
```

## Temel artefaktlar

Her üretim klasöründe mümkün olduğunda şunlar bulunur:

- final `.mp4`
- `production.json`
- `script.json`
- `scene-plan.json`
- `production-report.json`
- `production-report.md`
- `publish-gates.json`
- `asset-manifest.json`
- `cover.jpg`

`production.json`, renderın tek makine-okunur sahne planıdır; konuya özel React
kodu yazılması gerekmez.

## Güvenlik ilkeleri

- Kimlik bilgisinin bulunması upload izni sayılmaz.
- Public üretimde render hatası fail-closed davranır.
- Teknik olarak bozuk MP4 yayınlanmaz.
- Lisansı belirsiz müzik/SFX kullanılmaz.
- Görsel kaynak ve lisans kanıtı asset manifestine yazılır.
- Yayınlanacak dosya ile analiz edilen dosyanın hash'i eşleşmek zorundadır.
