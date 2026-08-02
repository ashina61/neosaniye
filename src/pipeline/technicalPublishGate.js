/**
 * TEKNİK YAYIN KAPISI — "QC cellat değil, editördür."
 *
 * ================== NEDEN VAR ==================
 * Sistem doğru çalışıyordu ama kanal boş kalıyordu. Her koşuda video üretiliyor,
 * teknik olarak sorunsuz bir MP4 çıkıyor, sonra EDİTORYAL bir ölçüt (semantik
 * eylem ortalaması, özne doğrulaması, retention skoru) yayını durduruyordu.
 * Bunların hiçbiri videonun BOZUK olduğunu söylemiyordu; "daha iyi olabilirdi"
 * diyordu. Sonuç: hiç yayın yok, dolayısıyla hiç geri bildirim yok, dolayısıyla
 * sistem hiç öğrenmiyor.
 *
 * Bu modül tek bir soruyu yanıtlar ve YALNIZCA onu:
 *
 *     Bu dosya izleyicinin ekranında düzgün OYNAR MI?
 *
 * Kalitesi hakkında hiçbir görüş bildirmez. Kalite görüşü publishGates'in
 * danışma kovasında ve retentionQC'de yaşar ve yayını durdurmaz.
 *
 * ================== ENGELLEYİCİ LİSTE ==================
 * Yalnızca aşağıdakiler yayını durdurur (hepsi "dosya bozuk" sınıfı):
 *   FILE_MISSING_OR_EMPTY   dosya yok ya da 0 byte
 *   DECODE_FAILED           MP4 açılamıyor / decode başarısız
 *   NO_VIDEO_STREAM         görüntü akışı yok
 *   NO_AUDIO_STREAM         ses akışı yok
 *   VIDEO_ALL_BLACK         tüm örnek kareler siyah
 *   AUDIO_SILENT            ses tamamen sessiz
 *   INVALID_RESOLUTION      çözünürlük/format geçersiz (dikey Shorts değil)
 *   FINAL_VIDEO_HASH_MISMATCH  analiz edilen dosya yayınlanacak dosya değil
 *   TIMELINE_ORDER_INVALID  sahne sırası bozuk
 *   CAPTION_TEXT_DIVERGED   altyazı metni TTS metninden CİDDİ biçimde farklı
 *
 * "Ciddi" kelimesi ölçülüdür: birkaç kelimelik sapma editoryal bir uyarıdır,
 * izleyicinin okuduğu metnin duyduğu metinle alakasız olması teknik arızadır.
 */

import { stat } from 'node:fs/promises';

/** Altyazı-TTS sapması bu eşiğin ALTINA düşerse teknik arıza sayılır. */
export const CAPTION_DIVERGENCE_BLOCK_THRESHOLD = 0.85;

/** Dikey Shorts için kabul edilen en dar en/boy oranı (9:16 ≈ 0.5625). */
export const MAX_ASPECT_RATIO = 0.70;

/**
 * Teknik yayın uygunluğu.
 *
 * Girdilerin hepsi OPSİYONELDİR ama eksik girdi "geçti" anlamına GELMEZ:
 * ölçülemeyen bir teknik ölçüt `unverified` listesine yazılır. Teknik ölçütler
 * fail-closed'dur — çünkü hepsi ucuz ve deterministiktir; ölçülememesi bir
 * arıza işaretidir, editoryal bir belirsizlik değil.
 *
 * @param {object} input
 * @param {string} [input.videoPath]        yayınlanacak dosya
 * @param {object} [input.preflight]        preflightCheck çıktısı
 * @param {object} [input.finalVideo]       validateFinalVideo çıktısı
 * @param {string} [input.expectedVideoHash] yayınlanacak dosyanın sha256'sı
 * @param {object} [input.captionIntegrity] validateCaptionIntegrity çıktısı
 * @param {boolean} [input.requireAudio]    ses akışı zorunlu mu (varsayılan evet)
 * @returns {Promise<{technicalPublishReady:boolean, blockers:string[],
 *                    unverified:string[], checks:object}>}
 */
