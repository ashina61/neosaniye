import React from 'react';
import {AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import type {SceneProps} from './types';
import {CLAMP, focusHunt, posterizeTime} from '../motion';
import {Plate} from '../Plate';
import {Glow} from '../draw/Glow';
import {WordStack} from '../draw/Type';
import {Annotation, type MarkKind} from '../draw/Annotation';

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
  const str = (key: string, fallback: string): string => {
    const value = scene.params?.[key];
    return typeof value === 'string' ? value : fallback;
  };
  const list = (key: string): string[] => {
    const value = scene.params?.[key];
    return Array.isArray(value) ? (value as string[]).map(String) : [];
  };

  const groundX = num('groundX', Math.round(width * 0.52));
  const groundY = num('groundY', Math.round(height * 0.88));
  const bgScale = num('bgScale', 1.12);
  const charScale = num('charScale', 1.7);
  // Height wins when both are given: a person is placed by how tall they stand.
  const charHeight = num('charHeight', 0);
  const charWidth = charHeight > 0 ? 0 : num('charWidth', Math.round(width * 0.62));
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

  // An old lens finds the subject rather than cutting to it. The drawn light is
  // told the same number, because a gradient survives a blur unchanged and
  // would otherwise sit sharp in a frame that has gone soft.
  const blur = focusHunt(stepped, durationInFrames, {maxPx: num('focusPx', 0), dipAt: 0.34, dipBack: 0.46});
  const caption = list('caption');
  const mark = str('mark', '') as MarkKind | '';

  return (
    <AbsoluteFill style={{filter: blur > 0.4 ? `blur(${blur}px)` : undefined}}>
      <Plate src={assets.background} scale={background} originX={groundX} originY={groundY} alive={false} />

      {/* Light the plate. A photographed street contains a lamp; it does not
          contain its light, and the difference is the whole shot.

          Parented to the BACKGROUND's own transform, not to the frame: the
          plate is being pushed in, so a glow pinned to scene coordinates would
          slide off the lamp it is supposed to be coming from — which reads as a
          lens flare rather than as a light source. */}
      {num('glowSize', 0) > 0 ? (
        <AbsoluteFill
          style={{
            transformOrigin: `${(groundX / width) * 100}% ${(groundY / height) * 100}%`,
            transform: `scale(${background})`,
          }}
        >
          <Glow
            x={num('glowX', Math.round(width * 0.5))}
            y={num('glowY', Math.round(height * 0.3))}
            size={num('glowSize', 0)}
            intensity={num('glowIntensity', 0.8)}
            colour={str('glowColour', '#fff6e2')}
            warm={str('glowWarm', '#ffb457')}
            defocus={blur}
          />
        </AbsoluteFill>
      ) : null}

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
              plateWidth={charWidth || undefined}
              plateHeight={charHeight || undefined}
              footX={groundX}
              footY={groundY}
              blacken
              alive={false}
            />
          </AbsoluteFill>

          <Plate
            src={assets.character}
            scale={character}
            plateWidth={charWidth || undefined}
            plateHeight={charHeight || undefined}
            footX={groundX}
            footY={groundY}
            cutout
            boilPhase={70}
          />
        </>
      ) : null}

      {caption.length ? (
        <WordStack
          lines={caption}
          x={num('captionX', 84)}
          y={num('captionY', 430)}
          from={num('captionFrame', 10)}
          every={num('captionEvery', 6)}
          size={num('captionSize', 92)}
          align={str('captionAlign', 'left') as 'left' | 'right' | 'center'}
          recedeAt={num('captionRecedeAt', 70)}
          accent={num('captionAccent', -1) >= 0 ? num('captionAccent', -1) : undefined}
        />
      ) : null}

      {mark ? (
        <Annotation
          kind={mark}
          x={num('markX', 84)}
          y={num('markY', Math.round(height * 0.42))}
          width={num('markWidth', 460)}
          height={num('markHeight', 96)}
          from={num('markFrame', 60)}
          seed={scene.id}
        />
      ) : null}
    </AbsoluteFill>
  );
};
