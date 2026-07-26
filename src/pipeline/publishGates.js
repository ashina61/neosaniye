/**
 * YAYIN KAPILARI — "bu video yayınlanabilir mi?" sorusunun ölçülebilir cevabı.
 *
 * Tasarım kuralı (26 Tem dersi): TEK BİR GENEL SKOR KULLANILMAZ. Sea cucumbers
 * videosu retention'dan 84/100 aldı; ortalama iyi göründüğü için altında yatan
 * kritik hatalar (yanlış hayvan, kayıp fiil, bağlamsız etiket) görünmedi.
 * Burada her kapı AYRI değerlendirilir ve tek bir kapının düşmesi videoyu
 * durdurur — ortalama maskeleme yok.
 *
 * ÜÇ DURUM:
 *   pass          → tüm kapılar ölçüldü ve geçti
 *   needs_review  → bir kapı GÜVENİLİR ÖLÇÜLEMEDİ (yanlış güven üretme)
 *   fail          → ölçüldü ve kaldı
 * needs_review de fail de upload'ı engeller.
 */

export const DEFAULT_THRESHOLDS = {
  captionTokenCoverage: 1.0,
  subjectContinuityScore: 0.8,
  semanticActionCompletionAverage: 0.7,
  duplicateNarrationCount: 0,
  duplicateCaptionStartCount: 0,
  subtitleCollisionCount: 0,
  unverifiedSubjectScenes: 0,
};

/**
 * @param {object} input
 * @param {object|null} input.captionIntegrity   validateCaptionIntegrity çıktısı
 * @param {object|null} input.subjectContinuity  assessSubjectContinuity çıktısı
 * @param {object|null} input.semanticActions    assessSemanticActions çıktısı
 * @param {object|null} input.listStructure      assessListStructure çıktısı
 * @param {object|null} input.repetition         detectRepetition çıktısı
 * @param {object|null} input.cta                { interruptsReveal:boolean }
 * @param {object} [input.thresholds]
 * @returns {{passed:boolean, status:string, failures:string[], review:string[], gates:object}}
 */
