import React from 'react';
import {AbsoluteFill, Audio, Img, Series, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';

/**
 * THE THREE-LAYER B-ROLL ENGINE.
 *
 * One idea, applied seven times:
 *
 *   BACKGROUND   locked, continuous across every beat. The same plate under all
 *                of them is what makes seven cuts read as one film instead of
 *                seven films.
 *   MIDGROUND    the subject, dropped in as a transparent cut-out, each with an
 *                offset MARKER STROKE behind it.
 *   FOREGROUND   an element that occludes the subject's lower body and anchors
 *                the shot. This is the one people skip, and it is the one doing
 *                the most work: without it a cut-out is a sticker floating on a
 *                photograph, and every viewer can see it.
 *
 * Nothing here knows a topic. Positions arrive as FRACTIONS of the frame and
 * become pixels at render time, so the same beat file works at 1080x1920 and
 * 1920x1080 without a single number changing.
 */

export type Layer = {
  file: string;
  /** Centre, as a fraction of frame width/height. */
  x?: number;
  y?: number;
  /** Width as a fraction of the frame. Height follows the asset's own ratio. */
  width?: number;
  /** Frame the layer starts rising on, and how long the rise takes. */
  at?: number;
  rise?: number;
  /** Marker-stroke offset in fractions of frame width. 0 turns it off. */
  strokeX?: number;
  strokeY?: number;
};

export type Beat = {
  slug: string;
  vo: string;
  bg: Layer | null;
  mid: Layer[];
  fore: Layer[];
  text?: {big?: string; small?: string; at?: number; x?: number; y?: number} | null;
  camera?: {from?: number; to?: number} | null;
  from: number;
  to: number;
};

export type BrollData = {
  background?: string;
  accent: string;
  ink: string;
  audio?: string;
  music?: string;
  musicGain?: number;
  beats: Beat[];
  end: number;
};

/**
 * THE MARKER STROKE — the signature, and ten lines of CSS.
 *
 * The same artwork, painted flat in the accent colour through a mask of itself,
 * sitting a few pixels behind the real one. No second asset, no outline
 * algorithm, no per-subject work: every cut-out in the film gets the same
 * gesture, and that repetition is what a house style is.
 *
 * Offset MOSTLY SIDEWAYS. An even outline all round reads as a sticker; an
 * offset on one side reads as a marker pen someone drew round the subject and
 * did not line up perfectly, which is the whole point.
 */
const Cutout: React.FC<{layer: Layer; accent: string; index: number}> = ({layer, accent, index}) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();

  const at = layer.at ?? 0;
  const rise = spring({
    frame: frame - at,
    fps,
    config: {damping: 15, mass: 0.9},
    durationInFrames: layer.rise ?? 26,
  });
  if (rise <= 0.001) return null;

  const w = (layer.width ?? 0.42) * width;
  const left = (layer.x ?? 0.5) * width;
  const top = (layer.y ?? 0.5) * height + (1 - rise) * height * 0.14;
  const strokeX = (layer.strokeX ?? -0.016) * width;
  const strokeY = (layer.strokeY ?? 0.006) * width;

  const box: React.CSSProperties = {
    position: 'absolute',
    left,
    top,
    width: w,
    transform: 'translate(-50%, -50%)',
    opacity: rise,
  };
  const url = staticFile(layer.file);

  return (
    <>
      <div
        style={{
          ...box,
          left: left + strokeX,
          top: top + strokeY,
          height: 'auto',
          aspectRatio: 'auto',
          backgroundColor: accent,
          WebkitMaskImage: `url(${url})`,
          maskImage: `url(${url})`,
          WebkitMaskSize: '100% 100%',
          maskSize: '100% 100%',
          WebkitMaskRepeat: 'no-repeat',
          maskRepeat: 'no-repeat',
        }}
      >
        {/* The mask needs a box with the asset's own height, and the cheapest
            way to get it is an invisible copy of the asset inside it. */}
        <Img src={url} style={{width: '100%', display: 'block', visibility: 'hidden'}} />
      </div>
      <div style={box}>
        <Img
          src={url}
          style={{
            width: '100%',
            display: 'block',
            filter: `drop-shadow(0 ${height * 0.012}px ${height * 0.02}px rgba(40,28,14,0.42))`,
          }}
        />
      </div>
    </>
  );
};

