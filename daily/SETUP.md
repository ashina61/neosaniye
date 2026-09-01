# Setup

The pipeline runs without any credentials — it just reports `SKIPPED` at the
upload step and leaves the bundle for hand-posting. Add the three variables
below to turn YouTube uploads on.

## YouTube

The daily job is headless, so it needs an **installed-app refresh token**, not a
service account (service accounts cannot own YouTube uploads).

1. In Google Cloud Console, create a project and enable **YouTube Data API v3**.
2. **OAuth consent screen** → External. Add the channel's Google account under
   *Test users* (a token from a test-user grant expires after 7 days, so once it
   works, publish the app to stop the expiry).
3. **Credentials → Create credentials → OAuth client ID → Desktop app.**
   Keep the client ID and client secret.
4. Mint a refresh token once, on a machine with a browser, with exactly this
   scope: `https://www.googleapis.com/auth/youtube.upload`

   The quickest route is the OAuth 2.0 Playground: click the gear, tick *Use
   your own OAuth credentials*, paste the client ID/secret, choose that scope,
   authorise with the channel's account, then exchange the code. Copy the
   refresh token.

5. Set these in the environment the scheduled session runs in:

   ```
   YOUTUBE_CLIENT_ID=…
   YOUTUBE_CLIENT_SECRET=…
   YOUTUBE_REFRESH_TOKEN=…
   ```

**Quota.** One upload costs 1600 units against a default 10,000/day, so two
videos a day uses under a third of it. Nothing else here spends quota.

**Privacy.** `publish.py` defaults to `unlisted`. Leave it there until you have
watched a few days of output — these scripts ship without human review, and an
unlisted mistake is recoverable. Switch by passing `--privacy public`.

## Instagram and Facebook

Not automated, and not automatable from this environment: the network's egress
gateway rejects `graph.facebook.com` and `graph.instagram.com` outright.

Each run leaves `videos/<slug>/` containing the MP4, a cover frame, and the
caption text for each platform. Posting is a copy-paste job.

If you later want these automated, it needs a machine without that egress
restriction, plus an Instagram **Business or Creator** account linked to a
Facebook Page, and a publicly reachable HTTPS URL for the video file —
Instagram's Content Publishing API pulls the video, it does not accept an
upload.

## Voice

Narration is offline piper TTS, because no cloud TTS host is reachable here.
If a `GOOGLE_API_KEY` is ever available, OpenMontage's `google_tts` tool with a
Chirp3-HD voice is a large quality upgrade over piper and worth switching to.
