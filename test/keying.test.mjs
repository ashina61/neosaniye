/**
 * Backdrop removal, tested on pictures we build ourselves.
 *
 * The generator cannot be tested end to end without spending a real draw, but
 * the keying is where it actually went wrong: the first version measured
 * greenness and therefore only worked if a diffusion model obeyed an
 * instruction to paint a chroma screen. It does not, and every keyed asset came
 * back 100% opaque. So the cases below are the ones that decide whether a
 * cut-out is usable, and none of them need the network.
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {CUTOUT_CEILING, keyBackdrop, islandCount} from '../scripts/generate-assets.mjs';

const W = 160;
const H = 160;

/** A picture with a flat backdrop and rectangles painted on it. */
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

async function opaqueFraction(png) {
  const {data, info} = await sharp(png).ensureAlpha().raw().toBuffer({resolveWithObject: true});
  let solid = 0;
  let total = 0;
  for (let i = 3; i < data.length; i += info.channels) {
    total += 1;
    if (data[i] > 200) solid += 1;
  }
  return solid / total;
}

const GREEN = [0, 177, 64];
const GREY = [186, 186, 186];
const RED = [176, 42, 38];

test('a green backdrop is keyed away and the subject survives', async () => {
  const png = await keyBackdrop(await picture(GREEN, [[50, 40, 110, 130, RED]]));
  assert.equal(await alphaAt(png, 4, 4), 0, 'corner should be transparent');
  assert.equal(await alphaAt(png, 80, 85), 255, 'middle of the subject should be solid');
});

test('a grey backdrop is keyed away too — the colour is never assumed', async () => {
  // This is the case the old greenness test could not do, and the reason every
  // cut-out failed: the model draws whatever backdrop it likes.
  const png = await keyBackdrop(await picture(GREY, [[50, 40, 110, 130, RED]]));
  assert.equal(await alphaAt(png, 4, 4), 0);
  assert.equal(await alphaAt(png, 80, 85), 255);
});

test('backdrop colour ENCLOSED by the subject is kept', async () => {
  // A white shirt on a white backdrop. Only the region connected to the frame
  // edge is backdrop; a matching patch walled in by the subject is not.
  const png = await keyBackdrop(await picture(GREY, [[40, 30, 120, 140, RED], [70, 60, 95, 90, GREY]]));
  assert.equal(await alphaAt(png, 4, 4), 0, 'outer backdrop goes');
  assert.equal(await alphaAt(png, 82, 74), 255, 'the enclosed patch stays');
});

test('keyHoles opens the window in an empty frame', async () => {
  // An empty picture frame: its middle IS backdrop, walled off by the frame.
  // Left opaque it covers whatever the frame is meant to be framing.
  const frame = await picture(GREY, [[40, 30, 120, 140, RED], [55, 45, 105, 125, GREY]]);
  assert.equal(await alphaAt(await keyBackdrop(frame), 80, 85), 255, 'closed by default');
  assert.equal(await alphaAt(await keyBackdrop(frame, {holes: true}), 80, 85), 0, 'opened on request');
});

test('a backdrop with a soft gradient is still followed all the way in', async () => {
  const data = Buffer.alloc(W * H * 3);
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const shade = 150 + Math.round((x / W) * 60); // 150 → 210 across the frame
      const inside = x >= 55 && x < 105 && y >= 40 && y < 130;
      const i = (y * W + x) * 3;
      data[i] = inside ? RED[0] : shade;
      data[i + 1] = inside ? RED[1] : shade;
      data[i + 2] = inside ? RED[2] : shade;
    }
  }
  const png = await keyBackdrop(await sharp(data, {raw: {width: W, height: H, channels: 3}}).png().toBuffer());
  assert.equal(await alphaAt(png, 4, 80), 0, 'dark end of the gradient');
  assert.equal(await alphaAt(png, W - 5, 80), 0, 'light end of the gradient');
  assert.equal(await alphaAt(png, 80, 85), 255, 'subject survives the gradient');
});

test('a picture that is nothing but backdrop keys away to nothing', async () => {
  // The generator refuses to write this rather than shipping an empty scene.
  const png = await keyBackdrop(await picture(GREY, []));
  assert.ok((await opaqueFraction(png)) < 0.04);
});

test('a picture with no backdrop at all keeps everything', async () => {
  // Busy edge to edge — nothing to key. The generator refuses this too, because
  // it means the model drew a room instead of a cut-out.
  const data = Buffer.alloc(W * H * 3);
  for (let i = 0; i < data.length; i += 3) {
    data[i] = (i * 7) % 255;
    data[i + 1] = (i * 13) % 255;
    data[i + 2] = (i * 29) % 255;
  }
  const png = await keyBackdrop(await sharp(data, {raw: {width: W, height: H, channels: 3}}).png().toBuffer());
  assert.ok((await opaqueFraction(png)) > 0.9);
});

test('a key that shatters the picture is refused, however opaque it is', async () => {
  // The worst run this repo has had, reproduced: asked for a subject on an
  // empty backdrop the model drew an empty studio ROOM, the key found a
  // backdrop and carved the rest into unrelated blobs. Every one passed the
  // opacity check — one was 52% opaque and pure noise — because opacity asks
  // how much survived, never whether it is one thing.
  const blobs = [];
  for (let i = 0; i < 14; i += 1) {
    const x = 12 + (i % 5) * 28;
    const y = 12 + Math.floor(i / 5) * 44;
    blobs.push([x, y, x + 18, y + 30, RED]);
  }
  const shattered = await keyBackdrop(await picture(GREY, blobs));
  assert.ok((await islandCount(shattered)) > 6, 'expected many islands');

  const oneObject = await keyBackdrop(await picture(GREY, [[50, 40, 110, 130, RED]]));
  assert.ok((await islandCount(oneObject)) <= 2, 'a single cut-out is one island');
});


test('a keyed photograph that kept half the frame is a rectangle, not a cut-out', async () => {
  /**
   * THE GUARD THAT WAS SET FOR THE WRONG FAILURE.
   *
   * The ceiling was 0.88, chosen for the GENERATOR: a model asked for "one
   * object on a plain white background" either complies or draws a whole scene
   * at 90%+. A FETCHED photograph fails much closer in — the keyer works
   * inward from the frame edges on colour, so a park bench photographed in a
   * park loses the sky and keeps seventy per cent, as one big island with hard
   * edges, and 0.88 waved it through.
   *
   * Measured on a real episode the two populations do not overlap: chess king
   * 9.6%, chair 9.7%, phone 17.3%, magnifying glass 22.4% — against bench
   * 70.0%, cable coil 68.9%, chalkboard 65.3%. Every one of the second group
   * reached a rendered frame and sat on the shot as a smear with corners.
   */
  assert.ok(CUTOUT_CEILING <= 0.5, `ceiling is ${CUTOUT_CEILING} — a half-frame blob is not a cut-out`);
  assert.ok(CUTOUT_CEILING > 0.28, `ceiling is ${CUTOUT_CEILING} — real cut-outs measured up to 27.9% and must survive`);

  // A tall object on a sweep keys down to a slim silhouette and is fine; the
  // same picture with the object filling the frame is the rectangle.
  const sweep = [255, 255, 255];
  const object = [59, 42, 24];
  const slim = await picture(sweep, [[66, 20, 94, 140, object]]);
  const wide = await picture(sweep, [[8, 8, 152, 152, object]]);
  assert.ok(await opaqueFraction(await keyBackdrop(slim)) < CUTOUT_CEILING);
  assert.ok(await opaqueFraction(await keyBackdrop(wide)) > CUTOUT_CEILING);
});
