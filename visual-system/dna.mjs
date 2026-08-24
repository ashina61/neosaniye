/**
 * THE VISUAL DNA — one machine-readable source for the channel's design language.
 *
 * Plain JavaScript for the same reason `schema.mjs` and `state.mjs` are: the
 * ENGINE that draws with these values and the CHECKER that audits them have to
 * read the same numbers. Two copies drift, and a design system that drifts is a
 * design system that does not exist.
 *
 * EVERY VALUE HERE WAS MEASURED, NOT INVENTED. The channel already had a visual
 * language — three font families, a four-step stroke scale, one accent, six
 * camera families — expressed across forty files and twelve episodes. This is
 * that language written down, so the thirteenth episode inherits it instead of
 * re-deciding it.
 *
 * The one rule the whole file exists to enforce:
 *
 *   A NEW STORY IS NOT A NEW VISUAL LANGUAGE.
 *
 * The subject changes. The grammar does not. A heart must not look like a map,
 * and both must look like the same studio made them.
 */

/** Bumped only when the language INTENTIONALLY changes. See visual-system/VERSION. */
export const DNA_VERSION = '1.0.0';

/* ------------------------------------------------------------- TYPOGRAPHY */

/**
 * THREE FAMILIES, AND THEY DO NOT OVERLAP.
 *
 * Serif is the narrator's voice — the body of a caption, set in italic, the
 * register of a printed documentary. Sans is emphasis and only emphasis: the
 * word the line exists for, and the numbers. Mono is the machine's own voice —
 * labels, callouts, disclosure plates, registration marks; everything the
 * DRAWING says about itself rather than about the story.
 *
 * A fourth family would not add a voice, it would blur the three that exist.
 */
export const TYPE = {
  families: {
    serif: '"Playfair Display", "Iowan Old Style", Georgia, serif',
    sans: '"Archivo", "Helvetica Neue", Arial, sans-serif',
    mono: '"Courier New", ui-monospace, monospace',
  },
  roles: {
    caption: 'serif',
    emphasis: 'sans',
    title: 'sans',
    figure: 'sans',
    label: 'mono',
    callout: 'mono',
    disclosure: 'mono',
  },
  weights: {caption: 900, emphasis: 900, label: 400},
  /**
   * SIZES AS FRACTIONS OF FRAME WIDTH, because the frame is 1080 today.
   * The floor is where a caption stops being readable on a phone; the ceiling
   * is where a three-word line runs off both edges.
   */
  scale: {
    captionMin: 0.043,
    captionMax: 0.17,
    titleMin: 0.115,
    titleMax: 0.232,
    label: 0.021,
    callout: 0.021,
    disclosure: 0.0185,
  },
  /** The emphasis word is set larger than its line, and by exactly this much. */
  emphasisScale: 1.16,
  tracking: {caption: -0.01, label: 0.14, disclosure: 0.16, figure: 0.2},
  /**
   * ONE LEFT MARGIN. It had two values — a literal 84 and `WIDTH * 0.075`,
   * which is 81 — and the difference shipped in three episodes as captions that
   * do not line up between shots. A margin expressed twice is a margin.
   */
  margin: 0.0778,
  align: 'left',
  /** Platform furniture eats the bottom eighth and a strip at the top. */
  safeArea: {top: 0.04, bottom: 0.9},
  maxLines: 5,
  idealCharsPerLine: 12,
};

/* ------------------------------------------------------------------ COLOUR */

/**
 * ONE ACCENT, ONE NEUTRAL, AND A GROUND THAT IS ALWAYS DARKER THAN THE DRAWING.
 *
 * The accent is the episode's own — a reel about fire is not the colour of a
 * reel about the sea — and that is the ONLY colour an episode chooses. Two
 * accents in one reel is not a palette, it is an argument.
 *
 * Everything else is fixed: the neutral that carries labels and construction
 * lines, the near-black grounds, and the two semantic colours that mean
 * something rather than decorate. `high`/`low` are hot and cold, oxygenated and
 * not, above and below — a pair that reads as a pair.
 */
