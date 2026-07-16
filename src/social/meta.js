import { readFile, stat } from 'node:fs/promises';
import { config } from '../config.js';

/**
 * Meta cross-post — Instagram Reels + Facebook Page Reels (resmi Graph API).
 *
 * KURULUM TEK SECRET: META_USER_TOKEN (uzun ömürlü kullanıcı token'ı).
 * Sayfa, sayfa token'ı ve Instagram hesabı run sırasında /me/accounts
 * üzerinden OTOMATİK keşfedilir; eksikler logda Türkçe açıklanır.
 * (İsteğe bağlı: META_PAGE_TOKEN / META_PAGE_ID / META_IG_USER_ID ile
 * keşif atlanıp değerler elle sabitlenebilir.)
 *
 * İki platform da "resumable upload" akışını kullanır: video binary olarak
 * doğrudan rupload.facebook.com'a gönderilir (herkese açık URL GEREKMEZ).
 *
 * Tamamen best-effort: token yoksa veya Meta hata verirse yalnızca uyarı
 * loglanır — YouTube akışı asla etkilenmez.
 */

const V = 'v21.0';
const GRAPH = `https://graph.facebook.com/${V}`;
// Instagram Login (Sayfasız) yolu ayni akışı graph.instagram.com üzerinden kullanır.
const IG_GRAPH = `https://graph.instagram.com/${V}`;

