import React from 'react';
import {AbsoluteFill} from 'remotion';
import {useLook} from './look';
import {hash01} from './motion';

/**
 * THE SETS.
 *
 * A rig without a photograph used to render an empty gradient with a caption
 * floating on it — technically fine, visually nothing. That is the difference
 * between "the pipeline ran" and "the reel is good", and it is the whole
 * complaint worth listening to.
 *
 * So every rig now stands on a DRAWN SET: a wall with a moulding and a floor,
 * a room with boards and haze, a desk with planks and a pool of lamplight, a
 * street with a skyline and pavement. Photographs, when the media layer finds
 * them, layer ON TOP of this. When it finds nothing, the beat is still a
 * composed frame instead of a hole.
 *
 * Three things make these read as space rather than as shapes:
 *   · a horizon — a floor plane in perspective, darker at the edges
 *   · one light — a single pooled source, everything else falling off
 *   · depth order — background wash, midground architecture, foreground darkness
 *
 * All of it takes the video's palette and seed, so two videos do not share a
 * room the way they must not share a colour.
 */

const alpha = (hex: string, a: number) =>
  `${hex}${Math.round(Math.max(0, Math.min(1, a)) * 255).toString(16).padStart(2, '0')}`;

/** A floor plane running to a horizon, with the light pooled where the eye goes. */
const Floor: React.FC<{horizon: number; lightX?: number; tone?: string}> = ({
  horizon,
  lightX = 50,
  tone,
}) => {
  const {palette} = useLook();
  const surface = tone ?? palette.paperDark;
  return (
    <div style={{position: 'absolute', left: 0, right: 0, top: `${horizon}%`, bottom: 0, overflow: 'hidden'}}>
      <AbsoluteFill
        style={{
          background: `linear-gradient(180deg, ${alpha(surface, 0.42)} 0%, ${alpha(palette.ink, 0.86)} 62%, ${palette.ink} 100%)`,
        }}
      />
      {/* the pool of light on the floor — the only bright thing down here */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 46% 40% at ${lightX}% 6%, ${alpha(palette.accent, 0.3)} 0%, rgba(0,0,0,0) 72%)`,
        }}
      />
    </div>
  );
};

/** GALLERY — where a framed photograph hangs and the camera flies through it. */
export const GalleryWall: React.FC<{seed?: string}> = ({seed = 'gallery'}) => {
  const {palette, motion} = useLook();
  const lightX = motion.polarity > 0 ? 42 : 58;
  return (
    <AbsoluteFill>
      <AbsoluteFill
        style={{
          background: `linear-gradient(180deg, ${alpha(palette.paperDark, 0.5)} 0%, ${alpha(palette.paperDark, 0.34)} 46%, ${alpha(palette.ink, 0.9)} 100%)`,
        }}
      />
      {/* the wash of a gallery spot, thrown from one side */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 62% 46% at ${lightX}% 30%, ${alpha(palette.paperLight, 0.34)} 0%, rgba(0,0,0,0) 70%)`,
        }}
      />
      {/* chair rail: two mouldings and the darker dado below them */}
      <div style={{position: 'absolute', left: 0, right: 0, top: '69%', height: 10, background: alpha(palette.ink, 0.5)}} />
      <div style={{position: 'absolute', left: 0, right: 0, top: '70.6%', height: 4, background: alpha(palette.paperLight, 0.28)}} />
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: '71.4%',
          bottom: 0,
          background: `linear-gradient(180deg, ${alpha(palette.ink, 0.42)} 0%, ${alpha(palette.ink, 0.86)} 100%)`,
        }}
      />
      <Floor horizon={88} lightX={lightX} />
      {/* the frame's own shadow on the wall, so it hangs instead of floating */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 34% 30% at 52% 44%, ${alpha(palette.ink, 0.55)} 0%, rgba(0,0,0,0) 68%)`,
          filter: 'blur(26px)',
          opacity: 0.9 - hash01(seed, 3) * 0.2,
        }}
      />
    </AbsoluteFill>
  );
};

/** VILLAIN ROOM — the sunburst is the backdrop; this is the room it sits in. */
export const VillainStage: React.FC = () => {
  const {palette, motion} = useLook();
  return (
    <AbsoluteFill>
      <Floor horizon={74} lightX={motion.polarity > 0 ? 46 : 54} tone={palette.danger} />
      {/* smoke haze catching the light — a room with air in it reads as deep */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 70% 30% at 50% 62%, ${alpha(palette.paperLight, 0.14)} 0%, rgba(0,0,0,0) 72%)`,
          filter: 'blur(18px)',
        }}
      />
      {/* the near edge of a desk, in silhouette, across the bottom */}
      <div
        style={{
          position: 'absolute',
          left: '-6%',
          right: '-6%',
          bottom: 0,
          height: '17%',
          background: `linear-gradient(180deg, ${alpha(palette.ink, 0.72)} 0%, ${palette.ink} 34%, ${palette.ink} 100%)`,
          borderTop: `3px solid ${alpha(palette.accent, 0.32)}`,
          transform: 'perspective(900px) rotateX(6deg)',
          transformOrigin: '50% 100%',
        }}
      />
    </AbsoluteFill>
  );
};

