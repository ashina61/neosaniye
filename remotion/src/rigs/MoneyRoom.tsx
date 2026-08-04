import React from 'react';
import {AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import type {Beat} from '../schema';
import {CLAMP, holdKeyframes, pingpong, posterizeTime} from '../engine/motion';
import {Plate, pickAsset} from '../engine/Plate';
import {LampLight} from '../engine/props';
import {useLook} from '../engine/look';
import {Stage} from '../engine/stage';
import {GeneratedSet} from '../engine/GeneratedSet';
import {Motif} from '../engine/motifs';
import {Atmosphere} from '../engine/atmosphere';

/**
 * MONEY ROOM — the payoff.
 *
 * Flat photographic plates again, but two things sell it and neither is in the
 * photograph: the light is drawn entirely in code, and the highlight on the
 * payoff object is the same duplicate-and-recolour trick as the shadow,
 * flickered on like a fluorescent tube warming up.
 *
 * The camera hunts focus like an old lens — wide and soft, whooshing in as
 * focus clears, dipping out again, then creeping onto the money shot. The lamp
 * blooms while the lens is soft, because real defocused highlights grow.
 */
export const MoneyRoom: React.FC<{beat: Beat}> = ({beat}) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const {motion, palette} = useLook();
  const stepped = posterizeTime(frame, fps, 12);

  const plate = pickAsset(beat.assets, 'plate');
  const character = pickAsset(beat.assets, 'character');
  const prop = pickAsset(beat.assets, 'prop');

  // The lamp hangs on the video's side, so the room is lit from a different
  // corner story to story even though the rig is the same.
  const lampX = beat.props.lampX ?? Math.round(width * motion.lampSide);
  const lampY = beat.props.lampY ?? Math.round(height * 0.18);
  const dip = beat.props.focusDipFrame ?? 43;

  // vintage focus hunt: open wide and soft → clear → dip → creep in
  const camScale = interpolate(stepped, [0, 21, dip, dip + 20, beat.durationInFrames], [0.88, 1, 1.01, 1.03, 1.08], {
    ...CLAMP,
    easing: Easing.inOut(Easing.quad),
  });
  const defocus = interpolate(stepped, [0, 21, dip, dip + 20], [1, 0, 0.75, 0], CLAMP);
  const sway = pingpong(stepped, 60, 3 * motion.polarity);

  // the highlight: the payoff object again, recoloured, on hold-keyframes
  const flicker = beat.props.flickerFrames ?? [23, 29, 32, 62, 64, 72];
  const lit = holdKeyframes(frame, flicker);

  return (
    <AbsoluteFill style={{backgroundColor: palette.ink}}>
      <AbsoluteFill style={{transform: `scale(${camScale})`, filter: defocus > 0.02 ? `blur(${defocus * 9}px)` : undefined}}>
        <AbsoluteFill style={{transform: 'scale(1.04)'}}>
          {beat.props.setPlan ? <GeneratedSet plan={beat.props.setPlan} seed={beat.id} /> : <Stage id={beat.props.set ?? 'study'} seed={beat.id} />}
        </AbsoluteFill>
        {plate ? <Plate asset={plate} scale={1.04} opacity={0.85} /> : null}
        {character ? (
          <Plate asset={character} scale={0.98} translateY={height * 0.05} cutout boilPhase={20} />
        ) : beat.props.motif ? (
          <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', paddingTop: height * 0.1}}>
            <Motif id={beat.props.motif} size={Math.round(width * 0.4)} seed={beat.id} />
          </AbsoluteFill>
        ) : null}
        <Atmosphere id={beat.props.atmosphere ?? 'none'} seed={beat.id} />

        {/* the light — none of it is in the photograph */}
        <LampLight x={lampX} y={lampY} defocus={defocus} sway={sway} />

        {/* the payoff object, duplicated and recoloured, blinking on */}
        {prop ? (
          <AbsoluteFill
            style={{
              opacity: lit ? 1 : 0,
              mixBlendMode: 'screen',
              filter: 'sepia(1) saturate(5) hue-rotate(18deg)',
            }}
          >
            <Plate asset={prop} scale={0.98} translateY={height * 0.12} cutout />
          </AbsoluteFill>
        ) : (
          <AbsoluteFill
            style={{
              opacity: lit ? 0.55 : 0,
              mixBlendMode: 'screen',
              background:
                `radial-gradient(ellipse 34% 16% at 50% 74%, ${palette.accent}e6 0%, ${palette.accentDark}59 48%, rgba(0,0,0,0) 78%)`,
            }}
          />
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
