#!/usr/bin/env python3
"""faster-whisper ile kelime bazlı zaman damgaları çıkarır.

Kullanım:
    python3 scripts/whisper_align.py <ses_dosyasi> [model]

Çıktı: stdout'a JSON -> [{"word": "...", "start": 0.1, "end": 0.4}, ...]
Yalnızca Piper yolunda kullanılır (edge-tts kendi zaman damgasını verir).
Ön koşul: pip install faster-whisper
"""
import json
import sys


def main() -> int:
    if len(sys.argv) < 2:
        print("kullanım: whisper_align.py <ses_dosyasi> [model]", file=sys.stderr)
        return 2

    audio = sys.argv[1]
    model_size = sys.argv[2] if len(sys.argv) > 2 else "base"

    from faster_whisper import WhisperModel

    model = WhisperModel(model_size, device="cpu", compute_type="int8")
    segments, _info = model.transcribe(audio, word_timestamps=True)

    words = []
    for seg in segments:
        for w in seg.words or []:
            words.append(
                {
                    "word": w.word.strip(),
                    "start": round(w.start, 3),
                    "end": round(w.end, 3),
                }
            )

    json.dump(words, sys.stdout, ensure_ascii=False)
    return 0


if __name__ == "__main__":
    sys.exit(main())
