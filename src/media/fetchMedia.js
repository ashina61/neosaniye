import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { config, assertPexels } from '../config.js';

/**
 * Faz 3 — Görsel Toplama (Pexels).
 * script.visual_keywords listesindeki her kelime için Pexels'ten dikey (9:16)
 * klip/foto çeker, yerel diske indirir ve bir manifest döndürür.
 *
 * Video > foto tercih edilir (Shorts için daha dinamik). Dikey video yoksa
 * dikey fotoğrafa düşer. Not: kesin 1080x1920 kırpma/ölçekleme Faz 4'te ffmpeg
 * ile yapılır; burada sadece dikey yönlü havuz toplanır.
 */

const API = 'https://api.pexels.com';

async function pexelsGet(url) {
  assertPexels();
  const res = await fetch(url, {
    headers: { Authorization: config.pexels.apiKey },
  });
  if (res.status === 429) {
    throw new Error('Pexels oran limiti aşıldı (ücretsiz tier 200/saat).');
  }
  if (!res.ok) {
    throw new Error(`Pexels API hatası ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

/** Bir Pexels videosunun dosyaları arasından en uygun dikey mp4'ü seçer. */
export function pickPortraitVideoFile(videoFiles) {
  const portrait = videoFiles.filter(
    (f) => f.height >= f.width && f.file_type === 'video/mp4',
  );
  if (!portrait.length) return null;
  // 1080 genişliğe en yakın olanı tercih et (Shorts hedefi 1080x1920).
  portrait.sort((a, b) => Math.abs(a.width - 1080) - Math.abs(b.width - 1080));
  return portrait[0];
}

async function searchVideo(keyword) {
  const url = `${API}/videos/search?query=${encodeURIComponent(
    keyword,
  )}&orientation=${config.pexels.orientation}&size=${config.pexels.size}&per_page=5`;
  const data = await pexelsGet(url);
  for (const video of data.videos || []) {
    const file = pickPortraitVideoFile(video.video_files || []);
    if (file) {
      return {
        type: 'video',
        keyword,
        downloadUrl: file.link,
        ext: 'mp4',
        width: file.width,
        height: file.height,
        duration: video.duration,
        pexelsId: video.id,
        sourceUrl: video.url,
        author: video.user?.name,
        authorUrl: video.user?.url,
      };
    }
  }
  return null;
}

async function searchPhoto(keyword) {
  const url = `${API}/v1/search?query=${encodeURIComponent(
    keyword,
  )}&orientation=${config.pexels.orientation}&per_page=5`;
  const data = await pexelsGet(url);
  const photo = (data.photos || [])[0];
  if (!photo) return null;
  return {
    type: 'photo',
    keyword,
    downloadUrl: photo.src?.portrait || photo.src?.large2x || photo.src?.original,
    ext: 'jpg',
    width: photo.width,
    height: photo.height,
    pexelsId: photo.id,
    sourceUrl: photo.url,
    author: photo.photographer,
    authorUrl: photo.photographer_url,
  };
}

/** Tek bir kelime için medya bulur (önce tercih edilen tür, sonra diğeri). */
async function findForKeyword(keyword) {
  const order =
    config.pexels.preferType === 'photo'
      ? [searchPhoto, searchVideo]
      : [searchVideo, searchPhoto];
  for (const fn of order) {
    try {
      const hit = await fn(keyword);
      if (hit) return hit;
    } catch (err) {
      console.warn(`[pexels] "${keyword}" arama hatası: ${err.message}`);
    }
  }
  return null;
}

async function downloadFile(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`indirme hatası ${res.status}: ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(dest, buf);
  return buf.length;
}

/**
 * Tek bir sahne için (birkaç anahtar kelime denenerek) Pexels'ten dikey medya
 * indirir. AI görsel üretimi başarısız olursa yedek olarak kullanılır.
 * @returns {Promise<{type:string, path:string, ...}|null>}
 */
export async function fetchOneForKeywords(keywords, destPath) {
  for (const keyword of keywords || []) {
    const hit = await findForKeyword(keyword);
    if (!hit) continue;
    try {
      const bytes = await downloadFile(hit.downloadUrl, destPath);
      return { ...hit, path: destPath, bytes };
    } catch (err) {
      console.warn(`[pexels] yedek indirme başarısız "${keyword}": ${err.message}`);
    }
  }
  return null;
}

/**
 * @param {object} script - generateScript çıktısı (visual_keywords içermeli).
 * @param {object} [opts]
 * @param {string} [opts.outDir='output'] - Kök çıktı klasörü.
 * @param {string} [opts.basename] - Alt klasör adı (varsayılan normalizedTopic).
 * @param {number} [opts.perKeyword] - Kelime başına indirilecek medya (varsayılan config).
 * @returns {Promise<{mediaDir:string, items:Array, manifestPath:string}>}
 */
export async function fetchMedia(script, opts = {}) {
  assertPexels();
  const keywords = script.visual_keywords || [];
  if (!keywords.length) throw new Error('script.visual_keywords boş.');

  const {
    outDir = 'output',
    basename = script.normalizedTopic || 'script',
    perKeyword = config.pexels.perKeyword,
  } = opts;

  const mediaDir = path.join(outDir, basename, 'media');
  await mkdir(mediaDir, { recursive: true });

  const items = [];
  let index = 0;

  for (const keyword of keywords) {
    // perKeyword>1 için per_page'i artırabiliriz; şimdilik 1 medya/kelime yeterli.
    for (let n = 0; n < perKeyword; n += 1) {
      const hit = await findForKeyword(keyword);
      if (!hit) {
        console.warn(`[pexels] "${keyword}" için dikey medya bulunamadı, atlandı.`);
        continue;
      }
      index += 1;
      const filename = `${String(index).padStart(2, '0')}-${hit.type}.${hit.ext}`;
      const filePath = path.join(mediaDir, filename);
      try {
        const bytes = await downloadFile(hit.downloadUrl, filePath);
        items.push({ ...hit, path: filePath, bytes });
        console.log(
          `[pexels] indirildi: ${filename} (${hit.type}, ${hit.width}x${hit.height}, "${keyword}")`,
        );
      } catch (err) {
        console.warn(`[pexels] indirme başarısız "${keyword}": ${err.message}`);
      }
    }
  }

  const manifestPath = path.join(outDir, basename, 'media-manifest.json');
  await writeFile(manifestPath, JSON.stringify({ keywords, items }, null, 2));

  return { mediaDir, items, manifestPath };
}
