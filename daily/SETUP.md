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
4. Mint a refresh token once, on a machine with a browser:

   ```bash
   python daily/lib/mint_youtube_token.py \
       --client-id "…apps.googleusercontent.com" --client-secret "GOCSPX-…"
   ```

   Use this rather than the OAuth 2.0 Playground. The Playground signs the grant
   with *Google's* client unless you remember to tick *Use your own OAuth
   credentials*, and a token minted that way looks perfectly well-formed but
   fails later with `invalid_grant` — the token and the client id you deploy it
   with simply do not belong together. The script signs with the same
   credentials you are about to deploy, so they cannot disagree.

   Scope is `https://www.googleapis.com/auth/youtube.upload`.

5. Set these three as **environment variables on the Claude Code environment**
   that the scheduled runs fire into:

   ```
   YOUTUBE_CLIENT_ID=…
   YOUTUBE_CLIENT_SECRET=…
   YOUTUBE_REFRESH_TOKEN=…
   ```

   They have to live on the environment, not in the repository and not in a chat
   message: every scheduled run starts a brand-new container that clones this
   repo fresh, so anything not in the environment's own configuration is gone
   before the run begins. `.env` is git-ignored precisely so these never get
   committed.

## Diagnosing a rejected token

`invalid_grant` from the token endpoint means the refresh token was refused;
`invalid_client` means the id/secret pair is wrong. To tell them apart, send a
deliberately fake refresh token with the same client id and secret: if that also
returns `invalid_grant`, the client is fine and the token is the problem.

A previously working token stops working when the consent screen is still in
*Testing* mode (tokens expire after 7 days — publish the app), when access is
revoked, or when the account has issued so many tokens for this client that
Google evicted the oldest.

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
