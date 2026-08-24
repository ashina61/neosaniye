#!/usr/bin/env node
/**
 * ACQUIRE THE PICTURES AN EPISODE ASKED FOR.
 *
 *   node scripts/acquire-assets.mjs --episode=baalbek[,hormuz] [--force] [--dry]
 *
 * Reads the ASSET_REQUIRED briefs the manifest already wrote, turns each into a
 * decidable brief, climbs the ladder, and writes three files:
 *
 *   ASSET_MANIFEST.json   what was accepted, with full provenance
 *   CREDITS.md            the attribution the licences require, per episode
 *   asset-review.json     every candidate and why it was refused
 *
 * It does NOT touch the scene config. Acquisition and rendering are separate
 * steps for the same reason generation and rendering are: if a provider breaks,
 * the acquisition step fails loudly and a finished episode does not silently
 * change.
 */
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {acquireOne, makeLedger, preflight, settle} from '../acquire/acquire.mjs';
import {briefFrom, briefProblems} from '../acquire/brief.mjs';
import {creditLine} from '../acquire/licence.mjs';
import {generationConfigured, usableRungs} from '../acquire/ladder.mjs';
import {episodeDir, exists, parseArgs} from './lib/episode.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

/** What the reel already draws for a line, so the ladder can settle honestly. */
async function drawnFor(episode) {
  const file = path.join(episodeDir(episode), 'scene-config.json');
  if (!(await exists(file))) return {};
  const config = JSON.parse(await readFile(file, 'utf8'));
  const out = {};
  for (const scene of config.scenes ?? []) {
    if (!scene.diagram) continue;
    const slug = String(scene.id).replace(/^s\d+-/, '').replace(/-[a-z]$/, '');
    out[slug] ??= scene.diagram.type;
  }
  return out;
}

