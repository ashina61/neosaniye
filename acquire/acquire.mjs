/**
 * THE ACQUISITION RUN.
 *
 * One brief in, one decision out, and a paper trail either way. The order is
 * not negotiable and every step exists because skipping it produced a defect
 * this repository shipped:
 *
 *   SEARCH      ask the rung's providers, in preference order
 *   DOWNLOAD    through the cache, and only for candidates worth decoding
 *   SEMANTIC    is it the thing? — a gate, first, before anything else is spent
 *   QUALITY     is it a usable picture of it?
 *   COMPOSITION will it work in the shot that was planned?
 *   LICENCE     may we publish a derivative, and what do we owe?
 *   DEDUPE      have we already used this, or something indistinguishable?
 *   ACCEPT      with provenance, or REJECT with a reason
 *
 * SEMANTIC FIRST is the ordering that matters. It is the only gate that can
 * reject alone, it is the cheapest to run, and putting it after quality means
 * paying to measure the sharpness of a photograph of the wrong object.
 *
 * NOTHING HERE TOUCHES THE ENGINE. The output is a manifest; what the reel does
 * with it is the planner's business, and the planner already knows how to use
 * a supplied file.
 */
import {makeLedger, perceptualHash} from './dedupe.mjs';
import {cached, cachePath} from './cache.mjs';
import {judgeLicence} from './licence.mjs';
import {preflight, providerById} from './providers/index.mjs';
import {RUNGS, settle, usableRungs} from './ladder.mjs';
import {scoreComposition, compositionVerdict} from './score/composition.mjs';
import {scoreQuality, qualityVerdict} from './score/quality.mjs';
import {scoreSemantic, semanticVerdict} from './score/semantic.mjs';

/** How many candidates per query are worth the decode. */
const SHORTLIST = 6;

/**
 * ONE CANDIDATE, ALL THE WAY THROUGH.
 *
 * Returns an outcome rather than throwing, because a rejection is a RESULT — it
 * is most of what the report is made of, and a candidate that fell over is a
 * different fact from one that was refused.
 */
async function assess({candidate, brief, provider, rung, ledger, sharp, force}) {
  const trail = {
    provider: candidate.provider,
    id: candidate.id,
    title: candidate.title,
    sourceUrl: candidate.sourceUrl,
    rung: rung.n,
  };

  /**
   * THE SEMANTIC GATE RUNS ON METADATA, BEFORE THE DOWNLOAD.
   *
   * A wrong-subject candidate costs nothing to refuse here and a full decode to
   * refuse later. It is also the honest place for it: whether this is a picture
   * of the thing is a question about what it depicts, not about its pixels.
   */
  const semantic = scoreSemantic(candidate, brief);
  const semanticCall = semanticVerdict(semantic, brief);
  if (!semanticCall.ok) {
    return {...trail, accepted: false, stage: 'semantic', why: semanticCall.why, semantic};
  }

  let got;
  try {
    got = await cached(candidate, {fetcher: (c) => provider.download(c), force});
  } catch (error) {
    return {...trail, accepted: false, stage: 'download', why: String(error?.message ?? error), semantic};
  }

  let quality;
  let composition;
  let phash;
  try {
    quality = await scoreQuality(sharp, got.buffer, brief);
    composition = await scoreComposition(sharp, got.buffer, brief, quality);
    phash = await perceptualHash(sharp, got.buffer);
  } catch (error) {
    return {...trail, accepted: false, stage: 'decode', why: `not a decodable image: ${error?.message ?? error}`, semantic};
  }

  const qualityCall = qualityVerdict(quality);
  if (!qualityCall.ok) {
    return {...trail, accepted: false, stage: 'quality', why: qualityCall.why, semantic, quality, composition};
  }

  const compositionCall = compositionVerdict(composition);
  if (!compositionCall.ok) {
    return {...trail, accepted: false, stage: 'composition', why: compositionCall.why, semantic, quality, composition};
  }

  const licence = judgeLicence({
    licence: candidate.licence,
    licenceUrl: candidate.licenceUrl,
    source: provider.name,
    sourceUrl: candidate.sourceUrl,
    creator: candidate.creator,
  });
  if (!licence.ok) {
    return {...trail, accepted: false, stage: 'licence', why: licence.why, semantic, quality, composition};
  }

  const dupe = ledger.check({candidate, buffer: got.buffer, phash, composition});
  if (dupe.reject) {
    return {...trail, accepted: false, stage: 'duplicate', why: `${dupe.duplicate}, already used for "${dupe.of}"`, semantic, quality, composition};
  }

  /**
   * ONE NUMBER FOR RANKING, and it is not the decision — the gates already
   * made that. Weighted toward semantics because a shot that is about the
   * right thing and slightly soft beats a beautiful near-miss every time.
   */
  const rank =
    semantic.relevance * 0.4 +
    semantic.accuracy * 0.2 +
    quality.score * 0.25 +
    composition.score * 0.15 -
    (dupe.penalty ?? 0);

  return {
    ...trail,
    accepted: true,
    stage: 'accepted',
    why: null,
    semantic,
    quality,
    composition,
    licence,
    rank: Number(rank.toFixed(2)),
    duplicateNote: dupe.duplicate ?? null,
    file: got.file,
    cacheHit: got.hit,
    bytes: got.bytes,
    phash,
    buffer: got.buffer,
    candidate,
  };
}

/**
 * ONE BRIEF: climb the ladder until something is accepted.
 *
 * Rungs are tried in order and a rung is finished as soon as it yields an
 * acceptable asset — there is no point searching four archives when the local
 * corpus already answered.
 */
export async function acquireOne({brief, availability, ledger, sharp, force = false, limit = SHORTLIST}) {
  const rungs = usableRungs(availability);
  const attempts = [];
  let best = null;

  for (const rung of rungs) {
    /**
     * Rungs five and six are not acquisitions — a drawing and a sentence are
     * made by the engine, not fetched — so the climb stops after four and the
     * caller settles what is left.
     */
    if (rung.n > 4) break;
    if (!rung.usable) {
      attempts.push({rung: rung.n, label: rung.label, skipped: rung.because});
      continue;
    }
    for (const id of rung.live ?? rung.providers) {
      const provider = providerById(id);
      if (!provider) continue;
      for (const query of brief.queries.slice(0, 3)) {
        let candidates = [];
        try {
          candidates = await provider.search(query, {limit, brief, orientation: /vertical/.test(brief.preferred_orientation ?? '') ? 'portrait' : undefined});
        } catch (error) {
          attempts.push({rung: rung.n, provider: id, query, failed: String(error?.message ?? error)});
          continue;
        }
        attempts.push({rung: rung.n, provider: id, query, found: candidates.length});
        for (const candidate of candidates) {
          const outcome = await assess({candidate, brief, provider, rung, ledger, sharp, force});
          attempts.push({rung: rung.n, ...stripBuffer(outcome)});
          if (outcome.accepted && (!best || outcome.rank > best.rank)) best = outcome;
        }
        /**
         * Good enough, stop looking. A shortlist that keeps searching after an
         * 8.5 is a shortlist that spends four archives to find an 8.6.
         */
        if (best && best.rank >= 8) break;
      }
      if (best && best.rank >= 8) break;
    }
    if (best) break;
  }

  return {best, attempts};
}

/** The buffer is for the caller, never for the report. */
function stripBuffer(outcome) {
  const {buffer, candidate, ...rest} = outcome;
  return rest;
}

export {preflight, RUNGS, settle, makeLedger, cachePath};