/** DESK — the wooden surface the newspapers land on. */
export const DeskStage: React.FC<{seed?: string}> = ({seed = 'desk'}) => {
  const {palette, motion} = useLook();
  const planks = 7 + Math.floor(hash01(seed, 11) * 4);
  const lightX = motion.polarity > 0 ? 44 : 56;
  return (
    <AbsoluteFill style={{overflow: 'hidden'}}>
      <AbsoluteFill
        style={{
          background: `linear-gradient(160deg, ${alpha(palette.paperDark, 0.42)} 0%, ${alpha(palette.accentDark, 0.4)} 44%, ${palette.ink} 100%)`,
        }}
      />
      {/* planks running away from camera, in perspective */}
      <AbsoluteFill style={{transform: 'perspective(1400px) rotateX(52deg) scale(1.9)', transformOrigin: '50% 74%'}}>
        {Array.from({length: planks}, (_, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              top: `${(i / planks) * 100}%`,
              left: 0,
              right: 0,
              height: `${100 / planks}%`,
              background: alpha(i % 2 ? palette.accentDark : palette.paperDark, 0.16 + hash01(seed, i) * 0.12),
              borderBottom: `2px solid ${alpha(palette.ink, 0.5)}`,
            }}
          />
        ))}
      </AbsoluteFill>
      {/* one warm pool, so the stack of paper has a reason to be readable */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 52% 42% at ${lightX}% 46%, ${alpha(palette.accent, 0.26)} 0%, rgba(0,0,0,0) 72%)`,
        }}
      />
      <AbsoluteFill
        style={{background: `radial-gradient(ellipse 74% 62% at 50% 48%, rgba(0,0,0,0) 26%, ${alpha(palette.ink, 0.82)} 100%)`}}
      />
    </AbsoluteFill>
  );
};

/** STREET — a skyline, a horizon and pavement for the grounded punch. */
export const StreetStage: React.FC<{seed?: string}> = ({seed = 'street'}) => {
  const {palette, motion} = useLook();
  const blocks = 7 + Math.floor(hash01(seed, 5) * 4);
  const lightX = motion.polarity > 0 ? 38 : 62;
  return (
    <AbsoluteFill style={{overflow: 'hidden'}}>
      {/* sky, brighter at the horizon the way dusk actually is */}
      <AbsoluteFill
        style={{
          background: `linear-gradient(180deg, ${alpha(palette.ink, 0.95)} 0%, ${alpha(palette.cool, 0.34)} 52%, ${alpha(palette.accent, 0.28)} 70%, ${alpha(palette.ink, 0.8)} 100%)`,
        }}
      />
      {/* skyline in silhouette, with a few lit windows */}
      <div style={{position: 'absolute', left: 0, right: 0, bottom: '30%', height: '46%', display: 'flex', alignItems: 'flex-end'}}>
        {Array.from({length: blocks}, (_, i) => {
          const h = 34 + hash01(seed, i * 3) * 62;
          const rows = 2 + Math.floor(hash01(seed, i * 7) * 4);
          return (
            <div
              key={i}
              style={{
                flex: 1,
                height: `${h}%`,
                background: palette.ink,
                borderTop: `2px solid ${alpha(palette.paperDark, 0.18)}`,
                marginRight: 6,
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {Array.from({length: rows}, (_, r) => (
                <div
                  key={r}
                  style={{
                    position: 'absolute',
                    left: '18%',
                    right: '18%',
                    top: `${12 + r * 20}%`,
                    height: 7,
                    background: alpha(palette.accent, hash01(seed, i * 13 + r) > 0.45 ? 0.5 : 0.1),
                  }}
                />
              ))}
            </div>
          );
        })}
      </div>
      <Floor horizon={70} lightX={lightX} />
      {/* kerb line — the ground the character and the shadow both stand on */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: '70%',
          height: 5,
          background: alpha(palette.paperDark, 0.4),
          boxShadow: `0 10px 34px ${alpha(palette.ink, 0.9)}`,
        }}
      />
    </AbsoluteFill>
  );
};

/**
 * THE EMPTY CHAIR — the villain beat's focal object.
 *
 * The rig is built around a person, and when the media layer returns no
 * photograph of one there is nothing to look at. Drawing a figure is not the
 * answer: procedural silhouettes came out as sign pictograms every time this
 * repo tried, which is why the collage line is dead.
 *
 * A high-backed chair behind a desk, with smoke still rising from it, says
 * "someone with power sits here" without drawing a body — furniture reads as
 * real at a glance in a way a fake person never does.
 */
export const EmptyChair: React.FC<{seed?: string; smoke?: number}> = ({seed = 'chair', smoke = 1}) => {
  const {palette} = useLook();
  const lean = (hash01(seed, 21) - 0.5) * 4;
  const leather = `linear-gradient(160deg, ${alpha(palette.paperDark, 0.22)} 0%, ${alpha(palette.accentDark, 0.3)} 22%, ${palette.ink} 62%, ${palette.ink} 100%)`;
  return (
    <AbsoluteFill style={{alignItems: 'center', justifyContent: 'flex-end', paddingBottom: '14%'}}>
      <div style={{position: 'relative', width: '52%', height: '52%', transform: `rotate(${lean}deg)`}}>
        {/* seat and base, so the back has something to sit on */}
        <div
          style={{
            position: 'absolute',
            left: '6%',
            right: '6%',
            bottom: 0,
            height: '16%',
            borderRadius: '14px 14px 6px 6px',
            background: leather,
            border: `2px solid ${alpha(palette.accent, 0.16)}`,
            boxShadow: `0 22px 50px ${alpha(palette.ink, 0.95)}`,
          }}
        />
        {/* the two arms, catching a little light on their top edge */}
        {[0, 1].map((side) => (
          <div
            key={side}
            style={{
              position: 'absolute',
              [side ? 'right' : 'left']: '-2%',
              bottom: '13%',
              width: '17%',
              height: '22%',
              borderRadius: side ? '10px 22px 10px 6px' : '22px 10px 6px 10px',
              background: leather,
              borderTop: `3px solid ${alpha(palette.accent, 0.3)}`,
            }}
          />
        ))}
        {/* the high back, tufted */}
        <div
          style={{
            position: 'absolute',
            left: '10%',
            right: '10%',
            top: 0,
            bottom: '14%',
            borderRadius: '46% 46% 10% 10% / 34% 34% 6% 6%',
            background: leather,
            border: `2px solid ${alpha(palette.accent, 0.2)}`,
            boxShadow: `inset 0 18px 46px ${alpha(palette.paperDark, 0.16)}, inset 0 -30px 60px ${alpha(palette.ink, 0.9)}, 0 30px 70px ${alpha(palette.ink, 0.95)}`,
            overflow: 'hidden',
          }}
        >
          {Array.from({length: 9}, (_, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: `${18 + (i % 3) * 26}%`,
                top: `${24 + Math.floor(i / 3) * 20}%`,
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: alpha(palette.ink, 0.9),
                boxShadow: `0 1px 0 ${alpha(palette.accent, 0.22)}`,
              }}
            />
          ))}
        </div>
        {/* a rim of light down one edge, so it is an object and not a hole */}
        <div
          style={{
            position: 'absolute',
            left: '9%',
            top: '6%',
            bottom: '20%',
            width: 7,
            borderRadius: 7,
            background: `linear-gradient(180deg, rgba(0,0,0,0) 0%, ${alpha(palette.accent, 0.55)} 38%, rgba(0,0,0,0) 100%)`,
            filter: 'blur(2px)',
          }}
        />
        {/* smoke still rising — the chair was occupied a moment ago */}
        {smoke > 0 ? (
          <div
            style={{
              position: 'absolute',
              right: '18%',
              top: '-40%',
              width: '20%',
              height: '52%',
              opacity: 0.55 * smoke,
              background: `radial-gradient(ellipse 36% 58% at 50% 100%, ${alpha(palette.paperLight, 0.55)} 0%, rgba(0,0,0,0) 74%)`,
              filter: 'blur(13px)',
            }}
          />
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

/** STUDY — the room the lamp hangs in, for the money beat. */
export const StudyStage: React.FC<{seed?: string}> = ({seed = 'study'}) => {
  const {palette, motion} = useLook();
  const shelves = 4 + Math.floor(hash01(seed, 9) * 3);
  const lightX = motion.lampSide * 100;
  return (
    <AbsoluteFill style={{overflow: 'hidden'}}>
      <AbsoluteFill style={{background: `linear-gradient(180deg, ${alpha(palette.paperDark, 0.24)} 0%, ${palette.ink} 78%)`}} />

      {/* bookshelf: rows of spines, only readable where the lamp reaches */}
      <div style={{position: 'absolute', left: '4%', right: '4%', top: '18%', height: '48%'}}>
        {Array.from({length: shelves}, (_, row) => (
          <div
            key={row}
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: `${(row / shelves) * 100}%`,
              height: `${100 / shelves - 2}%`,
              borderBottom: `4px solid ${alpha(palette.ink, 0.9)}`,
              display: 'flex',
              alignItems: 'flex-end',
              gap: 3,
              paddingInline: 8,
            }}
          >
            {Array.from({length: 16}, (_, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: `${58 + hash01(seed, row * 17 + i) * 36}%`,
                  background: alpha(
                    i % 3 === 0 ? palette.accentDark : i % 3 === 1 ? palette.paperDark : palette.cool,
                    0.28 + hash01(seed, row * 5 + i) * 0.3,
                  ),
                }}
              />
            ))}
          </div>
        ))}
      </div>

      {/* desk plane across the lower third */}
      <div
        style={{
          position: 'absolute',
          left: '-8%',
          right: '-8%',
          top: '68%',
          bottom: 0,
          background: `linear-gradient(180deg, ${alpha(palette.paperDark, 0.36)} 0%, ${alpha(palette.ink, 0.94)} 46%, ${palette.ink} 100%)`,
          transform: 'perspective(1200px) rotateX(10deg)',
          transformOrigin: '50% 0%',
          boxShadow: `0 -18px 40px ${alpha(palette.ink, 0.9)}`,
        }}
      />

      {/* the room falls off hard everywhere the lamp is not */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 56% 52% at ${lightX}% 34%, rgba(0,0,0,0) 18%, ${alpha(palette.ink, 0.88)} 100%)`,
        }}
      />
    </AbsoluteFill>
  );
};


