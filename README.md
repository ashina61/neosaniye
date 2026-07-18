# neosaniye — Otomatik Faceless YouTube Shorts Üretim Sistemi

"İlginç bilgiler / nasıl çalışır / nasıl yapılır" temalı, tamamen otomatik
çalışan bir YouTube Shorts üretim ve yayınlama pipeline'ı. GitHub Actions cron
ile tetiklenir; script yazar, seslendirir, video oluşturur, altyazı ekler ve
YouTube'a yükler.

## 14-Day US Audience Publishing Experiment (AKTİF)

**2026-07-19 → 2026-08-02 (UTC):** yayın saatleri 14 gün boyunca sabit 3 UTC
slotuna kilitli — **15:00 / 20:00 / 02:00 UTC** (TR yaz: 18:00 / 23:00 / 05:00).
Deney süresince saatler DEĞİŞTİRİLMEZ; sistem yalnızca slot etiketi + metrik
verisi toplar. Karar medyanla verilir, tek viral video kazanan yapmaz.
Ayrıntı: [docs/publishing-experiment.md](docs/publishing-experiment.md)

## Faz Durumu

| Faz | İçerik                          | Durum        |
| --- | ------------------------------- | ------------ |
| 1   | Script üretim motoru (Gemini)   | ✅ Hazır     |
| 2   | Ses / TTS (edge-tts + Piper yedek, erkek ses) | 🧪 Kod hazır (yerel test) |
| 3   | Görsel toplama (Pexels, 9:16)   | 🧪 Kod hazır (yerel test) |
| 4   | Video montaj (ffmpeg, 1080x1920)| ✅ Çalışıyor (uçtan uca test edildi) |
| 5   | Firestore loglama (+ yerel yedek)| ✅ Çalışıyor (yerel backend test edildi) |
| 6   | YouTube upload (+ Gemini metadata)| 🧪 Kod hazır (metadata test edildi) |
| 7   | Orkestrasyon + workflow         | ✅ Manuel tetikleme açık, cron kapalı |

Sıralama kuralı: önce yerelde uçtan uca 1 video üretimi tamamen çalışır hale
gelir, **cron EN SON açılır**.

## Proje Yapısı

```
src/
  config.js              # .env okuma
  lib/firestore.js       # State katmanı: Firestore veya yerel JSON (used_topics + videos)
  pipeline/
    run.js               # Faz 7 orkestratör (tüm fazları sırayla)
    recordProduction.js  # Faz 5 üretim kaydı (video + konu işaretleme)
  script/generateScript.js  # Faz 1 çekirdek modül
  tts/
    generateAudio.js     # Faz 2 orkestratör (edge -> piper fallback + whisper)
    edgeTts.js           # edge-tts motoru + SRT parse
    piper.js             # Piper çevrimdışı yedek motor
    align.js             # faster-whisper kelime zamanlaması (Piper yolu)
  media/
    fetchMedia.js        # Faz 3 Pexels dikey (9:16) klip/foto indirme
  video/
    renderVideo.js       # Faz 4 ffmpeg montaj + karaoke altyazı (1080x1920)
  youtube/
    buildMetadata.js     # Faz 6 Gemini ile başlık/açıklama/tag + #Shorts
    uploadVideo.js       # Faz 6 YouTube Data API v3 upload (OAuth refresh token)
scripts/
  generate-and-publish.js # Faz 7 ANA script (tüm boru hattı)
  generate-script.js     # Faz 1 test aracı (CLI)
  generate-audio.js      # Faz 2 test aracı (CLI)
  fetch-media.js         # Faz 3 test aracı (CLI)
  render-video.js        # Faz 4 test aracı (CLI, job.json)
  upload-youtube.js      # Faz 6 test aracı (CLI)
  youtube-auth.js        # Faz 6 refresh token üretici (bir kerelik)
  whisper_align.py       # faster-whisper yardımcı betiği
examples/                # 3 örnek script çıktısı
requirements.txt         # Faz 2 Python araçları (edge-tts, piper-tts, faster-whisper)
docs/
  firestore-schema.md
  github-actions-preview.md
  secrets-setup.md
```

## Kurulum (Faz 1)

```bash
npm install
cp .env.example .env      # GEMINI_API_KEY doldur (ücretsiz: aistudio.google.com/apikey)
npm run script            # 1 script üret ve ekrana yaz
npm run script 3          # 3 script üret
npm run script -- 1 --save  # üret + used_topics'e işaretle (Firebase varsa)
```

Firebase anahtarı verilmezse konu tekrar kontrolü atlanır; script üretimi yine
çalışır. Gerekli API anahtarları için `docs/secrets-setup.md`.

## Tam boru hattı (Faz 7)

```bash
pip install -r requirements.txt        # edge-tts, piper-tts, faster-whisper
sudo apt-get install -y ffmpeg
node scripts/generate-and-publish.js --no-upload   # üret, YouTube'a yükleme
node scripts/generate-and-publish.js               # üret + YouTube upload
```

Otomasyon: `.github/workflows/daily-short.yml` — şimdilik yalnızca **manuel**
(Actions sekmesi → Run workflow). Hazır olunca dosyadaki `schedule` bloğunun
yorumunu kaldırınca **cron** devreye girer. Gerekli GitHub Secrets:
`GEMINI_API_KEY`, `PEXELS_API_KEY`, `FIREBASE_SERVICE_ACCOUNT`,
`YOUTUBE_CLIENT_ID/SECRET/REFRESH_TOKEN`.

## Modülerlik

Her adım (script / tts / görsel / montaj / upload) ayrı dosyada; ileride
TikTok / Instagram gibi platformların eklenmesi kolay olacak şekilde tasarlandı.
