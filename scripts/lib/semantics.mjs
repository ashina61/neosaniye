/**
 * THE SEMANTIC CONTRACT — what a drawing claims to be of, and whether it may.
 *
 * The most expensive thing this repo ever drew was correct in every measurable
 * way. Given "four chambers, four valves, and every valve in the mechanism
 * opens one way only", the representation director matched the word
 * *mechanism* against the figure four and emitted a train of meshing gears as
 * a SCHEMATIC RECONSTRUCTION of a human heart. The wheels meshed. The teeth
 * did not slide. Every gate passed. It was a lie, and the reason nothing caught
 * it is that the hard semantic gate guarded PHOTOGRAPHS only — a procedural
 * visual went from a keyword match to the screen with nothing in between
 * asking whether it depicted the subject.
 *
 * A drawing presented as a record of a thing it is not is worse than a wrong
 * photograph, because the viewer cannot check it. So:
 *
 *   EVERY DRAWN REPRESENTATION DECLARES A SUBJECT AND ITS CLAIMS,
 *   AND SOMETHING REFUSES THE PAIRS THAT DO NOT BELONG TOGETHER.
 *
 * The refusal is not a list of forbidden episodes. It is a DOMAIN: what kind of
 * thing the sentence is about, read from the sentence, and what kinds of thing
 * each representation is able to depict. Anatomy is not mechanism. Geography is
 * not quantity. A gear train can only ever be a picture of a mechanism, and it
 * does not matter which episode asked for it.
 */

/**
 * THE DOMAINS.
 *
 * Deliberately few and deliberately about the KIND of claim rather than the
 * topic: "geography" covers a strait, a border and a trade route because all
 * three are claims about where things are relative to each other, and one
 * drawing serves all three.
 */
export const DOMAINS = [
  'anatomy',
  'geography',
  'process',
  'material',
  'scale',
  'mechanism',
  'elapsed',
  'celestial',
  'quantity',
  'abstract',
  'terrain',
];

/**
 * WHAT EACH REPRESENTATION IS ABLE TO BE A PICTURE OF.
 *
 * Read it as: a drawing of this type is a truthful depiction of a claim in one
 * of these domains, and of nothing else. The gate is this table.
 */
export const SERVES = {
  map: ['geography'],
  process: ['process', 'material'],
  crossSection: ['material', 'anatomy', 'process'],
  anatomyFlow: ['anatomy'],
  /**
   * A HAULAGE DRAWING IS ABOUT SIZE, AND ONLY ABOUT SIZE.
   *
   * It used to serve `process` as well, on the reasoning that hauling is a
   * process. It is — but the domain does not say WHICH process, and a reel
   * about swordsmithing is `process` from end to end. "A sword that is hard the
   * whole way through is a sword that snaps" went to the process builder, which
   * correctly refused it (nothing is being transformed), fell through to
   * haulage, and was delivered as a stone block on rollers behind a hatched
   * road, under a plate reading METHOD UNCERTAIN.
   *
   * Whether a process is a haulage is a question about the CLAIM, not the
   * domain, and the builder answers it.
   */
  scaleHaulage: ['scale'],
  /**
   * A MOULD IS ABOUT A PROCESS AND ABOUT A MATERIAL, AND IT IS ABOUT NEITHER
   * ANATOMY NOR GEOGRAPHY.
   *
   * The line that raised this — a body sealed in ash, decaying, leaving a
   * cavity — reads as `anatomy` on the word "body", and anatomy's drawing is a
   * circuit of chambers. It produced four heart chambers labelled UPPER and
   * LOWER over a sentence about a corpse in a volcanic deposit. Declaring
   * anatomy here would let that back in through the front door: what is being
   * depicted is not the body, it is what HAPPENED TO the space it occupied.
   */
  terrainSection: ['terrain', 'geography'],
  mouldCast: ['process', 'material'],
  gearSystem: ['mechanism'],
  timeline: ['elapsed'],
  measurement: ['scale', 'quantity', 'geography'],
  orbit: ['celestial'],
  scan: ['material', 'anatomy'],
  /**
   * AND TYPOGRAPHY IS NOT A UNIVERSAL DONOR.
   *
   * Words can carry a claim, a number, a date or an emphasis. They cannot be a
   * picture of a place, a process, a body, a mechanism or a size — and letting
   * them try is precisely how five episodes came out as forty-one text cards.
   * This row is the whole of the typography fallback limit.
   */
  typography: ['abstract', 'quantity', 'elapsed'],
  photo: [...DOMAINS],
};

