/**
 * IS THIS A PICTURE OF THE THING — the only question that can reject on its own.
 *
 * This repository's most expensive mistake was a technically perfect photograph
 * of the wrong object: an antique brass dial instrument standing in for the
 * X-ray of a Greek geared mechanism. Right family, wrong thing, every technical
 * axis green, and a documentary claim illustrated with something that is not the
 * thing. The lesson was not "search harder". It was that **semantic relevance
 * is a gate, not a term in an average**.
 *
 * So: two scores that can each reject alone.
 *
 *   RELEVANCE   — is it the subject the brief names?
 *   ACCURACY    — is it correct for the period or the science the brief asserts?
 *
 * Below 8, the candidate is refused, and no arrangement of resolution, exposure
 * and composition can buy it back.
 *
 * WHERE THE EVIDENCE COMES FROM matters as much as the arithmetic. A human
 * review outranks everything: somebody looked at the file and wrote down what
 * it depicts. Failing that, the provider's own description. Failing THAT, the
 * title — and a candidate scored from a title alone is capped below the gate on
 * purpose, because a filename is a claim about a picture and not the picture.
 */

export const SEMANTIC_FLOOR = 8;

/** Words that carry meaning; the rest are noise in a match. */
function terms(text) {
  return new Set(
    String(text ?? '')
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length > 2 && !STOP.has(t)),
  );
}

const STOP = new Set([
  'the', 'and', 'for', 'with', 'from', 'that', 'this', 'its', 'has', 'are', 'was', 'were', 'not',
  'any', 'all', 'one', 'two', 'its', 'into', 'onto', 'over', 'under', 'than', 'then', 'them',
  'photo', 'photograph', 'image', 'picture', 'file', 'jpg', 'jpeg', 'png', 'view', 'shot',
]);

function overlap(a, b) {
  if (!a.size || !b.size) return 0;
  let hits = 0;
  for (const t of a) if (b.has(t)) hits += 1;
  return hits / a.size;
}

/**
 * WHAT THE CANDIDATE IS EVIDENCE OF, and how much that evidence is worth.
 *
 * Returned rather than folded in, because the report has to be able to say
 * "scored from a title alone" — which is the difference between a candidate
 * that was judged and one that was merely matched.
 *
 * A HUMAN REVIEW IS RELATIVE TO THE BRIEF IT WAS WRITTEN FOR, and the first
 * version of this file forgot it. A reviewer scoring `museum-dark.jpg` at 9 for
 * relevance meant "9 as a dark museum ground for the Antikythera reel". Read as
 * a property of the FILE, that 9 travelled: one photograph of a Roman lamp was
 * accepted as a megalith, a harbour, a strait, a human heart and a medieval
 * forge, in five different episodes, on the same borrowed number. It is the
 * exact failure this repository is named after, rebuilt inside the machine
 * meant to prevent it.
 *
 * So the numbers transfer only when the review was written for THIS episode.
 * What always transfers is `depicts` — a person's description of what is in the
 * picture, which is a fact about the file rather than about a brief, and the
 * best text evidence this layer will ever get.
 */
export function evidenceOf(candidate, brief) {
  const review = candidate.reviewed;
  /**
   * The numbers belong to a CASTING, not to a file and not even to an episode.
   * A reviewer writing 9 meant "9 in the role this file is playing"; the same
   * file in another role has not been reviewed at all.
   */
  const own =
    review &&
    brief?.episode &&
    candidate.fromEpisode === brief.episode &&
    Array.isArray(candidate.castIn) &&
    brief.line &&
    candidate.castIn.includes(brief.line);
  if (own && Number.isFinite(review.relevance)) {
    return {kind: 'human review of this brief', text: candidate.description ?? '', weight: 1};
  }
  if (review?.depicts || (review && candidate.description)) {
    return {
      kind: 'human description',
      text: `${candidate.title ?? ''} ${candidate.description ?? ''}`,
      weight: 0.95,
      borrowed: review && !own ? (candidate.castIn?.length ? `its role in ${candidate.fromEpisode}` : candidate.fromEpisode) : null,
    };
  }
  if (candidate.description && candidate.description.length > 24) {
    return {kind: 'provider description', text: `${candidate.title ?? ''} ${candidate.description}`, weight: 0.8};
  }
  return {kind: 'title only', text: candidate.title ?? '', weight: 0.45};
}

