/**
 * THE RIG CATALOG.
 *
 * Six signature animations, and the rules for which spoken line earns which
 * one. A rig is not a "layout" — it is a mechanic with a job:
 *
 *   portal-zoom     open a story by flying INTO the picture
 *   villain-punch   someone refuses, mocks, demands or looms
 *   paper-drop      the line carries a LIST of promises, rules or facts
 *   grounded-punch  a fall: something ends, closes, collapses, dies
 *   money-room      a payoff: the number that makes the story worth telling
 *   finale-clone    the button — grounded-punch reskinned, answered by a gesture
 *
 * Each rig also declares what it needs from the media layer and which sound
 * effects belong on its beats. Nothing downstream invents either.
 */

export const RIG_IDS = [
  'portal-zoom',
  'villain-punch',
  'paper-drop',
  'grounded-punch',
  'money-room',
  'finale-clone',
];

export const RIG_CATALOG = {
  'portal-zoom': {
    role: 'setup',
    assets: ['plate', 'character', 'texture'],
    sfx: ['camera-shutter', 'whoosh-long'],
    captionSide: 'center',
    gradeDelta: {},
  },
  'villain-punch': {
    role: 'rejection',
    assets: ['character', 'prop'],
    sfx: ['whoosh-entrance', 'impact'],
    captionSide: 'center',
    // Sert beat: daha yüksek kontrast, biraz daha karanlık.
    gradeDelta: {saturate: 0.93, contrast: 1.07, sepia: 0.62, brightness: 0.97},
  },
  'paper-drop': {
    role: 'turn',
    assets: ['plate'],
    sfx: ['paper', 'paper', 'paper'],
    captionSide: 'center',
    gradeDelta: {sepia: 1.12},
  },
  'grounded-punch': {
    role: 'fall',
    assets: ['plate', 'character'],
    sfx: ['focus-hunt', 'heartbeat'],
    captionSide: 'left',
    // Kasvetli beat, videonun KENDİ gradesinden daha çok doygunluk kaybeder —
    // sabit bir sayıya inmez, yoksa her videodaki düşüş sahnesi aynı karedir.
    gradeDelta: {saturate: 0.72, contrast: 1.04, sepia: 0.38, brightness: 0.99},
  },
  'money-room': {
    role: 'payoff',
    assets: ['plate', 'character', 'prop'],
    sfx: ['cash', 'neon-buzz'],
    captionSide: 'center',
    gradeDelta: {saturate: 0.95, brightness: 0.98},
  },
  'finale-clone': {
    role: 'button',
    assets: ['plate', 'character'],
    sfx: ['whoosh-long', 'final-boom'],
    captionSide: 'left',
    gradeDelta: {saturate: 0.72, contrast: 1.04, sepia: 0.38, brightness: 0.99},
    clonedFrom: 'grounded-punch',
  },
};

/**
 * What each rig is listening for in the spoken line. Order matters: the first
 * pattern that matches wins, so the loudest event in a line decides the scene.
 */
const RIG_SIGNALS = [
  {
    rig: 'villain-punch',
    when: /\b(refus|reject|laugh|mock|scoff|deni|dismiss|said no|turned (?:it|them) down|demand|threat|order(?:ed)?|warn|arrogant|ignor)\w*\b/i,
  },
  {
    rig: 'money-room',
    when: /\b(billion|million|trillion|revenue|profit|worth|fortune|today|now the|biggest|largest|richest|paid|earns?|sold for|valued)\b/i,
  },
  {
    rig: 'grounded-punch',
    when: /\b(bankrupt|collaps|closed?|shut|died?|death|killed|destroy|ruin|vanish|disappear|lost|failed?|abandon|starv|sank|sunk|burn|ended)\w*\b/i,
  },
  {
    rig: 'paper-drop',
    when: /\b(no [a-z]+[.,].*\bno [a-z]+|three|rules?|promises?|first[.,]|instead|list|law|steps?|terms?)\b/i,
  },
];

/** A line with two or more short clauses is a list, whatever words it uses. */
function readsAsList(line) {
  const clauses = String(line || '')
    .split(/[.;—]|,\s+(?=(?:no|not|never|and|then)\b)/i)
    .map((part) => part.trim())
    .filter((part) => part.length > 2);
  return clauses.length >= 3 && clauses.every((part) => part.split(/\s+/).length <= 6);
}

/**
 * Pick the rig a line earns.
 *
 * Position decides only the two ends of the reel: the first line always opens
 * by flying into the picture, and the last line is always the button. In
 * between, the WORDS decide — never the index. A repeat guard keeps the same
 * mechanic from running three beats in a row, because the second time a
 * mechanic appears it reads as a motif and the third time it reads as a bug.
 */
export function assignRig(line, index, total, previous = []) {
  if (index === 0) return 'portal-zoom';
  if (index === total - 1) return 'finale-clone';

  const text = String(line || '');
  let chosen = RIG_SIGNALS.find((signal) => signal.when.test(text))?.rig;
  if (!chosen && readsAsList(text)) chosen = 'paper-drop';
  if (!chosen) chosen = index % 2 === 0 ? 'grounded-punch' : 'money-room';

  const lastTwo = previous.slice(-2);
  if (lastTwo.length === 2 && lastTwo.every((rig) => rig === chosen)) {
    const alternatives = ['paper-drop', 'money-room', 'grounded-punch', 'villain-punch'].filter(
      (rig) => rig !== chosen,
    );
    chosen = alternatives[index % alternatives.length];
  }
  return chosen;
}

export function rigRole(rig) {
  return RIG_CATALOG[rig]?.role || 'turn';
}

export function rigAssets(rig) {
  return RIG_CATALOG[rig]?.assets || ['plate'];
}

/**
 * Bir rig videonun gradesini KOYULAŞTIRIR veya AÇAR; onun yerine geçmez.
 * Mutlak sayı verseydi altı rig altı sabit görünüm demek olurdu ve videodan
 * videoya değişen tek şey fotoğraflar kalırdı.
 */
export function rigGradeDelta(rig) {
  return RIG_CATALOG[rig]?.gradeDelta || {};
}

export function rigSfx(rig) {
  return RIG_CATALOG[rig]?.sfx || [];
}
