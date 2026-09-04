"""Build caption chunks from the script and the measured narration timeline.

Whisper would give word-level alignment, but its models come from HuggingFace and
that host is denied by this environment's network policy. We do not need it: the
narration was synthesised from text we wrote, so the words are known exactly and
only their positions inside each measured section have to be estimated. Piper's
delivery is very even, so distributing a section's duration across its words by
character count lands within about a tenth of a second — invisible at
caption-chunk granularity.

Usage: scripts/build_captions.py <slug> [--skip s7] [--max-chars 30]
"""
import argparse, json, re, sys
from pathlib import Path

ap = argparse.ArgumentParser()
ap.add_argument("slug")
ap.add_argument("--skip", default="", help="comma-separated section ids to leave uncaptioned")
ap.add_argument("--max-chars", type=int, default=30)
a = ap.parse_args()

PROJ = Path("/home/user/neosaniye/projects") / a.slug
A = PROJ / "artifacts"
script = json.loads((A / "script.json").read_text())
timing = json.loads((A / "narration_timing.json").read_text())
placed = {p["id"]: p for p in timing["placed"]}
skip = {s.strip() for s in a.skip.split(",") if s.strip()}

FPS = 30
chunks = []

for sec in script["sections"]:
    sid = sec["id"]
    if sid in skip or sid not in placed:
        continue
    p = placed[sid]
    words = sec["text"].split()
    # Piper's own sentence silences live inside the measured duration, so weight
    # by characters (a proxy for speaking time) rather than by word count.
    weights = [len(w) + 1 for w in words]
    total = sum(weights)
    t = p["start"]
    span = p["end"] - p["start"]
    timed = []
    for w, wt in zip(words, weights):
        dur = span * wt / total
        timed.append((w, t, t + dur))
        t += dur

    # Group into caption-sized chunks, breaking at punctuation first.
    cur: list = []
    for w, s, e in timed:
        cur.append((w, s, e))
        text = " ".join(x[0] for x in cur)
        ends_clause = bool(re.search(r"[.,;:!?]$", w))
        if len(text) >= a.max_chars or ends_clause:
            chunks.append({
                "section": sid,
                "text": text,
                "start": round(cur[0][1], 3),
                "end": round(cur[-1][2], 3),
            })
            cur = []
    if cur:
        chunks.append({
            "section": sid,
            "text": " ".join(x[0] for x in cur),
            "start": round(cur[0][1], 3),
            "end": round(cur[-1][2], 3),
        })

# A break that leaves an orphan ("it.", "Fine.") reads as a stutter. Fold any
# very short tail back into the chunk before it, within the same section.
merged: list = []
for c in chunks:
    short = (c["end"] - c["start"] < 0.75) or len(c["text"].split()) <= 2
    if merged and short and merged[-1]["section"] == c["section"] and \
            len(merged[-1]["text"]) + len(c["text"]) + 1 <= a.max_chars + 16:
        merged[-1]["text"] += " " + c["text"]
        merged[-1]["end"] = c["end"]
    else:
        merged.append(c)
chunks = merged

# Hold each chunk until the next one starts, so there is never a blank flicker
# between two chunks of the same sentence.
for i, c in enumerate(chunks):
    c["fromFrame"] = int(round(c["start"] * FPS))
    nxt = chunks[i + 1] if i + 1 < len(chunks) else None
    end = c["end"]
    if nxt and nxt["start"] - c["end"] < 0.45 and nxt["section"] == c["section"]:
        end = nxt["start"]
    c["toFrame"] = int(round(end * FPS))
    c["durationInFrames"] = max(6, c["toFrame"] - c["fromFrame"])

out = A / "captions.json"
out.write_text(json.dumps(chunks, indent=2) + "\n")
longest = max(chunks, key=lambda c: len(c["text"]))
print(f"{len(chunks)} caption chunks -> {out}")
print(f"longest: {len(longest['text'])} chars — {longest['text']!r}")
for c in chunks[:6]:
    print(f"  {c['start']:6.2f}-{c['end']:6.2f}  {c['text']}")