async function graphCall(url, { method = 'POST', params = {}, token, timeoutMs = 30000 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const body = new URLSearchParams({ ...params, access_token: token });
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

/**
 * Hedefleri çözer: sayfa ID + sayfa token + IG user ID.
 * Öncelik: elle verilen değerler; yoksa META_USER_TOKEN ile otomatik keşif.
 * @returns {Promise<{pageId:string, pageToken:string, igUserId:string|null}|null>}
 */
async function resolveTargets() {
  const { userToken, pageToken, pageId, igUserId } = config.meta;

  // Elle tam yapılandırma verilmişse keşfe gerek yok.
  if (pageToken && pageId) {
    return { pageId, pageToken, igUserId: igUserId || null };
  }
  if (!userToken) return null; // cross-post kapalı (sessiz)

  // 1) Sayfayı keşfet.
  let page = null;
  try {
    const acc = await graphCall(`${GRAPH}/me/accounts`, {
      method: 'GET',
      token: userToken,
      params: { fields: 'id,name,access_token' },
    });
    const pages = acc.data || [];
    if (!pages.length) {
      console.warn(
        '[meta] Hesabında erişilebilir Facebook Sayfası yok. Ya sayfa hiç açılmamış ' +
          'ya da uygulama onayında sayfa İŞARETLENMEMİŞ (bkz. docs/meta-setup.md).',
      );
      return null;
    }
    page = pageId ? pages.find((p) => p.id === pageId) || pages[0] : pages[0];
    console.log(`[meta] sayfa: ${page.name} (${page.id})`);
  } catch (err) {
    console.warn(`[meta] sayfa keşfi başarısız: ${String(err.message).slice(0, 120)}`);
    return null;
  }

  // 2) Bağlı Instagram hesabını keşfet.
  let ig = igUserId || null;
  if (!ig) {
    try {
      const info = await graphCall(`${GRAPH}/${page.id}`, {
        method: 'GET',
        token: page.access_token,
        params: { fields: 'instagram_business_account' },
      });
      ig = info.instagram_business_account?.id || null;
      if (ig) console.log(`[meta] instagram: ${ig}`);
      else {
        console.warn(
          '[meta] Sayfaya bağlı Instagram hesabı bulunamadı — IG atlanacak, FB devam. ' +
            '(Instagram > Ayarlar > Hesap Merkezi üzerinden sayfaya bağla.)',
        );
      }
    } catch (err) {
      console.warn(`[meta] Instagram keşfi başarısız (FB devam): ${String(err.message).slice(0, 120)}`);
    }
  }

  return { pageId: page.id, pageToken: page.access_token, igUserId: ig };
}

/** Video binary'sini rupload.facebook.com'a tek parçada yükler. */
async function ruploadBinary(uploadUrl, videoPath, token, { timeoutMs = 180000 } = {}) {
  const buf = await readFile(videoPath);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(uploadUrl, {
      method: 'POST',
      signal: ctrl.signal,
      headers: {
        Authorization: `OAuth ${token}`,
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
 */
async function publishInstagramReel({ videoPath, caption = '', igUserId, token, graphBase = GRAPH }) {
  try {
    await stat(videoPath);
    const container = await graphCall(`${graphBase}/${igUserId}/media`, {
      token,
      params: {
        media_type: 'REELS',
        upload_type: 'resumable',
        caption: caption.slice(0, 2200),
        share_to_feed: 'true',
      },
    });

    const uploadUrl = container.uri || `https://rupload.facebook.com/ig-api-upload/${V}/${container.id}`;
    await ruploadBinary(uploadUrl, videoPath, token);

    // İşlenmesini bekle (FINISHED olana dek; tipik 15-60sn).
    const deadline = Date.now() + 4 * 60 * 1000;
    let status = '';
    while (Date.now() < deadline) {
      const st = await graphCall(`${graphBase}/${container.id}`, {
        method: 'GET',
        token,
        params: { fields: 'status_code' },
      });
      status = st.status_code;
      if (status === 'FINISHED') break;
      if (status === 'ERROR' || status === 'EXPIRED') throw new Error(`konteyner durumu: ${status}`);
      await new Promise((r) => setTimeout(r, 6000));
    }
    if (status !== 'FINISHED') throw new Error('işleme zaman aşımı');

    const pub = await graphCall(`${graphBase}/${igUserId}/media_publish`, {
      token,
      params: { creation_id: container.id },
    });
    return pub.id || null;
  } catch (err) {
    console.warn(`[meta] Instagram Reels yayını başarısız: ${String(err.message).slice(0, 140)}`);
    return null;
  }
}

/** Facebook Sayfa Reels yayını: start -> binary upload -> finish(PUBLISHED). */
async function publishFacebookReel({ videoPath, description = '', pageId, token }) {
  try {
    await stat(videoPath);
    const start = await graphCall(`${GRAPH}/${pageId}/video_reels`, {
      token,
      params: { upload_phase: 'start' },
    });
    if (!start.video_id) throw new Error('video_id dönmedi');

    const uploadUrl = start.upload_url || `https://rupload.facebook.com/video-upload/${V}/${start.video_id}`;
    await ruploadBinary(uploadUrl, videoPath, token);

    await graphCall(`${GRAPH}/${pageId}/video_reels`, {
      token,
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
 * YouTube upload'ı sonrası cross-post: hedefleri keşfeder, IG + FB'ye paralel dener.
 * @returns {Promise<{instagram: string|null, facebook: string|null}>}
 */
export async function crossPost({ videoPath, title = '', description = '', tags = [] }) {
  const igLoginToken = config.meta.igLoginToken;
  const targets = await resolveTargets();
  if (!targets && !igLoginToken) return { instagram: null, facebook: null };

  const hashtags = (tags || [])
    .slice(0, 8)
    .map((t) => '#' + String(t).replace(/[^a-z0-9]/gi, ''))
    .filter((t) => t.length > 2)
    .join(' ');
  const caption = [title, '', hashtags].filter(Boolean).join('\n');

  // Instagram: öncelik SAYFA yolu (graph.facebook.com — resumable upload
  // DESTEKLİ; canlıda doğrulandı). IG-login yolu (graph.instagram.com) yalnızca
  // YEDEK: o uç video_url (herkese açık URL) istiyor ve bizde yok — canlıda
  // "The parameter video_url is required" hatası verdi.
  let igTask = Promise.resolve(null);
  if (targets?.igUserId) {
    igTask = publishInstagramReel({ videoPath, caption, igUserId: targets.igUserId, token: targets.pageToken });
  } else if (igLoginToken) {
    igTask = (async () => {
      try {
        const me = await graphCall(`${IG_GRAPH}/me`, {
          method: 'GET',
          token: igLoginToken,
          params: { fields: 'user_id,username' },
        });
        const igId = me.user_id || me.id;
        if (!igId) throw new Error('IG kullanıcı kimliği çözülemedi');
        console.log(`[meta] Instagram (IG-login): @${me.username || igId}`);
        return await publishInstagramReel({
          videoPath, caption, igUserId: igId, token: igLoginToken, graphBase: IG_GRAPH,
        });
      } catch (err) {
        console.warn(`[meta] IG-login yolu başarısız: ${String(err.message).slice(0, 120)}`);
        return null;
      }
    })();
  }
  const fbTask = targets
    ? publishFacebookReel({ videoPath, description: caption, pageId: targets.pageId, token: targets.pageToken })
    : Promise.resolve(null);

  const [instagram, facebook] = await Promise.all([igTask, fbTask]);
  return { instagram, facebook };
}
