"""Publish to Instagram Reels and a Facebook Page via the Meta Graph API.

Both need a video already reachable at a public HTTPS URL: Instagram fetches it
rather than accepting an upload, and giving Facebook the same URL keeps one code
path. Instagram's container build is asynchronous, so publishing waits for the
container to report FINISHED before claiming success.
"""
from __future__ import annotations

import os
import time

import requests

GRAPH = "https://graph.facebook.com/v21.0"
TIMEOUT = 90


class MissingCredentials(RuntimeError):
    pass


def _token() -> str:
    tok = os.environ.get("META_USER_TOKEN")
    if not tok:
        raise MissingCredentials("META_USER_TOKEN is not set")
    return tok


def targets() -> dict:
    """Resolve the page and the Instagram business account behind the token."""
    tok = _token()
    r = requests.get(f"{GRAPH}/me/accounts", timeout=TIMEOUT,
                     params={"access_token": tok,
                             "fields": "name,access_token,instagram_business_account"})
    if r.status_code != 200:
        err = r.json().get("error", {})
        raise RuntimeError(f"Meta /me/accounts failed: {err.get('message', r.status_code)}")
    pages = r.json().get("data", [])
    if not pages:
        raise RuntimeError("this token controls no Facebook Page")
    page = next((p for p in pages if p.get("instagram_business_account")), pages[0])
    ig = (page.get("instagram_business_account") or {}).get("id")
    return {"page_id": page["id"], "page_name": page.get("name", "?"),
            "page_token": page["access_token"], "ig_user_id": ig}


def post_instagram(video_url: str, caption: str, tgt: dict,
                   poll_seconds: int = 300) -> str:
    if not tgt.get("ig_user_id"):
        raise RuntimeError("no Instagram business account is linked to this Page")
    ig, tok = tgt["ig_user_id"], tgt["page_token"]

    r = requests.post(f"{GRAPH}/{ig}/media", timeout=TIMEOUT,
                      data={"media_type": "REELS", "video_url": video_url,
                            "caption": caption, "access_token": tok})
    if r.status_code != 200:
        raise RuntimeError(f"IG container failed: {r.json().get('error', {}).get('message', r.text[:200])}")
    container = r.json()["id"]

    deadline = time.time() + poll_seconds
    status = "IN_PROGRESS"
    while time.time() < deadline:
        time.sleep(6)
        s = requests.get(f"{GRAPH}/{container}", timeout=TIMEOUT,
                         params={"fields": "status_code,status", "access_token": tok})
        status = s.json().get("status_code", "?")
        if status == "FINISHED":
            break
        if status == "ERROR":
            raise RuntimeError(f"IG rejected the video: {s.json().get('status', '')[:200]}")
    if status != "FINISHED":
        raise RuntimeError(f"IG container still {status} after {poll_seconds}s")

    r = requests.post(f"{GRAPH}/{ig}/media_publish", timeout=TIMEOUT,
                      data={"creation_id": container, "access_token": tok})
    if r.status_code != 200:
        raise RuntimeError(f"IG publish failed: {r.json().get('error', {}).get('message', r.text[:200])}")
    return r.json()["id"]


def post_facebook(video_url: str, description: str, tgt: dict) -> str:
    r = requests.post(f"{GRAPH}/{tgt['page_id']}/videos", timeout=TIMEOUT,
                      data={"file_url": video_url, "description": description,
                            "access_token": tgt["page_token"]})
    if r.status_code != 200:
        raise RuntimeError(f"FB publish failed: {r.json().get('error', {}).get('message', r.text[:200])}")
    return r.json().get("id", "?")
