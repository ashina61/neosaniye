/**
 * VISUAL STATE — what is on screen at frame N, as arithmetic.
 *
 * Plain JavaScript, like `schema.mjs`, and for the same reason: the renderer
 * and the validator have to agree, and the only way to guarantee that is for
 * both of them to call the same function. A checker that re-implements what the
 * drawing does is a checker that will eventually be checking something else.
 *
 * The failure this exists for is small and very visible. The slot reel scrolled
 * continuously, so at any moment between two values BOTH were partly in the
 * window — two sliced words stacked on each other between the slate's rules.
 * The first fix was a soft mask over the window edges, which is not a fix: it
 * made the broken state harder to see while leaving it broken. A state that
 * cannot be read is still a state that exists.
 *
 * So: an animated visual must have a VALID state at every frame, and "valid" is
 * something you can assert. These functions are the states; the validator
 * samples them; the components draw them.
 */

/* ── THE SLOT REEL ─────────────────────────────────────────────────────── */

/**
 * A SPLIT-FLAP, NOT A SCROLL.
 *
 * The invariant is that at most one value is readable at any frame, and it is
 * held by construction rather than by tuning: a value EXITS completely before
 * the next one begins to ENTER. Value i occupies its own slice of the spin, and
 * inside that slice it enters from below, holds, and leaves upward; the next
 * value's entrance starts at the boundary, by which time the previous one is a
 * whole line-height out of the window.
 *
 * A continuous scroll cannot make that promise. Between any two rows there is
 * always a moment where each is half in, and no easing curve removes it —
 * which is why the honest fix was to change the mechanism rather than to blur
 * the seam.
 *
 * Offsets are in LINE HEIGHTS: 0 is centred in the window, -1 is a full line
 * above it, +1 a full line below. `readable` is the assertion the whole file
 * exists for.
 */
export const SLOT_READABLE = 0.42;

export function slotState(frame, index, {from = 0, spin = 30, count = 1} = {}) {
  const total = Math.max(1, count);
  const last = total - 1;

  if (frame < from) {
    // Nothing has arrived. The answer waits below the window rather than
    // sitting in it, so the card does not show its own punchline early.
    return {offset: index === 0 ? 1 : 1, phase: 'idle', readable: false};
  }

  const settled = frame >= from + spin;
  if (settled) {
    return index === last
      ? {offset: 0, phase: 'settled', readable: true}
      : {offset: -1, phase: 'gone', readable: false};
  }

  const each = spin / total;
  const t = frame - from;
  // A quarter of each slice to arrive and a quarter to leave, so the value is
  // fully still for the half in the middle — the part anybody actually reads.
  const move = each * 0.25;
  const start = index * each;
  const end = start + each;

  if (t < start) return {offset: 1, phase: 'waiting', readable: false};
  if (t >= end) {
    return index === last ? {offset: 0, phase: 'settled', readable: true} : {offset: -1, phase: 'gone', readable: false};
  }

  const local = t - start;
  if (local < move) {
    // ENTERING, from below.
    const p = local / move;
    const offset = 1 - p;
    return {offset, phase: 'enter', readable: Math.abs(offset) < SLOT_READABLE};
  }
  // THE LAST VALUE NEVER LEAVES. It is the answer, and the reel stops on it.
  if (index === last || local < each - move) {
    return {offset: 0, phase: 'hold', readable: true};
  }
  // EXITING, upward.
  const p = (local - (each - move)) / move;
  const offset = -p;
  return {offset, phase: 'exit', readable: Math.abs(offset) < SLOT_READABLE};
}

/**
 * HOW MANY VALUES ARE READABLE AT ONCE.
 *
 * The assertion, exported so the regression test asks the component's own
 * question rather than a rephrasing of it. It must never exceed one.
 */
export function slotReadableCount(frame, options) {
  let n = 0;
  for (let i = 0; i < (options?.count ?? 1); i += 1) {
    if (slotState(frame, i, options).readable) n += 1;
  }
  return n;
}

/* ── COUNTERS ──────────────────────────────────────────────────────────── */

/**
 * A FIGURE THAT CLIMBS AND LANDS EXACTLY.
 *
 * Two properties that were previously only probable. It never goes backwards —
 * a counter that ticks 17, 18, 17 is a counter nobody believes — and it lands
 * on the stated figure rather than near it: an eased interpolation that stops
 * at 29 on a claim about thirty gears has quietly falsified the claim.
 *
 * The ease is applied to the PROGRESS and the value is floored, so the sequence
 * is monotonic by construction, and the final frame is pinned.
 */
