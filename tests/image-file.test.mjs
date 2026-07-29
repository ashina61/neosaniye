import assert from 'node:assert/strict';
import test from 'node:test';
import {inspectImageBuffer} from '../scripts/lib/image-file.mjs';

function png({width = 768, height = 1344, complete = true} = {}) {
  const buffer = Buffer.alloc(3000);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(buffer);
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);
  if (complete) buffer.write('IEND', buffer.length - 8, 'ascii');
  return buffer;
}

function jpeg({width = 768, height = 1344, complete = true} = {}) {
  const buffer = Buffer.alloc(3000);
  buffer[0] = 0xff;
  buffer[1] = 0xd8;
  buffer[2] = 0xff;
  buffer[3] = 0xc0;
  buffer.writeUInt16BE(17, 4);
  buffer[6] = 8;
  buffer.writeUInt16BE(height, 7);
  buffer.writeUInt16BE(width, 9);
  if (complete) {
    buffer[buffer.length - 2] = 0xff;
    buffer[buffer.length - 1] = 0xd9;
  }
  return buffer;
}

test('inspectImageBuffer reports valid vertical PNG metadata', () => {
  assert.deepEqual(inspectImageBuffer(png()), {
    width: 768,
    height: 1344,
    format: 'png',
    bytes: 3000,
    aspectRatio: 768 / 1344,
  });
});

test('inspectImageBuffer reports valid JPEG metadata', () => {
  assert.equal(inspectImageBuffer(jpeg()).format, 'jpeg');
  assert.throws(() => inspectImageBuffer(jpeg({complete: false})), /truncated-jpeg-image/);
});

test('inspectImageBuffer rejects small, truncated, and non-image buffers', () => {
  assert.throws(() => inspectImageBuffer(png({width: 64})), /low-resolution-image/);
  assert.throws(() => inspectImageBuffer(png({complete: false})), /truncated-png-image/);
  assert.throws(() => inspectImageBuffer(Buffer.from('not an image')), /invalid-image-bytes/);
});
