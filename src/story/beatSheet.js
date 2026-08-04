/**
 * THE BEAT SHEET — the spine of the whole factory.
 *
 * One voiceover line in, one scene out. For every line we decide:
 *
 *   · the rig it becomes (the signature animation)
 *   · the words that go on screen — pulled STRAIGHT from the line, verbatim
 *   · where those words land, measured from the TTS word timings
 *   · the emotional beat it plays
 *   · the assets it needs
 *   · the sound effects that punch on its events
 *
 * Two rules this module exists to enforce:
 *
 * 1. ON-SCREEN TEXT IS NEVER WRITTEN. It is a fragment of what is being said at
 *    that instant. A caption the narrator does not speak is a second voice
 *    competing with the first.
 * 2. TIMING IS MEASURED, NEVER ESTIMATED. Every caption, card and cue is placed
 *    at the frame where its words are actually spoken. Guessed beat lengths
 *    were the failure the collage line never recovered from.
 */

import {assignRig, rigAssets, rigGradeDelta, rigRole, rigSfx, RIG_CATALOG} from './rigs.js';
import {applyGradeDelta, chooseLook} from './look.js';
import {readSubject} from './subject.js';
import {planSet} from './setPlan.js';
import {planShots} from './shotPlan.js';

const WORD_RE = /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu;

const STOPWORDS = new Set([
  'a', 'an', 'the', 'of', 'to', 'in', 'on', 'at', 'for', 'and', 'or', 'but', 'is', 'was', 'were',
  'be', 'been', 'it', 'its', 'this', 'that', 'these', 'those', 'as', 'by', 'with', 'from', 'they',
  'them', 'their', 'he', 'she', 'his', 'her', 'we', 'you', 'i', 'into', 'over', 'than', 'then',
  'so', 'up', 'out', 'about', 'after', 'before', 'when', 'while', 'had', 'has', 'have', 'did',
  'do', 'does', 'not', 'no', 'there', 'here', 'what', 'which', 'who',
]);

const NUMBER_WORDS =
  'zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|billion|trillion';

/** A number as it is SAID — digits or words, with its unit attached. */
const NUMBER_PHRASE_RE = new RegExp(
  `(?:[$£€]\\s?)?(?:\\d[\\d,.]*|(?:${NUMBER_WORDS})(?:[- ](?:${NUMBER_WORDS}))*)` +
    `(?:\\s+(?:${NUMBER_WORDS}))?` +
    `(?:\\s+(?:dollars?|euros?|pounds?|people|men|women|years?|days?|miles?|tons?|stores?|ships?|soldiers?|times?|percent))?`,
  'i',
);

export function tokens(text) {
  return String(text || '').match(WORD_RE) || [];
}

function normalize(text) {
  return String(text || '').replace(/\s+/g, ' ').trim();
}

function lower(text) {
  return normalize(text).toLowerCase();
}

/**
 * Where a phrase is actually spoken.
 *
 * Matches the phrase's tokens against the measured word timings inside the
 * beat's own window and returns the start of its first word. Returns null when
 * the aligner never heard it — callers fall back to proportional placement and
 * the spec records that the timing was estimated.
 */
