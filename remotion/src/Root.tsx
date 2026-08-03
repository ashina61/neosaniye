import React from 'react';
import {Composition} from 'remotion';
import {Reel, SoloBeat} from './Reel';
import {RIG_IDS} from './rigs';
import {DEFAULT_GRADE, DEFAULT_REEL, type Beat, type ReelSpec, type RigId} from './schema';

/**
 * One master composition, plus one composition per rig.
 *
 * The per-rig compositions are how a scene gets tuned: open Studio, scrub to
 * the beat you care about, drag the props until it lands, and write the numbers
 * back into the spec builder. Every rig previews on its own so a change to one
 * never means re-rendering the whole reel to see it.
 */

const soloBeat = (rig: RigId): Beat => ({
  id: `solo-${rig}`,
  rig,
  role: 'setup',
  line: `Solo preview of the ${rig} rig.`,
  fromFrame: 0,
  durationInFrames: 120,
  captions: [
    {text: rig.replace(/-/g, ' '), atFrame: 12, durationInFrames: 90, style: 'serif-italic', side: 'center'},
  ],
  assets: [],
  sfx: [],
  props: {
    slotWord: '50 MILLION',
    cardTexts: ['NO LATE FEES', 'NO STORES', 'CUSTOMER FIRST'],
    cardFrames: [20, 60, 100],
    gesture: rig === 'finale-clone' ? 'wag' : 'none',
    shiftFrame: rig === 'grounded-punch' ? 60 : 0,
    shiftPx: 235,
  },
  grade: DEFAULT_GRADE,
});

const rigCompositionId = (rig: RigId): string =>
  `Rig-${rig.replace(/(^|-)([a-z])/g, (_match, _sep, letter: string) => letter.toUpperCase())}`;

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="NeoSaniyeReel"
      component={Reel}
      durationInFrames={DEFAULT_REEL.meta.durationInFrames}
      fps={DEFAULT_REEL.meta.fps}
      width={DEFAULT_REEL.meta.width}
      height={DEFAULT_REEL.meta.height}
      defaultProps={DEFAULT_REEL}
      calculateMetadata={({props}) => {
        const spec = props as ReelSpec;
        return {
          durationInFrames: spec.meta.durationInFrames,
          fps: spec.meta.fps,
          width: spec.meta.width,
          height: spec.meta.height,
        };
      }}
    />

    {RIG_IDS.map((rig) => (
      <Composition
        key={rig}
        id={rigCompositionId(rig)}
        component={SoloBeat}
        durationInFrames={120}
        fps={DEFAULT_REEL.meta.fps}
        width={DEFAULT_REEL.meta.width}
        height={DEFAULT_REEL.meta.height}
        defaultProps={{beat: soloBeat(rig), engine: DEFAULT_REEL.engine}}
      />
    ))}
  </>
);