/**
 * WHAT A SENTENCE IS ABOUT, read from the sentence.
 *
 * Not from an episode id, not from a file name, and not from anything the
 * writer had to remember to declare. The words in the line are the evidence,
 * which is the same evidence a person would use.
 *
 * Ordered by specificity: a sentence about blood moving through a heart is
 * anatomy even though it also contains a number, because the number is not
 * what the shot has to show.
 */
const SIGNALS = [
  [
    'anatomy',
    /\b(heart|cardiac|chamber|chambers|atrium|atria|ventricle|ventricles|valves?|artery|arteries|vein|veins|blood|lungs?|pulmonary|circulat\w*|muscle|tissue|organ|nerve|kidney|liver|brain|cell|cells|body|torso|chest|beats?|beating|pulse)\b/i,
  ],
  /**
   * THE LAND FROM THE SIDE, not the land from above.
   *
   * `geography` is a plan: where things are relative to each other. A slope
   * that fails, a reservoir that overtops, a glacier on its bed and a cliff
   * that retreats are all events in ELEVATION, and reading them as plan-view
   * geography sends them to a map that cannot draw a water level, let alone
   * water going over something. Placed above geography because a sentence that
   * says "slope" and "valley" in one breath is about the slope.
   */
  [
    'terrain',
    /\b(landslides?|rockslides?|slip|slippage|slope|slopes?|hillside|mountainside|flank|scarp|escarpment|slump\w*|rockfall|avalanche|collaps\w*|subsid\w*|sinkhole|dams?|reservoirs?|impound\w*|spillway|crest|overtop\w*|glaciers?|moraine|cliffs?|erod\w*|erosion|bedrock|strata|seabed|lakebed|valley floor|gorge|ravine|slabs?|clay|shale|marl|creep\w*|talus|scree)\b|\bslid (?:in|into|down)\b|\bslides? (?:in|into|down)\b/i,
  ],
  [
    'geography',
    /\b(strait|straits|coast|coastline|shore|shores|sea|ocean|gulf|bay|channel|island|peninsula|border|frontier|territory|region|province|harbour|harbor|port|route|lanes?|passage|mountains?|river|delta|desert|continent|northern|southern|uphill|downhill|miles?|kilometres?|kilometers?|way around|map|valleys?|towns?|villages?|cit(?:y|ies))\b/i,
  ],
  [
    'process',
    /\b(forge[ds]?|forging|smith|anvil|billet|blade|sword|hammer\w*|fold\w*|quench\w*|temper\w*|smelt\w*|cast|casting|weld\w*|anneal\w*|carve[ds]?|mix\w*|mixed|pour\w*|poured|cure[ds]?|curing|bake[ds]?|brew\w*|distil\w*|grind\w*|polish\w*|assembl\w*|layers?|step by step|heated|heating|cool\w*|blown|dried|drying|melt\w*|harden\w*|batch|buri\w*|burial|entomb\w*|engulf\w*|decay\w*|decompos\w*)\b/i,
  ],
  [
    'material',
    /\b(crack\w*|fracture\w*|crystal\w*|recrystallis\w*|recrystalliz\w*|lime|concrete|cement|mortar|corro\w*|rust\w*|dissolv\w*|react\w*|seal\w*|pore|porous|grain|alloy|carbon|steel|iron|molecul\w*|chemical|mineral|ash|ashes|pumice|tephra|sediment|silt|plaster|inside the|within the)\b/i,
  ],
  [
    'scale',
    /\b(tons?|tonnes?|weigh\w*|heav\w*|lift\w*|haul\w*|drag\w*|roll(?:ed|ing|ers?)?|sledge|ramp|crane|pulley|ropes?|capstans?|blocks?|megalith|colossal|massive|the size of|man-days?|slid|level)\b/i,
  ],
  ['mechanism', /\b(gears?|cogs?|clockwork|escapement|toothed|meshing|geartrain|dials?)\b/i],
  ['celestial', /\b(eclipses?|moon|lunar|solar|planets?|orbit\w*|stars?|constellation)\b/i],
  ['elapsed', /\b(years?|decades?|centuries|century|months?|generations?)\b/i],
  ['quantity', /\b(\d[\d,.]*|hundred|thousand|million|billion|dozen)\b/i],
];

