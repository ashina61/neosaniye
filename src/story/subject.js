/**
 * WHAT THIS LINE IS ABOUT.
 *
 * The rig says how a scene moves. The look says what colour it is. Neither of
 * them knows what the story is — and for a while that showed: a whale, a rocket
 * and a bank vault all rendered as the same skyline with the same empty chair
 * and the same grain over the top. Changing the palette does not fix that. The
 * viewer is not looking at the palette; they are looking at the drawing.
 *
 * So every beat also picks three things FROM ITS OWN LINE:
 *
 *   SET         where we are      — a vault, an ocean, a courtroom, a factory
 *   MOTIF       what we are looking at — the object the sentence is about
 *   ATMOSPHERE  what is in the air — rain, embers, dust, stars, static
 *
 * Two consequences worth stating, because they are the point:
 *
 * · Two different topics never share a drawing, even at identical rig and
 *   identical colour — a line about a sunken ship and a line about a bankrupt
 *   store are staged in different places with different objects.
 * · Scenes WITHIN a video differ too, because each line is read on its own.
 *   That is the one thing the look deliberately does not do (colour must stay
 *   constant), and it is why both layers exist.
 *
 * Selection is keyword-driven and deterministic. When a line says nothing
 * specific, the rig's home set is used and no motif is drawn — an honest empty
 * stage beats a wrong object confidently placed.
 */

/** Where we are. First match wins, so the most concrete signal decides. */
const SETS = [
  {id: 'ocean', when: /\b(ocean|sea|underwater|dive|diver|reef|whale|shark|fish|shipwreck|drown|tide|submarine|coral|wave)\w*/i},
  {id: 'space', when: /\b(space|orbit|planet|moon|mars|rocket|launch|satellite|astronaut|galaxy|comet|nasa|cosmic)\w*|\bstars?\b|\bstarlight\b/i},
  {id: 'vault', when: /\b(vault|bank|deposit|gold|bullion|treasur|heist|robber|cash|reserve|mint)\w*/i},
  {id: 'court', when: /\b(court|trial|judge|jury|lawsuit|verdict|testimon|sentence|prosecut|witness|appeal)\w*/i},
  {id: 'lab', when: /\b(lab|laborator|experiment|scientist|chemical|virus|vaccine|sample|research|formula|patient|microscope)\w*/i},
  {id: 'factory', when: /\b(factory|plant|assembly|machine|engine|industr|worker|production|steel|reactor|turbine)\w*|\bmills?\b/i},
  {id: 'forest', when: /\b(forest|jungle|tree|wood|rainforest|swamp|wildlife|nest|leaves|canopy)\w*/i},
  {id: 'ruins', when: /\b(ruin|collaps|abandon|rubble|earthquake|bomb|destroy|derelict|deserted|crumbl|wreckage)\w*/i},
  {id: 'study', when: /\b(office|study|desk|library|book|archive|ledger|document|paperwork|records?)\b/i},
  {id: 'street', when: /\b(street|city|store|shop|town|road|building|traffic|neighbou?rhood|sidewalk|pavement)\w*/i},
];

/** What we are looking at. The object the sentence actually names. */
const MOTIFS = [
  {id: 'whale', when: /\b(whale|shark|dolphin|fish|creature|animal)\w*/i},
  {id: 'ship', when: /\b(ship|boat|vessel|fleet|sail|voyage|cargo|liner|ferry|wreck)\w*/i},
  {id: 'anchor', when: /\b(anchor|harbou?r|port|dock|moor)\w*/i},
  {id: 'rocket', when: /\b(rocket|launch|missile|spacecraft|shuttle|probe)\w*/i},
  {id: 'plane', when: /\b(plane|aircraft|flight|airline|pilot|jet|wing)\w*/i},
  {id: 'train', when: /\b(train|railway|railroad|locomotive|wagon|track)\w*/i},
  {id: 'vault', when: /\b(vault|deposit|strongroom)\w*|\bsafes?\b/i},
  {id: 'coins', when: /\b(money|cash|coin|dollar|pound|euro|payment|fortune|profit|revenue|billion|million|price|paid|sold)\w*/i},
  {id: 'gavel', when: /\b(court|judge|trial|verdict|sentence|law|ruling|justice)\w*/i},
  {id: 'gear', when: /\b(machine|engine|mechanism|factory|gear|motor|system|industr)\w*/i},
  {id: 'flask', when: /\b(chemical|experiment|formula|poison|drug|vaccine|acid|sample|potion)\w*/i},
  {id: 'bulb', when: /\b(idea|invent|patent|discover|solution|innovat|electric|light)\w*/i},
  {id: 'tree', when: /\b(tree|forest|wood|plant|seed|root|jungle)\w*/i},
  {id: 'mountain', when: /\b(mountain|peak|summit|climb|volcano|cliff|ridge)\w*/i},
  {id: 'tower', when: /\b(tower|castle|monument|cathedral|skyscraper|lighthouse|fortress|palace)\w*/i},
  {id: 'letter', when: /\b(letter|telegram|message|mail|envelope|contract|treaty|memo|signature)\w*/i},
  {id: 'key', when: /\b(key|lock|secret|access|password|unlock|code)\w*/i},
  {id: 'crown', when: /\b(king|queen|empire|royal|throne|crown|emperor|reign|dynasty)\w*/i},
  {id: 'clock', when: /\b(clock|hour|minute|deadline|delay|midnight|countdown)\w*|\btimes?\b|\blate\b/i},
  {id: 'skull', when: /\b(death|died|dead|kill|corpse|grave|fatal|plague|murder|poison)\w*/i},
  {id: 'camera', when: /\b(camera|photo|film|footage|record|broadcast|screen|televis)\w*/i},
  {id: 'book', when: /\b(book|novel|diary|manuscript|journal|bible|encyclopedia|record)\w*/i},
];

