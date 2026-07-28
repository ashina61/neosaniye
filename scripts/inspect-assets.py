#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description='Inspect generated asset candidates and build a contact sheet.')
    parser.add_argument('--root', required=True, type=Path)
    parser.add_argument('--manifest', required=True, type=Path)
    parser.add_argument('--report', required=True, type=Path)
    return parser.parse_args()


def load_font(size: int, bold: bool = False) -> ImageFont.ImageFont:
    candidates = [
        Path('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf' if bold else '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'),
        Path('/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf' if bold else '/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf'),
    ]
    for candidate in candidates:
        if candidate.exists():
            return ImageFont.truetype(str(candidate), size=size)
    return ImageFont.load_default()


def has_meaningful_alpha(image: Image.Image) -> bool:
    if 'A' not in image.getbands():
        return False
    alpha = image.getchannel('A')
    minimum, maximum = alpha.getextrema()
    return minimum < 250 and maximum > 0


def checkerboard(width: int, height: int, cell: int = 24) -> Image.Image:
    image = Image.new('RGBA', (width, height), '#e8e3d8')
    draw = ImageDraw.Draw(image)
    alternate = '#d0cbc0'
    for y in range(0, height, cell):
        for x in range(0, width, cell):
            if ((x // cell) + (y // cell)) % 2:
                draw.rectangle((x, y, min(width, x + cell), min(height, y + cell)), fill=alternate)
    return image


def inspect(file: Path, asset: dict) -> tuple[dict, Image.Image]:
    with Image.open(file) as source:
        source.load()
        image = source.convert('RGBA')
        width, height = image.size
        alpha = has_meaningful_alpha(image)
        warnings: list[str] = []
        if width < 700 or height < 700:
            warnings.append('low-resolution')
        if asset.get('transparent') and not alpha:
            warnings.append('alpha-missing-provider-output')
        if not asset.get('transparent') and alpha:
            warnings.append('unexpected-alpha-background')
        ratio = width / max(1, height)
        qc = {
            'width': width,
            'height': height,
            'format': source.format,
            'mode': source.mode,
            'hasMeaningfulAlpha': alpha,
            'aspectRatio': round(ratio, 4),
            'warnings': warnings,
            'machineScore': max(0, 100 - 20 * len(warnings)),
        }
        return qc, image.copy()


def fit_image(image: Image.Image, width: int, height: int) -> Image.Image:
    copy = image.copy()
    copy.thumbnail((width, height), Image.Resampling.LANCZOS)
    canvas = checkerboard(width, height)
    x = (width - copy.width) // 2
    y = (height - copy.height) // 2
    canvas.alpha_composite(copy, (x, y))
    return canvas


def main() -> int:
    args = parse_args()
    manifest = json.loads(args.manifest.read_text(encoding='utf-8'))
    report = json.loads(args.report.read_text(encoding='utf-8'))
    assets = {asset['id']: asset for asset in manifest['assets']}
    successful: list[tuple[dict, Image.Image]] = []

    for result in report.get('results', []):
        if result.get('status') != 'success' or not result.get('file'):
            continue
        file = Path.cwd() / result['file']
        asset = assets[result['assetId']]
        qc, image = inspect(file, asset)
        result['qc'] = qc
        successful.append((result, image))

    tile_width = 420
    tile_height = 680
    image_width = 390
    image_height = 555
    columns = min(4, max(1, len(successful)))
    rows = max(1, math.ceil(len(successful) / columns))
    sheet = Image.new('RGBA', (columns * tile_width, rows * tile_height), '#11151d')
    draw = ImageDraw.Draw(sheet)
    title_font = load_font(22, bold=True)
    detail_font = load_font(18)

    for index, (result, image) in enumerate(successful):
        column = index % columns
        row = index // columns
        x = column * tile_width
        y = row * tile_height
        tile = fit_image(image, image_width, image_height)
        sheet.alpha_composite(tile, (x + 15, y + 105))
        draw.text((x + 18, y + 18), result['assetId'], fill='#efe7d4', font=title_font)
        qc = result['qc']
        alpha = ' · alpha' if qc['hasMeaningfulAlpha'] else ''
        draw.text(
            (x + 18, y + 54),
            f"{result['provider']} · {qc['width']}×{qc['height']}{alpha}",
            fill='#70d3d7',
            font=detail_font,
        )
        if qc['warnings']:
            draw.text((x + 18, y + 80), ', '.join(qc['warnings']), fill='#e5a14d', font=detail_font)

    contact_sheet = args.root / 'contact-sheet.png'
    sheet.convert('RGB').save(contact_sheet, quality=94)

    provider_scores: dict[str, list[int]] = {}
    for result, _ in successful:
        provider_scores.setdefault(result['provider'], []).append(result['qc']['machineScore'])
    report.setdefault('summary', {})['contactSheet'] = str(contact_sheet.relative_to(Path.cwd()))
    report['summary']['providerMachineScores'] = {
        provider: round(sum(scores) / len(scores), 1)
        for provider, scores in provider_scores.items()
        if scores
    }
    args.report.write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(report['summary'], indent=2))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
