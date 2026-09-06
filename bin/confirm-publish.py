#!/usr/bin/env python3
"""Did it actually go up?

    bin/confirm-publish.py videos/<slug>/published.json youtube

`daily/lib/publish.py` ALWAYS returns 0. Every upload failure is caught and
recorded — `results["youtube"] = "failed: ..."` or `"skipped: ..."` — and then
it exits cleanly, because it is written to publish to several places and not
lose the ones that worked when one of them does not.

That is fine for publish.py and fatal for a queue. Without this check the queue
would tick a video off, move to the next one next week, and silently drop the
first — and the workflow's own comment claims it only ticks off what actually
went. This is what makes that true.

Exits non-zero, loudly, unless every destination that was asked for came back
with something that looks like a real published thing. Prints `url=` on stdout
for $GITHUB_OUTPUT.
"""
import json, pathlib, sys

WANT = {"none": set(), "youtube": {"youtube"}, "all": {"youtube", "instagram", "facebook"}}


def main() -> int:
    if len(sys.argv) < 3:
        sys.exit("usage: confirm-publish.py <published.json> <none|youtube|all>")
    path, target = pathlib.Path(sys.argv[1]), sys.argv[2]
    want = WANT.get(target)
    if want is None:
        sys.exit(f"unknown upload target {target!r}")
    if not want:
        print("url=")
        return 0

    if not path.is_file():
        sys.exit(f"publish.py wrote no {path} — nothing was uploaded")
    d = json.loads(path.read_text())
    results = d.get("results") or {}

    bad = []
    for dest in sorted(want):
        v = str(results.get(dest, ""))
        if not v:
            bad.append(f"{dest}: publish.py never reported on it")
        elif v.startswith(("failed:", "skipped:")):
            bad.append(f"{dest}: {v}")
    if bad:
        print("THE UPLOAD DID NOT HAPPEN:", file=sys.stderr)
        for b in bad:
            print(f"  {b}", file=sys.stderr)
        print("Leaving the queue entry as `pending` so it is tried again "
              "rather than skipped in silence.", file=sys.stderr)
        return 1

    url = ""
    yt = str(results.get("youtube", ""))
    if yt.startswith("http"):
        url = yt
    elif d.get("public_url"):
        url = str(d["public_url"])
    print(f"url={url}")
    for k, v in sorted(results.items()):
        print(f"  {k}: {v}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
