"""Find and download real stock footage for a scene.

Pexels first, Pixabay next — both free to use commercially. Vertical clips are
strongly preferred: a landscape clip cropped to 9:16 loses most of its subject.
Each download records its attribution so the bundle can credit it.

Behind those sit the repo's keyless public-domain adapters: NASA, Wikimedia,
Archive.org, the Library of Congress and the rest. They are searched only when
the commercial libraries come back with nothing, because their footage is
mostly landscape and archival — but for the topics this pipeline covers they
hold the specific thing a stock library never does: an actual aurora, an actual
hurricane from orbit, actual laboratory footage. Nothing there is required to
work: a source that errors, times out or returns junk is skipped, and the scene
falls back to graphics exactly as it did before.
"""
from __future__ import annotations

import json
import logging
import os
import subprocess
import sys
from pathlib import Path

import requests

TIMEOUT = 60
TARGET_W, TARGET_H = 1080, 1920
# An archival master can be gigabytes. The runner's disk is a fixed allowance,
# and a clip is trimmed to about four seconds anyway, so a download that runs
# past this is abandoned rather than allowed to fill the volume.
MAX_DOWNLOAD = 220 << 20


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


def _archives(query: str, min_duration: float) -> list[dict]:
    """The keyless public-domain sources the repo already ships adapters for.

    Every call is wrapped: these adapters scrape websites rather than call APIs,
    so one of them being redesigned overnight must cost this query and nothing
    more. Anything that cannot be scored is dropped rather than guessed at.
    """
    try:
        sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
        from tools.video.stock_sources import available_sources, SearchFilters
    except Exception as e:
        print(f"      archive sources unavailable ({type(e).__name__})")
        return []

    # each adapter logs its own failures with a full URL and traceback; a dozen
    # of those per beat would bury the log, and the one-line summary below says
    # everything the run needs
    quiet = logging.getLogger("tools.video.stock_sources")
    was = quiet.level
    quiet.setLevel(logging.CRITICAL)
    try:
        return _archive_hits(available_sources(), SearchFilters, query, min_duration)
    finally:
        quiet.setLevel(was)


def _archive_hits(sources, SearchFilters, query: str, min_duration: float) -> list[dict]:
    out: list[dict] = []
    for src in sources:
        try:
            hits = src.search(query, SearchFilters())
        except Exception as e:
            print(f"      {src.name}: {type(e).__name__}")
            continue
        for c in hits[:6]:
            if getattr(c, "kind", "video") != "video" or not c.download_url:
                continue
            if c.duration and c.duration < min_duration:
                continue
            score = _score(c.width or 0, c.height or 0)
            if score <= 0:
                continue
            out.append({"source": src.name, "url": c.download_url,
                        "w": c.width, "h": c.height, "duration": c.duration or 0.0,
                        "credit": f"{c.creator or src.name} ({c.license or 'public domain'})",
                        # archival footage is nearly always landscape, so it
                        # ranks below anything the vertical libraries returned
                        "page": c.source_url or "", "score": score * 0.6,
                        # duration is often unknown here, so it is verified
                        # after download rather than trusted from the listing
                        "verify": not c.duration})
    return out


def _duration(path: Path) -> float:
    p = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                        "-of", "csv=p=0", str(path)], capture_output=True, text=True)
    try:
        return float(p.stdout.strip())
    except ValueError:
        return 0.0


def find(query: str, out: Path, min_duration: float = 4.0) -> dict | None:
    """Download the best vertical clip for `query`. None when nothing fits."""
    candidates = sorted(_pexels(query, min_duration) + _pixabay(query, min_duration),
                        key=lambda c: c["score"], reverse=True)
    if not candidates:
        candidates = sorted(_archives(query, min_duration),
                            key=lambda c: c["score"], reverse=True)
    for c in candidates[:4]:
        try:
            r = requests.get(c["url"], timeout=300, stream=True)
            if r.status_code != 200:
                continue
            out.parent.mkdir(parents=True, exist_ok=True)
            size, over = 0, False
            with out.open("wb") as fh:
                for chunk in r.iter_content(1 << 20):
                    size += len(chunk)
                    if size > MAX_DOWNLOAD:
                        over = True
                        break
                    fh.write(chunk)
            if over:
                print(f"      {c['source']}: over {MAX_DOWNLOAD >> 20}MB, skipped")
                out.unlink(missing_ok=True)
                continue
            if size < 40_000:                    # a truncated or placeholder file
                continue
            if c.get("verify") and _duration(out) < min_duration:
                out.unlink(missing_ok=True)
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


def gather(scenes: list[dict], work: Path, timing: dict,
           fallback_query: str = "") -> dict:
    """Fetch a clip for every scene that asks for one. Returns {index: info}.

    A beat whose own search comes back empty retries against the topic-level
    query, so one unlucky phrase does not quietly drop the footage coverage the
    format depends on.
    """
    got: dict[int, dict] = {}
    creds = []
    for i, (sc, beat) in enumerate(zip(scenes, timing["beats"])):
        q = sc.get("stock")
        if not q:
            continue
        need = max(beat["dur"] + 1.2, 3.0)
        raw = work / "stock" / f"{i:02d}-raw.mp4"
        info = find(q, raw, min_duration=min(need, 6.0))
        if not info and fallback_query:
            print(f"    scene {i+1}: nothing for {q!r}, retrying {fallback_query!r}")
            info = find(fallback_query, raw, min_duration=min(need, 6.0))
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
    asked = sum(1 for sc in scenes if (sc.get("stock") or "").strip())
    print(f"    footage on {len(got)}/{len(scenes)} scenes ({asked} asked for)")
    return got
