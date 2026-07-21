import { writeFile } from 'node:fs/promises';
import { config } from '../config.js';

/**
 * Ambiyans katmanı — Freesound'dan sahneye uyan ortam sesi (CC0).
 *
 * Kurgucu'nun seçtiği kısa arama sorgusuyla (örn. "battlefield distant wind")
 * Freesound'da SADECE CC0 lisanslı, uygun uzunlukta bir kayıt aranır ve HQ
 * önizleme mp3'ü indirilir. Bu katman müziğin ve anlatımın ALTINA çok düşük
 * seviyede serilir — "gerçek çekim" hissinin en ucuz ve en etkili kaynağı.
 *
 * Tamamen best-effort: FREESOUND_API_KEY yoksa, arama boş dönerse veya ağ
 * hata verirse null döner ve video ambiyanssız (bugünkü gibi) çıkar.
 */

const API = 'https://freesound.org/apiv2';

/** Kategoriye göre yedek ambiyans sorgusu (Kurgucu düşerse). */
export function defaultAmbienceQuery(category = '') {
  const map = {
    history: 'distant crowd wind ambience',
    mystery: 'dark eerie drone ambience',
    space: 'deep space drone hum',
    science: 'room tone electrical hum',
    nature: 'forest wind birds ambience',
    'human body': 'heartbeat slow deep',
    technology: 'server room hum ambience',
  };
  return map[String(category || '').toLowerCase()] || 'soft wind room tone ambience';
}

/**
 * @param {string} query - 2-5 kelimelik ambiyans araması (İngilizce).
 * @param {string} dest - İndirilecek mp3 yolu.
 * @returns {Promise<{path:string, name:string, duration:number}|null>}
 */
export async function fetchAmbienceTrack(query, dest, { timeoutMs = 45000 } = {}) {
  const key = config.freesound.apiKey;
  const q = String(query || '').trim();
  if (!key || !q) return null;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    // Yalnızca CC0 (atıf gerekmez, telif derdi yok) + döşemeye uygun uzunluk.
    const filter = 'duration:[12 TO 240] license:"Creative Commons 0"';
    const url =
      `${API}/search/text/?query=${encodeURIComponent(q)}` +
      `&filter=${encodeURIComponent(filter)}` +
      '&fields=id,name,username,duration,license,previews&sort=downloads_desc&page_size=10' +
      `&token=${key}`;
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`Freesound HTTP ${res.status}`);
    const data = await res.json();

    const sound = (data.results || []).find(
      (s) => s.previews?.['preview-hq-mp3'] || s.previews?.['preview-lq-mp3'],
    );
    if (!sound) return null;

    const dlUrl = sound.previews['preview-hq-mp3'] || sound.previews['preview-lq-mp3'];
    const dl = await fetch(dlUrl, { signal: ctrl.signal });
    if (!dl.ok) throw new Error(`Freesound indirme HTTP ${dl.status}`);
    const buf = Buffer.from(await dl.arrayBuffer());
    if (buf.length < 10000) throw new Error('Freesound önizleme boş/geçersiz');
    await writeFile(dest, buf);
    return {
      path: dest,
      name: sound.name,
      duration: sound.duration,
      provider: 'freesound',
      assetId: sound.id,
      author: sound.username || null,
      sourceUrl: `https://freesound.org/s/${sound.id}/`,
      license: sound.license || null,
      licenseEvidence: sound.license ? `Freesound API asset ${sound.id}: ${sound.license}` : null,
      query: q,
      retrievedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.warn(`[amb] ambiyans alınamadı ("${q}"): ${String(err.message).slice(0, 100)}`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}
