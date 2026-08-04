/**
 * ROOMS ARE ASSEMBLED, NOT LISTED.
 *
 * Thirteen named sets is still a menu: a random topic falls into one of
 * thirteen rooms, and after thirteen videos you are watching reruns. The fix is
 * the same one as for colour — stop choosing and start building.
 *
 * A set here is a PLAN, not a name: a horizon height, a kind of structure and
 * how many of it, a rhythm, an aperture, a ground, a light with a position and
 * a colour, an amount of haze. The renderer can draw any combination, so the
 * space is combinatorial rather than enumerated — thousands of rooms, and the
 * one a beat gets is derived from its own line.
 *
 * Semantics still lead. A line about the sea gets water on the ground and open
 * sky whatever else is generated; a line about a bank gets a vault disc. What
 * the grammar removes is the guarantee that two sea stories look identical.
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
 * Semantic anchors. Each pins only the parts of the plan that CARRY MEANING —
 * water on the ground for the sea, a disc for a vault, trunks for a forest —
 * and leaves everything else to be generated. That is the difference between
 * "the sea" and "this particular sea".
 */
const ANCHORS = [
  {when: /\b(ocean|sea|underwater|dive|reef|submarine|drown|tide|wave|shipwreck)\w*/i, plan: {ground: 'water', structure: 'none', aperture: 'surface', horizon: 0.2}},
  {when: /\b(space|orbit|planet|cosmic|galaxy|astronaut|satellite|moon|comet)\w*/i, plan: {ground: 'limb', structure: 'none', aperture: 'sky', horizon: 0.66}},
  {when: /\b(vault|bank|deposit|bullion|strongroom|safe)\w*/i, plan: {structure: 'none', aperture: 'disc', ground: 'tiles'}},
  {when: /\b(court|trial|judge|jury|verdict|testimon|prosecut)\w*/i, plan: {structure: 'panels', ground: 'plane', aperture: 'none'}},
  {when: /\b(lab|laborator|experiment|scientist|chemical|vaccine|microscope)\w*/i, plan: {structure: 'shelves', ground: 'tiles', aperture: 'window'}},
  {when: /\b(factory|machine|engine|industr|steel|reactor|turbine|assembly)\w*/i, plan: {structure: 'girders', ground: 'plane', aperture: 'none'}},
  {when: /\b(forest|jungle|tree|wood|rainforest|canopy|swamp)\w*/i, plan: {structure: 'trunks', ground: 'plane', aperture: 'sky'}},
  {when: /\b(ruin|rubble|derelict|abandon|crumbl|wreckage|earthquake)\w*/i, plan: {structure: 'arches', ground: 'rubble', aperture: 'sky'}},
  {when: /\b(library|archive|book|ledger|record|study|office)\w*/i, plan: {structure: 'shelves', ground: 'plane', aperture: 'none'}},
  {when: /\b(city|street|store|shop|town|building|skyline|traffic)\w*/i, plan: {structure: 'blocks', ground: 'plane', aperture: 'sky'}},
  {when: /\b(gallery|museum|portrait|exhibit|painting|frame)\w*/i, plan: {structure: 'panels', ground: 'plane', aperture: 'none'}},
  {when: /\b(mountain|peak|cliff|summit|ridge|volcano)\w*/i, plan: {structure: 'peaks', ground: 'plane', aperture: 'sky'}},
  {when: /\b(desert|dune|sand|drought|wasteland)\w*/i, plan: {structure: 'none', ground: 'plane', aperture: 'sky', horizon: 0.62}},
  {when: /\b(prison|cell|bars|captive|locked|dungeon)\w*/i, plan: {structure: 'columns', ground: 'tiles', aperture: 'window'}},
];

const STRUCTURES = ['blocks', 'columns', 'shelves', 'arches', 'trunks', 'panels', 'girders', 'peaks', 'none'];
const GROUNDS = ['plane', 'planks', 'tiles', 'rubble', 'water'];
const APERTURES = ['none', 'window', 'arch', 'disc', 'sky', 'surface'];
const RHYTHMS = ['even', 'scatter', 'perspective'];

/**
 * Build the room a line is staged in.
 *
 * @param {object} input
 * @param {string} input.line   the spoken line — the strongest signal
 * @param {string} input.topic  weaker context
 * @param {number} input.seed   the video's seed, so one video's rooms are kin
 * @param {number} input.index  the beat index, so its rooms still differ
 * @returns {object} a set plan the renderer can draw directly
 */
export function planSet({line = '', topic = '', seed = 0, index = 0} = {}) {
  const local = hash(`${line}|${index}`, seed >>> 0);
  const anchor =
    ANCHORS.find((entry) => entry.when.test(String(line)))?.plan ||
    ANCHORS.find((entry) => entry.when.test(`${line} ${topic}`))?.plan ||
    {};

  const structure = anchor.structure ?? pick(STRUCTURES, stream(local, 1));
  const ground = anchor.ground ?? pick(GROUNDS, stream(local, 2));
  const aperture = anchor.aperture ?? pick(APERTURES, stream(local, 3));

  return {
    // Where the floor meets the world. Low horizons feel monumental, high ones
    // feel intimate; generated, so the framing is not one house style.
    horizon: +(anchor.horizon ?? between(stream(local, 4), 0.58, 0.84)).toFixed(3),
    structure,
    // How many of whatever it is. A row of four columns and a row of eleven are
    // different rooms even at identical everything else.
    count: structure === 'none' ? 0 : Math.round(between(stream(local, 5), 3, 12)),
    rhythm: pick(RHYTHMS, stream(local, 6)),
    /** How tall the structure stands, as a share of the frame. */
    scale: +between(stream(local, 7), 0.28, 0.78).toFixed(3),
    aperture,
    ground,
    /** The single light: where it is, how wide it throws, which colour it is. */
    light: {
      x: +between(stream(local, 8), 0.24, 0.76).toFixed(3),
      y: +between(stream(local, 9), 0.12, 0.52).toFixed(3),
      size: +between(stream(local, 10), 0.3, 0.78).toFixed(3),
      tone: pick(['accent', 'cool', 'paperLight'], stream(local, 11)),
      strength: +between(stream(local, 12), 0.22, 0.5).toFixed(3),
    },
    /** Air in the room — the thing that turns flat layers into depth. */
    haze: +between(stream(local, 13), 0.06, 0.34).toFixed(3),
    /** Deterministic variation seed for the renderer's own jitter. */
    seed: local >>> 0,
  };
}

export const SET_GRAMMAR = {STRUCTURES, GROUNDS, APERTURES, RHYTHMS};
