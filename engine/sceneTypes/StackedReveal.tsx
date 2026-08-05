import React from 'react';
import {AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import type {SceneProps} from './types';
import {posterizeTime, springEntrance} from '../motion';
import {Plate} from '../Plate';

/**
 * STACKED REVEAL — several items arriving one after another and piling up.
 *
 * Roles: item1, item2, item3, … (as many as the episode supplies, in order).
 *
 * The rules that make it read as deliberate rather than as a glitch:
 *
 *   STAGGER    each item lands on its own beat. Arriving together is a pile-up
 *              the eye cannot separate into parts.
 *   VARY THE   item 1 from the left, item 2 from the right, item 3 from below.
 *   DIRECTION  Same edge three times reads as one object stuttering.
 *   SOFT SPRING low stiffness with a touch of mass, so each item glides in and
 *              settles rather than snapping — the feel of a hand placing it.
 */
const ENTRIES = [
  {fromX: -900, fromY: 260, rotate: -26, restX: -70, restY: 90, rest: -7},
  {fromX: 900, fromY: -180, rotate: 22, restX: 90, restY: -30, rest: 6},
  {fromX: 0, fromY: 1200, rotate: -14, restX: 0, restY: 180, rest: -3},
  {fromX: -700, fromY: -260, rotate: 18, restX: -40, restY: -140, rest: 4},
];

export const StackedReveal: React.FC<SceneProps> = ({scene, assets, durationInFrames}) => {
  const frame = useCurrentFrame();
  const {fps, width} = useVideoConfig();
  const stepped = posterizeTime(frame, fps, 12);

  // Items are whatever roles the episode named item1..itemN, in order.
  const items = Object.keys(assets)
    .filter((role) => /^item\d+$/.test(role))
    .sort((a, b) => Number(a.slice(4)) - Number(b.slice(4)))
    .map((role) => assets[role]);

  const frames = Array.isArray(scene.params?.itemFrames)
    ? (scene.params?.itemFrames as number[])
    : items.map((_, index) => Math.round((durationInFrames / (items.length + 1)) * (index + 1)) - 10);

  const itemWidth = typeof scene.params?.itemWidth === 'number'
    ? (scene.params.itemWidth as number)
    : Math.round(width * 0.5);

  const stiffness = typeof scene.params?.stiffness === 'number' ? (scene.params.stiffness as number) : 42;
  const mass = typeof scene.params?.mass === 'number' ? (scene.params.mass as number) : 1.1;

  return (
    <AbsoluteFill>
      {assets.background ? <Plate src={assets.background} alive={false} /> : null}

      <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
        {items.map((src, index) => {
          const entry = ENTRIES[index % ENTRIES.length];
          const at = frames[index] ?? 0;
          if (stepped < at) return null;

          const land = springEntrance(stepped, fps, {delay: at, stiffness, mass, damping: 13});
          const x = interpolate(land, [0, 1], [entry.fromX, entry.restX]);
          const y = interpolate(land, [0, 1], [entry.fromY, entry.restY]);
          const rotate = interpolate(land, [0, 1], [entry.rotate, entry.rest]);
          const scale = interpolate(land, [0, 1], [1.1, 1]);

          return (
            <div
              key={src}
              style={{
                position: 'absolute',
                width: itemWidth,
                transform: `translate(${x}px, ${y}px) rotate(${rotate}deg) scale(${scale})`,
                zIndex: index + 1,
                filter: 'drop-shadow(0 26px 46px rgba(0,0,0,0.85))',
              }}
            >
              <Img src={staticFile(src)} style={{width: '100%', display: 'block'}} />
            </div>
          );
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
