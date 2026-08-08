#!/usr/bin/env node
/**
 * THE PLANNER — a brief in, a whole episode out.
 *
 * Until now every scene-config in this repo was laid out by hand, and it shows:
 * ten shots that each work on their own and do not add up to anything, because
 * nothing decided the RHYTHM. Hand-authoring also means every episode inherits
 * whatever the last one happened to look like, so "a different drawing every
 * video" was never going to happen while a person was picking each knob.
 *
 * So the shape of a reel is derived, not typed:
 *
 *   THE WORDS DECIDE THE SHOT.  A line with a number in it becomes a slate with
 *       that number set large. A line that lists three things becomes three
 *       pieces of paper landing. A line naming an object becomes a push into
 *       that object. The voiceover is the storyboard — the same principle the
 *       whole pipeline is built on, applied one level up.
 *
 *   THE WORDS DECIDE THE LENGTH. A scene runs as long as its line takes to
 *       speak, at a documentary rate. Nothing is padded to a round number.
 *
 *   THE EPISODE DECIDES ITS OWN LOOK. Grade, accent colour, drawn field,
 *       transition vocabulary, annotation style and caption face are all drawn
 *       from a seed made of the episode id — inside the bounds of its declared
 *       mood. Two episodes in the same mood are cousins; two moods are
 *       strangers. Nothing is picked from a menu by hand, which is the only way
 *       the tenth episode looks unlike the first.
 *
 * Written by hand: the voiceover, and one phrase per line saying what we are
 * looking at. That is the storyboard, and it is the only part a person should
 * be doing.
 *
 *   node scripts/plan-episode.mjs --episode=mansa-musa
 */
