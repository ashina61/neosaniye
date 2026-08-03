import React from 'react';
import {AbsoluteFill, Img, OffthreadVideo, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import type {BeatAsset, AssetRole} from '../schema';
import {anchorOrigin, boil, posterizeTime} from './motion';
import {useLook} from './look';

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

/**
 * The plate a rig falls back to when the media layer returned nothing. It is
 * built from the video's own paper and ink, so even an empty stage belongs to
 * this story rather than to a house default.
 */
export const ProceduralPlate: React.FC<{seed?: number; dark?: boolean}> = ({seed = 0, dark = false}) => {
  const {palette} = useLook();
  const centre = 40 + (seed % 20);
  return (
    <AbsoluteFill
      style={{
        // A LIT STAGE, NOT A LIGHTBOX.
        //
        // Two failures live one step apart here. Painting the fallback in ink
        // gives a near-black beat that trips the black-frame gate; painting it
        // in the video's paper gives a milky frame that blows out the moment a
        // rig screen-blends light onto it. So the paper only ever tints an ink
        // ground: the video's colour is visible, the exposure stays cinematic.
        background: dark
          ? `radial-gradient(ellipse 120% 90% at ${centre}% 38%, ${palette.paperDark}33 0%, ${palette.ink} 58%, ${palette.ink} 100%)`
          : `radial-gradient(ellipse 120% 90% at ${centre}% 38%, ${palette.paperDark}80 0%, ${palette.accentDark}4d 46%, ${palette.ink} 92%)`,
      }}
    />
  );
};

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
