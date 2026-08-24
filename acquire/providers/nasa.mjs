/**
 * NASA IMAGE LIBRARY.
 *
 * Narrow and excellent: everything in it is a real photograph or a real
 * instrument's output, and NASA material is generally not copyrighted. Useless
 * for a medieval forge, irreplaceable for anything celestial or orbital — which
 * is a fair description of what a specialised provider should be.
 */
import {defineProvider, getBytes, getJSON, reachable} from './provider.mjs';

const API = 'https://images-api.nasa.gov';

export default defineProvider({
  id: 'nasa',
  name: 'NASA Image and Video Library',
  homepage: 'https://images.nasa.gov',
  probe: `${API}/search?q=moon&media_type=image`,
  kinds: ['photo', 'celestial', 'instrument'],

  async available() {
    return reachable(this.probe);
  },

  async search(query, {limit = 10} = {}) {
    const data = await getJSON(`${API}/search?q=${encodeURIComponent(query)}&media_type=image`);
    return (data?.collection?.items ?? []).slice(0, limit).map((item) => {
      const d = item.data?.[0] ?? {};
      return {
        provider: 'nasa',
        id: String(d.nasa_id ?? ''),
        title: d.title ?? null,
        url: item.links?.[0]?.href ?? null,
        originalUrl: item.href ?? null,
        width: null,
        height: null,
        mime: null,
        sourceUrl: d.nasa_id ? `https://images.nasa.gov/details-${d.nasa_id}` : null,
        creator: d.photographer ?? d.center ?? 'NASA',
        // NASA states its terms in prose rather than as a licence id; this is
        // the normalisation, and it is recorded as such rather than asserted.
        licence: 'Public domain (NASA media usage guidelines)',
        licenceUrl: 'https://www.nasa.gov/nasa-brand-center/images-and-media/',
        description: d.description ?? null,
        date: d.date_created ?? null,
      };
    }).filter((c) => c.url);
  },
  async metadata(c) { return c; },
  async license(c) { return {licence: c.licence, licenceUrl: c.licenceUrl, creator: c.creator}; },
  async download(c) { return getBytes(c.url); },
});
