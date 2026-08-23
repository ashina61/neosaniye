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
export const CAMERA_MOVES = ['push', 'pull', 'pan', 'tilt', 'drift', 'hold'];

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
/**
 * `beam` IS NOT ON THIS LIST, AND THAT IS THE POINT.
 *
 * The visual director's own test — a graphic must explain, measure, locate,
 * compare, highlight, count, connect or reveal — returns null for a shaft of
 * light, because it does none of them. It went into a shot of the moon on a
 * black sky, where there is no source for it to be the falloff of, and read as
 * a smear on the lens. A rule that the pipeline states and then breaks is not
 * a rule.
 */
export const FILLERS = ['mark', 'wire', 'shake'];

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

/* ══════════════════════════════════════════════════════════════════════════
 * SECOND STAGE — the directors that choose for a REASON rather than for
 * variety. Everything above this line schedules; everything below it decides.
 * ══════════════════════════════════════════════════════════════════════════ */

/**
 * THE CAMERA DIRECTOR.
 *
 * The previous version picked a move from a list, avoided three in a row, and
 * called that variety. It is not, and the reel proves it: eight of ten moves in
 * the last cut were pull-backs. The anti-repeat rule cannot see a device used
 * eighty per cent of the time non-consecutively, and the audience does not
 * experience a reel as a sliding window of three.
 *
 * Two changes. First, a move now has a PURPOSE and is chosen from what the beat
 * is doing, so a reveal pushes and a verdict holds because that is what those
 * beats are, not because the die said so. Second, there is a QUOTA: no family
 * may exceed roughly thirty per cent of the reel, counted across the whole
 * thing.
 */
export const CAMERA_PURPOSE = {
  push: 'single out the subject — the frame closes on what matters',
  pull: 'reveal scale or context — the subject turns out to sit in something',
  pan: 'expose information the frame was withholding, or follow a movement',
  tilt: 'a vertical reveal — height, depth, or a drop',
  drift: 'atmosphere, and the calm that makes the next cut land',
  hold: 'importance. The frame stops because the idea needs no help',
};

/** What each beat wants the camera to do, best first. */
const CAMERA_FOR_BEAT = {
  HOOK: ['push', 'tilt', 'hold'],
  MYSTERY: ['hold', 'drift', 'pull'],
  CONTEXT: ['pan', 'drift', 'pull'],
  DISCOVERY: ['push', 'tilt', 'pan'],
  EVIDENCE: ['hold', 'push', 'pan'],
  DETAIL: ['push', 'hold', 'tilt'],
  ESCALATION: ['push', 'pan', 'tilt'],
  COMPARISON: ['pan', 'pull', 'hold'],
  REVEAL: ['push', 'tilt', 'hold'],
  PAYOFF: ['pull', 'hold', 'drift'],
  VERDICT: ['hold', 'drift', 'push'],
};

/**
 * A QUOTA, COUNTED OVER THE WHOLE REEL.
 *
 * `used` is a tally of what has already been spent. A family at or over its
 * share is dropped from the candidate list unless nothing else is left, so the
 * reel cannot end up as one move wearing different names.
 */
export function withinQuota(candidates, used, total, share = 0.3) {
  const cap = Math.max(1, Math.ceil(total * share));
  const allowed = candidates.filter((kind) => (used[kind] ?? 0) < cap);
  if (allowed.length) return allowed;
  /**
   * WHEN EVERYTHING IS CAPPED, SPEND THE LEAST-USED ONE.
   *
   * Handing the whole list back is what let `hold` reach forty per cent of a
   * reel after every candidate had hit its ceiling: the overflow went to the
   * die, and the die kept picking the one already in front. A shot must move
   * somehow, so the fallback cannot be "nothing" — but it can be "the one this
   * reel has leaned on least".
   */
  const fewest = Math.min(...candidates.map((kind) => used[kind] ?? 0));
  return candidates.filter((kind) => (used[kind] ?? 0) === fewest);
}

