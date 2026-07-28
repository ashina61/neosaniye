#!/usr/bin/env python3
from __future__ import annotations

import datetime as dt
import hashlib
import json
import math
import os
import random
import re
import shutil
import struct
import subprocess
import sys
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TOPICS_PATH = ROOT / "data" / "topics.json"
PUBLISHED_PATH = ROOT / "data" / "published.json"
AUDIO = ROOT / "public" / "audio"
GENERATED = ROOT / "src" / "generated"
OUT = ROOT / "out"
FPS = 30
VOICE_OFFSET_FRAMES = 12
SAMPLE_RATE = 22050

AUDIO.mkdir(parents=True, exist_ok=True)
GENERATED.mkdir(parents=True, exist_ok=True)
OUT.mkdir(parents=True, exist_ok=True)

SLOT_MAP = {
    "2 13 * * *": ("slot-1", 0),
    "2 18 * * *": ("slot-2", 1),
    "2 23 * * *": ("slot-3", 2),
    "slot-1": ("slot-1", 0),
    "slot-2": ("slot-2", 1),
    "slot-3": ("slot-3", 2),
}


def clamp(value: float, lo: float = -1.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, value))


def write_wav(path: Path, duration: float, fn) -> None:
    frames = int(duration * SAMPLE_RATE)
    with wave.open(str(path), "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(SAMPLE_RATE)
        chunk = bytearray()
        for index in range(frames):
            t = index / SAMPLE_RATE
            sample = int(clamp(fn(t, duration)) * 32767)
            chunk.extend(struct.pack("<h", sample))
            if len(chunk) >= 65536:
                wav.writeframesraw(chunk)
                chunk.clear()
        if chunk:
            wav.writeframesraw(chunk)


def smooth_noise(seed: int):
    rng = random.Random(seed)
    values = [rng.uniform(-1, 1) for _ in range(16385)]

    def sample(t: float, speed: float) -> float:
        position = (t * speed) % 16384
        index = int(position)
        fraction = position - index
        smooth = fraction * fraction * (3 - 2 * fraction)
        return values[index] + (values[index + 1] - values[index]) * smooth

    return sample


def resolve_slot() -> tuple[str, int]:
    raw = (
        os.getenv("SCHEDULE_SLOT")
        or os.getenv("GITHUB_EVENT_SCHEDULE")
        or os.getenv("INPUT_SLOT")
        or "slot-1"
    ).strip()
    if raw == "auto":
        raw = "slot-1"
    return SLOT_MAP.get(raw, ("slot-1", 0))


def load_json(path: Path, fallback):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return fallback


def select_topic(topics: list[dict], slot_name: str, slot_index: int) -> dict:
    forced = os.getenv("FORCE_TOPIC", "").strip()
    if forced:
        for topic in topics:
            if topic["slug"] == forced:
                return topic
        raise RuntimeError(f"FORCE_TOPIC not found: {forced}")

    history = load_json(PUBLISHED_PATH, [])
    recent_slugs = [item.get("slug") for item in history[-min(len(topics) - 1, 15):]]
    date_key = os.getenv("CONTENT_DATE") or dt.datetime.now(dt.timezone.utc).date().isoformat()
    digest = hashlib.sha256(f"{date_key}:{slot_name}:{slot_index}".encode()).digest()
    start = int.from_bytes(digest[:4], "big") % len(topics)

    for offset in range(len(topics)):
        candidate = topics[(start + offset) % len(topics)]
        if candidate["slug"] not in recent_slugs:
            return candidate

    return topics[start]


def generate_music(topic: dict) -> None:
    seed = int(hashlib.sha256(topic["slug"].encode()).hexdigest()[:8], 16)
    n1 = smooth_noise(seed)
    n2 = smooth_noise(seed ^ 0xA5A5A5)
    roots = [49.0, 55.0, 61.74, 65.41]

    def music(t: float, duration: float) -> float:
        fade_in = min(1.0, t / 1.1)
        fade_out = min(1.0, max(0.0, (duration - t) / 2.4))
        section = min(3, int(t // 12))
        root = roots[(section + seed) % len(roots)]
        bass = 0.13 * math.sin(2 * math.pi * root * t)
        bass += 0.045 * math.sin(2 * math.pi * root * 2 * t)
        pulse_phase = t % (0.68 + 0.08 * (section % 2))
        pulse = math.sin(2 * math.pi * 42 * t) * math.exp(-pulse_phase * 7.2) * 0.16
        notes = [220.0, 261.63, 329.63, 392.0]
        note = notes[(int(t * 2.2) + section) % len(notes)]
        note_phase = (t * 2.2) % 1
        shimmer = math.sin(2 * math.pi * note * t) * math.exp(-note_phase * 5.2) * 0.023
        air = n1(t, 1.0) * 0.017 + n2(t, 32) * 0.006
        return (bass + pulse + shimmer + air) * fade_in * fade_out * 0.84

    write_wav(AUDIO / "music.wav", 60.0, music)


def generate_sfx(topic: dict) -> None:
    seed = int(hashlib.sha256((topic["slug"] + ":sfx").encode()).hexdigest()[:8], 16)
    n1 = smooth_noise(seed)
    n2 = smooth_noise(seed ^ 0x13579B)
    n3 = smooth_noise(seed ^ 0x2468AC)

    write_wav(AUDIO / "impact.wav", 1.4, lambda t, d: math.sin(2 * math.pi * (82 - 38 * t) * t) * math.exp(-5.2 * t) * 0.92 + n1(t, 180) * math.exp(-18 * t) * 0.28)
    write_wav(AUDIO / "whoosh-a.wav", 1.1, lambda t, d: n1(t, 170) * (math.sin(math.pi * t / d) ** 2.1) * 0.58 + math.sin(2 * math.pi * (130 + 650 * (t / d) ** 2) * t) * (math.sin(math.pi * t / d) ** 2) * 0.1)
    write_wav(AUDIO / "whoosh-b.wav", 0.75, lambda t, d: n2(t, 260) * (math.sin(math.pi * t / d) ** 2.5) * 0.68)
    write_wav(AUDIO / "reverse.wav", 1.5, lambda t, d: n1(t, 120) * ((t / d) ** 1.6) * 0.42 + math.sin(2 * math.pi * (900 - 650 * t / d) * t) * ((t / d) ** 1.8) * 0.12)
    write_wav(AUDIO / "tick.wav", 1.2, lambda t, d: (math.sin(2 * math.pi * 1450 * t) + 0.5 * math.sin(2 * math.pi * 2150 * t)) * math.exp(-28 * (t % 0.24)) * 0.2)
    write_wav(AUDIO / "chime.wav", 2.2, lambda t, d: (math.sin(2 * math.pi * 660 * t) + 0.62 * math.sin(2 * math.pi * 990 * t) + 0.35 * math.sin(2 * math.pi * 1320 * t)) * math.exp(-2.3 * t) * 0.24)
    write_wav(AUDIO / "rumble.wav", 8.0, lambda t, d: math.sin(2 * math.pi * 38 * t) * 0.12 + math.sin(2 * math.pi * 24 * t) * 0.07 + n2(t, 14) * 0.025)
    write_wav(AUDIO / "swipe.wav", 0.52, lambda t, d: n3(t, 330) * (math.sin(math.pi * t / d) ** 2.8) * 0.7)
    write_wav(AUDIO / "glitch.wav", 0.46, lambda t, d: (n1(t, 900) * 0.34 + math.sin(2 * math.pi * (320 + 1200 * t) * t) * 0.16) * (1 if int(t * 38) % 3 else 0.15))
    write_wav(AUDIO / "riser.wav", 1.65, lambda t, d: n2(t, 95) * ((t / d) ** 1.7) * 0.34 + math.sin(2 * math.pi * (110 + 720 * (t / d) ** 2) * t) * ((t / d) ** 2) * 0.14)
    write_wav(AUDIO / "snap.wav", 0.35, lambda t, d: n3(t, 1200) * math.exp(-34 * t) * 0.64 + math.sin(2 * math.pi * 180 * t) * math.exp(-24 * t) * 0.28)
    write_wav(AUDIO / "sub-hit.wav", 1.8, lambda t, d: math.sin(2 * math.pi * (54 - 12 * t) * t) * math.exp(-2.8 * t) * 0.86 + n1(t, 45) * math.exp(-5 * t) * 0.09)


def generate_voice(topic: dict) -> str:
    edge = shutil.which("edge-tts")
    if edge is None:
        raise RuntimeError("edge-tts was not found.")

    narration = "\n\n".join(topic["narration"])
    text_path = AUDIO / "narration.txt"
    text_path.write_text(narration, encoding="utf-8")

    last_error = None
    for voice in ["en-US-AndrewNeural", "en-US-BrianNeural", "en-US-GuyNeural"]:
        command = [
            edge,
            "--voice", voice,
            "--rate=+18%",
            "--pitch=-2Hz",
            "--file", str(text_path),
            "--write-media", str(AUDIO / "voice.mp3"),
            "--write-subtitles", str(AUDIO / "voice.srt"),
        ]
        try:
            subprocess.run(command, check=True)
            return voice
        except subprocess.CalledProcessError as exc:
            last_error = exc

    raise RuntimeError(f"English voice generation failed: {last_error}")


def timestamp_to_seconds(value: str) -> float:
    hours, minutes, rest = value.replace(",", ".").split(":")
    return int(hours) * 3600 + int(minutes) * 60 + float(rest)


def parse_srt(path: Path) -> list[dict]:
    blocks = re.split(r"\n\s*\n", path.read_text(encoding="utf-8-sig").strip())
    cues = []
    for block in blocks:
        lines = [line.strip() for line in block.splitlines() if line.strip()]
        if len(lines) < 3 or "-->" not in lines[1]:
            continue
        start_raw, end_raw = [part.strip() for part in lines[1].split("-->")]
        start = round(timestamp_to_seconds(start_raw) * FPS) + VOICE_OFFSET_FRAMES
        end = round(timestamp_to_seconds(end_raw) * FPS) + VOICE_OFFSET_FRAMES
        cues.append({"start": start, "end": max(end, start + 1), "text": " ".join(lines[2:])})
    if not cues:
        raise RuntimeError("SRT timing could not be parsed.")
    return cues


def cue_start(cues: list[dict], sentence: str, fallback_ratio: float) -> int:
    fragment = " ".join(sentence.split()[:4]).casefold()
    for cue in cues:
        if fragment in cue["text"].casefold():
            return int(cue["start"])
    return round(int(cues[-1]["end"]) * fallback_ratio)


def build_generated_files(topic: dict, slot_name: str, voice: str) -> dict:
    cues = parse_srt(AUDIO / "voice.srt")
    ratios = [0.0, 0.14, 0.29, 0.44, 0.59, 0.74, 0.87]
    starts = [0]
    for index, sentence in enumerate(topic["narration"][1:], start=1):
        starts.append(cue_start(cues, sentence, ratios[index]))
    starts = [max(0, value) for value in starts]
    for index in range(1, len(starts)):
        starts[index] = max(starts[index], starts[index - 1] + 18)

    total_frames = int(cues[-1]["end"]) + 24
    topic_ts = "import type {TopicSpec} from \'../types\';\n\nexport const TOPIC: TopicSpec = " + json.dumps(topic, ensure_ascii=False, indent=2) + ";\n"
    timing_ts = (
        "export type CaptionCue = {start: number; end: number; text: string};\n\n"
        f"export const CUES: CaptionCue[] = {json.dumps(cues, ensure_ascii=False, indent=2)};\n\n"
        f"export const SCENE_STARTS = {json.dumps(starts)} as const;\n"
        f"export const TOTAL_FRAMES = {total_frames};\n"
    )
    (GENERATED / "topic.ts").write_text(topic_ts, encoding="utf-8")
    (GENERATED / "timing.ts").write_text(timing_ts, encoding="utf-8")

    title = f"{topic['title']} #Shorts"
    if len(title) > 100:
        title = title[:97].rstrip() + "..."
    hashtags = ["#Shorts", "#Science", "#Facts"]
    description = (
        f"{topic['hook']}\n\n"
        f"Source: {topic['source']}\n\n"
        + " ".join(hashtags)
    )
    manifest = {
        "slug": topic["slug"],
        "title": title,
        "description": description,
        "tags": list(dict.fromkeys(topic["tags"] + ["shorts", "science facts", "NeoSaniye"]))[:15],
        "slot": slot_name,
        "contentDate": os.getenv("CONTENT_DATE") or dt.datetime.now(dt.timezone.utc).date().isoformat(),
        "voice": voice,
        "totalFrames": total_frames,
        "durationSeconds": round(total_frames / FPS, 3),
        "source": topic["source"],
        "privacyStatus": os.getenv("YOUTUBE_PRIVACY", "public"),
    }
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    return manifest


def main() -> int:
    topics = load_json(TOPICS_PATH, [])
    if not topics:
        raise RuntimeError("Topic pool is empty.")

    slot_name, slot_index = resolve_slot()
    topic = select_topic(topics, slot_name, slot_index)
    generate_music(topic)
    generate_sfx(topic)
    voice = generate_voice(topic)
    manifest = build_generated_files(topic, slot_name, voice)
    print(json.dumps({"selected": topic["slug"], "slot": slot_name, "duration": manifest["durationSeconds"]}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
