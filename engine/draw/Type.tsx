import React from 'react';
import {AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {CLAMP, dampedSwing, holdKeyframes, posterizeTime, springEntrance, stagger} from '../motion';
import {KineticLine, type EmphasisMark, type Reveal} from './Kinetic';
import {slotState} from '../state.mjs';

const SERIF = '"Playfair Display", "Iowan Old Style", Georgia, serif';
const SANS = '"Archivo", "Helvetica Neue", Arial, sans-serif';

/**
 * A SIZE THAT FITS THE FRAME.
 *
 * Type set at a fixed size is fine until the word is long, and then it is
 * simply CUT OFF — "SEVENTY YEARS" rendered as "SEVENT", "100 MILLION" as
 * "100". Nothing anywhere reports it: the render succeeds, the tests pass, and
 * the reel ships with half a word on its closing card.
 *
 * The estimate is per glyph — heavy sans runs about 0.64 em — and it is
 * deliberately PESSIMISTIC. The web font may not have loaded, in which case the
 * fallback is wider; and being a little small is invisible, while being a
 * little large puts the last letter through the edge of the frame. The first
 * pass used 0.56 and "SEVENTY YEARS" came out with its final S on the border.
 */
export function fitSize(text: string, wanted: number, width: number, padding = 210): number {
  const chars = Math.max(1, text.length);
  return Math.max(28, Math.min(wanted, (width - padding) / (chars * 0.64)));
}

/**
 * A WORD STACK — the reference reel's real caption device.
 *
 * Not a subtitle. The line is broken into two or three fragments and they land
 * ONE AT A TIME, a few frames apart, stacked down the side of the frame. That
 * stagger is the whole difference between a caption and a cut: the eye reads
 * "closed a" / "1000" / "stores" as three beats arriving with the narration,
 * where the same words on one line would be read once and ignored.
 *
 * Then it FADES BACK rather than leaving, so the frame stays composed while the
 * picture takes over.
 */
export const WordStack: React.FC<{
  lines: string[];
  x?: number;
  y?: number;
  from?: number;
  every?: number;
  size?: number;
  align?: 'left' | 'right' | 'center';
  colour?: string;
  face?: 'serif' | 'sans';
  /** Frame at which the stack drops to `restOpacity` and lets the shot breathe. */
  recedeAt?: number;
  restOpacity?: number;
  /** Index of a line to set in the accent colour — the number, usually. */
  accent?: number;
  accentColour?: string;
  /**
   * HOW THE WORDS ARRIVE, and WHICH ONE MATTERS.
   *
   * The stack used to land whole lines with a slide, which is one step up from
   * a fade and several short of typography: "a lump of / corroded metal" and
   * "the stone weighs / 1,000 TONS" were given exactly the same treatment,
   * although one of them is the reason its shot exists.
   *
   * So the line arrives word by word, and the emphasis — a word or a phrase —
   * takes the accent colour, a size, a punch and a drawn mark. One per stack:
   * a reel that emphasises everything emphasises nothing.
   */
  reveal?: Reveal;
  emphasis?: string;
  emphasisMark?: EmphasisMark;
  /** Frames between WORDS inside a line. The gap between lines is `every`. */
  wordEvery?: number;
  /**
   * A SOFT GROUND UNDER THE WORDS, 0 to 1.
   *
   * A stroke and a drop shadow are enough over a dark plate and nowhere near
   * enough over a busy one: "German tanks crossed the Polish border" set over a
   * printed map of Poland is two kinds of small type fighting, and the caption
   * loses. So the words carry their own ground — a gradient panel behind the
   * block, densest at the text and gone by its edge, which reads as light
   * falling on the picture rather than as a box drawn on it.
   *
   * It is a fraction, not a switch: a shot with a dark empty corner wants 0.2,
   * a shot over a map wants 0.6, and the shot that lets the picture speak wants
   * none of it.
   */
  scrim?: number;
}> = ({
  lines,
  x = 84,
  y = 520,
  from = 0,
  every = 6,
  size = 96,
  align = 'left',
  colour = '#f6ead0',
  face = 'serif',
  recedeAt,
  restOpacity = 0.32,
  accent,
  accentColour = '#ffcf3d',
  reveal = 'rise',
  emphasis,
  emphasisMark = 'none',
  wordEvery = 3,
  scrim = 0,
}) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const stepped = posterizeTime(frame, fps, 12);

  /**
   * IT CANNOT START LEAVING BEFORE IT HAS FINISHED ARRIVING.
   *
   * `recedeAt` was set from the shot's length and the stagger from the words,
   * and nothing checked the two against each other. On a short shot the stack
   * began fading at frame 38 while its second line was still landing at 44 —
   * so the last line of the caption was never seen at full strength, and the
   * only sign of it was a half-faded word in a still nobody sampled.
   */
  const lastWord =
    stagger(Math.max(0, lines.length - 1), {from, every}) +
    wordEvery * Math.max(1, (lines[lines.length - 1] ?? '').split(/\s+/).filter(Boolean).length) +
    10;
  const rest = recedeAt === undefined ? undefined : Math.max(recedeAt, lastWord);
  const recede = rest === undefined ? 1 : interpolate(stepped, [rest, rest + 14], [1, restOpacity], CLAMP);

  /**
   * THE WORDS FIT THE FRAME, AND THE ENGINE GUARANTEES IT.
   *
   * Same law as a piece plate never covering the shot: the config promises
   * nothing, the engine enforces it. A caption set at 84px whose emphasis word
   * is then set at 1.16 of that delivered "THIRTY GEARS" with the S through the
   * right edge of the frame — and the render succeeded, the tests passed, and
   * the reel shipped with half a word missing. The same failure the title card
   * was fixed for, in the other text component.
   *
   * Two limits. The column is bounded so a long word wraps instead of leaving,
   * and the size comes down until the longest line fits inside that column at
   * the size the EMPHASIS will be set at, which is the size that overflows.
   */
  const column = Math.max(240, width - x - 110);
  const longest = lines.reduce((n, line) => Math.max(n, line.length), 0);
  // The estimate is inflated twice over on purpose: the emphasis word is set at
  // 1.16 of the size, and it also carries margins on both sides that a
  // per-character estimate knows nothing about. Being a little small is
  // invisible; being a little large puts the last letter through the edge.
  const fitted = Math.max(34, Math.min(size, fitSize('x'.repeat(Math.ceil(longest * 1.24)), size, column, 0)));

  // How tall the block will be, so the ground under it covers the words and
  // not the whole frame.
  const block = lines.length * fitted * 1.3;
  /**
   * AND IT SITS INSIDE THE SAFE AREA.
   *
   * A four-line stack placed three quarters of the way down runs its last line
   * off the bottom of the frame — which on a vertical short is also where the
   * platform draws its own caption and buttons. The block is pushed up until it
   * fits, rather than being allowed to leave.
   */
  const top = Math.max(96, Math.min(y, height - block - 150));

  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {scrim > 0 ? (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: Math.max(0, top - fitted * 0.7),
            height: block + fitted * 1.4,
            background:
              align === 'right'
                ? `linear-gradient(270deg, rgba(0,0,0,${scrim}) 0%, rgba(0,0,0,${scrim * 0.82}) 42%, transparent 88%)`
                : `linear-gradient(90deg, rgba(0,0,0,${scrim}) 0%, rgba(0,0,0,${scrim * 0.82}) 42%, transparent 88%)`,
            opacity: recede,
            // Feathered top and bottom, so it is light on the picture and not a
            // panel with two hard edges across it.
            WebkitMaskImage: 'linear-gradient(180deg, transparent, #000 22%, #000 78%, transparent)',
            maskImage: 'linear-gradient(180deg, transparent, #000 22%, #000 78%, transparent)',
          }}
        />
      ) : null}
      <div
        style={{
          position: 'absolute',
          left: align === 'right' ? undefined : x,
          right: align === 'right' ? x : undefined,
          top,
          maxWidth: column,
          textAlign: align,
          opacity: recede,
        }}
      >
        {lines.map((line, i) => {
          const at = stagger(i, {from, every});
          // The slot is held from the first frame. Collapsing an unarrived line
          // makes every line below it JUMP as each one lands, and a caption
          // that reflows while it is being read is worse than one that is late.
          if (stepped < at) return <div key={i} style={{height: fitted * 1.24}} />;
          return (
            <div key={i} style={{lineHeight: 1.02, marginBottom: fitted * 0.06}}>
              <KineticLine
                text={line}
                from={at}
                every={wordEvery}
                reveal={reveal}
                size={fitted}
                colour={colour}
                face={face}
                // A whole line named as the accent is the older, coarser way of
                // saying which part matters; it still works, and an explicit
                // emphasis phrase wins over it.
                emphasis={emphasis ?? (accent === i ? line : undefined)}
                emphasisColour={accentColour}
                emphasisMark={emphasisMark}
                settleTracking={i === 0}
              />
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/**
 * A TITLE SLATE — the hard typographic card that opens or closes a reel.
 *
 * Rules above and below, a date or a label in mono, the statement in heavy
 * sans. Carries a whole scene on its own, with no photograph at all.
 */
export const Slate: React.FC<{
  kicker?: string;
  title: string;
  footer?: string;
  /**
   * WHEN THE QUALIFIER ARRIVES.
   *
   * The footer used to fade up with the whole block, so a closing card had one
   * event in it: everything appeared, and then four seconds passed. Landing the
   * figure and THEN the sentence that qualifies it is two beats — "fourteen
   * hundred", pause, "years before anything like it" — which is how the line is
   * spoken and, until now, not how it was shown.
   */
  footerFrom?: number;
  from?: number;
  colour?: string;
  accent?: string;
  size?: number;
  /**
   * Fixed-width digits. Only for a title that CHANGES — a number counting up
   * shifts sideways on every frame as glyph widths change, and a title that
   * wanders while it counts reads as a bug rather than as a total.
   */
  tabular?: boolean;
  /**
   * Something to put WHERE THE TITLE GOES — a slot reel, usually.
   *
   * It has to be here rather than layered over the card, because a slate is a
   * layout: rules above and below, a kicker over, a footer under. Draw a second
   * centred thing on top of it and the number lands straight through the kicker
   * and the footer, which is exactly what the first version did.
   */
  titleNode?: React.ReactNode;
}> = ({
  kicker,
  title,
  footer,
  footerFrom,
  from = 0,
  colour = '#f6ead0',
  accent = '#ffcf3d',
  size = 118,
  tabular = false,
  titleNode,
}) => {
  const frame = useCurrentFrame();
  const {fps, width} = useVideoConfig();
  const stepped = posterizeTime(frame, fps, 12);
  const land = springEntrance(stepped, fps, {delay: from, stiffness: 46, mass: 1.05});
  /**
   * THE RULES ARE THE SHEET; THE WORDS LAND ON THEM.
   *
   * Law 30. A slate used to hold its whole block — rules included — behind the
   * title's spring, so every card in the channel opened on a bare field: black
   * for the four to twelve frames before `from`, and the reel's very FIRST
   * frame was one of them. The rules are not the statement, they are what the
   * statement is set between, so they draw from frame zero outward and the cut
   * lands on a composed frame with something already moving in it.
   */
  const rule = interpolate(stepped, [0, Math.max(10, from + 6)], [0, 1], CLAMP);
  const tail = footerFrom === undefined ? 1 : interpolate(stepped, [footerFrom, footerFrom + 10], [0, 1], CLAMP);

  return (
    <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', padding: '0 90px'}}>
      <div style={{width: '100%', textAlign: 'center'}}>
        {kicker ? (
          <div
            style={{
              fontFamily: '"Courier New", monospace',
              fontSize: 30,
              letterSpacing: '0.26em',
              color: accent,
              marginBottom: 34,
              textTransform: 'uppercase',
              opacity: land,
            }}
          >
            {kicker}
          </div>
        ) : null}
        <div style={{height: 3, background: accent, width: `${rule * 100}%`, margin: '0 auto 40px'}} />
        {titleNode ? <div style={{opacity: land}}>{titleNode}</div> : (
        <div
          style={{
            fontFamily: SANS,
            fontWeight: 900,
            fontSize: fitSize(title, size, width),
            lineHeight: 0.98,
            letterSpacing: '-0.035em',
            fontVariantNumeric: tabular ? 'tabular-nums' : undefined,
            color: colour,
            textTransform: 'uppercase',
            transform: `translateY(${(1 - land) * 22}px)`,
            opacity: land,
            textShadow: '0 0 34px rgba(0,0,0,0.9)',
          }}
        >
          {title}
        </div>
        )}
        <div style={{height: 3, background: accent, width: `${rule * 100}%`, margin: '40px auto 0'}} />
        {footer ? (
          <div
            style={{
              fontFamily: SERIF,
              fontStyle: 'italic',
              fontSize: 44,
              color: colour,
              opacity: 0.78 * tail,
              marginTop: 34,
              transform: `translateY(${(1 - tail) * 16}px)`,
            }}
          >
            {footer}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};

/**
 * A SLOT REEL — the number spins past and SLAMS to a stop.
 *
 * The other way a figure can arrive, and the sharper one. A counter climbing to
 * four hundred makes the size of it felt; a reel rattling through THOUSAND,
 * MILLION, BILLION and slamming onto the right one makes the CHOICE felt — it
 * says the number could have been anything and it turned out to be this. The
 * reference build uses it on "50 MILLION" for exactly that reason.
 *
 * The whole thing is one eased scroll: the column decelerates through the
 * decoy values and comes to rest on the real one, then takes one small bounce.
 * A reel that fades to its answer is not a slot machine, it is a dissolve — the
 * stop has to be a stop.
 */
export const Slot: React.FC<{
  value: string;
  reel?: string[];
  from?: number;
  spin?: number;
  size?: number;
  colour?: string;
}> = ({
  value,
  reel = ['THOUSAND', 'HUNDRED', 'MILLION', 'BILLION'],
  from = 0,
  spin = 26,
  size = 210,
  colour = '#ffcf3d',
}) => {
  const frame = useCurrentFrame();
  const {fps, width} = useVideoConfig();
  const stepped = posterizeTime(frame, fps, 12);

  // The decoys, then the answer. The reel stops on the last row.
  const rows = [...reel.filter((r) => r !== value), value];
  // Fit the LONGEST row, not each one. A reel whose type resizes as it scrolls
  // is a reel that wobbles; and the row that decides the size is whichever
  // decoy is widest, not the answer.
  const fitted = rows.reduce((smallest, row) => Math.min(smallest, fitSize(row, size, width)), size);
  const line = fitted * 1.34;

  /**
   * ONE VALUE READABLE AT A TIME — GUARANTEED, NOT TUNED.
   *
   * This was a continuous scroll, so between any two values both were half in
   * the window: two sliced words stacked between the slate's rules. The first
   * attempt at a fix put a soft mask over the window edges, which made the
   * broken state harder to see and left it broken.
   *
   * The mechanism itself is different now. A value ENTERS from below, holds
   * still for the half of its slice anybody actually reads, and LEAVES upward
   * before the next one starts arriving — a split-flap rather than an odometer.
   * `slotState` owns the arithmetic and the regression test asserts against the
   * same function the drawing calls, so the two cannot drift apart.
   */
  const settle =
    stepped <= from + spin
      ? 0
      : dampedSwing(stepped, {amplitude: fitted * 0.05, rate: 0.9, decay: 0.24, delay: from + spin});

  return (
    <div style={{height: line, overflow: 'hidden', position: 'relative'}}>
      {rows.map((row, i) => {
        const state = slotState(stepped, i, {from, spin, count: rows.length});
        // A row a whole line out of the window is not drawn at all. Leaving it
        // at zero opacity is the same picture with a compositing cost, and it
        // is also how a "hidden" element ends up visible after a later change.
        if (Math.abs(state.offset) >= 1) return null;
        return (
          <div
            key={`${row}-${i}`}
            style={{
              position: 'absolute',
              inset: 0,
              height: line,
              lineHeight: `${line}px`,
              transform: `translateY(${state.offset * line + (state.phase === 'settled' ? settle : 0)}px)`,
              // A REEL ROW IS ONE LINE. The window is one line tall and clips
              // what leaves it, so "SEVENTY YEARS" wrapped at the space and the
              // second word was cut away entirely — the card read "SEVENTY".
              whiteSpace: 'nowrap',
              fontFamily: SANS,
              fontWeight: 900,
              fontSize: fitted,
              letterSpacing: '-0.045em',
              fontVariantNumeric: 'tabular-nums',
              color: colour,
              textAlign: 'center',
              // The decoys are dimmer than the answer, so even the one readable
              // value says whether it is a candidate or the result.
              opacity: state.phase === 'settled' ? 1 : 0.62,
              textShadow: '0 0 40px rgba(0,0,0,0.92)',
            }}
          >
            {row}
          </div>
        );
      })}
    </div>
  );
};

/**
 * NEGATIVE FLICKER — the reel's punctuation mark.
 *
 * Two or three-frame bursts of inverted, hue-shifted frame. On hold keyframes,
 * never faded: the violence of it IS the instant switch. Used once, on the
 * hardest beat; used often, it is a strobe.
 */
export const Flicker: React.FC<{spans?: number[][]; hue?: number; children: React.ReactNode}> = ({
  spans = [],
  hue = 180,
  children,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const on = holdKeyframes(posterizeTime(frame, fps, 12), spans);
  return (
    <AbsoluteFill style={{filter: on ? `invert(1) hue-rotate(${hue}deg)` : undefined}}>{children}</AbsoluteFill>
  );
};
