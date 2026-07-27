import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {boil, posterizeFrame} from './motion';

export type FilmGrade = {
  saturation?: number;
  contrast?: number;
  sepia?: number;
  brightness?: number;
};

export type FilmTreatmentProps = React.PropsWithChildren<{
  grade?: FilmGrade;
  grain?: boolean;
  grunge?: boolean;
  scanLines?: boolean;
  vignette?: boolean;
  gateWeave?: boolean;
}>;

export const FilmTreatment: React.FC<FilmTreatmentProps> = ({
  children,
  grade = {},
  grain = true,
  grunge = true,
  scanLines = true,
  vignette = true,
  gateWeave = true,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const stepped = posterizeFrame(frame, fps, 12);
  const weave = boil(stepped, 5, 0.34);
  const grainShiftX = interpolate(stepped % 11, [0, 10], [-24, 24]);
  const grainShiftY = interpolate(stepped % 7, [0, 6], [18, -18]);

  const saturation = grade.saturation ?? 0.86;
  const contrast = grade.contrast ?? 1.08;
  const sepia = grade.sepia ?? 0.16;
  const brightness = grade.brightness ?? 0.95;

  return (
    <AbsoluteFill style={{backgroundColor: '#080706', overflow: 'hidden'}}>
      <AbsoluteFill
        style={{
          transform: gateWeave
            ? `translate3d(${weave.x}px, ${weave.y}px, 0) rotate(${weave.rotate}deg) scale(1.012)`
            : undefined,
          filter: `saturate(${saturation}) contrast(${contrast}) sepia(${sepia}) brightness(${brightness})`,
        }}
      >
        {children}
      </AbsoluteFill>

      {scanLines ? (
        <AbsoluteFill
          style={{
            opacity: 0.16,
            filter: 'blur(0.7px)',
            backgroundImage:
              'repeating-linear-gradient(90deg, rgba(0,0,0,1) 0 1.6px, rgba(0,0,0,0) 1.6px 8px)',
            pointerEvents: 'none',
          }}
        />
      ) : null}

      {grain ? (
        <AbsoluteFill
          style={{
            inset: -50,
            opacity: 0.28,
            mixBlendMode: 'overlay',
            transform: `translate(${grainShiftX}px, ${grainShiftY}px)`,
            backgroundImage:
              'repeating-radial-gradient(circle at 30% 20%, rgba(255,255,255,0.36) 0 0.7px, rgba(0,0,0,0.34) 0.9px 1.5px, transparent 1.8px 4px)',
            backgroundSize: '9px 11px',
            pointerEvents: 'none',
          }}
        />
      ) : null}

      {grunge ? (
        <AbsoluteFill
          style={{
            opacity: 0.1,
            mixBlendMode: 'color-burn',
            backgroundImage:
              'repeating-linear-gradient(17deg, transparent 0 23px, rgba(70,42,22,0.3) 24px 25px, transparent 26px 48px), repeating-linear-gradient(103deg, transparent 0 61px, rgba(30,20,12,0.23) 62px 64px, transparent 65px 113px)',
            pointerEvents: 'none',
          }}
        />
      ) : null}

      {vignette ? (
        <AbsoluteFill
          style={{
            background:
              'radial-gradient(ellipse 92% 82% at 50% 48%, rgba(0,0,0,0) 0%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.50) 100%)',
            pointerEvents: 'none',
          }}
        />
      ) : null}
    </AbsoluteFill>
  );
};
