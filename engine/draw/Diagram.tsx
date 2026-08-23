import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {drawOn, posterizeTime, punch, springEntrance} from '../motion';
import {GEAR_ASPECT, countWindow, counterValue} from '../state.mjs';
import {gearTrainLayout} from '../state.mjs';

/**
 * THE PROCEDURAL VISUAL LIBRARY.
 *
 * A missing asset is a problem to solve. It is not permission to use the wrong
 * photograph, and it is not permission to put white text on black and call it a
 * design decision either.
 *
 * The specific failure this exists for: a reel about a geared bronze computer
 * had no photograph of one, so it used an antique brass dial instrument —
 * right family, wrong object — and a documentary claim was illustrated with
 * something that is not the thing. The truthful answer was never a better
 * search. It was to DRAW the mechanism, label it as a reconstruction, and let
 * the gears actually turn.
 *
 * So these are first-class visuals, not placeholders. A gear system that meshes
 * correctly is a better hero than a poor photograph of the wrong machine, and a
 * timeline showing fifty years of nothing is a better shot than a stock picture
 * of a cupboard.
 *
 * THREE RULES, and they are what separate this from clipart:
 *
 *   IT IS AN ENGINEERING DRAWING, NOT AN ICON. Controlled line weights derived
 *       from the frame, mono labels the way a technical plate is annotated,
 *       registration ticks, one accent and one muted tone. No fills that are
 *       not doing work, no rounded friendly shapes, no third colour.
 *
 *   IT DRAWS ITSELF. Every stroke arrives along its own length. A diagram that
 *       fades up is an overlay; one that draws is a hand explaining something,
 *       and that is the entire documentary register being aimed at.
 *
 *   IT NEVER CLAIMS TO BE A PHOTOGRAPH. Anything reconstructed carries a plate
 *       that says so. A drawing presented as evidence is a worse lie than a
 *       wrong photograph, because it is a lie the viewer cannot check.
 */

const MONO = '"Courier New", ui-monospace, monospace';
const SANS = '"Archivo", "Helvetica Neue", Arial, sans-serif';

/** Every diagram is one of these, described as data rather than as markup. */
export type DiagramSpec =
  | GearSystemSpec
  | TimelineSpec
  | MeasurementSpec
  | OrbitSpec
  | ScanSpec;

type Common = {
  /** Scene frame it begins drawing on. */
  from?: number;
  /** Frames the draw-on takes. */
  over?: number;
  accent?: string;
  muted?: string;
  /**
   * The honesty plate. Present on anything reconstructed rather than measured.
   * Absent only where the drawing is a pure abstraction nobody could mistake
   * for a record — a timeline of dates, a measurement bar.
   */
  disclosure?: string;
};

/** One wheel. Positions are fractions of the frame; `teeth` sets the ratio. */
export type Gear = {x: number; y: number; teeth: number; radius: number; label?: string};

export type GearSystemSpec = Common & {
  type: 'gearSystem';
  gears?: Gear[] | null;
  /**
   * A COUNT INSTEAD OF A LAYOUT.
   *
   * The planner knows "thirty gears" and nothing about pitch circles, and it
   * should stay that way: geometry belongs to the drawing layer. Given a count
   * and no gears, the train is laid out here.
   */
  count?: number;
  /** Which gear is driven. Everything meshed to it turns from it. */
  drive?: number;
  /** Degrees per second at the driven gear. */
  rate?: number;
  /** Gear index the shot is about; it lights when the count lands. */
  highlight?: number;
  /** A figure that climbs while the gears turn, and lands on the count. */
  countTo?: number;
  countLabel?: string;
};

export type TimelineSpec = Common & {
  type: 'timeline';
  events: {at: number; label: string; note?: string}[];
  /** The span. Derived from the events when absent. */
  start?: number;
  end?: number;
  /** A stretch to mark as empty — the years in which nothing happened. */
  gap?: [number, number];
  gapLabel?: string;
};

