import React from 'react';
import {useCurrentFrame, useVideoConfig} from 'remotion';
import {
  clipReveal,
  countTo,
  drawOn,
  posterizeTime,
  punch,
  springEntrance,
  stagger,
  tracking,
  wipeMask,
} from '../motion';

const SERIF = '"Playfair Display", "Iowan Old Style", Georgia, serif';
const SANS = '"Archivo", "Helvetica Neue", Arial, sans-serif';

/**
 * KINETIC TYPOGRAPHY — words as part of the picture, not a caption over it.
 *
 * What this replaces: `opacity: 0 → 1` on a whole line. That is not a text
 * animation, it is the absence of one, and a reel where every word arrives the
 * same way has no typography — it has subtitles.
 *
 * Two ideas do all the work here, and both are about ATTENTION rather than
 * about movement:
 *
 *   THE LINE ARRIVES IN PIECES. Words land one at a time, a few frames apart,
 *       so the eye reads them in the order they were written instead of taking
 *       the whole block in at once and looking away.
 *
 *   ONE WORD IS NOT LIKE THE OTHERS. "The stone weighs 1,000 tons" has one word
 *       in it that is the reason the sentence exists. It gets the colour, the
 *       size, the impact and the mark; everything else gets out of its way.
 *       A line where every word is emphasised has no emphasis, it has shouting.
 */
export type Reveal = 'rise' | 'wipe' | 'blur' | 'char' | 'punch';
export type EmphasisMark = 'none' | 'highlight' | 'underline' | 'box';

