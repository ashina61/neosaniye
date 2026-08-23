/**
 * THE SCENE DIRECTOR.
 *
 * The planner decides WHAT is in a shot: which plate, which words, which drawn
 * objects. Nothing decided WHEN anything happened inside it, and that gap is
 * most of why this pipeline's reels read as a slideshow with grain on.
 *
 * Look at what it was producing. A four-and-a-half second shot whose entire
 * content was: a photograph, a camera push from 1.0 to 1.46, some fog. Sample
 * it a third of the way in and two thirds of the way in and the two stills are
 * indistinguishable. Four of the seven shots in the last reel had an EMPTY
 * caption, so for those four the list of things that happened on screen in four
 * and a half seconds is: the picture got 13% bigger.
 *
 * A camera push is not an event. It is the floor — the thing that stops a shot
 * being a still — and a shot whose only event is its floor has nothing in it.
 *
 * So this module owns the answers to four questions the planner never asked:
 *
 *   HOW MANY THINGS HAPPEN IN THIS SHOT, and it is never fewer than two.
 *   WHEN DO THEY HAPPEN, spread across the shot, the first one early.
 *   WHICH WORD IS THE SHOT ABOUT, so the typography has something to point at.
 *   HOW DOES THE CAMERA MOVE, without repeating what it did in the last two.
 *
 * Everything here is numbers and strings — no React, no Remotion, no episode.
 * It is used by the planner at compile time and tested without a browser.
 */

/** A shot shorter than this is a flash and gets one event; above it, more. */
const FLASH = 40;

/**
 * HOW MANY THINGS MUST HAPPEN IN A SHOT OF THIS LENGTH.
 *
 * Roughly one event per second and a bit, floored at two for anything that is
 * a shot at all. The reference reel runs about fifteen shots in thirty-two
 * seconds with two or three events in each; the arithmetic below lands in the
 * same place without anybody counting.
 *
 * The cap matters as much as the floor. Six events in three seconds is not a
 * dense shot, it is a shot nobody can read — the master rule is animate what
 * matters, not animate everything.
 */
export function eventBudget(durationInFrames, fps = 30) {
  if (durationInFrames < FLASH) return 1;
  const seconds = durationInFrames / fps;
  return Math.max(2, Math.min(5, Math.round(seconds / 1.25)));
}

/**
 * WHEN THEY HAPPEN.
 *
 * Three rules, and each of them is a defect this repo has actually shipped:
 *
 *   THE FIRST ONE IS EARLY. A shot whose first event is halfway through opens
 *       with two seconds of a photograph being slowly scaled, and two seconds
 *       is the whole retention budget of a short.
 *   THE LAST ONE IS NOT AT THE END. An event on the final frames is an event
 *       nobody sees: the cut takes it. It lands by ~85% so it can be read.
 *   THEY DO NOT BUNCH. A minimum gap, because two things arriving three frames
 *       apart is one thing arriving with a stutter.
 *
 * Jitter comes from the seeded stream, so the same episode always cuts the same
 * way, and two shots of the same length never land their beats identically.
 */
export function beatSchedule(durationInFrames, count, rand = () => 0.5) {
  const n = Math.max(1, count);
  const open = Math.min(12, Math.round(durationInFrames * 0.08));
  const last = Math.round(durationInFrames * 0.85);
  if (n === 1) return [open];

  const span = Math.max(1, last - open);
  const gap = span / (n - 1);
  // A gap smaller than this is not a second event, it is a stutter on the first.
  const minGap = Math.max(6, Math.round(durationInFrames * 0.12));

  const out = [];
  for (let i = 0; i < n; i += 1) {
    const jitter = (rand() - 0.5) * gap * 0.3;
    const at = Math.round(open + gap * i + (i === 0 || i === n - 1 ? 0 : jitter));
    out.push(Math.max((out[out.length - 1] ?? -minGap) + minGap, Math.min(last, at)));
  }
  return out;
}

/**
 * WHICH WORD THE SHOT IS ABOUT.
 *
 * "The stone weighs 1,000 tons" has one word in it that is the reason the
 * sentence exists, and the typography has to know which. The order below is the
 * order a person would pick in:
 *
 *   A FIGURE WITH ITS UNIT   "1,000 tons", "fifty years". A bare number says
 *       nothing — the reel that set "TWENTY" on a card had thrown away the
 *       miles, and twenty of nothing is not a fact.
 *   A NAME                   a capitalised word that is not merely first.
 *   THE LONGEST CONTENT WORD as a last resort, which is usually the verb or the
 *       object and is at least never "the".
 *
 * Returned VERBATIM as it appears in the text, because the type layer matches
 * it back against the words it is setting.
 */
const STOPWORD =
  /^(the|a|an|and|or|but|of|in|on|to|for|from|by|with|at|as|it|its|was|were|is|are|be|been|had|has|have|that|this|these|those|they|them|he|she|his|her|him|we|us|you|not|no|so|then|when|while|after|before|into|over|under|about|up|down|out|off|there|their)$/i;

