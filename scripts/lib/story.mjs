/**
 * THE STORY BRAIN.
 *
 * Everything downstream of this file used to receive a sentence and a duration.
 * That is enough to make a shot and not nearly enough to make an EDIT, because
 * the two questions a cutting room asks first are never asked of a sentence:
 *
 *   WHAT KIND OF BEAT IS THIS?  A hook and a verdict are not the same object
 *       with different words in them. One has to arrest a scrolling thumb in
 *       under a second; the other has to land and be allowed to sit.
 *
 *   WHAT IS THE VIEWER MEANT TO NOTICE?  Not "what does the line say" — what
 *       does the eye have to find in the frame for the line to be true. That
 *       is the visual idea, and until it exists there is nothing for an asset
 *       to be right or wrong ABOUT.
 *
 * The old planner had a five-value `beatOf` — open, close, number, list, place
 * — which is a layout hint, not a reading. Everything in the middle of a reel
 * was "place", so the middle of every reel was the same.
 *
 * Nothing here knows about Remotion, pixels, or an episode. It reads sentences
 * and returns judgements.
 */

/**
 * THE BEATS, in the order a short-form documentary usually walks them.
 *
 * `weight` is how much of the reel's attention the beat deserves and drives
 * the rhythm — a verdict is allowed to be slow, a hook is never allowed to be.
 * `hold` is whether the beat wants air after it lands.
 */
export const BEATS = {
  HOOK: {weight: 1.0, pace: 'fast', hold: false},
  MYSTERY: {weight: 0.9, pace: 'slow', hold: true},
  CONTEXT: {weight: 0.6, pace: 'medium', hold: false},
  DISCOVERY: {weight: 0.9, pace: 'medium', hold: false},
  EVIDENCE: {weight: 0.85, pace: 'medium', hold: false},
  DETAIL: {weight: 0.7, pace: 'fast', hold: false},
  ESCALATION: {weight: 0.9, pace: 'fast', hold: false},
  COMPARISON: {weight: 0.8, pace: 'medium', hold: false},
  REVEAL: {weight: 1.0, pace: 'fast', hold: true},
  PAYOFF: {weight: 1.0, pace: 'slow', hold: true},
  VERDICT: {weight: 1.0, pace: 'slow', hold: true},
};

export const BEAT_NAMES = Object.keys(BEATS);

/**
 * WHAT THE SENTENCE IS DOING, read off its own verbs.
 *
 * Ordered by how much a match tells you. "found", "discovered", "uncovered"
 * is a DISCOVERY however many numbers are in the line; a number in a line that
 * is not otherwise doing anything is EVIDENCE.
 */
const SIGNALS = [
  /**
   * REVEAL OUTRANKS DISCOVERY, and the ordering is the whole point of the list.
   *
   * "X-rays found thirty gears" contains "found", so a discovery rule reading
   * first calls it a discovery — but nobody discovered anything at that moment;
   * an instrument LOOKED INSIDE something already on the table. Those are two
   * different shots: a discovery arrives into frame, a reveal opens what is
   * already in it.
   */
  [
    'REVEAL',
    /\b(turned out|revealed?|showed|x[- ]?ray\w*|scan\w*|inside (?:was|were|lay)|beneath|underneath|opened|it was actually|proved to be)\b/i,
  ],
  [
    'DISCOVERY',
    /\b(found|discover\w*|uncover\w*|recovered|pulled|surfaced|came across|stumbled|unearthed|dug up|located)\b/i,
  ],
  /**
   * WHAT THE THING COULD DO is the payoff of a story about an object. Left to
   * the fallbacks, "it predicted eclipses and tracked the moon" came back as
   * CONTEXT — scenery — when it is the entire reason the episode exists.
   */
  [
    'PAYOFF',
    /\b(predicted?|forecast\w*|calculated?|tracked|computed?|could (?:tell|predict|show|track)|able to|worked out|kept time)\b/i,
  ],
  [
    'MYSTERY',
    /\b(nobody|no one|unknown|unexplained|never (?:knew|understood|solved)|still (?:cannot|can't|do not|don't)|mystery|puzzl\w*|why)\b/i,
  ],
  [
    'ESCALATION',
    /\b(then|soon|within (?:days|weeks|months|years)|by \d{4}|grew|spread|rose|climbed|worse|more and more)\b/i,
  ],
  [
    'COMPARISON',
    /\b(than|compared|as (?:big|small|many|much|heavy|long) as|twice|half|equivalent|the size of|no bigger|no larger)\b/i,
  ],
  [
    'VERDICT',
    /\b(nothing (?:like|this)|not again|never again|remains?|to this day|still the|the only|for \w+ (?:hundred|thousand) years)\b/i,
  ],
  ['DETAIL', /\b(cut by hand|by hand|each|every|made of|carved|engraved|stamped|marked|bore|inscri\w*)\b/i],
  ['CONTEXT', /\b(in \d{4}|during|at the time|back then|for centuries|the (?:romans?|greeks?|empire))\b/i],
];

