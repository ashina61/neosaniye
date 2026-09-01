"""Vendor the latin woff2 subsets so rendering never depends on a font CDN.

Google's css2 response lists one @font-face per unicode subset; the first block
is vietnamese, so picking it by position yields a file with no ASCII glyphs and
the render silently falls back to a system font. Select by unicode-range.
"""
from __future__ import annotations

import re
import sys
import urllib.request
from pathlib import Path

UA = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                    "(KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36"}
FACES = [("Anton", "anton-400", 400), ("Inter", "inter-400", 400),
         ("Inter", "inter-600", 600), ("Inter", "inter-800", 800)]
OUT = Path(__file__).resolve().parents[1] / "assets" / "fonts"


def _get(url: str) -> bytes:
    return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60).read()


def latin_woff2_url(family: str, weight: int) -> str:
    css = _get(f"https://fonts.googleapis.com/css2?family={family}:wght@{weight}&display=swap").decode()
    for block in re.findall(r"@font-face\s*\{(.*?)\}", css, re.S):
        url = re.search(r"url\((https://[^)]+\.woff2)\)", block)
        rng = re.search(r"unicode-range:\s*([^;]+);", block)
        if url and rng and "U+0000" in rng.group(1):   # the basic-latin subset
            return url.group(1)
    single = re.search(r"url\((https://[^)]+\.woff2)\)", css)   # family with no subsetting
    if not single:
        raise RuntimeError(f"no woff2 url found for {family} {weight}")
    return single.group(1)


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    for family, name, weight in FACES:
        dest = OUT / f"{name}.woff2"
        if dest.exists() and dest.stat().st_size > 12_000:
            print(f"  {name}: present"); continue
        data = _get(latin_woff2_url(family, weight))
        if data[:4] != b"wOF2":
            raise RuntimeError(f"{name}: not a woff2 file (got {data[:16]!r})")
        dest.write_bytes(data)
        print(f"  {name}: {len(data)} bytes")
    return 0


if __name__ == "__main__":
    sys.exit(main())
