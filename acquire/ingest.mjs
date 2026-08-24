/**
 * THE INBOX — a human puts files in, and the pipeline works out what they are.
 *
 * THE FILENAME CARRIES NO AUTHORITY. A file called `baalbek-trilithon.jpg` is a
 * file somebody named `baalbek-trilithon.jpg`; it is not evidence about what is
 * in it. This repository has already shipped the consequence of believing a
 * name — and a supplier renaming a download to be helpful is exactly how a
 * plausible name gets attached to the wrong picture.
 *
 * So an inbox file is scored against EVERY open brief and the answer comes back
 * as a ranking with its reasons, not as an assignment.
 *
 * WHEN TWO ROLES SCORE ALIKE, A PERSON DECIDES. The cost of an automatic wrong
 * cast is the failure this repository is named after, and the cost of asking is
 * one question. That asymmetry sets the margin, not a tuning exercise.
 */
import {createHash} from 'node:crypto';
import {copyFile, mkdir, readFile, readdir, stat} from 'node:fs/promises';
import path from 'node:path';
import {INBOX_DIR, ORIGINAL_DIR} from './casting.mjs';
import {perceptualHash} from './dedupe.mjs';
import {judgeLicence} from './licence.mjs';
import {scoreComposition} from './score/composition.mjs';
import {scoreQuality} from './score/quality.mjs';
import {scoreSemantic, semanticVerdict} from './score/semantic.mjs';

const IMAGE = /\.(jpe?g|png|webp|tiff?)$/i;

/**
 * HOW CLOSE TWO ROLES HAVE TO BE BEFORE A PERSON IS ASKED.
 *
 * Deliberately tight. A gap of three tenths between "the Baalbek stone" and "a
 * generic megalith" is a real preference and the specific role wins; two
 * tenths between "the lamp shot" and "an ancient artefact" is noise, and
 * casting on noise is casting by coin toss.
 */
export const CONFIRM_MARGIN = 0.25;

/** Everything a human has dropped in, whatever they called it. */
export async function inboxFiles() {
  await mkdir(INBOX_DIR, {recursive: true});
  const names = await readdir(INBOX_DIR).catch(() => []);
  const out = [];
  for (const name of names) {
    if (!IMAGE.test(name)) continue;
    const full = path.join(INBOX_DIR, name);
    const info = await stat(full).catch(() => null);
    if (!info?.isFile() || info.size < 1024) continue;
    out.push({name, path: full, bytes: info.size});
  }
  return out;
}

/**
 * THE ORIGINAL IS SACRED.
 *
 * Copied into `assets/original/` under its content hash and never touched
 * again: not cropped, not resized, not re-encoded. Everything downstream reads
 * that copy and writes somewhere else, so a bad normalisation costs a rerun
 * rather than the file.
 *
 * The hash is the name because two people supplying the same photograph under
 * two names is one photograph, and because it makes the copy idempotent.
 */
export async function preserve(file) {
  const buffer = await readFile(file.path);
  const hash = createHash('sha256').update(buffer).digest('hex').slice(0, 20);
  const ext = path.extname(file.name).toLowerCase().replace('.jpeg', '.jpg') || '.jpg';
  const kept = path.join(ORIGINAL_DIR, `${hash}${ext}`);
  await mkdir(ORIGINAL_DIR, {recursive: true});
  const already = await stat(kept).catch(() => null);
  if (!already) await copyFile(file.path, kept);
  return {hash, original: kept, buffer, reused: Boolean(already)};
}

/**
 * SCORE ONE FILE AGAINST ONE BRIEF.
 *
 * The same three gates the acquisition layer uses, in the same order, for the
 * same reason: a human-supplied picture gets no easier a ride than a fetched
 * one. The only difference is what happens to a failure — a fetched candidate
 * is discarded, a supplied one is reported back to the person who supplied it.
 */
export async function scoreAgainst({sharp, buffer, brief, quality}) {
  /**
   * A supplied file has no description and no review, so the semantic scorer
   * would be reading a filename — which it is explicitly not allowed to trust.
   * What it CAN read is what the human said the picture is, if they said
   * anything, and that is the only text evidence here.
   */
  const candidate = {
    provider: 'inbox',
    id: brief.id,
    title: brief.humanDescription ?? null,
    description: brief.humanDescription ?? null,
    reviewed: null,
  };
  const semantic = scoreSemantic(candidate, brief);
  const composition = await scoreComposition(sharp, buffer, brief, quality);
  return {
    semantic,
    composition,
    verdict: semanticVerdict(semantic, brief),
    /**
     * One number for ranking only. The gates decide; this orders the shortlist
     * a person is shown.
     */
    rank: Number((semantic.relevance * 0.45 + quality.score * 0.3 + composition.score * 0.25).toFixed(2)),
  };
}

