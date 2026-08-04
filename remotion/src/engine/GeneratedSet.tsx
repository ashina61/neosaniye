import React from 'react';
import {AbsoluteFill} from 'remotion';
import {useLook} from './look';
import {hash01} from './motion';

/**
 * THE ROOM RENDERER.
 *
 * Draws whatever `src/story/setPlan.js` generated. Nothing here decides what a
 * scene looks like — it receives a plan (a horizon, a structure and its count,
 * a rhythm, an aperture, a ground, one light, some haze) and builds it.
 *
 * That split is the whole point: adding a new kind of room is adding a case to
 * a switch, but getting a room that has never been rendered before costs
 * nothing at all, because the plan is continuous.
 */

export type SetPlan = {
  horizon: number;
  structure: 'blocks' | 'columns' | 'shelves' | 'arches' | 'trunks' | 'panels' | 'girders' | 'peaks' | 'none';
  count: number;
  rhythm: 'even' | 'scatter' | 'perspective';
  scale: number;
  aperture: 'none' | 'window' | 'arch' | 'disc' | 'sky' | 'surface';
  /** `limb` is the curve of a planet seen from orbit — a horizon with no floor. */
  ground: 'plane' | 'planks' | 'tiles' | 'rubble' | 'water' | 'limb';
  light: {x: number; y: number; size: number; tone: 'accent' | 'cool' | 'paperLight'; strength: number};
  haze: number;
  seed: number;
};

const alpha = (hex: string, a: number) =>
  `${hex}${Math.round(Math.max(0, Math.min(1, a)) * 255).toString(16).padStart(2, '0')}`;

