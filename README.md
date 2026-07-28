# NeoSaniye Remotion Factory

A compact English Shorts factory that runs three times per day.

## Schedule

- 13:02 UTC — US Eastern morning
- 18:02 UTC — US Eastern midday
- 23:02 UTC — US Eastern evening

Each run selects a different topic from `data/topics.json`, generates English TTS and SRT timing, renders a 1080×1920 Remotion video, verifies the MP4, and uploads to every configured platform.

## Secrets

- `YOUTUBE_CLIENT_ID`
- `YOUTUBE_CLIENT_SECRET`
- `YOUTUBE_REFRESH_TOKEN`
- `META_PAGE_TOKEN` or `META_ACCESS_TOKEN`
- `META_PAGE_ID`
- `META_IG_USER_ID`

IDs may also be stored as GitHub Actions variables. `META_GRAPH_VERSION` defaults to `v25.0`.
