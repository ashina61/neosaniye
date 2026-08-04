/**
 * THE COLOUR WORLD IS BUILT, NOT PICKED.
 *
 * The first fix for "every video looks the same" was six colour families with
 * three accents each — eighteen possible worlds. That is better than one, and
 * still a menu: throw enough topics at it and you see the same eighteen looks
 * come round again, which is the same complaint one lap later.
 *
 * So the palette is now GENERATED. A hue comes off the topic, the story's own
 * words push temperature and chroma, and the nine roles are derived from that
 * hue in HSL under contrast rules. The space is continuous — two topics land on
 * the same colour world only by coincidence, not by design.
 *
 * What stays fixed is the STRUCTURE, and it has to: ink must be dark enough to
 * sit type on, paper light enough to read against it, accent saturated enough
 * to survive the film grade. Those are legibility constraints, not style.
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

/** Avalanched stream — see look.js: shifting one hash keeps decisions correlated. */
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
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

/** HSL → hex. Everything downstream is CSS, so hex is the useful form. */
export function hsl(h, s, l) {
  const hue = ((h % 360) + 360) % 360;
  const sat = clamp(s, 0, 1);
  const lig = clamp(l, 0, 1);
  const c = (1 - Math.abs(2 * lig - 1)) * sat;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = lig - c / 2;
  const [r, g, b] =
    hue < 60 ? [c, x, 0] :
    hue < 120 ? [x, c, 0] :
    hue < 180 ? [0, c, x] :
    hue < 240 ? [0, x, c] :
    hue < 300 ? [x, 0, c] : [c, 0, x];
  return `#${[r, g, b]
    .map((channel) => Math.round((channel + m) * 255).toString(16).padStart(2, '0'))
    .join('')}`;
}

/**
 * Semantic pull on the colour. These do not name colours — they push the
 * generated hue toward a region and bend saturation, so a story about ice and a
 * story about fire cannot land in the same place even on the same seed.
 */
const PULLS = [
  {when: /\b(ice|arctic|frozen|snow|winter|glacier|cold|antarctic)\w*/i, hue: 205, pull: 0.75, sat: -0.1, mood: 'soğuk'},
  {when: /\b(ocean|sea|underwater|dive|reef|submarine|river|lake|flood|whale|shark|marine|coast|harbou?r)\w*/i, hue: 190, pull: 0.7, sat: 0.05, mood: 'su'},
  {when: /\b(space|orbit|planet|cosmic|galaxy|astronaut|satellite|moon)\w*/i, hue: 224, pull: 0.72, sat: 0.0, mood: 'uzay'},
  {when: /\b(fire|burn|flame|explos|lava|volcano|furnace|blaze)\w*/i, hue: 24, pull: 0.78, sat: 0.16, mood: 'ateş'},
  {when: /\b(desert|drought|sand|dust|dry|scorch)\w*/i, hue: 38, pull: 0.7, sat: 0.08, mood: 'kurak'},
  {when: /\b(forest|jungle|tree|plant|wildlife|nature|animal|species)\w*/i, hue: 104, pull: 0.66, sat: 0.04, mood: 'doğa'},
  {when: /\b(money|gold|bank|fortune|billion|profit|empire|market)\w*/i, hue: 44, pull: 0.64, sat: 0.12, mood: 'altın'},
  {when: /\b(death|murder|plague|poison|blood|war|massacre|kill)\w*/i, hue: 356, pull: 0.6, sat: -0.06, mood: 'kan'},
  {when: /\b(crime|fraud|heist|prison|detective|forger|smuggl|secret)\w*/i, hue: 258, pull: 0.5, sat: -0.12, mood: 'suç'},
  {when: /\b(machine|factory|engine|industr|steel|reactor|computer)\w*/i, hue: 200, pull: 0.5, sat: -0.16, mood: 'sanayi'},
  {when: /\b(medic|hospital|virus|disease|laborator|experiment|vaccine)\w*/i, hue: 165, pull: 0.55, sat: -0.05, mood: 'klinik'},
];

