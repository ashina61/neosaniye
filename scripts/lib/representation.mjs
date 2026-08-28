/**
 * THE REPRESENTATION DIRECTOR.
 *
 * The question this asks is the one the pipeline never asked, and it comes
 * BEFORE composition, before the camera, before a single coordinate:
 *
 *     What is the most truthful and visually effective way to show this?
 *
 * The old order was: find a picture, then design a shot around it. So a missing
 * picture was a hole, and a hole gets filled with whatever is nearest — which
 * is how a reel about a Greek shipwreck opened on a sea slug and illustrated a
 * geared bronze computer with an antique brass dial.
 *
 * The new order asks what the viewer must understand, and then works down a
 * ladder of ways to show it:
 *
 *   1. the exact real asset
 *   2. a high-confidence real alternative
 *   3. a generated visual, where a generator exists
 *   4. a procedural reconstruction, drawn in code
 *   5. a diagram, where a diagram explains better than any photograph
 *   6. designed typography
 *   7. an intentional abstract
 *
 * Rungs 4 and 5 are not consolation prizes. A gear train that actually meshes
 * is a better hero than a poor photograph of the wrong machine; a timeline of
 * fifty empty years is a better shot than a stock picture of a cupboard. The
 * choice is made on COMMUNICATION VALUE, not on what happens to be on disk.
 *
 * And the reverse holds: this must not turn everything into SVG. Where a real
 * photograph is the strongest truthful representation, it wins, and where a
 * photograph plus a drawing beats either alone, that is the answer.
 */

import {NEEDS_A_PICTURE, SERVES, contract, readSubject, semanticCheck} from './semantics.mjs';
import {buildAnatomyFlow, buildCrossSection, buildMap, buildMouldCast,
  buildTerrainSection, buildProcess, buildScaleHaulage} from './visualise.mjs';

export const REPRESENTATIONS = [
  'PHOTO',
  'HYBRID',
  'PROCEDURAL',
  'DIAGRAM',
  'TYPOGRAPHY',
  /**
   * AND THE ONE THAT ADMITS DEFEAT OUT LOUD.
   *
   * A line that needs a picture and cannot be given one used to become a title
   * card, silently, and the reel shipped looking like a design choice. It is
   * not a design choice; it is a hole, and it now says so — the way a refused
   * photograph already writes ASSET_REQUIRED rather than quietly using a worse
   * one.
   */
  'REPRESENTATION_REQUIRED',
];

/**
 * WHERE THE WORDS GO WHEN A DRAWING IS ALREADY THERE.
 *
 * A diagram occupies real estate, and the caption placement that was right for
 * a photograph puts type straight through it: "It sat in a MUSEUM drawer" was
 * set across the timeline's 1901, and "THIRTY GEARS" landed on top of the
 * count it was describing. Two things fighting for the same space is a
 * hierarchy failure whichever of them is prettier.
 *
 * So each drawing declares the band it needs and the words take what is left.
 * Fractions of frame height.
 */
export const CAPTION_ZONE = {
  /**
   * The timeline runs from a quarter of the way down to three quarters, with
   * its dates set beside it. The only clear band is ABOVE it — under it the
   * words land on the closing date, which is the one the sentence is about.
   */
  timeline: {y: 0.055, align: 'left'},
  // The count owns the top, the wheels the middle band, the words the floor.
  gearSystem: {y: 0.79, align: 'left'},
  // The orbit is centred high, so the words take the lower third.
  orbit: {y: 0.72, align: 'left'},
  // The bar and its figure sit low; the words go above them.
  measurement: {y: 0.16, align: 'left'},
  scan: {y: 0.8, align: 'left'},
  /**
   * THE FIVE NEW ONES DECLARE THEIR BANDS TOO.
   *
   * Each was laid out with a band left free for the words, and the number here
   * is that band — not a guess. A map keeps its coasts in the middle third and
   * gives the words the top; a process owns the middle and the lower third for
   * its own stage labels, so the words take the top; a section fills the middle
   * and leaves the head clear.
   */
  map: {y: 0.055, align: 'left'},
  process: {y: 0.055, align: 'left'},
  crossSection: {y: 0.06, align: 'left'},
  anatomyFlow: {y: 0.055, align: 'left'},
  scaleHaulage: {y: 0.7, align: 'left'},
  /**
   * The form stands on a ground line at two thirds, and the state label and its
   * cause take the band under it. The words go ABOVE — under them they land on
   * the sentence the drawing is already making.
   */
  mouldCast: {y: 0.07, align: 'left'},
  terrainSection: {y: 0.07, align: 'left'},
};

