import React from "react";
import {
  AbsoluteFill,
  CalculateMetadataFunction,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { SERIF_400, SERIF_600, HAND_600 } from "./fonts";

// ----------------------------------------------------------------------------
// ATELIER (BESPOKE) — hand-authored for "The Bulge Nobody Can Explain".
// Art direction: ./art-direction.md   Per-scene plan: ./scenes.md
// Checked against productions/STYLE_LEDGER.md before design: nothing here is
// carried over from how-headphones-erase-sound, and nothing here is meant to be
// carried into whatever comes next.
// ----------------------------------------------------------------------------

const SERIF = "PlateSerif";
const HAND = "PlateHand";

// The render browser does not trust this environment's proxy CA, so a font
// fetched at render time fails. All three faces are inlined as data URIs and
// declared in CSS, which needs no network and therefore no delayRender: an
// unresolved delayRender aborts the whole render, and a font that is already in
// the document cannot be worth that risk.
if (typeof document !== "undefined" && !document.getElementById("plate-fonts")) {
  const style = document.createElement("style");
  style.id = "plate-fonts";
  style.textContent =
    `@font-face{font-family:"${SERIF}";font-weight:400;font-display:block;src:url("${SERIF_400}") format("woff2");}` +
    `@font-face{font-family:"${SERIF}";font-weight:600;font-display:block;src:url("${SERIF_600}") format("woff2");}` +
    `@font-face{font-family:"${HAND}";font-weight:600;font-display:block;src:url("${HAND_600}") format("woff2");}`;
  document.head.appendChild(style);
}

const W = 1080;
const H = 1920;
const FPS = 30;

const PAPER = "#EDE6D6";
const INK = "#141210";
const WATER = "#1F4E6B";
const FORCE = "#C1452F";

/** Arrow lengths, from the real inverse-square pull at the Moon's distance.
 *  Earth radius 6371 km, Moon 384400 km. The *spread* is exaggerated so it is
 *  visible on a phone (the true spread is ±3.4%), but the residuals after the
 *  centre pull is subtracted — 61.2 and 58.2 — are exactly to scale with each
 *  other, which is why the near bulge draws slightly larger than the far one. */
const L_NEAR = 179.4;
const L_CENTRE = 118.2;
const L_FAR = 60.0;

const CX = 540;
const CY = 860;
const R_EARTH = 200;
const MOON_X = 1000;
const MOON_R = 26;

export interface SceneSpec {
  id: string;
  from: number;
  durationInFrames: number;
}

export interface SceneProps {
  caption?: string;
  scenes?: SceneSpec[];
}

const DEFAULT_SCENES: SceneSpec[] = [
  { id: "sc-01", from: 0, durationInFrames: 114 },
  { id: "sc-02", from: 114, durationInFrames: 257 },
  { id: "sc-03", from: 371, durationInFrames: 252 },
  { id: "sc-04", from: 623, durationInFrames: 157 },
  { id: "sc-05", from: 780, durationInFrames: 124 },
  { id: "sc-06", from: 904, durationInFrames: 91 },
  { id: "sc-07", from: 995, durationInFrames: 221 },
  { id: "sc-08", from: 1216, durationInFrames: 89 },
  { id: "sc-09", from: 1305, durationInFrames: 90 },
];

const DEFAULT_CAPTION = "A tide is not gravity being strong.\nIt is gravity being uneven.";

// -------------------------------------------------------------- ink and paper

/** Deterministic paper grain, computed once. No per-frame randomness. */
const GRAIN = (() => {
  const out: { x: number; y: number; r: number; o: number }[] = [];
  let s = 20260904;
  const rnd = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
  for (let i = 0; i < 420; i++) {
    out.push({ x: rnd() * W, y: rnd() * H, r: 1 + rnd() * 3.4, o: 0.03 + rnd() * 0.05 });
  }
  return out;
})();

const Paper: React.FC = () => (
  <AbsoluteFill style={{ background: PAPER }}>
    <svg width={W} height={H}>
      {GRAIN.map((g, i) => (
        <circle key={i} cx={g.x} cy={g.y} r={g.r} fill={INK} opacity={g.o} />
      ))}
      <rect
        x={0}
        y={0}
        width={W}
        height={H}
        fill="none"
        stroke={INK}
        strokeWidth={150}
        opacity={0.018}
      />
    </svg>
  </AbsoluteFill>
);

/** A hand draws and settles: a small overshoot, then rest. Never linear. */
const settle = (frame: number, fps: number, delay: number) =>
  spring({ frame: frame - delay, fps, config: { damping: 11, stiffness: 90, mass: 0.7 } });

/** Progress along a stroke, for draw-on. */
const drawn = (frame: number, from: number, to: number) =>
  interpolate(frame, [from, to], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

const Stroke: React.FC<{
  d: string;
  progress: number;
  color?: string;
  width?: number;
  opacity?: number;
  dash?: string;
}> = ({ d, progress, color = INK, width = 3, opacity = 1, dash }) =>
  progress <= 0 ? null : (
    <path
      d={d}
      fill="none"
      stroke={color}
      strokeWidth={width}
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity={opacity}
      strokeDasharray={dash ?? 1}
      strokeDashoffset={dash ? undefined : 1 - progress}
      pathLength={dash ? undefined : 1}
    />
  );

/** A force arrow. Positive length points toward the Moon (+x). */
const Arrow: React.FC<{
  x: number;
  y: number;
  length: number;
  progress: number;
  color?: string;
  width?: number;
}> = ({ x, y, length, progress, color = FORCE, width = 5 }) => {
  if (progress <= 0.001 || Math.abs(length) < 1) return null;
  const L = length * progress;
  const dir = Math.sign(L) || 1;
  const tip = x + L;
  const head = 15 * dir;
  return (
    <g>
      <line x1={x} y1={y} x2={tip} y2={y} stroke={color} strokeWidth={width} strokeLinecap="round" />
      <path
        d={`M${tip - head} ${y - 11} L${tip} ${y} L${tip - head} ${y + 11}`}
        fill="none"
        stroke={color}
        strokeWidth={width}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  );
};

/** The tidal figure: a circle of water with independent near and far swells. */
function waterPath(rBase: number, near: number, far: number, steps = 180): string {
  const pts: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const th = (i / steps) * Math.PI * 2;
    const c = Math.cos(th);
    const swell = near * Math.max(0, c) ** 2 + far * Math.max(0, -c) ** 2;
    const r = rBase + swell;
    pts.push(`${(CX + r * c).toFixed(1)},${(CY + r * Math.sin(th)).toFixed(1)}`);
  }
  return "M" + pts.join(" L") + " Z";
}

/** Water is a ring around the body, never a filled disc: the Earth is punched
 *  back out with paper so only the ocean is blue. */
const Ocean: React.FC<{ near: number; far: number; opacity?: number }> = ({
  near,
  far,
  opacity = 1,
}) => {
  const d = waterPath(R_EARTH + 26, near, far);
  return (
    <g opacity={opacity}>
      <path d={d} fill={WATER} fillOpacity={0.26} />
      <circle cx={CX} cy={CY} r={R_EARTH} fill={PAPER} />
      <path d={d} fill="none" stroke={WATER} strokeWidth={4} />
    </g>
  );
};

const Body: React.FC<{ progress: number; opacity?: number }> = ({ progress, opacity = 1 }) => (
  <circle
    cx={CX}
    cy={CY}
    r={R_EARTH}
    fill="none"
    stroke={INK}
    strokeWidth={3}
    opacity={opacity}
    pathLength={1}
    strokeDasharray={1}
    strokeDashoffset={1 - progress}
  />
);

const Moon: React.FC<{ x?: number; opacity?: number }> = ({ x = MOON_X, opacity = 1 }) => (
  <g opacity={opacity}>
    <circle cx={x} cy={CY} r={MOON_R} fill="none" stroke={INK} strokeWidth={3} />
    <circle cx={x - 9} cy={CY - 6} r={5} fill="none" stroke={INK} strokeWidth={2} opacity={0.6} />
    <circle cx={x + 7} cy={CY + 9} r={3.5} fill="none" stroke={INK} strokeWidth={2} opacity={0.6} />
  </g>
);

const Axis: React.FC<{ opacity?: number; toX?: number }> = ({ opacity = 0.35, toX = MOON_X }) => (
  <line
    x1={CX - R_EARTH - 120}
    y1={CY}
    x2={toX}
    y2={CY}
    stroke={INK}
    strokeWidth={2}
    strokeDasharray="10 12"
    opacity={opacity}
  />
);

const Label: React.FC<{
  x: number;
  y: number;
  text: string;
  opacity?: number;
  size?: number;
  anchor?: "start" | "middle" | "end";
}> = ({ x, y, text, opacity = 1, size = 26, anchor = "start" }) => (
  <text
    x={x}
    y={y}
    fill={INK}
    opacity={0.55 * opacity}
    fontFamily={SERIF}
    fontWeight={400}
    fontSize={size}
    letterSpacing={5}
    textAnchor={anchor}
  >
    {text}
  </text>
);

// ------------------------------------------------------------------- scenes

/** sc-01 THE MARKS — the phenomenon, at human scale, before any explanation. */
const Marks: React.FC<{ duration: number }> = ({ duration }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  // A shoreline in section: a headland on the left, the seabed falling away
  // to the right, and two ruled marks the water climbs between.
  const CLIFF_TOP = 1090;
  const CLIFF_X = 250;
  const BEACH_X = 470;
  const SEABED = 1470;
  const HIGH = 1180;
  const LOW = 1360;

  const t = f / duration;
  const level = LOW + ((1 - Math.cos(2 * Math.PI * 2 * t)) / 2) * (HIGH - LOW);
  // Where the water meets the sloping beach at this level.
  const edge = CLIFF_X + ((level - CLIFF_TOP) / (SEABED - CLIFF_TOP)) * (BEACH_X - CLIFF_X);

  const land = drawn(f, 0, 20);
  const rules = Math.min(1, settle(f, fps, 6));

  return (
    <svg width={W} height={H}>
      <path
        d={`M0 ${CLIFF_TOP} L${CLIFF_X} ${CLIFF_TOP} L${BEACH_X} ${SEABED} L${W} ${SEABED}`}
        fill="none"
        stroke={INK}
        strokeWidth={3}
        pathLength={1}
        strokeDasharray={1}
        strokeDashoffset={1 - land}
      />
      {land > 0.99 ? (
        <>
          <path
            d={`M${edge.toFixed(1)} ${level.toFixed(1)} L${W} ${level.toFixed(1)} L${W} ${SEABED} L${BEACH_X} ${SEABED} Z`}
            fill={WATER}
            fillOpacity={0.3}
          />
          <line
            x1={edge}
            y1={level}
            x2={W}
            y2={level}
            stroke={WATER}
            strokeWidth={4}
            strokeLinecap="round"
          />
        </>
      ) : null}
      {/* the land itself, hatched the way a section drawing hatches rock */}
      <g opacity={0.5 * land}>
        {Array.from({ length: 9 }).map((_, i) => {
          const x = 40 + i * 46;
          return (
            <line
              key={i}
              x1={x}
              y1={CLIFF_TOP + 16}
              x2={x + 54}
              y2={CLIFF_TOP + 96}
              stroke={INK}
              strokeWidth={2}
            />
          );
        })}
      </g>
      <line x1={520} y1={HIGH} x2={W - 60} y2={HIGH} stroke={INK} strokeWidth={2} opacity={0.55 * rules} strokeDasharray="9 11" />
      <line x1={520} y1={LOW} x2={W - 60} y2={LOW} stroke={INK} strokeWidth={2} opacity={0.55 * rules} strokeDasharray="9 11" />
      <g opacity={rules}>
        <Label x={W - 60} y={HIGH - 24} text="HIGH WATER" anchor="end" />
      </g>
    </svg>
  );
};

/** sc-02 THE PLATE — the diagram they were taught, drawn faithfully. */
const Plate: React.FC<{ duration: number }> = ({ duration }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const body = drawn(f, 4, 40);
  const moon = Math.min(1, settle(f, fps, 34));
  const near = Math.min(1, settle(f, fps, 76)) * 56;
  const far = Math.min(1, settle(f, fps, duration * 0.62)) * 52;
  return (
    <svg width={W} height={H}>
      <g opacity={moon}>
        <Axis />
        <Moon />
      </g>
      <Ocean near={near} far={far} />
      <Body progress={body} />
      <g opacity={moon}>
        <Label x={MOON_X} y={CY + MOON_R + 46} text="MOON" anchor="middle" />
      </g>
    </svg>
  );
};

/** sc-03 THE ANNOTATION — the wrong answer, named and struck out, not erased. */
const Annotation: React.FC<{ duration: number }> = ({ duration }) => {
  const f = useCurrentFrame();
  const arc = drawn(f, 26, 78);
  const label = interpolate(f, [66, 92], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const strike = drawn(f, duration - 62, duration - 34);
  return (
    <svg width={W} height={H}>
      <Axis />
      <Moon />
      <Ocean near={56} far={52} />
      <Body progress={1} />
      <Stroke
        d={`M${CX - R_EARTH - 60} ${CY} C ${CX - R_EARTH - 190} ${CY} ${CX - R_EARTH - 230} ${CY - 130} ${CX - R_EARTH - 150} ${CY - 230}`}
        progress={arc}
        color={FORCE}
        width={5}
      />
      {arc > 0.96 ? (
        <path
          d={`M${CX - R_EARTH - 172} ${CY - 196} L${CX - R_EARTH - 150} ${CY - 232} L${CX - R_EARTH - 108} ${CY - 216}`}
          fill="none"
          stroke={FORCE}
          strokeWidth={5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}
      <text
        x={96}
        y={CY - 300}
        fill={FORCE}
        opacity={label}
        fontFamily={HAND}
        fontWeight={600}
        fontSize={72}
      >
        centrifugal force
      </text>
      <Stroke
        d={`M84 ${CY - 322} L${CX + 40} ${CY - 150}`}
        progress={strike}
        color={FORCE}
        width={7}
      />
    </svg>
  );
};

const NEAR_X = CX + R_EARTH;
const FAR_X = CX - R_EARTH;

/** sc-04 THREE PULLS — one arrow per clause, and the lengths are the argument. */
const ThreePulls: React.FC<{ duration: number }> = ({ duration }) => {
  const f = useCurrentFrame();
  const a1 = drawn(f, 10, 40);
  const a2 = drawn(f, 58, 88);
  const a3 = drawn(f, 106, 136);
  return (
    <svg width={W} height={H}>
      <Axis />
      <Moon />
      <Body progress={1} />
      <Arrow x={NEAR_X} y={CY} length={L_NEAR} progress={a1} />
      <Arrow x={CX} y={CY} length={L_CENTRE} progress={a2} />
      <Arrow x={FAR_X} y={CY} length={L_FAR} progress={a3} />
    </svg>
  );
};

/** sc-05 STACKED — the drawing steps outside itself to measure what it drew. */
const Stacked: React.FC<{ duration: number }> = ({ duration }) => {
  const f = useCurrentFrame();
  const move = interpolate(f, [6, 54], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const leaders = drawn(f, 44, 86);
  const BASE = 170;
  // The inset lives in the clear upper third; the figure ghosts below it.
  const rows = [
    { y: 380, from: { x: CX + R_EARTH, y: CY }, len: L_NEAR },
    { y: 470, from: { x: CX, y: CY }, len: L_CENTRE },
    { y: 560, from: { x: CX - R_EARTH, y: CY }, len: L_FAR },
  ];
  return (
    <svg width={W} height={H}>
      <g opacity={0.22}>
        <Axis />
        <Body progress={1} />
      </g>
      <Moon opacity={0.25} />
      <line
        x1={BASE}
        y1={340}
        x2={BASE}
        y2={600}
        stroke={INK}
        strokeWidth={2}
        opacity={0.5 * move}
      />
      {rows.map((r, i) => {
        const x = interpolate(move, [0, 1], [r.from.x, BASE]);
        const y = interpolate(move, [0, 1], [r.from.y, r.y]);
        return (
          <g key={i}>
            <Stroke
              d={`M${BASE + r.len + 26} ${r.y} C ${BASE + r.len + 200} ${r.y} ${r.from.x - 40} ${r.from.y - 120} ${r.from.x} ${r.from.y}`}
              progress={leaders}
              width={2}
              opacity={0.22}
            />
            <Arrow x={x} y={y} length={r.len} progress={1} />
          </g>
        );
      })}
    </svg>
  );
};

/** sc-06 THE SUBTRACTION — the hero beat. Both bulges fall out as arithmetic. */
const Subtraction: React.FC<{ duration: number }> = ({ duration }) => {
  const f = useCurrentFrame();
  const cut = interpolate(f, [6, 46], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // Every arrow loses the centre pull. The two remainders are exactly to scale.
  const near = L_NEAR - cut * L_CENTRE;
  const centre = L_CENTRE * (1 - cut);
  const far = L_FAR - cut * L_CENTRE;
  const water = interpolate(f, [40, duration - 4], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <svg width={W} height={H}>
      <Axis />
      <Moon />
      <Ocean near={58 * water} far={54 * water} opacity={water} />
      <Body progress={1} />
      <Arrow x={NEAR_X} y={CY} length={near} progress={1} />
      <Arrow x={CX} y={CY} length={centre} progress={centre > 9 ? 1 : 0} />
      <Arrow x={FAR_X} y={CY} length={far} progress={1} />
    </svg>
  );
};

/** sc-07 THE BATH — same ink, same page position, three identical arrows. */
const Bath: React.FC<{ duration: number }> = ({ duration }) => {
  const f = useCurrentFrame();
  const tub = drawn(f, 4, 44);
  const a = [drawn(f, 54, 78), drawn(f, 78, 102), drawn(f, 102, 126)];
  const x0 = CX - 300;
  const x1 = CX + 300;
  const top = CY - 130;
  const bottom = CY + 150;
  const waterY = top + 54;
  return (
    <svg width={W} height={H}>
      <Stroke
        d={`M${x0} ${top} L${x0} ${bottom - 46} Q ${x0} ${bottom} ${x0 + 46} ${bottom} L${x1 - 46} ${bottom} Q ${x1} ${bottom} ${x1} ${bottom - 46} L${x1} ${top}`}
        progress={tub}
        width={3}
      />
      {tub > 0.98 ? (
        <>
          <rect x={x0 + 3} y={waterY} width={x1 - x0 - 6} height={bottom - waterY - 4} fill={WATER} opacity={0.2} />
          <line x1={x0 + 3} y1={waterY} x2={x1 - 3} y2={waterY} stroke={WATER} strokeWidth={4} />
        </>
      ) : null}
      <Arrow x={x0 + 40} y={waterY - 44} length={110} progress={a[0]} />
      <Arrow x={CX - 55} y={waterY - 44} length={110} progress={a[1]} />
      <Arrow x={x1 - 150} y={waterY - 44} length={110} progress={a[2]} />
    </svg>
  );
};

const GhostFigure: React.FC<{ moonX?: number }> = ({ moonX = MOON_X }) => (
  <g opacity={0.18}>
    <Axis toX={moonX} />
    <Ocean near={58} far={54} />
    <Body progress={1} />
  </g>
);

const Caption: React.FC<{ text: string; opacity: number }> = ({ text, opacity }) => (
  <div
    style={{
      position: "absolute",
      left: 96,
      right: 120,
      top: 1330,
      fontFamily: SERIF,
      fontWeight: 600,
      fontSize: 64,
      lineHeight: 1.28,
      color: INK,
      whiteSpace: "pre-line",
      opacity,
    }}
  >
    {text}
  </div>
);

/** sc-08 THE CAPTION — set like the caption under a figure. */
const CaptionBeat: React.FC<{ text: string }> = ({ text }) => {
  const f = useCurrentFrame();
  const o = drawn(f, 4, 26);
  const rule = drawn(f, 2, 30);
  return (
    <AbsoluteFill>
      <svg width={W} height={H}>
        <GhostFigure />
        <Moon opacity={0.35} />
        <Stroke d={`M96 1290 L${96 + 300} 1290`} progress={rule} width={2} opacity={0.5} />
      </svg>
      <Caption text={text} opacity={o} />
    </AbsoluteFill>
  );
};

/** sc-09 STILL LEAVING — cut while the Moon is still going. */
const Leaving: React.FC<{ text: string; duration: number }> = ({ text, duration }) => {
  const f = useCurrentFrame();
  const x = MOON_X + interpolate(f, [0, duration], [0, 96]);
  return (
    <AbsoluteFill>
      <svg width={W} height={H}>
        <GhostFigure moonX={x} />
        <Moon x={x} opacity={0.35} />
      </svg>
      <Caption text={text} opacity={1} />
      <svg width={W} height={H} style={{ position: "absolute", top: 0, left: 0 }}>
        <line x1={96} y1={1290} x2={396} y2={1290} stroke={INK} strokeWidth={2} opacity={0.5} />
      </svg>
    </AbsoluteFill>
  );
};

// -------------------------------------------------------------------- scene

const BODY: Record<string, (d: number, caption: string) => React.ReactNode> = {
  "sc-01": (d) => <Marks duration={d} />,
  "sc-02": (d) => <Plate duration={d} />,
  "sc-03": (d) => <Annotation duration={d} />,
  "sc-04": (d) => <ThreePulls duration={d} />,
  "sc-05": (d) => <Stacked duration={d} />,
  "sc-06": (d) => <Subtraction duration={d} />,
  "sc-07": (d) => <Bath duration={d} />,
  "sc-08": (_d, c) => <CaptionBeat text={c} />,
  "sc-09": (d, c) => <Leaving text={c} duration={d} />,
};

export const Scene: React.FC<SceneProps> = ({ caption, scenes }) => {
  const list = scenes && scenes.length ? scenes : DEFAULT_SCENES;
  const text = caption ?? DEFAULT_CAPTION;
  return (
    <AbsoluteFill style={{ background: PAPER }}>
      <Paper />
      {list.map((s) => (
        <Sequence key={s.id} from={s.from} durationInFrames={s.durationInFrames}>
          <AbsoluteFill>{BODY[s.id] ? BODY[s.id](s.durationInFrames, text) : null}</AbsoluteFill>
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

export const calculateMetadata: CalculateMetadataFunction<SceneProps> = ({ props }) => {
  const list = props.scenes && props.scenes.length ? props.scenes : DEFAULT_SCENES;
  const last = list[list.length - 1];
  return { durationInFrames: last.from + last.durationInFrames, fps: FPS, width: W, height: H };
};
