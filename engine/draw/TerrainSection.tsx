/**
 * TERRAIN SECTION — the land from the side, the water standing in it, and the
 * mass that moves.
 *
 * The claim class, stated once so nothing here has to know a subject:
 *
 *     a landform holds a body of water against a structure; a mass inside the
 *     landform rests on a weaker bed; fluid reaches that bed; the mass releases
 *     along it, travels, and takes the water's place; the water leaves the only
 *     way it can.
 *
 * That is a reservoir landslide. It is also a glacier on its bed, a cliff
 * slumping into the sea, a mine roof onto a working, a flank collapse into a
 * crater lake. The mechanism is the same and so is the drawing, which is the
 * only reason this belongs in a shared vocabulary rather than in one episode.
 *
 * FOUR RULES SHAPE THIS FILE.
 *
 * 1. THE GROUND IS ONE PROFILE. Not layers, not a box: a single polyline read
 *    left to right, with the beds hung UNDER it so they follow it. A section
 *    whose strata are horizontal while its surface is not is a diagram of two
 *    different places.
 *
 * 2. THE MASS SLIDES ON ITS PLANE. It is displaced along the declared surface
 *    and not through the air, because the plane is the argument — "it was
 *    always going to go, and this is what it was going to go on".
 *
 * 3. THE WATER RISE IS COMPUTED, NEVER STATED. The level goes up by the area
 *    the mass takes from the basin, divided by the width of the basin at that
 *    level. A planner that could type the new level could type it wrong, and
 *    the whole claim of the drawing is that the rock and the water are the same
 *    volume. So the number has one source (law 15, applied to a geometry).
 *
 * 4. IT IS A RECONSTRUCTION AND IT SAYS SO. Nothing here was photographed. The
 *    disclosure is pinned to the sheet, outside the camera (law 34).
 */
import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {drawOn, flow, posterizeTime, settle} from '../motion';
import {MaterialDefs, MaterialFace, Motes} from './material';
import {Cam, Callout, Disclosure, MONO, Sheet, Ticks, setUp, weights, worldTransform} from './sheet';

const CLAMP = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

export type TerrainSectionSpec = Sheet & {
  type: 'terrainSection';
  /**
   * The ground surface, left to right, in fractions of the frame. y grows
   * downward like everything else here, so a peak is a SMALL y.
   */
  profile: [number, number][];
  /** Beds under the surface, shallowest first. `weak` is the one that lets go. */
  beds?: {label?: string; depth: number; weak?: boolean}[];
  /** Standing water: the level it is impounded at, as a fraction. */
  water?: {level: number; label?: string};
  /** What holds the water in — a dam, a moraine, a sea wall. */
  structure?: {x: number; base: number; width: number; label?: string; height?: string};
  /** The mass that goes. THE event. */
  mass?: {
    /** Its outline, in fractions. */
    shape: [number, number][];
    /** The surface it rests on and slides along. */
    plane: [number, number][];
    /** How far it travels, as a fraction of the frame. */
    to: [number, number];
    at: number;
    over: number;
    label?: string;
    volume?: string;
  };
  /** Fluid soaking into a bed: the CAUSE, and it arrives first. */
  seepage?: {at: number; over?: number; label?: string};
  /** The water leaving over the structure: the CONSEQUENCE, and it arrives last. */
  overtop?: {at: number; over?: number; label?: string};
  annotations?: {x: number; y: number; text: string; side?: 'left' | 'right'; at?: number}[];
  scaleNote?: string;
};

