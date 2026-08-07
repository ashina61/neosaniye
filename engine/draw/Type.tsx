import React from 'react';
import {AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {CLAMP, dampedSwing, holdKeyframes, posterizeTime, springEntrance} from '../motion';

const SERIF = '"Playfair Display", "Iowan Old Style", Georgia, serif';
const SANS = '"Archivo", "Helvetica Neue", Arial, sans-serif';

/**
 * A SIZE THAT FITS THE FRAME.
 *
 * Type set at a fixed size is fine until the word is long, and then it is
 * simply CUT OFF — "SEVENTY YEARS" rendered as "SEVENT", "100 MILLION" as
 * "100". Nothing anywhere reports it: the render succeeds, the tests pass, and
 * the reel ships with half a word on its closing card.
 *
 * The estimate is per glyph — heavy sans runs about 0.64 em — and it is
 * deliberately PESSIMISTIC. The web font may not have loaded, in which case the
 * fallback is wider; and being a little small is invisible, while being a
 * little large puts the last letter through the edge of the frame. The first
 * pass used 0.56 and "SEVENTY YEARS" came out with its final S on the border.
 */
export function fitSize(text: string, wanted: number, width: number, padding = 210): number {
  const chars = Math.max(1, text.length);
  return Math.max(28, Math.min(wanted, (width - padding) / (chars * 0.64)));
}

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
  /**
   * Fixed-width digits. Only for a title that CHANGES — a number counting up
   * shifts sideways on every frame as glyph widths change, and a title that
   * wanders while it counts reads as a bug rather than as a total.
   */
  tabular?: boolean;
  /**
   * Something to put WHERE THE TITLE GOES — a slot reel, usually.
   *
   * It has to be here rather than layered over the card, because a slate is a
   * layout: rules above and below, a kicker over, a footer under. Draw a second
   * centred thing on top of it and the number lands straight through the kicker
   * and the footer, which is exactly what the first version did.
   */
  titleNode?: React.ReactNode;
}> = ({
  kicker,
  title,
  footer,
  from = 0,
  colour = '#f6ead0',
  accent = '#ffcf3d',
  size = 118,
  tabular = false,
  titleNode,
}) => {
  const frame = useCurrentFrame();
  const {fps, width} = useVideoConfig();
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
        {titleNode ?? (
        <div
          style={{
            fontFamily: SANS,
            fontWeight: 900,
            fontSize: fitSize(title, size, width),
            lineHeight: 0.98,
            letterSpacing: '-0.035em',
            fontVariantNumeric: tabular ? 'tabular-nums' : undefined,
            color: colour,
            textTransform: 'uppercase',
            transform: `translateY(${(1 - land) * 22}px)`,
            textShadow: '0 0 34px rgba(0,0,0,0.9)',
          }}
        >
          {title}
        </div>
        )}
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
 * A SLOT REEL — the number spins past and SLAMS to a stop.
 *
 * The other way a figure can arrive, and the sharper one. A counter climbing to
 * four hundred makes the size of it felt; a reel rattling through THOUSAND,
 * MILLION, BILLION and slamming onto the right one makes the CHOICE felt — it
 * says the number could have been anything and it turned out to be this. The
 * reference build uses it on "50 MILLION" for exactly that reason.
 *
 * The whole thing is one eased scroll: the column decelerates through the
 * decoy values and comes to rest on the real one, then takes one small bounce.
 * A reel that fades to its answer is not a slot machine, it is a dissolve — the
 * stop has to be a stop.
 */
export const Slot: React.FC<{
  value: string;
  reel?: string[];
  from?: number;
  spin?: number;
  size?: number;
  colour?: string;
}> = ({
  value,
  reel = ['THOUSAND', 'HUNDRED', 'MILLION', 'BILLION'],
  from = 0,
  spin = 26,
  size = 210,
  colour = '#ffcf3d',
}) => {
  const frame = useCurrentFrame();
  const {fps, width} = useVideoConfig();
  const stepped = posterizeTime(frame, fps, 12);

  // The decoys, then the answer. Landing is just scrolling to the last row.
  const rows = [...reel.filter((r) => r !== value), value];
  // Fit the LONGEST row, not each one. A reel whose type resizes as it scrolls
  // is a reel that wobbles; and the row that decides the size is whichever
  // decoy is widest, not the answer.
  const fitted = rows.reduce((smallest, row) => Math.min(smallest, fitSize(row, size, width)), size);
  const line = fitted * 1.12;
  const travel = interpolate(stepped, [from, from + spin], [0, rows.length - 1], {
    ...CLAMP,
    easing: Easing.out(Easing.cubic),
  });
  // One bounce on the stop — the mechanism settling, not the type animating.
  const settle = stepped <= from + spin ? 0 : dampedSwing(stepped, {amplitude: fitted * 0.06, rate: 0.9, decay: 0.24, delay: from + spin});

  return (
    <div style={{height: line, overflow: 'hidden', position: 'relative'}}>
      <div style={{transform: `translateY(${-travel * line + settle}px)`}}>
        {rows.map((row, i) => (
          <div
            key={`${row}-${i}`}
            style={{
              height: line,
              lineHeight: `${line}px`,
              // A REEL ROW IS ONE LINE. The window is one line tall and clips
              // what leaves it, so "SEVENTY YEARS" wrapped at the space and the
              // second word was cut away entirely — the card read "SEVENTY".
              // Shrinking the type was only half the fix; it also must not wrap.
              whiteSpace: 'nowrap',
              fontFamily: SANS,
              fontWeight: 900,
              fontSize: fitted,
              letterSpacing: '-0.045em',
              fontVariantNumeric: 'tabular-nums',
              color: colour,
              textAlign: 'center',
              opacity: i === rows.length - 1 ? 1 : 0.5,
              textShadow: '0 0 40px rgba(0,0,0,0.92)',
            }}
          >
            {row}
          </div>
        ))}
      </div>
    </div>
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
