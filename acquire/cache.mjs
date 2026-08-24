/**
 * DOWNLOAD ONCE.
 *
 * A run that re-fetches what it already has is slow, rude to the archives it
 * depends on, and — the part that actually costs — NOT REPRODUCIBLE, because a
 * search index moves and the second fetch is a different picture. The cache is
 * what makes "run the benchmark again" mean the same thing twice.
 *
 * The key is provider + asset id + variant, and nothing else. Not the query, not
 * the brief, not the episode: the same file requested for two different lines is
 * the same file, and keying on the request would store it twice and then fail to
 * notice it was a duplicate.
 */
import {createHash} from 'node:crypto';
import {mkdir, readFile, stat, writeFile} from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
export const CACHE_DIR = path.join(ROOT, '.asset-cache');

export function cacheKey({provider, id, variant = 'default'}) {
  return createHash('sha256').update(`${provider} ${id} ${variant}`).digest('hex').slice(0, 32);
}

function extensionFor(candidate) {
  const from = candidate.mime?.split('/')?.[1] ?? path.extname(String(candidate.url ?? '')).replace('.', '');
  const clean = String(from).toLowerCase().replace(/[^a-z0-9]/g, '');
  return ['jpg', 'jpeg', 'png', 'webp', 'gif', 'tiff'].includes(clean) ? clean : 'jpg';
}

export function cachePath(candidate, variant = 'default') {
  const key = cacheKey({provider: candidate.provider, id: candidate.id, variant});
  return path.join(CACHE_DIR, `${key}.${extensionFor(candidate)}`);
}

const sidecar = (file) => `${file}.json`;

/**
 * Fetch through the cache. Returns the bytes and says which it was, because a
 * report that cannot distinguish a cache hit from a download cannot tell you
 * whether the network was used at all.
 */
export async function cached(candidate, {variant = 'default', fetcher, force = false} = {}) {
  const file = cachePath(candidate, variant);
  await mkdir(CACHE_DIR, {recursive: true});
  if (!force) {
    const info = await stat(file).catch(() => null);
    if (info && info.size > 0) {
      return {buffer: await readFile(file), file, hit: true, bytes: info.size};
    }
  }
  const buffer = await fetcher(candidate);
  if (!buffer?.length) throw new Error(`empty download from ${candidate.provider}:${candidate.id}`);
  await writeFile(file, buffer);
  await writeFile(
    sidecar(file),
    `${JSON.stringify({provider: candidate.provider, id: candidate.id, variant, url: candidate.url, retrieved: new Date().toISOString()}, null, 2)}\n`,
    'utf8',
  );
  return {buffer, file, hit: false, bytes: buffer.length};
}

/** The content hash, which is what deduplication actually compares. */
export function contentHash(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}
