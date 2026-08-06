import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {CLAMP, holdKeyframes, posterizeTime, springEntrance} from '../motion';

const SERIF = '"Playfair Display", "Iowan Old Style", Georgia, serif';
const SANS = '"Archivo", "Helvetica Neue", Arial, sans-serif';

/**
 * A WORD STACK — the reference reel's real caption device.
 *
 * Not a subtitle. The line is broken into two or three fragments and they land
 * ONE AT A TIME, a few frames apart, stacked down the side of the frame. That
 * stagger is the whole difference between a caption and a cut: the eye reads
 * "closed a" / "1000" / "stores" as three beats arriving with the narration,
 * where the same words on one line would be read once and ignored.
 *
 * Then it FADES BACK rather than leaving, so the frame stays composed while the
 * picture takes over.
 */
export const WordStack: React.FC<{
  lines: string[];
  x?: number;
  y?: number;
  from?: number;
  every?: number;
  size?: number;
  align?: 'left' | 'right' | 'center';
  colour?: string;
  face?: 'serif' | 'sans';
  /** Frame at which the stack drops to `restOpacity` and lets the shot breathe. */
  recedeAt?: number;
  restOpacity?: number;
  /** Index of a line to set in the accent colour — the number, usually. */
  accent?: number;
  accentColour?: string;
}> = ({
  lines,
  x = 84,
  y = 520,
  from = 0,
  every = 6,
  size = 96,
  align = 'left',
  colour = '#f6ead0',
  face = 'serif',
  recedeAt,
  restOpacity = 0.32,
  accent,
  accentColour = '#ffcf3d',
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const stepped = posterizeTime(frame, fps, 12);

  const recede = recedeAt === undefined ? 1 : interpolate(stepped, [recedeAt, recedeAt + 14], [1, restOpacity], CLAMP);

  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <div
        style={{
          position: 'absolute',
          left: align === 'right' ? undefined : x,
          right: align === 'right' ? x : undefined,
          top: y,
          textAlign: align,
          opacity: recede,
        }}
      >
        {lines.map((line, i) => {
          const at = from + i * every;
          if (stepped < at) return <div key={i} style={{height: size * 1.02}} />;
          const land = springEntrance(stepped, fps, {delay: at, stiffness: 58, mass: 0.9, damping: 13});
          const isAccent = accent === i;
          return (
            <div
              key={i}
              style={{
                fontFamily: isAccent || face === 'sans' ? SANS : SERIF,
                fontStyle: isAccent || face === 'sans' ? 'normal' : 'italic',
                fontWeight: 900,
                fontSize: isAccent ? size * 1.18 : size,
                lineHeight: 1.02,
                color: isAccent ? accentColour : colour,
                letterSpacing: isAccent ? '-0.03em' : '-0.01em',
                textTransform: isAccent ? 'uppercase' : 'none',
                opacity: land,
                transform: `translateX(${(1 - land) * (align === 'right' ? 34 : -34)}px)`,
                WebkitTextStroke: '1.5px rgba(10,8,5,0.5)',
                textShadow: '0 0 26px rgba(0,0,0,0.95), 0 6px 20px rgba(0,0,0,0.8)',
              }}
            >
              {line}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/**
 * A TITLE SLATE — the hard typographic card that opens or closes a reel.
 *
 * Rules above and below, a date or a label in mono, the statement in heavy
 * sans. Carries a whole scene on its own, with no photograph at all.
 */
export const Slate: React.FC<{
  kicker?: string;
  title: string;
  footer?: string;
  from?: number;
  colour?: string;
  accent?: string;
  size?: number;
}> = ({kicker, title, footer, from = 0, colour = '#f6ead0', accent = '#ffcf3d', size = 118}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const stepped = posterizeTime(frame, fps, 12);
  const land = springEntrance(stepped, fps, {delay: from, stiffness: 46, mass: 1.05});
  const rule = interpolate(stepped, [from + 4, from + 20], [0, 1], CLAMP);

  return (
    <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', padding: '0 90px'}}>
      <div style={{width: '100%', textAlign: 'center', opacity: land}}>
        {kicker ? (
          <div
            style={{
              fontFamily: '"Courier New", monospace',
              fontSize: 30,
              letterSpacing: '0.26em',
              color: accent,
              marginBottom: 34,
              textTransform: 'uppercase',
            }}
          >
            {kicker}
          </div>
        ) : null}
        <div style={{height: 3, background: accent, width: `${rule * 100}%`, margin: '0 auto 40px'}} />
        <div
          style={{
            fontFamily: SANS,
            fontWeight: 900,
            fontSize: size,
            lineHeight: 0.98,
            letterSpacing: '-0.035em',
            color: colour,
            textTransform: 'uppercase',
            transform: `translateY(${(1 - land) * 22}px)`,
            textShadow: '0 0 34px rgba(0,0,0,0.9)',
          }}
        >
          {title}
        </div>
        <div style={{height: 3, background: accent, width: `${rule * 100}%`, margin: '40px auto 0'}} />
        {footer ? (
          <div
            style={{
              fontFamily: SERIF,
              fontStyle: 'italic',
              fontSize: 44,
              color: colour,
              opacity: 0.78,
              marginTop: 34,
            }}
          >
            {footer}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

/**
 * NEGATIVE FLICKER — the reel's punctuation mark.
 *
 * Two or three-frame bursts of inverted, hue-shifted frame. On hold keyframes,
 * never faded: the violence of it IS the instant switch. Used once, on the
 * hardest beat; used often, it is a strobe.
 */
export const Flicker: React.FC<{spans?: number[][]; hue?: number; children: React.ReactNode}> = ({
  spans = [],
  hue = 180,
  children,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const on = holdKeyframes(posterizeTime(frame, fps, 12), spans);
  return (
    <AbsoluteFill style={{filter: on ? `invert(1) hue-rotate(${hue}deg)` : undefined}}>{children}</AbsoluteFill>
  );
};
