/**
 * THE ASSET BRIEF — the request, written so a stranger could fill it.
 *
 * The manifest this repo already wrote was addressed to a human researcher. A
 * brief is the same request addressed to a MACHINE as well: the same facts,
 * but decidable — `must_show` is a list a scorer can check off, `reject_if` is
 * a list it can fail against, `license_requirements` is a rule rather than a
 * hope.
 *
 * The two constraint fields are separate on purpose. "Period-correct tools" and
 * "anatomically correct for the species named" are both constraints and they
 * fail differently: a historical error is a claim about the past that a viewer
 * could look up, a scientific error is a claim about how something works. A
 * brief about a strait has the second and not the first; a brief about a forge
 * has both. Collapsing them into one field is how "close enough" gets in.
 *
 * NOTHING HERE CHOOSES A REPRESENTATION. `representation` records what the
 * representation director already decided, so the brief can say what KIND of
 * asset would serve — a photograph for a place, a specimen or plate for
 * anatomy — and the selector upstream is not touched.
 */
import {LICENCE_REQUIREMENT} from './licence.mjs';
import {DOMAINS} from '../scripts/lib/semantics.mjs';

export const BRIEF_FIELDS = [
  'subject',
  'purpose',
  'representation',
  'must_show',
  'preferred_orientation',
  'preferred_composition',
  'historical_constraints',
  'scientific_constraints',
  'acceptable_substitutes',
  'reject_if',
  'license_requirements',
];

/**
 * WHICH CONSTRAINTS A DOMAIN ACTUALLY HAS.
 *
 * Per domain rather than per topic, for the same reason everything else in this
 * pipeline is: the answer for "a strait" and "a border" is one answer, and a
 * table of topics is a table that is wrong about the next topic.
 */
const CONSTRAINT_KIND = {
  geography: {historical: false, scientific: false},
  process: {historical: true, scientific: true},
  material: {historical: false, scientific: true},
  anatomy: {historical: false, scientific: true},
  scale: {historical: true, scientific: false},
  mechanism: {historical: true, scientific: true},
  elapsed: {historical: true, scientific: false},
  celestial: {historical: false, scientific: true},
  quantity: {historical: false, scientific: false},
  abstract: {historical: false, scientific: false},
};

/** What a picture in this domain has to have in it to be worth having. */
const MUST_SHOW = {
  geography: ['{subject}', 'the spatial relation the line is about'],
  process: ['{subject} being worked', 'the tool or agent doing the work', 'the moment of contact'],
  material: ['{subject}', 'structure visible at the scale it is shown'],
  anatomy: ['{subject}, the whole structure', 'even lighting with the structure distinguishable'],
  scale: ['{subject}', 'a person or a known object in the same plane as a size reference'],
  mechanism: ['{subject}, the working parts', 'how the parts engage'],
  elapsed: ['a dated document or place showing {subject}', 'the date legible or verifiable'],
  celestial: ['{subject}'],
  quantity: ['{subject}, arrayed so the count is readable'],
  abstract: [],
};

/**
 * THE SUBJECT, IN WORDS A PERSON WOULD USE.
 *
 * The semantic layer's subjects are slugs — `humanHeart`, `swordMaking`,
 * `tradeRoute` — and where it found no specific subject it returns the domain
 * itself. Both are useless as literal text: a photograph's description never
 * contains the word "humanHeart", and matching the word "scale" against a
 * picture of stones finds nothing.
 *
 * So the slug is unpacked, and where the subject IS the domain the sentence's
 * own nouns stand in for it — those are the words somebody describing the
 * picture would actually use.
 */
