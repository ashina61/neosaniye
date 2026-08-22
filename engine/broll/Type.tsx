import React from 'react';
import {AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig} from 'remotion';
import {DISPLAY, TEXT} from './fonts';

/**
 * THE CAPTION, WITH A HIERARCHY AND A PLACE TO STAND.
 *
 * The version this replaces did one thing thirteen times: a black slab in the
 * middle of the frame, wiped in from the left. It was legible and it was
 * lifeless, and both for the same reason — every shot got the same treatment,
 * so the type never told you which shot mattered.
 *
 * Three things fix that, and none of them is a new font:
 *
 *   HIERARCHY. A kicker at nineteen pixels over a headline at ninety is a
 *   design; two lines at the same weight is a label. The rule under the kicker
 *   costs one div and does more than any effect in this file.
 *
 *   PLACE. `shape` moves the whole block — bottom-left, top-left, centre, a
 *   full-width band. Six shots in a row centred is not composition, it is a
 *   default, and a viewer feels it as monotony long before they can name it.
 *
 *   ARRIVAL BY WORD. The headline lands a word at a time on a spring. A block
 *   that fades in as one piece is a slide; words that arrive are read.
 *
 * And the ground under the words is a SCRIM, not a slab: a gradient the
 * picture continues through. The slab is still available for the one shot that
 * wants to shout, which is exactly when a slab works and never otherwise.
 */

export type Shape = 'lower-left' | 'upper-left' | 'centre' | 'banner' | 'lower-right';

export type TextBlock = {
  big?: string;
  /** The kicker: small, tracked, over a rule, above the headline. */
  small?: string;
  /** A quieter line under the headline, for a source or a date. */
  deck?: string;
  at?: number;
  x?: number;
  y?: number;
  shape?: Shape;
  /** True brings back the solid slab. Default is the scrim. */
  plate?: boolean;
  /** Type size as a fraction of frame width. */
  size?: number;
};

const PLACE: Record<Shape, {x: number; y: number; align: 'left' | 'center' | 'right'; width: number}> = {
  'lower-left': {x: 0.07, y: 0.8, align: 'left', width: 0.8},
  'upper-left': {x: 0.07, y: 0.12, align: 'left', width: 0.78},
  centre: {x: 0.5, y: 0.46, align: 'center', width: 0.84},
  banner: {x: 0.5, y: 0.5, align: 'center', width: 0.92},
  'lower-right': {x: 0.93, y: 0.8, align: 'right', width: 0.72},
};

export const Caption: React.FC<{
  text: TextBlock;
  accent: string;
  ink: string;
  paper: string;
  length: number;
}> = ({text, accent, ink, paper, length}) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();

  const shape = text.shape ?? 'lower-left';
  const place = PLACE[shape];
  const align = place.align;
  const at = Math.round((text.at ?? 0.28) * length);
  const slab = text.plate === true;

  const lines = (text.big ?? '').split('\n');
  let wordIndex = 0;

  const intro = interpolate(frame, [at, at + 10], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  if (frame < at) return null;

  const size = width * (text.size ?? (shape === 'banner' ? 0.105 : 0.086));
  const left = (text.x ?? place.x) * width;
  const top = (text.y ?? place.y) * height;
  const translate = align === 'left' ? '0, -50%' : align === 'right' ? '-100%, -50%' : '-50%, -50%';

  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {/* THE SCRIM. It is the reason the words are readable over anything the
          generator returns, and unlike a slab it does not cut a hole in the
          picture — the photograph keeps going underneath it. */}
      {!slab ? (
        <AbsoluteFill
          style={{
            background:
              shape === 'upper-left'
                ? `linear-gradient(to bottom, ${ink}D9 0%, ${ink}A6 22%, transparent 46%)`
                : shape === 'centre' || shape === 'banner'
                  ? `radial-gradient(ellipse 80% 44% at 50% ${(text.y ?? place.y) * 100}%, ${ink}CC 0%, transparent 72%)`
                  : `linear-gradient(to top, ${ink}E6 0%, ${ink}A6 26%, transparent 54%)`,
            opacity: intro,
          }}
        />
      ) : null}

      <div
        style={{
          position: 'absolute',
          left,
          top,
          width: place.width * width,
          transform: `translate(${translate})`,
          textAlign: align,
        }}
      >
        {text.small ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: width * 0.018,
              justifyContent: align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center',
              marginBottom: height * 0.012,
              opacity: intro,
            }}
          >
            {align !== 'right' ? (
              <div style={{width: width * 0.05 * intro, height: Math.max(2, width * 0.004), background: accent}} />
            ) : null}
            <div
              style={{
                fontFamily: TEXT,
                fontWeight: 800,
                fontSize: width * 0.026,
                letterSpacing: '0.2em',
                color: accent,
                textTransform: 'uppercase',
                whiteSpace: 'nowrap',
              }}
            >
              {text.small}
            </div>
            {align === 'right' ? (
              <div style={{width: width * 0.05 * intro, height: Math.max(2, width * 0.004), background: accent}} />
            ) : null}
          </div>
        ) : null}

        {lines.map((line, li) => (
          <div
            key={li}
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: `0 ${size * 0.26}px`,
              justifyContent: align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center',
              lineHeight: 0.98,
            }}
          >
            {line.split(/\s+/).filter(Boolean).map((word) => {
              /**
               * ONE SPRING PER WORD, staggered. The stagger is small — three
               * frames — because a headline that arrives slowly reads as an
               * animation and a headline that arrives fast reads as speech.
               */
              const rise = spring({
                frame: frame - at - wordIndex * 3,
                fps,
                config: {damping: 200, stiffness: 130, mass: 0.7},
              });
              wordIndex += 1;
              return (
                <span
                  key={`${li}-${wordIndex}`}
                  style={{
                    display: 'inline-block',
                    overflow: 'hidden',
                    verticalAlign: 'bottom',
                  }}
                >
                  <span
                    style={{
                      display: 'inline-block',
                      transform: `translateY(${(1 - rise) * size * 0.9}px)`,
                      opacity: rise,
                      fontFamily: DISPLAY,
                      fontWeight: 900,
                      fontSize: size,
                      letterSpacing: '-0.025em',
                      color: slab ? paper : paper,
                      background: slab ? ink : undefined,
                      padding: slab ? `${size * 0.06}px ${size * 0.14}px` : undefined,
                      boxShadow: slab ? `${width * 0.007}px ${height * 0.005}px 0 ${accent}` : undefined,
                      textShadow: slab ? undefined : `0 ${height * 0.004}px ${height * 0.014}px ${ink}CC`,
                    }}
                  >
                    {word}
                  </span>
                </span>
              );
            })}
          </div>
        ))}

        {text.deck ? (
          <div
            style={{
              marginTop: height * 0.012,
              fontFamily: TEXT,
              fontWeight: 600,
              fontSize: width * 0.032,
              letterSpacing: '0.02em',
              color: `${paper}B3`,
              opacity: interpolate(frame, [at + 12, at + 24], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              }),
            }}
          >
            {text.deck}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};
