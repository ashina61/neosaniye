import React from 'react';
import {AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import type {SceneProps} from './types';
import {CLAMP, blurBurst, posterizeTime} from '../motion';
import {Plate} from '../Plate';

/**
 * SPLIT SHIFT — the subject moves aside and the frame it clears is used.
 *
 * Roles: background, character.
 *
 * The point of the move is not the move: it is that the shot ARRIVES full and
 * then makes room. Text that fades in over a static subject is a caption; text
 * that appears in space the subject just vacated is staging.
 *
 * The motion blur peaks mid-move and clears — a hard cut to the new position
 * reads as a jump, and a slow slide with no blur reads as a slide.
 */
export const SplitShift: React.FC<SceneProps> = ({scene, assets, durationInFrames}) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const stepped = posterizeTime(frame, fps, 12);

  const num = (key: string, fallback: number): number => {
    const value = scene.params?.[key];
    return typeof value === 'number' ? value : fallback;
  };

  const shiftFrame = num('shiftFrame', Math.round(durationInFrames * 0.5));
  const shiftPx = num('shiftPx', 235);
  const shiftLength = num('shiftLength', 14);
  const groundX = num('groundX', Math.round(width * 0.52));
  const groundY = num('groundY', Math.round(height * 0.88));
  const bgScale = num('bgScale', 1.06);
  const charHeight = num('charHeight', 0);
  const charWidth = charHeight > 0 ? 0 : num('charWidth', Math.round(width * 0.6));

  const shift = interpolate(stepped, [shiftFrame, shiftFrame + shiftLength], [0, -Math.abs(shiftPx)], {
    ...CLAMP,
    easing: Easing.inOut(Easing.cubic),
  });
  const streak = blurBurst(
    stepped,
    [shiftFrame, shiftFrame + shiftLength / 2, shiftFrame + shiftLength],
    num('blurPeak', 7),
  );
  const background = interpolate(stepped, [0, durationInFrames], [1, bgScale], {
    ...CLAMP,
    easing: Easing.out(Easing.quad),
  });

  return (
    <AbsoluteFill>
      <Plate src={assets.background} scale={background} originX={groundX} originY={groundY} alive={false} />
      {assets.character ? (
        <Plate
          src={assets.character}
          translateX={shift}
          blur={streak}
          plateWidth={charWidth || undefined}
          plateHeight={charHeight || undefined}
          footX={groundX}
          footY={groundY}
          cutout
          boilPhase={40}
        />
      ) : null}
    </AbsoluteFill>
  );
};
