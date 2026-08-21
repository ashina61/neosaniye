import sharp from 'sharp';

/**
 * BACKGROUND REMOVAL — the step that turns a picture into a LAYER.
 *
 * Everything else in this pipeline is timing and composition. This is the one
 * thing that decides whether a shot looks composed or looks like a rectangle
 * pasted on a rectangle, and it is the reason a cut-out pipeline works at all:
 * a subject with a clean alpha edge can stand in front of something, and a
 * subject on a white square cannot.
 *
 * Two rules, and the second one is the one everybody misses:
 *
 *   FLOOD FROM THE CORNERS, NOT FROM THE EDGES. A wide subject touches the
 *   middle of an edge — a ship, a skyline, a row of people — and a fill seeded
 *   there walks straight into the subject and eats it. Corners are the only
 *   part of a generated image that is reliably background.
 *
 *   THEN KEEP ONLY THE LARGEST CONNECTED PIECE. That is what removes the stray
 *   specks a generator leaves lying in the corners: they are opaque, they are
 *   not the subject, and the fill has no reason to touch them.
 *
 * And then the part that does NOT follow from either of those: the gap under an
 * arm, a window, the hole in a handle. Those are background the fill can never
 * reach, and keeping the largest blob does not drop them either — a hole is
 * four-connected to the shape around it, so it IS the largest blob. They have
 * to be punched out on purpose, and carefully: an enclosed off-white region is
 * a window, and it is also a white shirt, so the pass below only punches a
 * region that is sealed inside the subject AND small next to it.
 *
 * Nothing here is model-based. It works because the input is an ASKED-FOR
 * cut-out on a plain background, which is what the prompt sheet demands.
 */