export function scoreSemantic(candidate, brief) {
  const evidence = evidenceOf(candidate, brief);
  const notes = [];

  /**
   * A HUMAN LOOKED AT IT, FOR THIS BRIEF. Nothing derived from text beats that
   * in either direction — it is what caught the brass dial, and it is also what
   * rescues a correctly-chosen file whose description is thin.
   */
  if (evidence.kind === 'human review of this brief') {
    const r = candidate.reviewed;
    notes.push(`human review: relevance ${r.relevance}, accuracy ${r.accuracy}, subject ${r.subject}`);
    if (r.note) notes.push(r.note);
    return {
      relevance: Number(r.relevance),
      accuracy: Number(r.accuracy),
      subject: Number(r.subject),
      evidence: evidence.kind,
      notes,
    };
  }

  const said = terms(evidence.text);
  const wanted = terms(`${brief.subject} ${brief.says ?? ''}`);
  const mustShow = brief.must_show ?? [];

  /** Relevance: how much of what the brief is about appears in the evidence. */
  const base = overlap(wanted, said);
  /** And how many of the must-show items are named at all. */
  const shown = mustShow.length
    ? mustShow.filter((item) => overlap(terms(item), said) > 0.34).length / mustShow.length
    : base;

  let relevance = (base * 0.55 + shown * 0.45) * 10;

  /**
   * REJECTION CRITERIA ARE READ, NOT DECORATIVE. A candidate whose own
   * description matches something the brief refuses is refused by its own words.
   */
  for (const reason of brief.reject_if ?? []) {
    const flag = terms(reason);
    if (flag.size && overlap(flag, said) > 0.5) {
      notes.push(`its own description matches a rejection criterion: "${reason}"`);
      relevance = Math.min(relevance, 3);
    }
  }

  /**
   * THE CAP THAT KEEPS A FILENAME FROM BECOMING A JUDGEMENT.
   *
   * A title matching every word of the brief is still just a title. Capped
   * below the floor so a title-only candidate can never be accepted outright —
   * it can only be shortlisted for a human to look at, which is the correct
   * outcome and the one this repo needed two rebuilds to learn.
   */
  if (evidence.kind === 'title only') {
    relevance = Math.min(relevance, SEMANTIC_FLOOR - 0.5);
    notes.push('scored from a title alone — capped below the semantic floor; a filename is a claim about a picture, not the picture');
  }
  if (evidence.borrowed) {
    notes.push(
      `a person reviewed this file for "${evidence.borrowed}", so their SCORES belong to that brief; ` +
        'only their description of what is in the picture has been used here',
    );
  }

  /**
   * ACCURACY is only a separate question where the brief says it is. Where a
   * domain has no historical or scientific constraint there is nothing to be
   * inaccurate ABOUT, and scoring it anyway invents a number.
   */
  const constrained = Boolean(brief.historical_constraints || brief.scientific_constraints);
  let accuracy = constrained ? relevance : 10;
  if (constrained && evidence.kind !== 'human review of this brief') {
    /**
     * Nothing in a caption establishes period-correctness. Held to the same cap
     * as a title so an unreviewed candidate cannot pass a constraint it was
     * never checked against.
     */
    accuracy = Math.min(accuracy, SEMANTIC_FLOOR - 0.5);
    notes.push(
      `${brief.historical_constraints ? 'historical' : 'scientific'} accuracy cannot be established from provider metadata — needs a human look`,
    );
  }

  return {
    relevance: Number(relevance.toFixed(1)),
    accuracy: Number(accuracy.toFixed(1)),
    subject: Number(Math.min(relevance, shown * 10).toFixed(1)),
    evidence: evidence.kind,
    notes,
  };
}

/**
 * THE GATE. Not an average — a floor on each axis that matters.
 *
 * Five green technical axes averaged with two red semantic ones is exactly how
 * a Victorian console shipped as a museum store room.
 */
export function semanticVerdict(scores, brief) {
  const constrained = Boolean(brief.historical_constraints || brief.scientific_constraints);
  if (scores.relevance < SEMANTIC_FLOOR) {
    return {ok: false, why: `semantic relevance ${scores.relevance}/10 is below the floor of ${SEMANTIC_FLOOR} — it is not a picture of ${brief.subject}`};
  }
  if (constrained && scores.accuracy < SEMANTIC_FLOOR) {
    const kind = brief.historical_constraints ? 'historical' : 'scientific';
    return {ok: false, why: `${kind} accuracy ${scores.accuracy}/10 is below the floor of ${SEMANTIC_FLOOR} — the brief asserts a constraint this candidate does not meet`};
  }
  return {ok: true, why: null};
}
