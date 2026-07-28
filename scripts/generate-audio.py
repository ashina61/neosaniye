#!/usr/bin/env python3
from __future__ import annotations

import json
import math
import random
import re
import shutil
import struct
import subprocess
import sys
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
AUDIO = ROOT / 'public' / 'audio'
GENERATED = ROOT / 'src' / 'generated'
TOPIC = ROOT / 'content' / 'topics' / 'first-traffic-light.json'
AUDIO.mkdir(parents=True, exist_ok=True)
GENERATED.mkdir(parents=True, exist_ok=True)

FPS = 30
VOICE_OFFSET_FRAMES = 12
SAMPLE_RATE = 22050
random.seed(61)

story = json.loads(TOPIC.read_text(encoding='utf-8'))
NARRATION = str(story['narration'])


def clamp(value: float, lo: float = -1.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, value))


def write_wav(path: Path, duration: float, fn) -> None:
    frames = int(duration * SAMPLE_RATE)
    with wave.open(str(path), 'wb') as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(SAMPLE_RATE)
        chunk = bytearray()
        for i in range(frames):
            t = i / SAMPLE_RATE
            sample = int(clamp(fn(t, duration)) * 32767)
            chunk.extend(struct.pack('<h', sample))
            if len(chunk) >= 65536:
                wav.writeframesraw(chunk)
                chunk.clear()
        if chunk:
            wav.writeframesraw(chunk)


def noise(seed: int):
    rng = random.Random(seed)
    values = [rng.uniform(-1, 1) for _ in range(16385)]
    def sample(t: float, speed: float) -> float:
        position = (t * speed) % 16384
        index = int(position)
        fraction = position - index
        smooth = fraction * fraction * (3 - 2 * fraction)
        return values[index] + (values[index + 1] - values[index]) * smooth
    return sample


def generate_music() -> None:
    n = noise(1868)
    def music(t: float, duration: float) -> float:
        fade_in = min(1.0, t / 1.0)
        fade_out = min(1.0, max(0.0, (duration - t) / 2.2))
        root = 55.0 if t < 12 else 61.74 if t < 24 else 49.0
        bass = math.sin(2 * math.pi * root * t) * 0.1
        pulse = math.sin(2 * math.pi * 45 * t) * math.exp(-(t % .74) * 7.8) * 0.13
        hiss = n(t, 1.2) * .015 + n(t, 42) * .005
        return (bass + pulse + hiss) * fade_in * fade_out
    write_wav(AUDIO / 'music.wav', 50.0, music)


def generate_sfx() -> None:
    n = noise(1868)
    write_wav(AUDIO / 'impact.wav', 1.6, lambda t, d: math.sin(2 * math.pi * (86 - 42 * t) * t) * math.exp(-4.6 * t) * .9 + n(t, 200) * math.exp(-15 * t) * .25)
    write_wav(AUDIO / 'snap.wav', .38, lambda t, d: n(t, 1200) * math.exp(-35 * t) * .62 + math.sin(2 * math.pi * 170 * t) * math.exp(-22 * t) * .26)
    write_wav(AUDIO / 'chime.wav', 2.0, lambda t, d: (math.sin(2 * math.pi * 610 * t) + .55 * math.sin(2 * math.pi * 915 * t)) * math.exp(-2.5 * t) * .22)


def generate_voice() -> None:
    edge = shutil.which('edge-tts')
    if edge is None:
        raise RuntimeError('edge-tts was not found.')
    text_path = AUDIO / 'narration.txt'
    text_path.write_text(NARRATION, encoding='utf-8')
    for voice in ['en-US-AndrewNeural', 'en-US-BrianNeural', 'en-US-GuyNeural']:
        command = [edge, '--voice', voice, '--rate=+16%', '--pitch=-2Hz', '--file', str(text_path), '--write-media', str(AUDIO / 'voice.mp3'), '--write-subtitles', str(AUDIO / 'voice.srt')]
        try:
            subprocess.run(command, check=True)
            return
        except subprocess.CalledProcessError:
            continue
    raise RuntimeError('English voice generation failed.')


def timestamp_to_seconds(value: str) -> float:
    hours, minutes, rest = value.replace(',', '.').split(':')
    return int(hours) * 3600 + int(minutes) * 60 + float(rest)


def parse_srt(path: Path) -> list[dict[str, object]]:
    blocks = re.split(r'\n\s*\n', path.read_text(encoding='utf-8-sig').strip())
    cues: list[dict[str, object]] = []
    for block in blocks:
        lines = [line.strip() for line in block.splitlines() if line.strip()]
        if len(lines) < 3 or '-->' not in lines[1]:
            continue
        start_raw, end_raw = [part.strip() for part in lines[1].split('-->')]
        start = round(timestamp_to_seconds(start_raw) * FPS) + VOICE_OFFSET_FRAMES
        end = round(timestamp_to_seconds(end_raw) * FPS) + VOICE_OFFSET_FRAMES
        cues.append({'start': start, 'end': max(end, start + 1), 'text': ' '.join(lines[2:])})
    if not cues:
        raise RuntimeError('SRT timing could not be parsed.')
    return cues


def cue_start(cues: list[dict[str, object]], fragment: str, fallback_ratio: float) -> int:
    for cue in cues:
        if fragment.casefold() in str(cue['text']).casefold():
            return int(cue['start'])
    return round(int(cues[-1]['end']) * fallback_ratio)


def generate_timing() -> None:
    cues = parse_srt(AUDIO / 'voice.srt')
    beats = story['beats']
    scenes = {}
    for index, beat in enumerate(beats):
        scenes[str(beat['id'])] = 0 if index == 0 else cue_start(cues, str(beat['trigger']), index / len(beats))
    total_frames = int(cues[-1]['end']) + 24
    output = f"""export type CaptionCue = {{start: number; end: number; text: string}};\n\nexport const CUES: CaptionCue[] = {json.dumps(cues, ensure_ascii=False, indent=2)};\n\nexport const SCENES = {json.dumps(scenes, ensure_ascii=False, indent=2)} as const;\n\nexport const TOTAL_FRAMES = {total_frames};\n"""
    (GENERATED / 'timing.ts').write_text(output, encoding='utf-8')


def main() -> int:
    generate_music()
    generate_sfx()
    generate_voice()
    generate_timing()
    return 0


if __name__ == '__main__':
    sys.exit(main())
