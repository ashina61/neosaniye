"""Write a video spec from a topic row, using Gemini, and refuse a bad one.

The model drafts; this module is the editor. Every rule the house style depends
on — beat count, word budget, headline width, scene variety, motif choice — is
checked here and fed back on a retry, because a spec that violates them renders
into an unreadable frame that no later gate can catch.
"""
from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path

import requests
import yaml

MODELS = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-flash-latest"]
URL = "https://generativelanguage.googleapis.com/v1beta/models/{m}:generateContent"

BEATS = 10
WORDS_MIN, WORDS_MAX = 95, 115
HEADLINE_MAX = 16          # characters; headlines are nowrap in a condensed face
SCENE_TYPES = ["hook", "statement", "card", "metric", "list", "compare", "endcard"]
MOTIFS = ["wave", "rings", "beam", "split", "particles"]

PROMPT = """You are writing a 40-second vertical science short. It must teach one
mechanism clearly enough that a viewer can repeat the explanation afterwards.

TOPIC: {question}
MECHANISM (the truth you must convey, do not contradict it): {mechanism}

Write exactly {beats} narration beats, {wmin}-{wmax} words in total.

Beat shape:
 1 hook - the surprising fact, stated flat. No "did you know", no question.
 2 reframe - overturn the assumption the hook creates.
 3 setup - name the parts of the mechanism.
 4 first part.
 5 second part.
 6 the rule - the one sentence that does the explaining.
 7 consequence - what follows from the rule.
 8 the turn - the case where it breaks, or the limit.
 9 why that matters.
10 payoff - land it, echoing the hook's language.

Voice: plain, short sentences, present tense. Say the mechanism, not a metaphor
for it. No filler adjectives, no hedging, no "basically", no exclamation marks.
Every sentence must be defensible as written; if you are unsure of a number,
leave the number out rather than inventing one.

For each beat also give a scene:
  type: one of {types}
  motif: one of {motifs}   (omit for type card and compare - they draw a panel)
  stock: 2-4 plain English words naming REAL FOOTAGE that exists in a stock
         library and shows the beat's subject literally. Concrete nouns only
         ("power line closeup", "ocean waves aerial"). Omit stock when the beat
         is abstract and no honest footage exists - a graphics scene is better
         than footage that shows the wrong thing.
  headline: for hook/statement/endcard, exactly two lines, EACH AT MOST {hmax}
         CHARACTERS INCLUDING SPACES. This is a hard limit: longer lines run off
         the screen. Uppercase.
  items: for list, 2-3 short uppercase lines, each at most {hmax} characters.
  body/legend/eyebrow: for card. body is a short uppercase phrase, may wrap one
         word in <em></em> to accent it.
  label/unit/count_to: for metric.
  columns: for compare, exactly 2, each {{chip, value, label}}; value at most 8
         characters, uppercase.

Vary the scene types - never more than two `statement` scenes in a row.

Also give:
  title: a YouTube title, at most 90 characters, ending with " #Shorts"
  hook_line: one sentence for the social caption
  caption: two or three sentences explaining the mechanism for a caption
  hashtags: 6 lowercase tags, no # prefix
"""

SCHEMA = {
    "type": "object",
    "required": ["script", "scenes", "title", "hook_line", "caption", "hashtags"],
    "properties": {
        "script": {"type": "array", "items": {"type": "string"}},
        "title": {"type": "string"}, "hook_line": {"type": "string"},
        "caption": {"type": "string"},
        "hashtags": {"type": "array", "items": {"type": "string"}},
        "scenes": {"type": "array", "items": {
            "type": "object", "required": ["type"],
            "properties": {
                "type": {"type": "string"}, "motif": {"type": "string"},
                "stock": {"type": "string"},
                "headline": {"type": "array", "items": {"type": "string"}},
                "items": {"type": "array", "items": {"type": "string"}},
                "eyebrow": {"type": "string"}, "body": {"type": "string"},
                "legend": {"type": "string"}, "label": {"type": "string"},
                "unit": {"type": "string"}, "count_to": {"type": "number"},
                "columns": {"type": "array", "items": {
                    "type": "object",
                    "properties": {"chip": {"type": "string"}, "value": {"type": "string"},
                                   "label": {"type": "string"}, "risk": {"type": "boolean"}}}},
            }}},
    },
}


def _plain(s: str) -> str:
    return re.sub(r"<[^>]+>", "", s or "")


