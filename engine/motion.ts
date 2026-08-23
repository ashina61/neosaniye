/**
 * MOTION HELPERS — shared by every episode, owned by none.
 *
 * Nothing in this file knows what a scene contains. It takes numbers and
 * returns numbers, which is what makes a second episode cost nothing.
 */
import {Easing, interpolate, spring} from 'remotion';

export const CLAMP = {
  extrapolateLeft: 'clamp' as const,
  extrapolateRight: 'clamp' as const,
};

/**
 * POSTERIZE TIME — the stop-motion stutter.
 *
 * Snaps the playhead to a coarser rate so everything downstream jumps in steps
 * instead of gliding. 30fps motion reads as digital; 12fps steps read as
 * hand-made. Feed THIS frame — not the real one — into every animation, or the
 * scene will glide underneath a juddering treatment and the two will fight.
 */
export function posterizeTime(frame: number, fps: number, stepFps = 12): number {
  const step = Math.max(1, Math.round(fps / Math.max(1, stepFps)));
  return Math.floor(frame / step) * step;
}

/**
 * BOIL — the wobble that keeps a still cut-out alive.
 *
 * A fraction of a percent of scale and half a degree of sway, on two sines of
 * different periods so they never sync into an obvious loop.
 */
export function boil(
  frame: number,
  {scale = 0.005, rotate = 0.5, period = 140, phase = 0} = {},
): {scale: number; rotate: number} {
  const t = (frame + phase) / period;
  return {
    scale: 1 + Math.sin(t * Math.PI * 2) * scale,
    rotate: Math.sin(t * Math.PI * 2 * 0.73 + 1.1) * rotate,
  };
}

/** DRIFT — slow one-way travel, for parallax layers. */
export function drift(frame: number, distance: number, durationInFrames: number): number {
  return interpolate(frame, [0, Math.max(1, durationInFrames)], [0, distance], CLAMP);
}

/** PINGPONG — symmetric oscillator for sways, pendulums, hand-held float. */
export function pingpong(frame: number, periodInFrames: number, amplitude = 1): number {
  return Math.sin((frame / Math.max(1, periodInFrames)) * Math.PI * 2) * amplitude;
}

/**
 * SPRING ENTRANCE — how things arrive.
 *
 * Low stiffness with a little mass: the object glides in over roughly a second
 * and settles with one small bounce, the way a hand places something down. A
 * stiff spring snaps, and a snap reads as a glitch rather than as a choice.
 */
export function springEntrance(
  frame: number,
  fps: number,
  {delay = 0, stiffness = 42, mass = 1.1, damping = 12} = {},
): number {
  return spring({frame: frame - delay, fps, config: {stiffness, mass, damping}});
}

/** A burst of motion blur that peaks at the fastest point of a move. */
export function blurBurst(frame: number, [start, peak, end]: number[], maxPx = 9): number {
  return interpolate(frame, [start, peak, end], [0, maxPx, 0], CLAMP);
}

/** Ease-out camera push — the default slow creep toward a subject. */
export function push(frame: number, [start, end]: number[], [from, to]: number[]): number {
  return interpolate(frame, [start, end], [from, to], {...CLAMP, easing: Easing.out(Easing.cubic)});
}

/**
 * A transform origin expressed in scene pixels.
 *
 * Two layers only read as one space if they scale around the SAME point on the
 * floor. Miss the shared anchor and the near layer slides off the far one.
 */
export function anchorOrigin(x: number, y: number, width: number, height: number): string {
  return `${(x / width) * 100}% ${(y / height) * 100}%`;
}

/**
 * HOLD KEYFRAMES — instant on, instant off, never a fade.
 *
 * A fluorescent tube warming up, a bulb striking, a frame flicking to negative.
 * The whole character of the effect is that there is NO ramp: cross-fade it and
 * it stops being electrical and becomes a dissolve.
 *
 * `spans` are [on, off] pairs in scene frames.
 */
export function holdKeyframes(frame: number, spans: number[][]): boolean {
  return spans.some(([on, off]) => frame >= on && frame < off);
}

