import { google } from 'googleapis';
import { config } from '../config.js';
import { getVideosWithYouTube, updateVideo } from '../lib/firestore.js';

/**
 * Faz 6+ — Etkileşim ve analitik yardımcıları (hepsi best-effort).
 *  - postFirstComment: videoya otomatik ilk yorum (etkileşimi tetikler).
 *  - updateVideoStats: geçmiş videoların izlenme/beğeni sayısını çekip state'e
 *    yazar; konu seçimi bu veriyle beslenir (neyin tuttuğunu öğrenme döngüsü).
 */

function getClient() {
  const { clientId, clientSecret, refreshToken } = config.youtube;
  if (!clientId || !clientSecret || !refreshToken) return null;
  const client = new google.auth.OAuth2(clientId, clientSecret);
  client.setCredentials({ refresh_token: refreshToken });
  return google.youtube({ version: 'v3', auth: client });
}

/**
 * Videoya kanal adına ilk yorumu atar. Yorumlar etkileşim sinyalidir ve
 * izleyiciyi cevap yazmaya iter. API ile "sabitleme" yapılamaz (YouTube
 * desteklemiyor) ama ilk yorum pratikte en üstte görünür.
 */
export async function postFirstComment(videoId, script) {
  const yt = getClient();
  if (!yt || !videoId) return false;
  const questions = [
    'Which part surprised you the most? 👇',
    'Did you know this before? Be honest 👇',
    'Would you have believed this? 👇',
    'What should we cover next? 👇',
  ];
  const q = questions[Math.floor(Math.random() * questions.length)];
  const text = `${q}`;
  try {
    await yt.commentThreads.insert({
      part: ['snippet'],
      requestBody: {
        snippet: {
          videoId,
          topLevelComment: { snippet: { textOriginal: text } },
        },
      },
    });
    return true;
  } catch (err) {
    console.warn(`[engage] ilk yorum atılamadı (${err.message?.slice(0, 100)}).`);
    return false;
  }
}

/**
 * Yayınlanmış videoların istatistiklerini çekip kayda işler.
 * @returns {Promise<number>} güncellenen video sayısı
 */
/** YouTube Analytics'ten video başına retention % + kazanılan abone (best-effort).
 *  Refresh token'da yt-analytics.readonly kapsamı yoksa sessizce boş döner —
 *  kullanıcı yeni kapsamla token yenileyince kendiliğinden aktifleşir. */
async function fetchAnalyticsMap(ids) {
  const { clientId, clientSecret, refreshToken } = config.youtube;
  if (!clientId || !refreshToken || !ids.length) return {};
  try {
    const auth = new google.auth.OAuth2(clientId, clientSecret);
    auth.setCredentials({ refresh_token: refreshToken });
    const an = google.youtubeAnalytics({ version: 'v2', auth });
    const { data } = await an.reports.query({
      ids: 'channel==MINE',
      startDate: '2025-01-01',
      endDate: new Date().toISOString().slice(0, 10),
      metrics: 'averageViewPercentage,subscribersGained',
      dimensions: 'video',
      filters: 'video==' + ids.slice(0, 25).join(','),
    });
    const map = {};
    for (const row of data.rows || []) {
      map[row[0]] = {
        avgViewPct: Math.round(Number(row[1]) * 10) / 10,
        subsGained: Number(row[2]) || 0,
      };
    }
    return map;
  } catch (err) {
    console.warn(`[stats] analytics verisi yok (yt-analytics kapsamı eklenince aktifleşir): ${String(err.message).slice(0, 70)}`);
    return {};
  }
}

export async function updateVideoStats(limit = 25) {
  const yt = getClient();
  if (!yt) return 0;
  const vids = await getVideosWithYouTube(limit).catch(() => []);
  const withIds = vids.filter((v) => v.youtube?.videoId);
  if (!withIds.length) return 0;

  try {
    const ids = withIds.map((v) => v.youtube.videoId).slice(0, 50);
    const anMap = await fetchAnalyticsMap(ids);
    const { data } = await yt.videos.list({
      part: ['statistics'],
      id: ids,
    });
    let updated = 0;
    for (const item of data.items || []) {
      const rec = withIds.find((v) => v.youtube.videoId === item.id);
      if (!rec) continue;
      const stats = {
        views: Number(item.statistics?.viewCount || 0),
        likes: Number(item.statistics?.likeCount || 0),
        comments: Number(item.statistics?.commentCount || 0),
        // Analytics zenginleştirmesi (retention + abone) — kapsam varsa dolar.
        ...(anMap[item.id] || {}),
        statsAt: new Date().toISOString(),
      };
      await updateVideo(rec.id, { stats }).catch(() => {});
      updated += 1;
    }
    return updated;
  } catch (err) {
    console.warn(`[engage] istatistik çekilemedi (${err.message?.slice(0, 100)}).`);
    return 0;
  }
}
