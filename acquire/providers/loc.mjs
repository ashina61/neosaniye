/**
 * LIBRARY OF CONGRESS.
 *
 * Where a documentary claim needs a DOCUMENT rather than a photograph — a
 * dated bulletin, a survey plate, a period engraving. Most of it carries "no
 * known restrictions", which is a provenance statement rather than a licence,
 * so it is recorded as exactly that and never upgraded to "public domain" on
 * the way through.
 */
import {defineProvider, getBytes, getJSON, reachable} from './provider.mjs';

const API = 'https://www.loc.gov';

export default defineProvider({
  id: 'loc',
  name: 'Library of Congress',
  homepage: API,
  probe: `${API}/photos/?q=test&fo=json&c=1`,
  kinds: ['photo', 'document', 'engraving', 'map'],

  async available() {
    return reachable(this.probe);
  },

  async search(query, {limit = 10} = {}) {
    const data = await getJSON(`${API}/photos/?q=${encodeURIComponent(query)}&fo=json&c=${limit}`);
    return (data?.results ?? []).slice(0, limit).map((r) => {
      // The image list runs small → large; the biggest is usually a TIFF the
      // size of a room, so the last JPEG is the right compromise.
      const images = (r.image_url ?? []).filter((u) => /\.(jpe?g|png)$/i.test(u));
      const url = images.at(-1) ?? r.image_url?.at(-1) ?? null;
      return {
        provider: 'loc',
        id: String(r.id ?? r.item?.id ?? ''),
        title: r.title ?? null,
        url: url && url.startsWith('//') ? `https:${url}` : url,
        originalUrl: r.url ?? null,
        width: null,
        height: null,
        mime: null,
        sourceUrl: r.url ?? null,
        creator: Array.isArray(r.contributor) ? r.contributor.join(', ') : r.contributor ?? null,
        licence: r.rights ? String(r.rights) : 'No known restrictions (Library of Congress)',
        licenceUrl: r.rights_advisory ? null : `${API}/legal/`,
        description: Array.isArray(r.description) ? r.description.join(' ') : r.description ?? null,
        date: r.date ?? null,
      };
    }).filter((c) => c.url);
  },
  async metadata(c) { return c; },
  async license(c) { return {licence: c.licence, licenceUrl: c.licenceUrl, creator: c.creator}; },
  async download(c) { return getBytes(c.url); },
});
