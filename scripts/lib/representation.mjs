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

export const REPRESENTATIONS = ['PHOTO', 'HYBRID', 'PROCEDURAL', 'DIAGRAM', 'TYPOGRAPHY'];

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
  /\b(\d[\d,.]*|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|billion)\s+(tons?|tonnes?|miles?|kilometres?|kilometers?|metres?|meters?|feet|pounds?|people|men|women|dead|killed)\b/i;

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
    const next = (words[i + 1] ?? '').replace(/[.,]$/, '');
    if ((next === 'hundred' || next === 'thousand' || next === 'million') && value < WORD_NUMBERS[next]) {
      value *= WORD_NUMBERS[next];
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
export function chooseRepresentation({
  vo = '',
  beat,
  emphasis,
  photo = null,
  accent = '#f2b53a',
  muted = '#cfc6ae',
  seed = 'x',
  /**
   * THE REEL'S OWN DATES, so a line can borrow one.
   *
   * "It sat in a drawer for fifty years" names a duration and no date, which is
   * how people speak — the year was established two sentences earlier. Without
   * the reel's anchor the timeline has nothing to start from and the strongest
   * available representation is silently skipped.
   */
  anchorYears = [],
}) {
  const figure = figureIn(vo);
  const years = yearsIn(vo);

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
