import path from 'node:path';
import { writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { config } from '../config.js';

const execFileAsync = promisify(execFile);
import { generateScript } from '../script/generateScript.js';
import { directVisuals, applyShotList } from '../crew/visualDirector.js';
import { planEdit } from '../crew/editorDirector.js';
import { generateAudio } from '../tts/generateAudio.js';
import { generateImages } from '../media/generateImages.js';
import { renderVideo } from '../video/renderVideo.js';
import { buildMetadata } from '../youtube/buildMetadata.js';
import { uploadVideo } from '../youtube/uploadVideo.js';
import { postFirstComment, updateVideoStats } from '../youtube/engage.js';
import { buildSrtFromWords, uploadCaptions } from '../youtube/captions.js';
import { preflightCheck } from './preflight.js';
import { recordProduction } from './recordProduction.js';
import { notify } from '../lib/notify.js';

/** Bir metindeki kelime sayısı (sahne ağırlığı için). */
function wordCount(text) {
  return String(text || '').trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Faz 7 — Uçtan uca orkestrasyon.
 * script -> ses -> görsel -> montaj -> KALİTE KONTROLÜ -> upload -> yorum
 * -> loglama -> bildirim. Ek olarak geçmiş videoların istatistikleri çekilir
 * (konu seçimi bu veriyle beslenir: öğrenme döngüsü).
 */
export async function runPipeline(opts = {}) {
  const { root = 'output', upload } = opts;
  const log = (msg) => console.log(`\n▶ ${msg}`);

  // YouTube yüklenebilir mi?
  const hasYouTube =
    config.youtube.clientId &&
    config.youtube.clientSecret &&
    config.youtube.refreshToken;
  const willUpload = upload === true || (upload !== false && hasYouTube);

  // 0) Öğrenme döngüsü: geçmiş videoların izlenme verisini tazele (best-effort).
  if (hasYouTube) {
    const n = await updateVideoStats().catch(() => 0);
    if (n) console.log(`[stats] ${n} videonun istatistiği güncellendi.`);
  }

  // 1) Script
  log('Faz 1: Script üretiliyor (Gemini)...');
  const script = await generateScript();
  const base = script.normalizedTopic;
  const workDir = path.join(root, base);
  console.log(`  konu: ${script.topic} (${script.format || 'story'}/${script.category || '-'})`);

  // 1.5) ORKESTRA: Görüntü Yönetmeni + Kurgucu/Ses Yönetmeni (paralel,
  // best-effort — düşen rol mekanik varsayılana bırakır, boru hattı kırılmaz).
  let editPlan = null;
  if (config.crew.enabled) {
    log('Faz 1.5: Orkestra (görüntü yönetmeni + kurgucu)...');
    const [shotList, edit] = await Promise.all([
      directVisuals(script).catch((e) => {
        console.warn(`[crew] görüntü yönetmeni düştü: ${String(e.message).slice(0, 90)}`);
        return null;
      }),
      planEdit(script).catch((e) => {
        console.warn(`[crew] kurgucu düştü: ${String(e.message).slice(0, 90)}`);
        return null;
      }),
    ]);
    if (shotList) applyShotList(script, shotList);
    editPlan = edit;
    const motions = (script.scenes || []).filter((s) => s.motion).length;
    console.log(
      `  görüntü yönetmeni: ${shotList ? `✓ (${motions} hareketli sahne)` : '— (taslakla devam)'}` +
        ` | kurgucu: ${edit ? `✓ (müzik:${edit.musicMood || script.category}, abone:sahne ${edit.subscribeScene + 1})` : '— (mekanik plan)'}`,
    );
  }

  try {
    // 2) Ses (edge-tts -> piper yedek)
    log('Faz 2: Seslendirme (TTS)...');
    const audio = await generateAudio(script, { outDir: workDir, basename: base });
    console.log(`  motor: ${audio.engine}, süre~ ${audio.durationEstimate.toFixed(1)}s`);

    // 3) Görsel (sahne başına AI görsel + Pexels/placeholder yedeği)
    log('Faz 3: Sahne görselleri üretiliyor (AI)...');
    const media = await generateImages(script, { outDir: root, basename: base });
    console.log(
      `  ${media.items.length} sahne — AI:${media.sources.ai} ` +
        `stokVideo:${media.sources.stock || 0} Pexels:${media.sources.pexels} ` +
        `yedek:${media.sources.placeholder}`,
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
      hookText: script.hook_text,
      category: script.category,
      editPlan,
      musicMood: editPlan?.musicMood || undefined,
      emphasisWords: script.emphasis_words || [],
      finaleText: script.finale_text || '',
      outPath,
    });
    console.log(`  ${video.width}x${video.height}, ${video.duration.toFixed(1)}s -> ${outPath}`);

    // 4.5) Yayın öncesi kalite kontrolü — bozuk video YouTube'a gitmez.
    log('Faz 4.5: Kalite kontrolü (preflight)...');
    const pf = await preflightCheck(outPath);
    console.log(`  metrikler: ${JSON.stringify(pf.metrics)}`);
    if (!pf.ok) {
      console.error(`  ❌ preflight başarısız: ${pf.issues.join(' | ')}`);
    } else {
      console.log('  ✅ tüm kontroller geçti');
    }

    // 6) Upload (opsiyonel + preflight şartlı)
    let youtube = null;
    if (willUpload && pf.ok) {
      log('Faz 6: YouTube upload...');
      const meta = await buildMetadata(script);
      const res = await uploadVideo({ videoPath: outPath, ...meta });
      youtube = { ...res, title: meta.title, publishedAt: new Date().toISOString() };
      console.log(`  yüklendi: ${res.url}`);

      // İlk yorum (etkileşim tetikleyici, best-effort).
      const commented = await postFirstComment(res.videoId, script).catch(() => false);
      if (commented) console.log('  ilk yorum atıldı');

      // Kelime-mükemmel altyazıyı resmi altyazı olarak yükle (SEO + erişilebilirlik).
      const srt = buildSrtFromWords(audio.wordTimings);
      if (srt) {
        const capOk = await uploadCaptions(res.videoId, srt).catch(() => false);
        if (capOk) console.log('  altyazı (SRT) yüklendi');
      }

      // Cross-post kiti: TikTok/Reels'e elle atmak için hazır metin paketi.
      const kit = [
        `TITLE:\n${meta.title}`,
        `\nDESCRIPTION:\n${meta.description}`,
        `\nTAGS:\n${(meta.tags || []).join(', ')}`,
        `\nHASHTAGS:\n${(meta.tags || []).slice(0, 6).map((t) => '#' + t.replace(/[^a-z0-9]/gi, '')).join(' ')}`,
        `\nYOUTUBE:\n${res.url}`,
      ].join('\n');
      await writeFile(path.join(workDir, 'publish-kit.txt'), kit).catch(() => {});
    } else if (willUpload && !pf.ok) {
      console.log('\n▶ Faz 6: upload İPTAL (preflight başarısız) — video artifact olarak duruyor.');
    } else {
      console.log('\n▶ Faz 6: YouTube upload atlandı (kredensiyel yok veya --no-upload).');
    }

    // Üretim raporu + önizleme kareleri (inceleme kolaylığı; best-effort).
    const report = {
      topic: script.topic,
      format: script.format || 'story',
      category: script.category || null,
      hook: script.hook_text || null,
      finale: script.finale_text || null,
      duration: +video.duration.toFixed(1),
      sources: media.sources,
      preflight: pf.metrics,
      editPlan: editPlan
        ? {
            musicMood: editPlan.musicMood,
            subscribeScene: editPlan.subscribeScene + 1,
            transitions: editPlan.boundaries.map((b) => b.transition).join(','),
            sfx: editPlan.boundaries.map((b) => b.sfx).join(','),
          }
        : 'mechanical',
      youtube: youtube?.url || null,
      createdAt: new Date().toISOString(),
    };
    await writeFile(path.join(workDir, 'report.json'), JSON.stringify(report, null, 2)).catch(() => {});
    for (const [name, t] of [['preview-hook.jpg', 0.5], ['preview-mid.jpg', video.duration * 0.5]]) {
      await execFileAsync('ffmpeg', [
        '-y', '-ss', t.toFixed(2), '-i', outPath, '-frames:v', '1',
        path.join(workDir, name),
      ], { maxBuffer: 10 * 1024 * 1024 }).catch(() => {});
    }

    // 5) Loglama
    log('Faz 5: Kayıt (state)...');
    const { videoId } = await recordProduction(script, {
      audioPath: audio.audioPath,
      videoPath: outPath,
      media: media.items,
      engine: audio.engine,
      duration: video.duration,
      status: youtube ? 'published' : pf.ok ? 'rendered' : 'failed_preflight',
      youtube,
    });
    console.log(`  kayıt id: ${videoId}`);

    // 7) Bildirim (best-effort).
    const msg = youtube
      ? `✅ neosaniye: "${script.topic}" yayında (${video.duration.toFixed(0)}s, ` +
        `AI:${media.sources.ai}/${media.items.length})\n${youtube.url}`
      : pf.ok
        ? `🎬 neosaniye: "${script.topic}" üretildi (upload atlandı).`
        : `⚠️ neosaniye: "${script.topic}" preflight'a takıldı: ${pf.issues.join(' | ')}`;
    await notify(msg).catch(() => {});

    if (willUpload && !pf.ok) {
      throw new Error(`Preflight başarısız: ${pf.issues.join(' | ')}`);
    }
    return { script, videoPath: outPath, youtube, videoId, preflight: pf };
  } catch (err) {
    await recordProduction(script, { status: 'failed', error: err.message }).catch(() => {});
    await notify(`❌ neosaniye üretim hatası (${script.topic}): ${err.message.slice(0, 300)}`).catch(() => {});
    throw err;
  }
}
