#!/usr/bin/env python3
"""Rewrite the title, description and tags of a video that is ALREADY on YouTube.

    bin/refresh-metadata.py <slug> [--dry-run]
    bin/refresh-metadata.py --published [--dry-run]     every published entry

The first eight films went up with a 1800-character description and one visible
hashtag. bin/check-copy.py stops that happening again, but two of them were
already public by the time anyone looked — and the copy in productions/<slug>/
spec.yaml is now the short version, so the repository and the channel disagree.
This is what settles that argument in the channel's favour.

It changes metadata only. It never touches the video, the thumbnail, the
privacy status or the comments, and it refuses a slug the queue does not record
as published with a real URL — there is nothing to refresh on a video that was
never uploaded, and guessing an id is how you edit a stranger's video.
"""
import argparse, pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
HERE = pathlib.Path(__file__).resolve().parent

# Python puts this script's own directory first on sys.path, and this directory
# contains queue.py — so `import requests` further down ends up importing OUR
# queue instead of the standard library's, and urllib3 dies on
# `queue.LifoQueue`. Drop bin/ before importing anything that reaches the net.
sys.path[:] = [d for d in sys.path
               if d and pathlib.Path(d).resolve() != HERE] or sys.path[1:]
sys.path.insert(0, str(ROOT / "daily" / "lib"))

import yaml               # noqa: E402
import youtube            # noqa: E402

QUEUE = ROOT / "productions" / "QUEUE.yaml"


def entries():
    d = yaml.safe_load(QUEUE.read_text())
    return {e["slug"]: e for e in d["queue"] if e.get("slug")}


def video_id(entry):
    """The id out of the queue's own url. Nothing is inferred or searched."""
    m = re.search(r"(?:shorts/|watch\?v=|youtu\.be/)([A-Za-z0-9_-]{6,})", entry.get("url") or "")
    return m.group(1) if m else None


def refresh(slug, entry, dry_run):
    if entry.get("state") != "published":
        print(f" ✗ {slug}: the queue does not say it is published")
        return 1
    vid = video_id(entry)
    if not vid:
        print(f" ✗ {slug}: no usable url in the queue entry")
        return 1
    spec = yaml.safe_load((ROOT / "productions" / slug / "spec.yaml").read_text())
    c = spec.get("copy") or {}
    meta = youtube.build_metadata(
        c["title"], (c.get("description") or "").strip(),
        [str(t) for t in (c.get("hashtags") or [])],
        entry.get("privacy", "public"))
    try:
        youtube.update_metadata(vid, meta, dry_run=dry_run)
    except RuntimeError as e:
        if "403" in str(e) or "insufficient" in str(e).lower():
            print(f" ✗ {slug}: the token cannot edit videos — it was minted with "
                  f"youtube.upload only. Remint it with youtube.force-ssl, or "
                  f"paste the description from spec.yaml in YouTube Studio.")
            print(f"     {e}")
            return 1
        raise
    d = meta["snippet"]["description"]
    print(f" {'·' if dry_run else '✓'} {slug}: {vid} — {len(d)} chars, "
          f"{len(re.findall(r'#[A-Za-z0-9_]+', d))} visible tags, "
          f"{len(meta['snippet']['tags'])} keywords"
          + ("   (dry run, nothing changed)" if dry_run else ""))
    return 0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("slug", nargs="?")
    ap.add_argument("--published", action="store_true",
                    help="every entry the queue records as published")
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()
    q = entries()
    if a.published:
        slugs = [s for s, e in q.items() if e.get("state") == "published"]
        if not slugs:
            print("nothing is published yet"); return 0
    elif a.slug:
        if a.slug not in q:
            sys.exit(f"{a.slug} is not in the queue")
        slugs = [a.slug]
    else:
        sys.exit("give a slug, or --published")
    bad = sum(refresh(s, q[s], a.dry_run) for s in slugs)
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
