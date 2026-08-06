import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import type {OnScreenTextSpec} from './schema';
import {CLAMP, posterizeTime, springEntrance} from './motion';

/**
 * ON-SCREEN TEXT.
 *
 * Timing is relative to the scene, so a scene can be moved or re-timed in the
 * config without touching a single text entry.
 *
 * The words carry their own dark halo rather than sitting in a box: a box reads
 * as burnt-in subtitles, and cream type over a bright plate disappears without
 * one. The halo survives both.
 */
const SERIF = '"Playfair Display", "Iowan Old Style", Georgia, serif';
const SANS = '"Archivo", "Helvetica Neue", Arial, sans-serif';

const positionStyle = (position: OnScreenTextSpec['position']): React.CSSProperties => {
  switch (position) {
    case 'top':
      return {alignItems: 'center', justifyContent: 'flex-start', paddingTop: 320};
    case 'bottom':
      return {alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 560};
    case 'left':
      return {alignItems: 'flex-start', justifyContent: 'center', paddingLeft: 84};
    case 'right':
      return {alignItems: 'flex-end', justifyContent: 'center', paddingRight: 84};
    default:
      return {alignItems: 'center', justifyContent: 'center'};
  }
};

const Line: React.FC<{spec: OnScreenTextSpec}> = ({spec}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const local = frame - spec.atFrame;
  const life = spec.durationInFrames ?? 60;
  if (local < 0 || local > life) return null;

  const stepped = posterizeTime(local, fps, 12);
  const pop = springEntrance(stepped, fps, {stiffness: 52, mass: 0.9});
  const opacity = interpolate(local, [0, 5, life - 8, life], [0, 1, 1, 0], CLAMP);
  const style = spec.style ?? 'serif-italic';

  const shared: React.CSSProperties = {
    opacity,
    transform: `translateY(${(1 - pop) * 26}px)`,
    maxWidth: 880,
    textAlign: 'center',
  };

  if (style === 'sticker') {
    return (
      <AbsoluteFill style={{...positionStyle(spec.position), pointerEvents: 'none'}}>
        <div style={shared}>
          <span
            style={{
              display: 'inline-block',
              background: '#ffbe2e',
              color: '#16110d',
              fontFamily: SANS,
              fontWeight: 900,
              fontSize: 74,
              letterSpacing: '-0.02em',
              padding: '10px 26px',
              borderRadius: 10,
              border: '3px solid #16110d',
              textTransform: 'uppercase',
            }}
          >
            {spec.text}
          </span>
        </div>
      </AbsoluteFill>
    );
  }

  const headline = style === 'headline';
  return (
    <AbsoluteFill style={{...positionStyle(spec.position), pointerEvents: 'none'}}>
      <div style={shared}>
        <span
          style={{
            fontFamily: headline ? SANS : SERIF,
            fontStyle: headline ? 'normal' : 'italic',
            fontWeight: headline ? 900 : 700,
            fontSize: headline ? 86 : 72,
            lineHeight: 1.08,
            color: '#f6ead0',
            WebkitTextStroke: '1.5px rgba(12,9,6,0.55)',
            textShadow: '0 0 22px rgba(0,0,0,0.95), 0 0 9px rgba(0,0,0,0.9), 0 6px 22px rgba(0,0,0,0.75)',
          }}
        >
          {spec.text}
        </span>
      </div>
    </AbsoluteFill>
  );
};

export const OnScreenText: React.FC<{specs?: OnScreenTextSpec[]}> = ({specs}) => (
  <>{(specs ?? []).map((spec, index) => <Line key={`${spec.text}-${index}`} spec={spec} />)}</>
);
