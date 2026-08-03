import React from 'react';
import {AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import type {Beat} from '../schema';
import {CLAMP, boil, entrance, holdKeyframes, pingpong, posterizeTime} from '../engine/motion';
import {Plate, pickAsset} from '../engine/Plate';
import {Diamond, SlotReel, Sunburst} from '../engine/props';

/**
 * VILLAIN PUNCH — the rejection beat.
 *
 * The antagonist looms on a blood-red sunburst, two props swing in from
 * opposite edges inside hand-drawn diamonds, a slot machine slams to a stop on
 * the number in the line, and the frame flickers negative on the punchline.
 *
 * The flicker is on hold-keyframes — instant, two- to three-frame bursts, no
 * fades. A fade here reads as a dissolve; the whole point is that it looks like
 * a fault in the film.
 */
export const VillainPunch: React.FC<{beat: Beat}> = ({beat}) => {
  const frame = useCurrentFrame();
  const {fps, width} = useVideoConfig();
  const stepped = posterizeTime(frame, fps, 12);

  const rise = beat.props.riseFrame ?? 8;
  const punch = beat.props.punchScale ?? 1.09;
  const slotAt = beat.props.slotFrame ?? Math.round(beat.durationInFrames * 0.45);
  const negativeAt = beat.props.negativeFrame ?? Math.round(beat.durationInFrames * 0.82);

  const character = pickAsset(beat.assets, 'character') ?? pickAsset(beat.assets, 'plate');
  const propAsset = pickAsset(beat.assets, 'prop');
  const smoke = beat.assets.find((asset) => asset.type === 'video');

  const riseSpring = entrance(stepped, fps, {delay: rise, stiffness: 46, mass: 1.05});
  const punchScale = interpolate(stepped, [rise + 12, rise + 32], [1, punch], {
    ...CLAMP,
    easing: Easing.out(Easing.cubic),
  });
  const sway = pingpong(stepped, 96, 1.4);
  const life = boil(stepped, {scale: 0.004, rotate: 0.4});

  const slotSpin = interpolate(stepped, [slotAt - 10, slotAt], [0, 1], CLAMP);

  // hold-keyframe negative bursts, then the eyes burn
  const negative = holdKeyframes(frame, [
    negativeAt, negativeAt + 3,
    negativeAt + 6, negativeAt + 8,
    negativeAt + 12, negativeAt + 15,
  ]);
  const burnEyes = frame >= negativeAt + 9;

  const diamondProgress = (delay: number) => interpolate(stepped, [delay, delay + 14], [0, 1], CLAMP);
  const leftIn = interpolate(stepped, [17, 33], [-width * 0.5, 0], {...CLAMP, easing: Easing.out(Easing.cubic)});
  const rightIn = interpolate(stepped, [47, 63], [width * 0.5, 0], {...CLAMP, easing: Easing.out(Easing.cubic)});

  return (
    <AbsoluteFill style={{filter: negative ? 'invert(1) hue-rotate(90deg)' : undefined}}>
      <Sunburst rotate={stepped * 0.12} />

      {/* the antagonist rises, punches in, then holds with a sway */}
      <AbsoluteFill
        style={{
          transform: `translateY(${(1 - riseSpring) * 340}px) scale(${punchScale * life.scale}) rotate(${sway * 0.3 + life.rotate}deg)`,
          transformOrigin: '50% 100%',
          filter: burnEyes ? 'grayscale(1) contrast(1.2)' : undefined,
        }}
      >
        <Plate asset={character} scale={1} cutout fallbackSeed={11} fallbackDark />
      </AbsoluteFill>

      {/* a plume shot on black: screen drops the black, a contrast crush kills
          the lifted grey, and a mask feathers the top so it trails off */}
      {smoke ? (
        <div
          style={{
            position: 'absolute',
            left: '14%',
            top: '4%',
            width: '38%',
            height: '34%',
            mixBlendMode: 'screen',
            filter: 'contrast(1.5) brightness(0.92)',
            WebkitMaskImage:
              'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.35) 14%, #000 34%, #000 100%)',
            maskImage: 'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.35) 14%, #000 34%, #000 100%)',
            opacity: interpolate(stepped, [rise, rise + 18], [0, 1], CLAMP),
          }}
        >
          <Plate asset={smoke} scale={1} />
        </div>
      ) : null}

      {/* the two props, from opposite edges, each inside a drawn diamond */}
      <div style={{position: 'absolute', left: 90, top: 520, transform: `translateX(${leftIn}px)`}}>
        <Diamond size={300} progress={diamondProgress(17)} wobble={pingpong(stepped, 4, 1.6)} />
      </div>
      <div style={{position: 'absolute', right: 90, top: 760, transform: `translateX(${rightIn}px)`}}>
        <Diamond size={300} progress={diamondProgress(47)} wobble={pingpong(stepped, 4, -1.6)} />
        {propAsset ? (
          <div style={{position: 'absolute', inset: 46, overflow: 'hidden', borderRadius: 8}}>
            <Plate asset={propAsset} scale={1} />
          </div>
        ) : null}
      </div>

      {/* the number in the line, slammed home on a slot reel */}
      {beat.props.slotWord ? (
        <AbsoluteFill style={{alignItems: 'center', justifyContent: 'flex-start', paddingTop: 380}}>
          <div style={{opacity: interpolate(stepped, [slotAt - 12, slotAt - 8], [0, 1], CLAMP)}}>
            <SlotReel
              word={beat.props.slotWord}
              spin={slotSpin}
              candidates={['BILLION', 'DOLLARS', 'TRILLION']}
            />
          </div>
        </AbsoluteFill>
      ) : null}

      {burnEyes ? (
        <AbsoluteFill
          style={{
            mixBlendMode: 'screen',
            background:
              'radial-gradient(circle 90px at 46% 40%, rgba(255,60,32,0.85) 0%, rgba(0,0,0,0) 70%), radial-gradient(circle 90px at 55% 40%, rgba(255,60,32,0.85) 0%, rgba(0,0,0,0) 70%)',
          }}
        />
      ) : null}
    </AbsoluteFill>
  );
};
