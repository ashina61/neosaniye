import React from "react";
import {
  AbsoluteFill,
  CalculateMetadataFunction,
  Sequence,
  continueRender,
  delayRender,
  interpolate,
  useCurrentFrame,
} from "remotion";
import { ARCHIVO_800, MONO_500 } from "./fonts";

// ----------------------------------------------------------------------------
// ATELIER (BESPOKE) — hand-authored for "The Deadline Inside Your Headphones".
// Art direction: ./art-direction.md   Per-scene plan: ./scenes.md
// Nothing here is imported from the stock scene registry, and nothing here is
// meant to be reused by another video.
// ----------------------------------------------------------------------------

const DISPLAY = "AtelierDisplay";
const MONO = "AtelierMono";

// The render browser does not trust this environment's proxy CA, so a font
// fetched at render time fails. Both faces are inlined as data URIs instead —
// which also makes the render offline and deterministic.
if (typeof document !== "undefined") {
  const handle = delayRender("atelier-fonts", { timeoutInMilliseconds: 60000 });
  let cleared = false;
  const finish = () => {
    if (!cleared) {
      cleared = true;
      continueRender(handle);
    }
  };
  const display = new FontFace(DISPLAY, `url("${ARCHIVO_800}")`, { weight: "800" });
  const mono = new FontFace(MONO, `url("${MONO_500}")`, { weight: "100 800" });
  // The faces are also declared in CSS, so a frame still gets the right type if
  // the FontFace promise is slow under render concurrency.
  const style = document.createElement("style");
  style.textContent =
    `@font-face{font-family:"${DISPLAY}";font-weight:800;src:url("${ARCHIVO_800}") format("woff2");}` +
    `@font-face{font-family:"${MONO}";font-weight:100 800;src:url("${MONO_500}") format("woff2");}`;
  document.head.appendChild(style);
  Promise.all([display.load(), mono.load()])
    .then(([d, m]) => {
      document.fonts.add(d);
      document.fonts.add(m);
    })
    .catch(() => undefined)
    .then(finish);
  // Never let a font stall a render.
  setTimeout(finish, 8000);
}

const W = 1080;
const H = 1920;
const FPS = 30;

const GROUND = "#080B10";
const GRID = "#12212B";
const WORLD = "#3FE0D0";
const ANSWER = "#FF8A3D";
const TYPE = "#F2F5F7";
const DIM = "#7E8A93";

/** One flight of sound across 3 cm of air at 343 m/s. */
const FLIGHT_US = 87;
const FLIGHT_FRAMES = 60;

export interface SceneSpec {
  id: string;
  from: number;
  durationInFrames: number;
  keyline?: string;
}

export interface SceneProps {
  title?: string;
  scenes?: SceneSpec[];
}

/** Frame boundaries derived from the measured narration timeline (30 fps). */
const DEFAULT_SCENES: SceneSpec[] = [
  { id: "sc-01", from: 0, durationInFrames: 101 },
  { id: "sc-02", from: 101, durationInFrames: 196, keyline: "IT ADDS THE OPPOSITE WAVE" },
  { id: "sc-03", from: 297, durationInFrames: 99 },
  { id: "sc-04", from: 396, durationInFrames: 129, keyline: "THE SOUND IS ALREADY MOVING" },
  { id: "sc-05", from: 525, durationInFrames: 90 },
  { id: "sc-06", from: 615, durationInFrames: 111, keyline: "INSIDE THE DEADLINE" },
  { id: "sc-07", from: 726, durationInFrames: 107, keyline: "OUTSIDE IT, NOTHING CANCELS" },
  { id: "sc-08", from: 833, durationInFrames: 142, keyline: "ONLY THE LOW END IS COVERED" },
  { id: "sc-09", from: 975, durationInFrames: 123, keyline: "A VOICE IS TOO QUICK" },
  { id: "sc-10", from: 1098, durationInFrames: 147 },
];

const DEFAULT_TITLE = "The Deadline Inside Your Headphones";

