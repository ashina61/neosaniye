/**
 * PEXELS.
 *
 * Modern stock. Worth having for CONTEMPORARY subjects a documentary still
 * needs — a working forge, a shipping lane, hands at a bench — and worth
 * distrusting for anything historical, where its catalogue is full of
 * beautifully lit re-enactment that would fail the accuracy gate anyway.
 *
 * Needs a key. Reports `unconfigured` when there is none.
 */
import {defineProvider, getBytes, getJSON, reachable} from './provider.mjs';

const API = 'https://api.pexels.com/v1/search';

export default defineProvider({
  id: 'pexels',
  name: 'Pexels',
  homepage: 'https://www.pexels.com',
  probe: 'https://api.pexels.com/v1/search?query=test&per_page=1',
  needsKey: 'PEXELS_API_KEY',
  kinds: ['photo'],

  async available() {
    const key = process.env[this.needsKey];
    if (!key) {
      const net = await reachable(this.probe);
      return net.ok
        ? {ok: false, why: 'unconfigured', detail: `${this.needsKey} is not set (host is reachable)`}
        : {ok: false, why: net.why, detail: net.detail};
    }
    try {
      await getJSON(`${API}?query=test&per_page=1`, {headers: {Authorization: key}});
      return {ok: true, detail: 'authorised'};
    } catch (error) {
      const status = error?.status;
      if (status === 401) return {ok: false, why: 'unconfigured', detail: 'the supplied key was rejected'};
      return reachable(this.probe);
    }
  },

  async search(query, {limit = 10, orientation} = {}) {
    const key = process.env[this.needsKey];
    const url =
      `${API}?query=${encodeURIComponent(query)}&per_page=${limit}` +
      (orientation ? `&orientation=${orientation}` : '');
    const data = await getJSON(url, {headers: {Authorization: key}});
    return (data?.photos ?? []).map((p) => ({
      provider: 'pexels',
      id: String(p.id),
      title: p.alt || null,
      url: p.src?.large2x ?? p.src?.large ?? p.src?.original,
      originalUrl: p.src?.original ?? null,
      width: p.width ?? null,
      height: p.height ?? null,
      mime: null,
      sourceUrl: p.url ?? null,
      creator: p.photographer ?? null,
      licence: 'Pexels License',
      licenceUrl: 'https://www.pexels.com/license/',
      description: p.alt ?? null,
      date: null,
    }));
  },
  async metadata(c) { return c; },
  async license(c) { return {licence: c.licence, licenceUrl: c.licenceUrl, creator: c.creator}; },
  async download(c) { return getBytes(c.url); },
});
