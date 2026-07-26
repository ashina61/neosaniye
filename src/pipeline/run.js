import path from 'node:path';
import { writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { config } from '../config.js';

const execFileAsync = promisify(execFile);
import { generateScript } from '../script/generateScript.js';
import { evaluateMeasuredDuration } from './durationPolicy.js';
import { directVisuals, applyShotList } from '../crew/visualDirector.js';
import { planVisualStory, MAX_ATMOSPHERE_SHARE } from '../crew/storyPlanner.js';
import { repairSemanticActions } from './semanticRepair.js';
import { applyPromptStyle } from '../crew/promptStyle.js';
import { applySideIdentity } from '../visual/sideIdentity.js';
import { planEdit } from '../crew/editorDirector.js';
import { analyzePerformance } from '../crew/analyst.js';
import { generateAudio } from '../tts/generateAudio.js';
import { fetchAmbienceTrack, defaultAmbienceQuery } from '../audio/fetchAmbience.js';
import { generateImages } from '../media/generateImages.js';
import { renderVideo } from '../video/renderVideo.js';
import { buildMetadata } from '../youtube/buildMetadata.js';
import { uploadVideo } from '../youtube/uploadVideo.js';
import { postFirstComment, updateVideoStats } from '../youtube/engage.js';
import { buildSrtFromWords, uploadCaptions } from '../youtube/captions.js';
import { crossPost } from '../social/meta.js';
import { preflightCheck } from './preflight.js';
import { recordPublicationBlock, runRetentionQC, uploadGate } from './retentionQC.js';
import { assessVisualNarration } from './visualNarrationQC.js';
import { appendQcHistory, buildQcHistoryEntry } from './qcHistory.js';
import { getRecentMusic, getRecentAssetIds } from '../lib/firestore.js';
import { describeMusicTrack } from '../audio/musicSelect.js';
import { detectSlot } from './scheduleExperiment.js';
import { emptySlotMetrics } from '../analytics/experimentMetrics.js';
import { semanticRelevanceScore, detectOffTopicVisual } from '../media/semanticRelevance.js';
import { applyCta } from '../motion/ctaEngine.js';
import { verifySfxInOutput } from './outputVerify.js';
import { evaluateHardGate } from './hardGate.js';
import { getRecentCtaTypes } from '../lib/firestore.js';
import { recordProduction } from './recordProduction.js';
import { notify } from '../lib/notify.js';
import {
  buildPublishingAttemptId,
  reservePublishingAttempt,
  updatePublishingPlatform,
} from './publishingLedger.js';
import { evaluateEmergencyQualityGate } from './emergencyQualityGate.js';
import { buildCanonicalTimeline, expandTimelineForMedia } from './canonicalTimeline.js';
import { validatePacing, validateViewerFirstScript } from './viewerFirstValidation.js';
import { resolveUploadPolicy, logUploadDecision, UPLOAD_BLOCKED_MESSAGE } from './uploadPolicy.js';
import { evaluateTechnicalPublishGate, decidePublish, logPublishDecision } from './technicalPublishGate.js';
import { validateFinalVideo } from './finalVideoValidator.js';
import { buildRunIntegrity } from './runIntegrity.js';
import { evaluatePublishGates } from './publishGates.js';
import { applySubjectBible } from '../crew/subjectBible.js';
import { validateCaptionIntegrity } from '../video/captionIntegrity.js';
import { analyzeCaptionLayout } from '../video/captionLayout.js';
import {
  assessSemanticActions, assessListStructure, assessCta, detectRepetition, assignListMarkers,
} from './storyAudit.js';

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

  // 14 günlük yayın saati deneyi: slot yalnızca TESPİT edilir ve etiketlenir;
  // hiçbir saat otomatik değiştirilmez (docs/publishing-experiment.md).
  const sched = detectSlot();
  console.log(
    `[deney] slot=${sched.slot} içerikGünü=${sched.contentDate}` +
      (sched.scheduledPublishAt ? ` planlanan=${sched.scheduledPublishAt}` : '') +
      ` durum=${sched.experiment.status}`,
  );

  // YouTube yüklenebilir mi?
  const hasYouTube =
    config.youtube.clientId &&
    config.youtube.clientSecret &&
    config.youtube.refreshToken;
  // YAYIN TALEBİ — kimlik bilgisi İZİN DEĞİLDİR.
  //
  // Eski satır: `upload === true || (upload !== false && hasYouTube)`.
  // Bayrak verilmediğinde (cron'da hep böyleydi) ifade `hasYouTube`e
  // indirgeniyordu: YouTube secret'ı tanımlıysa video yayınlanıyordu. Bir
  // anahtarın varlığı, o gün üretilen videonun yayınlanabilir olduğunu
  // söylemez. Karar artık uploadPolicy'de ve varsayılanı KAPALI.
  const uploadIntent = resolveUploadPolicy({
    cliUpload: upload,
    hasCredentials: Boolean(hasYouTube),
    // Bu aşamada yalnızca TALEP soruluyor; kapılar render + QC sonrasında.
    preflightOk: true,
    qc: { report: {} },
  });
  const willUpload = uploadIntent.requested;
  if (!willUpload) {
    console.log(`[yayın] upload kapalı (${uploadIntent.checks.source}) — video artifact olarak kalacak.`);
    console.log(UPLOAD_BLOCKED_MESSAGE);
  }

  // 0) Öğrenme döngüsü: geçmiş videoların izlenme verisini tazele (best-effort).
  if (hasYouTube) {
    const n = await updateVideoStats().catch(() => 0);
    if (n) console.log(`[stats] ${n} videonun istatistiği güncellendi.`);
  }

  // 0.5) BAŞ ANALİST: izlenme verisinden strateji notu (best-effort, +1 çağrı,
  // yeterli veri yoksa sessizce atlar). Tüm orkestrayı veriyle besler.
  let strategyBrief = '';
  const analysis = await analyzePerformance().catch(() => null);
  if (analysis?.brief) {
    strategyBrief = analysis.brief;
    console.log(`[analist] strateji: ${strategyBrief}`);
  }

  // 1) Script
  log('Faz 1: Script üretiliyor (Gemini → Groq → OpenRouter)...');
  const script = await generateScript({ strategyBrief });
  script.strategyBrief = strategyBrief; // şefler de okusun (görüntü + kurgu)
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
    // A valid MP3 alone is not enough: do not spend the rest of a production
    // run rendering a fragmentary 15-second video.
    const runtime = evaluateMeasuredDuration(audio.duration, config.content);
    if (!runtime.ok) {
      throw new Error(
        `${runtime.code}: ölçülen anlatım ${runtime.seconds.toFixed(1)}s; hedef ` +
        `${config.content.minDurationSeconds}-${config.content.maxDurationSeconds}s. Scripti yeniden üretin.`,
      );
    }
    const canonicalTimeline = buildCanonicalTimeline({
      scenes: script.scenes || [],
      segmentTexts: audio.segmentTexts,
      wordTimings: audio.wordTimings,
      duration: audio.duration,
      timingSource: audio.timingSource,
    });
    console.log(`  timeline: ${canonicalTimeline.source}${canonicalTimeline.fallbackUsed ? ' (fallback)' : ''}`);

    // 2.5) Ambiyans yatağı (Freesound, CC0; best-effort). Kurgucu'nun seçtiği
    // ortam sesi sorgusu; Kurgucu düştüyse kategori varsayılanı.
    let ambience = null;
    if (config.video.ambience && config.freesound.apiKey) {
      const ambQuery = editPlan?.ambience || defaultAmbienceQuery(script.category);
      ambience = await fetchAmbienceTrack(ambQuery, path.join(workDir, 'ambience.mp3'));
      if (ambience) {
        console.log(`[amb] ambiyans: "${ambQuery}" → ${ambience.name} (${Math.round(ambience.duration)}s)`);
      }
    }

    // Görsel stil: story/whatif videolarının ~%40'ı "animasyonlu hikâye
    // kitabı" (illüstrasyon + canlı doku) stilinde çıkar. process/howworks
    // gerçek görüntü ağırlıklı olduğundan hep fotogerçekçi kalır.
    // VIDEO_STYLE=animated|photo ile elle zorlanabilir.
    const styleEnv = process.env.VIDEO_STYLE;
    const visualStyle =
      styleEnv === 'animated' || styleEnv === 'photo'
        ? styleEnv
        : ['story', 'whatif'].includes(script.format || 'story') && Math.random() < 0.4
          ? 'animated'
          : 'photo';
    if (visualStyle === 'animated') console.log('  görsel stil: animasyonlu hikâye kitabı');

    // Sahne süreleri, anlatım kelime sayısına göre orantılı.
    // (cta artık seslendirilmiyor — yalnızca sahne anlatımları zamanlamayı belirler.)
    const scenes = script.scenes || [];
    const sceneWeights = scenes.map((s) => Math.max(1, wordCount(s.narration)));
    const sceneSeconds = canonicalTimeline.scenes.map((s) => s.duration);

    // 2.9) GÖRSEL HİKÂYE PLANI — SIRALAMA BURADA TERSİNE DÖNER (V3 Faz 2).
    // Eskiden görsel önce üretiliyor, anlam sonra üstüne yapıştırılıyordu;
    // dekorasyonun kök nedeni buydu. Artık her cümle ÖNCE bir görsel hikâye
    // şablonuna bağlanır ve image_prompt o şablonun gerektirdiği kompozisyonu
    // ZORUNLU kılar (ör. mekanizma anlatan sahne "kesit" ister — yoksa hava
    // akışı okları çizilebilecek bir zemin bulamaz).
    // Deterministiktir: sağlayıcı zinciri düşse bile çalışır.
    // 2.84) LİSTE YAPISI — "5 facts" diyorsan beş madde ve beş numara olacak.
    // Teslim edilemiyorsa sayı hook'tan KALDIRILIR (vaat edip vermemektense).
    const listPlan = assignListMarkers(script);
    if (listPlan.declared) {
      console.log(listPlan.strippedClaim
        ? `  liste: ${listPlan.declared} madde vaat edildi ama ayrılamadı — sayı hook'tan kaldırıldı.`
        : `  liste: ${listPlan.assigned}/${listPlan.declared} madde işaretlendi.`);
    }

    // 2.85) ÖZNE KİMLİK KİLİDİ — hikâye planından ÖNCE. Kimlik ön eki
    // image_prompt'un en başına girer; hikâye kompozisyonu onun üstüne biner.
    // Canlıda sahneler arası tırtıl/kırkayak/zırhlı solucan geçişlerinin
    // sebebi, her sahnenin promptunun bağımsız üretilmesiydi.
    const { bible, applied: bibleApplied } = applySubjectBible(script);
    console.log(
      `  özne kilidi: "${bible.canonicalName}"` +
      `${bible.scientificCategory ? ` (${bible.scientificCategory})` : ''} — ` +
      `${bibleApplied}/${(script.scenes || []).length} sahneye uygulandı, ` +
      `${bible.forbiddenTraits.length} yasak anatomi terimi, kaynak: ${bible.verifiedSource}`,
    );

    const storyPlan = planVisualStory(script);
    console.log(
      `  görsel hikâye: ${storyPlan.stats.composed}/${storyPlan.stats.total} sahnenin ` +
      `kompozisyonu hikâyeye göre kısıtlandı ` +
      `(${Object.entries(storyPlan.stats.byTemplate).map(([k, v]) => `${k}:${v}`).join(' ')}) ` +
      `| izleyici görevi: ${storyPlan.stats.viewerTasks}`,
    );
    if (storyPlan.stats.atmosphereCapExceeded) {
      console.warn(`  ⚠️ atmosphere oranı ${storyPlan.stats.atmosphereShare} (tavan ${MAX_ATMOSPHERE_SHARE}) `
        + `— ${storyPlan.stats.reclassified.length} sahne aktif şablona çekildi.`);
    }

    // ---- SEMANTİK OTOMATİK DÜZELTME (§15) — RENDER'DAN ÖNCE, TEK TUR ----
    //
    // QC artık cellat değil editör: düşük semantik skor cron'u durdurmaz,
    // önce DÜZELTİLMEYE çalışılır. Ölçüm bu noktada plandan yapılır (odak ve
    // aktörler henüz yok, onlar render sırasında ölçülüyor); amaç "bu sahne
    // anlattığı eylemi barındıran bir kadraj mı istiyor" sorusunu görsel
    // ÜRETİLMEDEN ÖNCE yanıtlamak. Görsel üretildikten sonra düzeltmek,
    // yeniden üretim demek olurdu.
    const planSemantics = assessSemanticActions(
      (script.scenes || []).map((sc) => ({
        narration: sc.narration,
        template: sc.story_template,
        focus: null,
        hasSequence: false,
        actors: [],
      })),
    );
    const semanticRepairResult = repairSemanticActions(script, planSemantics);
    if (semanticRepairResult.attempted) {
      console.log(`  [semantik-onarım] ${semanticRepairResult.reason}`);
      for (const c of semanticRepairResult.changedScenes) {
        console.log(`     sahne ${c.scene}: ${c.from} → ${c.to}`);
      }
      // Atlananlar GİZLENMEZ: neyin düzeltilemediğini bilmek, sonraki turda
      // neyi geliştirmek gerektiğini söyler.
      for (const sk of semanticRepairResult.skipped.slice(0, 4)) {
        console.log(`     sahne ${sk.scene} atlandı: ${sk.reason}`);
      }
      if (semanticRepairResult.qualityDegraded) {
        console.warn('  [semantik-onarım] quality_degraded=true — mevcut güvenli plan ile devam.');
      }
    }

    // ---- §9 PROMPT ÇELİŞKİLERİ + §8 TARAF RENK KİMLİĞİ ----
    //
    // SIRA ÖNEMLİ: önce kategori stili (çelişen yasakları temizler), sonra
    // taraf kimliği (her sahneye kendi renk/doku dilini yazar). Ters sırada
    // kategori temizliği, taraf kimliğinin eklediği renk terimlerini de
    // süpürebilirdi.
    const promptStyleResult = applyPromptStyle(script);
    if (promptStyleResult.contradictionsRemoved.length) {
      console.log(`  [prompt-stil] ${promptStyleResult.style}: çelişen yasak kaldırıldı — `
        + promptStyleResult.contradictionsRemoved.join(', '));
    }
    const sideIdentityResult = applySideIdentity(script);
    if (sideIdentityResult.pair) {
      console.log(`  [taraf-kimliği] ${sideIdentityResult.pair.a} ↔ ${sideIdentityResult.pair.b} `
        + `(${Object.entries(sideIdentityResult.assigned).map(([k, v]) => `${k}:${v}`).join(' ')}) `
        + '— sesi kapalı izleyici hangi tarafın anlatıldığını renkten görür.');
    }

    // 3) Görsel (sahne başına AI görsel + Pexels/placeholder yedeği).
    // TEMPO: 4.3sn'yi aşan statik AI sahneleri İKİ farklı kadraja bölünür
    // (canlı QC: 7 plan/5.5sn ortalama statikti — göz sıkılıyor).
    log('Faz 3: Sahne görselleri üretiliyor (AI)...');
    const recentAssetIds = await getRecentAssetIds(5).catch(() => []);
    const media = await generateImages(script, { outDir: root, basename: base, style: visualStyle, sceneSeconds, avoidAssetIds: recentAssetIds });
    console.log(
      `  ${media.items.length} plan / ${scenes.length} sahne — AI:${media.sources.ai} ` +
        `arşiv:${media.sources.archive || 0} ` +
        `stokVideo:${media.sources.stock || 0} Pexels:${media.sources.pexels} ` +
        `gfx:${media.sources.gfx || 0} yedek:${media.sources.placeholder}`,
    );
    if (!media.items.length) throw new Error('Hiç sahne görseli üretilemedi.');
    const renderTimeline = expandTimelineForMedia(canonicalTimeline, media.items);

    // Plan (item) ağırlıkları: bölünen sahnenin ağırlığı parçalara eşit dağılır.
    const partsPerScene = {};
    for (const it of media.items) partsPerScene[it.scene] = (partsPerScene[it.scene] || 0) + 1;
    const itemWeights = media.items.map(
      (it) => Math.max(0.5, (sceneWeights[it.scene] ?? 1) / (partsPerScene[it.scene] || 1)),
    );

    // Kurgu planını plan sayısına genişlet: aynı sahnenin parçaları arasına
    // sade 'cut' girer; sahneler arası sınırlar Kurgucu'nun kararını korur.
    // Abone kartı sahne indeksinden plan indeksine çevrilir.
    if (editPlan && media.items.length !== scenes.length) {
      const firstItemOfScene = {};
      media.items.forEach((it, idx) => {
        if (!(it.scene in firstItemOfScene)) firstItemOfScene[it.scene] = idx;
      });
      const newBounds = [];
      for (let k = 1; k < media.items.length; k += 1) {
        const prev = media.items[k - 1];
        const cur = media.items[k];
        newBounds.push(
          cur.scene === prev.scene
            ? { transition: 'cut', sfx: 'none' }
            : editPlan.boundaries[cur.scene - 1] || { transition: 'cut', sfx: 'none' },
        );
      }
      editPlan = {
        ...editPlan,
        boundaries: newBounds,
        subscribeScene: firstItemOfScene[editPlan.subscribeScene] ?? editPlan.subscribeScene,
      };
    }

    // 4) Montaj (ffmpeg)
    log('Faz 4: Video montajı (ffmpeg)...');
    const outPath = path.join(workDir, `${base}.mp4`);
    // Son 5 videonun müziği tekrar seçilmesin (çeşitlilik; state yoksa boş).
    const recentMusic = await getRecentMusic(5).catch(() => []);
    const video = await renderVideo({
      audioPath: audio.audioPath,
      wordTimings: audio.wordTimings,
      // BU EŞLEME DOĞRULAMANIN GÖRDÜĞÜ HER ŞEYİ BELİRLER. Daraltılmış nesne
      // loopEcho/part/assetId/source alanlarını düşürüyordu ve sonuçlar
      // sessizdi, çünkü hepsi "undefined" olarak makul görünüyor:
      //   • loopEcho düştüğü için overlayWindows.loopEcho DAİMA boş kaldı —
      //     kasıtlı döngü kapanışı muafiyeti üretimde hiç çalışmadı ve her
      //     koşuda DUPLICATE_SHOT + HOOK_OUTSIDE_PLAN olarak raporlandı.
      //   • part düştüğü için her klip part=0 aldı; kimlikler yalnızca sahneye
      //     göre ayrışıyordu.
      //   • assetId düştüğü için kopya tespiti plan kanıtına hiç bakamadı ve
      //     her eşleşme "algısal" sayıldı.
      media: media.items.map((m) => ({
        path: m.path,
        type: m.type,
        gfx: m.source === 'gfx',
        sequence: Boolean(m.sequence),
        part: m.part ?? 0,
        loopEcho: Boolean(m.loopEcho),
        assetId: m.assetId || m.path || null,
        source: m.source || null,
      })),
      mediaScene: media.items.map((m) => m.scene),
      scenes,
      timeline: renderTimeline,
      sceneWeights: itemWeights,
      hookText: script.hook_text,
      category: script.category,
      editPlan,
      musicMood: editPlan?.musicMood || undefined,
      ambiencePath: ambience?.path || null,
      visualStyle,
      // Process (gerçek görüntü) videolarında ok+etiket dikkat katmanı.
      annotate: (script.format || 'story') === 'process',
      emphasisWords: script.emphasis_words || [],
      finaleText: script.finale_text || '',
      avoidMusic: recentMusic,
      // Deterministik müzik seed'i — aynı konu aynı parçayı, farklı konu çeşidi verir.
      musicSeed: script.normalizedTopic || base,
      outPath,
    });
    console.log(`  ${video.width}x${video.height}, ${video.duration.toFixed(1)}s -> ${outPath}`);

    // GÖRSEL ANLATIM KAPISI: "slayt mı, anlatım mı?" Aynı görselin tekrarını ve
    // semantik anlatım yokluğunu yakalar — mevcut kapıların hiçbiri görmüyordu
    // (10 sahnenin hepsi aynı kare olan bir video tüm QC'lerden geçmişti).
    const vnQC = assessVisualNarration({
      items: media.items,
      beats: video.semanticBeats || [],
      motionPlan: video.renderPlan?.motion || [],
      duration: video.duration,
      scenes: script.scenes || [],       // V3: story_template / viewer_task
      actorStats: video.actorStats,      // V3: aktör vs kart ayrımı
    });
    const m = vnQC.metrics;
    console.log(
      `  görsel anlatım: ${m.uniqueVisuals} benzersiz plan / ${m.semanticBeats} semantik kompozisyon ` +
        `(${Object.entries(m.semanticKinds).map(([k, v]) => `${k}:${v}`).join(' ') || 'yok'}) ` +
        `hook-olayı:${m.hookEvent ? 'var' : 'YOK'}\n` +
        `  sessiz anlaşılırlık: ${m.microShots} mikro plan / ` +
        `aktörlü sahne %${m.actorRatio == null ? '?' : Math.round(m.actorRatio * 100)} / ` +
        `${m.viewerTasks} izleyici görevi ` +
        `(${Object.entries(m.storyTemplates).map(([k, v]) => `${k}:${v}`).join(' ') || 'şablon yok'})`,
    );
    for (const w of vnQC.warnings) console.warn(`  [görsel-anlatım] uyarı: ${w}`);
    for (const f of vnQC.failures) console.error(`  [görsel-anlatım] BAŞARISIZ: ${f}`);
    for (const f of vnQC.fixes) console.error(`  [görsel-anlatım] öneri: ${f}`);

    // Müzik lisans künyesi (CC0 manifesti veya eski havuz) — rapor + kayda girer.
    const musicMeta = video.musicTrack
      ? describeMusicTrack(video.musicTrack)
      : video.musicDecision?.reason === 'procedural-bed'
        ? {
            file: 'procedural',
            source: 'src/audio/makeMusic.js',
            license: 'proprietary-original',
            licenseEvidence: 'src/audio/makeMusic.js',
          }
        : null;
    if (musicMeta) {
      musicMeta.assetId ||= musicMeta.file || 'procedural';
      musicMeta.selectedAt = new Date().toISOString();
    }

    // 4.2) NEO MOTION ENGINE — özgün CTA animasyonu (editoryal seçim + safe-area).
    // Preflight/QC ÖNCESİ uygulanır ki final MP4 CTA'lı olsun. CTA hatası ana
    // videoyu ASLA çökertmez (fail-safe); uygulanırsa outPath yerine geçer.
    let motionReport = { enabled: false, ctaApplied: false, selectionReason: 'disabled' };
    if (config.motion.enabled && config.motion.cta.enabled) {
      const recentCtaTypes = await getRecentCtaTypes().catch(() => []);
      const outroOn = config.video.outro;
      const m = await applyCta({
        videoPath: outPath,
        workDir,
        duration: video.duration,
        seed: script.normalizedTopic || base,
        outroStartSec: outroOn ? video.duration - (config.video.outroDuration || 3) : null,
        recentCtaTypes,
        // İçerik dili → CTA yerelleştirme (İngilizce kanal = 'en'). Betikte
        // dil belirtildiyse onu, yoksa global config'i kullan.
        language: script.language || config.content?.language || 'en',
      });
      motionReport = m.report;
      if (m.videoPath !== outPath) {
        // CTA'lı sürümü ana çıktının üstüne al (downstream tek yol kullanır).
        await execFileAsync('mv', ['-f', m.videoPath, outPath]).catch(async () => {
          const { rename } = await import('node:fs/promises');
          await rename(m.videoPath, outPath);
        });
      }
      console.log(
        m.report.ctaApplied
          ? `  🎬 CTA: ${m.report.ctaId} (${m.report.ctaType}, ${m.report.startSec}s, ${m.report.position})`
          : `  🎬 CTA yok: ${m.report.selectionReason}`,
      );
    }

    // 4.5) Yayın öncesi TEKNİK kalite kontrolü — final MP4 üzerinde ffprobe/
    // ffmpeg taraması (decode, siyah/donma/sessizlik, loudness). Bozuk video
    // hiçbir platforma gitmez.
    log('Faz 4.5: Kalite kontrolü (preflight)...');
    const pf = await preflightCheck(outPath, { expectedDuration: video.duration, renderPlan: video.renderPlan });
    console.log(`  metrikler: ${JSON.stringify(pf.metrics)}`);
    for (const w of pf.warnings || []) console.warn(`  ⚠️ ${w}`);
    if (!pf.ok) {
      console.error(`  ❌ preflight başarısız: ${pf.issues.join(' | ')}`);
    } else {
      console.log('  ✅ tüm sert kontroller geçti');
    }

    // 4.55) RENDER SONRASI GERÇEK ÇIKTI DOĞRULAMASI — kaynak gerçek FINAL MP4.
    // SFX'in "adı planda geçmesi" kanıt DEĞİL: her cue'nun cue-öncesi tabana
    // göre duyulur enerji farkı final videodan ÖLÇÜLÜR. CTA dil/yerleşim ve
    // kanal (stereo) gerçeği de burada. Sert ihlaller upload'u HER MODDA durdurur.
    log('Faz 4.55: Render sonrası çıktı doğrulaması...');
    const sfxCues = [...(video.sfxCues || [])];
    // CTA 'pop' cue'su (ayrı pass'te bindirildi) — o da doğrulanır.
    if (motionReport.ctaApplied && config.motion.cta.sfx && motionReport.sfxId) {
      sfxCues.push({
        atSeconds: motionReport.startSec,
        sfxId: `cta:${motionReport.sfxId}`,
        assetResolved: true,
        mixedInGraph: true,
      });
    }
    // SFX kapalıyken doğrulanacak cue yoktur; kapıyı "başarısız" saymak
    // (26 Tem'de sesler bilinçli kapatıldı) her videoyu boş yere bloklardı.
    const sfxVerification = config.video.sfx === false
      ? { ok: true, cues: [], failures: [], repetition: {}, skipped: 'sfx-disabled' }
      : await verifySfxInOutput(outPath, sfxCues).catch((err) => {
        console.error(`[verify] SFX doğrulaması çöktü: ${err.message}`);
        return { ok: false, cues: [], failures: ['SFX_OUTPUT_VERIFICATION_FAILED'], repetition: {} };
      });
    for (const c of sfxVerification.cues) {
      if (c.verified) console.log(`  🔊 SFX ✓ ${c.atSeconds}s ${c.requested} (+${c.audibleDeltaDb}dB)`);
      else console.warn(`  🔇 SFX ✗ ${c.atSeconds}s ${c.requested} — ${c.code}${c.audibleDeltaDb != null ? ` (+${c.audibleDeltaDb}dB)` : ''}`);
    }

    // Kanal gerçeği: çıktı stereo (2) olmalı; mono ise metadata ile çelişki.
    const channelTruth = {
      expectedChannels: 2,
      actualChannels: pf.technical?.audioChannels ?? null,
      layoutExpected: 'stereo',
      layoutActual: pf.technical?.audioChannelLayout ?? null,
    };

    // Müzik çeşitlilik gerçeği (renderVideo kararından).
    const musicDecision = video.musicDecision || null;

    // Output/editorial findings are report-only; technical preflight remains the publish gate.
    const hard = evaluateHardGate({
      sfxVerification,
      ctaVerification: motionReport.ctaVerification || null,
      ctaApplied: motionReport.ctaApplied,
      ctaLanguageMatch: motionReport.languageMatch ?? null,
      music: musicDecision
        ? { repeatedFallback: musicDecision.repeatedFallback, poolExhausted: musicDecision.poolExhausted, silentFallback: musicDecision.silentFallback }
        : null,
      channelTruth,
    });
    if (hard.failures.length) {
      console.warn(`  ⚠️ editoryal çıktı uyarıları: ${hard.failures.join(', ')} — upload devam edecek.`);
      for (const rsn of hard.reasons) console.warn(`     • ${rsn}`);
    } else {
      console.log('  ✅ çıktı doğrulaması raporlandı');
    }
    const outputVerification = { sfx: sfxVerification, cta: motionReport.ctaVerification || null, channelTruth, music: musicDecision, hardGate: hard };

    // Acil üretim kapısı: yalnızca mevcut, doğrulanabilir metadata ve final-file
    // teknik gerçeğini kullanır. Piksel semantiği/OCR/AI kalite tahmini yapmaz.
    const emergencyQuality = evaluateEmergencyQualityGate({
      script,
      wordTimings: audio.wordTimings,
      mediaItems: media.items,
      music: musicMeta,
      ambience,
      technical: pf.technical || {},
      duration: pf.technical?.durationSeconds || video.duration,
      timeline: renderTimeline,
      renderPlan: video.renderPlan,
      viewerValidation: validateViewerFirstScript(script),
      musicRequired: Boolean(config.video.music),
    });
    outputVerification.emergencyQuality = emergencyQuality;
    const assetManifest = {
      version: 1,
      createdAt: new Date().toISOString(),
      videoId: script.normalizedTopic || base,
      visuals: media.items.map((m, index) => ({
        index, scene: m.scene, type: m.type, source: m.source || null,
        provider: m.provider || null, assetId: m.assetId || m.pexelsId || null,
        sourceUrl: m.sourceUrl || null, query: m.query || m.keyword || null,
        creator: m.author || null, license: m.license || null,
        licenseEvidence: m.licenseEvidence || null,
        rightsClass: m.rightsClass || null,
        retrievedAt: m.retrievedAt || m.generatedAt || null,
      })),
      music: musicMeta,
      ambience,
      generatedSfx: (video.sfxCues || []).map((cue) => ({
        id: cue.sfxId, atSeconds: cue.atSeconds, source: 'src/video/renderVideo.js',
        license: 'proprietary-original', licenseEvidence: 'src/video/renderVideo.js',
      })),
    };
    await writeFile(path.join(workDir, 'asset-manifest.json'), JSON.stringify(assetManifest, null, 2));
    if (emergencyQuality.block) {
      console.error(`  ⛔ ACİL KALİTE KAPISI (YAYIN DURDU): ${emergencyQuality.blocking.join(', ')}`);
      for (const reason of emergencyQuality.reasons) console.error(`     • ${reason}`);
    }
    if (emergencyQuality.advisory?.length) {
      console.warn(`  📋 künye eksiği (yayını durdurmaz): ${emergencyQuality.advisory.length} kayıt`);
    }

    // 4.6) RETENTION QC — deterministik editoryal kapı (rapor + mod kararı).
    // warning modda (varsayılan) yalnızca raporlar; strict modda düşük skor
    // upload'u engeller (video artifact olarak kalır, akış kırılmaz).
    const itemSeconds = renderTimeline.items.map((item) => item.duration);
    const pacingIssues = validatePacing({
      timeline: renderTimeline,
      mediaItems: media.items,
      transitions: editPlan?.boundaries?.map((b) => b.transition) || [],
    });

    // EDİTORYAL SFX EŞLEME: her (gerçekten miks edilmiş) SFX cue'sunu düştüğü
    // sahnenin anlatımıyla eşle — editoryal doğrulama (semantik uyum: riser=build,
    // impact=reveal, shimmer=uygun sahne) bunu okur. Sayı ZORLANMAZ; sistem ne
    // seçtiyse odur. cumStart[i] = i. medya öğesinin başlangıç saniyesi.
    const cumStart = [];
    { let acc = 0; for (const s of itemSeconds) { cumStart.push(acc); acc += s; } }
    const itemAt = (t) => { let idx = 0; for (let k = 0; k < cumStart.length; k += 1) if (t >= cumStart[k] - 0.001) idx = k; return idx; };
    const editorialSfx = (video.sfxCues || []).map((c) => {
      const i = itemAt(c.atSeconds);
      const it = media.items[i];
      const sc = it ? script.scenes?.[it.scene] : null;
      return {
        atSeconds: c.atSeconds,
        type: c.sfxId,
        sceneIndex: it?.scene ?? null,
        narration: String(sc?.narration || '').slice(0, 160),
      };
    });
    outputVerification.editorialSfx = editorialSfx;
    outputVerification.ambience = ambience?.name || null;

    // Semantik alaka (best-effort): stok görsellerin anahtar kelimesi o sahnenin
    // anlatımıyla örtüşüyor mu? AI/gfx/arşiv üretimde konu-türevi olduğundan
    // null (cezasız); yalnızca stok/pexels için ölçülür (alakasız stok yakalanır).
    // SAHNE-ANLATIM UYUMU — AI GÖRSELLER DE ÖLÇÜLÜR.
    //
    // Eski koşul yalnızca stock/pexels'i ölçüyordu. fungal-networks koşusu
    // %100 AI görseldi, dolayısıyla `semanticRelevance.count = 0` çıktı: uyum
    // HİÇ ölçülmedi. Sahne 2'nin anlatımı "how do these networks actually
    // work?" iken görsel "mikroskopla toprak inceleyen bir araştırmacı"ydı ve
    // hiçbir kapı bunu görmedi — oysa ölçülseydi örtüşme sıfıra yakın çıkardı.
    //
    // AI tarafında karşılaştırma metni ÇEKİRDEK prompt'tur (modelin sahne için
    // yazdığı özgün tarif). Tam prompt kullanılsaydı her sahnede aynı olan
    // kompozisyon+stil metni örtüşmeyi şişirir ve ölçüm anlamsızlaşırdı.
    const itemRelevance = media.items.map((m) => {
      const scene = script.scenes?.[m.scene];
      if (!scene) return null;
      const forbidden = scene.forbidden_mismatches || [];
      const tags = ['stock', 'pexels'].includes(m.source)
        ? m.keyword
        : (m.source === 'ai' ? scene.image_prompt_core : null);
      if (!tags) return null;
      return semanticRelevanceScore(scene.narration || '', tags, { forbiddenMismatches: forbidden }).score;
    });

    // SAHNE İLE ANLATIM AYNI ŞEYİ Mİ ANLATIYOR? Dar ve kanıtlı kontrol:
    // görselin tarifi, sahnenin ya da videonun söz ettiği HİÇBİR şeyi
    // içermiyorsa görsel başka bir konuyu gösteriyordur.
    const topicWords = [script.topic, script.subjectBible?.canonicalName].filter(Boolean);
    const offTopicScenes = [];
    media.items.forEach((m, i) => {
      const scene = script.scenes?.[m.scene];
      if (!scene) return;
      const imageText = ['stock', 'pexels'].includes(m.source)
        ? String(m.keyword || '')
        : String(scene.image_prompt_core || '');
      const r = detectOffTopicVisual({
        narration: scene.narration || '',
        imageText,
        sceneKeywords: scene.keywords || [],
        topicWords,
      });
      if (r.checked && r.offTopic) {
        offTopicScenes.push({ clip: i, scene: m.scene, narration: (scene.narration || '').slice(0, 70) });
      }
    });
    if (offTopicScenes.length) {
      console.warn(`  ⚠️ sahne-anlatım uyumsuz (${offTopicScenes.length}): `
        + offTopicScenes.slice(0, 3).map((o) => `sahne ${o.scene}`).join(', ')
        + ' — görsel, anlatımın ya da konunun hiçbir öğesini içermiyor.');
    }
    // ---- FINAL MP4 DOĞRULAMASI (tek gerçek kaynak) ----
    //
    // Buraya kadar her kapı PLANI okuyordu. Kolibri koşusu şunu kanıtladı:
    // plan doğru olabilir, çıkan video yanlış olabilir ve hiçbir rapor bunu
    // görmez ("CTA uygulanmadı" derken ekranda pil vardı). Bu çağrı gerçek
    // MP4'ü kare kare tarar ve sonucu yayın kapısının BİRİNCİL girdisi olur.
    const renderedOverlays = [
      ...(video.renderPlan?.overlayLayers || []),
      // motion CTA run.js'te uygulanır — render'ın bildirimine eklenir.
      ...(motionReport.ctaApplied ? ['cta'] : []),
    ];
    const ow = video.renderPlan?.overlayWindows || {};
    const finalVideo = await validateFinalVideo(outPath, {
      duration: video.duration,
      clips: video.renderPlan?.clips || [],
      hookWindows: ow.hook || [],
      diagramWindows: ow.diagram || [],
      ctaWindows: [
        ...(ow.cta || []),
        ...(motionReport.ctaApplied && Number.isFinite(motionReport.startSec)
          ? [[motionReport.startSec, motionReport.startSec + (motionReport.durationSec || 1)]] : []),
      ],
      loopEchoWindows: ow.loopEcho || [],
      declaredOverlays: [...new Set(renderedOverlays)],
    }).catch((err) => {
      console.warn(`[final-video] doğrulama çalıştırılamadı: ${String(err.message).slice(0, 90)}`);
      return null;
    });
    if (finalVideo) {
      console.log(
        `  final MP4: ${finalVideo.sampledFrames} kare @${finalVideo.fps}fps | ` +
        `hook ${finalVideo.hookOccurrences.length}× | diyagram ${finalVideo.diagramOccurrences.length}× | ` +
        `CTA ${finalVideo.ctaOccurrences.length}× | kopya plan ${finalVideo.duplicateShots.length} | ` +
        `en uzun durağan ${finalVideo.longestStaticStreakSeconds}s | sıra ${finalVideo.sceneOrderValid ? '✓' : 'BOZUK'}`,
      );
      for (const f of finalVideo.failures) console.error(`  [final-video] BAŞARISIZ: ${f}`);
      for (const w of finalVideo.warnings) console.warn(`  [final-video] uyarı: ${w}`);
    } else {
      console.error('  [final-video] DOĞRULANAMADI — doğrulanmamış video yayınlanmaz.');
    }
    outputVerification.finalVideo = finalVideo;

    // ---- RUN INTEGRITY: bütün artifact'ler AYNI koşuya mı ait? ----
    const runIntegrity = await buildRunIntegrity({
      workDir, videoPath: outPath, script, renderPlan: video.renderPlan,
    }).catch(() => null);
    outputVerification.runIntegrity = runIntegrity;
    if (runIntegrity) {
      console.log(`  run integrity: ${runIntegrity.runId} (zincir ${runIntegrity.chainHash.slice(0, 12)}…)`);
    }


    // ALTYAZI + SEMANTİK EYLEM ÖLÇÜMÜ — retention puanı bunlara BAĞLI olduğu
    // için QC'den ÖNCE hesaplanmak zorunda. (Aşağıya bırakıldığında TDZ hatası
    // veriyordu: "Cannot access 'semanticActions' before initialization" —
    // test/pipelineOrder.test.js bu sınıf hatayı statik olarak yakalıyor.)
    const captionLayout = analyzeCaptionLayout(audio.wordTimings || [], {
      emphasisWords: script.emphasis_words || [],
    });
    const captionIntegrity = validateCaptionIntegrity({
      events: captionLayout.events,
      ttsText: (script.scenes || []).map((s) => s.narration).join(' '),
    });
    const semanticActions = assessSemanticActions(
      (script.scenes || []).map((s, i) => ({
        narration: s.narration,
        template: s.story_template,
        focus: video.sceneFocus?.[i] || null,
        hasSequence: media.items.some((m) => m.scene === i && m.sequence),
        actors: (video.actorsByScene?.[i]) || [],
      })),
    );

    const qc = await runRetentionQC({
      script,
      wordTimings: audio.wordTimings,
      emphasisWords: script.emphasis_words || [],
      itemSeconds,
      itemTypes: media.items.map((m) => m.type),
      itemSources: media.items.map((m) => m.source),
      // §7: türev klipler (#b/#c) yeni plan sayılmasın diye TEMEL varlık kimliği.
      itemAssetIds: media.items.map((m) => m.assetId || m.path),
      // §14: puanın gerçeği tarif etmesi için editoryal ölçümler skora girer.
      semanticActionAverage: semanticActions?.average ?? null,
      captionReadability: captionLayout?.readability?.ok ?? null,
      // §13 — blok sayısı ile kelime vurgu sayısı AYRI alanlar.
      captionBlockCount: captionLayout?.events?.length ?? null,
      wordHighlightEventCount: (audio.wordTimings || []).length,
      finalVideoStructuralFailure: (finalVideo?.failures || [])
        .some((f) => /UNREADABLE|TIMELINE_ORDER_INVALID|DURATION_MISMATCH/.test(String(f))),
      itemRelevance,
      editPlan,
      timeline: renderTimeline,
      renderPlan: video.renderPlan,
      pacingIssues,
      duration: video.duration,
      lufs: pf.metrics.lufs ?? null,
      audioPresent: !pf.issues.some((i) => i.includes('ses akışı')),
    }, workDir, {
      technical: pf.technical || null,
      // FINAL MP4 kararı raporun içine girer (productionReady artık buna bağlı).
      finalVideo,
      runIntegrity,
      aiProvider: script.aiProvider || null,
      technicalPassed: pf.ok,
      blockingReasons: [...(hard.reasons || []), ...(emergencyQuality.reasons || [])],
      motion: motionReport,
      assetManifest,
      ttsPhrasingIssues: audio.phrasingIssues || [],
      uploadRequested: willUpload,
      platforms: {
        youtube: Boolean(hasYouTube),
        instagram: Boolean(
          config.meta.userToken || config.meta.igLoginToken ||
          (config.meta.pageToken && config.meta.igUserId),
        ),
        facebook: Boolean(
          config.meta.userToken || (config.meta.pageToken && config.meta.pageId),
        ),
      },
    }).catch((err) => {
      // Editorial QC is observational. Its own failure is recorded, but a
      // technically valid MP4 still proceeds to every configured platform.
      console.error(`[qc] RETENTION QC ÇALIŞTIRILAMADI: ${err.message}`);
      return { score: null, ok: true, blockUpload: false, report: null, error: err.message };
    });

    // Retention editörü — acımasız oto-eleştiri (Actions logunda görünür).
    const ec = qc.report?.editorCritique;
    if (ec) {
      console.log(`[editör] retention riski: ${ec.overallRetentionRisk} | en sıkıcı an: ${ec.mostBoringMoment ? ec.mostBoringMoment.atSeconds + 's' : '—'} | AI oranı: ${ec.visualRepetition.aiShare} | en iyi iyileştirme: ${ec.bestImprovement}`);
      if (qc.report.belowQualityTarget) console.log(`[editör] ⚠️ kalite hedefi ${qc.report.qualityTarget} altında (skor ${qc.score}) — iyileştirme planı: ${qc.report.improvementPlan.join(' | ')}`);
    }

    // 6) Upload — TEK ORTAK KAPI: YouTube + Instagram + Facebook'un ÜÇÜ DE
    // bu bloğun içindedir; uploadGate (teknik preflight + QC mod kararı)
    // geçilmeden hiçbir platforma yayın yapılmaz, platform bazlı bypass yoktur.
    let youtube = null;
    let social = { instagram: null, facebook: null };
    const instagramConfigured = Boolean(
      config.meta.userToken || config.meta.igLoginToken ||
      (config.meta.pageToken && config.meta.igUserId),
    );
    const facebookConfigured = Boolean(
      config.meta.userToken || (config.meta.pageToken && config.meta.pageId),
    );
    let publishingAttemptId = null;
    let publishingAttemptBlocked = false;
    let youtubeUploadError = null;
    // YAYIN KAPISI. 26 Tem'e kadar burada yalnızca "MP4 teknik olarak geçerli
    // mi" soruluyordu; acil kalite kapısının kararı hesaplanıp loglanıyor ama
    // KULLANILMIYORDU. Sonuç: retention 84/100 ile kalan ve ekranında
    // bağlamsız etiket kutuları olan bir video üç platforma birden çıktı.
    // Kapı artık gerçekten kapı: bloke eden bir bulgu varsa yayın olmaz,
    // video artifact olarak kalır ve akış kırılmaz.
    // ---- YAYIN KAPILARI (Faz 6) ----
    // Her kapı AYRI ölçülür. Sea cucumbers videosu retention'dan 84/100 aldı;
    // ortalama iyi göründüğü için altındaki kritik hatalar görünmedi. Tek
    // skorla maskeleme yok: bir kapı düşerse video yayınlanmaz.
    const listStructure = assessListStructure(script);
    const ctaReport = assessCta({
      ctaStart: video.ctaCue?.atSeconds ?? null,
      ctaDuration: video.ctaCue?.duration ?? 0,
      duration: video.duration,
      // Final açıklama = son sahnenin başlangıcı (reveal orada yapılır).
      revealStart: renderTimeline.items.at(-1)?.start ?? null,
    });
    const repetition = detectRepetition({
      narrations: (script.scenes || []).map((s) => s.narration),
      captionStarts: captionLayout.events.map((e) => e.words.slice(0, 3).map((w) => w.word).join(" ")),
      scenePlans: (script.scenes || []).map((s) => `${s.story_template}|${s.viewer_task || ''}`),
    });
    const publishGates = evaluatePublishGates({
      // BİRİNCİL GİRDİ: final MP4. Plan değil, çıkan video değerlendirilir.
      finalVideo,
      runIntegrity,
      captionIntegrity,
      // Görüntü semantiğini doğrulayacak model YOK → yanlış güven üretme.
      subjectContinuity: null,
      semanticActions,
      listStructure,
      repetition,
      cta: ctaReport,
    });
    outputVerification.publishGates = publishGates;
    outputVerification.captionIntegrity = captionIntegrity;
    outputVerification.semanticActions = semanticActions;
    outputVerification.listStructure = listStructure;
    outputVerification.subjectBible = bible;
    console.log(
      `  yayın kapıları: ${publishGates.status.toUpperCase()} | ` +
      `altyazı kapsama ${captionIntegrity.tokenCoverage} | ` +
      `eylem tamamlama ${semanticActions.average} | ` +
      `liste ${listStructure.declared ? (listStructure.valid ? '✓' : 'GEÇERSİZ') : '—'} | ` +
      `CTA reveal keser: ${ctaReport.interruptsReveal ? 'EVET' : 'hayır'}`,
    );
    for (const f of publishGates.failures) console.error(`  [yayın-kapısı] BAŞARISIZ: ${f}`);
    for (const r of publishGates.review) console.warn(`  [yayın-kapısı] doğrulanamadı: ${r}`);
    // Danışma bulguları yayını durdurmaz ama GİZLENMEZ: kalite bu satırlardan
    // izlenir, aksi hâlde otomatik yayın körleşir.
    for (const a of publishGates.advisory || []) console.warn(`  [yayın-kapısı] danışma (yayın durmaz): ${a}`);
    // İncelenebilirlik: script, sahne planı ve TTS metni de artifact olur.
    await writeFile(path.join(workDir, 'script.json'), JSON.stringify(script, null, 2)).catch(() => {});
    await writeFile(path.join(workDir, 'scene-plan.json'), JSON.stringify(
      (script.scenes || []).map((s, i) => ({
        index: i,
        narration: s.narration,
        story_template: s.story_template,
        viewer_task: s.viewer_task,
        camera_plan: s.camera_plan,
        image_prompt: s.image_prompt,
        negative_prompt: s.negative_prompt,
        actors: (video.actorsByScene?.[i] || []).map((a) => a.type),
        focus: video.sceneFocus?.[i] || null,
      })), null, 2)).catch(() => {});

    // TEKNİK YAYIN KAPISI — yayını durdurma yetkisi OLAN tek ölçüt kümesi.
    // Yayınlanacak dosyanın kendi sha256'sı, doğrulayıcının incelediği hash ile
    // karşılaştırılır: kapıların hangi dosyaya baktığı belirsizse hiçbir kararın
    // anlamı yoktur.
    const publishHash = runIntegrity?.parts?.finalVideo || finalVideo?.analyzedVideoHash || null;
    const technicalGate = await evaluateTechnicalPublishGate({
      videoPath: outPath,
      preflight: pf,
      finalVideo,
      expectedVideoHash: publishHash,
      captionIntegrity,
    }).catch((err) => {
      // Teknik kapı ÇALIŞAMADIYSA geçti sayılmaz (fail-closed): ölçütlerin
      // hepsi ucuz ve deterministik, çalışmaması bir arıza işaretidir.
      console.warn(`[teknik-kapı] çalıştırılamadı: ${String(err.message).slice(0, 90)}`);
      return { technicalPublishReady: false, blockers: ['TECHNICAL_GATE_ERROR'], unverified: [], checks: {} };
    });
    const publishVerdict = decidePublish({
      technical: technicalGate,
      publishGates,
      cronPublishingEnabled: true,
    });
    logPublishDecision(publishVerdict);

    const uploadDecision = resolveUploadPolicy({
      cliUpload: upload,
      hasCredentials: Boolean(hasYouTube),
      preflightOk: pf.ok,
      qc,
      emergencyGate: emergencyQuality,
      technicalGate,
      publishGates,
    });
    logUploadDecision(uploadDecision);
    await writeFile(path.join(workDir, 'publish-gates.json'), JSON.stringify({
      // Görevde istenen üç alanlı sözleşme, raporun EN ÜSTÜNDE.
      technicalPublishReady: publishVerdict.technicalPublishReady,
      editorialQualityPassed: publishVerdict.editorialQualityPassed,
      uploadAllowed: uploadDecision.allowed,
      uploadDecisionCode: uploadDecision.code,
      qualityWarnings: publishVerdict.qualityWarnings,
      // §15 — düzeltme turunun ne yaptığı ve neyi düzeltemediği.
      semanticRepair: semanticRepairResult,
      // Sahne-anlatım uyumu: görsel gerçekten anlatılan şeyi mi gösteriyor?
      offTopicScenes,
      qualityDegraded: semanticRepairResult.qualityDegraded === true,
      technicalGate,
      publishGates, finalVideo, runIntegrity, captionIntegrity, semanticActions,
      listStructure, ctaReport, repetition, subjectBible: bible,
    }, null, 2)).catch(() => {});
    let canUpload = uploadDecision.allowed;
    if (!canUpload && uploadDecision.requested) {
      await recordPublicationBlock(qc, workDir,
        `${uploadDecision.code}: ${uploadDecision.reason}`).catch(() => {});
    }
    // Eski kapı hâlâ ikinci bir emniyet olarak sorulur (savunma derinliği).
    if (canUpload && !uploadGate({ preflightOk: pf.ok, qc })) canUpload = false;
    if (willUpload && canUpload) {
      publishingAttemptId = buildPublishingAttemptId(script);
      try {
        const reservation = await reservePublishingAttempt({
          attemptId: publishingAttemptId,
          topic: script.topic,
          configuredPlatforms: {
            youtube: Boolean(hasYouTube),
            instagram: Boolean(
              config.meta.userToken || config.meta.igLoginToken ||
              (config.meta.pageToken && config.meta.igUserId),
            ),
            facebook: Boolean(
              config.meta.userToken || (config.meta.pageToken && config.meta.pageId),
            ),
          },
        });
        if (!reservation.acquired) {
          publishingAttemptBlocked = true;
          canUpload = false;
          await recordPublicationBlock(qc, workDir, `PUBLISH_ATTEMPT_EXISTS: ${publishingAttemptId}`);
          console.error(`[publish] aynı içerik için mevcut attempt var (${publishingAttemptId}) — kör yeniden upload engellendi.`);
        }
      } catch (err) {
        canUpload = false;
        await recordPublicationBlock(qc, workDir, `PUBLISH_STATE_UNAVAILABLE: ${err.message}`).catch(() => {});
        throw err;
      }
    }
    if (willUpload && canUpload) {
      log('Faz 6: YouTube upload...');
      const meta = await buildMetadata(script);
      // Açık lisans atıfları (CC BY/BY-SA arşiv görselleri lisans gereği).
      const credits = [...new Set(
        media.items
          .filter((m) => m.source === 'archive' && m.attribution)
          .map((m) => `📷 ${m.author} — Wikimedia Commons (${m.license})`),
      )];
      if (credits.length) meta.description += '\n\n' + credits.join('\n');
      await updatePublishingPlatform(publishingAttemptId, 'youtube', 'uploading');
      // ÖZEL KAPAK: hook karesini çıkar (neon başlık + çarpıcı görsel) → keşif CTR'si.
      // ~1.0s: hook yazısı tam oturmuş, CTA/outro yok. best-effort.
      const coverPath = path.join(workDir, 'cover.jpg');
      await execFileAsync('ffmpeg', ['-y', '-ss', '1.0', '-i', outPath, '-frames:v', '1',
        '-q:v', '2', coverPath], { maxBuffer: 10 * 1024 * 1024 }).catch(() => {});
      let res = null;
      try {
        res = await uploadVideo({ videoPath: outPath, ...meta, coverPath });
        await updatePublishingPlatform(publishingAttemptId, 'youtube', 'published', { remoteId: res.videoId });
        youtube = { ...res, title: meta.title, publishedAt: new Date().toISOString() };
        console.log(`  YouTube yüklendi: ${res.url}`);
      } catch (err) {
        youtubeUploadError = String(err.message || err);
        console.error(`  ⚠️ YouTube upload başarısız; Meta platformları yine denenecek: ${youtubeUploadError.slice(0, 180)}`);
        await updatePublishingPlatform(publishingAttemptId, 'youtube', 'remote_unknown', {
          lastError: youtubeUploadError.slice(0, 300),
        }).catch(() => {});
      }
      if (res) {
        // İlk yorum ve SRT, YouTube yayınlandıktan sonra best-effort çalışır.
        const commented = await postFirstComment(res.videoId, script).catch(() => false);
        if (commented) console.log('  ilk yorum atıldı');
        const srt = buildSrtFromWords(audio.wordTimings);
        if (srt) {
          const capOk = await uploadCaptions(res.videoId, srt).catch(() => false);
          if (capOk) console.log('  altyazı (SRT) yüklendi');
        }
      }

      // Meta cross-post: aynı video Instagram Reels + Facebook Reels'e
      // (best-effort; secrets yoksa sessizce atlanır, bkz. docs/meta-setup.md).
      if (instagramConfigured) await updatePublishingPlatform(publishingAttemptId, 'instagram', 'uploading');
      if (facebookConfigured) await updatePublishingPlatform(publishingAttemptId, 'facebook', 'uploading');
      social = await crossPost({
        videoPath: outPath,
        title: meta.title,
        description: meta.description,
        tags: meta.tags,
      }).catch(() => ({ instagram: null, facebook: null }));
      if (instagramConfigured) await updatePublishingPlatform(
        publishingAttemptId, 'instagram', social.instagram ? 'published' : 'remote_unknown',
        social.instagram ? { remoteId: social.instagram } : { lastError: 'cross-post sonucu belirsiz/başarısız' },
      );
      if (facebookConfigured) await updatePublishingPlatform(
        publishingAttemptId, 'facebook', social.facebook ? 'published' : 'remote_unknown',
        social.facebook ? { remoteId: social.facebook } : { lastError: 'cross-post sonucu belirsiz/başarısız' },
      );
      if (social.instagram) console.log('  Instagram Reels yayınlandı');
      if (social.facebook) console.log('  Facebook Reels yayınlandı');

      // Cross-post kiti: TikTok'a elle atmak için hazır metin paketi.
      const kit = [
        `TITLE:\n${meta.title}`,
        `\nDESCRIPTION:\n${meta.description}`,
        `\nTAGS:\n${(meta.tags || []).join(', ')}`,
        `\nHASHTAGS:\n${(meta.tags || []).slice(0, 6).map((t) => '#' + t.replace(/[^a-z0-9]/gi, '')).join(' ')}`,
        `\nYOUTUBE:\n${res?.url || 'UPLOAD_FAILED'}`,
      ].join('\n');
      await writeFile(path.join(workDir, 'publish-kit.txt'), kit).catch(() => {});
    } else if (willUpload && publishingAttemptBlocked) {
      console.log('\n▶ Faz 6: upload İPTAL (aynı içerik için publishing attempt zaten var) — artifact korunuyor.');
    } else if (willUpload && qc.blockUpload) {
      console.log(
        qc.error
          ? '\n▶ Faz 6: upload İPTAL (QC hatası, fail-closed) — video artifact olarak duruyor.'
          : '\n▶ Faz 6: upload İPTAL (strict retention QC) — video artifact olarak duruyor.',
      );
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
      visualStyle,
      ambience: ambience?.name || null,
      // Video başına lisans manifesti: kullanılan müziğin kaynağı ve kanıtı.
      music: musicMeta,
      // Neo Motion Engine CTA katmanı raporu.
      motion: motionReport,
      // RENDER SONRASI GERÇEK ÇIKTI DOĞRULAMASI (final MP4'ten ölçülen gerçek).
      // Kanal sayısı/layout ÖLÇÜLEN değer (hedef değil); SFX cue duyulabilirlik
      // farkları; CTA dil/yerleşim; sert kapı sonucu.
      outputVerification,
      canonicalTimeline: renderTimeline,
      renderPlan: video.renderPlan,
      viewerFirst: {
        script: validateViewerFirstScript(script),
        pacingIssues,
        ttsPhrasingIssues: audio.phrasingIssues || [],
      },
      // ÖLÇÜLEN ses kanal gerçeği (rapor iddiası değil, ffprobe).
      audioTruth: {
        channels: pf.technical?.audioChannels ?? null,
        channelLayout: pf.technical?.audioChannelLayout ?? null,
        sampleRate: pf.technical?.audioSampleRate ?? null,
        lufs: pf.technical?.lufs ?? null,
        maxVolumeDb: pf.technical?.maxVolumeDb ?? null,
      },
      // 14 günlük yayın deneyi etiketi + (API bağlanınca dolacak) metrik iskeleti.
      scheduleExperiment: {
        ...sched.experiment,
        scheduledPublishAt: sched.scheduledPublishAt,
        actualPublishAt: youtube?.publishedAt || null,
      },
      slotMetrics: emptySlotMetrics(), // SAHTE VERİ YOK — Analytics bağlanınca dolar
      preflight: pf.metrics,
      retentionScore: qc.score,
      // Retention editörü: kalite hedefi + acımasız oto-eleştiri özeti (madde 12).
      qualityTarget: qc.report?.qualityTarget ?? null,
      belowQualityTarget: qc.report?.belowQualityTarget ?? null,
      editorCritique: qc.report?.editorCritique || null,
      improvementPlan: qc.report?.improvementPlan || [],
      editPlan: editPlan
        ? {
            musicMood: editPlan.musicMood,
            subscribeScene: editPlan.subscribeScene + 1,
            transitions: editPlan.boundaries.map((b) => b.transition).join(','),
            sfx: editPlan.boundaries.map((b) => b.sfx).join(','),
          }
        : 'mechanical',
      youtube: youtube?.url || null,
      publishing: publishingAttemptId ? { attemptId: publishingAttemptId, platforms: { youtube, ...social } } : null,
      createdAt: new Date().toISOString(),
    };
    await writeFile(path.join(workDir, 'report.json'), JSON.stringify(report, null, 2)).catch(() => {});
    const configuredPlatforms = [hasYouTube, instagramConfigured, facebookConfigured].filter(Boolean).length;
    const successfulPlatforms = [youtube, social.instagram, social.facebook].filter(Boolean).length;
    // "Hiç yayınlanamadı" hatası, SESSİZ upload başarısızlıklarını yakalamak
    // için var. BİLİNÇLİ engelleme onun kapsamına girmez: kapı çalıştıysa
    // sistem doğru davranmıştır, koşu başarısız DEĞİLDİR.
    //
    // 26 Tem 17:01 koşusu tam bu yüzden düştü: kullanıcı --upload verdi, yayın
    // kapıları videoyu haklı olarak engelledi ("QC geçilemedi"), sonra bu
    // kontrol "hiçbir platforma yüklenemedi" diye exception attı ve iş
    // kırmızıya döndü. Kapının çalışması bir arıza gibi raporlanıyordu.
    if (willUpload && canUpload && configuredPlatforms > 0 && successfulPlatforms === 0) {
      throw new Error(`Hiçbir platforma upload yapılamadı: ${youtubeUploadError || 'Meta API upload başarısız veya belirsiz'}`);
    }
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
      canonicalTimeline: renderTimeline,
      renderPlan: video.renderPlan,
      engine: audio.engine,
      duration: video.duration,
      visualStyle, // Baş Analist stile göre öğrensin
      music: musicMeta, // parça tekrarını önleme + lisans izi
      motion: motionReport, // CTA tipi tekrarını önleme + izleme
      audioSfx: editorialSfx.map((e) => e.type).filter(Boolean), // SFX tekrarını izleme (son 5 video)
      scheduleExperiment: {
        ...sched.experiment,
        scheduledPublishAt: sched.scheduledPublishAt,
        actualPublishAt: youtube?.publishedAt || null,
      },
      retention: qc.report ? { score: qc.score, status: qc.report.status } : null,
      // 'blocked_qc': QC engelledi (strict skor/hata veya QC exception) —
      // yayınlanmış GİBİ görünmesin.
      status: youtube
        ? 'published'
        : !pf.ok && config.preflight.mode === 'strict'
          ? 'failed_preflight'
          : willUpload && qc.blockUpload
            ? 'blocked_qc'
            : 'rendered',
      youtube,
      publishing: publishingAttemptId ? { attemptId: publishingAttemptId, platforms: { youtube, ...social } } : null,
    });
    console.log(`  kayıt id: ${videoId}`);

    // 5.5) GÖZLEM KATMANI: QC geçmişi (data/qc-history.jsonl, append-only).
    // Skor ↔ izlenme analizinin ham verisi. Başarısız olursa yayın akışı
    // ETKİLENMEZ; hata appendQcHistory içinde açıkça loglanır.
    if (qc.report) {
      const hist = await appendQcHistory(buildQcHistoryEntry(qc.report, {
        videoId,
        topic: script.topic,
        format: script.format || null,
        durationSeconds: +video.duration.toFixed(1),
        scheduleExperimentId: sched.experiment.id,
        scheduledSlot: sched.slot,
        scheduledPublishAt: sched.scheduledPublishAt,
        actualPublishAt: youtube?.publishedAt || null,
      }));
      if (hist.appended) console.log('[qc-history] data/qc-history.jsonl güncellendi');
      else if (hist.ok) console.log(`[qc-history] atlandı: ${hist.reason}`);
    } else {
      console.error('[qc-history] production-report yok (QC çöktü) — geçmişe kayıt atılamadı.');
    }

    // 7) Bildirim (best-effort).
    const msg = youtube
      ? `✅ neosaniye: "${script.topic}" yayında (${video.duration.toFixed(0)}s, ` +
        `AI:${media.sources.ai}/${media.items.length})\n${youtube.url}`
      : willUpload && pf.ok && qc.blockUpload
        ? `🛑 neosaniye: "${script.topic}" strict QC'ye takıldı (skor ${qc.score ?? 'yok'}) — artifact'te duruyor.`
        : pf.ok
          ? `🎬 neosaniye: "${script.topic}" üretildi (upload atlandı).`
          : `⚠️ neosaniye: "${script.topic}" preflight'a takıldı: ${pf.issues.join(' | ')}`;
    await notify(msg).catch(() => {});

    if (willUpload && !pf.ok && config.preflight.mode === 'strict') {
      throw new Error(`Preflight başarısız: ${pf.issues.join(' | ')}`);
    }
    return { script, videoPath: outPath, youtube, videoId, preflight: pf };
  } catch (err) {
    await recordProduction(script, { status: 'failed', error: err.message }).catch(() => {});
    await notify(`❌ neosaniye üretim hatası (${script.topic}): ${err.message.slice(0, 300)}`).catch(() => {});
    throw err;
  }
}
