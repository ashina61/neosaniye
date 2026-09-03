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
import gates        # noqa: E402
import motion       # noqa: E402
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
            {"type": "list", "motif": "split", "items": [_widest("slam")] * 3},
            {"type": "card", "eyebrow": "AN UNUSUALLY LONG EYEBROW LABEL",
             "body": "A VERY LONG <em>CARD BODY</em> PHRASE", "legend": LONG,
             "headline": [H16, H16]},
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
            # every optional field filled, each at its cap, so the harness
            # exercises the dense case rather than the sparse one
            {"type": "motion", "shape": "circuit", "headline": [H16, H16],
             "from": "M" * motion.CAPS["node"], "to": "M" * motion.CAPS["node"],
             "perch": "M" * motion.CAPS["node"],
             "flow_label": "m" * motion.CAPS["flow"],
             "branch": {"label": "m" * motion.CAPS["branch"]}},
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
    sp, tm = spec(), timing()

    # A motion scene's artwork is a real video element, so the harness renders
    # one: checking the layout around a clip that is not there would prove
    # nothing about the layout around a clip that is.
    import stock as stock_mod
    mo = {}
    for i, sc in enumerate(sp["scenes"]):
        if sc.get("type") != "motion":
            continue
        raw = proj / "motion" / f"{i:02d}-raw.mp4"
        if motion.render(sc, raw, proj / "motion" / f"w{i}"):
            stock_mod.normalise(raw, proj / "motion" / f"{i:02d}.mp4",
                                tm["beats"][i]["dur"] + 1.4)
            raw.unlink(missing_ok=True)
            mo[i] = {"rel": f"motion/{i:02d}.mp4"}
    compose.build(sp, tm, proj / "index.html", motion=mo)
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
        ok, verdict = gates.verdict(out)
        print(f"  {gate}: {verdict}")
        if not ok:
            failed = True
            for line in out.splitlines():
                if line.strip().startswith("✗"):
                    print(f"      {line.strip()}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
