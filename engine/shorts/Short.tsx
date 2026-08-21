import React from 'react';
import {AbsoluteFill, Audio, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {Look, PALETTE} from './lib';
import {renderScene, type SceneSpec} from './scenes';

/**
 * A CODE-DRAWN VERTICAL SHORT.
 *
 * Every frame is drawn at render time, because the subject of this shape is a
 * NUMBER: there is no photograph of exponential growth, and a stock picture of
 * a sheet of paper says less than a bar that doubles in front of you.
 *
 * The engine knows six SHAPES; the episode supplies the CONTENT. The first pass
 * had "42" and "440.000" typed into the components, which made it a video
 * rather than a pipeline — a second topic would have meant a second set of
 * components, each carrying its own copy of whichever bug had not been found
 * yet.
 *
 * Everything is cut to the measured narration in `audio/vo.json`. One clock:
 * the words on screen and the pictures under them come off the same file, so a
 * scene cannot drift away from the sentence it illustrates.
 */

export type Cue = {text: string; from: number; to: number; line?: number};
export type Beat = {at: number; kind: 'thump' | 'riser'};

export type ShortData = {
  audio?: string;
  bed?: string;
  bedGain?: number;
  thump?: string;
  riser?: string;
  scenes: {spec: SceneSpec; from: number; to: number}[];
  words: Cue[];
  beats?: Beat[];
  end: number;
};

const SAFE_BOTTOM = 0.22;

/* -------------------------------------------------------------- CAPTIONS -- */

/**
 * THE NARRATION, BURNT IN, WITH THE SPOKEN WORD POPPING.
 *
 * The colour marks the word; the SCALE BUMP says it. Three frames of 1.00 →
 * 1.09 → 1.00 is the whole difference between "a video with subtitles" and "a
 * video written word by word", and it is the cheapest thing in the file.
 *
 * Sits above the platform's own furniture: the bottom 18% of a Short is covered
 * by the caption, the handle and the sound label, so anything below 22% is a
 * caption the viewer never reads.
 */
const Captions: React.FC<{words: Cue[]; after?: number}> = ({words, after = 0}) => {
  const frame = useCurrentFrame();
  const {width, height, fps} = useVideoConfig();

  /**
   * HELD BACK BY A FRAME NUMBER, NOT BY A `<Sequence>`.
   *
   * Wrapping this in a Sequence to keep it off the hook shifted its own clock —
   * inside a Sequence `useCurrentFrame()` counts from the Sequence's start, so
   * every cue was looked up one hook-length early and the captions ran four
   * seconds behind their pictures for the whole reel.
   */
  const index = frame < after ? -1 : words.findIndex((w) => frame >= w.from && frame < w.to);
  if (index < 0) return null;

  const start = Math.max(0, index - 4);
  const phrase: Cue[] = [];
  for (let i = start; i <= index; i += 1) {
    // The line index is CARRIED, not inferred from the gap: this narrator
    // leaves eleven frames between sentences and any threshold loose enough to
    // survive a fast reading also runs two sentences together.
    if (i > start && words[i].line !== words[i - 1].line) phrase.length = 0;
    phrase.push(words[i]);
  }

  const pop = spring({frame: frame - words[index].from, fps, config: {damping: 9, mass: 0.4}, durationInFrames: 9});
  const size = width * 0.068;

  const body = (
    <div
      style={{
        maxWidth: width * 0.84,
        textAlign: 'center',
        fontFamily: '"Archivo", "Helvetica Neue", Arial, sans-serif',
        fontWeight: 900,
        fontSize: size,
        lineHeight: 1.14,
        letterSpacing: '-0.012em',
        textTransform: 'uppercase',
      }}
    >
      {phrase.map((word, i) => {
        const live = i === phrase.length - 1;
        return (
          <span
            key={`${word.text}-${i}`}
            style={{
              color: live ? PALETTE.hot : '#ffffff',
              display: 'inline-block',
              transform: live ? `scale(${1 + pop * 0.09})` : undefined,
            }}
          >
            {word.text}
            {i < phrase.length - 1 ? ' ' : ''}
          </span>
        );
      })}
    </div>
  );

  // The stroked copy first, the filled copy second: both layers are absolutely
  // positioned, so paint order is DOM order, and getting it backwards renders
  // the caption as a solid black slab.
  const layer = (style: React.CSSProperties) => (
    <AbsoluteFill
      style={{justifyContent: 'flex-end', alignItems: 'center', paddingBottom: height * SAFE_BOTTOM, ...style}}
    >
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

/* ------------------------------------------------------------------ REEL -- */

export const Short: React.FC<{data: ShortData}> = ({data}) => {
  const {fps} = useVideoConfig();
  const hookEnd = data.scenes.length ? data.scenes[0].to : 0;

  /**
   * DUCKING — the bed steps out of the way of the voice.
   *
   * Room tone held at one level under narration is room tone FIGHTING it: the
   * words lose a little definition on every sentence, and the fix everyone
   * reaches for is turning the bed down until it is inaudible, at which point
   * it is not doing its job either. So it ducks — quiet under speech, up in the
   * gaps, which is exactly where the ear wants something.
   *
   * And it goes out at the end. A short that stops with the bed still running
   * feels cut off; one that lands in silence feels finished.
   */
  const bedVolume = React.useCallback(
    (frame: number) => {
      const speaking = data.words.some((w) => frame >= w.from - 3 && frame < w.to + 6);
      const base = data.bedGain ?? 0.13;
      const tail = Math.max(0, Math.min(1, (data.end - frame) / 24));
      return (speaking ? base * 0.45 : base) * tail;
    },
    [data.words, data.bedGain, data.end],
  );

  return (
    <AbsoluteFill style={{backgroundColor: PALETTE.ink}}>
      {data.audio ? <Audio src={staticFile(data.audio)} /> : null}
      {data.bed ? <Audio src={staticFile(data.bed)} volume={bedVolume} loop /> : null}

      {/* THE CUT IS HEARD AS WELL AS SEEN. A low thump under a hard change of
          picture is the difference between a cut and a jump: the ear confirms
          what the eye was shown. Placed on the scene boundaries the edit
          already has, never on a grid of its own. */}
      {(data.beats ?? []).map((beat, i) => {
        const src = beat.kind === 'riser' ? data.riser : data.thump;
        if (!src) return null;
        return (
          <Sequence key={`beat-${i}`} from={Math.max(0, beat.at)} durationInFrames={fps * 2}>
            <Audio src={staticFile(src)} volume={beat.kind === 'riser' ? 0.3 : 0.55} />
          </Sequence>
        );
      })}

      {data.scenes.map((scene, index) => (
        <Sequence key={`scene-${index}`} from={scene.from} durationInFrames={Math.max(1, scene.to - scene.from)}>
          {renderScene(scene.spec, scene.to - scene.from)}
        </Sequence>
      ))}

      {/* Outside every Sequence, like the narration it was measured against —
          EXCEPT over the hook, which sets the same sentence as display type.
          Running both puts the claim on screen twice in two sizes, and a first
          frame carrying two competing headlines is one nobody finishes. */}
      <Captions words={data.words} after={hookEnd} />
      <Look grain={0.16} vignette={0.3} />
    </AbsoluteFill>
  );
};
