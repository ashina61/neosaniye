/**
 * A MAP — schematic geography, drawn from data.
 *
 * The benchmark's clearest hole: an episode about the Strait of Hormuz that
 * never showed a strait. The engine could measure a distance, draw a wheel and
 * set a sentence; it had no way to say "these two coasts, that water between
 * them, this line through it".
 *
 * THE RULE THAT SHAPES EVERYTHING HERE IS HONESTY ABOUT PRECISION.
 *
 * There is no survey data in this repo and there is not going to be. What a
 * documentary graphic needs is almost never a survey: it needs the RELATION —
 * north shore, south shore, one lane in, one lane out, and the fact that there
 * is no way round. A schematic that says "schematic" communicates that
 * faithfully. A traced coastline drawn from memory would communicate the same
 * relation and additionally claim a precision it does not have, which is the
 * same lie as a reconstruction presented as a photograph.
 *
 * So: regions are simple closed forms built from a handful of control points,
 * every map carries `SCHEMATIC — NOT TO SCALE` unless its caller supplies a
 * better plate, and no map here will ever be mistaken for a chart.
 *
 * Everything is a fraction of the frame. The caller says what is where in the
 * story's terms; the geometry is this file's business.
 */
import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {drawOn, flow, posterizeTime} from '../motion';
import {Arrow, Callout, Cam, Disclosure, MONO, Sheet, Ticks, setUp, weights, worldTransform} from './sheet';
import {Depth, Haze, MaterialDefs, MaterialFace, Motes} from './material';

/** A landmass or a body of water: a closed form with a name. */
export type MapRegion = {
  /** Control points, fractions of the frame, clockwise. Three or more. */
  shape: [number, number][];
  label?: string;
  /** `land` is filled and outlined; `water` is outlined and hatched. */
  kind?: 'land' | 'water';
  /** The one the shot is about. Drawn in the accent. */
  focus?: boolean;
};

export type MapMarker = {
  x: number;
  y: number;
  label?: string;
  /** A place, a ship, or the thing that went wrong. */
  kind?: 'place' | 'vessel' | 'hazard';
  at?: number;
};

export type MapSpec = Sheet & {
  type: 'map';
  regions?: MapRegion[];
  /** A path that draws itself, point by point. The journey, or the lane. */
  route?: {points: [number, number][]; label?: string; direction?: 1 | -1; dashed?: boolean}[];
  markers?: MapMarker[];
  /** Two points and a figure: the width of a strait, the length of a road. */
  distance?: {from: [number, number]; to: [number, number]; label: string};
  /** A band to shade — a contested area, a closed lane, a watershed. */
  highlight?: {shape: [number, number][]; label?: string};
  annotations?: {x: number; y: number; text: string; side?: 'left' | 'right'}[];
  /** Fractional scale about the centre of the drawing, for a slow push in. */
  focusScale?: number;
};