export function subjectWords(subject, says) {
  const slug = String(subject ?? '')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .trim();
  const generic = new Set([...DOMAINS, 'photo', 'asset']);
  if (slug && !generic.has(slug)) return slug;
  /** No specific subject: the line's own concrete nouns are the subject. */
  const nouns = String(says ?? '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 3 && !TOPIC_STOP.has(w));
  return nouns.slice(0, 6).join(' ') || slug;
}

const TOPIC_STOP = new Set([
  'about', 'above', 'after', 'again', 'against', 'been', 'before', 'being', 'between', 'both',
  'could', 'does', 'each', 'from', 'have', 'into', 'more', 'most', 'much', 'must', 'never',
  'only', 'other', 'over', 'same', 'some', 'such', 'than', 'that', 'them', 'then', 'there',
  'these', 'they', 'this', 'those', 'through', 'under', 'until', 'were', 'what', 'when',
  'where', 'which', 'while', 'with', 'would', 'your', 'still', 'every', 'sits', 'took',
]);

/** Framing that serves the shot the director already planned. */
const COMPOSITION = {
  geography: 'high or aerial, horizon clear, both sides of the relation in frame; subject off-centre so type has a side',
  process: 'close over the work, tool and material both in frame, hands included; subject filling 50-70%',
  material: 'macro or section, structure the subject rather than the object it came from; centred, no caption overlap',
  anatomy: 'specimen or plate, whole structure in frame, even light; centred with margin for a push',
  scale: 'the object with its size reference in the same plane, no telephoto compression, whole object in frame',
  mechanism: 'the mechanism exposed, parts distinguishable, three-quarter rather than flat-on',
  elapsed: 'the document or place legible, filling the frame, no perspective distortion',
  celestial: 'the body against sky, negative space around it for a slow push',
  quantity: 'the counted thing arrayed so the count is readable',
  abstract: 'negative space for typography; no competing subject',
};

/**
 * A 9:16 REEL IS VERTICAL, and most photography is not.
 *
 * Preferring vertical where the subject is vertical and accepting landscape
 * where the subject is horizontal is not a style rule: a 5:1 megalith cropped
 * to 9:16 is a picture of one end of a megalith.
 */
const ORIENTATION = {
  geography: 'landscape source, croppable to 9:16 without losing the relation',
  process: 'either, with room to crop tall',
  material: 'either',
  anatomy: 'vertical preferred; the structure is taller than it is wide',
  scale: 'landscape preferred; the whole object must fit and most large objects are wide',
  mechanism: 'either',
  elapsed: 'vertical preferred; documents are portrait',
  celestial: 'either',
  quantity: 'either',
  abstract: 'vertical',
};

const REJECT = {
  geography: ['tourist framing', 'visible modern signage where the line is historical', 'any view that hides the relation the sentence is about'],
  process: ['machine tooling standing in for hand work', 'safety equipment in a historical scene', 'staged studio lighting', 're-enactment presented as record'],
  material: ['a generic texture', 'a rendered or CGI material', 'anything where the structure cannot be seen'],
  anatomy: ['stylised medical illustration presented as a specimen', 'any image of an identifiable patient', 'anything gratuitous'],
  scale: ['any framing with no scale reference in it', 'telephoto compression that flattens the size', 'a different monument of the same family'],
  mechanism: ['a different mechanism of the same family', 'a replica presented as the original'],
  elapsed: ['undated material presented as dated'],
  celestial: ['an artist impression presented as an observation'],
  quantity: [],
  abstract: [],
};

const SUBSTITUTE = {
  geography: 'a comparable coastline or terrain of the same character, LABELLED illustrative and not as the place',
  process: 'a living practitioner of the same craft, captioned as a modern demonstration',
  material: 'a published micrograph or core sample photograph with its source credited',
  anatomy: 'a public-domain anatomical plate, credited',
  scale: 'another object of the same order of magnitude, captioned as a comparison',
  mechanism: 'a radiograph or museum photograph of the same object',
  elapsed: 'a contemporaneous document of the same kind',
  celestial: 'an observatory image of the same body',
  quantity: 'none',
  abstract: 'none — a near miss is a rejection',
};

/**
 * Turn one entry of `assets.required.json` into a brief.
 *
 * The manifest is the source of truth for what was asked for; this adds the
 * fields a scorer needs and nothing a human would have to re-decide.
 */
export function briefFrom(entry, {episode} = {}) {
  const domain = entry.domain ?? 'abstract';
  const kind = CONSTRAINT_KIND[domain] ?? CONSTRAINT_KIND.abstract;
  const stated = entry.constraints ?? null;
  return {
    episode: episode ?? null,
    line: entry.line ?? null,
    says: entry.says ?? null,
    domain,
    priority: entry.priority ?? 'optional',
    /** The queries the manifest already worked out, plus the described image. */
    queries: [...(entry.searches ?? []), entry.described].filter(Boolean),

    subject: entry.subject ?? domain,
    purpose: entry.purpose ?? 'illustrate the claim the line makes',
    representation: entry.representation ?? 'photo',
    must_show: (MUST_SHOW[domain] ?? []).map((item) =>
      item.replace('{subject}', subjectWords(entry.subject ?? domain, entry.says)),
    ),
    preferred_orientation: entry.orientation ?? ORIENTATION[domain] ?? 'either',
    preferred_composition: entry.composition ?? COMPOSITION[domain] ?? COMPOSITION.abstract,
    historical_constraints: kind.historical ? stated ?? 'must be period-correct for the date the line names' : null,
    scientific_constraints: kind.scientific ? stated ?? 'must be correct for the thing the line names' : null,
    acceptable_substitutes: entry.substitutes ?? SUBSTITUTE[domain] ?? 'none',
    reject_if: [...new Set([...(REJECT[domain] ?? []), ...(entry.reject ? [entry.reject] : [])])],
    license_requirements: LICENCE_REQUIREMENT,
  };
}

/** A brief is only usable if it says what it wants and what it refuses. */
export function briefProblems(brief) {
  const out = [];
  for (const field of BRIEF_FIELDS) {
    if (!(field in brief)) out.push(`missing field: ${field}`);
  }
  if (!brief.subject) out.push('no subject: a brief that does not name its subject cannot be scored against one');
  if (!brief.purpose) out.push('no purpose: without it a scorer cannot tell a good picture from a useful one');
  if (!Array.isArray(brief.reject_if) || !brief.reject_if.length) {
    /**
     * The field this repo learned the hard way. A Greek shipwreck was
     * illustrated with an antique brass dial because nobody had written down
     * what "close enough" excluded.
     */
    out.push('no reject_if: the rejection criteria are what stop "approximately right" from shipping');
  }
  if (brief.historical_constraints === undefined || brief.scientific_constraints === undefined) {
    out.push('constraints not decided: both fields must be present, null meaning "this domain has none"');
  }
  return out;
}
