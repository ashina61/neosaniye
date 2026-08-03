import React from 'react';
import {AbsoluteFill, Audio, Sequence, staticFile, useVideoConfig} from 'remotion';
import type {Beat, ReelSpec, SfxCue} from './schema';
import {DEFAULT_GRADE, DEFAULT_LOOK} from './schema';
import {FilmLook} from './engine/FilmLook';
import {LookContext} from './engine/look';
import {Captions} from './engine/Captions';
import {RIGS} from './rigs';

/**
 * THE REEL.
 *
 * One voiceover, one beat per spoken line, one rig per beat. This file owns
 * exactly three things: laying beats onto the timeline, wrapping each one in
 * the film look, and mixing the three audio layers so the words always win.
 *
 * It deliberately knows nothing about the topic. Everything a beat looks like
 * lives in its rig and its props.
 */

const Watermark: React.FC = () => (
  <img
    src={staticFile('logo-mark.png')}
    alt=""
    style={{position: 'absolute', left: 72, top: 64, height: 72, width: 'auto', opacity: 0.92}}
  />
);

const BeatScene: React.FC<{beat: Beat; engine: ReelSpec['engine']}> = ({beat, engine}) => {
  const Rig = RIGS[beat.rig] ?? RIGS['grounded-punch'];
  return (
    <FilmLook
      grade={beat.grade ?? engine.grade ?? DEFAULT_GRADE}
      layers={{...engine.film, ...(beat.film ?? {})}}
      posterizeFps={engine.posterizeFps}
      weavePx={engine.gateWeavePx}
      weaveScale={engine.weaveScale}
    >
      <Rig beat={beat} />
      <Captions captions={beat.captions ?? []} />
    </FilmLook>
  );
};

/**
 * MIX RULE: the voiceover sits on top at full level; the music sits well under
 * it and only lifts in the gaps between lines; each effect punches through for
 * a beat and ducks back out. Get this wrong and all the emotion reads as noise.
 */
const MusicBed: React.FC<{spec: ReelSpec}> = ({spec}) => {
  const {fps} = useVideoConfig();
  const bed = spec.audio?.musicPath;
  if (!bed) return null;
  const base = spec.audio?.musicVolume ?? 0.16;
  const ducked = spec.audio?.musicDuckVolume ?? base * 0.45;
  const windows = spec.audio?.duckWindows ?? [];

  return (
    <Audio
      src={staticFile(bed)}
      volume={(frame) => {
        const speaking = windows.some(([from, to]) => frame >= from - fps * 0.15 && frame <= to + fps * 0.25);
        return speaking ? ducked : base;
      }}
    />
  );
};

export const Reel: React.FC<ReelSpec> = (spec) => {
  const beats = spec.beats ?? [];
  const cues: SfxCue[] = [
    ...(spec.globalSfx ?? []),
    ...beats.flatMap((beat) => (beat.sfx ?? []).map((cue) => ({...cue, atFrame: beat.fromFrame + cue.atFrame}))),
  ];

  // THE LOOK IS PUT UP ONCE, HERE.
  //
  // Everything below reads its colours, treatment strengths, prop shapes and
  // choreography polarity from this one value, chosen from the topic. Without
  // it, six coded rigs would draw byte-identical frames in every video this
  // repo ever ships — the exact failure the template line died of.
  const look = spec.engine?.look ?? DEFAULT_LOOK;

  return (
    <LookContext.Provider value={look}>
    <AbsoluteFill style={{backgroundColor: look.palette.ink}}>
      {spec.audio?.voicePath ? (
        <Audio src={staticFile(spec.audio.voicePath)} volume={spec.audio.voiceVolume ?? 1} />
      ) : null}
      <MusicBed spec={spec} />
      {spec.audio?.ambiencePath ? <Audio src={staticFile(spec.audio.ambiencePath)} volume={0.08} /> : null}

      {cues.map((cue, index) => (
        <Sequence
          key={`${cue.path}-${cue.atFrame}-${index}`}
          from={Math.max(0, cue.atFrame)}
          durationInFrames={cue.durationInFrames ?? 60}
        >
          <Audio src={staticFile(cue.path)} volume={cue.volume ?? 0.62} />
        </Sequence>
      ))}

      {beats.map((beat) => (
        <Sequence key={beat.id} from={beat.fromFrame} durationInFrames={beat.durationInFrames}>
          <BeatScene beat={beat} engine={spec.engine} />
        </Sequence>
      ))}

      <Watermark />
    </AbsoluteFill>
    </LookContext.Provider>
  );
};

/** A single beat on its own timeline — how each scene is previewed in Studio. */
export const SoloBeat: React.FC<{beat: Beat; engine: ReelSpec['engine']}> = ({beat, engine}) => {
  const look = engine?.look ?? DEFAULT_LOOK;
  return (
    <LookContext.Provider value={look}>
      <AbsoluteFill style={{backgroundColor: look.palette.ink}}>
        <BeatScene beat={{...beat, fromFrame: 0}} engine={engine} />
      </AbsoluteFill>
    </LookContext.Provider>
  );
};
