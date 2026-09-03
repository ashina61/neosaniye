"""What each narration engine's speaking rate actually is, learned from runs.

The word budget for a script depends on how fast the voice reading it talks,
and the two engines differ by more than half: the local voice measures 3.18
words a second and Gemini, from a production run, somewhere near 1.9. A single
hard-coded number cannot serve both, and guessing wrong in the fast direction
costs a whole run — the script comes out too long to fit the cut at all.

So the rate is not hard-coded. Each successful narration records what the
engine actually did, and the next script is budgeted from that. The seeds below
are only a starting point for an engine nothing has been measured for yet, and
they are deliberately on the slow side: budgeting slow and being served fast
leaves a little extra silence, while the reverse loses the video.
"""
from __future__ import annotations

import json
from pathlib import Path

STORE = Path(__file__).resolve().parents[1] / "rates.json"

SEED = {
    "piper": 3.18,     # measured: 397 words of real scripts in 125.05s
    "gemini": 1.90,    # derived from run 149, where 11.70s of overrun gave it away
    "kokoro": 3.00,    # measured: 117 words of real scripts in 39.02s (am_adam)
}
# A run whose measurement is wildly off — a take that failed to split, a script
# in the wrong language — should not poison the next one.
FLOOR, CEILING = 1.2, 5.0
# How much one run may move the stored figure. Slow enough that a single odd
# video cannot swing the budget, fast enough to converge in a handful of runs.
BLEND = 0.35


def _load() -> dict:
    try:
        return json.loads(STORE.read_text())
    except (OSError, ValueError):
        return {}


def words_per_second(engine: str) -> float:
    """The rate to budget with for `engine`."""
    return float(_load().get(engine) or SEED.get(engine) or min(SEED.values()))


def record(engine: str, words: int, seconds: float) -> float | None:
    """Fold one run's measurement into the stored rate. Returns the new value."""
    if not engine or seconds <= 0 or words <= 0:
        return None
    observed = words / seconds
    if not FLOOR <= observed <= CEILING:
        print(f"      {engine} measured {observed:.2f} words/s — outside "
              f"{FLOOR}-{CEILING}, not recording it")
        return None
    store = _load()
    before = float(store.get(engine) or SEED.get(engine) or observed)
    store[engine] = round(before + (observed - before) * BLEND, 3)
    try:
        STORE.write_text(json.dumps(store, indent=1, sort_keys=True) + "\n")
    except OSError as e:
        print(f"      could not record the rate ({e})")
        return None
    print(f"      {engine} spoke at {observed:.2f} words/s; "
          f"budget rate now {store[engine]}")
    return store[engine]
