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
import {access, readFile, readdir, rm, writeFile} from 'node:fs/promises';
import sharp from 'sharp';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {episodeDir, parseArgs} from './lib/episode.mjs';
import {PROP_KINDS} from '../engine/schema.mjs';
import {
  atmosphereFor,
  clampArrival,
  directCamera,
  directShot,
  directTransition,
  emphasisOf,
  TRANSITION_PURPOSE,
} from './lib/director.mjs';
import {cutMix, directCut} from './lib/cut.mjs';
import {boundsOf, cameraTravel, eventsOf, propHeight, throughTheCamera} from './lib/critique.mjs';
import {TYPE} from '../visual-system/dna.mjs';
import {readingFrames} from './lib/editor.mjs';
import {countWindow} from '../engine/state.mjs';
import {endingStrategy, hookStrategy, readScript, rhythmFor} from './lib/story.mjs';
import {colourCentre, judge, loadReview, measureAsset} from './lib/assetdirector.mjs';
import {directFraming, graphicJustified, hierarchyFor, labelFor} from './lib/visual.mjs';
import {CAPTION_ZONE, chooseRepresentation, figureIn} from './lib/representation.mjs';

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

/**
 * HOW A SHOT ARRIVES — and the sentence decides, not the die.
 *
 * The templates are chosen by the line, the motifs are chosen by the line, the
 * grade is chosen by the line. The CUT was still being drawn from a hat, which
 * put a slam on a quiet line and a soft focus-hunt on the hardest beat in the
 * reel — backwards, and the one editorial decision nothing was making.
 *
 * A cut is a piece of punctuation. Five of them, and each answers a different
 * kind of sentence:
 *
 *   slam    something LANDED. A crossing, a declaration, a door.
 *   rack    something was NOTICED. The lens had not found it yet.
 *   slip    something was PUT DOWN or laid out — a paper, a list, an offer.
 *   flare   a splice in the print, for the beat that breaks the story in half.
 *   blinds  a room being opened on. Surveillance, interiors, the found thing.
 *
 * First match wins, so the sharpest claims come first.
 */
const CUT_WORDS = [
  ['slam', /\b(cross\w*|invad\w*|struck?|hit|slam\w*|declar\w*|seiz\w*|smash\w*|broke|burst|fell|collaps\w*|crash\w*|arriv\w*|land\w*)\b/i],
  ['flare', /\b(kill\w*|died?|dead|burn\w*|explo\w*|war|shot|end\w*|last|final|never)\b/i],
  ['rack', /\b(saw|seen|notic\w*|found|discover\w*|realis\w*|realiz\w*|watch\w*|look\w*|appear\w*|learn\w*)\b/i],
  ['slip', /\b(gave|offer\w*|sent|wrote|signed?|paid|handed|ask\w*|demand\w*|list\w*|pass\w*)\b/i],
  ['blinds', /\b(room|office|house|inside|behind|door|window|hidden|secret|quiet\w*)\b/i],
];

/**
 * A cut chosen by the sentence, then by the rules, then by the die — and its
 * LENGTH from the same reading. A hard arrival cuts short and lands; a noticing
 * takes longer because the whole point of it is the lens catching up.
 */