/** Words that say the shot is about a machine with moving parts. */
const MECHANISM = /\b(gears?|cogs?|mechanism|clockwork|movement|dials?|teeth|escapement|machine)\b/i;
/** Words that say the shot is about a span of time rather than a moment. */
const ELAPSED = /\b(years?|decades?|centuries|century|months?)\b/i;
/** Words that say the shot is about looking inside something. */
const INSIDE = /\b(x[- ]?rays?|scan\w*|radiograph\w*|inside|beneath|underneath|within)\b/i;
/** Words that say the shot is about celestial prediction. */
const CELESTIAL = /\b(eclipses?|moon|lunar|solar|sun|planets?|orbit\w*|stars?|sky|calendar)\b/i;
/** A magnitude with something it counts — the case for a measured graphic. */
const MAGNITUDE =
  /\b(\d[\d,.]*|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|billion)\s+(tons?|tonnes?|miles?|kilometres?|kilometers?|metres?|meters?|feet|pounds?|people|men|women|dead|killed|degrees|barrels?|gallons?|litres?|liters?|hours?|beats?|man-days?)\b/i;

const WORD_NUMBERS = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
  eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60,
  seventy: 70, eighty: 80, ninety: 90, hundred: 100, thousand: 1000, million: 1000000,
};

/**
 * THE FIGURE IN A LINE, as a number.
 *
 * "thirty gears" is thirty; "fourteen hundred years" is fourteen hundred, not
 * fourteen. A magnitude word following a cardinal multiplies it — which is the
 * same rule the emphasis extractor uses, for the same reason.
 */
export function figureIn(text) {
  const words = String(text ?? '').toLowerCase().match(/[\p{L}\p{N},.]+/gu) ?? [];
  for (let i = 0; i < words.length; i += 1) {
    const clean = words[i].replace(/[.,]$/, '');
    const digits = clean.replace(/,/g, '');
    let value = /^\d+$/.test(digits) ? Number(digits) : WORD_NUMBERS[clean];
    if (value === undefined) continue;
    /**
     * A SPOKEN NUMBER RUNS UNTIL IT STOPS, and this used to read the first word
     * of it and leave.
     *
     * "two hundred and sixty-two metres" returned TWO HUNDRED, so a dam whose
     * whole first fact is its height was going to be dimensioned 200 m under a
     * narration saying 262 — the same fault as the hyphen compound below it,
     * one place further along the same sentence, and the reason that comment
     * exists: a drawn figure that contradicts the line it illustrates is worse
     * than no figure, because the viewer can see both.
     *
     * So the compound is walked to its end: a scale word multiplies, an "and"
     * or a hyphen adds the remainder, and a scale word AFTER the remainder
     * multiplies the whole thing — which is how "two hundred and seventy
     * million" is said and the only way to get it right.
     */
    let k = i + 1;
    const word = (n) => (words[n] ?? '').replace(/[.,]$/, '');
    const SCALE = {hundred: 100, thousand: 1000, million: 1e6, billion: 1e9};

    if (SCALE[word(k)] !== undefined && value < SCALE[word(k)]) {
      value *= SCALE[word(k)];
      k += 1;
      if (word(k) === 'and') k += 1;
      const rest = WORD_NUMBERS[word(k)];
      if (rest !== undefined && rest < 100) {
        value += rest;
        k += 1;
        // "sixty-two" tokenises as two words, so the units may follow the tens.
        const unit = WORD_NUMBERS[word(k)];
        if (rest >= 20 && rest % 10 === 0 && unit !== undefined && unit >= 1 && unit <= 9) {
          value += unit;
          k += 1;
        }
      }
      // "two hundred and seventy MILLION" — the scale belongs to the whole run.
      const outer = SCALE[word(k)];
      if (outer !== undefined && outer > 100) value *= outer;
    } else if (value >= 20 && value <= 90 && value % 10 === 0) {
      /**
       * A HYPHENATED COMPOUND IS ONE NUMBER.
       *
       * "twenty-one miles" tokenises as "twenty" and "one", and taking the
       * first gave a map that labelled the Strait of Hormuz TWENTY MILES while
       * the narration said twenty-one.
       */
      const unit = WORD_NUMBERS[word(k)];
      if (unit !== undefined && unit >= 1 && unit <= 9) value += unit;
    }
    return value;
  }
  return null;
}

