/**
 * A CROSS SECTION — cut the thing open and show what happens inside it.
 *
 * Written for the episode that exposed the gap most sharply. Roman concrete is
 * a story about a mechanism you cannot photograph: a crack opens, seawater runs
 * down it, reaches a lump of unslaked lime, the lime dissolves and
 * recrystallises across the gap, and the crack closes. Every one of those five
 * clauses is a physical event inside a solid, and the engine's answer was a
 * sentence in white type.
 *
 * THE RULE: THE DRAWING MUST DEMONSTRATE THE CLAIM, NOT LABEL IT.
 *
 * A hatched rectangle captioned "self-healing concrete" is a diagram of a
 * caption. The crack has to actually propagate, the fluid has to actually run
 * down it, the particle has to actually react, and the gap has to actually
 * close — in that order, each one starting when the last one arrives. If a
 * viewer can pause on any frame and see WHY the next thing happens, the drawing
 * is doing its job.
 *
 * Everything is a fraction of the frame; every event is scene-relative frames.
 */
import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {drawOn, flow, posterizeTime} from '../motion';
import {Callout, Cam, Disclosure, MONO, Sheet, Ticks, weights, worldTransform} from './sheet';
import {Contact, MaterialDefs, MaterialFace, Motes} from './material';

const CLAMP = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

/** A stratum of the material, drawn top to bottom in the order given. */
export type Layer = {
  label?: string;
  /** Share of the section's height. Normalised across all layers. */
  depth: number;
  /** How the stratum is drawn — this is what makes stone look unlike water. */
  fill?: 'solid' | 'hatch' | 'aggregate' | 'grain' | 'void';
  focus?: boolean;
};

/** Something embedded in the material that the story is about. */
export type Inclusion = {
  x: number;
  y: number;
  r: number;
  label?: string;
  /** When it reacts, and what it turns into. */
  reactsAt?: number;
  /** Fraction of itself consumed by the reaction, 0..1. */
  consumes?: number;
};

export type CrossSectionSpec = Sheet & {
  type: 'crossSection';
  layers: Layer[];
  inclusions?: Inclusion[];
  /**
   * THE CRACK — the event the whole section usually exists for.
   *
   * A path down through the layers, given as fractions of the section box. It
   * propagates from the first point to the last between `opensAt` and
   * `opensAt + opensOver`, and closes again over `healsAt` if the story says so.
   */
  crack?: {
    path: [number, number][];
    opensAt: number;
    opensOver?: number;
    /** Where the seal begins. Absent means the crack stays open. */
    healsAt?: number;
    healsOver?: number;
    label?: string;
  };
  /** Fluid running down the crack, arriving after it opens. */
  fluid?: {at: number; label?: string; colour?: string};
  /** New material growing across the gap — the repair, drawn as crystals. */
  growth?: {at: number; over?: number; label?: string};
  annotations?: {x: number; y: number; text: string; side?: 'left' | 'right'; at?: number}[];
  /** A magnification note, because a section is never at life size. */
  scaleNote?: string;
};

