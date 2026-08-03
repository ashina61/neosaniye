import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import type {FilmLayers, Grade} from '../schema';
import {DEFAULT_FILM, DEFAULT_GRADE} from '../schema';
import {posterizeTime} from './motion';

/**
 * THE FILM LOOK — written once, wrapped around every beat.
 *
 * This is the multiplier: the grade, the grain, the scan lines and the gate
 * weave live here, so a rig only ever has to think about its own choreography.
 * Layer order matters and is fixed, top to bottom:
 *
 *   scan lines → grain (multiply) → grunge (colour-burn) → vignette
 *
 * The textures are drawn in code rather than loaded from a texture pack. Two
 * reasons: the render stays hermetic (no asset can go missing mid-run), and
 * this repo has already proven it cannot reliably *fetch* clean art — but noise
 * is one of the few things a machine makes perfectly.
 */

const NOISE_URI = (frequency: number, octaves: number) =>
  `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='${frequency}' numOctaves='${octaves}'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

const GRAIN = NOISE_URI(0.9, 2);
const GRUNGE = NOISE_URI(0.035, 4);

export const gradeFilter = (grade: Grade): string =>
  `saturate(${grade.saturate}) contrast(${grade.contrast}) sepia(${grade.sepia}) brightness(${grade.brightness})`;

export const FilmLook: React.FC<
  React.PropsWithChildren<{
    grade?: Grade;
    layers?: Partial<FilmLayers>;
    posterizeFps?: number;
    weavePx?: number;
    weaveScale?: number;
  }>
> = ({
  children,
  grade = DEFAULT_GRADE,
  layers,
  posterizeFps = 12,
  weavePx = 5,
  weaveScale = 1.012,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const on: FilmLayers = {...DEFAULT_FILM, ...layers};

  // GATE WEAVE — the whole frame jitters like film sliding through a gate.
  // Stepped at the posterize rate so the weave stutters with everything else,
  // and the frame is scaled up slightly so the jitter never reveals an edge.
  const stepped = posterizeTime(frame, fps, posterizeFps);
  const weaveX = on.weave ? Math.sin(stepped * 0.43) * weavePx : 0;
  const weaveY = on.weave ? Math.cos(stepped * 0.37) * weavePx * 0.8 : 0;
  const grainX = ((stepped * 17) % 61) - 30;
  const grainY = ((stepped * 29) % 47) - 23;

  return (
    <AbsoluteFill style={{backgroundColor: '#0b0906', overflow: 'hidden'}}>
      <AbsoluteFill
        style={{
          transform: `translate3d(${weaveX}px, ${weaveY}px, 0) scale(${on.weave ? weaveScale : 1})`,
          filter: gradeFilter(grade),
        }}
      >
        {children}
      </AbsoluteFill>

      {/* Scan lines: a 1.6px line at 16% every 8px, softened just off-sharp. */}
      {on.scanlines ? (
        <AbsoluteFill
          style={{
            pointerEvents: 'none',
            filter: 'blur(0.7px)',
            backgroundImage:
              'repeating-linear-gradient(90deg, rgba(0,0,0,0.16) 0 1.6px, rgba(0,0,0,0) 1.6px 8px)',
          }}
        />
      ) : null}

      {/* Grain: multiplied, inverted and lifted so it darkens without muddying. */}
      {on.grain ? (
        <AbsoluteFill
          style={{
            pointerEvents: 'none',
            inset: -60,
            opacity: 0.55,
            mixBlendMode: 'multiply',
            filter: 'invert(1) brightness(1.35) contrast(1.02)',
            transform: `translate(${grainX}px, ${grainY}px)`,
            backgroundImage: GRAIN,
            backgroundSize: '180px 180px',
          }}
        />
      ) : null}

      {/* Grunge: big, slow blotches on colour-burn — the aged-emulsion pass. */}
      {on.grunge ? (
        <AbsoluteFill
          style={{
            pointerEvents: 'none',
            opacity: 0.16,
            mixBlendMode: 'color-burn',
            backgroundImage: GRUNGE,
            backgroundSize: '900px 1500px',
          }}
        />
      ) : null}

      {on.vignette ? (
        <AbsoluteFill
          style={{
            pointerEvents: 'none',
            background:
              'radial-gradient(ellipse 92% 82% at 50% 48%, rgba(0,0,0,0) 0%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.5) 100%)',
          }}
        />
      ) : null}
    </AbsoluteFill>
  );
};
