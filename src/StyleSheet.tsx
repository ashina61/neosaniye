import React from 'react';
import {Sequence, AbsoluteFill} from 'remotion';
import {CANVAS, PALETTE, FONTS} from './design/tokens';
import {SCENES, SCENE_NAMES} from './scenes';
import type {ScenePayload} from './scenes/types';

/**
 * STİL SAYFASI (denetim kompozisyonu)
 *
 * Her şablon sırayla 3 saniye gösterilir, üstünde adı yazar. Üretime girmez.
 * Neden var: tasarım sistemi bir yerde bozulduğunda (kontur kayboldu, aksan
 * taştı, metin güvenli alanı aştı) hangi şablonda bozulduğu tek videoda
 * görünsün. Şablonları tek tek elle render etmekten hızlı.
 */

/** Her şablonun kendini gösterebileceği asgari örnek içerik. */
const DEMO: Record<string, ScenePayload> = {
  hero_cutout: {label: 'MAU PIAILUG', headline: 'The *master* navigator'},
  wide_establish: {headline: 'One canoe. *No compass.*', caption: 'Hawai’i to Tahiti, 1976'},
  headline_card: {headline: 'He *read* the wind.', label: 'TRADITIONAL NAVIGATOR', caption: 'Recorded 1976'},
  pull_quote: {quote: '“In his mind, the canoe was *not moving*. He held it still.”', label: 'INTERVIEW'},
  split_compare: {
    sides: [
      {label: 'Instruments', detail: 'Compass, sextant, charts, radio'},
      {label: 'Memory', detail: 'Stars, swell, wind, birds'},
    ],
  },
  labeled_diagram: {
    headline: 'The crossing',
    sides: [{label: "HAWAI'I"}, {label: 'TAHITI'}],
    label: '1976',
    caption: '4,000 kilometres of open ocean, no instruments aboard.',
  },
  archival_timeline: {
    headline: 'How the knowledge nearly vanished',
    timeline: [
      {year: '1778', text: 'European contact begins'},
      {year: '1900', text: 'Voyaging canoes fall out of use'},
      {year: '1976', text: 'Piailug sails to Tahiti'},
    ],
  },
  map_route: {
    headline: 'Thirty-three days at sea',
    route: [
      {x: 0.14, y: 0.74, label: "HAWAI'I"},
      {x: 0.52, y: 0.46},
      {x: 0.86, y: 0.22, label: 'TAHITI'},
    ],
  },
  grid_scale: {headline: 'Navigators left alive', ratio: {total: 24, highlighted: 5, unit: 'remained'}},
  data_annotate: {
    headline: 'Voyages per decade',
    series: [0.08, 0.12, 0.1, 0.22, 0.4, 0.66, 0.95],
    label: '1976',
    caption: 'The revival begins with a single crossing.',
  },
  stick_beat: {headline: 'Which one have *you* been building?', caption: 'Instruments or instinct'},
  star_field: {headline: 'Star paths *memorized*', label: 'CELESTIAL NAVIGATION'},
};

export const StyleSheet: React.FC = () => {
  const per = CANVAS.fps * 3;
  return (
    <AbsoluteFill>
      {SCENE_NAMES.map((name, i) => {
        const Component = SCENES[name];
        return (
          <Sequence key={name} from={i * per} durationInFrames={per} name={name}>
            <Component seconds={3} payload={DEMO[name] ?? {}} seed={i * 7 + 3} index={i} />
            <div
              style={{
                position: 'absolute',
                left: 0,
                bottom: 0,
                width: CANVAS.width,
                padding: '18px 0 22px',
                textAlign: 'center',
                background: 'rgba(12,12,24,0.86)',
                color: PALETTE.accent,
                fontFamily: FONTS.display,
                fontWeight: 700,
                fontSize: 40,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
              }}
            >
              {`${i + 1}/${SCENE_NAMES.length}  ${name}`}
            </div>
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