/** Squared distance between two RGB triples. Cheap, and good enough. */
const dist2 = (r1, g1, b1, r2, g2, b2) => (r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2;

/**
 * @param {Buffer} input  any image
 * @param {{tolerance?: number, feather?: number, minShare?: number}} [options]
 *   tolerance  0..255-ish; how far a pixel may drift from the corner colour
 *   feather    px of alpha blur, so the edge is not a staircase
 *   minShare   refuse to return a cut-out smaller than this share of the frame
 * @returns {Promise<{png: Buffer, kept: number, width: number, height: number}>}
 */
export async function keyOut(input, {tolerance = 55, feather = 0.9, minShare = 0.01} = {}) {
  const image = sharp(input).ensureAlpha();
  const {data, info} = await image.raw().toBuffer({resolveWithObject: true});
  const {width, height} = info;
  const n = width * height;

  /** The four corners, averaged over a small patch so one odd pixel cannot
   *  define the background colour. */
  const corners = [
    [0, 0],
    [width - 1, 0],
    [0, height - 1],
    [width - 1, height - 1],
  ].map(([cx, cy]) => {
    let r = 0;
    let g = 0;
    let b = 0;
    let count = 0;
    for (let dy = -3; dy <= 3; dy += 1) {
      for (let dx = -3; dx <= 3; dx += 1) {
        const x = Math.min(width - 1, Math.max(0, cx + dx));
        const y = Math.min(height - 1, Math.max(0, cy + dy));
        const at = (y * width + x) * 4;
        r += data[at];
        g += data[at + 1];
        b += data[at + 2];
        count += 1;
      }
    }
    return [r / count, g / count, b / count];
  });

  const tol2 = tolerance * tolerance * 3;
  const isBackgroundColour = (at) =>
    corners.some((c) => dist2(data[at], data[at + 1], data[at + 2], c[0], c[1], c[2]) <= tol2);

  // FLOOD from the four corners only.
  const bg = new Uint8Array(n);
  const queue = new Int32Array(n);
  let head = 0;
  let tail = 0;
  const push = (index) => {
    if (bg[index]) return;
    const at = index * 4;
    // An already-transparent pixel is background by definition — a generator
    // that returned real alpha should not have it thrown away.
    if (data[at + 3] < 12 || isBackgroundColour(at)) {
      bg[index] = 1;
      queue[tail++] = index;
    }
  };
  push(0);
  push(width - 1);
  push((height - 1) * width);
  push(n - 1);

  while (head < tail) {
    const index = queue[head++];
    const x = index % width;
    const y = (index - x) / width;
    if (x > 0) push(index - 1);
    if (x < width - 1) push(index + 1);
    if (y > 0) push(index - width);
    if (y < height - 1) push(index + width);
  }

  /**
   * THEN THE LARGEST SURVIVING BLOB.
   *
   * Everything the fill could not reach is still opaque: the subject, and also
   * every hole inside it and every speck the generator left lying around. One
   * pass of connected components, keep the biggest, drop the rest.
   */
  const label = new Int32Array(n).fill(-1);
  let best = -1;
  let bestSize = 0;
  let next = 0;
  for (let start = 0; start < n; start += 1) {
    if (bg[start] || label[start] !== -1) continue;
    const id = next++;
    let size = 0;
    head = 0;
    tail = 0;
    label[start] = id;
    queue[tail++] = start;
    while (head < tail) {
      const index = queue[head++];
      size += 1;
      const x = index % width;
      const y = (index - x) / width;
      const visit = (nb) => {
        if (bg[nb] || label[nb] !== -1) return;
        label[nb] = id;
        queue[tail++] = nb;
      };
      if (x > 0) visit(index - 1);
      if (x < width - 1) visit(index + 1);
      if (y > 0) visit(index - width);
      if (y < height - 1) visit(index + width);
    }
    if (size > bestSize) {
      bestSize = size;
      best = id;
    }
  }

  if (bestSize < n * minShare) {
    throw new Error(
      `the cut-out is only ${((bestSize / n) * 100).toFixed(1)}% of the frame — the background ` +
        'colour probably matches the subject. Try a lower --tolerance, or ask for the asset again on a plainer background.',
    );
  }

  /**
   * PUNCH THE ENCLOSED HOLES.
   *
   * A region that is backdrop-coloured, sealed inside the subject and small
   * next to it is a hole: the triangle between an arm and a torso, the sky
   * through a window, the gap in a handle. Left opaque it fills with the
   * backdrop colour, and the cut-out lands on the scene with a pale patch in
   * the middle of it — the single most obvious way a composite announces that
   * it was cut out.
   *
   * The size limit is the whole safety margin. A man in a white shirt on an
   * off-white backdrop has a colour-matching region too, and it is a large
   * share of him; punching it would delete his chest. A window is small.
   * Anything at all close to the subject's own size is left alone, because
   * getting this wrong quietly is worse than leaving a patch a human can see.
   */
  const HOLE_MAX_SHARE = 0.22;
  const hole = new Uint8Array(n);
  const seen = new Uint8Array(n);
  for (let start = 0; start < n; start += 1) {
    if (seen[start] || label[start] !== best) continue;
    const at = start * 4;
    if (!(data[at + 3] < 12 || isBackgroundColour(at))) continue;
    head = 0;
    tail = 0;
    seen[start] = 1;
    queue[tail++] = start;
    let size = 0;
    let touchesEdge = false;
    const region = [];
    while (head < tail) {
      const index = queue[head++];
      region.push(index);
      size += 1;
      const x = index % width;
      const y = (index - x) / width;
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) touchesEdge = true;
      const visit = (nb) => {
        if (seen[nb] || label[nb] !== best) return;
        const a = nb * 4;
        if (!(data[a + 3] < 12 || isBackgroundColour(a))) return;
        seen[nb] = 1;
        queue[tail++] = nb;
      };
      if (x > 0) visit(index - 1);
      if (x < width - 1) visit(index + 1);
      if (y > 0) visit(index - width);
      if (y < height - 1) visit(index + width);
    }
    if (!touchesEdge && size < bestSize * HOLE_MAX_SHARE) {
      for (const index of region) hole[index] = 1;
    }
  }

  /**
   * Alpha from the label map, then a light feather so the edge is not a
   * staircase.
   *
   * THE BLUR IS DONE HERE, not by handing a one-channel raw buffer to sharp and
   * taking it back. That round-trip came back misaligned — corners opaque,
   * subject transparent, the mask effectively inverted — and it fails silently,
   * which is the worst way for a keyer to fail: every asset looks keyed and
   * every one of them is the hole instead of the shape. A separable three-tap
   * box blur is four lines and cannot be misread.
   */
  const alpha = Buffer.alloc(n);
  for (let i = 0; i < n; i += 1) alpha[i] = label[i] === best && !hole[i] ? 255 : 0;

  let softened = alpha;
  if (feather > 0) {
    const passes = Math.max(1, Math.round(feather * 2));
    let src = alpha;
    for (let pass = 0; pass < passes; pass += 1) {
      const out = Buffer.alloc(n);
      for (let y = 0; y < height; y += 1) {
        const row = y * width;
        for (let x = 0; x < width; x += 1) {
          const l = src[row + (x > 0 ? x - 1 : 0)];
          const c = src[row + x];
          const r = src[row + (x < width - 1 ? x + 1 : width - 1)];
          out[row + x] = (l + c + c + r) >> 2;
        }
      }
      const out2 = Buffer.alloc(n);
      for (let y = 0; y < height; y += 1) {
        const up = (y > 0 ? y - 1 : 0) * width;
        const dn = (y < height - 1 ? y + 1 : height - 1) * width;
        const row = y * width;
        for (let x = 0; x < width; x += 1) {
          out2[row + x] = (out[up + x] + out[row + x] + out[row + x] + out[dn + x]) >> 2;
        }
      }
      src = out2;
    }
    softened = src;
  }

  const rgb = Buffer.alloc(n * 3);
  for (let i = 0; i < n; i += 1) {
    rgb[i * 3] = data[i * 4];
    rgb[i * 3 + 1] = data[i * 4 + 1];
    rgb[i * 3 + 2] = data[i * 4 + 2];
  }

  const png = await sharp(rgb, {raw: {width, height, channels: 3}})
    .joinChannel(softened, {raw: {width, height, channels: 1}})
    .png({compressionLevel: 9})
    .toBuffer();

  return {png, kept: bestSize / n, width, height};
}