/**
 * DAMPED SWING — a pendulum that swings hard and settles.
 *
 * A finger wagging no, a hanging lamp knocked, a sign rocking. Amplitude times
 * a cosine times a decaying exponential; the decay is what stops it reading as
 * a loop.
 */
export function dampedSwing(
  frame: number,
  {amplitude = 28, rate = 0.52, decay = 0.042, delay = 0} = {},
): number {
  const t = Math.max(0, frame - delay);
  return amplitude * Math.cos(t * rate) * Math.exp(-decay * t);
}

/**
 * DRAW ON — 0..1 along a stroke, for anything that should look hand-drawn.
 *
 * Fed to stroke-dashoffset it makes a line draw itself. An annotation that
 * simply fades in reads as a graphic overlay; one that draws on reads as
 * someone marking the frame, which is the entire point of it.
 */
export function drawOn(frame: number, [start, end]: number[]): number {
  return interpolate(frame, [start, end], [0, 1], {...CLAMP, easing: Easing.out(Easing.quad)});
}

/**
 * FOCUS HUNT — an old lens finding its subject.
 *
 * Returns blur in pixels. Opens soft, snaps clear, drifts off once more, then
 * settles: the shot arrives rather than cutting in. Drawn light must be told
 * about this number, because soft gradients are blur-invariant — run a lens
 * blur over one and you get the same glow back, so it looks untreated while
 * everything around it goes soft.
 */
export function focusHunt(
  frame: number,
  durationInFrames: number,
  {clearBy = 21, dipAt = 0.3, dipBack = 0.42, maxPx = 16} = {},
): number {
  // EVERY KEY IS RELATIVE TO THE SHOT, INCLUDING THE FIRST ONE.
  //
  // `clearBy` used to be a flat 21 frames, which is fine while every scene is
  // seven seconds and wrong the moment one is a second and a half: the lens was
  // still finding focus a third of the way past the point it was supposed to
  // drift off again, the keys arrived out of order, and interpolate threw —
  // taking the whole render with it. A shot cannot spend most of itself
  // arriving, so the opening is capped at a fifth of the scene.
  const span = Math.max(2, durationInFrames);
  const clear = Math.max(1, Math.min(clearBy, Math.round(span * 0.2)));
  const dipStart = Math.max(clear + 1, Math.round(span * dipAt));
  const dipEnd = Math.max(dipStart + 2, Math.round(span * dipBack));
  return interpolate(
    frame,
    [0, clear, dipStart, (dipStart + dipEnd) / 2, dipEnd, Math.max(dipEnd + 1, span)],
    [maxPx, 0, 0, maxPx * 0.45, 0, 0],
    {...CLAMP, easing: Easing.inOut(Easing.quad)},
  );
}

/** Deterministic 0..1 from a string — same input, same frame, every run. */
export function hash01(seed: string, salt = 0): number {
  let h = (2166136261 ^ salt) >>> 0;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return ((h >>> 0) % 10000) / 10000;
}

/**
 * PUNCH — an impact, not an animation.
 *
 * A scale that snaps up in two frames and decays back. The whole character of
 * it is the ASYMMETRY: a symmetric ease in and out is a pulse, and a pulse
 * reads as a loading spinner. Something has to be hit hard and then recover.
 *
 * Returns a scale multiplier, so it composes with whatever scale the caller
 * already has rather than replacing it.
 */
export function punch(
  frame: number,
  at: number,
  {amount = 0.07, rise = 2, decay = 0.16} = {},
): number {
  const t = frame - at;
  if (t < 0) return 1;
  const attack = Math.min(1, t / Math.max(1, rise));
  return 1 + amount * attack * Math.exp(-decay * Math.max(0, t - rise));
}

/**
 * IMPACT SHAKE — the camera taking the hit.
 *
 * Two sines at incommensurable rates so the path never repeats, times an
 * exponential decay so it is an event rather than a loop. Rotation is a tenth
 * of the translation in degrees, which is roughly what a real handheld does
 * when something lands.
 *
 * Use it ON THE CAMERA, not on one layer. A single plate shaking inside a still
 * frame is a plate coming loose; the frame shaking is the world being struck.
 */