const NUMBER = /\b(\d[\d,.]*|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|billion|dozen)\b/i;

/**
 * CLASSIFY ONE LINE.
 *
 * Position is a strong prior and not an override: the first line is a hook
 * unless it is plainly doing something else, and the last line is a verdict
 * unless it is not. A brief may state `beat` outright and that always wins —
 * the same law the rest of this pipeline runs on.
 */
export function beatOfLine(line, index, total) {
  const written = String(line?.beat ?? '').toUpperCase();
  if (BEAT_NAMES.includes(written)) return written;

  const vo = String(line?.vo ?? '');
  const first = index === 0;
  const last = index === total - 1;

  const matched = SIGNALS.find(([, re]) => re.test(vo))?.[0] ?? null;

  // THE ENDS OF A REEL ARE STRUCTURAL. A closing line that also happens to
  // mention a year is still the closing line.
  if (last) return matched === 'MYSTERY' ? 'MYSTERY' : 'VERDICT';
  if (first) return matched === 'DISCOVERY' || matched === 'MYSTERY' ? matched : 'HOOK';

  if (matched) return matched;
  // A bare figure in the middle of a reel is the thing being shown, not the
  // thing being argued: that is evidence.
  if (NUMBER.test(vo)) return 'EVIDENCE';
  return 'CONTEXT';
}

/**
 * THE VISUAL IDEA — what has to be on screen for the line to be true.
 *
 * This is the step the pipeline never had, and its absence is why an asset
 * could be "wrong" without anything being able to say so. You cannot judge a
 * photograph against a sentence; you can judge it against an INTENTION.
 *
 * The subject is pulled out of the line's own nouns rather than invented, and
 * the `notice` is written as an instruction to the eye — "one gear, isolated",
 * not "gears". A brief may write either field and be obeyed.
 */
const OBJECT_WORDS =
  /\b(wreck|ship|bronze|metal|gear|gears|mechanism|drawer|drawers|cabinet|x[- ]?ray|moon|eclipse|statue|statues|lump|fragment|dial|dials|clock|coin|coins|map|route|letter|cipher|body|bodies|tank|border|street|clock|page|paper|card|stone|column|ash|cast)\b/gi;

export function visualIdea(line, beat) {
  if (line?.visual) return String(line.visual);
  const vo = String(line?.vo ?? '');
  const objects = [...new Set((vo.match(OBJECT_WORDS) ?? []).map((w) => w.toLowerCase()))];
  const subject = objects[0] ?? null;

  switch (beat) {
    case 'HOOK':
      return subject
        ? `the ${subject} in one frame, close enough that the eye has nowhere else to go`
        : 'the single strongest image in the story, held tight';
    case 'DISCOVERY':
      return subject ? `the ${subject} arriving into frame — found, not presented` : 'the moment of finding';
    case 'REVEAL':
      return subject ? `inside the ${subject}: the detail nobody expected, isolated` : 'the detail that changes the story';
    case 'EVIDENCE':
      return subject ? `the ${subject} as a specimen — flat, lit, countable` : 'the figure, proven on screen';
    case 'DETAIL':
      return subject ? `one ${subject}, extreme close, filling the frame` : 'one part of the whole, magnified';
    case 'MYSTERY':
      return subject ? `the ${subject} half-lit, most of the frame withheld` : 'absence — the thing not shown';
    case 'COMPARISON':
      return subject ? `the ${subject} set against the thing it is measured by` : 'two things, side by side';
    case 'ESCALATION':
      return subject ? `the ${subject} multiplying or growing across the frame` : 'quantity accumulating';
    case 'PAYOFF':
    case 'VERDICT':
      return subject
        ? `back to the ${subject}, hard and final, with the claim set over it`
        : 'the closing claim, typographic and still';
    default:
      return subject ? `the ${subject} in its place` : 'the setting, established';
  }
}