/**
 * Build a colour world from a topic.
 *
 * @param {string} topic
 * @returns {{palette: object, mood: string, hue: number, seed: number}}
 */
export function buildPalette(topic) {
  const seed = hash(topic);
  const text = String(topic || '');

  // A free hue from the seed, then bent toward whatever the topic is about.
  const freeHue = between(stream(seed, 1), 0, 360);
  const pull = PULLS.find((entry) => entry.when.test(text));
  const hue = pull
    ? (pull.hue + (freeHue - pull.hue) * (1 - pull.pull) + 360) % 360
    : freeHue;

  // The accent sits away from the base hue; how far is itself generated, so
  // some videos are near-monochrome and others openly complementary.
  const spread = [28, 46, 150, 180, 210][stream(seed, 2) % 5];
  const direction = stream(seed, 3) % 2 ? 1 : -1;
  const accentHue = (hue + spread * direction + 360) % 360;
  const coolHue = (accentHue + 168) % 360;

  // CHROMA IS CAPPED FOR A REASON.
  //
  // Uncapped, the generator produced hot pink and neon green worlds: varied,
  // yes, but they read as "computer picked a colour" rather than as film. Real
  // stock is restrained; the identity comes from HUE and from the relationship
  // between roles, not from saturation. The band below is wide enough that two
  // topics still look unrelated and narrow enough that none of them glow.
  const chroma = clamp(between(stream(seed, 4), 0.22, 0.5) + (pull?.sat ?? 0) * 0.6, 0.12, 0.58);
  const inkLight = between(stream(seed, 5), 0.055, 0.105);
  const paperLight = between(stream(seed, 6), 0.84, 0.93);

  const palette = {
    // Ink carries a trace of the hue: a neutral black reads as "default", and
    // default is the thing this whole file exists to avoid.
    ink: hsl(hue, clamp(chroma * 0.35, 0.06, 0.3), inkLight),
    paper: hsl(hue, clamp(chroma * 0.18, 0.04, 0.2), paperLight - 0.06),
    paperLight: hsl(hue, clamp(chroma * 0.14, 0.03, 0.16), paperLight),
    paperDark: hsl(hue, clamp(chroma * 0.26, 0.05, 0.26), paperLight - 0.26),
    accent: hsl(accentHue, clamp(chroma + 0.14, 0.24, 0.62), between(stream(seed, 7), 0.44, 0.58)),
    accentDark: hsl(accentHue, clamp(chroma + 0.06, 0.2, 0.56), between(stream(seed, 8), 0.24, 0.33)),
    cool: hsl(coolHue, clamp(chroma * 0.5, 0.1, 0.34), between(stream(seed, 9), 0.46, 0.6)),
    // Danger is always legible as danger; it is a signal, not a style choice.
    danger: hsl(between(stream(seed, 10), 354, 12), 0.52, 0.44),
    white: hsl(hue, 0.06, 0.97),
  };

  return {palette, mood: pull?.mood || 'serbest', hue: Math.round(hue), seed};
}

/**
 * The grade is generated too — a cold story is not simply a warm story with a
 * different accent, it is graded differently.
 */
export function buildGrade(topic) {
  const seed = hash(topic, 77);
  const text = String(topic || '');
  const bleak = /\b(death|war|plague|famine|collaps|prison|disaster|murder|lost|failed)\w*/i.test(text);
  const bright = /\b(discover|invent|triumph|record|golden|hope|rescue|victory|breakthrough)\w*/i.test(text);

  return {
    saturate: +between(stream(seed, 1), bleak ? 0.55 : 0.74, bleak ? 0.78 : 0.98).toFixed(3),
    contrast: +between(stream(seed, 2), 1.02, 1.18).toFixed(3),
    sepia: +between(stream(seed, 3), bright ? 0.02 : 0.06, bright ? 0.14 : 0.26).toFixed(3),
    brightness: +between(stream(seed, 4), bleak ? 0.88 : 0.93, bleak ? 0.97 : 1.02).toFixed(3),
  };
}
