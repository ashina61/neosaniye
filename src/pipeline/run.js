import path from 'node:path';
import { config } from '../config.js';
import { generateScript } from '../script/generateScript.js';
import { generateAudio } from '../tts/generateAudio.js';
import { generateImages } from '../media/generateImages.js';
import { renderVideo } from '../video/renderVideo.js';

/** Bir metindeki kelime sayısı (sahne ağırlığı için). */
function wordCount(text) {
  return String(text || '').trim().split(/\s+/).filter(Boolean).length;
}
import { buildMetadata } from '../youtube/buildMetadata.js';
import { uploadVideo } from '../youtube/uploadVideo.js';
import { recordProduction } from './recordProduction.js';

/**
 * Faz 7 — Uçtan uca orkestrasyon.
 * Sırayla: script -> ses -> görsel -> montaj -> (upload) -> loglama.
 * Herhangi bir adım hata verirse durum 'failed' olarak loglanır ve hata
 * yukarı fırlatılır (GitHub Actions böylece fail olur ve mail atar).
 */
export async function runPipeline(opts = {}) {
  const { root = 'output', upload } = opts;
  const log = (msg) => console.log(`\n▶ ${msg}`);

  // 1) Script
  log('Faz 1: Script üretiliyor (Gemini)...');
  const script = await generateScript();
  const base = script.normalizedTopic;
  const workDir = path.join(root, base);
  console.log(`  konu: ${script.topic}`);

  // YouTube yüklenebilir mi?
  const hasYouTube =
    config.youtube.clientId &&
    config.youtube.clientSecret &&
    config.youtube.refreshToken;
  const willUpload = upload === true || (upload !== false && hasYouTube);

  try {
    // 2) Ses (edge-tts -> piper yedek)
    log('Faz 2: Seslendirme (TTS)...');
    const audio = await generateAudio(script, { outDir: workDir, basename: base });
    console.log(`  motor: ${audio.engine}, süre~ ${audio.durationEstimate.toFixed(1)}s`);

    // 3) Görsel (sahne başına AI görsel + Pexels/placeholder yedeği)
    log('Faz 3: Sahne görselleri üretiliyor (AI)...');
    const media = await generateImages(script, { outDir: root, basename: base });
    console.log(
      `  ${media.items.length} sahne görseli — AI:${media.sources.ai} ` +
        `Pexels:${media.sources.pexels} yedek:${media.sources.placeholder}`,
    );
    if (!media.items.length) throw new Error('Hiç sahne görseli üretilemedi.');

    // Sahne süreleri, anlatım kelime sayısına göre orantılı (cta son sahneye eklenir).
    const scenes = script.scenes || [];
    const sceneWeights = scenes.map((s) => Math.max(1, wordCount(s.narration)));
    if (script.cta && sceneWeights.length) {
      sceneWeights[sceneWeights.length - 1] += wordCount(script.cta);
    }

    // 4) Montaj (ffmpeg)
    log('Faz 4: Video montajı (ffmpeg)...');
    const outPath = path.join(workDir, `${base}.mp4`);
    const video = await renderVideo({
      audioPath: audio.audioPath,
      wordTimings: audio.wordTimings,
      media: media.items.map((m) => ({ path: m.path, type: m.type })),
      sceneWeights: sceneWeights.length === media.items.length ? sceneWeights : undefined,
      outPath,
    });
    console.log(`  ${video.width}x${video.height}, ${video.duration.toFixed(1)}s -> ${outPath}`);

    // 6) Upload (opsiyonel)
    let youtube = null;
    if (willUpload) {
      log('Faz 6: YouTube upload...');
      const meta = await buildMetadata(script);
      const res = await uploadVideo({ videoPath: outPath, ...meta });
      youtube = { ...res, title: meta.title, publishedAt: new Date().toISOString() };
      console.log(`  yüklendi: ${res.url}`);
    } else {
      console.log('\n▶ Faz 6: YouTube upload atlandı (kredensiyel yok veya --no-upload).');
    }

    // 5) Loglama
    log('Faz 5: Kayıt (state)...');
    const { videoId } = await recordProduction(script, {
      audioPath: audio.audioPath,
      videoPath: outPath,
      media: media.items,
      engine: audio.engine,
      duration: video.duration,
      status: youtube ? 'published' : 'rendered',
      youtube,
    });
    console.log(`  kayıt id: ${videoId}`);

    return { script, videoPath: outPath, youtube, videoId };
  } catch (err) {
    // Hatayı da kaydet (best-effort), sonra yukarı fırlat.
    await recordProduction(script, { status: 'failed', error: err.message }).catch(() => {});
    throw err;
  }
}
