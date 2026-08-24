/**
 * THE FALLBACK LADDER — what to do when the picture you want does not exist.
 *
 * The rule this whole layer is built around: a missing visual is a problem to
 * SOLVE, never permission to use the wrong photograph, and never permission to
 * put white text on black and call it a design decision.
 *
 * Six rungs, in order. Each is a real answer, not a consolation prize — a
 * meshing gear train is a better hero than a poor photograph of the wrong
 * machine, and the ladder is ordered by TRUTHFULNESS FIRST and only then by
 * production value.
 *
 *   1 REVIEWED LOCAL     somebody looked at this file and wrote down what it is
 *   2 EXTERNAL PHOTO     a live provider, licence-clean, scored and gated
 *   3 PUBLIC ARCHIVE     the museums and libraries; older, freer, often better
 *   4 GENERATED          an illustration, declared as one, only if configured
 *   5 PROCEDURAL         the engine draws it, and says it is a reconstruction
 *   6 TYPOGRAPHY         and only for a claim that has no picture
 *
 * THE LAST RUNG IS GUARDED. A line about a place, a process, a body, a
 * mechanism, a size or the inside of a material cannot be carried by words: it
 * reaches rung six only as a REPRESENTATION_REQUIRED hole, counted and
 * reported. Falling through silently is the failure that produced forty-one
 * text cards out of forty-five lines.
 */

/** Domains where words are not a representation. Mirrors the semantic layer. */
export const NEEDS_A_PICTURE = ['geography', 'process', 'anatomy', 'mechanism', 'scale', 'material'];

export const RUNGS = [
  {
    n: 1,
    id: 'reviewed-local',
    label: 'reviewed local asset',
    providers: ['local'],
    why: 'a file already looked at, licensed and paid for outranks a fresh search result',
  },
  {
    n: 2,
    id: 'external-photo',
    label: 'reliable external real photograph',
    providers: ['commons', 'openverse', 'pexels', 'pixabay'],
    why: 'a real photograph of the named thing, if one is free and reachable',
  },
  {
    n: 3,
    id: 'public-archive',
    label: 'public-domain archive',
    providers: ['loc', 'archive', 'europeana', 'nasa'],
    why: 'museums and libraries: older, freer, and more likely to hold the object itself',
  },
  {
    n: 4,
    id: 'generated',
    label: 'generated illustrative image',
    providers: ['generated'],
    why: 'only where an image provider is configured, and only ever labelled as an illustration',
  },
  {
    n: 5,
    id: 'procedural',
    label: 'procedural representation',
    providers: [],
    why: 'the engine draws it and declares it a reconstruction — a first-class answer, not a placeholder',
  },
  {
    n: 6,
    id: 'typography',
    label: 'typography',
    providers: [],
    why: 'words, and only for a claim no picture could carry',
  },
];

/** Is a generation provider actually configured, or is rung four a fiction? */
export function generationConfigured() {
  return Boolean(process.env.IMAGE_API_URL || process.env.IMAGE_API_KEY);
}

/**
 * A GENERATED ASSET IS NOT A PHOTOGRAPH, and the settle step has to say which
 * of the two a line ended up with. Rungs one to three are records; rung four is
 * an illustration carrying a disclosure plate.
 */
export const RECORD_RUNGS = [1, 2, 3];

/**
 * WHERE A LINE ENDED UP, AND WHETHER THAT IS ALLOWED.
 *
 * Called once per brief after acquisition has run. The verdict is the thing the
 * report is for: an accepted photograph, a legitimate drawing, or a hole with a
 * name.
 */
export function settle({brief, accepted, drawn}) {
  if (accepted) {
    return {
      rung: accepted.rung,
      resolution: RECORD_RUNGS.includes(accepted.rung) ? 'photograph' : 'generated illustration',
      ok: true,
      note: null,
    };
  }
  if (drawn) {
    return {
      rung: 5,
      resolution: 'procedural',
      ok: true,
      note: `no acceptable photograph; the line is carried by a ${drawn} drawing, declared as a reconstruction`,
    };
  }
  const needed = NEEDS_A_PICTURE.includes(brief.domain);
  return {
    rung: 6,
    resolution: needed ? 'REPRESENTATION_REQUIRED' : 'typography',
    ok: !needed,
    note: needed
      ? `the line is about ${brief.domain} and reached the bottom of the ladder with no picture — this is a hole, not a design decision`
      : 'an abstract claim, which words can carry',
  };
}

/** The rungs a run may actually use, given who answered the preflight. */
export function usableRungs(availability) {
  const up = new Set(availability.filter((p) => p.available).map((p) => p.id));
  return RUNGS.map((rung) => {
    if (rung.id === 'generated') {
      return {...rung, usable: generationConfigured(), because: generationConfigured() ? null : 'no image generation provider configured'};
    }
    if (!rung.providers.length) return {...rung, usable: true, because: null};
    const live = rung.providers.filter((id) => up.has(id));
    return {
      ...rung,
      usable: live.length > 0,
      live,
      because: live.length ? null : `every provider on this rung is unavailable: ${rung.providers.join(', ')}`,
    };
  });
}