const Structure: React.FC<{plan: SetPlan; seedKey: string}> = ({plan, seedKey}) => {
  const {palette} = useLook();
  if (plan.structure === 'none' || plan.count < 1) return null;

  const items = Array.from({length: plan.count}, (_, i) => i);
  const top = `${plan.horizon * 100 - plan.scale * 100}%`;

  // Rhythm decides whether the row reads as built, grown or ruined.
  const position = (i: number) => {
    const step = 100 / plan.count;
    if (plan.rhythm === 'even') return {left: `${i * step}%`, width: `${step * 0.82}%`};
    if (plan.rhythm === 'scatter') {
      return {left: `${(i * step + hash01(seedKey, i * 7) * step * 0.7) % 100}%`, width: `${step * (0.5 + hash01(seedKey, i * 3) * 0.7)}%`};
    }
    // perspective: bigger and further apart toward one side
    const bias = i / plan.count;
    return {left: `${bias * 100 * 0.94}%`, width: `${step * (0.6 + bias * 0.9)}%`};
  };

  return (
    <div style={{position: 'absolute', left: 0, right: 0, top, height: `${plan.scale * 100}%`}}>
      {items.map((i) => {
        const {left, width} = position(i);
        const h = 40 + hash01(seedKey, i * 11) * 60;
        const shade = alpha(palette.ink, 0.62 + hash01(seedKey, i * 5) * 0.36);

        if (plan.structure === 'arches') {
          return (
            <div
              key={i}
              style={{
                position: 'absolute', left, width, bottom: 0, height: `${h}%`,
                border: `${Math.max(6, plan.scale * 26)}px solid ${shade}`, borderBottom: 'none',
                borderRadius: '50% 50% 0 0 / 30% 30% 0 0',
                clipPath: hash01(seedKey, i * 13) > 0.6 ? 'polygon(0 14%, 60% 0, 100% 20%, 100% 100%, 0 100%)' : undefined,
              }}
            />
          );
        }

        if (plan.structure === 'peaks') {
          return (
            <div
              key={i}
              style={{
                position: 'absolute', left, width, bottom: 0, height: `${h}%`,
                background: shade,
                clipPath: 'polygon(50% 0, 100% 100%, 0 100%)',
              }}
            />
          );
        }

        if (plan.structure === 'trunks') {
          return (
            <div
              key={i}
              style={{
                position: 'absolute', left, width: `${parseFloat(width) * 0.34}%`, top: `${-hash01(seedKey, i * 3) * 20}%`,
                height: `${h + 40}%`, background: shade,
                transform: `rotate(${(hash01(seedKey, i * 17) - 0.5) * 5}deg)`,
                filter: `blur(${hash01(seedKey, i * 19) * 2}px)`,
              }}
            />
          );
        }

        if (plan.structure === 'girders') {
          return (
            <div
              key={i}
              style={{
                position: 'absolute', left: `${i * (100 / plan.count) * 0.5 + 8}%`, right: `${i * (100 / plan.count) * 0.5 + 8}%`,
                top: `${(i / plan.count) * 60}%`, height: Math.max(5, plan.scale * 16),
                background: shade, borderTop: `2px solid ${alpha(palette.accent, 0.2)}`,
              }}
            />
          );
        }

        if (plan.structure === 'shelves') {
          return (
            <div
              key={i}
              style={{
                position: 'absolute', left: '4%', right: '4%',
                top: `${(i / plan.count) * 100}%`, height: `${100 / plan.count - 3}%`,
                borderBottom: `4px solid ${alpha(palette.ink, 0.9)}`,
                display: 'flex', alignItems: 'flex-end', gap: 3, paddingInline: 8,
              }}
            >
              {Array.from({length: 14}, (_, j) => (
                <div
                  key={j}
                  style={{
                    flex: 1,
                    height: `${52 + hash01(seedKey, i * 23 + j) * 44}%`,
                    background: alpha(j % 3 === 0 ? palette.accentDark : j % 3 === 1 ? palette.paperDark : palette.cool, 0.24 + hash01(seedKey, i * 7 + j) * 0.32),
                  }}
                />
              ))}
            </div>
          );
        }

        // blocks, columns and panels differ in proportion and detail
        const isColumn = plan.structure === 'columns';
        const isPanel = plan.structure === 'panels';
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left, width: isColumn ? `${parseFloat(width) * 0.4}%` : width,
              bottom: 0, height: `${isPanel ? 88 : h}%`,
              background: isPanel ? alpha(palette.paperDark, 0.12 + hash01(seedKey, i) * 0.1) : shade,
              border: isPanel ? `3px solid ${alpha(palette.ink, 0.75)}` : undefined,
              borderTop: isColumn ? `6px solid ${alpha(palette.paperDark, 0.3)}` : undefined,
              boxShadow: isPanel ? `inset 0 0 30px ${alpha(palette.ink, 0.7)}` : undefined,
              overflow: 'hidden',
            }}
          >
            {/* lit windows, only on block structures and only sometimes */}
            {!isColumn && !isPanel
              ? Array.from({length: 4}, (_, r) => (
                  <div
                    key={r}
                    style={{
                      position: 'absolute', left: '20%', right: '20%', top: `${14 + r * 20}%`, height: 6,
                      background: alpha(palette.accent, hash01(seedKey, i * 29 + r) > 0.5 ? 0.45 : 0.08),
                    }}
                  />
                ))
              : null}
          </div>
        );
      })}
    </div>
  );
};