/* ============================================================================
 * MORE PLACES.
 *
 * Five sets meant a whale documentary and a bank robbery were staged in the
 * same room with different paint. A set is not decoration — it is the answer
 * to "where am I", and that answer has to come from the line, not from the rig.
 * ==========================================================================*/

/** OCEAN — surface line, depth falloff, light shafts from above. */
export const OceanSet: React.FC<{seed?: string}> = ({seed = 'ocean'}) => {
  const {palette, motion} = useLook();
  return (
    <AbsoluteFill style={{overflow: 'hidden'}}>
      <AbsoluteFill
        style={{
          background: `linear-gradient(180deg, ${alpha(palette.cool, 0.55)} 0%, ${alpha(palette.cool, 0.28)} 26%, ${alpha(palette.ink, 0.9)} 74%, ${palette.ink} 100%)`,
        }}
      />
      {/* the surface, seen from just underneath */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: '16%',
          height: 6,
          background: alpha(palette.paperLight, 0.5),
          filter: 'blur(3px)',
        }}
      />
      {/* shafts coming through the surface */}
      <AbsoluteFill
        style={{
          mixBlendMode: 'screen',
          opacity: 0.35,
          transform: `rotate(${6 * motion.polarity}deg) scale(1.5)`,
          background: `repeating-linear-gradient(90deg, ${alpha(palette.paperLight, 0.2)} 0 22px, rgba(0,0,0,0) 22px 110px)`,
          filter: 'blur(16px)',
        }}
      />
      {/* seabed */}
      <div
        style={{
          position: 'absolute',
          left: '-10%',
          right: '-10%',
          bottom: '-6%',
          height: '26%',
          borderRadius: '50% 50% 0 0',
          background: `linear-gradient(180deg, ${alpha(palette.paperDark, 0.28)} 0%, ${palette.ink} 70%)`,
          filter: 'blur(2px)',
          opacity: 0.6 + hash01(seed, 4) * 0.2,
        }}
      />
    </AbsoluteFill>
  );
};

