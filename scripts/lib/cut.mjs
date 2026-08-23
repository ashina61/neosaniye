/**
 * THE CUT DIRECTOR.
 *
 * The previous layer chose an ARRIVAL for every seam — which arrival, under a
 * quota, never three the same running. What it never asked was whether the seam
 * wanted an arrival at all.
 *
 * That is the wrong default. A hard cut is the grammar of documentary editing;
 * it is what most seams should be, and the plainness of most of them is what
 * makes the three that are not plain mean something. A reel where every cut is
 * decorated has no punctuation left — the effects stop reading as choices and
 * start reading as a template.
 *
 * So every seam now gets a DECISION, and `HARD_CUT` is a first-class answer
 * rather than the absence of one. A non-hard cut must also carry a PURPOSE; if
 * there is no purpose to state, the answer is a hard cut.
 *
 * And where two shots genuinely rhyme — a circle onto a moon, a gear onto a
 * wheel, one plate onto itself — the correspondence does the work and the
 * seam stays hard. A match cut is the strongest transition there is and it is
 * made of nothing.
 */

/** The editorial vocabulary. What the cut IS, before how it is executed. */
export const CUT_KINDS = [
  'HARD_CUT',
  'MATCH_CUT',
  'OBJECT_WIPE',
  'MASK',
  'MORPH',
  'DIRECTIONAL',
  'FADE',
  'FLASH',
];

/**
 * WHY a seam is anything other than a hard cut.
 *
 * A transition with no purpose in this list is a transition that should not
 * exist, and the director says so rather than picking one anyway.
 */
export const CUT_PURPOSES = [
  'spatial continuity',
  'temporal continuity',
  'visual similarity',
  'object transformation',
  'energy escalation',
  'conceal and reveal',
  'passage of time',
];

/**
 * HOW AN EDITORIAL CUT IS EXECUTED by the engine's arrival vocabulary.
 *
 * `null` means no arrival component at all — the next shot simply is. Both
 * HARD_CUT and MATCH_CUT map to that, and the difference between them is
 * entirely in why: a match cut is a hard cut somebody EARNED.
 */
export const CUT_EXECUTION = {
  HARD_CUT: null,
  MATCH_CUT: null,
  DIRECTIONAL: 'slip',
  OBJECT_WIPE: 'slip',
  MASK: 'blinds',
  MORPH: 'rack',
  FADE: 'rack',
  FLASH: 'flare',
};

/**
 * WHAT A SHOT LOOKS LIKE, reduced to the handful of features a cut can rhyme on.
 *
 * Deliberately coarse. The question is not "are these images similar" — that
 * needs pixels — but "do they share a form the eye will carry across the cut",
 * and a circle, a plate, a dominant axis and an accent are enough to answer it.
 */
export function shapeOf(scene) {
  const p = scene.params ?? {};
  const plates = Object.values(scene.assets ?? {}).map((f) => String(f).split('/').pop());
  const props = (scene.props ?? []).map((q) => q.kind);
  const round =
    scene.diagram?.type === 'orbit' ||
    scene.diagram?.type === 'gearSystem' ||
    // NOT anatomyFlow. Adding it made every consecutive chamber diagram a
    // "circle onto circle" rhyme and put sixteen match cuts in a twenty-two
    // shot reel — a diagram containing circles is not a circular composition.
    (scene.props ?? []).some((q) => q.kind === 'wire' && q.shape === 'circle');
  return {
    plates,
    props,
    diagram: scene.diagram?.type ?? null,
    /**
     * THE FOUR THINGS THE EYE CARRIES ACROSS A CUT.
     *
     * Subject, shape, direction and scale — and until now only the first two
     * were available, because a drawing exposed nothing about itself. A cut
     * between two shots of the same object at the same size travelling the same
     * way is a match whether or not they are the same photograph, and the whole
     * point of a match cut is that the eye does not notice the join.
     */
    subject: scene.diagram?.subject ?? (plates[0] ?? null),
    /** Which way the shot moves. A pan right into a pan right is a rhyme. */
    direction:
      Math.abs(Number(p.panX) || 0) > 40
        ? (Number(p.panX) > 0 ? 'right' : 'left')
        : Math.abs(Number(p.panY) || 0) > 60
          ? (Number(p.panY) > 0 ? 'down' : 'up')
          : (Number(p.pushTo) || 1) - (Number(p.pushFrom) || 1) > 0.06
            ? 'in'
            : (Number(p.pushFrom) || 1) - (Number(p.pushTo) || 1) > 0.06
              ? 'out'
              : null,
    /** How big the subject is in frame, coarsely. */
    scale: scene.diagram
      ? scene.diagram.type === 'measurement' || scene.diagram.type === 'timeline'
        ? 'wide'
        : 'medium'
      : p.plateWidth
        ? p.plateWidth > 0.85
          ? 'full'
          : 'medium'
        : 'wide',
    round,
    // A timeline and a measurement are both a long straight rule; a slate is a
    // block of type. Both are forms a following shot can pick up.
    linear: scene.diagram?.type === 'timeline' || scene.diagram?.type === 'measurement',
    typographic: Boolean(p.title || p.spinTo || p.countTo !== undefined),
    accent: String(p.accent ?? ''),
    photographic: plates.length > 0,
  };
}