export async function evaluateTechnicalPublishGate({
  videoPath = null,
  preflight = null,
  finalVideo = null,
  expectedVideoHash = null,
  captionIntegrity = null,
  requireAudio = true,
} = {}) {
  const blockers = [];
  const unverified = [];
  const checks = {};

  // ---- 1) DOSYA VAR MI, BOŞ MU ----
  if (videoPath) {
    const st = await stat(videoPath).catch(() => null);
    checks.fileSizeBytes = st?.size ?? null;
    if (!st) blockers.push(`FILE_MISSING_OR_EMPTY: ${videoPath} yok`);
    else if (st.size === 0) blockers.push('FILE_MISSING_OR_EMPTY: 0 byte');
  } else {
    unverified.push('FILE_PRESENCE');
  }

  // ---- 2) DECODE / AKIŞLAR / ÇÖZÜNÜRLÜK ----
  // Bunların hepsi preflight'ın zaten ölçtüğü şeyler; burada yeniden ffmpeg
  // çalıştırmak yerine ONUN ölçümü KARARA çevrilir. preflight.issues'ın
  // tamamı engel DEĞİLDİR (içinde editoryal uyarılar da var); yalnızca
  // aşağıdaki teknik olgular engeldir.
  const t = preflight?.technical;
  if (!t) {
    unverified.push('PREFLIGHT_TECHNICAL');
  } else {
    checks.decodePassed = t.decodePassed;
    checks.videoStreamPresent = t.videoStreamPresent;
    checks.audioStreamPresent = t.audioStreamPresent;
    checks.resolution = t.resolution;
    checks.durationSeconds = t.durationSeconds;

    if (t.decodePassed === false) blockers.push('DECODE_FAILED');
    if (t.videoStreamPresent === false) blockers.push('NO_VIDEO_STREAM');
    if (requireAudio && t.audioStreamPresent === false) blockers.push('NO_AUDIO_STREAM');

    // Çözünürlük: Shorts dikeydir. Yatay bir dosya "çalışır" ama YouTube onu
    // Shorts saymaz — yayın hedefinin tanımı gereği geçersiz format.
    if (t.resolution) {
      const m = /^(\d+)\s*x\s*(\d+)$/.exec(String(t.resolution).trim());
      if (!m) blockers.push(`INVALID_RESOLUTION: ${t.resolution}`);
      else {
        const [w, h] = [Number(m[1]), Number(m[2])];
        checks.aspectRatio = h ? +(w / h).toFixed(3) : null;
        if (!w || !h) blockers.push(`INVALID_RESOLUTION: ${t.resolution}`);
        else if (w / h > MAX_ASPECT_RATIO) {
          blockers.push(`INVALID_RESOLUTION: ${t.resolution} dikey değil`);
        }
      }
    } else {
      unverified.push('RESOLUTION');
    }

    // Tamamen siyah / tamamen sessiz. preflight bunları issues metnine yazıyor;
    // metin eşleşmesi kırılgan olduğu için ölçüm alanları öncelikli okunur.
    const issues = preflight.issues || [];
    if (issues.some((i) => /tüm örnek kareler karanlık|all sample frames dark/i.test(i))) {
      blockers.push('VIDEO_ALL_BLACK');
    }
    if (t.maxVolumeDb != null && t.maxVolumeDb <= -70) blockers.push('AUDIO_SILENT');
  }

  // ---- 3) HASH: ANALİZ EDİLEN DOSYA = YAYINLANACAK DOSYA ----
  // "Final MP4 tek gerçek kaynaktır" kuralının kilidi. Doğrulayıcı bir dosyayı
  // inceleyip başka bir dosya yayınlanırsa bütün kapılar anlamsızdır.
  if (expectedVideoHash && finalVideo?.analyzedVideoHash) {
    checks.finalVideoHashValid = finalVideo.analyzedVideoHash === expectedVideoHash;
    if (!checks.finalVideoHashValid) {
      blockers.push('FINAL_VIDEO_HASH_MISMATCH: analiz edilen dosya yayınlanacak dosya değil');
    }
  } else {
    checks.finalVideoHashValid = null;
    unverified.push('FINAL_VIDEO_HASH');
  }

  // ---- 4) MP4 OKUNABİLİRLİĞİ (doğrulayıcının kendi kararı) ----
  if (finalVideo) {
    const fv = finalVideo.failures || [];
    if (fv.some((f) => String(f).startsWith('FINAL_VIDEO_UNREADABLE'))) blockers.push('DECODE_FAILED');
    // Sahne sırası: zaman çizelgesi kırıksa video anlatıyı yanlış sırada oynar.
    const order = fv.filter((f) => String(f).startsWith('TIMELINE_ORDER_INVALID'));
    checks.sceneOrderValid = finalVideo.sceneOrderValid ?? null;
    for (const o of order) blockers.push(o);
  } else {
    unverified.push('FINAL_VIDEO_ANALYSIS');
  }

  // ---- 5) ALTYAZI METNİ TTS METNİNDEN CİDDİ SAPIYOR MU ----
  // Birkaç kelimelik eksik EDİTORYALDİR (uyarı). İzleyicinin okuduğu metnin
  // duyduğuyla alakasız olması TEKNİKTİR: yanlış altyazı dosyası bindirilmiş,
  // hizalama çökmüş ya da metin karışmış demektir.
  if (captionIntegrity && typeof captionIntegrity.tokenCoverage === 'number') {
    checks.captionTokenCoverage = captionIntegrity.tokenCoverage;
    if (captionIntegrity.tokenCoverage < CAPTION_DIVERGENCE_BLOCK_THRESHOLD) {
      blockers.push(`CAPTION_TEXT_DIVERGED: kapsama ${captionIntegrity.tokenCoverage} `
        + `< ${CAPTION_DIVERGENCE_BLOCK_THRESHOLD}`);
    }
  } else {
    unverified.push('CAPTION_INTEGRITY');
  }

  return {
    technicalPublishReady: blockers.length === 0 && unverified.length === 0,
    blockers,
    unverified,
    checks,
  };
}