/** SPACE — a planet limb, a starfield and the black. */
export const SpaceSet: React.FC<{seed?: string}> = ({seed = 'space'}) => {
  const {palette, motion} = useLook();
  const side = motion.polarity > 0 ? '58%' : '42%';
  return (
    <AbsoluteFill style={{overflow: 'hidden'}}>
      <AbsoluteFill style={{background: `radial-gradient(ellipse 90% 70% at 50% 20%, ${alpha(palette.cool, 0.18)} 0%, ${palette.ink} 68%)`}} />
      {/* planet limb across the lower frame, lit on one side */}
      <div
        style={{
          position: 'absolute',
          left: '-40%',
          right: '-40%',
          top: '62%',
          height: '90%',
          borderRadius: '50%',
          background: `radial-gradient(ellipse 60% 50% at ${side} 12%, ${alpha(palette.paperDark, 0.55)} 0%, ${alpha(palette.accentDark, 0.35)} 34%, ${palette.ink} 72%)`,
          boxShadow: `inset 0 12px 60px ${alpha(palette.accent, 0.3)}`,
        }}
      />
      {/* atmosphere rim */}
      <div
        style={{
          position: 'absolute',
          left: '-40%',
          right: '-40%',
          top: '61%',
          height: 10,
          borderRadius: '50%',
          background: alpha(palette.cool, 0.5),
          filter: 'blur(6px)',
          opacity: 0.8 - hash01(seed, 6) * 0.2,
        }}
      />
    </AbsoluteFill>
  );
};

