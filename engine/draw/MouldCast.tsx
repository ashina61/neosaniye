/**
 * MOULD AND CAST — a form lost inside a medium, and recovered as its negative.
 *
 * The claim class, stated once so nothing here has to know a subject:
 *
 *     a form is engulfed by a moving medium; the form is lost; a void remains
 *     in its shape; the void is filled; the form returns in a new material.
 *
 * That is a mould and a casting. It is also plaster poured into a cavity left
 * in volcanic ash, and a fossil precipitated into the space a shell dissolved
 * out of. The mechanism is the same and the drawing is the same, which is the
 * only reason this belongs in a shared vocabulary at all.
 *
 * THREE RULES SHAPE THIS FILE.
 *
 * 1. ONE SILHOUETTE THROUGHOUT. The whole point is that the cavity is the SAME
 *    SHAPE as the thing that is gone, and that what comes out is the fill. Five
 *    separate pictures cannot say that; one outline carried through five states
 *    says it without a caption. So the form is computed once and every stage
 *    draws that same path in a different state.
 *
 * 2. THE MEDIUM ARRIVES FROM SOMEWHERE. A level that simply rises is weather.
 *    A front that sweeps in from one side and then banks up over the form is a
 *    current, and the difference is the entire content of the stage.
 *
 * 3. IT IS A RECONSTRUCTION AND IT SAYS SO. Nothing here was photographed:
 *    every frame is an argument about a mechanism. The disclosure plate is not
 *    optional and it is pinned, so a camera move cannot carry it off the frame.
 */
import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {drawOn, flow, hash01, posterizeTime, settle} from '../motion';
import {Contact, GroundPlane, MaterialDefs, MaterialFace, Motes} from './material';
import {Cam, Callout, Disclosure, MONO, Sheet, Ticks, weights, worldTransform} from './sheet';

