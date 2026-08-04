import React from 'react';
import {AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import type {Shot} from '../schema';
import {CLAMP, posterizeTime} from './motion';

/**
 * THE CAMERA.
 *
 * Takes the shot the edit planned (`src/story/shotPlan.js`) and executes it:
 * where the frame sits, how tight it is, how it moves, and what is in focus.
 *
 * Two things here do most of the work of making a frame look photographed:
 *
 * PERSPECTIVE FROM THE LENS. A short lens is close to its subject and bends the
 * space around it; a long lens is far away and flattens it. Feeding the focal
 * length into a CSS `perspective` gives the set the same difference, so a 24mm
 * beat and an 85mm beat are not the same picture at two zoom levels.
 *
 * DEPTH OF FIELD. Nothing in real footage is uniformly sharp. The scene is
 * blurred progressively toward the edges of the frame — cheap, but it reads as
 * a lens wide open, and it forces the eye to the one place that is sharp.
 */
export const Camera: React.FC<React.PropsWithChildren<{shot?: Shot; durationInFrames: number}>> = ({
  children,
  shot,
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const stepped = posterizeTime(frame, fps, 12);

  if (!shot) return <AbsoluteFill>{children}</AbsoluteFill>;

  const progress = interpolate(stepped, [0, Math.max(1, durationInFrames)], [0, 1], CLAMP);
  const ease = Easing.inOut(Easing.quad);

  // The move. `travel` is how far it goes; the ease keeps it from starting and
  // stopping abruptly, which is what a tripod head actually does.
  const eased = ease(progress);
  const base = 1 + (1 - shot.subject) * 0.24;
  const zoom =
    shot.move === 'push' ? base + shot.travel * eased :
    shot.move === 'pull' ? base + shot.travel - shot.travel * eased :
    base;

  const driftX = shot.move === 'drift' ? (eased - 0.5) * 70 * (shot.placement === 'right-third' ? -1 : 1) : 0;
  // Handheld: two out-of-phase sines so it never reads as a clean oscillation.
  const shakeX = shot.shake ? Math.sin(stepped * 0.41) * shot.shake + Math.sin(stepped * 0.17) * shot.shake * 0.5 : 0;
  const shakeY = shot.shake ? Math.cos(stepped * 0.33) * shot.shake * 0.8 : 0;

  // Where the subject sits. Thirds, not centre — centre is reserved for the
  // closing beat, where stillness is the point.
  const anchorX = shot.placement === 'left-third' ? 34 : shot.placement === 'right-third' ? 66 : 50;
  const anchorY = shot.height * 100;

  return (
    <AbsoluteFill style={{overflow: 'hidden'}}>
      <AbsoluteFill
        style={{
          transformOrigin: `${anchorX}% ${anchorY}%`,
          transform: `perspective(${1400 - shot.lens * 6}px) scale(${zoom}) translate(${driftX + shakeX}px, ${shakeY}px)`,
        }}
      >
        {children}
      </AbsoluteFill>

      {/* DEPTH OF FIELD — a soft copy of the frame, masked back in away from
          the focal point. The tighter the shot, the shallower it goes. */}
      {shot.dof > 0.1 ? (
        <AbsoluteFill
          style={{
            pointerEvents: 'none',
            transformOrigin: `${anchorX}% ${anchorY}%`,
            transform: `perspective(${1400 - shot.lens * 6}px) scale(${zoom * 1.01}) translate(${driftX + shakeX}px, ${shakeY}px)`,
            filter: `blur(${shot.dof * 9}px)`,
            WebkitMaskImage: `radial-gradient(ellipse ${70 - shot.dof * 26}% ${64 - shot.dof * 22}% at ${anchorX}% ${anchorY}%, rgba(0,0,0,0) 30%, #000 100%)`,
            maskImage: `radial-gradient(ellipse ${70 - shot.dof * 26}% ${64 - shot.dof * 22}% at ${anchorX}% ${anchorY}%, rgba(0,0,0,0) 30%, #000 100%)`,
          }}
        >
          {children}
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  );
};
