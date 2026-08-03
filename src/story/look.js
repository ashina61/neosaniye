/**
 * THE LOOK — one identity per video, never one identity per repo.
 *
 * ============ THE MISTAKE THIS FILE EXISTS TO PREVENT ============
 *
 * The abandoned collage line spent five rounds being told "same background,
 * same floor, same sounds" and five rounds patching the wrong layer. The cause
 * was a single line: the palette was a module-level constant. Every video the
 * repo would ever produce used the same cream, the same ink, the same gold.
 * Every bit of variety added underneath — cadence, layout, silhouettes — lived
 * INSIDE that frame. The viewer sees the frame.
 *
 * Coding the reel makes this worse, not better: six rigs drawing their own
 * props means six drawings that are byte-identical in every video unless
 * something above them varies. A rig library with a fixed look is a template
 * factory with extra steps.
 *
 * ============ WHAT VARIES, AND WHAT MUST NOT ============
 *
 * PER VIDEO: colour world, film treatment strength, the shape of the drawn
 * props, and the polarity of the choreography (which edge things enter from,
 * which side the light hangs on, which order the cards land in).
 *
 * WITHIN A VIDEO: nothing. A colour world is the video's identity; changing it
 * per scene is not variety, it is six scenes cut from six different films.
 *
 * ============ WHY DETERMINISTIC ============
 *
 * The choice comes from the topic, so the same production renders identically
 * on every run and across Remotion's parallel workers. Random would mean two
 * renders of one job disagree — and it would make a bad look unreproducible.
 */