/**
 * CHOOSE THE MOVE — purpose first, quota second, die last.
 *
 * `reframeFrom` is the previous shot's move on the SAME plate. A continuation
 * has to change the visual information (see the reframe rule); repeating the
 * previous move on the same picture is the definition of not doing that.
 */
export function directCamera({
  beat,
  rand,
  durationInFrames,
  used = {},
  total = 12,
  intensity = 0.6,
  impactAt = null,
  reframeFrom = null,
  sameSubject = false,
  share = 0.3,
}) {
  const between = ([lo, hi]) => lo + rand() * (hi - lo);
  const round = (n, p = 2) => Number(n.toFixed(p));

  let wanted = CAMERA_FOR_BEAT[beat] ?? ['push', 'pull', 'hold'];
  // A pan or a tilt needs time to travel far enough to be read as travel.
  if (durationInFrames < 55) wanted = wanted.filter((k) => k !== 'pan' && k !== 'tilt');
  /**
   * A SECOND SHOT OF ONE PICTURE MUST MOVE, AND MOVE DIFFERENTLY.
   *
   * Repeating the previous move is a stutter; HOLDING is worse — the only thing
   * that made the cut a cut was the promise of new visual information, and a
   * locked-off frame on the same plate delivers none. One continuation came out
   * travelling 0.02, which is a photograph with grain on it.
   */
  if (sameSubject) wanted = wanted.filter((k) => k !== reframeFrom && k !== 'hold');
  if (!wanted.length) wanted = ['push', 'hold'];

  /**
   * WHEN THE BEAT'S PREFERENCES ARE SPENT, WIDEN — DO NOT REPEAT.
   *
   * A beat names two or three moves it likes. Filter those by shot length and
   * by what the previous shot on the same plate did and you can be left with
   * one, and then the quota has nothing to choose between: excluding `hold`
   * from continuations pushed every one of them onto that single survivor and
   * `push` went from forty per cent of the reel to sixty-three.
   *
   * So the beat's list is a PREFERENCE, and the full vocabulary is what it
   * falls back into. A pull-back on a reveal is a second choice; a fifth
   * consecutive push is not a choice at all.
   */
  const cap = Math.max(1, Math.ceil(total * share));
  const spent = wanted.every((k) => (used[k] ?? 0) >= cap);
  const pool = spent
    ? CAMERA_MOVES.filter(
        (k) =>
          k !== reframeFrom &&
          !(sameSubject && k === 'hold') &&
          !(durationInFrames < 55 && (k === 'pan' || k === 'tilt')),
      )
    : wanted;

  const kind = pickFrom(withinQuota(pool.length ? pool : wanted, used, total, share), rand);
  const end = Math.round(durationInFrames * between([0.9, 0.98]));
  const reach = 0.16 + intensity * 0.3;

  /**
   * PREFER A CHANGE OF FRAMING TO A CHANGE OF SCALE.
   *
   * A 1.45→1.50 push is the same frame twice. Where two shots share a subject
   * the move starts from a genuinely different place, so the CROP differs at
   * frame zero — which is the only reliable way a cut reads as a new shot.
   */
  const spec =
    kind === 'push'
      ? {pushFrom: round(1 + (sameSubject ? between([0.0, 0.06]) : 0)), pushTo: round(1 + between([reach * 0.9, reach * 1.4]))}
      : kind === 'pull'
        ? {pushFrom: round(1 + between([reach * 1.0, reach * 1.6])), pushTo: round(1 + between([0.0, 0.05]))}
        : kind === 'pan'
          ? {
              pushFrom: round(1 + between([0.14, 0.24])),
              pushTo: round(1 + between([0.18, 0.32])),
              panX: Math.round((rand() > 0.5 ? 1 : -1) * between([140, 280])),
            }
          : kind === 'tilt'
            ? {
                pushFrom: round(1 + between([0.16, 0.26])),
                pushTo: round(1 + between([0.2, 0.34])),
                panY: Math.round((rand() > 0.5 ? 1 : -1) * between([120, 240])),
              }
            : kind === 'drift'
              ? {
                  pushFrom: 1,
                  pushTo: round(1 + between([0.07, 0.13])),
                  panY: Math.round(between([-70, -26])),
                  roll: round(between([-0.7, 0.7]), 2),
                }
              : {pushFrom: round(1 + between([0.02, 0.05])), pushTo: round(1 + between([0.04, 0.08]))};

  return {
    kind,
    purpose: CAMERA_PURPOSE[kind],
    params: {
      pushEndFrame: end,
      handheld: kind === 'hold' ? 3 : 1.5,
      ...spec,
      ...(impactAt === null ? {} : {shakeAt: [impactAt], shakeAmount: Math.round(9 + intensity * 13)}),
    },
  };
}

