import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import type {PropSpec} from '../schema';
import {posterizeTime, springEntrance} from '../motion';
import {Card, Newspaper, Plaque, Print} from './Paper';
import {WireFrame} from './Annotation';
import {Beam} from './Glow';

/**
 * THE THINGS IN THE ROOM THAT ARE DRAWN.
 *
 * Law 2 of this repo, finally wired: people and places are photographs,
 * everything else is drawn. The reference reel runs on about twenty assets and
 * only four of them are backdrops — the other sixteen are a museum plaque,
 * three newspaper front pages, hand-drawn wireframe diamonds, a gold frame, a
 * beam of light, index cards. Graphics, every one of them.
 *
 * This pipeline spent a fortnight asking a photo library for those. It searched
 * for a magnifying glass and got a washing-machine door; it searched for a
 * server rack and got a bicycle rack. Meanwhile `Plaque`, `WireFrame` and
 * `Beam` sat finished in this very directory, wired into ZERO templates — the
 * same disease as the drawn light the planner asked for zero times. Written,
 * never asked for.
 *
 * A prop takes the share of the camera push its DEPTH allows and scales about
 * the SAME ground point every plate scales about, because it is an object
 * standing in the same room. That is what separates it from a motif: a motif is
 * pinned to the frame, taking no part in the push, because it is a graphic
 * ABOUT the sentence rather than a thing inside the shot.
 */
export const DrawnProps: React.FC<{
  props?: PropSpec[];
  /** The shot's camera push. Each prop takes the fraction its depth allows. */
  push: number;
  /** The shared anchor as a transform-origin — the floor point of the room. */
  origin: string;
  accent: string;
}> = ({props = [], push, origin, accent}) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const stepped = posterizeTime(frame, fps, 12);

  return (
    <>
      {props.map((prop, i) => {
        const from = prop.from ?? 0;
        // Everything LANDS rather than appearing. A prop at full size on its
        // first frame is a sticker; the spring is what reads as a hand putting
        // it down, and it is the whole character of the reference's third scene.
        const land = springEntrance(stepped, fps, {delay: from, stiffness: 52, mass: 1});
        if (land <= 0.001) return null;

        const depth = prop.depth ?? 0.6;
        const scale = 1 + (push - 1) * depth;
        const w = prop.width ?? Math.round(width * 0.42);
        const x = prop.x ?? Math.round(width * 0.5);
        const y = prop.y ?? Math.round(height * 0.55);
        const colour = prop.colour ?? accent;
        const key = `${prop.kind}-${i}`;

        // A wire and a beam draw themselves in scene coordinates and already
        // fill the frame to do it, so they are handed the point and left alone.
        // Wrapping them in a positioned box would put them at an offset of an
        // offset and land them off screen.
        if (prop.kind === 'wire' || prop.kind === 'beam') {
          return (
            <AbsoluteFill
              key={key}
              style={{transformOrigin: origin, transform: `scale(${scale})`, opacity: (prop.opacity ?? 1) * land}}
            >
              {prop.kind === 'wire' ? (
                <WireFrame x={x} y={y} size={w} shape={prop.shape ?? 'diamond'} colour={colour} from={from} />
              ) : (
                <Beam x={x} y={y} width={w} colour={colour} rotate={prop.rotate ?? 0} />
              )}
            </AbsoluteFill>
          );
        }

        const paper =
          prop.kind === 'plaque' ? (
            <Plaque text={prop.text ?? ''} width={w} />
          ) : prop.kind === 'newspaper' ? (
            <Newspaper
              masthead={prop.masthead ?? prop.heading ?? ''}
              headline={prop.text ?? ''}
              date={prop.date}
              width={w}
              seed={key}
              // Big enough to be the shot? Then it is a close-up on the page,
              // not a small sheet scaled up into a wireframe of one.
              crop={w > width * 0.6}
            />
          ) : prop.kind === 'card' ? (
            <Card title={prop.heading} lines={prop.lines} width={w} stamp={prop.stamp} />
          ) : (
            <Print width={w} caption={prop.caption} />
          );

        return (
          <AbsoluteFill
            key={key}
            style={{transformOrigin: origin, transform: `scale(${scale})`, pointerEvents: 'none'}}
          >
            <div
              style={{
                position: 'absolute',
                left: x,
                top: y,
                width: w,
                // It arrives at an angle and settles level, so the rotation is
                // scaled by the landing rather than held: a paper that lands
                // already square was placed by a layout engine, not by a hand.
                transform: `translate(-50%, -50%) rotate(${(prop.rotate ?? 0) * (2 - land)}deg)`,
                opacity: (prop.opacity ?? 1) * land,
              }}
            >
              {paper}
            </div>
          </AbsoluteFill>
        );
      })}
    </>
  );
};
