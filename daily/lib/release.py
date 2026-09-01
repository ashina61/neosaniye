"""Publish the finished MP4 as a GitHub release asset.

Instagram's content publishing API does not accept an upload — it fetches the
video from a URL you give it. A release asset on a public repository is a stable
public HTTPS URL, which makes this the cheapest way to satisfy that requirement
without standing up hosting.
"""
from __future__ import annotations

import os
from pathlib import Path

import requests

API = "https://api.github.com"
TIMEOUT = 300


def _headers() -> dict:
    token = os.environ.get("GITHUB_TOKEN")
    if not token:
        raise RuntimeError("GITHUB_TOKEN is not set (Actions provides it automatically)")
    return {"Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28"}


def publish(video: Path, tag: str, title: str, body: str = "") -> str:
    """Create (or reuse) a release and upload `video`. Returns its public URL."""
    repo = os.environ.get("GITHUB_REPOSITORY")
    if not repo:
        raise RuntimeError("GITHUB_REPOSITORY is not set")
    h = _headers()

    r = requests.get(f"{API}/repos/{repo}/releases/tags/{tag}", headers=h, timeout=60)
    if r.status_code == 200:
        rel = r.json()
    else:
        r = requests.post(f"{API}/repos/{repo}/releases", headers=h, timeout=60,
                          json={"tag_name": tag, "name": title, "body": body,
                                "draft": False, "prerelease": False})
        if r.status_code not in (200, 201):
            raise RuntimeError(f"could not create release [{r.status_code}]: {r.text[:300]}")
        rel = r.json()

    # replace an asset of the same name so a re-run is idempotent
    for asset in rel.get("assets", []):
        if asset["name"] == video.name:
            requests.delete(f"{API}/repos/{repo}/releases/assets/{asset['id']}",
                            headers=h, timeout=60)

    upload = rel["upload_url"].split("{")[0]
    r = requests.post(upload, headers={**h, "Content-Type": "video/mp4"},
                      params={"name": video.name}, data=video.read_bytes(), timeout=TIMEOUT)
    if r.status_code not in (200, 201):
        raise RuntimeError(f"asset upload failed [{r.status_code}]: {r.text[:300]}")
    return r.json()["browser_download_url"]
