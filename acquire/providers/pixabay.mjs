/**
 * PIXABAY. The same role as Pexels and the same caution, kept because two
 * stock libraries fail independently and one key is easier to get than two.
 */
import {defineProvider, getBytes, getJSON, reachable} from './provider.mjs';

const API = 'https://pixabay.com/api/';

export default defineProvider({
  id: 'pixabay',
  name: 'Pixabay',
  homepage: 'https://pixabay.com',
  probe: 'https://pixabay.com/api/?key=probe&q=test',
  needsKey: 'PIXABAY_API_KEY',
  kinds: ['photo', 'illustration'],

  async available() {
    const key = process.env[this.needsKey];
    if (!key) {
      const net = await reachable(this.probe);
      return net.ok
        ? {ok: false, why: 'unconfigured', detail: `${this.needsKey} is not set (host is reachable)`}
        : {ok: false, why: net.why, detail: net.detail};
    }
    return reachable(`${API}?key=${key}&q=test&per_page=3`);
  },

  async search(query, {limit = 10, orientation} = {}) {
    const key = process.env[this.needsKey];
    const url =
      `${API}?key=${key}&q=${encodeURIComponent(query)}&per_page=${Math.max(3, limit)}` +
      `&image_type=photo&safesearch=true` +
      (orientation ? `&orientation=${orientation === 'vertical' ? 'vertical' : 'horizontal'}` : '');
    const data = await getJSON(url);
    return (data?.hits ?? []).slice(0, limit).map((h) => ({
      provider: 'pixabay',
      id: String(h.id),
      title: h.tags ?? null,
      url: h.largeImageURL ?? h.webformatURL,
      originalUrl: h.largeImageURL ?? null,
      width: h.imageWidth ?? null,
      height: h.imageHeight ?? null,
      mime: null,
      sourceUrl: h.pageURL ?? null,
      creator: h.user ?? null,
      licence: 'Pixabay License',
      licenceUrl: 'https://pixabay.com/service/license-summary/',
      description: h.tags ?? null,
      date: null,
    }));
  },
  async metadata(c) { return c; },
  async license(c) { return {licence: c.licence, licenceUrl: c.licenceUrl, creator: c.creator}; },
  async download(c) { return getBytes(c.url); },
});