export const COLOUR = {
  /**
   * FOUR MOOD REGISTERS, AND AN EPISODE PICKS ONE.
   *
   * This is where "when subject-specific colour is permitted" is answered. An
   * episode does NOT invent a colour; it chooses a register the channel already
   * has, and its accent from inside that register. A reel about fire is warm
   * and a reel about a drowned wreck is cold because the CHANNEL has a warm
   * register and a cold one — not because somebody picked a hex.
   *
   * The registers are the grade as much as the accent: `gold-heat` desaturates
   * less and sepias more, `ash-grey` pulls the colour almost out. Accent and
   * grade travel together, which is why they are one table.
   */
  moods: {
    'gold-heat': {accents: ['#f2b53a', '#e8a020', '#ffcf3d', '#d99326'], why: 'fire, gold, furnace, sunlight on stone'},
    'cold-noir': {accents: ['#ffcf3d', '#e6e2d6', '#8fb6c8', '#c9a94b'], why: 'night, water, evidence, institutions'},
    'green-rot': {accents: ['#c8d94a', '#9fb83a', '#e0d089'], why: 'corrosion, seabed, decay, long burial'},
    'ash-grey': {accents: ['#e8e2d4', '#b9c3c9', '#d94f3d'], why: 'ash, concrete, aftermath, exhaustion'},
  },
  /** Every accent the channel owns: the union of the four registers. */
  get accents() {
    return [...new Set(Object.values(this.moods).flatMap((m) => m.accents))];
  },
  /**
   * MIXING REGISTERS IS THE VIOLATION, not choosing one. An accent from
   * `gold-heat` beside one from `ash-grey` in the same reel is two designs.
   */
  maxMoodsPerEpisode: 1,
  maxAccentsPerEpisode: 1,

  neutral: '#cfc6ae',
  paper: '#f6ead0',
  ink: '#0b0906',
  ground: ['#16110d', '#0d0b09', '#0c0806'],
  /**
   * THE TWO COLOURS THAT MEAN SOMETHING RATHER THAN DECORATE. Hot and cold,
   * oxygenated and not, above and below. They are fixed across the channel so
   * that a viewer who learns them in one episode still knows them in the next.
   */
  semantic: {high: '#d9534f', low: '#5b8fa8'},
  /**
   * CONTRAST IS A FLOOR, NOT A PREFERENCE. Relative luminance, the same
   * measure an accessibility ratio uses, because it is the same question: can
   * the eye separate these two surfaces. Line work has no mass to carry itself.
   */
  contrast: {drawingOnGround: 3, comfortable: 4.5},
};

/* --------------------------------------------------------- GRAPHIC LANGUAGE */

/**
 * FOUR STROKE WEIGHTS, DERIVED FROM THE FRAME.
 *
 * Construction lines are the faintest — the pitch circles and centre marks a
 * draughtsman sets out before drawing anything. Detail is the drawing proper.
 * Object is a thing's own outline. Emphasis is the one edge that matters.
 *
 * A fifth weight would not be a fifth level of importance; it would be a second
 * opinion about the four.
 */
export const STROKE = {
  construction: 0.0015,
  detail: 0.0024,
  object: 0.0042,
  emphasis: 0.0062,
  linejoin: 'round',
  /** Drawings are drawn, not styled: no rounded corners on technical work. */
  cornerRadius: 0,

  /**
   * TWO REGISTERS, AND THEY ARE NOT THE SAME HAND.
   *
   * The four weights above are TECHNICAL line work — a plate, a section, a
   * gear train. Thin, even, and derived from the frame so the scale survives a
   * resolution change.
   *
   * The second register is HAND MARKS over photographs: a route drawn on a
   * map, a circle round a face, a tally notched into the frame. Those are a
   * marker pen, not a draughtsman's pen. They are two to five times heavier
   * and they carry a dark backing stroke underneath, because a mark that has
   * to read over an arbitrary photograph cannot rely on the photograph being
   * dark. That is a real distinction and it was in the code before it was
   * written down here.
   */
  registers: {
    technical: {
      files: ['draw/sheet.tsx', 'draw/Map.tsx', 'draw/Process.tsx', 'draw/CrossSection.tsx', 'draw/AnatomyFlow.tsx', 'draw/ScaleHaulage.tsx', 'draw/Diagram.tsx'],
      scale: 'weights(w) — construction / detail / object / emphasis',
    },
    marker: {
      files: ['draw/Motif.tsx', 'draw/Annotation.tsx'],
      rule: 'a hand mark is 2–5× the technical detail weight and carries a darker backing stroke beneath it',
      /**
       * AND IT IS NOT PARAMETERISED YET. `Motif.tsx` writes its widths as
       * literals against a 1080 frame, so they are correct today and wrong at
       * any other size. Recorded as a deviation rather than quietly blessed:
       * enumerating the sixteen numbers into this file would turn drift into
       * "system" by renaming it.
       */
      status: 'KNOWN_DEVIATION',
      why: 'the widths are literals against a 1080 frame and do not scale with it',
      remediation: 'derive them from a marker() scale the way weights() derives the technical four; visual output changes, so it needs a look at the frames',
      since: '1.0.0',
    },
  },
};

