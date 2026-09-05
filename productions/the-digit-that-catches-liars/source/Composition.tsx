import React from "react";
import {
  AbsoluteFill,
  CalculateMetadataFunction,
  OffthreadVideo,
  Sequence,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { GROTESK_500, GROTESK_700, MONO_400 } from "./fonts";

// ----------------------------------------------------------------------------
// ATELIER (BESPOKE) — hand-authored for "The Digit That Catches Liars".
//
// This layer is glass, not image. Every pixel of the picture comes from Manim
// (projects/<slug>/manim/benford.py); what lives here is the chip that names
// the current idea, the burned captions, and two annotations. That division is
// the point of the production: the reference video's grammar — annotation over
// footage — with drawn footage underneath.
//
// Checked against productions/STYLE_LEDGER.md before design. Nothing here is
// carried over from how-headphones-erase-sound or why-the-sea-rises-twice, and
// nothing here is meant to be carried into whatever comes next.
// ----------------------------------------------------------------------------

const SANS = "InstrumentSans";
const MONO = "InstrumentMono";

// The render browser does not trust this environment's proxy CA, so a font
// fetched at render time fails. Both faces are inlined as data URIs and
// declared in CSS, which needs no network and therefore no delayRender: an
// unresolved delayRender aborts the whole render, and Remotion fakes timers
// during a render so a setTimeout fallback never fires.
if (typeof document !== "undefined" && !document.getElementById("instrument-fonts")) {
  const style = document.createElement("style");
  style.id = "instrument-fonts";
  style.textContent =
    `@font-face{font-family:"${SANS}";font-weight:500;font-display:block;src:url("${GROTESK_500}") format("woff2");}` +
    `@font-face{font-family:"${SANS}";font-weight:700;font-display:block;src:url("${GROTESK_700}") format("woff2");}` +
    `@font-face{font-family:"${MONO}";font-weight:400;font-display:block;src:url("${MONO_400}") format("woff2");}`;
  document.head.appendChild(style);
}

const W = 1080;
const H = 1920;
const FPS = 30;

const SLATE = "#161A26";
const BONE = "#F0EAD8";
const DIM = "#79809A";
const ACCENT = "#C9E265";
const MAG = "#E5487B";

export type Caption = {
  text: string;
  emph: string[];
  emphColor: "accent" | "magenta";
  fromFrame: number;
  durationInFrames: number;
};

export type Shot = { id: string; fromFrame: number; durationInFrames: number };

export type SceneProps = {
  shots: Shot[];
  captions: Caption[];
};

// ── the chip ────────────────────────────────────────────────────────────────
// The reference names the current idea in a dark pill top-left. Naming the idea
// is the good part and it is taken; the pill is not. Ours is an index mark: a
// short accent bar and letterspaced caps, the way a label sits on an instrument.
// sc04 has none — that shot is the pivot and the frame is deliberately bare.
const CHIPS: { from: number; to: number; label: string }[] = [
  { from: 0, to: 156, label: "Real numbers" },
  { from: 156, to: 284, label: "The obvious guess" },
  { from: 284, to: 436, label: "What actually happens" },
  { from: 526, to: 760, label: "A ruler for multiplying" },
  { from: 760, to: 1001, label: ".301 against .046" },
  { from: 1001, to: 1112, label: "The whole law" },
  { from: 1112, to: 1289, label: "Why auditors run it" },
  { from: 1289, to: 1415, label: "One real case" },
  { from: 1415, to: 1698, label: "The condition" },
];

const Chip: React.FC = () => {
  const frame = useCurrentFrame();
  const chip = CHIPS.find((c) => frame >= c.from && frame < c.to);
  if (!chip) return null;
  // The bar draws down at a constant rate over four frames. Nothing here eases.
  const grow = Math.min(1, (frame - chip.from) / 4);
  return (
    <div
      style={{
        position: "absolute",
        left: 64,
        top: 128,
        display: "flex",
        alignItems: "center",
        gap: 20,
      }}
    >
      <div style={{ width: 7, height: 38 * grow, background: ACCENT }} />
      <div
        style={{
          fontFamily: SANS,
          fontWeight: 500,
          fontSize: 27,
          letterSpacing: "0.19em",
          textTransform: "uppercase",
          color: BONE,
          opacity: 0.93,
          paddingTop: 3,
        }}
      >
        {chip.label}
      </div>
    </div>
  );
};

// ── the captions ────────────────────────────────────────────────────────────
// Burned in, styled for this piece: the same grotesque as the chip, sitting in
// the clear band under the drawing. The load-bearing word is marked in the
// accent — except once, at the turn, where it is marked in the reserved colour.
const Captions: React.FC<{ captions: Caption[] }> = ({ captions }) => {
  const frame = useCurrentFrame();
  const c = captions.find(
    (x) => frame >= x.fromFrame && frame < x.fromFrame + x.durationInFrames,
  );
  if (!c) return null;
  const mark = c.emphColor === "magenta" ? MAG : ACCENT;
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: 1286,
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: 880,
          textAlign: "center",
          fontFamily: SANS,
          fontWeight: 500,
          fontSize: 54,
          lineHeight: 1.24,
          color: BONE,
          textShadow: `0 2px 18px ${SLATE}`,
        }}
      >
        {c.text.split(" ").map((w, i) => (
          <span key={i} style={{ color: c.emph.includes(w) ? mark : BONE }}>
            {w}
            {i < c.text.split(" ").length - 1 ? " " : ""}
          </span>
        ))}
      </div>
    </div>
  );
};

