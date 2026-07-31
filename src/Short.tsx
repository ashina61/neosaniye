import React from 'react';
import {AbsoluteFill, Sequence, Audio, staticFile} from 'remotion';
import {CANVAS} from './design/tokens';
import {FilmTreatment} from './film/treatment';
import {SCENES} from './scenes';
import type {SceneTemplate, ScenePayload} from './scenes/types';

/**
 * SIRALAYICI
 *
 * Storyboard JSON'u sahnelere çevirir. Konu bilgisi burada YOK: hangi konu
 * olursa olsun bu bileşen aynıdır. Eski repodaki hata konu başına bir Remotion
 * videosu yazmaktı (Scene01Hook…Scene07Payoff), o yüzden her yeni konu elle
 * kodlama gerektiriyordu.
 *
 * Sahneler arasında GEÇİŞ YOK. Referans videoda 16 kesmenin tamamı sert kesme;
 * çapraz geçiş tek bir yerde bile kullanılmamış. Kesme, kağıt kolajın dili.
 */

export interface StoryboardScene {
  template: SceneTemplate;
  payload: ScenePayload;
  /** Sahne uzunluğu, kare. */
  durationInFrames: number;
  seed: number;
  /** Bu şablonun kaçıncı kullanımı; derleyici hesaplar. */
  occurrence?: number;
}

export interface Storyboard {
  title: string;
  scenes: StoryboardScene[];
  /** public/ içindeki seslendirme dosyası, varsa. */
  audio?: string;
  /**
   * Anlatının yılı — `build-storyboard.mjs` cümlelerden çıkarır. Sahneler bunu
   * dönem damgası olarak taşıyor. Anlatıda yıl geçmiyorsa alan YOK ve damga
   * çizilmiyor; dönem uydurmak uydurma nesne çizmekle aynı sınıf yalan olurdu.
   */
  era?: string;
  totalFrames: number;
}

export const Short: React.FC<{storyboard: Storyboard}> = ({storyboard}) => {
  let cursor = 0;
  return (
    <AbsoluteFill style={{backgroundColor: '#E4E4D8'}}>
      {storyboard.scenes.map((scene, i) => {
        const Component = SCENES[scene.template];
        const from = cursor;
        cursor += scene.durationInFrames;
        if (!Component) return null;
        return (
          <Sequence key={i} from={from} durationInFrames={scene.durationInFrames} name={`${i + 1}. ${scene.template}`}>
            <Component
              seconds={scene.durationInFrames / CANVAS.fps}
              payload={scene.payload}
              seed={scene.seed}
              index={i}
              occurrence={scene.occurrence ?? 0}
              era={storyboard.era}
            />
          </Sequence>
        );
      })}
      {/*
        FİLM KATMANI — TÜM SAHNELERİN ÜSTÜNDE, TEK YERDE.

        Rehberin kuralı: "build the film-look engine once". Sahne içine
        konulursa 19 sahnede 19 farklı film çıkar; kolajı tek yapıma bağlayan
        şey tam olarak hepsinin AYNI filmden geçmesi.

        Sequence'lerin DIŞINDA duruyor, yani kesmelerden etkilenmez: gren,
        çizik ve vinyet sahne değişince yerinden oynamaz — gerçek bir filmde de
        oynamaz, çünkü onlar sahneye değil şeride ait.
      */}
      <FilmTreatment />
      {storyboard.audio && <Audio src={staticFile(storyboard.audio)} />}
    </AbsoluteFill>
  );
};
