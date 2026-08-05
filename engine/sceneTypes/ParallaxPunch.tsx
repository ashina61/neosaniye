import React from 'react';
import {AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import type {SceneProps} from './types';
import {CLAMP, posterizeTime} from '../motion';
import {Plate} from '../Plate';

/**
 * PARALLAX PUNCH — fake depth from two flat layers.
 *
 * Roles:
 *   background  the wall/street behind
 *   character   the subject in front
 *
 * Two rules carry the whole illusion:
 *
 * 1. The character punches in HARDER than the background, so it peels forward
 *    off it. Equal scaling is a zoom; unequal scaling is depth.
 * 2. Both scale around the SAME point on the floor — the subject's feet, given
 *    as groundX/groundY in scene pixels. Anchor them to the frame centre
 *    instead and the subject slides off the ground as the shot pushes in,
 *    which is the single most common way this effect fails.
 *
 * The shadow is NOT a third asset: it is the character file again, painted
 * black, flipped down from the feet and skewed onto the ground plane. An
 * episode that ships a character therefore ships its shadow for free.
 */
export const ParallaxPunch: React.FC<SceneProps> = ({scene, assets, durationInFrames}) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const stepped = posterizeTime(frame, fps, 12);

  const num = (key: string, fallback: number): number => {
    const value = scene.params?.[key];
    return typeof value === 'number' ? value : fallback;
  };

  const groundX = num('groundX', Math.round(width * 0.52));
  const groundY = num('groundY', Math.round(height * 0.88));
  const bgScale = num('bgScale', 1.12);
  const charScale = num('charScale', 1.7);
  const charWidth = num('charWidth', Math.round(width * 0.62));
  const shadowSkew = num('shadowSkew', -53);
  const shadowOpacity = num('shadowOpacity', 0.55);
  const shadowBlur = num('shadowBlur', 7);
  const punchEnd = num('punchEndFrame', Math.round(durationInFrames * 0.72));

  const background = interpolate(stepped, [8, punchEnd + 22], [1, bgScale], {
    ...CLAMP,
    easing: Easing.out(Easing.cubic),
  });
  const character = interpolate(stepped, [0, punchEnd], [1, charScale], {
    ...CLAMP,
    easing: Easing.out(Easing.cubic),
  });

  return (
    <AbsoluteFill>
      <Plate src={assets.background} scale={background} originX={groundX} originY={groundY} alive={false} />

      {assets.character ? (
        <>
          {/* THE SHADOW IS THE CHARACTER */}
          <AbsoluteFill
            style={{
              transformOrigin: `${(groundX / width) * 100}% ${(groundY / height) * 100}%`,
              transform: `scale(${character}) scaleY(-0.55) skewX(${shadowSkew}deg)`,
              filter: `blur(${shadowBlur}px)`,
              opacity: shadowOpacity,
            }}
          >
            <Plate
              src={assets.character}
              plateWidth={charWidth}
              footX={groundX}
              footY={groundY}
              blacken
              alive={false}
            />
          </AbsoluteFill>

          <Plate
            src={assets.character}
            scale={character}
            plateWidth={charWidth}
            footX={groundX}
            footY={groundY}
            cutout
            boilPhase={70}
          />
        </>
      ) : null}
    </AbsoluteFill>
  );
};
