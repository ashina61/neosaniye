"""Bundle for hand-posting, and upload to YouTube when credentials are present.

A missing YouTube credential is a normal outcome here, not an error: the bundle
is still written and the run reports SKIPPED. Instagram and Facebook are always
hand-posted from the bundle, because this network blocks Meta's Graph API.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import yaml

sys.path.insert(0, str(Path(__file__).resolve().parent))
import package    # noqa: E402
import youtube    # noqa: E402


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("out_dir", type=Path)
    ap.add_argument("--spec", type=Path, required=True)
    ap.add_argument("--title", required=True)
    ap.add_argument("--hook", required=True)
    ap.add_argument("--caption", required=True)
    ap.add_argument("--description", required=True)
    ap.add_argument("--hashtags", default="science,shorts")
    ap.add_argument("--privacy", default="unlisted", choices=["public", "unlisted", "private"])
    ap.add_argument("--dest", type=Path, default=None,
                    help="where the deliverable bundle lands (default videos/<slug>/)")
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()

    spec = yaml.safe_load(a.spec.read_text())
    videos = sorted(a.out_dir.glob("*_1080x1920.mp4"))
    if not videos:
        print(f"no finished video in {a.out_dir}", file=sys.stderr)
        return 1
    video = videos[0]
    tags = [t.strip() for t in a.hashtags.split(",") if t.strip()]

    copy = {"title": a.title, "hook": a.hook, "caption": a.caption,
            "youtube_description": a.description, "hashtags": tags}
    # out/ is scratch and ignored by git; deliverables land in videos/<slug>/
    dest = a.dest or Path(__file__).resolve().parents[2] / "videos" / spec["slug"]
    bundle = package.bundle(video, spec, copy, dest)
    print(f"bundle: {bundle}")

    try:
        meta = youtube.build_metadata(a.title, a.description, tags, a.privacy)
        vid = youtube.upload(video, meta, a.dry_run)
    except youtube.MissingCredentials as e:
        print(f"youtube: SKIPPED ({e})")
        print("result: skipped")
        return 0
    except Exception as e:                        # noqa: BLE001 — surfaced to the run report
        print(f"youtube: FAILED ({e})", file=sys.stderr)
        return 1
    print(f"youtube: https://youtube.com/shorts/{vid}" if vid != "DRY-RUN" else "youtube: dry-run ok")
    print(f"result: {vid}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
