import React from 'react';
import {Composition} from 'remotion';
import {CANVAS} from './design/tokens';
import {Short, type Storyboard} from './Short';
import {SCENES, SCENE_NAMES} from './scenes';
import {StyleSheet} from './StyleSheet';
import storyboardJson from '../content/storyboard.json';

const storyboard = storyboardJson as Storyboard;

export const RemotionRoot: React.FC = () => (
  <>
    {/*
      Tek üretim kompozisyonu. Süre storyboard'dan gelir — sabit değil, çünkü
      beat sayısı ve seslendirme uzunluğu konuya göre değişir.
    */}
    <Composition
      id="Short"
      component={Short}
      durationInFrames={Math.max(storyboard.totalFrames, 1)}
      fps={CANVAS.fps}
      width={CANVAS.width}
      height={CANVAS.height}
      defaultProps={{storyboard}}
    />

    {/*
      STİL SAYFASI — her sahne şablonundan bir kare, tek karede yan yana.
      Amacı denetim: tasarım sistemi bozulduğunda hangi şablonda bozulduğu
      tek bakışta görünsün. Üretime girmez, `remotion still` ile alınır.
    */}
    <Composition
      id="StyleSheet"
      component={StyleSheet}
      durationInFrames={SCENE_NAMES.length * CANVAS.fps * 3}
      fps={CANVAS.fps}
      width={CANVAS.width}
      height={CANVAS.height}
    />
  </>
);
