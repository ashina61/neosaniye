import React from 'react';
import {AbsoluteFill, Img, OffthreadVideo, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import type {BeatAsset, AssetRole} from '../schema';
import {anchorOrigin, boil, posterizeTime} from './motion';

/**
 * PLATES.
 *
 * Every rig is built from flat plates — a background, sometimes a character,
 * sometimes a prop. Depth is never in the asset; it is in how the plates move.
 *
 * The pipeline finds photographs rather than generating art, so a "character"
 * plate arrives as a rectangular photo, not a clean cut-out. `cutout` fakes the
 * separation with a soft elliptical mask and a drop shadow: enough to peel the
 * subject off the background once it is moving.
 */

export function pickAsset(assets: BeatAsset[] | undefined, role: AssetRole): BeatAsset | undefined {
  return (assets || []).find((asset) => asset.role === role);
}

/** The plate a rig falls back to when the media layer returned nothing. */
export const ProceduralPlate: React.FC<{seed?: number; dark?: boolean}> = ({seed = 0, dark = false}) => (
  <AbsoluteFill
    style={{
      background: dark
        ? `radial-gradient(ellipse 120% 90% at ${40 + (seed % 20)}% 38%, #2b2118 0%, #17110c 62%, #0b0805 100%)`
        : `radial-gradient(ellipse 120% 90% at ${40 + (seed % 20)}% 38%, #d8c9a6 0%, #b39c72 58%, #6f5c3c 100%)`,
    }}
  />
);

export const Plate: React.FC<{
  asset?: BeatAsset;
  scale?: number;
  /** Anchor in scene pixels — two plates only read as one space if they share it. */
  originX?: number;
  originY?: number;
  translateX?: number;
  translateY?: number;
  rotate?: number;
  blur?: number;
  opacity?: number;
  /** 0 = full colour, 1 = fully black and white. */
  desaturate?: number;
  cutout?: boolean;
  boilPhase?: number;
  style?: React.CSSProperties;
  fallbackSeed?: number;
  fallbackDark?: boolean;
}> = ({
  asset,
  scale = 1,
  originX,
  originY,
  translateX = 0,
  translateY = 0,
  rotate = 0,
  blur = 0,
  opacity = 1,
  desaturate = 0,
  cutout = false,
  boilPhase = 0,
  style,
  fallbackSeed = 0,
  fallbackDark = false,
}) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();

  // A CUT-OUT WITH NO PHOTOGRAPH IS NOTHING, NOT A SHAPE.
  //
  // The fallback plate is a soft gradient; masked into a cut-out silhouette it
  // renders as a dark blob in the middle of the frame — worse than an empty
  // stage. When the media layer returned no character, the rig's coded parts
  // carry the beat instead.
  if (cutout && !asset?.path) return null;

  // Even a still plate breathes — snapped to the stop-motion step so it
  // stutters rather than glides.
  const stepped = posterizeTime(frame, fps, 12);
  const life = boil(stepped, {scale: 0.005, rotate: 0.5, phase: boilPhase});

  const origin =
    originX !== undefined && originY !== undefined
      ? anchorOrigin(originX, originY, width, height)
      : '50% 50%';

  const mask = cutout
    ? 'radial-gradient(ellipse 46% 58% at 50% 46%, #000 58%, rgba(0,0,0,0.55) 78%, rgba(0,0,0,0) 96%)'
    : undefined;

  const media = asset?.path ? (
    asset.type === 'video' ? (
      <OffthreadVideo src={staticFile(asset.path)} muted style={{width: '100%', height: '100%', objectFit: 'cover'}} />
    ) : (
      <Img src={staticFile(asset.path)} style={{width: '100%', height: '100%', objectFit: 'cover'}} />
    )
  ) : (
    <ProceduralPlate seed={fallbackSeed} dark={fallbackDark} />
  );

  return (
    <AbsoluteFill
      style={{
        transformOrigin: origin,
        transform: `translate(${translateX}px, ${translateY}px) scale(${scale * life.scale}) rotate(${rotate + life.rotate}deg)`,
        filter: [
          blur > 0 ? `blur(${blur}px)` : '',
          desaturate > 0 ? `grayscale(${desaturate})` : '',
          cutout ? 'drop-shadow(-14px 18px 26px rgba(0,0,0,0.45))' : '',
        ]
          .filter(Boolean)
          .join(' '),
        opacity,
        WebkitMaskImage: mask,
        maskImage: mask,
        ...style,
      }}
    >
      {media}
    </AbsoluteFill>
  );
};