export function counterValue(frame, {from = 0, over = 30, to = 0, start = 0} = {}) {
  if (frame <= from) return start;
  if (frame >= from + over) return to;
  const p = (frame - from) / Math.max(1, over);
  const eased = 1 - Math.pow(1 - p, 3);
  const value = start + (to - start) * eased;
  // Floored toward the target so it can never overshoot and come back.
  return to >= start ? Math.floor(value) : Math.ceil(value);
}

/**
 * WHEN THE FIGURE CLIMBS, AND WHEN IT LANDS.
 *
 * The component derived this from the drawing's own schedule — start halfway
 * through the draw-on, finish thirty-four frames after it — and the checker
 * derived it differently, so the checker was asserting "the counter reaches
 * thirty" about a window nobody rendered. It passed. The reel shipped with 29
 * on a shot about thirty gears, which is the exact falsification law 15 exists
 * to prevent, arrived at through a checker that agreed with itself.
 *
 * One function, three callers: the planner writes the window into the spec, the
 * component counts through it, the checker asserts it lands inside the shot.
 */
export function countWindow(spec = {}, duration = 0) {
  const from = Number(spec.from) || 0;
  const over = Number(spec.over) || 26;
  const start = Number.isFinite(Number(spec.countFrom)) ? Number(spec.countFrom) : from + over * 0.5;
  const wanted = Number.isFinite(Number(spec.countOver)) ? Number(spec.countOver) : over + 34;
  // The figure must be standing still before the cut, or the shot ends on a
  // number that was on its way somewhere.
  const room = duration > 0 ? Math.max(6, duration - 6 - start) : wanted;
  return {start: Math.round(start), over: Math.round(Math.min(wanted, room))};
}

/* ── GEARS ─────────────────────────────────────────────────────────────── */

/**
 * THE RATIO IS PHYSICS, NOT DECORATION.
 *
 * A wheel meshed to another turns the opposite way, at the inverse of their
 * tooth counts. Get it wrong and the teeth visibly slide through each other,
 * which is the single thing everybody notices about a drawn gear train — and
 * it is also the difference between causal motion and three things moving at
 * once.
 *
 * Exported so the consistency check can assert the mesh rather than trust it.
 */
export function gearAngle(frame, {fps = 30, rate = 20, driveTeeth = 32, teeth = 32, driven = false} = {}) {
  const turn = (Math.max(0, frame) / fps) * rate;
  return driven ? turn : turn * -(driveTeeth / Math.max(1, teeth));
}

/**
 * DO TWO WHEELS ACTUALLY MESH?
 *
 * True when the distance between their centres equals the sum of their pitch
 * radii, within a tolerance. Two wheels closer than that overlap; further apart
 * and they are two wheels turning near each other for no reason, which is the
 * decorative version of the same picture.
 */
export function gearsMesh(a, b, {tolerance = 0.045, aspect = 1} = {}) {
  const dx = a.x - b.x;
  const dy = (a.y - b.y) * aspect;
  const distance = Math.hypot(dx, dy);
  return Math.abs(distance - (a.radius + b.radius)) <= tolerance;
}

/* ── CONTAINMENT ───────────────────────────────────────────────────────── */

/**
 * IS THE SUBJECT INSIDE THE CIRCLE DRAWN AROUND IT?
 *
 * A ring that misses what it encircles is worse than no ring: it tells the eye
 * to look at nothing. The moon's dashed orbit spent two renders with its top
 * outside the composition, enclosing empty sky.
 */
export function contains(ring, subject) {
  const dx = ring.cx - subject.cx;
  const dy = ring.cy - subject.cy;
  return Math.hypot(dx, dy) + subject.radius <= ring.radius * 1.02;
}

/** Is a circle wholly inside the frame? */
export function insideFrame(circle, {width, height}) {
  return (
    circle.cx - circle.radius >= 0 &&
    circle.cx + circle.radius <= width &&
    circle.cy - circle.radius >= 0 &&
    circle.cy + circle.radius <= height
  );
}

/* ── LAYOUT ────────────────────────────────────────────────────────────── */

/** Deterministic 0..1 from a seed. Same reel, same machine, every run. */
function hash01(seed, salt = 0) {
  let h = (2166136261 ^ salt) >>> 0;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return ((h >>> 0) % 10000) / 10000;
}

