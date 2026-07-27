#!/usr/bin/env python3
from __future__ import annotations

import math
import random
import shutil
import struct
import subprocess
import sys
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public' / 'audio' / 'eiffel'
OUT.mkdir(parents=True, exist_ok=True)
SFX_OUT = OUT / 'sfx'
SFX_OUT.mkdir(parents=True, exist_ok=True)
REFERENCE = OUT / 'reference'
SR = 22050
random.seed(61)

NARRATION = """In 1925, a con man sold the Eiffel Tower. Twice.

Victor Lustig read that Paris was struggling with the tower's maintenance costs. So he posed as a senior government official.

He mailed forged, confidential invitations to five scrap-metal dealers and summoned them to a luxury hotel.

The story? France was secretly demolishing the Eiffel Tower, and one of them could buy all seven thousand three hundred tons of iron.

Dealer André Poisson believed him. He paid for the tower, and even added a private bribe.

Lustig took the money and fled. Poisson was too embarrassed to call the police.

So Lustig came back to Paris and tried to sell the Eiffel Tower again.

The second buyer checked the story, and the scam collapsed. But Lustig had already earned his title: the man who sold the Eiffel Tower twice."""


def clamp(value: float, lo: float = -1.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, value))


def write_wav(path: Path, duration: float, fn, sample_rate: int = SR) -> None:
    frames = int(duration * sample_rate)
    with wave.open(str(path), 'wb') as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(sample_rate)
        chunk = bytearray()
        for i in range(frames):
            t = i / sample_rate
            sample = int(clamp(fn(t, duration)) * 32767)
            chunk.extend(struct.pack('<h', sample))
            if len(chunk) >= 65536:
                wav.writeframesraw(chunk)
                chunk.clear()
        if chunk:
            wav.writeframesraw(chunk)


def smooth_noise(seed: int, points: int = 8192):
    rng = random.Random(seed)
    vals = [rng.uniform(-1, 1) for _ in range(points + 1)]
    def sample(t: float, speed: float = 1.0) -> float:
        p = (t * speed) % points
        idx = int(p)
        frac = p - idx
        a, b = vals[idx], vals[idx + 1]
        frac = frac * frac * (3 - 2 * frac)
        return a + (b - a) * frac
    return sample


def generate_music() -> None:
    noise = smooth_noise(1925)
    def fn(t: float, duration: float) -> float:
        intro = min(1.0, t / 1.4)
        outro = min(1.0, max(0.0, (duration - t) / 2.2))
        env = intro * outro

        section = 0 if t < 8 else 1 if t < 20 else 2 if t < 31 else 3 if t < 37 else 4
        roots = [55.0, 61.74, 65.41, 49.0, 55.0]
        root = roots[section]

        bass = 0.18 * math.sin(2 * math.pi * root * t)
        bass += 0.08 * math.sin(2 * math.pi * root * 1.5 * t)
        bass += 0.045 * math.sin(2 * math.pi * root * 2.0 * t)

        pulse_rate = 1.25 if section < 2 else 0.9 if section == 2 else 1.4
        pulse_phase = t % pulse_rate
        pulse = math.exp(-pulse_phase * (5.5 if section != 3 else 8.5)) * math.sin(2 * math.pi * 43 * t) * (0.22 if section != 3 else 0.1)

        tick_rate = 0.58 if section < 2 else 0.42
        tick_phase = t % tick_rate
        tick = noise(t, 160) * math.exp(-tick_phase * 22) * (0.045 if section != 3 else 0.018)

        arpeggio = 0.0
        if section in (2, 4):
            notes = [220.0, 261.63, 329.63, 392.0]
            note = notes[int(t * 4) % len(notes)]
            local = (t * 4) % 1
            arpeggio = math.sin(2 * math.pi * note * t) * math.exp(-local * 5.2) * 0.032

        tension_rise = 1.0 + max(0.0, (t - 37.0) / 7.0) * 0.42
        air = noise(t, 0.85) * 0.022
        hiss = noise(t, 34) * 0.008
        return env * tension_rise * (bass + pulse + tick + arpeggio + air + hiss) * 0.82

    write_wav(OUT / 'music.wav', 44.0, fn)


def generate_sfx() -> None:
    n1 = smooth_noise(11)
    n2 = smooth_noise(12)
    write_wav(OUT / 'impact.wav', 1.5, lambda t, d: math.sin(2*math.pi*(78-32*t)*t)*math.exp(-4.7*t)*0.9 + n1(t,100)*math.exp(-15*t)*0.35)
    write_wav(OUT / 'boom.wav', 2.2, lambda t, d: math.sin(2*math.pi*(45-9*t)*t)*math.exp(-1.8*t)*0.95 + math.sin(2*math.pi*23*t)*math.exp(-2.6*t)*0.38 + n1(t,20)*math.exp(-4*t)*0.12)
    write_wav(OUT / 'paper.wav', 1.8, lambda t, d: (n2(t,230)*0.35 + n1(t,51)*0.16) * (math.sin(math.pi*t/d)**0.65))
    write_wav(OUT / 'stamp.wav', 1.0, lambda t, d: math.sin(2*math.pi*62*t)*math.exp(-9*t)*0.95 + n1(t,280)*math.exp(-19*t)*0.45)
    write_wav(OUT / 'coin.wav', 1.7, lambda t, d: (math.sin(2*math.pi*1380*t)+0.65*math.sin(2*math.pi*2140*t))*math.exp(-3.7*t)*0.3)
    def heartbeat(t: float, d: float) -> float:
        phase = t % 1.02
        beat1 = math.sin(2*math.pi*52*phase)*math.exp(-25*phase) if phase < 0.24 else 0
        p2 = phase - 0.18
        beat2 = math.sin(2*math.pi*47*p2)*math.exp(-29*p2) if 0 <= p2 < 0.18 else 0
        return beat1 * 0.7 + beat2 * 0.42
    write_wav(OUT / 'heartbeat.wav', 1.8, heartbeat)


