/**
 * EUROPEANA — the aggregated collections of European museums and libraries.
 *
 * The strongest provider for anything European and historical, and the one most
 * likely to hold the actual object rather than a photograph of a replica. Needs
 * a free API key, so it reports `unconfigured` rather than `blocked` when
 * nobody has supplied one — a distinction a person acting on the report needs.
 */
import {defineProvider, getBytes, getJSON, reachable} from './provider.mjs';

const API = 'https://api.europeana.eu/record/v2/search.json';

export default defineProvider({
  id: 'europeana',
  name: 'Europeana',
  homepage: 'https://www.europeana.eu',
  probe: `${API}?wskey=probe&query=test`,
  needsKey: 'EUROPEANA_API_KEY',
  kinds: ['photo', 'artefact', 'document', 'painting'],

  async available() {
    if (!process.env[this.needsKey]) {
      // Reachability is still worth knowing: a key can be supplied in a minute,
      // an egress policy cannot.
      const net = await reachable(this.probe);
      return net.ok
        ? {ok: false, why: 'unconfigured', detail: `${this.needsKey} is not set (host is reachable)`}
        : {ok: false, why: net.why, detail: net.detail};
    }
    return reachable(`${API}?wskey=${process.env[this.needsKey]}&query=test&rows=1`);
  },

  async search(query, {limit = 10} = {}) {
    const key = process.env[this.needsKey];
    const url =
      `${API}?wskey=${key}&query=${encodeURIComponent(query)}&rows=${limit}` +
      `&media=true&thumbnail=true&reusability=open&profile=rich`;
    const data = await getJSON(url);
    return (data?.items ?? []).map((it) => ({
      provider: 'europeana',
      id: String(it.id),
      title: it.title?.[0] ?? null,
      url: it.edmIsShownBy?.[0] ?? it.edmPreview?.[0] ?? null,
      originalUrl: it.edmIsShownAt?.[0] ?? null,
      width: null,
      height: null,
      mime: null,
      sourceUrl: it.guid ?? null,
      creator: it.dcCreator?.[0] ?? it.dataProvider?.[0] ?? null,
      licence: it.rights?.[0] ?? null,
      licenceUrl: it.rights?.[0] ?? null,
      description: it.dcDescription?.[0] ?? null,
      date: it.year?.[0] ?? null,
    })).filter((c) => c.url);
  },
  async metadata(c) { return c; },
  async license(c) { return {licence: c.licence, licenceUrl: c.licenceUrl, creator: c.creator}; },
  async download(c) { return getBytes(c.url); },
});
