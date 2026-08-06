import React from 'react';
import {AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {CLAMP, posterizeTime} from './motion';

/**
 * HOW A SHOT ARRIVES.
 *
 * Every cut in this reel was hard, which is a decision nobody made — it is what
 * you get when scenes are laid end to end and nothing is said about the seam.
 * Ten scenes of hard cuts read as a slideshow however good the frames are.
 *
 * These are OURS, not borrowed. The reference reel's language is a zoom flying
 * through a picture frame; ours is a case file being worked: paper landing on a
 * desk, a photograph pushed across it, a lamp catching, a lens finding focus,
 * blinds opening on a room. Same grammar of arrival, different vocabulary.
 *
 * A transition only ever touches the INCOMING scene. Cross-fading two scenes
 * means overlapping them on the timeline, and an overlap makes every duration
 * in the config a lie — the reel would no longer be the sum of its scenes,
 * which is the one arithmetic everything else here depends on.
 */
export type TransitionKind = 'cut' | 'slam' | 'slip' | 'flare' | 'rack' | 'blinds';

export const Transition: React.FC<{
  kind?: TransitionKind;
  frames?: number;
  children: React.ReactNode;
}> = ({kind = 'cut', frames = 12, children}) => {
  const frame = useCurrentFrame();
  const {fps, height} = useVideoConfig();
  const stepped = posterizeTime(frame, fps, 12);
  const t = interpolate(stepped, [0, frames], [0, 1], {...CLAMP, easing: Easing.out(Easing.cubic)});

  if (kind === 'cut' || stepped > frames + 2) return <>{children}</>;

  // SLAM — a file dropped flat on a desk. Comes in fast from below, lands
  // heavy, and the frame takes the hit: a moment of blur, a moment of overshoot.
  if (kind === 'slam') {
    const drop = interpolate(stepped, [0, frames], [-height * 0.14, 0], {
      ...CLAMP,
      easing: Easing.out(Easing.back(1.7)),
    });
    const smack = interpolate(stepped, [0, frames * 0.55, frames], [14, 4, 0], CLAMP);
    return (
      <AbsoluteFill style={{transform: `translateY(${drop}px)`, filter: smack > 0.4 ? `blur(${smack}px)` : undefined}}>
        {children}
      </AbsoluteFill>
    );
  }

  // SLIP — a photograph pushed across the table into view, with the darkness of
  // the edge it came from still on it for a beat.
  if (kind === 'slip') {
    const slide = interpolate(stepped, [0, frames], [-260, 0], {...CLAMP, easing: Easing.out(Easing.cubic)});
    const edge = interpolate(stepped, [0, frames], [1, 0], CLAMP);
    return (
      <AbsoluteFill style={{transform: `translateX(${slide}px)`}}>
        {children}
        <AbsoluteFill
          style={{
            background: `linear-gradient(90deg, rgba(4,3,2,${0.85 * edge}) 0%, transparent ${18 + 40 * (1 - edge)}%)`,
            pointerEvents: 'none',
          }}
        />
      </AbsoluteFill>
    );
  }

  // FLARE — a splice in the print. Two frames of blown highlight, then gone.
  // Deliberately brief: held even a little too long it stops being a splice and
  // becomes a dissolve, which is the softest cut there is and the wrong one here.
  if (kind === 'flare') {
    const burn = interpolate(stepped, [0, 2, frames * 0.6], [1, 0.55, 0], CLAMP);
    const pop = interpolate(stepped, [0, frames], [1.035, 1], CLAMP);
    return (
      <AbsoluteFill style={{transform: `scale(${pop})`}}>
        {children}
        <AbsoluteFill style={{background: `rgba(255,241,214,${burn * 0.8})`, mixBlendMode: 'screen'}} />
      </AbsoluteFill>
    );
  }

  // RACK — the lens has not found it yet. Arrives soft and snaps.
  if (kind === 'rack') {
    const soft = interpolate(stepped, [0, frames], [22, 0], {...CLAMP, easing: Easing.out(Easing.quad)});
    return (
      <AbsoluteFill style={{filter: soft > 0.4 ? `blur(${soft}px)` : undefined, transform: `scale(${1 + soft * 0.002})`}}>
        {children}
      </AbsoluteFill>
    );
  }

  // BLINDS — the slats open on the room. The one device in here that is pure
  // police-office, and the reason it earns its place is that it is a WIPE with
  // a texture rather than a fade: the shot is revealed in strips.
  const open = t;
  const slat = 100 / 9;
  return (
    <AbsoluteFill>
      {children}
      <AbsoluteFill
        style={{
          background:
            `repeating-linear-gradient(180deg, rgba(3,2,1,0.97) 0 ${slat * (1 - open)}%, ` +
            `transparent ${slat * (1 - open)}% ${slat}%)`,
          pointerEvents: 'none',
        }}
      />
    </AbsoluteFill>
  );
};
