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
AUDIO.mkdir(parents=True, exist_ok=True)
GENERATED.mkdir(parents=True, exist_ok=True)

FPS = 30
VOICE_OFFSET_FRAMES = 12
SAMPLE_RATE = 22050
random.seed(61)

NARRATION = """Venüs'te bir gün, bir yıldan daha uzun.

Ama burada küçük bir ayrıntı var. Bu, Güneş'in gökyüzündeki turu değil; gezegenin kendi eksenindeki tam dönüşü.

Venüs bir kez dönmek için 243 Dünya günü harcıyor.

Güneş'in çevresindeki bir yılıysa yalnızca 225 Dünya günü sürüyor.

Yani Venüs, kendi etrafındaki dönüşünü tamamlayamadan yeni yılı geliyor.

Üstelik ters yönde döndüğü için Güneş batıdan doğup doğuda batıyor gibi görünür.

Gün doğumundan gün doğumuna geçen güneş günü ise yaklaşık 117 Dünya günü. Venüs'te zaman gerçekten ters köşe."""


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
    n = noise(243)

    def music(t: float, duration: float) -> float:
        fade_in = min(1.0, t / 1.2)
        fade_out = min(1.0, max(0.0, (duration - t) / 2.5))
        section = 0 if t < 8 else 1 if t < 18 else 2 if t < 29 else 3
        root = [55.0, 61.74, 49.0, 65.41][section]
        bass = math.sin(2 * math.pi * root * t) * 0.14
        bass += math.sin(2 * math.pi * root * 2 * t) * 0.045
        pulse_phase = t % (0.72 if section != 2 else 0.9)
        pulse = math.sin(2 * math.pi * 42 * t) * math.exp(-pulse_phase * 7.5) * 0.18
        note = [220.0, 261.63, 329.63, 392.0][int(t * 2.5) % 4]
        note_phase = (t * 2.5) % 1
        shimmer = math.sin(2 * math.pi * note * t) * math.exp(-note_phase * 5) * 0.025
        air = n(t, 1.1) * 0.018 + n(t, 35) * 0.006
        return (bass + pulse + shimmer + air) * fade_in * fade_out * 0.85

    write_wav(AUDIO / 'music.wav', 50.0, music)


def generate_sfx() -> None:
    n1 = noise(225)
    n2 = noise(117)
    write_wav(AUDIO / 'impact.wav', 1.4, lambda t, d: math.sin(2 * math.pi * (82 - 38 * t) * t) * math.exp(-5.2 * t) * 0.92 + n1(t, 180) * math.exp(-18 * t) * 0.28)
    write_wav(AUDIO / 'whoosh-a.wav', 1.1, lambda t, d: n1(t, 170) * (math.sin(math.pi * t / d) ** 2.1) * 0.58 + math.sin(2 * math.pi * (130 + 650 * (t / d) ** 2) * t) * (math.sin(math.pi * t / d) ** 2) * 0.1)
    write_wav(AUDIO / 'whoosh-b.wav', 0.75, lambda t, d: n2(t, 260) * (math.sin(math.pi * t / d) ** 2.5) * 0.68)
    write_wav(AUDIO / 'reverse.wav', 1.5, lambda t, d: n1(t, 120) * ((t / d) ** 1.6) * 0.42 + math.sin(2 * math.pi * (900 - 650 * t / d) * t) * ((t / d) ** 1.8) * 0.12)
    write_wav(AUDIO / 'tick.wav', 1.2, lambda t, d: (math.sin(2 * math.pi * 1450 * t) + 0.5 * math.sin(2 * math.pi * 2150 * t)) * math.exp(-28 * (t % 0.24)) * 0.2)
    write_wav(AUDIO / 'chime.wav', 2.2, lambda t, d: (math.sin(2 * math.pi * 660 * t) + 0.62 * math.sin(2 * math.pi * 990 * t) + 0.35 * math.sin(2 * math.pi * 1320 * t)) * math.exp(-2.3 * t) * 0.24)
    write_wav(AUDIO / 'rumble.wav', 8.0, lambda t, d: math.sin(2 * math.pi * 38 * t) * 0.12 + math.sin(2 * math.pi * 24 * t) * 0.07 + n2(t, 14) * 0.025)


def generate_voice() -> None:
    edge = shutil.which('edge-tts')
    if edge is None:
        raise RuntimeError('edge-tts bulunamadı.')
    text_path = AUDIO / 'narration.txt'
    text_path.write_text(NARRATION, encoding='utf-8')
    last_error = None
    for voice in ['tr-TR-AhmetNeural', 'tr-TR-EmelNeural']:
        command = [edge, '--voice', voice, '--rate=+12%', '--pitch=-2Hz', '--file', str(text_path), '--write-media', str(AUDIO / 'voice.mp3'), '--write-subtitles', str(AUDIO / 'voice.srt')]
        try:
            subprocess.run(command, check=True)
            print(f'Ses oluşturuldu: {voice}')
            return
        except subprocess.CalledProcessError as exc:
            last_error = exc
    raise RuntimeError(f'Türkçe ses üretilemedi: {last_error}')


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
        raise RuntimeError('SRT zamanlaması çıkarılamadı.')
    return cues


def cue_start(cues: list[dict[str, object]], fragment: str, fallback_ratio: float) -> int:
    for cue in cues:
        if fragment.casefold() in str(cue['text']).casefold():
            return int(cue['start'])
    return round(int(cues[-1]['end']) * fallback_ratio)


def generate_timing() -> None:
    cues = parse_srt(AUDIO / 'voice.srt')
    scenes = {
        'hook': 0,
        'explain': cue_start(cues, 'küçük bir ayrıntı', 0.15),
        'rotation': cue_start(cues, '243', 0.32),
        'orbit': cue_start(cues, '225', 0.48),
        'compare': cue_start(cues, 'Yani Venüs', 0.62),
        'reverse': cue_start(cues, 'ters yönde', 0.74),
        'solar': cue_start(cues, '117', 0.87),
    }
    total_frames = int(cues[-1]['end']) + 24
    output = f"""export type CaptionCue = {{start: number; end: number; text: string}};

export const CUES: CaptionCue[] = {json.dumps(cues, ensure_ascii=False, indent=2)};

export const SCENES = {json.dumps(scenes, ensure_ascii=False, indent=2)} as const;

export const TOTAL_FRAMES = {total_frames};
"""
    (GENERATED / 'timing.ts').write_text(output, encoding='utf-8')
    print(f'Toplam süre: {total_frames / FPS:.2f} saniye')


def main() -> int:
    generate_music()
    generate_sfx()
    generate_voice()
    generate_timing()
    return 0


if __name__ == '__main__':
    sys.exit(main())
