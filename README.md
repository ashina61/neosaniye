# neosaniye — Otomatik Faceless YouTube Shorts Üretim Sistemi

"İlginç bilgiler / nasıl çalışır / nasıl yapılır" temalı, tamamen otomatik
çalışan bir YouTube Shorts üretim ve yayınlama pipeline'ı. GitHub Actions cron
ile tetiklenir; script yazar, seslendirir, video oluşturur, altyazı ekler ve
YouTube'a yükler.

## Faz Durumu

| Faz | İçerik                          | Durum        |
| --- | ------------------------------- | ------------ |
| 1   | Script üretim motoru (Gemini)   | ✅ Hazır     |
| 2   | Ses / TTS (edge-tts + Piper yedek, erkek ses) | 🧪 Kod hazır (yerel test) |
| 3   | Görsel toplama (Pexels, 9:16)   | 🧪 Kod hazır (yerel test) |
| 4   | Video montaj (ffmpeg, 1080x1920)| ✅ Çalışıyor (uçtan uca test edildi) |
| 5   | Firestore loglama (+ yerel yedek)| ✅ Çalışıyor (yerel backend test edildi) |
| 6   | YouTube upload (+ Gemini metadata)| 🧪 Kod hazır (metadata test edildi) |
| 7   | GitHub Actions orkestrasyon     | ⏳ (en son)  |

Sıralama kuralı: önce yerelde uçtan uca 1 video üretimi tamamen çalışır hale
gelir, **cron EN SON açılır**.

## Proje Yapısı

```
src/
  config.js              # .env okuma
  lib/firestore.js       # State katmanı: Firestore veya yerel JSON (used_topics + videos)
  pipeline/
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

## Modülerlik

Her adım (script / tts / görsel / montaj / upload) ayrı dosyada; ileride
TikTok / Instagram gibi platformların eklenmesi kolay olacak şekilde tasarlandı.
