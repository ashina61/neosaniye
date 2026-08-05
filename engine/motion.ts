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

/** Deterministic 0..1 from a string — same input, same frame, every run. */
export function hash01(seed: string, salt = 0): number {
  let h = (2166136261 ^ salt) >>> 0;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return ((h >>> 0) % 10000) / 10000;
}