async function runEpisode(episode, availability, {force, dry}) {
  const dir = episodeDir(episode);
  const required = path.join(dir, 'assets.required.json');
  if (!(await exists(required))) {
    return {episode, error: 'no assets.required.json — run scripts/asset-manifest.mjs first'};
  }
  const manifest = JSON.parse(await readFile(required, 'utf8'));
  const drawn = await drawnFor(episode);
  const ledger = makeLedger();

  const results = [];
  for (const entry of manifest.wanted ?? []) {
    const brief = briefFrom(entry, {episode});
    const problems = briefProblems(brief);
    if (problems.length) {
      results.push({line: brief.line, brief, error: problems, settled: null});
      continue;
    }
    const {best, attempts} = dry
      ? {best: null, attempts: [{skipped: 'dry run: no provider was contacted'}]}
      : await acquireOne({brief, availability, ledger, sharp, force});

    if (best) {
      ledger.record({
        candidate: best.candidate ?? {provider: best.provider, id: best.id},
        buffer: best.buffer,
        phash: best.phash,
        composition: best.composition,
        line: brief.line,
      });
    }
    const settled = settle({brief, accepted: best, drawn: drawn[brief.line] ?? null});
    results.push({line: brief.line, brief, best: best ? strip(best) : null, attempts, settled});
  }

  /**
   * ONLY WHAT WAS ACCEPTED GOES IN THE MANIFEST, and it goes in with everything
   * a licence audit would ask for. An entry that cannot answer "where did this
   * come from" is not an entry, it is a liability.
   */
  const accepted = results.filter((r) => r.best);
  const assetManifest = {
    episode,
    generatedAt: new Date().toISOString(),
    $note:
      'Every entry here is a file this pipeline downloaded, scored, licence-checked and accepted. ' +
      'Provenance is not optional: an asset with no source is not public domain, it is an asset with no source.',
    providersUsed: [...new Set(accepted.map((r) => r.best.provider))],
    assets: accepted.map((r) => ({
      line: r.line,
      subject: r.brief.subject,
      title: r.best.title ?? null,
      /**
       * WHERE IT CAME FROM ORIGINALLY, not where we happened to read it.
       *
       * The local corpus is a CACHE of the archives, so recording "local" as
       * the source of a Wikimedia photograph is not provenance, it is the
       * absence of it — and provenance is the only thing a public-domain or
       * CC-BY claim rests on. `via` keeps the fact that this run did not touch
       * the network, which the benchmark needs and the credit does not.
       */
      source: originOf(r.best),
      via: r.best.provider,
      sourceUrl: r.best.sourceUrl,
      creator: r.best.candidate?.creator ?? null,
      licence: r.best.candidate?.licence ?? null,
      licenceUrl: r.best.candidate?.licenceUrl ?? null,
      licenceFamily: r.best.licence?.family ?? null,
      needsCredit: r.best.licence?.needsCredit ?? true,
      retrieved: new Date().toISOString().slice(0, 10),
      assetId: r.best.id,
      localFile: r.best.file ? path.relative(ROOT, r.best.file) : null,
      scores: {
        semanticRelevance: r.best.semantic?.relevance ?? null,
        historicalAccuracy: r.best.semantic?.accuracy ?? null,
        quality: r.best.quality?.score ?? null,
        composition: r.best.composition?.score ?? null,
        rank: r.best.rank ?? null,
      },
    })),
  };

  /** Everything that happened, refusals included — the point of the exercise. */
  const review = {
    episode,
    generatedAt: new Date().toISOString(),
    providers: availability,
    ladder: usableRungs(availability).map(({n, id, label, usable, because}) => ({n, id, label, usable, because})),
    generationConfigured: generationConfigured(),
    requested: results.length,
    accepted: accepted.length,
    rejected: results.reduce((n, r) => n + (r.attempts ?? []).filter((a) => a.accepted === false).length, 0),
    lines: results.map((r) => ({
      line: r.line,
      subject: r.brief?.subject ?? null,
      domain: r.brief?.domain ?? null,
      priority: r.brief?.priority ?? null,
      settled: r.settled,
      accepted: r.best
        ? {
            provider: r.best.provider,
            id: r.best.id,
            title: r.best.title,
            rank: r.best.rank,
            licence: r.best.licence?.family ?? null,
          }
        : null,
      candidates: (r.attempts ?? [])
        .filter((a) => a.accepted !== undefined)
        .map((a) => ({
          provider: a.provider,
          id: a.id,
          title: a.title,
          accepted: a.accepted,
          rejectedAt: a.accepted ? null : a.stage,
          why: a.why,
          semantic: a.semantic ? {relevance: a.semantic.relevance, accuracy: a.semantic.accuracy, evidence: a.semantic.evidence} : null,
          quality: a.quality?.score ?? null,
          composition: a.composition?.score ?? null,
        })),
      searched: (r.attempts ?? []).filter((a) => a.found !== undefined || a.failed || a.skipped),
    })),
  };

  if (!dry) {
    await mkdir(dir, {recursive: true});
    await writeFile(path.join(dir, 'ASSET_MANIFEST.json'), `${JSON.stringify(assetManifest, null, 2)}\n`, 'utf8');
    await writeFile(path.join(dir, 'asset-review.json'), `${JSON.stringify(review, null, 2)}\n`, 'utf8');
    await writeFile(path.join(dir, 'CREDITS.md'), credits(episode, assetManifest), 'utf8');
  }

  return {episode, manifest: assetManifest, review};
}


/**
 * THE ORIGINAL PUBLISHER, read out of the source URL.
 *
 * A file in the local corpus was fetched from somewhere, and that somewhere is
 * what a licence names. Falls back to the provider only when there is no source
 * URL to read — in which case the licence gate has already refused it, because
 * a licence claim with no source is not a licence claim.
 */
