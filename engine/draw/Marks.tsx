import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {Annotation, type MarkKind} from './Annotation';
import {posterizeTime} from '../motion';

/**
 * THE POINTING FINGER — arrows, circles and labels that land ON something.
 *
 * The reel had marks already: a mark per scene, placed by the planner near the
 * caption. That is a DECORATION — it says "this frame is evidence". It cannot
 * say "look at THAT", which is the entire grammar of an explainer cut: the
 * picture is already showing the thing, and the edit's whole job is to point at
 * the part of it that matters and name it.
 *
 * So a mark here is aimed at a POINT, and three rules make it read as an edit
 * rather than an overlay:
 *
 *   THE ARROW'S HEAD IS THE TARGET.  A box centred on the thing is a circle; an
 *                     arrow centred on the thing points past it. The head lands
 *                     on the point and the tail swings away by `aim`, so the
 *                     mark comes in from wherever there is room.
 *   IT DRAWS ITSELF.  Inherited from Annotation, and the reason it looks like a
 *                     hand rather than a lower third.
 *   THE LABEL WAITS.  Text appears once the stroke has arrived, not with it —
 *                     two things starting together read as one graphic sliding
 *                     on, which is what a template does.
 */
export type MarkSpec = {
  kind?: MarkKind;
  /** The point being pointed AT, in scene pixels. */
  x: number;
  y: number;
  width: number;
  height?: number;
  /** Degrees the arrow's tail swings away from its head. 0 = tail down-left. */
  aim?: number;
  colour?: string;
  thickness?: number;
  from?: number;
  over?: number;
  /** What the mark says. Optional: a circle around the thing often says enough. */
  text?: string;
  textSize?: number;
};

/** Where Annotation puts an arrow's head inside its own box. */
const HEAD_INSET = 18;
const HEAD_DROP = 12;
/** Which half of the frame a mark is in decides which side its label takes. */
const FRAME_MID = 960;

export const Marks: React.FC<{marks?: MarkSpec[]; seed?: string}> = ({marks, seed = 'mark'}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const stepped = posterizeTime(frame, fps, 12);
  if (!marks?.length) return null;

  return (
    <>
      {marks.map((mark, i) => {
        const kind = mark.kind ?? 'arrow';
        const width = mark.width;
        const height = mark.height ?? Math.round(width * 0.62);
        const from = mark.from ?? 0;
        const over = mark.over ?? 12;
        const thickness = mark.thickness ?? 10;
        const pad = thickness * 2;
        const arrow = kind === 'arrow';

        /**
         * An arrow is placed by its HEAD, everything else by its CENTRE. Both
         * are then given to Annotation as its own top-left corner, which is the
         * one thing it knows how to take.
         */
        const x = arrow ? mark.x - width + HEAD_INSET : mark.x - width / 2;
        const y = arrow ? mark.y - HEAD_DROP : mark.y - height / 2;

        /**
         * THE PIVOT IS THE TARGET, IN FRAME COORDINATES.
         *
         * The rotation is applied to a layer the size of the whole frame, so an
         * origin measured from the mark's own box pivots around a point near
         * the top-left of the SHOT instead — which swings the arrow clean off
         * the thing and parks it on the edge of the picture. Rotating the layer
         * about the target keeps the head nailed there and swings only the
         * tail, which is what `aim` means.
         */
        const aim = mark.aim ?? 0;
        const origin = `${mark.x}px ${mark.y}px`;

        /**
         * THE LABEL SITS CLEAR OF THE MARK, on the side with room: under the
         * target in the top half of the frame, over it in the bottom half. It
         * used to be placed along the aim angle, which put it inside the ring
         * it was labelling as often as beside it.
         */
        const gap = Math.round((arrow ? height : height / 2) * 0.5) + 54;
        const below = mark.y < FRAME_MID;
        const labelX = Math.min(Math.max(mark.x, 220), 1080 - 220);
        const labelY = below ? mark.y + gap : mark.y - gap;
        const shown = stepped >= from + over;

        return (
          <AbsoluteFill key={`${kind}-${i}`} style={{pointerEvents: 'none'}}>
            <div style={{position: 'absolute', inset: 0, transform: `rotate(${aim}deg)`, transformOrigin: origin}}>
              <Annotation
                kind={kind}
                x={x}
                y={y}
                width={width}
                height={height}
                colour={mark.colour}
                thickness={thickness}
                from={from}
                over={over}
                seed={`${seed}-${i}`}
              />
            </div>
            {mark.text && shown ? (
              <div
                style={{
                  position: 'absolute',
                  left: labelX,
                  top: labelY,
                  transform: 'translate(-50%, -50%)',
                  maxWidth: '62%',
                  padding: '10px 18px',
                  background: 'rgba(12,11,10,0.72)',
                  color: mark.colour ?? '#ffcf3d',
                  font: `700 ${mark.textSize ?? 46}px/1.15 "Helvetica Neue", Helvetica, Arial, sans-serif`,
                  letterSpacing: '0.01em',
                  textAlign: 'center',
                  textWrap: 'balance',
                }}
              >
                {mark.text}
              </div>
            ) : null}
          </AbsoluteFill>
        );
      })}
    </>
  );
};