def validate(d: dict) -> list[str]:
    """Every house rule, checked. Returns the problems, empty when clean."""
    errs: list[str] = []
    script = d.get("script") or []
    scenes = d.get("scenes") or []
    if len(script) != BEATS:
        errs.append(f"script has {len(script)} beats, needs exactly {BEATS}")
    if len(scenes) != BEATS:
        errs.append(f"scenes has {len(scenes)} entries, needs exactly {BEATS}")
    words = sum(len(b.split()) for b in script)
    if not WORDS_MIN <= words <= WORDS_MAX:
        errs.append(f"script is {words} words, needs {WORDS_MIN}-{WORDS_MAX}")

    runs = 0
    for i, sc in enumerate(scenes, 1):
        t = sc.get("type")
        if t not in SCENE_TYPES:
            errs.append(f"scene {i}: type {t!r} is not one of {SCENE_TYPES}")
            continue
        runs = runs + 1 if t == "statement" else 0
        if runs > 2:
            errs.append(f"scene {i}: three `statement` scenes in a row — vary the types")
        if sc.get("motif") and sc["motif"] not in MOTIFS:
            errs.append(f"scene {i}: motif {sc['motif']!r} is not one of {MOTIFS}")
        if t in ("hook", "statement", "endcard"):
            key = "lines" if t == "endcard" else "headline"
            lines = sc.get(key) or sc.get("headline") or sc.get("lines") or []
            if len(lines) != 2:
                errs.append(f"scene {i} ({t}): needs exactly 2 headline lines, got {len(lines)}")
            for ln in lines:
                if len(ln) > HEADLINE_MAX:
                    errs.append(f"scene {i}: headline {ln!r} is {len(ln)} chars, max {HEADLINE_MAX}")
        if t == "list":
            items = sc.get("items") or []
            if not 2 <= len(items) <= 3:
                errs.append(f"scene {i} (list): needs 2-3 items, got {len(items)}")
            for it in items:
                if len(it) > HEADLINE_MAX:
                    errs.append(f"scene {i}: item {it!r} is {len(it)} chars, max {HEADLINE_MAX}")
        if t == "card" and not _plain(sc.get("body", "")).strip():
            errs.append(f"scene {i} (card): body is empty")
        if t == "compare":
            cols = sc.get("columns") or []
            if len(cols) != 2:
                errs.append(f"scene {i} (compare): needs exactly 2 columns, got {len(cols)}")
            for c in cols:
                if len(c.get("value", "")) > 8:
                    errs.append(f"scene {i}: column value {c.get('value')!r} is over 8 chars")
        if t == "metric" and not sc.get("label"):
            errs.append(f"scene {i} (metric): label is missing")

    if d.get("title") and len(d["title"]) > 100:
        errs.append(f"title is {len(d['title'])} chars, YouTube allows 100")
    return errs


def _ask(prompt: str, key: str) -> dict:
    last = ""
    for m in MODELS:
        r = requests.post(URL.format(m=m), params={"key": key}, timeout=180, json={
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"responseMimeType": "application/json",
                                 "responseSchema": SCHEMA, "temperature": 0.9}})
        if r.status_code == 200:
            return json.loads(r.json()["candidates"][0]["content"]["parts"][0]["text"])
        last = f"{m}: HTTP {r.status_code} {r.text[:200]}"
    raise RuntimeError(f"no Gemini model answered — {last}")


def draft(topic: dict, attempts: int = 4) -> dict:
    key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not key:
        raise RuntimeError("GEMINI_API_KEY is not set")
    base = PROMPT.format(question=topic["question"], mechanism=topic["mechanism"],
                         beats=BEATS, wmin=WORDS_MIN, wmax=WORDS_MAX,
                         types=SCENE_TYPES, motifs=MOTIFS, hmax=HEADLINE_MAX)
    prompt, problems = base, []
    for n in range(1, attempts + 1):
        d = _ask(prompt, key)
        problems = validate(d)
        if not problems:
            print(f"    draft accepted on attempt {n}")
            return d
        print(f"    attempt {n} rejected: {len(problems)} problem(s)")
        for p in problems[:6]:
            print(f"      - {p}")
        prompt = (base + "\n\nYour previous answer was rejected for these reasons. "
                  "Fix every one of them and return the whole thing again:\n"
                  + "\n".join(f"- {p}" for p in problems))
    raise RuntimeError("could not get a valid draft in "
                       f"{attempts} attempts; last problems: {problems}")


def to_spec(topic: dict, d: dict, duration: float = 40.0) -> dict:
    scenes = []
    for sc in d["scenes"]:
        out = {k: v for k, v in sc.items() if v not in (None, "", [], {})}
        if out["type"] == "endcard" and "headline" in out:
            out["lines"] = out.pop("headline")
        out.pop("motif", None) if out["type"] in ("card", "compare") else None
        scenes.append(out)
    return {"slug": topic["id"], "title": d["title"].replace(" #Shorts", ""),
            "duration": duration, "mood": topic.get("mood", "curious"),
            "seed": abs(hash(topic["id"])) % 10_000_000,
            "script": d["script"], "scenes": scenes,
            "copy": {"title": d["title"], "hook": d["hook_line"],
                     "caption": d["caption"], "hashtags": d["hashtags"]}}


def main() -> int:
    import argparse
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    import topics_queue

    ap = argparse.ArgumentParser()
    ap.add_argument("--topic-id", default=None)
    ap.add_argument("--out", type=Path, default=None)
    ap.add_argument("--duration", type=float, default=40.0)
    a = ap.parse_args()

    topic = (next(t for t in topics_queue.all_topics() if t["id"] == a.topic_id)
             if a.topic_id else topics_queue.take(1)[0])
    print(f"  topic: {topic['id']} — {topic['question']}")
    spec = to_spec(topic, draft(topic), a.duration)
    out = a.out or Path(__file__).resolve().parents[1] / "specs" / f"{topic['id']}.yaml"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(yaml.safe_dump(spec, sort_keys=False, allow_unicode=True, width=200))
    print(f"  spec: {out}")
    print(out)
    return 0


if __name__ == "__main__":
    sys.exit(main())