const Ground: React.FC<{plan: SetPlan; seedKey: string}> = ({plan, seedKey}) => {
  const {palette} = useLook();
  const top = `${plan.horizon * 100}%`;

  if (plan.ground === 'water') {
    return (
      <div style={{position: 'absolute', left: 0, right: 0, top, bottom: 0, overflow: 'hidden'}}>
        <AbsoluteFill style={{background: `linear-gradient(180deg, ${alpha(palette.cool, 0.5)} 0%, ${alpha(palette.ink, 0.94)} 68%, ${palette.ink} 100%)`}} />
        {Array.from({length: 9}, (_, i) => (
          <div
            key={i}
            style={{
              position: 'absolute', left: `${hash01(seedKey, i * 5) * 60}%`, right: `${hash01(seedKey, i * 7) * 40}%`,
              top: `${6 + i * 9}%`, height: 3, borderRadius: 3,
              background: alpha(palette.paperLight, 0.24 - i * 0.02), filter: 'blur(1.5px)',
            }}
          />
        ))}
      </div>
    );
  }

  if (plan.ground === 'planks') {
    const planks = 6 + Math.round(hash01(seedKey, 3) * 5);
    return (
      <div style={{position: 'absolute', left: 0, right: 0, top, bottom: 0, overflow: 'hidden'}}>
        <AbsoluteFill style={{transform: 'perspective(1200px) rotateX(58deg) scale(2)', transformOrigin: '50% 0%'}}>
          {Array.from({length: planks}, (_, i) => (
            <div
              key={i}
              style={{
                position: 'absolute', top: `${(i / planks) * 100}%`, left: 0, right: 0, height: `${100 / planks}%`,
                background: alpha(i % 2 ? palette.accentDark : palette.paperDark, 0.14 + hash01(seedKey, i) * 0.12),
                borderBottom: `2px solid ${alpha(palette.ink, 0.6)}`,
              }}
            />
          ))}
        </AbsoluteFill>
      </div>
    );
  }

  if (plan.ground === 'tiles') {
    return (
      <div style={{position: 'absolute', left: 0, right: 0, top, bottom: 0, overflow: 'hidden'}}>
        <AbsoluteFill style={{background: `linear-gradient(180deg, ${alpha(palette.paperDark, 0.3)} 0%, ${palette.ink} 70%)`}} />
        <AbsoluteFill
          style={{
            transform: 'perspective(900px) rotateX(64deg) scale(2.4)', transformOrigin: '50% 0%',
            backgroundImage: `linear-gradient(${alpha(palette.ink, 0.8)} 2px, transparent 2px), linear-gradient(90deg, ${alpha(palette.ink, 0.8)} 2px, transparent 2px)`,
            backgroundSize: '120px 120px',
          }}
        />
      </div>
    );
  }

  if (plan.ground === 'rubble') {
    return (
      <div style={{position: 'absolute', left: 0, right: 0, top, bottom: 0, overflow: 'hidden'}}>
        <AbsoluteFill style={{background: `linear-gradient(180deg, ${alpha(palette.paperDark, 0.24)} 0%, ${palette.ink} 64%)`}} />
        {Array.from({length: 14}, (_, i) => (
          <div
            key={i}
            style={{
              position: 'absolute', left: `${hash01(seedKey, i * 19) * 96}%`, top: `${hash01(seedKey, i * 23) * 40}%`,
              width: 14 + hash01(seedKey, i * 29) * 40, height: 8 + hash01(seedKey, i * 31) * 18,
              background: palette.ink, transform: `rotate(${(hash01(seedKey, i * 37) - 0.5) * 46}deg)`,
            }}
          />
        ))}
      </div>
    );
  }

  if (plan.ground === 'limb') {
    return (
      <div style={{position: 'absolute', left: 0, right: 0, top, bottom: 0, overflow: 'hidden'}}>
        <div
          style={{
            position: 'absolute', left: '-40%', right: '-40%', top: 0, height: '260%', borderRadius: '50%',
            background: `radial-gradient(ellipse 60% 50% at 56% 10%, ${alpha(palette.paperDark, 0.5)} 0%, ${alpha(palette.accentDark, 0.32)} 34%, ${palette.ink} 74%)`,
            boxShadow: `inset 0 14px 70px ${alpha(palette.accent, 0.28)}`,
          }}
        />
        <div
          style={{
            position: 'absolute', left: '-40%', right: '-40%', top: -6, height: 12, borderRadius: '50%',
            background: alpha(palette.cool, 0.5), filter: 'blur(7px)',
          }}
        />
      </div>
    );
  }

  return (
    <div style={{position: 'absolute', left: 0, right: 0, top, bottom: 0}}>
      <AbsoluteFill style={{background: `linear-gradient(180deg, ${alpha(palette.paperDark, 0.52)} 0%, ${alpha(palette.ink, 0.82)} 58%, ${palette.ink} 100%)`}} />
    </div>
  );
};

