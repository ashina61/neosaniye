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
# Stock coverage is counted over the scenes that can carry footage. Raising the
# floor across all ten only bought generic b-roll: a library has a wing, not a
# cross-section of a window, so the beats that need a cross-section get a
# diagram and the rest carry real footage.
MIN_STOCK = 5              # of the scenes that can take footage
MIN_DIAGRAM, MAX_DIAGRAM = 2, 3
SCENE_TYPES = ["hook", "statement", "card", "metric", "list", "compare",
               "diagram", "endcard"]
MOTIFS = ["wave", "rings", "beam", "split", "particles"]
SHAPES = ["layers", "route", "flow"]

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
  shape + its fields: for diagram. See below.

DIAGRAMS. Between {dmin} and {dmax} of the {beats} beats must be `diagram`
scenes, and they must be the beats that carry the mechanism itself (beats 3-7).
A diagram draws the thing being explained, which is the one thing stock footage
cannot do: a library has a photograph of an aeroplane, never a cross-section of
its window. Give a diagram scene NO stock and NO motif - it is the artwork.
Every diagram still needs a two-line `headline`.

Pick the shape that matches the mechanism:

  "layers" - things stacked in order: panes of glass, layers of atmosphere,
      rock strata, skin and nerve. 2-4 entries, outermost first.
      {{"type":"diagram","shape":"layers","headline":["...","..."],"layers":[
        {{"label":"OUTER PANE","note":"takes the pressure"}},
        {{"label":"MIDDLE PANE","mark":"hole","mark_label":"bleed hole"}},
        {{"label":"INNER PANE","note":"you touch this one"}}]}}
      `label` uppercase, at most {dglab} characters ({dghole} on the marked one).
      `note` optional, lowercase, at most {dgnote} characters.
      Give `mark":"hole"` to at most ONE entry, when a gap or opening through
      that layer is the point.

  "route" - two ways from A to B, one of them blocked. Use it when the
      explanation is "the current/air/heat could go this way, but it doesn't".
      {{"type":"diagram","shape":"route","headline":["...","..."],
        "from":"CABIN","to":"OUTSIDE","routes":[
        {{"label":"through the gap","state":"open"}},
        {{"label":"through the pane","state":"blocked"}}]}}
      `from`/`to` uppercase, at most {dgnode} characters. Exactly 2 routes,
      exactly one "open" and one "blocked". Labels lowercase, at most
      {dgroute} characters.

  "flow" - an ordered chain of causes. Use it for "this leads to this leads
      to this". 3-4 nodes, in order.
      {{"type":"diagram","shape":"flow","headline":["...","..."],
        "nodes":["CABIN AIR","BLEED HOLE","MIDDLE PANE","OUTER PANE"]}}
      Nodes uppercase, at most {dgflow} characters each.

Every word inside a diagram must come from THIS topic. A diagram labelled with
generic words teaches nothing and is worse than the footage it replaced.

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
    {{"type": "diagram", "shape": "layers", "headline": ["FIRST LINE", "SECOND LINE"],
      "layers": [{{"label": "OUTER PART", "note": "what it does"}},
                 {{"label": "INNER PART", "mark": "hole", "mark_label": "the gap"}}]}},
    {{"type": "diagram", "shape": "flow", "headline": ["FIRST LINE", "SECOND LINE"],
      "nodes": ["FIRST CAUSE", "THEN THIS", "THEN THIS"]}},
    {{"type": "endcard", "motif": "rings", "headline": ["LAST LINE", "FINAL LINE"]}}
  ],
  "title": "...",
  "hook_line": "...",
  "caption": "...",
  "hashtags": ["science", "physics", "shorts", "explained", "didyouknow", "learn"],
  "stock_fallback": "birds power lines"
}}

Those objects are examples of each type, not the answer — your `scenes`
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
                "shape": {"type": "string"},
                "from": {"type": "string"}, "to": {"type": "string"},
                "nodes": {"type": "array", "items": {"type": "string"}},
                "layers": {"type": "array", "items": {
                    "type": "object",
                    "properties": {"label": {"type": "string"}, "note": {"type": "string"},
                                   "mark": {"type": "string"},
                                   "mark_label": {"type": "string"}}}},
                "routes": {"type": "array", "items": {
                    "type": "object",
                    "properties": {"label": {"type": "string"},
                                   "state": {"type": "string"}}}},
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
        if t == "diagram":
            errs += _diagram(i, sc)

    # a diagram IS the artwork, so it is not counted against footage coverage
    footage_scenes = [sc for sc in scenes if sc.get("type") != "diagram"]
    with_stock = sum(1 for sc in footage_scenes if (sc.get("stock") or "").strip())
    if footage_scenes and with_stock < MIN_STOCK:
        errs.append(f"only {with_stock} of the {len(footage_scenes)} non-diagram "
                    f"scenes carry a stock query, need at least {MIN_STOCK} — "
                    f"this is a footage-led format")

    diagrams = len(scenes) - len(footage_scenes)
    if scenes and not MIN_DIAGRAM <= diagrams <= MAX_DIAGRAM:
        errs.append(f"{diagrams} diagram scenes, need {MIN_DIAGRAM}-{MAX_DIAGRAM} — "
                    f"the mechanism beats have to draw the mechanism")

    if d.get("title") and len(d["title"]) > 100:
        errs.append(f"title is {len(d['title'])} chars, YouTube allows 100")
    return errs