/** VAULT — a bank's back room: a steel door, a tiled floor, a hard light. */
export const VaultSet: React.FC<{seed?: string}> = ({seed = 'vault'}) => {
  const {palette} = useLook();
  return (
    <AbsoluteFill style={{overflow: 'hidden'}}>
      <AbsoluteFill style={{background: `linear-gradient(180deg, ${alpha(palette.paperDark, 0.3)} 0%, ${palette.ink} 76%)`}} />
      {/* the door: a huge disc with bolt rings */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '38%',
          width: '78%',
          aspectRatio: '1',
          transform: 'translate(-50%, -50%)',
          borderRadius: '50%',
          background: `radial-gradient(circle at 38% 32%, ${alpha(palette.paperDark, 0.5)} 0%, ${alpha(palette.ink, 0.96)} 62%)`,
          border: `10px solid ${alpha(palette.accentDark, 0.55)}`,
          boxShadow: `inset 0 0 80px ${alpha(palette.ink, 0.95)}, 0 30px 70px ${alpha(palette.ink, 0.9)}`,
        }}
      >
        {Array.from({length: 12}, (_, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: 14,
              height: 14,
              borderRadius: '50%',
              background: alpha(palette.accent, 0.4),
              transform: `rotate(${i * 30}deg) translateY(-42%) translateX(-50%)`,
            }}
          />
        ))}
        <div
          style={{
            position: 'absolute',
            inset: '30%',
            borderRadius: '50%',
            border: `6px solid ${alpha(palette.accent, 0.4)}`,
          }}
        />
      </div>
      <Floor horizon={78} lightX={50} />
    </AbsoluteFill>
  );
};

/** COURT — panelled wall, a bench, the light of a hearing. */
export const CourtSet: React.FC<{seed?: string}> = ({seed = 'court'}) => {
  const {palette} = useLook();
  const panels = 6 + Math.floor(hash01(seed, 3) * 3);
  return (
    <AbsoluteFill style={{overflow: 'hidden'}}>
      <AbsoluteFill style={{background: `linear-gradient(180deg, ${alpha(palette.accentDark, 0.34)} 0%, ${palette.ink} 82%)`}} />
      <div style={{position: 'absolute', left: 0, right: 0, top: '10%', height: '52%', display: 'flex', gap: 8, paddingInline: 10}}>
        {Array.from({length: panels}, (_, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              border: `3px solid ${alpha(palette.ink, 0.7)}`,
              background: alpha(palette.paperDark, 0.14 + hash01(seed, i) * 0.1),
              boxShadow: `inset 0 0 30px ${alpha(palette.ink, 0.7)}`,
            }}
          />
        ))}
      </div>
      {/* the bench, heavy and dark, across the middle */}
      <div
        style={{
          position: 'absolute',
          left: '-6%',
          right: '-6%',
          top: '60%',
          height: '16%',
          background: `linear-gradient(180deg, ${alpha(palette.paperDark, 0.4)} 0%, ${palette.ink} 60%)`,
          borderTop: `4px solid ${alpha(palette.accent, 0.3)}`,
          boxShadow: `0 24px 50px ${alpha(palette.ink, 0.95)}`,
        }}
      />
      <Floor horizon={76} lightX={50} />
    </AbsoluteFill>
  );
};