/**
 * A GEAR TRAIN LAID OUT FROM A COUNT.
 *
 * Lives here, in the shared module, because the CHECK and the DRAWING must be
 * looking at the same wheels. A validator that re-derives the layout is
 * validating its own copy, and the two drift the first time either is tuned.
 *
 * The planner knows "thirty gears" and nothing about pitch circles, and it
 * should stay that way. Thirty wheels drawn literally at readable size is a
 * grey mass, so a legible subset is shown: a large driven wheel and a ring of
 * meshing satellites, each placed so its pitch circle TOUCHES the driven one —
 * which is what `gearsMesh` then asserts.
 *
 * The ring is squashed vertically to keep the train inside a band, leaving the
 * top of the frame for the count and the bottom for the words. Squashing moves
 * the centres, so the distance is computed in the same squashed space the
 * check uses; otherwise the wheels look meshed and measure apart.
 */
export const GEAR_ASPECT = 1920 / 1080;
export const GEAR_SQUASH = 0.78;

export function gearTrainLayout(count, seed = 'train') {
  const shown = Math.max(3, Math.min(7, Math.round(count / 5) + 2));
  const hub = {x: 0.5, y: 0.46, teeth: 32, radius: 0.19, label: 'main wheel'};
  const gears = [hub];
  for (let i = 1; i < shown; i += 1) {
    const angle = (i / (shown - 1)) * Math.PI * 1.7 - Math.PI * 0.85;
    const teeth = 14 + Math.round(hash01(seed, i) * 12);
    const radius = 0.19 * (teeth / 32) + 0.035;
    const d = hub.radius + radius;
    /**
     * THE DISTANCE IS PRESERVED THROUGH THE SQUASH.
     *
     * Scaling y by 0.78 and leaving x alone pulls the side wheels off their
     * pitch circles — they read as meshed at the top and detached at the sides.
     * Dividing the vertical component by the same factor the check applies
     * keeps the centre distance exactly r1 + r2 in the space that matters.
     */
    gears.push({
      x: hub.x + Math.cos(angle) * d,
      y: hub.y + (Math.sin(angle) * d) / GEAR_ASPECT,
      teeth,
      radius,
    });
  }
  return fitTrain(gears);
}

/**
 * AND THE TRAIN HAS TO FIT IN THE FRAME.
 *
 * The laid-out ring ran to x = 1.07 and two wheels were cut in half by the
 * right edge of a rendered reel — which passed the schema, the tests, the
 * critique and the clipping check, because every one of them knew about props
 * and captions and none of them knew a diagram had geometry. Law 26 says
 * clipping is found by arithmetic; this is the arithmetic.
 *
 * Scaling the whole train about its hub is the one transform that cannot break
 * the mesh: every radius and every centre distance changes by the same factor,
 * so `r1 + r2` stays exactly the distance between the centres. Translating
 * afterwards cannot break it either. Nudging individual wheels would.
 */
const MARGIN_X = 0.055;
const BAND = [0.2, 0.8];

function fitTrain(gears) {
  const hub = gears[0];
  const left = Math.min(...gears.map((g) => g.x - g.radius));
  const right = Math.max(...gears.map((g) => g.x + g.radius));
  const top = Math.min(...gears.map((g) => g.y - g.radius / GEAR_ASPECT));
  const bottom = Math.max(...gears.map((g) => g.y + g.radius / GEAR_ASPECT));

  const scale = Math.min(
    1,
    (1 - MARGIN_X * 2) / Math.max(1e-6, right - left),
    (BAND[1] - BAND[0]) / Math.max(1e-6, bottom - top),
  );
  const scaled = gears.map((g) => ({
    ...g,
    x: hub.x + (g.x - hub.x) * scale,
    y: hub.y + (g.y - hub.y) * scale,
    radius: g.radius * scale,
  }));

  // Centre what is left, so the train sits in the band rather than against it.
  const l = Math.min(...scaled.map((g) => g.x - g.radius));
  const r = Math.max(...scaled.map((g) => g.x + g.radius));
  const t = Math.min(...scaled.map((g) => g.y - g.radius / GEAR_ASPECT));
  const b = Math.max(...scaled.map((g) => g.y + g.radius / GEAR_ASPECT));
  const dx = 0.5 - (l + r) / 2;
  const dy = (BAND[0] + BAND[1]) / 2 - (t + b) / 2;
  return scaled.map((g) => ({...g, x: g.x + dx, y: g.y + dy}));
}

/** Every wheel, wholly inside the frame? Asked in the same units it is drawn in. */
export function trainInsideFrame(gears) {
  return gears.every(
    (g) =>
      g.x - g.radius >= 0 &&
      g.x + g.radius <= 1 &&
      g.y - g.radius / GEAR_ASPECT >= 0 &&
      g.y + g.radius / GEAR_ASPECT <= 1,
  );
}