/**
 * Üç alanlı yayın kararı — görevde istenen sözleşme.
 *
 *   { technicalPublishReady, editorialQualityPassed, uploadAllowed }
 *
 * Upload kararı YALNIZCA teknik duruma ve cron iznine bağlıdır:
 *   technicalPublishReady && finalVideoHashValid && cronPublishingEnabled
 *
 * @param {object} input
 * @param {object} input.technical          evaluateTechnicalPublishGate çıktısı
 * @param {object|null} [input.publishGates] evaluatePublishGates çıktısı (editoryal)
 * @param {boolean} [input.cronPublishingEnabled]
 * @returns {{technicalPublishReady:boolean, editorialQualityPassed:boolean,
 *            uploadAllowed:boolean, qualityWarnings:string[], blockers:string[]}}
 */
export function decidePublish({
  technical,
  publishGates = null,
  cronPublishingEnabled = true,
} = {}) {
  const technicalPublishReady = technical?.technicalPublishReady === true;
  // Hash doğrulanamadıysa "geçerli" sayılmaz: bu, kapıların hangi dosyayı
  // incelediğini bilmediğimiz anlamına gelir.
  const finalVideoHashValid = technical?.checks?.finalVideoHashValid === true;

  const qualityWarnings = [
    ...(publishGates?.advisory || []),
    ...(publishGates?.failures || []),
    ...(publishGates?.review || []),
  ];
  const editorialQualityPassed = publishGates ? publishGates.passed === true : false;

  const uploadAllowed = technicalPublishReady && finalVideoHashValid && cronPublishingEnabled === true;

  return {
    technicalPublishReady,
    editorialQualityPassed,
    uploadAllowed,
    qualityWarnings,
    blockers: [
      ...(technical?.blockers || []),
      ...(technical?.unverified || []).map((u) => `UNVERIFIED:${u}`),
      ...(finalVideoHashValid ? [] : ['FINAL_VIDEO_HASH_UNVERIFIED']),
      ...(cronPublishingEnabled ? [] : ['PUBLISHING_DISABLED']),
    ],
  };
}

/** Kararı logla. Kalite düşükse yayın yine olur ama SESSİZ olmaz. */
export function logPublishDecision(decision, logger = console) {
  logger.log(
    `[yayın-kararı] teknik:${decision.technicalPublishReady ? '✓' : '✗'} `
    + `editoryal:${decision.editorialQualityPassed ? '✓' : '✗'} `
    + `upload:${decision.uploadAllowed ? 'İZİNLİ' : 'ENGELLİ'}`,
  );
  if (decision.uploadAllowed && !decision.editorialQualityPassed) {
    logger.warn('PUBLISHING WITH QUALITY WARNINGS');
    for (const w of decision.qualityWarnings) logger.warn(`  ! ${w}`);
  }
  if (!decision.uploadAllowed) {
    for (const b of decision.blockers) logger.error(`  ⛔ ${b}`);
  }
}
