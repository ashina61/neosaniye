import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {CLAMP, hash01, posterizeTime} from './motion';
import {useLook} from './look';

/**
 * ATMOSPHERE — the effect a line earns.
 *
 * Grain, scan lines and a vignette are the FILM; they belong to every frame.
 * They are not effects. When every beat of every reel gets only those, the
 * work looks like one filter applied to everything — which is exactly what it
 * was.
 *
 * These are effects: rain on a line about a storm, embers on a line about
 * fire, stars on a line about orbit, dust on a line about ruins. The beat
 * sheet picks one from the line's own words, so the effect is information —
 * it tells you where you are — instead of decoration.
 *
 * All of them are deterministic (positions from a hash, motion from the frame)
 * and all of them run on the stop-motion step, so they stutter with everything
 * else rather than gliding smoothly through a juddering frame.
 */

export type AtmosphereId =
  | 'none' | 'rain' | 'snow' | 'dust' | 'embers' | 'bubbles' | 'stars'
  | 'godrays' | 'static' | 'ripples' | 'heat' | 'ash';

const alpha = (hex: string, a: number) =>
  `${hex}${Math.round(Math.max(0, Math.min(1, a)) * 255).toString(16).padStart(2, '0')}`;

/** Falling particles: rain, snow and ash differ in speed, size and drift. */
const Falling: React.FC<{
  seed: string;
  count: number;
  speed: number;
  sway: number;
  length: number;
  thickness: number;
  colour: string;
  opacity: number;
  round?: boolean;
}> = ({seed, count, speed, sway, length, thickness, colour, opacity, round = false}) => {
  const frame = useCurrentFrame();
  const {fps, height} = useVideoConfig();
  const stepped = posterizeTime(frame, fps, 12);

  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {Array.from({length: count}, (_, i) => {
        const x = hash01(seed, i * 3) * 100;
        const phase = hash01(seed, i * 7);
        const rate = speed * (0.7 + hash01(seed, i * 11) * 0.6);
        const y = ((phase + (stepped * rate) / height) % 1.15) * 115 - 8;
        const drift = Math.sin((stepped / 40) + i) * sway;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `${x + drift}%`,
              top: `${y}%`,
              width: thickness,
              height: round ? thickness : length,
              borderRadius: round ? '50%' : 2,
              background: colour,
              opacity: opacity * (0.5 + hash01(seed, i * 13) * 0.5),
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

/** Particles that rise instead of fall — embers, bubbles, motes in a beam. */
const Rising: React.FC<{seed: string; count: number; colour: string; size: number; glow: boolean}> = ({
  seed,
  count,
  colour,
  size,
  glow,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const stepped = posterizeTime(frame, fps, 12);

  return (
    <AbsoluteFill style={{pointerEvents: 'none', mixBlendMode: 'screen'}}>
      {Array.from({length: count}, (_, i) => {
        const x = hash01(seed, i * 5) * 100;
        const phase = hash01(seed, i * 9);
        const rate = 0.4 + hash01(seed, i * 3) * 0.9;
        const y = 108 - ((phase + (stepped * rate) / 260) % 1.1) * 118;
        const wobble = Math.sin(stepped / 18 + i * 1.7) * 2.2;
        const s = size * (0.55 + hash01(seed, i * 17) * 0.9);
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `${x + wobble}%`,
              top: `${y}%`,
              width: s,
              height: s,
              borderRadius: '50%',
              background: colour,
              boxShadow: glow ? `0 0 ${s * 3}px ${colour}` : undefined,
              opacity: 0.35 + hash01(seed, i * 19) * 0.55,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

export const Atmosphere: React.FC<{id: AtmosphereId; seed?: string; intensity?: number}> = ({
  id,
  seed = 'atmo',
  intensity = 1,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const {palette, motion} = useLook();
  const stepped = posterizeTime(frame, fps, 12);

  switch (id) {
    case 'rain':
      return (
        <>
          <Falling
            seed={seed}
            count={90}
            speed={26}
            sway={0.4}
            length={44}
            thickness={2}
            colour={alpha(palette.paperLight, 0.5 * intensity)}
            opacity={0.7}
          />
          <AbsoluteFill
            style={{
              pointerEvents: 'none',
              background: `linear-gradient(180deg, ${alpha(palette.cool, 0.18 * intensity)} 0%, rgba(0,0,0,0) 60%)`,
            }}
          />
        </>
      );

    case 'snow':
      return (
        <Falling
          seed={seed}
          count={70}
          speed={5}
          sway={2.6}
          length={0}
          thickness={7}
          colour={alpha(palette.white, 0.75 * intensity)}
          opacity={0.8}
          round
        />
      );

    case 'ash':
      return (
        <Falling
          seed={seed}
          count={60}
          speed={4}
          sway={3.4}
          length={0}
          thickness={6}
          colour={alpha(palette.paperDark, 0.6 * intensity)}
          opacity={0.7}
          round
        />
      );

    case 'dust':
      return <Rising seed={seed} count={46} colour={alpha(palette.paperLight, 0.5 * intensity)} size={5} glow={false} />;

    case 'embers':
      return <Rising seed={seed} count={54} colour={alpha(palette.accent, 0.85 * intensity)} size={6} glow />;

    case 'bubbles':
      return <Rising seed={seed} count={40} colour={alpha(palette.cool, 0.6 * intensity)} size={11} glow={false} />;

    case 'stars':
      return (
        <AbsoluteFill style={{pointerEvents: 'none'}}>
          {Array.from({length: 110}, (_, i) => {
            const twinkle = 0.35 + 0.65 * Math.abs(Math.sin(stepped / 30 + i));
            const s = 2 + hash01(seed, i * 7) * 4;
            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: `${hash01(seed, i * 3) * 100}%`,
                  top: `${hash01(seed, i * 11) * 78}%`,
                  width: s,
                  height: s,
                  borderRadius: '50%',
                  background: palette.white,
                  opacity: twinkle * 0.8 * intensity,
                }}
              />
            );
          })}
        </AbsoluteFill>
      );

    case 'godrays': {
      // Shafts through a window, swinging a little as the "sun" moves.
      const angle = 14 * motion.polarity + Math.sin(stepped / 90) * 2;
      return (
        <AbsoluteFill style={{pointerEvents: 'none', mixBlendMode: 'screen', opacity: 0.5 * intensity}}>
          <AbsoluteFill
            style={{
              transform: `rotate(${angle}deg) scale(1.6)`,
              background: `repeating-linear-gradient(90deg, ${alpha(palette.accent, 0.22)} 0 26px, rgba(0,0,0,0) 26px 96px)`,
              filter: 'blur(14px)',
              WebkitMaskImage: 'radial-gradient(ellipse 60% 70% at 50% 10%, #000 0%, rgba(0,0,0,0) 76%)',
              maskImage: 'radial-gradient(ellipse 60% 70% at 50% 10%, #000 0%, rgba(0,0,0,0) 76%)',
            }}
          />
        </AbsoluteFill>
      );
    }

    case 'static': {
      // Broadcast interference: a rolling band plus a hard tear, on hold
      // keyframes so it snaps rather than fades.
      const roll = (stepped * 7) % 140;
      const tear = hash01(seed, Math.floor(stepped / 6)) > 0.72;
      return (
        <AbsoluteFill style={{pointerEvents: 'none', opacity: 0.5 * intensity}}>
          <AbsoluteFill
            style={{
              background: `linear-gradient(180deg, rgba(0,0,0,0) 0%, ${alpha(palette.white, 0.16)} 50%, rgba(0,0,0,0) 100%)`,
              height: '18%',
              top: `${roll - 20}%`,
              position: 'absolute',
              left: 0,
              right: 0,
            }}
          />
          {tear ? (
            <div
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: `${hash01(seed, stepped) * 80}%`,
                height: 14,
                background: alpha(palette.white, 0.3),
                transform: `translateX(${(hash01(seed, stepped + 3) - 0.5) * 60}px)`,
              }}
            />
          ) : null}
        </AbsoluteFill>
      );
    }

    case 'ripples': {
      // Concentric rings spreading from a point — water, sonar, a shockwave.
      return (
        <AbsoluteFill style={{pointerEvents: 'none', mixBlendMode: 'screen'}}>
          {Array.from({length: 4}, (_, i) => {
            const cycle = (stepped / 90 + i * 0.25) % 1;
            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '62%',
                  width: `${cycle * 150}%`,
                  height: `${cycle * 90}%`,
                  transform: 'translate(-50%, -50%)',
                  borderRadius: '50%',
                  border: `3px solid ${alpha(palette.cool, 0.5 * intensity)}`,
                  opacity: interpolate(cycle, [0, 0.2, 1], [0, 0.8, 0], CLAMP),
                }}
              />
            );
          })}
        </AbsoluteFill>
      );
    }

    case 'heat':
      return (
        <AbsoluteFill
          style={{
            pointerEvents: 'none',
            opacity: 0.4 * intensity,
            mixBlendMode: 'screen',
            background: `repeating-linear-gradient(0deg, ${alpha(palette.accent, 0.1)} 0 3px, rgba(0,0,0,0) 3px 14px)`,
            transform: `translateY(${Math.sin(stepped / 12) * 6}px) scaleY(1.04)`,
            filter: 'blur(3px)',
          }}
        />
      );

    default:
      return null;
  }
};
