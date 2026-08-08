/**
 * A SURFACE IS DRAWN, NOT SEARCHED.
 *
 * Law 2 of this repo says people and places are photographs and everything else
 * is drawn. A wall is not a place. Neither is water, a sheet of paper, a strip
 * of sky, the dark behind a museum case or the floor a thing is standing on —
 * they are the GROUND a shot is built on, and a photo archive does not index
 * them. Ask Commons for "a plain grey laboratory wall" and it returns a white
 * room; ask for "dark green water" and it returns an aerial photograph of a
 * lake; ask for "museum storage drawers" and it returns an antique console
 * cabinet. Three episodes of hand-correcting those search terms produced three
 * different wrong pictures, because the search is not the problem: nobody
 * uploads a photograph of a blank wall and captions it.
 *
 * So a surface is generated here, from a name, with no network at all. Same
 * name, same surface, every run — and it cannot come back as something else.
 *
 * What makes it a surface rather than a gradient, in the order it matters:
 *
 *   MOTTLE     fractal value noise, ANISOTROPIC. Wood grain runs one way, water
 *              ripples run the other, plaster runs neither. The stretch is what
 *              tells them apart; the noise is the same noise.
 *   STRUCTURE  the one thing the material actually does — rings in wood, bands
 *              in water, a horizon-less falloff in sky. One per texture, not a
 *              pile of them.
 *   LIGHT      a soft pool from ONE side, off-centre, seeded. The repo's third
 *              law again: light in a room has a source. A flat field lit evenly
 *              is a swatch, and it reads as one the moment a plate sits on it.
 *   GRAIN      last, at full resolution, so it does not get smoothed away.
 *
 * Everything is multiplied over a base colour rather than drawn in colour, so a
 * texture and a palette are separate decisions and the episode can override the
 * palette without touching the texture.
 */
import sharp from 'sharp';

/**
 * WHAT EACH MATERIAL IS, IN FIVE NUMBERS.
 *
 *   colour   the base, before light and mottle
 *   cells    noise cells across the frame [x, y] — UNEQUAL is the whole point,
 *            since the ratio between them is the grain direction
 *   octaves  how much fine detail rides on the large blotches
 *   depth    how far the mottle swings the value; a stone is not a bedsheet
 *   grain    per-pixel film noise, added at full resolution
 */
const TEXTURES = {
  wall: {colour: [104, 99, 92], cells: [15, 24], octaves: 5, depth: 0.2, grain: 0.03},
  plaster: {colour: [113, 107, 97], cells: [17, 28], octaves: 5, depth: 0.22, grain: 0.034},
  concrete: {colour: [92, 92, 89], cells: [13, 20], octaves: 6, depth: 0.26, grain: 0.04},
  stone: {colour: [88, 80, 72], cells: [18, 24], octaves: 6, depth: 0.34, grain: 0.045},
  wood: {colour: [78, 54, 34], cells: [3, 34], octaves: 4, depth: 0.24, grain: 0.028, structure: 'rings'},
  // A WALL OF DRAWERS IS NOT A WOOD SWATCH. The first version of this drew
  // beautiful grain and read as a kitchen worktop, because "rows of museum
  // storage drawers" is a GRID before it is a material: seams, a lip that
  // catches the light, a handle, and every drawer a slightly different age.
  // Without those the shot has no scale in it and no reason to be that room.
  drawers: {colour: [74, 52, 33], cells: [4, 30], octaves: 4, depth: 0.2, grain: 0.026, structure: 'panels'},
  shelves: {colour: [66, 60, 52], cells: [4, 26], octaves: 4, depth: 0.2, grain: 0.028, structure: 'panels'},
  metal: {colour: [92, 96, 101], cells: [2, 80], octaves: 3, depth: 0.16, grain: 0.022, structure: 'brushed'},
  paper: {colour: [200, 189, 166], cells: [8, 24], octaves: 5, depth: 0.12, grain: 0.032},
  cloth: {colour: [58, 54, 48], cells: [34, 34], octaves: 3, depth: 0.16, grain: 0.03, structure: 'weave'},
  water: {colour: [18, 51, 43], cells: [11, 5], octaves: 5, depth: 0.24, grain: 0.02, structure: 'ripple'},
  sky: {colour: [26, 39, 54], cells: [4, 3], octaves: 5, depth: 0.3, grain: 0.016, structure: 'sky'},
  dark: {colour: [21, 21, 23], cells: [11, 16], octaves: 5, depth: 0.3, grain: 0.026},
  rust: {colour: [98, 58, 34], cells: [14, 16], octaves: 6, depth: 0.36, grain: 0.045},
  green: {colour: [30, 54, 41], cells: [8, 9], octaves: 5, depth: 0.26, grain: 0.03},
};

export const SURFACE_TEXTURES = Object.keys(TEXTURES);

/**
 * WHICH MATERIAL A SENTENCE IS ASKING FOR.
 *
 * The brief already says it in words — "a plain grey wall", "dark green water
 * over rock" — so the texture is read out of the prompt rather than demanded as
 * a second field nobody would keep in sync. An explicit `surface` on the recipe
 * still wins; this is the fallback, and it falls back again to plaster, which
 * is the surface most rooms are made of.
 */