/**
 * SUBJECTS, so a report can say what the drawing was supposed to be of.
 *
 * A slug, derived the same way — the noun the domain hangs on. Used by the
 * validator's message and by the tests, never for selection.
 */
const SUBJECTS = [
  ['humanHeart', /\b(heart|cardiac|atrium|ventricle)\b/i],
  ['circulation', /\b(blood|circulat\w*|pulmonary)\b/i],
  ['strait', /\b(strait|channel|passage)\b/i],
  ['coastline', /\b(coast|shore|peninsula|island)\b/i],
  ['tradeRoute', /\b(route|lanes?|shipping|convoy|tanker)\b/i],
  ['swordMaking', /\b(sword|blade|smith|forge|forging)\b/i],
  /**
   * A SUBJECT IS A THING, NOT A MATERIAL IT IS MADE OF.
   *
   * "Two hundred and sixty-two metres of concrete closed a gorge" was read as
   * romanConcrete, which would let a Roman-harbour section stand in for an
   * Alpine dam — the same error as a Roman lamp playing five different
   * civilisations (law 40), reached from the other direction. Roman concrete is
   * a subject when the sentence is ABOUT the Roman material; a modern structure
   * that happens to be concrete is not.
   */
  ['romanConcrete', /\b(roman concrete|pozzolan\w*|opus caementicium)\b|\b(concrete|cement|mortar|lime)\b(?=[^.]*\b(roman|antiquity|ancient|seawater|marine)\b)/i],
  ['terrainSection', /\b(landslides?|slip plane|slope failure|reservoirs?|dams?)\b/i],
  ['megalith', /\b(megalith|block|blocks|stone|stones|trilithon)\b/i],
  ['mechanism', /\b(gears?|cogs?|clockwork|escapement)\b/i],
  ['mouldCast', /\b(cavit\w*|plaster cast|entomb\w*)\b/i],
];

/**
 * WHAT KIND OF THING EACH SUBJECT IS.
 *
 * The table the config-level gate runs on, and the reason it can be strict. A
 * heart is anatomy in every sentence anybody will ever write; a strait is
 * geography in all of them. So "this drawing says its subject is a human heart
 * and it is a gear train" is decidable from the file alone, with no need to
 * re-read the line — which matters, because the line a shot carries is a
 * FRAGMENT of the sentence the drawing was chosen for.
 */
export const SUBJECT_DOMAIN = {
  mouldCast: 'process',
  humanHeart: 'anatomy',
  circulation: 'anatomy',
  strait: 'geography',
  coastline: 'geography',
  tradeRoute: 'geography',
  swordMaking: 'process',
  romanConcrete: 'material',
  megalith: 'scale',
  mechanism: 'mechanism',
  terrainSection: 'terrain',
};

