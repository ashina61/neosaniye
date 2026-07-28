import React from 'react';
import {AbsoluteFill, Audio, Sequence, staticFile, useCurrentFrame} from 'remotion';
import {SCENES, TOTAL_FRAMES} from '../../generated/timing';
import {TransitionLayer} from '../../core/transitions/TransitionLayer';
import {beats, palette} from './story';
import {Scene01Hook} from './scenes/Scene01Hook';
import {Scene02Setup} from './scenes/Scene02Setup';
import {Scene03Semaphore} from './scenes/Scene03Semaphore';
import {Scene04Night} from './scenes/Scene04Night';
import {Scene05Operator} from './scenes/Scene05Operator';
import {Scene06Explosion} from './scenes/Scene06Explosion';
import {Scene07Payoff} from './scenes/Scene07Payoff';

const starts = [SCENES.hook, SCENES.setup, SCENES.semaphore, SCENES.night, SCENES.operator, SCENES.explosion, SCENES.payoff, TOTAL_FRAMES];

export const TrafficLightShort: React.FC = () => {
  const frame = useCurrentFrame();
  let index = 0;
  while (index < starts.length - 2 && frame >= starts[index + 1]) index += 1;
  const start = starts[index];
  const end = starts[index + 1];
  const local = frame - start;
  const duration = Math.max(1, end - start);

  const scene = index === 0 ? <Scene01Hook frame={local} duration={duration} />
    : index === 1 ? <Scene02Setup frame={local} />
    : index === 2 ? <Scene03Semaphore frame={local} duration={duration} />
    : index === 3 ? <Scene04Night frame={local} duration={duration} />
    : index === 4 ? <Scene05Operator frame={local} />
    : index === 5 ? <Scene06Explosion frame={local} duration={duration} />
    : <Scene07Payoff frame={local} duration={duration} />;

  const cut = starts[index + 1];
  const transitionLocal = frame - cut;

  return <AbsoluteFill style={{background: palette.paper, overflow: 'hidden'}}>
    {scene}
    <TransitionLayer kind={beats[index]?.transitionOut ?? 'hard-cut'} localFrame={transitionLocal} />
    <Audio src={staticFile('audio/music.wav')} volume={.16} />
    <Audio src={staticFile('audio/voice.mp3')} volume={1} />
    <Sequence from={SCENES.semaphore}><Audio src={staticFile('audio/snap.wav')} volume={.46} /></Sequence>
    <Sequence from={SCENES.night}><Audio src={staticFile('audio/chime.wav')} volume={.36} /></Sequence>
    <Sequence from={SCENES.explosion}><Audio src={staticFile('audio/impact.wav')} volume={.72} /></Sequence>
  </AbsoluteFill>;
};