def generate_reference_style_sfx() -> None:
    """Use exact user-supplied reference MP3s when present; otherwise create semantic fallbacks."""
    mapping = {
        'sfx-01-whoosh-entrance.mp3': 'whoosh-entrance.wav',
        'sfx-02-whoosh-long-zoom.mp3': 'whoosh-long-zoom.wav',
        'sfx-03-whoosh-quick-pan.mp3': 'whoosh-quick-pan.wav',
        'sfx-04-camera-shutter.mp3': 'camera-shutter.wav',
        'sfx-05-focus-hunt-1-left-hand.mp3': 'focus-hunt-left.wav',
        'sfx-06-focus-hunt-2-right-hand.mp3': 'focus-hunt-right.wav',
        'sfx-07-cha-ching.mp3': 'cha-ching.wav',
        'sfx-08-light-buzz-neon.mp3': 'neon-buzz.wav',
    }
    ffmpeg = shutil.which('ffmpeg')
    converted = set()
    if ffmpeg and REFERENCE.exists():
        for source_name, target_name in mapping.items():
            source = REFERENCE / source_name
            target = SFX_OUT / target_name
            if source.exists():
                subprocess.run([ffmpeg, '-hide_banner', '-loglevel', 'error', '-y', '-i', str(source), '-ar', str(SR), '-ac', '1', str(target)], check=True)
                converted.add(target_name)

    n1 = smooth_noise(431)
    n2 = smooth_noise(432)

    if 'whoosh-entrance.wav' not in converted:
        write_wav(SFX_OUT / 'whoosh-entrance.wav', 1.4, lambda t, d: n1(t, 145) * (math.sin(math.pi*t/d)**1.8) * 0.62 + math.sin(2*math.pi*(160+720*t*t)*t) * (math.sin(math.pi*t/d)**2) * 0.13)
    if 'whoosh-long-zoom.wav' not in converted:
        write_wav(SFX_OUT / 'whoosh-long-zoom.wav', 2.2, lambda t, d: n1(t, 110) * (math.sin(math.pi*t/d)**1.45) * 0.55 + math.sin(2*math.pi*(95+980*(t/d)**2)*t) * (math.sin(math.pi*t/d)**2.4) * 0.15)
    if 'whoosh-quick-pan.wav' not in converted:
        write_wav(SFX_OUT / 'whoosh-quick-pan.wav', 0.62, lambda t, d: n2(t, 240) * (math.sin(math.pi*t/d)**2.2) * 0.72)
    if 'camera-shutter.wav' not in converted:
        write_wav(SFX_OUT / 'camera-shutter.wav', 0.32, lambda t, d: n1(t, 620) * math.exp(-38*t) * 0.72 + math.sin(2*math.pi*125*t) * math.exp(-24*t) * 0.44 + (0.38 if 0.12 < t < 0.145 else 0))
    if 'focus-hunt-left.wav' not in converted:
        write_wav(SFX_OUT / 'focus-hunt-left.wav', 0.42, lambda t, d: math.sin(2*math.pi*(380+520*t)*t) * (math.sin(math.pi*t/d)**1.5) * 0.19 + n1(t, 180) * (math.sin(math.pi*t/d)**2) * 0.14)
    if 'focus-hunt-right.wav' not in converted:
        write_wav(SFX_OUT / 'focus-hunt-right.wav', 0.42, lambda t, d: math.sin(2*math.pi*(900-470*t)*t) * (math.sin(math.pi*t/d)**1.5) * 0.19 + n2(t, 190) * (math.sin(math.pi*t/d)**2) * 0.14)
    if 'cha-ching.wav' not in converted:
        write_wav(SFX_OUT / 'cha-ching.wav', 1.25, lambda t, d: (math.sin(2*math.pi*1320*t)+0.62*math.sin(2*math.pi*1980*t)+0.35*math.sin(2*math.pi*2640*t)) * math.exp(-3.8*t) * 0.28 + (math.sin(2*math.pi*780*(t-0.32))*math.exp(-5*(t-0.32))*0.19 if t>0.32 else 0))
    if 'neon-buzz.wav' not in converted:
        write_wav(SFX_OUT / 'neon-buzz.wav', 6.5, lambda t, d: 0.055*math.sin(2*math.pi*100*t) + 0.025*math.sin(2*math.pi*200*t) + n1(t, 25)*0.012)


def generate_voice() -> None:
    text_file = OUT / 'narration.txt'
    text_file.write_text(NARRATION, encoding='utf-8')
    edge = shutil.which('edge-tts')
    if not edge:
        raise RuntimeError('edge-tts command is not installed')
    voices = ['en-US-AndrewNeural', 'en-US-BrianNeural', 'en-US-GuyNeural']
    last_error = None
    for voice in voices:
        cmd = [
            edge,
            '--voice', voice,
            '--rate=+22%',
            '--pitch=-2Hz',
            '--file', str(text_file),
            '--write-media', str(OUT / 'voice.mp3'),
            '--write-subtitles', str(OUT / 'voice.srt'),
        ]
        try:
            subprocess.run(cmd, check=True)
            print(f'Generated voice with {voice}')
            return
        except subprocess.CalledProcessError as exc:
            last_error = exc
    raise RuntimeError(f'All edge-tts voices failed: {last_error}')


def main() -> int:
    generate_music()
    generate_sfx()
    generate_reference_style_sfx()
    generate_voice()
    print(f'Audio pack generated at {OUT}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
