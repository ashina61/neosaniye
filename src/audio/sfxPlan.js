const DEFAULT_CYCLE = ['whoosh', 'shimmer', 'impact', 'riser'];

/**
 * Enforce a sparse-but-present sound-design rhythm. The editor may nominate
 * cues, but an LLM plan with one cue must not silently reach the final mix.
 * All returned entries still map one-to-one to visual boundaries.
 */
export function normalizeSfxPlan(proposed = [], boundaryTimes = [], {
  minCues = 3,
  maxCues = 5,
  minGapSeconds = 4,
  cycle = DEFAULT_CYCLE,
} = {}) {
  const out = proposed.map((type) => (type && type !== 'none' ? type : null));
  const valid = (i, selected) => Number.isFinite(boundaryTimes[i]) && selected.every(
    (j) => Math.abs(boundaryTimes[i] - boundaryTimes[j]) >= minGapSeconds,
  );
  const selected = [];

  // Retain the earliest meaningful editor choices, but never stack effects or
  // exceed the cap. Discarded nominations are explicitly cleared from output.
  for (let i = 0; i < out.length; i += 1) {
    if (!out[i]) continue;
    if (selected.length >= maxCues || !valid(i, selected)) {
      out[i] = null;
      continue;
    }
    selected.push(i);
  }

  // Spread automated fills across the story arc: setup, reveal, and payoff.
  const targets = [0.24, 0.54, 0.82, 0.38, 0.68];
  for (const target of targets) {
    if (selected.length >= minCues || selected.length >= maxCues) break;
    const ranked = boundaryTimes
      .map((time, i) => ({ i, distance: Math.abs((time / Math.max(0.001, boundaryTimes.at(-1) || 1)) - target) }))
      .sort((a, b) => a.distance - b.distance);
    const candidate = ranked.find(({ i }) => !out[i] && valid(i, selected));
    if (!candidate) continue;
    const type = cycle[selected.length % cycle.length];
    out[candidate.i] = type;
    selected.push(candidate.i);
  }
  return out;
}