const UNIT_AFTER =
  /^(years?|months?|days?|hours?|minutes?|seconds?|miles?|kilometres?|kilometers?|metres?|meters?|feet|foot|inches|tons?|tonnes?|pounds?|kilos?|kilograms?|people|men|women|children|dead|killed|survivors?|dollars?|pounds?|francs?|percent|gears?|pages?|letters?|ciphers?|bodies|victims?|witnesses?|cases?|copies|times?)$/i;

/** Words that scale the figure before them rather than being figures of their own. */
const MAGNITUDE = /^(hundred|thousand|million|billion|dozen)$/i;

const NUMBER_TOKEN =
  /^(\d[\d,.]*|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|billion|dozen)$/i;

export function emphasisOf(text) {
  const words = String(text ?? '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '';
  const clean = (w) => w.replace(/[^\p{L}\p{N},.'%$£€-]/gu, '').replace(/[.,]$/, '');

  // A figure, plus the words that make it mean something. "fourteen hundred
  // years" is one emphasis; taking only "fourteen" is how a card ends up
  // reading HUNDRED.
  for (let i = 0; i < words.length; i += 1) {
    if (!NUMBER_TOKEN.test(clean(words[i]))) continue;
    let end = i;
    /**
     * A RUN CONTINUES ONLY THROUGH A MAGNITUDE.
     *
     * "fourteen hundred" is one figure; "1956 ten" is two, and joining them
     * produced the emphasis "1956 ten men" for a caption reading "In 1956 /
     * ten men…" — a phrase that exists in no single line, so nothing was
     * emphasised at all and nothing said so.
     */
    while (end + 1 < words.length && MAGNITUDE.test(clean(words[end + 1]))) end += 1;
    const after = clean(words[end + 1] ?? '');
    if (after && UNIT_AFTER.test(after)) end += 1;
    return words.slice(i, end + 1).map(clean).join(' ');
  }

  // A name. Not the first word, which is capitalised because it starts a
  // sentence rather than because it is anybody.
  for (let i = 1; i < words.length; i += 1) {
    const w = clean(words[i]);
    if (/^[A-Z][a-z]{2,}$/.test(w)) return w;
  }

  const longest = words
    .map(clean)
    .filter((w) => w.length > 3 && !STOPWORD.test(w))
    .sort((a, b) => b.length - a.length)[0];
  return longest ?? '';
}

/**
 * NEVER THE SAME THING THREE TIMES RUNNING.
 *
 * The guardrail the whole system is missing, stated once and reused: a device
 * that repeats stops being a choice and becomes a tic. It is deliberately not
 * "never twice" — two of something is a rhyme, and forbidding rhymes is how a
 * reel ends up as a tour of the effects list, which the master rule warns about
 * in the same breath as under-animating.
 *
 * `recent` is most-recent-last.
 */
export function withoutRepeats(options, recent, rand, limit = 2) {
  const tail = recent.slice(-limit);
  const jammed = tail.length >= limit && tail.every((r) => r === tail[0]) ? tail[0] : null;
  const allowed = options.filter((o) => o !== jammed);
  const list = allowed.length ? allowed : options;
  return list[Math.floor(rand() * list.length) % list.length];
}

/** How words arrive. `char` is held back — it is slow and it is a signature. */
const REVEALS = ['rise', 'wipe', 'blur', 'rise', 'punch'];

export function chooseReveal(rand, recent = []) {
  return withoutRepeats(REVEALS, recent, rand);
}

/** What is drawn on the emphasis. `none` is in the list because most lines want it. */
const MARKS = ['none', 'highlight', 'underline', 'none', 'box'];

export function chooseEmphasisMark(rand, recent = []) {
  return withoutRepeats(MARKS, recent, rand);
}

/**
 * THE CAMERA MOVE — as a family, so variety can be reasoned about.
 *
 * The old planner chose between "push in" and "pull back" and that was the
 * whole camera. Both are the same move with the sign flipped, so a reel of them
 * is a reel of one move; and a pan — the camera travelling PAST something
 * rather than toward it — never happened at all, although it is the move that
 * makes a wide plate feel like a place rather than a picture.
 *
 * The families are kept apart by name so the anti-repeat rule can see them.
 * Every one of them still ends at or above 1, because a fill plate scaled below
 * 1 shows the frame behind it.
 */
export const CAMERA_MOVES = ['push', 'pull', 'pan', 'drift', 'hold'];

export function cameraMove({rand, recent = [], durationInFrames, intensity = 0.5, impactAt = null}) {
  const between = ([lo, hi]) => lo + rand() * (hi - lo);
  const round = (n, p = 2) => Number(n.toFixed(p));
  // A short shot cannot pan: there is not enough time to travel far enough for
  // the eye to register it, and a pan you cannot see is a plate vibrating.
  const options = durationInFrames < 55 ? ['push', 'pull', 'drift'] : CAMERA_MOVES;
  const kind = withoutRepeats(options, recent, rand);

  const end = Math.round(durationInFrames * between([0.9, 0.98]));
  // A HOLD IS A DECISION, and it is the one the master rule protects: stillness
  // is what gives the movement around it somewhere to land. It is never dead,
  // though — the frame still breathes, because a locked-off digital still with
  // grain on it is the exact look this whole rebuild exists to get away from.
  const base = {pushEndFrame: end, handheld: kind === 'hold' ? 3 : 1.5};

  const reach = 0.18 + intensity * 0.34;
  const spec =
    kind === 'push'
      ? {pushFrom: 1, pushTo: round(1 + between([reach * 0.7, reach * 1.3]))}
      : kind === 'pull'
        ? {pushFrom: round(1 + between([reach * 0.9, reach * 1.5])), pushTo: round(1 + between([0.01, 0.06]))}
        : kind === 'pan'
          ? {
              pushFrom: round(1 + between([0.1, 0.2])),
              pushTo: round(1 + between([0.16, 0.3])),
              // A pan needs the plate to be OVERSIZE or it pans onto the void,
              // which is why both ends sit above 1 rather than starting at it.
              panX: Math.round((rand() > 0.5 ? 1 : -1) * between([90, 220])),
              panY: Math.round(between([-40, 40])),
            }
          : kind === 'drift'
            ? {
                pushFrom: 1,
                pushTo: round(1 + between([0.06, 0.12])),
                panY: Math.round(between([-70, -24])),
                roll: round(between([-0.8, 0.8]), 2),
              }
            : {pushFrom: round(1 + between([0.02, 0.05])), pushTo: round(1 + between([0.05, 0.09]))};

  return {
    kind,
    params: {
      ...base,
      ...spec,
      ...(impactAt === null ? {} : {shakeAt: [impactAt], shakeAmount: Math.round(9 + intensity * 14)}),
    },
  };
}

/**
 * THE RETENTION CURVE.
 *
 * A short is not paced evenly. The opening has to earn the next two seconds or
 * nothing after it is watched, the middle sustains, and the close hits hardest
 * because it is the only part anybody quotes.
 *
 * Returns 0..1, fed to the camera's reach and to how loud the drawn devices get.
 */
export function escalation(index, total) {
  if (total <= 1) return 1;
  const t = index / (total - 1);
  if (t < 0.12) return 0.9;
  if (t > 0.86) return 1;
  // A shallow climb through the middle, so shot eight is a little bigger than
  // shot three without any single cut announcing itself.
  return 0.42 + t * 0.4;
}

/**
 * THE SHOT PLAN — everything above, resolved for one shot.
 *
 * The planner hands in what it already knows and gets back a schedule it can
 * spend: which frames are free for events, which word carries the line, how the
 * camera moves, how the words arrive.
 *
 * `wants` is the events the shot already has in it, most important first. If
 * there are fewer than the budget, the planner is told to FILL — and it is told
 * with what, because "add something" is how a pipeline ends up adding a random
 * particle effect.
 */
/**
 * WHAT AN EMPTY SHOT IS GIVEN, and why these four.
 *
 * Each one says something. A mark is somebody pointing at the frame; a
 * wireframe is somebody measuring what is in it; a beam is the light in the
 * room arriving; a shake is the frame being hit. None of them is decoration
 * that could be dropped into any shot and mean the same thing, which is the
 * test — "add a particle system" is how a pipeline fills a shot without
 * filling it.
 */
export const FILLERS = ['mark', 'wire', 'beam', 'shake'];

export function directShot({
  durationInFrames,
  index,
  total,
  rand,
  wants = [],
  recent = {},
  fps = 30,
}) {
  const budget = eventBudget(durationInFrames, fps);
  const intensity = escalation(index, total);
  const beats = beatSchedule(durationInFrames, budget, rand);

  // What the shot already carries takes the earliest beats: the caption is the
  // reason the shot is that long, so it does not wait behind a wireframe.
  const scheduled = {};
  wants.slice(0, budget).forEach((want, i) => {
    scheduled[want] = beats[i];
  });

  const missing = Math.max(0, budget - wants.length);
  const fill = [];
  for (let i = 0; i < missing; i += 1) {
    const kind = withoutRepeats(
      FILLERS.filter((f) => !fill.includes(f)),
      recent.fillers ?? [],
      rand,
    );
    fill.push(kind);
    scheduled[kind] = beats[wants.length + i];
  }

  // The impact is the loudest beat in the shot, and only a shot that has earned
  // one gets it: a reel where the camera is struck on every cut is not
  // emphatic, it is broken.
  const impactAt =
    intensity > 0.8 && durationInFrames >= FLASH && rand() > 0.55
      ? (scheduled[wants[0]] ?? beats[0])
      : null;

  const camera = cameraMove({
    rand,
    recent: recent.camera ?? [],
    durationInFrames,
    intensity,
    impactAt,
  });

  return {
    budget,
    intensity,
    beats,
    at: scheduled,
    fill,
    camera: camera.params,
    cameraKind: camera.kind,
    reveal: chooseReveal(rand, recent.reveal ?? []),
    emphasisMark: chooseEmphasisMark(rand, recent.mark ?? []),
  };
}
