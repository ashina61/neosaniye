/**
 * THE PROVIDER CONTRACT.
 *
 * An asset provider is four functions and a name. Nothing above this file knows
 * whether a picture came from a museum's API, a stock library or a directory on
 * disk, and nothing below it knows what the picture is for — which is the only
 * reason a provider can be replaced without touching the acquisition logic, and
 * the acquisition logic without touching eight providers.
 *
 *   search(query, brief)  → candidates, newest-relevant first
 *   metadata(candidate)   → whatever the provider knows that search did not
 *   license(candidate)    → the licence, normalised
 *   download(candidate)   → bytes on disk
 *
 * A CANDIDATE is not an asset. It is a claim that an asset exists, made by a
 * remote service, and the acquisition layer's whole job is to disbelieve it
 * until it has been scored. So `search` returns the least it can get away with
 * and `download` is called for at most a handful of survivors — a provider that
 * downloads everything it finds is a provider that costs a gigabyte per line.
 *
 * AVAILABILITY IS A FACT, NOT A HOPE. Every provider is preflighted before it
 * is used and marked unavailable if it cannot be reached. The alternative —
 * treating a 403 as an empty result set — produces a run that reports "no
 * suitable images found" for an environment that never made a request, which is
 * the most expensive lie this layer could tell.
 */

/** What every provider must expose. Checked at registration, not at call time. */
const REQUIRED = ['id', 'name', 'homepage', 'search', 'download', 'metadata', 'license'];

/**
 * WHY A PROVIDER IS NOT BEING USED.
 *
 * Kept as an enum because the benchmark has to report it and "it didn't work"
 * is not a report. `blocked` means the network refused us; `unconfigured` means
 * the provider needs a key nobody supplied; `failing` means it answered and the
 * answer was unusable.
 */
export const UNAVAILABLE = {
  blocked: 'blocked — the network refused the connection (egress policy or firewall)',
  unconfigured: 'unconfigured — this provider needs an API key that is not set',
  failing: 'failing — the provider answered but the response was unusable',
  timeout: 'timeout — the provider did not answer in time',
};

export function defineProvider(spec) {
  for (const key of REQUIRED) {
    if (!(key in spec)) throw new Error(`provider "${spec.id ?? '?'}" is missing ${key}`);
  }
  return {
    /**
     * Whether the provider needs a key, and whether it has one. Separated from
     * reachability so a report can distinguish "we have no key for Pexels" from
     * "Pexels is unreachable" — those need different actions from a human.
     */
    needsKey: null,
    /** Preflight. Overridden by providers that can check more cheaply. */
    async available() {
      if (this.needsKey && !process.env[this.needsKey]) {
        return {ok: false, why: 'unconfigured', detail: `${this.needsKey} is not set`};
      }
      return reachable(this.probe ?? this.homepage);
    },
    ...spec,
  };
}

/**
 * ONE HTTP HELPER, so every provider fails the same way.
 *
 * Timeouts are short on purpose. A provider that takes thirty seconds to answer
 * a search is a provider that turns a five-episode run into an afternoon, and
 * the acquisition layer has seven others to try.
 */
export async function getJSON(url, {headers = {}, timeout = 20_000} = {}) {
  const response = await fetch(url, {
    headers: {'User-Agent': UA, Accept: 'application/json', ...headers},
    signal: AbortSignal.timeout(timeout),
  });
  if (!response.ok) {
    const error = new Error(`HTTP ${response.status} from ${new URL(url).host}`);
    error.status = response.status;
    throw error;
  }
  return response.json();
}

export async function getBytes(url, {headers = {}, timeout = 90_000} = {}) {
  const response = await fetch(url, {
    headers: {'User-Agent': UA, ...headers},
    signal: AbortSignal.timeout(timeout),
  });
  if (!response.ok) {
    const error = new Error(`HTTP ${response.status} from ${new URL(url).host}`);
    error.status = response.status;
    throw error;
  }
  return Buffer.from(await response.arrayBuffer());
}

/**
 * Automated clients identify themselves. Wikimedia asks for it explicitly and
 * several of the archives rate-limit anonymous traffic harder.
 */
export const UA = 'neosaniye-reels/1.0 (documentary reel asset acquisition; https://github.com/ashina61/neosaniye)';

/**
 * CAN WE REACH IT AT ALL — and WHY NOT, precisely.
 *
 * The distinction that matters is between a refusal at the CONNECT stage (the
 * egress policy said no, and no request was ever made) and an error from the
 * service itself (we reached it and it complained). The first is an environment
 * fact to report; the second is a provider fact to work around.
 */
export async function reachable(url, {timeout = 15_000} = {}) {
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {'User-Agent': UA},
      signal: AbortSignal.timeout(timeout),
    });
    if (response.status === 403 || response.status === 407) {
      return {ok: false, why: 'blocked', detail: `HTTP ${response.status} at ${new URL(url).host}`};
    }
    return {ok: true, detail: `HTTP ${response.status}`};
  } catch (error) {
    const text = String(error?.cause?.message ?? error?.message ?? error);
    if (/timeout|abort|timed out/i.test(text)) return {ok: false, why: 'timeout', detail: text};
    /**
     * A proxy that answers 403 to CONNECT surfaces in undici as a fetch failure
     * rather than as a response, so the reason has to be read out of the cause.
     * Without this branch every blocked host is reported as "failing", and a
     * report that cannot tell a firewall from a broken API is not a report.
     */
    if (/403|forbidden|proxy|tunnel|CONNECT|EPROTO|ECONNREFUSED|ENOTFOUND|EAI_AGAIN/i.test(text)) {
      return {ok: false, why: 'blocked', detail: text};
    }
    return {ok: false, why: 'failing', detail: text};
  }
}

/** Normalise whatever a provider calls a licence into something decidable. */
export function normaliseLicence(raw) {
  const text = String(raw ?? '').trim();
  if (!text) return {id: null, name: null, url: null, free: false, needsCredit: true, why: 'no licence stated'};
  const lower = text.toLowerCase();
  const url = /^https?:\/\//.test(text) ? text : null;
  const id = lower
    .replace(/^https?:\/\/creativecommons\.org\/(licenses|publicdomain)\//, '')
    .replace(/\/+$/, '')
    .replace(/\//g, '-');
  return {id: id || lower, name: text, url, free: null, needsCredit: null, why: null};
}