export type MeasurementSpec = Common & {
  type: 'measurement';
  value: number;
  unit?: string;
  label?: string;
  /** Fractions of the frame. */
  x?: number;
  y?: number;
  width?: number;
  /** Something to measure AGAINST, drawn to the same scale. */
  compare?: {label: string; ratio: number};
};

export type OrbitSpec = Common & {
  type: 'orbit';
  cx: number;
  cy: number;
  /** Fraction of frame width. */
  radius: number;
  /** The body being tracked, as a fraction of the orbit radius. */
  bodyRadius?: number;
  label?: string;
  /** Marks where the three bodies line up — an eclipse. */
  markAt?: number;
  markLabel?: string;
};

export type ScanSpec = Common & {
  type: 'scan';
  /** A bar that travels down the frame, revealing structure as it passes. */
  label?: string;
};

/* ── SHARED FURNITURE ──────────────────────────────────────────────────── */

/**
 * THE PLATE THAT SAYS WHAT THIS IS.
 *
 * A reconstruction must announce itself. It sits in the corner in mono at a
 * size that is legible and not loud, the way a museum diagram is captioned —
 * because the alternative is a drawing that a viewer reads as a photograph of a
 * thing, which is the failure this whole library exists to avoid.
 */
const Disclosure: React.FC<{text: string; colour: string; at: number; width: number}> = ({
  text,
  colour,
  at,
  width,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const stepped = posterizeTime(frame, fps, 12);
  const on = drawOn(stepped, [at, at + 10]);
  if (stepped < at) return null;
  return (
    <div
      style={{
        position: 'absolute',
        left: width * 0.075,
        bottom: width * 0.075,
        fontFamily: MONO,
        fontSize: width * 0.0185,
        letterSpacing: '0.16em',
        textTransform: 'uppercase',
        color: colour,
        opacity: on * 0.72,
        borderLeft: `2px solid ${colour}`,
        paddingLeft: width * 0.018,
        lineHeight: 1.5,
        /**
         * ONE LINE. A DISCLOSURE THAT WRAPS READS AS A CAPTION.
         *
         * "SCHEMATIC RECONSTRUCTION · NOT TO / SCALE" broke after "TO", so the
         * plate that exists to say the drawing is not a record turned into two
         * lines of mono text with an orphan — which is exactly the shape of a
         * subtitle, and the last thing this label should be mistaken for.
         */
        whiteSpace: 'nowrap',
        maxWidth: width * 0.85,
      }}
    >
      {text}
    </div>
  );
};

/** Registration ticks — the corner marks of a drawing sheet. */
const Ticks: React.FC<{colour: string; w: number; h: number; on: number}> = ({colour, w, h, on}) => {
  const m = w * 0.055;
  const len = w * 0.035;
  const corners = [
    [m, m, 1, 1],
    [w - m, m, -1, 1],
    [m, h - m, 1, -1],
    [w - m, h - m, -1, -1],
  ];
  return (
    <g opacity={on * 0.45}>
      {corners.map(([x, y, sx, sy], i) => (
        <g key={i}>
          <line x1={x} y1={y} x2={x + len * sx} y2={y} stroke={colour} strokeWidth={w * 0.0022} />
          <line x1={x} y1={y} x2={x} y2={y + len * sy} stroke={colour} strokeWidth={w * 0.0022} />
        </g>
      ))}
    </g>
  );
};

/**
 * ONE GEAR, DRAWN AS A GEAR.
 *
 * Trapezoidal teeth on the pitch circle rather than a circle with notches: at
 * twenty-odd teeth the difference is the whole difference between a machine
 * part and a cog emoji. The hub, the bore and the two inner rings are what a
 * bronze gear actually has, and they are also what gives the rotation something
 * to be visible against — a plain annulus turning looks completely still.
 */
function gearPath(cx: number, cy: number, r: number, teeth: number): string {
  const root = r * 0.86;
  const tip = r;
  const step = (Math.PI * 2) / teeth;
  // A tooth occupies a little under half the pitch, which is roughly right for
  // a hand-cut bronze wheel and reads correctly at any size.
  const half = step * 0.21;
  const parts: string[] = [];
  for (let i = 0; i < teeth; i += 1) {
    const a = i * step;
    const p = (angle: number, radius: number) =>
      `${(cx + Math.cos(angle) * radius).toFixed(2)} ${(cy + Math.sin(angle) * radius).toFixed(2)}`;
    parts.push(
      `${i === 0 ? 'M' : 'L'} ${p(a - half * 1.55, root)}`,
      `L ${p(a - half, tip)}`,
      `L ${p(a + half, tip)}`,
      `L ${p(a + half * 1.55, root)}`,
    );
  }
  return `${parts.join(' ')} Z`;
}

/* ── THE GEAR SYSTEM ───────────────────────────────────────────────────── */

/**
 * A MESHING GEAR TRAIN — and the meshing is the point.
 *
 * This is the library's argument for itself. The driven gear turns; every other
 * gear turns because IT turns, in the opposite direction, at the ratio of their
 * tooth counts. That is causal motion in the strict sense — B moves because A
 * moved — and it is a thing a photograph of a mechanism can never do.
 */
/**
 * IS THERE ROOM ABOVE THIS WHEEL FOR ITS NAME?
 *
 * Arithmetic, in the same fractional units the train is laid out in: the label
 * sits a little above the wheel's top, and if that point falls inside any other
 * wheel it has nowhere to go.
 */
function labelIsClear(gears: Gear[], index: number): boolean {
  const gear = gears[index];
  const lx = gear.x;
  const ly = gear.y - (gear.radius + 0.03) / GEAR_ASPECT;
  return gears.every((other, i) => {
    if (i === index) return true;
    const dy = (ly - other.y) * GEAR_ASPECT;
    return Math.hypot(lx - other.x, dy) > other.radius * 1.08;
  });
}

const GearSystem: React.FC<{spec: GearSystemSpec; w: number; h: number}> = ({spec, w, h}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const stepped = posterizeTime(frame, fps, 12);
  const from = spec.from ?? 0;
  const over = spec.over ?? 26;
  const accent = spec.accent ?? '#f2b53a';
  const muted = spec.muted ?? '#cfc6ae';
  const t = Math.max(0, stepped - from);
  const on = drawOn(stepped, [from, from + over]);
  if (stepped < from) return null;

  const drive = spec.drive ?? 0;
  const declared = spec.gears ?? [];
  const gears: Gear[] = declared.length > 0 ? declared : (gearTrainLayout(spec.count ?? 8) as Gear[]);
  const driven = gears[drive] ?? gears[0];
  const turn = (t / fps) * (spec.rate ?? 26);

  // The window is written into the spec by the planner and read here, so the
  // figure lands inside the shot rather than after the cut.
  const count = countWindow(spec);
  const countEnd = count.start + count.over;
  const landed = spec.countTo !== undefined && stepped >= countEnd;

  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{position: 'absolute', inset: 0}}>
        <Ticks colour={muted} w={w} h={h} on={on} />

        {/**
         * THE SETTING OUT — the frame the cut LANDS on.
         *
         * A self-drawing mechanism is nothing at frame zero, so every cut into
         * one landed on a black frame with a few disconnected zigzag arcs
         * floating in it: not a mechanism arriving, just debris. Sampling the
         * first frame of every shot is what found it; nothing else would.
         *
         * The answer is not to abandon the draw-on — a diagram that fades up is
         * a slide. It is that a draughtsman does not start with the teeth. The
         * pitch circles and the centre marks are SET OUT first, and the drawing
         * is made on top of them. So the cut lands on a composed geometric
         * figure, the mechanism draws itself onto that figure, and the
         * construction lines stay faintly visible underneath the way they do on
         * the real sheet.
         */}
        <g opacity={0.52}>
          {gears.map((gear, i) => (
            <g key={`set${i}`}>
              <circle
                cx={gear.x * w}
                cy={gear.y * h}
                r={gear.radius * w}
                fill="none"
                stroke={muted}
                strokeWidth={w * 0.0024}
                strokeDasharray={`${w * 0.012} ${w * 0.009}`}
              />
              <line
                x1={gear.x * w - w * 0.016}
                y1={gear.y * h}
                x2={gear.x * w + w * 0.016}
                y2={gear.y * h}
                stroke={muted}
                strokeWidth={w * 0.0024}
              />
              <line
                x1={gear.x * w}
                y1={gear.y * h - w * 0.016}
                x2={gear.x * w}
                y2={gear.y * h + w * 0.016}
                stroke={muted}
                strokeWidth={w * 0.0024}
              />
            </g>
          ))}
        </g>

        {gears.map((gear, i) => {
          const cx = gear.x * w;
          const cy = gear.y * h;
          const r = gear.radius * w;
          /**
           * THE RATIO IS THE CAUSALITY.
           *
           * Every wheel but the driven one turns because the driven one does:
           * opposite sense, scaled by the inverse of the tooth counts. Get this
           * wrong and the teeth visibly slide through each other, which is the
           * one thing everybody notices about a drawn gear train.
           */
          const ratio = i === drive ? 1 : -driven.teeth / gear.teeth;
          const angle = turn * ratio;
          // Each wheel is drawn in as the eye would build the train: from the
          // driven one outward.
          const arrive = drawOn(stepped, [from + i * 4, from + i * 4 + over * 0.7]);
          const lit = landed || spec.highlight === i;
          const stroke = lit ? accent : muted;
          const weight = w * (lit ? 0.0048 : 0.0036);
          const length = r * 9;

          return (
            <g key={i} transform={`rotate(${angle} ${cx} ${cy})`} opacity={0.55 + arrive * 0.45}>
              <path
                d={gearPath(cx, cy, r, gear.teeth)}
                fill="none"
                stroke={stroke}
                strokeWidth={weight}
                strokeLinejoin="round"
                strokeDasharray={length}
                strokeDashoffset={length * (1 - arrive)}
              />
              {/* The wheel's own structure: two rings and a bore. Without these
                  a rotating annulus is indistinguishable from a still one. */}
              <circle cx={cx} cy={cy} r={r * 0.62} fill="none" stroke={stroke} strokeWidth={weight * 0.6} opacity={arrive * 0.8} />
              <circle cx={cx} cy={cy} r={r * 0.17} fill="none" stroke={stroke} strokeWidth={weight * 0.8} opacity={arrive} />
              {[0, 1, 2, 3].map((s) => {
                const a = (s / 4) * Math.PI * 2 + 0.4;
                return (
                  <line
                    key={s}
                    x1={cx + Math.cos(a) * r * 0.19}
                    y1={cy + Math.sin(a) * r * 0.19}
                    x2={cx + Math.cos(a) * r * 0.6}
                    y2={cy + Math.sin(a) * r * 0.6}
                    stroke={stroke}
                    strokeWidth={weight * 0.55}
                    opacity={arrive * 0.7}
                  />
                );
              })}
            </g>
          );
        })}

        {/**
         * A LABEL LANDS ON PAPER, NOT ON A WHEEL.
         *
         * "MAIN WHEEL" was centred above the hub and the hub is surrounded by
         * the satellites it drives, so the label was printed across the teeth
         * of one of them and was unreadable. Where the callout has nowhere
         * clear to sit, it is not drawn — an unreadable label is worse than no
         * label, because it is also clutter.
         */}
        {gears.map((gear, i) =>
          gear.label && labelIsClear(gears, i) ? (
            <text
              key={`l${i}`}
              x={gear.x * w}
              y={gear.y * h - gear.radius * w - w * 0.022}
              textAnchor="middle"
              fill={muted}
              fontFamily={MONO}
              fontSize={w * 0.022}
              letterSpacing="0.18em"
              opacity={drawOn(stepped, [from + i * 4 + 8, from + i * 4 + 20]) * 0.85}
            >
              {gear.label.toUpperCase()}
            </text>
          ) : null,
        )}
      </svg>

      {/**
       * THE COUNT IS CAUSED BY THE TURNING, and the turning is confirmed by the
       * count landing: when it reaches its figure every wheel lights at once.
       * That is the shot's event, and it is one event with two halves rather
       * than two events that happen to coincide.
       */}
      {spec.countTo !== undefined && stepped >= count.start ? (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: h * 0.1,
            textAlign: 'center',
            fontFamily: SANS,
            fontWeight: 900,
            fontVariantNumeric: 'tabular-nums',
            color: accent,
            transform: `scale(${punch(stepped, countEnd, {amount: 0.12, rise: 2, decay: 0.18})})`,
            textShadow: '0 0 34px rgba(0,0,0,0.9)',
          }}
        >
          <div style={{fontSize: w * 0.15, lineHeight: 1}}>
            {counterValue(stepped, {from: count.start, over: count.over, to: spec.countTo})}
          </div>
          {spec.countLabel ? (
            <div style={{fontFamily: MONO, fontSize: w * 0.026, letterSpacing: '0.3em', opacity: 0.8}}>
              {spec.countLabel.toUpperCase()}
            </div>
          ) : null}
        </div>
      ) : null}

      {spec.disclosure ? <Disclosure text={spec.disclosure} colour={muted} at={from + 12} width={w} /> : null}
    </AbsoluteFill>
  );
};

