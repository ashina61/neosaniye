import React from 'react';
import {AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import type {SceneProps} from './types';
import {CLAMP, blurBurst, posterizeTime} from '../motion';
import {Plate} from '../Plate';
import {SceneMotif} from '../draw/Motif';

/**
 * PORTAL ZOOM REVEAL — fly INTO a framed photograph.
 *
 * Roles it reads from the config:
 *   photo   the picture we end up inside (required to see anything)
 *   frame   the frame around it, optional — the near layer that flies past us
 *   wall    what the frame hangs on, optional
 *
 * The whole illusion is WELD, then DETACH:
 *
 *   WELD    until `detachFrame`, the photo and the frame zoom as ONE locked
 *           unit — the content scale is rigidly weldRatio × the wall's scale.
 *           The moment they move at different rates, the eye reads two flat
 *           layers sliding instead of one window it is flying through.
 *   DETACH  after that frame the frame keeps accelerating out past the edges
 *           while the photo settles to 1.0 and blooms from grey into colour.
 *
 * A full-frame blur burst peaks at the fastest point, which is what sells the
 * speed — without it the move reads as a zoom rather than as travel.
 */
export const PortalZoomReveal: React.FC<SceneProps> = ({scene, assets, durationInFrames}) => {
  const frame = useCurrentFrame();
  const {fps, width} = useVideoConfig();
  const stepped = posterizeTime(frame, fps, 12);

  const num = (key: string, fallback: number): number => {
    const value = scene.params?.[key];
    return typeof value === 'number' ? value : fallback;
  };
  const str = (key: string, fallback: string): string => {
    const value = scene.params?.[key];
    return typeof value === 'string' ? value : fallback;
  };

  const pushEnd = num('pushEndFrame', Math.round(durationInFrames * 0.38));
  const detach = num('detachFrame', Math.round(durationInFrames * 0.52));
  const throughEnd = num('throughEndFrame', Math.round(durationInFrames * 0.63));
  const weld = num('weldRatio', 0.369);
  const wallEnd = num('wallScaleEnd', 6.8);

  const wallScale =
    stepped <= pushEnd
      ? interpolate(stepped, [0, pushEnd], [1, 1.16], {...CLAMP, easing: Easing.inOut(Easing.quad)})
      : interpolate(stepped, [pushEnd, throughEnd], [1.16, wallEnd], {...CLAMP, easing: Easing.in(Easing.cubic)});

  const contentScale =
    stepped <= detach
      ? wallScale * weld
      : interpolate(stepped, [detach, throughEnd - 4], [wallScale * weld, 1], {
          ...CLAMP,
          easing: Easing.out(Easing.cubic),
        });

  const frameScale =
    stepped <= detach
      ? wallScale * weld
      : interpolate(stepped, [detach, throughEnd], [wallScale * weld, wallEnd * weld * 2.6], {
          ...CLAMP,
          easing: Easing.in(Easing.cubic),
        });

  const frameOpacity = interpolate(stepped, [detach, throughEnd - 6], [1, 0], CLAMP);
  const colour = interpolate(stepped, [detach, throughEnd], [1, 0], CLAMP);
  const burst = blurBurst(stepped, [pushEnd + 8, Math.max(pushEnd + 9, detach - 1), throughEnd - 4], 9);
  const wallBlur = interpolate(stepped, [pushEnd + 6, throughEnd - 4], [0, 8], CLAMP);
  const wallOpacity = interpolate(stepped, [pushEnd + 6, throughEnd - 6], [1, 0], CLAMP);

  // The window we fly through. A portrait photo and a newspaper clipping want
  // different windows, so both are the episode's to set.
  const frameW = num('frameWidth', Math.round(width * 0.62));
  const frameH = Math.round(frameW * num('frameRatio', 1.24));

  return (
    <AbsoluteFill style={{filter: burst > 0.05 ? `blur(${burst}px)` : undefined}}>
      {assets.wall ? (
        <Plate src={assets.wall} scale={wallScale} blur={wallBlur} opacity={wallOpacity} alive={false} />
      ) : null}

      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
        <div
          style={{
            position: 'relative',
            width: frameW,
            height: frameH,
            transform: `scale(${contentScale / weld})`,
            overflow: 'hidden',
          }}
        >
          <Plate src={assets.photo} desaturate={colour} alive={false} />
        </div>
      </AbsoluteFill>

      {assets.frame ? (
        <AbsoluteFill
          style={{
            alignItems: 'center',
            justifyContent: 'center',
            opacity: frameOpacity,
            transform: `scale(${frameScale / weld})`,
          }}
        >
          <div style={{width: frameW, height: frameH, position: 'relative'}}>
            <Plate src={assets.frame} alive={false} fit="contain" />
          </div>
        </AbsoluteFill>
      ) : null}

      {/* ONLY ONCE WE ARE THROUGH. The whole first half of this shot is travel
          toward a picture; anything drawn over it during the flight competes
          with the one move the shot exists for. The motif belongs to the half
          AFTER arrival, where the photograph is otherwise just sitting there —
          which is exactly where a portrait needs gold falling past it. */}
      <SceneMotif
        params={scene.params}
        seed={scene.id}
        durationInFrames={durationInFrames}
        accent={str('accent', '#f2b53a')}
      />
    </AbsoluteFill>
  );
};
