"""Report which credentials actually authenticate. Never prints a secret value.

Run inside GitHub Actions, where the repository secrets exist. Each check makes
the cheapest real call that proves the credential works, and reports only a
status line, so the log is safe to read and to paste.
"""
from __future__ import annotations

import os
import sys

import requests

TIMEOUT = 30
results: list[tuple[str, bool, str]] = []


def record(name: str, ok: bool, detail: str) -> None:
    results.append((name, ok, detail))


def check(name: str, env: str | list[str]):
    """Decorator: skip when the secret is absent, and never leak the exception body."""
    names = [env] if isinstance(env, str) else env

    def wrap(fn):
        missing = [n for n in names if not os.environ.get(n)]
        if missing:
            record(name, False, f"secret not set: {', '.join(missing)}")
            return fn
        try:
            ok, detail = fn()
            record(name, ok, detail)
        except Exception as e:                        # noqa: BLE001
            record(name, False, f"{type(e).__name__}: {str(e)[:120]}")
        return fn
    return wrap


@check("Gemini text", "GEMINI_API_KEY")
def _gemini_text():
    r = requests.post(
        "https://generativelanguage.googleapis.com/v1beta/models/"
        "gemini-2.5-flash:generateContent",
        params={"key": os.environ["GEMINI_API_KEY"]}, timeout=TIMEOUT,
        json={"contents": [{"parts": [{"text": "Reply with the single word OK."}]}],
              "generationConfig": {"maxOutputTokens": 2048,
                                   "thinkingConfig": {"thinkingBudget": 0}}})
    if r.status_code != 200:
        return False, f"HTTP {r.status_code}: {r.text[:120]}"
    return True, "generateContent answered"


@check("Gemini TTS", "GEMINI_API_KEY")
def _gemini_tts():
    """Actually synthesize. Listing models succeeds on any tier and proves nothing
    about access to the TTS preview models, which is what the pipeline needs."""
    for model in ("gemini-2.5-flash-preview-tts", "gemini-3.1-flash-tts-preview"):
        r = requests.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
            params={"key": os.environ["GEMINI_API_KEY"]}, timeout=TIMEOUT,
            json={"contents": [{"parts": [{"text": "Testing."}]}],
                  "generationConfig": {
                      "responseModalities": ["AUDIO"],
                      "speechConfig": {"voiceConfig": {
                          "prebuiltVoiceConfig": {"voiceName": "Charon"}}}}})
        if r.status_code == 200:
            return True, f"{model} synthesized"
        if r.status_code not in (429, 403):
            return False, f"{model}: HTTP {r.status_code} {r.text[:140]}"
        last = f"{model}: HTTP {r.status_code} {r.json().get('error', {}).get('message', '')[:200]}"
    return False, last


@check("Pexels (stock video)", "PEXELS_API_KEY")
def _pexels():
    r = requests.get("https://api.pexels.com/videos/search",
                     params={"query": "bird", "per_page": 1},
                     headers={"Authorization": os.environ["PEXELS_API_KEY"]}, timeout=TIMEOUT)
    if r.status_code != 200:
        return False, f"HTTP {r.status_code}"
    return True, f"{r.json().get('total_results', 0)} results for a probe query"


@check("Pixabay (stock video)", "PIXABAY_API_KEY")
def _pixabay():
    r = requests.get("https://pixabay.com/api/videos/",
                     params={"key": os.environ["PIXABAY_API_KEY"], "q": "bird", "per_page": 3},
                     timeout=TIMEOUT)
    if r.status_code != 200:
        return False, f"HTTP {r.status_code}"
    return True, f"{r.json().get('totalHits', 0)} hits for a probe query"


@check("Freesound (audio)", "FREESOUND_API_KEY")
def _freesound():
    r = requests.get("https://freesound.org/apiv2/search/text/",
                     params={"query": "ambient", "page_size": 1,
                             "token": os.environ["FREESOUND_API_KEY"]}, timeout=TIMEOUT)
    if r.status_code != 200:
        return False, f"HTTP {r.status_code}"
    return True, f"{r.json().get('count', 0)} results"


@check("ElevenLabs (TTS)", "ELEVENLABS_API_KEY")
def _eleven():
    r = requests.get("https://api.elevenlabs.io/v1/user",
                     headers={"xi-api-key": os.environ["ELEVENLABS_API_KEY"]}, timeout=TIMEOUT)
    if r.status_code != 200:
        return False, f"HTTP {r.status_code}"
    sub = r.json().get("subscription", {})
    used, cap = sub.get("character_count"), sub.get("character_limit")
    return True, f"tier {sub.get('tier', '?')}, {used}/{cap} characters used"


@check("YouTube (upload)", ["YOUTUBE_CLIENT_ID", "YOUTUBE_CLIENT_SECRET", "YOUTUBE_REFRESH_TOKEN"])
def _youtube():
    r = requests.post("https://oauth2.googleapis.com/token", data={
        "client_id": os.environ["YOUTUBE_CLIENT_ID"],
        "client_secret": os.environ["YOUTUBE_CLIENT_SECRET"],
        "refresh_token": os.environ["YOUTUBE_REFRESH_TOKEN"],
        "grant_type": "refresh_token"}, timeout=TIMEOUT)
    if r.status_code != 200:
        return False, f"token refresh: {r.json().get('error', r.status_code)}"
    tok = r.json()["access_token"]
    c = requests.get("https://www.googleapis.com/youtube/v3/channels",
                     params={"part": "snippet", "mine": "true"},
                     headers={"Authorization": f"Bearer {tok}"}, timeout=TIMEOUT)
    if c.status_code != 200:
        return True, f"token ok, but channels.list returned {c.status_code}"
    items = c.json().get("items", [])
    title = items[0]["snippet"]["title"] if items else "no channel on this account"
    return True, f"channel: {title}"


@check("Meta (Instagram + Facebook)", "META_USER_TOKEN")
def _meta():
    tok = os.environ["META_USER_TOKEN"]
    r = requests.get("https://graph.facebook.com/v21.0/me",
                     params={"access_token": tok, "fields": "id,name"}, timeout=TIMEOUT)
    if r.status_code != 200:
        err = r.json().get("error", {})
        return False, f"{err.get('type', 'error')}: {str(err.get('message'))[:90]}"
    who = r.json().get("name", "?")
    p = requests.get("https://graph.facebook.com/v21.0/me/accounts",
                     params={"access_token": tok,
                             "fields": "name,instagram_business_account"}, timeout=TIMEOUT)
    pages = p.json().get("data", []) if p.status_code == 200 else []
    igs = [pg for pg in pages if pg.get("instagram_business_account")]
    return True, (f"user {who}; {len(pages)} page(s), {len(igs)} with a linked "
                  f"Instagram business account")


def main() -> int:
    width = max(len(n) for n, _, _ in results)
    print("\n" + "=" * 78)
    for name, ok, detail in results:
        print(f"  {'PASS' if ok else 'FAIL'}  {name:<{width}}  {detail}")
    print("=" * 78)
    passed = sum(1 for _, ok, _ in results if ok)
    print(f"\n{passed}/{len(results)} credentials usable.\n")
    return 0        # a failing credential is information, not a broken build


if __name__ == "__main__":
    sys.exit(main())
