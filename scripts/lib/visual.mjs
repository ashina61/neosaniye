/**
 * THE VISUAL DIRECTOR — hierarchy, framing, and one typographic system.
 *
 * Three decisions that were never being made, each of which shows up in the
 * finished frame as a specific fault:
 *
 *   NOBODY SAID WHAT THE SHOT WAS OF. Every element got whatever weight its
 *       defaults gave it, so a caption, a floating index card and a photograph
 *       competed on equal terms and the eye had nowhere to land.
 *
 *   EVERY FRAMING WAS THE SAME. The anchor sat at the centre-bottom of every
 *       composite, the plate filled the frame, and twelve shots were twelve
 *       centred medium shots. A short with no close-up and no wide has no
 *       framing language at all.
 *
 *   TYPE WAS CHOSEN PER ELEMENT. Serif italic for captions, heavy sans for the
 *       emphasis, mono for kickers, a different serif for footers — four
 *       families with no stated relationship, picked because each looked right
 *       on its own.
 */

/**
 * THE HIERARCHY OF A SHOT.
 *
 * Stated explicitly, because "the primary element must dominate" is not
 * something that can be checked, tuned or argued with until somebody has
 * written down which element is primary.
 */
export function hierarchyFor({beat, hasPhoto, hasFigure, emphasis, idea}) {
  // A shot with no usable photograph is not a broken shot — it is a
  // typographic shot, and its primary element is the claim.
  if (!hasPhoto) {
    return {
      primary: emphasis ? `the claim: "${emphasis}"` : 'the claim',
      secondary: 'the drawn label or mark that dates and places it',
      background: 'a drawn field — texture, not a photograph pretending to be one',
      carrier: 'type',
    };
  }
  switch (beat) {
    case 'REVEAL':
    case 'DETAIL':
      return {
        primary: 'the detail in the photograph, isolated by a mark',
        secondary: emphasis ? `the words "${emphasis}"` : 'the caption',
        background: 'the rest of the plate, dimmed and out of the way',
        carrier: 'image',
      };
    case 'EVIDENCE':
      return {
        primary: emphasis ? `the figure: "${emphasis}"` : 'the figure',
        secondary: 'the object it is counting',
        background: 'the plate',
        carrier: 'graphic',
      };
    case 'VERDICT':
    case 'PAYOFF':
      return {
        primary: emphasis ? `the claim: "${emphasis}"` : 'the closing claim',
        secondary: 'the strongest image in the reel, returned to',
        background: 'darkness',
        carrier: 'type',
      };
    default:
      return {
        primary: hasFigure ? 'the figure' : idea ?? 'the subject of the plate',
        secondary: 'the caption',
        background: 'the plate',
        carrier: 'image',
      };
  }
}

/**
 * FRAMING.
 *
 * A framing is an ANCHOR and a REACH, not a name — but naming it is what lets
 * the reel be checked for having more than one. The anchor is where the camera
 * scales about, in fractions of the frame; the reach is how much of the subject
 * the shot means to hold.
 *
 * `detail` and `extreme` deliberately push past 1: a close-up of a plate is a
 * plate scaled up and cropped, which is the only close-up available when the
 * subject is a photograph rather than a 3D scene.
 */
export const FRAMINGS = {
  extreme: {anchor: [0.5, 0.45], base: 1.55, note: 'extreme close — one part, filling the frame'},
  detail: {anchor: [0.46, 0.42], base: 1.3, note: 'close — the subject with no room around it'},
  close: {anchor: [0.5, 0.52], base: 1.16, note: 'close — subject dominant, a little air'},
  medium: {anchor: [0.5, 0.62], base: 1.0, note: 'medium — subject and its immediate place'},
  wide: {anchor: [0.5, 0.7], base: 1.0, note: 'wide — the place, subject inside it'},
  overhead: {anchor: [0.5, 0.3], base: 1.08, note: 'looking down — the specimen on the table'},
  edge: {anchor: [0.28, 0.55], base: 1.2, note: 'off-centre — the subject held to one side'},
  thirds: {anchor: [0.66, 0.42], base: 1.12, note: 'rule of thirds — weight to one corner'},
};

export const FRAMING_NAMES = Object.keys(FRAMINGS);

/** What each beat is usually framed as, best first. */
const FRAMING_FOR_BEAT = {
  HOOK: ['detail', 'extreme', 'close'],
  MYSTERY: ['wide', 'edge', 'medium'],
  CONTEXT: ['wide', 'medium', 'thirds'],
  DISCOVERY: ['medium', 'overhead', 'close'],
  EVIDENCE: ['overhead', 'close', 'thirds'],
  DETAIL: ['extreme', 'detail', 'close'],
  ESCALATION: ['close', 'thirds', 'medium'],
  COMPARISON: ['wide', 'thirds', 'medium'],
  REVEAL: ['detail', 'extreme', 'close'],
  PAYOFF: ['close', 'medium', 'edge'],
  VERDICT: ['medium', 'close', 'wide'],
};