const TOTAL_FRAMES =
  DEFAULT_SCENES[DEFAULT_SCENES.length - 1].from +
  DEFAULT_SCENES[DEFAULT_SCENES.length - 1].durationInFrames;

/** The one moment the instrument stops. */
const FREEZE_FRAME = 1098;

// ---------------------------------------------------------------- primitives

/** Horizontal waveform sampled into an SVG path. */
function wavePath(
  cy: number,
  amp: number,
  wavelength: number,
  phasePx: number,
  x0 = 60,
  x1 = W - 60,
  step = 4,
): string {
  const pts: string[] = [];
  for (let x = x0; x <= x1; x += step) {
    const y = cy + amp * Math.sin((2 * Math.PI * (x + phasePx)) / wavelength);
    pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return "M" + pts.join(" L");
}

/** Vertical waveform — amplitude in x, travelling down y. */
function verticalWavePath(
  cx: number,
  amp: number,
  wavelength: number,
  phasePx: number,
  y0: number,
  y1: number,
  step = 4,
): string {
  const pts: string[] = [];
  for (let y = y0; y <= y1; y += step) {
    const x = cx + amp * Math.sin((2 * Math.PI * (y + phasePx)) / wavelength);
    pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return "M" + pts.join(" L");
}

/**
 * The sum of a wave and its delayed inverse, sampled honestly rather than drawn.
 * offsetPx is the delay expressed in pixels of the on-screen wavelength.
 */
function residualPath(
  cy: number,
  amp: number,
  wavelength: number,
  phasePx: number,
  offsetPx: number,
  x0 = 60,
  x1 = W - 60,
  step = 4,
): string {
  const pts: string[] = [];
  for (let x = x0; x <= x1; x += step) {
    const a = Math.sin((2 * Math.PI * (x + phasePx)) / wavelength);
    const b = -Math.sin((2 * Math.PI * (x + phasePx - offsetPx)) / wavelength);
    pts.push(`${x.toFixed(1)},${(cy + amp * (a + b)).toFixed(1)}`);
  }
  return "M" + pts.join(" L");
}

const Grid: React.FC<{ frozen?: boolean }> = ({ frozen }) => {
  const frame = useCurrentFrame();
  const breathe = frozen ? 0.5 : 0.35 + 0.25 * Math.sin((2 * Math.PI * frame) / 190);
  const rows: React.ReactNode[] = [];
  for (let y = 0; y <= H; y += 120) {
    rows.push(<line key={`h${y}`} x1={0} y1={y} x2={W} y2={y} stroke={GRID} strokeWidth={1} />);
  }
  for (let x = 0; x <= W; x += 120) {
    rows.push(<line key={`v${x}`} x1={x} y1={0} x2={x} y2={H} stroke={GRID} strokeWidth={1} />);
  }
  return (
    <svg width={W} height={H} style={{ position: "absolute", opacity: breathe }}>
      {rows}
    </svg>
  );
};

/** The signature device. Counts one 3 cm flight, over and over, and then stops. */
const Counter: React.FC<{ frozenUs?: number }> = ({ frozenUs }) => {
  const frame = useCurrentFrame();
  const phase = ((frame - 396) % FLIGHT_FRAMES + FLIGHT_FRAMES) % FLIGHT_FRAMES;
  const us =
    frozenUs ?? Math.min(FLIGHT_US, Math.round((phase / FLIGHT_FRAMES) * FLIGHT_US));
  return (
    <div
      style={{
        position: "absolute",
        right: 56,
        top: 250,
        textAlign: "right",
        fontFamily: MONO,
        color: frozenUs === undefined ? WORLD : DIM,
        letterSpacing: 1,
      }}
    >
      <div style={{ fontSize: 26, color: DIM, letterSpacing: 4 }}>IN FLIGHT</div>
      <div style={{ fontSize: 72, fontWeight: 700, lineHeight: 1.1 }}>
        {String(us).padStart(2, "0")}
        <span style={{ fontSize: 34, color: DIM }}> µs</span>
      </div>
    </div>
  );
};

const Keyline: React.FC<{ text?: string; localFrame: number }> = ({ text, localFrame }) => {
  if (!text) return null;
  const o = interpolate(localFrame, [4, 16], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div
      style={{
        position: "absolute",
        left: 72,
        top: 1530,
        fontFamily: MONO,
        fontSize: 34,
        fontWeight: 500,
        letterSpacing: 5,
        color: DIM,
        opacity: o,
      }}
    >
      {text}
    </div>
  );
};

const MicGlyph: React.FC<{ x: number; y: number; opacity: number }> = ({ x, y, opacity }) => (
  <g transform={`translate(${x},${y})`} opacity={opacity}>
    <rect x={-34} y={-74} width={68} height={116} rx={34} stroke={TYPE} strokeWidth={3} fill="none" />
    {[-44, -22, 0, 22].map((gy) => (
      <line key={gy} x1={-20} y1={gy} x2={20} y2={gy} stroke={TYPE} strokeWidth={2} opacity={0.55} />
    ))}
    <path d="M-58 26 A 58 58 0 0 0 58 26" stroke={TYPE} strokeWidth={3} fill="none" />
    <line x1={0} y1={84} x2={0} y2={110} stroke={TYPE} strokeWidth={3} />
  </g>
);

const EarGlyph: React.FC<{ x: number; y: number; opacity: number }> = ({ x, y, opacity }) => (
  <g transform={`translate(${x},${y})`} opacity={opacity}>
    <path
      d="M-6 -78 C 52 -78 74 -26 64 24 C 56 66 26 92 -2 88"
      stroke={TYPE}
      strokeWidth={3}
      fill="none"
    />
    <path
      d="M6 -40 C 40 -40 46 -4 28 20 C 18 34 4 36 -2 26"
      stroke={TYPE}
      strokeWidth={3}
      fill="none"
    />
    <path d="M-2 26 C 6 34 8 46 2 56" stroke={TYPE} strokeWidth={3} fill="none" />
  </g>
);

// ------------------------------------------------------------------- scenes

/** sc-01 DESCENT — the world's noise entering, and never being stopped. */
const Descent: React.FC = () => {
  const f = useCurrentFrame();
  const head = interpolate(f, [0, 101], [-160, H + 200]);
  const phase = f * 9;
  const strike = interpolate(f, [72, 80], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const swap = interpolate(f, [80, 88], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill>
      <svg width={W} height={H}>
        <path
          d={verticalWavePath(824, 132, 260, phase, Math.max(-160, head - 900), Math.min(H + 200, head))}
          stroke={WORLD}
          strokeWidth={6}
          fill="none"
          strokeLinecap="round"
        />
      </svg>
      <div
        style={{
          position: "absolute",
          left: 96,
          top: 360,
          fontFamily: DISPLAY,
          fontWeight: 800,
          fontSize: 140,
          letterSpacing: -4,
          lineHeight: 1,
        }}
      >
        <div style={{ position: "relative", display: "inline-block", opacity: 1 - swap }}>
          <span style={{ color: TYPE }}>BLOCK</span>
          <div
            style={{
              position: "absolute",
              left: 0,
              top: "52%",
              height: 8,
              width: `${strike * 100}%`,
              background: ANSWER,
            }}
          />
        </div>
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            color: ANSWER,
            opacity: swap,
          }}
        >
          ADD
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** sc-02 MIRROR — the mechanism everyone already knows, delivered fast. */
const Mirror: React.FC<{ duration: number }> = ({ duration }) => {
  const f = useCurrentFrame();
  const t = f / duration;
  const phase = f * 7;
  const draw = interpolate(t, [0.06, 0.42], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const converge = interpolate(t, [0.55, 0.82], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const cyanY = interpolate(converge, [0, 1], [780, 960]);
  const amberY = interpolate(converge, [0, 1], [1140, 960]);
  const amp = interpolate(converge, [0, 1], [96, 0]);
  return (
    <AbsoluteFill>
      <svg width={W} height={H}>
        <path
          d={wavePath(cyanY, amp, 300, phase)}
          stroke={WORLD}
          strokeWidth={5}
          fill="none"
          strokeLinecap="round"
        />
        <path
          d={wavePath(amberY, -amp, 300, phase)}
          stroke={ANSWER}
          strokeWidth={5}
          fill="none"
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1 - draw}
        />
      </svg>
    </AbsoluteFill>
  );
};

/** sc-03 THE TURN — the only scene with no drawn subject. */
const Turn: React.FC<{ duration: number }> = ({ duration }) => {
  const f = useCurrentFrame();
  const wipe = interpolate(f, [0, 14], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const type = interpolate(f, [10, 22], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const geo = interpolate(f, [duration * 0.55, duration * 0.95], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill>
      <svg width={W} height={H}>
        <line
          x1={60}
          y1={960}
          x2={interpolate(wipe, [0, 1], [W - 60, 60])}
          y2={960}
          stroke={ANSWER}
          strokeWidth={4}
        />
        <MicGlyph x={540} y={300} opacity={geo * 0.9} />
        <EarGlyph x={540} y={1330} opacity={geo * 0.9} />
      </svg>
      <div
        style={{
          position: "absolute",
          left: 96,
          top: 1120,
          fontFamily: DISPLAY,
          fontWeight: 800,
          fontSize: 96,
          letterSpacing: -2,
          lineHeight: 1.05,
          color: TYPE,
          opacity: type,
        }}
      >
        That part
        <br />
        is easy.
      </div>
    </AbsoluteFill>
  );
};

const MicEarAxis: React.FC<{ pulse?: number | null }> = ({ pulse }) => (
  <svg width={W} height={H}>
    <line x1={540} y1={390} x2={540} y2={1240} stroke={GRID} strokeWidth={2} />
    <MicGlyph x={540} y={300} opacity={0.9} />
    <EarGlyph x={540} y={1330} opacity={0.9} />
    {pulse !== null && pulse !== undefined ? (
      <g>
        <circle cx={540} cy={pulse} r={13} fill={WORLD} />
        <circle cx={540} cy={pulse} r={30} fill="none" stroke={WORLD} strokeWidth={2} opacity={0.5} />
        <circle cx={540} cy={pulse} r={52} fill="none" stroke={WORLD} strokeWidth={2} opacity={0.22} />
      </g>
    ) : null}
    <text x={624} y={312} fill={DIM} fontFamily={MONO} fontSize={30} letterSpacing={4}>
      MIC
    </text>
    <text x={624} y={1342} fill={DIM} fontFamily={MONO} fontSize={30} letterSpacing={4}>
      EAR
    </text>
  </svg>
);

/** sc-04 THE RACE — the sound is already in flight. */
const Race: React.FC = () => {
  const f = useCurrentFrame();
  const phase = (f % FLIGHT_FRAMES) / FLIGHT_FRAMES;
  const y = interpolate(phase, [0, 1], [390, 1240]);
  return (
    <AbsoluteFill>
      <MicEarAxis pulse={y} />
    </AbsoluteFill>
  );
};

/** sc-05 DIMENSIONED — the gap, measured. */
const Dimensioned: React.FC<{ duration: number }> = ({ duration }) => {
  const f = useCurrentFrame();
  const d = interpolate(f, [4, 30], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const label = interpolate(f, [26, 44], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const x = 420;
  const top = 390;
  const bottom = 1240;
  const reach = interpolate(d, [0, 1], [top, bottom]);
  return (
    <AbsoluteFill>
      <MicEarAxis pulse={null} />
      <svg width={W} height={H} style={{ position: "absolute", top: 0, left: 0 }}>
        <line x1={x - 28} y1={top} x2={560} y2={top} stroke={DIM} strokeWidth={2} opacity={d} />
        <line x1={x - 28} y1={bottom} x2={560} y2={bottom} stroke={DIM} strokeWidth={2} opacity={d} />
        <line x1={x} y1={top} x2={x} y2={reach} stroke={ANSWER} strokeWidth={3} />
        <path d={`M${x - 12} ${top + 22} L${x} ${top} L${x + 12} ${top + 22}`} stroke={ANSWER} strokeWidth={3} fill="none" opacity={d} />
        <path
          d={`M${x - 12} ${bottom - 22} L${x} ${bottom} L${x + 12} ${bottom - 22}`}
          stroke={ANSWER}
          strokeWidth={3}
          fill="none"
          opacity={d >= 1 ? 1 : 0}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          left: 84,
          top: 720,
          fontFamily: MONO,
          opacity: label,
          textAlign: "left",
        }}
      >
        <div style={{ fontSize: 84, fontWeight: 700, color: TYPE, lineHeight: 1 }}>3 cm</div>
        <div style={{ fontSize: 40, color: ANSWER, marginTop: 14 }}>= 87 µs</div>
        <div style={{ fontSize: 26, color: DIM, marginTop: 10, letterSpacing: 2 }}>
          AIR · 343 m/s
        </div>
      </div>
    </AbsoluteFill>
  );
};

/**
 * sc-06 / sc-07 — the tolerance and the slip.
 * The residual line is computed, not drawn: it is the true sum of the wave and
 * its delayed inverse, so the picture cannot lie about the physics.
 */
const Offset: React.FC<{ duration: number; fromUs: number; toUs: number; hero: boolean }> = ({
  duration,
  fromUs,
  toUs,
  hero,
}) => {
  const f = useCurrentFrame();
  const t = interpolate(f, [duration * 0.12, duration * 0.62], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const us = interpolate(t, [0, 1], [fromUs, toUs]);
  const phase = f * 5;
  const wavelength = 500; // one 1 kHz cycle on screen
  const offsetPx = (us / 1000) * wavelength;
  const amp = 88;
  const band = interpolate(f, [6, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill>
      <svg width={W} height={H}>
        {/* The delay, drawn to scale: the gap between where the answer should
            have been and where it actually is. */}
        <g opacity={band}>
          <line x1={540} y1={612} x2={540} y2={900} stroke={DIM} strokeWidth={2} strokeDasharray="6 10" />
          <line
            x1={540 + offsetPx}
            y1={612}
            x2={540 + offsetPx}
            y2={900}
            stroke={ANSWER}
            strokeWidth={2}
            strokeDasharray="6 10"
          />
          <line x1={540} y1={628} x2={540 + offsetPx} y2={628} stroke={ANSWER} strokeWidth={3} />
          <rect
            x={540}
            y={612}
            width={Math.max(2, offsetPx)}
            height={288}
            fill={ANSWER}
            opacity={0.12}
          />
        </g>
        <path d={wavePath(760, amp, wavelength, phase)} stroke={WORLD} strokeWidth={5} fill="none" />
        <path
          d={wavePath(760, -amp, wavelength, phase - offsetPx)}
          stroke={ANSWER}
          strokeWidth={5}
          fill="none"
        />
        <line x1={60} y1={1160} x2={W - 60} y2={1160} stroke={GRID} strokeWidth={2} />
        <path
          d={residualPath(1160, amp, wavelength, phase, offsetPx)}
          stroke={hero ? ANSWER : WORLD}
          strokeWidth={hero ? 6 : 4}
          fill="none"
          opacity={0.95}
        />
        <text x={72} y={1240} fill={DIM} fontFamily={MONO} fontSize={28} letterSpacing={4}>
          WHAT REACHES YOUR EAR
        </text>
      </svg>
      <div
        style={{
          position: "absolute",
          right: 56,
          top: 940,
          textAlign: "right",
          fontFamily: MONO,
        }}
      >
        <div style={{ fontSize: 96, fontWeight: 700, color: hero ? ANSWER : TYPE, lineHeight: 1 }}>
          {Math.round(us)}
          <span style={{ fontSize: 40, color: DIM }}> µs</span>
        </div>
        <div style={{ fontSize: 26, color: DIM, letterSpacing: 3, marginTop: 8 }}>
          LATE · 1 kHz = 1000 µs
        </div>
      </div>
    </AbsoluteFill>
  );
};

const FREQ_TOP = 380;
const FREQ_BOTTOM = 1460;
const F_MIN = 20;
const F_MAX = 20000;

const freqY = (f: number) =>
  FREQ_BOTTOM - (Math.log10(f / F_MIN) / Math.log10(F_MAX / F_MIN)) * (FREQ_BOTTOM - FREQ_TOP);

const TICKS: [number, string][] = [
  [50, "50 Hz"],
  [200, "200"],
  [1000, "1 kHz"],
  [2000, "2 kHz"],
  [8000, "8 kHz"],
  [20000, "20 kHz"],
];

/** sc-08 THE BAND — cancellation floods up from the low end and stops. */
const Band: React.FC<{ duration: number }> = ({ duration }) => {
  const f = useCurrentFrame();
  const rise = interpolate(f, [10, duration * 0.72], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const ceiling = freqY(2000);
  const top = interpolate(rise, [0, 1], [FREQ_BOTTOM, ceiling]);
  return (
    <AbsoluteFill>
      <svg width={W} height={H}>
        <line x1={200} y1={FREQ_TOP} x2={200} y2={FREQ_BOTTOM} stroke={DIM} strokeWidth={2} />
        {TICKS.map(([hz, label]) => (
          <g key={hz}>
            <line x1={186} y1={freqY(hz)} x2={200} y2={freqY(hz)} stroke={DIM} strokeWidth={2} />
            <text
              x={172}
              y={freqY(hz) + 10}
              fill={DIM}
              fontFamily={MONO}
              fontSize={28}
              textAnchor="end"
            >
              {label}
            </text>
          </g>
        ))}
        <rect x={200} y={top} width={W - 260} height={FREQ_BOTTOM - top} fill={WORLD} opacity={0.16} />
        <line x1={200} y1={top} x2={W - 60} y2={top} stroke={WORLD} strokeWidth={4} />
      </svg>
    </AbsoluteFill>
  );
};

/** sc-09 ABOVE THE LINE — the band the trick can never reach. */
const AboveTheLine: React.FC<{ duration: number }> = ({ duration }) => {
  const f = useCurrentFrame();
  const ceiling = freqY(2000);
  const live = interpolate(f, [0, 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const settle = interpolate(f, [duration - 22, duration - 6], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const bars: React.ReactNode[] = [];
  for (let i = 0; i < 26; i++) {
    const x = 240 + i * 30;
    const seed = Math.sin(i * 12.9898) * 43758.5453;
    const drift = Math.sin((f + i * 7) / 6 + (seed % 1) * 6.28);
    const h = (34 + 46 * Math.abs(drift)) * live * (0.25 + 0.75 * settle);
    bars.push(
      <line
        key={i}
        x1={x}
        y1={ceiling - 60 - h}
        x2={x}
        y2={ceiling - 60 + h}
        stroke={TYPE}
        strokeWidth={4}
        opacity={0.85}
      />,
    );
  }
  return (
    <AbsoluteFill>
      <svg width={W} height={H}>
        <line x1={200} y1={FREQ_TOP} x2={200} y2={FREQ_BOTTOM} stroke={DIM} strokeWidth={2} />
        {TICKS.map(([hz, label]) => (
          <g key={hz}>
            <line x1={186} y1={freqY(hz)} x2={200} y2={freqY(hz)} stroke={DIM} strokeWidth={2} />
            <text
              x={172}
              y={freqY(hz) + 10}
              fill={DIM}
              fontFamily={MONO}
              fontSize={28}
              textAnchor="end"
            >
              {label}
            </text>
          </g>
        ))}
        <rect
          x={200}
          y={ceiling}
          width={W - 260}
          height={FREQ_BOTTOM - ceiling}
          fill={WORLD}
          opacity={0.16}
        />
        <line x1={200} y1={ceiling} x2={W - 60} y2={ceiling} stroke={WORLD} strokeWidth={4} />
        <text x={240} y={ceiling + 56} fill={WORLD} fontFamily={MONO} fontSize={30} letterSpacing={3}>
          CANCELLED · 50 Hz – 2 kHz
        </text>
        <text x={240} y={ceiling - 150} fill={TYPE} fontFamily={MONO} fontSize={30} letterSpacing={3}>
          A VOICE
        </text>
        {bars}
      </svg>
    </AbsoluteFill>
  );
};

/** sc-10 STILLNESS — the only motionless shot. */
const Stillness: React.FC<{ title: string }> = ({ title }) => (
  <AbsoluteFill>
    <svg width={W} height={H}>
      <line x1={60} y1={960} x2={W - 60} y2={960} stroke={WORLD} strokeWidth={4} />
    </svg>
    <div
      style={{
        position: "absolute",
        left: 96,
        top: 1120,
        fontFamily: DISPLAY,
        fontWeight: 800,
        fontSize: 92,
        letterSpacing: -2,
        lineHeight: 1.05,
        color: TYPE,
      }}
    >
      Silence is not
      <br />a wall.
    </div>
    <div
      style={{
        position: "absolute",
        left: 100,
        top: 1360,
        fontFamily: MONO,
        fontSize: 36,
        letterSpacing: 4,
        color: ANSWER,
      }}
    >
      IT IS ARRIVING ON TIME.
    </div>
    <div
      style={{
        position: "absolute",
        left: 100,
        top: 1530,
        fontFamily: MONO,
        fontSize: 24,
        letterSpacing: 3,
        color: DIM,
      }}
    >
      {title.toUpperCase()}
    </div>
  </AbsoluteFill>
);

// -------------------------------------------------------------------- scene

const SCENE_BODY: Record<string, (d: number, title: string) => React.ReactNode> = {
  "sc-01": () => <Descent />,
  "sc-02": (d) => <Mirror duration={d} />,
  "sc-03": (d) => <Turn duration={d} />,
  "sc-04": () => <Race />,
  "sc-05": (d) => <Dimensioned duration={d} />,
  "sc-06": (d) => <Offset duration={d} fromUs={0} toUs={40} hero={false} />,
  "sc-07": (d) => <Offset duration={d} fromUs={40} toUs={100} hero />,
  "sc-08": (d) => <Band duration={d} />,
  "sc-09": (d) => <AboveTheLine duration={d} />,
  "sc-10": (_d, title) => <Stillness title={title} />,
};

const COUNTER_SCENES = new Set(["sc-04", "sc-05", "sc-06", "sc-07"]);

const SceneShell: React.FC<{ spec: SceneSpec; title: string }> = ({ spec, title }) => {
  const localFrame = useCurrentFrame();
  const body = SCENE_BODY[spec.id];
  return (
    <AbsoluteFill>
      {body ? body(spec.durationInFrames, title) : null}
      {COUNTER_SCENES.has(spec.id) ? <Counter /> : null}
      {spec.id === "sc-10" ? <Counter frozenUs={FLIGHT_US} /> : null}
      <Keyline text={spec.keyline} localFrame={localFrame} />
    </AbsoluteFill>
  );
};

export const Scene: React.FC<SceneProps> = ({ title, scenes }) => {
  const frame = useCurrentFrame();
  const list = scenes && scenes.length ? scenes : DEFAULT_SCENES;
  const heading = title ?? DEFAULT_TITLE;
  return (
    <AbsoluteFill style={{ background: GROUND }}>
      <Grid frozen={frame >= FREEZE_FRAME} />
      {list.map((spec) => (
        <Sequence key={spec.id} from={spec.from} durationInFrames={spec.durationInFrames}>
          <SceneShell spec={spec} title={heading} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

export const calculateMetadata: CalculateMetadataFunction<SceneProps> = ({ props }) => {
  const list = props.scenes && props.scenes.length ? props.scenes : DEFAULT_SCENES;
  const last = list[list.length - 1];
  return {
    durationInFrames: last.from + last.durationInFrames,
    fps: FPS,
    width: W,
    height: H,
  };
};

export const TOTAL = TOTAL_FRAMES;
