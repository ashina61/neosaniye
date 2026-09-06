#!/usr/bin/env python3
"""The publish queue: read it, find the next one, mark it done.

    bin/queue.py status                     what is where
    bin/queue.py next                       the next entry, as KEY=VALUE
    bin/queue.py done <slug> [--url URL]    mark it published

`next` prints nothing but `slug=` when there is nothing to do, so a workflow
can skip cleanly instead of failing. It also refuses an entry that does not
say both `upload` and `privacy`, because an unstated destination is how this
repository once published everywhere by accident.
"""
import argparse, datetime, pathlib, signal, sys, yaml

# `bin/queue.py status | head` should not traceback
try: signal.signal(signal.SIGPIPE, signal.SIG_DFL)
except (AttributeError, ValueError): pass

ROOT = pathlib.Path(__file__).resolve().parent.parent
QUEUE = ROOT / "productions" / "QUEUE.yaml"
VALID_UPLOAD = {"none", "youtube", "all"}
VALID_PRIVACY = {"unlisted", "public", "private"}


def load():
    d = yaml.safe_load(QUEUE.read_text())
    if not isinstance(d, dict) or "queue" not in d:
        sys.exit(f"{QUEUE} is not a queue")
    return d


def problems(e):
    out = []
    slug = e.get("slug", "?")
    d = ROOT / "productions" / str(slug)
    if not (d / "spec.yaml").is_file():
        out.append("no spec.yaml")
    if not list(d.glob("*_1080x1920.mp4")):
        out.append("no *_1080x1920.mp4")
    if e.get("upload") not in VALID_UPLOAD:
        out.append(f"upload must be one of {sorted(VALID_UPLOAD)}")
    if e.get("privacy") not in VALID_PRIVACY:
        out.append(f"privacy must be one of {sorted(VALID_PRIVACY)}")
    return out


def cmd_status(d):
    print(f"queue: {'ENABLED' if d.get('enabled') else 'disabled (nothing will publish)'}"
          f"   {d.get('schedule', '')}")
    n = {"pending": 0, "published": 0, "hold": 0}
    for i, e in enumerate(d["queue"], 1):
        st = e.get("state", "?")
        n[st] = n.get(st, 0) + 1
        bad = problems(e) if st != "published" else []
        mark = {"pending": "·", "published": "✓", "hold": "—"}.get(st, "?")
        line = (f" {mark} {i}. {e.get('slug'):<32} {st:<10}"
                f" {e.get('upload','?')}/{e.get('privacy','?')}")
        if e.get("published_on"):
            line += f"  {e['published_on']}"
        print(line)
        for b in bad:
            print(f"      ! {b}")
    print(f"\n {n.get('pending',0)} pending · {n.get('published',0)} published · {n.get('hold',0)} on hold")
    return 0


def cmd_next(d):
    if not d.get("enabled"):
        print("slug=")
        print("reason=the queue's master switch is off", file=sys.stderr)
        return 0
    for e in d["queue"]:
        if e.get("state") != "pending":
            continue
        bad = problems(e)
        if bad:
            print(f"skipping {e.get('slug')}: {'; '.join(bad)}", file=sys.stderr)
            continue
        print(f"slug={e['slug']}")
        print(f"upload={e['upload']}")
        print(f"privacy={e['privacy']}")
        return 0
    print("slug=")
    print("reason=nothing pending", file=sys.stderr)
    return 0


def cmd_done(d, slug, url):
    txt = QUEUE.read_text()
    hit = None
    for e in d["queue"]:
        if e.get("slug") == slug and e.get("state") == "pending":
            hit = e
            break
    if hit is None:
        sys.exit(f"{slug} is not pending in the queue")
    # rewrite in place so the file keeps its comments — this file is mostly
    # comments and they are the reason it is shaped the way it is
    lines = txt.splitlines()
    seen = False
    for i, ln in enumerate(lines):
        if ln.strip() == f"- slug: {slug}":
            seen = True
        elif seen and ln.strip() == "state: pending":
            pad = ln[: len(ln) - len(ln.lstrip())]
            lines[i] = f"{pad}state: published"
            extra = [f"{pad}published_on: \"{datetime.date.today().isoformat()}\""]
            if url:
                extra.append(f'{pad}url: "{url}"')
            lines[i + 1 : i + 1] = extra
            QUEUE.write_text("\n".join(lines) + "\n")
            print(f"{slug} -> published")
            return 0
        elif seen and ln.strip().startswith("- slug:"):
            break
    sys.exit(f"could not find a pending state line for {slug}")


def main():
    p = argparse.ArgumentParser()
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("status")
    sub.add_parser("next")
    dn = sub.add_parser("done"); dn.add_argument("slug"); dn.add_argument("--url", default="")
    a = p.parse_args()
    d = load()
    if a.cmd == "status": return cmd_status(d)
    if a.cmd == "next": return cmd_next(d)
    if a.cmd == "done": return cmd_done(d, a.slug, a.url)


if __name__ == "__main__":
    sys.exit(main())
