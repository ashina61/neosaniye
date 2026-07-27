import {Easing, interpolate, spring} from 'remotion';

export const posterizeFrame = (frame: number, fps: number, targetFps = 12) => {
  const seconds = frame / fps;
  return (Math.floor(seconds * targetFps) / targetFps) * fps;
};

export const boil = (frame: number, amount = 1, speed = 0.46) => ({
  x: Math.sin(frame * speed) * amount,
  y: Math.cos(frame * speed * 0.83) * amount * 0.72,
  rotate: Math.sin(frame * speed * 0.51) * amount * 0.08,
});

export const drift = (
  frame: number,
  from: number,
  to: number,
  startFrame: number,
  endFrame: number,
) =>
  interpolate(frame, [startFrame, endFrame], [from, to], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.quad),
  });

export const pingpong = (frame: number, period: number, amplitude = 1) =>
  Math.sin((frame / period) * Math.PI * 2) * amplitude;

export const springEntrance = (
  frame: number,
  fps: number,
  delay = 0,
  config = {damping: 16, stiffness: 100, mass: 0.9},
) =>
  spring({
    frame: Math.max(0, frame - delay),
    fps,
    config,
    durationInFrames: Math.round(fps * 0.8),
  });
