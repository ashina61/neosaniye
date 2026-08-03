import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import type {Caption} from '../schema';
import {CLAMP, entrance, posterizeTime} from './motion';

/**
 * THE WORDS.
 *
 * On-screen text is never written for the screen: it is *pulled out of the
 * spoken line*, verbatim, and shown at the moment that fragment is actually
 * said. The beat sheet does the pulling; this file only draws.
 *
 * Two rules the layout enforces:
 *   · one fragment at a time owns the frame — captions stack, they don't crowd;
 *   · the bottom and right of the frame stay clear of the Shorts UI.
 */

const SERIF = '"Playfair Display", "Iowan Old Style", Georgia, serif';
const SANS = '"Archivo", "Helvetica Neue", Arial, sans-serif';

const INK = '#16110d';
const CREAM = '#ffeecc';
const MARIGOLD = '#ffbe2e';

/** A yellow pencil line that scribbles on under the words. */
const Underline: React.FC<{progress: number; width: number}> = ({progress, width}) => (
  <svg width={width} height={26} viewBox={`0 0 ${width} 26`} style={{display: 'block', marginTop: 4}}>
    <path
      d={`M6 17 C ${width * 0.25} 6, ${width * 0.55} 25, ${width - 8} 12`}
      fill="none"
      stroke={MARIGOLD}
      strokeWidth={9}
      strokeLinecap="round"
      pathLength={1}
      strokeDasharray={1}
      strokeDashoffset={1 - progress}
    />
  </svg>
);

/** A hand-drawn oval that circles the one word that carries the beat. */
const Oval: React.FC<{progress: number; width: number; height: number}> = ({progress, width, height}) => (
  <svg
    width={width}
    height={height}
    viewBox={`0 0 ${width} ${height}`}
    style={{position: 'absolute', left: -18, top: -14, pointerEvents: 'none'}}
  >
    <ellipse
      cx={width / 2}
      cy={height / 2}
      rx={width / 2 - 8}
      ry={height / 2 - 6}
      fill="none"
      stroke={MARIGOLD}
      strokeWidth={7}
      strokeLinecap="round"
      transform={`rotate(-3 ${width / 2} ${height / 2})`}
      pathLength={1}
      strokeDasharray={1}
      strokeDashoffset={1 - progress}
    />
  </svg>
);

const CaptionLine: React.FC<{caption: Caption}> = ({caption}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const local = frame - caption.atFrame;
  const life = caption.durationInFrames ?? 60;
  if (local < -1 || local > life) return null;

  const stepped = posterizeTime(local, fps, 12);
  const pop = entrance(stepped, fps, {stiffness: 52, mass: 0.9});
  const opacity = interpolate(local, [0, 5, life - 8, life], [0, 1, 1, 0], CLAMP);
  const markProgress = interpolate(local, [8, 20], [0, 1], CLAMP);

  const style = caption.style ?? 'serif-italic';
  const side = caption.side ?? 'center';

  const shared: React.CSSProperties = {
    opacity,
    transform: `translateY(${(1 - pop) * 26}px)`,
    textAlign: side === 'right' ? 'right' : side === 'left' ? 'left' : 'center',
    maxWidth: 880,
  };

  const approxWidth = Math.min(880, 34 + caption.text.length * 30);

  if (style === 'sticker' || style === 'slot') {
    return (
      <div style={{...shared, position: 'relative'}}>
        <span
          style={{
            display: 'inline-block',
            background: style === 'slot' ? INK : MARIGOLD,
            color: style === 'slot' ? MARIGOLD : INK,
            fontFamily: SANS,
            fontWeight: 900,
            fontSize: style === 'slot' ? 96 : 74,
            letterSpacing: '-0.02em',
            padding: '10px 26px',
            borderRadius: 10,
            border: `3px solid ${INK}`,
            boxShadow: '0 16px 30px -16px rgba(0,0,0,0.7)',
            textTransform: 'uppercase',
          }}
        >
          {caption.text}
        </span>
      </div>
    );
  }

  const isHeadline = style === 'headline';
  return (
    <div style={{...shared, position: 'relative'}}>
      <span
        style={{
          fontFamily: isHeadline ? SANS : SERIF,
          fontStyle: isHeadline ? 'normal' : 'italic',
          fontWeight: isHeadline ? 900 : 700,
          fontSize: isHeadline ? 86 : 72,
          lineHeight: 1.08,
          color: CREAM,
          letterSpacing: isHeadline ? '-0.02em' : '-0.01em',
          // A DARK HALO, NOT A SUBTITLE BOX.
          //
          // Cream type sits over whatever the rig staged — a lit money room one
          // beat, a bright newspaper the next — and cream on cream disappears.
          // A box would read as burnt-in subtitles and fight the editorial look,
          // so the words carry their own shadow instead.
          WebkitTextStroke: '1.5px rgba(12,9,6,0.55)',
          textShadow:
            '0 0 22px rgba(0,0,0,0.95), 0 0 9px rgba(0,0,0,0.9), 0 6px 22px rgba(0,0,0,0.75), 0 2px 3px rgba(0,0,0,0.95)',
          display: 'inline-block',
          position: 'relative',
        }}
      >
        {caption.text}
        {caption.mark === 'oval' ? (
          <Oval progress={markProgress} width={approxWidth + 36} height={112} />
        ) : null}
      </span>
      {caption.mark === 'underline' ? <Underline progress={markProgress} width={approxWidth} /> : null}
    </div>
  );
};

/**
 * Captions stack down one side of the frame in the order they are spoken, so a
 * later fragment never lands on top of an earlier one.
 */
export const Captions: React.FC<{captions: Caption[]}> = ({captions}) => {
  const grouped: Record<string, Caption[]> = {left: [], right: [], center: []};
  for (const caption of captions) grouped[caption.side ?? 'center'].push(caption);

  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {(['left', 'right', 'center'] as const).map((side) => {
        if (!grouped[side].length) return null;
        return (
          <div
            key={side}
            style={{
              position: 'absolute',
              left: side === 'right' ? undefined : 84,
              right: side === 'left' ? undefined : 84,
              top: side === 'center' ? undefined : 420,
              bottom: side === 'center' ? 560 : undefined,
              display: 'flex',
              flexDirection: 'column',
              gap: 18,
              alignItems: side === 'right' ? 'flex-end' : side === 'left' ? 'flex-start' : 'center',
            }}
          >
            {grouped[side].map((caption, index) => (
              <CaptionLine key={`${caption.text}-${index}`} caption={caption} />
            ))}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
