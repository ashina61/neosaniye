import React from 'react';
import {AbsoluteFill, Audio, Img, Sequence, interpolate, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';

/**
 * V2 — FULL-BLEED PICTURE, KEN BURNS, WORDS ON THE FRAME THEY ARE SPOKEN.
 *
 * The shape that actually reads on a phone. One photograph filling the frame,
 * moving slowly, with the narration burnt in a word at a time. No drawn field,
 * no props, no motif: if the picture is good the shot is good, and if it is not
 * nothing drawn on top of it will save it.
 *
 * Ported from Remotion's own prompt-to-video template WITH ITS THREE BUGS
 * FIXED, because all three ship silently:
 *
 *   1. It sized the image off the frame HEIGHT and positioned it off that same
 *      unclamped width — while Tailwind's preflight clamped `img` to 100%. The
 *      picture ended up shoved into a strip down the left of the frame with the
 *      rest white. Here the image is a `cover` background: it fills, it crops,
 *      there is nothing to clamp.
 *   2. Its intro offset was added to the audio and the captions but not to the
 *      pictures, so every image landed exactly one second before the sentence
 *      it belonged to — for the whole video. Here there is one clock and
 *      everything reads from it.
 *   3. Its entrance animations came from `Math.random()`, with the Remotion
 *      lint rule that forbids exactly that disabled three times. Same input,
 *      different video. Here the only variation is the index.
 */

export type Shot = {
  /** Episode-relative image path, e.g. "assets/seabed.jpg". */
  image: string;
  from: number;
  to: number;
};

export type Word = {
  text: string;
  from: number;
  to: number;
};

export type ReelData = {
  title?: string;
  audio?: string;
  bed?: string;
  bedGain?: number;
  shots: Shot[];
  words: Word[];
};

const FADE = 12;

/**
 * ONE PICTURE, FILLING THE FRAME, MOVING.
 *
 * The push alternates in and out by index rather than by chance: two pushes in
 * a row read as one move with a stutter in the middle, a push then a pull reads
 * as two shots. Deterministic, so the same reel builds the same way twice.
 */
const Plate: React.FC<{shot: Shot; index: number; length: number}> = ({shot, index, length}) => {
  const frame = useCurrentFrame();
  const zoomIn = index % 2 === 0;
  const scale = interpolate(frame, [0, length], zoomIn ? [1.02, 1.24] : [1.24, 1.02], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // The blur is the cut. A hard cut between two full-frame photographs on a
  // phone reads as a glitch; a short defocus reads as an edit.
  const blur = Math.max(
    interpolate(frame, [0, FADE], [16, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}),
    interpolate(frame, [length - FADE, length], [0, 16], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}),
  );
  const opacity = interpolate(frame, [0, FADE * 0.6], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

  return (
    <AbsoluteFill style={{overflow: 'hidden', opacity}}>
      {/* THE FRAME IS FILLED TWICE.
          A 9:16 frame and a landscape photograph cannot both be honoured by
          cropping: `cover` on a wide picture throws away most of it and leaves
          a texture. So the picture is shown WHOLE in front, and the same
          picture — blown up and blurred out — fills the frame behind it. The
          shot stays full-bleed and the subject survives. */}
      <Img
        src={staticFile(shot.image)}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: `scale(${scale * 1.18})`,
          filter: 'blur(38px) brightness(0.55) saturate(0.8)',
        }}
      />
      <Img
        src={staticFile(shot.image)}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          // CONTAIN, not a computed width. Bug 1 in the template it came from
          // was a picture positioned off a width a stylesheet had already
          // clamped; a picture that is told to fit cannot be pushed anywhere.
          objectFit: 'contain',
          transform: `scale(${scale})`,
          filter: blur > 0.3 ? `blur(${blur}px)` : undefined,
        }}
      />
      {/* A soft floor so white type is legible over a bright photograph, and a
          little top shade so the picture does not fight the frame edge. */}
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(rgba(0,0,0,0.34) 0%, rgba(0,0,0,0) 26%, rgba(0,0,0,0) 52%, rgba(0,0,0,0.72) 100%)',
        }}
      />
    </AbsoluteFill>
  );
};

/**
 * THE NARRATION, BURNT IN, A WORD AT A TIME.
 *
 * A short phrase with the spoken word lit inside it — not one word alone, which
 * is a meme caption, and not a whole sentence, which stops being synchronised
 * with anything. The stroke is doubled rather than a text-shadow because a
 * shadow disappears over a mid-grey photograph and a stroke does not.
 */
const Words: React.FC<{words: Word[]; accent: string}> = ({words, accent}) => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();

  const index = words.findIndex((word) => frame >= word.from && frame < word.to);
  if (index < 0) return null;

  const start = Math.max(0, index - 4);
  const phrase: Word[] = [];
  for (let i = start; i <= index; i += 1) {
    // Never carry the tail of one sentence under the head of the next.
    if (i > start && words[i].from - words[i - 1].to > 14) phrase.length = 0;
    phrase.push(words[i]);
  }

  const size = width * 0.072;
  const body = (
    <div
      style={{
        maxWidth: width * 0.86,
        textAlign: 'center',
        fontFamily: '"Archivo", "Helvetica Neue", Arial, sans-serif',
        fontWeight: 900,
        fontSize: size,
        lineHeight: 1.16,
        letterSpacing: '-0.01em',
        textTransform: 'uppercase',
      }}
    >
      {phrase.map((word, i) => (
        <span key={`${word.text}-${i}`} style={{color: word === words[index] ? accent : '#ffffff'}}>
          {word.text}
          {i < phrase.length - 1 ? ' ' : ''}
        </span>
      ))}
    </div>
  );

  /**
   * THE STROKE IS A SECOND COPY UNDERNEATH, and it has to BE underneath.
   * Both layers are absolutely positioned, so paint order is DOM order — the
   * stroked copy first, the filled copy second. Getting that backwards renders
   * the caption as a solid black slab, which is what the first pass shipped.
   */
  const layer = (style: React.CSSProperties) => (
    <AbsoluteFill style={{justifyContent: 'flex-end', alignItems: 'center', paddingBottom: height * 0.17, ...style}}>
      {body}
    </AbsoluteFill>
  );

  return (
    <AbsoluteFill>
      {layer({WebkitTextStroke: `${Math.round(size * 0.2)}px #000`})}
      {layer({})}
    </AbsoluteFill>
  );
};

export const Reel: React.FC<{data: ReelData; accent?: string}> = ({data, accent = '#ffd54a'}) => (
  <AbsoluteFill style={{backgroundColor: '#000'}}>
    {data.audio ? <Audio src={staticFile(data.audio)} /> : null}
    {data.bed ? <Audio src={staticFile(data.bed)} volume={data.bedGain ?? 0.14} loop /> : null}

    {data.shots.map((shot, index) => (
      <Sequence key={`${shot.image}-${index}`} from={shot.from} durationInFrames={Math.max(1, shot.to - shot.from)}>
        <Plate shot={shot} index={index} length={shot.to - shot.from} />
      </Sequence>
    ))}

    {/* Outside every Sequence, like the narration it was measured against. */}
    <Words words={data.words} accent={accent} />
  </AbsoluteFill>
);
