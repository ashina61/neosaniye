import { writeFile } from 'node:fs/promises';

/**
 * GERÇEK ARŞİV KATMANI — açık lisanslı GERÇEK fotoğraflar.
 *
 * Amaç (canlı QC bulgusu): gerçek bir tarihî nesne/yer anlatılırken AI'nın
 * uydurduğu rekonstrüksiyon yerine NESNENİN GERÇEK fotoğrafını göstermek.
 * Görüntü Yönetmeni sahneye `real_subject` verdiyse burası devreye girer.
 *
 * Kaynaklar (ikisi de ücretsiz, anahtarsız):
 *  1) Wikimedia Commons — lisans filtresi: Public domain / CC0 / CC BY / CC BY-SA.
 *     CC BY(-SA) için atıf bilgisi saklanır (video açıklamasına eklenir).
 *  2) Met Museum Open Access — tamamı CC0, atıf gerekmez.
 *
 * Tamamen best-effort: hata/boş sonuç → null döner, çağıran AI zincirine düşer.
 */

const UA = { 'user-agent': 'neosaniye/1.0 (github.com/ashina61/neosaniye)' };
const OK_LICENSE = /^(public domain|pd|cc0|cc[ -]by(?:[ -]sa)?(?:[ -]\d\.\d)?)$/i;

async function getJson(url, timeoutMs = 12000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: UA });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/** Wikimedia Commons'ta ara → lisansı uygun, yeterince büyük ilk görsel. */
async function searchWikimedia(query) {
  const u =
    'https://commons.wikimedia.org/w/api.php?action=query&generator=search' +
    `&gsrsearch=${encodeURIComponent(query + ' filetype:bitmap')}` +
    '&gsrnamespace=6&gsrlimit=10&prop=imageinfo' +
    '&iiprop=url%7Cextmetadata%7Csize&iiurlwidth=1080&format=json&origin=*';
  const data = await getJson(u);
  const pages = Object.values(data?.query?.pages || {});
  // Arama sırasına göre değerlendir (index alanı sıralamayı taşır).
  pages.sort((a, b) => (a.index || 0) - (b.index || 0));
  for (const p of pages) {
    const ii = (p.imageinfo || [])[0];
    if (!ii) continue;
    const em = ii.extmetadata || {};
    const licRaw = String((em.LicenseShortName || {}).value || '').trim();
    if (!OK_LICENSE.test(licRaw)) continue;
    const w = ii.thumbwidth || ii.width || 0;
    const h = ii.thumbheight || ii.height || 0;
    if (Math.min(w, h) < 640) continue; // telefon ekranında bulanır
    // Artist alanı HTML gelebilir — etiketleri temizle.
    const author = String((em.Artist || {}).value || '')
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 60);
    return {
      downloadUrl: ii.thumburl || ii.url,
      sourceUrl: ii.descriptionurl || `https://commons.wikimedia.org/wiki/${encodeURIComponent(p.title || '')}`,
      author: author || 'Wikimedia Commons',
      license: licRaw,
      licenseEvidence: ii.descriptionurl || `https://commons.wikimedia.org/wiki/${encodeURIComponent(p.title || '')}`,
      attribution: /^cc[ -]by/i.test(licRaw), // CC BY / CC BY-SA → atıf zorunlu
      provider: 'wikimedia',
    };
  }
  return null;
}

/** Met Museum Open Access'te ara (tamamı CC0). */
async function searchMet(query) {
  const s = await getJson(
    `https://collectionapi.metmuseum.org/public/collection/v1/search?q=${encodeURIComponent(query)}&hasImages=true`,
  );
  const ids = (s?.objectIDs || []).slice(0, 4);
  for (const id of ids) {
    try {
      const o = await getJson(`https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`);
      const img = o?.primaryImage || o?.primaryImageSmall;
      if (!img) continue;
      return {
        downloadUrl: img,
        sourceUrl: o.objectURL || `https://www.metmuseum.org/art/collection/search/${id}`,
        author: String(o.artistDisplayName || 'The Met Museum').slice(0, 60),
        license: 'CC0',
        licenseEvidence: o.objectURL || `https://www.metmuseum.org/art/collection/search/${id}`,
        attribution: false,
        provider: 'met',
      };
    } catch {
      /* sıradaki objeye geç */
    }
  }
  return null;
}

/**
 * Gerçek arşiv görseli indir (Commons → Met sırasıyla).
 * @returns {Promise<object|null>} { path, type:'photo', author, license, sourceUrl, attribution } | null
 */
export async function fetchArchiveImage(query, dest) {
  const q = String(query || '').trim();
  if (q.length < 3) return null;
  for (const search of [searchWikimedia, searchMet]) {
    try {
      const hit = await search(q);
      if (!hit) continue;
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 25000);
      try {
        const res = await fetch(hit.downloadUrl, { signal: ctrl.signal, headers: UA });
        if (!res.ok) continue;
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length < 20000) continue; // bozuk/ikon boyutlu dosya
        await writeFile(dest, buf);
        return { path: dest, type: 'photo', ...hit };
      } finally {
        clearTimeout(timer);
      }
    } catch (err) {
      console.warn(`[archive] ${q}: ${String(err.message).slice(0, 80)}`);
    }
  }
  return null;
}
