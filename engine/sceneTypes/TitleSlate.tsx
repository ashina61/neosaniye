import React from 'react';
import {AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import type {SceneProps} from './types';
import {CLAMP, posterizeTime} from '../motion';
import {Plate} from '../Plate';
import {Field, type FieldKind} from '../draw/Field';
import {Slate, Slot} from '../draw/Type';
import {Annotation, type MarkKind} from '../draw/Annotation';
import {Glow} from '../draw/Glow';
import {SceneMotif} from '../draw/Motif';

/**
 * TITLE SLATE — a scene made of type and drawn light, with no photograph
 * required.
 *
 * Every reel needs frames that state something rather than show it: the date,
 * the count, the verdict. Handing those to a photograph wastes them — a stock
 * picture of a courthouse says less than the words CASE STILL OPEN set large on
 * a drawn field.
 *
 * A backdrop plate is optional. With one it is a title over a photograph; with
 * none it is drawn end to end and cannot fail on a missing asset.
 *
 * Roles: background (optional).
 */
export const TitleSlate: React.FC<SceneProps> = ({scene, assets, durationInFrames}) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const stepped = posterizeTime(frame, fps, 12);

  const num = (key: string, fallback: number): number => {
    const value = scene.params?.[key];
    return typeof value === 'number' ? value : fallback;
  };
  const str = (key: string, fallback: string): string => {
    const value = scene.params?.[key];
    return typeof value === 'string' ? value : fallback;
  };
  const list = (key: string): string[] => {
    const value = scene.params?.[key];
    return Array.isArray(value) ? (value as string[]).map(String) : [];
  };

  const colours = list('fieldColours');
  const kicker = str('kicker', '');
  const title = str('title', '');
  const footer = str('footer', '');
  const mark = str('mark', '') as MarkKind | '';
  const spin = str('spinTo', '');

  /**
   * A NUMBER THAT ARRIVES INSTEAD OF BEING STATED.
   *
   * A slate reading 400 TONNES lands once and is over. The same number climbing
   * to 400 while the narrator says it holds the whole line, and it makes the
   * size of the figure FELT rather than read — which is the only reason a number
   * is in a script at all. It eases out, so most of the distance goes early and
   * the last stretch crawls: a linear count arrives and stops dead, and the eye
   * reads that as a clock rather than as a sum.
   */
  const countTo = num('countTo', 0);
  const counted = countTo
    ? `${str('countPrefix', '')}${Math.round(
        interpolate(stepped, [num('titleFrame', 6), num('titleFrame', 6) + num('countOver', 46)], [0, countTo], {
          ...CLAMP,
          easing: Easing.out(Easing.cubic),
        }),
      ).toLocaleString('en-US')}${str('countSuffix', '')}`
    : '';

  // The frame closes in a little the whole time it is up, so a card made of
  // type is never actually still.
  const creep = interpolate(stepped, [0, durationInFrames], [1, num('creep', 1.06)], {
    ...CLAMP,
    easing: Easing.out(Easing.quad),
  });

  return (
    <AbsoluteFill>
      {/* The CREEP moves the picture, never the type. Scaling a title card
          whole makes the words themselves grow, which softens them and gives
          away that the frame is a still being zoomed rather than a shot. */}
      <AbsoluteFill style={{transform: `scale(${creep})`}}>
        {assets.background ? (
          <>
            <Plate src={assets.background} alive={false} />
            <AbsoluteFill style={{background: `rgba(8,6,4,${num('scrim', 0.45)})`}} />
          </>
        ) : (
          <Field
            kind={str('field', 'spotlight') as FieldKind}
            colours={colours.length === 3 ? colours : undefined}
            seed={scene.id}
          />
        )}

        {num('glowSize', 0) > 0 ? (
          <Glow
            x={num('glowX', Math.round(width * 0.5))}
            y={num('glowY', Math.round(height * 0.36))}
            size={num('glowSize', 0)}
            intensity={num('glowIntensity', 0.7)}
          />
        ) : null}
      </AbsoluteFill>

      {/* Frame-locked, outside the creep, and UNDER the type: a motif that
          scales with the card would make the words grow with it. */}
      <SceneMotif
        params={scene.params}
        seed={scene.id}
        durationInFrames={durationInFrames}
        accent={str('accent', '#ffcf3d')}
        defaultY={Math.round(height * 0.86)}
      />

      {/* TWO WAYS A FIGURE CAN ARRIVE, and an episode picks one. A counter
          climbing makes the SIZE of it felt; a reel slamming to a stop makes
          the CHOICE felt — it could have been anything and it turned out to be
          this. Using both in one reel would make neither mean anything.

          The reel goes INSIDE the slate, in the title's own place, so the card
          stays a layout: kicker over, rules around, footer under. */}
      <Slate
        kicker={kicker || undefined}
        title={counted || title}
        footer={footer || undefined}
        from={num('titleFrame', 6)}
        size={num('titleSize', 118)}
        accent={str('accent', '#ffcf3d')}
        tabular={Boolean(counted)}
        titleNode={
          spin ? (
            <Slot
              value={spin}
              reel={list('spinReel')}
              from={num('titleFrame', 6)}
              spin={num('spinFrames', 26)}
              size={num('titleSize', 210)}
              colour={str('accent', '#ffcf3d')}
            />
          ) : undefined
        }
      />

      {mark ? (
        <Annotation
          kind={mark}
          x={num('markX', Math.round(width * 0.18))}
          y={num('markY', Math.round(height * 0.56))}
          width={num('markWidth', Math.round(width * 0.64))}
          height={num('markHeight', 96)}
          from={num('markFrame', 40)}
          over={num('markOver', 14)}
          colour={str('accent', '#ffcf3d')}
          seed={scene.id}
        />
      ) : null}
    </AbsoluteFill>
  );
};