const pickFrom = (list, rand) => list[Math.floor(rand() * list.length) % list.length];

/**
 * THE TRANSITION DIRECTOR.
 *
 * Motivated by what is happening, capped so nothing dominates, and forbidden
 * from blanking the frame on a short shot.
 *
 * The last cut used `rack` on five of eleven cuts — forty-five per cent of the
 * reel arriving out of focus — and `blinds` opened a two-second shot on a
 * completely black frame while `flare` opened another on a white one. On a
 * 1.7-second shot a transition that spends its first twelve frames unreadable
 * has eaten a fifth of the shot before anything can be seen.
 */
export const TRANSITION_PURPOSE = {
  slam: 'something lands — a document, a verdict, a fact',
  slip: 'something is moved into view, laterally',
  flare: 'a splice, a flash, a jump in the record',
  rack: 'the lens finds it — noticing, not cutting',
  blinds: 'a room is opened onto',
  cut: 'no ceremony — the next thing simply is',
};

/** Transitions that spend their opening frames unreadable. */
const BLANKING = new Set(['blinds', 'flare', 'rack']);

/** What the content is doing, and therefore how the next shot should arrive. */
const TRANSITION_FOR_BEAT = {
  HOOK: ['cut', 'slam'],
  MYSTERY: ['rack', 'blinds', 'cut'],
  CONTEXT: ['slip', 'cut'],
  DISCOVERY: ['blinds', 'slip', 'cut'],
  EVIDENCE: ['slam', 'cut', 'slip'],
  DETAIL: ['cut', 'slam'],
  ESCALATION: ['slam', 'flare', 'cut'],
  COMPARISON: ['slip', 'cut'],
  REVEAL: ['flare', 'rack', 'cut'],
  PAYOFF: ['rack', 'cut', 'slip'],
  VERDICT: ['slam', 'flare', 'cut'],
};

/**
 * CHOOSE HOW A SHOT ARRIVES.
 *
 * `cut` is in every list and that is deliberate. A hard cut is the default
 * grammar of documentary editing, and a reel where every seam is decorated has
 * no seams left to decorate — the plainness of most cuts is what makes the
 * three that are not plain mean something.
 */
export function directTransition({
  beat,
  rand,
  durationInFrames,
  used = {},
  total = 12,
  previous = [],
  share = 0.25,
  prefer = null,
}) {
  /**
   * AN EXECUTION ASKED FOR BY THE CUT DIRECTOR.
   *
   * The editorial layer above this one decides WHAT the cut is — a match, a
   * wipe, a flash — and hands down the one arrival that performs it. This stays
   * the place where the arrival has to survive the reel: a short shot still
   * refuses to open unreadable, a third repeat is still refused, and a spent
   * quota still goes to a plain cut. The editorial decision is a request, not
   * an override; when it cannot be met the answer is a hard cut, which is also
   * what the Cut Director falls back to on its own.
   */
  let wanted = prefer ? [prefer] : (TRANSITION_FOR_BEAT[beat] ?? ['cut', 'slip']);

  /**
   * A SHORT SHOT CANNOT AFFORD TO ARRIVE UNREADABLE.
   *
   * Under two seconds, anything that blanks or blurs the opening is spending
   * the part of the shot the viewer actually uses to understand it.
   */
  if (durationInFrames < 60) wanted = wanted.filter((k) => !BLANKING.has(k));
  const last = previous[previous.length - 1] ?? null;
  wanted = wanted.filter((k) => k !== last);
  if (!wanted.length) wanted = ['cut'];

  /**
   * OVERFLOW GOES TO A HARD CUT, NOT BACK INTO THE POOL.
   *
   * `withinQuota` returns the unfiltered list when every candidate is capped,
   * which is right for a camera — a shot must move somehow — and wrong here,
   * because a shot does not have to be decorated. Letting the overflow fall
   * back into the pool put `slip` on a third of the reel. A plain cut is always
   * available and is the correct answer when the vocabulary is spent.
   */
  const cap = Math.max(1, Math.ceil(total * share));
  const allowed = wanted.filter((k) => (used[k] ?? 0) < cap);
  const kind = allowed.length ? pickFrom(allowed, rand) : 'cut';
  // A hard arrival cuts short and lands; a noticing takes longer because the
  // whole point of it is the lens catching up. Both are shorter than they were.
  const hard = kind === 'slam' || kind === 'flare';
  const frames = kind === 'cut' ? 0 : hard ? 4 + Math.round(rand() * 2) : 8 + Math.round(rand() * 3);
  return {kind, purpose: TRANSITION_PURPOSE[kind], frames: clampArrival(kind, frames, durationInFrames)};
}

