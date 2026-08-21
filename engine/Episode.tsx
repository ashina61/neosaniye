import React from 'react';
import {AbsoluteFill, Audio, Sequence, staticFile} from 'remotion';
import type {EpisodeConfig, SceneSpec} from './schema';
import {DEFAULT_LOOK, resolveAssets, sceneOffsets} from './schema';
import {FilmLook} from './FilmLook';
import {OnScreenText} from './OnScreenText';
import {Transition} from './Transition';
import {Subtitles} from './draw/Subtitles';
import {resolveSceneType} from './sceneTypes/registry';

/**
 * THE ROOT TIMELINE.
 *
 * Reads the episode config and lays its scenes out in order, each for the
 * duration IT declares. This file owns three things and nothing else: the
 * order, the film wrapper, and the text layer.
 *
 * A missing template is drawn as a visible red card rather than skipped. A
 * silently dropped scene turns a 40-second reel into a 32-second one and
 * nobody notices until the audio no longer lines up.
 */
const MissingTemplate: React.FC<{scene: SceneSpec}> = ({scene}) => (
  <AbsoluteFill
    style={{
      backgroundColor: '#3a0d0d',
      color: '#ffd9d9',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'monospace',
      fontSize: 34,
      textAlign: 'center',
      padding: 80,
    }}
  >
    <div>
      UNKNOWN sceneType
      <br />
      <strong>{scene.sceneType}</strong>
      <br />
      (scene {scene.id})
    </div>
  </AbsoluteFill>
);

const Scene: React.FC<{scene: SceneSpec; look: EpisodeConfig['look']}> = ({scene, look}) => {
  const Template = resolveSceneType(scene.sceneType);
  const grade = {...look.grade, ...(scene.gradeOverride ?? {})};
  const assets = resolveAssets(scene.assets);

  return (
    <FilmLook grade={grade} film={look.film} posterizeFps={look.posterizeFps}>
      <Transition kind={scene.transition?.kind} frames={scene.transition?.frames}>
      {Template ? (
        <Template scene={scene} assets={assets} durationInFrames={scene.durationInFrames} />
      ) : (
        <MissingTemplate scene={scene} />
      )}
      </Transition>
      <OnScreenText specs={scene.onScreenText} />
    </FilmLook>
  );
};

export const Episode: React.FC<{config: EpisodeConfig}> = ({config}) => {
  const look = config?.look ?? DEFAULT_LOOK;
  const offsets = sceneOffsets(config);

  return (
    <AbsoluteFill style={{backgroundColor: '#0b0906'}}>
      {/* THE NARRATION RUNS THE WHOLE REEL, unsequenced, because it is not a
          thing that happens during a scene — it is the clock every scene was
          cut to. Sequencing it per scene would let a rounding error at one cut
          push the rest of the words out of step with their own pictures. */}
      {config.audio ? <Audio src={staticFile(config.audio)} /> : null}

      {/* ROOM TONE, UNDER EVERYTHING, FOR THE SAME REASON.
          A reel with only narration on it falls to absolute digital silence in
          every gap between two sentences — and no room has ever been silent, so
          the ear reads it as the sound dropping out rather than as a pause. Low
          enough to be a room and not a score. */}
      {config.bed ? <Audio src={staticFile(config.bed)} volume={config.bedGain ?? 0.16} loop /> : null}

      {config.scenes.map((scene, index) => (
        <Sequence
          key={scene.id}
          from={offsets[index]}
          durationInFrames={Math.max(1, Math.round(scene.durationInFrames))}
        >
          <Scene scene={scene} look={look} />
        </Sequence>
      ))}

      {/* AND THE CAPTIONS ON TOP OF ALL OF THEM, outside every Sequence.
          They are measured against the narration, which is also unsequenced;
          cutting them per scene would let each scene's rounding walk the words
          away from the voice, a frame at a time, until the caption is a word
          behind the mouth. Above the scenes but under nothing: a subtitle the
          film grain sits on top of stops reading as burnt in. */}
      <Subtitles cues={config.subtitles} />
    </AbsoluteFill>
  );
};
