import React from 'react';
import {AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import type {Beat} from '../schema';
import {CLAMP, blurBurst, drift, posterizeTime} from '../engine/motion';
import {Plate, pickAsset} from '../engine/Plate';
import {GoldFrame, Plaque} from '../engine/props';
import {useLook} from '../engine/look';
import {GalleryWall, Stage} from '../engine/stage';
import {GeneratedSet} from '../engine/GeneratedSet';
import {Motif} from '../engine/motifs';
import {Atmosphere} from '../engine/atmosphere';

/**
 * PORTAL ZOOM — the opener.
 *
 * A framed photograph hangs on a wall and the camera flies straight *through*
 * the frame into the picture, which blooms from black-and-white into colour as
 * it lands.
 *
 * The whole trick is weld, then detach:
 *
 *   WELD    up to `detachFrame`, the photo and the frame zoom as one locked
 *           unit — content scale is rigidly `weldRatio` × the wall scale. The
 *           instant they move at different rates, the eye reads two flat layers
 *           sliding instead of one window it is flying through.
 *   DETACH  after that frame the gold frame (the nearer layer) keeps
 *           accelerating out past the edges while the photo settles to 1.0 and
 *           cross-fades to colour.
 *
 * A full-frame motion-blur burst peaks at the fastest point to sell the speed.
 */
export const PortalZoom: React.FC<{beat: Beat}> = ({beat}) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const {motion, palette} = useLook();
  const stepped = posterizeTime(frame, fps, 12);

  const pushEnd = beat.props.pushEndFrame ?? 46;
  const throughEnd = beat.props.throughEndFrame ?? 76;
  const detach = beat.props.detachFrame ?? 62;
  const wallEnd = beat.props.wallScaleEnd ?? motion.portalScale;
  const weld = beat.props.weldRatio ?? 0.369;

  const plate = pickAsset(beat.assets, 'plate');
  const character = pickAsset(beat.assets, 'character');
  const texture = pickAsset(beat.assets, 'texture');

  // The wall: a slow push, then acceleration into the frame.
  const wallScale =
    stepped <= pushEnd
      ? interpolate(stepped, [0, pushEnd], [1, 1.16], {...CLAMP, easing: Easing.inOut(Easing.quad)})
      : interpolate(stepped, [pushEnd, throughEnd], [1.16, wallEnd], {
          ...CLAMP,
          easing: Easing.in(Easing.cubic),
        });

  // Welded until the detach, then the photo eases to its own settled scale.
  const contentScale =
    stepped <= detach
      ? wallScale * weld
      : interpolate(stepped, [detach, throughEnd - 4], [wallScale * weld, 1], {
          ...CLAMP,
          easing: Easing.out(Easing.cubic),
        });

  // The frame keeps accelerating out past the edges after the detach.
  const frameScale =
    stepped <= detach
      ? wallScale * weld
      : interpolate(stepped, [detach, throughEnd], [wallScale * weld, wallEnd * weld * 2.6], {
          ...CLAMP,
          easing: Easing.in(Easing.cubic),
        });
  const frameOpacity = interpolate(stepped, [detach, throughEnd - 6], [1, 0], CLAMP);

  const colour = interpolate(stepped, [detach, throughEnd], [1, 0], CLAMP);
  const burst = blurBurst(stepped, [pushEnd + 8, detach - 1, throughEnd - 4], 9);
  const wallBlur = interpolate(stepped, [pushEnd + 6, throughEnd - 4], [0, 8], CLAMP);
  const wallOpacity = interpolate(stepped, [pushEnd + 6, throughEnd - 6], [1, 0], CLAMP);

  // Parallax behind the subject: two layers, the second at 0.6× the speed.
  const cloud1 = drift(stepped, motion.polarity * -525, beat.durationInFrames);
  const cloud2 = cloud1 * 0.6;

  const frameW = Math.round(width * 0.62);
  const frameH = Math.round(frameW * 1.24);

  return (
    <AbsoluteFill style={{backgroundColor: palette.ink, filter: burst > 0.05 ? `blur(${burst}px)` : undefined}}>
      {/* the museum wall the picture hangs on — drawn, then a found texture
          laid over it when the media layer has one */}
      <AbsoluteFill
        style={{
          opacity: wallOpacity,
          transform: `scale(${wallScale})`,
          filter: wallBlur > 0 ? `blur(${wallBlur}px)` : undefined,
        }}
      >
        <GalleryWall seed={beat.id} />
        {texture ? <Plate asset={texture} scale={1} opacity={0.55} style={{mixBlendMode: 'overlay'}} /> : null}
      </AbsoluteFill>

      {/* the photograph inside the frame — welded, then detached */}
      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
        <div
          style={{
            position: 'relative',
            width: frameW,
            height: frameH,
            transform: `scale(${contentScale / weld})`,
          }}
        >
          <AbsoluteFill style={{overflow: 'hidden'}}>
            {/* inside the frame: the sky the subject stands against */}
            <AbsoluteFill style={{background: `linear-gradient(180deg, ${palette.cool}55 0%, ${palette.paperDark}66 58%, ${palette.ink} 100%)`}} />
            <div style={{position: 'absolute', inset: 0, transform: `translateX(${cloud2}px)`, opacity: 0.5}}>
              {texture ? <Plate asset={texture} scale={1.3} /> : null}
            </div>
            <div style={{position: 'absolute', inset: 0, transform: `translateX(${cloud1}px)`}}>
              {plate ? (
                <Plate asset={plate} scale={1.08} desaturate={colour} />
              ) : (
                // No photograph found: the frame still has to hold a PICTURE,
                // not more wall, or the fly-through lands on nothing.
                <AbsoluteFill style={{filter: `grayscale(${colour})`}}>
                  {beat.props.setPlan ? <GeneratedSet plan={beat.props.setPlan} seed={`${beat.id}-in`} /> : <Stage id={beat.props.set} seed={`${beat.id}-in`} />}
                  {beat.props.motif ? (
                    <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
                      <Motif id={beat.props.motif} size={Math.round(frameW * 0.62)} seed={beat.id} />
                    </AbsoluteFill>
                  ) : null}
                </AbsoluteFill>
              )}
            </div>
            {character ? (
              <Plate
                asset={character}
                scale={0.92}
                translateY={height * 0.06}
                desaturate={colour}
                cutout
                boilPhase={40}
              />
            ) : null}
          </AbsoluteFill>
        </div>
      </AbsoluteFill>

      {/* the gold frame — the nearer layer, welded then flung out */}
      <AbsoluteFill
        style={{
          alignItems: 'center',
          justifyContent: 'center',
          opacity: frameOpacity,
          transform: `scale(${frameScale / weld})`,
        }}
      >
        <GoldFrame width={frameW} height={frameH} />
      </AbsoluteFill>

      <Atmosphere id={beat.props.atmosphere ?? 'none'} seed={beat.id} intensity={0.8} />

      {/* the plaque reads the date, then leaves with the wall */}
      {beat.props.slotWord ? (
        <AbsoluteFill
          style={{
            alignItems: 'center',
            justifyContent: 'flex-end',
            paddingBottom: 460,
            opacity: wallOpacity,
            filter: wallBlur > 0 ? `blur(${wallBlur}px)` : undefined,
            transform: `scale(${wallScale})`,
          }}
        >
          <Plaque text={beat.props.slotWord} />
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  );
};
