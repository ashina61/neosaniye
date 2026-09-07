#!/usr/bin/env python3
"""Is this description a Shorts description, or an essay?

    bin/check-copy.py                     every production
    bin/check-copy.py productions/x/spec.yaml

The first eight videos went up with 1000-2200 character descriptions and one
visible hashtag, `#Shorts`, at the bottom. On a Short a viewer sees roughly the
first line and has to tap for the rest, and hashtags in the YouTube API's `tags`
field are metadata nobody can see — so the films had, in practice, no tags at
all and a wall of text nobody would open.

This is the gate that stops that shipping again. It runs before the upload, in
the same workflow, and a failure keeps the entry `pending` rather than putting
an essay on the channel.

The limits are deliberately loose enough for a real paragraph and tight enough
that nobody pastes a bibliography: the point is one line that earns the tap,
one that pays it off, a source, and tags a human can actually see.
"""
import pathlib, re, sys, yaml

ROOT = pathlib.Path(__file__).resolve().parent.parent

TITLE_MIN, TITLE_MAX = 10, 100      # YouTube's own limit is 100
DESC_MIN, DESC_MAX = 150, 700       # ~2 short paragraphs, a source and the tags
FIRST_LINE_MAX = 160                # about what a phone shows before "more"
VISIBLE_TAGS_MIN = 4
KEYWORDS_MIN, KEYWORDS_MAX = 4, 15


def check(spec: pathlib.Path) -> list[str]:
    d = yaml.safe_load(spec.read_text()) or {}
    c = d.get("copy") or {}
    bad = []

    title = (c.get("title") or "").strip()
    if not TITLE_MIN <= len(title) <= TITLE_MAX:
        bad.append(f"title is {len(title)} chars, want {TITLE_MIN}-{TITLE_MAX}")

    if not (c.get("hook") or "").strip():
        bad.append("no hook — that is the line the first comment is built from")

    desc = (c.get("description") or "").strip()
    if not DESC_MIN <= len(desc) <= DESC_MAX:
        bad.append(f"description is {len(desc)} chars, want {DESC_MIN}-{DESC_MAX}"
                   + (" — a Short is not the place for the essay" if len(desc) > DESC_MAX else ""))

    first = desc.split("\n", 1)[0]
    if len(first) > FIRST_LINE_MAX:
        bad.append(f"first line is {len(first)} chars — that is the only line most "
                   f"people read, keep it under {FIRST_LINE_MAX}")

    tags = re.findall(r"#\w+", desc)
    if len(tags) < VISIBLE_TAGS_MIN:
        bad.append(f"{len(tags)} hashtag(s) in the description, want at least "
                   f"{VISIBLE_TAGS_MIN} — the `hashtags` list below is API metadata "
                   f"and nobody can see it")
    if not any(t.lower() == "#shorts" for t in tags):
        bad.append("no #Shorts in the description")

    if len(re.findall(r"https?://", desc)) > 1:
        bad.append("more than one link — cite the one paper, keep the rest in source/")

    kw = c.get("hashtags") or []
    if not KEYWORDS_MIN <= len(kw) <= KEYWORDS_MAX:
        bad.append(f"{len(kw)} keyword tags, want {KEYWORDS_MIN}-{KEYWORDS_MAX}")
    if any(str(k).startswith("#") for k in kw):
        bad.append("keyword tags must not carry a '#' — YouTube adds nothing, it stores them raw")

    return bad


def main() -> int:
    args = sys.argv[1:]
    specs = [pathlib.Path(a) for a in args] or sorted(
        (ROOT / "productions").glob("*/spec.yaml"))
    fails = 0
    for s in specs:
        bad = check(s)
        name = s.parent.name
        if bad:
            fails += 1
            print(f" ✗ {name}")
            for b in bad:
                print(f"     {b}")
        else:
            d = (yaml.safe_load(s.read_text())["copy"]["description"]).strip()
            n = len(re.findall(r"#\w+", d))
            print(f" ✓ {name:<32} {len(d):>3} chars · {n} visible tags")
    if fails:
        print(f"\n{fails} production(s) would go up with copy nobody reads.")
        return 1
    print(f"\n{len(specs)} production(s) OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
