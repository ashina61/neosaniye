import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {useLook} from './look';
import {hash01, posterizeTime} from './motion';

/**
 * THE LENS.
 *
 * ============ WHY THE FRAMES LOOKED LIKE CLIP ART ============
 *
 * The complaint was "this looks like a nursery video, not a documentary", and
 * it was correct. The reason was not the subject matter and not the colour — it
 * was that every pixel was a flat CSS fill with a crisp edge. Real footage
 * never has a crisp edge: it has bloom around highlights, colour fringing at
 * the corners, dust on the glass, falloff, and nothing is uniformly sharp.
 *
 * Grain and scan lines (in FilmLook) say "this is film stock". They do not say
 * "this was photographed through glass". That is what this layer is for, and it
 * is the single largest visual difference between a vector poster and a frame
 * that reads as cinema.
 *
 * Everything here is cheap: no filters over the whole tree per frame, no
 * per-pixel work, just a handful of composited layers.
 */

const alpha = (hex: string, a: number) =>
  `${hex}${Math.round(Math.max(0, Math.min(1, a)) * 255).toString(16).padStart(2, '0')}`;

export const Lens: React.FC<
  React.PropsWithChildren<{
    /** How much the highlights bleed. Documentary glass: subtle. */
    bloom?: number;
    /** Corner colour fringing, in pixels of channel offset. */
    fringe?: number;
    /** Specks and hairs on the front element. */
    dust?: number;
    seed?: string;
  }>
> = ({children, bloom = 0.5, fringe = 1.6, dust = 0.5, seed = 'lens'}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const {palette} = useLook();
  const stepped = posterizeTime(frame, fps, 12);

  return (
    <AbsoluteFill>
      {/* THE SHARP IMAGE */}
      <AbsoluteFill>{children}</AbsoluteFill>

      {/* HALATION / BLOOM.
          A blurred, brightened copy of the frame screened back over itself:
          light spills off bright areas into the dark ones the way it does
          inside a real lens barrel. This is the effect that makes drawn light
          stop looking like a gradient. */}
      {bloom > 0 ? (
        <AbsoluteFill
          style={{
            mixBlendMode: 'screen',
            opacity: 0.34 * bloom,
            filter: 'blur(26px) brightness(1.25) saturate(1.1)',
            pointerEvents: 'none',
          }}
        >
          {children}
        </AbsoluteFill>
      ) : null}

      {/* CHROMATIC ABERRATION.
          Two nudged, tinted copies at the very edges only — glass focuses red
          and blue at slightly different distances, worst away from the centre.
          Masked to the corners so the middle of the frame stays clean. */}
      {fringe > 0 ? (
        <>
          <AbsoluteFill
            style={{
              mixBlendMode: 'screen',
              opacity: 0.22,
              transform: `translateX(${fringe}px)`,
              filter: 'blur(0.4px)',
              pointerEvents: 'none',
              WebkitMaskImage: 'radial-gradient(ellipse 58% 58% at 50% 50%, rgba(0,0,0,0) 40%, #000 100%)',
              maskImage: 'radial-gradient(ellipse 58% 58% at 50% 50%, rgba(0,0,0,0) 40%, #000 100%)',
              background: 'linear-gradient(0deg, rgba(255,0,40,0.28), rgba(255,0,40,0.28))',
              backgroundBlendMode: 'multiply',
            }}
          >
            {children}
          </AbsoluteFill>
          <AbsoluteFill
            style={{
              mixBlendMode: 'screen',
              opacity: 0.2,
              transform: `translateX(${-fringe}px)`,
              filter: 'blur(0.4px)',
              pointerEvents: 'none',
              WebkitMaskImage: 'radial-gradient(ellipse 58% 58% at 50% 50%, rgba(0,0,0,0) 40%, #000 100%)',
              maskImage: 'radial-gradient(ellipse 58% 58% at 50% 50%, rgba(0,0,0,0) 40%, #000 100%)',
              background: 'linear-gradient(0deg, rgba(0,90,255,0.26), rgba(0,90,255,0.26))',
              backgroundBlendMode: 'multiply',
            }}
          >
            {children}
          </AbsoluteFill>
        </>
      ) : null}

      {/* DUST AND HAIRS ON THE GLASS.
          Static across the whole shot — dust does not move with the subject,
          which is exactly why it reads as "there is a camera here". */}
      {dust > 0 ? (
        <AbsoluteFill style={{pointerEvents: 'none', opacity: 0.5 * dust, mixBlendMode: 'screen'}}>
          {Array.from({length: 16}, (_, i) => {
            const size = 2 + hash01(seed, i * 3) * 5;
            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: `${hash01(seed, i * 7) * 100}%`,
                  top: `${hash01(seed, i * 11) * 100}%`,
                  width: size,
                  height: size,
                  borderRadius: '50%',
                  background: alpha(palette.white, 0.5),
                  filter: 'blur(1.4px)',
                }}
              />
            );
          })}
          {Array.from({length: 3}, (_, i) => (
            <div
              key={`hair-${i}`}
              style={{
                position: 'absolute',
                left: `${12 + hash01(seed, i * 13) * 70}%`,
                top: `${hash01(seed, i * 17) * 80}%`,
                width: 60 + hash01(seed, i * 19) * 120,
                height: 1.5,
                background: alpha(palette.white, 0.3),
                transform: `rotate(${hash01(seed, i * 23) * 180}deg)`,
                filter: 'blur(1px)',
              }}
            />
          ))}
        </AbsoluteFill>
      ) : null}

      {/* GATE BREATH.
          Exposure never holds perfectly still on film — a fraction of a stop
          wanders. Stepped, so it flickers with the posterize rather than
          pulsing smoothly. */}
      <AbsoluteFill
        style={{
          pointerEvents: 'none',
          background: alpha(palette.ink, 0.06 + Math.abs(Math.sin(stepped * 0.21)) * 0.05),
          mixBlendMode: 'multiply',
        }}
      />
    </AbsoluteFill>
  );
};