const path = (points: [number, number][], w: number, h: number, close = true) =>
  points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x * w} ${y * h}`).join(' ') + (close ? ' Z' : '');

/** Length of a polyline in pixels, so a route can draw at an even speed. */
function lengthOf(points: [number, number][], w: number, h: number) {
  let n = 0;
  for (let i = 1; i < points.length; i += 1) {
    n += Math.hypot((points[i][0] - points[i - 1][0]) * w, (points[i][1] - points[i - 1][1]) * h);
  }
  return Math.max(1, n);
}

/** Where a route has got to at progress p, so a vessel can ride it. */
function along(points: [number, number][], p: number): [number, number] {
  if (points.length < 2) return points[0] ?? [0.5, 0.5];
  const span = (points.length - 1) * Math.min(1, Math.max(0, p));
  const i = Math.min(points.length - 2, Math.floor(span));
  const t = span - i;
  return [
    points[i][0] + (points[i + 1][0] - points[i][0]) * t,
    points[i][1] + (points[i + 1][1] - points[i][1]) * t,
  ];
}

export const MapPlate: React.FC<{spec: MapSpec; w: number; h: number; cam?: Cam}> = ({spec, w, h, cam}) => {
  /** The camera looks AT the world and THROUGH the sheet. */
  const world = worldTransform(cam, w, h);
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const stepped = posterizeTime(frame, fps, 12);
  const from = spec.from ?? 0;
  const over = spec.over ?? 30;
  const accent = spec.accent ?? '#f2b53a';
  const muted = spec.muted ?? '#cfc6ae';
  const line = weights(w);
  if (stepped < from) return null;

  const on = setUp(stepped, from, over);
  /**
   * THE COASTS ARE ALREADY THERE WHEN WE CUT.
   *
   * Law 30. The land does not draw itself on — a coastline arriving stroke by
   * stroke is a title sequence, not a map. What arrives is the ARGUMENT: the
   * route, the markers, the measurement. The geography is the sheet those are
   * drawn on, so it is present at frame zero and the cut lands on a composed
   * picture.
   */
  const push = 1 + (spec.focusScale ?? 0.06) * Math.min(1, Math.max(0, (stepped - from) / Math.max(1, over * 2)));

  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{position: 'absolute', inset: 0}}>
        <Ticks colour={muted} w={w} h={h} on={on} />

        {/* THE WORLD. Everything below here is what the camera is looking at;
            the ticks above and the plates below are the sheet it is drawn on. */}
        <g transform={world}>
        <g transform={`translate(${w / 2} ${h / 2}) scale(${push}) translate(${-w / 2} ${-h / 2})`}>
          <MaterialDefs id="map-water" material="water" colour="#7fb2c4" w={w} seed="sea" />
          <MaterialDefs id="map-stone" material="stone" colour={muted} w={w} seed="coast" />

          {/* WATER FIRST, then land on top of it: the way a chart is printed. */}
          {(spec.regions ?? [])
            .filter((r) => r.kind === 'water')
            .map((region, i) => (
              <g key={`w${i}`}>
                <path d={path(region.shape, w, h)} fill="#0a0f14" stroke={`${muted}55`} strokeWidth={line.construction} />
                <MaterialFace id="map-water" material="water" d={path(region.shape, w, h)} w={w} />
                {/**
                 * THE SEA MOVES.
                 *
                 * Three swell lines drifting at different rates. It is a chart,
                 * so this is two per cent of an effect — but a strait whose
                 * water is perfectly still is a diagram of a strait, and the
                 * whole complaint about the last pass was that everything was.
                 */}
                {[0, 1, 2].map((k) => {
                  const cy = region.shape[0][1] + ((k + 1) / 4) * (region.shape[2][1] - region.shape[0][1]);
                  const off = flow(stepped, fps, 0.05 + k * 0.03) * w * 0.3;
                  return (
                    <path
                      key={k}
                      d={`M ${-w * 0.3 + off} ${cy * h} q ${w * 0.08} ${-h * 0.006} ${w * 0.16} 0 t ${w * 0.16} 0 t ${w * 0.16} 0 t ${w * 0.16} 0 t ${w * 0.16} 0 t ${w * 0.16} 0 t ${w * 0.16} 0 t ${w * 0.16} 0`}
                      fill="none"
                      stroke="#7fb2c4"
                      strokeWidth={line.construction}
                      opacity={0.16}
                    />
                  );
                })}
              </g>
            ))}

          {(spec.regions ?? [])
            .filter((r) => r.kind !== 'water')
            .map((region, i) => {
              const colour = region.focus ? accent : muted;
              return (
                <g key={`l${i}`}>
                  <path
                    d={path(region.shape, w, h)}
                    fill={region.focus ? `${accent}26` : `${muted}22`}
                    stroke={colour}
                    strokeWidth={region.focus ? line.object : line.detail}
                    strokeLinejoin="round"
                  />
                  <MaterialFace id="map-stone" material="stone" d={path(region.shape, w, h)} w={w} />
                </g>
              );
            })}

          {/* THE CONTESTED OR CLOSED AREA, hatched rather than filled: a solid
              wash reads as another landmass. */}
          {spec.highlight ? (
            <g opacity={drawOn(stepped, [from + over * 0.4, from + over]) * 0.8}>
              <defs>
                <pattern id="mapHatch" width={w * 0.02} height={w * 0.02} patternUnits="userSpaceOnUse" patternTransform="rotate(38)">
                  <line x1="0" y1="0" x2="0" y2={w * 0.02} stroke={accent} strokeWidth={line.construction} />
                </pattern>
              </defs>
              <path d={path(spec.highlight.shape, w, h)} fill="url(#mapHatch)" stroke={accent} strokeWidth={line.construction} />
            </g>
          ) : null}

          {/* THE ROUTE DRAWS ITSELF. This is the map's verb. */}
          {(spec.route ?? []).map((route, i) => {
            const at = from + 4 + i * 8;
            const len = lengthOf(route.points, w, h);
            const p = drawOn(stepped, [at, at + over * 0.8]);
            const [hx, hy] = along(route.points, p);
            return (
              <g key={`r${i}`}>
                <path
                  d={path(route.points, w, h, false)}
                  fill="none"
                  stroke={accent}
                  strokeWidth={line.object}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray={route.dashed ? `${w * 0.016} ${w * 0.012}` : `${len}`}
                  strokeDashoffset={route.dashed ? 0 : len * (1 - p)}
                  opacity={route.dashed ? p : 1}
                />
                {/* A HULL AT THE HEAD OF THE LINE. A route with something
                    travelling it is a passage; without, it is a line. */}
                {p > 0.02 && p < 0.999 ? (
                  <g transform={`translate(${hx * w} ${hy * h})`}>
                    <path
                      d={`M ${-w * 0.014} ${-w * 0.006} L ${w * 0.016} 0 L ${-w * 0.014} ${w * 0.006} Z`}
                      fill={accent}
                      transform={`rotate(${(Math.atan2(
                        (along(route.points, Math.min(1, p + 0.02))[1] - hy) * h,
                        (along(route.points, Math.min(1, p + 0.02))[0] - hx) * w,
                      ) *
                        180) /
                        Math.PI})`}
                    />
                  </g>
                ) : null}
              </g>
            );
          })}

          {/* THE MEASUREMENT ACROSS THE GAP — the one thing a strait story is
              usually about, and the one a photograph can never carry. */}
          {spec.distance ? (
            <g opacity={drawOn(stepped, [from + over * 0.25, from + over * 0.7])}>
              {(() => {
                const [ax, ay] = spec.distance.from;
                const [bx, by] = spec.distance.to;
                const x1 = ax * w;
                const y1 = ay * h;
                const x2 = bx * w;
                const y2 = by * h;
                const nx = -(y2 - y1);
                const ny = x2 - x1;
                const nl = Math.max(1, Math.hypot(nx, ny));
                const tick = w * 0.018;
                return (
                  <>
                    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={accent} strokeWidth={line.detail} />
                    {[[x1, y1], [x2, y2]].map(([x, y], i) => (
                      <line
                        key={i}
                        x1={x - (nx / nl) * tick}
                        y1={y - (ny / nl) * tick}
                        x2={x + (nx / nl) * tick}
                        y2={y + (ny / nl) * tick}
                        stroke={accent}
                        strokeWidth={line.detail}
                      />
                    ))}
                    <text
                      x={(x1 + x2) / 2}
                      y={(y1 + y2) / 2 - w * 0.018}
                      textAnchor="middle"
                      fill={accent}
                      fontFamily={MONO}
                      fontSize={w * 0.028}
                      letterSpacing="0.16em"
                    >
                      {spec.distance.label.toUpperCase()}
                    </text>
                  </>
                );
              })()}
            </g>
          ) : null}

          {(spec.markers ?? []).map((marker, i) => {
            /**
             * A PLACE NAME IS GEOGRAPHY, NOT ARGUMENT.
             *
             * These used to arrive from ten frames in, six apart, so the frame
             * the cut landed on was an unlabelled grey polygon and the shot only
             * became a map a third of the way through it — the "featureless map"
             * complaint, and law 30 exactly. Where the places ARE is the sheet
             * the route is drawn on. They settle in place; the route is what
             * arrives.
             */
            const at = marker.at ?? from + i * 2;
            const shown = drawOn(stepped, [at, at + 8]);
            if (shown <= 0) return null;
            const x = marker.x * w;
            const y = marker.y * h;
            const colour = marker.kind === 'hazard' ? accent : muted;
            return (
              <g key={`m${i}`} opacity={shown}>
                {marker.kind === 'hazard' ? (
                  <g>
                    <circle cx={x} cy={y} r={w * 0.026} fill="none" stroke={accent} strokeWidth={line.detail} />
                    <line x1={x - w * 0.014} y1={y - w * 0.014} x2={x + w * 0.014} y2={y + w * 0.014} stroke={accent} strokeWidth={line.detail} />
                    <line x1={x + w * 0.014} y1={y - w * 0.014} x2={x - w * 0.014} y2={y + w * 0.014} stroke={accent} strokeWidth={line.detail} />
                  </g>
                ) : (
                  <circle cx={x} cy={y} r={w * 0.008} fill={colour} />
                )}
                {marker.label ? (
                  /**
                   * THE LABEL TURNS ROUND RATHER THAN LEAVING THE FRAME.
                   *
                   * Markers are spread from a tenth to nine tenths of the width
                   * and the text always ran to the right of its dot, so the last
                   * place on any route was printed off the edge of the picture.
                   * Past the midpoint it hangs to the left instead — which is
                   * what anybody labelling a chart by hand would do.
                   */
                  <text
                    x={x + (marker.x > 0.62 ? -w * 0.018 : w * 0.018)}
                    y={y + w * 0.01}
                    textAnchor={marker.x > 0.62 ? 'end' : 'start'}
                    fill={colour}
                    fontFamily={MONO}
                    fontSize={w * 0.021}
                    letterSpacing="0.14em"
                  >
                    {marker.label.toUpperCase()}
                  </text>
                ) : null}
              </g>
            );
          })}

          {(spec.regions ?? [])
            .filter((r) => r.label)
            .map((region, i) => {
              const cx = region.shape.reduce((n, p) => n + p[0], 0) / region.shape.length;
              const cy = region.shape.reduce((n, p) => n + p[1], 0) / region.shape.length;
              return (
                <text
                  key={`n${i}`}
                  x={cx * w}
                  y={cy * h}
                  textAnchor="middle"
                  fill={region.focus ? accent : muted}
                  fontFamily={MONO}
                  fontSize={w * 0.024}
                  letterSpacing="0.22em"
                  opacity={0.85}
                >
                  {String(region.label).toUpperCase()}
                </text>
              );
            })}

          {(spec.annotations ?? []).map((note, i) => (
            <Callout
              key={`a${i}`}
              x={note.x * w}
              y={note.y * h}
              text={note.text}
              colour={muted}
              w={w}
              side={note.side ?? 'right'}
              at={from + over * 0.6 + i * 6}
            />
          ))}
        </g>
        </g>
      </svg>
      <Disclosure text={spec.disclosure ?? 'schematic · not to scale'} colour={muted} at={from + 10} width={w} />
    </AbsoluteFill>
  );
};

export {Arrow};
