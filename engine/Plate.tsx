import React from 'react';
import {AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {anchorOrigin, boil, posterizeTime} from './motion';

/**
 * A PLATE — one flat image layer.
 *
 * Every template is built from these. Depth is never in the file; it is in how
 * two plates move relative to each other, which is why the same four templates
 * can carry any episode's artwork.
 *
 * `src` arrives from the episode config and is resolved with `staticFile`. The
 * renderer points Remotion's public directory at the episode folder, so
 * "assets/character-1.png" means THAT episode's character — the engine never
 * learns the name.
 */
export const Plate: React.FC<{
  src?: string;
  scale?: number;
  /** Anchor in scene pixels. Two plates share it to read as one space. */
  originX?: number;
  originY?: number;
  /**
   * SUBJECT MODE. Without it a plate is full-bleed: it covers the frame and
   * crops, which is right for a wall and wrong for a person — a cut-out
   * stretched to 1080x1920 fills the shot, so nothing can move in front of
   * anything and the depth is gone.
   *
   * Give a size in scene pixels and the plate becomes an object: drawn at that
   * size, the other dimension from the file's own ratio, standing with its
   * bottom centre on (footX, footY). Scaling then happens about the feet, so a
   * subject grows INTO the room instead of sliding out of it.
   *
   * Size a STANDING FIGURE by plateHeight. What places a person in a frame is
   * how tall they are in it, and a cut-out is trimmed to its own edges — so a
   * wide-stanced pose and a narrow one come back as files of different ratios,
   * and a fixed width would silently make one of them short.
   */
  plateWidth?: number;
  plateHeight?: number;
  footX?: number;
  footY?: number;
  /** 'cover' crops to fill its box; 'contain' fits the whole file inside it. */
  fit?: 'cover' | 'contain';
  translateX?: number;
  translateY?: number;
  rotate?: number;
  blur?: number;
  opacity?: number;
  /** 0 = full colour, 1 = fully black and white. */
  desaturate?: number;
  /** Paints the plate solid black — how a cast shadow is made from a subject. */
  blacken?: boolean;
  /** Soft elliptical mask, for a photo that is not a clean cut-out. */
  cutout?: boolean;
  /** Adds the stop-motion breath. Off for backgrounds that should sit still. */
  alive?: boolean;
  boilPhase?: number;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}> = ({
  src,
  scale = 1,
  originX,
  originY,
  plateWidth,
  plateHeight,
  footX,
  footY,
  fit = 'cover',
  translateX = 0,
  translateY = 0,
  rotate = 0,
  blur = 0,
  opacity = 1,
  desaturate = 0,
  blacken = false,
  cutout = false,
  alive = true,
  boilPhase = 0,
  style,
  children,
}) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();

  const stepped = posterizeTime(frame, fps, 12);
  const life = alive ? boil(stepped, {phase: boilPhase}) : {scale: 1, rotate: 0};

  const sized = (plateWidth ?? 0) > 0 || (plateHeight ?? 0) > 0;

  // A sized subject turns about its own feet; a full-bleed plate turns about
  // the shared anchor the scene handed it.
  const origin = sized
    ? '50% 100%'
    : originX !== undefined && originY !== undefined
      ? anchorOrigin(originX, originY, width, height)
      : '50% 50%';

  // The soft mask only makes sense on a full-bleed photo, where it fakes a
  // cut-out. A subject already sized to its own box would just get its edges
  // eaten.
  const mask =
    cutout && !sized
      ? 'radial-gradient(ellipse 46% 58% at 50% 46%, #000 58%, rgba(0,0,0,0.55) 78%, rgba(0,0,0,0) 96%)'
      : undefined;

  const filter = [
    blacken ? 'brightness(0)' : '',
    blur > 0 ? `blur(${blur}px)` : '',
    desaturate > 0 ? `grayscale(${desaturate})` : '',
    cutout && !blacken ? 'drop-shadow(-14px 18px 26px rgba(0,0,0,0.45))' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const transform = `translate(${translateX}px, ${translateY}px) scale(${scale * life.scale}) rotate(${rotate + life.rotate}deg)`;

  if (sized) {
    const standX = footX ?? width / 2;
    const standY = footY ?? height;
    const byHeight = !plateWidth && (plateHeight ?? 0) > 0;
    return (
      <AbsoluteFill style={style}>
        <div
          style={{
            position: 'absolute',
            width: plateWidth,
            height: plateHeight,
            left: standX,
            bottom: height - standY,
            transformOrigin: origin,
            // The half-width shift is what stands the plate ON the point rather
            // than beside it. It sits outside the scale, so it stays a constant
            // centring offset while the subject grows about its feet.
            transform: `translateX(-50%) ${transform}`,
            filter,
            opacity,
          }}
        >
          {src ? (
            <Img
              src={staticFile(src)}
              style={
                byHeight
                  ? {height: '100%', width: 'auto', display: 'block', objectFit: fit}
                  : {width: '100%', display: 'block', objectFit: fit}
              }
            />
          ) : null}
          {children}
        </div>
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill
      style={{
        transformOrigin: origin,
        transform,
        filter,
        opacity,
        WebkitMaskImage: mask,
        maskImage: mask,
        ...style,
      }}
    >
      {src ? <Img src={staticFile(src)} style={{width: '100%', height: '100%', objectFit: fit}} /> : null}
      {children}
    </AbsoluteFill>
  );
};
