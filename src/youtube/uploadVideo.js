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
      },
    },
    media: {
      body: fs.createReadStream(videoPath),
    },
  });

  const videoId = res.data.id;
  return { videoId, url: `https://www.youtube.com/shorts/${videoId}` };
}
