/**
 * OPENVERSE — the CC search index, which is several hundred sources at once.
 *
 * Its value here is breadth for the generic half of a brief: "hands forging",
 * "limestone quarry", "arterial blood". Its licence metadata is normalised
 * across sources, which makes it the cheapest provider to gate correctly.
 */
import {defineProvider, getBytes, getJSON, reachable} from './provider.mjs';

const API = 'https://api.openverse.org/v1/images/';

export default defineProvider({
  id: 'openverse',
  name: 'Openverse',
  homepage: 'https://openverse.org',
  probe: `${API}?q=test&page_size=1`,
  kinds: ['photo', 'illustration'],

  async available() {
    return reachable(this.probe);
  },

  async search(query, {limit = 12} = {}) {
    // `license_type=commercial,modification` is the licence gate expressed as a
    // query: the API can exclude NC and ND before they cost a round trip.
    const url =
      `${API}?q=${encodeURIComponent(query)}&page_size=${limit}` +
      `&license_type=commercial,modification&mature=false`;
    const data = await getJSON(url);
    return (data?.results ?? []).map((r) => ({
      provider: 'openverse',
      id: String(r.id),
      title: r.title ?? null,
      url: r.url,
      originalUrl: r.url,
      width: r.width ?? null,
      height: r.height ?? null,
      mime: null,
      sourceUrl: r.foreign_landing_url ?? null,
      creator: r.creator ?? null,
      licence: r.license ? `${r.license} ${r.license_version ?? ''}`.trim() : null,
      licenceUrl: r.license_url ?? null,
      description: r.tags?.map((t) => t.name).join(', ') ?? null,
      date: null,
    }));
  },
  async metadata(c) { return c; },
  async license(c) { return {licence: c.licence, licenceUrl: c.licenceUrl, creator: c.creator}; },
  async download(c) { return getBytes(c.url); },
});