/** LAB — tiled wall, a bench of glassware silhouettes, cold light. */
export const LabSet: React.FC<{seed?: string}> = ({seed = 'lab'}) => {
  const {palette} = useLook();
  return (
    <AbsoluteFill style={{overflow: 'hidden'}}>
      <AbsoluteFill style={{background: `linear-gradient(180deg, ${alpha(palette.cool, 0.26)} 0%, ${palette.ink} 78%)`}} />
      {/* tiles */}
      <AbsoluteFill
        style={{
          opacity: 0.4,
          backgroundImage: `linear-gradient(${alpha(palette.ink, 0.6)} 2px, transparent 2px), linear-gradient(90deg, ${alpha(palette.ink, 0.6)} 2px, transparent 2px)`,
          backgroundSize: '92px 92px',
          maskImage: 'linear-gradient(180deg, #000 0%, rgba(0,0,0,0) 72%)',
          WebkitMaskImage: 'linear-gradient(180deg, #000 0%, rgba(0,0,0,0) 72%)',
        }}
      />
      {/* bench with glassware shapes */}
      <div style={{position: 'absolute', left: 0, right: 0, top: '58%', height: '14%', display: 'flex', alignItems: 'flex-end', gap: 22, paddingInline: 40}}>
        {Array.from({length: 5}, (_, i) => (
          <div
            key={i}
            style={{
              width: 40 + hash01(seed, i * 5) * 40,
              height: `${50 + hash01(seed, i * 7) * 50}%`,
              borderRadius: '40% 40% 12% 12%',
              background: alpha(palette.cool, 0.16),
              border: `2px solid ${alpha(palette.paperLight, 0.24)}`,
            }}
          />
        ))}
      </div>
      <div style={{position: 'absolute', left: '-6%', right: '-6%', top: '72%', height: 12, background: alpha(palette.paperDark, 0.34)}} />
      <Floor horizon={74} lightX={50} />
    </AbsoluteFill>
  );
};

/** FACTORY — girders, a gantry and a floor that goes back a long way. */
export const FactorySet: React.FC<{seed?: string}> = ({seed = 'factory'}) => {
  const {palette, motion} = useLook();
  const bays = 5 + Math.floor(hash01(seed, 7) * 3);
  return (
    <AbsoluteFill style={{overflow: 'hidden'}}>
      <AbsoluteFill style={{background: `linear-gradient(180deg, ${alpha(palette.ink, 0.9)} 0%, ${alpha(palette.accentDark, 0.26)} 46%, ${palette.ink} 88%)`}} />
      {/* roof girders in perspective */}
      {Array.from({length: bays}, (_, i) => {
        const depth = i / bays;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `${8 + depth * 26}%`,
              right: `${8 + depth * 26}%`,
              top: `${6 + depth * 16}%`,
              height: 10,
              background: alpha(palette.ink, 0.9 - depth * 0.3),
              borderTop: `2px solid ${alpha(palette.accent, 0.22)}`,
            }}
          />
        );
      })}
      {/* the hanging lamp row that lights the hall */}
      <AbsoluteFill
        style={{
          mixBlendMode: 'screen',
          background: `radial-gradient(ellipse 40% 26% at ${motion.polarity > 0 ? 44 : 56}% 40%, ${alpha(palette.accent, 0.34)} 0%, rgba(0,0,0,0) 70%)`,
        }}
      />
      <Floor horizon={70} lightX={motion.polarity > 0 ? 44 : 56} />
    </AbsoluteFill>
  );
};

