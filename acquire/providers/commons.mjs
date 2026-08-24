/**
 * WIKIMEDIA COMMONS.
 *
 * The best source this layer has for anything with a NAME. A diffusion model
 * asked for the Baalbek trilithon invents one; the trilithon exists, it is
 * photographed from every angle, and most of those photographs are free. For a
 * named place, object or document, fetching beats generating on accuracy, on
 * cost and on reproducibility.
 *
 * It is also the source with the most licence variety, which is why the licence
 * gate is not optional here: Commons hosts FREE files, not PUBLIC ones.
 */
import {defineProvider, getBytes, getJSON, reachable} from './provider.mjs';

const API = 'https://commons.wikimedia.org/w/api.php';

export default defineProvider({
  id: 'commons',
  name: 'Wikimedia Commons',
  homepage: 'https://commons.wikimedia.org',
  probe: `${API}?action=query&format=json&meta=siteinfo`,
  kinds: ['photo', 'document', 'diagram', 'specimen'],

  async available() {
    return reachable(this.probe);
  },

  /**
   * SEARCH THE FILE NAMESPACE, and ask for the metadata in the same round trip.
   *
   * `generator=search` with `prop=imageinfo` is one request where the obvious
   * implementation is two per result. At nine briefs across five episodes that
   * is the difference between forty-five requests and four hundred.
   */
  async search(query, {limit = 12} = {}) {
    const url =
      `${API}?action=query&format=json&origin=*` +
      `&generator=search&gsrsearch=${encodeURIComponent(`filetype:bitmap ${query}`)}` +
      `&gsrnamespace=6&gsrlimit=${limit}` +
      `&prop=imageinfo&iiprop=url|size|mime|extmetadata|user` +
      `&iiurlwidth=1600`;
    const data = await getJSON(url);
    const pages = Object.values(data?.query?.pages ?? {});
    return pages
      .map((page) => {
        const info = page.imageinfo?.[0];
        if (!info) return null;
        const meta = info.extmetadata ?? {};
        const plain = (v) => String(v?.value ?? '').replace(/<[^>]+>/g, '').trim() || null;
        return {
          provider: 'commons',
          id: String(page.pageid),
          title: page.title?.replace(/^File:/, '') ?? null,
          // The scaled URL, not the original: a 40-megapixel TIFF of a temple
          // is the same picture as its 1600px rendering and eighty times the
          // download.
          url: info.thumburl ?? info.url,
          originalUrl: info.url,
          width: info.thumbwidth ?? info.width,
          height: info.thumbheight ?? info.height,
          mime: info.mime ?? null,
          sourceUrl: info.descriptionurl ?? null,
          creator: plain(meta.Artist) ?? info.user ?? null,
          licence: plain(meta.LicenseShortName) ?? plain(meta.License) ?? null,
          licenceUrl: plain(meta.LicenseUrl) ?? null,
          description: plain(meta.ImageDescription) ?? null,
          date: plain(meta.DateTimeOriginal) ?? plain(meta.DateTime) ?? null,
        };
      })
      .filter(Boolean);
  },

  async metadata(candidate) {
    return candidate;
  },

  async license(candidate) {
    return {licence: candidate.licence, licenceUrl: candidate.licenceUrl, creator: candidate.creator};
  },

  async download(candidate) {
    return getBytes(candidate.url);
  },
});
