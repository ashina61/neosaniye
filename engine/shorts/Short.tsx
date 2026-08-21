import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Easing,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {Aberrate, Look, PALETTE, Stars, hash01, measure, ramp, shake, thickness} from './lib';

/**
 * "FOLD A SHEET OF PAPER 42 TIMES AND YOU REACH THE MOON."
 *
 * A short built the way a short should be: every frame drawn, because the
 * subject is a NUMBER. There is no photograph of exponential growth, and a
 * stock picture of a piece of paper would say less than a bar that doubles in
 * front of you.
 *
 * The shape is the one that holds on a phone, and it is not an accident:
 *
 *   HOOK      the claim, hard in, no fade, under two seconds
 *   TURN      why it feels wrong — the eye is shown the two curves
 *   BUILD     the number climbs, and the climbing IS the content
 *   PAYOFF    the pull-back that makes the number mean something
 *   TWIST     the thing that sends it to the comments
 *
 * Everything is cut to the measured narration in `audio/vo.json`: the words on
 * screen and the pictures under them come off ONE clock, so nothing can drift.
 */

export type Cue = {text: string; from: number; to: number; line?: number};
export type ShortData = {audio?: string; bed?: string; bedGain?: number; marks: number[]; words: Cue[]};

const SAFE_BOTTOM = 0.22;

/* ------------------------------------------------------------------ TYPE - */

const Display: React.FC<{
  children: React.ReactNode;
  size: number;
  colour?: string;
  weight?: number;
  tracking?: string;
}> = ({children, size, colour = PALETTE.paper, weight = 900, tracking = '-0.03em'}) => (
  <div
    style={{
      fontFamily: '"Archivo", "Helvetica Neue", Arial, sans-serif',
      fontWeight: weight,
      fontSize: size,
      color: colour,
      letterSpacing: tracking,
      lineHeight: 0.94,
      textAlign: 'center',
      textTransform: 'uppercase',
    }}
  >
    {children}
  </div>
);

/* ------------------------------------------------------------------ HOOK -- */

/**
 * TWO SECONDS TO EARN THE REST. No fade: a short that opens by fading in has
 * spent the half second the viewer uses to decide, on nothing.
 */