/** FOREST — trunks in depth, canopy light, undergrowth dark. */
export const ForestSet: React.FC<{seed?: string}> = ({seed = 'forest'}) => {
  const {palette} = useLook();
  const trunks = 7 + Math.floor(hash01(seed, 9) * 4);
  return (
    <AbsoluteFill style={{overflow: 'hidden'}}>
      <AbsoluteFill style={{background: `linear-gradient(180deg, ${alpha(palette.cool, 0.34)} 0%, ${alpha(palette.accentDark, 0.2)} 44%, ${palette.ink} 86%)`}} />
      {Array.from({length: trunks}, (_, i) => {
        const depth = hash01(seed, i * 13);
        const w = 20 + depth * 60;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `${hash01(seed, i * 3) * 100}%`,
              top: `${-6 + depth * 12}%`,
              width: w,
              height: `${72 + depth * 22}%`,
              background: alpha(palette.ink, 0.55 + depth * 0.4),
              filter: `blur(${(1 - depth) * 3}px)`,
              transform: `rotate(${(hash01(seed, i * 17) - 0.5) * 4}deg)`,
            }}
          />
        );
      })}
      <AbsoluteFill
        style={{
          mixBlendMode: 'screen',
          opacity: 0.4,
          background: `radial-gradient(ellipse 50% 30% at 50% 4%, ${alpha(palette.accent, 0.4)} 0%, rgba(0,0,0,0) 72%)`,
        }}
      />
      <Floor horizon={82} lightX={50} />
    </AbsoluteFill>
  );
};

/** RUINS — a broken arcade, rubble, a sky where a roof used to be. */
export const RuinsSet: React.FC<{seed?: string}> = ({seed = 'ruins'}) => {
  const {palette} = useLook();
  const arches = 4 + Math.floor(hash01(seed, 11) * 3);
  return (
    <AbsoluteFill style={{overflow: 'hidden'}}>
      <AbsoluteFill style={{background: `linear-gradient(180deg, ${alpha(palette.paperDark, 0.34)} 0%, ${alpha(palette.ink, 0.92)} 62%, ${palette.ink} 100%)`}} />
      <div style={{position: 'absolute', left: 0, right: 0, top: '22%', height: '46%', display: 'flex', alignItems: 'flex-end', gap: 14, paddingInline: 20}}>
        {Array.from({length: arches}, (_, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: `${52 + hash01(seed, i * 5) * 48}%`,
              borderRadius: '50% 50% 0 0 / 26% 26% 0 0',
              border: `14px solid ${palette.ink}`,
              borderBottom: 'none',
              // a broken top edge: the arch is chewed away at one corner
              clipPath: hash01(seed, i * 7) > 0.5 ? 'polygon(0 12%, 62% 0, 100% 18%, 100% 100%, 0 100%)' : undefined,
              opacity: 0.9,
            }}
          />
        ))}
      </div>
      <Floor horizon={68} lightX={50} />
      {/* rubble along the ground line */}
      {Array.from({length: 10}, (_, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: `${hash01(seed, i * 19) * 96}%`,
            top: `${67 + hash01(seed, i * 23) * 6}%`,
            width: 16 + hash01(seed, i * 29) * 34,
            height: 10 + hash01(seed, i * 31) * 16,
            background: palette.ink,
            transform: `rotate(${(hash01(seed, i * 37) - 0.5) * 40}deg)`,
          }}
        />
      ))}
    </AbsoluteFill>
  );
};

export type SetId =
  | 'gallery' | 'villain' | 'desk' | 'street' | 'study'
  | 'ocean' | 'space' | 'vault' | 'court' | 'lab' | 'factory' | 'forest' | 'ruins';

/**
 * The set dispatcher. A rig asks for a place by name and gets it — the mechanic
 * does not care whether the punch happens on a street, in a vault or under
 * water, which is the whole reason a rig can be reused at all.
 */
export const Stage: React.FC<{id?: SetId; seed?: string}> = ({id = 'street', seed = 'set'}) => {
  switch (id) {
    case 'gallery': return <GalleryWall seed={seed} />;
    case 'villain': return <VillainStage />;
    case 'desk': return <DeskStage seed={seed} />;
    case 'study': return <StudyStage seed={seed} />;
    case 'ocean': return <OceanSet seed={seed} />;
    case 'space': return <SpaceSet seed={seed} />;
    case 'vault': return <VaultSet seed={seed} />;
    case 'court': return <CourtSet seed={seed} />;
    case 'lab': return <LabSet seed={seed} />;
    case 'factory': return <FactorySet seed={seed} />;
    case 'forest': return <ForestSet seed={seed} />;
    case 'ruins': return <RuinsSet seed={seed} />;
    default: return <StreetStage seed={seed} />;
  }
};
