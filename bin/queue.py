#!/usr/bin/env python3
"""The publish queue: read it, find the next one, mark it done.

    bin/queue.py status                     what is where
    bin/queue.py next [--force]             the next entry, as KEY=VALUE
    bin/queue.py done <slug> [--url URL]    mark it published
    bin/queue.py topic                      the next unused topic, as KEY=VALUE
    bin/queue.py add <slug> --topic <id>    put a finished production on the end

`next` prints nothing but `slug=` when there is nothing to do, so a workflow
can skip cleanly instead of failing. It also refuses an entry that does not
say both `upload` and `privacy`, because an unstated destination is how this
repository once published everywhere by accident.

AND IT REFUSES TO HAND OUT A SECOND VIDEO TOO SOON. On 2026-09-06 a manual run
published one at 17:25 and the week's cron — two and a half hours late, not
skipped — fired at 17:27, took the next `pending`, and published that too. Two
videos, two minutes apart, on a channel that posts one a week. Nothing was
broken: both runs did exactly what they were told. So `next` now looks at the
`published_on` dates it writes itself and says nothing is due unless the last
one is at least `min_days_between` days old. `--force` overrides it, out loud,
and is meant for a human who has decided to.
"""
import argparse, datetime, pathlib, signal, sys, yaml

# `bin/queue.py status | head` should not traceback
try: signal.signal(signal.SIGPIPE, signal.SIG_DFL)
except (AttributeError, ValueError): pass

ROOT = pathlib.Path(__file__).resolve().parent.parent
QUEUE = ROOT / "productions" / "QUEUE.yaml"
VALID_UPLOAD = {"none", "youtube", "all"}
DEFAULT_MIN_DAYS = 5        # if QUEUE.yaml does not say
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


def last_published(d):
    """(date, slug) of the most recent thing that went out, or None.

    A `published_on` that will not parse raises: a date this cannot read is a
    date the gap below cannot be measured from, and the safe reading of "I do
    not know when the last one went out" is not "publish another".
    """
    best = None
    for e in d["queue"]:
        raw = e.get("published_on")
        if not raw:
            continue
        try:
            day = datetime.date.fromisoformat(str(raw))
        except ValueError:
            raise ValueError(f"{e.get('slug')} has published_on: {raw!r}, "
                             f"which is not a YYYY-MM-DD date")
        if best is None or day > best[0]:
            best = (day, e.get("slug"))
    return best


def min_days(d):
    try:
        return max(0, int(d.get("min_days_between", DEFAULT_MIN_DAYS)))
    except (TypeError, ValueError):
        return DEFAULT_MIN_DAYS


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
    gap = min_days(d)
    try:
        last = last_published(d)
    except ValueError as err:
        print(f" ! {err}")
        last = None
    if last:
        age = (datetime.date.today() - last[0]).days
        print(f" last out: {last[1]} on {last[0]} ({age}d ago)"
              f" · minimum gap {gap}d"
              f" · {'DUE' if age >= gap else f'not due for {gap - age}d more'}")
    return 0


def cmd_next(d, force=False):
    if not d.get("enabled"):
        print("slug=")
        print("reason=the queue's master switch is off", file=sys.stderr)
        return 0
    # Two runs that overlap in time are not the risk; two runs that both find a
    # `pending` entry are. A late cron is a normal event, so the queue — not the
    # schedule — is what decides whether anything is due.
    gap = min_days(d)
    try:
        last = last_published(d)
    except ValueError as err:
        print("slug=")
        print(f"reason={err}", file=sys.stderr)
        return 0
    if last and gap:
        age = (datetime.date.today() - last[0]).days
        if age < gap:
            if not force:
                print("slug=")
                print(f"reason={last[1]} went out on {last[0]} ({age}d ago) and this "
                      f"queue publishes at most one every {gap} days", file=sys.stderr)
                return 0
            print(f"--force: publishing anyway, {age}d after {last[1]}", file=sys.stderr)
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


TOPICS = ROOT / "daily" / "topics.yaml"


def cmd_topic(d):
    """The next topic nobody has made yet. Topics are curated in
    daily/topics.yaml with the mechanism already written down, so picking one
    needs no model and cannot invent a physics claim."""
    used = set(d.get("topics_used") or [])
    for t in yaml.safe_load(TOPICS.read_text())["topics"]:
        if t["id"] in used:
            continue
        print(f"id={t['id']}")
        print(f"question={t['question']}")
        print(f"mechanism={t['mechanism']}")
        return 0
    print("id=")
    print("reason=every topic in daily/topics.yaml has been made", file=sys.stderr)
    return 0


def cmd_add(d, slug, topic):
    """Put a finished production on the end of the queue. It goes in as
    `pending`, which means it will be published — but the queue publishes ONE A
    WEEK, so a video made today sits behind everything already in the line.
    That gap is the review window, and it is the reason a daily producer and a
    weekly publisher are safe together."""
    if any(e.get("slug") == slug for e in d["queue"]):
        print(f"{slug} is already in the queue"); return 0
    bad = problems({"slug": slug, "upload": "youtube", "privacy": "public"})
    if bad:
        sys.exit(f"{slug} is not shippable: {'; '.join(bad)}")
    txt = QUEUE.read_text().rstrip("\n")
    txt += (f"\n\n  - slug: {slug}\n"
            f"    state: pending\n"
            f"    upload: youtube\n"
            f"    privacy: public\n"
            f"    made_on: \"{datetime.date.today().isoformat()}\"\n")
    if topic:
        txt += f"    topic: {topic}\n"
        if "topics_used:" in txt:
            txt = txt.replace("topics_used:", f"topics_used:\n  - {topic}", 1)
        else:
            txt = txt.replace("queue:", f"topics_used:\n  - {topic}\n\nqueue:", 1)
    QUEUE.write_text(txt + "\n")
    n = sum(1 for e in d["queue"] if e.get("state") == "pending") + 1
    print(f"{slug} added — {n} pending, so it is about {n} weeks out")
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
    nx = sub.add_parser("next")
    nx.add_argument("--force", action="store_true",
                    help="ignore the minimum gap between publishes")
    sub.add_parser("topic")
    ad = sub.add_parser("add"); ad.add_argument("slug"); ad.add_argument("--topic", default="")
    dn = sub.add_parser("done"); dn.add_argument("slug"); dn.add_argument("--url", default="")
    a = p.parse_args()
    d = load()
    if a.cmd == "status": return cmd_status(d)
    if a.cmd == "next": return cmd_next(d, a.force)
    if a.cmd == "topic": return cmd_topic(d)
    if a.cmd == "add": return cmd_add(d, a.slug, a.topic)
    if a.cmd == "done": return cmd_done(d, a.slug, a.url)


if __name__ == "__main__":
    sys.exit(main())
