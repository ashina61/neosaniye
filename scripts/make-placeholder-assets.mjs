#!/usr/bin/env node
/**
 * Placeholder art for the test episode: flat colour boxes with a label.
 *
 * Written as real PNG files rather than generated at render time so the
 * validator has something to find — a test episode whose assets only exist in
 * memory would pass validation for the wrong reason.
 */
import {mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import {ROOT, parseArgs} from './lib/episode.mjs';

function png(width, height, rgb) {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  let offset = 0;
  for (let y = 0; y < height; y += 1) {
    raw[offset++] = 0;
    for (let x = 0; x < width; x += 1) {
      // A soft diagonal so a placeholder still shows movement and scale.
      const shade = 0.75 + 0.25 * Math.sin((x / width + y / height) * Math.PI);
      raw[offset++] = Math.round(rgb[0] * shade);
      raw[offset++] = Math.round(rgb[1] * shade);
      raw[offset++] = Math.round(rgb[2] * shade);
    }
  }
  const chunk = (type, data) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(zlib.crc32 ? zlib.crc32(body) : crc32(body));
    return Buffer.concat([length, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function crc32(buffer) {
  let crc = ~0;
  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return ~crc >>> 0;
}

const FILES = [
  ['background-1.png', 1080, 1920, [46, 58, 72]],
  ['background-2.png', 1080, 1920, [72, 52, 44]],
  ['character-1.png', 700, 1200, [206, 178, 128]],
  ['photo-1.png', 900, 1120, [128, 146, 160]],
  ['frame-1.png', 900, 1120, [196, 158, 74]],
  ['item-1.png', 620, 830, [214, 206, 182]],
  ['item-2.png', 620, 830, [198, 190, 166]],
  ['item-3.png', 620, 830, [182, 174, 150]],
];

async function main() {
  const args = parseArgs();
  const episodeId = typeof args.episode === 'string' ? args.episode : 'test-episode';
  const dir = path.join(ROOT, 'episodes', episodeId, 'assets');
  await mkdir(dir, {recursive: true});
  for (const [name, width, height, rgb] of FILES) {
    await writeFile(path.join(dir, name), png(width, height, rgb));
    console.log(`  ${name} ${width}x${height}`);
  }
  console.log(`✓ ${FILES.length} placeholder assets in episodes/${episodeId}/assets`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
