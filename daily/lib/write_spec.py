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
import unicodedata
import zlib
from pathlib import Path

import requests
import yaml

sys.path.insert(0, str(Path(__file__).resolve().parent))
import motion                    # noqa: E402
import narrate                   # noqa: E402
import rates                     # noqa: E402
import textfit                   # noqa: E402
import tts                       # noqa: E402

MODELS = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-flash-latest"]
URL = "https://generativelanguage.googleapis.com/v1beta/models/{m}:generateContent"

# Everything below is derived from the target length rather than fixed at the
# 40 seconds this started as. The rates come from the videos already made: five
# 40-second cuts came in at 98-101 words and a 30-second one at 74, which is
# 2.5 words a second either way. The band around that is what keeps a cut from
# being mostly silence at one end or unreadably dense at the other; narrate.plan
# spreads any slack into the gaps, so a few words under is a worse video, not a
# broken one, and not worth spending a free-tier attempt on.
# How much of the time available for speech to actually fill. The rest becomes
# the pauses between beats; at 1.0 the narration would run wall to wall with
# only the minimum gap anywhere, which is breathless.
SPEECH_SHARE = 0.85
BEAT_SECONDS = 4.0             # a beat much longer than this stops feeling like a short


def budgets(duration: float, wps: float | None = None) -> dict:
    """Every count this prompt and validator need, for a cut of `duration`.

    The word budget is derived from the time actually available for speech —
    the cut, less the lead-in, the tail and the minimum gap between every pair
    of beats — rather than from the cut's length. Those are not the same number
    and treating them as one is how a 60-second script came out 13 seconds too
    long to fit in 60 seconds.

    `wps` is how fast the voice that will read it talks. It is not a constant:
    the local voice runs at 3.18 words a second and Gemini at about 1.9, so a
    script written for one is unusable by the other. See narration_rate().
    """
    wps = wps or rates.words_per_second("piper")
    beats = max(8, min(16, round(duration / BEAT_SECONDS)))
    speech = duration - narrate.HEAD - narrate.TAIL - narrate.MIN_GAP * (beats - 1)
    target_words = speech * SPEECH_SHARE * wps
    # never let the ceiling reach the point where the narration cannot physically
    # fit, whatever share of the gaps it eats
    ceiling = round(speech * wps) - 4
    return {
        "beats": beats,
        "wps": wps,
        "wmin": round(target_words * 0.88),
        "wmax": min(round(target_words * 1.12), ceiling),
        "drawn_min": max(2, round(beats * 0.25)),
        "drawn_max": max(3, round(beats * 0.40)),
        "motion_max": max(2, beats // 5),
        "statement_max": max(2, beats // 3),
        "stock_min": max(3, round(beats * 0.40)),
    }
HEADLINE_MAX = 16          # characters; headlines are nowrap in a condensed face
# Stock coverage is counted over the scenes that can carry footage. Raising the
# floor across all ten only bought generic b-roll: a library has a wing, not a
# cross-section of a window, so the beats that need a cross-section get a
# diagram and the rest carry real footage.
SCENE_TYPES = ["hook", "statement", "card", "metric", "list", "compare",
               "diagram", "motion", "endcard"]

# The dramatic spine, which does not change with length: a hook, the assumption
# it creates overturned, the parts named, then the mechanism, then what follows
# from it, where it breaks, why it matters, and a landing. Only the number of
# mechanism beats in the middle grows with the running time — stretching the
# same ten beats over a minute makes each one slow, which is the one thing a
# short cannot be.
_OPENING = [("hook", "the surprising fact, stated flat. No \"did you know\", no question", "hook"),
            ("reframe", "overturn the assumption the hook creates", "statement"),
            ("setup", "name the parts of the mechanism", "list")]
_RULE = ("the rule", "the one sentence that does the explaining", "card")
_TURN = ("the turn", "the case where it breaks, or the limit", "compare")
_PAYOFF = ("payoff", "land it, echoing the hook's language", "endcard")
# Dropped first when the cut is short. The six beats around them are the spine
# proper; these two are the ones an eight-beat cut can do without, and it has
# to — a spine that fills every beat leaves nothing in the middle to draw.
_OPTIONAL = [("consequence", "what follows from the rule", "metric"),
             ("why that matters", "", "statement")]
# what each middle beat wants, cycled so seven of them do not look alike
_MIDDLE = ["diagram", "motion", "diagram", "compare", "metric", "diagram",
           "motion", "card"]


def beat_plan(beats: int) -> str:
    # keep at least two mechanism beats in the middle, then spend what is left
    # on the optional closers
    extras = max(0, min(len(_OPTIONAL), beats - 8))
    rows = list(_OPENING)
    for i in range(beats - 6 - extras):
        rows.append((f"part {i + 1}", "one step of the mechanism, in order",
                     _MIDDLE[i % len(_MIDDLE)]))
    rows.append(_RULE)
    if extras >= 1:
        rows.append(_OPTIONAL[0])
    rows.append(_TURN)
    if extras >= 2:
        rows.append(_OPTIONAL[1])
    rows.append(_PAYOFF)
    w = max(len(n) for n, _d, _s in rows)
    return "\n".join(
        f"{i:2d} {name:<{w}}  {('- ' + desc) if desc else '':<52} scene: {scene}"
        for i, (name, desc, scene) in enumerate(rows, 1))
MOTIFS = ["wave", "rings", "beam", "split", "particles"]
SHAPES = ["layers", "route", "flow"]
MOTION_SHAPES = ["circuit", "wave", "rays", "orbit"]
PROMPT = """You are writing a {seconds:.0f}-second vertical science short. It must teach one
mechanism clearly enough that a viewer can repeat the explanation afterwards.

LANGUAGE. Write EVERYTHING in English: the narration, every headline and label
that appears on screen, the title, the caption and the hashtags. The topic and
the mechanism below may be written in another language — that is the language
the topic was asked in, not the language of the video. Translate them and work
in English. The narration is read by an English voice, so a script in any other
language comes out mispronounced and, because it is read far more slowly, too
long to fit the cut at all.

TOPIC: {question}
MECHANISM (the truth you must convey, do not contradict it): {mechanism}

Write exactly {beats} narration beats, {wmin}-{wmax} words in total.

Beat shape, with the scene each beat wants. Follow it unless the topic gives
you a better reason, and if you depart from it keep the same variety:
{plan}

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

DRAWN BEATS. Between {dmin} and {dmax} of the {beats} beats must draw the
mechanism rather than caption footage, and they must be the beats that carry the
mechanism itself (beats 3-8). A drawing is the one thing a stock library cannot
supply: it has a photograph of an aeroplane, never a cross-section of its
window. Give a drawn scene NO stock and NO motif - it is the artwork. Every one
still needs a two-line `headline`.

There are two kinds, and the difference is whether the explanation moves. The
shape names do NOT overlap: circuit, wave, rays and orbit are ALWAYS
"type":"motion", and layers, route and flow are ALWAYS "type":"diagram". Never
put one kind's shape on the other kind's type.

`motion` scenes are animated. Use one when the mechanism IS a movement -
something travelling, cycling, spreading or splitting. Prefer motion over a
static diagram whenever the topic has a moving part; at most {mmax} per video.

  "circuit" - something flowing from A to B, and a way it does not go. Current,
      heat, air, water, a signal. The blocked branch is the point.
      {{"type":"motion","shape":"circuit","headline":["...","..."],
        "from":"PYLON","to":"PYLON","perch":"BIRD",
        "flow_label":"current runs along","branch":{{"label":"no path to ground"}}}}
      `from`/`to`/`perch` uppercase, {mnode} characters. `flow_label` and the
      branch label lowercase, {mflow} and {mbranch} characters. `branch` is
      REQUIRED - the way the thing does NOT go is what this shape explains, and
      without it the frame is a line with dots on it. If nothing is blocked in
      your mechanism, use a different shape. `perch` is optional: drop it when
      nothing sits on the path.

  "wave" - one or two travelling waves. Light, sound, pitch, colour. Give two
      when the comparison between them is the explanation.
      {{"type":"motion","shape":"wave","headline":["...","..."],"waves":[
        {{"label":"BLUE LIGHT","wavelength":1.0,"amplitude":0.9}},
        {{"label":"RED LIGHT","wavelength":2.9,"amplitude":0.9}}],
        "note":"short waves scatter more"}}
      `wavelength` 0.7-4.0 (small means a short, tight wave), `amplitude`
      0.35-1.05. Labels uppercase, {mlabel} characters; `note` lowercase.

  "rays" - a beam meeting a boundary and leaving it changed. Scattering,
      refraction, filtering, absorption.
      {{"type":"motion","shape":"rays","headline":["...","..."],
        "medium":"ATMOSPHERE","incoming":"SUNLIGHT","outgoing":[
        {{"label":"BLUE"}},{{"label":"GREEN"}},{{"label":"RED"}}]}}
      1-3 outgoing rays. All labels uppercase, {mlabel} characters.

  "orbit" - one body going round another. Tides, phases, seasons, cycles.
      {{"type":"motion","shape":"orbit","headline":["...","..."],
        "center":"EARTH","satellite":"MOON","marks":["HIGH TIDE","HIGH TIDE"],
        "note":"one bulge on each side"}}
      `marks` are 0-2 fixed points on either side, {mmark} characters each.

`diagram` scenes are still drawings, for a mechanism that is a structure rather
than a movement. Pick the shape that matches:

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

Every word inside a drawing must come from THIS topic. One labelled with
generic words teaches nothing and is worse than the footage it replaced.

Vary the scene types. A `statement` is a headline over footage and nothing
else, so use AT MOST {smax} of them in the whole video and never two in a row.
The other beats must earn a shape: a diagram where something is being taken
apart, a `compare` where two cases sit against each other, a `metric` where a
number is the point, a `list` where three things are being named, a `card` where
one sentence is the rule. Ten beats should not produce ten frames that look the
same.

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
    {{"type": "motion", "shape": "circuit", "headline": ["FIRST LINE", "SECOND LINE"],
      "from": "START", "to": "END", "flow_label": "what moves along it",
      "branch": {{"label": "where it does not go"}}}},
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


def repair(d: dict, topic: dict, stock_min: int = 4) -> list[str]:
    """Fix what is mechanically fixable, before anything is rejected over it.

    Four attempts against a free-tier key is not much headroom, and it was being
    spent on faults that have one obvious correct answer. A validator should
    reject what it cannot fix; everything here it can. Returns what it changed,
    for the log.
    """
    fixed: list[str] = []
    scenes = d.get("scenes") or []

    # A drawn beat put on the wrong renderer. The model chose a real shape and
    # attached it to the other scene type — the shape is the intent, so the
    # type follows it rather than the draft dying over the mismatch.
    # the fields each shape needs, so a swap only happens when the scene really
    # carries that shape's data — a bare shape name is a broken scene, not a
    # misfiled one, and rewriting its type would hide that
    FIELDS = {"layers": ("layers",), "route": ("routes", "from", "to"), "flow": ("nodes",),
              "circuit": ("from", "to", "perch", "flow_label", "branch"),
              "wave": ("waves",), "rays": ("outgoing", "incoming", "medium"),
              "orbit": ("center", "satellite", "marks")}
    for i, sc in enumerate(scenes, 1):
        t, shape = sc.get("type"), sc.get("shape")
        want = "motion" if (t == "diagram" and shape in MOTION_SHAPES) else \
               "diagram" if (t == "motion" and shape in SHAPES) else None
        if want and any(sc.get(f) for f in FIELDS.get(shape, ())):
            sc["type"] = want
            fixed.append(f"scene {i}: shape {shape!r} belongs to a {want} scene — moved it")

    # Under-tagged footage. `stock` is only a search query, and gather() already
    # falls back to the topic-level one when a beat's own search comes up empty,
    # so filling the gap here costs nothing a missing tag would not have cost.
    fallback = (d.get("stock_fallback") or topic.get("question", "")).strip()
    if fallback:
        can = [sc for sc in scenes if sc.get("type") not in ("diagram", "motion", "endcard")]
        have = sum(1 for sc in can if (sc.get("stock") or "").strip())
        for sc in can:
            if have >= stock_min:
                break
            if not (sc.get("stock") or "").strip():
                sc["stock"] = fallback
                have += 1
                fixed.append(f"scene {scenes.index(sc) + 1}: no stock query — "
                             f"used the topic fallback {fallback!r}")
    return fixed


def _plain(s: str) -> str:
    return re.sub(r"<[^>]+>", "", s or "")


def validate(d: dict, b: dict | None = None) -> list[str]:
    """Every house rule, checked. Returns the problems, empty when clean.

    `b` is the budget table for this video's length; it defaults to the
    40-second one so a caller that does not care about length need not pass it.
    """
    b = b or budgets(40.0)
    BEATS = b["beats"]
    errs: list[str] = []
    script = d.get("script") or []
    scenes = d.get("scenes") or []
    if len(script) != BEATS:
        errs.append(f"script has {len(script)} beats, needs exactly {BEATS}")
    if len(scenes) != BEATS:
        errs.append(f"scenes has {len(scenes)} entries, needs exactly {BEATS}")
    words = sum(len(b.split()) for b in script)
    if words < b["wmin"]:
        errs.append(f"script is {words} words, needs at least {b['wmin']} — add about "
                    f"{b['wmin'] - words + 4} more, spread across the beats that "
                    f"carry the mechanism, not the hook")
    elif words > b["wmax"]:
        errs.append(f"script is {words} words, needs at most {b['wmax']} — cut about "
                    f"{words - b['wmax'] + 4}")

    runs = 0
    for i, sc in enumerate(scenes, 1):
        t = sc.get("type")
        if t not in SCENE_TYPES:
            errs.append(f"scene {i}: type {t!r} is not one of {SCENE_TYPES}")
            continue
        runs = runs + 1 if t == "statement" else 0
        if runs > 1:
            errs.append(f"scene {i}: two `statement` scenes in a row — vary the types")
        if sc.get("motif") and sc["motif"] not in MOTIFS:
            errs.append(f"scene {i}: motif {sc['motif']!r} is not one of {MOTIFS}")
        if t in ("hook", "statement", "endcard", "card", "compare", "metric"):
            key = "lines" if t == "endcard" else "headline"
            lines = sc.get(key) or sc.get("headline") or sc.get("lines") or []
            if len(lines) != 2:
                errs.append(f"scene {i} ({t}): needs exactly 2 headline lines, got {len(lines)}")
            kind = "endcard" if t == "endcard" else "kh"
            for ln in lines:
                # compose sets an over-wide line smaller rather than letting it
                # run off frame, so the only real failure is a line so long it
                # would have to shrink out of being a display headline
                if textfit.fit_size(ln, kind) is None:
                    errs.append(f"scene {i}: headline {textfit.check(ln, kind)}")
        if t == "list":
            items = sc.get("items") or []
            if not 2 <= len(items) <= 3:
                errs.append(f"scene {i} (list): needs 2-3 items, got {len(items)}")
            for it in items:
                if textfit.fit_size(it, "slam") is None:
                    errs.append(f"scene {i}: item {textfit.check(it, 'slam')}")
        if t == "card" and not _plain(sc.get("body", "")).strip():
            errs.append(f"scene {i} (card): body is empty")
        if t == "compare":
            cols = sc.get("columns") or []
            if len(cols) != 2:
                errs.append(f"scene {i} (compare): needs exactly 2 columns, got {len(cols)}")
            for c in cols:
                if textfit.fit_size(c.get("value", ""), "col_big") is None:
                    errs.append(f"scene {i}: column value "
                                f"{textfit.check(c.get('value', ''), 'col_big')}")
        if t == "metric" and not sc.get("label"):
            errs.append(f"scene {i} (metric): label is missing")
        if t == "diagram":
            errs += _diagram(i, sc)
        if t == "motion":
            errs += _motion(i, sc)

    # a drawn beat IS the artwork, so it is not counted against footage coverage
    DRAWN = ("diagram", "motion")
    footage_scenes = [sc for sc in scenes if sc.get("type") not in DRAWN]
    with_stock = sum(1 for sc in footage_scenes if (sc.get("stock") or "").strip())
    if footage_scenes and with_stock < b["stock_min"]:
        errs.append(f"only {with_stock} of the {len(footage_scenes)} non-diagram "
                    f"scenes carry a stock query, need at least {b['stock_min']} — "
                    f"this is a footage-led format")

    statements = sum(1 for sc in scenes if sc.get("type") == "statement")
    if statements > b["statement_max"]:
        errs.append(f"{statements} `statement` scenes, at most {b['statement_max']} — "
                    f"a statement is a headline over footage, and a video made "
                    f"mostly of them is ten frames with one layout")

    drawn = len(scenes) - len(footage_scenes)
    if scenes and not b["drawn_min"] <= drawn <= b["drawn_max"]:
        errs.append(f"{drawn} drawn scenes (diagram + motion), need "
                    f"{b['drawn_min']}-{b['drawn_max']} — the mechanism beats "
                    f"have to draw the mechanism")
    motions = sum(1 for sc in scenes if sc.get("type") == "motion")
    if motions > b["motion_max"]:
        errs.append(f"{motions} `motion` scenes, at most {b['motion_max']} — each "
                    f"one is a separate render and they slow the whole video down")

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


def _cap(errs: list[str], where: str, text, kind: str) -> None:
    """Motion labels are capped by character count, not measured width.

    The text goes through Pango at a Manim scale factor, and deriving a pixel
    width through that chain would be a guess dressed up as a measurement. The
    renderer truncates anything longer; rejecting it here means it never has to.
    """
    n = len(str(text or "").strip())
    limit = motion.CAPS[kind]
    if n > limit:
        errs.append(f"{where}: {str(text)[:40]!r} is {n} characters, "
                    f"at most {limit} — it would be truncated on screen")


def _motion(i: int, sc: dict) -> list[str]:
    errs: list[str] = []
    shape = sc.get("shape")
    if shape not in MOTION_SHAPES:
        return [f"scene {i} (motion): shape {shape!r} is not one of {MOTION_SHAPES}"]

    if shape == "circuit":
        for key in ("from", "to", "perch"):
            if sc.get(key):
                _cap(errs, f"scene {i} circuit `{key}`", sc[key], "node")
        if sc.get("flow_label"):
            _cap(errs, f"scene {i} circuit flow_label", sc["flow_label"], "flow")
        br = sc.get("branch") or {}
        if not (br.get("label") or "").strip():
            errs.append(f"scene {i} (circuit): needs a `branch` with a label "
                        f"saying where the flow does NOT go — that contrast is "
                        f"the whole shape, and without it the frame is a line "
                        f"with dots on it. Use another shape if nothing is blocked")
        if br.get("label"):
            _cap(errs, f"scene {i} circuit branch", br["label"], "branch")

    elif shape == "wave":
        waves = sc.get("waves") or []
        if not 1 <= len(waves) <= 2:
            errs.append(f"scene {i} (wave): needs 1-2 waves, got {len(waves)}")
        for j, w in enumerate(waves, 1):
            _cap(errs, f"scene {i} wave {j} label", w.get("label"), "label")
            for key, lo, hi in (("wavelength", 0.7, 4.0), ("amplitude", 0.35, 1.05)):
                if key in w:
                    try:
                        v = float(w[key])
                    except (TypeError, ValueError):
                        errs.append(f"scene {i} wave {j}: {key} {w[key]!r} is not a number")
                        continue
                    if not lo <= v <= hi:
                        errs.append(f"scene {i} wave {j}: {key} {v} is outside "
                                    f"{lo}-{hi} and would be clamped")
        if len(waves) == 2 and all("wavelength" in w for w in waves):
            try:
                a, b = (float(w["wavelength"]) for w in waves)
                if abs(a - b) < 0.5:
                    errs.append(f"scene {i} (wave): the two wavelengths are {a} and "
                                f"{b} — too close to tell apart, which is the "
                                f"whole point of drawing two")
            except (TypeError, ValueError):
                pass
        if sc.get("note"):
            _cap(errs, f"scene {i} wave note", sc["note"], "note")

    elif shape == "rays":
        outs = sc.get("outgoing") or []
        if not 1 <= len(outs) <= 3:
            errs.append(f"scene {i} (rays): needs 1-3 outgoing rays, got {len(outs)}")
        for key in ("medium", "incoming"):
            if sc.get(key):
                _cap(errs, f"scene {i} rays `{key}`", sc[key], "label")
        for j, o in enumerate(outs, 1):
            _cap(errs, f"scene {i} rays outgoing {j}", o.get("label"), "label")

    elif shape == "orbit":
        for key in ("center", "satellite"):
            if not (sc.get(key) or "").strip():
                errs.append(f"scene {i} (orbit): `{key}` is missing")
            _cap(errs, f"scene {i} orbit `{key}`", sc.get(key), "node")
        marks = sc.get("marks") or []
        if len(marks) > 2:
            errs.append(f"scene {i} (orbit): {len(marks)} marks, at most 2")
        for j, m in enumerate(marks, 1):
            _cap(errs, f"scene {i} orbit mark {j}", m, "mark")
        if sc.get("note"):
            _cap(errs, f"scene {i} orbit note", sc["note"], "note")

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


def _ask_text(prompt: str, key: str) -> str:
    """One short plain-text answer. Same models and fallbacks as _ask."""
    problems = []
    for m in MODELS:
        cfg = {"temperature": 0.3, "maxOutputTokens": 2048}
        if m.startswith("gemini-2.5"):
            cfg["thinkingConfig"] = {"thinkingBudget": 0}
        try:
            r = requests.post(URL.format(m=m), params={"key": key}, timeout=120, json={
                "contents": [{"parts": [{"text": prompt}]}], "generationConfig": cfg})
        except requests.RequestException as e:
            problems.append(f"{m}: {type(e).__name__}")
            continue
        if r.status_code != 200:
            problems.append(f"{m}: HTTP {r.status_code} {r.text[:160]}")
            continue
        parts = ((r.json().get("candidates") or [{}])[0].get("content") or {}).get("parts") or []
        text = (parts[0].get("text") if parts else "") or ""
        if text.strip():
            return text.strip()
        problems.append(f"{m}: empty answer")
    raise DraftFailed("no Gemini model answered — " + " | ".join(problems))


def draft(topic: dict, attempts: int = 4, duration: float = 40.0,
          wps: float | None = None) -> dict:
    key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not key:
        raise RuntimeError("GEMINI_API_KEY is not set")
    b = budgets(duration, wps)
    base = PROMPT.format(question=topic["question"], mechanism=topic["mechanism"],
                         seconds=duration, plan=beat_plan(b["beats"]),
                         beats=b["beats"], wmin=b["wmin"], wmax=b["wmax"],
                         types=SCENE_TYPES, motifs=MOTIFS, hmax=HEADLINE_MAX,
                         dmin=b["drawn_min"], dmax=b["drawn_max"],
                         smax=b["statement_max"], mmax=b["motion_max"],
                         # the caps the model is told are the caps the
                         # validator measures, so the two cannot drift apart
                         mnode=motion.CAPS["node"], mflow=motion.CAPS["flow"],
                         mbranch=motion.CAPS["branch"], mlabel=motion.CAPS["label"],
                         mmark=motion.CAPS["mark"],
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
            for note in repair(d, topic, b["stock_min"]):
                print(f"    repaired: {note}")
        except DraftFailed as e:
            problems = [str(e)]
            print(f"    attempt {n} failed: {e}")
            prompt = base          # a malformed reply teaches nothing; start clean
            continue
        problems = validate(d, b)
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
        if out["type"] in ("card", "compare", "metric", "diagram", "motion"):
            out.pop("motif", None)      # these draw their own panel; compose drops it anyway
        if out["type"] in ("diagram", "motion"):
            out.pop("stock", None)      # the drawing IS the art; build.py drops it anyway
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


MECHANISM_PROMPT = """In one sentence of at most 25 words, state the actual physical
or biological mechanism that answers this question. No preamble, no hedging, no
restating the question — just the mechanism, as a claim you would defend.

Answer in ENGLISH even when the question is asked in another language: this
sentence becomes the anchor for an English script.

QUESTION: {question}

Return only that sentence."""


# Turkish is the language topics arrive in even though the video is in English.
# NFKD decomposes most of it (ö, ü, ç, ş, ğ) but not the dotless ı, which is a
# letter in its own right rather than an i with something removed.
_FOLD = str.maketrans("ıİĞğŞşÇçÖöÜü", "iIGgSsCcOoUu")


def narration_rate() -> tuple[str, float]:
    """The engine that will most likely read this, and how fast it talks.

    Deliberately no probe call: a probe is another TTS request against the same
    free quota, and it could be the one that tips a run into a 429. So the
    engine is inferred from configuration, and the inference errs slow. If a
    Gemini key is present the script is budgeted for Gemini even though the run
    may end up falling back — budgeting slow and being served fast only leaves
    a little more silence, while the reverse loses the run.
    """
    engine = "piper" if tts.configured_engine() == "piper" or not (
        os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    ) else "gemini"
    return engine, rates.words_per_second(engine)


def slugify(question: str) -> str:
    flat = unicodedata.normalize("NFKD", question.translate(_FOLD))
    flat = "".join(c for c in flat if not unicodedata.combining(c))
    words = re.findall(r"[a-z0-9]+", flat.lower())
    drop = {"why", "what", "how", "does", "do", "is", "are", "the", "a", "an",
            "you", "your", "it", "when", "can", "cant", "and", "of", "to", "in"}
    keep = [w for w in words if w not in drop][:4] or words[:4]
    return "-".join(keep) or "topic"


def ad_hoc_topic(question: str, mechanism: str | None = None) -> dict:
    """A topic row for a question that is not in topics.yaml.

    The `mechanism` field is what keeps the script from drifting into vibes —
    the prompt hands it to the model as the truth it must not contradict — so
    when the caller has not supplied one it is asked for on its own first, and
    printed, because it decides what every one of the beats will claim.
    """
    question = question.strip().rstrip("?") + "?"
    if not mechanism:
        key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
        if not key:
            raise RuntimeError("GEMINI_API_KEY is not set")
        got = _ask_text(MECHANISM_PROMPT.format(question=question), key)
        mechanism = " ".join(got.split())
    print(f"  mechanism: {mechanism}")
    return {"id": slugify(question), "question": question,
            "mechanism": mechanism, "mood": "curious"}


def main() -> int:
    import argparse
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    import topics_queue

    ap = argparse.ArgumentParser()
    ap.add_argument("--topic-id", default=None,
                    help="an id from topics.yaml; omit to take the next in the queue")
    ap.add_argument("--topic", default=None,
                    help="any question, in place of a topics.yaml row")
    ap.add_argument("--mechanism", default=None,
                    help="the truth the script must not contradict; asked for if omitted")
    ap.add_argument("--out", type=Path, default=None)
    ap.add_argument("--duration", type=float, default=40.0)
    a = ap.parse_args()

    if a.topic:
        # a free-text question may still name a row: prefer the hand-written
        # mechanism over one the model invents on the spot
        known = {t["id"]: t for t in topics_queue.all_topics()}
        topic = known.get(a.topic) or known.get(slugify(a.topic)) \
            or ad_hoc_topic(a.topic, a.mechanism)
    elif a.topic_id:
        topic = next(t for t in topics_queue.all_topics() if t["id"] == a.topic_id)
    else:
        topic = topics_queue.take(1)[0]
    print(f"  topic: {topic['id']} — {topic['question']}")
    engine, wps = narration_rate()
    print(f"  narration: {engine} at {wps} words/s — budgeting the script for it")
    spec = to_spec(topic, draft(topic, duration=a.duration, wps=wps), a.duration)
    out = a.out or Path(__file__).resolve().parents[1] / "specs" / f"{topic['id']}.yaml"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(yaml.safe_dump(spec, sort_keys=False, allow_unicode=True, width=200))
    print(f"  spec: {out}")
    print(out)
    return 0


if __name__ == "__main__":
    sys.exit(main())