// ── the annotations ─────────────────────────────────────────────────────────
// Point at the thing. Two of them, and both carry a number the picture does not
// already say out loud. A third would be decoration.

/** sc07 — the two readings are on screen; this is the ratio between them. */
const RatioBracket: React.FC = () => {
  const frame = useCurrentFrame();
  const local = frame - 760;
  if (local < 46 || local >= 122) return null; // sc07 only
  const grow = Math.min(1, (local - 46) / 7); // constant rate, four frames
  const x0 = 235;
  const x1 = 962;
  return (
    <>
      <div
        style={{
          position: "absolute",
          left: x0,
          top: 1032,
          width: (x1 - x0) * grow,
          height: 3,
          background: ACCENT,
        }}
      />
      {[x0, x1].map((x, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: x,
            top: 1020,
            width: 3,
            height: 15,
            background: ACCENT,
            opacity: grow === 1 ? 1 : 0,
          }}
        />
      ))}
      {grow === 1 ? (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 1058,
            textAlign: "center",
            fontFamily: MONO,
            fontSize: 40,
            color: ACCENT,
          }}
        >
          6.5 ×
        </div>
      ) : null}
    </>
  );
};

/** sc10 — Manim labels the real curve; this labels the thing it is beaten by. */
const TypedLabel: React.FC = () => {
  const frame = useCurrentFrame();
  const local = frame - 1112;
  if (local < 20 || local >= 177) return null; // sc10 only
  return (
    <>
      <div
        style={{
          position: "absolute",
          left: 96,
          top: 928,
          fontFamily: SANS,
          fontWeight: 500,
          fontSize: 30,
          color: BONE,
          opacity: 0.82,
        }}
      >
        what a person types
      </div>
      <div
        style={{
          position: "absolute",
          left: 96,
          top: 972,
          width: 268,
          height: 2,
          background: BONE,
          opacity: 0.42,
        }}
      />
    </>
  );
};

// ── the piece ───────────────────────────────────────────────────────────────
export const Scene: React.FC<SceneProps> = ({ shots, captions }) => (
  <AbsoluteFill style={{ backgroundColor: SLATE }}>
    {shots.map((s) => (
      <Sequence
        key={s.id}
        from={s.fromFrame}
        durationInFrames={s.durationInFrames}
        name={s.id}
      >
        <OffthreadVideo
          src={staticFile(`${s.id}.mp4`)}
          muted
          style={{ width: W, height: H }}
        />
      </Sequence>
    ))}
    <Chip />
    <RatioBracket />
    <TypedLabel />
    <Captions captions={captions} />
  </AbsoluteFill>
);

export const calculateMetadata: CalculateMetadataFunction<SceneProps> = ({
  props,
}) => {
  const last = props.shots[props.shots.length - 1];
  return {
    durationInFrames: last.fromFrame + last.durationInFrames,
    fps: FPS,
    width: W,
    height: H,
  };
};
