"""Gate every scene type at once, with every field at its longest legal value.

Layout failures here have a habit of surfacing one production run at a time,
because each Gemini-written spec exercises a different combination. This builds
the worst case deliberately — all seven scene archetypes, every optional field
filled, headlines at the character cap in the widest glyph — so a change to the
template can be checked in one pass instead of over a week of runs.

    python daily/lib/stress_layout.py          # builds, lints and inspects
"""
from __future__ import annotations

import json
import shutil
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import compose      # noqa: E402
import textfit      # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
def _widest(kind: str) -> str:
    """The widest line the validator would still accept, in the widest glyph.

    Hard-coding a character count here would test the wrong thing: the real
    limit is rendered width, so ask for it rather than guess.
    """
    s = ""
    while textfit.overflow(s + "M", kind) <= 0:
        s += "M"
    return s


H16 = _widest("kh")           # widest legal headline
LONG = "a considerably longer descriptive line than any topic should need"


def spec() -> dict:
    return {
        "slug": "stress", "title": "Stress", "duration": 40.0,
        "mood": "curious", "seed": 1,
        "script": [f"Stress beat number {i} with a reasonable amount of words in it."
                   for i in range(1, 11)],
        "scenes": [
            {"type": "hook", "motif": "rings", "headline": [H16, H16],
             "badge": {"label": "A VERY LONG BADGE LABEL", "count_to": 1234567, "unit": "MW"}},
            {"type": "statement", "motif": "wave", "accent": "red", "headline": [H16, H16]},
            {"type": "list", "motif": "split", "items": [_widest("slam")] * 3},
            {"type": "card", "eyebrow": "AN UNUSUALLY LONG EYEBROW LABEL",
             "body": "A VERY LONG <em>CARD BODY</em> PHRASE", "legend": LONG,
             "tagline": H16, "headline": [H16, H16]},
            {"type": "metric", "label": "AN EXTREMELY LONG METRIC LABEL HERE",
             "count_to": 9876543, "unit": "units", "headline": [H16, H16]},
            {"type": "compare", "headline": [H16, H16], "columns": [
                {"chip": "a rather long chip", "value": _widest("col_big"), "label": LONG},
                {"chip": "another long chip", "value": _widest("col_big"), "label": LONG, "risk": True}]},
            {"type": "diagram", "shape": "layers", "headline": [H16, H16], "layers": [
                {"label": _widest("dg_label"), "note": _widest("dg_note")},
                {"label": _widest("dg_hole"), "mark": "hole",
                 "mark_label": _widest("dg_note")},
                {"label": _widest("dg_label"), "note": _widest("dg_note")},
                {"label": _widest("dg_label")}]},
            {"type": "diagram", "shape": "route", "headline": [H16, H16],
             "from": _widest("dg_node"), "to": _widest("dg_node"), "routes": [
                {"label": _widest("dg_route"), "state": "open"},
                {"label": _widest("dg_route"), "state": "blocked"}]},
            {"type": "diagram", "shape": "flow", "headline": [H16, H16],
             "nodes": [_widest("dg_flow")] * 4},
            {"type": "endcard", "motif": "rings", "lines": [_widest("endcard")] * 2},
        ]}


def timing(duration: float = 40.0, beats: int = 10) -> dict:
    span = (duration - 1.0) / beats
    return {"target": duration, "beats": [
        {"start": round(0.35 + i * span, 2), "end": round(0.35 + i * span + span * 0.78, 2),
         "dur": round(span * 0.78, 2), "text": f"Stress beat {i + 1} caption text goes here."}
        for i in range(beats)]}


def main() -> int:
    proj = ROOT / "out" / "stress"
    shutil.rmtree(proj, ignore_errors=True)
    proj.mkdir(parents=True)
    compose.build(spec(), timing(), proj / "index.html")
    for name in ("assets", "node_modules"):
        (proj / name).symlink_to(ROOT / "daily" / name)
    shutil.copy(ROOT / "daily" / "hyperframes.json", proj / "hyperframes.json")

    env = dict(__import__("os").environ)
    envfile = ROOT / ".render-env"
    if envfile.exists():
        for line in envfile.read_text().splitlines():
            if line.startswith("export "):
                k, _, v = line[7:].partition("=")
                env[k] = v

    failed = False
    for gate in ("lint", "inspect"):
        r = subprocess.run(["npx", "--yes", "hyperframes", gate], cwd=proj,
                           capture_output=True, text=True, env=env, timeout=1800)
        out = r.stdout + r.stderr
        verdict = next((l for l in out.splitlines() if "error(s)" in l), "no verdict")
        print(f"  {gate}: {verdict.strip()}")
        if "0 error(s)" not in out:
            failed = True
            for line in out.splitlines():
                if line.strip().startswith("✗"):
                    print(f"      {line.strip()}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
