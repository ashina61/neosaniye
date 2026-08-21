/**
 * THE HANDOVER, TESTED AT ITS TWO SEAMS.
 *
 * This pipeline has exactly two places where a human and a machine meet, and
 * both of them are silent when they break:
 *
 *   THE FILENAME. The prompt sheet promises a name and the renderer expects
 *   that same name. If the two ever drift, the user comes back with fifteen
 *   correct pictures and the render says nothing is there.
 *
 *   THE KEY. A mis-keyed cut-out still renders. It renders as a rectangle, or
 *   as the hole where the subject was, and the run reports success either way.
 *   Both of those actually happened here: sharp's `.blur()` on a one-channel
 *   raw buffer came back misaligned and inverted the mask, and `sharp.trim()`
 *   cropped to a 728x98 strip because it matches the top-left PIXEL COLOUR,
 *   not the alpha. Neither threw.
 *
 * So the cases below are the ones that decide whether the handover works, and
 * none of them need a generator, a network, or a browser.
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {shotsOf} from '../scripts/broll-shots.mjs';
import {keyOut, trimToSubject} from '../scripts/lib/key.mjs';

const W = 200;
const H = 200;

/** A flat backdrop with shapes painted on it — no generator required. */
async function picture(backdrop, rects) {
  const data = Buffer.alloc(W * H * 3);
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      let colour = backdrop;
      for (const [x0, y0, x1, y1, c] of rects) {
        if (x >= x0 && x < x1 && y >= y0 && y < y1) colour = c;
      }
      const i = (y * W + x) * 3;
      data[i] = colour[0];
      data[i + 1] = colour[1];
      data[i + 2] = colour[2];
    }
  }
  return sharp(data, {raw: {width: W, height: H, channels: 3}}).png().toBuffer();
}

async function alphaAt(png, x, y) {
  const {data, info} = await sharp(png).ensureAlpha().raw().toBuffer({resolveWithObject: true});
  return data[(y * info.width + x) * info.channels + 3];
}

const brief = {
  format: 'vertical',
  style: 'archival',
  background: 'aged paper',
  beats: [
    {
      slug: 'pact',
      vo: 'İki bakan bir anlaşma imzaladı.',
      mid: [{name: 'ribbentrop', prompt: 'a diplomat'}, {name: 'molotov', prompt: 'an official'}],
      fore: [{name: 'signing desk', prompt: 'a desk'}],
    },
    {slug: 'dawn', vo: 'Şafakta sınırı geçtiler.', mid: [{name: 'tank column', prompt: 'tanks'}]},
  ],
};

test('the sheet and the renderer agree on every filename', () => {
  const plan = shotsOf(brief);
  const promised = new Set(plan.wanted.map((item) => item.file));
  const expected = [];
  for (const beat of plan.beats) {
    if (beat.bg) expected.push(beat.bg.file);
    for (const layer of [...beat.mid, ...beat.fore]) expected.push(layer.file);
  }
  // Every file the beats reach for is a file the sheet asked the user to bring.
  for (const file of expected) assert.ok(promised.has(file), `${file} is used but never asked for`);
  assert.equal(promised.size, expected.length + 1, 'the shared background is asked for once');
});

test('the filename says which beat, which layer, and which thing', () => {
  const plan = shotsOf(brief);
  const names = plan.wanted.map((item) => item.file);
  assert.ok(names.includes('background.png'));
  assert.ok(names.includes('s01-mid-ribbentrop.png'));
  assert.ok(names.includes('s01-fore-signing-desk.png'));
  assert.ok(names.includes('s02-mid-tank-column.png'));
});

test('every prompt carries the layer rule, not just the topic', () => {
  const plan = shotsOf(brief);
  for (const item of plan.wanted) {
    assert.ok(item.prompt.includes('archival'), 'the episode style rides on every prompt');
    assert.ok(/no text/.test(item.prompt), 'a generator left alone will write words on the picture');
    if (item.kind !== 'bg') {
      // This one sentence is what makes the corner flood fill possible at all.
      assert.match(item.prompt, /plain flat off-white background/);
    }
  }
});

test('a wide subject touching the edge survives — the fill starts at the CORNERS', async () => {
  // A band from edge to edge, the shape that eats a subject when the fill is
  // seeded at the middle of an edge instead.
  const png = await picture([245, 244, 240], [[0, 80, W, 130, [30, 30, 30]]]);
  const {png: keyed} = await keyOut(png);
  assert.equal(await alphaAt(keyed, 4, 100), 255, 'the subject reaches the edge and stays');
  assert.equal(await alphaAt(keyed, 100, 100), 255);
  assert.equal(await alphaAt(keyed, 100, 10), 0, 'the backdrop above it is gone');
});

test('a hole inside the subject is background too', async () => {
  const png = await picture(
    [245, 244, 240],
    [
      [50, 50, 150, 150, [30, 30, 30]],
      [80, 80, 120, 120, [245, 244, 240]],
    ],
  );
  const {png: keyed} = await keyOut(png);
  assert.equal(await alphaAt(keyed, 100, 100), 0, 'the fill can never reach it; the hole pass punches it');
  assert.equal(await alphaAt(keyed, 60, 60), 255);
});

test('specks in the corners do not come back as a cut-out', async () => {
  const png = await picture(
    [245, 244, 240],
    [
      [60, 60, 140, 140, [30, 30, 30]],
      [4, 4, 12, 12, [20, 90, 160]],
    ],
  );
  const {png: keyed} = await keyOut(png);
  assert.equal(await alphaAt(keyed, 8, 8), 0, 'only the largest piece survives');
});

test('the mask is the SHAPE, never the hole', async () => {
  // The blur round-trip that broke this returned a mask that was opaque in the
  // corners and transparent on the subject, and threw nothing.
  const png = await picture([245, 244, 240], [[70, 70, 130, 130, [30, 30, 30]]]);
  const {png: keyed, kept} = await keyOut(png);
  assert.equal(await alphaAt(keyed, 2, 2), 0);
  assert.equal(await alphaAt(keyed, 100, 100), 255);
  assert.ok(kept > 0.05 && kept < 0.2, `kept ${kept} should be about the square's share`);
});

test('a backdrop that matches the subject is refused, not delivered', async () => {
  const png = await picture([245, 244, 240], [[95, 95, 105, 105, [244, 243, 239]]]);
  await assert.rejects(() => keyOut(png), /background/);
});

test('the trim box means the subject, not the generator margins', async () => {
  const png = await picture([245, 244, 240], [[70, 40, 130, 160, [30, 30, 30]]]);
  const {png: keyed} = await keyOut(png);
  const trimmed = await trimToSubject(keyed, 0);
  const info = await sharp(trimmed).metadata();
  // 60x120, plus the guard pixel and the couple the feather bleeds outwards.
  // What matters is that it is the SUBJECT: not the 200x200 frame, and not the
  // 728x98 strip `sharp.trim()` handed back when it matched on colour instead.
  assert.ok(info.width >= 60 && info.width <= 70, `width ${info.width}`);
  assert.ok(info.height >= 120 && info.height <= 130, `height ${info.height}`);
});