/**
 * THE ANNOTATION VOCABULARY.
 *
 * Every one of these already exists as a component; the list is here so a new
 * episode reaches for one instead of inventing a sixth way to point at
 * something.
 */
export const ANNOTATION = {
  arrow: {head: 'triangle', drawsOn: true, weight: 'object'},
  callout: {leader: 'straight', dot: true, text: 'mono', side: 'whichever has room'},
  measurement: {ticks: 'perpendicular', text: 'mono', style: 'dimension line'},
  marker: {shapes: ['dot', 'ring', 'hazard'], weight: 'detail'},
  label: {font: 'mono', transform: 'uppercase', tracking: 0.14},
  underline: {kind: 'draws itself', weight: 'emphasis'},
  registration: {corners: 4, weight: 'construction', opacity: 0.45},
  disclosure: {font: 'mono', rule: 'left border', wraps: false},
};

/* --------------------------------------------------------- IMAGE TREATMENT */

/**
 * THE FILM PASS IS ONE PLACE AND ONE PLACE ONLY.
 *
 * Grain, grunge, scanlines, vignette, gate weave and grade live in
 * `FilmLook.tsx`. A template that adds its own grain is a template with a
 * second opinion about what the channel looks like, and two grains do not read
 * as more film, they read as noise.
 */
export const IMAGE = {
  film: {
    grainOpacity: [0.28, 0.42],
    grungeOpacity: [0.1, 0.2],
    scanlineOpacity: [0.06, 0.16],
    vignetteStrength: [0.34, 0.58],
    weavePx: [4, 7],
    posterizeFps: [12, 15],
  },
  grade: {saturate: [0.82, 1.0], contrast: [1.05, 1.2], sepia: [0.2, 0.5], brightness: [0.94, 1.06]},
  /** A subject plate never fills the frame: see the composition rules. */
  plateMaxHeight: 0.92,
  /** Atmosphere sits in front of everything and must not sit on the words. */
  fogMax: 0.62,
  fogMaxOverCaption: 0.42,
};

/* ------------------------------------------------------------- COMPOSITION */

/**
 * FOUR PLANES, AND THEY MOVE AT DIFFERENT RATES.
 *
 * The difference between the rates is the only reason a flat drawing reads as a
 * space. A push that scales every plane equally is a zoom.
 */
export const COMPOSITION = {
  planes: {background: 0.16, secondary: 0.52, primary: 1, foreground: 1.55},
  /** How much of a shot's camera a DRAWING may take. A photograph may take all. */
  drawingCameraShare: 0.3,
  drawingPanDepth: 0.24,
  drawingPushCap: 1.18,
  /**
   * The most things that may be moving at once before a shot stops having a
   * subject. Not a budget to spend — a ceiling that means something is wrong.
   */
  maxSimultaneousElements: 5,
  /** Events per shot: law 18. Under one is a slideshow, over five is a fight. */
  eventsPerShot: {min: 1, ideal: [2, 4], max: 5},
  /** Type wins. Nothing is drawn through a sentence. */
  typographyWins: true,
};

/* ----------------------------------------------------------------- MOTION */

/**
 * SIX FAMILIES, AND A MOTION BELONGS TO EXACTLY ONE.
 *
 * The families are not a list of effects; they are a list of REASONS. A motion
 * that cannot name its family is a motion without a purpose, and a motion
 * without a purpose is decoration — which is the thing this repository has
 * spent four phases removing.
 */
