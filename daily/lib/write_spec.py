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
import zlib
from pathlib import Path

import requests
import yaml

sys.path.insert(0, str(Path(__file__).resolve().parent))
import textfit                   # noqa: E402

MODELS = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-flash-latest"]
URL = "https://generativelanguage.googleapis.com/v1beta/models/{m}:generateContent"

BEATS = 10
WORDS_MIN, WORDS_MAX = 95, 115
HEADLINE_MAX = 16          # characters; headlines are nowrap in a condensed face
MIN_STOCK = 7              # of BEATS; graphics are the exception, not the rule
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
         ("power line closeup", "ocean waves aerial"). Give AT LEAST SEVEN of the
         {beats} beats a stock query - this is a footage-led format and graphics
         are the exception, not the rule. The panel types work over footage too:
         a card, a comparison or a metric reads well sitting on top of b-roll, so
         do not skip stock just because the beat is a panel. Omit it only where
         the beat is genuinely abstract and any footage would show the wrong
         thing; a graphics scene beats misleading footage.
  headline: for EVERY type except `list`, exactly two lines, EACH AT MOST {hmax}
         CHARACTERS INCLUDING SPACES. This is a hard limit: longer lines run off
         the screen. Uppercase. The panel types (card, compare, metric) need one
         too — without it the lower half of the frame is empty while every other
         scene fills it.
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
  stock_fallback: 2-3 plain words naming footage that suits the topic as a
         whole, used when a specific beat's search comes back empty

Return ONE JSON object and nothing else, in exactly this shape. `script` and
`scenes` must both hold exactly {beats} entries, index for index.

{{
  "script": ["beat one sentence.", "beat two sentence.", "... {beats} in total"],
  "scenes": [
    {{"type": "hook", "motif": "rings", "stock": "power line closeup",
      "headline": ["FIRST LINE", "SECOND LINE"]}},
    {{"type": "statement", "motif": "wave", "accent": "cyan",
      "headline": ["FIRST LINE", "SECOND LINE"]}},
    {{"type": "list", "motif": "split", "items": ["ONE THING", "OTHER THING"]}},
    {{"type": "card", "eyebrow": "THE MECHANISM",
      "body": "SHORT <em>PHRASE</em>", "legend": "one clarifying line",
      "headline": ["FIRST LINE", "SECOND LINE"]}},
    {{"type": "metric", "label": "WHAT IS MEASURED", "count_to": 92, "unit": "%",
      "headline": ["FIRST LINE", "SECOND LINE"]}},
    {{"type": "compare", "headline": ["FIRST LINE", "SECOND LINE"], "columns": [
      {{"chip": "case one", "value": "SHORT", "label": "what it means"}},
      {{"chip": "case two", "value": "LONG", "label": "what it means", "risk": true}}]}},
    {{"type": "endcard", "motif": "rings", "headline": ["LAST LINE", "FINAL LINE"]}}
  ],
  "title": "...",
  "hook_line": "...",
  "caption": "...",
  "hashtags": ["science", "physics", "shorts", "explained", "didyouknow", "learn"],
  "stock_fallback": "birds power lines"
}}

Those seven objects are examples of each type, not the answer — your `scenes`
array holds exactly {beats} entries following the beat shape above.
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
        if t in ("hook", "statement", "endcard", "card", "compare", "metric"):
            key = "lines" if t == "endcard" else "headline"
            lines = sc.get(key) or sc.get("headline") or sc.get("lines") or []
            if len(lines) != 2:
                errs.append(f"scene {i} ({t}): needs exactly 2 headline lines, got {len(lines)}")
            kind = "endcard" if t == "endcard" else "kh"
            for ln in lines:
                # measured, not counted: sixteen narrow characters fit and
                # sixteen wide ones run half a frame off the edge
                problem = textfit.check(ln, kind)
                if problem:
                    errs.append(f"scene {i}: headline {problem}")
        if t == "list":
            items = sc.get("items") or []
            if not 2 <= len(items) <= 3:
                errs.append(f"scene {i} (list): needs 2-3 items, got {len(items)}")
            for it in items:
                problem = textfit.check(it, "slam")
                if problem:
                    errs.append(f"scene {i}: item {problem}")
        if t == "card" and not _plain(sc.get("body", "")).strip():
            errs.append(f"scene {i} (card): body is empty")
        if t == "compare":
            cols = sc.get("columns") or []
            if len(cols) != 2:
                errs.append(f"scene {i} (compare): needs exactly 2 columns, got {len(cols)}")
            for c in cols:
                problem = textfit.check(c.get("value", ""), "col_big")
                if problem:
                    errs.append(f"scene {i}: column value {problem}")
        if t == "metric" and not sc.get("label"):
            errs.append(f"scene {i} (metric): label is missing")

    with_stock = sum(1 for sc in scenes if (sc.get("stock") or "").strip())
    if scenes and with_stock < MIN_STOCK:
        errs.append(f"only {with_stock} of {len(scenes)} scenes carry a stock query, "
                    f"need at least {MIN_STOCK} — this is a footage-led format")

    if d.get("title") and len(d["title"]) > 100:
        errs.append(f"title is {len(d['title'])} chars, YouTube allows 100")
    return errs


