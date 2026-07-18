import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';
import { analyzeCaptionLayout } from '../video/captionLayout.js';

/**
 * RETENTION QC — yayın öncesi DETERMİNİSTİK editoryal kalite kapısı.
 *
 * "Video teknik olarak tamam ama izleyiciyi tutar mı?" sorusuna ölçülebilir
 * cevap verir: elimizdeki gerçek verilerden (kelime zamanlamaları, plan
 * süreleri, kaynak karışımı, kurgu planı, preflight metrikleri) 100 üzerinden
 * puan üretir. LLM tahmini YOK — her alt kontrol tekrarlanabilir.
 *
 * Modlar (config.retention.mode / RETENTION_QC_MODE):
 *   disabled : hiçbir şey yapılmaz.
 *   warning  : (VARSAYILAN) rapor + log; upload'u ASLA engellemez. Mevcut
 *              günlük yayın akışı birebir korunur.
 *   strict   : skor < minScore ise upload engellenir (video artifact kalır).
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

  // ---------- A) HOOK (25) ----------
  let hook = 0;
  const ht = String(s.hook_text || '').trim();
  const firstNar = String(s.scenes?.[0]?.narration || '').trim();
  if (ht) {
    hook += 5;
    if (ht.length <= cfg.maxHookChars) hook += 3;
    else fixes.push(`hook_text ${ht.length} karakter — ${cfg.maxHookChars} altına indir (kapakta büyük dursun).`);
    if (!WEAK_HOOK.some((r) => r.test(ht)) && !WEAK_HOOK.some((r) => r.test(firstNar))) hook += 5;
    else fixes.push('Zayıf hook kalıbı ("did you know" tarzı) — doğrudan imkânsız iddia/merak boşluğu kullan.');
    if (PROMISE_HOOK.some((r) => r.test(ht)) || PROMISE_HOOK.some((r) => r.test(firstNar))) hook += 6;
    else fixes.push('Hook bir vaat/çelişki/sayı/soru içermiyor — scroll-stop gücü düşük.');
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
  const firstNarWords = firstNar.split(/\s+/).filter(Boolean).length;
  if (firstNarWords > 0 && firstNarWords <= 16) hook += 2;

  // ---------- B) GÖRSEL TEMPO (20) ----------
  let pacing = 0;
  if (avgEventInterval !== null) {
    if (avgEventInterval <= cfg.targetVisualEventInterval) pacing += 8;
    else if (avgEventInterval <= cfg.targetVisualEventInterval + 1.3) pacing += 5;
    else fixes.push(`Ortalama plan süresi ${avgEventInterval}s — hedef ≤${cfg.targetVisualEventInterval}s (daha çok plan/bölme).`);
  }
  if (longestStatic <= cfg.maxStaticSegmentSeconds) pacing += 8;
  else if (longestStatic <= cfg.maxStaticSegmentSeconds + 1.5) {
    pacing += 4;
    warnings.push(`en uzun statik plan ${longestStatic}s (hedef ≤${cfg.maxStaticSegmentSeconds}s)`);
  } else fixes.push(`${longestStatic}s'lik statik plan var — bölünmeli veya harekete çevrilmeli.`);
  const motionShare = 1 - staticShare;
  if (motionShare >= 0.25) pacing += 4;
  else if (motionShare >= 0.1) pacing += 2;

  // ---------- C) MERAK ZİNCİRİ (15) ----------
  let curiosity = 0;
  const scenes = s.scenes || [];
  if (scenes.length >= 6 && scenes.length <= 9) curiosity += 4;
  const twists = scenes.filter((sc) => TWIST_WORDS.test(sc.narration || '')).length;
  if (twists >= 2) curiosity += 6;
  else if (twists === 1) curiosity += 3;
  else fixes.push('Anlatıda dönüş kelimesi (but/until/turns out...) yok — merak zinciri düz.');
  if (deadAirCount === 0) curiosity += 3;
  else warnings.push(`konuşmada ${deadAirCount} ölü boşluk (>1.5s)`);
  if (String(s.finale_text || '').trim()) curiosity += 2;

  // ---------- D) ALTYAZI (10) ----------
  // Metin uzunluğu tahmini DEĞİL: render'ın kullandığı gerçek yerleşim
  // matematiği (captionLayout.js) burada da çalıştırılır — bölme, font tabanı
  // ve güvenli alan render ile birebir aynı hesaptan doğrulanır.
  let captions = 0;
  let capLayout = null;
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
    else warnings.push(`${capLayout.belowFloorCount} altyazı olayı font tabanına rağmen sığmıyor (çok uzun kelime)`);
  } else {
    // Kelime akışı yoksa yerleşim değerlendirilemez; yapı ayarına bakılır.
    if (config.video.captionWordsPerLine <= cfg.maxCaptionWords) captions += 3;
    captions += 3;
  }

  // ---------- E) GÖRSEL ÇEŞİTLİLİK (10) ----------
  let variety = 0;
  const srcSet = new Set(sources);
  if (srcSet.size >= 3) variety += 4;
  else if (srcSet.size === 2) variety += 2;
  let maxRun = 0;
  let run = 0;
  for (let i = 0; i < sources.length; i += 1) {
    run = i > 0 && sources[i] === sources[i - 1] ? run + 1 : 1;
    maxRun = Math.max(maxRun, run);
  }
  if (maxRun <= 3 || (sources[0] === 'stock' && maxRun === sources.length)) variety += 3;
  if (!sources.includes('placeholder')) variety += 3;
  else failures.push('placeholder görsel üretimde — asset zinciri incelenmeli');

  // ---------- F) SES TASARIMI (10) ----------
  let audio = 0;
  if (input.audioPresent) audio += 4;
  else failures.push('ses akışı yok');
  if (input.lufs !== null && input.lufs >= -16.5 && input.lufs <= -12.5) audio += 3;
  else if (input.lufs !== null) warnings.push(`loudness ${input.lufs} LUFS (hedef -14±2)`);
  const sfxList = (input.editPlan?.boundaries || []).map((b) => b.sfx).filter((x) => x && x !== 'none');
  if (sfxList.length >= 2 && sfxList.length <= 6) audio += 2;
  else if (input.editPlan) warnings.push(`duyulur sfx sayısı ${sfxList.length} (hedef 2-6)`);
  if (new Set(sfxList).size >= Math.min(2, sfxList.length)) audio += 1;

  // ---------- G) FİNAL + LOOP (10) ----------
  let payoff = 0;
  if (String(s.finale_text || '').trim()) payoff += 4;
  else fixes.push('finale_text yok — kapanış vuruşu eksik.');
  if (config.video.tailSeconds <= 0.6) payoff += 3;
  else warnings.push(`kuyruk ${config.video.tailSeconds}s — loop hissi için ≤0.6s`);
  const subScene = input.editPlan?.subscribeScene;
  if (subScene === undefined || subScene === null || planCount === 0 || subScene / planCount >= 0.55) payoff += 3;
  else warnings.push('abone kartı hikâyenin ilk yarısında — geç bölüme alınmalı');

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
      sfxCount: sfxList.length,
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

function reportMd(r, mode, minScore, qcExecStatus = null) {
  if (qcExecStatus === 'disabled') {
    return `# Retention QC Raporu\n\n**Editoryal QC devre dışı** (RETENTION_QC_MODE=disabled). Teknik preflight bağımsız çalıştı — sonuçlar production-report.json → technicalValidation içinde.\n`;
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
  if (r.warnings.length) lines.push('', '## ⚠️ Uyarılar', ...r.warnings.map((w) => `- ${w}`));
  if (r.recommendedFixes.length) lines.push('', '## 🔧 Önerilen düzeltmeler', ...r.recommendedFixes.map((x) => `- ${x}`));
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
export function uploadGate({ preflightOk, qc, technicalMode = config.preflight.mode }) {
  const technicalGateOk = Boolean(preflightOk) || technicalMode !== 'strict';
  return technicalGateOk && !qc?.blockUpload;
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
  mode,
  platforms = {},
}) {
  const reasons = [];
  const technicalGateOk = Boolean(technicalReady) || technicalMode !== 'strict';
  const base = uploadRequested !== false && technicalGateOk && !blockUpload;

  if (uploadRequested === false) reasons.push('upload istenmedi (--no-upload veya kredensiyel yok)');
  if (!technicalReady && technicalMode === 'strict') reasons.push('teknik preflight başarısız (TECHNICAL_PREFLIGHT_MODE=strict)');
  if (execError) reasons.push('QC çalıştırılamadı — QC denetiminden geçmeyen video otomatik yayınlanmaz (fail-closed)');
  if (!execError && blockUpload && mode === 'strict') reasons.push('strict mod: retention skoru eşiğin altında veya kritik editoryal hata');

  // Policy override'lar: hazır OLMAYAN video, politika izniyle yayınlanıyor.
  let policyOverride = false;
  if (base && !technicalReady && technicalMode !== 'strict') {
    policyOverride = true;
    reasons.push('POLICY OVERRIDE: teknik sorunlar var ama TECHNICAL_PREFLIGHT_MODE=warning yayına izin veriyor');
  }
  if (base && mode === 'warning' && !execError && editorialReady === false) {
    policyOverride = true;
    reasons.push('POLICY OVERRIDE: retention skoru hedefin altında ama warning-mod politikası yayına izin veriyor');
  }
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
  const productionReady = Boolean(technicalReady && editorialReady && qcExecStatus === 'passed');

  // Upload politikası (yalnızca QC tarafının kararı; teknik kapı uploadGate'te):
  //   exception → her aktif modda blok (QC'siz video otomatik yayınlanmaz),
  //   strict    → editoryal hazır değilse blok,
  //   warning   → editoryal sonuç ne olursa olsun politika izin verir,
  //   disabled  → izin verir.
  const blockUpload = disabled ? false : execError ? true : cfg.mode === 'strict' ? !editorialReady : false;
  const uploadAllowedByPolicy = !blockUpload;
  const status = disabled ? 'disabled' : execError ? 'error' : r.failures.length ? 'fail' : editorialReady ? 'pass' : 'warning';

  const uploadEligibility = computeUploadEligibility({
    uploadRequested: extras.uploadRequested,
    technicalReady,
    blockUpload,
    execError,
    editorialReady,
    mode: cfg.mode,
    platforms: extras.platforms,
  });

  const report = {
    retentionScore: r ? r.score : null,
    status,
    technicalReady,
    editorialReady,
    productionReady,
    uploadAllowedByPolicy,
    mode: cfg.mode, // geriye dönük uyumluluk (eski alan adı)
    qcMode: cfg.mode,
    minScore: cfg.minScore,
    qcExecution: { status: qcExecStatus, error: execError },
    technicalValidation: extras.technical || null,
    uploadEligibility,
    scores: r ? r.parts : null,
    metrics: r ? r.metrics : null,
    warnings: r ? r.warnings : [],
    failures: r ? r.failures : [],
    recommendedFixes: r ? r.recommendedFixes : [],
    createdAt: new Date().toISOString(),
  };
  // Rapor yazımı görünür şekilde başarısız olmalı (sessiz yutma yok) —
  // ama QC raporu yazılamadı diye video üretimi çökmesin: hata logla, devam et.
  try {
    await writeFile(path.join(workDir, 'production-report.json'), JSON.stringify(report, null, 2));
    await writeFile(path.join(workDir, 'production-report.md'), reportMd(r, cfg.mode, cfg.minScore, qcExecStatus));
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
  if (uploadEligibility.policyOverride) {
    console.warn('[qc] ⚠️ POLICY OVERRIDE: video production-ready değil ama mevcut politika yayına izin veriyor (rapora yazıldı).');
  }
  if (blockUpload) {
    const causes = [];
    if (execError) causes.push('QC kendisi hata verdi (fail-closed, her aktif modda)');
    if (!execError && !editorialReady) causes.push(`skor ${r?.score} < ${cfg.minScore} veya kritik editoryal hata`);
    console.error(`[qc] ${cfg.mode.toUpperCase()} mod: ${causes.join(' + ')} — upload ENGELLENDİ.`);
  }
  return { score: r ? r.score : null, ok: productionReady, blockUpload, report, error: execError };
}
