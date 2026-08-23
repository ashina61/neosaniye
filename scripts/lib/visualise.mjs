/**
 * BUILDING A DRAWING FROM A SENTENCE.
 *
 * The five new primitives take data. This is where the data comes from, and the
 * whole difficulty is in one rule:
 *
 *   NOTHING HERE MAY KNOW WHICH EPISODE IT IS WORKING ON.
 *
 * There is no map of Hormuz in this file and there is not going to be. What
 * there is: a line that names two shores and a width becomes two landmasses
 * with water and a dimension between them. A line that names a heat, a hammer
 * and a quench becomes three stages of one object. A line about a crack, water
 * and a reaction becomes a section with a crack, a fluid and an inclusion that
 * is consumed.
 *
 * The geometry is generic and the CONTENT is the sentence's. That is what makes
 * it a representation layer rather than five illustrations with switches on
 * them — and it is why a sixth subject in the same domain gets a drawing for
 * free.
 *
 * Everything returned is fractions of the frame and scene-relative frames.
 */
import {figureIn} from './representation.mjs';

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

/** Deterministic 0..1 from a seed, so one line always draws the same way. */
function hash01(seed, salt = 0) {
  let h = (2166136261 ^ salt) >>> 0;
  for (let i = 0; i < String(seed).length; i += 1) {
    h ^= String(seed).charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return ((h >>> 0) % 10000) / 10000;
}

/** The words a line actually used, so a drawing can be built from them. */
const has = (vo, re) => re.test(String(vo));

/* ── MAP ───────────────────────────────────────────────────────────────── */

/**
 * A PLACE, SCHEMATICALLY.
 *
 * Two coasts and the water between them is the commonest shape in documentary
 * geography — a strait, a border river, a valley, a channel — and it is the one
 * a sentence most often describes. Where the line instead names a sequence of
 * places, it becomes a route across a single ground.
 *
 * The coastlines are generated from the seed rather than traced, and the plate
 * says SCHEMATIC, because this repo has no survey data and inventing a
 * recognisable outline would claim a precision it does not have.
 */
export function buildMap({vo, seed, accent, muted, stops = [], claims = []}) {
  const wobble = (i, amp = 0.05) => (hash01(seed, i) - 0.5) * amp;
  const twoSided = has(vo, /\b(north\w*|south\w*|both sides|either side|shores)\b/i) || claims.includes('two_shores');
  const narrow = claims.includes('narrowness') || has(vo, /\b(narrow\w*|miles across|wide)\b/i);
  const figure = figureIn(vo);
  const unit = /\bkilometre|kilometer/i.test(vo) ? 'km' : /\bmiles?\b/i.test(vo) ? 'miles' : '';

  /** A coast: a run of points along a line, roughed up so it is not a ruler. */
  const coast = (baseY, dir, salt) =>
    Array.from({length: 9}, (_, i) => {
      const x = i / 8;
      return [x, baseY + dir * (0.03 + Math.abs(wobble(salt + i, 0.07)))];
    });

  const regions = [];
  const gap = narrow ? 0.1 : 0.17;
  const midY = 0.44;

  if (twoSided || narrow) {
    /**
     * NORTH LAND, WATER, SOUTH LAND — the relation the sentence describes.
     *
     * THE WINDING MATTERS. The first version walked the northern coast
     * backwards to close its polygon, which crossed the two ends over each
     * other: the render came out with a giant X drawn across the top of the
     * frame, because a self-intersecting path is filled by the crossing rule
     * and outlined along its own crossing. Each landmass now runs along its
     * coast in one direction and closes along the frame edge.
     */
    regions.push({
      kind: 'land',
      shape: [[0, 0], ...coast(midY - gap / 2, -1, 7), [1, 0]],
    });
    regions.push({
      kind: 'water',
      shape: [
        [0, midY - gap / 2 - 0.02],
        [1, midY - gap / 2 - 0.02],
        [1, midY + gap / 2 + 0.02],
        [0, midY + gap / 2 + 0.02],
      ],
    });
    regions.push({
      kind: 'land',
      shape: [[0, 1], ...coast(midY + gap / 2, 1, 23), [1, 1]],
    });
  } else {
    regions.push({
      kind: 'land',
      shape: [
        [0.06, 0.2],
        [0.5 + wobble(3, 0.2), 0.14],
        [0.94, 0.24],
        [0.9, 0.66],
        [0.5 + wobble(9, 0.2), 0.72],
        [0.08, 0.62],
      ],
    });
  }

  const spec = {type: 'map', regions, accent, muted};

  /**
   * THE LANE. One in and one out is a real and common arrangement, and drawing
   * both is the difference between "ships pass here" and "there are exactly two
   * ways through and they are two miles wide".
   */
  const lanes = has(vo, /\b(one (?:lane )?in.*one|lanes?|in and out|traffic)\b/i);
  if (stops.length >= 2) {
    spec.route = [
      {
        points: stops.map((_, i) => [0.1 + (i / Math.max(1, stops.length - 1)) * 0.8, midY + wobble(i + 40, 0.08)]),
      },
    ];
    spec.markers = stops.map((label, i) => ({
      x: 0.1 + (i / Math.max(1, stops.length - 1)) * 0.8,
      y: midY + wobble(i + 40, 0.08),
      label,
      kind: 'place',
      at: 8 + i * 7,
    }));
  } else if (twoSided || narrow) {
    spec.route = lanes
      ? [
          {points: [[0.04, midY - 0.022], [0.96, midY - 0.022]]},
          {points: [[0.96, midY + 0.022], [0.04, midY + 0.022]]},
        ]
      : [{points: [[0.04, midY], [0.96, midY]]}];
  }

  if (narrow && figure) {
    spec.distance = {
      from: [0.3, midY - gap / 2],
      to: [0.3, midY + gap / 2],
      label: `${figure}${unit ? ` ${unit}` : ''}`,
    };
  }

  if (claims.includes('chokepoint')) {
    spec.markers = [...(spec.markers ?? []), {x: 0.52, y: midY, label: 'closed', kind: 'hazard', at: 20}];
    spec.highlight = {
      shape: [
        [0.36, midY - gap / 2],
        [0.68, midY - gap / 2],
        [0.68, midY + gap / 2],
        [0.36, midY + gap / 2],
      ],
    };
  }
  if (claims.includes('no_alternative')) {
    spec.annotations = [{x: 0.2, y: midY - gap / 2 - 0.08, text: 'no way round', side: 'right'}];
  }
  return spec;
}

/* ── PROCESS ───────────────────────────────────────────────────────────── */

/**
 * THE VERBS IN THE SENTENCE, IN ORDER, AS ONE OBJECT CHANGING.
 *
 * A process line almost always names its own stages: "hammer, fold, hammer
 * again", "heated once more and plunged into oil". So the stages are read off
 * the verbs, in the order they appear, and each verb carries both an agent (the
 * cause) and a shape change (the effect).
 *
 * The shape is a generic bar in a unit box. That is deliberate: this has to
 * work for a blade, a billet, a loaf and a casting, and the thing the viewer
 * must feel is not "that is a sword" but "that is the SAME thing, changed".
 */
const VERBS = [
  [/\bheat\w*|hot|furnace|fire|degrees\b/i, {agent: 'heat', label: 'heated', heat: 0.75, stretch: 1.06, taper: 0.1}],
  [/\bforge[ds]?|forging|worked it|drawn out\b/i, {agent: 'strike', label: 'forged', heat: 0.65, stretch: 1.18, taper: 0.14}],
  [/\bhammer\w*|struck|strike|beat\b/i, {agent: 'strike', label: 'hammered', heat: 0.6, stretch: 1.24, taper: 0.22}],
  [/\bfold\w*|layer\w*\b/i, {agent: 'fold', label: 'folded', heat: 0.55, stretch: 0.86, taper: 0.16}],
  [/\bquench\w*|plunged|oil|cool\w*\b/i, {agent: 'quench', label: 'quenched', heat: 0.06, stretch: 1.0, taper: 0.3}],
  [/\bgrind\w*|polish\w*|sharpen\w*|ground\b/i, {agent: 'grind', label: 'ground', heat: 0, stretch: 1.0, taper: 0.42}],
  [/\bmix\w*|poured?|blend\w*\b/i, {agent: 'water', label: 'mixed', heat: 0, stretch: 1.1, taper: 0.06}],
  [/\bcure[ds]?|curing|set\b/i, {agent: 'pressure', label: 'cured', heat: 0, stretch: 1.0, taper: 0.08}],
];

/** A bar in a unit box: eight points, so every stage tweens against every other. */
function bar({stretch = 1, taper = 0, thickness = 0.34}) {
  const halfW = clamp(0.46 * stretch, 0.12, 0.49);
  const t = thickness / 2;
  const tip = t * (1 - clamp(taper, 0, 0.9));
  return [
    [0.5 - halfW, 0.5 - t],
    [0.5 - halfW * 0.3, 0.5 - t],
    [0.5 + halfW * 0.55, 0.5 - tip],
    [0.5 + halfW, 0.5],
    [0.5 + halfW * 0.55, 0.5 + tip],
    [0.5 - halfW * 0.3, 0.5 + t],
    [0.5 - halfW, 0.5 + t],
    [0.5 - halfW, 0.5],
  ];
}

export function buildProcess({vo, accent, muted, objectLabel = null}) {
  const text = String(vo);
  /** Stages named by the brief win; otherwise the verbs in the line are read. */
  const found = [];
  for (const [re, step] of VERBS) {
    const at = text.search(re);
    if (at >= 0) found.push({at, ...step});
  }
  found.sort((a, b) => a.at - b.at);

  // The raw state, so the first stage is the thing BEFORE anything happened —
  // without it a process starts halfway through and there is nothing to change
  // from.
  const stages = [{shape: bar({stretch: 0.72, taper: 0, thickness: 0.4}), label: 'raw', heat: 0, agent: 'none'}];
  for (const step of found.slice(0, 4)) {
    stages.push({
      shape: bar({stretch: step.stretch, taper: step.taper, thickness: 0.4 - step.taper * 0.14}),
      label: step.label,
      agent: step.agent,
      heat: step.heat,
      effect: null,
    });
  }
  if (stages.length < 2) return null;

  /**
   * THE STAGE LABELS COME FROM THE VERBS AND NOWHERE ELSE.
   *
   * An earlier version let a brief's `stops` rename the last stage, on the
   * theory that an author who listed steps knew them best. But `stops` are
   * PLACES, and on a line listing the parts of a blade — the edge, the core,
   * the spine — it renamed the final state of the forging to "THE SPINE". A
   * stage label has to name what the object has BECOME; a part of it is not
   * that, and a label that is confidently wrong is worse than a plain one.
   */

  // The causal caption under each stage: what the previous agent did.
  const EFFECT = {
    heat: 'the metal softens',
    strike: 'the shape changes',
    fold: 'the layers double',
    quench: 'the edge locks hard',
    grind: 'the edge is formed',
    water: 'the mix binds',
    pressure: 'it sets',
  };
  for (const stage of stages) if (stage.agent && stage.agent !== 'none') stage.effect = EFFECT[stage.agent] ?? null;

  return {type: 'process', stages, objectLabel, accent, muted, highlight: stages.length - 1};
}

/* ── CROSS SECTION ─────────────────────────────────────────────────────── */

/**
 * THE INSIDE OF SOMETHING, AND WHAT HAPPENS IN THERE.
 *
 * The events are read from the claims because the claims ARE the mechanism: a
 * line that mentions a crack, water and a reaction is describing three linked
 * events, and they must happen in that order with each one waiting for the
 * last. A section where the fluid arrives before the crack has explained
 * nothing.
 */
export function buildCrossSection({vo, seed, accent, muted, claims = []}) {
  const fluid = claims.includes('fluid_ingress');
  const reacts = claims.includes('reaction');
  const heals = claims.includes('self_healing');
  /**
   * WATER NEEDS SOMEWHERE TO RUN, AND A SEAL NEEDS A GAP.
   *
   * Five shots came out with a fluid and no crack — droplets rendered along a
   * path that did not exist, which is to say nothing rendered at all — and the
   * episode's payoff, the line where the wall repairs itself, drew an empty
   * hatched box because `growth` is drawn ALONG the crack it is closing. That
   * is not a preference about composition. A channel is a precondition of both,
   * so a section that claims either has one.
   */
  const cracks = claims.includes('crack_propagation') || has(vo, /\bcrack|fracture|split|gap\b/i) || fluid || heals;
  const grainy = has(vo, /\b(ash|sand|aggregate|volcanic|grain|mix\w*|lime)\b/i);

  const spec = {
    type: 'crossSection',
    accent,
    muted,
    layers: [
      {label: 'surface', depth: 0.16, fill: 'solid'},
      {label: grainy ? 'aggregate' : 'body', depth: 0.56, fill: grainy ? 'aggregate' : 'hatch', focus: true},
      {label: 'base', depth: 0.28, fill: 'grain'},
    ],
    scaleNote: 'magnified',
  };

  if (cracks) {
    const jag = (i) => 0.42 + (hash01(seed, i) - 0.5) * 0.16;
    spec.crack = {
      path: [
        [0.5, 0],
        [jag(1), 0.16],
        [jag(2), 0.34],
        [jag(3), 0.52],
        [jag(4), 0.68],
        [jag(5), 0.82],
      ],
      opensAt: 4,
      opensOver: 16,
      label: 'crack',
      ...(heals ? {healsAt: 44, healsOver: 22} : {}),
    };
  }
  if (fluid) spec.fluid = {at: cracks ? 18 : 4, label: 'water'};

  /**
   * THE INCLUSIONS ARE THERE FROM THE FIRST FRAME.
   *
   * That is the whole surprise in a self-repairing material: the repair was
   * built in and looked like a flaw. Drawing them as they arrive would tell the
   * opposite story.
   */
  /**
   * AND THE LUMPS ARE ALWAYS IN THE WALL.
   *
   * Drawing them only on the lines that mention a reaction told the story
   * backwards: the whole surprise is that the repair was BUILT IN and looked
   * like a flaw, so they have to be visible before anything happens to them.
   */
  if (reacts || heals || grainy) {
    spec.inclusions = [0, 1, 2].map((i) => ({
      x: 0.3 + i * 0.22 + (hash01(seed, 30 + i) - 0.5) * 0.08,
      y: 0.34 + (hash01(seed, 60 + i) - 0.5) * 0.3,
      r: 0.018 + hash01(seed, 90 + i) * 0.012,
      reactsAt: i === 1 ? 30 : undefined,
      consumes: 0.6,
      label: i === 1 ? 'lime' : undefined,
    }));
  }
  if (heals) spec.growth = {at: 42, over: 24, label: 'sealed'};

  spec.annotations = [
    ...(cracks && !heals ? [{x: 0.5, y: 0.06, text: 'crack opens', side: 'right', at: 8}] : []),
    ...(fluid ? [{x: 0.44, y: 0.4, text: 'water enters', side: 'right', at: 22}] : []),
    ...(heals ? [{x: 0.5, y: 0.72, text: 'gap closes', side: 'right', at: 50}] : []),
  ];

  /**
   * A SECTION IN WHICH NOTHING HAPPENS IS A HATCHED BOX.
   *
   * Five shots got one: no crack, no fluid, no reaction, no inclusion — the
   * material, cut open, doing nothing. That is not a representation of the
   * line, it is a texture, and the correct answer is to hand the decision back
   * so the next candidate on the ladder gets a turn.
   */
  if (!cracks && !spec.inclusions?.length) return null;
  return spec;
}

/* ── ANATOMY FLOW ──────────────────────────────────────────────────────── */

/**
 * A BODY WITH SOMETHING MOVING THROUGH IT.
 *
 * The layout is derived from the COUNT of chambers the sentence names, not from
 * the organ it names: four chambers arrange as two pairs with a circuit through
 * both, which is what a four-chambered heart is, and two chambers arrange as
 * one pair. Nothing here knows the word "heart".
 *
 * The claims decide what is emphasised — a line about wall thickness thickens
 * the wall, a line about a delay draws the delay — because the drawing has to
 * demonstrate the sentence, not the organ in general.
 */
export function buildAnatomyFlow({vo, accent, muted, claims = []}) {
  const figure = figureIn(vo);
  const count = figure && figure >= 2 && figure <= 6 ? figure : 4;
  const pairs = Math.max(1, Math.round(count / 2));
  const thick = claims.includes('wall_thickness');

  const chambers = [];
  const valves = [];
  for (let side = 0; side < 2; side += 1) {
    for (let row = 0; row < pairs; row += 1) {
      const x = side === 0 ? 0.34 : 0.66;
      const y = 0.3 + row * 0.17;
      chambers.push({
        id: `c${side}${row}`,
        x,
        y,
        rx: row === 0 ? 0.085 : 0.105,
        ry: row === 0 ? 0.045 : 0.058,
        label: row === 0 ? 'upper' : 'lower',
        // The systemic side pushes further, so its wall is drawn thicker — but
        // only where the line is making that claim.
        wall: thick && side === 1 ? 3 : 1,
        phase: row === 0 ? 0 : 0.12,
        focus: thick && side === 1,
      });
      if (row < pairs - 1) {
        valves.push({x, y: y + 0.088, angle: side === 0 ? 0 : 0, opensAt: 0.1});
      }
    }
  }

  /**
   * THE CIRCUIT CLOSES.
   *
   * Out of one side, through the far bed, into the other side, out through the
   * near bed, back to the start. A loop that does not return is not a
   * circulation, and the validator checks that this one does.
   */
  const left = chambers[0];
  const leftLower = chambers[pairs - 1];
  const right = chambers[pairs];
  const rightLower = chambers[chambers.length - 1];
  /**
   * THE VESSELS GO ROUND THE OUTSIDE.
   *
   * The first routing cut corners across the middle of the drawing: one pipe
   * ran straight through the upper-left chamber and out through the caption,
   * which makes the organ look like a wireframe box with lines over it rather
   * than like plumbing. Blood does not travel through the wall of a chamber to
   * get to the next one.
   *
   * So each leg leaves its chamber at the edge, travels in the clear band
   * outside the organ, and arrives at the next chamber's edge — and the return
   * leg uses the lower third, which was empty in every frame of the first pass.
   */
  const vessels = [
    {
      path: [[leftLower.x - 0.06, leftLower.y + 0.03], [0.15, 0.6], [0.11, 0.36], [left.x - 0.07, left.y - 0.01]],
      charge: 'low',
      label: 'to the lungs',
    },
    {path: [[left.x, left.y - 0.05], [0.5, 0.235], [right.x, right.y - 0.05]], charge: 'high', label: 'from the lungs'},
    {path: [[right.x + 0.07, right.y + 0.01], [0.83, 0.4], [right.x + 0.07, rightLower.y - 0.02]], charge: 'high'},
    {
      path: [
        [rightLower.x + 0.04, rightLower.y + 0.05],
        [0.84, 0.7],
        [0.6, 0.78],
        [0.4, 0.78],
        [0.16, 0.7],
        [leftLower.x - 0.06, leftLower.y + 0.03],
      ],
      charge: 'high',
      label: 'to the body',
    },
  ];

  const spec = {
    type: 'anatomyFlow',
    chambers,
    valves,
    vessels,
    circuit: [0, 1, 2, 3],
    cycleFrames: 36,
    accent,
    muted,
  };
  if (claims.includes('delay')) spec.delay = {label: 'fill, then fire', fraction: 0.12};
  if (claims.includes('one_way_flow')) {
    spec.annotations = [{x: 0.34, y: 0.47, text: 'one way only', side: 'left', at: 16}];
  }
  return spec;
}

/* ── SCALE / HAULAGE ───────────────────────────────────────────────────── */

/**
 * HOW BIG, AND HOW IT MOVED.
 *
 * The figure in the sentence sizes the block against a person; the verbs decide
 * what is under it. A line that says "rolled" gets rollers, a line that says
 * "rope" gets ropes, and a line that says neither gets a block and a human and
 * nothing invented on its behalf.
 *
 * The plate says ILLUSTRATIVE and not SCHEMATIC, because for most ancient
 * haulage the arrangement is the best available hypothesis rather than the
 * record.
 */
export function buildScaleHaulage({vo, accent, muted, claims = [], anchorFigure = 0}) {
  const figure = figureIn(vo);
  const mass = /\btonnes?\b/i.test(vo) ? 'tonnes' : /\btons?\b/i.test(vo) ? 'tons' : /\bmen\b/i.test(vo) ? 'men' : '';
  const rolled = claims.includes('haulage') || has(vo, /\broll\w*|slid|haul\w*|drag\w*\b/i);
  const roped = has(vo, /\brope|capstan|pull\w*\b/i);
  const lifting = has(vo, /\blift\w*|crane|pulley\b/i);

  /**
   * AND IT REFUSES A LINE WITH NOTHING TO MOVE.
   *
   * The builders are allowed to say "not from this sentence" — the process
   * builder does — and this one never did, so it was the last thing standing
   * whenever every better drawing had declined. Its answer to a claim about
   * metallurgy was a megalith on rollers with a man drawn next to it for scale.
   *
   * A haulage drawing needs one of two things in the sentence: a MASS, which is
   * a size worth showing beside a person, or the act of MOVING one. Neither and
   * the honest answer is no drawing, which sends the line to the next candidate
   * and, if there is none, to type — where a claim with no picture belongs.
   */
  const moves = rolled || roped || lifting;
  const massive = Boolean(figure && mass);
  if (!moves && !massive) return null;

  /**
   * HOW BIG THE BLOCK IS DRAWN, AND WHY IT IS NOT A STYLE CHOICE.
   *
   * The first version picked between two sizes and put the smaller one — three
   * tenths of the frame's width, a fifteenth of its height — under a sentence
   * about eight hundred tons. Beside a figure drawn at six per cent of the
   * frame that made the block about twice a man's height, which is a large
   * crate. The shot exists to make a size FELT and it was quietly understating
   * it by a factor of five.
   *
   * So the proportions come from the object, not from a preference. A megalith
   * is a beam: Baalbek's largest is about twenty metres by four by four, and
   * the ratio that matters on screen is the one between the stone and the man
   * standing next to it. Fix the man at a human fraction of the frame, derive
   * the block's height from how many of him fit up its face, and let the length
   * follow the block's own proportion. The frame then fills itself, because a
   * thing drawn at its true size relative to a person is large.
   */
  const colossal = Math.max(figure ?? 0, anchorFigure) >= 100 || /\bcolossal|massive|megalith\b/i.test(vo);
  /**
   * The load fills the frame's WIDTH, because that is the axis a 9:16 frame
   * has to spare and a beam of stone is a horizontal object.
   */
  const objW = colossal ? 0.7 : 0.5;
  /** Length to height. Cut stone travels as a beam, not as a cube. */
  const beam = colossal ? 4.6 : 3.2;
  /**
   * Height crosses the aspect: a fraction of the frame's width is not the same
   * fraction of its height. Written out rather than folded into a constant,
   * because the frame is 1080 wide TODAY.
   */
  const aspect = 1080 / 1920;
  const objH = (objW / beam) * aspect;
  /**
   * AND THE MAN IS DERIVED FROM THE STONE, NOT THE OTHER WAY ROUND.
   *
   * He is the instrument, so his size is the reading. Setting him at a fixed
   * six per cent of the frame and then choosing a block size independently is
   * how a sentence about eight hundred tons ended up illustrated with a stone
   * twice a man's height — a large crate, drawn to the wrong scale by a factor
   * of five, in the one shot whose entire job is scale.
   */
  const mensTall = colossal ? 3.2 : 2;
  const humanHeight = Number((objH / mensTall).toFixed(4));
  const spec = {
    type: 'scaleHaulage',
    accent,
    muted,
    object: {w: objW, h: Number(objH.toFixed(4)), label: 'the block'},
    humanHeight,
    humans: /\bmen|thousand|people\b/i.test(vo) ? 3 : 1,
    rollers: rolled ? 5 : 0,
    sledge: rolled,
    ropes: roped ? 2 : 0,
    travel: rolled ? 0.14 : 0.02,
  };
  if (figure && mass) spec.figure = {value: figure, unit: mass, label: null, at: 6, over: 26};
  if (lifting) {
    spec.forces = [{x: 0, y: -0.1, angle: -90, label: 'no crane'}];
  } else if (roped || rolled) {
    spec.forces = [{x: -0.55, y: 0.3, angle: 180, label: 'pull'}];
  }
  if (claims.includes('distance')) spec.distance = {label: 'uphill'};
  return spec;
}
