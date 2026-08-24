/**
 * RUNG FOUR — AN ILLUSTRATION, AND IT SAYS SO.
 *
 * This provider exists for the case where a real photograph is genuinely
 * unavailable: nobody photographed the Baalbek quarry in 27 BC, and no archive
 * holds a picture of a blade at the moment it was quenched in 1340. The choice
 * is not between a generated image and a real one; it is between a generated
 * image and nothing.
 *
 * IT IS NOT A PHOTOGRAPH AND IT NEVER CLAIMS TO BE. Every asset from here
 * carries the prompt that made it, the provider, the model and the date — and
 * where the subject is a historical or scientific reconstruction rather than
 * something anybody could have seen, it carries the plate the engine already
 * draws on its procedural work:
 *
 *   ILLUSTRATIVE RECONSTRUCTION
 *
 * A drawing presented as a record is a worse lie than a wrong photograph,
 * because the viewer cannot check it. That rule already governs the procedural
 * library; it governs generated pixels for exactly the same reason.
 *
 * The provider reports `unconfigured` rather than pretending, so a run with no
 * image endpoint says rung four is closed instead of silently skipping it.
 */
import {defineProvider} from './provider.mjs';

const BASE_URL = process.env.IMAGE_API_URL ?? '';
const MODEL = process.env.IMAGE_MODEL ?? 'unspecified';

/**
 * WHICH DOMAINS PRODUCE A RECONSTRUCTION rather than an illustration.
 *
 * A generated picture of "hands at a forge" is an illustration: it depicts an
 * activity that happens, and nothing about it asserts a specific past. A
 * generated picture of the Baalbek quarry in 27 BC asserts one, and that is a
 * reconstruction whether or not anybody says so.
 */
const RECONSTRUCTS = ['scale', 'mechanism', 'elapsed', 'process'];

export function disclosureFor(brief) {
  if (RECONSTRUCTS.includes(brief.domain) || brief.historical_constraints) {
    return 'ILLUSTRATIVE RECONSTRUCTION';
  }
  return 'ILLUSTRATION · NOT A PHOTOGRAPH';
}

/**
 * The prompt, built from the brief rather than from the episode.
 *
 * `reject_if` becomes the negative half: the same list that refuses a wrong
 * photograph is the list that tells a generator what not to draw, which is the
 * one place in this pipeline where those two jobs are literally the same job.
 */
export function promptFor(brief) {
  const wants = [brief.subject, ...(brief.must_show ?? [])].filter(Boolean).join(', ');
  const framing = brief.preferred_composition ?? '';
  const avoid = (brief.reject_if ?? []).join(', ');
  return {
    prompt:
      `documentary photograph: ${wants}. ${framing}. ` +
      'natural light, no text, no watermark, no people looking at camera.',
    negative: avoid || null,
  };
}

export default defineProvider({
  id: 'generated',
  name: 'Configured image generator',
  homepage: BASE_URL || 'https://example.invalid/unconfigured',
  needsKey: null,
  kinds: ['illustration'],

  async available() {
    if (!BASE_URL && !process.env.IMAGE_API_KEY) {
      return {
        ok: false,
        why: 'unconfigured',
        detail: 'set IMAGE_API_URL (and IMAGE_API_KEY / IMAGE_MODEL) to open rung four',
      };
    }
    return {ok: true, detail: `${MODEL} at ${BASE_URL || 'default endpoint'}`};
  },

  /**
   * There is nothing to search: generation makes exactly one candidate, and it
   * is described entirely by the brief that asked for it.
   */
  async search(query, {brief} = {}) {
    if (!brief) return [];
    const {prompt, negative} = promptFor(brief);
    const disclosure = disclosureFor(brief);
    return [
      {
        provider: 'generated',
        /** Deterministic: the same brief asks for the same picture. */
        id: Buffer.from(`${MODEL}:${prompt}`).toString('base64url').slice(0, 32),
        title: `${disclosure} — ${brief.subject}`,
        url: null,
        originalUrl: null,
        width: 1024,
        height: 1536,
        mime: 'image/png',
        sourceUrl: null,
        creator: `${MODEL} (generated)`,
        /**
         * A generated image has no copyright to clear and no author to credit,
         * but it does have a PROVENANCE obligation that is stricter than a
         * photograph's: what made it, from what instruction, and when.
         */
        licence: 'Generated asset — no third-party rights; see generation record',
        licenceUrl: null,
        description: `${disclosure}: ${prompt}`,
        date: new Date().toISOString().slice(0, 10),
        generation: {
          prompt,
          negative,
          provider: BASE_URL || 'configured endpoint',
          model: MODEL,
          generatedAt: new Date().toISOString(),
          disclosure,
        },
      },
    ];
  },

  async metadata(candidate) {
    return candidate;
  },

  async license(candidate) {
    return {licence: candidate.licence, licenceUrl: null, creator: candidate.creator};
  },

  /**
   * Deliberately not implemented here.
   *
   * `scripts/generate-assets.mjs` already speaks two generation protocols, has
   * the retry and transparency handling, and is the step that COMMITS what it
   * draws. Duplicating it would give this repository two generators that drift.
   * This provider's job is to decide that rung four applies and to record what
   * would be asked for; the generator's job is to draw it.
   */
  async download() {
    throw new Error(
      'generated assets are produced by scripts/generate-assets.mjs, which commits them — ' +
        'the acquisition layer records the request rather than drawing it inline',
    );
  },
});
