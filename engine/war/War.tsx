import React from 'react';
import {AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame} from 'remotion';
import {Gate, Nitrate} from './film';
import {Blitz, Card, Clock, PAPER, Teletype, WarMap} from './scenes';

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
          <WarMap
            phase={{draw, west, east: 0, lit, split, label}}
            zoom={interpolate(frame, [at(8.5), at(19)], [1, 1.72], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})}
            focus={[
              interpolate(frame, [at(8.5), at(19)], [12, 18.4], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}),
              interpolate(frame, [at(8.5), at(19)], [52, 52.3], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}),
            ]}
          />
        </Sequence>

        <Sequence from={at(19.6)} durationInFrames={at(25.4) - at(19.6)}>
          <Blitz word="BLITZKRIEG" length={at(25.4) - at(19.6)} />
        </Sequence>

        <Sequence from={at(25.4)} durationInFrames={at(31.6) - at(25.4)}>
          <Teletype
            startAt={at(0.5)}
            lines={['BÜYÜK BRİTANYA', 'ALMANYA İLE', 'SAVAŞ HÂLİNDEDİR.']}
          />
        </Sequence>

        <Sequence from={at(31.6)} durationInFrames={at(38.4) - at(31.6)}>
          <WarMap
            phase={{draw: 1, west: 1, east, lit: ['de', 'gb', 'fr'], split: 1, label}}
            zoom={interpolate(frame, [at(31.6), at(38)], [1.8, 1.45], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})}
            focus={[19.6, 52.3]}
          />
        </Sequence>

        <Sequence from={at(38.4)} durationInFrames={at(43.6) - at(38.4)}>
          <Card kicker="POLONYA DİRENİŞİ" big="5" under="HAFTA SÜRDÜ" />
        </Sequence>

        <Sequence from={at(43.6)}>
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