/** Deterministic jitter so the aggregate looks like stone, not like a grid. */
function noise(seed: number) {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export const CrossSectionPlate: React.FC<{spec: CrossSectionSpec; w: number; h: number; cam?: Cam}> = ({spec, w, h, cam}) => {
  /** The camera looks AT the world and THROUGH the sheet. */
  const world = worldTransform(cam, w, h);
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const stepped = posterizeTime(frame, fps, 12);
  const from = spec.from ?? 0;
  const accent = spec.accent ?? '#f2b53a';
  const muted = spec.muted ?? '#cfc6ae';
  const line = weights(w);
  if (stepped < from) return null;

  const on = drawOn(stepped, [from, from + 10]);

  /**
   * THE SECTION BOX — set out at frame zero and never animated.
   *
   * Law 30 again, and it matters more here than anywhere: the whole point of a
   * section is that the material is ALREADY THERE and something happens inside
   * it. A section that draws itself on has shown the viewer the wall being
   * built, which is a different film.
   */
  const box = {x: w * 0.12, y: h * 0.24, w: w * 0.76, h: h * 0.42};

  const layers = spec.layers ?? [];
  const total = Math.max(0.0001, layers.reduce((n, l) => n + Math.max(0, l.depth), 0));
  let cursor = box.y;
  const bands = layers.map((layer) => {
    const height = (Math.max(0, layer.depth) / total) * box.h;
    const band = {...layer, top: cursor, height};
    cursor += height;
    return band;
  });

  const crack = spec.crack;
  const open = crack
    ? drawOn(stepped, [from + crack.opensAt, from + crack.opensAt + (crack.opensOver ?? 14)])
    : 0;
  const heal =
    crack?.healsAt !== undefined
      ? drawOn(stepped, [from + crack.healsAt, from + crack.healsAt + (crack.healsOver ?? 20)])
      : 0;

  const crackPoints = (crack?.path ?? []).map(([px, py]) => [box.x + px * box.w, box.y + py * box.h] as [number, number]);
  /** How far down the crack has reached — the fluid can never outrun it. */
  const reached = Math.max(1, Math.floor(crackPoints.length * open));
  const crackD = crackPoints
    .slice(0, Math.max(2, reached))
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x} ${y}`)
    .join(' ');

  const fluidOn = spec.fluid ? drawOn(stepped, [from + spec.fluid.at, from + spec.fluid.at + 16]) : 0;
  const growOn = spec.growth ? drawOn(stepped, [from + spec.growth.at, from + spec.growth.at + (spec.growth.over ?? 22)]) : 0;

  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{position: 'absolute', inset: 0}}>
        <Ticks colour={muted} w={w} h={h} on={on} />

        {/* THE WORLD. Everything below here is what the camera is looking at;
            the ticks above and the plates below are the sheet it is drawn on. */}
        <g transform={world}>
        <MaterialDefs id="cs-concrete" material="concrete" colour={muted} w={w} seed="section" />
        <MaterialDefs id="cs-water" material="water" colour="#7fb2c4" w={w} seed="fluid" />

        <defs>
          <pattern id="csHatch" width={w * 0.018} height={w * 0.018} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2={w * 0.018} stroke={muted} strokeWidth={line.construction} />
          </pattern>
          <clipPath id="csBox">
            <rect x={box.x} y={box.y} width={box.w} height={box.h} />
          </clipPath>
        </defs>

        {/* THE STRATA. Each one drawn the way its material behaves. */}
        <g clipPath="url(#csBox)">
          {bands.map((band, i) => (
            <g key={i}>
              <rect
                x={box.x}
                y={band.top}
                width={box.w}
                height={band.height}
                fill={band.fill === 'hatch' ? 'url(#csHatch)' : band.focus ? `${accent}14` : `${muted}0e`}
                stroke="none"
              />
              {band.fill === 'aggregate'
                ? Array.from({length: 34}, (_, k) => {
                    const cx = box.x + noise(i * 40 + k) * box.w;
                    const cy = band.top + noise(i * 91 + k * 3) * band.height;
                    const r = w * (0.006 + noise(k * 7 + i) * 0.014);
                    return (
                      <circle key={k} cx={cx} cy={cy} r={r} fill="none" stroke={muted} strokeWidth={line.construction} opacity={0.55} />
                    );
                  })
                : null}
              {band.fill === 'grain'
                ? Array.from({length: 60}, (_, k) => {
                    const cx = box.x + noise(i * 13 + k * 5) * box.w;
                    const cy = band.top + noise(i * 29 + k) * band.height;
                    return <circle key={k} cx={cx} cy={cy} r={w * 0.0018} fill={muted} opacity={0.5} />;
                  })
                : null}
              <MaterialFace
                id="cs-concrete"
                material="concrete"
                rect={{x: box.x, y: band.top, w: box.w, h: band.height}}
                w={w}
              />
              <line
                x1={box.x}
                y1={band.top}
                x2={box.x + box.w}
                y2={band.top}
                stroke={band.focus ? accent : muted}
                strokeWidth={band.focus ? line.detail : line.construction}
                opacity={0.8}
              />
            </g>
          ))}
        </g>

        {/* THE CRACK. It propagates DOWN, and nothing that depends on it can
            start before it has reached them. */}
        {crack && open > 0 ? (
          <g clipPath="url(#csBox)">
            <path
              d={crackD}
              fill="none"
              stroke={accent}
              strokeWidth={line.object * (1 - heal * 0.85)}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={1 - heal * 0.55}
            />
            {/* A hairline of relief either side: a crack in a solid opens the
                material around it, and one line alone reads as a drawn stroke. */}
            <path
              d={crackD}
              fill="none"
              stroke={accent}
              strokeWidth={line.object * 2.6 * (1 - heal)}
              opacity={0.13 * (1 - heal)}
              strokeLinecap="round"
            />
          </g>
        ) : null}

        {/* THE FLUID, running down the crack it cannot outrun. */}
        {spec.fluid && fluidOn > 0 && crackPoints.length > 1 ? (
          <g clipPath="url(#csBox)">
            {Array.from({length: 7}, (_, k) => {
              /**
               * WATER DOES NOT EASE.
               *
               * Anything that eases has stopped being a fluid and started being
               * an object travelling from A to B. Each droplet runs on a
               * continuous cycle, offset by its index, bounded by how far the
               * crack has actually opened — so it can never outrun the channel
               * it is running down.
               */
              const cycled = flow(Math.max(0, stepped - (from + (spec.fluid?.at ?? 0))), fps, 0.5 + k * 0.04);
              const lead = Math.min(open, fluidOn) * (0.25 + cycled * 0.7);
              const at = Math.min(crackPoints.length - 1, Math.max(0, lead * (crackPoints.length - 1)));
              const i = Math.floor(at);
              const t = at - i;
              const p0 = crackPoints[i];
              const p1 = crackPoints[Math.min(crackPoints.length - 1, i + 1)];
              return (
                <circle
                  key={k}
                  cx={p0[0] + (p1[0] - p0[0]) * t}
                  cy={p0[1] + (p1[1] - p0[1]) * t}
                  r={w * 0.0055}
                  fill={spec.fluid?.colour ?? '#7fb2c4'}
                  opacity={(0.85 - k * 0.09) * (1 - heal)}
                />
              );
            })}
          </g>
        ) : null}

        {/* THE INCLUSIONS. They sit in the material from the start — they are
            not new, which is the whole surprise of the concrete story — and
            they are CONSUMED when the fluid reaches them. */}
        {(spec.inclusions ?? []).map((inc, i) => {
          const cx = box.x + inc.x * box.w;
          const cy = box.y + inc.y * box.h;
          const react = inc.reactsAt === undefined ? 0 : drawOn(stepped, [from + inc.reactsAt, from + inc.reactsAt + 18]);
          const shrink = 1 - react * (inc.consumes ?? 0.7);
          return (
            <g key={`i${i}`}>
              <circle
                cx={cx}
                cy={cy}
                r={inc.r * w * shrink}
                fill={react > 0.05 ? `${accent}33` : `${muted}22`}
                stroke={react > 0.05 ? accent : muted}
                strokeWidth={line.detail}
              />
              {/* The reaction: material leaving the particle and going somewhere. */}
              {react > 0.1
                ? Array.from({length: 8}, (_, k) => {
                    const a = (k / 8) * Math.PI * 2;
                    const d = inc.r * w + react * w * 0.05;
                    return (
                      <line
                        key={k}
                        x1={cx + Math.cos(a) * inc.r * w * shrink}
                        y1={cy + Math.sin(a) * inc.r * w * shrink}
                        x2={cx + Math.cos(a) * d}
                        y2={cy + Math.sin(a) * d}
                        stroke={accent}
                        strokeWidth={line.construction}
                        opacity={0.55 * react}
                      />
                    );
                  })
                : null}
            </g>
          );
        })}

        {/* THE GROWTH — new mineral crossing the gap. Drawn as blades, because
            that is what a crystal front looks like and because a smooth fill
            would read as the crack being erased rather than bridged. */}
        {spec.growth && growOn > 0 && crackPoints.length > 1 ? (
          <g clipPath="url(#csBox)">
            {Array.from({length: 16}, (_, k) => {
              const at = ((k + 0.5) / 16) * (crackPoints.length - 1);
              const i = Math.floor(at);
              const t = at - i;
              const p0 = crackPoints[i];
              const p1 = crackPoints[Math.min(crackPoints.length - 1, i + 1)];
              const x = p0[0] + (p1[0] - p0[0]) * t;
              const y = p0[1] + (p1[1] - p0[1]) * t;
              const grown = Math.max(0, Math.min(1, growOn * 1.6 - k / 24));
              if (grown <= 0) return null;
              const len = w * 0.016 * grown;
              return (
                <g key={k} opacity={0.9}>
                  <line x1={x - len} y1={y} x2={x + len} y2={y} stroke="#e9e2cf" strokeWidth={line.detail} />
                  <line x1={x} y1={y - len * 0.55} x2={x} y2={y + len * 0.55} stroke="#e9e2cf" strokeWidth={line.construction} />
                </g>
              );
            })}
          </g>
        ) : null}

        {/* THE SECTION'S OWN EDGE, last, so nothing spills over it. And a
            contact shadow beneath, so the block of material sits on the sheet
            instead of floating on it. */}
        <Contact x={box.x + box.w / 2} y={box.y + box.h + w * 0.008} width={box.w} strength={0.6} />
        <rect x={box.x} y={box.y} width={box.w} height={box.h} fill="none" stroke={muted} strokeWidth={line.detail} />

        {bands
          .filter((b) => b.label)
          .map((band, i) => (
            <Callout
              key={`bl${i}`}
              // ON THE LEFT. The section box reaches 0.88 of the frame, so a
              // right-hand callout plus its leader plus its text ran off the
              // edge — "SURFACE" shipped as "SURFA". The left band is empty.
              x={box.x}
              y={band.top + band.height / 2}
              text={String(band.label)}
              colour={band.focus ? accent : muted}
              w={w}
              side="left"
              lead={0.03}
              at={from + 6 + i * 5}
            />
          ))}

        {(spec.annotations ?? []).map((note, i) => (
          <Callout
            key={`a${i}`}
            x={box.x + note.x * box.w}
            y={box.y + note.y * box.h}
            text={note.text}
            colour={accent}
            w={w}
            side={note.side ?? 'left'}
            at={from + (note.at ?? 20 + i * 8)}
          />
        ))}
        </g>
      </svg>

      {spec.scaleNote ? (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: h * 0.7,
            textAlign: 'center',
            fontFamily: MONO,
            fontSize: w * 0.022,
            letterSpacing: '0.28em',
            color: muted,
            opacity: 0.66 * on,
            textTransform: 'uppercase',
          }}
        >
          {spec.scaleNote}
        </div>
      ) : null}

      <Disclosure text={spec.disclosure ?? 'schematic section · not to scale'} colour={muted} at={from + 12} width={w} />
    </AbsoluteFill>
  );
};

export {interpolate, CLAMP};
