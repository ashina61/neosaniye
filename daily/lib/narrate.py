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
import kokoro_tts                # noqa: E402
import rates                     # noqa: E402
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


def synthesize(lines: list[str], out_dir: Path,
               voice: str | None = None) -> tuple[list[float], str]:
    """Render one wav per line. Returns (durations, engine).

    Three engines, in descending order of how good they sound and ascending
    order of how reliably they are there: Gemini, then Kokoro, then piper.

    Gemini is asked for the whole script in a single request and the take is cut
    locally, because quota is charged per request and ten short calls cost ten
    times one. Kokoro runs on the machine with no key and no quota, so it is
    what catches a Gemini that has run out. piper is the floor — always present,
    plainest voice.

    A video never mixes engines: if one fails partway the whole narration is
    redone in the next one down, because changing voice halfway through is
    worse than the plainer voice throughout.
    """
    out_dir.mkdir(parents=True, exist_ok=True)
    engine = ""
    if tts.configured_engine() not in ("piper", "kokoro") and tts._key():
        try:
            model = tts.say_script(lines, out_dir, voice)
            if model:
                print(f"      Gemini TTS via {model}, one request for the whole script")
                engine = "gemini"
        except tts.QuotaExhausted as e:
            print(f"      Gemini TTS unavailable: {str(e)[:200]}")
        except Exception as e:                    # noqa: BLE001 - never block on the voice
            print(f"      Gemini TTS failed ({type(e).__name__}: {str(e)[:160]})")

    if not engine and tts.configured_engine() != "piper" and kokoro_tts.available():
        try:
            for i, line in enumerate(lines, 1):
                kokoro_tts.say(line, out_dir / f"{i:02d}.wav", voice)
            print(f"      narration: kokoro ({kokoro_tts.VOICE})")
            engine = "kokoro"
        except Exception as e:                    # noqa: BLE001
            print(f"      kokoro failed ({type(e).__name__}: {str(e)[:160]})")

    if not engine:
        print("      narration: piper")
        for i, line in enumerate(lines, 1):
            tts.say(line, out_dir / f"{i:02d}.wav", voice, engine="piper")
        engine = "piper"

    durs = [duration(out_dir / f"{i:02d}.wav") for i in range(1, len(lines) + 1)]
    return durs, engine


class Overlong(ValueError):
    """The narration does not fit. `speed` is what it would have to be sped up by.

    A run that reaches this point has already spent a Gemini draft, a TTS take
    and a stock search, so losing it to a script a few percent long is a bad
    trade — build() speeds the take up instead when the factor is small enough
    to be inaudible.
    """

    def __init__(self, msg: str, speed: float = 1.0):
        super().__init__(msg)
        self.speed = speed


# Beyond this a sped-up narration starts to sound hurried rather than merely
# brisk. It is a rescue for a script that came out slightly long, not a licence
# to ignore the word budget.
MAX_SPEEDUP = 1.08


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
        raise Overlong(
            f"script is {over:.2f}s too long for a {target:.0f}s cut — "
            f"cut roughly {max(1, int(over / max(rate, 0.01)))} words",
            # aim a little past the line rather than exactly at it: atempo's
            # own rounding is enough to land a hair over and fail twice
            speed=speech / max((speech - over) * 0.98, 0.01))
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


def _speed_up(line_dir: Path, n: int, factor: float) -> list[float]:
    """Re-time every line by `factor`, in place. Returns the new durations."""
    out = []
    for i in range(1, n + 1):
        src, dst = line_dir / f"{i:02d}.wav", line_dir / f"{i:02d}-fast.wav"
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(src),
                        "-filter:a", f"atempo={factor:.4f}", str(dst)], check=True)
        dst.replace(src)
        out.append(duration(src))
    return out


def build(lines: list[str], target: float, work: Path,
          weights: list[float] | None = None, voice: str | None = None) -> dict:
    durs, engine = synthesize(lines, work / "lines", voice)
    try:
        timing = plan(lines, durs, target, weights)
    except Overlong as e:
        if e.speed > MAX_SPEEDUP:
            raise
        print(f"      narration is long; speeding it {e.speed:.3f}x to fit")
        durs = _speed_up(work / "lines", len(lines), e.speed)
        timing = plan(lines, durs, target, weights)
    timing["engine"] = engine
    # What this engine really did, so the next script is budgeted from a
    # measurement rather than from a guess about the voice that will read it.
    rates.record(engine, sum(len(l.split()) for l in lines), sum(durs))
    assemble(timing["beats"], work / "lines", target, work / "vo.wav")
    (work / "timing.json").write_text(json.dumps(timing, indent=1))
    return timing