/**
 * TRIM TO THE SUBJECT, then pad a little.
 *
 * A cut-out that keeps the generator's empty margins is positioned by those
 * margins rather than by itself — move it and the subject does not go where
 * you put it. Trimming makes the box mean the subject.
 */
export async function trimToSubject(png, pad = 0.02) {
  /**
   * THE BOX IS COMPUTED FROM THE ALPHA, not from `sharp.trim()`.
   *
   * `trim` decides what to cut by matching the TOP-LEFT PIXEL's colour, which
   * is a different question from "where is the subject" — and once the edge has
   * been feathered, the near-zero alpha values around it no longer match that
   * pixel exactly. On a keyed portrait it returned a 728x98 strip. The alpha
   * channel already says exactly where the subject is; read it.
   */
  const {data, info} = await sharp(png).ensureAlpha().raw().toBuffer({resolveWithObject: true});
  let minX = info.width;
  let minY = info.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      if (data[(y * info.width + x) * 4 + 3] > 8) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) throw new Error('nothing survived the key — the whole frame came back transparent');

  const w = maxX - minX + 1;
  const h = maxY - minY + 1;
  const px = Math.max(1, Math.round(Math.max(w, h) * pad));
  return sharp(png)
    .extract({left: minX, top: minY, width: w, height: h})
    .extend({top: px, bottom: px, left: px, right: px, background: {r: 0, g: 0, b: 0, alpha: 0}})
    .png({compressionLevel: 9})
    .toBuffer();
}