/** Strip punctuation so "1,000." matches an emphasis written "1,000". */
const bare = (word: string) => word.replace(/[^\p{L}\p{N}%$£€.,'-]/gu, '').replace(/[.,]$/, '').toLowerCase();

/**
 * WHICH WORDS ARE THE EMPHASIS.
 *
 * Returned as a set of indices rather than a match on each word, because an
 * emphasis is often a PHRASE — "fourteen hundred", "1,000 tons" — and matching
 * word by word would light up "hundred" in a line that also says "a hundred
 * miles earlier". The first run of consecutive words that spells the phrase
 * wins, and only the first.
 */
export function emphasisRange(words: string[], emphasis?: string): Set<number> {
  const out = new Set<number>();
  if (!emphasis) return out;
  const want = emphasis.trim().split(/\s+/).map(bare).filter(Boolean);
  if (!want.length) return out;
  const have = words.map(bare);
  for (let i = 0; i + want.length <= have.length; i += 1) {
    if (want.every((w, j) => have[i + j] === w)) {
      for (let j = 0; j < want.length; j += 1) out.add(i + j);
      return out;
    }
  }
  return out;
}

const Piece: React.FC<{
  text: string;
  at: number;
  reveal: Reveal;
  size: number;
  lift: number;
  children?: React.ReactNode;
}> = ({text, at, reveal, size, lift, children}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const stepped = posterizeTime(frame, fps, 12);
  const land = springEntrance(stepped, fps, {delay: at, stiffness: 58, mass: 0.9, damping: 14});

  // RISE — the word climbs out from behind a matte. The signature move, and the
  // reason it beats a fade: a fade says the word became visible, a rise says
  // the word ARRIVED. The box is taller than the glyphs so a descender is not
  // shaved off at rest, and the matte edge sits just below it.
  if (reveal === 'rise') {
    return (
      <span
        style={{
          display: 'inline-block',
          overflow: 'hidden',
          height: size * 1.24,
          verticalAlign: 'top',
        }}
      >
        <span
          style={{
            display: 'inline-block',
            lineHeight: `${size * 1.06}px`,
            transform: `translateY(${(1 - land) * 100}%)`,
          }}
        >
          {children ?? text}
        </span>
      </span>
    );
  }

  if (reveal === 'wipe') {
    const mask = wipeMask(land, 'up', 22);
    return (
      <span
        style={{
          display: 'inline-block',
          lineHeight: `${size * 1.06}px`,
          WebkitMaskImage: mask,
          maskImage: mask,
        }}
      >
        {children ?? text}
      </span>
    );
  }

  if (reveal === 'blur') {
    return (
      <span
        style={{
          display: 'inline-block',
          lineHeight: `${size * 1.06}px`,
          opacity: land,
          filter: land > 0.985 ? undefined : `blur(${(1 - land) * 16}px)`,
          transform: `translateY(${(1 - land) * lift}px)`,
        }}
      >
        {children ?? text}
      </span>
    );
  }

  if (reveal === 'punch') {
    return (
      <span
        style={{
          display: 'inline-block',
          lineHeight: `${size * 1.06}px`,
          opacity: Math.min(1, land * 3),
          transform: `scale(${land < 0.02 ? 0.84 : punch(stepped, at, {amount: 0.14, rise: 3, decay: 0.2})})`,
        }}
      >
        {children ?? text}
      </span>
    );
  }

  // CHAR — the word types itself in. Held back for short words: nine letters
  // staggered three frames apart is most of a second spent on one word, and a
  // caption cannot afford that more than once in a reel.
  return (
    <span style={{display: 'inline-block', lineHeight: `${size * 1.06}px`}}>
      {[...text].map((glyph, i) => {
        const letter = springEntrance(stepped, fps, {delay: at + i * 1.6, stiffness: 70, mass: 0.7});
        return (
          <span
            key={i}
            style={{
              display: 'inline-block',
              opacity: letter,
              transform: `translateY(${(1 - letter) * lift * 0.6}px)`,
            }}
          >
            {glyph === ' ' ? ' ' : glyph}
          </span>
        );
      })}
    </span>
  );
};

/**
 * THE MARK BEHIND THE WORD.
 *
 * Drawn, wiped on, and behind the type rather than over it — a highlighter is
 * under the ink, and a marker drawn on top of a word makes it harder to read,
 * which is the opposite of emphasis.
 */
const Mark: React.FC<{kind: EmphasisMark; at: number; colour: string; size: number}> = ({
  kind,
  at,
  colour,
  size,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const stepped = posterizeTime(frame, fps, 12);
  if (kind === 'none' || stepped < at) return null;

  // It lands a few frames AFTER the word, because a hand marks something it has
  // already read. Arriving together makes them one graphic.
  const on = drawOn(stepped, [at, at + 9]);
  const clip = clipReveal(on, 'left');

  if (kind === 'highlight') {
    return (
      <span
        style={{
          position: 'absolute',
          left: -size * 0.06,
          right: -size * 0.06,
          top: size * 0.16,
          bottom: size * 0.1,
          background: colour,
          opacity: 0.26,
          clipPath: clip,
          zIndex: -1,
        }}
      />
    );
  }

  if (kind === 'box') {
    return (
      <span
        style={{
          position: 'absolute',
          left: -size * 0.1,
          right: -size * 0.1,
          top: size * 0.06,
          bottom: size * 0.04,
          border: `${Math.max(3, size * 0.05)}px solid ${colour}`,
          clipPath: clip,
          zIndex: -1,
        }}
      />
    );
  }

  return (
    <span
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: size * 0.06,
        height: Math.max(4, size * 0.07),
        background: colour,
        clipPath: clip,
        zIndex: -1,
      }}
    />
  );
};

/**
 * ONE LINE, SET IN MOTION.
 *
 * The words arrive on their own beats; one of them is the emphasis and gets
 * treated as such. Everything is scene-relative, so a line can be moved in the
 * config without re-timing a single word.
 */
export const KineticLine: React.FC<{
  text: string;
  from?: number;
  every?: number;
  reveal?: Reveal;
  size: number;
  colour?: string;
  face?: 'serif' | 'sans';
  /** The word or phrase this line exists for. */
  emphasis?: string;
  emphasisColour?: string;
  emphasisMark?: EmphasisMark;
  /** Tracking settling in, in em. A line that arrives already set was dropped in. */
  settleTracking?: boolean;
}> = ({
  text,
  from = 0,
  every = 4,
  reveal = 'rise',
  size,
  colour = '#f6ead0',
  face = 'serif',
  emphasis,
  emphasisColour = '#ffcf3d',
  emphasisMark = 'none',
  settleTracking = false,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const stepped = posterizeTime(frame, fps, 12);

  const words = text.split(/\s+/).filter(Boolean);
  const lit = emphasisRange(words, emphasis);
  const track = settleTracking ? tracking(stepped, [from, from + 26], [0.1, -0.01]) : -0.01;

  return (
    <span style={{letterSpacing: `${track}em`}}>
      {words.map((word, i) => {
        const at = stagger(i, {from, every});
        const isLit = lit.has(i);
        // The mark spans the whole emphasis phrase, so only its first word draws
        // one and it is stretched over the rest by the wrapper below.
        const marks = isLit && !lit.has(i - 1);
        const wordSize = isLit ? size * 1.16 : size;
        return (
          <span
            key={i}
            style={{
              position: 'relative',
              display: 'inline-block',
              /**
               * THE EMPHASIS WORD NEEDS ROOM TO PUNCH INTO.
               *
               * It arrives with a scale hit, and a scale hit does not change
               * the layout — so the word grew 15% wider over the top of the
               * gap after it and the caption read "In 1901sponge divers". The
               * margin has to cover the overshoot, not the resting width.
               */
              marginRight: isLit ? wordSize * 0.34 : size * 0.24,
              marginLeft: isLit ? wordSize * 0.08 : 0,
              isolation: 'isolate',
              fontFamily: isLit || face === 'sans' ? SANS : SERIF,
              fontStyle: isLit || face === 'sans' ? 'normal' : 'italic',
              fontWeight: 900,
              fontSize: wordSize,
              color: isLit ? emphasisColour : colour,
              textTransform: isLit ? 'uppercase' : 'none',
              WebkitTextStroke: '1.5px rgba(10,8,5,0.5)',
              textShadow: '0 0 26px rgba(0,0,0,0.95), 0 6px 20px rgba(0,0,0,0.8)',
            }}
          >
            {marks ? <Mark kind={emphasisMark} at={at + 5} colour={emphasisColour} size={wordSize} /> : null}
            <Piece
              text={word}
              at={at}
              // The emphasis word PUNCHES whatever the rest of the line does.
              // Same entrance for the whole line is a line that arrives; a
              // different one on the word that matters is a line that lands.
              reveal={isLit && reveal !== 'char' ? 'punch' : reveal}
              size={wordSize}
              lift={size * 0.34}
            />
          </span>
        );
      })}
    </span>
  );
};

/**
 * A NUMBER THAT CLIMBS.
 *
 * The figure is the point of the shot, so it is not allowed to simply BE there:
 * it counts, and the counting is what makes the size of it felt. Tabular
 * figures, because a number whose glyphs change width wanders sideways while it
 * counts and reads as a bug.
 */
export const Counter: React.FC<{
  to: number;
  from?: number;
  start?: number;
  over?: number;
  size?: number;
  colour?: string;
  prefix?: string;
  suffix?: string;
  /** Thousands separators. Off for a year, on for a quantity. */
  grouped?: boolean;
}> = ({
  to,
  from = 0,
  start = 0,
  over = 40,
  size = 180,
  colour = '#ffcf3d',
  prefix = '',
  suffix = '',
  grouped = true,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const stepped = posterizeTime(frame, fps, 12);
  const value = Math.round(countTo(stepped, [start, start + over], to, from));
  // One small hit as it lands, so the count STOPS rather than just ceasing.
  const hit = punch(stepped, start + over, {amount: 0.09, rise: 2, decay: 0.2});

  return (
    <span
      style={{
        display: 'inline-block',
        fontFamily: SANS,
        fontWeight: 900,
        fontSize: size,
        letterSpacing: '-0.04em',
        fontVariantNumeric: 'tabular-nums',
        color: colour,
        transform: `scale(${hit})`,
        textShadow: '0 0 40px rgba(0,0,0,0.92)',
      }}
    >
      {prefix}
      {grouped ? value.toLocaleString('en-US') : String(value)}
      {suffix}
    </span>
  );
};