import {readFile, rm, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {episodeDir, parseArgs} from './lib/episode.mjs';
import {PROP_KINDS} from '../engine/schema.mjs';

const FPS = 30;
const WIDTH = 1080;
const HEIGHT = 1920;
/** Words per second a documentary narrator actually reads at. */
const RATE = 2.7;

/** Deterministic stream: same episode id, same reel, forever. */
function seeded(seed) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return () => {
    h = Math.imul(h ^ (h >>> 15), h | 1) >>> 0;
    h ^= h + Math.imul(h ^ (h >>> 7), h | 61);
    return ((h ^ (h >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A NUMBER, OR THE FALLBACK — and `??` cannot do this job.
 *
 * `Number(undefined) ?? 0.2` is NaN, because `??` catches null and undefined
 * and NaN is neither. Seven placements in this file were written that way, so
 * every optional coordinate a brief left out became NaN, travelled through
 * Math.round untouched, and landed in the config as `"depth": null` — which the
 * schema then refused with a message about the CONFIG rather than about the
 * brief that caused it. A layer written `{"role": "x"}` was enough.
 *
 * Fractions are also CLAMPED here rather than at each call site, because a
 * brief is written by hand and a hand types 1.5 where it meant 0.15.
 */
const num = (value, fallback, lo = -Infinity, hi = Infinity) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fallback;
};

const pick = (rand, list) => list[Math.floor(rand() * list.length) % list.length];
const between = (rand, [lo, hi]) => lo + rand() * (hi - lo);
const round = (n, p = 2) => Number(n.toFixed(p));

/**
 * MOODS — the bounds a look is generated INSIDE, never a look itself.
 *
 * A menu of finished palettes would give ten episodes that are one of five
 * things. Bounds give a family: every gold-heat reel is warm and bright, and no
 * two are the same warm and bright.
 */
const MOODS = {
  'gold-heat': {
    grade: {saturate: [0.74, 0.94], contrast: [1.02, 1.14], sepia: [0.22, 0.42], brightness: [1.0, 1.12]},
    accents: ['#f2b53a', '#e8a020', '#ffcf3d', '#d99326'],
    fields: ['spotlight', 'sunburst', 'wash'],
    fieldColours: [
      ['#c98a2a', '#7d4d12', '#2c1a06'],
      ['#d9a13c', '#8a5a18', '#241505'],
      ['#b87a22', '#6d420f', '#1d1204'],
    ],
    fog: [0, 0.18],
    vignette: [0.34, 0.5],
    grain: [0.3, 0.46],
  },
  'cold-noir': {
    grade: {saturate: [0.42, 0.72], contrast: [1.08, 1.24], sepia: [0.08, 0.22], brightness: [0.92, 1.06]},
    accents: ['#ffcf3d', '#e6e2d6', '#8fb6c8', '#c9a94b'],
    fields: ['spotlight', 'grid', 'wash'],
    fieldColours: [
      ['#2a3138', '#161b20', '#080a0c'],
      ['#333a3e', '#1b2024', '#0a0c0e'],
      ['#2c3340', '#171c26', '#080a0f'],
    ],
    fog: [0.2, 0.6],
    vignette: [0.4, 0.58],
    grain: [0.34, 0.5],
  },
  'green-rot': {
    grade: {saturate: [0.5, 0.78], contrast: [1.06, 1.18], sepia: [0.1, 0.26], brightness: [0.94, 1.06]},
    accents: ['#c8d94a', '#9fb83a', '#e0d089'],
    fields: ['wash', 'grid', 'spotlight'],
    fieldColours: [
      ['#3a4530', '#1f2619', '#0b0e08'],
      ['#44503a', '#242c1e', '#0d100a'],
    ],
    fog: [0.15, 0.45],
    vignette: [0.36, 0.52],
    grain: [0.32, 0.48],
  },
  'ash-grey': {
    grade: {saturate: [0.2, 0.5], contrast: [1.1, 1.26], sepia: [0.04, 0.16], brightness: [0.95, 1.08]},
    accents: ['#e8e2d4', '#b9c3c9', '#d94f3d'],
    fields: ['grid', 'wash', 'spotlight'],
    fieldColours: [
      ['#33373a', '#1c1f21', '#0a0b0c'],
      ['#3d4144', '#212426', '#0c0d0e'],
    ],
    fog: [0.25, 0.6],
    vignette: [0.4, 0.56],
    grain: [0.36, 0.52],
  },
};

/**
 * How a beat bends the episode's own grade. Multipliers would drift with the
 * mood; these are absolute, and deliberately few — three registers, not nine.
 */
const GRADE_SHIFT = {
  // Ruin, and the last word. Colour drains out and contrast comes up.
  close: {saturate: 0.5, contrast: 1.16, brightness: 0.94},
  embers: {saturate: 0.58, contrast: 1.14, brightness: 0.95},
  // Money and glory run hot.
  coins: {saturate: 0.96, sepia: 0.34, brightness: 1.06},
  rays: {saturate: 0.98, sepia: 0.3, brightness: 1.08},
};

/** What a slot reel rattles through before it stops. */
const SPIN_DECOYS = ['THOUSAND', 'HUNDRED', 'MILLION', 'BILLION', 'FIFTY', 'TWENTY'];

/** A sentence that puts light on something. Nothing else earns a highlight. */
const LIT_WORDS = /\b(gold|golden|coins?|treasur\w*|fire|burn\w*|lamp|lit|glow\w*|shining|bright)\b/i;

/**
 * Does this line earn the highlight?
 *
 * Same law as the motifs: on every shot it is a filter; on the one line about
 * treasure it IS the line. And it needs something to light — the trick is a
 * recoloured copy of a PIECE, so a shot with no pieces has nothing to copy.
 */
export function earnsHighlight(line) {
  return Boolean(line?.pieces?.length) && LIT_WORDS.test(line?.vo ?? '');
}

const MARKS = ['underline', 'oval', 'bracket', 'box', 'strike'];
const TRANSITIONS = ['slam', 'slip', 'flare', 'rack', 'blinds'];

/**
 * WHAT THE LINE IS DOING — and therefore what gets DRAWN over it.
 *
 * This is the difference between a picture with words on it and a documentary.
 * A photograph says who and where; it cannot say "and then the money arrived".
 * So the sentence is read for its VERB, not just its subject, and the motif
 * acts the verb out: gold falling and piling up while the line is about
 * spending, a route drawing itself while it is about a journey, a count
 * climbing while it is about years. It is the only thing in the frame changing
 * on purpose, which is why the eye follows it.
 *
 * Order matters — the first match wins, so the most specific claims come first.
 * "He spent a fortune" is about money before it is about a king.
 */
const MOTIF_WORDS = [
  // COMMON VERBS ARE WEAK EVIDENCE. Two of these shipped and both were wrong on
  // the first script that used them innocently: "the roofs gave" is a collapse,
  // "ten men spent a summer" is a season. Both got gold rained over them. So
  // `gave` counts only as "gave it away", and `spent` only when what follows is
  // not a stretch of time — which is exactly how a script about money says it.
  ['coins', /\b(gold|golden|money|wealth|wealthy|rich|riches|fortune|coins?|treasur\w*|dinars?|bullion|paid|price|cost|gift\w*|alms|crashed?)\b|\bgave\s+(it\s+|them\s+)?away\b|\bgiv(es|ing)\s+away\b|\bspen[dt]\w*\b(?!\s+(\w+\s+){0,2}(second|minute|hour|day|night|week|month|year|decade|summer|winter|spring|autumn|life|time)s?\b)/i],
  ['rise', /\b(rose|rise|risen|rising|grew|grow\w*|doubl\w*|tripl\w*|soar\w*|surg\w*|increas\w*|boom\w*|climb\w*|multipl\w*|swell\w*)\b/i],
  ['route', /\b(journey|travel\w*|caravan|pilgrimage|pilgrim|road|route|marched?|crossed?|across|set out|departed|returned|miles?)\b/i],
  ['embers', /\b(fire|burn\w*|ash|ashes|collaps\w*|ruin\w*|destroy\w*|sacked?|war|siege|died|death|end\w*)\b/i],
  ['rays', /\b(king|emperor|empire|throne|crown|glory|legend\w*|holy|sacred|greatest|famous|power\w*|remembered)\b/i],
  ['tally', /\b(years?|days?|months?|centur\w*|counted?|thousands?|hundreds?|men|camels?|scholars?|people)\b/i],
];

/**
 * WHERE EACH MOTIF SITS, and how big.
 *
 * Not scattered: a pile of coins belongs on the floor of the frame, a bar
 * climbs from the lower third, rays sit behind the head, a tally goes high
 * where a caption is not. Frame-relative so the same numbers hold at any size.
 */
const MOTIF_PLACE = {
  coins: {x: 0.52, y: 0.86, size: 46, count: 22},
  rise: {x: 0.16, y: 0.82, size: 62, count: 7},
  route: {x: 0.16, y: 0.62, size: 210, count: 1},
  embers: {x: 0.5, y: 0.5, size: 40, count: 28},
  rays: {x: 0.5, y: 0.4, size: 330, count: 22},
  tally: {x: 0.12, y: 0.26, size: 92, count: 12},
};

/**
 * A motif is EARNED, not decorated on.
 *
 * Three rules, and all three exist because the first draft put one on every
 * shot and the reel turned into a screensaver:
 *
 *   THE LINE HAS TO SAY IT.   Inference off the verb, not off the topic.
 *   NEVER TWICE RUNNING.      A repeated drawing stops reading as meaning and
 *                             starts reading as a template.
 *   NEVER THREE IN A ROW.     Two decorated shots then a plain one. The plain
 *                             shot is what makes the decorated ones land — a
 *                             reel where every frame has something drawn on it
 *                             has nothing drawn on it.
 *
 * A brief overrules all three, in either direction: a named motif is used, and
 * "none" means the line is meant to be left alone.
 */
export function motifFor(line, recentMotifs, sceneType) {
  if (line.motif === 'none') return '';
  if (typeof line.motif === 'string' && line.motif) return line.motif;
  // A line that lists the places he actually passed through IS a route, and no
  // rhythm rule outranks that — the itinerary is the content of such a shot,
  // not decoration laid over it.
  if (line.stops?.length >= 2) return 'route';
  if (recentMotifs.length >= 2 && recentMotifs.every(Boolean)) return '';
  const previous = recentMotifs[recentMotifs.length - 1];
  for (const [kind, pattern] of MOTIF_WORDS) {
    if (kind === previous) continue;
    if (!fitsScene(kind, sceneType)) continue;
    if (pattern.test(line.vo)) return kind;
  }
  return '';
}

/**
 * A TYPE CARD'S MIDDLE BELONGS TO THE WORDS.
 *
 * A route arcs across the centre of the frame and a tally sits high on the
 * left; on a photograph that is composition, on a title slate it is a line
 * drawn through the title. So a slate only takes the motifs that live on the
 * floor or behind the type — and it takes a DIFFERENT one rather than none,
 * because the search simply carries on down the list.
 */
const SLATE_MOTIFS = new Set(['coins', 'rise', 'embers', 'rays']);

export function fitsScene(kind, sceneType) {
  return sceneType === 'title-slate' ? SLATE_MOTIFS.has(kind) : true;
}

/** The knobs for a chosen motif, in scene pixels. */
function motifParams(kind, {rand, from, accent, stops}) {
  if (!kind) return {};
  const place = MOTIF_PLACE[kind];
  // An itinerary lays itself out across the whole frame from its stops, so the
  // anchor and the element count below are not its business.
  if (kind === 'route' && stops?.length >= 2) {
    return {motif: kind, motifStops: stops, motifFrame: from, motifColour: accent};
  }
  return {
    motif: kind,
    motifX: Math.round(WIDTH * place.x + (rand() - 0.5) * WIDTH * 0.1),
    motifY: Math.round(HEIGHT * place.y),
    motifSize: Math.round(place.size * (0.88 + rand() * 0.3)),
    motifCount: Math.max(1, Math.round(place.count * (0.8 + rand() * 0.5))),
    motifFrame: from,
    motifColour: accent,
    motifOpacity: round(between(rand, [0.8, 1]), 2),
  };
}

/**
 * WHAT KIND OF SHOT A LINE WANTS.
 *
 * Read off the words themselves. Not clever, and it does not need to be — the
 * point is that the DECISION is derived rather than typed, so a new script gets
 * a shape without anybody laying one out.
 */
const NUMBER_WORD =
  /\b(\d[\d,.]*|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|twenty|thirty|forty|fifty|sixty|hundreds?|thousands?|millions?|billions?|dozen|decade)\b/i;

function beatOf(line, index, total) {
  // WHAT THE BRIEF SAYS WINS. Inference is for lines that did not bother to
  // say; it is not there to overrule a storyboard. An earlier version guessed
  // first and quietly threw away slate copy that had been written by hand for
  // exactly that shot.
  if (line.items) return 'list';
  if (line.artefact) return 'artefact';
  // A line that names the places he passed through is a MAP shot: the itinerary
  // needs the whole frame and the backdrop under it has to be the chart. Left
  // to the number-word rule below, "four thousand miles" would make it a title
  // card and the route would be drawn straight through the title.
  if (line.stops?.length >= 2) return 'place';
  // A line that names things to put in the frame wants a frame to put them in,
  // whatever numbers happen to be in the sentence.
  if (line.pieces?.length) return 'place';
  if (line.title) return index === 0 ? 'open' : index === total - 1 ? 'close' : 'number';

  if (index === 0) return 'open';
  if (index === total - 1) return 'close';
  if (NUMBER_WORD.test(line.vo)) return 'number';
  if ((line.vo.match(/,/g) ?? []).length >= 2) return 'list';
  return 'place';
}

const DIRECTED_TEMPLATES = new Set(['composite', 'portal-zoom-reveal', 'title-slate', 'evidence-board', 'stacked-reveal', 'split-shift', 'parallax-punch']);

const SCENE_FOR = {
  open: 'title-slate',
  close: 'title-slate',
  number: 'title-slate',
  list: 'evidence-board',
  artefact: 'portal-zoom-reveal',
  place: 'composite',
};

/**
 * ONE SENTENCE IS NOT ONE SHOT.
 *
 * This is the thing that made every reel out of this repo feel dead, and the
 * numbers say it plainly: nine scenes, and all nine came out at 215 frames —
 * the ceiling — because every line was long enough to hit it. Nine identical
 * seven-second shots in a row. Nothing to cut TO, so nothing lands.
 *
 * The reference reel is thirty-two seconds and about fifteen shots: a couple of
 * seconds each, and the same picture is often held across two or three of them
 * while the words move on. That is the whole trick, and it costs no extra
 * artwork — the backdrop stays, the framing and the caption change, and the CUT
 * is what carries the pace.
 *
 * So a sentence is split at its clauses, each fragment gets a shot, and every
 * fragment after the first reuses the line's own picture. A shot now lasts as
 * long as its FRAGMENT takes to say instead of as long as the sentence does,
 * which is also what makes the durations differ from one another at last.
 */
const SPLIT_AT = /(?<=,)\s+|\s+(?=and\s|but\s|because\s|so\s|then\s|while\s)|(?<=\.)\s+/i;
/** Seconds of speech beyond which a shot stops being a shot and becomes a wait. */
const MAX_SPOKEN = 3.6;

export function fragmentsOf(vo, max = MAX_SPOKEN) {
  const words = (s) => s.trim().split(/\s+/).filter(Boolean).length;
  const budget = Math.round(max * RATE);
  const pieces = String(vo).split(SPLIT_AT).map((s) => s.trim()).filter(Boolean);

  // Re-join what is too short to stand on its own. A three-word shot is a
  // flash, and a clause like "and kept paying" is not a sentence — the split
  // exists to break up a wall of speech, not to shred it.
  const out = [];
  for (const piece of pieces) {
    const last = out[out.length - 1];
    if (last && (words(last) < 4 || words(last) + words(piece) <= budget * 0.55)) {
      out[out.length - 1] = `${last} ${piece}`;
    } else {
      out.push(piece);
    }
  }
  return out.length ? out : [String(vo).trim()];
}

/** Frames a fragment needs, spoken at a documentary rate, plus a breath. */
/**
 * SPLIT A MEASURED WINDOW ACROSS THE FRAGMENTS INSIDE IT.
 *
 * When the voiceover has been spoken, a line's length is not a guess any more —
 * it is a start and an end in the file, silences included. The fragments inside
 * that line still have to divide it, and they divide it by the only thing that
 * tracks how long a phrase takes to say: how many words are in it.
 *
 * The remainder goes to the LAST fragment, so the sum is exactly the window and
 * the reel never drifts out of sync with its own narration. Rounding each
 * fragment independently loses a frame here and there, and over a reel that is
 * how the last line ends up cut off.
 */
export function splitWindow(fragments, startSeconds, endSeconds, fps = FPS) {
  const from = Math.round(startSeconds * fps);
  const to = Math.round(endSeconds * fps);
  const total = Math.max(fragments.length, to - from);
  const weights = fragments.map((f) => Math.max(1, f.trim().split(/\s+/).filter(Boolean).length));
  const sum = weights.reduce((a, b) => a + b, 0);

  const out = [];
  let used = 0;
  for (let i = 0; i < fragments.length - 1; i += 1) {
    const frames = Math.max(1, Math.round((weights[i] / sum) * total));
    out.push(frames);
    used += frames;
  }
  out.push(Math.max(1, total - used));
  return out;
}

/** The ESTIMATE — used only when nothing has been spoken yet. */
export function framesFor(text, {min = 45, max = 118} = {}) {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  // Eight frames of breath, not twenty-six. Twenty-six was set when a scene was
  // a whole sentence and there were nine of them; at twenty-odd shots the same
  // padding quietly adds ten seconds of nothing to the reel.
  return Math.max(min, Math.min(max, Math.round((words / RATE) * FPS) + 8));
}

/**
 * The number a slate should set large — WITH WHAT IT COUNTS.
 *
 * "TWENTY" on its own is not a statement, it is a fragment: the line said the
 * ash went twenty MILES up, and the slate threw the miles away. A number needs
 * its noun or it says nothing, so the word that follows it comes too when it is
 * a unit rather than grammar.
 */
const NOT_A_UNIT = /^(and|or|of|the|a|an|in|on|to|for|from|by|with|at|was|were|is|are|had|has|that|this|it|he|she|they)$/i;

function bigNumber(vo) {
  const numeric = /\b\d[\d,.]*\b/;
  const spelled =
    /\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|billion)(\s+(hundred|thousand|million|billion))?\b/i;

  const match = vo.match(numeric) ?? vo.match(spelled);
  if (!match) return '';

  const number = match[0].replace(/[.,]$/, '');
  const after = vo.slice(match.index + match[0].length).trim().split(/\s+/)[0] ?? '';
  const unit = after.replace(/[^a-z]/gi, '');
  return (NOT_A_UNIT.test(unit) || !unit ? number : `${number} ${unit}`).toUpperCase();
}

/**
 * Break a fragment into the beats a WordStack lands one at a time.
 *
 * EVERY WORD SURVIVES. The first version filled three lines of three words and
 * stopped, so "and the road ran four thousand miles across the Sahara" arrived
 * on screen as "and the road ran four thousand miles across the" — the sentence
 * cut off mid-preposition, with nothing anywhere saying a word had been
 * dropped. If a fragment is long the lines get longer; the caption size comes
 * down to match, and that is the trade to make. Silently losing half a sentence
 * is not.
 */
export const CAPTION_LINES = 4;

export function captionLines(text) {
  const words = text.replace(/[.,]\s*$/, '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const perLine = Math.ceil(words.length / Math.min(CAPTION_LINES, Math.ceil(words.length / 2)));
  const lines = [];
  for (let i = 0; i < words.length; i += perLine) lines.push(words.slice(i, i + perLine).join(' '));
  return lines;
}

/** Caption type shrinks as the fragment grows, so four lines still fit the frame. */
function captionSize(lines, rand) {
  const longest = lines.reduce((n, line) => Math.max(n, line.length), 0);
  const base = longest > 22 ? 62 : longest > 16 ? 74 : 88;
  return base + Math.round(rand() * 10);
}

/**
 * THE STACK — a backdrop, and the things standing in front of it.
 *
 * ONE implementation, because both kinds of shot need it and only one of them
 * used to have it. A reel planned before this was six photographs and their
 * continuations were the SAME six photographs from a different corner: eleven
 * scenes, eight files, four of them the previous shot again. The stack was
 * built in the composite branch and nowhere else, so every other template threw
 * the line's pieces away.
 *
 * PLACEMENT FOLLOWS DEPTH. It is not random.
 *
 * The first version scattered pieces with rand(): a near piece could come out
 * small and high in the frame while a far one loomed large, so every layer
 * contradicted the depth it had been given and the shot read as accidental —
 * things standing about, rather than a place seen from somewhere. Three rules
 * fix it, and they are just what perspective and air already do:
 *
 *   NEARER IS BIGGER   size rises with depth
 *   NEARER IS LOWER    its feet sit further down the frame, because the ground
 *                      plane falls away toward the horizon
 *   FURTHER IS FAINTER aerial perspective — distance washes contrast out
 *
 * And they alternate outward from the centre, so near pieces frame the edges
 * and nothing parks itself where the caption goes.
 *
 * `spread` shifts every piece sideways. A continuation is the same room from a
 * different corner, so its pieces must not sit where they sat in the shot
 * before — same stack, new framing, which is a cut rather than a jump.
 */
/**
 * THE DRAWN LAYER — what makes a photograph into a shot.
 *
 * Law 3 of this repo says the premium look is not in the photograph, it is in
 * what gets drawn ON it: the lamp is in the plate, its LIGHT never is. The
 * engine has had that light all along — `Glow` stacks screen-blended radial
 * gradients and scales them with the plate so they cannot slide off it, and it
 * blooms into a bokeh disc when the lens defocuses.
 *
 * The planner asked for it ZERO times. Every shot this pipeline has ever made
 * was a photograph, a slow push and some fog, and the continuation shots did
 * not even get the fog — an empty params object, which is exactly what "bomboş
 * video" means when somebody says it about a finished render.
 *
 * The light comes from ONE side for the whole episode. Real light in a room has
 * a source; a reel whose key light jumps sides every cut has no source, it has
 * a flicker. Height and reach still vary per shot, because the same lamp seen
 * from two places is not the same shape on the frame.
 *
 * It travels with the plate it belongs to (`glowDepth` = the ground's depth).
 * Pinned to the frame instead, it slides off the lamp as the camera pushes and
 * turns into a lens flare — the exact failure law 3 was written about.
 */
/**
 * WHERE THE WORDS GO, AND HOW THEY ARRIVE.
 *
 * The last thing in the frame still being placed by a die. A caption landed at
 * x=84 and a y picked at random between a third and half way down, which is
 * fine over an empty corner and unreadable over a printed map — and "German
 * tanks crossed the Polish border" was set over a printed map of Poland, two
 * kinds of small type fighting, with the caption losing.
 *
 * So the director places it, in fractions, and says how loud its ground is. The
 * derived values below are the fallback for a line that says nothing.
 */
function captionPlacement({shot, rand, durationInFrames, lines}) {
  const text = shot?.text ?? {};
  const at = (v, d) => (v === undefined ? d : Math.round(durationInFrames * Math.min(0.9, Math.max(0, Number(v)))));
  return {
    captionX: text.x === undefined ? 84 : Math.round(WIDTH * Number(text.x)),
    captionY:
      text.y === undefined ? Math.round(between(rand, [300, 1080])) : Math.round(HEIGHT * Number(text.y)),
    captionSize: text.size === undefined ? captionSize(lines, rand) : Math.round(WIDTH * Number(text.size)),
    captionAlign: text.align ?? 'left',
    captionFrame: at(text.at, 4),
    captionEvery: text.every === undefined ? 6 + Math.round(rand() * 4) : Math.round(Number(text.every)),
    /**
     * THE GROUND UNDER THE WORDS. Zero where the picture is dark and empty,
     * heavier where it is busy — a caption over a map needs it and a caption
     * over a night street does not. Derived shots get a little by default,
     * because unreadable is a worse failure than slightly veiled.
     */
    captionScrim: text.scrim === undefined ? 0.34 : round(Number(text.scrim), 2),
  };
}

function drawnLayer({rand, look, side, groundDepth, durationInFrames}) {
  /**
   * THE SOURCE IS OFF-CAMERA. Only its falloff is in the shot.
   *
   * `Glow` builds four gradients and the innermost is a white-hot BULB core.
   * That core belongs on a bulb: law 3 is about a plate that contains a lamp
   * and no light, and the core goes where the lamp is. Put it in open frame
   * with no lamp under it and it is not light, it is a white ball hanging in
   * the room — which is exactly what the first version rendered over a crowd
   * and over the Deep Blue cabinet.
   *
   * So the centre sits far enough past the frame edge that the core never
   * reaches it, and what enters is the wide warm spill. That is how a room is
   * lit: you see the light, not the lamp.
   */
  const size = Math.round(between(rand, [300, 560]));
  const off = Math.round(size * between(rand, [0.6, 1.0]));
  return {
    glowX: side > 0 ? WIDTH + off : -off,
    glowY: Math.round(HEIGHT * between(rand, [0.06, 0.32])),
    glowSize: size,
    glowIntensity: round(between(rand, [0.4, 0.7]), 2),
    glowWarm: look.accent,
    glowDepth: groundDepth,
    // THE LENS HUNTS. A vintage focus-hunt is the reference kit's signature
    // camera move and the thing that makes a still plate feel photographed
    // rather than pasted; it also gives the drawn light something to bloom
    // for. It used to be a coin flip, so half the reel opened dead sharp.
    focusPx: Math.round(between(rand, [7, 15])),
    fog: round(between(rand, look.fog), 2),
  };
}

/**
 * THE DRAWN OBJECTS THAT STAND IN THE SHOT.
 *
 * The reference reel runs on about twenty assets and only four of them are
 * backdrops. This pipeline made SIX backdrops and called it an episode, and
 * spent a fortnight trying to buy the other fourteen from a photo search that
 * cannot sell them — while `Plaque`, `WireFrame` and `Beam` sat finished in
 * `engine/draw/`, wired into zero templates.
 *
 * So the other fourteen are DRAWN, which is law 2 of this repo and always was:
 * people and places are photographs, everything else is drawn. A plaque, a
 * front page, an index card, a print's white border, a wireframe, a shaft of
 * light. No file, no search, no keyer, and they cannot come back as a
 * washing-machine door.
 *
 * TWO RULES, and they are the same two the motifs are held to, because a
 * graphic that appears on every shot is not a device, it is a filter:
 *
 *   IT MUST HAVE SOMETHING TO SAY   a plaque needs the line's own label, a card
 *       its own heading. Nothing is invented to fill a slot — only `wire` and
 *       `beam` are pure graphics, and they are the ones held back hardest.
 *   NEVER THE SAME THING TWICE RUNNING   the kind that opened the last shot
 *       cannot open this one.
 */
function planProps({line, rand, look, side, durationInFrames, recentProps, beat}) {
  /**
   * A DIRECTED SHOT WINS OVER A DERIVED ONE — always, and without argument.
   *
   * Everything below this line is the fallback: rules and a seeded die, which
   * is what the planner had instead of a director. It produces the same reel
   * every time with different photographs in it, and it composes nonsense —
   * a front page hanging in mid-air in front of a university portico, because
   * nothing decided to put it there. A die did.
   *
   * When the brief carries a `shot`, somebody THOUGHT about this frame: what
   * the one move is, what stands in it, how big, where, and when it lands. That
   * is the whole method the reference build uses and the one thing this
   * pipeline never had. It is compiled, not second-guessed.
   *
   * Fractions in, pixels out. A director says "eight tenths of the frame, just
   * left of centre, a third of the way in"; only the compiler should care that
   * the frame is 1080 by 1920.
   */
  // AN EMPTY LIST IS A DECISION. A director who leaves a shot bare has said
  // something — the reference reel's power comes partly from the shots that
  // carry nothing, and falling through to the die on `props: []` overrules the
  // one instruction that is hardest to give and easiest to lose.
  const directed = line?.shot?.props;
  if (Array.isArray(directed)) {
    return directed.map((prop) => {
      /**
       * SAY IT HERE, WHERE THE BRIEF IS. An unknown kind used to travel all the
       * way into scene-config.json and fail at `npm run validate`, which then
       * blamed the CONFIG — a generated file nobody wrote — for something a
       * hand-typed line got wrong two steps earlier. The brief is the thing
       * that needs changing, so the brief is what the message names.
       */
      if (!PROP_KINDS.includes(prop?.kind)) {
        throw new BriefError(
          `line "${line.slug ?? '?'}": prop kind "${prop?.kind}" is not one of ${PROP_KINDS.join(', ')}`,
        );
      }
      const width = Math.round(WIDTH * Math.min(0.98, Math.max(0.15, Number(prop.size) || 0.4)));
      const margin = width / 2 + 24;
      return {
        kind: prop.kind,
        text: prop.text,
        heading: prop.heading,
        lines: prop.lines,
        masthead: prop.masthead,
        date: prop.date,
        stamp: prop.stamp,
        caption: prop.caption,
        shape: prop.shape,
        colour: prop.colour ?? (prop.kind === 'wire' || prop.kind === 'beam' ? look.accent : undefined),
        width,
        // Clamped even here. A director gives an intention, not a guarantee that
        // the object's own width keeps it on screen, and "Hanover · 1956"
        // delivered as "Hanover · 19" is nobody's intention.
        x: Math.round(Math.min(WIDTH - margin, Math.max(margin, WIDTH * num(prop.x, 0.5, 0, 1)))),
        y: Math.round(HEIGHT * num(prop.y, 0.55, 0, 1)),
        depth: round(num(prop.depth, 0.6, 0, 1), 2),
        rotate: num(prop.tilt, 0, -45, 45),
        from: Math.round(durationInFrames * num(prop.at, 0, 0, 0.8)),
      };
    });
  }

  const props = [];
  const banned = new Set(recentProps);
  const use = (kind) => !banned.has(kind);

  /**
   * WHERE THINGS STAND — and it is not free choice.
   *
   * Two rules, both learned from a contact sheet. Props alternate across the
   * frame so they do not pile up; and whatever x comes out, the whole object
   * has to be INSIDE the frame. The first version put a plaque at the left lane
   * and let its own width run off the edge, so a caption reading "Hanover ·
   * 1956" was delivered as "Hanover · 19".
   */
  const lane = (i, w) => {
    const wanted = WIDTH * (i % 2 === 0 ? between(rand, [0.3, 0.42]) : between(rand, [0.58, 0.72]));
    const margin = w / 2 + 40;
    return Math.round(Math.min(WIDTH - margin, Math.max(margin, wanted)));
  };
  const stagger = () => Math.round(durationInFrames * between(rand, [0.06, 0.3]));

  // A MUSEUM PLAQUE, under the picture — the reference kit's opening shot.
  // It carries the line's own label: a date, a place. Never a summary.
  if (line.kicker && use('plaque')) {
    const plaqueWidth = Math.round(between(rand, [360, 470]));
    props.push({
      kind: 'plaque',
      text: String(line.kicker),
      depth: round(between(rand, [0.5, 0.72]), 2),
      x: lane(props.length, plaqueWidth),
      // LOW. A museum caption hangs under the thing it captions, and keeping it
      // in its own band is what stops the front page landing on top of it —
      // which is how a plaque and a newspaper shared a shot and only one of
      // them could be read.
      y: Math.round(HEIGHT * between(rand, [0.7, 0.8])),
      width: plaqueWidth,
      rotate: round(between(rand, [-2.5, 2.5]), 1),
      from: stagger(),
    });
  }

  // A FRONT PAGE. Only where the line STATES something — a title is a headline
  // and a headline is what a newspaper is for.
  if (line.title && use('newspaper')) {
    /**
     * A MASTHEAD IS A PAPER'S NAME, NOT A SENTENCE.
     *
     * The first version put the line's `footer` up there and cut it to
     * twenty-two characters, so the front page read "THERE WAS NO MACHINE Y".
     * The masthead is set at the largest size on the sheet — whatever goes
     * there has to be two or three words that were always going to be two or
     * three words. The line's own statement is the HEADLINE, which is what a
     * headline is; the label goes in the dateline, and only when a plaque is
     * not already carrying it in the same frame.
     */
    const carried = props.some((p) => p.kind === 'plaque');
    const paperWidth = Math.round(between(rand, [360, 470]));
    props.push({
      kind: 'newspaper',
      masthead: pick(rand, ['THE RECORD', 'THE DAILY', 'THE GAZETTE', 'THE CHRONICLE', 'THE HERALD']),
      text: String(line.title),
      date: !carried && line.kicker ? String(line.kicker) : undefined,
      depth: round(between(rand, [0.62, 0.86]), 2),
      x: lane(props.length, paperWidth),
      y: Math.round(HEIGHT * between(rand, [0.4, 0.54])),
      width: paperWidth,
      rotate: round(between(rand, [-7, 7]), 1),
      from: stagger(),
    });
  }

  // INDEX CARDS, one per thing listed. The reference lands three of them from
  // three directions about a second apart; the stagger is the whole effect.
  for (const [i, item] of (line.items ?? []).slice(0, 3).entries()) {
    const [, heading, body] = String(item).split('|');
    if (!heading) continue;
    props.push({
      kind: 'card',
      heading,
      lines: body ? [body] : [],
      depth: round(0.5 + i * 0.16, 2),
      x: lane(i, 430),
      y: Math.round(HEIGHT * (0.46 + i * 0.11)),
      width: Math.round(between(rand, [380, 470])),
      rotate: round(between(rand, [-8, 8]), 1),
      from: Math.round(durationInFrames * 0.1) + i * Math.round(durationInFrames * 0.16),
    });
  }

  /**
   * A SHAFT OF LIGHT, from the side the room is lit from.
   *
   * The one prop that is pure atmosphere, so it is the one held to the light's
   * own rule: it comes from the same side all episode. A beam that swaps sides
   * between cuts is not a window, it is a mistake.
   */
  if (use('beam') && rand() > 0.45) {
    props.push({
      kind: 'beam',
      depth: round(between(rand, [0.15, 0.4]), 2),
      x: side > 0 ? Math.round(WIDTH * between(rand, [0.74, 0.94])) : Math.round(WIDTH * between(rand, [0.06, 0.26])),
      y: Math.round(HEIGHT * between(rand, [-0.05, 0.08])),
      width: Math.round(between(rand, [220, 380])),
      rotate: side > 0 ? -Math.round(between(rand, [8, 22])) : Math.round(between(rand, [8, 22])),
      opacity: round(between(rand, [0.5, 0.85]), 2),
      colour: look.accent,
      from: 0,
    });
  }

  /**
   * A HAND-DRAWN OUTLINE around something in the frame.
   *
   * The reference frames its props inside wireframe diamonds that draw
   * themselves on. It carries no words, so it is the easiest thing here to
   * overuse and the fastest to become wallpaper — it is allowed only where the
   * shot is otherwise bare, and never on the closing beat, where the frame
   * belongs to the verdict.
   */
  if (use('wire') && props.length < 2 && beat !== 'close') {
    props.push({
      kind: 'wire',
      shape: pick(rand, ['diamond', 'circle', 'rect']),
      depth: round(between(rand, [0.55, 0.85]), 2),
      x: lane(props.length, 380),
      y: Math.round(HEIGHT * between(rand, [0.4, 0.62])),
      width: Math.round(between(rand, [260, 420])),
      colour: look.accent,
      from: stagger(),
    });
  }

  /**
   * NO SHOT LEAVES EMPTY-HANDED.
   *
   * The no-repeat rule and the coin flip can agree at the wrong moment: a line
   * with no label, no title and nothing listed, following a shot that used the
   * one graphic it had left, comes out carrying nothing — a photograph and a
   * slow push, which is the exact thing all of this exists to stop. So the two
   * pure graphics take turns rather than competing: whichever of them did NOT
   * appear last is allowed through here.
   *
   * This is the fallback, not the rule. Every prop above still has to have
   * something of the line's own to say.
   */
  if (!props.length) {
    props.push(
      banned.has('wire')
        ? {
            kind: 'beam',
            depth: round(between(rand, [0.15, 0.4]), 2),
            x: side > 0 ? Math.round(WIDTH * 0.86) : Math.round(WIDTH * 0.14),
            y: Math.round(HEIGHT * between(rand, [-0.05, 0.06])),
            width: Math.round(between(rand, [240, 380])),
            rotate: side > 0 ? -16 : 16,
            opacity: round(between(rand, [0.5, 0.8]), 2),
            colour: look.accent,
            from: 0,
          }
        : {
            kind: 'wire',
            shape: pick(rand, ['diamond', 'circle', 'rect']),
            depth: round(between(rand, [0.55, 0.85]), 2),
            x: lane(0, 380),
            y: Math.round(HEIGHT * between(rand, [0.4, 0.62])),
            width: Math.round(between(rand, [260, 420])),
            colour: look.accent,
            from: stagger(),
          },
    );
  }

  return props;
}

/**
 * A DIRECTED STACK — the photographic plates, placed by hand.
 *
 * `planProps` let a director place the DRAWN objects and the die kept placing
 * the photographed ones, which is half a law. A kit of real cut-outs makes that
 * gap obvious immediately: a figure has to stand at a particular point with his
 * feet on a particular pavement, and no rule derives that from a sentence.
 *
 * Fractions in, pixels out, same as everywhere else. `height` is a fraction of
 * the FRAME HEIGHT because a standing figure is measured by how tall he is;
 * props take `size` as a fraction of the width because a sheet of paper is
 * measured across. Two names, so the two can never be confused for each other.
 */
/**
 * A FILE NAME, AND NOTHING ELSE.
 *
 * The episode folder IS the render's public directory, so a path that climbs
 * out of it does not fail — it resolves, and pulls whatever it lands on into
 * the bundle. A brief naming `../../../../etc/passwd` produced exactly that,
 * because asset paths were interpolated straight into `assets/${...}` while
 * `audio` had been guarded against the same thing since the beginning.
 *
 * A brief has no legitimate reason to name a directory: its artwork lives in
 * its own assets folder. So the name is reduced to a base name and anything
 * left that is not a file name is refused rather than quietly rewritten —
 * silently loading a different file than the one asked for is worse than
 * stopping.
 */
class BriefError extends Error {}

function assetFile(name, where) {
  const raw = String(name ?? '').trim();
  const base = raw.split(/[\\/]/).pop() ?? '';
  if (!base || base === '.' || base === '..' || base !== raw) {
    throw new BriefError(`${where}: "${raw}" is not a file name — an asset lives in the episode's own assets folder`);
  }
  return base;
}

function directedStack({shot, rand, durationInFrames = 90}) {
  const assets = {};
  const layers = [];
  /** Its own beat and its own move, both fractions of the shot. */
  const beat = (layer) =>
    layer.at === undefined ? {} : {from: Math.round(durationInFrames * Math.min(0.85, Math.max(0, Number(layer.at))))};
  const move = (layer) => ({
    ...(layer.enter ? {enter: layer.enter, enterDistance: Math.round(WIDTH * Number(layer.enterDistance ?? 0.9))} : {}),
    ...(layer.swing ? {swing: Number(layer.swing)} : {}),
    ...(layer.drift ? {drift: Math.round(WIDTH * Number(layer.drift))} : {}),
  });
  for (const [i, layer] of (shot.layers ?? []).entries()) {
    const role = String(layer.role ?? `plate${i}`).replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    // The file is named by the EPISODE, which is where file names belong. The
    // engine still never sees it: the template reads a role.
    assets[layer.optional ? `?${role}` : role] = `assets/${assetFile(layer.asset, `layer "${role}"`)}`;
    if (layer.fill !== false && !layer.height) {
      layers.push({
        role,
        depth: round(num(layer.depth, 0.2, 0, 1), 2),
        anchor: 'fill',
        ...(layer.alive ? {alive: true} : {}),
        ...beat(layer),
        ...move(layer),
      });
      continue;
    }
    layers.push({
      role,
      depth: round(num(layer.depth, 1, 0, 1), 2),
      anchor: 'bottom',
      height: Math.round(HEIGHT * num(layer.height, 0.5, 0.02, 1.6)),
      x: Math.round(WIDTH * num(layer.x, 0.5, 0, 1)),
      y: Math.round(HEIGHT * num(layer.y, 0.94, 0, 1)),
      ...(layer.alive ? {alive: true} : {}),
      ...(layer.shadow
        ? {shadow: true, shadowSkew: Number(layer.shadowSkew) || -53, shadowOpacity: Number(layer.shadowOpacity) || 0.55}
        : {}),
      ...(layer.opacity !== undefined ? {opacity: round(Number(layer.opacity), 2)} : {}),
      ...beat(layer),
      ...move(layer),
    });
  }
  return {assets, layers, groundDepth: layers[0]?.depth ?? 0.2};
}

function buildStack({line, ground, rand, groundDepth, spread = 0, cutouts = false}) {
  /**
   * PIECES ARE ONLY PLACED WHERE THERE IS A SUPPLY OF THEM.
   *
   * The brief still names them and the writer is still held to naming them —
   * that authorship is right and costs nothing the day a supply exists. But
   * placing one requires a CLEAN CUT-OUT, and this pipeline has no source of
   * those. Commons is full of photographs of objects in rooms; keyed, a bench
   * photographed in a park comes back as a rectangle, and a search for a
   * magnifying glass comes back as a washing-machine door that keys perfectly
   * and is still a washing-machine door. No threshold reaches that: it is a
   * supply problem wearing a quality problem's clothes.
   *
   * The reference kit did not have this problem because it did not use a photo
   * search — everything that had to be INVENTED was generated to spec and
   * background-removed. Turn `"cutouts": true` on in the brief the day that
   * generator is wired, and every piece below is placed again unchanged.
   */
  const pieces = cutouts ? (line.pieces ?? []).slice(0, 4) : [];

  /**
   * A BACKDROP WITH NOTHING IN FRONT OF IT TAKES THE PUSH ITSELF.
   *
   * The shallow depth is there so the pieces can out-run the wall — that
   * difference IS the depth. With no pieces the same number means nothing
   * moves at all: a shot that sits at 4% of a camera push is a still frame
   * with grain on it.
   */
  const depth = pieces.length ? groundDepth : round(between(rand, [0.72, 0.95]), 2);

  const assets = {ground};
  const layers = [{role: 'ground', depth, anchor: 'fill'}];
  const highlights = [];

  // WHICH SIDE THE STACK OPENS ON is the episode's, not the index's. Alternating
  // strictly from i=0 meant the near piece went left in every scene of every
  // reel ever planned — and since the lateral offset grew with depth until it
  // ran past the frame, it did not merely go left, it CLAMPED to x=150. The
  // nearest, largest, shadow-casting piece was pinned to the same pixel of the
  // same edge in every shot of every episode.
  const flip = rand() > 0.5 ? 1 : -1;

  pieces.forEach((piece, i) => {
    const role = piece.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    assets[`?${role}`] = `assets/${role}.png`;
    const depth = round(0.26 + (i / Math.max(1, pieces.length - 1 || 1)) * 0.58, 2);
    const jitter = (span) => Math.round((rand() - 0.5) * span);
    const side = (i % 2 === 0 ? -1 : 1) * flip;

    /**
     * THE NEAREST PIECE CATCHES THE LIGHT.
     *
     * Only when the sentence is about gold or fire — the same law as the
     * motifs. A highlight on every shot is a filter; a highlight on the one
     * line about treasure is the line.
     */
    if (i === pieces.length - 1 && earnsHighlight(line)) {
      highlights.push({index: layers.length});
    }

    // A near piece cropped by the frame edge is good framing; a near piece
    // whose CENTRE is off-frame is a sliver. The old guard was a clamp, which
    // turned every overflow into the same pixel — so overflow now MIRRORS to
    // the other side of the frame instead, which is a different composition
    // rather than a wall. The clamp stays underneath as a last resort only.
    const offset = 120 + depth * 300;
    const wanted = Math.round(WIDTH / 2 + side * offset + spread + jitter(60));
    const mirrored =
      wanted < 150 || wanted > WIDTH - 150
        ? Math.round(WIDTH / 2 - side * offset + spread + jitter(40))
        : wanted;

    layers.push({
      role,
      depth,
      anchor: 'bottom',
      x: Math.min(WIDTH - 150, Math.max(150, mirrored)),
      y: Math.round(1150 + depth * 620 + jitter(50)),
      height: Math.round(320 + depth * 760 + jitter(70)),
      opacity: round(0.5 + depth * 0.5, 2),
      ...(depth > 0.7 ? {shadow: true, shadowSkew: -(44 + Math.round(rand() * 26)), shadowOpacity: 0.34} : {}),
    });
  });

  /**
   * THE HIGHLIGHT IS THE PIECE AGAIN — the shadow trick with colour instead of
   * black. A second copy of the SAME file, laid exactly over the first,
   * recoloured and switched on and off on hold keyframes. No new asset, and it
   * goes LAST so it sits over everything it is a copy of.
   */
  for (const hit of highlights) {
    layers.push({
      ...layers[hit.index],
      recolour: 'sepia(1) saturate(5) hue-rotate(18deg) brightness(1.15)',
      // Instant on, instant off. A ramp turns a fluorescent strike into a
      // dissolve, which is the one thing it must not be.
      flicker: [
        [23, 29],
        [32, 62],
        [64, 72],
      ],
      shadow: false,
    });
  }

  return {assets, layers, groundDepth: depth};
}

/**
 * A CONTINUATION SHOT — the same picture, seen differently, saying the next
 * thing.
 *
 * The cheapest shot in the reel and the one that fixes its pace: no new
 * artwork, a hard cut, a different corner of the same plate and the next
 * fragment of the sentence landing over it. The reference reel lives on these —
 * one photograph of a man outside a building carries three cuts while the
 * narration moves from "a small startup" to "called Netflix" to "pitched
 * Blockbuster".
 *
 * It always pushes from a DIFFERENT anchor than the shot before it. Cutting
 * from a plate to the same plate on the same move is not a cut, it is a jump.
 */
function planContinuation({line, index, part, fragment, frames: measured, rand, look, previousTransition, plate, side, cutouts, recentProps}) {
  const assetBase = `s${String(index + 1).padStart(2, '0')}-${line.slug ?? 'shot'}`;
  const choices = look.transitions.filter((k) => k !== previousTransition);
  const corner = part % 4;
  const frames = measured ?? framesFor(fragment);
  const lines = captionLines(fragment);
  // Alternate the direction of travel. Two pushes on one plate look like the
  // same shot played twice; a push followed by a pull-back looks like an edit.
  const pullBack = part % 2 === 1;

  // THE SAME ROOM, NOT THE SAME SLIDE. The stack is rebuilt rather than
  // dropped: the pieces that gave the first shot its depth are still standing
  // there when we cut, and the whole reason to cut is to see them from
  // somewhere else. Without this the continuation was one flat plate, which is
  // how a six-scene reel came out as eleven scenes and eight files.
  //
  // The ground sits SHALLOW here, not at 0.7-0.95 as it did when it was the
  // only layer: a backdrop that takes nearly the whole push leaves no room for
  // anything in front of it to move faster, and moving faster is the only thing
  // that puts a piece in front.
  // THE SAME DIRECTED ROOM. A continuation is another angle on the shot before
  // it, so when that shot was placed by hand this one stands in the same set —
  // falling back to a derived backdrop here asks for a file the episode never
  // had and loses every plate the director put in the frame.
  const {assets, layers, groundDepth} = line?.shot?.layers?.length
    ? directedStack({shot: line.shot, rand, durationInFrames: frames})
    : buildStack({
    line,
    ground: plate ?? `assets/${assetBase}-bg.png`,
    rand,
    cutouts,
    groundDepth: round(between(rand, [0.06, 0.16]), 2),
    // Walk the pieces the opposite way to the anchor, so the corner we push
    // into is the corner they are NOT standing in.
    spread: (corner === 0 || corner === 3 ? 1 : -1) * (90 + Math.round(rand() * 120)),
  });

  return {
    id: `${assetBase}-${String.fromCharCode(97 + part)}`,
    sceneType: 'composite',
    voText: fragment,
    durationInFrames: frames,
    transition: {kind: pick(rand, choices), frames: 7 + Math.round(rand() * 5)},
    assets,
    layers,
    // A continuation is the same room seen from another corner, so the drawn
    // objects are still standing in it — and it is the shot that used to carry
    // nothing at all.
    // ALREADY STANDING. A prop that springs in again on every cut is a prop
    // being placed over and over; by the continuation the hand has gone and the
    // thing is simply in the room.
    props: planProps({line, rand, look, side, durationInFrames: frames, recentProps, beat: 'middle'}).map((p) => ({
      ...p,
      from: 0,
    })),
    params: {
      /**
       * THE GROUND POINT SURVIVES THE CUT.
       *
       * Walking the anchor round the corners is right for a plate: it stops two
       * shots of one photograph being the same framing twice. It is WRONG for a
       * directed set, where the anchor is a place on the floor that a figure is
       * standing on — move it and he scales about somebody else's feet. A man
       * outside a dying storefront came back standing on its ROOF in the
       * continuation, and only in the continuation.
       */
      ...(Array.isArray(line?.shot?.anchor)
        ? {
            anchorX: Math.round(WIDTH * line.shot.anchor[0]),
            anchorY: Math.round(HEIGHT * line.shot.anchor[1]),
          }
        : {
            anchorX: Math.round(WIDTH * (corner === 0 || corner === 3 ? 0.26 : 0.74)),
            anchorY: Math.round(HEIGHT * (corner < 2 ? 0.3 : 0.78)),
          }),
      // A wider throw than the old 1.14→1.3, which was too small to register as
      // a new framing at all — four shots of one gate, all the same size.
      pushFrom: pullBack ? round(between(rand, [1.34, 1.5]), 2) : 1,
      pushTo: pullBack ? round(between(rand, [1.02, 1.1]), 2) : round(between(rand, [1.3, 1.48]), 2),
      pushEndFrame: Math.round(frames * 0.94),
      accent: look.accent,
      caption: lines,
      ...captionPlacement({shot: line.shot, rand, durationInFrames: frames, lines}),
      // A CONTINUATION IS A SHOT, NOT A SLIDE. Its params used to carry the
      // push and the caption and nothing else — no light, no fog, no focus —
      // so half the reel was a photograph moving slowly with grain on it.
      ...drawnLayer({rand, look, side, groundDepth, durationInFrames: frames}),
    },
  };
}

function planScene({line, index, total, fragment, frames, rand, look, previousTransition, recentMotifs, recentTypes, side, cutouts, recentProps}) {
  const beat = beatOf(line, index, total);
  /**
   * THE DIRECTOR PICKS THE TEMPLATE. The rotation below is the fallback.
   *
   * A beat rotation gives every episode the same skeleton — hook, number,
   * list, close, in that order, forever — which is precisely why every reel
   * this pipeline made felt like the last one with new photographs in it.
   */
  let sceneType = DIRECTED_TEMPLATES.has(line?.shot?.template) ? line.shot.template : SCENE_FOR[beat];
  // RHYTHM. Never the same template as the shot before it. The old rule waited
  // for THREE in a row, which let the reel run portal, portal back to back —
  // and two seven-second flights into a picture, one after the other, is the
  // single most tiring thing this pipeline has produced.
  // …unless the line's CONTENT decides the template. Pieces to stand in a frame
  // and places to join up both need a composite; swapping one out for a title
  // card in the name of rhythm drops the artwork the line was written around,
  // and the recipe for it is then drawn for nothing.
  // A DIRECTED TEMPLATE IS FINAL. The rhythm rule below exists to stop a
  // DERIVED rotation repeating itself; turning a director's choice into its
  // opposite for rhythm throws away the shot that was designed and silently
  // substitutes one that was not — three consecutive scenes of a hand-built
  // reel came out as title cards that way.
  const contentBound = Boolean(line.pieces?.length || line.stops?.length >= 2 || line.shot?.template);
  if (!contentBound && recentTypes.length && recentTypes[recentTypes.length - 1] === sceneType) {
    sceneType = sceneType === 'composite' ? 'title-slate' : 'composite';
  }
  // The shot lasts as long as ITS FRAGMENT takes to say — not as long as the
  // whole sentence does. That one change is what stopped every scene coming out
  // at the ceiling.
  const durationInFrames = frames ?? framesFor(fragment ?? line.vo);

  // Never the same arrival twice running: a repeated transition stops being a
  // choice and becomes a tic. Short, too — a cut that takes half a second is a
  // dissolve, and this reel is meant to CUT.
  const choices = look.transitions.filter((k) => k !== previousTransition);
  const transition = index === 0 ? null : {kind: pick(rand, choices), frames: 7 + Math.round(rand() * 5)};

  const assetBase = `s${String(index + 1).padStart(2, '0')}-${(line.slug ?? beat)}`;
  const id = assetBase;
  const scene = {id, sceneType, voText: fragment ?? line.vo, durationInFrames};

  /**
   * THE GRADE IS PART OF THE SENTENCE.
   *
   * The reference build pulls the sombre beat down on its own — saturate 0.62
   * against the reel's 0.86 — and it is the cheapest way a shot says how to
   * feel about what it is showing. Only where the line earns it: a reel where
   * every scene is graded differently has no grade at all, it has a wobble.
   */
  const shift = GRADE_SHIFT[beat === 'close' ? 'close' : motifFor(line, recentMotifs, sceneType)];
  if (shift) scene.gradeOverride = shift;
  if (transition) scene.transition = transition;

  const backdrop = `assets/${id}-bg.png`;
  const motif = motifFor(line, recentMotifs, sceneType);

  if (sceneType === 'title-slate') {
    // A DIRECTED BACKGROUND, here too. These two templates are graphics-first
    // and derive their own plate, which quietly ignored an episode that had
    // named its own — the closing card asked for a file the brief never had.
    scene.assets = line?.shot?.layers?.length
      ? directedStack({shot: line.shot, rand, durationInFrames}).assets
      : {background: backdrop};
    // A hand-written title can BE the number — "TWELVE YEARS" — and the old
    // rule only looked at the voiceover on the `number` beat, so a slate whose
    // whole point was a figure got neither the count nor the spin.
    const number = bigNumber(line.title ?? '') || (beat === 'number' ? bigNumber(line.vo) : '');
    const titleFrame = 4 + Math.round(rand() * 6);
    scene.params = {
      scrim: round(between(rand, [0.36, 0.54])),
      kicker: line.kicker ?? '',
      title: (line.title ?? number ?? '').toString().toUpperCase(),
      footer: line.footer ?? '',
      titleFrame,
      titleSize: number ? 230 : 124,
      creep: round(between(rand, [1.04, 1.1]), 3),
      accent: look.accent,
      field: look.field,
      fieldColours: look.fieldColours,
      ...motifParams(motif, {rand, from: titleFrame + 8, accent: look.accent, stops: line.stops}),
    };
    /**
     * A FIGURE WORTH SAYING IS WORTH COUNTING TO.
     *
     * Only above ten: counting to three is a stutter, not a sum. And only when
     * the number is the point of the card — a date counting up from zero would
     * be nonsense, so a four-digit year is left where it is.
     */
    const digits = Number(String(number).replace(/[^\d]/g, ''));
    const isYear = /^(1[0-9]{3}|20[0-9]{2})$/.test(String(number).replace(/[^\d]/g, ''));
    if (number && digits >= 10 && !isYear) {
      if (look.numbers === 'slot') {
        // The reel needs something to rattle through. Its decoys are the same
        // ORDER of magnitude either side, so the stop lands on a choice rather
        // than on the only legible option.
        //
        // A YEAR NEVER SPINS. "2012" rattling through THOUSAND and FIFTY says
        // the date could have been any of them, which is not what a date means
        // — and it is why a slate about the year it learned to see came up
        // reading TWENTY.
        scene.params.spinTo = String(number).toUpperCase();
        scene.params.spinReel = SPIN_DECOYS;
        scene.params.spinFrames = Math.max(14, Math.round(durationInFrames * 0.4));
      } else {
        scene.params.countTo = digits;
        scene.params.countOver = Math.round(durationInFrames * 0.55);
        if (line.countSuffix) scene.params.countSuffix = line.countSuffix;
      }
    } else if (number && !isYear && look.numbers === 'slot') {
      // A word-number — TWELVE, FIFTY — has nothing to count to, but it spins.
      scene.params.spinTo = String(number).toUpperCase();
      scene.params.spinReel = SPIN_DECOYS;
      scene.params.spinFrames = Math.max(14, Math.round(durationInFrames * 0.4));
    }
    if (rand() > 0.45) {
      Object.assign(scene.params, {
        mark: look.mark,
        markX: 260,
        markY: number ? 820 : 1160,
        markWidth: 560,
        markHeight: number ? 300 : 96,
        markFrame: Math.round(durationInFrames * 0.34),
      });
    }
  } else if (sceneType === 'evidence-board') {
    // A DIRECTED BACKGROUND, here too. These two templates are graphics-first
    // and derive their own plate, which quietly ignored an episode that had
    // named its own — the closing card asked for a file the brief never had.
    scene.assets = line?.shot?.layers?.length
      ? directedStack({shot: line.shot, rand, durationInFrames}).assets
      : {background: backdrop};
    const items = (line.items ?? []).slice(0, 3);
    scene.params = {
      bgScale: round(between(rand, [1.05, 1.12]), 3),
      scrim: round(between(rand, [0.18, 0.32])),
      focusPx: Math.round(between(rand, [6, 11])),
      itemWidth: 520 + Math.round(rand() * 60),
      itemFrames: items.map((_, i) => 10 + i * (36 + Math.round(rand() * 14))),
      items,
      caption: line.caption ?? [],
      captionX: 84,
      captionY: 190 + Math.round(rand() * 60),
      captionFrame: 6,
      captionSize: 82 + Math.round(rand() * 10),
      captionRecedeAt: Math.round(durationInFrames * 0.45),
    };
  } else if (sceneType === 'portal-zoom-reveal') {
    // A DIRECTED PORTAL NAMES ITS OWN THREE PLATES. The wall it hangs on, the
    // photograph we fly into and the frame that flies past are three different
    // files with three different jobs, and deriving two of them from one
    // backdrop is how a flight into a picture became a zoom on a wall.
    const directedPortal = line?.shot?.layers?.length ? directedStack({shot: line.shot, rand, durationInFrames}) : null;
    scene.assets = directedPortal ? directedPortal.assets : {wall: backdrop, photo: `assets/${id}-photo.png`};
    const push = Math.round(durationInFrames * 0.36);
    scene.params = {
      frameWidth: 700 + Math.round(rand() * 140),
      frameRatio: round(between(rand, [0.9, 1.3]), 2),
      pushEndFrame: push,
      detachFrame: push + 22,
      throughEndFrame: push + 44,
      weldRatio: round(between(rand, [0.34, 0.44]), 3),
      wallScaleEnd: round(between(rand, [5, 7]), 1),
      accent: look.accent,
      // Words land once the picture has, not during the flight — a caption
      // competing with the one move the shot exists for is a caption nobody
      // reads and a move nobody watches.
      caption: line.caption ?? [],
      captionX: 84,
      captionY: Math.round(between(rand, [1180, 1520])),
      captionFrame: push + 48,
      captionEvery: 7 + Math.round(rand() * 4),
      captionSize: 84 + Math.round(rand() * 10),
      captionRecedeAt: Math.max(1, durationInFrames - 18),
      // AFTER the arrival. The first half of this shot is the flight into the
      // picture; the second half is a photograph sitting still, and that is the
      // half a portrait wants gold falling past it.
      ...motifParams(motif, {rand, from: push + 50, accent: look.accent, stops: line.stops}),
    };
  } else {
    // COMPOSITE — the stack. Pieces are optional at RENDER time, so a piece
    // that fails to draw costs this shot some depth and never costs the reel;
    // they are not optional at WRITING time, which is where the brief is
    // refused for handing over six photographs.
    // A DIRECTED SHOT WINS. Same law as the props: what somebody thought about
    // beats what a rule derived, and the rule is only the fallback.
    const stack = line?.shot?.layers?.length
      ? directedStack({shot: line.shot, rand, durationInFrames})
      : buildStack({
          line,
          ground: backdrop,
          rand,
          cutouts,
          groundDepth: round(between(rand, [0.04, 0.12]), 2),
        });
    scene.assets = stack.assets;
    scene.layers = stack.layers;
    // THE OTHER FOURTEEN ASSETS, DRAWN. See planProps: the reference reel is
    // four backdrops and sixteen graphics, and this pipeline was making six
    // backdrops and nothing else.
    scene.props = planProps({line, rand, look, side, durationInFrames, recentProps, beat});

    const anchor = line?.shot?.anchor;
    scene.params = {
      // THE GROUND POINT IS THE DIRECTOR'S. Every plate scales about it, so it
      // is the man's feet or it is nothing — a derived centre puts him on air.
      anchorX: Math.round(WIDTH * (Array.isArray(anchor) ? anchor[0] : 0.5)),
      anchorY: Math.round(Array.isArray(anchor) ? HEIGHT * anchor[1] : 1700),
      // THE CAMERA IS THE DIRECTOR'S. A push and a pull-back are two different
      // shots, and which one this line wants is not a thing a die should decide.
      pushFrom: round(Number(line?.shot?.camera?.from) || 1, 2),
      pushTo: round(Number(line?.shot?.camera?.to) || between(rand, [1.22, 1.5]), 2),
      pushEndFrame: Math.round(durationInFrames * 0.86),
      ...drawnLayer({rand, look, side, groundDepth: stack.groundDepth, durationInFrames}),
      ...(line?.shot?.camera?.focus === 'sharp' ? {focusPx: 0} : {}),
      caption: line.caption ?? [],
      ...captionPlacement({shot: line.shot, rand, durationInFrames, lines: line.caption ?? []}),
      captionRecedeAt: Math.round(durationInFrames * 0.72),
      accent: look.accent,
      ...motifParams(motif, {rand, from: 18 + Math.round(rand() * 14), accent: look.accent, stops: line.stops}),
    };
    if (line.accentLine !== undefined) scene.params.captionAccent = line.accentLine;
  }

  /**
   * A PORTAL LANDS IN A ROOM, and a room has objects in it.
   *
   * The composite branch sets these; the portal did not, so two of ten shots
   * carried nothing drawn at all. Its template holds them back until the flight
   * is over — a plaque the camera flies past is not a plaque — so they cost the
   * arrival nothing and give the second half of the shot something to be.
   */
  if (sceneType !== 'composite') {
    scene.props = planProps({line, rand, look, side, durationInFrames, recentProps, beat});
  }

  if (line.onScreen) {
    scene.onScreenText = [
      {
        text: line.onScreen,
        atFrame: Math.round(durationInFrames * 0.6),
        durationInFrames: Math.round(durationInFrames * 0.32),
        style: look.textStyle,
        position: 'bottom',
      },
    ];
  }

  return {
    scene,
    motif,
    backdropPrompt: line.image,
    photoPrompt: line.artefact,
    backdropCommons: line.imageCommons,
    photoCommons: line.artefactCommons,
    pieces: line.pieces ?? [],
    // The line travels with its plan so the recipe builder can read the
    // scene's own material list off it.
    line,
  };
}

async function main() {
  const args = parseArgs();
  const episodeId = typeof args.episode === 'string' ? args.episode : null;
  if (!episodeId) {
    console.error('Usage: node scripts/plan-episode.mjs --episode=<episode-id>');
    process.exit(1);
  }

  const dir = episodeDir(episodeId);
  const brief = JSON.parse(await readFile(path.join(dir, 'brief.json'), 'utf8'));

  /**
   * THE MEASUREMENT, IF IT EXISTS.
   *
   * Written by scripts/voice-episode.mjs from the narration itself. When it is
   * here every duration in the reel comes from the audio; when it is not, they
   * come from a word count, and the run says so out loud — because a reel cut
   * to an estimate is a draft, and it should never quietly look finished.
   */
  const voice = await readFile(path.join(dir, 'audio', 'vo.json'), 'utf8')
    .then(JSON.parse)
    .catch(() => null);
  const rand = seeded(`${episodeId}::${brief.mood ?? 'cold-noir'}`);
  const mood = MOODS[brief.mood] ?? MOODS['cold-noir'];

  // THE EPISODE'S OWN LOOK, generated inside its mood.
  const look = {
    accent: pick(rand, mood.accents),
    field: pick(rand, mood.fields),
    fieldColours: pick(rand, mood.fieldColours),
    mark: pick(rand, MARKS),
    textStyle: pick(rand, ['serif-italic', 'sticker', 'typed']),
    // HOW A FIGURE ARRIVES, chosen once per reel. A counter climbing makes the
    // SIZE of it felt; a slot reel slamming to a stop makes the CHOICE felt.
    // Using both in one reel would make neither of them mean anything.
    numbers: pick(rand, ['count', 'slot']),
    fog: mood.fog,
    // FOUR of the five arrivals, in an order this episode picks for itself. The
    // old draft took three, and across nine scenes that meant each one came
    // round three times — which is what "the same transitions over and over"
    // actually was. With more shots per reel now, three was never going to be
    // enough vocabulary.
    transitions: [...TRANSITIONS].sort(() => rand() - 0.5).slice(0, 4),
  };

  const grade = {
    saturate: round(between(rand, mood.grade.saturate)),
    contrast: round(between(rand, mood.grade.contrast)),
    sepia: round(between(rand, mood.grade.sepia)),
    brightness: round(between(rand, mood.grade.brightness)),
  };

  /**
   * WHICH SIDE THE LIGHT COMES FROM — chosen once, for the whole episode.
   *
   * Real light in a room has a source. A reel whose key light jumps sides every
   * cut has no source, it has a flicker; and picking it per scene is how a
   * pipeline generates ten shots that cannot possibly be the same afternoon.
   */
  const side = rand() > 0.5 ? 1 : -1;
  // Pieces are placed only where there is a supply of clean cut-outs. See
  // buildStack: the brief still names them, nothing places them until this is on.
  const cutouts = brief.cutouts === true;

  const planned = [];
  let previousTransition = null;
  brief.lines.forEach((line, index) => {
    // ONE SENTENCE, SEVERAL SHOTS. The first fragment gets the beat's template
    // and the line's artwork; the rest reuse that same picture from a different
    // corner. Nine long lines used to be nine identical seven-second scenes.
    const fragments = fragmentsOf(line.vo);
    // THE SPOKEN WINDOW WINS. If the narration has been recorded, this line
    // starts and ends at measured times and the fragments divide that; only an
    // episode with no voiceover yet falls back to counting words.
    const spoken = voice?.lines?.[index];
    const cuts = spoken ? splitWindow(fragments, spoken.start, spoken.end) : null;

    const result = planScene({
      line,
      index,
      total: brief.lines.length,
      fragment: fragments[0],
      frames: cuts?.[0],
      rand,
      look,
      previousTransition,
      recentMotifs: planned.slice(-2).map((p) => p.motif),
      recentTypes: planned.slice(-2).map((p) => p.scene.sceneType),
      side,
      cutouts,
      // Never open two shots running with the same drawn object. A device that
      // repeats stops being a device and becomes wallpaper — the same law the
      // motifs and the transitions are already held to.
      recentProps: planned.slice(-1).flatMap((p) => (p.scene.props ?? []).map((q) => q.kind)),
    });
    previousTransition = result.scene.transition?.kind ?? null;
    planned.push(result);

    // A portal shot lands INSIDE the picture, so its continuations stay there
    // rather than cutting back out to the wall it hung on.
    const plate =
      result.scene.sceneType === 'portal-zoom-reveal' ? result.scene.assets?.photo : undefined;

    fragments.slice(1).forEach((fragment, i) => {
      const scene = planContinuation({
        line,
        index,
        part: i + 1,
        fragment,
        frames: cuts?.[i + 1],
        rand,
        look,
        previousTransition,
        plate,
        side,
        cutouts,
        recentProps: planned.slice(-1).flatMap((p) => (p.scene.props ?? []).map((q) => q.kind)),
      });
      previousTransition = scene.transition.kind;
      // The continuation stands the SAME pieces in the same room, so it carries
      // the line's list too — otherwise the recipe builder, which now only
      // draws what a layer asks for, would find nothing asking for them.
      planned.push({scene, line, motif: '', pieces: line.pieces ?? []});
    });
  });

  const config = {
    id: episodeId,
    title: brief.title,
    // The narration rides the whole reel, so it belongs to the episode, not to
    // any one scene. Absent until the voice script has run.
    ...(voice ? {audio: voice.audio ?? 'audio/vo.mp3'} : {}),
    fps: FPS,
    width: WIDTH,
    height: HEIGHT,
    look: {
      posterizeFps: pick(rand, [12, 12, 12, 15]),
      grade,
      film: {
        grain: true,
        grunge: true,
        scanlines: true,
        vignette: true,
        gateWeave: true,
        grainOpacity: round(between(rand, mood.grain)),
        grungeOpacity: round(between(rand, [0.1, 0.2])),
        scanlineOpacity: round(between(rand, [0.06, 0.16])),
        scanlinePeriod: 8 + Math.round(rand() * 3),
        vignetteStrength: round(between(rand, mood.vignette)),
        weavePx: 4 + Math.round(rand() * 3),
        weaveScale: round(1.01 + rand() * 0.008, 3),
      },
    },
    scenes: planned.map((p) => p.scene),
  };

  // RECIPES. Backdrops and artefacts are photographs; pieces are cut-outs and
  // therefore optional in the config above.
  const assets = {};
  /**
   * ONLY WHAT A SCENE ACTUALLY NAMES.
   *
   * A recipe is an instruction for MAKING a missing file. An episode whose
   * plates were supplied — a real kit, handed over — names those files directly
   * and never touches the derived `sNN-bg.png` the beat rules would have
   * invented, so writing a recipe for one is an instruction to draw a picture
   * no frame contains. It also fails the repo's own guard, which is right: a
   * recipe nobody uses costs a draw on every run.
   */
  const named = new Set(
    planned.flatMap(({scene}) => Object.values(scene.assets ?? {}).map((f) => path.basename(String(f)))),
  );
  /**
   * EVERY SCENE'S OWN MATERIAL LIST.
   *
   * A directed shot names its plates one by one, and each of them says what it
   * IS — a search for something real, or a prompt for something that has to be
   * invented. That list is the fifth step of the method and the one this
   * pipeline never had: it derived a single backdrop per scene from a single
   * sentence, so a scene could never ask for "the map behind everything, the
   * figure in front of it, the flag coming in from the left". Now it can, and
   * each of those is drawn or fetched on its own terms.
   *
   * `kind` decides how: a `backdrop` fills the frame, a `piece` is keyed to
   * transparency and stood in front of it.
   */
  for (const {line} of planned) {
    for (const layer of line?.shot?.layers ?? []) {
      const name = String(layer.asset ?? '').trim();
      if (!name || assets[name] || !(layer.prompt || layer.commons)) continue;
      assets[name] = {
        kind: layer.kind ?? (layer.height ? 'piece' : 'backdrop'),
        ...(layer.commons ? {commons: [].concat(layer.commons)} : {}),
        ...(layer.prompt ? {prompt: layer.prompt} : {}),
      };
    }
  }

  for (const {scene, backdropPrompt, photoPrompt, backdropCommons, photoCommons, pieces} of planned) {
    // `commons` names a REAL thing and is tried first; `prompt` is what draws it
    // when nothing free and large enough exists. A named artefact is always
    // better fetched than invented.
    if ((backdropPrompt || backdropCommons) && named.has(`${scene.id}-bg.png`)) {
      assets[`${scene.id}-bg.png`] = {
        kind: 'backdrop',
        ...(backdropCommons ? {commons: backdropCommons} : {}),
        ...(backdropPrompt ? {prompt: backdropPrompt} : {}),
      };
    }
    if ((photoPrompt || photoCommons) && named.has(`${scene.id}-photo.png`)) {
      assets[`${scene.id}-photo.png`] = {
        kind: 'photo',
        ...(photoCommons ? {commons: photoCommons} : {}),
        ...(photoPrompt ? {prompt: photoPrompt} : {}),
      };
    }
    // ONLY WHAT A LAYER ASKS FOR. A piece is needed if and only if some scene
    // actually places it: a line whose first shot is a title card still carries
    // its pieces in the brief, and drawing files nothing references costs the
    // generator its time and the repo its disk for a picture no frame contains.
    const placed = new Set(
      Object.keys(scene.assets ?? {})
        .filter((role) => role.startsWith('?'))
        .map((role) => role.slice(1)),
    );
    for (const piece of pieces) {
      const slug = piece.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
      if (!placed.has(slug)) continue;
      const name = `${slug}.png`;
      if (!assets[name]) {
        assets[name] = {
          kind: 'piece',
          // TRY THE REAL THING FIRST, even for a cut-out. Commons is full of
          // catalogue photography — an object on a plain sweep, because that is
          // how a museum photographs a coin and how a contributor photographs a
          // camel — and a plain sweep is exactly what the keyer wants. A real
          // camel keyed out beats a drawn one every time; when the key comes
          // back a rectangle or a handful of confetti the prompt still gets its
          // turn.
          // TRANSPARENT FIRST. A PNG somebody already cut out by hand beats any
          // threshold this repo will ever write; a plain sweep is second best,
          // because the keyer can handle that; the bare name is the last resort.
          commons: [`${piece} transparent png`, `${piece} white background`, `${piece} isolated`, piece],
          // Singular, because "a row of X" makes the model draw a SCENE, and a
          // scene has no backdrop to key away.
          prompt: `one single ${piece}, whole object in frame, dark silhouette, on a plain white background`,
        };
      }
    }
  }

  const recipes = {
    $comment: 'GENERATED by scripts/plan-episode.mjs from brief.json. Edit the brief, re-plan.',
    style: brief.style,
    styleAlpha: 'sharp studio photograph, even soft lighting, plain background',
    negative: brief.negative ?? 'text, letters, words, watermark, logo, cartoon, cgi, duplicate',
    kinds: {
      backdrop: {width: 1080, height: 1920, alpha: false},
      photo: {width: 900, height: 1170, alpha: false},
      piece: {width: 1400, height: 900, alpha: true},
      overlay: {width: 1080, height: 1080, alpha: false, overlay: true},
    },
    assets,
  };

  await writeFile(path.join(dir, 'scene-config.json'), `${JSON.stringify(config, null, 2)}\n`, 'utf8');
  /**
   * NO RECIPES, NO RECIPE FILE.
   *
   * An episode built from artwork that was HANDED OVER has nothing to draw, and
   * an empty `assets.json` is not the same statement as no `assets.json` — the
   * first says "draw these zero things", which the repo's own guard reads as a
   * config naming files the generator will never make. The second says the
   * artwork is supplied, which is the truth.
   */
  if (Object.keys(assets).length) {
    await writeFile(path.join(dir, 'assets.json'), `${JSON.stringify(recipes, null, 2)}\n`, 'utf8');
  } else {
    await rm(path.join(dir, 'assets.json'), {force: true});
  }

  const frames = config.scenes.reduce((total, s) => total + s.durationInFrames, 0);
  console.log(`✓ planned ${episodeId}: ${config.scenes.length} scenes, ${frames} frames (${(frames / FPS).toFixed(1)}s)`);
  console.log(`  look   accent ${look.accent} · field ${look.field} · mark ${look.mark} · text ${look.textStyle}`);
  console.log(`  grade  ${JSON.stringify(grade)}`);
  console.log(`  cuts   ${look.transitions.join(', ')}`);
  console.log(`  types  ${config.scenes.map((s) => s.sceneType).join(' → ')}`);
  console.log(`  drawn  ${planned.map((p) => p.motif || '·').join(' ')}`);
  console.log(`  assets ${Object.keys(assets).length} recipes`);

  /**
   * THE STORYBOARD, PRINTED.
   *
   * The reference build gets this by pasting a prompt and reading prose back:
   * for every line, the scene it becomes, the words that go on screen pulled
   * straight from the line, and the assets needed to make it. That is exactly
   * what everything above just DERIVED — it was simply never shown, so the one
   * artefact a person actually reads before building was the only one the tool
   * did not produce.
   *
   * Printing it costs nothing and it is better than the prose version in one
   * way that matters: it is what will actually be rendered, not a description
   * of what someone intends to render.
   */
  /**
   * WHAT THE BRIEF GETS WRONG, SAID BEFORE A RENDER IS PAID FOR.
   *
   * `npm run write` holds a brief to every rule in this repo — six lines, a
   * stack, a directed shot, words that come out of the line. A brief EDITED BY
   * HAND skips that step entirely, and this planner used to compile whatever it
   * was handed: fifteen lines planned into a sixty-second reel without a word,
   * which is the exact failure the six-line rule exists to prevent.
   *
   * Warnings, not refusals. Every episode in this repo predates half these
   * rules and all of them still render; turning the checks into a gate here
   * would break work that is finished. The job is to make sure nobody finds out
   * from the finished mp4.
   */
  const {problemsWith} = await import('./write-episode.mjs');
  const notes = problemsWith(brief);
  if (notes.length) {
    console.log(`\n  ${notes.length} thing(s) the brief gets wrong — it still planned, but:`);
    for (const note of notes.slice(0, 8)) console.log(`   · ${note}`);
    if (notes.length > 8) console.log(`   · …and ${notes.length - 8} more`);
  }

  console.log('\n  STORYBOARD');
  for (const [index, line] of brief.lines.entries()) {
    const own = planned.filter((p) => p.scene.id.startsWith(`s${String(index + 1).padStart(2, '0')}-`));
    const first = own[0]?.scene;
    if (!first) continue;

    const seconds = own.reduce((total, p) => total + p.scene.durationInFrames, 0) / FPS;
    const onScreen = [
      first.params?.kicker,
      first.params?.title || first.params?.spinTo,
      first.params?.footer,
      ...(Array.isArray(first.params?.caption) ? first.params.caption : []),
      ...(first.onScreenText ?? []).map((t) => t.text),
      ...(Array.isArray(first.params?.motifStops) ? [first.params.motifStops.join(' → ')] : []),
    ]
      .filter(Boolean)
      .join(' / ');
    // EVERY SHOT OF THE LINE, not just the first. A line whose opener is a
    // portal and whose continuation is a four-layer composite was reported as
    // needing two files, which made the reel look flatter on paper than it is
    // and hid the change that fixed it.
    const needs = [
      ...new Set(own.flatMap((p) => Object.values(p.scene.assets ?? {}).map((f) => String(f).replace(/^assets\//, '')))),
    ];

    console.log(`\n  ${index + 1}. "${line.vo}"`);
    console.log(
      `     ${own.length > 1 ? `${own.length} shots` : '1 shot'} · ${own.map((p) => p.scene.sceneType).join(' + ')} · ${seconds.toFixed(1)}s` +
        (own[0].motif ? ` · motif ${own[0].motif}` : ''),
    );
    if (onScreen) console.log(`     on screen  ${onScreen}`);
    if (needs.length) console.log(`     needs      ${needs.join(', ')}`);

    // PIECES WRITTEN AND NEVER STOOD UP. A portal shot is a flight into a
    // photograph and holds nothing in front of it, so a line that becomes one
    // drops its whole stack. That is a fair outcome and a silent one, and
    // silence is the problem: the author wrote three objects, the reel shows
    // none of them, and nothing anywhere said so.
    const dropped = (line.pieces ?? []).filter(
      (piece) => !needs.includes(`${piece.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`),
    );
    if (dropped.length) {
      console.log(`     dropped    ${dropped.join(', ')} — no shot on this line can stand a piece up`);
    }
  }
  console.log(
    voice
      ? `  clock  CUT TO ${voice.audio ?? 'audio/vo.mp3'} — ${voice.duration.toFixed(1)}s, ${voice.how ?? 'measured'}`
      : `  clock  ESTIMATED from word counts — no voiceover yet. Run: npm run voice -- --episode=${episodeId}`,
  );
}

// Only when run as a command; the tests import the rhythm rules from here.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    /**
     * A BAD BRIEF IS NOT A CRASH.
     *
     * Everything upstream of this script is written by hand or by a model, so
     * "the brief said something impossible" is an ordinary Tuesday and it
     * deserves a sentence, not a stack trace. A stack points at the planner,
     * which is never the thing that needs changing — the line is.
     *
     * A real bug still gets its stack, because that IS the thing that needs
     * changing and hiding it would cost an afternoon.
     */
    if (error instanceof BriefError) {
      console.error(`✗ the brief cannot be compiled\n\n   ${error.message}\n`);
    } else {
      console.error(error?.stack || error?.message || error);
    }
    process.exit(1);
  });
}
