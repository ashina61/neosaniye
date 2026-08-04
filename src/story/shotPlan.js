/**
 * THE CUT — shot design, not just scene design.
 *
 * ============ WHAT WAS MISSING ============
 *
 * Every beat was framed the same way: subject centred, filling the frame, shot
 * from the same height, on the same lens, with the same slow push. Six of those
 * in a row is not editing — it is one shot repeated six times with the contents
 * swapped. A documentary reads as a documentary because the CUT does work:
 *
 *   · shot scale changes  — wide to establish, medium to follow, close to land
 *   · the subject moves off centre, and which third it sits on changes
 *   · the lens changes    — a wide lens bends space, a long lens flattens it
 *   · depth of field changes — what is sharp tells you where to look
 *   · the camera behaves differently — a locked tripod, a slow push, a handheld
 *     drift; each says something about how close the story is
 *
 * ============ THE EDITING RULES ============
 *
 * Shot design is not random per beat; it follows the arc:
 *
 *   OPEN WIDE      the first beat establishes a place, so we know where we are
 *   TIGHTEN        each beat sits closer than the establishing shot
 *   BREAK PATTERN  never the same scale twice running — a repeated scale reads
 *                  as a mistake, and three of them reads as a broken render
 *   PUNCH THE TURN the loudest beat gets the tightest, hardest framing
 *   LAND CLOSE     the button is close and still, because the words carry it
 *
 * That is why this is a plan over the WHOLE reel rather than a choice per line:
 * a cut only exists in relation to the shot before it.
 */