export function textureFor(text) {
  const s = String(text ?? '').toLowerCase();
  const has = (re) => re.test(s);
  if (has(/\b(water|sea|ocean|underwater|lake|river|wave)/)) return 'water';
  if (has(/\b(sky|cloud|night sky|dusk|dawn|fog bank)/)) return 'sky';
  if (has(/\b(drawers?|cabinets?|shelf|shelves|filing|locker|pigeonhole|archive)/)) return 'drawers';
  if (has(/\b(wood|wooden|timber|oak|desk|table|floorboard|panell?ing|crate)/)) return 'wood';
  if (has(/\b(metal|steel|iron|brass|bronze|aluminium|zinc|sheet)/)) return 'metal';
  if (has(/\b(rust|corro\w+|oxidi[sz]ed)/)) return 'rust';
  if (has(/\b(paper|card|parchment|page|document|ledger)/)) return 'paper';
  if (has(/\b(cloth|fabric|felt|curtain|velvet|linen|canvas)/)) return 'cloth';
  if (has(/\b(stone|rock|granite|marble|slate|seabed|gravel)/)) return 'stone';
  if (has(/\b(concrete|cement|tarmac|asphalt)/)) return 'concrete';
  if (has(/\b(black|dark|void|shadow|unlit)/) && !has(/\b(green|blue|red|brown)\b/)) return 'dark';
  if (has(/\bgreen\b/)) return 'green';
  return 'plaster';
}