export function shake(
  frame: number,
  at: number,
  {amplitude = 16, decay = 0.24, rate = 1.9} = {},
): {x: number; y: number; rotate: number} {
  const t = frame - at;
  if (t < 0) return {x: 0, y: 0, rotate: 0};
  const fall = Math.exp(-decay * t);
  return {
    x: Math.sin(t * rate) * amplitude * fall,
    y: Math.cos(t * rate * 1.37 + 0.6) * amplitude * 0.72 * fall,
    rotate: Math.sin(t * rate * 0.81 + 1.4) * amplitude * 0.055 * fall,
  };
}

/**
 * A SOFT-EDGED WIPE, as a CSS mask.
 *
 * The reveal that is not a fade. A fade changes how much of a thing you can
 * see everywhere at once, which is a dissolve; a wipe changes WHERE the thing
 * is, which is an edge travelling — and an edge travelling is a thing being
 * uncovered.
 *
 * `softness` is the width of the feathered edge as a percentage. Zero is a hard
 * matte line, which is right for a graphic and wrong for type: type wiped with
 * a hard edge shows half a letter for two frames and reads as a clipping bug.
 */
export type WipeDirection = 'left' | 'right' | 'up' | 'down';

const WIPE_ANGLE: Record<WipeDirection, number> = {left: 90, right: 270, up: 0, down: 180};

export function wipeMask(progress: number, direction: WipeDirection = 'up', softness = 14): string {
  const p = Math.min(1, Math.max(0, progress));
  // The window travels past the far edge by `softness`, so the last sliver of
  // the subject reaches FULL opacity instead of being left under the feather.
  const edge = p * (100 + softness);
  return (
    `linear-gradient(${WIPE_ANGLE[direction]}deg, ` +
    `#000 0%, #000 ${Math.max(0, edge - softness)}%, transparent ${edge}%, transparent 100%)`
  );
}

/** A hard clip reveal — for graphics, rules and bars, where an edge is wanted. */
export function clipReveal(progress: number, direction: WipeDirection = 'left'): string {
  const gone = (1 - Math.min(1, Math.max(0, progress))) * 100;
  switch (direction) {
    case 'right':
      return `inset(0 0 0 ${gone}%)`;
    case 'up':
      return `inset(${gone}% 0 0 0)`;
    case 'down':
      return `inset(0 0 ${gone}% 0)`;
    default:
      return `inset(0 ${gone}% 0 0)`;
  }
}

/**
 * A NUMBER CLIMBING.
 *
 * Eased out, so it runs fast and lands slow: a linear count is a clock, and a
 * clock does not make a figure feel large. Returns the raw number — rounding
 * and formatting belong to whatever is drawing it, because a year, a count and
 * a sum of money are three different strings from the same climb.
 */
export function countTo(frame: number, [start, end]: number[], to: number, from = 0): number {
  return interpolate(frame, [start, Math.max(start + 1, end)], [from, to], {
    ...CLAMP,
    easing: Easing.out(Easing.cubic),
  });
}

/**
 * LETTER-SPACING OPENING OUT, in em.
 *
 * Type that arrives already set reads as a caption dropped in. Type whose
 * tracking settles reads as type being SET, which is a small difference on one
 * word and the whole difference across a reel.
 */
export function tracking(frame: number, [start, end]: number[], [from, to] = [0.18, -0.02]): number {
  return interpolate(frame, [start, Math.max(start + 1, end)], [from, to], {
    ...CLAMP,
    easing: Easing.out(Easing.cubic),
  });
}

/**
 * WHEN THE NTH THING IN A GROUP ARRIVES.
 *
 * Centralised because a stagger written inline is a stagger that drifts: three
 * templates each doing `from + i * 6` is three templates that will disagree the
 * first time one of them is tuned.
 *
 * `ease` bunches the later items up (0.7 is a good crowd), so a long list does
 * not take proportionally longer than a short one — which is what turns the
 * last item of a nine-item stack into an afterthought arriving alone.
 */
export function stagger(index: number, {from = 0, every = 6, ease = 1} = {}): number {
  return from + every * Math.pow(Math.max(0, index), ease);
}