const Scene: React.FC<{beat: Beat; data: BrollData; length: number}> = ({beat, data, length}) => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();

  // ONE slow move per beat, so a still composite is never actually still.
  const push = interpolate(frame, [0, length], [beat.camera?.from ?? 1, beat.camera?.to ?? 1.05], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const plate = beat.bg?.file ?? data.background;
  const textAt = beat.text?.at ?? 0.3;
  const textIn = interpolate(frame, [length * textAt, length * textAt + 12], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{backgroundColor: '#DAD9D5', overflow: 'hidden'}}>
      <AbsoluteFill style={{transform: `scale(${push})`}}>
        {plate ? (
          <Img src={staticFile(plate)} style={{width: '100%', height: '100%', objectFit: 'cover'}} />
        ) : null}
        {/* A soft-light wash, so every scene sits in the same light no matter
            what the generator returned. */}
        <AbsoluteFill style={{background: 'rgba(218,217,213,0.34)', mixBlendMode: 'soft-light'}} />

        {beat.mid.map((layer, i) => (
          <Cutout key={`m${i}`} layer={layer} accent={data.accent} index={i} />
        ))}
        {beat.fore.map((layer, i) => (
          <Cutout key={`f${i}`} layer={{strokeX: 0.012, ...layer}} accent={data.accent} index={i} />
        ))}
      </AbsoluteFill>

      {/**
       * THE TEXT SITS ON A PLATE, NOT ON THE PICTURE.
       *
       * The first cut of this had the words painted straight onto the frame:
       * dark ink for the headline, accent red for the strap. Over a bright
       * paper background it read fine, and the moment a dark cut-out rose
       * behind it the strap disappeared — accent red on a black overcoat is
       * two dark colours. A caption whose legibility depends on what the
       * generator happened to return is not a caption.
       *
       * So the words carry their own ground: an ink slab that hugs the
       * headline, an accent chip above it for the strap, and the whole thing
       * wiped in from the left rather than faded. It also fixes the overlap —
       * a plate ON TOP of a cut-out reads as a title card laid over the shot,
       * which is what it is; bare letters crossing a subject read as a mistake.
       */}
      {beat.text?.big ? (
        <div
          style={{
            position: 'absolute',
            left: (beat.text.x ?? 0.5) * width,
            top: (beat.text.y ?? 0.16) * height,
            transform: `translate(-50%, -50%) translateY(${(1 - textIn) * height * 0.02}px)`,
            width: width * 0.86,
            textAlign: 'center',
            clipPath: `inset(0 ${(1 - textIn) * 100}% 0 0)`,
          }}
        >
          {beat.text.small ? (
            <div
              style={{
                display: 'inline-block',
                backgroundColor: data.accent,
                color: '#F4F1E8',
                fontFamily: '"Archivo", Arial, sans-serif',
                fontWeight: 800,
                fontSize: width * 0.03,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                padding: `${height * 0.006}px ${width * 0.026}px`,
                marginBottom: height * 0.006,
              }}
            >
              {beat.text.small}
            </div>
          ) : null}
          <div>
            <div
              style={{
                display: 'inline-block',
                backgroundColor: data.ink,
                color: '#F4F1E8',
                fontFamily: '"Archivo Black", "Arial Black", Arial, sans-serif',
                fontWeight: 900,
                fontSize: width * 0.082,
                lineHeight: 1.08,
                letterSpacing: '-0.02em',
                padding: `${height * 0.008}px ${width * 0.03}px ${height * 0.012}px`,
                boxShadow: `${width * 0.008}px ${height * 0.006}px 0 ${data.accent}`,
              }}
            >
              {beat.text.big}
            </div>
          </div>
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

export const Broll: React.FC<{data: BrollData}> = ({data}) => (
  <AbsoluteFill style={{backgroundColor: '#DAD9D5'}}>
    {data.audio ? <Audio src={staticFile(data.audio)} /> : null}
    {data.music ? (
      <Audio
        src={staticFile(data.music)}
        volume={(f) =>
          interpolate(f, [0, 24, data.end - 50, data.end], [0, data.musicGain ?? 0.2, data.musicGain ?? 0.2, 0], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          })
        }
      />
    ) : null}

    {/* Chained, each beat for exactly its spoken window. The script is the
        timeline: nothing here decides how long a shot is, the narration does. */}
    <Series>
      {data.beats.map((beat) => (
        <Series.Sequence key={beat.slug} durationInFrames={Math.max(1, beat.to - beat.from)}>
          <Scene beat={beat} data={data} length={beat.to - beat.from} />
        </Series.Sequence>
      ))}
    </Series>
  </AbsoluteFill>
);