/** Everything the line asks the picture to demonstrate. */
const CLAIMS = [
  ['chambers', /\b(chambers?|atri\w+|ventricl\w+)\b/i],
  ['valves', /\b(valves?)\b/i],
  ['one_way_flow', /\b(one way|single direction|opens? (?:in )?one)\b/i],
  ['circulation', /\b(circulat\w*|round the body|to the lungs|everywhere else)\b/i],
  ['contraction', /\b(squeez\w*|contract\w*|beats?|pump\w*|fires?)\b/i],
  ['wall_thickness', /\b(thick\w*|wall)\b/i],
  ['delay', /\b(delay|tenth of a second|later)\b/i],
  ['narrowness', /\b(narrow\w*|wide|width|miles across)\b/i],
  ['no_alternative', /\b(no way around|only|one door|no substitute)\b/i],
  ['chokepoint', /\b(closes?|blocks?|aground|grounded|shut)\b/i],
  ['two_shores', /\b(north\w*|south\w*|shore|both sides)\b/i],
  ['transformation', /\b(becomes?|turns? into|forged|folded|quench\w*|heated|cooled)\b/i],
  ['sequence', /\b(then|first|next|again|each|step)\b/i],
  ['crack_propagation', /\b(crack\w*|fracture\w*|split)\b/i],
  ['fluid_ingress', /\b(water|seawater|fluid|runs? down|enters?|reaches)\b/i],
  ['reaction', /\b(react\w*|dissolv\w*|recrystallis\w*|recrystalliz\w*|forms?)\b/i],
  ['self_healing', /\b(seals?|heals?|repairs?|closes? (?:it|the gap))\b/i],
  ['mass', /\b(tons?|tonnes?|weigh\w*)\b/i],
  ['human_scale', /\b(men|people|hands?|crane|no crane)\b/i],
  /**
   * `slid` IS NOT HAULAGE.
   *
   * It was in this list because a megalith slides on rollers. A mountain also
   * slides, and it does it with no rope, no sledge and nobody pulling — so a
   * landslide came out claiming haulage and would have been drawn as a crew
   * dragging a block. Haulage needs the APPARATUS in the sentence; sliding on
   * its own is just a thing moving.
   */
  ['haulage', /\b(roll\w*|haul\w*|drag\w*|sledge|rope|capstan)\b/i],
  ['distance', /\b(miles?|kilometres?|kilometers?|metres?|meters?|feet|uphill)\b/i],
  ['duration', /\b(years?|months?|decades?|centuries|hours?|days?)\b/i],
  /**
   * ENGULFMENT AND RECOVERY BY NEGATIVE SPACE.
   *
   * Deliberately narrow. `seal` and `dissolve` already belong to the section's
   * chemistry — "the lime dissolves, recrystallises across the gap, and seals
   * it" is a reaction inside a material, not a burial — so sealing counts here
   * only when something is sealed IN or UNDER or a body is sealed, and decay
   * excludes dissolution. Widening any of these takes lines off the drawing
   * that was built for them.
   */
  ['engulf_front', /\b(current|surge|swept|rushed|raced|poured down|flowed?|flowing|rolled over)\b/i],
  ['entombment', /\b(buri\w*|engulf\w*|entomb\w*|swallow\w*)\b|\bseal\w*\s+(?:each|every|the body|them|her|him|in|under)\b/i],
  ['decay', /\b(decay\w*|decompos\w*|rots?|rotted|rotting|vanish\w*|left nothing)\b/i],
  ['void_left', /\b(cavit\w*|hollows?|voids?|impressions?|empty space|the space (?:it|they|he|she) left)\b/i],
  ['infill', /\b(plaster|infill|poured in)\b|\bfilled? (?:in|with)\b|\bpour\w*\b[^.]*\binto the (?:cavity|cavities|void|hollow|space|mould|mold|impression)\b/i],
  /**
   * A SLOPE LETTING GO, AND WHAT THAT DOES TO THE WATER BESIDE IT.
   *
   * Narrow on purpose, the way the mould's five are. `impoundment` needs a
   * structure holding water back, not any mention of a lake; `release` needs
   * something giving way rather than any motion; `displacement` needs one thing
   * taking another's place. Widen any of these and they start taking lines off
   * the drawings that were built for them.
   */
  ['impoundment', /\b(dams?|reservoirs?|impound\w*|held? back|behind the (?:dam|wall))\b/i],
  ['slip_plane', /\b(slip plane|weak bed|bed of clay|planes? of weakness|shear\s?(?:plane|surface)|lay on|resting on|sliding surface)\b/i],
  ['release', /\b(let go|gave way|released?|broke free|detached?|failed)\b|\bslid (?:in|into|down|off)\b/i],
  ['displacement', /\b(took (?:the|its) .{0,12}place|displac\w*|pushed? (?:the )?water|nowhere to go|no(?:where)? else to go)\b/i],
  ['overtopping', /\b(overtop\w*|over the (?:top|crest|wall|dam)|spilled? over|went over)\b/i],
];