/**
 * CHOOSE A FRAMING, under a quota and never twice on the same picture.
 *
 * The quota is the part that matters. Left to preference every beat picks its
 * first choice, and a reel of twelve shots comes out as twelve medium shots
 * with slightly different anchors — which is what it was.
 */
export function directFraming({beat, rand, used = {}, total = 12, avoid = null, share = 0.34}) {
  const wanted = (FRAMING_FOR_BEAT[beat] ?? ['medium', 'close']).filter((f) => f !== avoid);
  const cap = Math.max(1, Math.ceil(total * share));
  const allowed = wanted.filter((f) => (used[f] ?? 0) < cap);
  const list = allowed.length ? allowed : wanted.length ? wanted : ['medium'];
  const name = list[Math.floor(rand() * list.length) % list.length];
  return {name, ...FRAMINGS[name]};
}

/**
 * THE TYPE SYSTEM.
 *
 * One system, four semantic roles, and the roles are what a designer would name
 * rather than what a template happens to need. The point is not the fonts — it
 * is that each role means something, so a reader learns the reel's language in
 * the first three shots and every later use of that style is already understood.
 *
 *   STATEMENT  the claim. Heavy sans, uppercase, accent. Used once per shot.
 *   BODY       the narration on screen. Quiet, readable, never competing.
 *   LABEL      archival apparatus — dates, places, catalogue numbers. Mono.
 *   FIGURE     numbers that are being counted or landed on. Tabular sans.
 *
 * The engine already has all four faces. What it lacked was a rule about WHICH
 * to use WHEN, so the caption layer chose serif italic and the emphasis chose
 * heavy sans inside the same line, and they fought.
 */
export const TYPE_ROLES = {
  statement: {face: 'sans', weight: 900, transform: 'uppercase', use: 'the claim — one per shot, in the accent'},
  body: {face: 'serif', weight: 700, transform: 'none', use: 'the narration on screen'},
  label: {face: 'mono', weight: 400, transform: 'uppercase', use: 'dates, places, catalogue apparatus'},
  figure: {face: 'sans', weight: 900, transform: 'none', use: 'a number being counted or landed on'},
};

/**
 * WHAT A DRAWN OBJECT SHOULD SAY, given that the caption already says the line.
 *
 * The reel had the narration say "for fifty years nobody looked inside", a card
 * say "FIFTY YEARS / nobody looked inside", and the caption say "for FIFTY
 * YEARS before anyone looked inside" — the same sentence three times, which is
 * not emphasis, it is an echo.
 *
 * A graphic's job is to carry what the narration CANNOT: the apparatus. A date
 * range, an accession number, a place. Those are things a documentary shows
 * because they are evidence, and they are the one thing a voice cannot deliver.
 */
export function labelFor({vo = '', kicker, place}) {
  if (kicker) return String(kicker);
  const years = [...String(vo).matchAll(/\b(1[0-9]{3}|20[0-9]{2})\b/g)].map((m) => m[1]);
  if (years.length >= 2) return `${years[0]}–${years[years.length - 1]}`;
  if (years.length === 1) return place ? `${place} · ${years[0]}` : years[0];
  return place ?? null;
}

/**
 * DOES THIS GRAPHIC PROVE ANYTHING?
 *
 * The test a decorative element fails. A graphic must explain, measure, locate,
 * compare, highlight, count, connect or reveal; a wireframe drawn around empty
 * brass does none of those and should not be in the frame.
 */
export const GRAPHIC_JOBS = ['explain', 'measure', 'locate', 'compare', 'highlight', 'count', 'connect', 'reveal'];

export function graphicJustified(kind, {emphasis, hasNumber, hasPlace, hasSubject}) {
  switch (kind) {
    case 'wire':
      // A wireframe HIGHLIGHTS, and only if there is something under it to
      // highlight. Over an even texture it is a shape with nothing inside it.
      return hasSubject ? 'highlight' : null;
    case 'plaque':
      return hasPlace || emphasis ? 'locate' : null;
    case 'card':
      return emphasis ? 'explain' : null;
    case 'newspaper':
      return emphasis ? 'reveal' : null;
    case 'beam':
      // Pure atmosphere. It proves nothing, so it is only allowed where the
      // shot has a light source to justify it — never on a night sky.
      return null;
    case 'print':
      return hasSubject ? 'explain' : null;
    default:
      return hasNumber ? 'count' : null;
  }
}