const ORIGINS = [
  [/(^|\.)wikimedia\.org$|(^|\.)wikipedia\.org$/, 'Wikimedia Commons'],
  [/(^|\.)openverse\.org$/, 'Openverse'],
  [/(^|\.)loc\.gov$/, 'Library of Congress'],
  [/(^|\.)archive\.org$/, 'Internet Archive'],
  [/(^|\.)europeana\.eu$/, 'Europeana'],
  [/(^|\.)nasa\.gov$/, 'NASA'],
  [/(^|\.)pexels\.com$/, 'Pexels'],
  [/(^|\.)pixabay\.com$/, 'Pixabay'],
];

function originOf(best) {
  const url = best?.sourceUrl;
  if (!url) return best?.provider ?? 'unrecorded';
  let host;
  try {
    host = new URL(url).host;
  } catch {
    return best?.provider ?? 'unrecorded';
  }
  for (const [pattern, name] of ORIGINS) if (pattern.test(host)) return name;
  return host;
}

function strip(best) {
  const {buffer, ...rest} = best;
  return rest;
}

/**
 * THE CREDIT FILE, and it says what it is for.
 *
 * CC BY and CC BY-SA require attribution WHEREVER THE WORK IS PUBLISHED, which
 * means in the reel's description and not only in a repository nobody reading
 * the description will open.
 */
function credits(episode, manifest) {
  const needing = manifest.assets.filter((a) => a.needsCredit);
  const lines = [
    `# Image credits — ${episode}`,
    '',
    'These are the attributions the licences on this episode require. CC BY and',
    'CC BY-SA require credit **wherever the reel is published** — in the video',
    "description, not only in this file. Public-domain entries need no credit but",
    'keep their provenance here, because a public-domain claim with no source is',
    'not a public-domain claim.',
    '',
  ];
  if (!manifest.assets.length) {
    lines.push('_No external assets were accepted for this episode._', '');
    return `${lines.join('\n')}\n`;
  }
  for (const asset of manifest.assets) {
    lines.push(`## ${path.basename(asset.localFile ?? asset.assetId)}`);
    lines.push(`- Used for: ${asset.line} — ${asset.subject}`);
    lines.push(`- ${creditLine({creator: asset.creator, title: asset.title ?? asset.subject, licence: asset.licence, source: asset.source, sourceUrl: asset.sourceUrl})}`);
    lines.push(`- Retrieved: ${asset.retrieved}`);
    lines.push(`- Credit required: ${asset.needsCredit ? 'yes' : 'no (public domain, provenance recorded above)'}`);
    lines.push('');
  }
  lines.push(`_${needing.length} of ${manifest.assets.length} asset(s) require attribution._`, '');
  return `${lines.join('\n')}\n`;
}

async function main() {
  const args = parseArgs();
  const ids = typeof args.episode === 'string' ? args.episode.split(',').map((s) => s.trim()) : [];
  if (!ids.length) {
    console.error('Usage: node scripts/acquire-assets.mjs --episode=<id>[,<id>…] [--force] [--dry]');
    process.exit(1);
  }
  const force = args.force === true || args.force === 'true';
  const dry = args.dry === true || args.dry === 'true';

  console.log('preflighting providers…');
  const availability = await preflight();
  for (const p of availability) {
    const mark = p.available ? '  ok  ' : ' DOWN ';
    console.log(`${mark}${p.id.padEnd(11)} ${p.available ? p.detail ?? '' : `${p.why}: ${p.detail ?? ''}`}`);
  }
  const live = availability.filter((p) => p.available);
  if (!live.length) {
    console.error('\nNo provider is reachable. Nothing can be acquired; the run will report that rather than invent it.');
  }
  console.log('');

  for (const id of ids) {
    const out = await runEpisode(id, availability, {force, dry});
    if (out.error) {
      console.error(`✗ ${id} — ${out.error}`);
      continue;
    }
    const {review} = out;
    const holes = review.lines.filter((l) => l.settled?.resolution === 'REPRESENTATION_REQUIRED').length;
    console.log(
      `✓ ${id} — ${review.requested} requested · ${review.accepted} accepted · ` +
        `${review.rejected} candidate(s) rejected · ${holes} REPRESENTATION_REQUIRED`,
    );
  }
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
