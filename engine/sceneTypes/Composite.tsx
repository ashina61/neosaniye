import React from 'react';
import {AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import type {SceneProps} from './types';
import type {LayerSpec} from '../schema';
import {boil, dampedSwing, focusHunt, holdKeyframes, posterizeTime, springEntrance} from '../motion';
import {cameraFromParams, useCamera} from '../Camera';
import {Fog, Glow} from '../draw/Glow';
import {WordStack} from '../draw/Type';
import {Diagram, type DiagramSpec} from '../draw/Diagram';
import type {EmphasisMark, Reveal} from '../draw/Kinetic';
import {Annotation, type MarkKind} from '../draw/Annotation';
import {SceneMotif} from '../draw/Motif';
import {DrawnProps} from '../draw/Props';
import {Field, type FieldKind} from '../draw/Field';

/**
 * A COMPOSED SHOT — as many layers as the scene declares.
 *
 * The template the rest of them should have been. A shot is not a photograph;
 * it is a stack of pieces, and the reference kit is the proof: its opening
 * frame is a sky, two cut-out clouds drifting at different speeds, a cut-out
 * building, a figure, a frame and a paper texture. Seven files, not one of them
 * a whole picture.
 *
 * Everything here follows from ONE NUMBER PER LAYER:
 *
 *   DEPTH   how much of the camera's push this layer takes. The sky at 0 does
 *           not move; the subject at 1 takes all of it; the building at 0.5
 *           takes half. Unequal scaling about a shared floor point is the
 *           entire depth illusion, and with a whole stack it stops being a
 *           trick and becomes a space.
 *
 * Everything scales about the SAME anchor. Give each layer its own centre and
 * they slide against each other instead of holding together as one room — the
 * single most common way this effect falls apart.
 */
export const Composite: React.FC<SceneProps> = ({scene, assets, durationInFrames}) => {
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

  const anchorX = num('anchorX', Math.round(width * 0.52));
  const anchorY = num('anchorY', Math.round(height * 0.88));
  const origin = `${(anchorX / width) * 100}% ${(anchorY / height) * 100}%`;

  // ONE camera move for the whole stack. Each layer takes the fraction of it
  // its depth allows, which is what keeps them in the same space.
  //
  // A shot may also PULL BACK — start close and open out. Two pushes in a row
  // on the same plate read as one continuous move with a stutter in the middle;
  // a push then a pull reads as two shots, which is what they are. Both ends
  // stay at or above 1 so a fill layer never shrinks inside the frame.
  //
  // And a push is not the only move a camera has. Pan, roll, handheld breath
  // and impact all live in the same object now, so a shot can travel PAST its
  // subject instead of only toward it — which is the difference between six
  // shots that move and six shots that move identically.
  const camera = useCamera(cameraFromParams(scene.params, durationInFrames), durationInFrames);
  const push = camera.push;
  const blur = focusHunt(stepped, durationInFrames, {maxPx: num('focusPx', 0), dipAt: 0.34, dipBack: 0.46});

  const layers = (scene.layers ?? []).filter((layer) => !layer.role || assets[layer.role]);
  const caption = list('caption');
  const mark = str('mark', '') as MarkKind | '';

  const draw = (layer: LayerSpec, key: string, asShadow = false) => {
    const src = layer.role ? assets[layer.role] : undefined;
    if (!src) return null;

    const depth = layer.depth ?? 1;
    const scale = camera.scaleAt(depth);
    // The camera's own travel at this depth, plus whatever this layer is doing
    // on its own account. A cloud drifts because it is a cloud; the frame moves
    // because somebody moved it. They add.
    const shot = camera.offsetAt(depth);
    const drift = shot.x + ((layer.drift ?? 0) * stepped) / Math.max(1, durationInFrames);
    const driftY = shot.y + ((layer.driftY ?? 0) * stepped) / Math.max(1, durationInFrames);
    const life = layer.alive ? boil(stepped, {phase: key.length * 11}) : {scale: 1, rotate: 0};
    const enter =
      layer.from === undefined ? 1 : springEntrance(stepped, fps, {delay: layer.from, stiffness: 48, mass: 1});
    if (enter <= 0.001) return null;

    /**
     * THE LAYER'S OWN MOVE. The camera push is shared; this is not.
     *
     * A plate that only rides the push can do one thing, and six of them doing
     * that one thing together is a photograph with extra files behind it. The
     * reference's offer scene is two hands entering from OPPOSITE edges a
     * second apart — same backdrop, same push, and it reads as an event purely
     * because each plate travels on its own from its own side.
     */
    const travel = layer.enter ? (1 - enter) * (layer.enterDistance ?? width * 0.9) : 0;
    const enterX = layer.enter === 'left' ? -travel : layer.enter === 'right' ? travel : 0;
    const enterY = layer.enter === 'top' ? -travel : layer.enter === 'bottom' ? travel : 0;
    // A decaying swing about its own base — it swings hard, then settles. A
    // constant wobble is a loop; the decay is what makes it an arrival.
    const swing = layer.swing
      ? dampedSwing(stepped, {amplitude: layer.swing, rate: 0.5, decay: 0.05, delay: layer.from ?? 0})
      : 0;

    // THE HIGHLIGHT IS THE LAYER AGAIN. Same artwork, recoloured, switched on
    // and off on HOLD keyframes — instant, never a fade, because the whole
    // character of it is that there is no ramp. A layer that asks to flicker
    // and is currently off is not drawn at all; leaving it up at zero opacity
    // would still cost a composite pass on every frame of the shot.
    const lit = layer.flicker ? holdKeyframes(stepped, layer.flicker) : true;
    if (layer.recolour && !lit) return null;

    const anchor = layer.anchor ?? (layer.width || layer.height ? 'bottom' : 'fill');
    const common: React.CSSProperties = {
      filter: [
        asShadow ? 'brightness(0)' : '',
        !asShadow && layer.recolour ? layer.recolour : '',
        (layer.blur ?? 0) > 0 ? `blur(${layer.blur}px)` : '',
        asShadow ? `blur(${layer.shadowSkew !== undefined ? 8 : 8}px)` : '',
      ]
        .filter(Boolean)
        .join(' '),
      opacity: (asShadow ? (layer.shadowOpacity ?? 0.5) : (layer.opacity ?? 1)) * enter,
      mixBlendMode: layer.blend === 'screen' ? 'screen' : undefined,
    };

    if (anchor === 'fill') {
      return (
        <AbsoluteFill
          key={key}
          style={{
            ...common,
            transformOrigin: origin,
            transform:
              `translate(${drift + enterX}px, ${driftY + enterY}px) ` +
              `scale(${scale * life.scale}) rotate(${swing + camera.rotate}deg)`,
          }}
        >
          <Img src={staticFile(src)} style={{width: '100%', height: '100%', objectFit: 'cover'}} />
        </AbsoluteFill>
      );
    }

    const standX = layer.x ?? width / 2;
    const standY = layer.y ?? height;
    const box: React.CSSProperties = {
      position: 'absolute',
      width: layer.width,
      height: layer.height,
      left: standX,
      // A shadow is the layer again, flipped down from the very point the layer
      // stands on and laid along the ground. Never a second file.
      transformOrigin: anchor === 'bottom' ? '50% 100%' : '50% 50%',
      transform:
        `translate(-50%, ${anchor === 'bottom' ? '0' : '-50%'}) ` +
        `translate(${drift + enterX}px, ${driftY + enterY}px) ` +
        `scale(${scale * life.scale}) ` +
        (asShadow ? `scaleY(-0.55) skewX(${layer.shadowSkew ?? -53}deg) ` : '') +
        `rotate(${(layer.rotate ?? 0) + life.rotate + swing + camera.rotate}deg)`,
      ...common,
    };
    if (anchor === 'bottom') box.bottom = height - standY;
    else box.top = standY;

    /**
     * A PIECE NEVER COVERS THE FRAME — and it is the ENGINE that guarantees it,
     * not the config that promises it.
     *
     * A layer asks for a HEIGHT and the width used to follow the artwork's
     * aspect with nothing stopping it. Piece artwork is drawn on a landscape
     * canvas, so a piece standing 970px tall came out 1500px WIDE in a 1080px
     * frame: one object covering the shot, with the backdrop and every other
     * layer behind it and nothing able to move in front. Depth dies, and the
     * stack that was just built is invisible underneath it.
     *
     * Capping both sides on the IMG rather than the box keeps the aspect — the
     * artwork scales down to fit whichever limit it hits first — and lets the
     * box shrink-wrap, which is what the translate(-50%) centring is measured
     * against.
     *
     * THE CAP RIDES DEPTH, because a flat cap silently flattens the stack. On
     * landscape artwork the width limit binds before the height one, so a
     * single number capped the far piece and the near piece to exactly the same
     * size — three layers at three depths rendering identically, which looks
     * like the bug it replaced. A near piece is allowed to be big; that is what
     * near means.
     */
    const cap = num('pieceMaxWidth', Math.round(width * (0.3 + (layer.depth ?? 1) * 0.38)));
    return (
      <div key={key} style={box}>
        <Img
          src={staticFile(src)}
          style={
            layer.height && !layer.width
              ? {maxHeight: '100%', maxWidth: cap, width: 'auto', height: 'auto', display: 'block'}
              : {width: '100%', maxWidth: cap, display: 'block'}
          }
        />
      </div>
    );
  };

  return (
    <AbsoluteFill style={{filter: blur > 0.4 ? `blur(${blur}px)` : undefined}}>
      {/**
       * A GROUND THAT IS NOT A PHOTOGRAPH.
       *
       * The one capability the director needed and the engine did not have.
       * When the asset director REFUSES a plate — because the picture is of the
       * wrong thing, which is a decision no amount of motion can rescue — the
       * shot still needs something under it. Without this, a refusal meant an
       * empty frame, so the only way to keep a shot alive was to use the wrong
       * photograph, which is the failure the refusal exists to prevent.
       *
       * It sits behind the stack rather than replacing it, so a shot may also
       * use it as a ground under partial artwork. It takes no part in the
       * camera push: it is the surface the shot is drawn ON, not a thing in the
       * room, and a drawn field that parallaxes reads as a sliding backdrop.
       */}
      {str('field', '') ? (
        <Field
          kind={str('field', 'wash') as FieldKind}
          colours={list('fieldColours').length === 3 ? list('fieldColours') : undefined}
          seed={scene.id}
        />
      ) : null}

      {layers.map((layer, index) => (
        <React.Fragment key={`${layer.role}-${index}`}>
          {layer.shadow ? draw(layer, `shadow-${index}`, true) : null}
          {draw(layer, `layer-${index}`)}
        </React.Fragment>
      ))}

      {num('glowSize', 0) > 0 ? (
        <AbsoluteFill style={{transformOrigin: origin, transform: `scale(${1 + (push - 1) * num('glowDepth', 1)})`}}>
          <Glow
            x={num('glowX', Math.round(width * 0.5))}
            y={num('glowY', Math.round(height * 0.3))}
            size={num('glowSize', 0)}
            intensity={num('glowIntensity', 0.9)}
            warm={str('glowWarm', '#ffb457')}
            defocus={blur}
            // No plate means no lamp, and a core with no lamp under it is a
            // white ball hanging in the frame rather than a light in a room.
            core={layers.length > 0}
          />
        </AbsoluteFill>
      ) : null}

      {/* THE DRAWN OBJECTS IN THE ROOM. In front of the photographic plates and
          behind the atmosphere, because a plaque on a wall has air in front of
          it like everything else does. They take the push their depth allows
          and scale about the same floor point the plates do. */}
      <DrawnProps props={scene.props} push={push} origin={origin} accent={str('accent', '#f2b53a')} />

      {/* Atmosphere is drawn, in front of the stack. A generated haze plate
          came back as a grey landscape, and screen-blending that does not add
          fog to a shot — it washes the frame out. */}
      <Fog
        frame={stepped}
        amount={num('fog', 0)}
        colour={str('fogColour', '#cfd6dc')}
        speed={num('fogSpeed', 1)}
        height={num('fogHeight', 0.62)}
      />

      {/* IN FRONT OF THE ROOM, BEHIND THE WORDS. The motif is the graphic
          layer: it takes no part in the camera push, because a thing that is
          anchored to the room and drawn on top of it is not a graphic, it is a
          prop that is sliding. */}
      {/**
        * THE DRAWN VISUAL, in front of the room and behind the words.
        *
        * Where the asset director refused every photograph, this IS the shot —
        * a meshing gear train, a timeline of the years nobody looked, the
        * geometry of an eclipse. Where a photograph survived, it lies over it
        * as annotation, which is the hybrid this pipeline is aiming at: a true
        * picture with a true diagram on it, neither pretending to be the other.
        *
        * It is pinned to the frame and takes no part in the camera push, for
        * the same reason a motif is: a drawing that parallaxes stops being a
        * drawing and becomes a prop sliding around the room.
        */}
      <Diagram spec={scene.diagram as DiagramSpec | undefined} />

      <SceneMotif
        params={scene.params}
        seed={scene.id}
        durationInFrames={durationInFrames}
        accent={str('accent', '#f2b53a')}
        defaultY={Math.round(height * 0.82)}
      />

      {caption.length ? (
        <WordStack
          lines={caption}
          /* WHICH WORD THE LINE IS FOR, and how the words arrive. Set by the
             director; absent means the older behaviour, a line at a time. */
          emphasis={str('captionEmphasis', '') || undefined}
          emphasisMark={str('captionMark', 'none') as EmphasisMark}
          reveal={str('captionReveal', 'rise') as Reveal}
          wordEvery={num('captionWordEvery', 3)}
          x={num('captionX', 84)}
          y={num('captionY', 430)}
          from={num('captionFrame', 10)}
          every={num('captionEvery', 6)}
          size={num('captionSize', 92)}
          align={str('captionAlign', 'left') as 'left' | 'right' | 'center'}
          recedeAt={num('captionRecedeAt', 70)}
          accent={num('captionAccent', -1) >= 0 ? num('captionAccent', -1) : undefined}
          scrim={num('captionScrim', 0)}
        />
      ) : null}

      {mark ? (
        <Annotation
          kind={mark}
          x={num('markX', 84)}
          y={num('markY', Math.round(height * 0.42))}
          width={num('markWidth', 460)}
          height={num('markHeight', 96)}
          from={num('markFrame', 60)}
          seed={scene.id}
        />
      ) : null}
    </AbsoluteFill>
  );
};
