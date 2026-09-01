"""Upload a finished vertical video to YouTube as a Short.

Auth is an installed-app OAuth refresh token, which is what a headless daily job
needs: no browser, no expiry as long as the grant stands. Supply three env vars:

    YOUTUBE_CLIENT_ID
    YOUTUBE_CLIENT_SECRET
    YOUTUBE_REFRESH_TOKEN     # minted once, with scope youtube.upload

`--dry-run` exercises everything except the two network calls, so the pipeline
can be verified end to end without credentials.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

import requests

TOKEN_URL = "https://oauth2.googleapis.com/token"
UPLOAD_URL = "https://www.googleapis.com/upload/youtube/v3/videos"
CHUNK = 8 * 1024 * 1024


class MissingCredentials(RuntimeError):
    pass


def access_token() -> str:
    cid = os.environ.get("YOUTUBE_CLIENT_ID")
    secret = os.environ.get("YOUTUBE_CLIENT_SECRET")
    refresh = os.environ.get("YOUTUBE_REFRESH_TOKEN")
    missing = [n for n, v in [("YOUTUBE_CLIENT_ID", cid), ("YOUTUBE_CLIENT_SECRET", secret),
                              ("YOUTUBE_REFRESH_TOKEN", refresh)] if not v]
    if missing:
        raise MissingCredentials("missing env var(s): " + ", ".join(missing))
    r = requests.post(TOKEN_URL, data={"client_id": cid, "client_secret": secret,
                                       "refresh_token": refresh, "grant_type": "refresh_token"},
                      timeout=60)
    if r.status_code != 200:
        raise RuntimeError(f"token refresh failed [{r.status_code}]: {r.text[:400]}")
    return r.json()["access_token"]


def build_metadata(title: str, description: str, tags: list[str],
                   privacy: str = "public", category: str = "27") -> dict:
    # 27 = Education. Shorts is inferred from the vertical aspect and length.
    if len(title) > 100:
        raise ValueError(f"title is {len(title)} chars; YouTube allows 100")
    if len(description) > 5000:
        raise ValueError("description exceeds 5000 chars")
    return {"snippet": {"title": title, "description": description,
                        "tags": tags[:30],
                        "categoryId": category},
            "status": {"privacyStatus": privacy, "selfDeclaredMadeForKids": False}}


def upload(video: Path, meta: dict, dry_run: bool = False) -> str:
    size = video.stat().st_size
    if dry_run:
        print(f"[dry-run] would upload {video.name} ({size/1e6:.1f} MB)")
        print("[dry-run] metadata:", json.dumps(meta, indent=1)[:600])
        return "DRY-RUN"
    token = access_token()
    r = requests.post(
        UPLOAD_URL,
        params={"uploadType": "resumable", "part": "snippet,status"},
        headers={"Authorization": f"Bearer {token}",
                 "Content-Type": "application/json; charset=UTF-8",
                 "X-Upload-Content-Length": str(size),
                 "X-Upload-Content-Type": "video/mp4"},
        data=json.dumps(meta).encode(), timeout=120)
    if r.status_code not in (200, 201):
        raise RuntimeError(f"could not start upload [{r.status_code}]: {r.text[:400]}")
    session = r.headers["Location"]

    sent = 0
    with video.open("rb") as fh:
        while sent < size:
            block = fh.read(CHUNK)
            end = sent + len(block) - 1
            resp = requests.put(session, data=block, timeout=600, headers={
                "Content-Length": str(len(block)),
                "Content-Range": f"bytes {sent}-{end}/{size}"})
            if resp.status_code in (200, 201):
                return resp.json()["id"]
            if resp.status_code != 308:
                raise RuntimeError(f"chunk {sent}-{end} rejected [{resp.status_code}]: {resp.text[:300]}")
            rng = resp.headers.get("Range")
            sent = int(rng.split("-")[1]) + 1 if rng else sent + len(block)
    raise RuntimeError("upload finished without an id")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("video", type=Path)
    ap.add_argument("--title", required=True)
    ap.add_argument("--description", default="")
    ap.add_argument("--tags", default="")
    ap.add_argument("--privacy", default="public", choices=["public", "unlisted", "private"])
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()
    meta = build_metadata(a.title, a.description,
                          [t.strip() for t in a.tags.split(",") if t.strip()], a.privacy)
    try:
        vid = upload(a.video, meta, a.dry_run)
    except MissingCredentials as e:
        print(f"SKIPPED: {e}", file=sys.stderr)
        return 2
    print(f"https://youtube.com/shorts/{vid}" if vid != "DRY-RUN" else "dry-run ok")
    return 0


if __name__ == "__main__":
    sys.exit(main())
