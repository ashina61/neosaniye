/**
 * INTERNET ARCHIVE.
 *
 * The last resort among the archives and the widest: scanned books, museum
 * uploads, film stills. Its metadata is whatever the uploader typed, which is
 * why its licence field is treated with more suspicion than any other
 * provider's — an item marked "publicdomain" by a stranger is a claim, and the
 * licence gate reads it as one.
 */
import {defineProvider, getBytes, getJSON, reachable} from './provider.mjs';

const API = 'https://archive.org';

export default defineProvider({
  id: 'archive',
  name: 'Internet Archive',
  homepage: API,
  probe: `${API}/advancedsearch.php?q=test&rows=1&output=json`,
  kinds: ['photo', 'document', 'scan'],

  async available() {
    return reachable(this.probe);
  },

  async search(query, {limit = 10} = {}) {
    const q = `${query} AND mediatype:(image)`;
    const url =
      `${API}/advancedsearch.php?q=${encodeURIComponent(q)}` +
      `&fl[]=identifier&fl[]=title&fl[]=creator&fl[]=licenseurl&fl[]=rights&fl[]=date&fl[]=description` +
      `&rows=${limit}&page=1&output=json`;
    const data = await getJSON(url);
    return (data?.response?.docs ?? []).map((d) => ({
      provider: 'archive',
      id: String(d.identifier),
      title: d.title ?? null,
      // `services/img` is the archive's own derivative endpoint, so this does
      // not have to guess a filename out of the item's file listing.
      url: `${API}/services/img/${d.identifier}`,
      originalUrl: `${API}/details/${d.identifier}`,
      width: null,
      height: null,
      mime: null,
      sourceUrl: `${API}/details/${d.identifier}`,
      creator: Array.isArray(d.creator) ? d.creator.join(', ') : d.creator ?? null,
      licence: d.licenseurl ?? d.rights ?? null,
      licenceUrl: d.licenseurl ?? null,
      description: Array.isArray(d.description) ? d.description.join(' ') : d.description ?? null,
      date: d.date ?? null,
    }));
  },
  async metadata(c) { return c; },
  async license(c) { return {licence: c.licence, licenceUrl: c.licenceUrl, creator: c.creator}; },
  async download(c) { return getBytes(c.url); },
});
