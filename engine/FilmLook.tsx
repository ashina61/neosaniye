import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import type {FilmLayers, Grade} from './schema';
import {DEFAULT_FILM, DEFAULT_GRADE} from './schema';
import {posterizeTime} from './motion';

/**
 * THE FILM LOOK — written once, wrapped around every scene of every episode.
 *
 * Layer order is fixed and deliberate, top to bottom:
 *
 *   scan lines → grain (multiply) → grunge (colour-burn) → vignette
 *
 * with the grade and the gate weave applied to the picture underneath. Every
 * layer can be switched off from the config, and every strength is a number,
 * because an episode about a courtroom and one about a coastline should not be
 * forced through identical texture.
 *
 * The textures are DRAWN, not loaded. A render that depends on a texture file
 * can fail halfway through a CI job for a reason that has nothing to do with
 * the episode; noise is one of the few things a machine makes perfectly.
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
    film?: Partial<FilmLayers>;
    posterizeFps?: number;
    /** Behind everything, so a scene never shows through to white. */
    backdrop?: string;
  }>
> = ({children, grade = DEFAULT_GRADE, film, posterizeFps = 12, backdrop = '#0b0906'}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const on: FilmLayers = {...DEFAULT_FILM, ...film};

  // GATE WEAVE — the frame jitters like film sliding through a gate. Stepped at
  // the posterize rate so it stutters with the picture, and the whole frame is
  // scaled up a hair so the jitter can never reveal an edge.
  const stepped = posterizeTime(frame, fps, posterizeFps);
  const travel = on.weavePx ?? 5;
  const weaveX = on.gateWeave ? Math.sin(stepped * 0.43) * travel : 0;
  const weaveY = on.gateWeave ? Math.cos(stepped * 0.37) * travel * 0.8 : 0;
  const grainX = ((stepped * 17) % 61) - 30;
  const grainY = ((stepped * 29) % 47) - 23;

  return (
    <AbsoluteFill style={{backgroundColor: backdrop, overflow: 'hidden'}}>
      <AbsoluteFill
        style={{
          transform: `translate3d(${weaveX}px, ${weaveY}px, 0) scale(${on.gateWeave ? on.weaveScale ?? 1.012 : 1})`,
          filter: gradeFilter(grade),
        }}
      >
        {children}
      </AbsoluteFill>

      {on.scanlines ? (
        <AbsoluteFill
          style={{
            pointerEvents: 'none',
            filter: 'blur(0.7px)',
            backgroundImage: `repeating-linear-gradient(90deg, rgba(0,0,0,${on.scanlineOpacity ?? 0.16}) 0 1.6px, rgba(0,0,0,0) 1.6px ${on.scanlinePeriod ?? 8}px)`,
          }}
        />
      ) : null}

      {on.grain ? (
        <AbsoluteFill
          style={{
            pointerEvents: 'none',
            inset: -60,
            opacity: on.grainOpacity ?? 0.55,
            mixBlendMode: 'multiply',
            filter: 'invert(1) brightness(1.35) contrast(1.02)',
            transform: `translate(${grainX}px, ${grainY}px)`,
            backgroundImage: GRAIN,
            backgroundSize: '180px 180px',
          }}
        />
      ) : null}

      {on.grunge ? (
        <AbsoluteFill
          style={{
            pointerEvents: 'none',
            opacity: on.grungeOpacity ?? 0.16,
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
            background: `radial-gradient(ellipse 92% 82% at 50% 48%, rgba(0,0,0,0) 0%, rgba(0,0,0,0) 55%, rgba(0,0,0,${on.vignetteStrength ?? 0.5}) 100%)`,
          }}
        />
      ) : null}
    </AbsoluteFill>
  );
};
