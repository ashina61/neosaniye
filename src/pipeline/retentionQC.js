import { appendFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';
import { analyzeCaptionLayout } from '../video/captionLayout.js';
import {
  countPatternInterrupts,
  detectMechanismCoverage,
  classifyFactualCertainty,
  sfxQuality,
} from './editorialSignals.js';
import { summarizeRelevance, extractKeywords } from '../media/semanticRelevance.js';
import { assessHookReadability, assessCaptionReadability } from '../video/readability.js';
import { buildEditorCritique } from './editorCritique.js';

/**
 * RETENTION QC — yayın öncesi DETERMİNİSTİK editoryal kalite kapısı.
 *
 * "Video teknik olarak tamam ama izleyiciyi tutar mı?" sorusuna ölçülebilir
 * cevap verir: elimizdeki gerçek verilerden (kelime zamanlamaları, plan
 * süreleri, kaynak karışımı, kurgu planı, preflight metrikleri) 100 üzerinden
 * puan üretir. LLM tahmini YOK — her alt kontrol tekrarlanabilir.
 *
 * Modlar (config.retention.mode / RETENTION_QC_MODE):
 *   disabled : değerlendirme yapılmaz; render mümkündür ama upload fail-closed.
 *   warning  : rapor üretir; editorialReady/productionReady false ise upload durur.
 *   strict   : aynı hazır-olma sözleşmesini uygular (video artifact kalır).
 *
 * Kategoriler (100): hook 25, görsel tempo 20, merak zinciri 15, altyazı 10,
 * görsel çeşitlilik 10, ses tasarımı 10, final/loop 10.
 */

const WEAK_HOOK = [
  /^did you know/i, /^today we/i, /^here (is|'s) an? /i, /^let'?s talk/i,
  /^welcome/i, /^in this video/i, /^have you ever wondered$/i,
];
const PROMISE_HOOK = [
  /\d/, /\?$/, /\b(no one|nobody|never|only|first|last|oldest|biggest|strangest|impossible|secret|hidden|forbidden|wouldn'?t|shouldn'?t|can'?t)\b/i,
  /\b(but|until|survived|vanished|refused|fooled|defied|glow|talks?|counts?)\b/i,
];
const TWIST_WORDS = /\b(but|until|then|instead|suddenly|turns out|except|yet|however|in fact|actually)\b/i;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/**
 * Saf değerlendirme — dosya yazmaz, config'i parametre alır (test edilebilir).
 * @param {object} input {
 *   script: {hook_text, finale_text, scenes:[{narration}], format},
 *   wordTimings: [{word,start,end}],
 *   itemSeconds: number[]  (plan süreleri, sn),
 *   itemTypes: string[]    ('photo'|'video'),
 *   itemSources: string[]  ('ai'|'stock'|'archive'|'gfx'|'pexels'|'placeholder'),
 *   editPlan: {boundaries:[{transition,sfx}], subscribeScene} | null,
 *   duration: number, lufs: number|null, audioPresent: boolean,
 * }
 */
export function evaluateRetention(input, cfg = config.retention) {
  const warnings = [];
  const failures = [];
  const fixes = [];
  const s = input.script || {};
  const words = input.wordTimings || [];
  const secs = input.itemSeconds || [];
  const types = input.itemTypes || [];
  const sources = input.itemSources || [];
  const duration = Number(input.duration) || 0;

  // ---------- metrikler ----------
  const firstSpeechMs = words.length ? Math.round(words[0].start * 1000) : null;
  const planCount = secs.length;
  const avgEventInterval = planCount ? +(duration / planCount).toFixed(2) : null;
  // Statik segment: photo tipli plan süresi (Ken Burns tek başına "olay" sayılmaz).
  let longestStatic = 0;
  secs.forEach((d, i) => {
    if ((types[i] || 'photo') === 'photo') longestStatic = Math.max(longestStatic, d);
  });
  longestStatic = +longestStatic.toFixed(2);
  const staticShare = duration
    ? +(secs.reduce((a, d, i) => a + ((types[i] || 'photo') === 'photo' ? d : 0), 0) / duration).toFixed(2)
    : 1;
  // Konuşma içi ölü boşluk (kelimeler arası > 1.5sn).
  let deadAirCount = 0;
  for (let i = 1; i < words.length; i += 1) {
    if (words[i].start - words[i - 1].end > 1.5) deadAirCount += 1;
  }

  // ---------- yeni editoryal sinyaller (saf, deterministik) ----------
  const pi = countPatternInterrupts({ itemSources: sources, itemTypes: types, editPlan: input.editPlan });
  const mech = detectMechanismCoverage(s, sources);
  const allNarration = (s.scenes || []).map((sc) => sc.narration || '').join(' ') +
    ' ' + String(s.hook_text || '') + ' ' + String(s.finale_text || '');
  const certainty = classifyFactualCertainty(allNarration);
  const sfx = sfxQuality(input.editPlan, secs, { minGap: cfg.minSfxGapSeconds });
  const relevance = summarizeRelevance(input.itemRelevance || []);
  // FİLM YAPISI — loop: finale hook'un açtığı soruyu kapatıyor mu? (kelime örtüşmesi)
  const hookKw = new Set(extractKeywords(s.hook_text || s.scenes?.[0]?.narration || ''));
  const finaleKw = extractKeywords(s.finale_text || '');
  const loopClosed = finaleKw.length > 0 && finaleKw.some((w) => hookKw.has(w));
  // GÖRSEL TEKRAR — en uzun aynı-kaynak dizisi + AI oranı (estetik tekdüzeliği).
  let srcRun = 0; let srcMaxRun = 0;
  for (let i = 0; i < sources.length; i += 1) {
    srcRun = i > 0 && sources[i] === sources[i - 1] ? srcRun + 1 : 1;
    srcMaxRun = Math.max(srcMaxRun, srcRun);
  }
  const aiShare = sources.length ? +(sources.filter((x) => x === 'ai').length / sources.length).toFixed(2) : 0;

  // ---------- A) HOOK (25) ----------
  let hook = 0;
  let hookRead = null;
  const ht = String(s.hook_text || '').trim();
  const firstNar = String(s.scenes?.[0]?.narration || '').trim();
  const hookWords = ht.split(/\s+/).filter(Boolean).length;
  if (ht) {
    hook += 5;
    if (ht.length <= cfg.maxHookChars) hook += 3;
    else fixes.push(`hook_text ${ht.length} karakter — ${cfg.maxHookChars} altına indir (kapakta büyük dursun).`);
    if (!WEAK_HOOK.some((r) => r.test(ht)) && !WEAK_HOOK.some((r) => r.test(firstNar))) hook += 5;
    else fixes.push('Zayıf hook kalıbı ("did you know" tarzı) — doğrudan imkânsız iddia/merak boşluğu kullan.');
    if (PROMISE_HOOK.some((r) => r.test(ht)) || PROMISE_HOOK.some((r) => r.test(firstNar))) hook += 5;
    else fixes.push('Hook bir vaat/çelişki/sayı/soru içermiyor — scroll-stop gücü düşük.');
    // Mobil okunabilirlik: hook 5-7 kelimeyi aşmamalı (ilk bakışta okunmalı).
    if (hookWords <= cfg.maxHookWords) hook += 3;
    else fixes.push(`Hook ${hookWords} kelime — ${cfg.maxHookWords} kelimeyi aşıyor, telefonda ilk bakışta okunmaz.`);
    // 360x640 ön izlemede gerçek görünür boyut (uzun hook = küçük font).
    hookRead = assessHookReadability(ht, {
      minPreviewPx: cfg.hookMinPreviewPx ?? 20, maxWords: cfg.maxHookWords, hasContrastBox: true,
    });
    if (!hookRead.ok) for (const r of hookRead.reasons) if (!fixes.some((f) => f.includes('Hook'))) fixes.push(`Hook okunabilirlik: ${r}.`);
  } else {
    failures.push('hook_text yok');
  }
  if (firstSpeechMs !== null) {
    if (firstSpeechMs <= cfg.firstSpeechDeadlineMs) hook += 4;
    else {
      warnings.push(`ilk konuşma ${firstSpeechMs}ms'de başlıyor (hedef ≤${cfg.firstSpeechDeadlineMs}ms)`);
      hook += 1;
    }
  }

  // ---------- B) GÖRSEL TEMPO + PATTERN INTERRUPT (20) ----------
  let pacing = 0;
  if (avgEventInterval !== null) {
    if (avgEventInterval <= cfg.targetVisualEventInterval) pacing += 6;
    else if (avgEventInterval <= cfg.targetVisualEventInterval + 1.3) pacing += 3;
    else fixes.push(`Ortalama görsel olay aralığı ${avgEventInterval}s — hedef ≤${cfg.targetVisualEventInterval}s (daha çok plan/bölme).`);
  }
  if (longestStatic <= cfg.maxStaticSegmentSeconds) pacing += 6;
  else if (longestStatic <= cfg.maxStaticSegmentSeconds + 1.0) {
    pacing += 3;
    warnings.push(`en uzun statik plan ${longestStatic}s (hedef ≤${cfg.maxStaticSegmentSeconds}s)`);
  } else fixes.push(`${longestStatic}s statik plan — pattern interrupt (crop/pan/diagram/cutaway) ile bölünmeli.`);
  // Pattern interrupt: 30-35sn için min/ideal hedef.
  if (pi.count >= cfg.idealPatternInterrupts) pacing += 5;
  else if (pi.count >= cfg.minPatternInterrupts) pacing += 3;
  else fixes.push(`Yalnızca ${pi.count} güçlü pattern interrupt — hedef ≥${cfg.minPatternInterrupts} (yeni kaynak/diagram/harita/cutaway).`);
  const motionShare = 1 - staticShare;
  if (motionShare >= 0.25) pacing += 3;
  else if (motionShare >= 0.1) pacing += 1;

  // ---------- C) MERAK + İÇERİK BÜTÜNLÜĞÜ (15) ----------
  let curiosity = 0;
  const scenes = s.scenes || [];
  if (scenes.length >= 6 && scenes.length <= 10) curiosity += 3;
  const twists = scenes.filter((sc) => TWIST_WORDS.test(sc.narration || '')).length;
  if (twists >= 2) curiosity += 4;
  else if (twists === 1) curiosity += 2;
  else fixes.push('Anlatıda dönüş kelimesi (but/until/turns out...) yok — merak zinciri düz.');
  if (deadAirCount === 0) curiosity += 2;
  else warnings.push(`konuşmada ${deadAirCount} ölü boşluk (>1.5s)`);
  if (String(s.finale_text || '').trim()) curiosity += 1;
  // Mekanizma: "nasıl çalışır" anlatan video en az bir açıklayıcı görsel içermeli.
  if (mech.ok) curiosity += 3;
  else fixes.push('Mekanizma anlatılıyor ama açıklayıcı görsel (diagram/oklar/ışın) yok — salt B-roll yetmez.');
  // Olgusal kesinlik: kaynaksız mutlak iddia (definitely/proven...) yumuşatılmalı.
  if (!certainty.overclaim) curiosity += 2;
  else fixes.push(`Tartışmalı iddia kesin dille ("${certainty.absolute ? 'definitely/proven' : ''}") — "may/experiments suggest" ile yumuşat.`);

  // ---------- D) ALTYAZI (10) ----------
  // Metin uzunluğu tahmini DEĞİL: render'ın kullandığı gerçek yerleşim
  // matematiği (captionLayout.js) burada da çalıştırılır — bölme, font tabanı
  // ve güvenli alan render ile birebir aynı hesaptan doğrulanır.
  let captions = 0;
  let capLayout = null;
  let capRead = null;
  if (words.length) {
    capLayout = analyzeCaptionLayout(words, { emphasisWords: input.emphasisWords || [] });
    if (!capLayout.safeArea.ok) {
      failures.push('altyazı güvenli alan dışında (Shorts UI çakışması riski)');
    }
  }
  if (config.video.captionSize >= cfg.minCaptionPx) captions += 4;
  else fixes.push(`Altyazı ${config.video.captionSize}px — ${cfg.minCaptionPx}px altı telefonda okunmuyor.`);
  if (capLayout) {
    if (capLayout.maxWordsOnScreen <= cfg.maxCaptionWords) captions += 3;
    else warnings.push(`ekranda aynı anda ${capLayout.maxWordsOnScreen} kelime (hedef ≤${cfg.maxCaptionWords})`);
    if (capLayout.belowFloorCount === 0) captions += 3;
    if (capLayout.timingIssues?.length) failures.push(...capLayout.timingIssues);
    else warnings.push(`${capLayout.belowFloorCount} altyazı olayı font tabanına rağmen sığmıyor (çok uzun kelime)`);
    // Güvenli alan içinde OLSA BİLE mobil görünür boyut düşükse yakala.
    capRead = assessCaptionReadability({
      minFontPx: capLayout.minFontUsed, outlinePx: 2.6, minPreviewPx: cfg.captionMinPreviewPx ?? 15,
    });
    if (!capRead.ok) warnings.push(`altyazı okunabilirlik: ${capRead.reason}`);
  } else {
    failures.push('altyazı zamanlaması yok veya boş');
  }

  // ---------- E) GÖRSEL ÇEŞİTLİLİK + SEMANTİK ALAKA (10) ----------
  let variety = 0;
  const srcSet = new Set(sources);
  if (srcSet.size >= 3) variety += 3;
  else if (srcSet.size === 2) variety += 1;
  let maxRun = 0;
  let run = 0;
  for (let i = 0; i < sources.length; i += 1) {
    run = i > 0 && sources[i] === sources[i - 1] ? run + 1 : 1;
    maxRun = Math.max(maxRun, run);
  }
  if (maxRun <= 3 || (sources[0] === 'stock' && maxRun === sources.length)) variety += 2;
  if (!sources.includes('placeholder')) variety += 3;
  else failures.push('placeholder görsel üretimde — asset zinciri incelenmeli');
  // Semantik alaka: görseller cümleyi gerçekten açıklamalı (alakasız stok yasak).
  if (relevance.count === 0 || (relevance.mismatchCount === 0 && (relevance.mean ?? 1) >= cfg.minSemanticRelevance)) {
    variety += 2;
  } else {
    fixes.push(`${relevance.mismatchCount} sahnede görsel anlatımla alakasız (alaka<${cfg.minSemanticRelevance}) — konuyu açıklayan görselle değiştir.`);
  }

  // ---------- F) SES TASARIMI (10) ----------
  let audio = 0;
  if (input.audioPresent) audio += 3;
  else failures.push('ses akışı yok');
  if (input.lufs !== null && input.lufs >= -16.5 && input.lufs <= -12.5) audio += 2;
  else if (input.lufs !== null) warnings.push(`loudness ${input.lufs} LUFS (hedef -14±2)`);
  // Duyulur sfx yeterliliği: 30-35sn bilgi videosu için min 3 (ideal 3-5, max 6).
  if (sfx.count >= cfg.minAudibleSfx && sfx.count <= cfg.maxAudibleSfx) audio += 3;
  else if (sfx.count >= 1) { audio += 1; fixes.push(`Yalnızca ${sfx.count} duyulur sfx — hedef ${cfg.minAudibleSfx}-${cfg.maxAudibleSfx} anlamlı, zamanlı vuruş.`); }
  else if (input.editPlan) fixes.push('Hiç duyulur sfx yok — hook/reveal/final anlarına anlamlı vuruşlar ekle.');
  // Aralık + çeşitlilik: birbirine çok yakın veya hep aynı sfx puan kazandırmaz.
  if (sfx.count >= 2) {
    if (sfx.spacedOk && sfx.distinctCount >= 2) audio += 2;
    else if (!sfx.spacedOk) warnings.push(`sfx'ler çok sık (${sfx.minGapSeconds}s < ${cfg.minSfxGapSeconds}s) — seyrelt.`);
    else warnings.push('sfx çeşitliliği düşük — aynı efekt tekrar ediyor.');
  }

  // ---------- G) FİNAL + LOOP (10) ----------
  let payoff = 0;
  if (String(s.finale_text || '').trim()) payoff += 4;
  else fixes.push('finale_text yok — kapanış vuruşu eksik.');
  if (config.video.tailSeconds <= 0.6) payoff += 3;
  else warnings.push(`kuyruk ${config.video.tailSeconds}s — loop hissi için ≤0.6s`);
  // CTA/abone kartı: payoff öncesi (ilk %70) görünürse GERÇEK puan cezası.
  const subScene = input.editPlan?.subscribeScene;
  const ctaRatio = (subScene !== undefined && subScene !== null && planCount > 0) ? subScene / planCount : null;
  if (ctaRatio === null || ctaRatio >= cfg.ctaEarliestRatio) payoff += 3;
  else fixes.push(`Abone/CTA kartı %${Math.round(ctaRatio * 100)}'de (payoff öncesi) — son %${Math.round((1 - cfg.ctaEarliestRatio) * 100)}'e al veya kaldır.`);
  // Film yapısı loop: finale hook sorusunu kapatmalı (başa dönüş hissi).
  if (String(s.finale_text || '').trim() && !loopClosed) {
    fixes.push('Loop yok — finale hook sorusuna geri bağlanmıyor; hook kelimesini finalede kapat.');
  }
  // Görsel tekdüzelik: uzun AI dizisi / yüksek AI oranı estetiği tekrarlıyor.
  if (srcMaxRun >= 4 || aiShare > 0.6) {
    fixes.push(`Görsel çeşitlilik düşük (AI oranı ${aiShare}, en uzun aynı-kaynak ${srcMaxRun}) — arşiv/diagram/stok/harita serpiştir.`);
  }

  // ---------- YENİ METRİKLER (ilk-3sn hook / CTA / bilgi yoğunluğu) ----------
  // Puanlama 100 tabanını (7 kategori) BOZMAZ; bunlar ölçülebilir teşhis
  // metrikleridir + düşükse önerilen düzeltme üretirler (editoryal rapora yansır).
  // İlk 3 saniye hook gücü (0-10): kapak sözü sinyalleri + konuşma erken mi başlıyor.
  let first3sHookScore = 0;
  if (ht) {
    if (!WEAK_HOOK.some((r) => r.test(ht))) first3sHookScore += 2;
    if (PROMISE_HOOK.some((r) => r.test(ht))) first3sHookScore += 3;
    if (/\d/.test(ht)) first3sHookScore += 2;   // şok istatistik = pattern interrupt
    if (/\?/.test(ht)) first3sHookScore += 1;   // curiosity gap sorusu
    if (hookWords <= cfg.maxHookWords) first3sHookScore += 1;
  }
  if (firstSpeechMs !== null && firstSpeechMs <= cfg.firstSpeechDeadlineMs) first3sHookScore += 1;
  first3sHookScore = clamp(first3sHookScore, 0, 10);

  // CTA varlık + yerleşim skoru (0-10): metin var mı + net abone çağrısı + payoff sonrası mı.
  let ctaScore = 0;
  const ctaText = String(s.cta || '').trim();
  if (ctaText) {
    ctaScore += 4;
    if (/\b(subscribe|abone|follow|takip)\b/i.test(ctaText)) ctaScore += 3;
    if (ctaRatio === null || ctaRatio >= cfg.ctaEarliestRatio) ctaScore += 3; // payoff sonrası / kart yok
  }
  ctaScore = clamp(ctaScore, 0, 10);

  // Bilgi yoğunluğu skoru (0-10): dönüş kelimeleri + sayısal iddialar + konuşma akış hızı.
  const narrationWordCount = scenes.reduce(
    (a, sc) => a + String(sc.narration || '').split(/\s+/).filter(Boolean).length, 0,
  );
  const wordsPerSecond = duration > 0 ? +(narrationWordCount / duration).toFixed(2) : 0;
  const numericBeats = scenes.filter((sc) => /\d/.test(sc.narration || '')).length;
  let infoDensityScore = 0;
  if (twists >= 2) infoDensityScore += 3; else if (twists === 1) infoDensityScore += 1;
  if (numericBeats >= 3) infoDensityScore += 3; else if (numericBeats >= 1) infoDensityScore += 1;
  if (wordsPerSecond >= 2.2 && wordsPerSecond <= 3.4) infoDensityScore += 3; // ideal konuşma yoğunluğu
  else if (wordsPerSecond >= 1.8) infoDensityScore += 1;
  if (deadAirCount === 0) infoDensityScore += 1;
  infoDensityScore = clamp(infoDensityScore, 0, 10);

  if (first3sHookScore < 6) fixes.push(`İlk-3sn hook skoru ${first3sHookScore}/10 — pattern interrupt (şok sayı/soru) ile ilk 3 saniyeyi güçlendir.`);
  if (ctaScore < 6) fixes.push(`CTA skoru ${ctaScore}/10 — net "ABONE OL" çağrısı ekle ve payoff sonrasına (son %30) al.`);
  if (infoDensityScore < 6) fixes.push(`Bilgi yoğunluğu ${infoDensityScore}/10 — her sahneye yeni somut bilgi/sayı ekle, ölü boşlukları at.`);

  const parts = {
    hook: clamp(hook, 0, 25),
    visualPacing: clamp(pacing, 0, 20),
    curiosity: clamp(curiosity, 0, 15),
    captions: clamp(captions, 0, 10),
    visualVariety: clamp(variety, 0, 10),
    audioDesign: clamp(audio, 0, 10),
    payoffAndLoop: clamp(payoff, 0, 10),
  };
  const score = Object.values(parts).reduce((a, b) => a + b, 0);

  return {
    score,
    parts,
    metrics: {
      firstSpeechMs,
      planCount,
      averageVisualEventInterval: avgEventInterval,
      longestStaticSegment: longestStatic,
      staticShare,
      deadAirCount,
      twistCount: twists,
      // Yeni retention metrikleri (0-10) — teşhis + önerilen düzeltme kaynağı.
      first3sHookScore,
      ctaScore,
      infoDensityScore,
      narrationWordsPerSecond: wordsPerSecond,
      numericBeats,
      sfxCount: sfx.count,
      patternInterrupts: pi.count,
      patternInterruptIndices: pi.indices,
      sfxCues: sfx.cues,
      sfxMinGapSeconds: sfx.minGapSeconds,
      mechanism: { isMechanism: mech.isMechanism, hasExplanatoryVisual: mech.hasExplanatoryVisual, ok: mech.ok },
      factualCertainty: { level: certainty.level, overclaim: certainty.overclaim },
      semanticRelevance: relevance,
      hookWords,
      hookReadability: hookRead ? { previewPx: hookRead.previewPx, ok: hookRead.ok } : null,
      captionReadability: capRead ? { previewPx: capRead.previewPx, ok: capRead.ok } : null,
      loop: { closed: loopClosed },
      visualRepetition: { longestSameSourceRun: srcMaxRun, aiShare },
      sourceMix: [...srcSet].join('+'),
      durationSeconds: +duration.toFixed(1),
      captionLayout: capLayout
        ? {
            eventCount: capLayout.eventCount,
            splitCount: capLayout.splitCount,
            belowFloorCount: capLayout.belowFloorCount,
            maxLinesUsed: capLayout.maxLinesUsed,
            maxWordsOnScreen: capLayout.maxWordsOnScreen,
            minFontUsed: capLayout.minFontUsed,
            safeAreaOk: capLayout.safeArea.ok,
          }
        : null,
    },
    warnings,
    failures,
    recommendedFixes: fixes,
  };
}

function reportMd(r, mode, minScore, qcExecStatus = null, extra = {}) {
  if (qcExecStatus === 'disabled') {
    return `# Retention QC Raporu\n\n**Editoryal QC devre dışı** (RETENTION_QC_MODE=disabled). Render artifact üretilebilir; otomatik upload fail-closed olarak engellenir.\n\n## ⛔ Yayın Engelleri\n- EDITORIAL_NOT_READY\n`;
  }
  if (!r) {
    return `# Retention QC Raporu\n\n**QC ÇALIŞTIRILAMADI** — mod: ${mode}. Upload engellendi (QC denetiminden geçmeyen video otomatik yayınlanmaz). Ayrıntı production-report.json → qcExecution.error içinde.\n`;
  }
  const lines = [
    `# Retention QC Raporu`,
    ``,
    `**Skor: ${r.score}/100** — mod: ${mode}, eşik: ${minScore} → ${r.score >= minScore ? '✅ production-ready' : '⚠️ eşiğin altında'}`,
    ``,
    `| Kategori | Puan |`,
    `|---|---|`,
    ...Object.entries(r.parts).map(([k, v]) => `| ${k} | ${v} |`),
    ``,
    `## Metrikler`,
    '```json',
    JSON.stringify(r.metrics, null, 2),
    '```',
  ];
  if (r.failures.length) lines.push('', '## ❌ Kritik', ...r.failures.map((f) => `- ${f}`));
  if (extra.blockingReasons?.length) lines.push('', '## ⛔ Yayın Engelleri', ...extra.blockingReasons.map((x) => `- ${x}`));
  if (r.warnings.length) lines.push('', '## ⚠️ Uyarılar', ...r.warnings.map((w) => `- ${w}`));
  if (r.recommendedFixes.length) lines.push('', '## 🔧 Önerilen düzeltmeler', ...r.recommendedFixes.map((x) => `- ${x}`));
  const c = extra.critique;
  if (c) {
    lines.push('', '## 🎬 Editör Eleştirisi (acımasız)',
      `- Genel retention riski: **${c.overallRetentionRisk}**`,
      `- En sıkıcı an: ${c.mostBoringMoment ? `${c.mostBoringMoment.atSeconds}s (${c.mostBoringMoment.verdict})` : '—'}`,
      `- En zayıf sahne: ${c.weakestScene ? `#${c.weakestScene.plan} — "${(c.weakestScene.narration || '').slice(0, 60)}"` : '—'}`,
      `- En güçlü sahne: ${c.strongestScene ? `#${c.strongestScene.plan} — "${(c.strongestScene.narration || '').slice(0, 60)}"` : '—'}`,
      `- Görsel tekrar: en uzun aynı-kaynak ${c.visualRepetition.longestSameSourceRun}, AI oranı ${c.visualRepetition.aiShare}, farklı kaynak ${c.visualRepetition.distinctSources}`,
      `- Anlatım tekrarı: ${c.narrationRepetition.hasRepetition ? c.narrationRepetition.repeatedWords.join(', ') : 'yok'}`,
      `- Kaydırma riski anları (sn): ${c.swipeRiskMoments.length ? c.swipeRiskMoments.join(', ') : 'yok'}`,
      `- **En iyi iyileştirme:** ${c.bestImprovement}`);
  }
  if (extra.improvementPlan?.length) {
    lines.push('', `## 🎯 İyileştirme Planı (kalite hedefi ${extra.qualityTarget || 90} altında)`,
      ...extra.improvementPlan.map((x, i) => `${i + 1}. ${x}`));
  }
  return lines.join('\n') + '\n';
}

/**
 * TEK ORTAK UPLOAD KAPISI — üç platform (YouTube, Instagram, Facebook) da
 * yalnızca bu koşuldan geçerek yayınlanabilir; platform bazlı bypass yoktur.
 *
 *   teknik kapı : preflight geçti VEYA TECHNICAL_PREFLIGHT_MODE=warning
 *                 (varsayılan strict → teknik hata her zaman durdurur)
 *   QC kapısı   : qc.blockUpload=false (mod sözleşmesine göre hesaplanır)
 */
export function uploadGate({ preflightOk, qc }) {
  // Editorial QC is report-only. Only final-MP4 technical validation may stop
  // a publish attempt; a missing QC report must not halt production.
  return Boolean(preflightOk && (!qc || qc.blockUpload === false));
}

/** Persist a blocker discovered after QC but before a remote side effect. */
export async function recordPublicationBlock(qc, workDir, reason) {
  if (!qc?.report || !reason) return;
  qc.blockUpload = true;
  qc.ok = false;
  qc.report.productionReady = false;
  qc.report.uploadAllowedByPolicy = false;
  qc.report.blockingReasons = [...new Set([...(qc.report.blockingReasons || []), reason])];
  if (qc.report.uploadEligibility) {
    for (const platform of ['youtube', 'instagram', 'facebook']) qc.report.uploadEligibility[platform] = false;
    qc.report.uploadEligibility.policyOverride = false;
    qc.report.uploadEligibility.reasons = [
      ...new Set([...(qc.report.uploadEligibility.reasons || []), reason]),
    ];
  }
  await writeFile(path.join(workDir, 'production-report.json'), JSON.stringify(qc.report, null, 2));
  await appendFile(path.join(workDir, 'production-report.md'), `\n## ⛔ Yayın Engeli\n- ${reason}\n`);
}

/**
 * Platform bazlı yayın uygunluğu + insan-okur nedenler (rapor için).
 * uploadEligible tanımı: teknik kapı geçildi && QC exec hatası yok
 * && politika izin veriyor && platform yapılandırılmış.
 * policyOverride: video production-ready OLMADIĞI hâlde politika gereği
 * yayına izin verildi (raporda açıkça görünür, rapor kendi içinde çelişmez).
 */
export function computeUploadEligibility({
  uploadRequested,
  technicalReady,
  technicalMode = config.preflight.mode,
  blockUpload,
  execError,
  editorialReady,
  productionReady,
  blockingReasons = [],
  mode,
  platforms = {},
}) {
  const reasons = [];
  const base = uploadRequested !== false && Boolean(technicalReady) && !blockUpload;

  if (uploadRequested === false) reasons.push('upload istenmedi (--no-upload veya kredensiyel yok)');
  if (!technicalReady) reasons.push('teknik preflight başarısız — warning modu güvenlik kapısını aşamaz');
  if (execError) reasons.push('QC çalıştırılamadı; yayın etkilenmedi, rapor eksik.');
  if (!execError && editorialReady !== true) reasons.push(`${mode} mod: editoryal bulgular raporlandı; upload devam eder.`);
  for (const reason of blockingReasons) if (reason && !reasons.includes(reason)) reasons.push(reason);

  // Acil güvenlik sözleşmesi: hazır olmayan üretime policy override yoktur.
  const policyOverride = false;
  for (const p of ['youtube', 'instagram', 'facebook']) {
    if (base && !platforms[p]) reasons.push(`${p} yapılandırılmamış (kredensiyel yok)`);
  }
  return {
    youtube: Boolean(base && platforms.youtube),
    instagram: Boolean(base && platforms.instagram),
    facebook: Boolean(base && platforms.facebook),
    policyOverride,
    reasons,
  };
}

/**
 * Pipeline sarmalayıcı: değerlendirir, raporları yazar, mod kararını döndürür.
 *
 * ALAN SÖZLEŞMESİ (rapor kendi içinde çelişmez):
 *   technicalReady       : final MP4 teknik olarak geçerli mi (preflight).
 *   editorialReady       : retention skoru ≥ eşik VE kritik editoryal hata yok.
 *   productionReady      : technicalReady && editorialReady && qcExecution=passed.
 *   uploadAllowedByPolicy: mevcut mod/politika otomatik yüklemeye izin veriyor mu.
 *   uploadEligibility    : platform bazlı nihai uygunluk (+policyOverride+nedenler).
 *
 * MOD SÖZLEŞMESİ:
 *   disabled → editoryal QC uygulanmaz (qcExecution.status='disabled'); teknik
 *              preflight BAĞIMSIZ çalışmaya devam eder. Upload engellenmez.
 *   warning  → düşük skor/kritik editoryal hata yayını DURDURMAZ; ama bu bir
 *              POLICY OVERRIDE'dır ve raporda açıkça görünür.
 *              QC'nin KENDİSİ hata verirse (exception) upload ENGELLENİR:
 *              QC denetiminden geçmeyen video otomatik yayınlanmaz.
 *   strict   → düşük skor, kritik hata VEYA QC exception → upload engellenir
 *              (fail-closed).
 *
 * @param {object} input  evaluateRetention girdisi
 * @param {string} workDir rapor dosyalarının yazılacağı klasör
 * @param {object} [extras] {technical, technicalPassed, uploadRequested, platforms}
 * @returns {{score:number|null, ok:boolean, blockUpload:boolean, report:object|null, error:string|null}}
 */
export async function runRetentionQC(input, workDir, extras = {}) {
  const cfg = config.retention;
  // Teknik durum bilinmiyorsa (eski çağrı imzası) karara karıştırma.
  const technicalReady = extras.technicalPassed !== false;
  const disabled = cfg.mode === 'disabled';

  let r = null;
  let execError = null;
  if (!disabled) {
    try {
      r = evaluateRetention(input, cfg);
    } catch (err) {
      execError = String(err?.message || err);
      console.error(`[qc] QC DEĞERLENDİRMESİ ÇÖKTÜ: ${execError}`);
    }
  }

  // editorialReady: yalnızca editoryal ölçütler (teknik durum karışmaz).
  const editorialReady = disabled ? null : r ? r.score >= cfg.minScore && r.failures.length === 0 : false;
  const qcExecStatus = disabled ? 'disabled' : execError ? 'error' : editorialReady ? 'passed' : 'failed';
  const externalBlockingReasons = [...new Set(extras.blockingReasons || [])].filter(Boolean);
  // Production means the final artifact is technically publishable. Editorial
  // readiness remains visible in the report but never becomes a publish gate.
  const productionReady = Boolean(technicalReady);
  const blockUpload = !technicalReady;
  const uploadAllowedByPolicy = !blockUpload;
  const status = disabled ? 'disabled' : execError ? 'error' : r.failures.length ? 'fail' : editorialReady ? 'pass' : 'warning';

  const uploadEligibility = computeUploadEligibility({
    uploadRequested: extras.uploadRequested,
    technicalReady,
    blockUpload,
    execError,
    editorialReady,
    productionReady,
    blockingReasons: externalBlockingReasons,
    mode: cfg.mode,
    platforms: extras.platforms,
  });

  // RETENTION EDİTÖRÜ: kalite hedefi (90) altındaysa acımasız oto-eleştiri +
  // insan gözü simülasyonu + öncelikli iyileştirme planı. Upload kapısı DEĞİL.
  const qualityTarget = cfg.qualityTarget || 90;
  const belowQualityTarget = r ? r.score < qualityTarget : null;
  let critique = null;
  let attention = null;
  if (r && !execError) {
    try {
      const c = buildEditorCritique(input, r);
      critique = c.editorCritique;
      attention = c.attentionForecast;
    } catch (err) {
      console.error(`[qc] editör eleştirisi hesaplanamadı: ${err.message}`);
    }
  }
  const improvementPlan = r && belowQualityTarget
    ? (r.recommendedFixes || []).slice(0, 3)
    : [];

  const report = {
    openRouterUsed: extras.aiProvider?.openRouterUsed || false,
    openRouterRequestedModel: extras.aiProvider?.openRouterRequestedModel || null,
    openRouterResolvedModel: extras.aiProvider?.openRouterResolvedModel || null,
    openRouterAttempts: extras.aiProvider?.openRouterAttempts || 0,
    openRouterFailures: extras.aiProvider?.openRouterFailures || 0,
    retentionScore: r ? r.score : null,
    status,
    technicalReady,
    editorialReady,
    productionReady,
    uploadAllowedByPolicy,
    qualityTarget,
    belowQualityTarget,
    mode: cfg.mode, // geriye dönük uyumluluk (eski alan adı)
    qcMode: cfg.mode,
    minScore: cfg.minScore,
    qcExecution: { status: qcExecStatus, error: execError },
    technicalValidation: extras.technical || null,
    canonicalTimeline: input.timeline || null,
    renderPlan: input.renderPlan || null,
    assetManifest: extras.assetManifest || null,
    motion: extras.motion || null,
    blockingReasons: [
      ...(!technicalReady ? ['TECHNICAL_NOT_READY'] : []),
      ...(editorialReady !== true ? ['EDITORIAL_REPORT_WARNING'] : []),
      ...(execError ? [`QC_EXECUTION_ERROR: ${execError}`] : []),
      ...externalBlockingReasons.map((reason) => `EDITORIAL_REPORT: ${reason}`),
    ],
    uploadEligibility,
    scores: r ? r.parts : null,
    viewerFacingScoreBreakdown: {
      basis: 'deterministic metadata/render checks; null means not verified',
      hook: r?.parts?.hook ?? null,
      story: r ? { curiosity: r.parts.curiosity, payoffAndLoop: r.parts.payoffAndLoop } : null,
      visualDiversity: r?.parts?.visualVariety ?? null,
      timing: input.pacingIssues?.length ? 0 : 10,
      captions: r?.parts?.captions ?? null,
      narration: extras.ttsPhrasingIssues?.length ? 0 : null,
      sound: r?.parts?.audioDesign ?? null,
      technical: technicalReady ? 10 : 0,
      rights: externalBlockingReasons.some((x) => /license|rights|provenance|lisans/i.test(x)) ? 0 : 10,
      repetition: input.pacingIssues?.some((x) => /REPEAT/i.test(x)) ? 0 : null,
    },
    metrics: r ? r.metrics : null,
    editorCritique: critique,
    attentionForecast: attention,
    improvementPlan,
    warnings: r ? r.warnings : [],
    failures: r ? r.failures : [],
    recommendedFixes: r ? r.recommendedFixes : [],
    createdAt: new Date().toISOString(),
  };
  // Rapor yazımı görünür şekilde başarısız olmalı (sessiz yutma yok) —
  // ama QC raporu yazılamadı diye video üretimi çökmesin: hata logla, devam et.
  try {
    await writeFile(path.join(workDir, 'production-report.json'), JSON.stringify(report, null, 2));
    await writeFile(path.join(workDir, 'production-report.md'), reportMd(r, cfg.mode, cfg.minScore, qcExecStatus, {
      critique, improvementPlan, qualityTarget, blockingReasons: report.blockingReasons,
    }));
  } catch (err) {
    console.error(`[qc] RAPOR YAZILAMADI: ${err.message}`);
  }

  if (disabled) {
    console.log('[qc] retention QC devre dışı (RETENTION_QC_MODE=disabled) — teknik preflight bağımsız çalıştı.');
  }
  if (r) {
    const line = Object.entries(r.parts).map(([k, v]) => `${k}:${v}`).join(' ');
    console.log(`[qc] retention ${r.score}/100 (${status}) — ${line}`);
    for (const f of r.failures) console.error(`[qc] ❌ ${f}`);
    for (const w of r.warnings) console.warn(`[qc] ⚠️ ${w}`);
    for (const x of r.recommendedFixes) console.log(`[qc] 🔧 ${x}`);
  }
  if (blockUpload) {
    const causes = [];
    if (execError) causes.push('QC kendisi hata verdi (fail-closed, her aktif modda)');
    if (!execError && !editorialReady) causes.push(`skor ${r?.score} < ${cfg.minScore} veya kritik editoryal hata`);
    for (const reason of externalBlockingReasons) causes.push(reason);
    console.error(`[qc] ${cfg.mode.toUpperCase()} mod: ${causes.join(' + ')} — upload ENGELLENDİ.`);
  }
  return { score: r ? r.score : null, ok: productionReady, blockUpload, report, error: execError };
}