/**
 * DOES THE NEXT SHOT RHYME WITH THIS ONE?
 *
 * Returns the correspondence if there is one, so the reason can be recorded and
 * argued with. Ordered by how strongly the eye carries it.
 */
export function correspondence(a, b) {
  if (!a || !b) return null;
  const shared = a.plates.filter((f) => b.plates.includes(f));
  if (shared.length) return {kind: 'same subject', detail: shared[0]};
  /**
   * A RHYME IS A SHAPE CARRIED ACROSS A CHANGE.
   *
   * Both halves matter. A circle onto a circle is only a rhyme if the two shots
   * are otherwise different things — a gear train into an orbit. A gear train
   * into a gear train is the same drawing continuing, and calling that a match
   * cut is how one reel came out with sixteen of them in twenty-two shots.
   */
  if (a.round && b.round && a.diagram !== b.diagram) {
    return {kind: 'circle onto circle', detail: `${a.diagram ?? 'ring'} → ${b.diagram ?? 'ring'}`};
  }
  if (a.linear && b.linear && a.diagram !== b.diagram) {
    return {kind: 'rule onto rule', detail: `${a.diagram} → ${b.diagram}`};
  }
  /**
   * THE SAME SUBJECT, DRAWN, IS THE SAME SUBJECT.
   *
   * Two shots of one blade at two stages of forging are a match cut in the
   * strictest sense — it is literally the same object, and the whole
   * representation layer was built so that it stays the same object. Reading
   * only file names, that fact was invisible to the editor.
   */
  if (a.subject && a.subject === b.subject && a.diagram && b.diagram) {
    /**
     * BUT THE SAME SUBJECT IN THE SAME DRAWING IS A CONTINUATION.
     *
     * A match cut is a rhyme ACROSS a change: something persists while
     * something else does not. Fifteen consecutive shots of one heart in one
     * anatomical schematic are not fifteen rhymes — they are one drawing seen
     * fifteen times, and labelling every seam a match cut is the same failure
     * as calling a shared accent colour a rhyme. Seventy-six per cent of one
     * reel came out "earned" that way.
     *
     * Same subject, DIFFERENT representation is the real thing: the blade in
     * section after the blade being forged.
     */
    if (a.diagram === b.diagram) {
      return {kind: 'the same drawing continuing', detail: a.subject, weak: true};
    }
    return {kind: 'same subject, seen another way', detail: `${a.subject}: ${a.diagram} → ${b.diagram}`};
  }
  // The same drawing again is a continuation, not a rhyme. Weak: it argues for
  // a plain cut, because there is nothing to bridge between a thing and itself.
  if (a.diagram && b.diagram && a.diagram === b.diagram) {
    return {kind: 'the same drawing continuing', detail: a.diagram, weak: true};
  }
  /** A move continued across a cut. The eye follows the direction, not the frame. */
  if (a.direction && a.direction === b.direction && a.direction !== 'in') {
    return {kind: 'direction carried', detail: a.direction};
  }
  /** Same size, same kind of subject: a scale rhyme, weaker but real. */
  if (a.scale && a.scale === b.scale && a.diagram && b.diagram && a.scale !== 'wide') {
    return {kind: 'scale held', detail: a.scale, weak: true};
  }
  /**
   * A SHARED ACCENT IS NOT A MATCH CUT.
   *
   * Two drawn shots on the same ground in the same colour look continuous, and
   * for a moment that reads as a rhyme — which is why the first pass counted it
   * as one and handed six of nine seams a MATCH_CUT. Six match cuts is no match
   * cuts: the label stops meaning "the eye carried a shape across the join" and
   * starts meaning "these two shots were made by the same program".
   *
   * It is still a real reason not to decorate the seam — there is nothing to
   * bridge between two shots that already share a world — so it comes back as a
   * WEAK correspondence, and a weak one argues for a plain cut rather than
   * claiming a rhyme that is not there.
   */
  if (!a.photographic && !b.photographic && a.accent && a.accent === b.accent) {
    return {kind: 'graphic continuity', detail: a.accent, weak: true};
  }
  return null;
}

