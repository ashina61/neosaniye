"""Topic queue with durable state, so a scheduled run never repeats itself."""
from __future__ import annotations

import json
from datetime import date
from pathlib import Path

import yaml

PIPE = Path(__file__).resolve().parents[1]
TOPICS = PIPE / "topics.yaml"
STATE = PIPE / "state.json"


def _state() -> dict:
    if STATE.exists():
        return json.loads(STATE.read_text())
    return {"done": []}


def all_topics() -> list[dict]:
    return yaml.safe_load(TOPICS.read_text())["topics"]


def done_ids() -> set[str]:
    return {d["id"] for d in _state()["done"]}


def remaining() -> list[dict]:
    used = done_ids()
    return [t for t in all_topics() if t["id"] not in used]


def take(n: int = 1) -> list[dict]:
    """The next n unused topics, in queue order. Does not mark them."""
    left = remaining()
    if len(left) < n:
        raise RuntimeError(
            f"topic queue nearly empty: {len(left)} left, {n} requested. "
            f"Add entries to {TOPICS.name} before the next run.")
    return left[:n]


def mark(topic_id: str, **meta) -> None:
    st = _state()
    if any(d["id"] == topic_id for d in st["done"]):
        return
    st["done"].append({"id": topic_id, "date": date.today().isoformat(), **meta})
    STATE.write_text(json.dumps(st, indent=1))


if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == "status":
        print(f"{len(remaining())} of {len(all_topics())} topics remaining")
        for t in take(min(2, len(remaining()))):
            print(f"  next: {t['id']} — {t['question']}")
