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
    error = null,
  } = meta;

  const record = {
    topic: script.topic,
    normalizedTopic: script.normalizedTopic,
    // Baş Analist öğrenme döngüsü bunlara göre gruplar (format/stil/kategori).
    format: script.format || null,
    // Retention QC skoru — Analist'in gelecekte kalite-izlenme bağını kurması için.
    retention: meta.retention || null,
    // Kullanılan müzik künyesi (lisans manifesti + parça tekrarını önleme).
    music: meta.music || null,
    visualStyle: meta.visualStyle || null,
    script: {
      title: script.title || null,
      category: script.category || null,
      // Kazanan hook öğrenmesi için (getWinningHooks) — yazar kendi başarılı
      // açılışlarından üslup öğrenir.
      hook_text: script.hook_text || null,
      finale_text: script.finale_text || null,
      scenes: (script.scenes || []).map((s) => ({
        narration: s.narration,
        image_prompt: s.image_prompt,
      })),
      cta: script.cta,
    },
    audioPath,
    videoPath,
    media: media.map((m) => ({
      type: m.type,
      source: m.source || null,
      scene: m.scene,
      keyword: m.keyword,
      path: m.path,
      sourceUrl: m.sourceUrl,
      author: m.author,
    })),
    engine,
    duration,
    status,
    youtube,
    ...(error ? { error } : {}),
  };

  const videoId = await logVideo(record);
  await markTopicUsed(script.topic, { videoId });
  return { videoId };
}
