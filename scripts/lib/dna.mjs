/**
 * THE VISUAL DNA CHECK — a scene can be technically valid and still be off-brand.
 *
 * Everything else in `scripts/lib/` asks whether a shot WORKS: is it in frame,
 * is it readable, is it valid at every frame, does the sequence have a rhythm.
 * This asks a different question:
 *
 *   DOES THIS LOOK LIKE THE SAME CHANNEL MADE IT?
 *
 * The failures it catches are the ones that pass every other gate precisely
 * because they are not errors. A caption three pixels left of where every other
 * caption in the reel sits is not a bug; it is drift, and drift is what makes
 * twelve episodes look like twelve studios.
 *
 * IT IS DELIBERATELY NOT A SCORE. Every finding names the value it found, the
 * value the DNA holds, and where the DNA says so — because a consistency check
 * that reports a number teaches nobody what to change.
 */
import {CAMERA, COLOUR, COMPOSITION, DNA_VERSION, MOTION, TRANSITION, TYPE} from '../../visual-system/dna.mjs';

const round = (v, n = 4) => Number(Number(v).toFixed(n));

/** Relative luminance — the same measure the contrast check uses. */
function luminance(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex ?? ''));
  if (!m) return null;
  const v = Number.parseInt(m[1], 16);
  const lin = [(v >> 16) & 255, (v >> 8) & 255, v & 255]
    .map((c) => c / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

/** How close two colours are, so "nearly the accent" is not reported as new. */
function nearest(hex, palette) {
  const t = /^#?([0-9a-f]{6})$/i.exec(String(hex ?? ''));
  if (!t) return null;
  const to = Number.parseInt(t[1], 16);
  const rgb = (v) => [(v >> 16) & 255, (v >> 8) & 255, v & 255];
  const [r, g, b] = rgb(to);
  let best = null;
  for (const candidate of palette) {
    const c = /^#?([0-9a-f]{6})$/i.exec(candidate);
    if (!c) continue;
    const [cr, cg, cb] = rgb(Number.parseInt(c[1], 16));
    const d = Math.hypot(r - cr, g - cg, b - cb);
    if (!best || d < best.distance) best = {hex: candidate, distance: d};
  }
  return best;
}

export function dnaProblems(config) {
  const errors = [];
  const warnings = [];
  const width = config.width ?? 1080;
  const scenes = config.scenes ?? [];
  const where = (i, scene) => `scene[${i}] "${scene.id}"`;

  /* ------------------------------------------------------------ TYPOGRAPHY */

  /**
   * ONE LEFT MARGIN FOR THE WHOLE REEL.
   *
   * Captions are set left, so their left edge is the strongest alignment in the
   * frame — and the eye reads a shift of three pixels between shots as a jolt
   * without being able to say why. This is the finding that started the phase:
   * the planner expressed the margin twice, as a literal 84 and as
   * `WIDTH * 0.075`, and shipped both.
   */
  const margins = new Map();
  for (const [i, scene] of scenes.entries()) {
    const x = scene.params?.captionX;
    if (!Array.isArray(scene.params?.caption) || !scene.params.caption.length || x === undefined) continue;
    if (!margins.has(x)) margins.set(x, []);
    margins.get(x).push(where(i, scene));
  }
  if (margins.size > 1) {
    const canonical = Math.round(width * TYPE.margin);
    const found = [...margins.keys()].sort((a, b) => margins.get(b).length - margins.get(a).length);
    warnings.push(
      `caption left margin is not consistent: ${found.map((x) => `${x}px×${margins.get(x).length}`).join(', ')} — ` +
        `the DNA holds one margin (${canonical}px, TYPE.margin), and a left-set caption's left edge is the ` +
        `strongest alignment in the frame`,
    );
  }
  for (const [x, at] of margins) {
    const canonical = Math.round(width * TYPE.margin);
    if (Math.abs(x - canonical) > 2) {
      warnings.push(`${at[0]}: caption margin ${x}px, DNA margin ${canonical}px (TYPE.margin ${TYPE.margin})`);
      break;
    }
  }

  /** Alignment is a channel decision, not a per-shot one. */
  const aligns = new Set(
    scenes.filter((s) => s.params?.caption?.length).map((s) => s.params.captionAlign ?? TYPE.align),
  );
  if (aligns.size > 1) {
    warnings.push(`captions are set both ${[...aligns].join(' and ')} — the DNA sets them ${TYPE.align} (TYPE.align)`);
  }

  /** Type sizes live between a readable floor and a ceiling that fits. */
  for (const [i, scene] of scenes.entries()) {
    const size = scene.params?.captionSize;
    if (!size || !scene.params?.caption?.length) continue;
    const f = size / width;
    if (f < TYPE.scale.captionMin - 0.002) {
      warnings.push(`${where(i, scene)}: caption ${size}px is below the readable floor (${Math.round(TYPE.scale.captionMin * width)}px, TYPE.scale.captionMin)`);
    }
    if (f > TYPE.scale.captionMax + 0.004) {
      warnings.push(`${where(i, scene)}: caption ${size}px is above the ceiling (${Math.round(TYPE.scale.captionMax * width)}px, TYPE.scale.captionMax)`);
    }
  }

  /* ---------------------------------------------------------------- COLOUR */

  /**
   * ONE ACCENT PER EPISODE.
   *
   * The accent is the only colour an episode chooses. Two accents is not a
   * palette, it is an argument — and it is the fastest way to stop looking like
   * one channel.
   */
  const accents = new Map();
  for (const [i, scene] of scenes.entries()) {
    const accent = scene.params?.accent ?? scene.diagram?.accent;
    if (!accent) continue;
    if (!accents.has(accent)) accents.set(accent, []);
    accents.get(accent).push(where(i, scene));
  }
  if (accents.size > COLOUR.maxAccentsPerEpisode) {
    errors.push(
      `${accents.size} accent colours in one reel (${[...accents.keys()].join(', ')}) — ` +
        `the DNA allows ${COLOUR.maxAccentsPerEpisode} (COLOUR.maxAccentsPerEpisode); a second accent is a second design`,
    );
  }
  /**
   * AN EPISODE PICKS A REGISTER, NOT A COLOUR.
   *
   * So the question is not "is this hex in a list" but "does this reel's accent
   * belong to ONE of the channel's four moods" — and, if several accents
   * appear, whether they come from the same one. Mixing `gold-heat` with
   * `ash-grey` is two designs in one reel; choosing `green-rot` is not.
   */
  const moodsUsed = new Set();
  for (const accent of accents.keys()) {
    const owning = Object.entries(COLOUR.moods).filter(([, m]) => m.accents.includes(accent));
    if (!owning.length) {
      const near = nearest(accent, COLOUR.accents);
      warnings.push(
        `accent ${accent} belongs to no mood register — nearest channel accent is ${near?.hex} (COLOUR.moods). ` +
          `An episode chooses a register and its accent from inside it; it does not invent a hex.`,
      );
      continue;
    }
    for (const [name] of owning) moodsUsed.add(name);
  }
  /**
   * MIXING REGISTERS IS THE SHARPER FAULT, so it is reported as one.
   *
   * Two accents that happen to live in the same register is a reel using two
   * shades of its own colour — untidy. Two accents from different registers is
   * two designs, and the message should say which two.
   */
  if (moodsUsed.size > 1) {
    const shared = Object.values(COLOUR.moods).some((m) => [...accents.keys()].every((a) => m.accents.includes(a)));
    if (!shared) {
      errors.push(
        `accents ${[...accents.keys()].join(', ')} come from different mood registers ` +
          `(${[...moodsUsed].join(', ')}) — the DNA allows ${COLOUR.maxMoodsPerEpisode} (COLOUR.maxMoodsPerEpisode); ` +
          `accent and grade travel together, so two registers is two designs`,
      );
    }
  }

  /** Line work needs a ground darker than the line. Drawn shots only. */
  for (const [i, scene] of scenes.entries()) {
    if (!scene.diagram || (scene.layers ?? []).length) continue;
    const field = scene.params?.fieldColours;
    if (!Array.isArray(field) || !field.length) continue;
    const lit = Math.max(...field.map(luminance).filter((v) => v !== null));
    const ink = luminance(scene.diagram.muted ?? COLOUR.neutral);
    if (ink === null || !Number.isFinite(lit)) continue;
    const ratio = (Math.max(lit, ink) + 0.05) / (Math.min(lit, ink) + 0.05);
    if (ratio < COLOUR.contrast.drawingOnGround) {
      errors.push(
        `${where(i, scene)}: the drawing sits at ${ratio.toFixed(1)}:1 against its ground — ` +
          `the DNA floor is ${COLOUR.contrast.drawingOnGround}:1 (COLOUR.contrast.drawingOnGround)`,
      );
    }
  }

  /* ---------------------------------------------------------------- MOTION */

  /**
   * EVERY MOTION BELONGS TO A FAMILY.
   *
   * Not because families are tidy, but because a family is a REASON. A reveal
   * that is not in ENTRANCE, an emphasis mark that is not in EMPHASIS, a
   * transition arrival that is not in the motivated list — each is a motion
   * that could not say why it was there.
   */
  const entrance = new Set(MOTION.families.ENTRANCE.members);
  const emphasis = new Set(MOTION.families.EMPHASIS.members);
  for (const [i, scene] of scenes.entries()) {
    const reveal = scene.params?.captionReveal;
    if (reveal && !entrance.has(reveal) && reveal !== 'char') {
      errors.push(`${where(i, scene)}: caption arrives by "${reveal}", which is in no motion family (MOTION.families.ENTRANCE)`);
    }
    const mark = scene.params?.captionMark;
    if (mark && mark !== 'none' && !emphasis.has(mark)) {
      errors.push(`${where(i, scene)}: emphasis mark "${mark}" is in no motion family (MOTION.families.EMPHASIS)`);
    }
  }

  /* ---------------------------------------------------------------- CAMERA */

  /**
   * NO FAMILY MAY DOMINATE. Ten moves of which eight are pulls is not a camera
   * style; it is a tic, and it reads as one.
   */
  const moves = scenes.map((s) => s.params?.cameraMove).filter(Boolean);
  if (moves.length >= 6) {
    const tally = {};
    for (const m of moves) tally[m] = (tally[m] ?? 0) + 1;
    for (const [move, n] of Object.entries(tally)) {
      const share = n / moves.length;
      if (share > CAMERA.maxShareOfShots + 0.08) {
        warnings.push(
          `the camera ${move}es in ${n} of ${moves.length} shots (${Math.round(share * 100)}%) — ` +
            `the DNA holds no family above ${Math.round(CAMERA.maxShareOfShots * 100)}% (CAMERA.maxShareOfShots)`,
        );
      }
      if (!CAMERA.families.includes(move)) {
        errors.push(`camera move "${move}" is not a channel family (CAMERA.families)`);
      }
    }
  }

  /* ----------------------------------------------------------- TRANSITIONS */

  /**
   * A TRANSITION MUST HAVE A REASON. The default is a hard cut, and most cuts
   * being plain is what lets the few that are not mean something.
   */
  const arrivals = scenes.map((s) => s.transition?.kind ?? s.transition).filter(Boolean);
  if (arrivals.length && scenes.length > 3) {
    const decorated = arrivals.length / Math.max(1, scenes.length - 1);
    if (decorated > TRANSITION.maxShareOfCuts) {
      warnings.push(
        `${arrivals.length} of ${scenes.length - 1} seams carry a device (${Math.round(decorated * 100)}%) — ` +
          `the DNA caps it at ${Math.round(TRANSITION.maxShareOfCuts * 100)}% (TRANSITION.maxShareOfCuts); ` +
          `a reel that decorates every seam has no punctuation left`,
      );
    }
    const tally = {};
    for (const a of arrivals) tally[a] = (tally[a] ?? 0) + 1;
    for (const [kind, n] of Object.entries(tally)) {
      if (n / Math.max(1, scenes.length - 1) > TRANSITION.maxShareOfCuts) {
        warnings.push(`"${kind}" carries ${n} seams — no single device may exceed ${Math.round(TRANSITION.maxShareOfCuts * 100)}% (TRANSITION.maxShareOfCuts)`);
      }
    }
  }

  /** A darkening arrival on a short shot eats the first readable frame. */
  for (const [i, scene] of scenes.entries()) {
    const kind = scene.transition?.kind ?? scene.transition;
    if (!kind || !TRANSITION.darkening.includes(kind)) continue;
    if ((scene.durationInFrames ?? 0) < TRANSITION.minShotFramesForDarkening) {
      errors.push(
        `${where(i, scene)}: "${kind}" darkens the frame and this shot is ${scene.durationInFrames} frames — ` +
          `the DNA needs ${TRANSITION.minShotFramesForDarkening} (TRANSITION.minShotFramesForDarkening)`,
      );
    }
  }

  /* ----------------------------------------------------------- COMPOSITION */

  /** Atmosphere in front of the words is words behind the weather. */
  for (const [i, scene] of scenes.entries()) {
    const fog = Number(scene.params?.fog) || 0;
    if (fog > COMPOSITION.typographyWins && scene.params?.caption?.length && fog > 0.5) {
      warnings.push(`${where(i, scene)}: fog ${fog} over a caption — the DNA caps it at ${IMAGE_FOG} (IMAGE.fogMaxOverCaption)`);
    }
  }

  return {errors, warnings, version: DNA_VERSION};
}

/** Imported lazily to keep the message readable above. */
const IMAGE_FOG = 0.42;

/**
 * A SUMMARY A PERSON CAN ACT ON, rather than a score they can chase.
 */
export function dnaSummary(config) {
  const {errors, warnings} = dnaProblems(config);
  return {
    version: DNA_VERSION,
    conforms: errors.length === 0,
    errors: errors.length,
    warnings: warnings.length,
    findings: [...errors.map((e) => ({level: 'error', what: e})), ...warnings.map((w) => ({level: 'warning', what: w}))],
  };
}