/* ── THE TIMELINE ──────────────────────────────────────────────────────── */

/**
 * ELAPSED TIME, DRAWN.
 *
 * "Fifty years" and "fourteen hundred years" are the two hardest things in a
 * documentary to photograph, and the two easiest to draw. The rule the drawing
 * has to obey is that the GAP is the subject: the span where nothing happened
 * is what the sentence is about, so it is the part that is marked, and the
 * events at either end are only what bound it.
 */
const Timeline: React.FC<{spec: TimelineSpec; w: number; h: number}> = ({spec, w, h}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const stepped = posterizeTime(frame, fps, 12);
  const from = spec.from ?? 0;
  const over = spec.over ?? 30;
  const accent = spec.accent ?? '#f2b53a';
  const muted = spec.muted ?? '#cfc6ae';
  if (stepped < from) return null;

  const years = spec.events.map((e) => e.at);
  const start = spec.start ?? Math.min(...years);
  const end = spec.end ?? Math.max(...years);
  const span = Math.max(1, end - start);

  // Vertical, because the frame is. A horizontal timeline in 9:16 is a line
  // across a third of the picture with the labels stacked on top of each other.
  const top = h * 0.24;
  const bottom = h * 0.78;
  const x = w * 0.3;
  const at = (year: number) => top + ((year - start) / span) * (bottom - top);

  const grown = drawOn(stepped, [from, from + over]);
  const head = top + (bottom - top) * grown;

  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{position: 'absolute', inset: 0}}>
        {/**
         * THE RULE IS SET OUT BEFORE IT IS DRAWN.
         *
         * At 0.28 on a near-black ground the construction line was invisible,
         * so the cut into this shot landed on an empty frame and the timeline
         * appeared out of nothing a third of a second later. The rule and its
         * two ends are the SHEET; the accent line growing down it is the
         * drawing. One is there when we cut, the other happens.
         */}
        <g opacity={0.5}>
          <line x1={x} y1={top} x2={x} y2={bottom} stroke={muted} strokeWidth={w * 0.002} />
          {[top, bottom].map((y) => (
            <line key={y} x1={x - w * 0.026} y1={y} x2={x + w * 0.026} y2={y} stroke={muted} strokeWidth={w * 0.002} />
          ))}
        </g>
        <line x1={x} y1={top} x2={x} y2={head} stroke={accent} strokeWidth={w * 0.0038} />

        {/* THE EMPTY YEARS, hatched. The subject of the sentence. */}
        {spec.gap ? (
          <g opacity={drawOn(stepped, [from + over * 0.35, from + over]) * 0.5}>
            {Array.from({length: 22}, (_, i) => {
              const y0 = at(spec.gap![0]);
              const y1 = at(spec.gap![1]);
              const y = y0 + ((y1 - y0) * i) / 21;
              if (y > head) return null;
              return (
                <line
                  key={i}
                  x1={x - w * 0.028}
                  y1={y}
                  x2={x + w * 0.028}
                  y2={y - w * 0.02}
                  stroke={muted}
                  strokeWidth={w * 0.0016}
                />
              );
            })}
          </g>
        ) : null}

        {spec.events.map((event, i) => {
          const y = at(event.at);
          if (y > head + 4) return null;
          const arrive = springEntrance(stepped, fps, {delay: from + 6 + i * 8, stiffness: 60, mass: 0.9});
          return (
            <g key={i} opacity={arrive}>
              <line x1={x - w * 0.022} y1={y} x2={x + w * 0.022} y2={y} stroke={accent} strokeWidth={w * 0.0032} />
              <circle cx={x} cy={y} r={w * 0.008} fill={accent} />
              <text
                x={x + w * 0.05}
                y={y + w * 0.012}
                fill="#f6ead0"
                fontFamily={SANS}
                fontWeight={900}
                fontSize={w * 0.055}
                style={{fontVariantNumeric: 'tabular-nums'}}
              >
                {event.label}
              </text>
              {event.note ? (
                <text
                  x={x + w * 0.05}
                  y={y + w * 0.048}
                  fill={muted}
                  fontFamily={MONO}
                  fontSize={w * 0.021}
                  letterSpacing="0.2em"
                  opacity={0.75}
                >
                  {event.note.toUpperCase()}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>

      {spec.gapLabel && stepped > from + over * 0.5 ? (
        <div
          style={{
            position: 'absolute',
            left: w * 0.3 - w * 0.24,
            top: (at(spec.gap?.[0] ?? start) + at(spec.gap?.[1] ?? end)) / 2 - w * 0.03,
            width: w * 0.2,
            textAlign: 'right',
            fontFamily: MONO,
            fontSize: w * 0.024,
            letterSpacing: '0.2em',
            lineHeight: 1.5,
            color: muted,
            opacity: drawOn(stepped, [from + over * 0.5, from + over]) * 0.85,
          }}
        >
          {spec.gapLabel.toUpperCase()}
        </div>
      ) : null}

      {spec.disclosure ? <Disclosure text={spec.disclosure} colour={muted} at={from + 14} width={w} /> : null}
    </AbsoluteFill>
  );
};

/* ── MEASUREMENT AND COMPARISON ────────────────────────────────────────── */

/**
 * A FIGURE WITH SOMETHING TO MEASURE IT AGAINST.
 *
 * A number on screen is a caption. A number with a bar the length of the thing
 * it describes, next to a bar the length of something the viewer already knows,
 * is an argument. The comparison is optional and it is what makes the graphic
 * worth its space.
 */
const Measurement: React.FC<{spec: MeasurementSpec; w: number; h: number}> = ({spec, w, h}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const stepped = posterizeTime(frame, fps, 12);
  const from = spec.from ?? 0;
  const over = spec.over ?? 22;
  const accent = spec.accent ?? '#f2b53a';
  const muted = spec.muted ?? '#cfc6ae';
  if (stepped < from) return null;

  const x = (spec.x ?? 0.14) * w;
  const y = (spec.y ?? 0.6) * h;
  const width = (spec.width ?? 0.66) * w;
  const grow = drawOn(stepped, [from, from + over]);
  const tick = w * 0.026;

  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{position: 'absolute', inset: 0}}>
        <line x1={x} y1={y - tick} x2={x} y2={y + tick} stroke={accent} strokeWidth={w * 0.0034} />
        <line x1={x} y1={y} x2={x + width * grow} y2={y} stroke={accent} strokeWidth={w * 0.0034} />
        <line
          x1={x + width}
          y1={y - tick}
          x2={x + width}
          y2={y + tick}
          stroke={accent}
          strokeWidth={w * 0.0034}
          opacity={grow > 0.98 ? 1 : 0}
        />

        {spec.compare ? (
          <g opacity={drawOn(stepped, [from + over, from + over + 14]) * 0.7}>
            <line
              x1={x}
              y1={y + h * 0.055}
              x2={x + width * spec.compare.ratio}
              y2={y + h * 0.055}
              stroke={muted}
              strokeWidth={w * 0.0026}
              strokeDasharray={`${w * 0.014} ${w * 0.01}`}
            />
            <text
              x={x + width * spec.compare.ratio + w * 0.018}
              y={y + h * 0.055 + w * 0.011}
              fill={muted}
              fontFamily={MONO}
              fontSize={w * 0.022}
              letterSpacing="0.16em"
            >
              {spec.compare.label.toUpperCase()}
            </text>
          </g>
        ) : null}
      </svg>

      <div
        style={{
          position: 'absolute',
          left: x,
          top: y - h * 0.1,
          fontFamily: SANS,
          fontWeight: 900,
          fontSize: w * 0.11,
          lineHeight: 1,
          fontVariantNumeric: 'tabular-nums',
          color: accent,
          textShadow: '0 0 30px rgba(0,0,0,0.9)',
        }}
      >
        {counterValue(stepped, {from, over, to: spec.value}).toLocaleString('en-US')}
        {spec.unit ? (
          <span style={{fontFamily: MONO, fontSize: w * 0.028, letterSpacing: '0.2em', marginLeft: w * 0.016}}>
            {spec.unit.toUpperCase()}
          </span>
        ) : null}
      </div>

      {spec.disclosure ? <Disclosure text={spec.disclosure} colour={muted} at={from + 10} width={w} /> : null}
    </AbsoluteFill>
  );
};

/* ── ORBIT ─────────────────────────────────────────────────────────────── */

/**
 * THE GEOMETRY OF A PREDICTION.
 *
 * Laid over a real photograph of the moon rather than replacing it: the
 * photograph is the evidence that the moon is a real object, and the drawing is
 * the claim about what the machine could work out. That is the hybrid the whole
 * library is aiming at — a true picture with a true diagram on it, and neither
 * pretending to be the other.
 */
const Orbit: React.FC<{spec: OrbitSpec; w: number; h: number}> = ({spec, w, h}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const stepped = posterizeTime(frame, fps, 12);
  const from = spec.from ?? 0;
  const over = spec.over ?? 30;
  const accent = spec.accent ?? '#f2b53a';
  const muted = spec.muted ?? '#cfc6ae';
  if (stepped < from) return null;

  const cx = spec.cx * w;
  const cy = spec.cy * h;
  /**
   * THE PATH IS CLAMPED INSIDE THE FRAME.
   *
   * A dashed circle whose top was outside the composition enclosed nothing and
   * read as a mistake. The radius cannot exceed the distance from the centre to
   * the nearest edge, less a margin — so the geometry is guaranteed to CONTAIN
   * its subject, which is the only reason to draw a circle round something.
   */
  const margin = w * 0.06;
  const room = Math.min(cx, w - cx, cy, h - cy) - margin;
  const r = Math.max(w * 0.08, Math.min(spec.radius * w, room));

  const travel = drawOn(stepped, [from, from + over]);
  const bodyAngle = -Math.PI / 2 + travel * Math.PI * 1.55;
  const bodyR = (spec.bodyRadius ?? 0.13) * r;
  const bx = cx + Math.cos(bodyAngle) * r;
  const by = cy + Math.sin(bodyAngle) * r;
  const circumference = Math.PI * 2 * r;

  const markT = spec.markAt ?? 0.78;
  const marked = travel >= markT;

  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{position: 'absolute', inset: 0}}>
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={muted}
          strokeWidth={w * 0.0026}
          strokeDasharray={`${circumference}`}
          strokeDashoffset={circumference * (1 - travel)}
          transform={`rotate(-90 ${cx} ${cy})`}
          opacity={0.75}
        />
        {/* The line of syzygy — where the prediction is actually made. */}
        {marked ? (
          <g opacity={drawOn(stepped, [from + over * markT, from + over * markT + 10])}>
            <line
              x1={cx - r * 1.12}
              y1={cy}
              x2={cx + r * 1.12}
              y2={cy}
              stroke={accent}
              strokeWidth={w * 0.0026}
              strokeDasharray={`${w * 0.016} ${w * 0.012}`}
            />
            <circle cx={cx} cy={cy} r={w * 0.007} fill={accent} />
          </g>
        ) : null}
        <circle cx={bx} cy={by} r={bodyR} fill="none" stroke={accent} strokeWidth={w * 0.0034} />
        <circle cx={bx} cy={by} r={bodyR * 0.28} fill={accent} opacity={0.85} />
      </svg>

      {spec.markLabel && marked ? (
        <div
          style={{
            position: 'absolute',
            left: cx - r,
            top: cy + w * 0.02,
            width: r * 2,
            textAlign: 'center',
            fontFamily: MONO,
            fontSize: w * 0.024,
            letterSpacing: '0.28em',
            color: accent,
            opacity: drawOn(stepped, [from + over * markT + 4, from + over * markT + 16]),
          }}
        >
          {spec.markLabel.toUpperCase()}
        </div>
      ) : null}

      {spec.label ? (
        <div
          style={{
            position: 'absolute',
            left: cx - r,
            top: cy - r - w * 0.06,
            width: r * 2,
            textAlign: 'center',
            fontFamily: MONO,
            fontSize: w * 0.022,
            letterSpacing: '0.2em',
            color: muted,
            opacity: 0.8,
          }}
        >
          {spec.label.toUpperCase()}
        </div>
      ) : null}

      {spec.disclosure ? <Disclosure text={spec.disclosure} colour={muted} at={from + 12} width={w} /> : null}
    </AbsoluteFill>
  );
};