const Aperture: React.FC<{plan: SetPlan}> = ({plan}) => {
  const {palette} = useLook();
  const tone = palette[plan.light.tone];

  switch (plan.aperture) {
    case 'window':
      return (
        <div
          style={{
            position: 'absolute', left: `${plan.light.x * 100 - 16}%`, top: `${plan.light.y * 100 - 10}%`,
            width: '32%', height: '26%',
            background: `linear-gradient(180deg, ${alpha(tone, 0.6)} 0%, ${alpha(tone, 0.18)} 100%)`,
            border: `10px solid ${alpha(palette.ink, 0.9)}`,
            boxShadow: `0 0 90px ${alpha(tone, 0.4)}`,
          }}
        />
      );
    case 'arch':
      return (
        <div
          style={{
            position: 'absolute', left: `${plan.light.x * 100 - 14}%`, top: `${plan.light.y * 100 - 6}%`,
            width: '28%', height: '38%', borderRadius: '50% 50% 0 0 / 40% 40% 0 0',
            background: `linear-gradient(180deg, ${alpha(tone, 0.5)} 0%, ${alpha(tone, 0.1)} 100%)`,
            border: `12px solid ${alpha(palette.ink, 0.92)}`, borderBottom: 'none',
          }}
        />
      );
    case 'disc':
      return (
        <div
          style={{
            position: 'absolute', left: '50%', top: `${plan.light.y * 100 + 12}%`, width: '74%', aspectRatio: '1',
            transform: 'translate(-50%, -50%)', borderRadius: '50%',
            background: `radial-gradient(circle at 38% 32%, ${alpha(palette.paperDark, 0.44)} 0%, ${alpha(palette.ink, 0.97)} 62%)`,
            border: `10px solid ${alpha(palette.accentDark, 0.5)}`,
            boxShadow: `inset 0 0 80px ${alpha(palette.ink, 0.95)}`,
          }}
        >
          <div style={{position: 'absolute', inset: '32%', borderRadius: '50%', border: `6px solid ${alpha(palette.accent, 0.35)}`}} />
        </div>
      );
    case 'surface':
      return (
        <div
          style={{
            position: 'absolute', left: 0, right: 0, top: `${plan.horizon * 100 - 2}%`, height: 8,
            background: alpha(palette.paperLight, 0.5), filter: 'blur(4px)',
          }}
        />
      );
    default:
      return null;
  }
};

export const GeneratedSet: React.FC<{plan: SetPlan; seed?: string}> = ({plan, seed = 'set'}) => {
  const {palette} = useLook();
  const seedKey = `${seed}-${plan.seed}`;
  const tone = palette[plan.light.tone];
  const skyOpen = plan.aperture === 'sky' || plan.ground === 'limb' || plan.ground === 'water';

  return (
    <AbsoluteFill style={{overflow: 'hidden', backgroundColor: palette.ink}}>
      {/* the far wall or the sky — brighter near the horizon either way */}
      <AbsoluteFill
        style={{
          background: skyOpen
            ? `linear-gradient(180deg, ${alpha(palette.ink, 0.96)} 0%, ${alpha(palette.cool, 0.3)} ${plan.horizon * 62}%, ${alpha(tone, 0.3)} ${plan.horizon * 96}%, ${alpha(palette.ink, 0.86)} 100%)`
            : `linear-gradient(180deg, ${alpha(palette.paperDark, 0.62)} 0%, ${alpha(palette.paperDark, 0.42)} 46%, ${alpha(palette.ink, 0.82)} 100%)`,
        }}
      />

      <Aperture plan={plan} />
      <Structure plan={plan} seedKey={seedKey} />
      <Ground plan={plan} seedKey={seedKey} />

      {/* ONE LIGHT. Everything else falls off — that is what makes a flat stack
          of divs read as a room instead of as a poster. */}
      <AbsoluteFill
        style={{
          mixBlendMode: 'screen',
          // KEY LIGHT.
          //
          // This used to top out around 0.5 and the finished frames measured
          // 0.10–0.26 mean luma — dark enough that the publish gate could not
          // tell two different scenes apart on brightness, and dark enough that
          // the drawn sets read as murk. A key light is meant to be the
          // brightest thing in the room by a wide margin.
          background: `radial-gradient(ellipse ${plan.light.size * 120}% ${plan.light.size * 88}% at ${plan.light.x * 100}% ${plan.light.y * 100}%, ${alpha(tone, Math.min(0.95, plan.light.strength * 1.9))} 0%, ${alpha(tone, plan.light.strength * 0.5)} 38%, rgba(0,0,0,0) 78%)`,
        }}
      />

      {/* air in the room */}
      <AbsoluteFill
        style={{
          opacity: plan.haze,
          background: `linear-gradient(180deg, rgba(0,0,0,0) 0%, ${alpha(tone, 0.5)} ${plan.horizon * 100}%, rgba(0,0,0,0) 100%)`,
          filter: 'blur(24px)',
        }}
      />

      {/* the frame's own falloff, tightened around the light */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 92% 78% at ${plan.light.x * 100}% 50%, rgba(0,0,0,0) 34%, ${alpha(palette.ink, 0.62)} 100%)`,
        }}
      />
    </AbsoluteFill>
  );
};
