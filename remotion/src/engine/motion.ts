/**
 * THE MOTION ENGINE.
 *
 * Written once, imported by every rig. A scene file never re-invents a stutter,
 * a wobble or a spring — it asks for one here. That is what makes a new scene a
 * choreography problem instead of a physics problem.
 */
import {Easing, interpolate, spring} from 'remotion';

export const CLAMP = {
  extrapolateLeft: 'clamp' as const,
  extrapolateRight: 'clamp' as const,
};

/**
 * POSTERIZE — the single most important function in the engine.
 *
 * Snaps the playhead to a coarser rate so everything downstream jumps in steps
 * instead of gliding. 30fps motion reads as digital; 12fps steps read as
 * stop-motion. Feed this frame — not the real one — into every animation.
 */
export function posterizeTime(frame: number, fps: number, stepFps = 12): number {
  const step = Math.max(1, Math.round(fps / Math.max(1, stepFps)));
  return Math.floor(frame / step) * step;
}

/**
 * BOIL — the hand-made wobble.
 *
 * A cut-out that holds perfectly still looks dead, so everything breathes: a
 * fraction of a percent of scale and half a degree of sway, on slow sines of
 * different periods so the two never sync into an obvious loop.
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

/** DRIFT — a slow one-way travel, for clouds and other parallax layers. */
export function drift(frame: number, distance: number, durationInFrames: number): number {
  return interpolate(frame, [0, Math.max(1, durationInFrames)], [0, distance], CLAMP);
}

/** PINGPONG — a symmetric oscillator for sways, pendulums and hand-held float. */
export function pingpong(frame: number, periodInFrames: number, amplitude = 1): number {
  return Math.sin((frame / Math.max(1, periodInFrames)) * Math.PI * 2) * amplitude;
}

/**
 * ENTRANCE — the spring everything pops in on.
 *
 * Low stiffness with a touch of mass: things glide in over roughly a second and
 * settle with one small bounce, the way a hand places something down. A stiff
 * spring snaps and reads as a glitch.
 */
export function entrance(
  frame: number,
  fps: number,
  {delay = 0, stiffness = 42, mass = 1.1, damping = 12} = {},
): number {
  return spring({
    frame: frame - delay,
    fps,
    config: {stiffness, mass, damping},
    durationInFrames: undefined,
  });
}

/**
 * DAMPED WAG — a swing about a pivot that loses energy: the foam-finger "no",
 * a shaking head, a sign swinging after it is hit.
 */
export function dampedWag(
  frame: number,
  {amplitude = 28, speed = 0.52, decay = 0.042, delay = 0} = {},
): number {
  const t = Math.max(0, frame - delay);
  return amplitude * Math.cos(t * speed) * Math.exp(-decay * t);
}

/**
 * HOLD KEYFRAMES — instant on/off with no fades, like a fluorescent tube
 * warming up or a projector gate flickering. Windows are [start, end) pairs in
 * frames; anything outside them is off.
 */
export function holdKeyframes(frame: number, windows: number[]): boolean {
  for (let i = 0; i + 1 < windows.length; i += 2) {
    if (frame >= windows[i] && frame < windows[i + 1]) return true;
  }
  return false;
}

/**
 * ANCHORED SCALE — a transform-origin expressed in scene pixels.
 *
 * Two plates only read as one space if they scale around the SAME point on the
 * floor. Miss the anchor and the character slides off the pavement.
 */
export function anchorOrigin(x: number, y: number, width: number, height: number): string {
  return `${(x / width) * 100}% ${(y / height) * 100}%`;
}

/** A burst of motion blur that peaks at the fastest point of a move. */
export function blurBurst(frame: number, [start, peak, end]: number[], maxPx = 9): number {
  return interpolate(frame, [start, peak, end], [0, maxPx, 0], CLAMP);
}

/** Ease-out camera push — the default "slow creep toward the subject". */
export function push(
  frame: number,
  [start, end]: number[],
  [from, to]: number[],
): number {
  return interpolate(frame, [start, end], [from, to], {
    ...CLAMP,
    easing: Easing.out(Easing.cubic),
  });
}

/** Deterministic 0..1 hash — same beat id always yields the same variation. */
export function hash01(seed: string, salt = 0): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}