/** Every four-digit year in a line, in the order they appear. */
export function yearsIn(text) {
  return [...String(text ?? '').matchAll(/\b(1[0-9]{3}|20[0-9]{2})\b/g)].map((m) => Number(m[1]));
}

/**
 * CHOOSE THE REPRESENTATION.
 *
 * `photo` is the surviving asset for the line, if any — already through the
 * asset director's gate, so its presence means it is genuinely correct rather
 * than merely present.
 */
/**
 * THE LADDER, AFTER THE GENERALISATION BENCHMARK.
 *
 * Five unrelated subjects went through the old ladder and forty-one of their
 * forty-five lines came out as typography — not because the drawings were bad
 * but because there was no drawing for a place, a process, the inside of a
 * material, a circulation or the size of a thing, which is most of what a
 * documentary has to explain.
 *
 * The order is a preference, not a law: the rung that best communicates THIS
 * claim wins, which is why a magnitude inside a geography line can still get a
 * measurement bar and a photograph beats all of it when one exists.
 */
export const LADDER = [
  'PHOTO',
  'HYBRID',
  'PROCEDURAL_OBJECT',
  'MAP',
  'PROCESS',
  'CROSS_SECTION',
  'ANATOMY_FLOW',
  'SCALE_HAULAGE',
  'DIAGRAM',
  'TYPOGRAPHY',
];

/**
 * WHICH DRAWING BEST CARRIES THIS CLAIM.
 *
 * Scored rather than branched, because the domains overlap on purpose: a
 * sentence about rolling a stone uphill is scale AND geography, and which of
 * those the shot must show depends on what the sentence is asserting. The score
 * is the count of the line's own claims that the candidate can actually
 * demonstrate — which is the only definition of "best" that is about the
 * viewer rather than about the code.
 */
const DEMONSTRATES = {
  map: ['narrowness', 'no_alternative', 'chokepoint', 'two_shores', 'distance'],
  process: ['transformation', 'sequence', 'reaction'],
  crossSection: ['crack_propagation', 'fluid_ingress', 'reaction', 'self_healing', 'wall_thickness'],
  anatomyFlow: ['chambers', 'valves', 'one_way_flow', 'circulation', 'contraction', 'wall_thickness', 'delay'],
  scaleHaulage: ['mass', 'human_scale', 'haulage', 'distance'],
  mouldCast: ['engulf_front', 'entombment', 'decay', 'void_left', 'infill', 'sequence'],
  /**
   * A LANDFORM CAN BE BURIED AND A FRONT CAN COME DOWN IT.
   *
   * `entombment` and `engulf_front` were the mould's alone, so "a hot flow came
   * down the flank onto the town" — a claim about a landscape if there ever was
   * one — reached for a plate that draws an object through stages, and "the
   * town was buried on the flank of a volcano" reached for the one that draws a
   * human silhouette. The claims are shared; what separates them is the DOMAIN,
   * which is the whole reason the director scores rather than branches. A body
   * sealed in ash is anatomy and material and goes to the mould; a town under a
   * flow is terrain and comes here.
   */
  terrainSection: ['impoundment', 'slip_plane', 'release', 'displacement', 'overtopping', 'fluid_ingress', 'entombment', 'engulf_front'],
  measurement: ['mass', 'distance', 'narrowness'],
  timeline: ['duration'],
  gearSystem: [],
  orbit: [],
  scan: ['fluid_ingress'],
};

