/**
 * THE CASTING MANIFEST — one file a person can read and know what to go and find.
 *
 * Everything upstream of here is the machine talking to itself: briefs derived
 * from sentences, domains, scores, ladders. This is the one artefact addressed
 * to a HUMAN with a camera roll or an archive login, and it is judged by a
 * single question:
 *
 *   Can somebody open `assets/casting.json` and know what to supply?
 *
 * So every entry answers, without cross-referencing anything: what the picture
 * is of, why the reel needs it, what must be visible, what must NOT be, what
 * shape it has to be, how big, where the subject may sit, and what licence
 * facts have to come with it.
 *
 * STATUS IS A LIFECYCLE, NOT A LABEL.
 *
 *   OPEN                 nobody has supplied anything
 *   CANDIDATE            a file is in, scored, and waiting on a decision
 *   PROVENANCE_REQUIRED  the picture is right and we do not know where it came from
 *   ACCEPTED             it passed every gate and is in the manifest
 *   REJECTED             it was refused, and the reason is recorded
 *
 * `PROVENANCE_REQUIRED` is a separate state rather than a rejection because the
 * two need different actions: a rejected picture needs a different picture, an
 * unprovenanced one needs somebody to write down where they got it. Collapsing
 * them loses a usable asset and teaches nobody anything.
 */
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {briefFrom} from './brief.mjs';
import {LICENCE_REQUIREMENT} from './licence.mjs';
import {requirementsFor, scenesFor, slugOf} from './shot.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
export const CASTING_DIR = path.join(ROOT, 'assets');
export const CASTING_FILE = path.join(CASTING_DIR, 'casting.json');
export const INBOX_DIR = path.join(CASTING_DIR, 'inbox');
export const ORIGINAL_DIR = path.join(CASTING_DIR, 'original');
export const PROCESSED_DIR = path.join(CASTING_DIR, 'processed');
export const PREVIEW_DIR = path.join(CASTING_DIR, 'preview');

export const STATUS = ['OPEN', 'CANDIDATE', 'PROVENANCE_REQUIRED', 'ACCEPTED', 'REJECTED'];

/**
 * WHAT MUST NOT BE IN THE PICTURE, stated as things a person can look for.
 *
 * `reject_if` from the brief is written for a scorer. This adds the ones that
 * come from the SHOT rather than from the subject, because they are the ones a
 * supplier would never guess: a watermark survives every crop, a burnt-in date
 * becomes a second caption, and a picture that is already 9:16 has usually been
 * cropped once and cannot be cropped again.
 */
const SHOT_REFUSALS = [
  'watermarks, logos or agency bugs — they survive every crop and every grade',
  'burnt-in dates or captions — the reel has its own typography and two sets fight',
  'heavy existing colour grading, especially teal-and-orange — the reel grades once, at the end',
  'a subject already cropped to the frame edge — the camera pushes in and there is nothing to push into',
];


/**
 * TWO WAYS OF SAYING THE SAME REFUSAL IS ONE REFUSAL.
 *
 * The domain table and the line's own manifest entry often phrase the same
 * prohibition twice — "any framing with no scale reference in it" and "any
 * framing with no scale reference in it, which is the one thing this shot
 * exists to provide". A list that repeats itself is a list people stop reading,
 * and the longer phrasing is the one that explains WHY, so it wins.
 */
function dedupeRefusals(items) {
  const kept = [];
  for (const item of items.sort((a, b) => b.length - a.length)) {
    const bare = item.toLowerCase().replace(/[^a-z0-9 ]/g, '').slice(0, 44);
    if (kept.some((k) => k.toLowerCase().replace(/[^a-z0-9 ]/g, '').startsWith(bare))) continue;
    kept.push(item);
  }
  return kept;
}

/** The provenance a supplier has to write down, whatever the source. */
export const PROVENANCE_FIELDS = ['source', 'sourceUrl', 'creator', 'license', 'licenseUrl', 'retrievalDate', 'notes'];

export function emptyProvenance() {
  return Object.fromEntries(PROVENANCE_FIELDS.map((f) => [f, null]));
}

/**
 * A STABLE ID.
 *
 * `episode/line`, because that is what it is, it sorts usefully, and a person
 * reading a filename in the inbox folder can tell what it was cast for without
 * opening anything.
 */
export function briefId(episode, line) {
  return `${episode}/${line}`;
}

