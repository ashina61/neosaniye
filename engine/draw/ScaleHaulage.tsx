/**
 * SCALE AND HAULAGE — how big it is, and how it was moved.
 *
 * Two claims that always travel together and that a photograph handles badly.
 * A picture of a megalith is a picture of a grey wall until something human
 * stands next to it; and "they rolled it on hardwood, level, with a thousand
 * men on the ropes" is a claim about a MECHANISM that no surviving photograph
 * or object can show, because the timber and the rope rotted two thousand
 * years ago.
 *
 * TWO RULES SHAPE THIS FILE.
 *
 * 1. SCALE NEEDS A HUMAN. The figure is not decoration; it is the unit. Drawn
 *    at a stated height so the block's size is derived from it rather than
 *    asserted — which is also why the figure is a plain silhouette: a detailed
 *    person invites you to look at the person.
 *
 * 2. AN UNCERTAIN MECHANISM SAYS SO. Nobody knows exactly how the Baalbek
 *    trilithon was moved. Drawing rollers and capstans and captioning it
 *    SCHEMATIC RECONSTRUCTION would present one hypothesis as the record. The
 *    plate here defaults to ILLUSTRATIVE RECONSTRUCTION, which is a different
 *    and weaker claim, and the caller is expected to leave it that way unless
 *    the method is actually documented.
 */
import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {angular, drawOn, hash01, heavy, posterizeTime, tension} from '../motion';
import {counterValue} from '../state.mjs';
import {Contact, Depth, GroundPlane, Haze, MaterialDefs, MaterialFace, Motes, Sky} from './material';
import {Arrow, Callout, Cam, Disclosure, MONO, SANS, Sheet, Ticks, setUp, weights, worldTransform} from './sheet';

const CLAMP = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

export type ScaleHaulageSpec = Sheet & {
  type: 'scaleHaulage';
  /** The thing being moved. Width and height as fractions of the frame. */
  object: {w: number; h: number; label?: string; mass?: string};
  /** How tall a person is, as a fraction of the frame height. THE unit. */
  humanHeight?: number;
  /** How many figures to draw, spread along the load. */
  humans?: number;
  /** The gear under it. Each is a claim and each is drawn as one. */
  rollers?: number;
  sledge?: boolean;
  /** Degrees of incline. A ramp is a different claim from a level haul. */
  ramp?: number;
  /** Ropes going forward off the frame, with the pull they represent. */
  ropes?: number;
  /** Force arrows: where the effort is applied and which way. */
  forces?: {x: number; y: number; angle: number; label?: string}[];
  /** How far it travels across the frame while we watch, 0..1. */
  travel?: number;
  /** A figure to count up beside the load — tons, men, days. */
  figure?: {value: number; unit?: string; label?: string; at?: number; over?: number};
  /** A distance bar under the ground line. */
  distance?: {label: string};
  annotations?: {x: number; y: number; text: string; side?: 'left' | 'right'; at?: number}[];
};

/**
 * A PERSON, AS A UNIT OF MEASUREMENT.
 *
 * Deliberately the plainest silhouette that still reads as a human at
 * thumbnail size: head, shoulders, two legs. Anything more and the eye goes to
 * the figure instead of to the thing it is there to measure.
 */
const Figure: React.FC<{x: number; y: number; height: number; colour: string; lean?: number; w: number}> = ({
  x,
  y,
  height,
  colour,
  lean = 0,
  w,
}) => {
  const head = height * 0.15;
  const line = weights(w);
  return (
    <g transform={`translate(${x} ${y}) rotate(${lean})`}>
      <circle cx={0} cy={-height + head} r={head} fill={colour} />
      <line x1={0} y1={-height + head * 2} x2={0} y2={-height * 0.42} stroke={colour} strokeWidth={line.object} />
      <line x1={0} y1={-height * 0.42} x2={-height * 0.13} y2={0} stroke={colour} strokeWidth={line.object} />
      <line x1={0} y1={-height * 0.42} x2={height * 0.13} y2={0} stroke={colour} strokeWidth={line.object} />
      <line
        x1={0}
        y1={-height * 0.72}
        x2={height * 0.26}
        y2={-height * 0.6}
        stroke={colour}
        strokeWidth={line.detail}
      />
    </g>
  );
};

