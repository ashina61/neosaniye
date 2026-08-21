import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import type {SceneProps} from './types';
import {focusHunt, posterizeTime, springEntrance} from '../motion';
import {Plate} from '../Plate';
import {Field, type FieldKind} from '../draw/Field';
import {Card, Newspaper, Print} from '../draw/Paper';
import {Annotation} from '../draw/Annotation';
import {WordStack} from '../draw/Type';

/**
 * EVIDENCE BOARD — drawn paper landing on a surface, one piece at a time.
 *
 * The same choreography as the shared stacked reveal (staggered, from different
 * edges, on a soft spring) but the items are DRAWN rather than supplied as
 * artwork: newspapers, index cards, photographic prints. That swap is the point
 * of the template.
 *
 * Asking an image generator for a newspaper front page is asking it for small
 * legible type on a clean rectangle, which is the one thing it is worst at —
 * every one of ours came back refused or unusable. Drawn, it is just
 * typography, and typography is what a documentary graphic already is. People
 * and places stay photographed; paper gets drawn.
 *
 * Items come from `params.items`, each a string of `kind|primary|secondary`:
 *
 *   news|THE CHRONICLE|CIPHER PRINTED IN FULL
 *   card|EVIDENCE 4-B|size 10 1/2 boot print · Lake Berryessa
 *   print|WITNESS COMPOSITE|Oct 1969
 *
 * Roles: background (optional — a drawn field is used when absent).
 */
/**
 * Where each item comes FROM and where it lands.
 *
 * The resting positions are spread by more than an item's own height on
 * purpose. Landing them closer looks tidier in a still and is wrong in motion:
 * each new piece is drawn on top of the last, so a tight stack buries the
 * heading of everything that arrived before it and the shot ends up showing one
 * card and two slivers.
 */
const ENTRIES = [
  {fromX: -980, fromY: 340, rotate: -24, restX: -140, restY: 20, rest: -7.5},
  {fromX: 1000, fromY: -300, rotate: 21, restX: 150, restY: -330, rest: 6.5},
  {fromX: 40, fromY: 1340, rotate: -13, restX: -30, restY: 360, rest: -2.5},
  {fromX: -860, fromY: -340, rotate: 17, restX: 90, restY: 690, rest: 4},
];

export const EvidenceBoard: React.FC<SceneProps> = ({scene, assets, durationInFrames}) => {
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

  const items = list('items');
  const itemWidth = num('itemWidth', Math.round(width * 0.52));
  const frames = list('itemFrames').length
    ? list('itemFrames').map(Number)
    : items.map((_, i) => Math.round((durationInFrames / (items.length + 1)) * (i + 1)) - 14);

  // The shot arrives out of focus and finds the table, the way a documentary
  // insert does. Everything drawn rides the same blur so nothing floats free.
  const blur = focusHunt(stepped, durationInFrames, {maxPx: num('focusPx', 8), dipAt: 0.86, dipBack: 0.94});
  const caption = list('caption');

  return (
    <AbsoluteFill>
      {assets.background ? (
        <Plate src={assets.background} scale={num('bgScale', 1.07)} alive={false} />
      ) : (
        <Field
          kind={str('field', 'paper') as FieldKind}
          colours={list('fieldColours').length === 3 ? list('fieldColours') : undefined}
          seed={scene.id}
          lift={num('fieldLift', 1)}
        />
      )}
      <AbsoluteFill style={{background: `rgba(6,5,3,${num('scrim', 0.34)})`}} />

      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', filter: blur > 0.4 ? `blur(${blur}px)` : undefined}}>
        {items.map((raw, index) => {
          /**
           * AN ITEM THAT DID NOT NAME A KIND IS NOT AN EMPTY ITEM.
           *
           * The planner normalises this now, but a config can be written by
           * hand and an episode planned before that change still says just
           * "MAVİ". Splitting blind put that word in the `kind` slot, matched
           * nothing, and drew a card with no heading — three wordless slips of
           * paper that passed validation and the whole test suite, because
           * every one of them is a perfectly valid card. Drawing nothing is
           * never the right reading of a string somebody typed.
           */
          const parts = raw.split('|');
          const named = parts.length >= 2 && (parts[0] === 'card' || parts[0] === 'news' || parts[0] === 'print');
          const kind = named ? parts[0] : 'card';
          const primary = named ? (parts[1] ?? '') : raw;
          const secondary = named ? parts.slice(2).join('|') : '';
          const entry = ENTRIES[index % ENTRIES.length];
          const at = frames[index] ?? 0;
          if (stepped < at) return null;

          const land = springEntrance(stepped, fps, {
            delay: at,
            stiffness: num('stiffness', 42),
            mass: num('mass', 1.12),
            damping: 13,
          });
          const x = entry.fromX + (entry.restX - entry.fromX) * land;
          const y = entry.fromY + (entry.restY - entry.fromY) * land;
          const rotate = entry.rotate + (entry.rest - entry.rotate) * land;
          const scale = 1.1 + (1 - 1.1) * land;

          return (
            <div
              key={`${raw}-${index}`}
              style={{
                position: 'absolute',
                transform: `translate(${x}px, ${y}px) rotate(${rotate}deg) scale(${scale})`,
                zIndex: index + 1,
              }}
            >
              {kind === 'news' ? (
                <Newspaper masthead={primary} headline={secondary} width={itemWidth} seed={`${scene.id}-${index}`} />
              ) : kind === 'print' ? (
                <Print width={itemWidth} caption={secondary}>
                  <AbsoluteFill
                    style={{
                      background: `repeating-linear-gradient(118deg, #2a251d 0 3px, #14110c 3px 7px)`,
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#cbbfa4',
                      fontFamily: '"Courier New", monospace',
                      fontSize: itemWidth * 0.075,
                      letterSpacing: '0.16em',
                    }}
                  >
                    {primary}
                  </AbsoluteFill>
                </Print>
              ) : (
                <Card
                  title={primary}
                  lines={secondary ? secondary.split('·').map((s) => s.trim()) : []}
                  width={itemWidth}
                  stamp={index === items.length - 1 ? str('stamp', '') || undefined : undefined}
                />
              )}
            </div>
          );
        })}
      </AbsoluteFill>

      {caption.length ? (
        <WordStack
          lines={caption}
          x={num('captionX', 84)}
          y={num('captionY', 250)}
          from={num('captionFrame', 8)}
          every={num('captionEvery', 6)}
          size={num('captionSize', 82)}
          recedeAt={num('captionRecedeAt', 60)}
          accent={num('captionAccent', -1) >= 0 ? num('captionAccent', -1) : undefined}
        />
      ) : null}

      {num('markWidth', 0) > 0 ? (
        <Annotation
          kind="underline"
          x={num('markX', 84)}
          y={num('markY', Math.round(height * 0.2))}
          width={num('markWidth', 0)}
          from={num('markFrame', 40)}
          seed={scene.id}
        />
      ) : null}
    </AbsoluteFill>
  );
};