/** Build the casting entries for one episode from what it already asked for. */
export async function castingFor(episodeId, {episodeDir}) {
  const required = JSON.parse(await readFile(path.join(episodeDir, 'assets.required.json'), 'utf8'));
  const {config} = await scenesFor(episodeDir, '__none__');
  const byLine = new Map();
  for (const scene of config.scenes ?? []) {
    const slug = slugOf(scene.id);
    if (!byLine.has(slug)) byLine.set(slug, []);
    byLine.get(slug).push(scene);
  }

  /**
   * WHAT THE EPISODE IS ABOUT, where a single line does not say.
   *
   * The semantic layer returns the DOMAIN when it finds no specific subject, so
   * "Each weighs about eight hundred tons" comes back as `scale`. That is true
   * and useless to somebody going out to find a picture: the reel's scale lines
   * are all about the same object, and three of them name it.
   *
   * So a generic subject borrows the specific one found in the same domain
   * elsewhere in the episode. Same domain only — a quarry line is geography and
   * must not inherit "megalith" from the stones being quarried.
   */
  const specific = new Map();
  for (const wanted of required.wanted ?? []) {
    const b = briefFrom(wanted, {episode: episodeId});
    if (b.subject && b.subject !== b.domain && !specific.has(b.domain)) specific.set(b.domain, b.subject);
  }

  const entries = [];
  for (const wanted of required.wanted ?? []) {
    const brief = briefFrom(wanted, {episode: episodeId});
    /** Fill a generic subject from the episode, and say that it was filled. */
    const inherited = brief.subject === brief.domain ? specific.get(brief.domain) ?? null : null;
    const subject = inherited ?? brief.subject;
    const mustShow = inherited
      ? [subject, ...brief.must_show.slice(1)]
      : brief.must_show;
    const scenes = byLine.get(brief.line) ?? [];
    const shot = requirementsFor(scenes, {width: config.width, height: config.height});
    entries.push({
      id: briefId(episodeId, brief.line),
      episode: episodeId,
      shot: shot?.shots ?? [],
      subject,
      purpose: brief.purpose,
      representation: brief.representation,
      must_show: mustShow,
      preferred_orientation: brief.preferred_orientation,
      preferred_composition: brief.preferred_composition,
      historical_constraints: brief.historical_constraints,
      scientific_constraints: brief.scientific_constraints,
      reject_if: dedupeRefusals([...brief.reject_if, ...SHOT_REFUSALS]),
      status: 'OPEN',

      /** Context a supplier needs and the schema above does not carry. */
      says: brief.says,
      domain: brief.domain,
      priority: brief.priority,
      currently: wanted.currently ?? null,
      subjectInferredFrom: inherited ? `the episode's other ${brief.domain} lines — this one names no subject of its own` : null,
      searchTerms: brief.queries,
      acceptable_substitutes: brief.acceptable_substitutes,
      license_requirements: LICENCE_REQUIREMENT,
      /** The shape the shot demands, derived from the scene and never guessed. */
      shotRequirements: shot,
      /** Filled in when somebody supplies something. */
      candidates: [],
      accepted: null,
      provenance: emptyProvenance(),
    });
  }
  return entries;
}

/** Read the casting manifest, or an empty one. */
export async function loadCasting() {
  try {
    return JSON.parse(await readFile(CASTING_FILE, 'utf8'));
  } catch {
    return {generatedAt: null, episodes: [], briefs: []};
  }
}

/**
 * Write it, preserving anything a human has already done.
 *
 * Regenerating must never silently discard a supplied file, a provenance record
 * or a decision. The brief's REQUIREMENTS come from the pipeline and are
 * refreshed; everything a person put there is carried across by id.
 */
export async function saveCasting(briefs, {episodes}) {
  await mkdir(CASTING_DIR, {recursive: true});
  const prior = await loadCasting();
  const kept = new Map((prior.briefs ?? []).map((b) => [b.id, b]));

  const merged = briefs.map((fresh) => {
    const old = kept.get(fresh.id);
    if (!old) return fresh;
    return {
      ...fresh,
      status: old.status ?? fresh.status,
      candidates: old.candidates ?? [],
      accepted: old.accepted ?? null,
      provenance: old.provenance ?? fresh.provenance,
      humanNote: old.humanNote ?? undefined,
    };
  });

  const doc = {
    $note:
      'What a person has to supply to make these episodes production-ready. Every entry says what the ' +
      'picture must be OF, what must be visible, what must NOT be, and the shape the shot demands — the ' +
      'last of those is read from the scene config, not guessed. Drop files in assets/inbox/ and run ' +
      '`npm run assets:match`; filenames carry no authority.',
    generatedAt: new Date().toISOString(),
    episodes,
    counts: countsOf(merged),
    statuses: Object.fromEntries(STATUS.map((s) => [s, merged.filter((b) => b.status === s).length])),
    briefs: merged,
  };
  await writeFile(CASTING_FILE, `${JSON.stringify(doc, null, 2)}\n`, 'utf8');
  return doc;
}

export function countsOf(briefs) {
  return {
    total: briefs.length,
    blocking: briefs.filter((b) => b.priority === 'BLOCKING').length,
    wouldStrengthen: briefs.filter((b) => b.priority === 'would strengthen').length,
    optional: briefs.filter((b) => b.priority === 'optional').length,
    stillNeeded: briefs.filter((b) => b.status !== 'ACCEPTED').length,
  };
}