export const ScaleHaulagePlate: React.FC<{spec: ScaleHaulageSpec; w: number; h: number; cam?: Cam}> = ({spec, w, h, cam}) => {
  /** The camera looks AT the world and THROUGH the sheet. */
  const world = worldTransform(cam, w, h);
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const stepped = posterizeTime(frame, fps, 12);
  const from = spec.from ?? 0;
  const over = spec.over ?? 34;
  const accent = spec.accent ?? '#f2b53a';
  const muted = spec.muted ?? '#cfc6ae';
  const line = weights(w);
  if (stepped < from) return null;

  const on = setUp(stepped, from);
  const t = Math.max(0, stepped - from);

  /**
   * THE GROUND LINE IS THE SHEET.
   *
   * Present at frame zero with the block already standing on it, so the cut
   * lands on a composed figure and what happens afterwards is the MOVEMENT —
   * which is the claim. A block that assembles itself out of nothing has spent
   * the shot's opening on the wrong idea.
   */
  const ground = h * 0.62;
  const ramp = spec.ramp ?? 0;
  const rad = (ramp * Math.PI) / 180;

  const objW = spec.object.w * w;
  const objH = spec.object.h * h;
  const rollerR = Math.max(w * 0.012, objH * 0.09);
  const sledgeH = spec.sledge ? objH * 0.1 : 0;

  const travel = (spec.travel ?? 0.16) * w;
  // It moves SLOWLY and never arrives: the point of the sentence is usually
  // that this took months. A block that crosses the frame has contradicted it.
  /**
   * A THOUSAND TONS DOES NOT EASE LIKE A MENU.
   *
   * Linear travel says the block is on wheels; a cubic ease says it is a
   * dialog box. `heavy` at mass 3 spends most of the shot getting started and
   * most of the rest failing to stop, which is what the sentence is about.
   */
  const moved = heavy(Math.min(1, t / Math.max(1, over * 1.8)), 3) * travel;
  /**
   * THE LOAD STARTS CLEAR OF THE SCALE REFERENCE.
   *
   * The standing figure that gives the block its size lives at the left margin,
   * and the haulers stand just ahead of the load. At 0.32 the load's front edge
   * reached back to 0.11 and the haulers were drawn on top of the reference —
   * two figures in the same place, one of them a measuring instrument.
   */
  const humanH = (spec.humanHeight ?? 0.075) * h;
  const humans = Math.max(0, spec.humans ?? 2);

  /**
   * WHICH WAY IT GOES, AND WHY IT WAS GOING THE WRONG WAY.
   *
   * Every other part of this drawing was built for a load travelling LEFT: the
   * haulers stand off the left edge leaning into it, the ropes leave the left
   * face and run out of frame, the force arrow points left and is labelled
   * PULL. The position was `startX + moved`. So the men leaned into a rope,
   * the arrow said PULL, and the block slid the other way — a shot about cause
   * and effect in which the effect contradicted the cause, on screen, for
   * fourteen shots.
   *
   * AND THE FRAME IS BUDGETED, NOT ASSUMED. Once the load was drawn at its true
   * size it filled four fifths of the width, and the first arrangement simply
   * pinned it to the right margin: the haulers went off the left edge, taking
   * the only figure in the shot with them, and a drawing whose subject is scale
   * delivered a rectangle with no reference in it. The width is spent in order
   * — men first, because they are the reading, then the load, and whatever is
   * left over becomes travel.
   */
  const margin = w * 0.07;
  /** What the haulers need to the left of the load, including their own width. */
  const leadPad = w * (0.05 + Math.max(0, humans - 1) * 0.045) + w * 0.035;
  const endLeft = margin + leadPad;
  const travelPx = Math.max(0, Math.min(travel, w - margin - endLeft - objW));
  const startX = endLeft + travelPx + objW / 2;
  const x = startX - Math.min(moved, travelPx);
  /**
   * THE BLOCK STANDS ON THE GROUND, NOT IN IT.
   *
   * `baseY` is the TOP of the object, so the support height has to be added to
   * its own height to find it. Subtracting only the support put the rectangle's
   * top a few pixels above the ground line and its whole body below — a
   * thousand-ton block buried in the road, in a drawing whose entire subject is
   * that it was never lowered into anything.
   */
  const support = (spec.rollers ?? 0) > 0 ? rollerR * 2 : 0;
  const baseY = ground - support - sledgeH - objH;

  /**
   * THE CAMERA, SHARED BY EVERY PLANE.
   *
   * One number. The far ground takes a sixth of it, the load takes all of it,
   * the dust in front takes half again — and the difference between those rates
   * is the only reason a flat drawing reads as a space. A push that scales
   * everything equally is a zoom.
   */
  // The plate's OWN push, which is what drives the parallax between planes:
  // the world transform from the shot's camera scales every plane equally and
  // so cannot make a space. This one can, and they compose.
  const parallax = 1 + drawOn(stepped, [from, from + over * 2.2]) * 0.1;
  const anchor: [number, number] = [0.42, 0.62];

  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{position: 'absolute', inset: 0}}>
        <Ticks colour={muted} w={w} h={h} on={on} />

        {/* THE WORLD. Everything below here is what the camera is looking at;
            the ticks above and the plates below are the sheet it is drawn on. */}
        <g transform={world}>

        <MaterialDefs id="haul-stone" material="stone" colour={accent} w={w} seed="haul" />
        <MaterialDefs id="haul-wood" material="wood" colour={muted} w={w} seed="roller" />

        {/**
         * BACKGROUND — a far horizon and the ground plane behind everything.
         *
         * Two lines and a wash. The point is not the mountains; it is that
         * there is something BEHIND the block that moves at a different rate,
         * so the push reveals space instead of enlarging a rectangle.
         */}
        {/* AIR ABOVE, FLOOR BELOW. Neither is an effect: they are the two
            surfaces the drawing is standing between, and without them the
            drawn band hangs in a black rectangle. */}
        <Sky y={ground - h * 0.14} w={w} colour={muted} id="haul-sky" />

        <Depth plane="background" push={parallax} anchor={anchor} w={w} h={h}>
          <path
            d={`M 0 ${ground - h * 0.16} L ${w * 0.22} ${ground - h * 0.21} L ${w * 0.41} ${ground - h * 0.15} ` +
               `L ${w * 0.63} ${ground - h * 0.2} L ${w * 0.84} ${ground - h * 0.145} L ${w} ${ground - h * 0.175} ` +
               `L ${w} ${ground} L 0 ${ground} Z`}
            fill={`${muted}0d`}
            stroke={`${muted}44`}
            strokeWidth={line.construction}
          />
        </Depth>
        <Haze colour={muted} strength={0.05} w={w} h={ground} from={0.2} />

        <g transform={ramp ? `rotate(${-ramp} ${w * 0.1} ${ground})` : undefined}>
          {/* THE GROUND, and the ramp if there is one. */}
          <GroundPlane y={ground} w={w} h={h} colour={muted} id="haul-ground" />
          <line x1={0} y1={ground} x2={w} y2={ground} stroke={muted} strokeWidth={line.detail} />
          {Array.from({length: 40}, (_, i) => (
            <line
              key={i}
              x1={(i / 40) * w}
              y1={ground}
              x2={(i / 40) * w - w * 0.014}
              y2={ground + w * 0.014}
              stroke={muted}
              strokeWidth={line.construction}
              opacity={0.45}
            />
          ))}

          {/* THE ROLLERS, turning at the speed the load is travelling. Not
              decoration: if the block moves and the rollers do not, the drawing
              has contradicted itself. */}
          {Array.from({length: Math.max(0, spec.rollers ?? 0)}, (_, i) => {
            const spacing = objW / Math.max(1, (spec.rollers ?? 1) - 0.001);
            const rx = x - objW / 2 + spacing * (i + 0.5);
            /**
             * THE ROLLER TURNS BECAUSE THE BLOCK MOVED.
             *
             * Not a rotation on a timer. The angle is the distance travelled
             * divided by the radius — the actual relation — so if the load
             * stops the rollers stop, and if it never moves they never turn.
             * That is the difference between causal motion and decoration.
             */
            const spin = (moved / Math.max(1, rollerR)) * 57.3;
            return (
              <g key={`r${i}`} transform={`translate(${rx} ${ground - rollerR})`}>
                <Contact x={0} y={rollerR * 0.98} width={rollerR * 1.6} strength={0.5} />
                <circle cx={0} cy={0} r={rollerR} fill={`${muted}18`} stroke={muted} strokeWidth={line.detail} />
                <MaterialFace id="haul-wood" material="wood" ellipse={{cx: 0, cy: 0, rx: rollerR, ry: rollerR}} w={w} />
                <line
                  x1={0}
                  y1={0}
                  x2={Math.cos((spin * Math.PI) / 180) * rollerR}
                  y2={Math.sin((spin * Math.PI) / 180) * rollerR}
                  stroke={muted}
                  strokeWidth={line.construction}
                />
              </g>
            );
          })}

          {spec.sledge ? (
            <rect
              x={x - objW / 2 - w * 0.012}
              y={baseY + objH}
              width={objW + w * 0.024}
              height={sledgeH}
              fill="none"
              stroke={muted}
              strokeWidth={line.detail}
            />
          ) : null}

          {/**
           * THE OBJECT. The only thing in the frame with a material on it.
           *
           * Cut stone: almost no sheen, heavy tooth, a deep shadow of its own,
           * and a contact shadow where it meets what is carrying it. The
           * contact shadow is the cheapest depth cue in the file and the one
           * whose absence made the first version a sticker.
           */}
          <Contact x={x} y={ground + h * 0.004} width={objW * 1.06} strength={0.85} />
          <rect x={x - objW / 2} y={baseY} width={objW} height={objH} fill="#0d0b09" opacity={0.5} />
          
          <MaterialFace id="haul-stone" material="stone" rect={{x: x - objW / 2, y: baseY, w: objW, h: objH}} w={w} />
          <rect x={x - objW / 2} y={baseY} width={objW} height={objH} fill="none" stroke={accent} strokeWidth={line.emphasis} />
          {/* Two courses of jointing, so it reads as cut stone rather than as a
              rectangle. */}
          {[0.34, 0.68].map((f) => (
            <line
              key={f}
              x1={x - objW / 2}
              y1={baseY + objH * f}
              x2={x + objW / 2}
              y2={baseY + objH * f}
              stroke={accent}
              strokeWidth={line.construction}
              opacity={0.45}
            />
          ))}

          {/* THE ROPES, leaving the frame forward. The load is being pulled from
              somewhere off-picture, which is also true. */}
          {Array.from({length: Math.max(0, spec.ropes ?? 0)}, (_, i) => {
            const ry = baseY + objH * (0.25 + i * 0.22);
            /**
             * A ROPE UNDER LOAD TAKES UP ITS SLACK AND THEN HOLDS.
             *
             * The first version wobbled it on a sine, which is a rope with
             * nothing on the end of it. `tension` pulls the sag out as the haul
             * begins, overshoots once, and settles — and the residual tremor is
             * a fraction of the original because a loaded rope barely moves.
             */
            const pull = tension(Math.min(1, t / Math.max(1, over)));
            const sag = (1 - pull) * w * 0.022 + Math.sin(t / 6 + i) * w * 0.0009;
            return (
              <path
                key={`rope${i}`}
                d={`M ${x - objW / 2} ${ry} Q ${x - objW / 2 - w * 0.14} ${ry + sag + w * 0.01} ${0} ${ry - w * 0.01}`}
                fill="none"
                stroke={muted}
                strokeWidth={line.detail}
                opacity={0.8}
              />
            );
          })}

          {/* THE PEOPLE. The unit, standing on the ground line. */}
          {Array.from({length: humans}, (_, i) => (
            <Figure
              key={`f${i}`}
              // Clear of the standing scale reference at 0.135w, which is a
              // different figure doing a different job.
              x={x - objW / 2 - w * (0.05 + i * 0.045)}
              y={ground}
              height={humanH}
              colour={muted}
              lean={-14}
              w={w}
            />
          ))}

          {/* FORCE. Where the effort goes in and which way it points. */}
          {(spec.forces ?? []).map((force, i) => {
            const fx = x + force.x * objW;
            const fy = baseY + force.y * objH;
            const len = w * 0.07;
            const a = (force.angle * Math.PI) / 180;
            return (
              <g key={`fo${i}`}>
                <Arrow
                  x1={fx}
                  y1={fy}
                  x2={fx + Math.cos(a) * len}
                  y2={fy + Math.sin(a) * len}
                  colour={accent}
                  w={w}
                  at={from + 8 + i * 5}
                  over={10}
                  weight={line.object}
                />
                {force.label ? (
                  /**
                   * THE LABEL IS KEPT IN THE FRAME.
                   *
                   * It sits at the arrow's point, and the arrow points out of
                   * the picture on purpose — the load is being pulled from
                   * somewhere off-screen. So the word followed it out and the
                   * shot delivered "ULL" against the left edge. Past the margin
                   * the text stops travelling with the arrow and anchors to the
                   * side it is on.
                   */
                  (() => {
                    const tipX = fx + Math.cos(a) * len * 1.1;
                    const inner = w * 0.075;
                    const clamped = Math.max(inner, Math.min(w - inner, tipX));
                    const anchored = clamped !== tipX;
                    return (
                      <text
                        x={clamped}
                        y={fy + Math.sin(a) * len * 1.1 - w * 0.012}
                        fill={accent}
                        fontFamily={MONO}
                        fontSize={w * 0.02}
                        letterSpacing="0.14em"
                        textAnchor={anchored ? (clamped <= w * 0.5 ? 'start' : 'end') : 'middle'}
                      >
                        {force.label.toUpperCase()}
                      </text>
                    );
                  })()
                ) : null}
              </g>
            );
          })}
        </g>

        {/**
         * THE SCALE, MEASURED AGAINST THE LOAD ITSELF.
         *
         * This used to be a second standing figure with a dimension bar in the
         * left margin, and it stopped working the moment the block was drawn at
         * its true size: a load that fills the frame's width puts its own left
         * face exactly where the reference stood, and the drawing delivered two
         * figures standing in the same place, one of them an instrument.
         *
         * A draughtsman would not have drawn a second man. He would have ticked
         * the load's height off in man-heights against its face, which asserts
         * nothing and measures everything — and leaves the men in the picture
         * doing the one job they are there for, which is pulling.
         */}
        <g opacity={0.7 * on}>
          {(() => {
            const gx = x - objW / 2 + w * 0.028;
            const men = Math.max(1, Math.round(objH / Math.max(1, humanH)));
            return (
              <>
                <line x1={gx} y1={ground} x2={gx} y2={baseY} stroke={muted} strokeWidth={line.construction} />
                {Array.from({length: men + 1}, (_, i) => {
                  const gy = ground - Math.min(objH + (ground - baseY - objH), i * humanH);
                  return (
                    <line
                      key={i}
                      x1={gx - w * 0.011}
                      y1={gy}
                      x2={gx + w * 0.011}
                      y2={gy}
                      stroke={muted}
                      strokeWidth={line.detail}
                    />
                  );
                })}
                <text
                  x={gx + w * 0.02}
                  y={baseY + objH * 0.5}
                  fill={muted}
                  fontFamily={MONO}
                  fontSize={w * 0.019}
                  letterSpacing="0.18em"
                  dominantBaseline="middle"
                >
                  {`${men} × MAN`}
                </text>
              </>
            );
          })()}
        </g>

        {spec.distance ? (
          <g opacity={drawOn(stepped, [from + over * 0.5, from + over])}>
            <line x1={w * 0.12} y1={ground + h * 0.06} x2={w * 0.88} y2={ground + h * 0.06} stroke={muted} strokeWidth={line.construction} />
            {[w * 0.12, w * 0.88].map((cx, i) => (
              <line key={i} x1={cx} y1={ground + h * 0.05} x2={cx} y2={ground + h * 0.07} stroke={muted} strokeWidth={line.detail} />
            ))}
            <text
              x={w * 0.5}
              y={ground + h * 0.052}
              textAnchor="middle"
              fill={muted}
              fontFamily={MONO}
              fontSize={w * 0.022}
              letterSpacing="0.2em"
            >
              {spec.distance.label.toUpperCase()}
            </text>
          </g>
        ) : null}

        {/**
         * FOREGROUND — dust at the roller line, moving faster than anything.
         *
         * It explains nothing, which is exactly why it is allowed: it says the
         * air in front of the camera exists, and it is the plane that makes the
         * push read as a push. Held to a band at the ground so it never crosses
         * the block or the words.
         */}
        <Depth plane="foreground" push={parallax} anchor={anchor} w={w} h={h}>
          <Motes w={w} h={h} colour={muted} count={14} seed="haul-dust" air={0.8} band={[0.56, 0.68]} />
        </Depth>

        {(spec.annotations ?? []).map((note, i) => (
          <Callout
            key={`a${i}`}
            x={note.x * w}
            y={note.y * h}
            text={note.text}
            colour={muted}
            w={w}
            side={note.side ?? 'right'}
            at={from + (note.at ?? 16 + i * 7)}
          />
        ))}
        </g>
      </svg>

      {spec.figure ? (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: h * 0.16,
            textAlign: 'center',
            fontFamily: SANS,
            fontWeight: 900,
            fontVariantNumeric: 'tabular-nums',
            color: accent,
            textShadow: '0 0 30px rgba(0,0,0,0.9)',
          }}
        >
          <div style={{fontSize: w * 0.13, lineHeight: 1}}>
            {/**
              * THE SHARED COUNTER, NOT A RAW INTERPOLATION.
              *
              * `countTo` returns a float, so eight hundred tons counted up
              * through "576.377 TONS" — three decimal places on a figure about
              * a block of stone. `counterValue` is the one the whole repo
              * counts with: integer, never backwards, and it lands exactly on
              * the figure it claims.
              */}
            {counterValue(stepped, {
              from: from + (spec.figure.at ?? 6),
              over: spec.figure.over ?? 26,
              to: spec.figure.value,
            }).toLocaleString('en-US')}
            {spec.figure.unit ? (
              <span style={{fontFamily: MONO, fontSize: w * 0.028, letterSpacing: '0.2em', marginLeft: w * 0.016}}>
                {spec.figure.unit.toUpperCase()}
              </span>
            ) : null}
          </div>
          {spec.figure.label ? (
            <div style={{fontFamily: MONO, fontSize: w * 0.022, letterSpacing: '0.3em', opacity: 0.8, color: muted}}>
              {spec.figure.label.toUpperCase()}
            </div>
          ) : null}
        </div>
      ) : null}

      {/**
       * THE PLATE IS WEAKER THAN A SCHEMATIC ON PURPOSE.
       *
       * "Schematic reconstruction" claims the arrangement is known. For most
       * ancient haulage it is not: the rollers and the capstans are the best
       * available hypothesis, not the record. "Illustrative" says that.
       */}
      <Disclosure text={spec.disclosure ?? 'illustrative reconstruction · method uncertain'} colour={muted} at={from + 12} width={w} />
    </AbsoluteFill>
  );
};