const CLAMP = {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'} as const;

/** The five states. A shot plays a contiguous run of them. */
export type MouldStage = 'form' | 'engulf' | 'void' | 'fill' | 'cast';

export type MouldCastSpec = Sheet & {
  type: 'mouldCast';
  /** The thing that is lost. Height as a fraction of the frame. */
  form: {label?: string; height?: number};
  /** What buries it. */
  medium: {label?: string; material?: 'stone' | 'concrete' | 'wood' | 'paper'};
  /** What is poured into the space it leaves. */
  filler?: {label?: string};
  /** Which states this shot plays, in order. */
  stages: MouldStage[];
  /** What each state is called on screen, and why it happens. */
  captions?: Partial<Record<MouldStage, {state: string; cause: string}>>;
};

const SAYS: Record<MouldStage, {state: string; cause: string}> = {
  form: {state: 'BEFORE', cause: 'the form stands in the open'},
  engulf: {state: 'ENGULFED', cause: 'the medium arrives and banks up'},
  void: {state: 'VOID', cause: 'the form decays and leaves its shape'},
  fill: {state: 'FILLED', cause: 'the space is poured full'},
  cast: {state: 'CAST', cause: 'the fill is the form, in new material'},
};

/**
 * THE SILHOUETTE, ONCE.
 *
 * A standing figure reduced to a closed outline — not a stick figure, because a
 * stick figure has no interior and this drawing is entirely about an interior
 * being empty and then full. Deliberately plain: a detailed person invites you
 * to look at the person, and the subject here is the space they occupied.
 */
function formPath(cx: number, ground: number, height: number): string {
  const H = height;
  const headR = H * 0.115;
  const headY = ground - H + headR;
  const shoulder = ground - H * 0.775;
  const hip = ground - H * 0.44;
  const halfShoulder = H * 0.165;
  const halfHip = H * 0.125;
  const halfFoot = H * 0.135;
  return [
    `M ${cx - halfShoulder * 0.34} ${headY + headR * 0.86}`,
    `C ${cx - halfShoulder} ${shoulder - H * 0.02} ${cx - halfShoulder} ${shoulder} ${cx - halfShoulder} ${shoulder + H * 0.02}`,
    `L ${cx - halfHip} ${hip}`,
    `L ${cx - halfFoot} ${ground}`,
    `L ${cx - halfFoot * 0.24} ${ground}`,
    `L ${cx - H * 0.02} ${hip + H * 0.02}`,
    `L ${cx + H * 0.02} ${hip + H * 0.02}`,
    `L ${cx + halfFoot * 0.24} ${ground}`,
    `L ${cx + halfFoot} ${ground}`,
    `L ${cx + halfHip} ${hip}`,
    `L ${cx + halfShoulder} ${shoulder + H * 0.02}`,
    `C ${cx + halfShoulder} ${shoulder} ${cx + halfShoulder} ${shoulder - H * 0.02} ${cx + halfShoulder * 0.34} ${headY + headR * 0.86}`,
    `A ${headR} ${headR} 0 1 0 ${cx - halfShoulder * 0.34} ${headY + headR * 0.86}`,
    'Z',
  ].join(' ');
}

export const MouldCastPlate: React.FC<{spec: MouldCastSpec; w: number; h: number; cam?: Cam}> = ({
  spec,
  w,
  h,
  cam,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const stepped = posterizeTime(frame, fps, 12);
  const from = spec.from ?? 0;
  const over = spec.over ?? 40;
  if (stepped < from) return null;

  const accent = spec.accent ?? '#e8e2d4';
  const muted = spec.muted ?? '#cfc6ae';
  const line = weights(w);

  const stages = spec.stages?.length ? spec.stages : (['form', 'engulf', 'void'] as MouldStage[]);
  const t = Math.max(0, stepped - from);
  /**
   * WHERE WE ARE IN THE RUN. `each` is one state's worth of time; `k` is the
   * index of the state we are leaving and `mix` how far we have left it. A
   * single-state shot holds, which is what a payoff wants.
   */
  const each = over / Math.max(1, stages.length - 1);
  const raw = stages.length === 1 ? 0 : Math.min(stages.length - 1, t / Math.max(1, each));
  const k = Math.min(stages.length - 1, Math.floor(raw));
  const next = Math.min(stages.length - 1, k + 1);
  const mix = settle(Math.min(1, raw - k));
  const at = (s: MouldStage) => {
    // How far this shot has got INTO a given state, 0..1.
    const idx = stages.indexOf(s);
    if (idx < 0) return stages.indexOf('cast') >= 0 && s !== 'cast' ? 1 : 0;
    if (k > idx) return 1;
    if (k < idx) return 0;
    return mix;
  };
  // A state already passed counts as complete even if this shot never plays it:
  // a shot that opens on VOID must draw the medium the previous shot banked up.
  const reached = (s: MouldStage) => {
    const order: MouldStage[] = ['form', 'engulf', 'void', 'fill', 'cast'];
    const first = order.indexOf(stages[0]);
    const mine = order.indexOf(s);
    if (mine < first) return 1;
    return at(s);
  };

  const cx = w * 0.5;
  const ground = h * 0.66;
  const formH = (spec.form?.height ?? 0.2) * h;
  const path = formPath(cx, ground, formH);

  // THE MEDIUM. A front sweeps in from the right, then the level banks up.
  const sweep = reached('engulf');
  const frontX = interpolate(sweep, [0, 0.55], [w * 1.12, cx - formH * 0.42], CLAMP);
  const level = interpolate(sweep, [0.45, 1], [0, formH * 1.16], CLAMP);
  const deckY = ground - level;
  const buried = reached('void');
  const filled = reached('fill');
  const cast = reached('cast');
  const on = drawOn(stepped, [from, from + over * 0.35]);

  const world = worldTransform(cam, w, h);
  const grain = spec.medium?.material ?? 'concrete';

  return (
    <AbsoluteFill>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{position: 'absolute', inset: 0}}>
        <MaterialDefs id="mc-medium" material={grain} colour={muted} w={w} />
        <MaterialDefs id="mc-fill" material="paper" colour={accent} w={w} />
        <defs>
          {/* The deposit clips everything drawn inside it, so the form and the
              cavity are genuinely INSIDE the medium rather than over it. */}
          <clipPath id="mc-deck">
            <rect x={0} y={deckY} width={w} height={Math.max(0, ground - deckY) + h * 0.02} />
          </clipPath>
        </defs>

        <g transform={world}>
          <GroundPlane y={ground} w={w} h={h} colour={muted} />

          {/* THE FORM, while it is still there. Fades as it decays — the one
              thing in the drawing that is allowed to disappear. */}
          {cast < 0.02 ? (
            <g opacity={1 - buried}>
              <Contact x={cx} y={ground + h * 0.003} width={formH * 0.5} strength={0.7} />
              <path d={path} fill="#0d0b09" opacity={0.45} />
              <MaterialFace id="mc-fill" material="paper" d={path} w={w} />
              <path d={path} fill="none" stroke={accent} strokeWidth={line.object} opacity={on} />
            </g>
          ) : null}

          {/* THE DEPOSIT. Everything below the deck line. */}
          {level > 0.5 ? (
            <g>
              <rect x={0} y={deckY} width={w} height={Math.max(0, ground - deckY)} fill="#0d0b09" opacity={0.55} />
              <MaterialFace
                id="mc-medium"
                material={grain}
                rect={{x: 0, y: deckY, w, h: Math.max(0, ground - deckY)}}
                w={w}
              />
              <line x1={0} y1={deckY} x2={w} y2={deckY} stroke={muted} strokeWidth={line.detail} opacity={0.8} />
            </g>
          ) : null}

          {/* THE CAVITY. Drawn only once the form has gone, and drawn as a
              DASHED negative — the convention for a space rather than a thing.
              Clipped to the deposit so it reads as a hole in it. */}
          {buried > 0.02 && cast < 0.98 ? (
            <g clipPath="url(#mc-deck)" opacity={buried}>
              <path d={path} fill="#07060a" opacity={0.85} />
              <path
                d={path}
                fill="none"
                stroke={accent}
                strokeWidth={line.detail}
                strokeDasharray={`${w * 0.012} ${w * 0.009}`}
                opacity={0.95}
              />
            </g>
          ) : null}

          {/* THE FILL, rising inside the cavity. It fills from the FLOOR UP,
              because that is what a poured fill does, and the rising line is
              the only thing that makes it read as pouring rather than fading. */}
          {filled > 0.02 ? (
            <g clipPath="url(#mc-deck)">
              <defs>
                <clipPath id="mc-rise">
                  <rect
                    x={0}
                    y={interpolate(filled, [0, 1], [ground, ground - formH * 1.02], CLAMP)}
                    width={w}
                    height={formH * 1.2}
                  />
                </clipPath>
              </defs>
              <g clipPath="url(#mc-rise)">
                <path d={path} fill="#0d0b09" opacity={0.5} />
                <MaterialFace id="mc-fill" material="paper" d={path} w={w} />
                <path d={path} fill="none" stroke={accent} strokeWidth={line.object} />
              </g>
            </g>
          ) : null}

          {/* THE POUR. A stream from off the top into the cavity, only while
              filling — cause before effect, and it stops when the space is
              full. */}
          {filled > 0.02 && filled < 0.985 ? (
            <g opacity={Math.min(1, filled * 6)}>
              <line
                x1={cx}
                y1={h * 0.1}
                x2={cx}
                y2={deckY}
                stroke={accent}
                strokeWidth={line.object}
                opacity={0.75}
              />
              {Array.from({length: 5}, (_, i) => {
                const p = (flow(stepped + i * 7, fps, 1.1) + 1) % 1;
                return (
                  <circle
                    key={i}
                    cx={cx + (hash01('pour', i) - 0.5) * w * 0.012}
                    cy={h * 0.1 + p * (deckY - h * 0.1)}
                    r={w * 0.005}
                    fill={accent}
                    opacity={0.7}
                  />
                );
              })}
            </g>
          ) : null}

          {/* THE FRONT. Only while it is arriving: a moving edge with the
              medium behind it, which is what separates a current from a fall. */}
          {sweep > 0.02 && sweep < 0.6 ? (
            <g opacity={interpolate(sweep, [0, 0.1, 0.5, 0.6], [0, 1, 1, 0], CLAMP)}>
              <path
                d={`M ${w} ${ground} L ${w} ${ground - formH * 1.5} Q ${frontX + formH * 0.5} ${ground - formH * 1.6} ${frontX} ${ground - formH * 0.5} Q ${frontX - formH * 0.24} ${ground - formH * 0.12} ${frontX + formH * 0.3} ${ground} Z`}
                fill={muted}
                opacity={0.24}
              />
              <path
                d={`M ${w} ${ground - formH * 1.5} Q ${frontX + formH * 0.5} ${ground - formH * 1.6} ${frontX} ${ground - formH * 0.5} Q ${frontX - formH * 0.24} ${ground - formH * 0.12} ${frontX + formH * 0.3} ${ground}`}
                fill="none"
                stroke={accent}
                strokeWidth={line.detail}
                opacity={0.8}
              />
              <Motes w={w} h={h} colour={accent} count={16} seed="front" band={[0.42, 0.68]} />
            </g>
          ) : null}

          {/* THE CAST, once it is out: the deposit cut away on the left so the
              recovered form stands clear of it. A section, not a reveal. */}
          {cast > 0.02 ? (
            <g opacity={cast}>
              <rect
                x={0}
                y={deckY - h * 0.005}
                width={cx - formH * 0.34}
                height={Math.max(0, ground - deckY) + h * 0.01}
                fill="#07060a"
                opacity={0.92}
              />
              <line
                x1={cx - formH * 0.34}
                y1={deckY - h * 0.005}
                x2={cx - formH * 0.34}
                y2={ground}
                stroke={muted}
                strokeWidth={line.construction}
                strokeDasharray={`${w * 0.006} ${w * 0.006}`}
                opacity={0.7}
              />
              <path d={path} fill="#0d0b09" opacity={0.5} />
              <MaterialFace id="mc-fill" material="paper" d={path} w={w} />
              <path d={path} fill="none" stroke={accent} strokeWidth={line.emphasis} />
            </g>
          ) : null}
        </g>

        {/* THE SHEET. Pinned: a camera move must not carry the honesty plate or
            the state label off the frame (law 34). */}
        <Ticks colour={muted} w={w} h={h} on={on} />

        {/* THE STATE, and WHY IT HAPPENED. The cause is the argument — a label
            reading VOID explains nothing; "the form decays and leaves its
            shape" is the sentence the drawing is making. */}
        <g opacity={on}>
          <text
            x={w * 0.5}
            y={h * 0.775}
            fill={accent}
            fontFamily={MONO}
            fontSize={w * 0.042}
            letterSpacing={w * 0.004}
            textAnchor="middle"
          >
            {(spec.captions?.[stages[k]] ?? SAYS[stages[k]]).state}
          </text>
          <text
            x={w * 0.5}
            y={h * 0.802}
            fill={muted}
            fontFamily={MONO}
            fontSize={w * 0.021}
            letterSpacing={w * 0.0022}
            textAnchor="middle"
            opacity={0.85}
          >
            {(spec.captions?.[stages[k]] ?? SAYS[stages[k]]).cause.toUpperCase()}
          </text>
        </g>

        {/* THE RUN, as a strip: which state we are in, out of how many. The
            viewer can see that this is one sequence and where in it they are. */}
        <g opacity={on * 0.9}>
          {stages.map((s, i) => (
            <rect
              key={s + i}
              x={w * 0.5 - (stages.length * w * 0.05) / 2 + i * w * 0.05 + w * 0.006}
              y={h * 0.822}
              width={w * 0.038}
              height={h * 0.0035}
              fill={i <= k ? accent : muted}
              opacity={i <= k ? 0.95 : 0.32}
            />
          ))}
        </g>
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
