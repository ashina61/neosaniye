import React from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import type {EpisodeConfig, SceneSpec} from './schema';
import {DEFAULT_LOOK, sceneOffsets} from './schema';
import {FilmLook} from './FilmLook';
import {OnScreenText} from './OnScreenText';
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

  return (
    <FilmLook grade={grade} film={look.film} posterizeFps={look.posterizeFps}>
      {Template ? (
        <Template scene={scene} assets={scene.assets ?? {}} durationInFrames={scene.durationInFrames} />
      ) : (
        <MissingTemplate scene={scene} />
      )}
      <OnScreenText specs={scene.onScreenText} />
    </FilmLook>
  );
};

export const Episode: React.FC<{config: EpisodeConfig}> = ({config}) => {
  const look = config?.look ?? DEFAULT_LOOK;
  const offsets = sceneOffsets(config);

  return (
    <AbsoluteFill style={{backgroundColor: '#0b0906'}}>
      {config.scenes.map((scene, index) => (
        <Sequence
          key={scene.id}
          from={offsets[index]}
          durationInFrames={Math.max(1, Math.round(scene.durationInFrames))}
        >
          <Scene scene={scene} look={look} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