/** What is in the air. */
const ATMOSPHERES = [
  {id: 'rain', when: /\b(rain|storm|flood|monsoon|downpour|wet|drench)\w*/i},
  {id: 'snow', when: /\b(snow|ice|arctic|frozen|blizzard|winter|glacier|freez)\w*/i},
  {id: 'embers', when: /\b(fire|burn|flame|blaze|explos|furnace|lava|ignit|torch)\w*/i},
  {id: 'ash', when: /\b(ash|volcano|eruption|smoke|soot|cremat|dust storm)\w*/i},
  {id: 'bubbles', when: /\b(underwater|dive|sank|sunk|drown|submarine|ocean floor|deep sea)\w*/i},
  {id: 'stars', when: /\b(space|orbit|night|galaxy|cosmos|universe|stars?|moon)\w*/i},
  {id: 'static', when: /\b(broadcast|signal|radio|televis|transmission|interference|channel|screen)\w*/i},
  {id: 'ripples', when: /\b(shockwave|tremor|earthquake|sonar|pulse|echo|ripple|wave)\w*/i},
  {id: 'heat', when: /\b(desert|heat|drought|scorch|sweltering|furnace|boil)\w*/i},
  {id: 'dust', when: /\b(ruin|abandon|forgotten|derelict|attic|archive|old|ancient|decay)\w*/i},
  {id: 'godrays', when: /\b(reveal|discover|truth|found|uncover|dawn|hope|saved|answer)\w*/i},
];

/** The place each rig stands in when its line names nowhere. */
const RIG_HOME_SET = {
  'portal-zoom': 'gallery',
  'villain-punch': 'villain',
  'paper-drop': 'desk',
  'grounded-punch': 'street',
  'money-room': 'study',
  'finale-clone': 'street',
};

/**
 * Effects a beat may fall back to when its line names none. Chosen from the
 * video's seed rather than fixed, so a run of plain lines does not put the
 * same haze over every reel this repo ships.
 */
const NEUTRAL_ATMOSPHERES = ['dust', 'godrays', 'none', 'heat', 'none'];

function firstMatch(rules, text) {
  return rules.find((rule) => rule.when.test(text))?.id || null;
}

/**
 * Read one line (with its topic as weaker context) and decide what to draw.
 *
 * @param {object} input
 * @param {string} input.line   the spoken line — the strongest signal
 * @param {string} input.topic  the video's topic — used only as a tiebreak
 * @param {string} input.rig    the rig, for its home set
 * @param {number} input.seed   the video's look seed, for neutral fallbacks
 * @param {number} input.index  beat index, so neutral choices still vary
 */
export function readSubject({line = '', topic = '', rig = 'grounded-punch', seed = 0, index = 0} = {}) {
  const text = String(line);
  // The topic is a weaker signal on purpose: a video about Netflix should not
  // stage EVERY line in a boardroom just because the topic says "company".
  const context = `${text} ${topic}`;

  const set = firstMatch(SETS, text) || firstMatch(SETS, context) || RIG_HOME_SET[rig] || 'street';
  const motif = firstMatch(MOTIFS, text) || firstMatch(MOTIFS, context);
  const atmosphere =
    firstMatch(ATMOSPHERES, text) ||
    NEUTRAL_ATMOSPHERES[(Math.abs(Math.trunc(seed)) + index * 3) % NEUTRAL_ATMOSPHERES.length];

  return {set, motif, atmosphere};
}

export const SET_IDS = SETS.map((entry) => entry.id);
export const MOTIF_IDS = MOTIFS.map((entry) => entry.id);
export const ATMOSPHERE_IDS = ATMOSPHERES.map((entry) => entry.id);
