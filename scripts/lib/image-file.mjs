import {readFile} from 'node:fs/promises';

function jpegDimensions(buffer) {
  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buffer[offset + 1];
    if (marker === 0xd8 || marker === 0xd9) {
      offset += 2;
      continue;
    }
    const length = buffer.readUInt16BE(offset + 2);
    if (length < 2 || offset + length + 2 > buffer.length) return null;
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      return {width: buffer.readUInt16BE(offset + 7), height: buffer.readUInt16BE(offset + 5), format: 'jpeg'};
    }
    offset += length + 2;
  }
  return null;
}

export function inspectImageBuffer(buffer, {minimumDimension = 512, minimumBytes = 3000} = {}) {
  if (!Buffer.isBuffer(buffer) || buffer.length < minimumBytes) throw new Error('invalid-image-bytes');
  let dimensions = null;
  if (buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    if (buffer.subarray(-8, -4).toString('ascii') !== 'IEND') throw new Error('truncated-png-image');
    dimensions = {width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20), format: 'png'};
  } else if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    if (buffer.at(-2) !== 0xff || buffer.at(-1) !== 0xd9) throw new Error('truncated-jpeg-image');
    dimensions = jpegDimensions(buffer);
  }
  if (!dimensions || dimensions.width < minimumDimension || dimensions.height < minimumDimension) throw new Error('unsupported-corrupt-or-low-resolution-image');
  return {...dimensions, bytes: buffer.length, aspectRatio: dimensions.width / dimensions.height};
}

export async function inspectImageFile(file) {
  return inspectImageBuffer(await readFile(file));
}
