import React from 'react';
import {AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import type {Beat} from '../schema';
import {CLAMP, entrance, posterizeTime} from '../engine/motion';
import {Plate, pickAsset} from '../engine/Plate';
import {NewspaperCard} from '../engine/props';
import {useLook} from '../engine/look';
import {DeskStage} from '../engine/stage';

/**
 * PAPER DROP — the beat that carries a list.
 *
 * Several promises in one breath become several headlines on a desk. Each card
 * springs in from a different edge, staggered by roughly the gap between the
 * spoken promises, and settles with one small bounce.
 *
 * Stagger and vary the direction or it reads as a glitch: three cards arriving
 * together from the same edge cannot be separated by the eye. Different edge,
 * ~1.3s apart, soft spring — that is the "deliberate hand placing them down"
 * feel, and it is the whole effect.
 */

const ENTRIES = [
  {fromX: -900, fromY: 260, rotate: -26, restX: -70, restY: 90, rest: -7},
  {fromX: 900, fromY: -180, rotate: 22, restX: 90, restY: -30, rest: 6},
  {fromX: 0, fromY: 1200, rotate: -14, restX: 0, restY: 180, rest: -3},
];

export const PaperDrop: React.FC<{beat: Beat}> = ({beat}) => {
  const frame = useCurrentFrame();
  const {fps, width} = useVideoConfig();
  const {motion, palette} = useLook();
  const stepped = posterizeTime(frame, fps, 12);

  const desk = pickAsset(beat.assets, 'plate');
  const texts = (beat.props.cardTexts ?? []).slice(0, 3);
  const frames = beat.props.cardFrames ?? texts.map((_, index) => 20 + index * 40);

  // The shot opens with a focus hunt, like an old lens finding the desk.
  const focus = interpolate(stepped, [0, 14], [12, 0], CLAMP);
  const ken = interpolate(stepped, [0, beat.durationInFrames], [1, 1 + (beat.props.kenBurns ?? 0.09)], {
    ...CLAMP,
    easing: Easing.out(Easing.quad),
  });

  const cardWidth = Math.round(width * 0.5);

  return (
    <AbsoluteFill style={{backgroundColor: palette.ink}}>
      {/* the desk is drawn; a found photograph of one lies over it */}
      <AbsoluteFill style={{transform: `scale(${ken})`, filter: focus > 0 ? `blur(${focus}px)` : undefined}}>
        <DeskStage seed={beat.id} />
        {desk ? <Plate asset={desk} scale={1} opacity={0.72} /> : null}
      </AbsoluteFill>

      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
        {texts.map((text, index) => {
          // Same three directions, dealt in this video's order — the stack
          // builds differently without the mechanic changing.
          const entry = ENTRIES[(motion.cardOrder[index] ?? index) % ENTRIES.length];
          const at = frames[index] ?? 20 + index * 40;
          const land = entrance(stepped, fps, {delay: at, stiffness: 42, mass: 1.1, damping: 13});
          if (stepped < at) return null;

          const x = interpolate(land, [0, 1], [entry.fromX, entry.restX]);
          const y = interpolate(land, [0, 1], [entry.fromY, entry.restY]);
          const rotate = interpolate(land, [0, 1], [entry.rotate, entry.rest]);
          const scale = interpolate(land, [0, 1], [1.1, 1]);

          return (
            <div
              key={`${text}-${index}`}
              style={{
                position: 'absolute',
                transform: `translate(${x}px, ${y}px) rotate(${rotate}deg) scale(${scale})`,
                zIndex: index + 1,
              }}
            >
              <NewspaperCard headline={text} width={cardWidth} seed={index * 7} />
            </div>
          );
        })}
      </AbsoluteFill>

      {/* a tight vignette so the stack, not the desk, owns the frame */}
      <AbsoluteFill
        style={{
          pointerEvents: 'none',
          background: 'radial-gradient(ellipse 70% 58% at 50% 50%, rgba(0,0,0,0) 30%, rgba(0,0,0,0.62) 100%)',
        }}
      />
    </AbsoluteFill>
  );
};
