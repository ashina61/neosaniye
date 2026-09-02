"""Bundle the deliverable, and publish it to whichever platforms are enabled.

Upload is off unless asked for, so a run can always be exercised end to end
without touching a live account. Each platform is independent: one failing is
reported and does not stop the others, because a partial publish is more useful
than none and the report says exactly what landed where.
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import date
from pathlib import Path

import yaml

sys.path.insert(0, str(Path(__file__).resolve().parent))
import package    # noqa: E402
import release    # noqa: E402
import social     # noqa: E402
import youtube    # noqa: E402


def main() -> int:
    ap = argparse.ArgumentParser(description="Bundle and optionally publish one short.")
    ap.add_argument("out_dir", type=Path)
    ap.add_argument("--spec", type=Path, required=True)
    # Each of these falls back to the spec's own `copy` block, which write_spec.py
    # fills in, so an automated run passes none of them and a manual one can
    # override any single field.
    ap.add_argument("--title")
    ap.add_argument("--hook")
    ap.add_argument("--caption")
    ap.add_argument("--description")
    ap.add_argument("--hashtags")
    ap.add_argument("--privacy", default="unlisted",
                    choices=["public", "unlisted", "private"])
    ap.add_argument("--upload", default="none",
                    help="comma-separated: none | all | youtube,instagram,facebook")
    ap.add_argument("--dest", type=Path, default=None)
    a = ap.parse_args()

    spec = yaml.safe_load(a.spec.read_text())
    c = spec.get("copy") or {}
    a.title = a.title or c.get("title")
    a.hook = a.hook or c.get("hook")
    a.caption = a.caption or c.get("caption")
    a.description = a.description or c.get("description") or (
        f'{c.get("caption", "")}\n\n#Shorts'.strip())
    if a.hashtags is None:
        a.hashtags = ",".join(c.get("hashtags") or ["science", "shorts"])
    missing = [n for n in ("title", "hook", "caption") if not getattr(a, n)]
    if missing:
        print(f"no copy for: {', '.join(missing)} — pass them, or put a `copy` "
              f"block in {a.spec}", file=sys.stderr)
        return 1

    videos = sorted(a.out_dir.glob("*_1080x1920.mp4"))
    if not videos:
        print(f"no finished video in {a.out_dir}", file=sys.stderr)
        return 1
    video = videos[0]
    tags = [t.strip() for t in a.hashtags.split(",") if t.strip()]
    tagline = " ".join(f"#{t.lstrip('#')}" for t in tags)

    want = {w.strip().lower() for w in a.upload.split(",") if w.strip()}
    if "all" in want:
        want = {"youtube", "instagram", "facebook"}
    want.discard("none")

    copy = {"title": a.title, "hook": a.hook, "caption": a.caption,
            "youtube_description": a.description, "hashtags": tags}
    dest = a.dest or Path(__file__).resolve().parents[2] / "videos" / spec["slug"]
    attribution = a.out_dir / "project" / "attribution.txt"
    bundle = package.bundle(video, spec, copy, dest)
    if attribution.exists():
        (dest / "attribution.txt").write_text(attribution.read_text())
    print(f"bundle: {bundle}")

    if not want:
        print("upload: disabled (--upload none)")
        print("result: bundled")
        return 0

    results: dict[str, str] = {}

    # Instagram fetches the file from a URL rather than accepting an upload, so
    # the release has to exist before either Meta call.
    public_url = None
    if want & {"instagram", "facebook"}:
        try:
            public_url = release.publish(
                video, tag=f"short-{spec['slug']}",
                title=a.title, body=f"{a.hook}\n\n{a.caption}")
            print(f"release: {public_url}")
        except Exception as e:                      # noqa: BLE001
            print(f"release: FAILED ({e})", file=sys.stderr)
            results["release"] = f"failed: {e}"

    if "youtube" in want:
        try:
            meta = youtube.build_metadata(a.title, a.description, tags, a.privacy)
            vid = youtube.upload(video, meta)
            results["youtube"] = f"https://youtube.com/shorts/{vid}"
            print(f"youtube: {results['youtube']}")
            # The tags go in the first comment, not the description. A failure
            # here is cosmetic — the video is already up — and the usual cause
            # is a token minted for upload only, so it must not fail the run.
            try:
                youtube.comment(vid, f"{a.hook}\n\n{tagline}")
                print("youtube: first comment posted")
            except Exception as e:                  # noqa: BLE001
                print(f"youtube: first comment skipped ({e})", file=sys.stderr)
        except youtube.MissingCredentials as e:
            results["youtube"] = f"skipped: {e}"
            print(f"youtube: SKIPPED ({e})")
        except Exception as e:                      # noqa: BLE001
            results["youtube"] = f"failed: {e}"
            print(f"youtube: FAILED ({e})", file=sys.stderr)

    if want & {"instagram", "facebook"} and public_url:
        try:
            tgt = social.targets()
            print(f"meta: page {tgt['page_name']}, ig account {tgt['ig_user_id'] or 'none'}")
        except Exception as e:                      # noqa: BLE001
            tgt = None
            for p in want & {"instagram", "facebook"}:
                results[p] = f"failed: {e}"
            print(f"meta: FAILED ({e})", file=sys.stderr)

        if tgt:
            if "instagram" in want:
                try:
                    mid = social.post_instagram(public_url, f"{a.hook}\n\n{a.caption}\n\n{tagline}", tgt)
                    results["instagram"] = f"media {mid}"
                    print(f"instagram: published ({mid})")
                except Exception as e:              # noqa: BLE001
                    results["instagram"] = f"failed: {e}"
                    print(f"instagram: FAILED ({e})", file=sys.stderr)
            if "facebook" in want:
                try:
                    fid = social.post_facebook(public_url, f"{a.hook}\n\n{a.caption}", tgt)
                    results["facebook"] = f"video {fid}"
                    print(f"facebook: published ({fid})")
                except Exception as e:              # noqa: BLE001
                    results["facebook"] = f"failed: {e}"
                    print(f"facebook: FAILED ({e})", file=sys.stderr)

    (dest / "published.json").write_text(json.dumps(
        {"date": date.today().isoformat(), "slug": spec["slug"],
         "public_url": public_url, "results": results}, indent=1))
    print("result: " + ("; ".join(f"{k}={v}" for k, v in results.items()) or "nothing published"))
    return 0


if __name__ == "__main__":
    sys.exit(main())
