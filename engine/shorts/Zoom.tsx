import React from 'react';
import {AbsoluteFill, Audio, Easing, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {Look, PALETTE, Stars, measure} from './lib';
import {MOON, WORLD} from './world';

/**
 * ONE SHOT. THIRTY SECONDS. NO CUTS.
 *
 * The first version of this reel was seven static cards with transitions
 * between them, and cards are what a slide deck is made of. This is the same
 * subject as a single continuous move: a stack of paper doubling, and the
 * camera pulling back for half a minute to keep it in frame while it swallows a
 * hand, a person, a house, a skyline, a mountain, the atmosphere, the Earth,
 * and finally the distance to the Moon.
 *
 * WHY A CONTINUOUS ZOOM IS THE RIGHT SHAPE HERE, and not just a nicer one:
 * exponential growth is not a sequence of states, it is a RATE. Cutting between
 * "10 folds" and "20 folds" shows two numbers; never cutting shows the thing
 * the numbers are about. The viewer cannot look away to check whether it
 * slowed down, because it is happening in front of them the whole time.
 *
 * THE ONE IDEA THE WHOLE FILE RESTS ON:
 *
 *   Nothing here animates. Every object has a fixed REAL SIZE in millimetres,
 *   and the camera has one number — the current thickness of the stack. An
 *   object's size on screen is `real / thickness`. So the hand does not shrink;
 *   the stack grows, and the arithmetic does the rest. That is why the scales
 *   are honest: they are not keyframed, they are divided.
 */

export type ZoomData = {
  score?: string;
  thump?: string;
  base: number;
  ratio: number;
  folds: number;
  end: number;
  title: {pre: string; big: string; post: string};
  close: {pre: string; big: string; post: string};
};

/** The stack's own height on screen, constant: it is the subject, so the camera
 *  is always framed on it and everything else is measured against it. */
const COLUMN = 0.44;

/* --------------------------------------------------------------- CAMERA -- */

/**
 * WHERE THE STACK HAS GOT TO, at this frame.
 *
 * Linear in FOLDS, which is exponential in millimetres — and that is the point.
 * A camera that eased would be making the growth look like it was tiring; it is
 * not, and the whole feeling of the piece is that it never does.
 */
const foldsAt = (frame: number, data: ZoomData): number => {
  const hold = 26;
  return interpolate(frame, [hold, data.end - 70], [0, data.folds], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
};

/* ---------------------------------------------------------------- STACK -- */

/**
 * THE STACK ITSELF — a slab lit from the left with its sheets visible.
 *
 * Sheet lines are drawn only while there are few enough to count. Past about
 * twelve folds they would be sub-pixel and the browser draws a grey mush, so
 * they fade out and the slab takes over. Detail that cannot be resolved is not
 * detail, it is noise.
 */
const Stack: React.FC<{folds: number; height: number; width: number}> = ({folds, height, width}) => {
  const sheets = Math.min(24, 2 ** Math.min(folds, 4.6));
  const lines = interpolate(folds, [3, 7], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

  return (
    <div
      style={{
        position: 'relative',
        width,
        height,
        background: 'linear-gradient(100deg, #ffffff 0%, #efe9d9 26%, #cdc5b2 62%, #8f8877 100%)',
        boxShadow: `0 ${height * 0.05}px ${height * 0.16}px rgba(0,0,0,0.75), inset 0 0 ${height * 0.1}px rgba(0,0,0,0.18)`,
        overflow: 'hidden',
      }}
    >
      {lines > 0.01
        ? Array.from({length: Math.round(sheets)}, (_, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: `${(i / sheets) * 100}%`,
                height: 1,
                background: 'rgba(60,52,40,0.55)',
                opacity: lines,
              }}
            />
          ))
        : null}
      {/* A specular band, so the slab reads as a solid with a surface rather
          than as a filled rectangle. */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(100deg, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0) 22%)',
          mixBlendMode: 'screen',
        }}
      />
    </div>
  );
};

/* ----------------------------------------------------------------- HUD --- */

/**
 * THE COUNTER, PINNED.
 *
 * The only thing on screen that does not move, which is what lets everything
 * else move without the frame feeling loose. Tabular figures so the digits
 * change without the number sliding sideways.
 */
