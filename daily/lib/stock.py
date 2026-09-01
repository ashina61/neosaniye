"""Find and download real stock footage for a scene.

Pexels first, Pixabay as the fallback — both free to use commercially. Vertical
clips are strongly preferred: a landscape clip cropped to 9:16 loses most of its
subject. Each download records its attribution so the bundle can credit it.
"""
from __future__ import annotations

import json
import os
import subprocess
from pathlib import Path

import requests

TIMEOUT = 60
TARGET_W, TARGET_H = 1080, 1920


def _score(w: int, h: int, want_min_side: int = 900) -> float:
    """Rank a rendition: portrait beats landscape, and bigger beats smaller —
    but only up to the point where it stops adding visible detail."""
    if not w or not h:
        return -1
    portrait = 1.0 if h >= w else 0.35
    coverage = min(w / TARGET_W, h / TARGET_H)
    if min(w, h) < want_min_side:
        coverage *= 0.5
    return portrait * min(coverage, 1.6)


def _pexels(query: str, min_duration: float) -> list[dict]:
    key = os.environ.get("PEXELS_API_KEY")
    if not key:
        return []
    r = requests.get("https://api.pexels.com/videos/search",
                     params={"query": query, "orientation": "portrait",
                             "per_page": 15, "size": "medium"},
                     headers={"Authorization": key}, timeout=TIMEOUT)
    if r.status_code != 200:
        return []
    out = []
    for v in r.json().get("videos", []):
        if v.get("duration", 0) < min_duration:
            continue
        best = max(v.get("video_files", []),
                   key=lambda f: _score(f.get("width", 0), f.get("height", 0)), default=None)
        if not best or _score(best.get("width", 0), best.get("height", 0)) <= 0:
            continue
        out.append({"source": "pexels", "url": best["link"],
                    "w": best["width"], "h": best["height"],
                    "duration": v.get("duration", 0),
                    "credit": f'{v.get("user", {}).get("name", "unknown")} on Pexels',
                    "page": v.get("url", ""),
                    "score": _score(best["width"], best["height"])})
    return out


def _pixabay(query: str, min_duration: float) -> list[dict]:
    key = os.environ.get("PIXABAY_API_KEY")
    if not key:
        return []
    r = requests.get("https://pixabay.com/api/videos/",
                     params={"key": key, "q": query, "per_page": 20, "safesearch": "true"},
                     timeout=TIMEOUT)
    if r.status_code != 200:
        return []
    out = []
    for hit in r.json().get("hits", []):
        if hit.get("duration", 0) < min_duration:
            continue
        best, best_s = None, -1
        for name, v in (hit.get("videos") or {}).items():
            s = _score(v.get("width", 0), v.get("height", 0))
            if s > best_s and v.get("url"):
                best, best_s = v, s
        if not best or best_s <= 0:
            continue
        out.append({"source": "pixabay", "url": best["url"],
                    "w": best["width"], "h": best["height"],
                    "duration": hit.get("duration", 0),
                    "credit": f'{hit.get("user", "unknown")} on Pixabay',
                    "page": hit.get("pageURL", ""), "score": best_s})
    return out


def find(query: str, out: Path, min_duration: float = 4.0) -> dict | None:
    """Download the best vertical clip for `query`. None when nothing fits."""
    candidates = sorted(_pexels(query, min_duration) + _pixabay(query, min_duration),
                        key=lambda c: c["score"], reverse=True)
    for c in candidates[:4]:
        try:
            r = requests.get(c["url"], timeout=300, stream=True)
            if r.status_code != 200:
                continue
            out.parent.mkdir(parents=True, exist_ok=True)
            with out.open("wb") as fh:
                for chunk in r.iter_content(1 << 20):
                    fh.write(chunk)
            if out.stat().st_size < 40_000:      # a truncated or placeholder file
                continue
            c["path"] = str(out)
            return c
        except requests.RequestException:
            continue
    return None


def normalise(src: Path, dest: Path, duration: float, start: float = 0.0) -> Path:
    """Crop-to-fill 1080x1920, trim to `duration`, strip audio, constant frame rate.

    Doing this once up front keeps the renderer from having to decode odd sizes
    and rates mid-render, which is where stock footage usually causes trouble.
    """
    dest.parent.mkdir(parents=True, exist_ok=True)
    vf = (f"scale={TARGET_W}:{TARGET_H}:force_original_aspect_ratio=increase,"
          f"crop={TARGET_W}:{TARGET_H},fps=30,setsar=1")
    p = subprocess.run(
        ["ffmpeg", "-y", "-v", "error", "-ss", f"{start:.2f}", "-i", str(src),
         "-t", f"{duration:.2f}", "-vf", vf, "-an",
         "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
         "-pix_fmt", "yuv420p", str(dest)], capture_output=True, text=True)
    if p.returncode != 0 or not dest.exists():
        raise RuntimeError(f"stock normalise failed: {p.stderr[-300:]}")
    return dest


def gather(scenes: list[dict], work: Path, timing: dict) -> dict:
    """Fetch a clip for every scene that asks for one. Returns {index: info}."""
    got: dict[int, dict] = {}
    creds = []
    for i, (sc, beat) in enumerate(zip(scenes, timing["beats"])):
        q = sc.get("stock")
        if not q:
            continue
        need = max(beat["dur"] + 1.2, 3.0)
        raw = work / "stock" / f"{i:02d}-raw.mp4"
        info = find(q, raw, min_duration=min(need, 6.0))
        if not info:
            print(f"    scene {i+1}: no stock clip for {q!r} — falling back to graphics")
            continue
        clip = normalise(raw, work / "stock" / f"{i:02d}.mp4", need)
        raw.unlink(missing_ok=True)
        info["clip"] = str(clip)
        got[i] = info
        creds.append(f'scene {i+1}: {info["credit"]} — {info["page"]}')
        print(f"    scene {i+1}: {info['source']} {info['w']}x{info['h']} — {info['credit']}")
    if creds:
        (work / "attribution.txt").write_text("\n".join(creds) + "\n")
    (work / "stock.json").write_text(json.dumps(got, indent=1))
    return got
