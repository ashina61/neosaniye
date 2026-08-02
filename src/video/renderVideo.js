import {renderRemotion} from './renderRemotion.js';

/**
 * NeoSaniye'nin tek Faz 4 render giriş noktası.
 *
 * Eski FFmpeg montaj motoru kaldırıldı. Bu dosya yalnızca boru hattındaki
 * kararlı `renderVideo(job)` sözleşmesini korur ve işi Remotion adaptörüne
 * devreder. FFmpeg/ffprobe; medya normalizasyonu ve teknik çıktı denetimi için
 * kullanılabilir, fakat görüntü montajı artık yalnızca Remotion tarafından
 * yapılır.
 */
export async function renderVideo(job = {}) {
  return renderRemotion({
    ...job,
    language: job.language || process.env.CONTENT_LANGUAGE || 'en',
    title: job.title || job.hookText || 'NeoSaniye story',
    topic: job.topic || job.musicSeed || job.title || job.hookText || 'neosaniye-story',
  });
}
