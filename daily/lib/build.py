"""spec (yaml) -> finished vertical MP4.

Runs the whole chain and refuses to hand back a file that failed a gate:
narration -> score -> composition -> lint/inspect -> render -> mix -> encode.
"""
from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path

import yaml

sys.path.insert(0, str(Path(__file__).resolve().parent))
import compose            # noqa: E402
import narrate            # noqa: E402
import score              # noqa: E402
import stock as stock_mod  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
PIPE = ROOT / "daily"


def sh(cmd: list[str], cwd: Path | None = None, timeout: int = 3600) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, timeout=timeout)


def render_env() -> dict:
    import os
    env = dict(os.environ)
    envfile = ROOT / ".render-env"
    if envfile.exists():
        for line in envfile.read_text().splitlines():
            if line.startswith("export "):
                k, _, v = line[7:].partition("=")
                env[k] = v
    return env


def gate(name: str, proc: subprocess.CompletedProcess) -> None:
    out = proc.stdout + proc.stderr
    if "0 error(s)" not in out:
        tail = "\n".join(l for l in out.splitlines() if l.strip().startswith(("✗", "◇")))
        raise RuntimeError(f"{name} gate failed:\n{tail or out[-1200:]}")
    print(f"  {name}: clean")


def build(spec_path: Path, work_root: Path | None = None) -> Path:
    spec = yaml.safe_load(spec_path.read_text())
    slug = spec["slug"]
    work = (work_root or ROOT / "out") / slug
    work.mkdir(parents=True, exist_ok=True)
    target = float(spec.get("duration", 40.0))

    print(f"[1/8] narration ({len(spec['script'])} beats -> {target:.0f}s)")
    timing = narrate.build(spec["script"], target, work,
                           spec.get("gap_weights"), spec.get("voice"))
    print(f"      engine: {timing.get('engine')}")
    beats = timing["beats"]
    for i, b in enumerate(beats):
        cap = spec.get("captions", {}).get(i + 1) if isinstance(spec.get("captions"), dict) else None
        if cap:
            b["caption"] = cap
    turn_beat = spec.get("turn_beat")
    turn = beats[turn_beat - 1]["start"] if turn_beat else None
    spec["turn_time"] = turn

    print("[2/8] score")
    score.compose(target, work / "music.wav", mood=spec.get("mood", "curious"),
                  turn=turn, changes=[b["start"] for b in beats])

    print("[3/8] stock footage")
    proj = work / "project"
    proj.mkdir(exist_ok=True)
    stock = stock_mod.gather(spec["scenes"], proj, timing,
                             spec.get("stock_fallback", "")) if any(
        sc.get("stock") for sc in spec["scenes"]) else {}
    for i, info in stock.items():
        info["rel"] = str(Path(info["clip"]).relative_to(proj))
    if not stock and any(sc.get("stock") for sc in spec["scenes"]):
        print("      none retrieved — the composition falls back to graphics")

    print("[4/8] composition")
    for name in ("assets", "node_modules"):
        link = proj / name
        if not link.exists():
            link.symlink_to(PIPE / name)
    shutil.copy(PIPE / "hyperframes.json", proj / "hyperframes.json")
    compose.build(spec, timing, proj / "index.html", stock)

    print("[5/8] gates")
    env = render_env()
    gate("lint", subprocess.run(["npx", "--yes", "hyperframes", "lint"],
                                cwd=proj, capture_output=True, text=True, env=env, timeout=900))
    gate("inspect", subprocess.run(["npx", "--yes", "hyperframes", "inspect"],
                                   cwd=proj, capture_output=True, text=True, env=env, timeout=1800))

    print("[6/8] render")
    silent = work / "silent.mp4"
    r = subprocess.run(["npx", "--yes", "hyperframes", "render", "--output", str(silent),
                        "--fps", "30", "--quality", "high"],
                       cwd=proj, capture_output=True, text=True, env=env, timeout=5400)
    if not silent.exists():
        raise RuntimeError(f"render produced no file:\n{(r.stdout + r.stderr)[-1500:]}")

    print("[7/8] mix")
    mix = work / "mix.wav"
    r = sh(["ffmpeg", "-y", "-i", str(work / "music.wav"), "-i", str(work / "vo.wav"),
            "-filter_complex",
            "[0:a]aformat=channel_layouts=stereo,volume=0.62[mus];"
            "[1:a]aformat=channel_layouts=stereo[vo];[vo]asplit=2[vo_mix][vo_key];"
            "[mus][vo_key]sidechaincompress=threshold=0.045:ratio=7:attack=12:release=340:makeup=1[duck];"
            "[duck][vo_mix]amix=inputs=2:normalize=0:weights=1 1[sum];"
            f"[sum]loudnorm=I=-14:TP=-1.0:LRA=10,alimiter=limit=0.95,atrim=0:{target},asetpts=N/SR/TB[out]",
            "-map", "[out]", "-ar", "48000", "-ac", "2", "-c:a", "pcm_s16le", str(mix)])
    if r.returncode:
        raise RuntimeError(f"mix failed: {r.stderr[-800:]}")

    print("[8/8] encode")
    final = work / f"{slug}_1080x1920.mp4"
    r = sh(["ffmpeg", "-y", "-i", str(silent), "-i", str(mix), "-map", "0:v:0", "-map", "1:a:0",
            "-c:v", "libx264", "-profile:v", "high", "-level", "4.1", "-pix_fmt", "yuv420p",
            "-crf", "19", "-preset", "slow",
            "-x264-params", "keyint=60:min-keyint=30:scenecut=40",
            "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2",
            "-movflags", "+faststart", "-shortest", str(final)])
    if r.returncode or not final.exists():
        raise RuntimeError(f"encode failed: {r.stderr[-800:]}")

    probe = json.loads(sh(["ffprobe", "-v", "error", "-print_format", "json",
                           "-show_format", "-show_streams", str(final)]).stdout)
    d = float(probe["format"]["duration"])
    if abs(d - target) > 0.15:
        raise RuntimeError(f"final duration {d:.2f}s != target {target:.2f}s")
    v = next(s for s in probe["streams"] if s["codec_type"] == "video")
    if (v["width"], v["height"]) != (1080, 1920):
        raise RuntimeError(f"wrong frame size {v['width']}x{v['height']}")
    if not any(s["codec_type"] == "audio" for s in probe["streams"]):
        raise RuntimeError("final file has no audio stream")

    (work / "timing.json").write_text(json.dumps(timing, indent=1))
    print(f"\nOK  {final}  ({final.stat().st_size/1e6:.1f} MB, {d:.2f}s)")
    return final


def main() -> int:
    ap = argparse.ArgumentParser(description="Build one video from a spec.")
    ap.add_argument("spec", type=Path)
    ap.add_argument("--out", type=Path, default=None)
    a = ap.parse_args()
    try:
        build(a.spec, a.out)
    except Exception as e:                       # noqa: BLE001 - surfaced to the caller
        print(f"\nFAILED: {e}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