/**
 * FOREGROUND OCCLUDERS — the cheapest cinematography there is.
 *
 * A documentary camera is almost never in clean air: it shoots past a door
 * frame, through leaves, over a shoulder, between railings. That out-of-focus
 * dark mass at the edge of frame does two things no amount of grading can — it
 * puts the camera INSIDE the space, and it gives the eye a near plane to judge
 * depth against.
 *
 * Drawn as blurred shapes in the video's ink, so they read as "something close
 * and unlit" rather than as decoration.
 */
export const Foreground: React.FC<{kind?: 'doorway' | 'leaves' | 'railing' | 'shoulder' | 'none'; seed?: string; side?: 1 | -1}> = ({
  kind = 'doorway',
  seed = 'fg',
  side = 1,
}) => {
  const {palette} = useLook();
  if (kind === 'none') return null;
  const near = alpha(palette.ink, 0.96);
  const edge = side > 0 ? {left: 0} : {right: 0};

  if (kind === 'doorway') {
    return (
      <AbsoluteFill style={{pointerEvents: 'none'}}>
        <div style={{position: 'absolute', ...edge, top: 0, bottom: 0, width: '17%', background: near, filter: 'blur(14px)'}} />
        <div style={{position: 'absolute', left: 0, right: 0, top: 0, height: '8%', background: near, filter: 'blur(16px)'}} />
      </AbsoluteFill>
    );
  }

  if (kind === 'railing') {
    return (
      <AbsoluteFill style={{pointerEvents: 'none', filter: 'blur(11px)'}}>
        {Array.from({length: 5}, (_, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `${(side > 0 ? 4 : 62) + i * 9}%`,
              top: '-6%',
              bottom: '-6%',
              width: `${2.5 + hash01(seed, i) * 2}%`,
              background: near,
            }}
          />
        ))}
        <div style={{position: 'absolute', left: 0, right: 0, bottom: '6%', height: '5%', background: near}} />
      </AbsoluteFill>
    );
  }

  if (kind === 'leaves') {
    // These hug the very edge of frame. The first version threw big soft blobs
    // into the middle third and they read as smudges on the render rather than
    // as foliage between the lens and the scene — an occluder has to occlude an
    // EDGE, or it is just dirt in the picture.
    return (
      <AbsoluteFill style={{pointerEvents: 'none', filter: 'blur(9px)'}}>
        {Array.from({length: 5}, (_, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              [side > 0 ? 'left' : 'right']: `${-8 + hash01(seed, i * 5) * 7}%`,
              top: `${-8 + hash01(seed, i * 7) * 26}%`,
              width: `${9 + hash01(seed, i * 11) * 9}%`,
              height: `${7 + hash01(seed, i * 13) * 11}%`,
              borderRadius: '60% 20% 60% 20%',
              background: near,
              transform: `rotate(${hash01(seed, i * 17) * 70 - 35}deg)`,
            }}
          />
        ))}
      </AbsoluteFill>
    );
  }

  // shoulder: a soft mass rising into one lower corner
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <div
        style={{
          position: 'absolute',
          ...edge,
          bottom: '-18%',
          width: '30%',
          height: '34%',
          borderRadius: '50% 50% 0 0',
          background: near,
          filter: 'blur(14px)',
        }}
      />
    </AbsoluteFill>
  );
};
