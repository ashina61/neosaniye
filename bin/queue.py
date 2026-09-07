#!/usr/bin/env python3
"""The publish queue: read it, find the next one, mark it done.

    bin/queue.py status                     what is where
    bin/queue.py next [--force]             the next entry, as KEY=VALUE
    bin/queue.py done <slug> [--url URL]    mark it published
    bin/queue.py tick                       stamp the queue, say if one is due
    bin/queue.py topic                      the next unused topic, as KEY=VALUE
    bin/queue.py add <slug> --topic <id>    put a finished production on the end

`next` prints nothing but `slug=` when there is nothing to do, so a workflow
can skip cleanly instead of failing. It also refuses an entry that does not
say both `upload` and `privacy`, because an unstated destination is how this
repository once published everywhere by accident.

AND IT REFUSES TO HAND OUT THE NEXT ONE TOO SOON. On 2026-09-06 a manual run
published one at 17:25 and the week's cron — two and a half hours late, not
skipped — fired at 17:27, took the next `pending`, and published that too. Two
videos, two minutes apart. Nothing was broken: both runs did exactly what they
were told, and nothing was asking whether a video was actually due. So `next`
measures the gap from the `published_at` stamp it writes itself and says
nothing is due inside `min_hours_between`. The channel now posts twice a day,
morning and evening, so the gap is counted in HOURS: a slot is ~11-13 hours
from its neighbour and a late cron lands on "nothing is due" rather than on
tomorrow morning's video. `--force` overrides it, out loud, for a human who has
decided to.
"""
import argparse, datetime, pathlib, signal, sys, yaml

# `bin/queue.py status | head` should not traceback
try: signal.signal(signal.SIGPIPE, signal.SIG_DFL)
except (AttributeError, ValueError): pass

ROOT = pathlib.Path(__file__).resolve().parent.parent
QUEUE = ROOT / "productions" / "QUEUE.yaml"
VALID_UPLOAD = {"none", "youtube", "all"}
DEFAULT_MIN_HOURS = 8       # if QUEUE.yaml does not say
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


UTC = datetime.timezone.utc


def stamp(e):
    """When this entry went out, as an aware UTC datetime, or None.

    `published_at` is the truth and `done` always writes it. `published_on` is
    a date, kept because it reads well in the file — an entry that carries only
    the date is read as the END of that day, which is the fail-safe direction:
    a gap counted in hours cannot be measured from an unknown hour, and the
    safe reading of "I am not sure when it went out" is not "send another".

    Anything unparseable raises, for the same reason.
    """
    raw = e.get("published_at")
    if raw:
        try:
            t = datetime.datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
        except ValueError:
            raise ValueError(f"{e.get('slug')} has published_at: {raw!r}, "
                             f"which is not an ISO timestamp")
        return t if t.tzinfo else t.replace(tzinfo=UTC)
    raw = e.get("published_on")
    if not raw:
        return None
    try:
        day = datetime.date.fromisoformat(str(raw))
    except ValueError:
        raise ValueError(f"{e.get('slug')} has published_on: {raw!r}, "
                         f"which is not a YYYY-MM-DD date")
    return datetime.datetime.combine(day, datetime.time(23, 59, 59), tzinfo=UTC)


def last_published(d):
    """(when, slug) of the most recent thing that went out, or None."""
    best = None
    for e in d["queue"]:
        t = stamp(e)
        if t is None:
            continue
        if best is None or t > best[0]:
            best = (t, e.get("slug"))
    return best


def slots_per_day(d):
    try:
        return max(1, int(d.get("slots_per_day", 2)))
    except (TypeError, ValueError):
        return 2


def min_hours(d):
    try:
        return max(0.0, float(d.get("min_hours_between", DEFAULT_MIN_HOURS)))
    except (TypeError, ValueError):
        return DEFAULT_MIN_HOURS


def hours_since(t):
    return (datetime.datetime.now(UTC) - t).total_seconds() / 3600.0


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
    per_day = slots_per_day(d)
    runway = n.get("pending", 0) / per_day
    print(f"\n {n.get('pending',0)} pending · {n.get('published',0)} published · {n.get('hold',0)} on hold")
    print(f" runway: {runway:.1f} days at {per_day} a day"
          + ("   ← MAKE MORE, the queue runs dry inside a day" if runway < 1.5 else ""))
    gap = min_hours(d)
    try:
        last = last_published(d)
    except ValueError as err:
        print(f" ! {err}")
        last = None
    if last:
        age = hours_since(last[0])
        print(f" last out: {last[1]} at {last[0]:%Y-%m-%d %H:%M} UTC ({age:.1f}h ago)"
              f" · minimum gap {gap:g}h"
              f" · {'DUE' if age >= gap else f'not due for {gap - age:.1f}h more'}")
    return 0


