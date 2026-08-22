import React from 'react';
import {AbsoluteFill, Audio, Img, Series, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {Enter, FilmLook, Furniture} from './Frame';
import {Graphic, Graphics} from './Graphics';
import {Caption, TextBlock} from './Type';
import {useFonts} from './fonts';

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
  /**
   * How much of the camera move this layer takes. 0 is the far wall, 1 is the
   * thing the lens is on. Defaults by role: the plate barely moves, the subject
   * moves, the foreground moves most — which is the whole of the depth effect
   * and costs one number.
   */
  depth?: number;
};

export type Beat = {
  slug: string;
  vo: string;
  bg: Layer | null;
  mid: Layer[];
  fore: Layer[];
  text?: TextBlock | null;
  /**
   * `from`→`to` is the push. `panX`/`panY` slide the whole room sideways over
   * the beat, in fractions of the frame — a push and a pull-back are two
   * different shots, and so are a push and a drift.
   */
  camera?: {from?: number; to?: number; panX?: number; panY?: number} | null;
  /** The point everything scales about, as a fraction of the frame. */
  anchor?: {x?: number; y?: number} | null;
  /**
   * Lines, dimensions, counts — the sentences a photograph cannot say. Nailed
   * to the frame rather than to the room; see Graphics.tsx.
   */
  graphics?: Graphic[] | null;
  /** A word in the bottom-left that says where in the story this shot sits. */
  ticker?: string | null;
  from: number;
  to: number;
};

export type BrollData = {
  background?: string;
  accent: string;
  ink: string;
  /**
   * The pale half of the palette: the caption slab's type, and the colour of
   * words drawn straight onto the picture. Set once per episode, so a reel
   * cannot end up with black type on a black sea.
   */
  paper?: string;
  /** What is behind everything when a plate is missing or does not reach. */
  ground?: string;
  /** Standing type in the top-left corner — the film's own name. */
  label?: string;
  grain?: number;
  vignette?: number;
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

  /**
   * ONE MOVE PER BEAT, AND IT HAS TO BE A MOVE.
   *
   * The first cut ran 1.00→1.05 across a four-second beat, which between any
   * two frames a viewer actually compares is about two percent — a photograph
   * with grain on it. Eased rather than linear, because a camera that starts
   * and stops at constant speed is a slide transition.
   */
  const t = interpolate(frame, [0, Math.max(1, length)], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const eased = t * t * (3 - 2 * t);
  const push = interpolate(eased, [0, 1], [beat.camera?.from ?? 1, beat.camera?.to ?? 1.14]);
  const panX = eased * (beat.camera?.panX ?? 0) * width;
  const panY = eased * (beat.camera?.panY ?? 0) * height;

  /**
   * EVERY LAYER SCALES ABOUT THE SAME POINT.
   *
   * Give each its own centre and they slide over one another instead of
   * holding together as a room. The anchor sits low by default: that is where
   * the floor is, and a push about the floor keeps the subject standing on it.
   */
  const anchor = `${(beat.anchor?.x ?? 0.5) * 100}% ${(beat.anchor?.y ?? 0.84) * 100}%`;
  const move = (depth: number): React.CSSProperties => ({
    transform: `translate(${panX * depth}px, ${panY * depth}px) scale(${1 + (push - 1) * depth})`,
    transformOrigin: anchor,
  });

  const plate = beat.bg?.file ?? data.background;
  const textPlate = beat.text?.plate !== false;
  const paper = data.paper ?? '#F4F1E8';
  const textAt = beat.text?.at ?? 0.3;
  const textIn = interpolate(frame, [length * textAt, length * textAt + 12], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{backgroundColor: data.ground ?? '#DAD9D5', overflow: 'hidden'}}>
      <AbsoluteFill style={move(beat.bg?.depth ?? 0.28)}>
        {plate ? (
          <Img src={staticFile(plate)} style={{width: '100%', height: '100%', objectFit: 'cover'}} />
        ) : null}
        {/* A soft-light wash, so every scene sits in the same light no matter
            what the generator returned — and ONLY where there is a plate to
            wash. Left running over an empty frame it lifts the ground colour
            instead: a film set in a deep navy night drafted itself mid-grey,
            and the wash was the only thing in the frame doing it. */}
        {plate ? (
          <AbsoluteFill style={{background: 'rgba(218,217,213,0.34)', mixBlendMode: 'soft-light'}} />
        ) : null}
      </AbsoluteFill>

      {beat.mid.map((layer, i) => (
        <AbsoluteFill key={`m${i}`} style={move(layer.depth ?? 0.85)}>
          <Cutout layer={layer} accent={data.accent} index={i} />
        </AbsoluteFill>
      ))}
      {beat.fore.map((layer, i) => (
        <AbsoluteFill key={`f${i}`} style={move(layer.depth ?? 1.3)}>
          <Cutout layer={{strokeX: 0.012, ...layer}} accent={data.accent} index={i} />
        </AbsoluteFill>
      ))}

      {/* Over the pictures, under the caption: a drawn line belongs to the shot,
          a caption belongs to the film. */}
      {beat.graphics?.length ? (
        <Graphics graphics={beat.graphics} accent={data.accent} paper={paper} />
      ) : null}

      {beat.text?.big ? (
        <Caption text={beat.text} accent={data.accent} ink={data.ink} paper={paper} length={length} />
      ) : null}
    </AbsoluteFill>
  );
};

export const Broll: React.FC<{data: BrollData}> = ({data}) => {
  useFonts();
  return (
  <AbsoluteFill style={{backgroundColor: data.ground ?? '#DAD9D5'}}>
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
      {data.beats.map((beat, i) => (
        <Series.Sequence key={beat.slug} durationInFrames={Math.max(1, beat.to - beat.from)}>
          <Enter index={i}>
            <Scene beat={beat} data={data} length={beat.to - beat.from} />
          </Enter>
        </Series.Sequence>
      ))}
    </Series>

    {/* ABOVE THE CUT, NOT INSIDE IT. This is the whole point of these two:
        they are what does not change when the picture does. */}
    <Shell data={data} />
  </AbsoluteFill>
  );
};

/** The furniture and the treatment, reading the film's own clock. */
const Shell: React.FC<{data: BrollData}> = ({data}) => {
  const frame = useCurrentFrame();
  const index = Math.max(
    0,
    data.beats.findIndex((b) => frame >= b.from && frame < b.to),
  );
  return (
    <>
      <FilmLook strength={data.grain ?? 0.16} vignette={data.vignette ?? 0.55} />
      <Furniture
        accent={data.accent}
        paper={data.paper ?? '#F4F1E8'}
        index={index}
        count={data.beats.length}
        progress={Math.min(1, frame / Math.max(1, data.end))}
        label={data.label}
        ticker={data.beats[index]?.ticker ?? undefined}
      />
    </>
  );
};
