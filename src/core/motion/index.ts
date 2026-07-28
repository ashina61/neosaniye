import {interpolate, spring} from 'remotion';

export const clamp = {
  extrapolateLeft: 'clamp' as const,
  extrapolateRight: 'clamp' as const,
};

export const posterizeFrame = (frame: number, sourceFps = 30, targetFps = 12) =>
  Math.floor((frame * targetFps) / sourceFps) * (sourceFps / targetFps);

export const boil = (frame: number, seed = 0, amount = 1) => {
  const stepped = posterizeFrame(frame + seed * 7);
  return {
    x: Math.sin(stepped * 0.19 + seed) * amount,
    y: Math.cos(stepped * 0.16 + seed * 1.3) * amount,
    rotate: Math.sin(stepped * 0.11 + seed * 2.1) * amount * 0.15,
  };
};

export const progress = (frame: number, from: number, to: number) =>
  interpolate(frame, [from, to], [0, 1], clamp);

export const enterSpring = (frame: number, delay = 0) =>
  spring({
    frame: Math.max(0, frame - delay),
    fps: 30,
    config: {damping: 14, stiffness: 115, mass: 0.85},
  });
