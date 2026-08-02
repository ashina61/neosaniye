import { google } from 'googleapis';
import { config } from '../config.js';

/**
 * Faz 6+ — YouTube altyazı yükleme (best-effort).
 * Kelime zamanlamalarından temiz bir SRT üretir ve videoya resmi altyazı
 * kanalı olarak yükler. YouTube altyazıları arama için İNDEKSLER — bedava SEO
 * + erişilebilirlik. captions API, youtube.force-ssl scope'u ile çalışır.
 */

function srtTime(sec) {
  const s = Math.max(0, sec);
  const h = String(Math.floor(s / 3600)).padStart(2, '0');
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = String(Math.floor(s % 60)).padStart(2, '0');
  const ms = String(Math.round((s - Math.floor(s)) * 1000)).padStart(3, '0');
  return `${h}:${m}:${ss},${ms}`;
}

/** Kelime zamanlamalarından okunabilir satırlı SRT üretir. */
export function buildSrtFromWords(words, { maxWords = 7, maxGap = 0.6 } = {}) {
  const clean = (words || []).filter((w) => w.word && w.end > w.start);
  if (!clean.length) return '';
  const lines = [];
  let cur = [];
  for (let i = 0; i < clean.length; i += 1) {
    cur.push(clean[i]);
    const next = clean[i + 1];
    const gap = next ? next.start - clean[i].end : Infinity;
    const punct = /[.!?]$/.test(String(clean[i].word));
    if (cur.length >= maxWords || gap > maxGap || punct || !next) {
      lines.push(cur);
      cur = [];
    }
  }
  return lines
    .map((group, i) => {
      const start = group[0].start;
      const end = Math.max(group[group.length - 1].end, start + 0.4);
      const text = group.map((w) => w.word).join(' ');
      return `${i + 1}\n${srtTime(start)} --> ${srtTime(end)}\n${text}\n`;
    })
    .join('\n');
}

/**
 * SRT içeriğini videoya İngilizce altyazı olarak yükler.
 * @returns {Promise<boolean>} başarı
 */
export async function uploadCaptions(videoId, srtContent) {
  const { clientId, clientSecret, refreshToken } = config.youtube;
  if (!clientId || !clientSecret || !refreshToken || !videoId || !srtContent) return false;
  try {
    const client = new google.auth.OAuth2(clientId, clientSecret);
    client.setCredentials({ refresh_token: refreshToken });
    const yt = google.youtube({ version: 'v3', auth: client });
    await yt.captions.insert({
      part: ['snippet'],
      requestBody: {
        snippet: { videoId, language: 'en', name: 'English' },
      },
      media: { mimeType: 'application/octet-stream', body: srtContent },
    });
    return true;
  } catch (err) {
    console.warn(`[captions] altyazı yüklenemedi (${String(err.message).slice(0, 100)}).`);
    return false;
  }
}