/**
 * DECIDE ONE SEAM.
 *
 * The order is the argument: a rhyme beats an effect, an effect needs a reason,
 * and with no reason the answer is a hard cut.
 */
export function directCut({previous, next, beat, rand, used = {}, total = 10, stylisedCap = 0.4}) {
  const a = previous ? shapeOf(previous) : null;
  const b = shapeOf(next);

  /**
   * A RHYME IS A HARD CUT SOMEBODY EARNED.
   *
   * The strongest seam available and it costs nothing: the eye holds the shape
   * across the join and the two shots become one idea. Decorating it would
   * destroy it — a wipe over a match cut hides the very thing that makes it
   * work.
   */
  const rhyme = correspondence(a, b);
  if (rhyme?.weak) {
    return {
      kind: 'HARD_CUT',
      purpose: null,
      because: `${rhyme.kind} (${rhyme.detail}) — the two shots already share a world, so there is nothing to bridge`,
      execution: null,
    };
  }
  if (rhyme) {
    return {
      kind: 'MATCH_CUT',
      purpose: 'visual similarity',
      because: `${rhyme.kind} (${rhyme.detail})`,
      execution: null,
    };
  }

  /**
   * AN EFFECT NEEDS A REASON, and the reason comes from the beat rather than
   * from a list of available effects.
   */
  const motivated =
    beat === 'REVEAL'
      ? {kind: 'FLASH', purpose: 'conceal and reveal'}
      : beat === 'ESCALATION'
        ? {kind: 'FLASH', purpose: 'energy escalation'}
        : beat === 'EVIDENCE' || beat === 'VERDICT'
          ? {kind: 'OBJECT_WIPE', purpose: 'object transformation'}
          : beat === 'MYSTERY'
            ? {kind: 'MASK', purpose: 'conceal and reveal'}
            : beat === 'CONTEXT' || beat === 'COMPARISON'
              ? {kind: 'DIRECTIONAL', purpose: 'spatial continuity'}
              : null;

  if (!motivated) {
    return {kind: 'HARD_CUT', purpose: null, because: 'no correspondence and no reason to decorate', execution: null};
  }

  /**
   * AND EVEN A MOTIVATED EFFECT ANSWERS TO THE REEL.
   *
   * Past the cap the reel is over-edited: the seams have stopped being
   * punctuation and become texture. The excess goes back to hard cuts, which is
   * the correct repair and not a compromise.
   */
  const stylised = Object.entries(used).reduce((n, [kind, count]) => (kind === 'HARD_CUT' || kind === 'MATCH_CUT' ? n : n + count), 0);
  if (stylised >= Math.ceil(total * stylisedCap)) {
    return {
      kind: 'HARD_CUT',
      purpose: null,
      because: `the reel already has ${stylised} stylised cuts — past that it reads as over-edited`,
      execution: null,
    };
  }
  const cap = Math.max(1, Math.ceil(total * 0.25));
  if ((used[motivated.kind] ?? 0) >= cap) {
    return {
      kind: 'HARD_CUT',
      purpose: null,
      because: `${motivated.kind} is already on ${used[motivated.kind]} of ${total} cuts`,
      execution: null,
    };
  }

  return {...motivated, because: `beat is ${beat}`, execution: CUT_EXECUTION[motivated.kind]};
}

/**
 * HOW MUCH OF THE REEL IS DECORATED.
 *
 * Reported so over-editing is a number rather than an impression. A short with
 * two thirds of its seams styled is not richly edited; it is a reel with no
 * plain cuts left to contrast against.
 */
export function cutMix(decisions) {
  const total = Math.max(1, decisions.length);
  const tally = {};
  for (const d of decisions) tally[d.kind] = (tally[d.kind] ?? 0) + 1;
  const hard = (tally.HARD_CUT ?? 0) + (tally.MATCH_CUT ?? 0);
  return {tally, hardRatio: Number((hard / total).toFixed(2)), total};
}
