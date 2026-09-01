"""Turn a list of script lines into a timed, mastered voiceover track.

Piper decides how long each line takes; this module measures that and then
distributes the leftover time across the inter-line gaps so the track lands
exactly on the target duration. Scene timing downstream reads timing.json,
so the picture is always cut to the real speech, never to an estimate.
"""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import tts                       # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
HEAD, TAIL = 0.35, 0.60          # lead-in silence, and air after the last word
MIN_GAP = 0.15                   # never butt two lines together


def _run(cmd: list[str], stdin: str | None = None) -> None:
    r = subprocess.run(cmd, input=stdin, capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(f"{cmd[0]} failed: {r.stderr[-400:]}")


def duration(path: Path) -> float:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "csv=p=0", str(path)], capture_output=True, text=True).stdout.strip()
    return float(out)


def synthesize(lines: list[str], out_dir: Path, voice: str | None = None) -> list[float]:
    """Render one wav per line; return their durations.

    The engine is whichever is configured — Gemini when a key is present, piper
    otherwise. Rates differ between them, which is exactly why nothing
    downstream assumes a words-per-second constant.
    """
    out_dir.mkdir(parents=True, exist_ok=True)
    durs = []
    for i, line in enumerate(lines, 1):
        wav = out_dir / f"{i:02d}.wav"
        tts.say(line, wav, voice)
        durs.append(duration(wav))
    return durs


def plan(lines: list[str], durs: list[float], target: float,
         weights: list[float] | None = None) -> dict:
    """Place each line on the timeline so the track ends exactly at `target`.

    `weights` biases where the breathing room goes — a bigger number means a
    longer pause after that line (use it to land a beat before a turn).
    """
    n = len(lines)
    speech = sum(durs)
    gaps = n - 1
    slack = target - speech - HEAD - TAIL - MIN_GAP * gaps
    if slack < 0:
        over = -slack
        rate = speech / max(sum(len(l.split()) for l in lines), 1)   # seconds per word, measured
        raise ValueError(
            f"script is {over:.2f}s too long for a {target:.0f}s cut — "
            f"cut roughly {max(1, int(over / max(rate, 0.01)))} words")
    w = weights or [1.0] * gaps
    if len(w) != gaps:
        raise ValueError(f"need {gaps} weights, got {len(w)}")
    total_w = sum(w) or 1.0
    beats, t = [], HEAD
    for i, (line, d) in enumerate(zip(lines, durs)):
        beats.append({"i": i + 1, "start": round(t, 3), "end": round(t + d, 3),
                      "dur": round(d, 3), "text": line})
        t += d
        if i < gaps:
            t += MIN_GAP + slack * (w[i] / total_w)
    return {"target": target, "speech": round(speech, 3), "beats": beats}


def assemble(beats: list[dict], line_dir: Path, target: float, out: Path) -> None:
    """Mix the placed lines into one mastered mono track of exactly `target`."""
    ins, filt, mix = [], [], []
    for b in beats:
        ins += ["-i", str(line_dir / f"{b['i']:02d}.wav")]
        ms = int(b["start"] * 1000)
        filt.append(f"[{b['i']-1}:a]adelay={ms}|{ms},apad[d{b['i']}]")
        mix.append(f"[d{b['i']}]")
    chain = ";".join(filt) + ";" + "".join(mix) + f"amix=inputs={len(beats)}:normalize=0[m];"
    chain += ("[m]aresample=48000,highpass=f=85,"
              "equalizer=f=240:t=q:w=1.1:g=-2,"      # tame the boxy low-mid
              "equalizer=f=3200:t=q:w=1.4:g=2.2,"    # lift consonants for phone speakers
              "acompressor=threshold=0.09:ratio=3:attack=8:release=180:makeup=1.6,"
              "loudnorm=I=-16:TP=-1.5:LRA=11,"
              f"atrim=0:{target},asetpts=N/SR/TB[out]")
    out.parent.mkdir(parents=True, exist_ok=True)
    _run(["ffmpeg", "-y", *ins, "-filter_complex", chain, "-map", "[out]",
          "-ar", "48000", "-ac", "1", "-c:a", "pcm_s16le", str(out)])


def build(lines: list[str], target: float, work: Path,
          weights: list[float] | None = None, voice: str | None = None) -> dict:
    durs = synthesize(lines, work / "lines", voice)
    timing = plan(lines, durs, target, weights)
    timing["engine"] = tts.engine()
    assemble(timing["beats"], work / "lines", target, work / "vo.wav")
    (work / "timing.json").write_text(json.dumps(timing, indent=1))
    return timing