/**
 * READ A LINE.
 *
 * Returns the domain the shot has to satisfy, the subject it is about, the
 * claims it makes, and how sure any of that is. `confidence` matters: a line
 * with one weak signal should not force a drawing.
 */
export function readSubject(vo = '') {
  const text = String(vo);
  const hits = SIGNALS.filter(([, re]) => re.test(text)).map(([domain]) => domain);
  const domain = hits[0] ?? 'abstract';
  const subject = SUBJECTS.find(([, re]) => re.test(text))?.[0] ?? null;
  const claims = CLAIMS.filter(([, re]) => re.test(text)).map(([claim]) => claim);
  return {
    domain,
    /** Every domain the line touches, strongest first. A shot may satisfy any. */
    domains: hits.length ? hits : ['abstract'],
    subject,
    claims,
    confidence: hits.length === 0 ? 0 : hits.length === 1 ? 0.7 : 1,
  };
}

/**
 * THE DOMAINS A PICTURE IS REQUIRED FOR.
 *
 * A claim about a place, a process, a body, a mechanism or a size cannot be
 * discharged by setting it in nice type. This list is the difference between
 * "typography is one option" and "typography is the default", and the second
 * is what produced five reels of text.
 */
export const NEEDS_A_PICTURE = ['geography', 'process', 'anatomy', 'mechanism', 'scale', 'material', 'terrain'];

/**
 * THE GATE.
 *
 * Given what the line is about and what the planner proposes to draw, may that
 * drawing stand as a picture of it?
 *
 * Hard, like the asset gate and for the same reason: a representation that is
 * *nearly* the right kind of thing is the failure mode, not the safe middle.
 * An antique brass dial is nearly an Antikythera mechanism. A gear train is
 * nearly a pump.
 */
export function semanticCheck({type, subject = null, domains = [], claims = []} = {}) {
  const serves = SERVES[type];
  if (!serves) {
    return {ok: false, why: `"${type}" declares no domain it can depict — it cannot be a picture of anything`};
  }
  const wanted = domains.length ? domains : ['abstract'];
  const met = wanted.filter((d) => serves.includes(d));
  if (!met.length) {
    return {
      ok: false,
      why:
        `${type} depicts ${serves.join('/')}; this line is about ${wanted.join('/')}` +
        (subject ? ` (${subject})` : '') +
        ' — a drawing of the wrong kind of thing is a claim nobody can check',
    };
  }
  return {ok: true, domain: met[0], why: `${type} is a picture of ${met[0]}`, claims};
}

/**
 * AND THE CONTRACT THE SPEC CARRIES.
 *
 * Attached to every drawn spec by the representation director, checked by the
 * validator against the line it was made for. Kept as plain data so the
 * director's report can print it and a person can argue with it.
 */
export function contract({type, subject, domain, claims = []}) {
  return {subject: subject ?? domain ?? 'unnamed', claims: [...new Set(claims)].slice(0, 8), depicts: domain, type};
}

/**
 * THE GATE, RUN OVER A FINISHED CONFIG.
 *
 * The planner already refuses a mismatch when it chooses. This runs again on
 * the file that will actually be rendered, for the same reason the asset check
 * does: a config can be hand-edited, an older one can be replanned by a newer
 * planner, and a representation is exactly the kind of decision somebody
 * reasonably changes by hand at two in the morning.
 *
 * It is an ERROR, not a warning. A drawing of the wrong kind of thing is the
 * one defect in this repo that a viewer cannot detect and cannot check.
 */
/** The shots of one line share a stem: s07-slide, s07-slide-b, s07-slide-c. */
const stem = (id) => String(id ?? '').replace(/-[a-z]$/, '');

