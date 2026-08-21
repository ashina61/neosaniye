import React from 'react';
import {AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame} from 'remotion';
import {Gate, Nitrate} from './film';
import {Card, Clock, Teletype} from './scenes';
import {Theatre} from './Theatre';
import {Pincer} from './Pincer';

/**
 * EYLÜL 1939 — ONE FILM, EIGHT MOVEMENTS.
 *
 * The shape a viewer will follow on a phone is not "what happened", it is WHERE
 * and WHEN: a clock arriving at a time, a map filling from one side and then
 * the other, a wire report, and a number at the end. Everything else a
 * documentary would say in a voiceover, this says by drawing.
 *
 * The whole film sits inside one `Gate`, so the picture weaves and breathes as
 * a single strip of film — and the dirt sits OUTSIDE it, on the projector,
 * because dirt that weaves with the picture is dirt painted on the picture.
 */

export type WarData = {score?: string; end: number};

const at = (seconds: number) => Math.round(seconds * 30);

export const War: React.FC<{data: WarData}> = ({data}) => {
  const frame = useCurrentFrame();

  /** The map is one continuous graphic; the scenes are windows onto it. */
  const draw = interpolate(frame, [at(4.4), at(8.5)], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const split = interpolate(frame, [at(8.6), at(10.4)], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const west = interpolate(frame, [at(12.4), at(19.2)], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const east = interpolate(frame, [at(32.4), at(37.4)], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const lit = frame > at(27.5) ? ['de', 'gb', 'fr'] : frame > at(12) ? ['de'] : [];
  const label =
    frame > at(32) ? '17 EYLÜL — DOĞUDAN' : frame > at(12) ? '04:45 — SINIR GEÇİLDİ' : frame > at(8.4) ? '23 AĞUSTOS — GİZLİ PROTOKOL' : undefined;

  return (
    <AbsoluteFill style={{backgroundColor: '#05040a'}}>
      <Gate>
        <Sequence durationInFrames={at(4.4)}>
          <Clock length={at(4.4)} />
        </Sequence>

        {/* THE MAP HOLDS THE MIDDLE OF THE FILM — two long passages with the
            blitz and the declaration cut into it, so the geography is the spine
            and everything else is an inset. */}
        <Sequence from={at(4.4)} durationInFrames={at(19.6) - at(4.4)}>
          <Theatre
            ops={{print: draw, west, east: 0, front: Math.min(1, west * 0.62), split, lit, ops: frame > at(12)}}
            zoom={interpolate(frame, [at(8.6), at(19)], [1, 1.95], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})}
            focus={[
              interpolate(frame, [at(8.6), at(19)], [12, 19.2], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}),
              interpolate(frame, [at(8.6), at(19)], [52, 52.4], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}),
            ]}
            date={frame > at(12) ? '1 EYLÜL 1939 · 04:45' : '23 AĞUSTOS 1939'}
            label={frame > at(12) ? 'ÜÇ KOLDAN GİRİŞ' : 'GİZLİ PROTOKOL — POLONYA PAYLAŞILDI'}
          />
        </Sequence>

        <Sequence from={at(19.6)} durationInFrames={at(26.2) - at(19.6)}>
          <Pincer length={at(26.2) - at(19.6)} />
        </Sequence>

        <Sequence from={at(26.2)} durationInFrames={at(31.6) - at(26.2)}>
          <Teletype startAt={at(0.4)} lines={['BÜYÜK BRİTANYA', 'ALMANYA İLE', 'SAVAŞ HÂLİNDEDİR.']} />
        </Sequence>

        <Sequence from={at(31.6)} durationInFrames={at(38.4) - at(31.6)}>
          <Theatre
            ops={{print: 1, west: 1, east, front: 0.5 + east * 0.5, split: 1, lit: ['de', 'gb', 'fr'], ops: true}}
            zoom={interpolate(frame, [at(31.6), at(38)], [2.0, 1.5], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})}
            focus={[20.4, 52.3]}
            date="17 EYLÜL 1939"
            label="DOĞUDAN KIZIL ORDU"
          />
        </Sequence>

        {/* THE CARDS SIT ON THE MAP, DIMMED. A number on an empty black field
            is a slide; the same number over the country it is about is a
            caption on a document — and the viewer has spent thirty seconds
            learning to read that document. */}
        <Sequence from={at(38.4)} durationInFrames={at(43.6) - at(38.4)}>
          <Theatre
            ops={{print: 1, west: 1, east: 1, front: 1, split: 1, lit: ['de', 'gb', 'fr'], ops: true}}
            zoom={1.55}
            focus={[20.4, 52.3]}
          />
          <Card kicker="POLONYA DİRENİŞİ" big="5" under="HAFTA SÜRDÜ" />
        </Sequence>

        <Sequence from={at(43.6)}>
          <Theatre
            ops={{print: 1, west: 1, east: 1, front: 1, split: 1, lit: ['de', 'gb', 'fr', 'su', 'it'], ops: false}}
            zoom={1.05}
            focus={[14, 51]}
          />
          <Card kicker="BU SAVAŞ SÜRECEKTİ" big="2194" under="GÜN" colour="#e8b23c" />
        </Sequence>
      </Gate>

      <Nitrate intensity={1} warmth={1} />

      {/* The last two seconds go to black under the grain, so the film ends by
          running out rather than by stopping. */}
      <AbsoluteFill
        style={{
          background: '#000',
          opacity: interpolate(frame, [data.end - 26, data.end - 4], [0, 1], {extrapolateLeft: 'clamp'}),
        }}
      />
      {data.score ? <Audio src={staticFile(data.score)} volume={0.9} /> : null}
    </AbsoluteFill>
  );
};
