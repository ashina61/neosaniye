import { logVideo, markTopicUsed } from '../lib/firestore.js';

/**
 * Faz 5 — Loglama.
 * Üretilen bir videoyu state katmanına kaydeder ve konuyu used_topics'e işler.
 * Backend (Firestore / yerel JSON) firestore.js tarafından otomatik seçilir.
 *
 * @param {object} script - generateScript çıktısı.
 * @param {object} meta
 * @param {string} [meta.audioPath]
 * @param {string} [meta.videoPath]
 * @param {Array}  [meta.media] - Faz 3 manifest item'ları.
 * @param {string} [meta.engine] - Kullanılan TTS motoru.
 * @param {number} [meta.duration]
 * @param {string} [meta.status='rendered'] - draft|rendered|published|failed
 * @param {object} [meta.youtube] - Faz 6'da doldurulur.
 * @returns {Promise<{videoId:string}>}
 */
export async function recordProduction(script, meta = {}) {
  const {
    audioPath = null,
    videoPath = null,
    media = [],
    engine = null,
    duration = script.estimated_duration_seconds || null,
    status = 'rendered',
    youtube = null,
  } = meta;

  const record = {
    topic: script.topic,
    normalizedTopic: script.normalizedTopic,
    script: {
      hook: script.hook,
      body: script.body,
      cta: script.cta,
      visual_keywords: script.visual_keywords,
    },
    audioPath,
    videoPath,
    media: media.map((m) => ({
      type: m.type,
      keyword: m.keyword,
      path: m.path,
      sourceUrl: m.sourceUrl,
      author: m.author,
    })),
    engine,
    duration,
    status,
    youtube,
  };

  const videoId = await logVideo(record);
  await markTopicUsed(script.topic, { videoId });
  return { videoId };
}