/** FNV-1a over the topic — stable across processes and Node versions. */
function hash(value, salt = 0) {
  let h = (2166136261 ^ salt) >>> 0;
  const text = String(value || 'neosaniye').toLowerCase();
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/**
 * INDEPENDENT STREAMS FROM ONE SEED.
 *
 * Two traps here, both found by looking at real output rather than by reading
 * the code:
 *
 * 1. `>>` on a uint32 above 2^31 goes NEGATIVE, which indexed off the end of
 *    every variant list and pushed grain and scanline values outside their
 *    bands. Half of all topics silently rendered with `undefined` props.
 * 2. Shifting one FNV hash is not the same as having many random values. The
 *    low bits of a multiply depend only on the low bits of its inputs, so
 *    `stream(seed, 7)` and `stream(seed, 14)` stayed correlated — six different topics in
 *    a row all came out with the same polarity and the same frame style, which
 *    is precisely the sameness this file exists to prevent.
 *
 * So each decision draws from its own avalanched stream (murmur3's finalizer).
 */
function stream(seed, index) {
  let h = (seed ^ Math.imul(index + 1, 0x9e3779b1)) >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}

const pick = (list, value) => list[value % list.length];
/** A seeded value inside a band — jitter that is repeatable. */
const band = (value, low, high, steps = 16) => low + ((value % steps) / (steps - 1)) * (high - low);

/**
 * Colour worlds. Each family owns a mood; the accents inside a family are what
 * keeps two crime stories from looking like the same crime story.
 */
const FAMILIES = [
  {
    name: 'suç / soruşturma — soğuk kanıt masası',
    when: /\b(crime|heist|robber|murder|steal|stolen|police|detective|hijack|fraud|smuggl|prison|escape|missing|vanish|forger|con(?:man)?)/i,
    palette: {ink: '#141519', paper: '#dfe0da', paperLight: '#eceee7', paperDark: '#b9bcb2', cool: '#7fa8ad', danger: '#b3352c', white: '#fbfcf8'},
    accents: [
      {accent: '#c9a227', accentDark: '#8a6c10'},
      {accent: '#9fb6c4', accentDark: '#5d7482'},
      {accent: '#d0673a', accentDark: '#8c3d18'},
    ],
    grade: {saturate: 0.74, contrast: 1.14, sepia: 0.08, brightness: 0.93},
  },
  {
    name: 'felaket / kaza — kavrulmuş turuncu',
    when: /\b(disaster|crash|explos|collaps|burn|fire|meltdown|earthquake|eruption|flood|toxic|radiation|sink|wreck|storm|famine)/i,
    palette: {ink: '#1c1410', paper: '#efe0cd', paperLight: '#f7ecdb', paperDark: '#d3b795', cool: '#a3b5a0', danger: '#a8321f', white: '#fffaf1'},
    accents: [
      {accent: '#d98324', accentDark: '#9c5510'},
      {accent: '#e0a72e', accentDark: '#a06d0e'},
      {accent: '#c25a2b', accentDark: '#83330f'},
    ],
    grade: {saturate: 0.88, contrast: 1.12, sepia: 0.2, brightness: 0.92},
  },
  {
    name: 'bilim / uzay — mürekkep mavisi',
    when: /\b(space|nasa|rocket|orbit|planet|star|physic|chemis|science|experiment|laborator|atom|quantum|telescope|mission|satellite|computer|machine)/i,
    palette: {ink: '#0f1621', paper: '#e2e7ee', paperLight: '#f0f4f9', paperDark: '#b6c0ce', cool: '#5f9ea6', danger: '#c0453a', white: '#fbfdff'},
    accents: [
      {accent: '#c8b061', accentDark: '#8a7326'},
      {accent: '#6fa8d6', accentDark: '#33607f'},
      {accent: '#b7c9d8', accentDark: '#6b8296'},
    ],
    grade: {saturate: 0.8, contrast: 1.06, sepia: 0.04, brightness: 0.97},
  },
  {
    name: 'doğa / hayvan — yosun yeşili',
    when: /\b(animal|bird|fish|insect|whale|forest|jungle|ocean|reef|plant|tree|species|evolution|nature|desert|arctic|volcano|island)/i,
    palette: {ink: '#15190f', paper: '#e6e6d2', paperLight: '#f2f2e2', paperDark: '#c2c4a6', cool: '#7fa88a', danger: '#b0503a', white: '#fcfdf4'},
    accents: [
      {accent: '#c8a83a', accentDark: '#856f14'},
      {accent: '#8fae5c', accentDark: '#526c28'},
      {accent: '#d9a93f', accentDark: '#8c6a1a'},
    ],
    grade: {saturate: 0.9, contrast: 1.05, sepia: 0.1, brightness: 0.96},
  },
  {
    name: 'para / imparatorluk — kasa yeşili',
    when: /\b(money|bank|gold|fortune|billion|million|company|empire|market|trade|deal|sold|bought|price|debt|tax|business)/i,
    palette: {ink: '#131610', paper: '#e7e3cf', paperLight: '#f4f0dd', paperDark: '#c3bd9d', cool: '#84a598', danger: '#a83c30', white: '#fdfbf2'},
    accents: [
      {accent: '#d5a52d', accentDark: '#9b6d11'},
      {accent: '#b8923f', accentDark: '#7c5c14'},
      {accent: '#8fa25c', accentDark: '#586a24'},
    ],
    grade: {saturate: 0.84, contrast: 1.08, sepia: 0.18, brightness: 0.94},
  },
  {
    // Yedek: hiçbiri tutmazsa. Eski krem arşiv paleti birebir korunuyor —
    // geri dönüş davranışı, yeni bir görünüm değil.
    name: 'genel / tarih — krem arşiv',
    when: null,
    palette: {ink: '#171511', paper: '#efe6d3', paperLight: '#f8f1e4', paperDark: '#d7c6a9', cool: '#9fc8c6', danger: '#bc493f', white: '#fffdf7'},
    accents: [
      {accent: '#d5a52d', accentDark: '#9b6d11'},
      {accent: '#c07f3a', accentDark: '#7f4c12'},
      {accent: '#b9a86a', accentDark: '#7c6c20'},
    ],
    grade: {saturate: 0.86, contrast: 1.08, sepia: 0.16, brightness: 0.95},
  },
];

/** The drawn props change shape between videos, not just colour. */
const FRAME_STYLES = ['ornate', 'museum', 'brass'];
const GESTURES = ['foam-finger', 'flat-palm', 'stamp'];
const MASTHEADS = [
  'THE DAILY RECORD',
  'THE EVENING LEDGER',
  'THE MORNING DISPATCH',
  'THE NATIONAL HERALD',
  'THE CITY CHRONICLE',
];

/**
 * @param {string} topic  the production's topic — the identity's only input
 * @returns {object} look
 */
export function chooseLook(topic) {
  const seed = hash(topic);
  const family = FAMILIES.find((entry) => entry.when && entry.when.test(String(topic || ''))) || FAMILIES.at(-1);
  const accent = pick(family.accents, stream(seed, 3));
  const polarity = stream(seed, 7) % 2 === 0 ? 1 : -1;

  return {
    name: family.name,
    seed,
    palette: {...family.palette, ...accent},
    grade: {
      // The family sets the mood; the seed nudges it so two videos in the same
      // family are not the same photograph twice.
      saturate: +band(stream(seed, 2), family.grade.saturate - 0.06, family.grade.saturate + 0.06).toFixed(3),
      contrast: +band(stream(seed, 5), family.grade.contrast - 0.04, family.grade.contrast + 0.05).toFixed(3),
      sepia: +band(stream(seed, 9), Math.max(0, family.grade.sepia - 0.05), family.grade.sepia + 0.06).toFixed(3),
      brightness: +band(stream(seed, 11), family.grade.brightness - 0.03, family.grade.brightness + 0.03).toFixed(3),
    },
    film: {
      scanlines: true,
      grain: true,
      grunge: true,
      vignette: true,
      weave: true,
      // How hard the film treatment bites. A crime story wants a coarser gate
      // than a science story; the seed keeps it from being one fixed recipe.
      scanlineOpacity: +band(stream(seed, 4), 0.1, 0.22).toFixed(3),
      scanlinePeriod: Math.round(band(stream(seed, 6), 6, 11)),
      grainOpacity: +band(stream(seed, 8), 0.38, 0.68).toFixed(3),
      grungeOpacity: +band(stream(seed, 10), 0.1, 0.24).toFixed(3),
      vignetteStrength: +band(stream(seed, 12), 0.38, 0.6).toFixed(3),
      weavePx: Math.round(band(stream(seed, 13), 3, 7)),
      weaveScale: 1.012,
    },
    props: {
      frame: pick(FRAME_STYLES, stream(seed, 14)),
      masthead: pick(MASTHEADS, stream(seed, 15)),
      gesture: pick(GESTURES, stream(seed, 16)),
      rayCount: Math.round(band(stream(seed, 17), 18, 40)),
    },
    motion: {
      // Which edge things come from, which side the light hangs on, which way
      // the punch drifts. Same mechanic, mirrored — the reel stops feeling
      // like the same storyboard with new photographs in it.
      polarity,
      cardOrder: polarity > 0 ? [0, 1, 2] : [1, 0, 2],
      lampSide: polarity > 0 ? 0.55 : 0.42,
      punchBias: +band(stream(seed, 18), 1.45, 1.9).toFixed(2),
      pushBias: +band(stream(seed, 19), 1.08, 1.2).toFixed(3),
      portalScale: +band(stream(seed, 20), 5.6, 7.6).toFixed(2),
    },
  };
}

/**
 * A rig darkens or lifts the video's grade; it never replaces it. The fall beat
 * is more desaturated THAN THIS VIDEO, not desaturated to one fixed number —
 * otherwise every fall beat in every video is the same frame.
 */
export function applyGradeDelta(grade, delta = {}) {
  return {
    saturate: +(grade.saturate * (delta.saturate ?? 1)).toFixed(3),
    contrast: +(grade.contrast * (delta.contrast ?? 1)).toFixed(3),
    sepia: +Math.max(0, grade.sepia * (delta.sepia ?? 1)).toFixed(3),
    brightness: +(grade.brightness * (delta.brightness ?? 1)).toFixed(3),
  };
}