/**
 * MATCH ONE FILE AGAINST EVERY OPEN BRIEF.
 *
 * Returns a decision the caller may act on and a ranking a person may overrule.
 * `needsConfirmation` is the important field: it is true whenever the machine
 * is not entitled to choose.
 */
export async function matchFile({sharp, file, briefs, describe = null}) {
  const {hash, original, buffer, reused} = await preserve(file);
  const phash = await perceptualHash(sharp, buffer);

  const scored = [];
  for (const brief of briefs) {
    const withText = describe ? {...brief, humanDescription: describe} : brief;
    // Quality is a property of the file, not of the brief, but ORIENTATION fit
    // is not — so it is measured per brief and the cost is one decode each.
    const quality = await scoreQuality(sharp, buffer, withText);
    const result = await scoreAgainst({sharp, buffer, brief: withText, quality});
    scored.push({
      briefId: brief.id,
      subject: brief.subject,
      episode: brief.episode,
      rank: result.rank,
      semantic: result.semantic.relevance,
      accuracy: result.semantic.accuracy,
      quality: quality.score,
      composition: result.composition.score,
      passesSemanticGate: result.verdict.ok,
      why: result.verdict.ok ? null : result.verdict.why,
      notes: [...result.semantic.notes, ...quality.notes, ...result.composition.notes],
    });
  }
  scored.sort((a, b) => b.rank - a.rank);

  const [top, second] = scored;
  const plausible = scored.filter((s) => s.passesSemanticGate);
  /**
   * Three ways this can end, and only one of them is an assignment.
   */
  let decision;
  if (!top) decision = {kind: 'NO_BRIEFS', why: 'there are no open briefs to match against'};
  else if (!plausible.length) {
    decision = {
      kind: 'NO_MATCH',
      why: `nothing this file could be: the best of ${scored.length} brief(s) was "${top.briefId}" at ${top.semantic}/10 semantic, below the floor of 8`,
    };
  } else if (plausible.length > 1 && plausible[0].rank - plausible[1].rank < CONFIRM_MARGIN) {
    decision = {
      kind: 'NEEDS_CONFIRMATION',
      why:
        `"${plausible[0].briefId}" (${plausible[0].rank}) and "${plausible[1].briefId}" (${plausible[1].rank}) ` +
        `are within ${CONFIRM_MARGIN} of each other — casting on that difference is casting by coin toss`,
      between: plausible.slice(0, 3).map((p) => p.briefId),
    };
  } else {
    decision = {kind: 'SUGGEST', briefId: plausible[0].briefId, why: null};
  }

  return {
    file: file.name,
    hash,
    original: path.relative(path.resolve(path.dirname(new URL(import.meta.url).pathname), '..'), original),
    reused,
    bytes: file.bytes,
    phash,
    decision,
    needsConfirmation: decision.kind === 'NEEDS_CONFIRMATION',
    best: plausible[0] ?? null,
    alternatives: scored.slice(0, 5),
  };
}

/**
 * WHETHER A SUPPLIED FILE MAY BE ACCEPTED, once a brief has been chosen.
 *
 * Provenance is checked LAST and separately, because it is the one failure a
 * person can fix without finding a different picture — and it is the one this
 * layer must never paper over. No licence is inferred from a file. Ever.
 */
export function provenanceVerdict(provenance) {
  const missing = ['source', 'license'].filter((f) => !provenance?.[f]);
  if (missing.length) {
    return {
      ok: false,
      status: 'PROVENANCE_REQUIRED',
      why: `no ${missing.join(' and no ')} recorded — a file with no stated licence is not a file we may publish, and none will be inferred`,
    };
  }
  const call = judgeLicence({
    licence: provenance.license,
    licenceUrl: provenance.licenseUrl,
    source: provenance.source,
    sourceUrl: provenance.sourceUrl,
    creator: provenance.creator,
  });
  return call.ok
    ? {ok: true, status: 'ACCEPTED', family: call.family, needsCredit: call.needsCredit}
    : {ok: false, status: 'REJECTED', why: call.why};
}
