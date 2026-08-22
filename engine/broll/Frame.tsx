import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {DISPLAY, TEXT} from './fonts';

/**
 * THE THING THAT MAKES THIRTEEN SHOTS ONE FILM.
 *
 * A reel cut from thirteen composites, each correct on its own, still plays as
 * thirteen slides. What was missing was not a better shot — it was everything
 * that DOES NOT CUT: a border that never moves, a progress bar that crosses the
 * whole running time, a shot number that counts up, and one grain field
 * running over all of it at a constant speed.
 *
 * That is why this layer lives at the top of the film rather than inside a
 * scene. Cut it with the pictures and it becomes decoration on each slide;
 * held above them, it is the thing the pictures are happening INSIDE.
 *
 * The rule for all of it: NOTHING HERE COMPETES. Hairlines, not bars. Twelve
 * pixels of type, not twenty. If a viewer notices the furniture, the furniture
 * is wrong — they should only notice that the film feels made.
 */

export const Furniture: React.FC<{
  accent: string;
  paper: string;
  index: number;
  count: number;
  progress: number;
  label?: string;
  ticker?: string;
}> = ({accent, paper, index, count, progress, label, ticker}) => {
  const {width, height} = useVideoConfig();
  const inset = width * 0.045;
  const tick = width * 0.028;
  const hair = Math.max(1, width * 0.0016);
  const dim = `${paper}44`;

  const corner = (x: number, y: number, sx: number, sy: number) => (
    <>
      <div style={{position: 'absolute', left: x, top: y, width: tick * sx, height: hair, background: dim}} />
      <div style={{position: 'absolute', left: x, top: y, width: hair, height: tick * sy, background: dim}} />
    </>
  );

  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {/* Four corner ticks instead of a box. A closed rectangle reads as a
          border round a picture; open corners read as a viewfinder. */}
      {corner(inset, inset, 1, 1)}
      {corner(width - inset - tick, inset, 1, 1)}
      {corner(inset, height - inset - tick, 1, 1)}
      {corner(width - inset - tick, height - inset - tick, 1, 1)}

      {label ? (
        <div
          style={{
            position: 'absolute',
            left: inset + tick * 0.6,
            top: inset - width * 0.004,
            fontFamily: TEXT,
            fontWeight: 700,
            fontSize: width * 0.019,
            letterSpacing: '0.26em',
            color: dim,
            textTransform: 'uppercase',
          }}
        >
          {label}
        </div>
      ) : null}

      {/* The shot number. It is how a viewer knows, without being told, that
          this is one of a set and roughly where they are in it. */}
      <div
        style={{
          position: 'absolute',
          // Clear of the corner tick: overlapping it, the shot number lost a
          // digit into a hairline and read as a rendering fault.
          right: inset + tick * 1.5,
          top: inset - width * 0.004,
          fontFamily: TEXT,
          fontWeight: 700,
          fontSize: width * 0.019,
          letterSpacing: '0.18em',
          color: dim,
        }}
      >
        {`${String(index + 1).padStart(2, '0')} / ${String(count).padStart(2, '0')}`}
      </div>

      {/* ONE BAR ACROSS THE WHOLE RUNNING TIME. It is the only element that
          knows the film is finite, and it is the difference between "another
          shot" and "we are nearly there". */}
      <div
        style={{
          position: 'absolute',
          left: inset,
          right: inset,
          bottom: inset,
          height: hair,
          background: `${paper}22`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: inset,
          bottom: inset,
          width: (width - inset * 2) * progress,
          height: hair * 2,
          background: accent,
        }}
      />

      {ticker ? (
        <div
          style={{
            position: 'absolute',
            left: inset + tick * 0.6,
            bottom: inset + width * 0.016,
            fontFamily: TEXT,
            fontWeight: 700,
            fontSize: width * 0.019,
            letterSpacing: '0.22em',
            color: dim,
            textTransform: 'uppercase',
          }}
        >
          {ticker}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

/**
 * THE FILM TREATMENT, IN ONE PLACE.
 *
 * Grain, a vignette and a cold-shadow grade. Small amounts of all three, and
 * the reason they matter is subtraction rather than addition: a flat digital
 * frame has no floor and no edge, so every element in it floats at the same
 * distance. Grain gives the frame a surface for things to sit on.
 *
 * The grain SEED CHANGES EVERY FRAME. A static noise field is a dirty lens,
 * not film — and it is instantly readable as a mistake once anything in the
 * shot moves under it.
 */
export const FilmLook: React.FC<{strength?: number; vignette?: number}> = ({
  strength = 0.16,
  vignette = 0.55,
}) => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 74% 62% at 50% 46%, rgba(0,0,0,0) 40%, rgba(0,0,0,${vignette}) 100%)`,
        }}
      />
      <svg width={width} height={height} style={{position: 'absolute', mixBlendMode: 'overlay', opacity: strength}}>
        <filter id="grain">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.85"
            numOctaves={2}
            seed={frame % 97}
            stitchTiles="stitch"
          />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width={width} height={height} filter="url(#grain)" />
      </svg>
    </AbsoluteFill>
  );
};

/**
 * THE CUT ITSELF.
 *
 * Thirteen hard cuts in a row is a slideshow whatever is inside them. Each
 * shot arrives with a short push from a direction that alternates, and an
 * accent bar crosses the frame on the cut — six frames, gone before it can be
 * looked at, but the rhythm it leaves is the difference between "next slide"
 * and "next shot".
 */
export const Enter: React.FC<{index: number; children: React.ReactNode}> = ({index, children}) => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const t = interpolate(frame, [0, 14], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const eased = 1 - (1 - t) ** 3;
  const dir = index % 2 === 0 ? 1 : -1;

  return (
    <AbsoluteFill>
      <AbsoluteFill
        style={{
          transform: `translateX(${(1 - eased) * width * 0.045 * dir}px)`,
          opacity: interpolate(frame, [0, 7], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}),
        }}
      >
        {children}
      </AbsoluteFill>
      {/* The sweep. Off the frame by frame 10. */}
      <AbsoluteFill
        style={{
          background: 'rgba(0,0,0,0.9)',
          transform: `translateX(${interpolate(frame, [0, 10], [0, dir * width], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          })}px)`,
          opacity: frame < 10 ? 1 : 0,
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          width: width * 0.012,
          background: 'currentColor',
          left: interpolate(frame, [0, 12], [dir > 0 ? -width * 0.02 : width, dir > 0 ? width : -width * 0.02], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          }),
          opacity: frame < 12 ? 0.9 : 0,
        }}
      />
      <AbsoluteFill style={{height}} />
    </AbsoluteFill>
  );
};