def cmd_next(d, force=False):
    if not d.get("enabled"):
        print("slug=")
        print("reason=the queue's master switch is off", file=sys.stderr)
        return 0
    # Two runs that overlap in time are not the risk; two runs that both find a
    # `pending` entry are. A late cron is a normal event, so the queue — not the
    # schedule — is what decides whether anything is due.
    gap = min_hours(d)
    try:
        last = last_published(d)
    except ValueError as err:
        print("slug=")
        print(f"reason={err}", file=sys.stderr)
        return 0
    if last and gap:
        age = hours_since(last[0])
        if age < gap:
            if not force:
                print("slug=")
                print(f"reason={last[1]} went out {age:.1f}h ago and this queue "
                      f"publishes at most one every {gap:g}h", file=sys.stderr)
                return 0
            print(f"--force: publishing anyway, {age:.1f}h after {last[1]}", file=sys.stderr)
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
    `pending`, which means it WILL be published — and the queue publishes twice
    a day, so a film added this morning can be on the channel this evening.
    There is no multi-day review window to catch a bad one any more: the build
    gates and the judgement of whoever added it are the review."""
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
    per = slots_per_day(d)
    print(f"{slug} added — {n} pending, which is {n / per:.1f} days at {per} a day")
    return 0


def cmd_tick(d):
    """Write the time of this check into the queue, and say whether a video is
    due. It exists because GitHub's scheduler does not run this repository's
    crons: the publisher is triggered by a PUSH, so something has to push when
    the queue comes due. This is that something — one line changes, it is the
    audit trail of the mechanism, and the commit it produces is what starts the
    upload. `enabled: false` still stops everything; a tick is only a check."""
    now = datetime.datetime.now(UTC).replace(microsecond=0)
    stampline = f'last_tick: "{now.strftime("%Y-%m-%dT%H:%M:%SZ")}"'
    lines = QUEUE.read_text().splitlines()
    for i, ln in enumerate(lines):
        if ln.startswith("last_tick:"):
            lines[i] = stampline
            break
    else:
        for i, ln in enumerate(lines):
            if ln.startswith("enabled:"):
                lines.insert(i + 1, "\n# When the queue was last checked by the tick Routine. GitHub's scheduler\n"
                                    "# does not run this repository's crons, so a push is what publishes and\n"
                                    "# this line is what makes the push.\n" + stampline)
                break
    QUEUE.write_text("\n".join(lines) + "\n")
    gap, last = min_hours(d), last_published(d)
    due = True
    if not d.get("enabled"):
        due = False; why = "the queue's master switch is off"
    elif last and hours_since(last[0]) < gap:
        due = False; why = f"{last[1]} went out {hours_since(last[0]):.1f}h ago, gap is {gap:g}h"
    else:
        nxt = [e for e in d["queue"] if e.get("state") == "pending" and not problems(e)]
        if not nxt:
            due = False; why = "nothing publishable is pending"
        else:
            why = f"{nxt[0]['slug']} is due"
    print(("DUE: " if due else "not due: ") + why)
    print("due=" + ("1" if due else "0"))
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
            now = datetime.datetime.now(UTC).replace(microsecond=0)
            lines[i] = f"{pad}state: published"
            extra = [f"{pad}published_on: \"{now.date().isoformat()}\"",
                     f"{pad}published_at: \"{now.strftime('%Y-%m-%dT%H:%M:%SZ')}\""]
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
    sub.add_parser("tick")
    ad = sub.add_parser("add"); ad.add_argument("slug"); ad.add_argument("--topic", default="")
    dn = sub.add_parser("done"); dn.add_argument("slug"); dn.add_argument("--url", default="")
    a = p.parse_args()
    d = load()
    if a.cmd == "status": return cmd_status(d)
    if a.cmd == "next": return cmd_next(d, a.force)
    if a.cmd == "topic": return cmd_topic(d)
    if a.cmd == "tick": return cmd_tick(d)
    if a.cmd == "add": return cmd_add(d, a.slug, a.topic)
    if a.cmd == "done": return cmd_done(d, a.slug, a.url)


if __name__ == "__main__":
    sys.exit(main())
