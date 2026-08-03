# NeoSaniye — Voiceover-First Reel Factory

NeoSaniye; konu seçimi, İngilizce mini-belgesel seslendirmesi, TTS, beat sheet,
kaynak görseller, özgün müzik/SFX, Remotion reel renderı, teknik kalite kapıları
ve YouTube/Instagram/Facebook yayınını tek otomatik hatta birleştirir.

**Seslendirme kaynak koddur.** Metin kilitlendikten sonra her satır kendi
sahnesini, ekrandaki kelimelerini, süresini ve ses efektlerini dikte eder.

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
İngilizce seslendirme satırları (script)
        ↓
TTS + ölçülmüş kelime zamanları
        ↓
BEAT SHEET  (satır → rig → ekrandaki kelimeler → varlıklar → SFX)
        ↓
stok / arşiv / AI kaynak görselleri
        ↓
ReelSpec (production.json + beat-sheet.md)
        ↓
Remotion reel renderı (engine + rigs)
        ↓
preflight + final MP4 + yayın kapıları
        ↓
YouTube / Instagram / Facebook
```

## Görsel dil

Sahne türü şablon değil **rig**tir: her seslendirme satırı bir imza hareketi
kazanır. Rigi satırın kelimeleri seçer; ilk satır her zaman portal, son satır
her zaman finale olur.

| Rig | Ne zaman | İmza hareketi |
| --- | --- | --- |
| `portal-zoom` | açılış | çerçeveli fotoğrafın içine uçmak (weld → detach) |
| `villain-punch` | ret, alay, dayatma | yükselen figür + slot makinesi + negatif flicker |
| `paper-drop` | satır liste taşıyor | üç yönden düşen manşet kartları |
| `grounded-punch` | düşüş, kapanış | ayakta çapalanmış punch + karakterin kendi gölgesi |
| `money-room` | ödeme, sayı, zafer | kodla çizilen lamba ışığı + hold-keyframe parlama |
| `finale-clone` | kapanış | `grounded-punch` klonu + sönümlenen jest |

Ortak dil hepsinin üstünde tek yerden gelir: 12fps posterize adımı (stop-motion
sekmesi), film işlemesi (scan çizgileri, grain, grunge, vignette, gate weave) ve
dört değerli grade. Ayrıntı: `ANIMATION_BIBLE.md`.

Fotoğraf BULUNUR, grafik ÇİZİLİR: çerçeve, plaket, gazete, lamba ışığı, gölge ve
köpük el `remotion/src/engine/props.tsx` içinde kodla çizilir.

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

`test/remotionOnly.test.js`, eski renderer/ASS/CTA katmanları veya kolaj şablon
hattı tekrar eklenirse CI'yi düşürür. `test/beatSheet.test.js` ise uydurulmuş
altyazıyı düşürür: ekrandaki her kelime kendi seslendirme satırında birebir
geçmek zorundadır. Fixture workflow'u ayrıca 1080×1920 H.264/AAC video üretir ve
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
    Root.tsx           # master reel + rig başına solo kompozisyon
    Reel.tsx           # beat'leri zaman çizgisine dizer, sesi mikser
    schema.ts          # ReelSpec / Beat tipleri
    engine/
      motion.ts        # posterize, boil, drift, pingpong, entrance, wag
      FilmLook.tsx     # scan/grain/grunge/vignette/weave + grade
      Plate.tsx        # düz fotoğraf plakaları
      Captions.tsx     # söylenen kelimelerin ekran hâli
      props.tsx        # kodla çizilen grafikler
    rigs/              # altı imza hareketi, her biri tek dosya

src/
  script/             # konu ve senaryo
  story/
    beatSheet.js      # satır → beat (rig, kelimeler, ölçülmüş yerleşim)
    rigs.js           # rig kataloğu ve seçim kuralları
  tts/                # TTS + kelime zamanlaması
  media/              # AI / stok / arşiv kaynakları
  video/
    buildReelSpec.js   # beat sheet → production.json + beat-sheet.md
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
- `beat-sheet.md`
- `script.json`
- `scene-plan.json`
- `production-report.json`
- `production-report.md`
- `publish-gates.json`
- `asset-manifest.json`
- `cover.jpg`

`production.json`, renderın tek makine-okunur beat planıdır; konuya özel React
kodu yazılması gerekmez. `beat-sheet.md` aynı planın insan okuması içindir:
hangi satır hangi rige döndü, ekrana hangi kelimeler çıktı ve bunlar ölçülmüş
konuşmaya mı oturdu. Bir satırın ekrandaki kelimeleri kendi seslendirmesinde
geçmiyorsa video daha ilk kareye bakmadan yanlıştır.

## Güvenlik ilkeleri

- Kimlik bilgisinin bulunması upload izni sayılmaz.
- Public üretimde render hatası fail-closed davranır.
- Teknik olarak bozuk MP4 yayınlanmaz.
- Lisansı belirsiz müzik/SFX kullanılmaz.
- Görsel kaynak ve lisans kanıtı asset manifestine yazılır.
- Yayınlanacak dosya ile analiz edilen dosyanın hash'i eşleşmek zorundadır.