const Hook: React.FC<{length: number}> = ({length}) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();

  const land = spring({frame, fps, config: {damping: 11, mass: 0.7}, durationInFrames: 22});
  const s = shake(frame, 8, 22);
  const bloom = interpolate(frame, [8, 20], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const push = interpolate(frame, [0, length], [1.0, 1.12], {extrapolateRight: 'clamp'});
  const second = spring({frame: frame - 26, fps, config: {damping: 13}, durationInFrames: 18});

  return (
    <AbsoluteFill style={{backgroundColor: PALETTE.ink}}>
      <Stars count={110} drift={frame * 0.004} seed="hook" />
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at 50% 42%, rgba(255,210,63,${0.16 + bloom * 0.5}) 0%, rgba(255,210,63,0) 58%)`,
        }}
      />

      <AbsoluteFill
        style={{
          justifyContent: 'center',
          alignItems: 'center',
          transform: `translate(${s.x}px, ${s.y}px) scale(${push})`,
        }}
      >
        <Aberrate amount={bloom * 9}>
          <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', gap: height * 0.012}}>
            <div style={{opacity: interpolate(land, [0, 0.4], [0, 1]), transform: `translateY(${(1 - land) * 40}px)`}}>
              <Display size={width * 0.088} colour="rgba(244,241,232,0.62)" weight={800} tracking="0.16em">
                bir kağıdı
              </Display>
            </div>
            <div style={{transform: `scale(${0.6 + land * 0.4})`, opacity: land}}>
              <Display size={width * 0.34} colour={PALETTE.hot}>
                42
              </Display>
            </div>
            <div style={{opacity: interpolate(land, [0.3, 0.8], [0, 1], {extrapolateRight: 'clamp'})}}>
              <Display size={width * 0.105} weight={800} tracking="0.06em">
                kez katla
              </Display>
            </div>

            {/* The payoff line arrives a beat LATER, on its own spring. Landing
                both at once makes one statement; landing the second late makes
                the first one a set-up and the second one a punch. */}
            <div
              style={{
                marginTop: height * 0.03,
                opacity: second,
                transform: `translateY(${(1 - second) * 26}px) scale(${0.9 + second * 0.1})`,
              }}
            >
              <Display size={width * 0.125} colour={PALETTE.cool} tracking="0.02em">
                ay&apos;a çıkarsın
              </Display>
            </div>
          </AbsoluteFill>
        </Aberrate>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ TURN -- */

/**
 * WHY IT FEELS WRONG, SHOWN RATHER THAN SAID.
 *
 * Two paths drawing themselves with `stroke-dasharray`: addition walks up the
 * frame, doubling leaves it. The straight line is drawn first and gets to look
 * reasonable for a second — the joke only works if the eye believes it.
 */
const Turn: React.FC<{length: number}> = ({length}) => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();

  const W = width;
  const H = height * 0.52;
  const points = 60;
  const line = (fn: (t: number) => number) =>
    Array.from({length: points + 1}, (_, i) => {
      const t = i / points;
      return `${t * W * 0.86 + W * 0.07},${H - Math.min(1, fn(t)) * H * 0.86 + height * 0.06}`;
    }).join(' ');

  const linear = line((t) => t * 0.42);
  // The exponent is set so the curve LEAVES the frame rather than
  // flattening near the top: the point of the shot is that it does not stop,
  // and a curve that eases into a ceiling says the opposite.
  const expo = line((t) => (2 ** (t * 11) - 1) / 900);

  const drawA = ramp(frame, 4, 34);
  const drawB = ramp(frame, 24, 62);
  const LEN = 3200;

  return (
    <AbsoluteFill style={{backgroundColor: PALETTE.ink}}>
      <Stars count={50} seed="turn" opacity={0.5} />
      <AbsoluteFill style={{justifyContent: 'center'}}>
        <svg width={W} height={H + height * 0.1} style={{overflow: 'visible'}}>
          {/* A grid so the curves have something to be measured against. */}
          {Array.from({length: 6}, (_, i) => (
            <line
              key={i}
              x1={W * 0.07}
              x2={W * 0.93}
              y1={height * 0.06 + (H * i) / 5}
              y2={height * 0.06 + (H * i) / 5}
              stroke="rgba(244,241,232,0.09)"
              strokeWidth={2}
            />
          ))}
          <polyline
            points={linear}
            fill="none"
            stroke="rgba(244,241,232,0.5)"
            strokeWidth={7}
            strokeLinecap="round"
            strokeDasharray={LEN}
            strokeDashoffset={LEN * (1 - drawA)}
          />
          <polyline
            points={expo}
            fill="none"
            stroke={PALETTE.hot}
            strokeWidth={13}
            strokeLinecap="round"
            strokeDasharray={LEN}
            strokeDashoffset={LEN * (1 - drawB)}
            style={{filter: `drop-shadow(0 0 ${18 * drawB}px rgba(255,210,63,0.75))`}}
          />
        </svg>
      </AbsoluteFill>

      <AbsoluteFill style={{justifyContent: 'flex-start', alignItems: 'center', paddingTop: height * 0.07, gap: 10}}>
        <div style={{opacity: ramp(frame, 6, 18)}}>
          <Display size={width * 0.062} colour="rgba(244,241,232,0.55)" weight={800} tracking="0.2em">
            beynin toplar
          </Display>
        </div>
        <div style={{opacity: ramp(frame, 30, 44), transform: `scale(${0.9 + ramp(frame, 30, 44) * 0.1})`}}>
          <Display size={width * 0.1} colour={PALETTE.hot} tracking="0.04em">
            katlamak çarpar
          </Display>
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{opacity: interpolate(frame, [length - 10, length], [0, 1], {extrapolateLeft: 'clamp'})}} />
    </AbsoluteFill>
  );
};

/* ----------------------------------------------------------------- PAPER -- */

/**
 * THE SHEET, FOLDING IN 3D.
 *
 * `perspective` plus a `rotateX` on a half that pivots at its own edge — the
 * cheapest real fold there is, and it beats any drawing of one because the
 * shading changes with the angle the way a fold's does.
 */
const Paper: React.FC<{length: number}> = ({length}) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();

  const sheetW = width * 0.56;
  const sheetH = sheetW * 1.38;

  // Three folds, each a spring so it snaps rather than slides.
  const folds = [0, 1, 2].map((i) =>
    spring({frame: frame - (18 + i * 22), fps, config: {damping: 14, mass: 0.6}, durationInFrames: 16}),
  );
  const stack = folds.reduce((sum, f) => sum + f, 0);
  const s = folds.map((f, i) => shake(frame, 18 + i * 22 + 12, 6)).reduce((a, b) => ({x: a.x + b.x, y: a.y + b.y}));

  return (
    <AbsoluteFill style={{backgroundColor: PALETTE.ink}}>
      <Stars count={40} seed="paper" opacity={0.35} />
      <AbsoluteFill
        style={{
          justifyContent: 'center',
          alignItems: 'center',
          perspective: 1400,
          transform: `translate(${s.x}px, ${s.y + height * 0.04}px) scale(${1 + stack * 0.04})`,
        }}
      >
        <div style={{position: 'relative', width: sheetW, height: sheetH, transformStyle: 'preserve-3d'}}>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: `linear-gradient(158deg, ${PALETTE.paper} 0%, #d9d4c4 100%)`,
              boxShadow: '0 40px 90px rgba(0,0,0,0.6)',
            }}
          />
          {folds.map((f, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: 0,
                height: sheetH / 2 ** (i + 1),
                transformOrigin: 'bottom center',
                transform: `rotateX(${-180 * f}deg) translateZ(${i * 2}px)`,
                background: `linear-gradient(${158 + i * 24}deg, #efeadb 0%, #c8c2b0 100%)`,
                boxShadow: `0 ${18 * f}px ${30 * f}px rgba(0,0,0,${0.5 * f})`,
                backfaceVisibility: 'hidden',
              }}
            />
          ))}
        </div>
      </AbsoluteFill>

      {/* The count and the thickness, kept together — a number without its unit
          is a fragment, and the unit is the whole point of this shot.
          AT THE TOP, because the bottom 22% belongs to the caption and a hero
          number sharing a band with burnt-in words is two things asking to be
          read at once. */}
      <AbsoluteFill style={{justifyContent: 'flex-start', alignItems: 'center', paddingTop: height * 0.09}}>
        <div style={{display: 'flex', alignItems: 'baseline', gap: width * 0.026}}>
          <Display size={width * 0.075} colour="rgba(244,241,232,0.5)" weight={800} tracking="0.14em">
            {Math.min(3, Math.round(stack))} kat
          </Display>
          <Display size={width * 0.15} colour={PALETTE.hot}>
            {measure(thickness(Math.min(3, Math.round(stack)))).value}
          </Display>
          <Display size={width * 0.07} colour={PALETTE.hot} weight={800}>
            {measure(thickness(Math.min(3, Math.round(stack)))).unit}
          </Display>
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{opacity: interpolate(frame, [length - 8, length], [0, 1], {extrapolateLeft: 'clamp'})}} />
    </AbsoluteFill>
  );
};