/** What the eye must find. Written as an instruction, because it is one. */
export function whatToNotice(line, beat, emphasis) {
  if (line?.notice) return String(line.notice);
  if (emphasis) return `the words "${emphasis}" and the thing in frame they refer to`;
  return `the subject of "${String(line?.vo ?? '').slice(0, 48)}…"`;
}

/**
 * SHOT RHYTHM — the reel is not divided equally.
 *
 * The measured voiceover fixes the total and each line's window; this decides
 * how a line's window is spent ACROSS its shots. A hook front-loads and cuts
 * away; a verdict gives its last shot the air to land in.
 *
 * Returns weights, one per shot, summing to 1.
 */
export function rhythmFor(beat, shots) {
  if (shots <= 1) return [1];
  const pace = BEATS[beat]?.pace ?? 'medium';
  const raw = Array.from({length: shots}, (_, i) => {
    const t = i / (shots - 1);
    // FAST leans early — the information lands and the shot gets out.
    if (pace === 'fast') return 1.25 - t * 0.5;
    // SLOW leans late — the last shot of the beat is the one that is held.
    if (pace === 'slow') return 0.75 + t * 0.5;
    return 1;
  });
  const sum = raw.reduce((a, b) => a + b, 0);
  return raw.map((w) => w / sum);
}

/**
 * DOES THIS BEAT WANT A HELD FRAME AFTER IT?
 *
 * A verdict cut off on its last syllable is a verdict nobody heard. The engine
 * cannot invent time, so a hold is taken out of the beat's OWN window — the
 * final shot keeps its words and simply stops adding new ones.
 */
export function wantsHold(beat) {
  return Boolean(BEATS[beat]?.hold);
}

/** How loud this beat is allowed to be, 0..1. Drives camera reach and devices. */
export function beatWeight(beat) {
  return BEATS[beat]?.weight ?? 0.6;
}

/**
 * THE WHOLE SCRIPT, READ.
 *
 * Returns one record per line. This is the object the rest of the decision
 * layer reasons about; nothing downstream should be re-reading the sentence.
 */
export function readScript(lines, {emphasisOf = () => ''} = {}) {
  const total = lines.length;
  return lines.map((line, index) => {
    const beat = beatOfLine(line, index, total);
    const emphasis = line?.emphasis ?? emphasisOf(line?.vo ?? '');
    return {
      index,
      slug: line?.slug ?? `line-${index + 1}`,
      vo: String(line?.vo ?? ''),
      beat,
      weight: beatWeight(beat),
      pace: BEATS[beat]?.pace ?? 'medium',
      hold: wantsHold(beat),
      emphasis,
      idea: visualIdea(line, beat),
      notice: whatToNotice(line, beat, emphasis),
    };
  });
}

/**
 * THE HOOK AND THE ENDING, as strategies rather than as positions.
 *
 * Both are reported in the director's log so that a reel which opens weakly can
 * be argued with, rather than discovered later in a contact sheet.
 */
export function hookStrategy(read) {
  const first = read[0];
  if (!first) return null;
  return {
    line: first.vo,
    beat: first.beat,
    idea: first.idea,
    // The opening asset is the single most consequential choice in a short.
    // Naming the requirement here is what lets the QA layer check it.
    demands: 'the strongest, most specific image available — never a texture, never a stand-in',
  };
}

export function endingStrategy(read) {
  const last = read[read.length - 1];
  if (!last) return null;
  return {
    line: last.vo,
    beat: last.beat,
    idea: last.idea,
    claim: last.emphasis || null,
    // A verdict split across two shots puts the payload on the first and the
    // silence on the second, which is backwards: the reel decrescendos into
    // its own ending. One shot, held.
    demands: 'one shot: the strongest relevant image, the claim over it, then a hold and a hard out',
  };
}