class DraftFailed(RuntimeError):
    """One attempt did not produce usable JSON. Retryable."""


def _generation_config(model: str) -> dict:
    cfg = {"responseMimeType": "application/json", "temperature": 0.9,
           # A ten-beat spec runs long. The default ceiling truncates it, and a
           # truncated candidate comes back with no content part at all.
           "maxOutputTokens": 16384}
    if model.startswith("gemini-2.5"):
        # 2.5 thinks by default and those tokens are charged against the output
        # budget, so a long structured answer can exhaust it before writing any.
        cfg["thinkingConfig"] = {"thinkingBudget": 0}
    return cfg


def _extract(payload: dict, model: str) -> dict:
    cands = payload.get("candidates") or []
    if not cands:
        fb = payload.get("promptFeedback", {})
        raise DraftFailed(f"{model}: no candidates (promptFeedback={fb})")
    cand = cands[0]
    reason = cand.get("finishReason", "?")
    parts = (cand.get("content") or {}).get("parts") or []
    if not parts:
        raise DraftFailed(f"{model}: candidate had no content (finishReason={reason})")
    text = parts[0].get("text", "")
    try:
        return json.loads(text)
    except json.JSONDecodeError as e:
        raise DraftFailed(f"{model}: response was not valid JSON "
                          f"(finishReason={reason}, {e}); starts {text[:120]!r}") from e


def _ask(prompt: str, key: str) -> dict:
    problems = []
    for m in MODELS:
        try:
            r = requests.post(URL.format(m=m), params={"key": key}, timeout=240, json={
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": _generation_config(m)})
        except requests.RequestException as e:
            problems.append(f"{m}: {type(e).__name__}")
            continue
        if r.status_code != 200:
            problems.append(f"{m}: HTTP {r.status_code} {r.text[:160]}")
            continue
        try:
            return _extract(r.json(), m)
        except DraftFailed as e:
            problems.append(str(e))
    raise DraftFailed("no Gemini model produced usable JSON — " + " | ".join(problems))


def draft(topic: dict, attempts: int = 4) -> dict:
    key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not key:
        raise RuntimeError("GEMINI_API_KEY is not set")
    base = PROMPT.format(question=topic["question"], mechanism=topic["mechanism"],
                         beats=BEATS, wmin=WORDS_MIN, wmax=WORDS_MAX,
                         types=SCENE_TYPES, motifs=MOTIFS, hmax=HEADLINE_MAX)
    prompt, problems = base, []
    for n in range(1, attempts + 1):
        try:
            d = _ask(prompt, key)
        except DraftFailed as e:
            problems = [str(e)]
            print(f"    attempt {n} failed: {e}")
            prompt = base          # a malformed reply teaches nothing; start clean
            continue
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
        if out["type"] in ("card", "compare", "metric"):
            out.pop("motif", None)      # these draw their own panel; compose drops it anyway
        scenes.append(out)
    return {"slug": topic["id"], "title": d["title"].replace(" #Shorts", ""),
            "stock_fallback": d.get("stock_fallback", topic["question"]),
            "duration": duration, "mood": topic.get("mood", "curious"),
            # str.hash is salted per process, so it would give a different seed
            # every run; crc32 keeps a topic's decorative layout reproducible.
            "seed": zlib.crc32(topic["id"].encode()) % 10_000_000,
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