/** A polyline as an SVG path, in pixels. */
const line = (pts: [number, number][], w: number, h: number) =>
  pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x * w} ${y * h}`).join(' ');

/** A closed polygon. */
const poly = (pts: [number, number][], w: number, h: number) => `${line(pts, w, h)} Z`;

/** The area of a polygon in fraction-squared units, for the displacement sum. */
function areaOf(pts: [number, number][]): number {
  let a = 0;
  for (let i = 0; i < pts.length; i += 1) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a) / 2;
}

/** The ground's height at x, by walking the profile. */
function groundAt(profile: [number, number][], x: number): number {
  for (let i = 1; i < profile.length; i += 1) {
    const [x1, y1] = profile[i - 1];
    const [x2, y2] = profile[i];
    if (x >= x1 && x <= x2) {
      const t = x2 === x1 ? 0 : (x - x1) / (x2 - x1);
      return y1 + (y2 - y1) * t;
    }
  }
  return profile[profile.length - 1]?.[1] ?? 0.6;
}

export const TerrainSectionPlate: React.FC<{spec: TerrainSectionSpec; cam?: Cam}> = ({spec, cam}) => {
  const frame = useCurrentFrame();
  const {fps, width: w, height: h} = useVideoConfig();
  const stepped = posterizeTime(frame, fps, 12);

  const from = spec.from ?? 0;
  if (stepped < from) return null;
  const accent = spec.accent ?? '#e8e2d4';
  const muted = spec.muted ?? '#cfc6ae';
  const weight = weights(w);
  const on = setUp(stepped, from);

  const profile = spec.profile?.length >= 2 ? spec.profile : ([[0, 0.5], [1, 0.5]] as [number, number][]);
  const floor = 1.02;
  /** The ground as a closed shape: the surface, then down and back along the base. */
  const ground: [number, number][] = [...profile, [profile[profile.length - 1][0], floor], [profile[0][0], floor]];

  /**
   * THE MASS, AND WHERE IT HAS GOT TO.
   *
   * `slid` is the eased progress along the plane. The shape is translated by
   * the declared displacement — no rotation, no morph: a slab that changes
   * shape as it goes is a fluid, and the argument here is that it was a slab.
   */
  const mass = spec.mass;
  const slid = mass ? settle(drawOn(stepped, [from + mass.at, from + mass.at + mass.over])) : 0;
  const dx = mass ? mass.to[0] * slid : 0;
  const dy = mass ? mass.to[1] * slid : 0;
  const massNow: [number, number][] | null = mass
    ? (mass.shape.map(([x, y]) => [x + dx, y + dy]) as [number, number][])
    : null;

  /**
   * AND WHAT IT TOOK FROM THE BASIN.
   *
   * Only the part of the mass that has arrived BELOW the water line displaces
   * anything, so the rise follows the slide rather than jumping when it starts.
   * The basin's width is measured at the still level; area over width is a
   * height, and that height is the rise. It is a section, so this is honest
   * two-dimensional bookkeeping and not a hand-wave.
   */
  const still = spec.water?.level ?? null;
  let rise = 0;
  if (mass && massNow && still !== null) {
    const submerged = massNow.filter(([, y]) => y > still);
    const share = submerged.length / Math.max(1, massNow.length);
    const basinLeft = Math.min(...massNow.map(([x]) => x), spec.structure?.x ?? 1);
    const basinRight = spec.structure ? spec.structure.x : 1;
    const span = Math.max(0.12, basinRight - basinLeft);
    rise = (areaOf(massNow) * share) / span;
  }
  const level = still === null ? null : Math.max(0.02, still - rise);

  /** Water fills from its level down to the ground, clipped by the terrain. */
  const waterShape: [number, number][] | null =
    level === null
      ? null
      : ([
          [profile[0][0], level],
          [spec.structure ? spec.structure.x : profile[profile.length - 1][0], level],
          [spec.structure ? spec.structure.x : profile[profile.length - 1][0], floor],
          [profile[0][0], floor],
        ] as [number, number][]);

  const seep = spec.seepage
    ? drawOn(stepped, [from + spec.seepage.at, from + spec.seepage.at + (spec.seepage.over ?? 20)])
    : 0;
  const spill = spec.overtop
    ? drawOn(stepped, [from + spec.overtop.at, from + spec.overtop.at + (spec.overtop.over ?? 18)])
    : 0;

  const world = worldTransform(cam, w, h);
  const crest = spec.structure ? spec.structure.base : 0;

  return (
    <AbsoluteFill>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{position: 'absolute', inset: 0}}>
        <MaterialDefs id="ts-rock" material="stone" colour={muted} w={w} seed="rock" />
        <MaterialDefs id="ts-water" material="water" colour="#7fb2c4" w={w} seed="lake" />
        <MaterialDefs id="ts-built" material="concrete" colour={muted} w={w} seed="dam" />
        <defs>
          <clipPath id="ts-ground">
            <path d={poly(ground, w, h)} />
          </clipPath>
        </defs>

        <g transform={world}>
          {/* THE WATER, under the land so the shoreline is the ground's edge. */}
          {waterShape ? (
            <g>
              <path d={poly(waterShape, w, h)} fill="#0a0f14" />
              <MaterialFace id="ts-water" material="water" d={poly(waterShape, w, h)} w={w} />
              {/* Two swell lines. A lake that is perfectly flat is a diagram of
                  a lake, and the whole shot is about this water moving. */}
              {[0, 1].map((k) => {
                const off = flow(stepped, fps, 0.04 + k * 0.02) * w * 0.24;
                const y = (level! + 0.004 + k * 0.012) * h;
                return (
                  <path
                    key={k}
                    d={`M ${-w * 0.3 + off} ${y} q ${w * 0.09} ${-h * 0.004} ${w * 0.18} 0 t ${w * 0.18} 0 t ${w * 0.18} 0 t ${w * 0.18} 0 t ${w * 0.18} 0 t ${w * 0.18} 0 t ${w * 0.18} 0`}
                    fill="none"
                    stroke="#7fb2c4"
                    strokeWidth={weight.construction}
                    opacity={0.18}
                  />
                );
              })}
              {/* THE STILL LEVEL STAYS DRAWN once the water has risen above it:
                  the rise is only legible against where the water WAS. */}
              {rise > 0.004 ? (
                <g opacity={0.55}>
                  <path
                    d={`M ${profile[0][0] * w} ${still! * h} L ${(spec.structure ? spec.structure.x : 1) * w} ${still! * h}`}
                    stroke={muted}
                    strokeWidth={weight.construction}
                    strokeDasharray={`${w * 0.008} ${w * 0.008}`}
                    fill="none"
                  />
                </g>
              ) : null}
            </g>
          ) : null}

          {/* THE LAND. */}
          <path d={poly(ground, w, h)} fill="#0d0b09" />
          <MaterialFace id="ts-rock" material="stone" d={poly(ground, w, h)} w={w} />
          <path d={line(profile, w, h)} fill="none" stroke={muted} strokeWidth={weight.object} />

          {/* THE BEDS, hung under the surface so they FOLLOW it. A weak bed is
              the one the story is about, so it is the one drawn in accent. */}
          <g clipPath="url(#ts-ground)">
            {(spec.beds ?? []).map((bed, i) => {
              const shifted = profile.map(([x, y]) => [x, y + bed.depth]) as [number, number][];
              const wet = bed.weak ? seep : 0;
              return (
                <g key={`b${i}`}>
                  <path
                    d={line(shifted, w, h)}
                    fill="none"
                    stroke={bed.weak ? accent : muted}
                    strokeWidth={bed.weak ? weight.emphasis : weight.detail}
                    strokeDasharray={bed.weak ? undefined : `${w * 0.01} ${w * 0.008}`}
                    opacity={bed.weak ? 0.45 + wet * 0.55 : 0.5}
                  />
                  {/* SEEPAGE IS DRAWN ON THE BED IT WEAKENS, not near it: the
                      claim is that the water got INTO this surface. */}
                  {bed.weak && wet > 0.02 ? (
                    <path
                      d={line(shifted, w, h)}
                      fill="none"
                      stroke="#7fb2c4"
                      strokeWidth={weight.object}
                      strokeDasharray={`${w * 0.9} ${w * 0.9}`}
                      strokeDashoffset={w * 0.9 * (1 - wet)}
                      opacity={0.7}
                    />
                  ) : null}
                </g>
              );
            })}
          </g>

          {/* THE PLANE THE MASS RESTS ON, and then leaves. */}
          {mass ? (
            <path
              d={line(mass.plane, w, h)}
              fill="none"
              stroke={accent}
              strokeWidth={weight.detail}
              strokeDasharray={`${w * 0.012} ${w * 0.009}`}
              opacity={0.5 + seep * 0.4}
            />
          ) : null}

          {/* THE MASS. Drawn after the ground so it reads as a body ON it. */}
          {mass && massNow ? (
            <g>
              <path d={poly(massNow, w, h)} fill="#131110" />
              <MaterialFace id="ts-rock" material="stone" d={poly(massNow, w, h)} w={w} />
              <path
                d={poly(massNow, w, h)}
                fill="none"
                stroke={accent}
                strokeWidth={weight.object}
                opacity={0.9}
              />
              {/* Debris where it lands, once it is actually moving. */}
              {slid > 0.35 ? (
                <Motes w={w} h={h} colour={muted} count={14} seed="slide" band={[0.5, 0.8]} />
              ) : null}
            </g>
          ) : null}

          {/* THE STRUCTURE. Drawn last: it is in front of the water. */}
          {spec.structure ? (
            <g>
              {(() => {
                const s = spec.structure!;
                const foot = groundAt(profile, s.x);
                const box: [number, number][] = [
                  [s.x - s.width / 2, s.base],
                  [s.x + s.width / 2, s.base],
                  [s.x + s.width / 2, Math.max(foot, s.base) + 0.001],
                  [s.x - s.width / 2, Math.max(foot, s.base) + 0.001],
                ];
                return (
                  <>
                    <path d={poly(box, w, h)} fill="#141210" />
                    <MaterialFace id="ts-built" material="concrete" d={poly(box, w, h)} w={w} />
                    <path d={poly(box, w, h)} fill="none" stroke={accent} strokeWidth={weight.object} />
                    {/* THE WATER GOING OVER. It leaves the crest and falls; a
                        glow or a flash here would be decoration, and this is
                        the consequence the whole section was built to show. */}
                    {spill > 0.02 ? (
                      <g opacity={Math.min(1, spill * 1.4)}>
                        <path
                          d={`M ${(s.x - s.width / 2) * w} ${s.base * h}
                              C ${(s.x + s.width * 0.2) * w} ${(s.base - 0.012 * spill) * h},
                                ${(s.x + s.width * 0.8) * w} ${(s.base + 0.05 * spill) * h},
                                ${(s.x + s.width * 0.75) * w} ${(s.base + 0.22 * spill) * h}
                              L ${(s.x + s.width / 2) * w} ${(s.base + 0.2 * spill) * h}
                              L ${(s.x + s.width / 2) * w} ${s.base * h} Z`}
                          fill="#7fb2c4"
                          opacity={0.45}
                        />
                        <Motes w={w} h={h} colour="#cfe4ec" count={10} seed="spill" band={[0.3, 0.6]} />
                      </g>
                    ) : null}
                  </>
                );
              })()}
            </g>
          ) : null}

          {/* THE STRUCTURE'S HEIGHT, as a dimension rather than a claim in a
              caption: a number beside the thing it measures. */}
          {spec.structure?.height ? (
            <g opacity={on * 0.9}>
              {(() => {
                const s = spec.structure!;
                const x = (s.x + s.width / 2 + 0.045) * w;
                const foot = Math.max(groundAt(profile, s.x), s.base) * h;
                const top = s.base * h;
                const tick = w * 0.016;
                return (
                  <>
                    <line x1={x} y1={top} x2={x} y2={foot} stroke={accent} strokeWidth={weight.detail} />
                    <line x1={x - tick} y1={top} x2={x + tick} y2={top} stroke={accent} strokeWidth={weight.detail} />
                    <line x1={x - tick} y1={foot} x2={x + tick} y2={foot} stroke={accent} strokeWidth={weight.detail} />
                    <text
                      x={x + tick * 1.6}
                      y={(top + foot) / 2}
                      fill={accent}
                      fontFamily={MONO}
                      fontSize={w * 0.026}
                      letterSpacing="0.14em"
                      dominantBaseline="middle"
                    >
                      {String(spec.structure!.height).toUpperCase()}
                    </text>
                  </>
                );
              })()}
            </g>
          ) : null}
        </g>

        {/* THE SHEET. Pinned outside the camera (law 34). */}
        <Ticks colour={muted} w={w} h={h} on={on} />

        {(spec.annotations ?? []).map((note, i) => (
          <Callout
            key={`a${i}`}
            x={note.x * w}
            y={note.y * h}
            text={note.text}
            colour={accent}
            w={w}
            side={note.side ?? 'right'}
            at={from + (note.at ?? 0)}
            set={note.at === undefined}
          />
        ))}

        {spec.scaleNote ? (
          <text
            x={w * 0.5}
            y={h * 0.845}
            fill={muted}
            fontFamily={MONO}
            fontSize={w * 0.021}
            letterSpacing={w * 0.0022}
            textAnchor="middle"
            opacity={on * 0.8}
          >
            {String(spec.scaleNote).toUpperCase()}
          </text>
        ) : null}

        {/* THE VOLUME, once it has gone in. A number that lands when the thing
            it counts has happened, not before it. */}
        {mass?.volume && slid > 0.5 ? (
          <text
            x={w * 0.5}
            y={h * 0.795}
            fill={accent}
            fontFamily={MONO}
            fontSize={w * 0.038}
            letterSpacing={w * 0.004}
            textAnchor="middle"
            opacity={interpolate(slid, [0.5, 0.75], [0, 1], CLAMP)}
          >
            {String(mass.volume).toUpperCase()}
          </text>
        ) : null}
      </svg>

      <Disclosure
        text={spec.disclosure ?? 'SCHEMATIC RECONSTRUCTION · NOT TO SCALE'}
        colour={muted}
        at={from}
        width={w}
      />
    </AbsoluteFill>
  );
};
