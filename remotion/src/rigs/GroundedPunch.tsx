import React from 'react';
import {AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import type {Beat} from '../schema';
import {CLAMP, blurBurst, dampedWag, posterizeTime} from '../engine/motion';
import {Plate, pickAsset} from '../engine/Plate';
import {Gesture} from '../engine/props';
import {useLook} from '../engine/look';
import {Stage} from '../engine/stage';
import {GeneratedSet} from '../engine/GeneratedSet';
import {Motif} from '../engine/motifs';
import {Atmosphere} from '../engine/atmosphere';

/**
 * GROUNDED PUNCH — the workhorse.
 *
 * Two flat plates, one camera move, and depth that isn't in either picture. The
 * character punches in harder than the wall behind them, so they peel forward
 * off it in fake 3D — and both zooms are anchored to the SAME point on the
 * floor (the feet), not the centre of the frame. Miss that shared anchor and
 * the character slides off the pavement and the illusion dies.
 *
 * The shadow is not a third asset. It is the character plate again: painted
 * pure black, flipped down from the feet, skewed onto the ground plane,
 * blurred and dropped to half opacity.
 *
 * `gesture: 'wag'` turns this same rig into the finale — a prop swings up and
 * wags "no" on a decaying pendulum. Once one reveal works, the rest are
 * reskins.
 */
export const GroundedPunch: React.FC<{beat: Beat}> = ({beat}) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const {motion, palette} = useLook();
  const stepped = posterizeTime(frame, fps, 12);

  // How hard the punch bites and which way the character clears the frame are
  // part of the video's identity, not of the mechanic. Same rig, different
  // camera — otherwise every fall beat this repo ships is the same shot.
  const groundY = beat.props.groundY ?? Math.round(height * 0.88);
  const groundX = Math.round(width * (motion.polarity > 0 ? 0.52 : 0.48));
  const platePunch = beat.props.platePunch ?? motion.pushBias;
  const characterPunch = beat.props.characterPunch ?? motion.punchBias;
  const shadowSkew = beat.props.shadowSkew ?? -53;
  const shadowOpacity = beat.props.shadowOpacity ?? 0.55;
  const shiftFrame = beat.props.shiftFrame ?? 0;
  const shiftPx = beat.props.shiftPx ?? 0;

  const plate = pickAsset(beat.assets, 'plate');
  const character = pickAsset(beat.assets, 'character') ?? plate;

  // The wall creeps; the character punches. The difference is the depth.
  const wallScale = interpolate(stepped, [8, 80], [1, platePunch], {
    ...CLAMP,
    easing: Easing.out(Easing.cubic),
  });
  const charScale = interpolate(stepped, [0, 58], [1, characterPunch], {
    ...CLAMP,
    easing: Easing.out(Easing.cubic),
  });

  // The shift clears one side of the frame for the closing line.
  const shift = shiftFrame
    ? interpolate(stepped, [shiftFrame, shiftFrame + 14], [0, motion.polarity * -Math.abs(shiftPx)], {
        ...CLAMP,
        easing: Easing.inOut(Easing.cubic),
      })
    : 0;
  const shiftBlur = shiftFrame ? blurBurst(stepped, [shiftFrame, shiftFrame + 7, shiftFrame + 14], 7) : 0;

  const wag = beat.props.gesture === 'wag';
  const gestureAt = beat.props.gestureFrame ?? 24;
  const gestureIn = interpolate(stepped, [gestureAt, gestureAt + 12], [0, 1], {
    ...CLAMP,
    easing: Easing.out(Easing.cubic),
  });
  const gestureAngle = dampedWag(stepped, {amplitude: 28, speed: 0.52, decay: 0.042, delay: gestureAt});

  return (
    <AbsoluteFill style={{backgroundColor: palette.ink}}>
      {/* The set is drawn — skyline, horizon, pavement — and the found
          photograph lies on top of it. A beat with no photograph is still a
          place, not a black rectangle. */}
      <AbsoluteFill
        style={{
          transformOrigin: `${(groundX / width) * 100}% ${(groundY / height) * 100}%`,
          transform: `scale(${wallScale})`,
        }}
      >
        {beat.props.setPlan ? <GeneratedSet plan={beat.props.setPlan} seed={beat.id} /> : <Stage id={beat.props.set} seed={beat.id} />}
      </AbsoluteFill>
      {plate ? <Plate asset={plate} scale={wallScale} originX={groundX} originY={groundY} opacity={0.9} /> : null}

      {/* THE SHADOW IS THE CHARACTER — same plate, blackened, flipped, skewed */}
      <AbsoluteFill
        style={{
          transformOrigin: `${(groundX / width) * 100}% ${(groundY / height) * 100}%`,
          transform: `translateX(${shift}px) scale(${charScale}) scaleY(-0.55) skewX(${shadowSkew}deg)`,
          filter: `brightness(0) blur(7px)`,
          opacity: shadowOpacity,
        }}
      >
        {character ? (
          <Plate asset={character} scale={1} cutout />
        ) : beat.props.motif ? (
          <AbsoluteFill style={{alignItems: 'center', justifyContent: 'flex-end', paddingBottom: `${100 - (groundY / height) * 100}%`}}>
            <Motif id={beat.props.motif} size={Math.round(width * 0.42)} seed={beat.id} rim={0} />
          </AbsoluteFill>
        ) : null}
      </AbsoluteFill>

      {/* the character, punching in harder than the wall, off the same anchor.
          With no photograph, the line's own object takes the punch instead —
          a ship, a vault, a rocket: whatever the sentence is about. */}
      {character ? (
        <Plate
          asset={character}
          scale={charScale}
          originX={groundX}
          originY={groundY}
          translateX={shift}
          blur={shiftBlur}
          cutout
          boilPhase={70}
        />
      ) : beat.props.motif ? (
        <AbsoluteFill
          style={{
            alignItems: 'center',
            justifyContent: 'flex-end',
            paddingBottom: `${100 - (groundY / height) * 100}%`,
            transformOrigin: `${(groundX / width) * 100}% ${(groundY / height) * 100}%`,
            transform: `translateX(${shift}px) scale(${charScale})`,
            filter: shiftBlur > 0 ? `blur(${shiftBlur}px)` : undefined,
          }}
        >
          <Motif id={beat.props.motif} size={Math.round(width * 0.42)} seed={beat.id} />
        </AbsoluteFill>
      ) : null}

      {/* what is in the air on this line */}
      <Atmosphere id={beat.props.atmosphere ?? 'none'} seed={beat.id} />

      {/* the gesture: a prop swings up and wags on a decaying pendulum */}
      {wag && stepped >= gestureAt ? (
        <div
          style={{
            position: 'absolute',
            right: motion.polarity > 0 ? Math.round(width * 0.16) : undefined,
            left: motion.polarity > 0 ? undefined : Math.round(width * 0.16),
            bottom: Math.round(height * 0.3),
            transformOrigin: '50% 92%',
            transform: `translate(${motion.polarity * (1 - gestureIn) * 180}px, ${(1 - gestureIn) * 220}px) scale(${interpolate(
              gestureIn,
              [0, 1],
              [0.72, 1],
            )}) rotate(${gestureAngle}deg)`,
            filter: 'drop-shadow(-10px 14px 22px rgba(0,0,0,0.55))',
          }}
        >
          <Gesture height={250} />
        </div>
      ) : null}

      {/* focus vignette tightens so the eye lands where the verdict will be */}
      <AbsoluteFill
        style={{
          pointerEvents: 'none',
          opacity: interpolate(stepped, [40, 78], [0.2, 1], CLAMP),
          background: 'radial-gradient(ellipse 66% 52% at 50% 46%, rgba(0,0,0,0) 34%, rgba(0,0,0,0.66) 100%)',
        }}
      />
    </AbsoluteFill>
  );
};
