/**
 * THE REGISTRY, AND THE PREFLIGHT THAT DECIDES WHO IS IN THE RUN.
 *
 * Order is preference, not fallback: `local` first because a file already
 * reviewed and paid for is worth more than a fresh search result, then the
 * archives (accurate, free, licence-clean), then the stock libraries (broad,
 * modern, and the most likely to offer beautiful pictures of the wrong thing).
 *
 * Every one is preflighted ONCE per run and the result is carried into the
 * report. This is the difference between "no suitable images were found" and
 * "no request was ever made", and only one of those is a finding.
 */
import archive from './archive.mjs';
import commons from './commons.mjs';
import europeana from './europeana.mjs';
import loc from './loc.mjs';
import local from './local.mjs';
import nasa from './nasa.mjs';
import openverse from './openverse.mjs';
import pexels from './pexels.mjs';
import pixabay from './pixabay.mjs';
import {UNAVAILABLE} from './provider.mjs';

export const PROVIDERS = [local, commons, openverse, loc, archive, europeana, nasa, pexels, pixabay];

export function providerById(id) {
  return PROVIDERS.find((p) => p.id === id) ?? null;
}

/**
 * Ask every provider whether it can be reached, in parallel and once.
 *
 * Serial preflight of nine providers against a firewall costs nine timeouts;
 * in parallel it costs one. That matters because the honest answer in a blocked
 * environment is the SLOW one — every provider has to actually be tried.
 */
export async function preflight({only = null, timeoutMs = 20_000} = {}) {
  const wanted = only ? PROVIDERS.filter((p) => only.includes(p.id)) : PROVIDERS;
  const results = await Promise.all(
    wanted.map(async (provider) => {
      const started = Date.now();
      let verdict;
      try {
        verdict = await Promise.race([
          provider.available(),
          new Promise((resolve) =>
            setTimeout(() => resolve({ok: false, why: 'timeout', detail: `no answer in ${timeoutMs}ms`}), timeoutMs),
          ),
        ]);
      } catch (error) {
        verdict = {ok: false, why: 'failing', detail: String(error?.message ?? error)};
      }
      return {
        id: provider.id,
        name: provider.name,
        homepage: provider.homepage,
        needsKey: provider.needsKey ?? null,
        available: Boolean(verdict.ok),
        why: verdict.ok ? null : verdict.why,
        reason: verdict.ok ? null : UNAVAILABLE[verdict.why] ?? verdict.why,
        detail: verdict.detail ?? null,
        ms: Date.now() - started,
      };
    }),
  );
  return results;
}
