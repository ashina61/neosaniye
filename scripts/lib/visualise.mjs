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
  /**
   * "ACROSS THE BAY" IS A TWO-SHORE SENTENCE.
   *
   * The land–water–land layout, the swell lines and the water material were all
   * already here and the builder only reached for them when the line said
   * "north", "shores" or "narrow". Everything else got the featureless blob:
   * one grey pentagon on black, which is what "the mountain stood five miles
   * from the town, ACROSS THE BAY" shipped as, twice, and the second map in the
   * same reel was the identical polygon. A sentence that puts one place across
   * water from another has described two shores; that is what to draw.
   */
  const crossesWater = has(
    vo,
    /\bacross the (bay|sea|strait|channel|gulf|lake|river|water|harbour|harbor|sound|firth)\b|\b(opposite|far) (shore|bank|side)\b/i,
  );
  const twoSided =
    has(vo, /\b(north\w*|south\w*|both sides|either side|shores)\b/i) ||
    claims.includes('two_shores') ||
    crossesWater;
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
      /**
       * THE WATER RUNS UNDER BOTH COASTS.
       *
       * A coastline is not a ruled line — it wobbles up to a tenth of the frame
       * off its base — and the water was a rectangle inset two hundredths from
       * the same base. So wherever the coast wandered further than that, the
       * strait had a black stripe between the sea and the shore: neither land
       * nor water, in the one drawing whose whole subject is where one ends and
       * the other begins.
       *
       * The sea is drawn first and the land on top of it, so the overlap costs
       * nothing and the COASTLINE becomes the boundary — which is what a
       * coastline is.
       */
      shape: [
        [0, midY - gap / 2 - 0.15],
        [1, midY - gap / 2 - 0.15],
        [1, midY + gap / 2 + 0.15],
        [0, midY + gap / 2 + 0.15],
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
  /**
   * AND ON A TWO-SHORE MAP THE PLACES STAND ON OPPOSITE SHORES.
   *
   * Stops used to run along `midY` whatever the geography was, which on a map
   * with water down the middle is the one place they cannot be. If the sentence
   * says these two are across water from each other, then the water is between
   * them and the route CROSSES it — which is the whole claim, drawn.
   */
  const shored = (twoSided || narrow) && stops.length >= 2;
  const stopY = (i) =>
    shored
      ? i % 2 === 0
        ? midY - gap / 2 - 0.10 - Math.abs(wobble(i + 40, 0.05))
        : midY + gap / 2 + 0.10 + Math.abs(wobble(i + 40, 0.05))
      : midY + wobble(i + 40, 0.08);
  if (stops.length >= 2) {
    spec.route = [
      {
        points: stops.map((_, i) => [0.1 + (i / Math.max(1, stops.length - 1)) * 0.8, stopY(i)]),
      },
    ];
    spec.markers = stops.map((label, i) => ({
      x: 0.1 + (i / Math.max(1, stops.length - 1)) * 0.8,
      y: stopY(i),
      label,
      kind: 'place',
      /**
       * A PLACE NAME IS CONSTRUCTION, NOT AN ARRIVAL.
       *
       * These arrived from eight frames in, seven apart, so the map cut to an
       * unlabelled grey polygon and only became a place a third of the way into
       * the shot — the "featureless map" complaint, and law 30. Where the places
       * ARE is the sheet; the ROUTE between them is what the map is arguing.
       * The plate treats a marker with no `at` as set up.
       */
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
  } else if (figure && stops.length >= 2 && claims.includes('distance')) {
    /**
     * A STATED DISTANCE BETWEEN TWO NAMED PLACES IS A DISTANCE THE MAP CAN DRAW.
     *
     * The dimension used to appear only for `narrowness` — "miles across" — so
     * "the mountain stood five miles from the town" put two markers on a blank
     * landmass and drew the one number the sentence was actually about
     * nowhere. `spec.distance` already exists and the plate already renders it;
     * the builder simply never reached for it. Set under the markers rather
     * than through them, so the dimension and the route are two lines and not
     * one.
     */
    spec.distance = shored
      ? // Across the water, between the two shores: the dimension IS the claim.
        {
          from: [0.1, stopY(0)],
          to: [0.9, stopY(1)],
          label: `${figure}${unit ? ` ${unit}` : ''}`,
        }
      : {
          from: [0.1, midY + 0.11],
          to: [0.9, midY + 0.11],
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

/**
 * A bar in a unit box: eight points, so every stage tweens against every other.
 *
 * AND IT KEEPS ITS VOLUME. The first version fixed the thickness per stage and
 * clamped the length at almost the full box, so every stage after the first was
 * the same stubby wedge at the same width: a forging sequence in which working
 * the metal changed nothing about its proportions. What it delivered was an
 * object that never looked like a blade at any point in a reel about making one.
 *
 * Metal does not appear or vanish under a hammer, it MOVES: drawing a bar out
 * makes it longer and thinner, folding it makes it shorter and thicker, and
 * those two facts are the whole visual grammar of a forge. `thickness` is
 * therefore derived from `stretch` rather than set beside it — which is also
 * true of rolled glass and of anything else worked from stock, so it stays a
 * general rule rather than a fact about swords.
 */
function bar({stretch = 1, taper = 0, thickness = 0.22}) {
  const halfW = clamp(0.38 * stretch, 0.12, 0.47);
  const t = clamp(thickness / Math.max(0.2, stretch) - taper * 0.09, 0.05, 0.34) / 2;
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
  const stages = [{shape: bar({stretch: 0.72, taper: 0}), label: 'raw', heat: 0, agent: 'none'}];
  for (const step of found.slice(0, 4)) {
    stages.push({
      shape: bar({stretch: step.stretch, taper: step.taper}),
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

  /**
   * THE BANDS ARE NAMED BY THE SENTENCE, NOT BY A FIXED VOCABULARY.
   *
   * A section labelled SURFACE / AGGREGATE / BASE is the right drawing for a
   * concrete wall and the wrong caption for anything else. A line about pumice
   * falling on roofs got AGGREGATE across its focus band — a materials-science
   * word the sentence never said, over a picture of a roof under a snowfall of
   * rock. It is the same failure as an "approximately right" photograph: the
   * geometry was true and the label was making its own claim (law 32).
   *
   * So the deposit takes the name of the stuff the line says is accumulating,
   * and the top band takes the name of what it is landing on. Both fall back to
   * the generic pair, which is still correct for a material section.
   */
  const named = (re) => (String(vo).match(re)?.[1] ?? '').toLowerCase();
  const deposit = named(/\b(pumice|ash|cinders?|tephra|sand|silt|gravel|snow|dust|soot|sediment)\b/i);
  const upon = named(/\b(roofs?|streets?|decks?|floors?|fields?|pavements?)\b/i);

  const spec = {
    type: 'crossSection',
    accent,
    muted,
    layers: [
      {label: upon || 'surface', depth: 0.16, fill: 'solid'},
      {
        label: deposit || (grainy ? 'aggregate' : 'body'),
        depth: 0.56,
        fill: grainy || deposit ? 'aggregate' : 'hatch',
        focus: true,
      },
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

/**
 * A FORM LOST INSIDE A MEDIUM, AND RECOVERED AS ITS NEGATIVE.
 *
 * The stages are read off the sentence exactly the way the process builder
 * reads its verbs, and for the same reason: a line almost always names the part
 * of the mechanism it is about. "Ash sealed each body, the body decayed, and a
 * cavity was left" names three of them in order; "diggers poured plaster into
 * the cavity" names the last two.
 *
 * A LINE THAT NAMES NONE OF THEM GETS NOTHING. This builder refuses, the way
 * the process builder refuses a line with no transformation in it, because the
 * alternative is a five-stage burial diagram appearing under a sentence that
 * never mentioned one.
 */
export function buildMouldCast({vo, accent, muted, claims = []}) {
  const said = (re) => has(vo, re);
  const wants = [];
  // Order is the mechanism's order, not the sentence's: a line may mention the
  // cavity before the decay that produced it, and the drawing still has to run
  // forwards.
  if (said(/\b(stood|standing|before|was there|lived|walked)\b/i)) wants.push('form');
  if (claims.includes('engulf_front') || claims.includes('entombment')) wants.push('engulf');
  if (claims.includes('decay') || claims.includes('void_left')) wants.push('void');
  if (claims.includes('infill')) wants.push('fill');
  if (said(/\b(cast|casts|the shape of|came back|form returned|figure)\b/i) && wants.includes('fill')) {
    wants.push('cast');
  }
  if (!wants.length) return null;
  /**
   * A ONE-STAGE SHOT IS A STILL. Where the line names a single stage the
   * drawing plays it FROM the state before it, so the viewer sees the change
   * that stage IS rather than the state it leaves behind.
   */
  const ORDER = ['form', 'engulf', 'void', 'fill', 'cast'];
  if (wants.length === 1) {
    const only = ORDER.indexOf(wants[0]);
    if (only > 0) wants.unshift(ORDER[only - 1]);
  }
  const stages = ORDER.filter((s) => wants.includes(s));

  const medium = said(/\bash|pumice|tephra|silt|sediment|sand|mud|tar|ice\b/i) ? 'ash' : 'the deposit';
  const filler = said(/\bplaster\b/i) ? 'plaster' : said(/\bbronze|metal\b/i) ? 'bronze' : 'the fill';

  return {
    type: 'mouldCast',
    accent,
    muted,
    form: {label: 'the form', height: 0.26},
    medium: {label: medium, material: 'concrete'},
    filler: {label: filler},
    stages,
    captions: {
      engulf: {state: 'ENGULFED', cause: `${medium} arrives and banks up`},
      void: {state: 'VOID', cause: 'the form decays and leaves its shape'},
      fill: {state: 'FILLED', cause: `${filler} is poured into the space`},
      cast: {state: 'CAST', cause: 'the fill IS the form, in new material'},
    },
    subject: 'mouldCast',
    depicts: 'process',
  };
}

/**
 * A LANDFORM IN PROFILE, AND WHAT MOVES IN IT.
 *
 * Reads the sentence for the five things a terrain section can be about, and
 * builds only what the line actually claims. A line that names a dam gets the
 * structure; one that names a slip plane gets the plane and the slab resting on
 * it; one that says water got in gets the seepage; one that says something let
 * go gets the release; one that says the water went over gets the overtopping.
 * Nothing here knows it is in the Alps.
 *
 * THE ORDER IS THE ARGUMENT. Seepage lands before the release, the release
 * before the travel, and the overtopping last, because that is the causal chain
 * the sentence is describing and the drawing has to be able to be believed.
 */
/** A spoken volume, written the way it is said. */
function volumeLabel(n) {
  if (n >= 1e9) return `${+(n / 1e9).toFixed(2)} BILLION m³`;
  if (n >= 1e6) return `${+(n / 1e6).toFixed(0)} MILLION m³`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)} THOUSAND m³`;
  return `${n} m³`;
}

export function buildTerrainSection({vo, seed, accent, muted, claims = [], stops = []}) {
  const wobble = (i, amp = 0.04) => (hash01(seed, i) - 0.5) * amp;
  const impounds = claims.includes('impoundment') || has(vo, /\b(dams?|reservoirs?|impound\w*)\b/i);
  const plane = claims.includes('slip_plane') || has(vo, /\b(slab|clay|bed of|resting on|slip)\b/i);
  const seeps = claims.includes('fluid_ingress');
  const goes = claims.includes('release') || claims.includes('displacement');
  /**
   * CREEP IS MOVEMENT, JUST SLOW — and drawing it as stillness is a lie the
   * sentence contradicts. "The mountainside was already creeping" put a
   * perfectly static valley on screen while the narration said it was moving,
   * which is the anti-slideshow test failed at the level of meaning rather than
   * of animation. It gets a fraction of the travel, which is the claim.
   */
  const creeps = !goes && has(vo, /\bcreep\w*|\bcrept\b|\binching\b|\bslowly moving\b/i);
  const spills = claims.includes('overtopping');
  /**
   * A NUMBER IS A HEIGHT ONLY WHERE THE SENTENCE SAYS SO.
   *
   * The first version took whatever `figureIn` found and let the shape it was
   * building decide what it meant, so "the slab slid into the lake in FORTY-FIVE
   * SECONDS" put 45 MILLION m³ on the frame — a drawing inventing a fact out of
   * a unit it had not read. The unit is read off the sentence, and a figure with
   * the wrong unit for this slot is not used at all.
   */
  const figure = figureIn(vo);
  const isHeight = /\b\d*\s*(metres?|meters?|feet|foot)\s+(high|tall|deep)\b|\b(high|tall|deep)\b[^.]*\b(metres?|meters?|feet)\b|\b(metres?|meters?|feet)\s+(high|tall|deep)\b/i.test(vo);
  const isVolume = /\bcubic\s+(metres?|meters?|yards?|kilometres?|kilometers?)\b|\bm³/i.test(vo);

  /**
   * THE LANDFORM IS READ FROM THE SENTENCE, like everything else here.
   *
   * A valley that impounds water is a high shoulder, a gorge and a lower
   * shoulder. A mountain with something coming down it is a FLANK: high on one
   * side, falling to ground the town is standing on. Drawing the second story
   * on the first landform puts a volcano's flow into a reservoir it does not
   * have, which is a picture of somewhere else.
   */
  const descends = claims.includes('engulf_front') || has(vo, /\b(flanks?|mountainside|hillside|slopes?)\b/i);
  const profile = impounds
    ? [
        [0, 0.30 + wobble(1)],
        [0.16, 0.34 + wobble(2)],
        [0.34, 0.46 + wobble(3)],
        [0.46, 0.66 + wobble(4, 0.02)],
        [0.58, 0.72],
        [0.66, 0.66 + wobble(5, 0.02)],
        [0.78, 0.50 + wobble(6)],
        [1, 0.42 + wobble(7)],
      ]
    : /**
       * AND THE FLANK SITS LOW, because the words have to go somewhere.
       *
       * Drawn from a fifth of the way down, the slope and the mass on it filled
       * the frame from 12% to 72% — there was no clear band left, and moving
       * the caption only chose which part of the drawing to lay it on. A
       * section is composed WITH the type, not in spite of it: the summit is
       * off the top of the frame, which is also how you would frame it with a
       * camera, and the upper third belongs to the sentence.
       */
      [
        [0, 0.42 + wobble(1, 0.03)],
        [0.14, 0.47 + wobble(2, 0.025)],
        [0.30, 0.545 + wobble(3, 0.02)],
        [0.46, 0.60 + wobble(4, 0.018)],
        [0.62, 0.655 + wobble(5, 0.015)],
        [0.78, 0.69 + wobble(6, 0.012)],
        [1, 0.71 + wobble(7, 0.012)],
      ];

  const spec = {
    type: 'terrainSection',
    accent,
    muted,
    profile,
    /** Both landforms are composed to leave the upper third to the words. */
    captionZone: {y: 0.07, align: 'left'},
    scaleNote: 'schematic profile',
    subject: 'terrainSection',
    depicts: 'terrain',
    claims,
  };

  /**
   * THE BEDS. Two ordinary ones and, when the sentence says so, the weak one —
   * the whole reason the section exists. Without the claim there is no weak bed,
   * because a section that always draws a failure plane is asserting one.
   */
  spec.beds = plane
    ? [{label: 'rock', depth: 0.05}, {label: 'clay', depth: 0.115, weak: true}, {depth: 0.19}]
    : [{label: 'rock', depth: 0.06}, {depth: 0.13}];

  if (impounds) {
    spec.structure = {
      x: 0.72,
      base: 0.44,
      width: 0.035,
      label: 'dam',
      ...(figure && isHeight ? {height: `${figure} m`} : {}),
    };
    spec.water = {level: 0.52, label: 'reservoir'};
  }

  /**
   * THE SLAB. It sits ON the weak bed, between the shoulder and the water, and
   * it travels DOWN AND RIGHT into the basin — along the plane it was resting
   * on, because that is the claim.
   */
  /**
   * WHERE IN THE SLIDE THIS SENTENCE SITS — because the slab does not go twice.
   *
   * Four consecutive beats describe one event: the bed lets go, the slab
   * travels, the rock takes the water's place, the water goes over. Built
   * independently they each animated the slide from the top, so the reel would
   * have shown a mountain sliding into a lake THREE TIMES and called it one
   * event. Law 31 and the process-continuity rule are the same rule: the object
   * continues.
   *
   * So a sentence about a CONSEQUENCE of the release opens with the release
   * already finished — the animation began before the cut and this shot is
   * looking at the result, which is what the sentence is about.
   */
  const already = (claims.includes('displacement') || claims.includes('overtopping')) && !claims.includes('release');
  /**
   * AND THE SENTENCE THAT SAYS IT LET GO IS NOT THE SENTENCE THAT SAYS IT WENT.
   *
   * "Water soaked into the clay UNTIL THE BED LET GO" and "the slab SLID INTO
   * THE LAKE" are the cause and the event, and giving both the full travel put
   * the mountain into the reservoir twice. The first is the lurch — the moment
   * it stops being held — and the second is the travel, opening from where the
   * lurch left it.
   */
  const lets = claims.includes('release') && claims.includes('fluid_ingress');
  const travels = claims.includes('release') && !claims.includes('fluid_ingress');

  /**
   * A FRONT COMING DOWN THE FLANK.
   *
   * It starts as a compact mass high on the slope and ends as a deposit lying
   * over the ground where the town is — so the drawing says "it came down and
   * covered that", which is the sentence. Point for point, because the plate
   * interpolates between the two footprints rather than sliding one of them.
   */
  const buries = claims.includes('engulf_front') || claims.includes('entombment');
  if (buries && !plane && !impounds) {
    const ground = (x) => {
      for (let i = 1; i < profile.length; i += 1) {
        const [x1, y1] = profile[i - 1];
        const [x2, y2] = profile[i];
        if (x >= x1 && x <= x2) return y1 + ((y2 - y1) * (x - x1)) / Math.max(1e-6, x2 - x1);
      }
      return profile[profile.length - 1][1];
    };
    /**
     * A DEPOSIT LIES ON THE LAND, SO IT FOLLOWS THE LAND.
     *
     * The first version was a quadrilateral: a straight top edge and a straight
     * bottom edge across a CURVED profile. Wherever the ground dipped below
     * that straight base the deposit floated over it, and the render came back
     * with a hard black wedge between the ash and the mountain it was lying on.
     * Both edges are sampled along the profile now — the underside is the
     * ground itself, and the surface is the ground plus a thickness that grows
     * toward the toe, because a flow piles up where it stops.
     */
    const XS = [0.02, 0.2, 0.38, 0.56, 0.74, 1.02];
    const deep = 0.095;
    const lying = [
      ...XS.map((x) => [x, ground(Math.min(1, x)) - deep * (0.45 + 0.75 * x)]),
      ...[...XS].reverse().map((x) => [x, ground(Math.min(1, x)) + 0.004]),
    ];
    /**
     * And the source is the same polygon gathered into a mass at the top of the
     * slope — same points, same order, so the plate can interpolate one into
     * the other and the flow READS as the same body of ash arriving.
     */
    const src = 0.02;
    const span = 0.2;
    const gathered = [
      ...XS.map((x) => [src + x * span, ground(src + x * span) - 0.085 * (0.5 + x)]),
      ...[...XS].reverse().map((x) => [src + x * span, ground(src + x * span) + 0.004]),
    ];
    spec.mass = {
      kind: 'front',
      shape: gathered,
      becomes: lying,
      // Already lying there when the sentence is about the burial rather than
      // the arrival: law 31 across a cut, the same rule the slab obeys.
      at: claims.includes('engulf_front') ? 5 : -34,
      over: 34,
      label: 'the flow',
    };
  } else if (plane || goes || creeps) {
    spec.mass = {
      /**
       * A BODY ON THE FLANK, NOT THE FLANK ITSELF. At its first size the slab
       * was a quarter of the frame wide and, framed close, filled it — so the
       * shot read as an abstract hatched diagonal rather than as a piece of a
       * mountain with a mountain around it.
       */
      shape: [
        [0.235, 0.395],
        [0.395, 0.475],
        [0.425, 0.565],
        [0.265, 0.495],
      ],
      plane: [
        [0.16, 0.34],
        [0.30, 0.44],
        [0.42, 0.545],
        [0.50, 0.63],
      ],
      to: lets ? [0.035, 0.019] : goes ? [0.20, 0.11] : creeps ? [0.018, 0.010] : [0, 0],
      // The travel opens already begun, so it continues the lurch instead of
      // starting the mountain over at the top of the slope.
      at: already ? -26 : travels ? -5 : lets ? 30 : creeps ? 6 : 8,
      over: creeps ? 46 : travels ? 34 : lets ? 22 : 26,
      kind: 'slab',
      label: 'slab',
      /**
       * And it is printed as the sentence says it, not as a raw integer:
       * "270000000 m³" is a number nobody reads, and the narration says two
       * hundred and seventy million.
       */
      ...(figure && isVolume ? {volume: volumeLabel(figure)} : {}),
    };
  }

  /**
   * AND WHERE TO STAND. Declared by the same builder that placed the geometry,
   * so it can never point at nothing: near the slab for the sentences about the
   * slab, at the dam for the ones about the wall and the crest, wide for the
   * ones about the valley. Fourteen sections framed identically is one picture
   * shown fourteen times, whatever moves inside it.
   */
  if (spec.mass?.kind === 'front') {
    /**
     * Wide while it comes down — a flow is a thing you watch cross a distance,
     * and cropping in on it removes the distance it crosses. But a sentence
     * about the AFTERMATH is not the same shot as the sentence about the
     * arrival: it goes close on the place that is now under it, so the two
     * beats are two pictures of one landscape rather than one picture twice.
     */
    spec.focus = claims.includes('engulf_front') ? undefined : {x: 0.58, y: 0.58, scale: 1.18};
  } else if (spills) {
    // At the wall, for the thing the wall does.
    spec.focus = {x: 0.70, y: 0.46, scale: 1.46};
  } else if (isHeight) {
    spec.focus = {x: 0.68, y: 0.47, scale: 1.34};
  } else if (plane && !goes) {
    spec.focus = {x: 0.34, y: 0.47, scale: 1.30};
  } else if (travels) {
    // With the mass, close, while it travels.
    spec.focus = {x: 0.40, y: 0.53, scale: 1.44};
  } else if (already) {
    /**
     * AND WIDE FOR THE CONSEQUENCE. Close, wide, close is an edit; three
     * consecutive shots at one distance is one shot played three times, whatever
     * moves inside it. The sentence earns the pull-back: "the rock took the
     * reservoir's place" is a claim about the whole basin, so the whole basin is
     * what to show.
     */
    spec.focus = {x: 0.5, y: 0.52, scale: 1.0};
  } else if (goes) {
    spec.focus = {x: 0.45, y: 0.52, scale: 1.16};
  }

  /**
   * A PLACE BELOW THE WALL, when the sentence names one.
   *
   * The last beat of a dam story is that the water arrived somewhere with a
   * name in it. Handed to a plan-view map that beat was nine and a half seconds
   * — a fifth of the reel — of a grey polygon with a straight line and two dots
   * on it, because a map cannot draw water arriving. A section can: the town is
   * downstream of the wall, on the ground, and the water comes over and reaches
   * it. So a terrain line that names places puts the last of them below the
   * structure, and water that has left a dam is water going somewhere.
   */
  const named = stops.filter((s) => typeof s === 'string' && s.trim());
  if (named.length) {
    spec.places = [{x: 0.90, label: named[named.length - 1]}];
    /**
     * Water only goes over a wall if there is a wall. The overtopping belongs to
     * the impounded case; a flank with a town on it has nothing to overtop, and
     * drawing a spill there would be a graphic of an event the sentence never
     * described.
     */
    if (!spills && impounds) spec.overtop = {at: 6, over: 22, label: 'over the crest'};
    if (impounds) spec.focus = {x: 0.74, y: 0.5, scale: 1.22};
  }

  if (seeps && plane) spec.seepage = {at: 4, over: 18, label: 'water in the bed'};
  if (spills) spec.overtop = {at: 30, over: 20, label: 'over the crest'};

  /**
   * ONE annotation at most, and only for the thing the line is actually about.
   * A section labelled everywhere is a section nobody reads.
   */
  spec.annotations = spills
    ? [{x: 0.72, y: 0.38, text: 'over the crest', side: 'left', at: 34}]
    : seeps && plane
      ? [{x: 0.30, y: 0.455, text: 'water in the bed', side: 'right', at: 8}]
      : plane && !goes
        ? [{x: 0.34, y: 0.455, text: 'slip plane', side: 'right'}]
        : [];

  return spec;
}