export function representationProblems(config) {
  const errors = [];
  const warnings = [];

  (config.scenes ?? []).forEach((scene, index) => {
    const where = `scene[${index}] "${scene.id}"`;
    const vo = String(scene.voText ?? '');
    const read = readSubject(vo);
    const photographic = Object.keys(scene.assets ?? {}).length > 0;
    const drawn = scene.diagram?.type ?? null;

    if (drawn) {
      /**
       * A CONTINUATION IS A FRAGMENT, AND A FRAGMENT IS NOT EVIDENCE.
       *
       * One sentence becomes two or three shots, and the drawing belongs to the
       * SENTENCE — the second shot of a heart is still a heart even though its
       * three words are "beating together". Checked against the fragment, the
       * gate reported nineteen correct drawings as wrong across four episodes,
       * because a fragment with no anatomical word in it classifies as
       * abstract.
       *
       * So a mismatch is only a mismatch when the text is actually SAYING
       * something else. Absence of signal is not evidence, and a check that
       * cries wolf on the correct case is a check people switch off.
       */
      /**
       * CHECKED AGAINST WHAT THE DRAWING SAYS IT IS OF.
       *
       * Not against the shot's own words. One sentence becomes two or three
       * shots and the drawing belongs to the SENTENCE, so the second shot of a
       * heart carries three words that are not about hearts — checked against
       * those, the gate reported nineteen correct drawings as wrong across four
       * episodes. A check that cries wolf on the correct case is a check people
       * switch off.
       *
       * The subject is decidable on its own: a heart is anatomy in every
       * sentence anybody will ever write. So the pair (subject, type) can be
       * refused from the config alone, which is both stricter and quieter.
       */
      const named = scene.diagram?.subject;
      const domain = SUBJECT_DOMAIN[named];
      if (domain && !(SERVES[drawn] ?? []).includes(domain)) {
        errors.push(
          `${where}: the drawing says its subject is ${named}, which is ${domain}; ` +
            `a ${drawn} depicts ${(SERVES[drawn] ?? []).join('/')} — a drawing of the wrong kind of thing ` +
            'is a claim nobody can check',
        );
      }
      /**
       * AND THE CONTRACT IT CARRIES MUST BE TRUE.
       *
       * `depicts` is written by the director; if it names a domain the type
       * cannot serve, the spec is lying about itself and the check above would
       * have been asking the wrong question.
       */
      const depicts = scene.diagram?.depicts;
      if (depicts && !(SERVES[drawn] ?? []).includes(depicts)) {
        errors.push(`${where}: the drawing declares it depicts ${depicts}, which a ${drawn} cannot depict`);
      }
    }

    /**
     * A LINE THAT NEEDS A PICTURE AND HAS NONE.
     *
     * Not silently a title card. The reel still renders — a hole is not a
     * reason to fail a build — but it is named, counted, and reported as
     * REPRESENTATION_REQUIRED, which is the same treatment a refused photograph
     * already gets.
     */
    /**
     * …AND "HAS NONE" MEANS THE LINE, NOT THE SHOT.
     *
     * A sentence usually becomes two or three shots, and the card that states
     * its figure is one of them: "the slab slid into the lake in forty-five
     * seconds" is a 45 SECONDS slate CUT TO the section showing it slide. The
     * check looked at one scene at a time, so it reported the card as a line
     * carried by type alone while the drawing it belongs to was in the very next
     * shot. A warning that fires on the correct arrangement is a warning people
     * learn to scroll past.
     */
    const sameLine = (config.scenes ?? []).filter((other) => stem(other.id) === stem(scene.id));
    const drawnNearby = sameLine.some((other) => other.diagram) || sameLine.some((other) => Object.keys(other.assets ?? {}).some((r) => !r.startsWith('?')));

    if (!drawn && !photographic && !drawnNearby && NEEDS_A_PICTURE.includes(read.domain) && read.confidence >= 0.7) {
      warnings.push(
        `${where}: REPRESENTATION_REQUIRED — the line is about ${read.domain}` +
          `${read.subject ? ` (${read.subject})` : ''} and is being carried by type alone`,
      );
    }
  });

  return {errors, warnings};
}