/**
 * AN ARRIVAL MAY NOT EAT THE SHOT.
 *
 * A safety rule rather than a preference, which is why it also applies to a
 * transition the brief asked for by name. This episode's brief writes `rack` on
 * a shot that was four and a half seconds when it was written and is one point
 * nine now: eleven frames of blur on a fifty-eight frame shot, a fifth of it
 * gone before anything is legible. The author's device survives; its cost does
 * not.
 */
export function clampArrival(kind, frames, durationInFrames) {
  if (!frames) return 0;
  const ceiling = Math.max(3, Math.round(durationInFrames * 0.12));
  // `blinds` and `flare` START fully covered, so their cost is measured from
  // the first readable frame rather than from the cut. Six frames is a fifth of
  // a second of black; more than that is a gap in the reel.
  const blanking = BLANKING.has(kind) ? Math.min(ceiling, durationInFrames < 60 ? 4 : 6) : ceiling;
  return Math.min(frames, blanking);
}

/**
 * FOCUS AND ATMOSPHERE ARE NOT DEFAULTS.
 *
 * `focusPx` was 7–15 on eight of twelve shots and `fog` was on all twelve. A
 * lens hunt that appears in every shot is not a lens, it is a filter; and haze
 * over every frame is not atmosphere, it is the reason the whole reel is grey.
 *
 * Both now need a REASON, and the amount is bounded by the shot's own length so
 * a focus hunt can never eat the opening of a short shot. They also refuse to
 * stack: a shot arriving on a rack transition gets no hunt of its own.
 */
const ATMOSPHERIC = /\b(sea|water|underwater|dive[rs]?|wreck|dust|ash|smoke|fog|mist|night|dark|storm|rain|deep)\b/i;

export function atmosphereFor({vo = '', beat, durationInFrames, transitionKind, rand}) {
  const reason = ATMOSPHERIC.exec(String(vo))?.[0]?.toLowerCase() ?? null;
  const arrivesSoft = transitionKind === 'rack' || transitionKind === 'blinds';

  /**
   * A HUNT ONLY WHERE THE SHOT CAN PAY FOR IT.
   *
   * The hunt clears over a fifth of the shot. On 34 frames that is seven frames
   * of mush at the top of a one-second shot; on 130 it is a lens finding its
   * subject. So it is available above four seconds, on beats that are about
   * looking, and never on top of a transition that is already soft.
   */
  const canHunt = durationInFrames >= 120 && !arrivesSoft && (beat === 'MYSTERY' || beat === 'DISCOVERY');
  return {
    focusPx: canHunt ? 8 + Math.round(rand() * 4) : 0,
    // Haze needs something in the sentence to be hazy about, and even then it
    // is light: 0.45 over a pale plate is what turned an opening shot white.
    fog: reason ? Number((0.1 + rand() * 0.14).toFixed(2)) : 0,
    fogReason: reason,
  };
}