const Hud: React.FC<{folds: number; data: ZoomData; opacity: number}> = ({folds, data, opacity}) => {
  const {width, height} = useVideoConfig();
  const shown = Math.floor(folds);
  const {value, unit} = measure(data.base * data.ratio ** shown);

  return (
    <AbsoluteFill style={{alignItems: 'center', paddingTop: height * 0.085, opacity, pointerEvents: 'none'}}>
      <div
        style={{
          fontFamily: '"Archivo", "Helvetica Neue", Arial, sans-serif',
          textAlign: 'center',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        <div
          style={{
            fontSize: width * 0.042,
            fontWeight: 800,
            letterSpacing: '0.34em',
            color: 'rgba(255,255,255,0.5)',
            textTransform: 'uppercase',
          }}
        >
          {String(shown).padStart(2, '0')} katlama
        </div>
        <div style={{display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: width * 0.018, marginTop: height * 0.006}}>
          <span
            style={{
              fontSize: width * 0.165,
              fontWeight: 900,
              letterSpacing: '-0.045em',
              color: '#fff',
              lineHeight: 0.9,
              textShadow: '0 6px 40px rgba(0,0,0,0.85)',
            }}
          >
            {value}
          </span>
          <span style={{fontSize: width * 0.07, fontWeight: 900, color: PALETTE.hot, letterSpacing: '-0.02em'}}>{unit}</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* --------------------------------------------------------------- LABELS -- */

/**
 * A NAME ARRIVES BY BEING UNCOVERED, not by fading in.
 *
 * A wipe has a direction and a speed, so it reads as an action; opacity has
 * neither, so it reads as a rendering artefact. The bar travels ahead of the
 * word and gets out of the way, which is the oldest title trick there is and
 * still the one that looks most deliberate.
 */
const Label: React.FC<{text: string; progress: number; y: number}> = ({text, progress, y}) => {
  const {width, height} = useVideoConfig();
  const open = interpolate(progress, [0, 0.42], [0, 1], {extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic)});
  const out = interpolate(progress, [0.86, 1], [1, 0], {extrapolateLeft: 'clamp'});
  if (out <= 0.01) return null;

  return (
    <div
      style={{
        position: 'absolute',
        top: y,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        opacity: out,
        pointerEvents: 'none',
      }}
    >
      <div style={{position: 'relative', overflow: 'hidden', padding: `${height * 0.004}px 0`}}>
        <div
          style={{
            fontFamily: '"Archivo", "Helvetica Neue", Arial, sans-serif',
            fontSize: width * 0.058,
            fontWeight: 900,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: '#fff',
            whiteSpace: 'nowrap',
            clipPath: `inset(0 ${(1 - open) * 100}% 0 0)`,
            textShadow: '0 3px 20px rgba(0,0,0,0.9)',
          }}
        >
          {text}
        </div>
        <div
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: `${open * 100}%`,
            width: width * 0.012,
            background: PALETTE.hot,
            opacity: open < 1 ? 1 : 0,
          }}
        />
      </div>
    </div>
  );
};

/* ---------------------------------------------------------------- TITLE -- */

const Card: React.FC<{
  pre: string;
  big: string;
  post: string;
  progress: number;
  colour: string;
}> = ({pre, big, post, progress, colour}) => {
  const {width, height, fps} = useVideoConfig();
  const land = spring({frame: progress * fps * 1.2, fps, config: {damping: 12, mass: 0.7}, durationInFrames: 20});
  const font = '"Archivo", "Helvetica Neue", Arial, sans-serif';

  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', pointerEvents: 'none'}}>
      <div style={{textAlign: 'center', fontFamily: font, textTransform: 'uppercase'}}>
        <div
          style={{
            fontSize: width * 0.072,
            fontWeight: 800,
            letterSpacing: '0.24em',
            color: 'rgba(255,255,255,0.62)',
            opacity: interpolate(land, [0, 0.4], [0, 1]),
            transform: `translateY(${(1 - land) * 30}px)`,
          }}
        >
          {pre}
        </div>
        <div
          style={{
            fontSize: width * 0.36,
            fontWeight: 900,
            letterSpacing: '-0.06em',
            lineHeight: 0.86,
            color: colour,
            transform: `scale(${0.62 + land * 0.38})`,
            opacity: land,
            textShadow: `0 0 ${80 * land}px ${colour}66`,
          }}
        >
          {big}
        </div>
        <div
          style={{
            fontSize: width * 0.088,
            fontWeight: 900,
            letterSpacing: '0.06em',
            color: '#fff',
            opacity: interpolate(land, [0.35, 0.85], [0, 1], {extrapolateRight: 'clamp'}),
            transform: `translateY(${(1 - land) * -18}px)`,
          }}
        >
          {post}
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* ----------------------------------------------------------------- REEL -- */

export const Zoom: React.FC<{data: ZoomData}> = ({data}) => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();

  const folds = foldsAt(frame, data);
  const thickness = data.base * data.ratio ** folds;

  /**
   * ONE PROJECTION, AND EVERYTHING GOES THROUGH IT.
   *
   * The world is measured in millimetres of ALTITUDE above the table. The
   * camera shows a slice of it: the ground at 72% of the frame, the top of the
   * stack at 34%. Both of those are constants, so the stack always occupies the
   * same band — it is the subject, and a subject that drifts out of frame is a
   * subject the shot has lost.
   *
   * Everything else divides. An object 1.75m tall is 1.75m of that slice, and
   * when the slice is 700km deep it is a pixel. Nothing is keyframed; the
   * scales are honest because they are arithmetic.
   */
  const span = thickness * 2.6;
  const groundY = height * 0.72;
  const y = (mm: number) => groundY - (mm / span) * height;
  const onScreen = (mm: number) => (mm / span) * height;
  const column = groundY - y(thickness);

  const opening = interpolate(frame, [0, 26], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const closing = interpolate(frame, [data.end - 70, data.end - 46], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const hudIn = interpolate(frame, [22, 40], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}) * (1 - closing);

  /**
   * SPACE ARRIVES WHEN THE ATMOSPHERE IS PASSED, and it arrives by the ground
   * leaving rather than by a cut. Above a hundred kilometres there is no ground
   * to stand on, so the horizon line and the haze go — and because it happens
   * over two seconds of continuous move, the viewer registers LEAVING rather
   * than a change of scene.
   */
  const inSpace = interpolate(folds, [28, 32], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const closestIndex = WORLD.reduce(
    (best, object, index) =>
      Math.abs(Math.log2(object.mm / thickness)) < Math.abs(Math.log2(WORLD[best].mm / thickness)) ? index : best,
    0,
  );

  return (
    <AbsoluteFill style={{backgroundColor: '#04070e', overflow: 'hidden'}}>
      {/* SKY. Blue while there is air, black once there is not. */}
      {/* A LIT HORIZON, and it is not decoration.
          Every object on the ladder is a dark silhouette, and a dark silhouette
          on a dark sky is a smudge — the first pass had a hand, a house and a
          skyline on screen that could not be told apart from the background.
          Backlighting them is the oldest fix there is and the only one that
          costs nothing: the shapes read as shapes, and the frame gains a
          direction of light it did not have. */}
      <AbsoluteFill
        style={{
          // The warm band has to sit just ABOVE the ground line. The first pass
          // put it at 84-100% of the frame, which is underneath the ground
          // plane — so the whole reason for lighting the horizon was painted
          // and then covered up, and every silhouette stayed a smudge.
          background:
            'linear-gradient(#050b18 0%, #0b2547 30%, #1d4a72 52%, #8a5f3c 66%, #f0b070 71%, #6b4326 73%, #12161d 100%)',
          opacity: 1 - inSpace,
        }}
      />
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 70% 26% at 70% ${(groundY / height) * 100 - 1}%, rgba(255,205,130,0.9) 0%, rgba(255,150,70,0.28) 34%, rgba(255,140,60,0) 70%)`,
          opacity: 1 - inSpace,
        }}
      />
      <AbsoluteFill style={{background: '#04070e', opacity: inSpace}} />
      <Stars count={150} drift={folds * 0.02} seed="zoom" opacity={inSpace} />

      {/* THE LADDER. Only the two or three objects whose size lands inside the
          frame are mounted at all: everything else is a div the browser would
          lay out, scale and clip for nothing, on every frame of the render. */}
      {/* ONE NAME AT A TIME. Three objects are on screen at once for most of the
          reel, and drawing all three labels stacked them into an unreadable
          heap at the same y. The one being named is the one whose size the
          stack is closest to right now. */}
      {WORLD.map((object, index) => {
        const h = onScreen(object.mm);
        // ONCE A THING IS BIGGER THAN THE FRAME IT STOPS BEING THAT THING.
        // A house at four times frame height is two lit windows and a diagonal
        // — the viewer sees abstract shapes, not a house, and the ladder loses
        // the rung it was meant to gain. It leaves before it stops reading.
        if (h < height * 0.02 || h > height * 2.2) return null;
        const w = h / object.aspect;
        const isEarth = object.mm > 1e9;

        // How far through its own visit this object is, for its label. Each one
        // is on screen for about six doublings; the label opens on arrival and
        // is gone before the next thing turns up.
        const progress = interpolate(Math.log2(thickness / (object.mm / 3)), [0, 5.4], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });

        return (
          <React.Fragment key={object.label}>
            <div
              style={{
                position: 'absolute',
                left: '68%',
                bottom: height - groundY,
                width: w,
                height: h,
                transform: 'translateX(-50%)',
                opacity:
                  interpolate(h, [height * 0.02, height * 0.05], [0, 1], {extrapolateRight: 'clamp'}) *
                  interpolate(h, [height * 1.6, height * 2.2], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}),
                filter: isEarth ? 'drop-shadow(0 0 40px rgba(80,170,255,0.45))' : undefined,
              }}
            >
              {object.draw(`o${index}`)}
            </div>
            {closestIndex === index ? <Label text={object.label} progress={progress} y={height * 0.795} /> : null}
          </React.Fragment>
        );
      })}

      {/* THE MOON IS AT ITS DISTANCE, NOT AT ITS SIZE.
          Everything on the ladder gets overtaken; this one is 384,400 km AWAY,
          and the payoff of the piece is the column arriving at it. Drawn at
          that altitude, so it comes into frame from above exactly as the stack
          gets long enough to reach — at fold forty-two and not one earlier. */}
      {(() => {
        const d = onScreen(MOON.diameter);
        const cy = y(MOON.altitude);
        if (cy > height * 1.4 || d < 3) return null;
        return (
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: cy,
              width: d,
              height: d,
              transform: 'translate(-50%, -50%)',
              filter: 'drop-shadow(0 0 60px rgba(255,244,214,0.4))',
            }}
          >
            {MOON.draw('moon')}
          </div>
        );
      })()}

      {/* GROUND — a line for things to stand on, gone once there is no ground. */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: groundY,
          height: height - groundY,
          background: 'linear-gradient(#0a121d 0%, #050a12 100%)',
          opacity: 1 - inSpace,
          boxShadow: '0 -1px 0 rgba(140,180,220,0.28)',
        }}
      />

      {/* THE STACK, dead centre, always the same height on screen. */}
      <div
        style={{
          position: 'absolute',
          left: '32%',
          bottom: height - groundY,
          transform: 'translateX(-50%)',
          opacity: 1 - closing,
          zIndex: 2,
        }}
      >
        <Stack folds={folds} height={column} width={Math.max(5, height * 0.052)} />
      </div>

      <Hud folds={folds} data={data} opacity={hudIn} />

      {opening > 0.01 ? (
        <AbsoluteFill style={{backgroundColor: '#04070e', opacity: opening}}>
          <Card {...data.title} progress={interpolate(frame, [0, 26], [0, 1])} colour={PALETTE.hot} />
        </AbsoluteFill>
      ) : null}
      {closing > 0.01 ? (
        <AbsoluteFill style={{backgroundColor: '#04070e', opacity: closing}}>
          <Card
            {...data.close}
            progress={interpolate(frame, [data.end - 62, data.end - 20], [0, 1], {extrapolateRight: 'clamp'})}
            colour={PALETTE.danger}
          />
        </AbsoluteFill>
      ) : null}

      {data.score ? <Audio src={staticFile(data.score)} volume={0.85} /> : null}
      <Look grain={0.2} vignette={0.5} />
    </AbsoluteFill>
  );
};
