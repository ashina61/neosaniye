/**
 * WHAT A STILL LOOKS LIKE, IN NUMBERS.
 *
 * The contact sheet exists because looking is the only way to catch a bad
 * frame. This is the half of looking a machine can do — and it earns its place
 * because a person scanning sixteen thumbnails does not notice that the third
 * one is four percent darker than the rest, or that two stills of one scene are
 * pixel-for-pixel identical.
 *
 * The lesson these thresholds encode was learned the expensive way and from the
 * outside: a finished reel came in at 22 MB where the fixed one came in at 54,
 * same length, same codec, same resolution. Two thirds of every frame was flat
 * white, and flat compresses to nothing. The file size was screaming and nobody
 * was listening, because nothing in the pipeline was reading the pictures.
 *
 * Nothing here knows what an episode is. It takes pixels and returns numbers.
 */

/**
 * @param {import('sharp').Sharp} image
 * @returns {Promise<{luma: number, spread: number, flat: number, edges: number}>}
 *   luma    mean brightness, 0..1
 *   spread  standard deviation of brightness, 0..1 — contrast
 *   flat    share of pixels inside the single most common brightness bucket
 *   edges   mean absolute neighbour difference, 0..1 — how much detail there is
 */
export async function measureFrame(image) {
  const {data, info} = await image.clone().greyscale().raw().toBuffer({resolveWithObject: true});
  const total = info.width * info.height;

  const buckets = new Uint32Array(32);
  let sum = 0;
  for (let i = 0; i < total; i += 1) {
    sum += data[i];
    buckets[data[i] >> 3] += 1;
  }
  const mean = sum / total;

  let variance = 0;
  for (let i = 0; i < total; i += 1) {
    const d = data[i] - mean;
    variance += d * d;
  }

  let peak = 0;
  for (const count of buckets) if (count > peak) peak = count;

  // A cheap detail measure: how different a pixel is from the one to its right.
  // A photograph is full of small differences; a gradient and a flat fill are
  // not, and that is exactly the distinction worth making.
  let edge = 0;
  let edges = 0;
  for (let y = 0; y < info.height; y += 4) {
    for (let x = 0; x + 1 < info.width; x += 4) {
      const at = y * info.width + x;
      edge += Math.abs(data[at] - data[at + 1]);
      edges += 1;
    }
  }

  return {
    luma: mean / 255,
    spread: Math.sqrt(variance / total) / 255,
    flat: peak / total,
    edges: edges ? edge / edges / 255 : 0,
  };
}

/**
 * HOW DIFFERENT TWO STILLS OF THE SAME SHOT ARE.
 *
 * The check the repo's own laws ask for in words and nothing enforced: "a shot
 * sitting at four percent of a camera push is a still frame with grain on it".
 * Two samples from one scene that come back nearly identical mean the shot does
 * not move, and a reel of shots that do not move is a slideshow — the exact
 * thing this pipeline was rebuilt to stop being.
 *
 * Compared on a tiny greyscale thumbnail, because the question is whether the
 * PICTURE changed, not whether the grain did.
 */
export async function frameDistance(a, b) {
  const shrink = (image) => image.clone().greyscale().resize(32, 57, {fit: 'fill'}).raw().toBuffer();
  const [left, right] = await Promise.all([shrink(a), shrink(b)]);
  let sum = 0;
  for (let i = 0; i < left.length; i += 1) sum += Math.abs(left[i] - right[i]);
  return sum / left.length / 255;
}

/**
 * THE THRESHOLDS, AND WHY EACH ONE IS WHERE IT IS.
 *
 * Every one of these is a defect this repo has actually shipped, turned into a
 * number. They are deliberately loose: a gate that cries wolf gets switched
 * off, and a switched-off gate is worth less than no gate at all.
 */
export const LIMITS = {
  /** Below this the frame is mud on a phone in daylight. */
  dark: 0.055,
  /** Above this something is blown out — a white plate, a missing texture. */
  bright: 0.85,
  /** Below this there is nothing to look at: no contrast, no subject. */
  spread: 0.045,
  /** More than this share of the frame in ONE brightness bucket is a flat fill. */
  flat: 0.62,
  /** Two samples of one scene closer than this did not move enough to be a shot. */
  motion: 0.012,
};

/**
 * Frame measurements → the things worth saying out loud.
 *
 * WARNINGS, NOT FAILURES. A slate that is meant to be a dark card would trip
 * `flat` every time, and failing the build for it would teach everyone to stop
 * reading the output. The contact sheet is still the authority; this points at
 * which of the sixteen tiles to look at first.
 *
 * @param {{label: string, scene: string, stats: object, distance?: number}[]} tiles
 * @returns {string[]}
 */
export function auditTiles(tiles) {
  const notes = [];
  for (const tile of tiles) {
    const {luma, spread, flat} = tile.stats;
    if (luma < LIMITS.dark) notes.push(`${tile.label}: almost black (luma ${luma.toFixed(3)}) — is anything drawn here?`);
    else if (luma > LIMITS.bright) notes.push(`${tile.label}: blown out (luma ${luma.toFixed(3)})`);
    if (spread < LIMITS.spread) notes.push(`${tile.label}: no contrast (spread ${spread.toFixed(3)}) — flat fill, not a shot`);
    if (flat > LIMITS.flat) notes.push(`${tile.label}: ${Math.round(flat * 100)}% of the frame is one tone — a plate is missing or misplaced`);
    if (tile.distance !== undefined && tile.distance < LIMITS.motion) {
      notes.push(`${tile.scene}: two samples are ${(tile.distance * 100).toFixed(1)}% apart — the shot does not move`);
    }
  }
  return notes;
}