/* ----------------------------------------------------------------- CLIMB -- */

/**
 * THE NUMBER CLIMBING — the whole reason this subject works.
 *
 * A counter that arrives at its answer says the answer. A counter that CLIMBS
 * to it makes the size felt, and the feeling is the content. It eases out, so
 * most of the distance goes early and the last stretch crawls: a linear count
 * reads as a clock rather than as a sum.
 */
const Climb: React.FC<{from: number; to: number; length: number; marks: {at: number; label: string}[]}> = ({
  from,
  to,
  length,
  marks,
}) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();

  /**
   * THE COUNTER LANDS ON THE NUMBER WHILE THE NARRATOR IS SAYING IT.
   *
   * Climbing across the whole scene put the counter at 18 folds while the voice
   * said "on katlamada" — and on a video whose subject is arithmetic, a figure
   * that disagrees with the sentence under it is the one mistake that costs
   * something. So the climb finishes at 70% and HOLDS: the last third of every
   * line is spoken over the figure it names.
   */
  const t = interpolate(frame, [6, length * 0.7], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  const folds = from + (to - from) * t;
  const shown = Math.round(folds);
  /**
   * THE FIGURE IS THE ONE THE LABEL NAMES.
   *
   * Reading the thickness off the FRACTIONAL fold count while rounding the
   * label put "30 KAT" over "96 km" — the thickness of 29.6 folds. A viewer who
   * checks the arithmetic finds it wrong, and on a video whose whole subject is
   * arithmetic that is the only mistake that actually costs anything.
   */
  const {value, unit} = measure(thickness(shown));

  // The bar is LOG height, because a linear bar for 2^42 is a flat line for
  // forty frames and then a wall. What the eye should feel is steady climb.
  const barH = (folds / 42) * height * 0.46;

  /**
   * A MILESTONE STAYS UP ONCE IT IS PASSED.
   *
   * Showing it only while the counter reads exactly that number gives it a
   * window of two or three frames near the end of an eased climb — a chip that
   * flickers and is gone before it can be read. Passed is passed: the most
   * recent one holds the screen until the next arrives.
   */
  const passed = marks.filter((m) => shown >= m.at);
  const hit = passed.length ? passed[passed.length - 1] : null;
  const hitAt = hit ? interpolate(hit.at, [from, to], [6, length * 0.7], {extrapolateLeft: 'clamp'}) : 0;
  const hitSpring = spring({frame: frame - hitAt, fps, config: {damping: 12}, durationInFrames: 14});

  return (
    <AbsoluteFill style={{backgroundColor: PALETTE.ink}}>
      <Stars count={60} drift={t * 2.4} seed="climb" opacity={0.4 + t * 0.6} />

      {/* THE BAR — one rectangle, glowing harder the taller it gets. */}
      <AbsoluteFill style={{justifyContent: 'flex-end', alignItems: 'center', paddingBottom: height * (SAFE_BOTTOM + 0.09)}}>
        <div
          style={{
            width: width * 0.2,
            height: barH * 0.78,
            borderRadius: width * 0.02,
            background: `linear-gradient(to top, ${PALETTE.hot} 0%, #ff8a3d 100%)`,
            boxShadow: `0 0 ${40 + t * 90}px rgba(255,140,60,${0.35 + t * 0.5})`,
          }}
        />
      </AbsoluteFill>

      {/* THE FIGURE — tabular figures so the digits do not jitter sideways as
          they change, which is the difference between a counter and a mess. */}
      <AbsoluteFill style={{justifyContent: 'flex-start', alignItems: 'center', paddingTop: height * 0.14, gap: 6}}>
        <Display size={width * 0.058} colour="rgba(244,241,232,0.5)" weight={800} tracking="0.22em">
          {shown} kat
        </Display>
        <div style={{display: 'flex', alignItems: 'baseline', gap: width * 0.022, fontVariantNumeric: 'tabular-nums'}}>
          <Display size={width * 0.185} colour={PALETTE.paper}>
            {value}
          </Display>
          <Display size={width * 0.08} colour={PALETTE.hot} weight={800}>
            {unit}
          </Display>
        </div>
        {hit ? (
          <div style={{marginTop: height * 0.012, opacity: hitSpring, transform: `scale(${0.8 + hitSpring * 0.2})`}}>
            <div
              style={{
                padding: `${height * 0.008}px ${width * 0.04}px`,
                borderRadius: 999,
                background: PALETTE.cool,
              }}
            >
              <Display size={width * 0.052} colour={PALETTE.ink} weight={900} tracking="0.06em">
                {hit.label}
              </Display>
            </div>
          </div>
        ) : null}
      </AbsoluteFill>
      <Look grain={0.22} vignette={0.5} />
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ MOON -- */

/**
 * THE PULL-BACK. The number stops being a number when there is something next
 * to it — so the frame opens out until the Earth is a curve at the bottom and
 * the Moon is a disc at the top, with the distance drawn between them.
 */
const Moon: React.FC<{length: number}> = ({length}) => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();

  const out = interpolate(frame, [0, length * 0.7], [0, 1], {
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  const arc = ramp(frame, 14, length * 0.8);
  const moonIn = spring({frame: frame - 10, fps: 30, config: {damping: 15}, durationInFrames: 26});

  /**
   * THE EARTH HAS TO BE IN SHOT.
   *
   * A number is not a distance until there is something at both ends of it.
   * Pulled back far enough for the Moon to be a disc, the first pass had the
   * Earth entirely below the frame — so the dashed line ran from nothing to
   * somewhere and the 440.000 was a caption rather than a measurement. The
   * curve stays on screen: it is the other end.
   */
  const earthR = width * (2.2 - out * 1.1);
  const earthY = height * 0.72 + earthR;

  return (
    <AbsoluteFill style={{backgroundColor: '#03050b'}}>
      <Stars count={140} drift={out * 3} seed="moon" />

      <svg width={width} height={height} style={{position: 'absolute'}}>
        <defs>
          <radialGradient id="earth" cx="50%" cy="18%">
            <stop offset="0%" stopColor="#2f6fb5" />
            <stop offset="70%" stopColor="#123a68" />
            <stop offset="100%" stopColor="#05101f" />
          </radialGradient>
          <radialGradient id="moon" cx="38%" cy="32%">
            <stop offset="0%" stopColor="#fbf7ea" />
            <stop offset="72%" stopColor="#cfc7b4" />
            <stop offset="100%" stopColor="#6d6759" />
          </radialGradient>
        </defs>

        <circle cx={width / 2} cy={earthY} r={earthR} fill="url(#earth)" />
        <circle cx={width / 2} cy={earthY} r={earthR} fill="none" stroke="rgba(120,190,255,0.5)" strokeWidth={4} />

        {/* THE DISTANCE, DRAWING ITSELF. A dashed line that appears is a
            graphic; one that draws is a measurement being taken. */}
        <line
          x1={width / 2}
          y1={earthY - earthR}
          x2={width / 2}
          y2={earthY - earthR - (earthY - earthR - height * 0.26) * arc}
          stroke={PALETTE.hot}
          strokeWidth={5}
          strokeDasharray="16 14"
          opacity={0.9}
        />

        <g transform={`translate(${width / 2}, ${height * 0.185}) scale(${0.4 + moonIn * 0.6})`} opacity={moonIn}>
          <circle r={width * 0.225} fill="url(#moon)" />
          {Array.from({length: 12}, (_, i) => (
            <circle
              key={i}
              cx={(hash01('crater', i) - 0.5) * width * 0.26}
              cy={(hash01('crater', i + 40) - 0.5) * width * 0.26}
              r={width * (0.012 + hash01('crater', i + 80) * 0.026)}
              fill="rgba(90,84,72,0.42)"
            />
          ))}
        </g>
      </svg>

      <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', paddingTop: height * 0.14}}>
        <div style={{opacity: ramp(frame, 26, 44), transform: `scale(${0.88 + ramp(frame, 26, 44) * 0.12})`}}>
          <Display size={width * 0.155} colour={PALETTE.hot}>
            440.000
          </Display>
          <div style={{height: 8}} />
          <Display size={width * 0.06} colour={PALETTE.paper} weight={800} tracking="0.28em">
            kilometre
          </Display>
        </div>
      </AbsoluteFill>
      <Look grain={0.24} vignette={0.6} />
    </AbsoluteFill>
  );
};

/* ----------------------------------------------------------------- TWIST -- */

/**
 * THE THING THAT SENDS IT TO THE COMMENTS.
 *
 * A short that ends on its own payoff is finished; one that ends on a
 * correction is an argument, and an argument is a reply. Hard cut to black,
 * no easing in — the change of register IS the joke.
 */
const Twist: React.FC<{length: number}> = ({length}) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();

  const but = spring({frame, fps, config: {damping: 12, mass: 0.6}, durationInFrames: 14});
  const stampIn = spring({frame: frame - 22, fps, config: {damping: 9, mass: 0.8}, durationInFrames: 18});
  const s = shake(frame, 24, 18);
  const fade = interpolate(frame, [length - 14, length], [1, 0], {extrapolateLeft: 'clamp'});

  return (
    <AbsoluteFill style={{backgroundColor: '#000', opacity: fade}}>
      <AbsoluteFill
        style={{
          justifyContent: 'center',
          alignItems: 'center',
          gap: height * 0.02,
          transform: `translate(${s.x}px, ${s.y}px)`,
        }}
      >
        <div style={{opacity: but, transform: `translateY(${(1 - but) * 30}px)`}}>
          <Display size={width * 0.09} colour="rgba(244,241,232,0.6)" weight={800} tracking="0.2em">
            ama katlayamazsın
          </Display>
        </div>

        <div
          style={{
            marginTop: height * 0.02,
            opacity: stampIn,
            transform: `scale(${1.7 - stampIn * 0.7}) rotate(${-7 + stampIn * 4}deg)`,
          }}
        >
          <div
            style={{
              border: `${width * 0.014}px solid ${PALETTE.danger}`,
              borderRadius: width * 0.03,
              padding: `${height * 0.016}px ${width * 0.06}px`,
            }}
          >
            <Display size={width * 0.2} colour={PALETTE.danger}>
              12
            </Display>
          </div>
        </div>

        <div style={{marginTop: height * 0.018, opacity: ramp(frame, 40, 54)}}>
          <Display size={width * 0.058} colour="rgba(244,241,232,0.55)" weight={800} tracking="0.18em">
            dünya rekoru
          </Display>
        </div>
      </AbsoluteFill>
      <Look grain={0.3} vignette={0.7} />
    </AbsoluteFill>
  );
};

/* -------------------------------------------------------------- CAPTIONS -- */

/**
 * THE NARRATION, BURNT IN, WITH THE SPOKEN WORD POPPING.
 *
 * The colour change marks the word; the SCALE BUMP says it. That three-frame
 * 1.00 → 1.09 → 1.00 is the whole difference between "a video with subtitles"
 * and "a video written word by word", and it is the cheapest thing in here.
 *
 * Sits above the platform's own furniture: the bottom 18% of a Short is
 * covered by the caption, the handle and the sound label, so anything below
 * 22% is a caption the viewer never reads.
 */
const Captions: React.FC<{words: Cue[]; after?: number}> = ({words, after = 0}) => {
  const frame = useCurrentFrame();
  const {width, height, fps} = useVideoConfig();

  /**
   * HELD BACK BY A FRAME NUMBER, NOT BY A `<Sequence>`.
   *
   * Wrapping this in a Sequence to keep it off the hook shifted its own clock:
   * inside a Sequence `useCurrentFrame()` counts from the Sequence's start, so
   * every cue was looked up one hook-length early and the captions ran four
   * seconds behind their pictures for the whole reel. The cues are in REEL
   * frames; the component that reads them has to be too.
   */
  const index = frame < after ? -1 : words.findIndex((w) => frame >= w.from && frame < w.to);
  if (index < 0) return null;

  const start = Math.max(0, index - 4);
  const phrase: Cue[] = [];
  for (let i = start; i <= index; i += 1) {
    // The line index is CARRIED, not inferred from the gap: this narrator
    // leaves eleven frames between sentences and any gap threshold loose
    // enough to survive a fast reading also runs two sentences together.
    if (i > start && words[i].line !== words[i - 1].line) phrase.length = 0;
    phrase.push(words[i]);
  }

  const pop = spring({frame: frame - words[index].from, fps, config: {damping: 9, mass: 0.4}, durationInFrames: 9});
  const size = width * 0.068;

  const body = (
    <div
      style={{
        maxWidth: width * 0.84,
        textAlign: 'center',
        fontFamily: '"Archivo", "Helvetica Neue", Arial, sans-serif',
        fontWeight: 900,
        fontSize: size,
        lineHeight: 1.14,
        letterSpacing: '-0.012em',
        textTransform: 'uppercase',
      }}
    >
      {phrase.map((word, i) => {
        const live = i === phrase.length - 1;
        return (
          <span
            key={`${word.text}-${i}`}
            style={{
              color: live ? PALETTE.hot : '#ffffff',
              display: 'inline-block',
              transform: live ? `scale(${1 + pop * 0.09})` : undefined,
            }}
          >
            {word.text}
            {i < phrase.length - 1 ? ' ' : ''}
          </span>
        );
      })}
    </div>
  );

  const layer = (style: React.CSSProperties) => (
    <AbsoluteFill
      style={{justifyContent: 'flex-end', alignItems: 'center', paddingBottom: height * SAFE_BOTTOM, ...style}}
    >
      {body}
    </AbsoluteFill>
  );

  return (
    <AbsoluteFill>
      {layer({WebkitTextStroke: `${Math.round(size * 0.2)}px #000`})}
      {layer({})}
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ REEL -- */

export const Short: React.FC<{data: ShortData}> = ({data}) => {
  const [m0, m1, m2, m3, m4, m5, m6, end] = data.marks;

  const scene = (from: number, to: number, node: (length: number) => React.ReactNode) => (
    <Sequence from={from} durationInFrames={Math.max(1, to - from)}>
      {node(to - from)}
    </Sequence>
  );

  return (
    <AbsoluteFill style={{backgroundColor: PALETTE.ink}}>
      {data.audio ? <Audio src={staticFile(data.audio)} /> : null}
      {data.bed ? <Audio src={staticFile(data.bed)} volume={data.bedGain ?? 0.1} loop /> : null}

      {scene(m0, m1, (l) => <Hook length={l} />)}
      {scene(m1, m2, (l) => <Turn length={l} />)}
      {scene(m2, m3, (l) => <Paper length={l} />)}
      {scene(m3, m4, (l) => (
        <Climb from={3} to={20} length={l} marks={[{at: 10, label: '10 kat · bir el'}, {at: 20, label: '20 kat · gökdelen'}]} />
      ))}
      {scene(m4, m5, (l) => (
        <Climb from={20} to={30} length={l} marks={[{at: 30, label: '30 kat · uzay sınırı'}]} />
      ))}
      {scene(m5, m6, (l) => <Moon length={l} />)}
      {scene(m6, end, (l) => <Twist length={l} />)}

      {/* Outside every Sequence, like the narration it was measured against —
          EXCEPT over the hook, which sets the same sentence as display type.
          Running both puts the claim on screen twice in two sizes, and a first
          frame carrying two competing headlines is a first frame nobody
          finishes reading. */}
      <Captions words={data.words} after={m1} />
      <Look grain={0.16} vignette={0.3} />
    </AbsoluteFill>
  );
};
