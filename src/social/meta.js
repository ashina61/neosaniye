import { readFile, stat } from 'node:fs/promises';
import { config } from '../config.js';

/**
 * Meta cross-post — Instagram Reels + Facebook Page Reels (resmi Graph API).
 *
 * İkisi de "resumable upload" akışını kullanır: video binary olarak doğrudan
 * rupload.facebook.com'a gönderilir (herkese açık URL barındırmak GEREKMEZ).
 *
 * Tamamen best-effort: token/ID eksikse veya Meta hata verirse yalnızca uyarı
 * loglanır — YouTube akışı asla etkilenmez.
 *
 * Kurulum: docs/meta-setup.md (META_PAGE_TOKEN, META_PAGE_ID, META_IG_USER_ID).
 */

const V = 'v21.0';
const GRAPH = `https://graph.facebook.com/${V}`;

function metaReady() {
  const { pageToken, pageId, igUserId } = config.meta;
  return Boolean(pageToken && (pageId || igUserId));
}

async function graphCall(url, { method = 'POST', params = {}, timeoutMs = 30000 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const body = new URLSearchParams({ ...params, access_token: config.meta.pageToken });
    const res = await fetch(method === 'GET' ? `${url}?${body}` : url, {
      method,
      signal: ctrl.signal,
      ...(method === 'GET' ? {} : { body }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) {
      throw new Error(data.error?.message || `Graph HTTP ${res.status}`);
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

/** Video binary'sini rupload.facebook.com'a tek parçada yükler. */
async function ruploadBinary(uploadUrl, videoPath, { timeoutMs = 180000 } = {}) {
  const buf = await readFile(videoPath);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(uploadUrl, {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        Authorization: `OAuth ${config.meta.pageToken}`,
        offset: '0',
        file_size: String(buf.length),
        'Content-Type': 'application/octet-stream',
      },
      body: buf,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.success === false) {
      throw new Error(data?.debug_info?.message || data?.error?.message || `rupload HTTP ${res.status}`);
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Instagram Reels yayını: container (resumable) -> binary upload -> işlenmesini
 * bekle -> publish. ~20MB video için tipik toplam süre 1-2 dk.
 * @returns {Promise<string|null>} yayınlanan medya ID'si veya null
 */
export async function publishInstagramReel({ videoPath, caption = '' }) {
  const igId = config.meta.igUserId;
  if (!config.meta.pageToken || !igId) return null;
  try {
    await stat(videoPath);
    // 1) Konteyner (resumable upload modunda).
    const container = await graphCall(`${GRAPH}/${igId}/media`, {
      params: {
        media_type: 'REELS',
        upload_type: 'resumable',
        caption: caption.slice(0, 2200),
        share_to_feed: 'true',
      },
    });

    // 2) Binary yükleme.
    const uploadUrl = container.uri || `https://rupload.facebook.com/ig-api-upload/${V}/${container.id}`;
    await ruploadBinary(uploadUrl, videoPath);

    // 3) İşlenmesini bekle (FINISHED olana dek; tipik 15-60sn).
    const deadline = Date.now() + 4 * 60 * 1000;
    let status = '';
    while (Date.now() < deadline) {
      const st = await graphCall(`${GRAPH}/${container.id}`, {
        method: 'GET',
        params: { fields: 'status_code' },
      });
      status = st.status_code;
      if (status === 'FINISHED') break;
      if (status === 'ERROR' || status === 'EXPIRED') {
        throw new Error(`konteyner durumu: ${status}`);
      }
      await new Promise((r) => setTimeout(r, 6000));
    }
    if (status !== 'FINISHED') throw new Error('işleme zaman aşımı');

    // 4) Yayınla.
    const pub = await graphCall(`${GRAPH}/${igId}/media_publish`, {
      params: { creation_id: container.id },
    });
    return pub.id || null;
  } catch (err) {
    console.warn(`[meta] Instagram Reels yayını başarısız: ${String(err.message).slice(0, 140)}`);
    return null;
  }
}

/**
 * Facebook Sayfa Reels yayını: start -> binary upload -> finish(PUBLISHED).
 * @returns {Promise<string|null>} video ID'si veya null
 */
export async function publishFacebookReel({ videoPath, description = '' }) {
  const pageId = config.meta.pageId;
  if (!config.meta.pageToken || !pageId) return null;
  try {
    await stat(videoPath);
    // 1) Upload oturumu başlat.
    const start = await graphCall(`${GRAPH}/${pageId}/video_reels`, {
      params: { upload_phase: 'start' },
    });
    if (!start.video_id) throw new Error('video_id dönmedi');

    // 2) Binary yükleme.
    const uploadUrl = start.upload_url || `https://rupload.facebook.com/video-upload/${V}/${start.video_id}`;
    await ruploadBinary(uploadUrl, videoPath);

    // 3) Bitir ve yayınla.
    await graphCall(`${GRAPH}/${pageId}/video_reels`, {
      params: {
        upload_phase: 'finish',
        video_id: start.video_id,
        video_state: 'PUBLISHED',
        description: description.slice(0, 5000),
      },
    });
    return start.video_id;
  } catch (err) {
    console.warn(`[meta] Facebook Reels yayını başarısız: ${String(err.message).slice(0, 140)}`);
    return null;
  }
}

/**
 * YouTube upload'ı sonrası cross-post: IG + FB'ye paralel dener.
 * @returns {Promise<{instagram: string|null, facebook: string|null}>}
 */
export async function crossPost({ videoPath, title = '', description = '', tags = [] }) {
  if (!metaReady()) return { instagram: null, facebook: null };
  const hashtags = (tags || [])
    .slice(0, 8)
    .map((t) => '#' + String(t).replace(/[^a-z0-9]/gi, ''))
    .filter((t) => t.length > 2)
    .join(' ');
  const caption = [title, '', hashtags].filter(Boolean).join('\n');
  const [instagram, facebook] = await Promise.all([
    publishInstagramReel({ videoPath, caption }),
    publishFacebookReel({ videoPath, description: caption }),
  ]);
  return { instagram, facebook };
}