const SPECIFICITY = ['terrainSection', 'mouldCast', 'anatomyFlow', 'crossSection', 'process', 'map', 'scaleHaulage', 'orbit', 'gearSystem', 'timeline', 'scan', 'measurement'];

export function bestDrawing({domain = 'abstract', domains = [], claims = []}) {
  const candidates = Object.keys(DEMONSTRATES).filter((type) =>
    (SERVES[type] ?? []).some((d) => domains.includes(d)),
  );
  if (!candidates.length) return [];
  return candidates
    .map((type) => {
      const met = (DEMONSTRATES[type] ?? []).filter((c) => claims.includes(c)).length;
      /**
       * WHAT THE DRAWING IS PRIMARILY FOR BEATS WHAT IT CAN ALSO COVER.
       *
       * A section serves material, anatomy AND process, so on claim-count alone
       * it took every forging line off the process builder — a cut through a
       * blade instead of the blade being made, which is a picture of the wrong
       * question. A type whose FIRST domain is this line's first domain is the
       * one built for this job; the others are covering.
       */
      const primary = (SERVES[type] ?? [])[0] === domain ? 6 : 0;
      /**
       * AND A TIE GOES TO THE MORE SPECIFIC DRAWING.
       *
       * `measurement` serves scale, quantity and geography, so on a tie it
       * would win nearly everything — and a bar is the least explanatory thing
       * in the library.
       */
      const rank = SPECIFICITY.indexOf(type);
      return {type, met, score: met * 10 + primary - rank};
    })
    .sort((a, b) => b.score - a.score);
}

