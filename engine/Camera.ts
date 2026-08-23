import {Easing, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {CLAMP, pingpong, posterizeTime, shake} from './motion';

/**
 * THE VIRTUAL CAMERA.
 *
 * Every shot in this engine used to own its own idea of a camera move, and all
 * of them owned the same one: a scale interpolated from A to B. That is a
 * zoom, not a camera. A camera can also travel sideways past a subject, roll a
 * degree because somebody is holding it, breathe while nobody is touching it,
 * and take a hit when something lands — and each of those does a different job
 * for the eye.
 *
 * ONE MOVE PER SHOT, SHARED BY EVERY LAYER. That is the whole design. A layer
 * does not decide how the camera moves; it decides how much of the move it
 * takes, which is its DEPTH:
 *
 *   0   the sky. Infinitely far, so the camera moving does not change it.
 *   0.5 the building across the street. Half of everything.
 *   1   the subject at the anchor. All of it.
 *
 * Give two layers their own camera and they stop being one space. The depth
 * fraction is what makes a flat plate stack read as a room, and it costs one
 * number per layer.
 *
 * WHAT THIS RETURNS IS NUMBERS. The transform-origin — the point on the floor
 * that everything turns about — belongs to the scene, because it is a fact
 * about where the subject is standing rather than about the camera. Miss that
 * and each layer scales about its own centre and the stack slides apart, which
 * is the single most common way the effect fails.
 */
export type CameraSpec = {
  /** Scale at the start and end of the move. Both >= 1 so a fill never gaps. */
  from?: number;
  to?: number;
  /** Frame the move finishes on. Past it the shot HOLDS, which is a choice. */
  endFrame?: number;
  /** Sideways and vertical travel across the shot, in pixels at depth 1. */
  panX?: number;
  panY?: number;
  /** A degree or two of roll. More than about three reads as a broken tripod. */
  roll?: number;
  /** Handheld breath: amplitude in pixels. Zero for anything locked off. */
  handheld?: number;
  /** Frames at which the camera is struck. */
  shakeAt?: number[];
  shakeAmount?: number;
  /** Motion rate the whole move is snapped to, matching the episode's look. */
  stepFps?: number;
};

export type Camera = {
  /** The raw depth-1 scale. For anything that has to match the move exactly. */
  push: number;
  /** How far through the move we are, 0..1. For scheduling against the camera. */
  progress: number;
  scaleAt: (depth: number) => number;
  offsetAt: (depth: number) => {x: number; y: number};
  /** Roll plus any impact. The camera body, so every layer gets the same one. */
  rotate: number;
  /** The whole thing as a transform string, in the order scale-then-translate. */
  transformAt: (depth: number, extra?: {x?: number; y?: number; rotate?: number}) => string;
};

const NO_SHAKE = {x: 0, y: 0, rotate: 0};

export function useCamera(spec: CameraSpec, durationInFrames: number): Camera {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const stepped = posterizeTime(frame, fps, spec.stepFps ?? 12);

  const from = spec.from ?? 1;
  const to = spec.to ?? 1;
  const endFrame = Math.max(1, spec.endFrame ?? durationInFrames);

  const progress = interpolate(stepped, [0, endFrame], [0, 1], {
    ...CLAMP,
    easing: Easing.out(Easing.cubic),
  });
  const push = from + (to - from) * progress;

  // A PAN IS THE CAMERA MOVING, NOT THE PICTURE SLIDING. Which is why it takes
  // the same depth fraction the push does: walk past a room and the near chair
  // sweeps across the frame while the far window barely shifts. Give every
  // layer the same travel and you have not panned, you have slid a photograph.
  const panX = (spec.panX ?? 0) * progress;
  const panY = (spec.panY ?? 0) * progress;

  // The body of the camera: breath and impact. Both are the same for every
  // layer, because they are the camera and not the world.
  const breath = spec.handheld ?? 0;
  const float = breath
    ? {x: pingpong(stepped, 97, breath), y: pingpong(stepped + 31, 143, breath * 0.8)}
    : {x: 0, y: 0};
  const hit = (spec.shakeAt ?? []).reduce((worst, at) => {
    const s = shake(stepped, at, {amplitude: spec.shakeAmount ?? 16});
    return Math.abs(s.x) > Math.abs(worst.x) ? s : worst;
  }, NO_SHAKE);

  const scaleAt = (depth: number) => 1 + (push - 1) * depth;
  const offsetAt = (depth: number) => ({
    x: panX * depth + float.x + hit.x,
    y: panY * depth + float.y + hit.y,
  });
  const rotate = (spec.roll ?? 0) * progress + hit.rotate;

  return {
    push,
    progress,
    scaleAt,
    offsetAt,
    rotate,
    transformAt: (depth, extra) => {
      const o = offsetAt(depth);
      return (
        `translate(${o.x + (extra?.x ?? 0)}px, ${o.y + (extra?.y ?? 0)}px) ` +
        `scale(${scaleAt(depth)}) ` +
        `rotate(${rotate + (extra?.rotate ?? 0)}deg)`
      );
    },
  };
}

/**
 * Read a camera off a scene's params.
 *
 * Kept here rather than in the template so that every template that grows a
 * camera reads the same key names. A shot that says `panX` in one template and
 * `cameraPanX` in another is a config format with two dialects.
 */
export function cameraFromParams(
  params: Record<string, number | string | boolean | number[] | string[]> | undefined,
  durationInFrames: number,
): CameraSpec {
  const n = (key: string, fallback: number): number => {
    const value = params?.[key];
    return typeof value === 'number' ? value : fallback;
  };
  const frames = params?.shakeAt;
  return {
    from: n('pushFrom', 1),
    to: n('pushTo', 1.55),
    endFrame: n('pushEndFrame', durationInFrames),
    panX: n('panX', 0),
    panY: n('panY', 0),
    roll: n('roll', 0),
    handheld: n('handheld', 0),
    shakeAt: Array.isArray(frames) ? (frames as number[]).filter((f) => typeof f === 'number') : [],
    shakeAmount: n('shakeAmount', 16),
  };
}