export function locatePhrase(words, phrase, windowStart, windowEnd) {
  const target = tokens(phrase).map((token) => token.toLowerCase());
  if (!target.length || !Array.isArray(words) || !words.length) return null;

  const inWindow = words.filter((word) => {
    const start = Number(word?.start);
    return Number.isFinite(start) && start >= windowStart - 0.05 && start <= windowEnd + 0.05;
  });

  for (let i = 0; i + target.length <= inWindow.length; i += 1) {
    let hit = true;
    for (let j = 0; j < target.length; j += 1) {
      if (String(inWindow[i + j]?.word || '').toLowerCase().replace(/[^\p{L}\p{N}']/gu, '') !== target[j]) {
        hit = false;
        break;
      }
    }
    if (hit) {
      return {
        start: Number(inWindow[i].start),
        end: Number(inWindow[i + target.length - 1].end),
        measured: true,
      };
    }
  }
  return null;
}

/** The number in the line, as a screen-ready sticker: "45 BILLION", "1000 STORES". */
export function numberPhrase(line) {
  const match = normalize(line).match(NUMBER_PHRASE_RE);
  if (!match) return null;
  const phrase = normalize(match[0]);
  if (!/[\d]|(?:^|\s)(?:one|two|three|four|five|six|seven|eight|nine|ten|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|billion|trillion)/i.test(phrase)) {
    return null;
  }
  return phrase;
}

/**
 * Split a line into the short clauses it is really made of. "No late fees. No
 * stores. Customer first." is three cards, not one sentence.
 */
export function listFragments(line) {
  return normalize(line)
    .split(/[.;:!?]|,\s+(?=(?:no|not|never|and|then|only|just)\b)|\s+—\s+/i)
    .map((part) => normalize(part).replace(/^(?:and|then|so)\s+/i, ''))
    .filter((part) => part && tokens(part).length >= 1 && tokens(part).length <= 6);
}

/**
 * The strongest three-word window in a line.
 *
 * The safety net: every beat must put SOMETHING of its line on screen, and a
 * line with no number, no flagged word and no short clause still has a spine.
 * Windows are scored by how much meaning they carry — stopwords score nothing,
 * long words score more — so "the most expensive" wins over "this was the".
 */
export function contentWindow(line, size = 3) {
  const words = normalize(line).replace(/[.,;:!?]+$/g, '').split(/\s+/).filter(Boolean);
  if (!words.length) return '';
  if (words.length <= size) return words.join(' ');

  let best = '';
  let bestScore = -1;
  for (let i = 0; i + size <= words.length; i += 1) {
    const window = words.slice(i, i + size);
    const score = window.reduce((total, word) => {
      const clean = word.toLowerCase().replace(/[^\p{L}\p{N}']/gu, '');
      if (!clean || STOPWORDS.has(clean)) return total;
      return total + 1 + Math.min(4, clean.length) / 10;
    }, 0);
    if (score > bestScore) {
      bestScore = score;
      best = window.join(' ');
    }
  }
  return best.replace(/[,;:]$/g, '');
}

/**
 * Pull the fragments that go on screen.
 *
 * Everything returned here is a verbatim substring of the line. Priority: the
 * number (it is usually why the line exists), then any emphasis word the script
 * flagged, then the strongest content window. Two fragments per beat is the
 * ceiling — the frame belongs to the picture, not to the text.
 *
 * `claimed` holds text a PROP is already showing — a plaque, a slot reel, a
 * newspaper headline. The same words must never appear twice in one frame, so
 * whatever a prop says is taken off the caption layer's table.
 */
export function pullOnScreenText(line, {emphasisWords = [], max = 2, claimed = []} = {}) {
  const text = normalize(line);
  if (!text) return [];
  const found = [];
  const seen = new Set();
  const taken = claimed.map((value) => lower(value)).filter(Boolean);

  const add = (fragment, kind) => {
    const clean = normalize(fragment).replace(/^[,.\-—\s]+|[,.\-—\s]+$/g, '');
    if (!clean) return;
    const key = clean.toLowerCase();
    if (seen.has(key)) return;
    if (!lower(text).includes(key)) return; // verbatim only — never a paraphrase
    if (taken.some((claim) => claim.includes(key) || key.includes(claim))) return;
    seen.add(key);
    found.push({text: clean, kind, at: lower(text).indexOf(key)});
  };

  const number = numberPhrase(text);
  if (number) add(number, 'number');

  for (const word of emphasisWords) {
    if (found.length >= max + 1) break;
    const needle = lower(word);
    if (!needle || !lower(text).includes(needle)) continue;
    // take the emphasis word plus what follows it, so it reads as language
    const index = lower(text).indexOf(needle);
    const tail = text.slice(index).split(/\s+/).slice(0, 3).join(' ');
    add(tail, 'emphasis');
  }

  if (found.length < max) {
    for (const clause of listFragments(text)) {
      if (found.length >= max) break;
      const content = tokens(clause).filter((token) => !STOPWORDS.has(token.toLowerCase()));
      if (content.length < 1) continue;
      const words = clause.split(/\s+/);
      add(words.length <= 4 ? clause : contentWindow(clause), 'phrase');
    }
  }

  if (!found.length) add(contentWindow(text), 'phrase');

  return found
    .sort((a, b) => a.at - b.at)
    .slice(0, max)
    .map(({text: value, kind}) => ({text: value, kind}));
}

function captionStyle(kind, rig) {
  if (kind === 'number') return rig === 'villain-punch' ? 'slot' : 'sticker';
  return 'serif-italic';
}

function captionMark(kind, index) {
  if (kind === 'number') return 'oval';
  return index === 0 ? 'none' : 'underline';
}

/**
 * Rig props are derived from the beat's own measured length, never copied from
 * a 30-second reference. A four-second beat and an eight-second beat run the
 * same mechanic at different speeds; hard-coded frame numbers would only be
 * right for one of them.
 */
function buildProps({rig, durationInFrames, cards, cardFrames, numberText, plaqueText}) {
  const d = durationInFrames;
  const at = (ratio) => Math.max(1, Math.round(d * ratio));

  switch (rig) {
    case 'portal-zoom':
      return {
        pushEndFrame: at(0.38),
        detachFrame: at(0.52),
        throughEndFrame: at(0.63),
        wallScaleEnd: 6.8,
        weldRatio: 0.369,
        // the museum plaque under the frame reads the date out of the line
        slotWord: plaqueText ? plaqueText.toUpperCase() : null,
      };
    case 'villain-punch':
      return {
        riseFrame: at(0.06),
        punchScale: 1.09,
        slotFrame: at(0.5),
        slotWord: numberText ? numberText.toUpperCase() : null,
        negativeFrame: at(0.84),
      };
    case 'paper-drop':
      return {
        cardTexts: cards,
        cardFrames,
        kenBurns: 0.09,
      };
    case 'grounded-punch':
      return {
        groundY: 1690,
        platePunch: 1.12,
        characterPunch: 1.7,
        shadowSkew: -53,
        shadowOpacity: 0.55,
        shiftFrame: at(0.5),
        shiftPx: 235,
        gesture: 'none',
      };
    case 'money-room':
      return {
        lampX: 590,
        lampY: 345,
        focusDipFrame: at(0.42),
        flickerFrames: [at(0.2), at(0.24), at(0.27), at(0.55), at(0.57), at(0.64)],
      };
    case 'finale-clone':
      return {
        groundY: 1690,
        platePunch: 1.12,
        characterPunch: 1.7,
        shadowSkew: -53,
        shadowOpacity: 0.55,
        shiftFrame: 0,
        shiftPx: 0,
        gesture: 'wag',
        gestureFrame: at(0.2),
      };
    default:
      return {};
  }
}

/**
 * BUILD THE BEAT SHEET.
 *
 * @param {object} input
 * @param {object} input.script      the locked script — its scenes ARE the VO lines
 * @param {object} input.timeline    the canonical timeline (measured TTS timings)
 * @param {object} [input.look]      the video's identity (default: chosen from topic)
 * @param {number} input.fps
 * @returns {{beats: Array, timingSource: string, measuredCaptions: number, estimatedCaptions: number}}
 */
export function buildBeatSheet({script, timeline, look = null, fps = 30} = {}) {
  const lines = (script?.scenes || []).map((scene) => normalize(scene?.narration));
  if (!lines.length) throw new Error('BEAT_SHEET_LINES_REQUIRED');

  const words = timeline?.words || timeline?.captions || [];
  const emphasisWords = script?.emphasis_words || [];
  // The video's identity. Every beat grades relative to it, so the reel reads
  // as one film and two reels do not read as the same film.
  const identity = look || chooseLook(script?.topic || script?.normalizedTopic || script?.title);
  const chosen = [];
  let lastMotif = null;
  let measuredCaptions = 0;
  let estimatedCaptions = 0;

  const beats = lines.map((line, index) => {
    const timed = timeline?.scenes?.[index];
    const startSeconds = Number(timed?.start ?? 0);
    const endSeconds = Number(timed?.end ?? startSeconds + 3);
    const durationSeconds = Math.max(0.6, endSeconds - startSeconds);
    const fromFrame = Math.max(0, Math.round(startSeconds * fps));
    const durationInFrames = Math.max(18, Math.round(durationSeconds * fps));

    const rig = assignRig(line, index, lines.length, chosen);
    chosen.push(rig);

    // Where each fragment is spoken, in frames from the start of the beat.
    const frameFor = (phrase, fallbackRatio) => {
      const located = locatePhrase(words, phrase, startSeconds, endSeconds);
      if (located) {
        measuredCaptions += 1;
        return Math.max(0, Math.round((located.start - startSeconds) * fps));
      }
      estimatedCaptions += 1;
      return Math.round(durationInFrames * fallbackRatio);
    };

    // PROPS CLAIM THEIR WORDS FIRST.
    //
    // A plaque reading "In 2000", a slot reel slamming to "FIFTY MILLION", three
    // newspapers carrying the three promises — those words are already on
    // screen, drawn by the rig. The caption layer must then say something else,
    // or the frame says the same thing twice.
    //
    // The list is taken from the END of the line: a line that carries promises
    // usually frames them first ("So they built the opposite") and lists them
    // after, and the framing clause belongs to the caption, not to a card.
    const numberText = numberPhrase(line);
    const plaqueText = rig === 'portal-zoom' ? (line.match(/\b(?:in|by)\s+\d{3,4}\b/i) || [])[0] || null : null;
    const cards = rig === 'paper-drop' ? listFragments(line).slice(-3).map((card) => card.toUpperCase()) : [];

    const claimed = [
      ...(plaqueText ? [plaqueText] : []),
      ...(rig === 'villain-punch' && numberText ? [numberText] : []),
      ...cards,
    ];

    const fragments = pullOnScreenText(line, {emphasisWords, max: 2, claimed});
    const captions = fragments.map((fragment, order) => {
      const atFrame = frameFor(fragment.text, 0.12 + order * 0.36);
      return {
        text: fragment.kind === 'number' ? fragment.text.toUpperCase() : fragment.text,
        atFrame,
        durationInFrames: Math.max(24, durationInFrames - atFrame - 2),
        style: captionStyle(fragment.kind, rig),
        side: RIG_CATALOG[rig]?.captionSide || 'center',
        mark: captionMark(fragment.kind, order),
      };
    });

    // Each card lands ON its promise — measured, so the paper hits the word.
    const cardFrames = cards.map((card, order) => frameFor(card, 0.16 + order * 0.28));
    // WHAT THIS LINE IS ABOUT — the set it is staged in, the object it draws
    // and what is in the air. Read from the line itself, so two topics never
    // share a drawing, and scenes inside one video differ from each other.
    const subject = readSubject({
      line,
      topic: script?.topic || script?.normalizedTopic || '',
      rig,
      seed: identity.seed,
      index,
      avoidMotif: lastMotif,
    });
    lastMotif = subject.motif ?? lastMotif;

    const props = {
      ...buildProps({rig, durationInFrames, cards, cardFrames, numberText, plaqueText}),
      ...subject,
      // The room itself is generated per line rather than picked from a list —
      // horizon, structure, rhythm, aperture, ground, light and haze.
      setPlan: planSet({
        line,
        topic: script?.topic || script?.normalizedTopic || '',
        seed: identity.seed,
        index,
      }),
    };

    return {
      id: `beat-${String(index + 1).padStart(2, '0')}`,
      rig,
      role: rigRole(rig),
      line,
      fromFrame,
      durationInFrames,
      captions,
      assetRequests: rigAssets(rig).map((role) => ({role, line})),
      sfxFamilies: rigSfx(rig),
      props,
      grade: applyGradeDelta(identity.grade, rigGradeDelta(rig)),
      clonedFrom: RIG_CATALOG[rig]?.clonedFrom,
      spokenWindow: [startSeconds, endSeconds],
    };
  });

  // THE CUT IS PLANNED OVER THE WHOLE REEL, NOT PER LINE.
  // A shot only means something next to the shot before it: open wide, tighten,
  // never repeat a scale twice running, land close. See src/story/shotPlan.js.
  const shots = planShots(beats, identity.seed);
  beats.forEach((beat, index) => {
    beat.props.shot = shots[index];
  });

  return {
    beats,
    look: identity,
    timingSource: timeline?.source || 'unknown',
    measuredCaptions,
    estimatedCaptions,
  };
}
