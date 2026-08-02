import fs from 'node:fs';
import { google } from 'googleapis';
import { config, assertYouTube } from '../config.js';

/**
 * Faz 6 — YouTube Data API v3 ile videoyu yükler.
 * OAuth2 refresh token ile kimlik doğrular (GitHub Secrets'ta saklanır).
 * Resumable upload otomatik olarak googleapis tarafından yönetilir.
 */

function getOAuthClient() {
  assertYouTube();
  const { clientId, clientSecret, refreshToken } = config.youtube;
  const client = new google.auth.OAuth2(clientId, clientSecret);
  client.setCredentials({ refresh_token: refreshToken });
  return client;
}

/**
 * @param {object} params
 * @param {string} params.videoPath - Yüklenecek mp4 (1080x1920).
 * @param {string} params.title
 * @param {string} params.description
 * @param {string[]} params.tags
 * @param {string} [params.privacyStatus] - config.youtube.privacyStatus varsayılan.
 * @param {string} [params.categoryId] - config.youtube.categoryId varsayılan.
 * @returns {Promise<{videoId:string, url:string}>}
 */
export async function uploadVideo({
  videoPath,
  title,
  description,
  tags,
  privacyStatus = config.youtube.privacyStatus,
  categoryId = config.youtube.categoryId,
  coverPath = null,
}) {
  if (!videoPath || !fs.existsSync(videoPath)) {
    throw new Error(`Video bulunamadı: ${videoPath}`);
  }

  const auth = getOAuthClient();
  const youtube = google.youtube({ version: 'v3', auth });

  const res = await youtube.videos.insert({
    part: ['snippet', 'status'],
    requestBody: {
      snippet: {
        title,
        description,
        tags,
        categoryId,
      },
      status: {
        privacyStatus,
        selfDeclaredMadeForKids: false,
        // AI üretimi gerçekçi içerik beyanı (YouTube sentetik medya politikası).
        containsSyntheticMedia: true,
      },
    },
    media: {
      body: fs.createReadStream(videoPath),
    },
  });

  const videoId = res.data.id;

  // ÖZEL KAPAK (best-effort): Shorts kanal sayfası / arama / keşif'te görünen
  // kapak karesi — CTR'yi artırır (swipe feed'de görünmez ama keşif view'inin
  // kaynağı). thumbnails.set kanal DOĞRULAMASI ister; doğrulanmamışsa hata verir
  // → upload'ı BOZMADAN atlanır, kanal doğrulanınca otomatik aktifleşir.
  let thumbnailSet = false;
  if (coverPath && fs.existsSync(coverPath)) {
    try {
      await youtube.thumbnails.set({ videoId, media: { body: fs.createReadStream(coverPath) } });
      thumbnailSet = true;
    } catch (err) {
      console.warn(`  [kapak] thumbnail set edilemedi (kanal doğrulaması gerekebilir): ${String(err.message || err).slice(0, 90)}`);
    }
  }

  return { videoId, url: `https://www.youtube.com/shorts/${videoId}`, thumbnailSet };
}