def _fits(errs: list[str], where: str, text: str, kind: str) -> None:
    problem = textfit.check(text or "", kind)
    if problem:
        errs.append(f"{where}: {problem}")


def _diagram(i: int, sc: dict) -> list[str]:
    """A diagram is drawn from the model's own words, so the words have to fit.

    SVG text does not wrap: an over-long band label runs off the frame silently,
    exactly the way an over-long headline does, so it is measured the same way.
    """
    errs: list[str] = []
    shape = sc.get("shape")
    if shape not in SHAPES:
        return [f"scene {i} (diagram): shape {shape!r} is not one of {SHAPES}"]
    if shape == "layers":
        items = sc.get("layers") or []
        if not 2 <= len(items) <= 4:
            errs.append(f"scene {i} (layers): needs 2-4 layers, got {len(items)}")
        marks = 0
        for j, it in enumerate(items, 1):
            label = (it.get("label") or "").strip()
            if not label:
                errs.append(f"scene {i} layer {j}: label is empty")
            holed = (it.get("mark") or "").lower() == "hole"
            marks += holed
            _fits(errs, f"scene {i} layer {j} label", label,
                  "dg_hole" if holed else "dg_label")
            if it.get("note"):
                _fits(errs, f"scene {i} layer {j} note", it["note"], "dg_note")
            if it.get("mark") and not holed:
                errs.append(f"scene {i} layer {j}: mark {it['mark']!r} — only "
                            f"\"hole\" is drawn")
            if holed and it.get("mark_label"):
                _fits(errs, f"scene {i} layer {j} mark_label", it["mark_label"], "dg_note")
        if marks > 1:
            errs.append(f"scene {i} (layers): {marks} layers marked `hole`, at most one")

    elif shape == "route":
        for key in ("from", "to"):
            v = (sc.get(key) or "").strip()
            if not v:
                errs.append(f"scene {i} (route): `{key}` is missing")
            _fits(errs, f"scene {i} route `{key}`", v, "dg_node")
        routes = sc.get("routes") or []
        if len(routes) != 2:
            errs.append(f"scene {i} (route): needs exactly 2 routes, got {len(routes)}")
        states = [(r.get("state") or "").lower() for r in routes]
        if sorted(states) != ["blocked", "open"]:
            errs.append(f"scene {i} (route): states are {states}, need one "
                        f"\"open\" and one \"blocked\"")
        for j, r in enumerate(routes, 1):
            if not (r.get("label") or "").strip():
                errs.append(f"scene {i} route {j}: label is empty")
            _fits(errs, f"scene {i} route {j} label", r.get("label", ""), "dg_route")

    elif shape == "flow":
        nodes = [n for n in (sc.get("nodes") or []) if (n or "").strip()]
        if not 3 <= len(nodes) <= 4:
            errs.append(f"scene {i} (flow): needs 3-4 nodes, got {len(nodes)}")
        for j, n in enumerate(nodes, 1):
            _fits(errs, f"scene {i} flow node {j}", n, "dg_flow")

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
                         types=SCENE_TYPES, motifs=MOTIFS, hmax=HEADLINE_MAX,
                         dmin=MIN_DIAGRAM, dmax=MAX_DIAGRAM,
                         # the caps the model is told are the caps the
                         # validator measures, so the two cannot drift apart
                         dglab=textfit.budget("dg_label"),
                         dghole=textfit.budget("dg_hole"),
                         dgnote=textfit.budget("dg_note"),
                         dgnode=textfit.budget("dg_node"),
                         dgroute=textfit.budget("dg_route"),
                         dgflow=textfit.budget("dg_flow"))
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
        if out["type"] in ("card", "compare", "metric", "diagram"):
            out.pop("motif", None)      # these draw their own panel; compose drops it anyway
        if out["type"] == "diagram":
            out.pop("stock", None)      # the diagram IS the art; build.py drops it anyway
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
