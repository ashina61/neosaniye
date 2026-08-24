/**
 * THE LOCAL CORPUS — rung one of the ladder, and a real provider.
 *
 * Everything this repository has already fetched, reviewed and paid the licence
 * cost of. It is a provider rather than a special case for two reasons.
 *
 * The first is that it satisfies the same contract, so the orchestrator does
 * not need a branch for it: search, score, licence, accept. A pipeline with one
 * privileged input path is a pipeline whose privileged path is never tested.
 *
 * The second is that it is genuinely a source. A photograph fetched for one
 * episode is a photograph; nothing about it belongs to that episode, and a reel
 * about Roman concrete has every right to a Commons image of a Roman wall that
 * arrived eight months ago for a different reel. The alternative — re-fetching
 * per episode — pays twice for the same file and gets a different one when the
 * search index has moved on.
 *
 * It is also the only provider that can supply a HUMAN semantic score. The
 * review sidecar is somebody who looked at the file writing down what it
 * actually depicts, and that judgement outranks anything derived from a
 * filename, which is the whole reason the sidecar exists.
 */
import {createHash} from 'node:crypto';
import {readFile, readdir, stat} from 'node:fs/promises';
import path from 'node:path';
import {defineProvider} from './provider.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const EPISODES = path.join(ROOT, 'episodes');
const IMAGE = /\.(jpe?g|png|webp)$/i;

/** Provenance, parsed back out of the CREDITS.md the fetcher wrote. */
async function creditsFor(dir) {
  const file = path.join(dir, 'CREDITS.md');
  let text;
  try {
    text = await readFile(file, 'utf8');
  } catch {
    return {};
  }
  const out = {};
  // Blocks are "## filename" followed by "- **Title**" / "- Author:" / … lines.
  for (const block of text.split(/^## /m).slice(1)) {
    const [head, ...rest] = block.split('\n');
    const name = head.trim();
    const body = rest.join('\n');
    const grab = (label) => body.match(new RegExp(`^- ${label}:\\s*(.+)$`, 'm'))?.[1]?.trim() ?? null;
    out[name] = {
      title: body.match(/^- \*\*(.+?)\*\*\s*$/m)?.[1]?.trim() ?? null,
      creator: grab('Author'),
      licence: grab('Licence') ?? grab('License'),
      sourceUrl: grab('Source'),
    };
  }
  return out;
}

/** What a person who looked at the file wrote down about it. */
async function reviewFor(episodeDir) {
  try {
    return JSON.parse(await readFile(path.join(episodeDir, 'assets.review.json'), 'utf8'));
  } catch {
    return {};
  }
}

/**
 * WHICH LINES A FILE IS CURRENTLY CAST IN.
 *
 * The review sidecar holds one entry per FILE, and its numbers were written
 * against the role that file plays — "9 as a dark museum ground", not "9". So
 * the scores are only transferable to the line the file is actually cast in,
 * and this is how that is established: from the scene config, which is the only
 * record of what was cast where.
 */
async function castingFor(episodeDir) {
  const out = new Map();
  let config;
  try {
    config = JSON.parse(await readFile(path.join(episodeDir, 'scene-config.json'), 'utf8'));
  } catch {
    return out;
  }
  for (const scene of config.scenes ?? []) {
    const slug = String(scene.id ?? '').replace(/^s\d+-/, '').replace(/-[a-z]$/, '');
    const files = [
      ...Object.values(scene.assets ?? {}),
      ...(scene.layers ?? []).map((l) => l.asset),
    ].filter(Boolean);
    for (const file of files) {
      const name = String(file).split('/').pop();
      if (!out.has(name)) out.set(name, new Set());
      out.get(name).add(slug);
    }
  }
  return out;
}

async function corpus() {
  const out = [];
  let episodes;
  try {
    episodes = await readdir(EPISODES, {withFileTypes: true});
  } catch {
    return out;
  }
  for (const entry of episodes) {
    if (!entry.isDirectory()) continue;
    const episodeDir = path.join(EPISODES, entry.name);
    const assetDir = path.join(episodeDir, 'assets');
    let files;
    try {
      files = await readdir(assetDir);
    } catch {
      continue;
    }
    const credits = await creditsFor(assetDir);
    const review = await reviewFor(episodeDir);
    const casting = await castingFor(episodeDir);
    for (const file of files) {
      if (!IMAGE.test(file)) continue;
      const full = path.join(assetDir, file);
      const info = await stat(full).catch(() => null);
      if (!info || info.size < 1024) continue;
      const credit = credits[file] ?? {};
      const reviewed = review[file] ?? null;
      out.push({
        provider: 'local',
        /** Stable across runs and across episodes: the path is the identity. */
        id: createHash('sha1').update(path.relative(ROOT, full)).digest('hex').slice(0, 16),
        title: credit.title ?? file,
        url: full,
        originalUrl: credit.sourceUrl ?? null,
        localPath: full,
        bytes: info.size,
        sourceUrl: credit.sourceUrl ?? null,
        creator: credit.creator ?? null,
        licence: credit.licence ?? null,
        licenceUrl: null,
        /**
         * The words a person used for what is in the picture. This is the
         * search corpus AND the evidence for the semantic score — a file with
         * a review is judged on the review, not on its name.
         */
        description: reviewed?.depicts ?? null,
        reviewed: reviewed
          ? {relevance: reviewed.relevance, accuracy: reviewed.accuracy, subject: reviewed.subject, note: reviewed.note}
          : null,
        fromEpisode: entry.name,
        /** The lines this file is cast in today; empty means it is cast in none. */
        castIn: [...(casting.get(file) ?? [])],
        date: null,
      });
    }
  }
  return out;
}

let cached = null;

export default defineProvider({
  id: 'local',
  name: 'Local reviewed corpus',
  homepage: 'file://episodes/*/assets',
  kinds: ['photo', 'document', 'texture'],

  /** Always available: it is a directory. Empty is a result, not a failure. */
  async available() {
    const files = await corpus();
    return {ok: true, detail: `${files.length} reviewed file(s) on disk`};
  },

  async search(query, {limit = 12} = {}) {
    cached ??= await corpus();
    const terms = String(query)
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length > 2);
    if (!terms.length) return cached.slice(0, limit);
    /**
     * A word in what somebody WROTE the picture is of counts double a word in
     * its filename. Filenames are what the pipeline chose to call a role; the
     * description is what a person saw.
     */
    const scored = cached.map((c) => {
      const described = String(c.description ?? '').toLowerCase();
      const named = `${c.title ?? ''} ${path.basename(c.url)}`.toLowerCase();
      let hits = 0;
      for (const term of terms) {
        if (described.includes(term)) hits += 2;
        else if (named.includes(term)) hits += 1;
      }
      return {c, hits};
    });
    return scored
      .filter((s) => s.hits > 0)
      .sort((a, b) => b.hits - a.hits)
      .slice(0, limit)
      .map((s) => s.c);
  },

  async metadata(c) { return c; },
  async license(c) { return {licence: c.licence, licenceUrl: c.licenceUrl, creator: c.creator}; },
  async download(c) { return readFile(c.localPath); },
});