export function cutFor(line, previous, allowed, rand) {
  const named = line?.shot?.cut;
  if (typeof named === 'string' && TRANSITIONS.includes(named)) {
    return {kind: named, frames: Number(line?.shot?.cutFrames) || (named === 'slam' || named === 'flare' ? 6 : 11)};
  }

  /**
   * WHAT THE SENTENCE SAYS BEATS WHAT THE RULE PREFERS.
   *
   * The anti-repeat rule is right about a DERIVED cut: pulled from a hat twice
   * running it stops being a choice and becomes a tic. It is wrong about a cut
   * the sentence asked for, and the first version let it win — the closing line
   * of a reel, "sixty million people were dead", matched `flare` and was denied
   * it because the shot before had flared, so the verdict of the whole episode
   * arrived on venetian blinds.
   *
   * So the sentence is read for EVERY cut it earns, in order of sharpness, and
   * the first one that is not a repeat is taken. Only when the sentence has
   * nothing to say does the die get a turn — and there the rule still holds.
   */
  /**
   * A RHYME IS ALLOWED. A TIC IS NOT.
   *
   * A sentence that earns a cut beats the rule, and it should: the verdict of
   * an episode should arrive on the cut its words asked for, not on venetian
   * blinds because the shot before had flared. But "earned beats the rule" with
   * no ceiling gave four consecutive flares in one reel — every closing line of
   * a war episode matches the same word list, so every one of them earned the
   * same cut, and the exception ate the rule.
   *
   * So: never the same as the last one unless the sentence earned it, and never
   * the same as the last TWO under any circumstances.
   */
  const history = Array.isArray(previous) ? previous : [previous];
  const last = history[history.length - 1] ?? null;
  const jammed =
    history.length >= 2 && history[history.length - 2] && history[history.length - 2] === last ? last : null;

  const earned = CUT_WORDS.filter(([, re]) => re.test(line?.vo ?? ''))
    .map(([kind]) => kind)
    .filter((kind) => kind !== jammed);
  const fresh = earned.find((kind) => kind !== last);
  const choices = allowed.filter((k) => k !== last && k !== jammed);
  const chosen = fresh ?? earned[0] ?? pick(rand, choices.length ? choices : allowed.filter((k) => k !== jammed));

  // A hard arrival cuts SHORT and lands; a noticing takes longer, because the
  // whole point of it is the lens catching up.
  const hard = chosen === 'slam' || chosen === 'flare';
  return {
    kind: chosen,
    frames: Number(line?.shot?.cutFrames) || (hard ? 5 + Math.round(rand() * 3) : 9 + Math.round(rand() * 5)),
  };
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
  // EMBERS ARE A FIRE. `destroy` on its own is not one — "seawater is what
  // destroys modern concrete" was given glowing warm embers, which is the
  // opposite of what the line says destroyed it. Destruction counts here only
  // where the sentence has fire or heat in it, the way `gave` counts only as
  // "gave it away". `end\w*` went with it: it is a substring trap that catches
  // endless, endure and ending up, and `died|death` already carries the elegy.
  [
    'embers',
    /\b(fire|burn\w*|ash|ashes|collaps\w*|ruin\w*|sacked?|war|siege|died|death)\b|\bdestroy\w*\b(?=[\s\S]*\b(fire|burn\w*|flame\w*|heat|smoke|ash|ashes)\b)|\b(fire|burn\w*|flame\w*|heat|smoke)\b(?=[\s\S]*\bdestroy\w*\b)/i,
  ],
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
  const size = Math.round(place.size * (0.88 + rand() * 0.3));
  /**
   * AND THE JITTER KEEPS ITS OWN WIDTH INSIDE THE FRAME.
   *
   * The anchor is a fraction and the shake is ±5% of the width, and neither
   * knows how wide the mark it is placing turns out to be: a tally anchored
   * near the left edge was shaken 54px further left and delivered with its
   * first stroke 13px outside the safe area. This is the plaque's rule — an x
   * clamps so the object's own width stays in — applied to the one drawn thing
   * that had been exempt from it.
   */
  const half = size / 2;
  const bound = (v) => Math.min(WIDTH - 40 - half, Math.max(40 + half, v));
  return {
    motif: kind,
    motifX: Math.round(bound(WIDTH * place.x + (rand() - 0.5) * WIDTH * 0.1)),
    motifY: Math.round(HEIGHT * place.y),
    motifSize: size,
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
  /**
   * TWO COMMAS ARE NOT A LIST OF THINGS TO PIN UP.
   *
   * The `list` beat builds an evidence board, and a board is index cards — it
   * needs `items` to put on it. The heuristic counted commas, so "Hammer, fold,
   * hammer again" became a board with nothing to pin, and four unrelated
   * episodes each shipped an evidence board with zero cards and zero caption:
   * an entirely empty shot that the validator could only describe as "1.7s and
   * nothing happens".
   *
   * A comma is punctuation, not an inventory. Where the line did not say what
   * the things ARE, the shot is composed instead — which is what a sentence
   * with a rhythm in it wanted anyway.
   */
  if (line.items?.length && (line.vo.match(/,/g) ?? []).length >= 2) return 'list';
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
/**
 * …EXCEPT THE "AND" INSIDE A NUMBER.
 *
 * "two hundred AND sixty-two metres high" is one figure, and the clause splitter
 * cut it in half: the reel said "The dam was TWO HUNDRED" and then, after a cut,
 * "and SIXTY-TWO metres of concrete". A number broken across a cut cannot be
 * read as a number, let alone emphasised (law 20) — and this one is the first
 * fact in the film.
 */
const NUMBER_JOIN = /\b(?:hundred|thousand|million|billion)\s+and\s+\w/i;
/**
 * Seconds of speech beyond which a shot stops being a shot and becomes a wait.
 *
 * Pulled down from 3.6. At 3.6 the budget is ten words, and ten words of
 * documentary narration is three and a half seconds of one camera move — which
 * is what the reels out of here were made of. The reference cuts about every
 * two seconds; eight words lands just under three, which is as slow as a shot
 * can be while still being a shot.
 */
const MAX_SPOKEN = 2.9;

/**
 * WHERE A CLAUSE-FREE SENTENCE BREAKS.
 *
 * Prefer a preposition or a relative — "found a wreck | full of bronze" reads
 * as two shots; "found a wreck full | of bronze" reads as a dropped frame. The
 * midpoint is the fallback, and it is still better than not cutting: the split
 * exists because a shot that runs four and a half seconds on one camera move is
 * the slideshow this whole pipeline is trying to stop making.
 */
const BREAK_BEFORE = /^(of|in|on|at|for|from|by|with|into|over|under|through|across|before|after|until|about|that|who|which|where|when|full|and|but|to)$/i;

function breakLongest(piece, budget) {
  const words = piece.trim().split(/\s+/).filter(Boolean);
  if (words.length <= budget) return [piece];

  const halves = Math.ceil(words.length / budget);
  const target = Math.round(words.length / halves);
  /**
   * Search outward from the target for a word worth breaking before, but never
   * so far out that one side becomes a flash.
   *
   * BOTH sides. The floor used to bound only how far LEFT the search could
   * reach, which said nothing about the piece being left behind on the right:
   * "The famous casts are not people turned to stone" found `to` two words past
   * the target and shipped a seven-word shot followed by a two-word one — 3.2
   * seconds holding on a single caption, then a nine-tenths-of-a-second flash,
   * and an English phrase severed between a verb and its particle. A candidate
   * that leaves a tail too short to be a shot is not a better break than the
   * midpoint; it is the same fault the floor already refuses on the other side.
   */
  const floor = Math.max(2, Math.round(target * 0.5));
  const standsAlone = (at) => at >= floor && words.length - at >= floor;
  let cut = target;
  for (let d = 0; d <= target - floor; d += 1) {
    if (BREAK_BEFORE.test(words[target - d] ?? '') && standsAlone(target - d)) {
      cut = target - d;
      break;
    }
    if (BREAK_BEFORE.test(words[target + d] ?? '') && standsAlone(target + d)) {
      cut = target + d;
      break;
    }
  }
  return [words.slice(0, cut).join(' '), ...breakLongest(words.slice(cut).join(' '), budget)];
}

export function fragmentsOf(vo, max = MAX_SPOKEN) {
  const words = (s) => s.trim().split(/\s+/).filter(Boolean).length;
  const budget = Math.round(max * RATE);
  const pieces = [];
  for (const piece of String(vo).split(SPLIT_AT).map((s) => s.trim()).filter(Boolean)) {
    const last = pieces[pieces.length - 1];
    // Re-join a split that landed inside a spoken figure.
    if (last && NUMBER_JOIN.test(`${last} ${piece}`) && /^and\b/i.test(piece)) {
      pieces[pieces.length - 1] = `${last} ${piece}`;
    } else {
      pieces.push(piece);
    }
  }

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

  /**
   * AND THEN ACTUALLY HONOUR THE BUDGET.
   *
   * MAX_SPOKEN was aspirational: the split only ever happened at commas and
   * conjunctions, so a sentence without one came through whole however long it
   * was. "In 1901 sponge divers off Antikythera found a wreck full of bronze"
   * has no comma in it, and it became a single four-and-a-half-second shot
   * whose only event was the camera scaling by 13%. Five of that reel's six
   * lines were exactly that, which is the reel.
   *
   * A clause boundary is the BEST place to cut. It is not the only one, and
   * having none is not a reason to give up and hold the shot.
   */
  const paced = out.flatMap((piece) => breakLongest(piece, budget));
  return paced.length ? paced : [String(vo).trim()];
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

/**
 * A SPOKEN NUMBER IS ONE NUMBER, AND THERE IS ONLY ONE READER OF IT.
 *
 * This had its own grammar — one number word plus at most one scale word — and
 * `figureIn` had another. Two readers of the same sentence disagree eventually,
 * and here they disagreed ON SCREEN, in the same shot: a card set the largest
 * type on the sheet to TWO HUNDRED while the sticker under it said 262 METRES,
 * and on the next line the same card said TWO HUNDRED over a sentence about two
 * hundred and SEVENTY MILLION cubic metres. That is the tonnage fault — a
 * drawn figure contradicting the line it illustrates — with the contradiction
 * inside one frame.
 *
 * So the extent of the compound is matched here and the VALUE comes from
 * `figureIn`, which is the repository's number reader. And it is set in
 * digits, because a card is where a figure lands and "270 MILLION" lands where
 * "TWO HUNDRED AND SEVENTY MILLION" is a paragraph.
 */
const NUM_WORD =
  '(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|billion)';

function spokenFigure(n) {
  if (n >= 1e9) return `${+(n / 1e9).toFixed(2)} BILLION`;
  if (n >= 1e6) return `${+(n / 1e6).toFixed(0)} MILLION`;
  return n.toLocaleString('en-GB');
}

function bigNumber(vo) {
  const numeric = /\b\d[\d,.]*\b/;
  const spelled = new RegExp(`\\b${NUM_WORD}(?:[\\s-]+(?:and[\\s-]+)?${NUM_WORD})*\\b`, 'i');

  const match = vo.match(numeric) ?? vo.match(spelled);
  if (!match) return '';

  const value = figureIn(match[0]);
  const number = value === null ? match[0].replace(/[.,]$/, '') : spokenFigure(value);
  /**
   * AND "CUBIC" IS NOT A UNIT, IT IS HALF OF ONE. Taking one word after the
   * figure delivered "270 MILLION CUBIC", which is not a quantity of anything.
   */
  const rest = vo.slice(match.index + match[0].length).trim().split(/\s+/);
  const word = (n) => (rest[n] ?? '').replace(/[^a-z³]/gi, '');
  const unit = /^(cubic|square|nautical|metric|short|long)$/i.test(word(0))
    ? `${word(0)} ${word(1)}`.trim()
    : word(0);
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

/** A line should not end on one of these if there is any alternative. */
const DANGLER =
  /^(a|an|the|of|off|in|into|on|onto|at|to|for|from|by|with|within|over|under|through|and|or|but|as|than|is|was|were|it|its|his|her|their|that|this|when|while|after|before)$/i;

/**
 * WHERE THE LINE BREAKS.
 *
 * It used to be `words.length / lines` and a slice, which is even and wrong.
 * Even splitting gave "of corroded / metal the / size of / a book" — three of
 * the four lines ending on a preposition, and the sentence read as four
 * fragments rather than as a sentence in four parts.
 *
 * It also cut straight through the emphasis. "for fourteen / hundred years"
 * puts "fourteen hundred years" across a break, and the type layer sets an
 * emphasis inside ONE line, so the figure the shot exists for lost its accent
 * and nothing reported it.
 *
 * The counts here are small — ten words at most, four lines at most — so every
 * arrangement is simply scored and the best one wins. Balance is the base cost;
 * splitting the emphasis is close to disqualifying; a dangling preposition is a
 * nudge.
 */
/**
 * `ideal` is the character count past which a line starts costing, and
 * `maxLines` the most it may break into.
 *
 * Both exist because a caption and a STATEMENT want different shapes. Twenty
 * characters over three lines is right for words sitting on a photograph; it is
 * wrong for words that are the entire shot, where the same sentence wants to be
 * five short lines set large. Same scorer, same emphasis rule, different target.
 */
export function captionLines(text, emphasis = '', {ideal = 20, maxLines = CAPTION_LINES} = {}) {
  const words = text.replace(/[.,]\s*$/, '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];

  const want = emphasis.trim().toLowerCase();
  const chars = words.join(' ').length;

  /**
   * MEASURED IN CHARACTERS, NOT WORDS.
   *
   * "of a book" and "Antikythera" are one word and three, and balancing by
   * word count sets them as equal lines — which they are not, on screen.
   *
   * The long-line penalty is what stops the scorer collapsing everything onto
   * one line: past about twenty characters the type has to shrink to fit the
   * frame, and a caption that has shrunk is a caption competing with the
   * picture instead of sitting on it.
   */
  const score = (parts) => {
    if (parts.some((part) => !part.length)) return Infinity;
    const set = parts.map((part) => part.join(' '));
    const avg = chars / parts.length;
    let cost = set.reduce((n, line) => n + (line.length - avg) ** 2, 0) / 12;
    cost += set.reduce((n, line) => n + Math.max(0, line.length - ideal) ** 2 * 0.5, 0);
    for (const part of parts) {
      const last = part[part.length - 1].replace(/[^\p{L}\p{N}]/gu, '');
      if (DANGLER.test(last)) cost += 3;
    }
    // A figure cut in half cannot be emphasised, and the type layer will not
    // say so — it will simply set the line flat.
    if (want && words.join(' ').toLowerCase().includes(want)) {
      if (!set.some((line) => line.toLowerCase().includes(want))) cost += 60;
    }
    return cost;
  };

  let best = {cost: Infinity, parts: [words]};
  const walk = (cuts, from, lines) => {
    if (cuts.length === lines - 1) {
      const parts = [];
      let at = 0;
      for (const cut of [...cuts, words.length]) {
        parts.push(words.slice(at, cut));
        at = cut;
      }
      const cost = score(parts);
      if (cost < best.cost) best = {cost, parts};
      return;
    }
    for (let i = from; i < words.length; i += 1) walk([...cuts, i], i + 1, lines);
  };
  // Every arrangement into one to four lines. Ten words at most, so this is a
  // few hundred candidates — cheaper than one frame of the render it feeds.
  for (let lines = 1; lines <= Math.min(maxLines, words.length); lines += 1) walk([], 1, lines);

  return best.parts.map((part) => part.join(' '));
}

/**
 * CAPTION TYPE THAT FITS, IN THE CONFIG AND NOT ONLY AT RENDER.
 *
 * The engine clamps an oversized caption because a guarantee has to live where
 * it cannot be forgotten. But a config carrying a size the engine then has to
 * overrule is a config that lies about its own layout: the clipping check reads
 * it and reports a caption 126 pixels past the right edge that will in fact
 * render correctly. So the planner sizes it the same way the engine does —
 * against the widest line, at the size the EMPHASIS will be set at, which is
 * the one that overflows.
 */
function captionSize(lines, rand, x = 84) {
  const longest = lines.reduce((n, line) => Math.max(n, line.length), 0);
  const base = longest > 22 ? 62 : longest > 16 ? 74 : 88;
  const wanted = base + Math.round(rand() * 10);
  const column = Math.max(240, WIDTH - x - 110);
  return Math.max(34, Math.min(wanted, Math.floor(column / (longest * 1.24 * 0.64))));
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
    captionX: text.x === undefined ? Math.round(WIDTH * TYPE.margin) : Math.round(WIDTH * Number(text.x)),
    /**
     * INSIDE THE SAFE AREA, IN THE CONFIG AND NOT ONLY IN THE ENGINE.
     *
     * The engine pushes an overflowing block back up because a guarantee has
     * to live where it cannot be forgotten. But a config carrying a y the
     * engine then has to overrule is a config that lies about its own layout,
     * and the next person reading it believes the number.
     */
    captionY: Math.min(
      HEIGHT - 150 - lines.length * (text.size === undefined ? captionSize(lines, rand) : WIDTH * Number(text.size)) * 1.3,
      text.y === undefined ? Math.round(between(rand, [300, 1080])) : Math.round(HEIGHT * Number(text.y)),
    ),
    /**
     * AN AUTHORED SIZE IS CLAMPED TOO.
     *
     * The brief writes a type size for the line it was written against, and the
     * planner then cuts that line into fragments of different lengths. "Cut by
     * hand, meshing" at the size chosen for "thirty gears" runs 126 pixels past
     * the right edge. The engine catches it at render; letting the config carry
     * the wrong number means the clipping check is arguing with a value nobody
     * will ever see, which is how a real finding gets dismissed as a false one.
     */
    captionSize: Math.min(
      captionSize(lines, rand, text.x === undefined ? 84 : Math.round(WIDTH * Number(text.x))),
      text.size === undefined ? Infinity : Math.round(WIDTH * Number(text.size)),
    ),
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
    /**
     * ONE REEL, ONE PAPER.
     *
     * The name was drawn per shot, so a reel with three front pages in it had
     * three different newspapers: THE RECORD opened it, THE HERALD carried the
     * turn and THE GAZETTE closed it. A masthead is the one part of the graphic
     * that claims continuity — the same paper reporting the story as it
     * develops — and three of them says the opposite, in the largest type on
     * the sheet. The die is still thrown on every page so the rest of the
     * episode's seeded stream is unchanged; the first result is the one that
     * names the paper, and every later page is that same paper.
     */
    const thrown = pick(rand, ['THE RECORD', 'THE DAILY', 'THE GAZETTE', 'THE CHRONICLE', 'THE HERALD']);
    look.masthead = look.masthead ?? thrown;
    props.push({
      kind: 'newspaper',
      masthead: look.masthead,
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
  if (!props.length && beat !== 'close') {
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
/**
 * THE DIRECTOR'S PASS — run over every shot, after it has been built.
 *
 * The planner decides what is in the frame. This decides what HAPPENS in it,
 * and it is the step this pipeline never had. Before it, a shot could be:
 * a photograph, a slow scale, and nothing else, for four and a half seconds —
 * and four of seven shots in the last reel were exactly that, because a caption
 * is the only event the planner scheduled and those four had no caption.
 *
 * Three things happen here:
 *
 *   THE EVENTS ARE SPREAD. Whatever the shot carries — words, a card landing,
 *       a motif — is laid across the shot's length instead of all of it firing
 *       at frame six. The first one lands early, the last one before the cut.
 *
 *   AN EMPTY SHOT IS FILLED, and filled with something that means something: a
 *       mark drawing itself on the frame, a wireframe closing on the subject, a
 *       shaft of light, the camera taking a hit. Never a particle system.
 *
 *   THE CAMERA STOPS REPEATING. Push, pull, pan, drift, hold — chosen against
 *       what the last two shots did, so a reel is a sequence of moves rather
 *       than one move eleven times.
 *
 * WHAT THE BRIEF WROTE IS NEVER OVERRULED. A director who said "from 1.5 to
 * 1.0, focus hunts, caption at 0.2" gets exactly that; the pass only fills in
 * what nobody wrote. That is this repo's first law applied one level up.
 */
/**
 * THE GROUND UNDER A TYPOGRAPHIC SHOT.
 *
 * A drawn field is the whole picture in a shot with no photograph, so it cannot
 * be the reel's darkest preset — a near-black grid under cream type is not a
 * designed frame, it is a fade-out somebody put words on. The two fields with a
 * lit centre give the type something to sit on and the camera something to move
 * against, and a little drawn light off the episode's own side finishes it.
 */
/**
 * A COLOUR PULLED TOWARD BLACK, keeping its hue.
 *
 * Multiplying the channels rather than blending with black or dropping the
 * lightness in HSL: multiplication is what less light actually does to a
 * surface, and it leaves the relationship between the three stops intact.
 */
function dim(hex, k) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex));
  if (!m) return hex;
  const v = Number.parseInt(m[1], 16);
  const ch = [(v >> 16) & 255, (v >> 8) & 255, v & 255].map((c) => Math.max(0, Math.min(255, Math.round(c * k))));
  return `#${ch.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

function graphicGround(look) {
  return {
    field: look.field === 'grid' || look.field === 'paper' ? 'spotlight' : look.field,
    fieldColours: look.fieldColours,
    glowX: look.side > 0 ? Math.round(WIDTH * 1.06) : Math.round(-WIDTH * 0.06),
    glowY: Math.round(HEIGHT * 0.22),
    /**
     * A DRAWN GROUND HAS TO SUPPLY ITS OWN LIGHT.
     *
     * Law 3 says the premium is the layer drawn OVER the photograph. With the
     * photograph refused there is no photograph to light, and the glow that was
     * calibrated as an accent on a plate was the only illumination in the
     * frame — which is why every drawn shot rendered as a diagram in a dark
     * room. Raised enough to model the ground and no further: this is a lamp
     * off to one side, not a key light.
     */
    glowSize: 560,
    glowIntensity: 0.62,
    glowWarm: look.accent,
    glowDepth: 0.1,
  };
}

const CAMERA_TEMPLATES = new Set(['composite', 'parallax-punch']);

/**
 * NOTHING STANDS WHERE THE WORDS ARE.
 *
 * A dashed wire frame was placed at the middle of the closing card and drawn
 * straight through "FOURTEEN HUNDRED", striking the footer out on its way past.
 * Every check passed: the prop was inside the frame, inside the safe area, the
 * right size, and the type was inside the frame too. Nobody compared them.
 *
 * The type band is not negotiable — a sentence is the only part of a shot the
 * viewer has to read — so the object moves. Where there is a clear band above
 * or below it stands there; where there is not, it is DROPPED, because a
 * graphic with nowhere to stand is not a graphic, it is clutter.
 *
 * The height model is the one the checker uses; two models would disagree, and
 * the disagreement would surface as a warning nobody could act on.
 */
function standClear(props, zone) {
  // The checker's own model, imported rather than restated — see `propHeight`.
  const heightOf = (prop) => propHeight(prop, WIDTH);
  const boxOf = (prop, y) => {
    const w = Number(prop.width) || WIDTH * 0.42;
    const x = Number(prop.x) || WIDTH / 2;
    const half = heightOf(prop) / 2;
    return {left: x - w / 2, right: x + w / 2, top: y - half, bottom: y + half, text: carriesText(prop)};
  };
  /**
   * The checker calls two boxes one place at 0.35 of either area; clearing to
   * 0.3 leaves the decision on the planner's side of the line rather than on
   * the boundary, where a rounded pixel decides it.
   *
   * BUT A PLAQUE IS A SENTENCE WITH A BEVEL ON IT. Two props that both carry
   * words get no tolerance at all: a newspaper lying over a quarter of a
   * plaque is not a quarter of a defect, it is the words BC missing off the
   * end of "BAALBEK · 27 BC", which is how that shot was delivered — under the
   * threshold, past the checker, and unreadable. Type wins over graphics
   * (law 29); this is the same law applied where BOTH objects are type.
   */
  const carriesText = (prop) => Boolean(prop.text || prop.masthead);
  const clashes = (a, b) => {
    const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
    const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
    if (w <= 0 || h <= 0) return false;
    const over = w * h;
    const areaA = Math.max(1, (a.right - a.left) * (a.bottom - a.top));
    const areaB = Math.max(1, (b.right - b.left) * (b.bottom - b.top));
    const tolerance = a.text && b.text ? 0.02 : 0.3;
    return over / areaA > tolerance || over / areaB > tolerance;
  };
  const out = [];
  const placed = [];
  for (const prop of props) {
    // A beam is a shaft of light from off-frame; it has no body to collide with.
    if (prop.kind === 'beam') {
      out.push(prop);
      continue;
    }
    const half = heightOf(prop) / 2;
    const y = Number(prop.y) || HEIGHT * 0.55;
    /**
     * AND NOT WHERE ANOTHER OBJECT ALREADY STANDS.
     *
     * The type pass moved every prop independently, so two props with nowhere
     * else to go were both moved to the one clear strip and delivered on top of
     * each other — a plaque reading ONE LIFETIME with a newspaper laid across
     * it, in the closing shot of three of the five episodes. Clearing the words
     * and clearing the furniture are the same question asked twice, so they are
     * answered in one pass: each candidate position is tested against the type
     * band AND against everything already standing, and a prop with no clear
     * position is dropped for the same reason as before.
     */
    const clearOfType = (at) => !zone || at + half <= zone.top || at - half >= zone.bottom;
    const clearOfProps = (at) => {
      const box = boxOf(prop, at);
      return placed.every((b) => !clashes(box, b));
    };
    /**
     * The floor and ceiling are the SAFE AREA the checker measures against, not
     * the frame edge. Bounding to the frame moved a displaced newspaper down to
     * within forty pixels of the bottom, where the platform draws its own
     * furniture: the collision was gone and a second warning had taken its
     * place, which is not a fix.
     */
    const usable = (at) =>
      at - half >= HEIGHT * 0.04 && at + half <= HEIGHT * 0.9 && clearOfType(at) && clearOfProps(at);
    /**
     * AND "AS FAR OVER AS IT WILL GO" IS A POSITION TOO.
     *
     * The candidates were "just clear of the thing" and nothing else, so an
     * object whose ideal spot fell a few pixels outside the safe area was
     * DROPPED rather than nudged back in. A newspaper 611px tall wanted its
     * centre at 378 and the floor was 382: four pixels, and the closing card of
     * three reels lost its front page. Each candidate is therefore also offered
     * clamped into the safe band — if the clamped position still clears the
     * words and the other objects, it stands there.
     */
    /**
     * A pixel of slack, because the bound is fractional and the position it
     * produces is rounded to an integer: a clamp that lands exactly on the
     * floor rounds DOWN through it, and the checker measures the rounded value.
     * Four tenths of a pixel put a newspaper outside the safe area.
     */
    const floor = HEIGHT * 0.04 + half + 1;
    const ceiling = HEIGHT * 0.9 - half - 1;
    const clamp = (v) => Math.min(ceiling, Math.max(floor, v));
    const candidates = [y];
    if (zone) {
      const wanted = [zone.top - half - 24, zone.bottom + half + 24];
      // A second object sent to the same strip stacks behind the first.
      for (const b of placed) {
        wanted.push(b.top - half - 24, b.bottom + half + 24);
      }
      for (const v of wanted) candidates.push(v, clamp(v));
    }
    const at = candidates.find((c) => usable(c));
    if (at === undefined) continue; // dropped: a graphic with nowhere to stand is clutter.
    placed.push(boxOf(prop, at));
    out.push(at === y ? prop : {...prop, y: Math.round(at)});
  }
  return out;
}

/** Where the shot's own words are, in pixels. Null when it has none. */
function typeZone(scene) {
  const p = scene.params ?? {};
  if (p.title || p.spinTo) {
    const size = Number(p.titleSize) || WIDTH * 0.115;
    const cy = Number(p.titleY) || HEIGHT * 0.5;
    return {top: cy - size * 1.1, bottom: cy + size * 1.1 + (p.footer ? size * 0.9 : 0)};
  }
  const caption = Array.isArray(p.caption) ? p.caption : [];
  if (caption.length) {
    const size = Number(p.captionSize) || 88;
    const top = Number(p.captionY) || 300;
    return {top, bottom: top + caption.length * size * 1.3};
  }
  return null;
}

/**
 * AN AUTHORED ARRIVAL, READ BACK AS AN EDITORIAL DECISION.
 *
 * The brief writes in the engine's vocabulary because that is what a person
 * looking at the reel can picture. The Cut Director thinks in the editorial
 * one, and the two have to be counted together — otherwise a reel where every
 * seam was authored would report itself as entirely hard cuts.
 */
const AUTHORED_CUT = {slam: 'OBJECT_WIPE', slip: 'DIRECTIONAL', flare: 'FLASH', rack: 'MORPH', blinds: 'MASK'};

function applyDirection({
  scene,
  line,
  index,
  total,
  rand,
  look,
  recent,
  durationInFrames,
  isContinuation = false,
  read = null,
  quota = {camera: {}, transition: {}, framing: {}},
  representation = null,
  previousScene = null,
}) {
  const params = scene.params ?? (scene.params = {});
  let caption = Array.isArray(params.caption) ? params.caption : [];
  const props = scene.props ?? [];
  const written = line?.shot ?? {};

  // WHAT THE SHOT ALREADY DOES, most important first. The caption is why the
  // shot is as long as it is, so it never queues behind a decoration.
  /**
   * A GRAPHIC MUST NOT SAY WHAT THE CAPTION IS ALREADY SAYING.
   *
   * The narration said "for fifty years nobody looked inside", a card said
   * "FIFTY YEARS / nobody looked inside", and the caption said "for FIFTY YEARS
   * before anyone looked inside" — one sentence, three times, in three
   * typefaces. That is not emphasis; it is an echo, and it costs the graphic
   * its only real job, which is to carry what a voice cannot: the apparatus. A
   * date range, a place, an accession number.
   *
   * So an echoing prop keeps its LABEL and loses its sentence. Where the label
   * itself is the echo, the apparatus replaces it, and where there is no
   * apparatus to be had the prop goes — an object with nothing to say is one of
   * the two things this repo's second law forbids.
   */
  if (caption.length) {
    const capWords = new Set(caption.join(' ').toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []);
    const echo = (text) => {
      const own = String(text ?? '').toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
      return own.filter((w) => w.length > 3 && capWords.has(w)).length >= 2;
    };
    scene.props = props.filter((prop) => {
      if (prop.kind === 'wire' || prop.kind === 'beam') return true;
      const sentence = [prop.text, ...(prop.lines ?? [])].filter(Boolean).join(' ');
      if (!echo(sentence) && !echo(prop.heading)) return true;
      if (prop.lines) delete prop.lines;
      if (echo(prop.text)) delete prop.text;
      const label = labelFor({vo: scene.voText ?? '', kicker: line?.kicker, place: line?.place});
      if (label && !echo(label)) {
        prop.heading = label.toUpperCase();
        return true;
      }
      // The heading survives only if it is a label rather than a sentence.
      return Boolean(prop.heading) && String(prop.heading).split(/\s+/).length <= 3 && !echo(prop.heading);
    });
  }


  const kept = scene.props ?? props;
  const wants = [];
  if (caption.length) wants.push('caption');
  // A CARD IS AN EVENT AND IT OWNS THE OPENING BEAT. Left out of the list, the
  // slate's title and a filler mark were both scheduled at frame six — one
  // beat wearing two hats, on the shot that closes the reel.
  if (params.title || params.kicker) wants.push('slate');
  kept.forEach((_, i) => wants.push(`prop${i}`));
  if (params.motif) wants.push('motif');
  if (params.mark) wants.push('mark');

  /**
   * THE DRAWN VISUAL IS AN EVENT, AND USUALLY THE SHOT'S BIGGEST.
   *
   * Declared before the budget is spent so it takes an early beat rather than
   * queueing behind a decoration — a gear train that starts turning two thirds
   * of the way through a two-second shot is a gear train nobody sees.
   */
  const drawn = representation?.diagram ?? null;
  if (drawn) wants.unshift('diagram');

  const plan = directShot({durationInFrames, index, total, rand, wants, recent, fps: FPS});

  /**
   * A SLATE'S TYPE OWNS THE MIDDLE OF THE FRAME.
   *
   * Every drawing this engine makes is built around the centre — a vertical
   * rule, a ring, a train of wheels, a dimensioned figure — and a slate puts
   * its verdict there. Put both in and the timeline is ruled straight through
   * "THE MACHINE ARRIVED", which is what shipped. There is no placement that
   * fixes it: the two elements want the same third of the frame.
   *
   * So the slate keeps its words. A closing card IS the typographic
   * representation; asking it to also be the drawn one is asking one shot to be
   * two, and the shot it becomes is neither.
   */
  const slate = scene.sceneType === 'title-slate';
  if (drawn && slate) {
    plan.representation = 'TYPOGRAPHY';
    plan.drawingRefused = `a ${drawn.type} and a slate want the same third of the frame`;
  }

  if (drawn && !slate) {
    const at = plan.at.diagram ?? 4;
    /**
     * A DIAGRAM DRAWS ITSELF ONCE.
     *
     * On the second shot of the same idea it is ALREADY THERE — the timeline
     * has been drawn, the count has landed. Re-running both makes the cut a
     * reset rather than a new angle, and the figure climbing to thirty twice is
     * the reel contradicting itself. The gears keep turning, because they were
     * turning before the cut and would not stop for it.
     */
    /**
     * WHERE THE DRAWING IS THE SHOT, IT STARTS AT THE TOP OF THE SHOT.
     *
     * A gear train scheduled on beat two opens the shot on an empty field for
     * a third of a second and then begins — which is the "opens on a still"
     * fault, applied to the one element the shot exists for.
     */
    /**
     * A SLATE'S TYPE OWNS THE MIDDLE OF THE FRAME.
     *
     * Every drawing this engine makes is built around the centre — a vertical
     * rule, a ring, a train of wheels, a dimensioned figure — and a slate puts
     * its verdict there. Put both in and the timeline is ruled straight through
     * "THE MACHINE ARRIVED", which is what shipped. There is no placement that
     * fixes it: the two elements want the same third of the frame.
     *
     * So the slate keeps its words. A closing card IS the typographic
     * representation; asking it to also be the drawn one is asking one shot to
     * be two, and the shot it becomes is neither.
     */
    const own = representation.mode === 'PROCEDURAL' || representation.mode === 'DIAGRAM';
    /**
     * A CONTINUATION OF A SHOT THAT NEVER DREW IT IS NOT A CONTINUATION.
     *
     * A continuation stands the same drawing in the same room, so it arrives
     * already made — `over: 1`, no second draw-on, because re-drawing a
     * mechanism the viewer watched assemble one cut ago is the "every
     * continuation shows the same plate again" fault read backwards.
     *
     * But a slate suppresses its own drawing (its type owns the middle of the
     * frame, four comments up), so the shot after a slate is the FIRST sight of
     * that drawing however the planner labelled it. Twenty million barrels was
     * therefore delivered by a counter that went from 0 to its final value in
     * ONE FRAME and then held for sixty-three — law 15 asks a number to make
     * its magnitude felt, and a number that is simply already there makes
     * nothing felt at all. Continuation is a fact about the PREVIOUS SHOT, so
     * it is read off the previous shot.
     */
    const carriedOver = isContinuation && Boolean(previousScene?.diagram);
    /**
     * AND IT IS ALREADY FINISHED ON THE FRAME THE CUT LANDS ON.
     *
     * `from: 0, over: 1` looked like "instant", and it is one frame too late:
     * the plates read progress as `(frame - from) / over`, so at frame ZERO a
     * carried-over drawing is at progress 0 — its FIRST state. A sword that had
     * been hammered and folded across three shots snapped back to a raw grey
     * wedge for a thirtieth of a second at every cut, then re-advanced. One
     * frame is enough: it is the frame the cut lands on (law 30), and law 31
     * asks the same object to CONTINUE. Starting one frame in the past makes
     * the drawing complete when the shot opens.
     */
    scene.diagram = carriedOver
      ? {...drawn, from: -1, over: 1}
      : {
          ...drawn,
          from: own ? 0 : at,
          /**
           * MORE STATES NEED MORE OF THE SHOT.
           *
           * A fixed 45% is right for a drawing that assembles once and then
           * holds. A drawing that runs through STATES has to spend that time
           * n-1 times over, and at 45% a three-state run gave each transition
           * about half a second: plaster poured into a cavity went from empty
           * to finished between two sampled frames, so the stage the whole
           * sequence exists to show was the one nobody saw.
           */
          over: Math.max(
            14,
            Math.round(
              durationInFrames *
                Math.min(0.86, 0.45 + Math.max(0, (drawn.stages?.length ?? 2) - 2) * 0.2),
            ),
          ),
          ...(drawn.type === 'gearSystem' && drawn.count ? {countTo: drawn.count} : {}),
        };
    /**
     * AND THE FIGURE LANDS BEFORE THE CUT.
     *
     * The count's window used to be derived inside the component from the
     * drawing's schedule, which on a 58-frame shot put the landing at frame 60:
     * the reel shipped showing 29 on a claim about thirty gears. The planner
     * knows how long the shot is, so the planner writes the window, and the
     * component and the checker both read it.
     */
    if (scene.diagram.countTo !== undefined) {
      const win = countWindow(scene.diagram, durationInFrames);
      scene.diagram.countFrom = win.start;
      scene.diagram.countOver = win.over;
    }
    delete scene.diagram.gears;
    plan.representation = representation.mode;

    /**
     * AND THE DRAWING DOES NOT NEED TO BE TOLD WHAT IT ALREADY SAYS.
     *
     * Every procedural plate prints its own honesty line — law 24 requires it —
     * so a brief that ALSO asks for those words on screen gets them twice: a
     * SCHEMATIC RECONSTRUCTION card typed into the middle of the frame, right
     * over the plate's state label, while SCHEMATIC RECONSTRUCTION · NOT TO
     * SCALE stood at the bottom of the same shot. Two labels, one claim, and
     * one of them laid through a sentence (law 29). The disclosure belongs to
     * the drawing; a sticker repeating it is clutter in the middle of the
     * frame.
     */
    const declared = String(scene.diagram.disclosure ?? 'SCHEMATIC RECONSTRUCTION · NOT TO SCALE').toUpperCase();
    if (Array.isArray(scene.onScreenText)) {
      scene.onScreenText = scene.onScreenText.filter(
        (t) => !declared.includes(String(t.text ?? '').trim().toUpperCase()),
      );
      if (!scene.onScreenText.length) delete scene.onScreenText;
    }

    /**
     * THE DRAWING GETS ITS SPACE AND THE WORDS TAKE WHAT IS LEFT.
     *
     * Placement written for a photograph is wrong once a diagram is in the
     * frame, however carefully it was written — the picture it was avoiding is
     * not the thing that is there now.
     */
    /**
     * …AND THE DRAWING KNOWS ITS OWN SHAPE BETTER THAN ITS TYPE DOES.
     *
     * A caption zone per TYPE is right where every instance of that type has
     * the same silhouette. A terrain section does not: an impounded valley is
     * clear across the top and a mountain flank is solid there, so the zone
     * that keeps the words off a reservoir lays them straight through a
     * volcano. Where the builder — the only thing that knows which landform it
     * just drew — declares a band, that wins; the type default covers the rest.
     */
    const zone = scene.diagram.captionZone ?? CAPTION_ZONE[drawn.type];
    if (zone && caption.length) {
      // The zone says where the words belong relative to the drawing; the safe
      // area says how far down they may go. The block is placed to satisfy both,
      // which on a short caption means the zone and on a long one means the floor.
      const block = caption.length * (Number(params.captionSize) || 84) * 1.3;
      params.captionY = Math.round(Math.min(HEIGHT * zone.y, HEIGHT * 0.88 - block));
      params.captionAlign = zone.align;
      params.captionScrim = Math.max(Number(params.captionScrim) || 0, 0.38);
    }

    /**
     * AND A DRAWN CARD DOES NOT REPEAT THE DRAWING.
     *
     * A timeline that reads "50 YEARS UNOPENED" with an index card beside it
     * reading "FIFTY YEARS / nobody looked inside" is the same fact three times
     * — once spoken, once drawn, once typed. The diagram is the more
     * informative of the two, so the card goes.
     */
    scene.props = (scene.props ?? []).filter((prop) => {
      if (prop.kind === 'wire' || prop.kind === 'beam') return true;
      const copy = [prop.text, prop.heading, ...(prop.lines ?? [])].filter(Boolean).join(' ').toLowerCase();
      const drawnWords = JSON.stringify(scene.diagram).toLowerCase();
      const own = copy.match(/[\p{L}\p{N}]+/gu) ?? [];
      const shared = own.filter((w) => w.length > 3 && drawnWords.includes(w)).length;
      return shared < 2;
    });
  }

  /**
   * A HELD BEAT STOPS ADDING THINGS.
   *
   * The hold is not empty time — it is the shot continuing with nothing NEW in
   * it, which is what lets a claim land. So the events are compressed into the
   * front of the shot and the tail is left alone. Without this a verdict keeps
   * introducing wireframes and marks over the sentence it is supposed to be
   * letting the viewer read.
   */
  if (read?.hold && durationInFrames > 60) {
    const tail = Math.round(durationInFrames * 0.62);
    for (const key of Object.keys(plan.at)) plan.at[key] = Math.min(plan.at[key], tail);
  }
  // The slate's own copy lands on the beat the schedule gave it.
  if (plan.at.slate !== undefined && params.titleFrame !== undefined) {
    params.titleFrame = Math.max(4, plan.at.slate);
    /**
     * AND THE REEL HAS TO LAND BEFORE THE CUT.
     *
     * Exactly the fault the counter had, on the other device, and it survived
     * because the fix was applied to `countWindow` and never to the spin. The
     * beat schedule can put the slate late in a short shot; `spinFrames` was
     * derived from the shot's whole length regardless, so on a forty-five frame
     * shot the reel was still rattling at frame 56 — the answer arrives after
     * the cut, which means the shot's one job never happens.
     *
     * Pull the spin in first, because a slightly faster reel is a smaller loss
     * than a late one; only if that is not enough does the slate itself move
     * earlier. Nine frames is the floor at which a reel is still a reel.
     */
    const spin = Number(params.spinFrames);
    if (Number.isFinite(spin) && spin > 0) {
      /**
       * AND THE CLAIM IS LEFT TIME TO BE READ.
       *
       * Six frames was the "it lands before the cut" clamp, and landing before
       * the cut is not the same as landing. A fact that appears two tenths of a
       * second before black has been stated and not delivered — the shape a
       * closing beat needs is ARRIVAL, EMPHASIS, HOLD, CUT, and the hold is the
       * part that quietly disappears when a shot is trimmed.
       *
       * Reserved against the same reading rate the captions use, so the ending
       * and the captions cannot disagree about how long words take.
       */
      const words = String(params.spinTo ?? params.title ?? '').split(/\s+/).filter(Boolean).length +
        String(params.footer ?? '').split(/\s+/).filter(Boolean).length;
      const hold = Math.max(Math.round(FPS * 0.8), readingFrames(words, FPS));
      const room = durationInFrames - hold - params.titleFrame;
      if (spin > room) {
        params.spinFrames = Math.max(9, Math.min(spin, room));
        if (params.titleFrame + params.spinFrames > durationInFrames - hold) {
          params.titleFrame = Math.max(2, durationInFrames - hold - params.spinFrames);
        }
      }
    }
  }

  /**
   * A THIN SHOT NEEDS A THING, NOT A JOLT.
   *
   * A composite with one plate and nothing standing in front of it has no
   * depth to move — that is law 4 failing in the config rather than in the
   * engine. Shaking the camera does not fix it; it shakes a flat picture. So
   * where the frame is thin, the filler is something that STANDS in it.
   */
  const thin = scene.sceneType === 'composite' && (scene.layers ?? []).length < 2 && !props.length;
  if (thin) plan.fill = plan.fill.map((k) => (k === 'shake' ? (recent.fillers.at(-1) === 'wire' ? 'beam' : 'wire') : k));

  /**
   * THE CAMERA. Written beats derived, every time.
   *
   * A brief that names `camera.from` and `camera.to` has decided the move and
   * the pass leaves it alone — but a written push says nothing about roll, or
   * handheld, or whether the frame is struck when the card lands, and those
   * were simply never set by anything. So the derived move fills the silence
   * around the written one instead of replacing it.
   */
  const wroteCamera = written.camera?.from !== undefined || written.camera?.to !== undefined;

  /**
   * THE CAMERA IS CHOSEN FOR A REASON, AND UNDER A QUOTA.
   *
   * `directShot`'s move was picked from a list with a three-in-a-row guard, and
   * eight of the last reel's ten moves came out as pull-backs — because every
   * continuation forced one and nothing counted the total. A sliding window of
   * three cannot see a device used eighty per cent of the time.
   *
   * So the move now comes from what the BEAT is doing (a reveal pushes, a
   * verdict holds), no family may take more than about a third of the reel, and
   * two shots of one picture may not repeat the move — which is what makes the
   * second one a new shot rather than the first one again.
   */
  const directed = directCamera({
    beat: read?.beat ?? 'CONTEXT',
    rand,
    durationInFrames,
    used: quota.camera,
    total,
    share: 0.25,
    intensity: plan.intensity,
    impactAt: plan.camera.shakeAt?.[0] ?? null,
    /**
     * On a continuation, the previous move on the same plate. Otherwise the
     * move that has ALREADY run twice: three of anything is a tic, and the
     * check that says so counts across subjects while this only ever looked
     * within one — so three pushes ran in a sword's forging sequence and the
     * director had no idea it had made them.
     */
    reframeFrom: isContinuation
      ? recent.camera[recent.camera.length - 1] ?? null
      : recent.camera.length >= 2 && recent.camera[recent.camera.length - 1] === recent.camera[recent.camera.length - 2]
        ? recent.camera[recent.camera.length - 1]
        : null,
    sameSubject: isContinuation,
  });
  const camera = {...directed.params};
  /**
   * A WRITTEN CAMERA DESCRIBES THE LINE'S OWN SHOT, NOT ITS CONTINUATIONS.
   *
   * The brief says how this line is seen; it says nothing about the second and
   * third angles the cut invents to hold that line. Letting the written move
   * cover them meant every continuation fell back to the planner's alternating
   * pull-back — seven pull-backs in twelve shots, and the quota never saw them
   * because the quota was never consulted.
   */
  if (wroteCamera && !isContinuation) {
    delete camera.pushFrom;
    delete camera.pushTo;
    delete camera.pushEndFrame;
  }
  /**
   * ONLY WHERE THERE IS A CAMERA TO MOVE.
   *
   * A pan written into a title slate is a number in a config that nothing
   * reads. It costs nothing at render and it costs plenty later, because the
   * next person to look at the file believes the card is panning. The
   * templates that own a camera are the ones built out of plates.
   */
  if (!CAMERA_TEMPLATES.has(scene.sceneType)) {
    for (const key of ['panX', 'panY', 'roll', 'handheld', 'shakeAt', 'shakeAmount']) delete camera[key];
  }
  Object.assign(params, camera);

  /**
   * HOW THE SHOT ARRIVES — motivated, capped, and never blank.
   *
   * `rack` was on five of eleven cuts in the last reel: forty-five per cent of
   * it arriving out of focus. `blinds` opened a two-second shot on a completely
   * black frame and `flare` opened another on a white one, each eating a fifth
   * of a shot before anything could be seen. None of that is caught by a rule
   * about consecutive repeats.
   *
   * A written `shot.cut` still wins — the sentence that asked for a slam gets
   * its slam — but everything derived now answers to the beat and the quota.
   */
  if (index > 0 && (!written.cut || isContinuation)) {
    /**
     * THE EDITORIAL DECISION COMES FIRST, THE EXECUTION SECOND.
     *
     * `directTransition` answered "which arrival" and could not answer "an
     * arrival at all?", so every seam past the first got decorated with
     * whatever the quota still had room for. The Cut Director answers the
     * earlier question: what IS this cut. A hard cut is a first-class answer
     * and a rhyme between two shots is the strongest cut available — both of
     * them made of nothing, both of them previously unreachable.
     */
    const decision = directCut({
      previous: previousScene,
      next: scene,
      beat: read?.beat ?? 'CONTEXT',
      rand,
      used: quota.cut ?? (quota.cut = {}),
      total,
    });
    /**
     * AND THE EXECUTION STILL ANSWERS TO THE REEL.
     *
     * The safety rules live one layer down and stay there: a short shot refuses
     * to open unreadable, a third repeat is refused, an arrival may not eat the
     * shot. If the requested arrival cannot be afforded the answer is a plain
     * cut — which is the Cut Director's own fallback, so nothing is lost in
     * translation.
     */
    const arrival = decision.execution
      ? directTransition({
          beat: read?.beat ?? 'CONTEXT',
          rand,
          durationInFrames,
          used: quota.transition,
          total,
          previous: recent.transition ?? [],
          prefer: decision.execution,
        })
      : {kind: 'cut', frames: 0, purpose: TRANSITION_PURPOSE.cut};
    scene.transition = arrival.kind === 'cut' ? undefined : {kind: arrival.kind, frames: arrival.frames};
    quota.transition[arrival.kind] = (quota.transition[arrival.kind] ?? 0) + 1;
    (recent.transition ??= []).push(arrival.kind);
    // A stylised cut that came back as a plain one is a plain one — the reel is
    // counted by what it SHOWS, not by what was asked for.
    const kind = arrival.kind === 'cut' && decision.execution ? 'HARD_CUT' : decision.kind;
    quota.cut[kind] = (quota.cut[kind] ?? 0) + 1;
    plan.cut = {
      kind,
      purpose: kind === 'HARD_CUT' ? null : decision.purpose,
      because:
        kind === decision.kind
          ? decision.because
          : `${decision.kind} was refused: ${arrival.kind === 'cut' ? 'the arrival could not be afforded here' : arrival.kind}`,
    };
    plan.transitionKind = arrival.kind;
    plan.transitionPurpose = arrival.purpose;
  } else if (scene.transition) {
    // An authored arrival keeps its character and loses its excess.
    const kept = clampArrival(scene.transition.kind, scene.transition.frames ?? 10, durationInFrames);
    scene.transition = {...scene.transition, frames: kept};
    quota.transition[scene.transition.kind] = (quota.transition[scene.transition.kind] ?? 0) + 1;
    (recent.transition ??= []).push(scene.transition.kind);
    // Authored, so the editorial reason is the author's; it is still counted,
    // because the cap on how much of a reel is decorated is about the FINISHED
    // reel and does not care who asked for each piece of it.
    const kind = AUTHORED_CUT[scene.transition.kind] ?? 'DIRECTIONAL';
    (quota.cut ??= {})[kind] = (quota.cut[kind] ?? 0) + 1;
    plan.cut = {kind, purpose: 'authored', because: `the brief writes ${scene.transition.kind} on this line`};
    plan.transitionKind = scene.transition.kind;
    plan.transitionPurpose = TRANSITION_PURPOSE[scene.transition.kind];
  } else if (index > 0) {
    // No arrival and nobody asked for one: still a decision, still recorded.
    (quota.cut ??= {}).HARD_CUT = (quota.cut.HARD_CUT ?? 0) + 1;
    plan.cut = {kind: 'HARD_CUT', purpose: null, because: 'the brief writes a hard cut here'};
  }

  /**
   * ATMOSPHERE AND FOCUS NEED A REASON.
   *
   * Fog was on all twelve shots and a focus hunt on eight. A haze in every
   * frame is not atmosphere, it is why the whole reel was grey; a lens that
   * hunts in every shot is not a lens, it is a filter. Both are now bounded by
   * the shot's own length and refuse to stack on a soft arrival.
   */
  if (CAMERA_TEMPLATES.has(scene.sceneType)) {
    const air = atmosphereFor({
      vo: scene.voText ?? '',
      beat: read?.beat ?? 'CONTEXT',
      durationInFrames,
      transitionKind: scene.transition?.kind,
      rand,
    });
    /**
     * A LENS CANNOT HUNT IN A FRAME WITH NOTHING PHOTOGRAPHIC IN IT.
     *
     * The hunt is a camera finding its subject, and it is applied to the whole
     * shot. On a shot whose only content is TYPE, the thing that goes soft is
     * the sentence — a caption that opens out of focus, which is not a lens
     * effect but a rendering fault, and it is what five unrelated episodes
     * delivered. Blur is a photographic device; it needs a photograph.
     */
    const photographic = Object.keys(scene.assets ?? {}).length > 0;
    params.focusPx = photographic ? air.focusPx : 0;
    params.fog = air.fog;
    plan.fogReason = air.fogReason;
  }

  // WHEN THE WORDS ARRIVE, and which one the line is for. A caption placed by
  // hand keeps its frame; the emphasis is picked either way, because nothing
  // in a brief has ever named one and the line still has a word that matters.
  if (caption.length) {
    if (written.text?.at === undefined && plan.at.caption !== undefined) {
      params.captionFrame = plan.at.caption;
    }
    /**
     * WORDS THAT ARRIVE AFTER THE CUT ARE WORDS NOBODY SEES.
     *
     * The portal template held its caption until the flight into the picture
     * was over — `push + 48` — which was correct while every shot was seven
     * seconds and became nonsense the moment one was under two: the caption
     * was scheduled at frame 69 of a 58-frame shot and simply never appeared.
     * Nothing reported it. The reel rendered, and one of its shots was mute.
     *
     * The clamp is the backstop, not the fix; the fix is that the templates
     * below derive their schedules from the shot's own length.
     */
    /**
     * AND HOW LATE IS TOO LATE DEPENDS ON THE WORDS, not only on the shot.
     *
     * Sixty-two per cent of the shot is the right ceiling for three words and
     * far too late for seven. A diagram takes the front of its shot, the
     * caption queues behind it, and on a two-second shot that put six words on
     * screen with eight tenths of a second left — a caption that renders, that
     * every check passed, and that nobody read. The clamp now asks how long
     * these particular words need, using the same figure the editor judges by.
     */
    const words = caption.join(' ').split(/\s+/).filter(Boolean).length;
    const lastUseful = Math.max(2, Math.min(Math.round(durationInFrames * 0.62), durationInFrames - readingFrames(words, FPS)));
    if (Number(params.captionFrame) > lastUseful) params.captionFrame = lastUseful;
    if (Number(params.captionRecedeAt) <= Number(params.captionFrame)) {
      params.captionRecedeAt = Math.max(1, durationInFrames - 6);
    }
    /**
     * THE EMPHASIS COMES OUT OF THE WORDS ON SCREEN, not out of the sentence.
     *
     * Taken from the fragment, a shot whose caption was written by hand got an
     * emphasis that is not in its caption — "statues" picked out of "Among the
     * statues lay a lump" while the screen reads "a lump of / corroded metal".
     * The type layer then matches it against words that are not there and
     * nothing is emphasised at all, silently.
     */
    const emphasis = line?.emphasis ?? emphasisOf(caption.join(' ')) ?? emphasisOf(scene.voText ?? '');
    /**
     * AND IT HAS TO FIT ON ONE LINE.
     *
     * The type layer sets the emphasis inside a line, so a phrase straddling
     * the break between two of them matches nothing — the caption renders with
     * no emphasis and the run says nothing about it. Where the phrase does not
     * survive the line breaks, its longest word does.
     */
    const fits = emphasis && caption.some((l) => l.toLowerCase().includes(emphasis.toLowerCase()));
    const usable = fits
      ? emphasis
      : (emphasis || '')
          .split(/\s+/)
          .filter((w) => caption.some((l) => l.toLowerCase().includes(w.toLowerCase())))
          .sort((a, b) => b.length - a.length)[0];
    if (usable) params.captionEmphasis = usable;
    params.captionReveal = plan.reveal;
    params.captionMark = plan.emphasisMark;
    params.captionWordEvery = 2 + Math.round(rand() * 2);

    /**
     * WHEN THE WORDS ARE THE SHOT, THEY ARE SET LIKE A STATEMENT.
     *
     * The last rung of the representation ladder is DESIGNED TYPOGRAPHY, and
     * what this pipeline was producing on that rung was a caption: 84 pixels of
     * text in the top-left corner of an otherwise empty frame, sized and placed
     * for a photograph that had been refused. Five unrelated episodes came out
     * that way — forty-one shots where the type occupied about eight per cent
     * of the picture and the other ninety-two was drawn ground. Every gate
     * passed. The frames are unusable.
     *
     * A caption is a label on something. A statement IS the thing. So where the
     * shot has no plate and no drawing, the words take the column, take the
     * optical centre, and are set at statement scale — which is the size the
     * slate has always used for exactly this reason.
     *
     * Nothing new is invented here: the hierarchy already said the type was
     * primary on these shots. It was simply never asked.
     */
    const bare = !Object.keys(scene.assets ?? {}).length && !scene.diagram;
    if (bare && caption.length) {
      /**
       * AND IT IS RE-BROKEN FOR THE SHAPE IT IS NOW IN.
       *
       * The lines were chosen for a caption: about twenty characters each, over
       * as few lines as read well beside a picture. Set as the whole shot, a
       * twenty-character line pins the type size to about seventy pixels — so
       * making the words the hero and leaving the wrap alone gets a slightly
       * larger caption, not a statement. The same sentence over five short
       * lines carries three times the size in the same column.
       */
      const wrapped = captionLines(scene.voText ?? caption.join(' '), params.captionEmphasis ?? '', {
        ideal: 12,
        maxLines: 5,
      });
      if (wrapped.length) {
        caption = wrapped;
        params.caption = wrapped;
      }
      const longest = caption.reduce((n, l) => Math.max(n, l.length), 0);
      /**
       * THE MARGIN COMES FROM THE DNA, not from a second opinion about it.
       *
       * This line said `WIDTH * 0.075` — 81px — while three other places in
       * this file said 84. Captions are set left, so their left edge is the
       * strongest alignment in the frame, and three episodes shipped with two
       * of them. A margin expressed twice is a margin.
       */
      const margin = Math.round(WIDTH * TYPE.margin);
      const column = WIDTH - margin * 2;
      // Fill the column, then stay inside the two sizes a statement lives
      // between: below the floor it is a caption again, above the ceiling a
      // three-word line runs off both edges.
      /**
       * SIZED BY THE SAME ARITHMETIC THE CHECKER MEASURES WITH.
       *
       * The emphasis word is set larger than the rest of its line, so a block
       * that fits at the nominal size does not fit once one word grows — 0.58
       * per character, inflated by 1.16 for the emphasis, which is exactly what
       * `boundsOf` computes. Sizing to the nominal width put six captions past
       * the right edge of the frame, and the clipping check said so.
       */
      /**
       * AND THE FIT WINS OVER THE AMBITION.
       *
       * A floor under the statement size is a promise the column cannot always
       * keep: a fourteen-character line fits at 160, a twenty-six-character one
       * does not fit at 84, and holding the floor put eleven captions past the
       * right edge. So the column decides the maximum and the statement scale
       * is a CEILING to grow toward, never a minimum to insist on.
       */
      const size = Math.min(184, Math.floor(column / Math.max(1, longest * 0.58 * 1.16)));
      const block = caption.length * size * 1.2;
      params.captionSize = size;
      params.captionX = margin;
      // Optically centred, which sits slightly above true centre.
      params.captionY = Math.round(Math.max(HEIGHT * 0.1, Math.min(HEIGHT * 0.46 - block / 2, HEIGHT * 0.86 - block)));
      params.captionAlign = 'left';
      // A scrim darkens type against a photograph. There is no photograph.
      params.captionScrim = 0;
      /**
       * AND THE CUT LANDS ON THE STATEMENT, NOT ON AN EMPTY FRAME.
       *
       * Law 30, applied to the one representation it had never been applied to.
       * The rule was written for diagrams — a mechanism that draws itself is
       * nothing at frame zero, so the cut arrives on debris — and the answer
       * was to set the geometry out first. Words have exactly the same problem
       * and it is worse, because a shot whose ONLY content is type is, until
       * its first word lands, a shot with nothing in it at all. Every one of
       * these shots opened on black for about four tenths of a second: across
       * twenty cuts, eight seconds of a fifty-second reel.
       *
       * So the stack starts BEFORE the cut. The first line is already set when
       * we arrive and the rest land onto it, which is what kinetic type does in
       * every documentary that uses it. The negative frame is not a trick: it
       * says the words were already on screen, and on a continuation they
       * literally were.
       */
      params.captionFrame = -12;
      plan.typeIsTheShot = true;
    }
  }

  // EVERY DRAWN OBJECT ON ITS OWN BEAT. Two cards landing on the same frame are
  // one event with a thickness; a beat apart they are two things happening.
  kept.forEach((prop, i) => {
    const at = plan.at[`prop${i}`];
    if (at !== undefined && written.props?.[i]?.at === undefined) prop.from = at;
  });

  // The motif's own beat. The key is `motifFrame`, and writing `motifFrom`
  // here put a number in the config that the engine does not read — a motif
  // scheduled by nothing, which is how it was before this pass existed.
  if (params.motif && plan.at.motif !== undefined) params.motifFrame = plan.at.motif;

  /**
   * FILLING A SHOT THAT DOES NOTHING.
   *
   * The important half of this pass. Everything above re-times events the shot
   * already had; this is what happens when it had none — which was four shots
   * out of seven.
   */
  /**
   * A SHAFT OF LIGHT NEEDS SOMETHING CASTING IT.
   *
   * The event filler already refuses a beam in a shot with no lamp; the prop
   * planner did not, and could not — the atmosphere is decided here, after the
   * props are made. So the rule lived in one of the two places that put beams
   * in shots, which is the same as not existing, and four unrelated episodes
   * each shipped three beams over drawn ground with nothing casting them.
   *
   * It has to happen BEFORE the filler runs. Removing the beam afterwards left
   * one shot with no events at all — the beam had been its only one — and a
   * repair that empties a shot has traded a warning for an error.
   */
  if (Array.isArray(scene.props) && !(Number(params.glowSize) > 0)) {
    scene.props = scene.props.filter((q) => q.kind !== 'beam');
    if (!scene.props.length) delete scene.props;
  }

  for (const kind of plan.fill) {
    const at = plan.at[kind];
    /**
     * A SLATE'S STATEMENT IS NOT MARKED.
     *
     * The card is already a typographic device: a rule above, a rule below, a
     * kicker over and a qualifier under. The filler added a third mark on top
     * of that and, with no caption to attach to, placed it from the scene
     * anchor — which on a slate is the middle of the frame. A strike was drawn
     * horizontally through "FOURTEEN HUNDRED", so the reel's closing shot spent
     * four seconds appearing to cross its own verdict out.
     */
    if (kind === 'mark' && (params.title || params.spinTo)) {
      /**
       * BUT THE CARD STILL NEEDS ITS SECOND BEAT.
       *
       * Refusing the mark cannot leave the closing shot with one event in four
       * seconds. The card has one to give that it was throwing away: the
       * qualifier under the rules used to fade up with the title, so "fourteen
       * hundred / years before anything like it" arrived as a single object.
       * Landing the figure and then the sentence is how the line is SPOKEN.
       */
      if (params.footer && params.footerFrame === undefined) {
        const lands = (Number(params.titleFrame) || 6) + (Number(params.spinFrames) || Number(params.countOver) || 20);
        params.footerFrame = Math.min(Math.round(durationInFrames * 0.72), lands + 8);
        plan.fill = plan.fill.filter((k) => k !== 'mark');
        continue;
      }
      continue;
    }
    if (kind === 'mark' && !params.mark) {
      /**
       * A MARK IS MADE ON SOMETHING.
       *
       * Placed at a random x and y it is a yellow line lying in the middle of
       * the frame under nothing — which fails the only test a graphic has to
       * pass: it explains, measures, locates, highlights or connects, or it
       * comes out. So it attaches: under the words when there are words, and
       * around the subject when there are not.
       */
      const lines = caption.length;
      const size = Number(params.captionSize) || 82;
      Object.assign(
        params,
        lines
          ? {
              mark: 'underline',
              markX: Math.round(Number(params.captionX) || WIDTH * TYPE.margin),
              markY: Math.round((Number(params.captionY) || 300) + lines * size * 1.24),
              markWidth: Math.round(Math.min(WIDTH * 0.72, size * 0.58 * Math.max(...caption.map((l) => l.length)))),
              markHeight: 10,
              markFrame: at,
            }
          : {
              mark: look.mark === 'underline' ? 'oval' : look.mark,
              markX: Math.round((Number(params.anchorX) || WIDTH * 0.5) - WIDTH * 0.22),
              markY: Math.round((Number(params.anchorY) || HEIGHT * 0.5) - HEIGHT * 0.1),
              markWidth: Math.round(WIDTH * 0.44),
              markHeight: Math.round(HEIGHT * 0.16),
              markFrame: at,
            },
      );
      continue;
    }
    // A SHAFT OF LIGHT IS THE FALLOFF OF A SOURCE. With no source in the shot
    // it proves nothing and reads as a smear on the lens, which is the test a
    // decorative graphic fails.
    if (kind === 'beam' && !(Number(params.glowSize) > 0)) continue;
    /**
     * A WIREFRAME CLOSES ON SOMETHING.
     *
     * It is a hand-drawn outline AROUND A SUBJECT, so with no plate in the shot
     * there is nothing for it to close on and what gets drawn is an empty
     * dashed rectangle hanging in the dark. One shipped over the closing card
     * of the last reel, and once it was moved off the verdict's type it was
     * simply an empty box in the sky — the graphic had never had a job.
     */
    if (kind === 'wire' && !Object.keys(scene.assets ?? {}).length) continue;
    if ((kind === 'wire' || kind === 'beam') && !props.some((p) => p.kind === kind)) {
      // A wireframe closes on the SUBJECT, so it goes near the anchor the whole
      // stack is scaling about; a beam comes from wherever the light does,
      // which is decided once for the episode and not per shot.
      const near = kind === 'wire';
      props.push({
        kind,
        depth: near ? round(between(rand, [0.6, 0.95]), 2) : round(between(rand, [0.18, 0.4]), 2),
        x: near
          ? Math.round(Number(params.anchorX) || WIDTH * 0.5)
          : Math.round(WIDTH * (look.side > 0 ? 0.78 : 0.22)),
        y: near ? Math.round(HEIGHT * between(rand, [0.36, 0.56])) : 0,
        width: Math.round(WIDTH * (near ? between(rand, [0.32, 0.52]) : between(rand, [0.26, 0.4]))),
        from: at,
        ...(near ? {shape: pick(rand, ['circle', 'diamond', 'rect'])} : {opacity: round(between(rand, [0.5, 0.8]), 2)}),
      });
      scene.props = props;
      continue;
    }
    if (kind === 'shake' && !params.shakeAt && CAMERA_TEMPLATES.has(scene.sceneType)) {
      params.shakeAt = [at];
      params.shakeAmount = Math.round(8 + plan.intensity * 12);
    }
  }

  /**
   * RECORD WHAT IS ACTUALLY IN THE CONFIG, not what was chosen.
   *
   * A continuation keeps its own alternating push/pull, so the director's
   * choice is thrown away for it — and pushing the discarded choice into the
   * memory made the anti-repeat rule reason about a camera nobody would see.
   * Three pull-backs in a row went unnoticed for exactly that reason.
   */
  const from = Number(params.pushFrom ?? 1);
  const to = Number(params.pushTo ?? 1);
  const actual =
    Math.abs(Number(params.panX) || 0) > 40
      ? 'pan'
      : to - from > 0.06
        ? 'push'
        : from - to > 0.06
          ? 'pull'
          : 'hold';
  /**
   * RECORD THE DECISION; DO NOT MAKE ANYONE INFER IT.
   *
   * A drift sets a small scale change and a vertical travel, and any classifier
   * reading `pushTo - pushFrom` calls that a push — so the reel reported sixty
   * per cent pushes while the director had spent two. Every downstream check
   * was then arguing with a measurement rather than with a choice. The engine
   * ignores this param; the report and the critique read it instead of guessing.
   */
  const family = CAMERA_TEMPLATES.has(scene.sceneType) ? actual : directed.kind;
  params.cameraMove = wroteCamera && !isContinuation ? actual : directed.kind;
  params.cameraPurpose = directed.purpose;
  /**
   * WHO CHOSE THIS MOVE.
   *
   * The quota can refuse a move it derived and cannot refuse one the brief
   * wrote — written wins, and that is the right law. But it means a reel can
   * come out over the ceiling with the director having done everything
   * correctly, and the warning then reads as a bug in the planner. Recording
   * authorship turns "push on half the reel" into "push on half the reel, and
   * three of them are in your brief", which is a note somebody can act on.
   */
  if (wroteCamera && !isContinuation) params.cameraAuthored = true;
  quota.camera[params.cameraMove] = (quota.camera[params.cameraMove] ?? 0) + 1;
  recent.camera.push(params.cameraMove);
  plan.cameraKind = directed.kind;
  plan.cameraPurpose = directed.purpose;
  recent.reveal.push(plan.reveal);
  recent.mark.push(plan.emphasisMark);
  recent.fillers.push(...plan.fill);

  /**
   * LAST, AFTER EVERY ELEMENT HAS ITS PLACE: get the graphics off the words.
   *
   * It has to be last. The caption's frame, its size and the slate's title are
   * all decided above, so the type band does not exist until here — moving a
   * prop any earlier would be moving it away from a sentence that had not been
   * written yet.
   */
  /**
   * THE MOTIF IS FRAME-LOCKED, WHICH IS NOT THE SAME AS FREE TO SIT ANYWHERE.
   *
   * A route drew itself across the caption of "he crossed the Sahara" — the two
   * best things in the shot, on top of each other. Law 14 pins the motif to the
   * frame rather than to the room; it says nothing about which part of the
   * frame, and the part with the sentence in it is spoken for.
   */
  /**
   * AND OFF THE DRAWING, WHICH IS THE OTHER THING IN THE FRAME.
   *
   * Clearing the words was half the law. A route motif drew itself straight
   * across a strait's own shipping markers, across a quarry map's pin, across
   * two chambers of a heart and along the blade of a sword — five shots in
   * which the two graphics that carry the sentence were laid on top of each
   * other. The motif was moved away from the type and nothing ever asked where
   * the DIAGRAM was, so the clear band it was sent to was the band the drawing
   * occupies.
   *
   * The drawing's position is not guessed: `boundsOf` and `throughTheCamera`
   * are the functions the checker measures with, so the planner asks them.
   * Two models of where a gear train is would disagree, and the disagreement
   * would surface as a warning nobody could act on.
   */
  /**
   * AND A MOTIF IS REFUSED WHEN THE DRAWING ALREADY PLAYS ITS VERB.
   *
   * The check below this one is geometric — it moves a motif off whatever it
   * would sit on, and drops it when there is nowhere clear. It cannot see the
   * other way a motif goes wrong, which is being the SECOND graphic in the shot
   * saying the same thing. A map that draws a route between two named places
   * was also handed a `route` motif drawing its own line across the same frame:
   * two diagonals crossing, and the dimension label "5 MILES" sitting exactly
   * on the intersection. Neither line was out of bounds and neither overlapped
   * enough of the other to trip the geometry, so the frame shipped with a
   * graphic through a sentence (law 29) that every check called clean.
   *
   * Law 14 says the motif plays the VERB of the sentence. If the drawing is
   * already playing it, the sentence does not have a second verb.
   */
  const PLAYED_BY = {
    map: ['route'],
    scaleHaulage: ['route'],
    timeline: ['tally', 'rise'],
    gearSystem: ['rise'],
    /**
     * A SECTION IS NOT A TALLY SHEET.
     *
     * The number-word rule put a row of tally strokes in the sky over a valley
     * because the sentence said "two hundred and sixty-two". Tally marks count
     * occurrences; a dam's height is a dimension, and the section draws it as
     * one. Nothing here counts, so nothing here tallies.
     */
    terrainSection: ['tally', 'rise', 'route'],
  };
  if (params.motif && (PLAYED_BY[scene.diagram?.type] ?? []).includes(String(params.motif))) {
    delete params.motif;
    delete params.motifX;
    delete params.motifY;
    delete params.motifSize;
    delete params.motifCount;
    delete params.motifFrame;
    delete params.motifColour;
    delete params.motifOpacity;
  }

  if (params.motif) {
    const zone = typeZone(scene);
    const size = Number(params.motifSize) || WIDTH * 0.3;
    const x = Number(params.motifX) || WIDTH * 0.5;
    const y = Number(params.motifY) || HEIGHT * 0.45;
    const others = throughTheCamera(
      scene,
      boundsOf(scene, {width: WIDTH, height: HEIGHT}).filter(
        (b) => b.role === 'drawn' && !String(b.what).startsWith('motif'),
      ),
      {width: WIDTH, height: HEIGHT},
    );
    const clearOfType = (at) => !zone || at + size / 2 <= zone.top || at - size / 2 >= zone.bottom;
    const clearOfDrawing = (at) => {
      const box = {left: x - size / 2, right: x + size / 2, top: at - size / 2, bottom: at + size / 2};
      return others.every((b) => {
        const w = Math.min(box.right, b.right) - Math.max(box.left, b.left);
        const h = Math.min(box.bottom, b.bottom) - Math.max(box.top, b.top);
        if (w <= 0 || h <= 0) return true;
        const over = w * h;
        const mine = Math.max(1, size * size);
        const theirs = Math.max(1, (b.right - b.left) * (b.bottom - b.top));
        return over / mine <= 0.3 && over / theirs <= 0.3;
      });
    };
    const usable = (at) =>
      at - size / 2 >= HEIGHT * 0.04 && at + size / 2 <= HEIGHT * 0.9 && clearOfType(at) && clearOfDrawing(at);
    if (!usable(y)) {
      const candidates = [];
      if (zone) candidates.push(zone.top - size / 2 - 30, zone.bottom + size / 2 + 30);
      for (const b of others) candidates.push(b.top - size / 2 - 30, b.bottom + size / 2 + 30);
      const at = candidates.find((c) => usable(c));
      /**
       * A motif with nowhere to stand is DROPPED, for the reason a prop is:
       * the shot already has a graphic saying what the sentence says, and a
       * second one laid over it is not emphasis, it is noise. Law 14's "a bare
       * shot is what makes the others exist" is the same sentence read from
       * the other end.
       */
      if (at === undefined) {
        delete params.motif;
        delete params.motifX;
        delete params.motifY;
        delete params.motifSize;
      } else {
        params.motifY = Math.round(at);
      }
    }
  }

  /**
   * A DRAWING NEEDS A GROUND DARKER THAN THE DRAWING.
   *
   * The four chambers of a heart came out as grey buttons because the field
   * behind them was a wash running from bright ochre at the top of the frame,
   * and a schematic is LINE WORK: pale strokes, thin labels, a muted contour.
   * Put light lines on a light ground and the drawing does not lose a little
   * contrast, it stops being visible — the brightest thing in a shot about a
   * heart was the empty air beside it.
   *
   * The palette is not replaced, only pulled down: the reel still looks like
   * itself, the hues are the same family, and the values go where a plate's
   * values belong. Photographic shots keep the ground they were given, because
   * there the ground is BEHIND a picture rather than under a pen.
   */
  /**
   * AND THE WEATHER STANDS BEHIND THE SENTENCE, NOT IN FRONT OF IT.
   *
   * Fog is drawn nearest the viewer, which is where fog is. It is also the one
   * place a caption cannot survive: at three fifths strength across the band
   * the words are in, a shot's sentence becomes a rumour. Atmosphere is worth
   * having and the words are worth reading, so the fog is pulled back over the
   * type rather than switched off — the shot keeps its air and loses nothing
   * the viewer had to read.
   */
  {
    const q = scene.params ?? {};
    const capY = (Number(q.captionY) || 0) / HEIGHT;
    const fogTop = 1 - (Number(q.fogHeight) || 0.62);
    if ((Number(q.fog) || 0) > 0.5 && Array.isArray(q.caption) && q.caption.length && capY > fogTop) {
      q.fog = 0.42;
    }
  }

  if (scene.diagram && Array.isArray(scene.params?.fieldColours)) {
    const pull = [0.26, 0.34, 0.72];
    scene.params.fieldColours = scene.params.fieldColours.map((hex, i) => dim(hex, pull[i] ?? 0.4));
  }

  if (Array.isArray(scene.props) && scene.props.length) {
    const before = scene.props.length;
    /**
     * A DRAWING DOES NOT NEED A DECORATION ON TOP OF IT.
     *
     * `wire` is the one prop with nothing of its own to say — it is a shape
     * that frames whatever it is put around, and it exists for the shot that
     * would otherwise be bare. A shot carrying a gear train or an orbit is the
     * opposite of bare, and the ring was landing directly on the mechanism: two
     * circles of the same colour in the same place, one of them meaningless.
     */
    if (scene.diagram) scene.props = scene.props.filter((q) => q.kind !== 'wire');
    /**
     * NOR DOES A SENTENCE. The same argument, and the case it was missing.
     *
     * A pure graphic exists so a shot with nothing in it is not empty. A shot
     * whose entire content is three lines of type is not empty — the words ARE
     * the subject, and the whole point of a typographic shot is that the
     * representation director could find no honest picture and said so. What it
     * delivered instead was a dashed diamond rotating above the words, related
     * to nothing, drawn because a slot was free.
     *
     * `wire` and `beam` are the two props with nothing of their own to say, so
     * they are the two that go. A plaque or a card carries the line's own label
     * and stays.
     */
    const typeOnly = !scene.diagram && !(scene.layers ?? []).length;
    if (typeOnly) scene.props = scene.props.filter((q) => q.kind !== 'wire' && q.kind !== 'beam');
    /**
     * AND A PROP DOES NOT REPEAT THE CARD'S OWN WORDS.
     *
     * A plaque carries its shot's label (law 2) and a slate prints that label
     * too, so the opening and closing cards of all five reels said the same six
     * words twice — once set as type and once screwed to a brass plate three
     * hundred pixels below it. Two treatments of one fact is not emphasis, it
     * is a frame with nothing else to say.
     */
    const spoken = new Set(
      [scene.params?.title, scene.params?.kicker, scene.params?.footer]
        .filter(Boolean)
        .map((v) => String(v).trim().toUpperCase()),
    );
    if (spoken.size) {
      scene.props = (scene.props ?? []).filter(
        (prop) => prop.kind !== 'plaque' || !spoken.has(String(prop.text ?? '').trim().toUpperCase()),
      );
    }
    scene.props = standClear(scene.props, typeZone(scene));
    if (scene.props.length < before) plan.propsDropped = before - scene.props.length;
    if (!scene.props.length) delete scene.props;
  }
  return plan;
}

function planContinuation({line, index, part, fragment, frames: measured, rand, look, previousTransition, plate, side, cutouts, recentProps}) {
  const assetBase = `s${String(index + 1).padStart(2, '0')}-${line.slug ?? 'shot'}`;
  const corner = part % 4;
  const frames = measured ?? framesFor(fragment);
  const lines = captionLines(fragment, line.emphasis ?? emphasisOf(fragment));
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
    : line.graphicsOnly
    ? {assets: {}, layers: [], groundDepth: 0.1}
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
    // A continuation cuts on the FRAGMENT it is about to speak, not on the whole
    // line — that is the half of the sentence this shot exists for.
    // A CONTINUATION DOES NOT INHERIT THE DIRECTION. `shot.cut` names how THIS
    // shot arrives, and a continuation is a different shot — spreading the line
    // whole handed it the same instruction and produced three identical cuts in
    // a row, which is the tic the anti-repeat rule exists to prevent.
    transition: cutFor(
      {...line, vo: fragment, shot: {...line.shot, cut: undefined, cutFrames: undefined}},
      previousTransition,
      look.transitions,
      rand,
    ),
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
      ...(line.graphicsOnly ? graphicGround(look) : {}),
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
  /**
   * A PORTAL IS A FLIGHT INTO A PHOTOGRAPH.
   *
   * With every plate refused there is nothing to fly into, and the template
   * cheerfully derived two file names for pictures nobody has. A drawn shot is
   * a composite: it has a ground, a camera and somewhere to put the diagram.
   */
  if (line.graphicsOnly && (sceneType === 'portal-zoom-reveal' || sceneType === 'parallax-punch')) {
    sceneType = 'composite';
  }
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
  /**
   * AND A CARD NEEDS SOMETHING TO SAY ON IT.
   *
   * The rhythm rule swapped a repeated composite for a title-slate without ever
   * asking whether the line had a title. On an episode where most shots are
   * composites — which is every episode with no photographs in it — the swap
   * fired constantly, and lines with no kicker, no title and no footer became
   * BLANK CARDS: a scrim, a creep, and nothing written on it. Three unrelated
   * episodes shipped one, and two more were seven title cards long.
   *
   * A slate is a statement. Where the line has no statement to set, the shot
   * stays a composite and earns its difference the way the others do — a
   * different camera, a different caption, a different drawn object. Variety
   * that empties a shot is not variety.
   */
  const canSlate = Boolean(line.title || line.kicker || line.footer || bigNumber(line.vo));
  /**
   * AND THE ENDING IS NOT SUBJECT TO IT.
   *
   * The rhythm rule exists to stop a DERIVED rotation repeating itself, and it
   * fired on the one shot in the reel that is not derived: the closing card,
   * swapped to a composite because the shot before it also happened to be a
   * card. A short that ends by running out of narration over a diagram has no
   * ending — law 14's closing beat IS the typographic representation, and it is
   * as much a decision as a directed template. If two cards land back to back
   * the earlier one yields; the last one never does.
   */
  const isEnding = beat === 'close';
  if (!contentBound && !isEnding && recentTypes.length && recentTypes[recentTypes.length - 1] === sceneType) {
    if (sceneType !== 'composite') sceneType = 'composite';
    else if (canSlate) sceneType = 'title-slate';
  }
  // The shot lasts as long as ITS FRAGMENT takes to say — not as long as the
  // whole sentence does. That one change is what stopped every scene coming out
  // at the ceiling.
  const durationInFrames = frames ?? framesFor(fragment ?? line.vo);

  // Never the same arrival twice running: a repeated transition stops being a
  // choice and becomes a tic. Short, too — a cut that takes half a second is a
  // dissolve, and this reel is meant to CUT.
  const transition = index === 0 ? null : cutFor(line, previousTransition, look.transitions, rand);

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
      : line.graphicsOnly
        ? {}
        : {background: backdrop};
    // A hand-written title can BE the number — "TWELVE YEARS" — and the old
    // rule only looked at the voiceover on the `number` beat, so a slate whose
    // whole point was a figure got neither the count nor the spin.
    /**
     * A TITLE THE AUTHOR WROTE IS THE CARD, WHOLE.
     *
     * The number is EXTRACTED so a line can earn a slate without one being
     * typed; extracting it from a title that was typed is a different thing,
     * and it loses whatever the extractor does not recognise. An episode
     * closing on "FOURTEEN HUNDRED" delivered a card reading HUNDRED, because
     * the spelled-number list had no teens in it — and even with them, taking a
     * piece of a hand-written title is not a decision anything should make.
     *
     * So a written title spins or counts AS ITSELF. The extractor is only for
     * the line that never had one.
     */
    const number = line.title
      ? String(line.title).toUpperCase()
      : beat === 'number'
        ? bigNumber(line.vo)
        : '';
    const titleFrame = 4 + Math.round(rand() * 6);
    /**
     * A TITLE CARD WITH NO TITLE IS NOT A TITLE CARD.
     *
     * A hook beat has no figure to extract and usually no written title, so
     * `title` came out empty and the card was left holding a KICKER — a small
     * label, arriving at four fifths of the way through. All five reels
     * therefore opened on about two seconds of near-black followed by a line of
     * small caps, and a vertical short is decided in its first second.
     *
     * The card already has the words for it. A place and a date set large IS
     * the documentary opening — HORMUZ · 26°34′N, BAIAE · 40 BC — so where
     * there is no title the kicker becomes one rather than the card standing
     * empty. It is promoted, not copied: a kicker still printed above a title
     * that reads the same is the duplication one line down.
     */
    const written = (line.title ?? number ?? '').toString().toUpperCase();
    const promoted = !written && line.kicker ? String(line.kicker).toUpperCase() : '';
    scene.params = {
      scrim: round(between(rand, [0.36, 0.54])),
      kicker: promoted ? '' : line.kicker ?? '',
      title: written || promoted,
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
    /**
     * A MARK IS MADE ON SOMETHING, AND IT DOES NOT CANCEL IT.
     *
     * Two failures shipped here, both plain in one still and invisible to every
     * check because a mark and a title were each inside the frame and neither
     * knew about the other.
     *
     * The first: `strike` draws its line at the MIDDLE of its box, and the box
     * is the title's own band — so a reel whose mood mark is a strike delivered
     * "TWO MILES" and "TWENTY MILLION BARRELS" with a line ruled through them.
     * The reel crossed out its own claim. A strike means cancelled; a slate
     * exists to assert. Under a title it becomes the mark that emphasises
     * instead, which is the same decision already made one branch over when an
     * underline with no baseline becomes an oval.
     *
     * The second: a card with an empty title has nothing to mark, and the mark
     * was placed anyway — a gold rule lying across the dark under nothing, in
     * the OPENING shot of three of the five reels. A mark explains, measures,
     * locates, highlights or connects, or it comes out.
     */
    const MIDLINE_MARKS = new Set(['strike']);
    /**
     * AND AN ENCLOSING MARK CANNOT WRAP TWO SENTENCES.
     *
     * `oval` and `box` go AROUND what they mark, which is right for a figure
     * standing alone and wrong the moment the card also carries a qualifier:
     * the closing card of the concrete drew its ellipse around TWO THOUSAND and
     * ran the bottom of the arc straight through "years, and still curing". The
     * overlap check could not see it — a mark is classed as typography rather
     * than as a graphic, because touching the type is what a highlight is FOR —
     * and that reasoning holds for a mark on one word and breaks on a mark that
     * encircles a whole card.
     *
     * With a footer under the figure the mark becomes the one that sits at the
     * bottom edge of its own box and cannot wrap around a second line.
     */
    /**
     * AND A CARD THAT DRAWS ITS OWN RULES DOES NOT NEED A FOURTH ONE.
     *
     * Turning the enclosing mark into an underline moved the collision instead
     * of ending it: the rule then landed ON "years, and still curing" instead of
     * around it. The reason is that the mark's box is hardcoded pixel geometry —
     * 260/820/560/300, tuned for a card carrying nothing but a number — while
     * the slate itself is a FLEX-CENTRED block: kicker, rule, title, rule,
     * footer, its height and therefore its position decided at render time. Add
     * a qualifier and the block grows and shifts, and the fixed box no longer
     * knows where anything is.
     *
     * A slate already draws rules above and below its title. Those ARE the
     * mark.
     *
     * AND THE FOOTER WAS NEVER THE CONDITION — IT WAS ONE SYMPTOM.
     *
     * "No mark when the card carries a qualifier" fixed the case that had been
     * looked at and left the reasoning behind it unapplied. A two-word card
     * with no kicker and no footer sat higher in the frame than the guess, and
     * a bracket 260 pixels from the left edge came down through the gap in
     * "IT CHANGED" with its arms cutting across both of the slate's own rules:
     * a graphic through a sentence (law 29), on the shortest, loudest card in
     * the reel. The box cannot be right, because nothing upstream of the
     * renderer knows how tall a flex-centred block is — and a box that is only
     * usually right is a box that fails on the card nobody checked.
     *
     * So a slate takes no mark. It has two rules and it has the largest type
     * on the sheet; it does not need a third device drawn over the second one.
     * The die is still thrown so the seeded stream underneath every later
     * decision is unchanged.
     */
    /**
     * The draw is still TAKEN, and its result still thrown away, so that
     * refusing the mark does not shift the seeded stream underneath every later
     * decision: the short-circuit version of this line moved a mark off one
     * card and, three shots later, dropped a motif onto a caption. Same seed,
     * same reel.
     */
    rand();
  } else if (sceneType === 'evidence-board') {
    // A DIRECTED BACKGROUND, here too. These two templates are graphics-first
    // and derive their own plate, which quietly ignored an episode that had
    // named its own — the closing card asked for a file the brief never had.
    scene.assets = line?.shot?.layers?.length
      ? directedStack({shot: line.shot, rand, durationInFrames}).assets
      : line.graphicsOnly
        ? {}
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
      captionX: Math.round(WIDTH * TYPE.margin),
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
    /**
     * A FLIGHT SCALED TO THE SHOT, not to a seven-second one.
     *
     * These were `push + 22` and `push + 44`, fixed. At seven seconds the
     * flight took two thirds of the shot and landed; at two seconds it took
     * more than the whole shot, so the reveal the scene exists for happened
     * after the cut. Every key is a fraction now, which is the same law the
     * focus hunt was already fixed under.
     */
    const push = Math.round(durationInFrames * 0.3);
    const through = Math.round(durationInFrames * 0.66);
    scene.params = {
      frameWidth: 700 + Math.round(rand() * 140),
      frameRatio: round(between(rand, [0.9, 1.3]), 2),
      pushEndFrame: push,
      detachFrame: Math.round((push + through) / 2),
      throughEndFrame: through,
      weldRatio: round(between(rand, [0.34, 0.44]), 3),
      wallScaleEnd: round(between(rand, [5, 7]), 1),
      accent: look.accent,
      // Words land once the picture has, not during the flight — a caption
      // competing with the one move the shot exists for is a caption nobody
      // reads and a move nobody watches.
      caption: line.caption ?? [],
      captionX: Math.round(WIDTH * TYPE.margin),
      captionY: Math.round(between(rand, [1180, 1520])),
      captionFrame: Math.round(through + durationInFrames * 0.06),
      captionEvery: 7 + Math.round(rand() * 4),
      captionSize: 84 + Math.round(rand() * 10),
      captionRecedeAt: Math.max(1, durationInFrames - 18),
      // AFTER the arrival. The first half of this shot is the flight into the
      // picture; the second half is a photograph sitting still, and that is the
      // half a portrait wants gold falling past it.
      ...motifParams(motif, {rand, from: Math.round(through + durationInFrames * 0.08), accent: look.accent, stops: line.stops}),
    };
  } else {
    // COMPOSITE — the stack. Pieces are optional at RENDER time, so a piece
    // that fails to draw costs this shot some depth and never costs the reel;
    // they are not optional at WRITING time, which is where the brief is
    // refused for handing over six photographs.
    // A DIRECTED SHOT WINS. Same law as the props: what somebody thought about
    // beats what a rule derived, and the rule is only the fallback.
    /**
     * NO PICTURE IS NOT NO SHOT.
     *
     * A line whose plates the asset director refused used to fall through to a
     * derived `sNN-bg.png` — a file name for a photograph nobody had — so a
     * refusal produced a broken render instead of a decision. Now it produces
     * a DRAWN GROUND, and the shot becomes what it should have been all along:
     * a typographic shot that states the thing the reel cannot show.
     */
    const stack = line?.shot?.layers?.length
      ? directedStack({shot: line.shot, rand, durationInFrames})
      : line.graphicsOnly
        ? {assets: {}, layers: [], groundDepth: 0.1}
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
      /**
       * THE FIRST SHOT OF A LINE SPEAKS TOO.
       *
       * `line.caption` is what a brief WROTE, and most lines write nothing —
       * so the opening shot of five of six lines carried no words at all,
       * while every continuation derived its own from its fragment. Four of
       * the last reel's seven shots were silent pictures for that one reason.
       *
       * A written caption still wins. This only fills the silence.
       */
      // The emphasis is chosen BEFORE the breaks, so the breaks can be chosen
      // around it: a figure split across two lines cannot be emphasised.
      ...(line.graphicsOnly ? graphicGround(look) : {}),
      caption: line.caption?.length
        ? line.caption
        : captionLines(fragment ?? line.vo, line.emphasis ?? emphasisOf(fragment ?? line.vo)),
      ...captionPlacement({
        shot: line.shot,
        rand,
        durationInFrames,
        lines: line.caption?.length
          ? line.caption
          : captionLines(fragment ?? line.vo, line.emphasis ?? emphasisOf(fragment ?? line.vo)),
      }),
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

  /**
   * AND A CARD DOES NOT NEED A STICKER REPEATING ITS OWN FIGURE.
   *
   * Once the slate and the sticker read the same number the same way, they said
   * it twice in one frame: 262 METRES set as the largest type on the sheet with
   * 262 METRES typed underneath it. Two statements of one fact is not emphasis,
   * it is the shot arguing with itself about which of them is the point. The
   * card is where a figure lands (law 15), so the card keeps it.
   */
  const carriedByTheCard =
    line.onScreen &&
    typeof scene.params?.title === 'string' &&
    figureIn(String(line.onScreen)) !== null &&
    figureIn(String(line.onScreen)) === figureIn(String(scene.params.title));

  if (line.onScreen && !carriedByTheCard) {
    /**
     * A STICKER THAT FINISHES ARRIVING AS IT LEAVES WAS NEVER READ.
     *
     * "TWO MILES WIDE" was scheduled at 60% of a 45-frame shot for 32% of it —
     * fourteen frames. The typed style spends 55% of its life putting the
     * characters down, so the line stood complete for SIX FRAMES and then went
     * out, four frames before the cut. A fifth of a second is not a caption, it
     * is a flicker, and the frame grabs showed it mid-word at 66% and gone at
     * 94%.
     *
     * `readingFrames` was exported for exactly this and never called here — its
     * own comment says so: the planner is supposed to schedule against the
     * number the editor judges by. So the sticker is given the time its words
     * need AFTER it has finished arriving, and it runs to the cut rather than
     * leaving early: the cut is the exit, and an exit before the cut is a state
     * change nobody asked for.
     */
    const words = String(line.onScreen).trim().split(/\s+/).filter(Boolean).length;
    // The typed style lays characters down over 55% of its life, so the life
    // has to be long enough that the remaining 45% covers the read.
    const life = Math.min(
      durationInFrames,
      Math.max(Math.round(durationInFrames * 0.32), Math.ceil(readingFrames(words, FPS) / 0.45)),
    );
    const atFrame = Math.max(0, Math.min(Math.round(durationInFrames * 0.6), durationInFrames - life));
    scene.onScreenText = [
      {
        text: line.onScreen,
        atFrame,
        durationInFrames: durationInFrames - atFrame,
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
  // The director places a shaft of light too, and it has to come from the same
  // window everything else in the episode is lit by.
  look.side = side;
  // Pieces are placed only where there is a supply of clean cut-outs. See
  // buildStack: the brief still names them, nothing places them until this is on.
  const cutouts = brief.cutouts === true;

  /**
   * THE STORY BRAIN READS THE SCRIPT BEFORE ANYTHING IS PLANNED.
   *
   * Beat, pace, whether the beat wants air after it, what the viewer is meant
   * to notice. Everything below reasons about THIS rather than about the
   * sentence, because a sentence does not tell you whether it is a hook or a
   * verdict and those are not the same shot.
   */
  const story = readScript(brief.lines, {emphasisOf});

  /**
   * THE ASSET DIRECTOR RUNS BEFORE THE FIRST SHOT IS CHOSEN.
   *
   * Not after, and not as a warning. A refused plate changes what KIND of shot
   * the line becomes — a photograph-less line is a typographic shot, not a
   * broken one — and that decision has to be available while the shot is being
   * designed rather than reported once it is too late to act on.
   */
  const assetDir = path.join(dir, 'assets');
  const files = await readdir(assetDir).then((all) => all.filter((f) => /\.(png|jpe?g|webp)$/i.test(f))).catch(() => []);
  const reviewLedger = await loadReview(dir);
  const measured = {};
  for (const file of files) {
    measured[file] = await measureAsset(sharp, path.join(assetDir, file), {width: WIDTH, height: HEIGHT});
  }
  const centre = colourCentre(measured);

  /** Which role each file is being asked to play, read off the brief. */
  const roleOf = {};
  for (const line of brief.lines) {
    for (const layer of line?.shot?.layers ?? []) {
      const name = String(layer.asset ?? '').split(/[\\/]/).pop();
      if (name) roleOf[name] = String(layer.role ?? 'plate');
    }
  }

  const assetVerdicts = {};
  for (const file of files) {
    const line = brief.lines.find((l) => (l?.shot?.layers ?? []).some((y) => String(y.asset ?? '').endsWith(file)));
    const read = line ? story[brief.lines.indexOf(line)] : null;
    assetVerdicts[file] = judge({
      file,
      role: roleOf[file] ?? '(unused)',
      kind: (line?.shot?.layers ?? []).find((y) => String(y.asset ?? '').endsWith(file))?.kind ?? 'backdrop',
      measured: measured[file],
      reviewed: reviewLedger[file],
      idea: read?.idea,
      notice: read?.notice,
      episodeColour: centre,
    });
  }
  /**
   * A REFUSAL IS A RESULT.
   *
   * The rejected set is consulted when the stack is built, so the layer is
   * never placed at all — as opposed to being placed and then apologised for.
   */
  const rejectedAssets = new Set(
    Object.values(assetVerdicts).filter((v) => v.verdict === 'reject').map((v) => v.file),
  );
  const assetBriefs = Object.values(assetVerdicts)
    .filter((v) => v.brief)
    .map((v) => v.brief);

  /**
   * THE DECISION IS APPLIED TO THE BRIEF, BEFORE ANYTHING IS PLANNED.
   *
   * This is the ordering the whole second stage turns on. An asset decision
   * that arrives after the shot has been designed can only ever be a warning
   * printed next to a finished frame; applied here, a refusal actually changes
   * what kind of shot the line becomes, and a recast puts a picture in the role
   * it belongs in before a single coordinate has been derived from it.
   *
   * The brief on disk is untouched — this is the working copy. The authored
   * document stays the authored document, and the director's edit to it is
   * recorded in the report rather than written back over somebody's writing.
   */
  const recastNotes = [];
  /** Layers lifted out of one line to be stood up in another. */
  const moves = [];
  // How many plates the brief WROTE, kept before any are dropped, so a refusal
  // can be told apart from a brief that never named one.
  for (const line of brief.lines) {
    if (line.shot) line.shot.layersDeclared = (line.shot.layers ?? []).length;
  }
  for (const line of brief.lines) {
    const layers = line?.shot?.layers ?? [];
    if (!layers.length) continue;
    const kept = [];
    for (const layer of layers) {
      const name = String(layer.asset ?? '').split(/[\\/]/).pop();
      const verdict = assetVerdicts[name];
      if (verdict?.verdict === 'reject') {
        recastNotes.push({line: line.slug, drop: name, role: layer.role, why: verdict.note, brief: verdict.brief});
        continue;
      }
      /**
       * A CROSS-LINE RECAST — the casting decision proper.
       *
       * Some pictures are not wrong, they are in the wrong scene. A catalogue
       * photograph of corroded bronze weights is a poor grey wall and an
       * excellent illustration of "a wreck full of bronze"; leaving it where it
       * was meant throwing away the one asset that matched a line, while that
       * line got nothing. So the ledger may say where a picture belongs, and it
       * is moved there.
       */
      if (verdict?.recast?.line) {
        recastNotes.push({
          line: line.slug,
          move: name,
          from: layer.role,
          to: `${verdict.recast.line}.${verdict.recast.role}`,
          why: verdict.note,
        });
        moves.push({...layer, ...verdict.recast, role: verdict.recast.role});
        continue;
      }
      if (verdict?.recastAs && verdict.recastAs !== layer.role) {
        recastNotes.push({line: line.slug, recast: name, from: layer.role, to: verdict.recastAs, why: verdict.note});
        /**
         * A RECAST CHANGES THE ROLE AND THEREFORE THE JOB.
         *
         * The encrusted wreck find in this episode was cast as an empty wall
         * with a brick texture standing in front of it. Recast, it stops being
         * scenery and becomes the subject — which means it also stops being a
         * layer something else is placed over, and takes the depth of a thing
         * the camera is looking AT.
         */
        kept.push({...layer, role: verdict.recastAs, depth: Math.max(Number(layer.depth) || 0, 0.55)});
        continue;
      }
      kept.push(layer);
    }
    line.shot = {...line.shot, layers: kept};
    /**
     * A LINE WITH NO PICTURE IS A TYPOGRAPHIC SHOT.
     *
     * Not a failure and not an empty frame. The reel says what it can prove
     * with a photograph and STATES the rest, which is what a documentary does
     * when the footage does not exist — and it looks authored, where a wrong
     * photograph looks scraped.
     */
    if (!kept.length) line.graphicsOnly = true;
  }

  /**
   * AN ASSET THE BRIEF NEVER NAMED CAN STILL BE CAST.
   *
   * The recast mechanism above can only MOVE a picture the brief already cast
   * somewhere. That is not enough: refusing a plate often means the right
   * picture is a derived one — a crop, a keyed cut-out — that no brief mentions
   * because it did not exist when the brief was written. Without this the
   * refusal removed the bad plate and put nothing in its place, and two shots
   * came back as an empty field with a caption on it.
   */
  for (const [file, entry] of Object.entries(reviewLedger)) {
    if (!entry?.recastTo?.line) continue;
    if (roleOf[file]) continue; // already cast somewhere; handled above
    if (!files.includes(file)) continue;
    const target = brief.lines.find((l) => l.slug === entry.recastTo.line);
    if (!target) continue;
    recastNotes.push({introduce: file, to: `${entry.recastTo.line}.${entry.recastTo.role}`, why: entry.note});
    moves.push({...entry.recastTo, asset: file, role: entry.recastTo.role, kind: 'piece'});
  }

  // The moved plates, stood up in the lines they actually illustrate.
  for (const move of moves) {
    const target = brief.lines.find((l) => l.slug === move.line);
    if (!target) continue;
    target.shot = {...(target.shot ?? {}), layers: [...(target.shot?.layers ?? []), move]};
  }

  /**
   * A GROUND IS NEEDED WHENEVER NOTHING FILLS THE FRAME.
   *
   * Not only when every plate was refused. A shot can keep one subject and lose
   * its backdrop — which is exactly what a recast produces — and a subject
   * standing on nothing is a cut-out on black. The drawn field is what it
   * stands on, and it is also the fix for the recast plate's own problem: a
   * catalogue photograph on a white sweep must not fill a frame in a dark reel,
   * but it is perfectly good standing IN one.
   */
  for (const line of brief.lines) {
    const layers = line?.shot?.layers ?? [];
    const fills = layers.filter((l) => l.fill !== false && !l.height);
    /**
     * A LINE THAT NEVER DECLARED A PLATE IS NOT A LINE WHOSE PLATES WERE
     * REFUSED.
     *
     * An older brief names no layers at all and lets the planner derive a
     * backdrop file for it — that is a supported way to write one. Treating the
     * absence as a refusal turned three whole episodes graphics-only, deleted
     * every generation recipe they had, and left their configs naming nothing.
     * The drawn ground is the answer to a REFUSAL, and only to that.
     */
    const declared = (line?.shot?.layersDeclared ?? layers.length) > 0 || line.graphicsOnly === true;
    if (!fills.length && declared) {
      line.graphicsOnly = true;
      /**
       * AN AUTHORED CUT DIES WITH THE PICTURE IT WAS WRITTEN FOR.
       *
       * "blinds" was chosen because the shot opened onto a room full of museum
       * drawers. With that photograph refused there is no room to open onto —
       * only a drawn field — so the device becomes eight frames of solid black
       * at the head of a two-second shot and nothing behind it.
       */
      if (line.shot?.cut) line.shot = {...line.shot, cut: undefined};
      /**
       * AND SO DOES ITS AUTHORED CAPTION TIMING.
       *
       * "Words at halfway" was written for a shot whose first half was a
       * photograph doing the work. With the photograph gone the words ARE the
       * shot, and holding them back leaves thirty-seven frames of empty field.
       */
      if (line.shot?.text?.at !== undefined) {
        line.shot = {...line.shot, text: {...line.shot.text, at: undefined}};
      }
    } else if (fills.length) {
      delete line.graphicsOnly;
    }
  }

  /**
   * HOW EACH LINE IS TO BE SHOWN — decided before a single shot is designed.
   *
   * This is the ordering the last stage was still missing. The asset director
   * can refuse a picture, but a refusal on its own only produces a hole; the
   * question "what IS the truthful way to show this?" has to be asked next, and
   * it has to be asked before composition, because the answer changes what kind
   * of shot the line is.
   *
   * A mechanism with a count becomes a meshing gear train. A span of empty
   * years becomes a timeline. A claim about eclipses becomes orbital geometry
   * laid over the real moon. None of those are fallbacks — each is a better
   * shot than the photograph it replaces, and two of them are better than any
   * photograph that could exist.
   */
  const representation = {};
  const anchorYears = [
    ...new Set(brief.lines.flatMap((l) => [...String(l.vo).matchAll(/\b(1[0-9]{3}|20[0-9]{2})\b/g)].map((m) => Number(m[1])))),
  ].sort((a, b) => a - b);
  /**
   * THE BIGGEST THING THE REEL CLAIMS, SO IT IS THE SAME THING EVERY TIME.
   *
   * A haulage drawing sized itself from the sentence it was under, and the
   * sentences say different amounts: the shot naming eight hundred tons drew a
   * megalith, the one saying "they rolled them" drew a crate half its size, and
   * the reel cut between them as though they were the same stone. The load is a
   * CHARACTER — the whole episode is about one block — so its size is a
   * property of the reel, not of the line that happens to be under it.
   */
  const anchorFigure = Math.max(
    0,
    ...brief.lines.map((l) => figureIn(String(l.vo)) ?? 0).filter((v) => Number.isFinite(v)),
  );
  for (const line of brief.lines) {
    const read = story[brief.lines.indexOf(line)];
    const survives = (line?.shot?.layers ?? []).some((l) => {
      const name = String(l.asset ?? '').split(/[\\/]/).pop();
      return name && assetVerdicts[name]?.verdict !== 'reject';
    });
    representation[line.slug] = chooseRepresentation({
      vo: line.vo,
      beat: read?.beat,
      emphasis: read?.emphasis,
      photo: survives ? true : null,
      accent: look.accent,
      muted: '#cfc6ae',
      seed: `${episodeId}:${line.slug}`,
      anchorYears,
      anchorFigure,
      // Places the line names, so a map can draw them in the order it says.
      stops: line.stops ?? [],
    });
  }

  /**
   * A NUMBER INSIDE A CONTINUING DRAWING DOES NOT GET A CARD OF ITS OWN.
   *
   * `beatOf` turns any line with a number word into a title-slate, and it
   * already carves out the case where that is wrong: a line naming `stops`
   * stays a composite because "the itinerary needs the whole frame … left to
   * the number-word rule, 'four thousand miles' would make it a title card and
   * the route would be drawn straight through the title."
   *
   * A landslide is the same sentence read again. "The slab slid into the lake
   * in FORTY-FIVE SECONDS" and "TWO HUNDRED AND SEVENTY MILLION cubic metres of
   * rock took the reservoir's place" both became three-second cards counting up
   * on a black field — six seconds of the reel's payoff spent watching a
   * number, with the section that shows the thing happening cut away to make
   * room, and the counter passing through 188 and 267 on its way to 270 in a
   * shot whose whole job is one figure. The drawing already prints it.
   *
   * So: where a line's own representation is a drawing that CONTINUES the one
   * before it, the number goes on the drawing and the shot stays a composite.
   * A number card is still right where the number is the whole beat — a
   * standalone tonnage, a death toll — because there is no drawing to put it on.
   */
  {
    const drawnType = (slug) => representation[slug]?.diagram?.type ?? null;
    for (const [i, line] of brief.lines.entries()) {
      const mine = drawnType(line.slug);
      if (!mine) continue;
      const before = i > 0 ? drawnType(brief.lines[i - 1].slug) : null;
      const after = i + 1 < brief.lines.length ? drawnType(brief.lines[i + 1].slug) : null;
      if (mine !== before && mine !== after) continue;
      if (!NUMBER_WORD.test(line.vo)) continue;
      if (line.items || line.artefact || line.stops?.length >= 2 || line.pieces?.length) continue;
      // A hook and a verdict are cards by position, not by their numbers.
      if (i === 0 || i === brief.lines.length - 1) continue;
      line.shot = {...(line.shot ?? {}), template: 'composite'};
    }
  }

  /** Quotas, counted across the whole reel rather than over a sliding three. */
  const quota = {camera: {}, transition: {}, framing: {}};

  const planned = [];
  /** The last few arrivals, so a third repeat can be refused. */
  const previousTransition = [];

  /**
   * WHAT THE LAST FEW SHOTS DID.
   *
   * The anti-repeat guardrails need a memory, and it has to span the whole reel
   * rather than a line: a line that becomes three shots can repeat itself three
   * times without any per-line rule noticing.
   */
  const recent = {camera: [], reveal: [], mark: [], fillers: []};
  // How many SHOTS the reel will be, which is not how many lines it has. The
  // escalation curve needs to know where in the reel a shot sits, and "line 4
  // of 6" and "shot 8 of 12" are different places.
  const totalShots = brief.lines.reduce((n, line, i) => {
    const read = story[i];
    if (read.hold && i === brief.lines.length - 1) return n + 1;
    const budget = read.pace === 'fast' ? 2.2 : read.pace === 'slow' ? 4.2 : MAX_SPOKEN;
    return n + fragmentsOf(line.vo, budget).length;
  }, 0);
  let shotIndex = 0;

  brief.lines.forEach((line, index) => {
    // ONE SENTENCE, SEVERAL SHOTS. The first fragment gets the beat's template
    // and the line's artwork; the rest reuse that same picture from a different
    // corner. Nine long lines used to be nine identical seven-second scenes.
    /**
     * RHYTHM IS HOW MANY SHOTS A LINE BECOMES, not how its window is skewed.
     *
     * A short is not divided equally — a hook cuts fast and a verdict is
     * allowed to sit. But the window each line occupies is MEASURED from the
     * narration, and skewing time inside it would slide the captions off the
     * words they belong to. So the rhythm is spent on the number of shots
     * instead: a fast beat is cut into more, shorter shots and a slow one into
     * fewer, longer ones, and the audio stays exactly where it was.
     */
    const read = story[index];
    const budget = read.pace === 'fast' ? 2.2 : read.pace === 'slow' ? 4.2 : MAX_SPOKEN;
    /**
     * AND A VERDICT IS NEVER SPLIT.
     *
     * The last reel put "FOURTEEN HUNDRED" on a slate and then cut to a smaller,
     * quieter repeat of the same words over a worse picture — the payload on the
     * first shot and the silence on the second, so the reel decrescendoed into
     * its own ending. A closing beat that wants air gets one shot and keeps it.
     */
    const closing = read.hold && index === brief.lines.length - 1;
    const raw = closing ? [line.vo] : fragmentsOf(line.vo, budget);
    // THE SPOKEN WINDOW WINS. If the narration has been recorded, this line
    // starts and ends at measured times and the fragments divide that; only an
    // episode with no voiceover yet falls back to counting words.
    const spoken = voice?.lines?.[index];
    /**
     * AND A FRAGMENT TOO SHORT TO BE A SHOT IS NOT A SHOT.
     *
     * `fragmentsOf` counts WORDS, and the pace budget makes a hook's budget six
     * of them, so a seven-word hook was split — and the measured window for it
     * was two seconds, so the reel opened on EIGHTEEN FRAMES of a title card
     * and cut. Six tenths of a second is not an establishing shot; it is a
     * flash, and it was the flash the whole short is judged on.
     *
     * The word budget cannot see this because it does not know how long the
     * line takes to say. The measured window does. So once the window is known,
     * a cut below the floor merges back into its neighbour and the fragments
     * are re-divided — the audio never moves, only the number of shots over it.
     */
    let fragments = raw;
    let cuts = spoken ? splitWindow(fragments, spoken.start, spoken.end) : null;
    if (cuts) {
      const FLASH = Math.round(FPS * 0.8);
      let guard = fragments.length;
      while (fragments.length > 1 && guard-- > 0) {
        const worst = cuts.indexOf(Math.min(...cuts));
        if (cuts[worst] >= FLASH) break;
        const into = worst === 0 ? 1 : worst - 1;
        const merged = [...fragments];
        merged[Math.min(worst, into)] = `${fragments[Math.min(worst, into)]} ${fragments[Math.max(worst, into)]}`;
        merged.splice(Math.max(worst, into), 1);
        fragments = merged;
        cuts = splitWindow(fragments, spoken.start, spoken.end);
      }
    }

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
    const firstPlan = applyDirection({
      scene: result.scene,
      line,
      index: shotIndex,
      total: totalShots,
      rand,
      look,
      recent,
      durationInFrames: result.scene.durationInFrames,
      read: story[index],
      quota,
      representation: representation[line.slug],
      // The seam is between two shots, so the decision needs both of them. The
      // rhyme that makes a match cut lives in the pair and nowhere else.
      previousScene: planned[planned.length - 1]?.scene ?? null,
    });
    shotIndex += 1;
    previousTransition.push(result.scene.transition?.kind ?? 'cut');
    planned.push({...result, cut: firstPlan.cut ?? null});

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
      const partPlan = applyDirection({
        scene,
        line,
        index: shotIndex,
        total: totalShots,
        rand,
        look,
        recent,
        durationInFrames: scene.durationInFrames,
        read: story[index],
        quota,
        representation: representation[line.slug],
        previousScene: planned[planned.length - 1]?.scene ?? null,
        // A continuation already re-frames the plate on purpose — it alternates
        // push and pull-back so two shots of one photograph are not the same
        // shot twice. Handing it a fresh camera would throw that away.
        isContinuation: true,
      });
      shotIndex += 1;
      previousTransition.push(scene.transition?.kind ?? 'cut');
      // The continuation stands the SAME pieces in the same room, so it carries
      // the line's list too — otherwise the recipe builder, which now only
      // draws what a layer asks for, would find nothing asking for them.
      planned.push({scene, line, motif: '', pieces: line.pieces ?? [], cut: partPlan.cut ?? null});
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

  /**
   * HOW MUCH CAMERA EACH DRAWING CAN AFFORD, MEASURED RATHER THAN GUESSED.
   *
   * A photograph can take any push because there is more picture outside the
   * frame. A drawing has exactly the frame it was composed for, so the camera
   * that makes fourteen haulage shots look like fourteen shots is the same
   * camera that puts the haulers off the left edge and half a magnified section
   * past the right one.
   *
   * A fixed small share is the wrong answer twice over: too much for a section
   * that already spans three quarters of the width, and needlessly little for a
   * gear train sitting in the middle of the frame with room on every side. This
   * is the only place that knows both the camera and the drawing's extent, so
   * it hands each shot the LARGEST share that keeps every drawn box inside —
   * maximum variety, guaranteed framing.
   */
  /**
   * AND IT DOES NOT REPEAT THEM ONE CUT LATER EITHER.
   *
   * Dropping the plaque that said what the card already said fixed the frame
   * and not the reel: the shot AFTER the opening card carries the line's own
   * label, and the opening card's title is that label — so four of the five
   * reels announced BAALBEK · LEBANON in ninety-point type and then screwed the
   * same six words to a brass plate two seconds later. Nobody hears a place
   * named twice as emphasis; they hear it as a machine with one fact.
   *
   * A frame cannot see this and a scene cannot either. The reel can, so it is
   * asked here, where the neighbours exist — and it runs BEFORE the passes that
   * count events, because a dropped prop is one fewer arrival and those passes
   * have to count what is actually left.
   */
  const saidBy = (scene) =>
    [scene?.params?.title, scene?.params?.kicker, scene?.params?.footer]
      .filter(Boolean)
      .map((v) => String(v).trim().toUpperCase());
  for (const [index, scene] of config.scenes.entries()) {
    const spoken = new Set([...saidBy(scene), ...saidBy(config.scenes[index - 1])]);
    if (!spoken.size || !scene.props?.length) continue;
    scene.props = scene.props.filter(
      (prop) => prop.kind !== 'plaque' || !spoken.has(String(prop.text ?? '').trim().toUpperCase()),
    );
  }

  /**
   * A CARD WITH ONE THING ON IT PUTS THAT THING WHERE THE CUT LANDS.
   *
   * Law 30 says the frame a cut arrives on cannot be empty. Every slate in the
   * five reels is set up by something — a plaque, an emphasis mark, a tally —
   * arriving in the first third, and the figure lands on that. Two were given
   * nothing, and an empty card with a slow creep on it held for a second and a
   * half before its number appeared: the cut landed on nothing and stayed
   * there.
   *
   * A graphic cannot be invented to fill it — the middle of a type card belongs
   * to the words (law 14), and a mark placed over the figure would trade an
   * empty frame for a crossed-out one. So the card leads with the only thing it
   * has. A number that is there when you arrive and then held is how a title
   * card works; a number that appears once you have stopped looking is not.
   */
  for (const [index, scene] of config.scenes.entries()) {
    if (scene.sceneType !== 'title-slate') continue;
    const events = eventsOf(scene);
    const only = events[0];
    /**
     * AND THE REEL'S FIRST CARD STATES ITSELF AT ONCE.
     *
     * Every other shot inherits an established frame from the cut before it.
     * The first one has nothing behind it, so law 30's "the cut lands on
     * geometry already set out" has nothing to inherit — the card IS the
     * establishing shot. Left to the ordinary rule, all five reels opened on
     * about two seconds of near-black and then a line of type at four fifths of
     * the way through; one of them drew an emphasis rule under a title that had
     * not arrived, which satisfies the two-event count and still shows a
     * viewer nothing. A vertical short is decided in its first second.
     */
    const opening = index === 0;
    if (!opening && events.length !== 1) continue;
    if (!only || !['slate', 'spin', 'count'].includes(events[events.length - 1].kind)) continue;
    const lead = Math.round(scene.durationInFrames * (opening ? 0.16 : 0.3));
    if ((scene.params.titleFrame ?? 0) <= lead) continue;
    scene.params.titleFrame = lead;
  }

  /**
   * AND THE FIGURE LANDS BEFORE THE CUT — RE-CHECKED AFTER EVERYTHING MOVED IT.
   *
   * `countOver` is set from the shot's length at the moment the card is built,
   * and every pass since then is allowed to push `titleFrame` later: the beat
   * separator, the unearned-hold rescue, the early landing above. A card whose
   * count started at frame 53 and ran for 47 was scheduled to arrive at 100 in
   * an 86-frame shot, so the reel would have shipped a claim about a hundred
   * thousand heartbeats under a counter still climbing when the cut came.
   *
   * Law 15 says a number either climbs or stands, and a number cut off mid-climb
   * is neither. `countWindow` already knows how to bound one; it simply has to
   * be asked again once nothing else is going to move.
   */
  for (const scene of config.scenes) {
    const p = scene.params ?? {};
    if (p.countTo === undefined && p.spinTo === undefined) continue;
    const start = Number(p.titleFrame) || 0;
    const win = countWindow({from: start, countFrom: start, countOver: p.countOver ?? p.spinFrames}, scene.durationInFrames);
    if (p.countTo !== undefined) p.countOver = win.over;
    else p.spinFrames = Math.max(10, win.over);
  }

  /**
   * TWO ARRIVALS ONE FRAME APART ARE ONE ARRIVAL.
   *
   * An emphasis mark was struck at frame 18 and the figure it emphasised
   * landed at 19; a sticker punched on at 52 and the slate's number span up at
   * 53. Both shots were planned as two beats and both play as one, because
   * every element chose its own frame and nothing ever compared them. Law 18
   * counts events; it cannot count events the eye cannot separate.
   *
   * The setter moves the LATER one, and the later one is almost always the
   * figure: a mark or a sticker is set-up and the number is the arrival, so
   * separating them in that direction is also the right reading. Nothing moves
   * past the shot's own tail — a beat pushed off the end is a beat deleted.
   */
  const FRAME_HANDLES = (scene) => {
    const p = scene.params ?? {};
    const out = [];
    const push = (kind, index, at, set) => {
      if (typeof at === 'number' && Number.isFinite(at)) out.push({kind, index, at, set});
    };
    push('caption', undefined, p.captionFrame, (v) => {
      p.captionFrame = v;
    });
    push('mark', undefined, p.markFrame, (v) => {
      p.markFrame = v;
    });
    push('motif:' + p.motif, undefined, p.motifFrame, (v) => {
      p.motifFrame = v;
    });
    const figure = p.countTo !== undefined ? 'count' : p.spinTo !== undefined ? 'spin' : 'slate';
    push(figure, undefined, p.titleFrame, (v) => {
      p.titleFrame = v;
    });
    for (const [i, spec] of (scene.onScreenText ?? []).entries()) {
      push('onScreenText', i, spec.atFrame, (v) => {
        spec.atFrame = v;
      });
    }
    for (const [i, prop] of (scene.props ?? []).entries()) {
      push('prop:' + prop.kind, i, prop.from, (v) => {
        prop.from = v;
      });
    }
    return out;
  };

  /**
   * A PLACE DOES NOT COME AND GO WITH THE SENTENCE.
   *
   * Each terrain section was built from its own line, so the reservoir and the
   * dam appeared only in the sentences that happened to name them. The reel
   * showed the lake, then a bare valley for two shots, then the lake again —
   * and the shot of the slab sliding INTO THE LAKE had no lake in it, because
   * that sentence says "lake" and not "reservoir". A section is a section OF A
   * PLACE, and the place is the same place all the way through.
   *
   * So the setting — the ground profile, the beds under it, the structure and
   * the water it impounds — is established once for the episode from the
   * richest description any line gives, and every section shares it. What stays
   * per-sentence is the EVENT: which mass moves, when the water gets into the
   * bed, when it goes over the crest. Continuity of place, exactly as law 31
   * asks for continuity of object.
   */
  {
    const sections = config.scenes.filter((s) => s.diagram?.type === 'terrainSection');
    if (sections.length > 1) {
      const richest = (key) =>
        sections.map((s) => s.diagram[key]).find((v) => (Array.isArray(v) ? v.length : v != null)) ?? null;
      // A structure that carries its dimension is the fuller description of the
      // same structure, so it is the one the whole episode inherits.
      const structure =
        sections.map((s) => s.diagram.structure).find((v) => v?.height) ?? richest('structure');
      const beds = sections
        .map((s) => s.diagram.beds)
        .filter(Boolean)
        .sort((a, b) => b.length - a.length)[0] ?? null;
      const setting = {
        profile: richest('profile'),
        beds,
        structure,
        water: richest('water'),
      };
      for (const scene of sections) {
        for (const [key, value] of Object.entries(setting)) {
          if (value != null) scene.diagram[key] = value;
        }
      }
    }
  }

  /**
   * ONE FORM, ONE RUN THROUGH ITS STATES — ACROSS THE WHOLE EPISODE.
   *
   * Each line's stage list is derived from that line's own claims, so two
   * consecutive sentences about neighbouring parts of one process both reached
   * for the transition between them: "the body decayed away" played
   * ENGULFED→VOID, and then "what was left was a cavity" played ENGULFED→VOID
   * again. The body decayed twice. That is the process reset this drawing
   * exists to make impossible — the whole claim of a mould sequence is that it
   * is ONE form going through states in order, and a viewer who sees a stage
   * replayed learns that the states are illustrations rather than a history.
   *
   * So the states are walked once. A line that opens on a stage the reel has
   * already reached starts where the last one finished; if that leaves it
   * nothing new to play, it HOLDS that state, which is what a sentence about a
   * result should do anyway.
   */
  {
    const ORDER = ['form', 'engulf', 'void', 'fill', 'cast'];
    const stem = (id) => String(id).replace(/-[a-z]$/, '');
    let reached = -1;
    let group = null;
    let run = null;
    for (const scene of config.scenes) {
      if (scene.diagram?.type !== 'mouldCast' || !Array.isArray(scene.diagram.stages)) continue;
      const mine = stem(scene.id);
      if (mine !== group) {
        group = mine;
        const stages = scene.diagram.stages;
        const kept = stages.filter((st) => ORDER.indexOf(st) >= reached);
        run = kept.length ? kept : [stages[stages.length - 1]];
        reached = Math.max(reached, ORDER.indexOf(run[run.length - 1]));
      }
      // Every shot of the line plays the line's run — the continuation shots
      // are the same drawing seen again, not a fresh derivation of it.
      scene.diagram.stages = run;
    }
  }

  /**
   * A PROCESS CONTINUES ACROSS THE CUT; AN ASSEMBLY HOLDS.
   *
   * A continuation is handed `from: -1, over: 1` so a mechanism the viewer
   * watched assemble does not assemble again — right for a gear train, wrong
   * for a drawing that runs through STATES. A burial spread over three shots
   * finished banking up in the first two point eight seconds and then stood
   * there for four more while the narration was still describing it: the same
   * picture three times, which is the "does anything repeat without adding
   * information" fault stated exactly.
   *
   * So a staged drawing carried across a run of shots is re-timed against the
   * WHOLE run. Zeroth law: the voice is the clock, and if the sentence about
   * the ash arriving lasts six seconds then the ash arrives over six seconds.
   * The run's last shot is the payoff — the final state lands as the cut into
   * it lands, and that shot holds it. An assembly (one state, or a drawing with
   * no states at all) is untouched: it still opens finished.
   */
  {
    const staged = (scene) => (scene.diagram?.stages?.length ?? 0) > 1;
    // Stages are strings for a mould and objects for a forge, so the run's
    // identity is the whole list serialised — `join` on the second kind gives
    // "[object Object]" for every spec there is, which is not an identity.
    const signature = (scene) =>
      `${scene.diagram?.type}|${scene.diagram?.subject}|${JSON.stringify(scene.diagram?.stages ?? [])}`;
    let i = 0;
    while (i < config.scenes.length) {
      if (!staged(config.scenes[i])) {
        i += 1;
        continue;
      }
      let j = i + 1;
      while (
        j < config.scenes.length &&
        staged(config.scenes[j]) &&
        signature(config.scenes[j]) === signature(config.scenes[i]) &&
        config.scenes[j].diagram.from === -1
      ) {
        j += 1;
      }
      const run = config.scenes.slice(i, j);
      if (run.length > 1) {
        const total = run.reduce((n, s) => n + s.durationInFrames, 0);
        const last = run[run.length - 1].durationInFrames;
        const over = Math.max(Math.round(total * 0.4), total - last);
        let prefix = 0;
        for (const scene of run) {
          scene.diagram.from = -prefix;
          scene.diagram.over = over;
          prefix += scene.durationInFrames;
        }
      }
      i = j;
    }
  }

  for (const scene of config.scenes) {
    const tail = Math.floor(scene.durationInFrames * 0.9);
    // Repeat until settled: moving one beat off another can land it on a third.
    for (let pass = 0; pass < 4; pass += 1) {
      const events = eventsOf(scene);
      let moved = false;
      for (let i = 1; i < events.length; i += 1) {
        const a = events[i - 1];
        const b = events[i];
        if (b.at <= 1 || b.at - a.at >= 3 || b.kind === a.kind) continue;
        if (['shake', 'flight', 'arrival'].includes(a.kind) || ['shake', 'flight', 'arrival'].includes(b.kind)) continue;
        const handle = FRAME_HANDLES(scene).find((h) => h.kind === b.kind && h.index === b.index && h.at === b.at);
        if (!handle) continue;
        const to = a.at + 4;
        if (to > tail) continue;
        handle.set(to);
        moved = true;
        break;
      }
      if (!moved) break;
    }
  }

  /**
   * AND THE CAPTION CLAMP IS APPLIED AGAIN, ONCE THE SHOT IS ITS FINAL LENGTH.
   *
   * `lastUseful` is computed while the shot is being planned, against the
   * duration it has at that moment — and the reel is cut to the clock
   * afterwards, so a shot that loses a fifth of its length keeps a caption
   * timed for the longer version. "The streets were open" arrived at 62% of a
   * shot that had since shrunk to 1.7 seconds, leaving four words two thirds of
   * a second to be read in. The clamp was right; it was just asked too early,
   * so it is asked again here, where the duration is the one that ships — and
   * AFTER the separation pass, which is entitled to push a caption later and
   * has no idea there is a deadline. Two beats three frames apart is a smaller
   * fault than a sentence nobody can read.
   */
  for (const scene of config.scenes) {
    const p = scene.params ?? {};
    const caption = Array.isArray(p.caption) ? p.caption : [];
    if (!caption.length || typeof p.captionFrame !== 'number' || p.captionFrame < 0) continue;
    const words = caption.join(' ').split(/\s+/).filter(Boolean).length;
    const lastUseful = Math.max(
      2,
      Math.min(Math.round(scene.durationInFrames * 0.62), scene.durationInFrames - readingFrames(words, FPS)),
    );
    if (p.captionFrame > lastUseful) {
      p.captionFrame = lastUseful;
      if (Number(p.captionRecedeAt) <= lastUseful) p.captionRecedeAt = Math.max(1, scene.durationInFrames - 6);
    }
  }

  /**
   * A HOLD IS A DECISION THE SHOT HAS TO BE ABLE TO AFFORD.
   *
   * The camera director picks `hold` for a verdict because a frame that stops
   * is how an edit says the idea needs no help — and it picks it before the
   * beats are counted, so it cannot know whether anything else is going to
   * happen in those two and a half seconds. Twice it stopped the camera on a
   * shot with two events and nothing else, and two and a half seconds of a
   * still picture with a caption on it is what "a photograph with grain on it"
   * describes.
   *
   * The answer is not to ban the hold: a reel needs the still shots that give
   * the moving ones somewhere to land. It is to say that stillness is EARNED —
   * three events carry a locked frame, two do not — and where it is not
   * earned the frame withdraws instead. A pull-back is the move for a claim
   * landing, it ends on the framing the shot was composed for rather than
   * inside it, and it is not a push, so a shot rescued here cannot become the
   * third push in a row.
   *
   * It runs BEFORE the budget below: widening the travel changes the largest
   * scale the drawing reaches, and a budget measured against the old one would
   * be measuring a camera that no longer exists.
   */
  for (const scene of config.scenes) {
    const params = scene.params ?? {};
    if (scene.durationInFrames < 50) continue;
    if (cameraTravel(scene) >= 0.05) continue;
    if (eventsOf(scene).length >= 3) continue;
    const to = typeof params.pushTo === 'number' ? params.pushTo : 1;
    params.pushFrom = round(to + 0.07, 3);
    params.pushTo = round(to, 3);
    params.cameraMove = 'pull';
    params.cameraPurpose = 'the frame withdraws as the claim lands, because a still frame here has nothing carrying it';
    params.handheld = 1.5;
  }

  /**
   * THE PLANNER NEVER WRITES A HARD DEPENDENCY ON A FILE THAT IS NOT THERE.
   *
   * "Eksik asset reel'i durdurmaz" is a law of this repo, and the mechanism for
   * it already exists: a role written with `?` is used when the file is on disk
   * and dropped when it is not. What was missing is that the planner wrote the
   * role WITHOUT the mark whether or not the picture existed, so requesting a
   * photograph that has not been supplied yet turned a whole episode red — the
   * asset layer said ASSET_REQUIRED, non-blocking, and the validator said file
   * not found.
   *
   * Asking for a picture and depending on one are different things. A role
   * whose file is absent at plan time is written optional: the casting list
   * still carries the request, the reel still renders, and the shot falls to
   * the rung below exactly as the ladder intends.
   */
  for (const scene of config.scenes) {
    for (const [role, file] of Object.entries(scene.assets ?? {})) {
      if (role.startsWith('?') || typeof file !== 'string') continue;
      let there = true;
      try {
        await access(path.join(episodeDir(brief.id), file));
      } catch {
        there = false;
      }
      if (there) continue;
      delete scene.assets[role];
      scene.assets[`?${role}`] = file;
      if (Array.isArray(scene.layers)) {
        for (const layer of scene.layers) if (layer.role === role) layer.role = `?${role}`;
      }
    }
  }

  const SAFE = {top: HEIGHT * 0.04, bottom: HEIGHT * 0.9, left: 40, right: WIDTH - 40};
  for (const scene of config.scenes) {
    if (!scene.diagram) continue;
    const boxes = boundsOf(scene, {width: WIDTH, height: HEIGHT}).filter((b) => b.camera);
    if (!boxes.length) continue;
    let afford = 0;
    for (let k = 1; k >= 0; k -= 0.05) {
      const probe = {...scene, params: {...scene.params, diagramCamera: k}};
      const moved = throughTheCamera(probe, boxes, {width: WIDTH, height: HEIGHT});
      /**
       * AND "INSIDE" MEANS THE SAFE AREA, NOT THE FRAME.
       *
       * The budget was bounded by the frame while the checker measured the
       * safe area, so the planner handed a shot the largest camera that kept
       * the drawing barely on screen and the checker then reported the result
       * as a fault — ten warnings the planner had deliberately created. A
       * lead figure at x=0 is not a framing decision either way: the platform
       * draws its own furniture over that strip, so a hauler standing there is
       * a hauler nobody sees.
       */
      const inside = moved.every(
        (b) => b.left >= SAFE.left && b.right <= SAFE.right && b.top >= SAFE.top && b.bottom <= SAFE.bottom,
      );
      if (inside) {
        afford = k;
        break;
      }
    }
    // Rounded, because the value is written into a config a person reads.
    if (afford < 0.999) scene.params.diagramCamera = Math.max(0, round(afford, 2));
  }

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
   * THE DIRECTOR'S DECISION LOG.
   *
   * Every reel this pipeline made was un-arguable: the config said WHAT was
   * drawn and nothing said WHY, so a bad reel could only be diagnosed by
   * looking at it and guessing backwards. The log records the judgements — the
   * beat each line was read as, which pictures were refused and on what
   * grounds, where the camera went and why, what is missing and what to shoot.
   *
   * It is machine-readable because the next iteration should be able to check
   * itself against it, and because "asset relevance 2/10" is a fact somebody
   * can act on where "the video feels flat" is not.
   */
  const report = {
    episode: episodeId,
    generatedFrom: {brief: 'brief.json', review: 'assets.review.json', voice: voice ? 'audio/vo.json' : null},
    concept: {
      title: brief.title ?? null,
      mood: brief.mood ?? null,
      hook: hookStrategy(story),
      ending: endingStrategy(story),
    },
    beats: story.map((r) => ({
      line: r.slug,
      beat: r.beat,
      pace: r.pace,
      holdsAfter: r.hold,
      emphasis: r.emphasis,
      visualIdea: r.idea,
      viewerShouldNotice: r.notice,
    })),
    assets: {
      colourCentre: centre,
      decisions: Object.values(assetVerdicts).map((v) => ({
        file: v.file,
        role: v.role,
        depicts: v.depicts,
        score: v.score,
        verdict: v.verdict,
        reviewed: v.reviewed,
        axes: v.axes,
        note: v.note,
      })),
      recast: recastNotes,
      required: assetBriefs,
    },
    shots: planned.map(({scene, cut}, i) => ({
      id: scene.id,
      template: scene.sceneType,
      seconds: Number((scene.durationInFrames / FPS).toFixed(2)),
      camera: {
        from: scene.params?.pushFrom ?? null,
        to: scene.params?.pushTo ?? null,
        panX: scene.params?.panX ?? null,
        panY: scene.params?.panY ?? null,
      },
      transition: scene.transition?.kind ?? 'cut',
      /**
       * WHAT THIS SEAM IS, before how it is performed.
       *
       * `"HARD_CUT — no correspondence and no reason to decorate"` is a
       * decision. `"cut"` was the absence of one, and it read identically in
       * the log whether the director had thought about it or run out of quota.
       */
      cut: cut ?? null,
      /**
       * HOW THIS SHOT CHOSE TO SHOW ITS IDEA, and why.
       *
       * The most important line in the log. "PROCEDURAL — a mechanism with a
       * count: meshing is the claim, and a photograph cannot show it" is a
       * decision somebody can argue with; a scene-config full of coordinates
       * is not.
       */
      representation: scene.diagram
        ? Object.keys(scene.assets ?? {}).length
          ? 'HYBRID'
          : 'PROCEDURAL'
        : Object.keys(scene.assets ?? {}).length
          ? 'PHOTO'
          : 'TYPOGRAPHY',
      drawn: scene.diagram?.type ?? null,
      emphasis: scene.params?.captionEmphasis ?? null,
      reveal: scene.params?.captionReveal ?? null,
      plates: Object.values(scene.assets ?? {}).map((f) => String(f).split('/').pop()),
      drawnGround: scene.params?.field ?? null,
      props: (scene.props ?? []).map((q) => q.kind),
      hierarchy: hierarchyFor({
        beat: story[Math.min(i, story.length - 1)]?.beat,
        hasPhoto: Object.keys(scene.assets ?? {}).length > 0,
        hasFigure: false,
        emphasis: scene.params?.captionEmphasis,
        idea: story[Math.min(i, story.length - 1)]?.idea,
      }),
    })),
    representation: Object.fromEntries(
      Object.entries(representation).map(([slug, r]) => [slug, {mode: r.mode, why: r.why, drawn: r.diagram?.type ?? null}]),
    ),
    quotas: quota,
    /**
     * HOW MUCH OF THE REEL IS DECORATED, as a number.
     *
     * The complaint "the transitions feel like a template" is unanswerable; a
     * hard-cut ratio of 0.36 is not. A documentary short lives above two
     * thirds — below that the plain cuts have stopped outnumbering the effects
     * and there is nothing left for an effect to stand out against.
     */
    editing: {
      ...cutMix(planned.map((p) => p.cut).filter(Boolean)),
      note: 'HARD_CUT and MATCH_CUT are both made of nothing; the difference is that a match cut was earned',
    },
    typography: {
      system: 'one family per semantic role — statement, body, label, figure',
      accent: look.accent,
      note: 'the emphasis is the only element allowed the accent colour in a shot',
    },
    colourStrategy: {
      accent: look.accent,
      field: look.field,
      fieldColours: look.fieldColours,
      grade,
      note: 'one accent across the reel; the grade moves only where the sentence earns it',
    },
    limitations: [
      ...assetBriefs.map((b) => `ASSET_REQUIRED: ${b.subject}`),
      voice ? null : 'cut to an estimate — no voiceover measured yet',
    ].filter(Boolean),
  };
  /**
   * A RECIPE FOR A PICTURE THE DIRECTOR CAST BUT NOBODY WROTE.
   *
   * An asset introduced from the review ledger — a crop, a keyed cut-out, a
   * derived plate — is in the cut and has no recipe, so the guard that says
   * "the generator would never draw this" is right to complain. It records
   * where the file came from, which is the point of a recipe: provenance, not
   * just a prompt.
   */
  for (const [file, entry] of Object.entries(reviewLedger)) {
    if (!entry?.recastTo?.line || roleOf[file] || !files.includes(file)) continue;
    assets[file] ??= {
      // `piece`: a cut-out standing in a shot, which is what a derived plate is.
      kind: entry.recastTo.kind ?? 'piece',
      derivedFrom: entry.derivedFrom ?? null,
      prompt: entry.depicts || entry.needed || 'cast by the asset director from the episode review ledger',
    };
  }

  await writeFile(path.join(dir, 'director-report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
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
  const mix = cutMix(planned.map((p) => p.cut).filter(Boolean));
  console.log(
    `  cuts   ${Object.entries(mix.tally)
      .map(([k, n]) => `${k}×${n}`)
      .join(' ')} · ${Math.round(mix.hardRatio * 100)}% plain`,
  );
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
