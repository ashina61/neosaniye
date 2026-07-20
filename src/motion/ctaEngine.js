import path from 'node:path';
import { config } from '../config.js';
import { selectCta } from './ctaSelector.js';
import { computeSafeArea, avoidZones } from './ctaSafeArea.js';
import { validatePlan, verifyRendered, verifyOutput } from './ctaValidator.js';
import { renderCta } from './ctaRenderer.js';
import { ctaMeta, ctaCardSize } from './ctaTemplates.js';
import { verifyCtaOutput } from '../pipeline/outputVerify.js';

/**
 * NEO MOTION ENGINE — CTA uygulama orkestrasyonu.
 *
 * select → safe-area → validate → render → verify → report.
 * FAIL-SAFE: CTA'nın herhangi bir adımı hata verirse ana video KORUNUR
 * (orijinal yol döner), sebep raporlanır. Ana render hatası ile CTA hatası
 * ayrıdır — bu fonksiyon asla throw etmez.
 *
 * @param {object} o { videoPath, workDir, duration, seed, outroStartSec, recentCtaTypes }
 * @returns {Promise<{report:object, videoPath:string}>}
 */
export async function applyCta(o) {
  // İçerik dili (CTA yerelleştirme + dil kapısı). Kanal İngilizce/ABD → 'en'.
  const language = o.language || config.content?.language || 'en';
  const base = {
    enabled: Boolean(config.motion.enabled && config.motion.cta.enabled),
    ctaRequested: false, ctaApplied: false, ctaId: null, ctaType: null,
    startSec: null, durationSec: null, position: null, selectionReason: null,
    safeAreaPassed: false, sfxId: null, resolvedLanguage: language, label: null,
    languageMatch: null, warnings: [], failures: [],
  };
  const keep = (report) => ({ report, videoPath: o.videoPath });

  try {
    if (!config.motion.enabled) return keep({ ...base, selectionReason: 'disabled' });

    const plan = selectCta({
      seed: o.seed, durationSec: o.duration,
      outroStartSec: o.outroStartSec, recentCtaTypes: o.recentCtaTypes,
    });
    if (!plan.applied) {
      return keep({ ...base, ctaRequested: plan.reason === 'probability-skip' || plan.reason === 'timeline-conflict', selectionReason: plan.reason });
    }
    // Buraya geldiyse CTA editoryal olarak İSTENDİ.
    const req = { ...base, ctaRequested: true, ctaId: plan.templateId, ctaType: plan.type,
      startSec: plan.startSec, durationSec: plan.durationSec, position: plan.position };

    // Dile göre etiket künyesi + kart ölçüsü — safe-area yerleşiminden ÖNCE
    // (uzun İngilizce etiket için kart genişler, sonra güvenli yere oturur).
    const meta = ctaMeta(plan.type, language);
    const cardSize = ctaCardSize(plan.type, language);
    req.resolvedLanguage = meta.resolvedLanguage;
    req.label = meta.label;
    req.languageMatch = meta.resolvedLanguage === language;

    const safeArea = computeSafeArea({ position: plan.position, cardW: cardSize.w, cardH: cardSize.h });
    const v = validatePlan(plan, { duration: o.duration, cfg: config.motion.cta, safeArea });
    req.warnings.push(...v.warnings);
    if (!safeArea) return keep({ ...req, selectionReason: 'no-safe-area' });
    if (!v.ok) return keep({ ...req, failures: v.failures, selectionReason: 'validation-failed' });
    req.position = safeArea.position;
    req.safeAreaPassed = true;
    req.box = { x: safeArea.x, y: safeArea.y, w: safeArea.w, h: safeArea.h };

    const outCta = path.join(o.workDir, `cta-${path.basename(o.videoPath)}`);
    const r = await renderCta({
      inputVideo: o.videoPath, outputVideo: outCta, plan, box: safeArea,
      workDir: o.workDir, width: 1080, height: 1920, duration: o.duration,
      language,
    });
    if (!r.ok) return keep({ ...req, failures: [`render-failed:${r.error || ''}`], selectionReason: 'validation-failed' });

    // Çıktı geçerli mi + CTA katmanı gerçekten var mı?
    if (!(await verifyOutput(outCta))) {
      return keep({ ...req, failures: ['output-invalid'], selectionReason: 'validation-failed' });
    }
    const midSec = plan.startSec + plan.durationSec / 2;
    const vr = await verifyRendered(o.videoPath, outCta, midSec);
    if (!vr.applied) {
      return keep({ ...req, failures: ['cta-layer-not-present'], selectionReason: 'validation-failed' });
    }

    // RENDER SONRASI CTA ÇIKTI DOĞRULAMASI — bbox, kenar payı, altyazı/UI
    // çakışması, dil eşleşmesi (gerçek yerleşim + katman varlığı üzerinden).
    const ctaVerification = verifyCtaOutput({
      box: req.box, width: 1080, height: 1920,
      layerPresent: vr.applied,
      resolvedLanguage: meta.resolvedLanguage,
      requestedLanguage: language,
      label: meta.label,
      avoidZones: avoidZones({}),
      safeMarginPx: 40,
    });

    // BAŞARILI.
    return {
      report: { ...req, ctaApplied: true, sfxId: r.sfxId,
        selectionReason: 'editorial-rule', layerDiff: vr.diff, ctaVerification },
      videoPath: outCta,
    };
  } catch (err) {
    // CTA katmanı hiçbir koşulda ana videoyu çökertmez.
    console.error(`[motion] CTA uygulanamadı (ana video korunuyor): ${err.message}`);
    return keep({ ...base, failures: [`engine-error:${err.message.slice(0, 120)}`], selectionReason: 'validation-failed' });
  }
}