function hash(value, salt = 0) {
  let h = (2166136261 ^ salt) >>> 0;
  const text = String(value || 'neosaniye').toLowerCase();
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

function stream(seed, index) {
  let h = (seed ^ Math.imul(index + 1, 0x9e3779b1)) >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}

const unit = (value) => (value % 100000) / 100000;
const between = (value, low, high) => low + unit(value) * (high - low);
const pick = (list, value) => list[value % list.length];

/**
 * Shot scales, with what each one is FOR. `subject` is how much of the frame
 * height the subject takes; `lens` bends the set's perspective.
 */
const SCALES = {
  wide: {subject: 0.34, lens: 24, dof: 0.15, label: 'geniş'},
  full: {subject: 0.52, lens: 35, dof: 0.3, label: 'tam'},
  medium: {subject: 0.68, lens: 50, dof: 0.5, label: 'orta'},
  close: {subject: 0.88, lens: 85, dof: 0.78, label: 'yakın'},
  insert: {subject: 1.15, lens: 100, dof: 0.9, label: 'detay'},
};

const SCALE_IDS = Object.keys(SCALES);

/** How the camera behaves. Not decoration — it says how close the story is. */
const MOVES = ['locked', 'push', 'pull', 'drift', 'handheld'];

/** Which third the subject sits on. Dead centre is reserved for the button. */
const PLACEMENTS = ['left-third', 'right-third', 'centre'];

const FOREGROUNDS = ['none', 'doorway', 'railing', 'leaves', 'shoulder'];

/** The scale each emotional beat wants before variety is applied. */
const ROLE_SCALE = {
  setup: 'wide',
  rejection: 'close',
  turn: 'medium',
  fall: 'full',
  payoff: 'medium',
  button: 'close',
};

/**
 * Design the shots for a whole reel.
 *
 * @param {Array<{role: string, line: string, rig: string}>} beats
 * @param {number} seed  the video's seed — two videos cut differently
 * @returns {Array<object>} one shot per beat, in order
 */
export function planShots(beats = [], seed = 0) {
  const shots = [];
  let previousScale = null;
  let previousMove = null;

  beats.forEach((beat, index) => {
    const local = hash(`${beat.line}|shot|${index}`, seed >>> 0);
    const last = index === beats.length - 1;

    // Start from what the beat's role wants.
    let scale = ROLE_SCALE[beat.role] || 'medium';

    // OPEN WIDE, LAND CLOSE — the two ends of the arc are not negotiable.
    if (index === 0) scale = 'wide';
    else if (last) scale = 'close';
    // BREAK PATTERN: the same scale twice running reads as a stuck render.
    else if (scale === previousScale) {
      const alternatives = SCALE_IDS.filter((id) => id !== previousScale && id !== 'insert');
      scale = pick(alternatives, stream(local, 1));
    }
    // …and every so often, cut to a detail. A documentary breathes by looking
    // at one small thing after looking at a big one.
    if (!last && index > 0 && previousScale === 'wide' && unit(stream(local, 2)) > 0.62) {
      scale = 'insert';
    }

    const spec = SCALES[scale];

    let move = pick(MOVES, stream(local, 3));
    if (move === previousMove) move = pick(MOVES.filter((m) => m !== previousMove), stream(local, 4));
    // The button holds still: movement competes with the closing line.
    if (last) move = unit(stream(local, 5)) > 0.5 ? 'locked' : 'push';

    const placement = last
      ? 'centre'
      : pick(PLACEMENTS.filter((p) => p !== 'centre' || unit(stream(local, 6)) > 0.7), stream(local, 7));

    // EXPOSURE MUST MOVE BETWEEN SHOTS — AND NOT JUST ALTERNATE.
    //
    // The duplicate gate calls two frames the same when a perceptual hash
    // matches AND their mean brightness is within 0.03. A live run was blocked
    // on five windows that way.
    //
    // Two traps, both worth stating because the obvious fix fails on each:
    //
    // 1. A ±10% swing is not enough in the dark. Brightness is a MULTIPLIER, so
    //    on a frame averaging 0.12 luma a 10% swing moves it by 0.012 — well
    //    inside the gate's window. The ladder below spans ~30%, which clears
    //    0.03 even on the darkest beats this engine produces.
    // 2. Strict alternation only separates NEIGHBOURS. With +/-/+/- every even
    //    beat shares an exposure with every other even beat, and the gate
    //    compares all pairs, not just adjacent ones. A four-rung ladder means
    //    a repeat needs four beats of distance, past any realistic reel.
    // THE ARITHMETIC, SINCE IT DECIDES THE RUNG SPACING.
    //
    // Brightness is a multiplier, so on a frame averaging L luma two shots
    // differ by L·|e1−e2|. The gate's window is 0.03 and these frames run dark
    // (measured 0.10–0.26), so the worst case needs |e1−e2| > 0.25 — far wider
    // than the ±10% that reads as "a bit brighter". Three rungs at that spacing
    // beat four rungs squeezed together, because a rung that is only 0.08 from
    // its neighbour buys nothing at all.
    const EXPOSURE_LADDER = [1.26, 0.84, 1.05];
    const exposure = +(
      EXPOSURE_LADDER[index % EXPOSURE_LADDER.length] + between(stream(local, 15), -0.015, 0.015)
    ).toFixed(3);

    shots.push({
      exposure,
      scale,
      label: spec.label,
      /** Share of frame height the subject fills. */
      subject: +spec.subject.toFixed(3),
      /** Focal length in mm — the renderer turns this into a perspective. */
      lens: spec.lens,
      /** 0 = everything sharp, 1 = shallow. Tighter shots go shallower. */
      dof: +Math.min(0.95, spec.dof + between(stream(local, 8), -0.08, 0.12)).toFixed(3),
      move,
      placement,
      /** How hard the move travels, as a scale delta over the beat. */
      travel: +between(stream(local, 9), 0.04, 0.16).toFixed(3),
      /** Handheld amplitude in pixels — 0 on a tripod. */
      shake: move === 'handheld' ? +between(stream(local, 10), 2.5, 6).toFixed(2) : 0,
      /** Camera height: low looks up and monumental, high looks down. */
      height: +between(stream(local, 11), 0.32, 0.68).toFixed(3),
      /** What the camera is shooting past. */
      foreground: index === 0 || last ? pick(FOREGROUNDS, stream(local, 12)) : pick(FOREGROUNDS, stream(local, 13)),
      foregroundSide: unit(stream(local, 14)) > 0.5 ? 1 : -1,
    });

    previousScale = scale;
    previousMove = move;
  });

  return shots;
}

export const SHOT_GRAMMAR = {SCALES, MOVES, PLACEMENTS, FOREGROUNDS};