/* ── SCAN ──────────────────────────────────────────────────────────────── */

/** A bar travelling down the frame — the act of looking inside something. */
const Scan: React.FC<{spec: ScanSpec; w: number; h: number}> = ({spec, w, h}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const stepped = posterizeTime(frame, fps, 12);
  const from = spec.from ?? 0;
  const over = spec.over ?? 40;
  const accent = spec.accent ?? '#f2b53a';
  if (stepped < from) return null;
  const y = drawOn(stepped, [from, from + over]) * h;

  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: y - h * 0.05,
          height: h * 0.05,
          background: `linear-gradient(180deg, transparent, ${accent}22)`,
        }}
      />
      <div style={{position: 'absolute', left: 0, right: 0, top: y, height: 2, background: accent, opacity: 0.8}} />
      {spec.label ? (
        <div
          style={{
            position: 'absolute',
            right: w * 0.075,
            top: y + h * 0.012,
            fontFamily: MONO,
            fontSize: w * 0.022,
            letterSpacing: '0.24em',
            color: accent,
            opacity: 0.85,
          }}
        >
          {spec.label.toUpperCase()}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

/* ── THE DISPATCHER ────────────────────────────────────────────────────── */

/**
 * ONE COMPONENT, MANY DIAGRAMS, DESCRIBED AS DATA.
 *
 * A scene carries a `diagram` object and this draws it. Nothing about any
 * particular episode is compiled in — the same gear system serves any story
 * with a mechanism in it, and the same timeline serves any story with a gap.
 */
export const Diagram: React.FC<{spec?: DiagramSpec | null}> = ({spec}) => {
  const {width, height} = useVideoConfig();
  if (!spec) return null;
  switch (spec.type) {
    case 'gearSystem':
      return <GearSystem spec={spec} w={width} h={height} />;
    case 'timeline':
      return <Timeline spec={spec} w={width} h={height} />;
    case 'measurement':
      return <Measurement spec={spec} w={width} h={height} />;
    case 'orbit':
      return <Orbit spec={spec} w={width} h={height} />;
    case 'scan':
      return <Scan spec={spec} w={width} h={height} />;
    default:
      return null;
  }
};