export const MOTION = {
  families: {
    ENTRANCE: {
      why: 'something arrives that was not there',
      members: ['rise', 'wipe', 'punch', 'blur', 'draw-on', 'clip-reveal', 'stagger', 'spring'],
      durationFrames: [8, 26],
      easing: 'out(cubic)',
    },
    EMPHASIS: {
      why: 'one thing matters more than the rest of the frame',
      members: ['punch', 'highlight', 'underline', 'box', 'flicker', 'recolour', 'shake'],
      durationFrames: [4, 18],
      easing: 'out(back)',
    },
    TRANSFORMATION: {
      why: 'the same object is different at the end than it was at the start',
      members: ['morph', 'deform', 'state-change', 'material-change', 'growth', 'contraction'],
      durationFrames: [18, 60],
      easing: 'inOut(cubic)',
    },
    CAUSAL: {
      why: 'B happens BECAUSE A happened, and the frame shows the because',
      members: ['force-transfer', 'propagation', 'flow', 'chain', 'mesh', 'squeeze'],
      durationFrames: [12, 90],
      easing: 'physical',
    },
    CAMERA: {
      why: 'the frame itself is answering the shot',
      members: ['push', 'pull', 'pan', 'tilt', 'drift', 'hold', 'impact'],
      durationFrames: [30, 180],
      easing: 'out(cubic)',
    },
    EXIT: {
      why: 'something leaves, and leaving is an event',
      members: ['recede', 'dissolve', 'move-through', 'hard-cut'],
      durationFrames: [6, 24],
      easing: 'in(quad)',
    },
  },
  /** The only easing curves the channel uses. A seventh is a new language. */
  easing: [
    'out(cubic)',
    'out(quad)',
    'inOut(cubic)',
    'inOut(quad)',
    'in(cubic)',
    'in(quad)',
    'out(back)',
    'linear',
    'physical',
  ],
  /**
   * PHYSICAL EASING IS NOT A CURVE, IT IS A MODEL. `heavy`, `tension`, `rigid`,
   * `impact`, `flow`, `cyclic`, `angular` and `settle` in `engine/motion.ts`.
   * A thousand-ton block does not ease like a menu.
   */
  physical: ['heavy', 'tension', 'rigid', 'impact', 'flow', 'cyclic', 'angular', 'settle'],
  /** The shared clock. Everything steps at this rate, so nothing floats. */
  posterizeFps: 12,
  /**
   * MOTION DENSITY FOLLOWS INFORMATION DENSITY. A quiet shot holds; a shot
   * carrying a claim coordinates several elements; a payoff moves hard and
   * then STOPS. Never animate everything at once to look busy.
   */
  density: {
    lowInformation: {events: [1, 2], note: 'controlled movement, or a hold'},
    highInformation: {events: [3, 5], note: 'coordinated, and ordered as a chain'},
    payoff: {events: [2, 4], note: 'strong motion, then a hold long enough to read'},
  },
  /** A payoff has to be allowed to land. Below this it is a flash. */
  minPayoffHoldSeconds: 1.2,
};

/* -------------------------------------------------------------- TRANSITIONS */

/**
 * THE DEFAULT IS A HARD CUT, AND THAT IS NOT A LIMITATION.
 *
 * The grammar of documentary editing is the hard cut. Most cuts being plain is
 * what allows the three that are not to mean something. A reel that decorates
 * every seam has no punctuation left.
 */
export const TRANSITION = {
  default: 'HARD_CUT',
  motivated: {
    MATCH_CUT: 'the two shots genuinely rhyme — circle onto circle, rule onto rule',
    OBJECT_WIPE: 'an object in the outgoing shot carries the incoming one on',
    MASK: 'the incoming shot is revealed THROUGH something in the outgoing one',
    MORPH: 'the same object continues and changes',
    DIRECTIONAL: 'space continues across the cut',
    FADE: 'time passes',
    FLASH: 'an impact lands on the cut',
  },
  /** No device may take more than this share of a reel's seams. */
  maxShareOfCuts: 0.25,
  /** A darkening arrival on a short shot eats the first readable frame. */
  darkening: ['blinds', 'flare', 'rack'],
  minShotFramesForDarkening: 60,
  maxArrivalShareOfShot: 0.125,
};

/* --------------------------------------------------------------- THE CAMERA */

/**
 * A CAMERA MOVE IS CHOSEN BY THE BEAT, NOT BY A DIE.
 *
 * And no family may dominate: ten moves of which eight are pulls is not a
 * camera style, it is a tic.
 */
export const CAMERA = {
  families: ['push', 'pull', 'pan', 'tilt', 'drift', 'hold'],
  byBeat: {
    reveal: 'push',
    verdict: 'hold',
    aftermath: 'pull',
    context: 'pan',
    escalation: 'push',
    hook: 'push',
  },
  maxShareOfShots: 0.3,
  /** A drawing has only the frame it was composed for. See COMPOSITION. */
  photographPushMax: 6.4,
  drawingPushMax: 1.18,
};

/** Everything, for a checker that wants one import. */
export const DNA = {
  version: DNA_VERSION,
  TYPE,
  COLOUR,
  STROKE,
  ANNOTATION,
  IMAGE,
  COMPOSITION,
  MOTION,
  TRANSITION,
  CAMERA,
};