/** Same name, same surface — the generator's rule, kept here too. */
function seedFor(name) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < name.length; i += 1) {
    h ^= name.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

function hash(x, y, seed) {
  let h = (seed ^ Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const smooth = (t) => t * t * (3 - 2 * t);

function noise(x, y, seed) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = smooth(x - xi);
  const yf = smooth(y - yi);
  const a = hash(xi, yi, seed);
  const b = hash(xi + 1, yi, seed);
  const c = hash(xi, yi + 1, seed);
  const d = hash(xi + 1, yi + 1, seed);
  return (a * (1 - xf) + b * xf) * (1 - yf) + (c * (1 - xf) + d * xf) * yf;
}

function fbm(x, y, seed, octaves) {
  let sum = 0;
  let amp = 1;
  let norm = 0;
  let f = 1;
  for (let o = 0; o < octaves; o += 1) {
    sum += amp * noise(x * f, y * f, (seed + o * 1013) >>> 0);
    norm += amp;
    amp *= 0.5;
    // Not exactly 2: an integer lacunarity lines the octaves up on the same
    // lattice and the mottle grows a visible grid.
    f *= 2.07;
  }
  return sum / norm;
}

/**
 * A GRID OF FRONTS, WITH A LIP AND A HANDLE.
 *
 * Four things, and every one of them is doing a job:
 *
 *   SEAM     a dark line where two fronts meet — the only thing that says this
 *            is many objects rather than one board
 *   LIP      light along the top edge of each front, shadow along the bottom.
 *            This is the whole illusion: a drawer sticks out, and a surface
 *            that sticks out catches the light on one edge only
 *   HANDLE   a recessed bar in the middle. Without it a grid of wooden squares
 *            is panelling, and panelling is a different room
 *   AGE      per-drawer brightness, from the cell's own hash. A wall of
 *            identical fronts is a texture tile and reads as one immediately
 */
function panel(u, v, seed, cols = 3, rows = 9) {
  const gx = u * cols;
  const gy = v * rows;
  const cx = Math.floor(gx);
  const cy = Math.floor(gy);
  const fx = gx - cx;
  const fy = gy - cy;

  let value = 0.86 + hash(cx, cy, seed ^ 0x2f) * 0.28;

  const seam = 0.018;
  if (fx < seam || fx > 1 - seam || fy < seam * (cols / rows) * 3 || fy > 1 - seam * (cols / rows) * 3) {
    return value * 0.34;
  }
  // Lit along the top, dropping into shadow at the foot of each front.
  value *= 1.16 - fy * 0.34;

  // The handle: a recessed bar, dark, with the light catching just under it.
  const hx = Math.abs(fx - 0.5);
  const hy = fy - 0.52;
  if (hx < 0.17 && Math.abs(hy) < 0.045) value *= hy < 0 ? 0.45 : 1.28;

  return value;
}

function parseColour(value, fallback) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(value ?? '').trim());
  if (!m) return fallback;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * Draw one surface.
 *
 * `name` is the seed — the file name, so re-running redraws the same picture.
 * Everything else has a default, because a brief that says nothing beyond "a
 * plain grey wall" must still get a usable plate.
 */
export async function drawSurface({name, width, height, texture, colour, light, format = 'png'}) {
  const spec = TEXTURES[texture] ?? TEXTURES.plaster;
  const base = parseColour(colour, spec.colour);
  const seed = seedFor(name);
  const rnd = (n) => hash(n, 7717, seed);

  // ONE SIDE, and which side is the episode's business when it says so. The
  // pool sits partly off-frame: a light source inside a blank surface is a
  // torch pointed at a wall, and it reads as a blown highlight rather than as a
  // room.
  const side = light === 'left' ? -1 : light === 'right' ? 1 : rnd(3) < 0.5 ? -1 : 1;
  const lx = 0.5 + side * (0.34 + rnd(11) * 0.22);
  const ly = 0.24 + rnd(13) * 0.4;
  const spread = 0.52 + rnd(17) * 0.24;
  const lift = 0.34 + rnd(19) * 0.16;

  const cellsX = spec.cells[0];
  const cellsY = spec.cells[1];
  const ratio = height / width;

  const data = Buffer.allocUnsafe(width * height * 3);
  const structure = spec.structure;

  for (let y = 0; y < height; y += 1) {
    const v = y / height;
    for (let x = 0; x < width; x += 1) {
      const u = x / width;

      // MOTTLE. The cell counts are per axis, so a texture stretched 3×40 gives
      // long fibres down the frame without the noise itself knowing anything
      // about wood.
      const m = fbm(u * cellsX, v * cellsY, seed, spec.octaves);
      let value = 1 + (m - 0.5) * spec.depth * 2;

      /**
       * STRUCTURE — one move per material.
       *
       * Anything that BENDS rides a deliberately SMOOTH field, not the mottle:
       * displacing a wave by five octaves of noise turns it into contour lines,
       * and the first water drawn here came back looking like a geological
       * survey map. Grain and ripples are slow; the fine detail belongs in the
       * mottle underneath them.
       */
      const slow = structure ? fbm(u * cellsX * 0.5, v * cellsY * 0.25, seed ^ 0x51, 2) : 0.5;

      if (structure === 'rings') {
        const rings = Math.sin((u * 6.5 + slow * 1.8) * Math.PI * 2);
        value *= 1 + rings * 0.07;
      } else if (structure === 'brushed') {
        value *= 1 + (hash(x, 0, seed) - 0.5) * 0.16;
      } else if (structure === 'weave') {
        value *= 1 + Math.sin(x * 0.9) * Math.sin(y * 0.9) * 0.05;
      } else if (structure === 'ripple') {
        // Few, wide, soft. A caustic is a bright edge with a long dark trough
        // under it, which is why only the positive half is kept and raised to a
        // power — a plain sine is a corduroy blind.
        const bands = Math.sin((v * 5.2 + slow * 1.5 + u * 0.4) * Math.PI * 2);
        value *= 1 + Math.max(0, bands) ** 7 * 0.42;
        // Water gets darker away from the surface, and that is most of why it
        // reads as water rather than as green plaster.
        value *= 1 - v * 0.46;
      } else if (structure === 'sky') {
        value *= 1 - v * 0.3;
        value *= 1 + (m - 0.5) * 0.5;
      } else if (structure === 'panels') {
        value *= panel(u, v, seed);
      }

      /**
       * LIGHT — AND IT NEVER GOES ABOVE THE PAPER.
       *
       * The first version could reach 2.1× the base colour in the middle of the
       * pool, which is not a lit wall, it is a blown one: a mid-grey wall came
       * out near-white and swallowed the x-ray plate standing in front of it.
       * A surface is the thing at the BACK of the shot. It is allowed to be lit;
       * it is not allowed to be the brightest thing in the frame. Peak is held
       * just over 1.2 and the shadow side never goes fully black, because a
       * black corner is where a plate's edge stops being visible.
       */
      const dx = (u - lx) / spread;
      const dy = (v - ly) / (spread * ratio * 0.62);
      const pool = Math.exp(-(dx * dx + dy * dy) * 1.4);
      value *= 0.55 + (0.45 + lift * 0.5) * pool;

      // VIGNETTE — the frame's own falloff, on top of the pool, because a lens
      // darkens the corners whatever the lamp is doing.
      const cx = (u - 0.5) * 2;
      const cy = (v - 0.5) * 2;
      value *= 1 - Math.min(1, (cx * cx * 0.7 + cy * cy * 0.55)) * 0.34;

      // GRAIN, full resolution and last.
      value += (hash(x, y, seed ^ 0x9e3779b9) - 0.5) * spec.grain * 2;

      // Warm where it is lit, cold where it is not. A field lit with one flat
      // multiplier looks like a swatch at any brightness.
      const warm = Math.min(1, Math.max(0, pool));
      const r = base[0] * value * (1 + warm * 0.06);
      const g = base[1] * value;
      const b = base[2] * value * (1 - warm * 0.05 + (1 - warm) * 0.07);

      const i = (y * width + x) * 3;
      data[i] = Math.min(255, Math.max(0, r));
      data[i + 1] = Math.min(255, Math.max(0, g));
      data[i + 2] = Math.min(255, Math.max(0, b));
    }
  }

  const image = sharp(data, {raw: {width, height, channels: 3}});
  return format === 'jpeg' ? image.jpeg({quality: 92}).toBuffer() : image.png().toBuffer();
}