export function chooseRepresentation({
  vo = '',
  beat,
  emphasis,
  photo = null,
  accent = '#f2b53a',
  muted = '#cfc6ae',
  seed = 'x',
  /** Places the line names, when it names any. A map can draw them in order. */
  stops = [],
  /**
   * THE REEL'S OWN DATES, so a line can borrow one.
   *
   * "It sat in a drawer for fifty years" names a duration and no date, which is
   * how people speak — the year was established two sentences earlier. Without
   * the reel's anchor the timeline has nothing to start from and the strongest
   * available representation is silently skipped.
   */
  anchorYears = [],
  /**
   * THE LARGEST FIGURE THE REEL STATES ANYWHERE.
   *
   * So a drawing whose subject is a size draws the SAME size in every shot. A
   * load that shrinks between two cuts is not the same load, and an episode
   * about one block that shows two different blocks has broken the only thing
   * the viewer was tracking.
   */
  anchorFigure = 0,
}) {
  const figure = figureIn(vo);
  const years = yearsIn(vo);

  /**
   * WHAT IS THIS LINE ABOUT, AND WHAT DOES IT ASSERT?
   *
   * Read from the sentence — no episode id reaches this function and none ever
   * will. The domain decides which drawings are even eligible; the claims
   * decide which of those actually demonstrates what is being said.
   */
  const read = readSubject(vo);
  const BUILDERS = {
    map: () => buildMap({vo, seed, accent, muted, stops, claims: read.claims}),
    process: () => buildProcess({vo, accent, muted}),
    crossSection: () => buildCrossSection({vo, seed, accent, muted, claims: read.claims}),
    anatomyFlow: () => buildAnatomyFlow({vo, accent, muted, claims: read.claims}),
    scaleHaulage: () => buildScaleHaulage({vo, accent, muted, claims: read.claims, anchorFigure}),
    mouldCast: () => buildMouldCast({vo, accent, muted, claims: read.claims}),
    terrainSection: () => buildTerrainSection({vo, seed, accent, muted, claims: read.claims, stops}),
  };

  /**
   * TRY THE CANDIDATES IN ORDER AND FALL THROUGH.
   *
   * A builder is allowed to say "not from this sentence" — the process builder
   * does exactly that when the line names no transformation — and when it does,
   * the answer is the next best drawing rather than the bottom of the ladder.
   * Taking only the top candidate sent three lines straight to
   * REPRESENTATION_REQUIRED with a perfectly good second choice unexamined.
   */
  for (const drawn of bestDrawing(read)) {
    const build = BUILDERS[drawn.type];
    if (!build) continue;
    {
      const spec = build();
      /**
       * AND IT ONLY SHIPS IF IT IS A PICTURE OF THE RIGHT KIND OF THING.
       *
       * The gate the gear-heart got through. A builder can return something —
       * it always can — and the question is whether that something may stand as
       * a depiction of this claim. A refusal here falls through to the rungs
       * below rather than being drawn anyway.
       */
      const check = spec ? semanticCheck({type: drawn.type, subject: read.subject, domains: read.domains, claims: read.claims}) : {ok: false, why: 'nothing to build from'};
      if (spec && check.ok) {
        return {
          mode: photo ? 'HYBRID' : 'PROCEDURAL',
          why: `${check.why} — it demonstrates ${drawn.met || 'the claim'} of what the line asserts`,
          diagram: {...spec, ...contract({type: drawn.type, subject: read.subject, domain: check.domain, claims: read.claims})},
          semantic: {...check, subject: read.subject, domains: read.domains, claims: read.claims},
        };
      }
    }
  }

  /**
   * A MACHINE WITH A COUNT IS A GEAR TRAIN.
   *
   * The strongest case in the ladder. "Thirty gears, cut by hand, meshing" is a
   * claim about a mechanism, and no photograph of a corroded lump shows meshing
   * — the thing the sentence is actually about. Drawn, the wheels turn each
   * other and the count lands on them.
   */
  if (MECHANISM.test(vo) && figure && figure >= 3 && figure <= 400) {
    return {
      mode: photo ? 'HYBRID' : 'PROCEDURAL',
      why: `a mechanism with a count: meshing is the claim, and a photograph cannot show it`,
      diagram: {
        type: 'gearSystem',
        gears: null, // laid out by the engine helper from the count
        count: figure,
        countLabel: (emphasis || 'gears').replace(/^\d+\s*/, ''),
        rate: 18,
        accent,
        muted,
        // It is a reconstruction and it says so. A drawing presented as a
        // record is a worse lie than a wrong photograph.
        disclosure: 'schematic reconstruction · not to scale',
      },
    };
  }

  /**
   * A SPAN OF EMPTY YEARS IS A TIMELINE.
   *
   * "It sat in a museum drawer for fifty years before anyone looked inside" is
   * a sentence about a GAP, and a gap is the one thing a photograph of a drawer
   * cannot contain. Two marks and the hatched nothing between them do.
   */
  if (ELAPSED.test(vo) && (years.length >= 2 || (figure && figure >= 20 && ELAPSED.test(vo)))) {
    const start = years[0] ?? anchorYears[0] ?? null;
    /**
     * A BORROWED ANCHOR ONLY WORKS FOR A SPAN INSIDE THE STORY.
     *
     * "Fifty years in a drawer" plausibly starts at the reel's own date. "Not
     * built again for fourteen hundred years" does not — added to 1901 it
     * produced a timeline running to the year 3301, which is not a mistake a
     * viewer would forgive. So a derived end must land in the past, and the
     * span must be human enough that the anchor is credible; a claim across
     * centuries needs dates the script did not give, and gets the slate instead.
     */
    const derived = start && figure && figure < 200 ? start + figure : null;
    const end = years[1] ?? (derived && derived <= new Date().getFullYear() ? derived : null);
    if (start && end && end > start) {
      return {
        mode: photo ? 'HYBRID' : 'DIAGRAM',
        why: 'the sentence is about elapsed time, which no photograph contains',
        diagram: {
          type: 'timeline',
          events: [
            {at: start, label: String(start), note: 'recovered'},
            {at: end, label: String(end), note: 'examined'},
          ],
          gap: [start, end],
          gapLabel: `${end - start} years\nunopened`,
          accent,
          muted,
        },
      };
    }
  }

  /**
   * A PREDICTION ABOUT THE SKY IS GEOMETRY, over the real thing where we have
   * a photograph of it. The picture proves the moon; the drawing carries the
   * claim about what the machine could work out. Neither pretends to be the
   * other, which is the whole argument for a hybrid.
   */
  if (CELESTIAL.test(vo)) {
    return {
      mode: photo ? 'HYBRID' : 'DIAGRAM',
      why: 'a claim about celestial prediction — the geometry is the evidence',
      diagram: {
        type: 'orbit',
        cx: 0.5,
        cy: 0.42,
        radius: 0.3,
        label: 'predicted path',
        markAt: 0.74,
        markLabel: /eclipse/i.test(vo) ? 'eclipse' : 'alignment',
        accent,
        muted,
      },
    };
  }

  /** A magnitude with a unit wants a bar and something to measure it against. */
  if (MAGNITUDE.test(vo) && figure) {
    const unit = MAGNITUDE.exec(vo)?.[2] ?? '';
    return {
      mode: photo ? 'HYBRID' : 'DIAGRAM',
      why: 'a magnitude means more beside something than it does alone',
      diagram: {type: 'measurement', value: figure, unit, accent, muted},
    };
  }

  /** Looking inside something we have a picture of: the scan is the action. */
  if (INSIDE.test(vo) && photo) {
    return {
      mode: 'HYBRID',
      why: 'the sentence is the act of looking inside, and the bar travelling is that act',
      diagram: {type: 'scan', label: 'scan', accent, muted},
    };
  }

  if (photo) return {mode: 'PHOTO', why: 'a correct photograph exists and is the strongest representation', diagram: null};

  /**
   * THE TYPOGRAPHY FALLBACK LIMIT.
   *
   * Words can carry a claim, a number, a date or an emphasis. They cannot be a
   * picture of a place, a process, a body, a mechanism, a size or the inside of
   * a material — and being allowed to try is exactly how five episodes came out
   * as forty-one text cards while every gate said they were fine.
   *
   * So a line in one of those domains that reaches this point has NOT found a
   * representation. It says so, loudly, and the planner writes it up the way it
   * writes a refused photograph. The shot still renders — a hole in a reel is
   * not a reason to fail a render — but nobody gets to believe it was designed.
   */
  if (NEEDS_A_PICTURE.includes(read.domain)) {
    return {
      mode: 'REPRESENTATION_REQUIRED',
      why:
        `this line is about ${read.domain}${read.subject ? ` (${read.subject})` : ''} and needs a picture; ` +
        'no photograph and no drawing in the library can carry it',
      diagram: null,
      semantic: {ok: false, ...read},
      required: {
        domain: read.domain,
        subject: read.subject,
        claims: read.claims,
        wanted: (Object.entries(SERVES).find(([, d]) => d.includes(read.domain)) ?? ['a new representation'])[0],
      },
    };
  }

  /**
   * NOTHING TO SHOW AND NOTHING TO DRAW — but a fallback is not permission to
   * make a boring shot. This still returns designed typography on a lit ground
   * with a camera on it, which is what the planner builds for a refused line.
   */
  return {
    mode: 'TYPOGRAPHY',
    why: 'no correct photograph and nothing the sentence asks to be drawn — the claim is stated',
    diagram: null,
  };
}
