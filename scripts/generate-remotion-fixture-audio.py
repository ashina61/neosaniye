#!/usr/bin/env python3
from __future__ import annotations

import math
import random
import shutil
import struct
import subprocess
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'remotion' / 'public' / 'runs' / 'fixture'
OUT.mkdir(parents=True, exist_ok=True)
SR = 22050
random.seed(61)

NARRATION = (
    'In eighteen twenty, Gregor MacGregor sold Britain a country called Poyais. '
    'He printed maps, bonds, land deeds and official seals. '
    'Two hundred and fifty settlers crossed the Atlantic expecting a tropical capital. '
    'They found jungle, disease and empty coastline. '
    'The country was fake. The journey was real.'
)


def clamp(value: float, low: float = -1.0, high: float = 1.0) -> float:
    return max(low, min(high, value))


def write_wav(path: Path, duration: float, fn) -> None:
    frames = int(duration * SR)
    with wave.open(str(path), 'wb') as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(SR)
        buffer = bytearray()
        for i in range(frames):
            t = i / SR
            sample = int(clamp(fn(t, duration)) * 32767)
            buffer.extend(struct.pack('<h', sample))
            if len(buffer) >= 65536:
                wav.writeframesraw(buffer)
                buffer.clear()
        if buffer:
            wav.writeframesraw(buffer)


def noise(seed: int):
    rng = random.Random(seed)
    values = [rng.uniform(-1, 1) for _ in range(8193)]

    def sample(t: float, speed: float = 1.0) -> float:
        pos = (t * speed) % 8192
        idx = int(pos)
        frac = pos - idx
        frac = frac * frac * (3 - 2 * frac)
        return values[idx] + (values[idx + 1] - values[idx]) * frac

    return sample


def generate_music() -> None:
    n = noise(2026)

    def fn(t: float, duration: float) -> float:
        fade = min(1.0, t / 1.8, max(0.0, duration - t) / 2.0)
        bass = 0.22 * math.sin(2 * math.pi * 55 * t)
        drone = 0.12 * math.sin(2 * math.pi * 82.5 * t + math.sin(t * 0.2))
        pulse_phase = t % 2.0
        pulse = math.sin(2 * math.pi * 42 * t) * math.exp(-pulse_phase * 4.2) * 0.25
        air = n(t, 0.7) * 0.025
        return fade * (bass + drone + pulse + air) * 0.52

    write_wav(OUT / 'music.wav', 24.0, fn)


def generate_sfx() -> None:
    n1 = noise(11)
    n2 = noise(12)
    write_wav(OUT / 'whoosh.wav', 1.5, lambda t, d: n1(t, 120) * math.sin(math.pi * t / d) ** 1.7 * 0.65)
    write_wav(OUT / 'whoosh-long.wav', 2.3, lambda t, d: (n1(t, 75) + 0.25 * math.sin(2 * math.pi * (90 + 250 * t) * t)) * math.sin(math.pi * t / d) ** 1.5 * 0.48)
    write_wav(OUT / 'shutter.wav', 0.75, lambda t, d: n2(t, 560) * math.exp(-30 * t) * 0.75 + math.sin(2 * math.pi * 120 * t) * math.exp(-22 * t) * 0.35)
    write_wav(OUT / 'focus.wav', 1.6, lambda t, d: math.sin(2 * math.pi * (180 + 720 * t / d) * t) * math.sin(math.pi * t / d) ** 2 * 0.3 + n1(t, 40) * 0.08)
    write_wav(OUT / 'paper.wav', 1.8, lambda t, d: (n1(t, 210) * 0.3 + n2(t, 47) * 0.18) * math.sin(math.pi * t / d) ** 0.6)
    write_wav(OUT / 'stamp.wav', 0.9, lambda t, d: math.sin(2 * math.pi * 64 * t) * math.exp(-8 * t) * 0.85 + n1(t, 250) * math.exp(-18 * t) * 0.45)
    write_wav(OUT / 'impact.wav', 1.4, lambda t, d: math.sin(2 * math.pi * (72 - 24 * t) * t) * math.exp(-4 * t) * 0.9 + n2(t, 80) * math.exp(-12 * t) * 0.35)
    write_wav(OUT / 'cash.wav', 1.8, lambda t, d: (math.sin(2 * math.pi * 1450 * t) + 0.5 * math.sin(2 * math.pi * 2050 * t)) * math.exp(-3.8 * t) * 0.28 + n1(t, 180) * math.exp(-4 * t) * 0.1)

    def heartbeat(t: float, duration: float) -> float:
        phase = t % 1.05
        first = math.sin(2 * math.pi * 55 * phase) * math.exp(-24 * phase) if phase < 0.25 else 0
        second_phase = phase - 0.18
        second = math.sin(2 * math.pi * 48 * second_phase) * math.exp(-28 * second_phase) if 0 <= second_phase < 0.2 else 0
        return first * 0.65 + second * 0.4

    write_wav(OUT / 'heartbeat.wav', 3.0, heartbeat)
    write_wav(OUT / 'boom.wav', 1.8, lambda t, d: math.sin(2 * math.pi * (48 - 9 * t) * t) * math.exp(-1.9 * t) * 0.92 + math.sin(2 * math.pi * 24 * t) * math.exp(-2.6 * t) * 0.38)
    # Money-room rig'inin altında duran elektrik uğultusu.
    write_wav(OUT / 'neon-buzz.wav', 2.4, lambda t, d: (math.sin(2 * math.pi * 120 * t) * 0.18 + math.sin(2 * math.pi * 240 * t) * 0.07 + n2(t, 400) * 0.05) * (0.35 if t < 0.35 and math.sin(2 * math.pi * 31 * t) < 0 else 1.0))


def fallback_voice() -> None:
    words = NARRATION.split()
    word_length = 22.5 / max(1, len(words))

    def fn(t: float, duration: float) -> float:
        phase = t % word_length
        envelope = math.sin(math.pi * min(1.0, phase / max(0.001, word_length))) ** 2
        carrier = math.sin(2 * math.pi * (125 + 18 * math.sin(t * 0.7)) * t)
        return carrier * envelope * 0.08

    write_wav(OUT / 'voice.wav', 23.0, fn)


def generate_voice() -> None:
    edge = shutil.which('edge-tts')
    if not edge:
        fallback_voice()
        return
    command = [
        edge,
        '--voice', 'en-US-AndrewNeural',
        '--rate=+18%',
        '--pitch=-2Hz',
        '--text', NARRATION,
        '--write-media', str(OUT / 'voice.mp3'),
    ]
    try:
        subprocess.run(command, check=True, timeout=90)
    except Exception as exc:
        print(f'edge-tts failed, using deterministic fallback: {exc}')
        fallback_voice()


def main() -> None:
    generate_music()
    generate_sfx()
    generate_voice()
    print(f'Fixture audio generated: {OUT}')


if __name__ == '__main__':
    main()
