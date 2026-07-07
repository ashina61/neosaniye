# neosaniye — Otomatik Faceless YouTube Shorts Üretim Sistemi

"İlginç bilgiler / nasıl çalışır / nasıl yapılır" temalı, tamamen otomatik
çalışan bir YouTube Shorts üretim ve yayınlama pipeline'ı. GitHub Actions cron
ile tetiklenir; script yazar, seslendirir, video oluşturur, altyazı ekler ve
YouTube'a yükler.

## Faz Durumu

| Faz | İçerik                          | Durum        |
| --- | ------------------------------- | ------------ |
| 1   | Script üretim motoru (Claude)   | ✅ Hazır     |
| 2   | Ses / TTS (edge-tts) + whisper  | ⏳ Sırada    |
| 3   | Görsel toplama (Pexels)         | ⏳           |
| 4   | Video montaj (ffmpeg)           | ⏳           |
| 5   | Firestore loglama               | ⏳           |
| 6   | YouTube otomatik upload         | ⏳           |
| 7   | GitHub Actions orkestrasyon     | ⏳ (en son)  |

Sıralama kuralı: önce yerelde uçtan uca 1 video üretimi tamamen çalışır hale
gelir, **cron EN SON açılır**.

## Proje Yapısı

```
src/
  config.js              # .env okuma
  lib/firestore.js       # Firestore + used_topics (kredensiyel yoksa no-op)
  script/generateScript.js  # Faz 1 çekirdek modül
scripts/
  generate-script.js     # Faz 1 test aracı (CLI)
examples/                # 3 örnek script çıktısı
docs/
  firestore-schema.md
  github-actions-preview.md
  secrets-setup.md
```

## Kurulum (Faz 1)

```bash
npm install
cp .env.example .env      # ANTHROPIC_API_KEY doldur
npm run script            # 1 script üret ve ekrana yaz
npm run script 3          # 3 script üret
npm run script -- 1 --save  # üret + used_topics'e işaretle (Firebase varsa)
```

Firebase anahtarı verilmezse konu tekrar kontrolü atlanır; script üretimi yine
çalışır. Gerekli API anahtarları için `docs/secrets-setup.md`.

## Modülerlik

Her adım (script / tts / görsel / montaj / upload) ayrı dosyada; ileride
TikTok / Instagram gibi platformların eklenmesi kolay olacak şekilde tasarlandı.
