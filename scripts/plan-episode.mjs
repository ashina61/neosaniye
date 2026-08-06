#!/usr/bin/env node
/**
 * THE PLANNER — a brief in, a whole episode out.
 *
 * Until now every scene-config in this repo was laid out by hand, and it shows:
 * ten shots that each work on their own and do not add up to anything, because
 * nothing decided the RHYTHM. Hand-authoring also means every episode inherits
 * whatever the last one happened to look like, so "a different drawing every
 * video" was never going to happen while a person was picking each knob.
 *
 * So the shape of a reel is derived, not typed:
 *
 *   THE WORDS DECIDE THE SHOT.  A line with a number in it becomes a slate with
 *       that number set large. A line that lists three things becomes three
 *       pieces of paper landing. A line naming an object becomes a push into
 *       that object. The voiceover is the storyboard — the same principle the
 *       whole pipeline is built on, applied one level up.
 *
 *   THE WORDS DECIDE THE LENGTH. A scene runs as long as its line takes to
 *       speak, at a documentary rate. Nothing is padded to a round number.
 *
 *   THE EPISODE DECIDES ITS OWN LOOK. Grade, accent colour, drawn field,
 *       transition vocabulary, annotation style and caption face are all drawn
 *       from a seed made of the episode id — inside the bounds of its declared
 *       mood. Two episodes in the same mood are cousins; two moods are
 *       strangers. Nothing is picked from a menu by hand, which is the only way
 *       the tenth episode looks unlike the first.
 *
 * Written by hand: the voiceover, and one phrase per line saying what we are
 * looking at. That is the storyboard, and it is the only part a person should
 * be doing.
 *
 *   node scripts/plan-episode.mjs --episode=mansa-musa
 */
