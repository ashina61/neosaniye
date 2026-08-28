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
import {Haze, MaterialDefs, MaterialFace, Motes, Sky} from './material';
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
    plane?: [number, number][];
    /** How far it travels, as a fraction of the frame. A slab is displaced. */
    to?: [number, number];
    /**
     * WHAT IT ENDS AS. A FLOW DOES NOT MOVE, IT SPREADS.
     *
     * A slab keeps its shape and changes place, so a translation is the truth
     * about it. A pyroclastic flow, a lahar, a lava front, a flood — none of
     * those arrive as a block that slid; they advance, thin out and lie down
     * over what they cover. Translating one is a diagram of the wrong physics.
     * So a front declares the footprint it BECOMES, point for point, and the
     * drawing interpolates between the two: the leading edge runs downslope and
     * the body flattens out behind it.
     */
    becomes?: [number, number][];
    kind?: 'slab' | 'front';
    at: number;
    over: number;
    label?: string;
    volume?: string;
  };
  /** Fluid soaking into a bed: the CAUSE, and it arrives first. */
  seepage?: {at: number; over?: number; label?: string};
  /** The water leaving over the structure: the CONSEQUENCE, and it arrives last. */
  overtop?: {at: number; over?: number; label?: string};
  /**
   * WHERE TO STAND TO SEE WHAT THIS SENTENCE IS ABOUT.
   *
   * A section drawn once and shown fourteen times from the same distance is a
   * slideshow of one picture however much moves inside it. But the answer is
   * not variety for its own sake: a sentence about the slab wants to be near
   * the slab, one about the crest wants to be at the dam, and one about the
   * valley wants the valley. The BUILDER knows which, because it put those
   * things where they are — so the framing is declared with the drawing rather
   * than guessed by the planner, and it moves only when the subject moves.
   */
  focus?: {x: number; y: number; scale: number};
  /** Where the words fit around THIS landform. Read by the planner, not here. */
  captionZone?: {y: number; align: 'left' | 'right' | 'center'};
  /**
   * NAMED PLACES ON THE PROFILE — the town below the dam, the village on the
   * shoulder. A section can say WHERE as well as what: the whole point of the
   * last beat of a dam story is that the water arrived somewhere with a name in
   * it, and a plan-view map cannot draw water arriving.
   */
  places?: {x: number; label: string; below?: boolean}[];
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
  const front = mass?.kind === 'front' && mass.becomes?.length === mass.shape.length;
  const dx = mass && !front ? (mass.to?.[0] ?? 0) * slid : 0;
  const dy = mass && !front ? (mass.to?.[1] ?? 0) * slid : 0;
  const massNow: [number, number][] | null = !mass
    ? null
    : front
      ? (mass.shape.map(([x, y], i) => {
          const [bx, by] = mass.becomes![i];
          return [x + (bx - x) * slid, y + (by - y) * slid];
        }) as [number, number][])
      : (mass.shape.map(([x, y]) => [x + dx, y + dy]) as [number, number][]);

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

  /**
   * The shot camera moves the world; the focus decides where the world is seen
   * FROM. They compose: the drawing is framed on its subject and the shot's own
   * push and pan still play over that framing.
   */
  const world = worldTransform(cam, w, h);
  const f = spec.focus;
  const framed = f
    ? `translate(${(w * 0.5).toFixed(2)} ${(h * 0.5).toFixed(2)}) scale(${f.scale.toFixed(3)}) translate(${(-w * f.x).toFixed(2)} ${(-h * f.y).toFixed(2)})`
    : undefined;
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

        <g transform={framed}>
        <g transform={world}>
          {/**
            * THE AIR ABOVE THE HORIZON.
            *
            * `Sky` is in the component index for precisely this — "so a drawn
            * band is not floating in black" — and this plate had never reached
            * for it. A flank sits low in the frame to leave the upper third to
            * the type, which meant the upper third was DEAD BLACK: the reel
            * opened on a thin diagonal in a void. A landform has air over it,
            * and drawing that air is the difference between a section of a
            * mountainside and a line on a page.
            */}
          <Sky y={Math.min(...profile.map(([, y]) => y)) * h} w={w} colour={muted} id="ts-sky" strength={1.1} />
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
          {mass?.plane ? (
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
              {/**
                * THE SLAB HAS TO BE VISIBLE BEFORE IT MOVES.
                *
                * Drawn in the ground's own material, flush against the ground,
                * it was invisible until it separated — so the two shots that
                * exist to say "this piece is going to go" showed a hillside and
                * a label. A section distinguishes a body from its surroundings
                * by TONE and by hatch, not by waiting for it to move, and the
                * whole argument of those shots is that the thing was already
                * there, already defined, already resting on its plane.
                */}
              <defs>
                <pattern id="ts-slab" width={w * 0.026} height={w * 0.026} patternUnits="userSpaceOnUse" patternTransform="rotate(52)">
                  <line x1="0" y1="0" x2="0" y2={w * 0.026} stroke={accent} strokeWidth={weight.construction} opacity={0.5} />
                </pattern>
              </defs>
              {/* A SLAB IS ROCK AND A FRONT IS NOT. Hatch says "cut through
                  solid material"; a cloud of ash and gas is neither solid nor
                  cut, so it is drawn as a mass with a soft body and a hard
                  LEADING EDGE, which is the only part of a flow you can see
                  the position of. */}
              {/**
                * ASH IS THE PALEST THING IN THE FRAME (law 35: a material is a
                * value before it is a surface).
                *
                * Given the tone of wet earth, the deposit was darker than the
                * rock it lay on — so a slope with a flow across it read as one
                * dark shape on a dark ground, and the burial, which is the
                * whole first act, was invisible. Ash is near-white; that value
                * is what makes a covered landscape legible at all, and it is
                * also simply what the stuff looks like.
                */}
              <path d={poly(massNow, w, h)} fill={front ? '#9a9184' : '#1b1712'} opacity={front ? 0.97 : 1} />
              <MaterialFace id="ts-rock" material={front ? 'paper' : 'stone'} d={poly(massNow, w, h)} w={w} />
              {front ? null : <path d={poly(massNow, w, h)} fill="url(#ts-slab)" />}
              {/**
                * A DEPOSIT HAS A SURFACE, NOT AN OUTLINE.
                *
                * Stroking the closed polygon drew its left end as a bright
                * vertical line standing on the slope — which reads as a wall,
                * and there is no wall. What you can see of a flow is its top
                * surface and its leading edge; the underside is buried in the
                * ground it is lying on. So a front strokes the upper half of
                * its own outline and nothing else.
                */}
              <path
                d={front ? line(massNow.slice(0, Math.ceil(massNow.length / 2)), w, h) : poly(massNow, w, h)}
                fill="none"
                stroke={accent}
                strokeWidth={front ? weight.object : weight.emphasis}
                opacity={front ? 0.85 : 0.95}
                strokeLinecap="round"
              />
              {front && slid > 0.02 && slid < 0.99 ? (
                <circle
                  cx={massNow[1][0] * w}
                  cy={massNow[1][1] * h}
                  r={w * 0.009}
                  fill={accent}
                  opacity={0.9}
                />
              ) : null}
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
                    {/**
                      * THE WATER GOING OVER IS THE SHOT.
                      *
                      * The first version tinted a thin wedge at 45% and the
                      * payoff frame — the one the whole film is built toward —
                      * read as a lake that was merely high. What a dam does when
                      * it is overtopped is that a SHEET of water leaves the crest
                      * and falls the height of the wall, so that is what is
                      * drawn: it clears the crest, curves over, and lands.
                      */}
                    {spill > 0.02 ? (
                      <g opacity={Math.min(1, spill * 1.6)}>
                        {(() => {
                          const drop = 0.30 * spill;
                          const lip = s.x - s.width / 2;
                          const toe = s.x + s.width / 2;
                          const foot = Math.max(groundAt(profile, s.x), s.base);
                          return (
                            <>
                              <path
                                d={`M ${lip * w} ${(s.base - 0.008) * h}
                                    C ${(toe + s.width * 0.5) * w} ${(s.base - 0.004) * h},
                                      ${(toe + s.width * 1.1) * w} ${(s.base + drop * 0.55) * h},
                                      ${(toe + s.width * 0.9) * w} ${Math.min(foot, s.base + drop) * h}
                                    L ${(toe - s.width * 0.1) * w} ${Math.min(foot, s.base + drop) * h}
                                    C ${(toe - s.width * 0.2) * w} ${(s.base + drop * 0.5) * h},
                                      ${toe * w} ${(s.base + drop * 0.2) * h},
                                      ${toe * w} ${(s.base - 0.008) * h} Z`}
                                fill="#8fc0d2"
                                opacity={0.72}
                              />
                              {/* The lip itself: a bright line where the sheet
                                  leaves the concrete. */}
                              <path
                                d={`M ${lip * w} ${(s.base - 0.008) * h} L ${toe * w} ${(s.base - 0.008) * h}`}
                                stroke="#dcefF5"
                                strokeWidth={weight.emphasis}
                                fill="none"
                                opacity={0.9}
                              />
                              <Motes w={w} h={h} colour="#cfe4ec" count={16} seed="spill" band={[0.42, 0.72]} />
                            </>
                          );
                        })()}
                      </g>
                    ) : null}
                  </>
                );
              })()}
            </g>
          ) : null}

          {/* NAMED PLACES, sitting on the ground they are built on. */}
          {(spec.places ?? []).map((place, i) => {
            const y = groundAt(profile, place.x);
            const px = place.x * w;
            const py = y * h;
            const right = place.x < 0.6;
            return (
              <g key={`p${i}`} opacity={on}>
                <circle cx={px} cy={py} r={w * 0.007} fill={accent} />
                <line x1={px} y1={py} x2={px} y2={py - h * 0.028} stroke={accent} strokeWidth={weight.detail} />
                <text
                  x={right ? px + w * 0.012 : px - w * 0.012}
                  y={py - h * 0.034}
                  fill={accent}
                  fontFamily={MONO}
                  fontSize={w * 0.024}
                  letterSpacing="0.14em"
                  textAnchor={right ? 'start' : 'end'}
                >
                  {String(place.label).toUpperCase()}
                </text>
              </g>
            );
          })}

          {/* THE STRUCTURE'S HEIGHT, as a dimension rather than a claim in a
              caption: a number beside the thing it measures. */}
          {spec.structure?.height ? (
            <g opacity={on * 0.9}>
              {(() => {
                const s = spec.structure!;
                /**
                 * CLEAR OF THE WATER AND CLEAR OF THE WALL.
                 *
                 * At four and a half hundredths the label sat on the reservoir
                 * surface, so a dimension of the dam read as a caption floating
                 * on the lake. A dimension belongs OUTSIDE the thing it
                 * measures, on the dry side, with its own extension lines — the
                 * way it is drawn on a real elevation.
                 */
                const x = Math.min(0.93, s.x + s.width / 2 + 0.085) * w;
                const foot = Math.max(groundAt(profile, s.x), s.base) * h;
                const top = s.base * h;
                const tick = w * 0.016;
                return (
                  <>
                    {/* Extension lines from the structure out to the dimension. */}
                    <line x1={(s.x + s.width / 2) * w} y1={top} x2={x} y2={top} stroke={muted} strokeWidth={weight.construction} opacity={0.5} />
                    <line x1={(s.x + s.width / 2) * w} y1={foot} x2={x} y2={foot} stroke={muted} strokeWidth={weight.construction} opacity={0.5} />
                    <line x1={x} y1={top} x2={x} y2={foot} stroke={accent} strokeWidth={weight.detail} />
                    <line x1={x - tick} y1={top} x2={x + tick} y2={top} stroke={accent} strokeWidth={weight.detail} />
                    <line x1={x - tick} y1={foot} x2={x + tick} y2={foot} stroke={accent} strokeWidth={weight.detail} />
                    <text
                      x={x + tick * 1.4}
                      y={(top + foot) / 2}
                      fill={accent}
                      fontFamily={MONO}
                      fontSize={w * 0.026}
                      letterSpacing="0.12em"
                      dominantBaseline="middle"
                      textAnchor="middle"
                      transform={`rotate(-90 ${x + tick * 1.4} ${(top + foot) / 2})`}
                    >
                      {String(spec.structure!.height).toUpperCase()}
                    </text>
                  </>
                );
              })()}
            </g>
          ) : null}
        </g>
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