export function evaluatePublishGates({
  finalVideo = null,
  runIntegrity = null,
  captionIntegrity = null,
  subjectContinuity = null,
  semanticActions = null,
  listStructure = null,
  repetition = null,
  cta = null,
  thresholds = {},
} = {}) {
  const th = { ...DEFAULT_THRESHOLDS, ...thresholds };
  const failures = [];
  const review = [];
  const gates = {};

  // ---- FINAL MP4 (BİRİNCİL KAPI) ----
  //
  // KURAL: plan başarılı olabilir, final video başarısızsa VİDEO BAŞARISIZDIR.
  // Doğrulama hiç çalışmadıysa da geçilmiş sayılmaz — doğrulanmamış video
  // yayınlanmaz ("rapor üretilemedi" bir başarı değildir).
  if (!finalVideo) {
    review.push('FINAL_VIDEO_UNVERIFIED');
    gates.finalVideo = null;
  } else {
    gates.finalVideo = {
      analyzedVideoHash: finalVideo.analyzedVideoHash,
      sampledFrames: finalVideo.sampledFrames,
      duplicateShots: finalVideo.duplicateShots?.length ?? null,
      duplicateHooks: finalVideo.duplicateHooks,
      duplicateDiagrams: finalVideo.duplicateDiagrams,
      duplicateCTA: finalVideo.duplicateCTA,
      duplicateCaptions: finalVideo.duplicateCaptions,
      longestStaticStreakSeconds: finalVideo.longestStaticStreakSeconds,
      sceneOrderValid: finalVideo.sceneOrderValid,
      similarShots: finalVideo.similarShots?.length ?? null,
    };
    // Doğrulayıcının kendi bulguları doğrudan yayın engelidir.
    for (const f of finalVideo.failures || []) failures.push(`FINAL_VIDEO/${f}`);
    // SIMILAR_SHOT bir İDDİADIR, kanıt değil: farklı varlıklar algısal olarak
    // yakın çıkmış. Sert engel yanlış olurdu (doğru kurgulanmış video bloklanır),
    // sessizce geçmek de yanlış (gerçekten tekrar gibi görünüyor olabilir).
    // Doğru yer insan gözü: needs_review.
    for (const w of finalVideo.warnings || []) {
      if (String(w).startsWith('SIMILAR_SHOT')) review.push(`FINAL_VIDEO/${w}`);
    }
  }

  // ---- RUN INTEGRITY ----
  // Artifact'ler aynı koşuya ait değilse, karşılaştırdığımız plan o videonun
  // planı olmayabilir; bu durumda hiçbir kapının sonucuna güvenilemez.
  if (!runIntegrity?.chainHash) {
    review.push('RUN_INTEGRITY_UNVERIFIED');
  } else {
    gates.runId = runIntegrity.runId;
    gates.chainHash = runIntegrity.chainHash;
    if (!runIntegrity.parts?.finalVideo) {
      failures.push('RUN_INTEGRITY_NO_VIDEO_HASH');
    }
  }

  // ---- ALTYAZI BÜTÜNLÜĞÜ ----
  if (!captionIntegrity) {
    review.push('CAPTION_INTEGRITY_UNVERIFIED');
  } else {
    gates.captionTokenCoverage = captionIntegrity.tokenCoverage;
    if (captionIntegrity.tokenCoverage < th.captionTokenCoverage) {
      failures.push(`CAPTION_TOKENS_LOST: kapsama ${captionIntegrity.tokenCoverage} ` +
        `(eksik: ${captionIntegrity.missingTokens.slice(0, 6).join(', ')})`);
    }
    if (captionIntegrity.duplicateTokens?.length) {
      failures.push(`CAPTION_TOKENS_DUPLICATED: ${captionIntegrity.duplicateTokens.slice(0, 6).join(', ')}`);
    }
    if ((captionIntegrity.timelineOverlapCount || 0) > th.subtitleCollisionCount) {
      failures.push(`CAPTION_TIMELINE_OVERLAP: ${captionIntegrity.timelineOverlapCount}`);
    }
    if (captionIntegrity.grammarRiskBlocks?.length) {
      failures.push(`CAPTION_GRAMMAR_RISK: ${captionIntegrity.grammarRiskBlocks.slice(0, 4).join(' | ')}`);
    }
  }

  // ---- ÖZNE SÜREKLİLİĞİ ----
  // Görüntü semantiğini güvenilir doğrulayacak model yoksa YANLIŞ GÜVEN
  // ÜRETİLMEZ: sonuç needs_review olur ve upload engellenir.
  if (!subjectContinuity || subjectContinuity.verified !== true) {
    review.push('SUBJECT_VERIFICATION_UNAVAILABLE');
    gates.subjectContinuityScore = subjectContinuity?.score ?? null;
  } else {
    gates.subjectContinuityScore = subjectContinuity.score;
    if (subjectContinuity.score < th.subjectContinuityScore) {
      failures.push(`SUBJECT_CONTINUITY_LOW: ${subjectContinuity.score}`);
    }
    if ((subjectContinuity.suspectedWrongSubjectScenes || []).length > th.unverifiedSubjectScenes) {
      failures.push(`WRONG_SUBJECT_SCENES: ${subjectContinuity.suspectedWrongSubjectScenes.join(', ')}`);
    }
  }

  // ---- SEMANTİK EYLEM TAMAMLAMA ----
  if (!semanticActions) {
    review.push('SEMANTIC_ACTION_UNVERIFIED');
  } else {
    gates.semanticActionCompletionAverage = semanticActions.average;
    if (semanticActions.average < th.semanticActionCompletionAverage) {
      failures.push(`SEMANTIC_ACTION_INCOMPLETE: ortalama ${semanticActions.average}`);
    }
  }

  // ---- LİSTE YAPISI ----
  // Liste iddiası YOKSA bu kapı uygulanmaz (her video liste değil).
  if (listStructure?.declared) {
    gates.listStructure = listStructure;
    if (!listStructure.valid) {
      failures.push(`LIST_STRUCTURE_INVALID: ${listStructure.declaredItemCount} iddia / ` +
        `${listStructure.detectedItemCount} tespit / işaret [${(listStructure.renderedMarkers || []).join(',')}]`);
    }
  }

  // ---- TEKRAR ----
  if (repetition) {
    gates.repetition = repetition.status;
    if ((repetition.duplicateNarrationSpans || []).length > th.duplicateNarrationCount) {
      failures.push(`DUPLICATE_NARRATION: ${repetition.duplicateNarrationSpans.length}`);
    }
    if ((repetition.duplicateCaptionStarts || []).length > th.duplicateCaptionStartCount) {
      failures.push(`DUPLICATE_CAPTION_STARTS: ${repetition.duplicateCaptionStarts.slice(0, 4).join(' | ')}`);
    }
  }

  // ---- CTA ----
  if (cta?.interruptsReveal) failures.push('CTA_INTERRUPTS_REVEAL');
  gates.ctaInterruptsReveal = Boolean(cta?.interruptsReveal);

  const status = failures.length ? 'fail' : review.length ? 'needs_review' : 'pass';
  return { passed: status === 'pass', status, failures, review, gates };
}
