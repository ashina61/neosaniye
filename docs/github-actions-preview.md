# GitHub Actions Workflow — TASLAK (Faz 7'de aktifleşecek)

> Bu dosya sadece bir **önizleme**dir. Gerçek workflow, uçtan uca 1 video
> yerelde çalışır hale gelmeden (`.github/workflows/daily-short.yml` olarak)
> eklenmeyecek. Cron EN SON açılır — projenin sıralama kuralı bu.

Planlanan `daily-short.yml`:

```yaml
name: Günlük Short Üret ve Yayınla

on:
  workflow_dispatch: # manuel tetikleme (önce bununla test edilir)
  schedule:
    - cron: "0 9 * * *"   # her gün 09:00 UTC (~12:00 TR)
    # - cron: "0 17 * * *" # istenirse günde 2. üretim

jobs:
  produce:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: ffmpeg kur (Faz 4)
        run: sudo apt-get update && sudo apt-get install -y ffmpeg

      - name: Python + faster-whisper (Faz 2 altyazı)
        uses: actions/setup-python@v5
        with:
          python-version: "3.11"

      - run: npm ci

      - name: Üret ve yayınla
        run: node scripts/generate-and-publish.js
        env:
          GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
          GEMINI_MODEL: ${{ vars.GEMINI_MODEL }}
          FIREBASE_SERVICE_ACCOUNT: ${{ secrets.FIREBASE_SERVICE_ACCOUNT }}
          PEXELS_API_KEY: ${{ secrets.PEXELS_API_KEY }}
          YOUTUBE_CLIENT_ID: ${{ secrets.YOUTUBE_CLIENT_ID }}
          YOUTUBE_CLIENT_SECRET: ${{ secrets.YOUTUBE_CLIENT_SECRET }}
          YOUTUBE_REFRESH_TOKEN: ${{ secrets.YOUTUBE_REFRESH_TOKEN }}
```

Hata bildirimi: workflow fail olduğunda GitHub otomatik olarak repo sahibine
e-posta gönderir — Faz 7 için bu yeterli (ek bildirim entegrasyonu gerekmez).

`generate-and-publish.js` ana orkestratörü Faz 7'de yazılacak ve tüm fazları
(script → tts → görsel → montaj → loglama → upload) sırayla çağıracak.