import {readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {episodeDir, parseArgs} from './lib/episode.mjs';

const FPS = 30;
const WIDTH = 1080;
const HEIGHT = 1920;
/** Words per second a documentary narrator actually reads at. */
const RATE = 2.7;

/** Deterministic stream: same episode id, same reel, forever. */
function seeded(seed) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return () => {
    h = Math.imul(h ^ (h >>> 15), h | 1) >>> 0;
    h ^= h + Math.imul(h ^ (h >>> 7), h | 61);
    return ((h ^ (h >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = (rand, list) => list[Math.floor(rand() * list.length) % list.length];
const between = (rand, [lo, hi]) => lo + rand() * (hi - lo);
const round = (n, p = 2) => Number(n.toFixed(p));

/**
 * MOODS — the bounds a look is generated INSIDE, never a look itself.
 *
 * A menu of finished palettes would give ten episodes that are one of five
 * things. Bounds give a family: every gold-heat reel is warm and bright, and no
 * two are the same warm and bright.
 */
const MOODS = {
  'gold-heat': {
    grade: {saturate: [0.74, 0.94], contrast: [1.02, 1.14], sepia: [0.22, 0.42], brightness: [1.0, 1.12]},
    accents: ['#f2b53a', '#e8a020', '#ffcf3d', '#d99326'],
    fields: ['spotlight', 'sunburst', 'wash'],
    fieldColours: [
      ['#c98a2a', '#7d4d12', '#2c1a06'],
      ['#d9a13c', '#8a5a18', '#241505'],
      ['#b87a22', '#6d420f', '#1d1204'],
    ],
    fog: [0, 0.18],
    vignette: [0.34, 0.5],
    grain: [0.3, 0.46],
  },
  'cold-noir': {
    grade: {saturate: [0.42, 0.72], contrast: [1.08, 1.24], sepia: [0.08, 0.22], brightness: [0.92, 1.06]},
    accents: ['#ffcf3d', '#e6e2d6', '#8fb6c8', '#c9a94b'],
    fields: ['spotlight', 'grid', 'wash'],
    fieldColours: [
      ['#2a3138', '#161b20', '#080a0c'],
      ['#333a3e', '#1b2024', '#0a0c0e'],
      ['#2c3340', '#171c26', '#080a0f'],
    ],
    fog: [0.2, 0.6],
    vignette: [0.4, 0.58],
    grain: [0.34, 0.5],
  },
  'green-rot': {
    grade: {saturate: [0.5, 0.78], contrast: [1.06, 1.18], sepia: [0.1, 0.26], brightness: [0.94, 1.06]},
    accents: ['#c8d94a', '#9fb83a', '#e0d089'],
    fields: ['wash', 'grid', 'spotlight'],
    fieldColours: [
      ['#3a4530', '#1f2619', '#0b0e08'],
      ['#44503a', '#242c1e', '#0d100a'],
    ],
    fog: [0.15, 0.45],
    vignette: [0.36, 0.52],
    grain: [0.32, 0.48],
  },
  'ash-grey': {
    grade: {saturate: [0.2, 0.5], contrast: [1.1, 1.26], sepia: [0.04, 0.16], brightness: [0.95, 1.08]},
    accents: ['#e8e2d4', '#b9c3c9', '#d94f3d'],
    fields: ['grid', 'wash', 'spotlight'],
    fieldColours: [
      ['#33373a', '#1c1f21', '#0a0b0c'],
      ['#3d4144', '#212426', '#0c0d0e'],
    ],
    fog: [0.25, 0.6],
    vignette: [0.4, 0.56],
    grain: [0.36, 0.52],
  },
};

const MARKS = ['underline', 'oval', 'bracket', 'box', 'strike'];
const TRANSITIONS = ['slam', 'slip', 'flare', 'rack', 'blinds'];

/**
 * WHAT THE LINE IS DOING — and therefore what gets DRAWN over it.
 *
 * This is the difference between a picture with words on it and a documentary.
 * A photograph says who and where; it cannot say "and then the money arrived".
 * So the sentence is read for its VERB, not just its subject, and the motif
 * acts the verb out: gold falling and piling up while the line is about
 * spending, a route drawing itself while it is about a journey, a count
 * climbing while it is about years. It is the only thing in the frame changing
 * on purpose, which is why the eye follows it.
 *
 * Order matters — the first match wins, so the most specific claims come first.
 * "He spent a fortune" is about money before it is about a king.
 */
const MOTIF_WORDS = [
  ['coins', /\b(gold|golden|money|wealth|wealthy|rich|riches|fortune|coins?|treasur\w*|dinars?|bullion|spent|spend|spending|paid|price|cost|gave|gift\w*|alms|crashed?)\b/i],
  ['rise', /\b(rose|rise|risen|rising|grew|grow\w*|doubl\w*|tripl\w*|soar\w*|surg\w*|increas\w*|boom\w*|climb\w*|multipl\w*|swell\w*)\b/i],
  ['route', /\b(journey|travel\w*|caravan|pilgrimage|pilgrim|road|route|marched?|crossed?|across|set out|departed|returned|miles?)\b/i],
  ['embers', /\b(fire|burn\w*|ash|ashes|collaps\w*|ruin\w*|destroy\w*|sacked?|war|siege|died|death|end\w*)\b/i],
  ['rays', /\b(king|emperor|empire|throne|crown|glory|legend\w*|holy|sacred|greatest|famous|power\w*|remembered)\b/i],
  ['tally', /\b(years?|days?|months?|centur\w*|counted?|thousands?|hundreds?|men|camels?|scholars?|people)\b/i],
];

/**
 * WHERE EACH MOTIF SITS, and how big.
 *
 * Not scattered: a pile of coins belongs on the floor of the frame, a bar
 * climbs from the lower third, rays sit behind the head, a tally goes high
 * where a caption is not. Frame-relative so the same numbers hold at any size.
 */
const MOTIF_PLACE = {
  coins: {x: 0.52, y: 0.86, size: 46, count: 22},
  rise: {x: 0.16, y: 0.82, size: 62, count: 7},
  route: {x: 0.16, y: 0.62, size: 210, count: 1},
  embers: {x: 0.5, y: 0.5, size: 40, count: 28},
  rays: {x: 0.5, y: 0.4, size: 330, count: 22},
  tally: {x: 0.12, y: 0.26, size: 92, count: 12},
};

/**
 * A motif is EARNED, not decorated on.
 *
 * Three rules, and all three exist because the first draft put one on every
 * shot and the reel turned into a screensaver:
 *
 *   THE LINE HAS TO SAY IT.   Inference off the verb, not off the topic.
 *   NEVER TWICE RUNNING.      A repeated drawing stops reading as meaning and
 *                             starts reading as a template.
 *   NEVER THREE IN A ROW.     Two decorated shots then a plain one. The plain
 *                             shot is what makes the decorated ones land — a
 *                             reel where every frame has something drawn on it
 *                             has nothing drawn on it.
 *
 * A brief overrules all three, in either direction: a named motif is used, and
 * "none" means the line is meant to be left alone.
 */
export function motifFor(line, recentMotifs, sceneType) {
  if (line.motif === 'none') return '';
  if (typeof line.motif === 'string' && line.motif) return line.motif;
  // A line that lists the places he actually passed through IS a route, and no
  // rhythm rule outranks that — the itinerary is the content of such a shot,
  // not decoration laid over it.
  if (line.stops?.length >= 2) return 'route';
  if (recentMotifs.length >= 2 && recentMotifs.every(Boolean)) return '';
  const previous = recentMotifs[recentMotifs.length - 1];
  for (const [kind, pattern] of MOTIF_WORDS) {
    if (kind === previous) continue;
    if (!fitsScene(kind, sceneType)) continue;
    if (pattern.test(line.vo)) return kind;
  }
  return '';
}

/**
 * A TYPE CARD'S MIDDLE BELONGS TO THE WORDS.
 *
 * A route arcs across the centre of the frame and a tally sits high on the
 * left; on a photograph that is composition, on a title slate it is a line
 * drawn through the title. So a slate only takes the motifs that live on the
 * floor or behind the type — and it takes a DIFFERENT one rather than none,
 * because the search simply carries on down the list.
 */
const SLATE_MOTIFS = new Set(['coins', 'rise', 'embers', 'rays']);

export function fitsScene(kind, sceneType) {
  return sceneType === 'title-slate' ? SLATE_MOTIFS.has(kind) : true;
}

/** The knobs for a chosen motif, in scene pixels. */
function motifParams(kind, {rand, from, accent, stops}) {
  if (!kind) return {};
  const place = MOTIF_PLACE[kind];
  // An itinerary lays itself out across the whole frame from its stops, so the
  // anchor and the element count below are not its business.
  if (kind === 'route' && stops?.length >= 2) {
    return {motif: kind, motifStops: stops, motifFrame: from, motifColour: accent};
  }
  return {
    motif: kind,
    motifX: Math.round(WIDTH * place.x + (rand() - 0.5) * WIDTH * 0.1),
    motifY: Math.round(HEIGHT * place.y),
    motifSize: Math.round(place.size * (0.88 + rand() * 0.3)),
    motifCount: Math.max(1, Math.round(place.count * (0.8 + rand() * 0.5))),
    motifFrame: from,
    motifColour: accent,
    motifOpacity: round(between(rand, [0.8, 1]), 2),
  };
}

/**
 * WHAT KIND OF SHOT A LINE WANTS.
 *
 * Read off the words themselves. Not clever, and it does not need to be — the
 * point is that the DECISION is derived rather than typed, so a new script gets
 * a shape without anybody laying one out.
 */
const NUMBER_WORD =
  /\b(\d[\d,.]*|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|twenty|thirty|forty|fifty|sixty|hundreds?|thousands?|millions?|billions?|dozen|decade)\b/i;

function beatOf(line, index, total) {
  // WHAT THE BRIEF SAYS WINS. Inference is for lines that did not bother to
  // say; it is not there to overrule a storyboard. An earlier version guessed
  // first and quietly threw away slate copy that had been written by hand for
  // exactly that shot.
  if (line.items) return 'list';
  if (line.artefact) return 'artefact';
  // A line that names the places he passed through is a MAP shot: the itinerary
  // needs the whole frame and the backdrop under it has to be the chart. Left
  // to the number-word rule below, "four thousand miles" would make it a title
  // card and the route would be drawn straight through the title.
  if (line.stops?.length >= 2) return 'place';
  // A line that names things to put in the frame wants a frame to put them in,
  // whatever numbers happen to be in the sentence.
  if (line.pieces?.length) return 'place';
  if (line.title) return index === 0 ? 'open' : index === total - 1 ? 'close' : 'number';

  if (index === 0) return 'open';
  if (index === total - 1) return 'close';
  if (NUMBER_WORD.test(line.vo)) return 'number';
  if ((line.vo.match(/,/g) ?? []).length >= 2) return 'list';
  return 'place';
}

const SCENE_FOR = {
  open: 'title-slate',
  close: 'title-slate',
  number: 'title-slate',
  list: 'evidence-board',
  artefact: 'portal-zoom-reveal',
  place: 'composite',
};

/** The number a slate should set large, pulled straight out of the sentence. */
function bigNumber(vo) {
  const digits = vo.match(/\b\d[\d,.]*\b/);
  if (digits) return digits[0].replace(/[.,]$/, '');
  const words = vo.match(/\b(one|two|three|four|five|six|seven|eight|nine|ten|twelve|twenty|fifty|hundred|thousand|million|billion)(\s+(hundred|thousand|million|billion))?\b/i);
  return words ? words[0].toUpperCase() : '';
}

function planScene({line, index, total, rand, look, previousTransition, recentMotifs, recentTypes}) {
  const beat = beatOf(line, index, total);
  let sceneType = SCENE_FOR[beat];
  // RHYTHM. Two of a kind running is a pair; three is a pattern, and a reel
  // that falls into one stops being edited and starts being a list.
  if (recentTypes.length >= 2 && recentTypes.every((t) => t === sceneType) && index !== total - 1) {
    sceneType = sceneType === 'composite' ? 'title-slate' : 'composite';
  }
  const words = line.vo.trim().split(/\s+/).length;
  // The scene lasts as long as the line takes to say, plus a breath either side.
  const durationInFrames = Math.max(105, Math.min(215, Math.round(((words / RATE) * FPS) + 26)));

  // Never the same arrival twice running: a repeated transition stops being a
  // choice and becomes a tic.
  const choices = look.transitions.filter((k) => k !== previousTransition);
  const transition = index === 0 ? null : {kind: pick(rand, choices), frames: 10 + Math.round(rand() * 8)};

  const id = `s${String(index + 1).padStart(2, '0')}-${(line.slug ?? beat)}`;
  const scene = {id, sceneType, voText: line.vo, durationInFrames};
  if (transition) scene.transition = transition;

  const backdrop = `assets/${id}-bg.png`;
  const motif = motifFor(line, recentMotifs, sceneType);

  if (sceneType === 'title-slate') {
    scene.assets = {background: backdrop};
    const number = beat === 'number' ? bigNumber(line.vo) : '';
    const titleFrame = 4 + Math.round(rand() * 6);
    scene.params = {
      scrim: round(between(rand, [0.36, 0.54])),
      kicker: line.kicker ?? '',
      title: (line.title ?? number ?? '').toString().toUpperCase(),
      footer: line.footer ?? '',
      titleFrame,
      titleSize: number ? 230 : 124,
      creep: round(between(rand, [1.04, 1.1]), 3),
      accent: look.accent,
      field: look.field,
      fieldColours: look.fieldColours,
      ...motifParams(motif, {rand, from: titleFrame + 8, accent: look.accent, stops: line.stops}),
    };
    /**
     * A FIGURE WORTH SAYING IS WORTH COUNTING TO.
     *
     * Only above ten: counting to three is a stutter, not a sum. And only when
     * the number is the point of the card — a date counting up from zero would
     * be nonsense, so a four-digit year is left where it is.
     */
    const digits = Number(String(number).replace(/[^\d]/g, ''));
    const isYear = /^(1[0-9]{3}|20[0-9]{2})$/.test(String(number).replace(/[^\d]/g, ''));
    if (number && digits >= 10 && !isYear) {
      scene.params.countTo = digits;
      scene.params.countOver = Math.round(durationInFrames * 0.55);
      if (line.countSuffix) scene.params.countSuffix = line.countSuffix;
    }
    if (rand() > 0.45) {
      Object.assign(scene.params, {
        mark: look.mark,
        markX: 260,
        markY: number ? 820 : 1160,
        markWidth: 560,
        markHeight: number ? 300 : 96,
        markFrame: Math.round(durationInFrames * 0.34),
      });
    }
  } else if (sceneType === 'evidence-board') {
    scene.assets = {background: backdrop};
    const items = (line.items ?? []).slice(0, 3);
    scene.params = {
      bgScale: round(between(rand, [1.05, 1.12]), 3),
      scrim: round(between(rand, [0.18, 0.32])),
      focusPx: Math.round(between(rand, [6, 11])),
      itemWidth: 520 + Math.round(rand() * 60),
      itemFrames: items.map((_, i) => 10 + i * (36 + Math.round(rand() * 14))),
      items,
      caption: line.caption ?? [],
      captionX: 84,
      captionY: 190 + Math.round(rand() * 60),
      captionFrame: 6,
      captionSize: 82 + Math.round(rand() * 10),
      captionRecedeAt: Math.round(durationInFrames * 0.45),
    };
  } else if (sceneType === 'portal-zoom-reveal') {
    scene.assets = {wall: backdrop, photo: `assets/${id}-photo.png`};
    const push = Math.round(durationInFrames * 0.36);
    scene.params = {
      frameWidth: 700 + Math.round(rand() * 140),
      frameRatio: round(between(rand, [0.9, 1.3]), 2),
      pushEndFrame: push,
      detachFrame: push + 22,
      throughEndFrame: push + 44,
      weldRatio: round(between(rand, [0.34, 0.44]), 3),
      wallScaleEnd: round(between(rand, [5, 7]), 1),
      accent: look.accent,
      // AFTER the arrival. The first half of this shot is the flight into the
      // picture; the second half is a photograph sitting still, and that is the
      // half a portrait wants gold falling past it.
      ...motifParams(motif, {rand, from: push + 50, accent: look.accent, stops: line.stops}),
    };
  } else {
    // COMPOSITE — the stack. Pieces are optional, so a piece that fails to draw
    // costs this shot some depth and never costs the reel.
    scene.assets = {ground: backdrop};
    const pieces = (line.pieces ?? []).slice(0, 3);
    scene.layers = [{role: 'ground', depth: round(between(rand, [0.04, 0.12]), 2), anchor: 'fill'}];
    /**
     * PLACEMENT FOLLOWS DEPTH. It is not random.
     *
     * The first version scattered pieces with rand(): a near piece could come
     * out small and high in the frame while a far one loomed large, so every
     * layer contradicted the depth it had been given and the shot read as
     * accidental — things standing about, rather than a place seen from
     * somewhere. Three rules fix it, and they are just what perspective and air
     * already do:
     *
     *   NEARER IS BIGGER   size rises with depth
     *   NEARER IS LOWER    its feet sit further down the frame, because the
     *                      ground plane falls away toward the horizon
     *   FURTHER IS FAINTER aerial perspective — distance washes contrast out
     *
     * And they alternate outward from the centre, so near pieces frame the
     * edges and nothing parks itself where the caption goes.
     */
    pieces.forEach((piece, i) => {
      const role = piece.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
      scene.assets[`?${role}`] = `assets/${role}.png`;
      const depth = round(0.26 + (i / Math.max(1, pieces.length - 1 || 1)) * 0.58, 2);
      const jitter = (span) => Math.round((rand() - 0.5) * span);
      const side = i % 2 === 0 ? -1 : 1;

      scene.layers.push({
        role,
        depth,
        anchor: 'bottom',
        // Clamped: a near piece cropped by the frame edge is good framing, a
        // near piece whose CENTRE is off-frame is just a sliver.
        x: Math.min(WIDTH - 150, Math.max(150, Math.round(WIDTH / 2 + side * (140 + depth * 420) + jitter(60)))),
        y: Math.round(1150 + depth * 620 + jitter(50)),
        height: Math.round(320 + depth * 760 + jitter(70)),
        opacity: round(0.5 + depth * 0.5, 2),
        ...(depth > 0.7
          ? {shadow: true, shadowSkew: -(44 + Math.round(rand() * 26)), shadowOpacity: 0.34}
          : {}),
      });
    });
    scene.params = {
      anchorX: Math.round(WIDTH * 0.5),
      anchorY: 1700,
      pushTo: round(between(rand, [1.22, 1.5]), 2),
      pushEndFrame: Math.round(durationInFrames * 0.86),
      focusPx: rand() > 0.5 ? Math.round(between(rand, [8, 16])) : 0,
      fog: round(between(rand, look.fog), 2),
      caption: line.caption ?? [],
      captionX: 84,
      captionY: Math.round(between(rand, [320, 1100])),
      captionFrame: 10,
      captionEvery: 16 + Math.round(rand() * 10),
      captionSize: 82 + Math.round(rand() * 12),
      captionRecedeAt: Math.round(durationInFrames * 0.72),
      accent: look.accent,
      ...motifParams(motif, {rand, from: 18 + Math.round(rand() * 14), accent: look.accent, stops: line.stops}),
    };
    if (line.accentLine !== undefined) scene.params.captionAccent = line.accentLine;
  }

  if (line.onScreen) {
    scene.onScreenText = [
      {
        text: line.onScreen,
        atFrame: Math.round(durationInFrames * 0.6),
        durationInFrames: Math.round(durationInFrames * 0.32),
        style: look.textStyle,
        position: 'bottom',
      },
    ];
  }

  return {
    scene,
    motif,
    backdropPrompt: line.image,
    photoPrompt: line.artefact,
    backdropCommons: line.imageCommons,
    photoCommons: line.artefactCommons,
    pieces: line.pieces ?? [],
  };
}

async function main() {
  const args = parseArgs();
  const episodeId = typeof args.episode === 'string' ? args.episode : null;
  if (!episodeId) {
    console.error('Usage: node scripts/plan-episode.mjs --episode=<episode-id>');
    process.exit(1);
  }

  const dir = episodeDir(episodeId);
  const brief = JSON.parse(await readFile(path.join(dir, 'brief.json'), 'utf8'));
  const rand = seeded(`${episodeId}::${brief.mood ?? 'cold-noir'}`);
  const mood = MOODS[brief.mood] ?? MOODS['cold-noir'];

  // THE EPISODE'S OWN LOOK, generated inside its mood.
  const look = {
    accent: pick(rand, mood.accents),
    field: pick(rand, mood.fields),
    fieldColours: pick(rand, mood.fieldColours),
    mark: pick(rand, MARKS),
    textStyle: pick(rand, ['serif-italic', 'sticker', 'typed']),
    fog: mood.fog,
    // Three of the five arrivals, so one reel favours slam and blinds while the
    // next lives on flares and rack focus.
    transitions: [...TRANSITIONS].sort(() => rand() - 0.5).slice(0, 3),
  };

  const grade = {
    saturate: round(between(rand, mood.grade.saturate)),
    contrast: round(between(rand, mood.grade.contrast)),
    sepia: round(between(rand, mood.grade.sepia)),
    brightness: round(between(rand, mood.grade.brightness)),
  };

  const planned = [];
  let previousTransition = null;
  brief.lines.forEach((line, index) => {
    const result = planScene({
      line,
      index,
      total: brief.lines.length,
      rand,
      look,
      previousTransition,
      recentMotifs: planned.slice(-2).map((p) => p.motif),
      recentTypes: planned.slice(-2).map((p) => p.scene.sceneType),
    });
    previousTransition = result.scene.transition?.kind ?? null;
    planned.push(result);
  });

  const config = {
    id: episodeId,
    title: brief.title,
    fps: FPS,
    width: WIDTH,
    height: HEIGHT,
    look: {
      posterizeFps: pick(rand, [12, 12, 12, 15]),
      grade,
      film: {
        grain: true,
        grunge: true,
        scanlines: true,
        vignette: true,
        gateWeave: true,
        grainOpacity: round(between(rand, mood.grain)),
        grungeOpacity: round(between(rand, [0.1, 0.2])),
        scanlineOpacity: round(between(rand, [0.06, 0.16])),
        scanlinePeriod: 8 + Math.round(rand() * 3),
        vignetteStrength: round(between(rand, mood.vignette)),
        weavePx: 4 + Math.round(rand() * 3),
        weaveScale: round(1.01 + rand() * 0.008, 3),
      },
    },
    scenes: planned.map((p) => p.scene),
  };

  // RECIPES. Backdrops and artefacts are photographs; pieces are cut-outs and
  // therefore optional in the config above.
  const assets = {};
  for (const {scene, backdropPrompt, photoPrompt, backdropCommons, photoCommons, pieces} of planned) {
    // `commons` names a REAL thing and is tried first; `prompt` is what draws it
    // when nothing free and large enough exists. A named artefact is always
    // better fetched than invented.
    if (backdropPrompt || backdropCommons) {
      assets[`${scene.id}-bg.png`] = {
        kind: 'backdrop',
        ...(backdropCommons ? {commons: backdropCommons} : {}),
        ...(backdropPrompt ? {prompt: backdropPrompt} : {}),
      };
    }
    if (photoPrompt || photoCommons) {
      assets[`${scene.id}-photo.png`] = {
        kind: 'photo',
        ...(photoCommons ? {commons: photoCommons} : {}),
        ...(photoPrompt ? {prompt: photoPrompt} : {}),
      };
    }
    for (const piece of pieces) {
      const name = `${piece.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`;
      if (!assets[name]) {
        assets[name] = {
          kind: 'piece',
          // Singular, because "a row of X" makes the model draw a SCENE, and a
          // scene has no backdrop to key away.
          prompt: `one single ${piece}, whole object in frame, dark silhouette, on a plain white background`,
        };
      }
    }
  }

  const recipes = {
    $comment: 'GENERATED by scripts/plan-episode.mjs from brief.json. Edit the brief, re-plan.',
    style: brief.style,
    styleAlpha: 'sharp studio photograph, even soft lighting, plain background',
    negative: brief.negative ?? 'text, letters, words, watermark, logo, cartoon, cgi, duplicate',
    kinds: {
      backdrop: {width: 1080, height: 1920, alpha: false},
      photo: {width: 900, height: 1170, alpha: false},
      piece: {width: 1400, height: 900, alpha: true},
      overlay: {width: 1080, height: 1080, alpha: false, overlay: true},
    },
    assets,
  };

  await writeFile(path.join(dir, 'scene-config.json'), `${JSON.stringify(config, null, 2)}\n`, 'utf8');
  await writeFile(path.join(dir, 'assets.json'), `${JSON.stringify(recipes, null, 2)}\n`, 'utf8');

  const frames = config.scenes.reduce((total, s) => total + s.durationInFrames, 0);
  console.log(`✓ planned ${episodeId}: ${config.scenes.length} scenes, ${frames} frames (${(frames / FPS).toFixed(1)}s)`);
  console.log(`  look   accent ${look.accent} · field ${look.field} · mark ${look.mark} · text ${look.textStyle}`);
  console.log(`  grade  ${JSON.stringify(grade)}`);
  console.log(`  cuts   ${look.transitions.join(', ')}`);
  console.log(`  types  ${config.scenes.map((s) => s.sceneType).join(' → ')}`);
  console.log(`  drawn  ${planned.map((p) => p.motif || '·').join(' ')}`);
  console.log(`  assets ${Object.keys(assets).length} recipes`);
}

// Only when run as a command; the tests import the rhythm rules from here.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error?.stack || error?.message || error);
    process.exit(1);
  });
}
