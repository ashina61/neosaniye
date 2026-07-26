/**
 * YAYIN POLİTİKASI — upload'a izin veren TEK yer.
 *
 * ================== NEDEN VAR ==================
 * 26 Temmuz'da kalite kontrolünden kalan bir video (sea-cucumbers) cron
 * tarafından YouTube + Instagram + Facebook'a yüklendi. Kök neden üç katmanlıydı
 * ve her katman TEK BAŞINA yeterliydi:
 *
 *   1) .github/workflows/daily-short.yml — üretim adımı `--no-upload` bayrağını
 *      YALNIZCA `inputs.no_upload` doğruysa geçiriyordu. `schedule` tetiğinde
 *      input DİYE BİR ŞEY YOKTUR: ifade boş stringe düşer, bayrak hiç geçmez.
 *      Yani cron, tanım gereği "upload açık" modda koşuyordu.
 *
 *   2) scripts/generate-and-publish.js — bayrak yoksa `upload: undefined`
 *      gönderiyordu, yani "karar verilmedi".
 *
 *   3) src/pipeline/run.js — `willUpload = upload === true ||
 *      (upload !== false && hasYouTube)`. `undefined` gelince ifade
 *      `hasYouTube`e indirgeniyordu: **kimlik bilgisinin VARLIĞI, yayın İZNİ
 *      sayılıyordu.** Asıl hata budur. Anahtarın olması, yayınla demek değildir.
 *
 * ================== YENİ SÖZLEŞME ==================
 * Varsayılan KAPALI. Upload, açıkça istenmedikçe olmaz; istense bile bütün
 * kapılar geçilmedikçe olmaz. Karar tek bir saf fonksiyonda toplanır ki
 * öncelik sırası okunabilir ve test edilebilir olsun.
 *
 * ÖNCELİK (yukarıdan aşağı, ilk eşleşen kazanır):
 *   1. CLI `--no-upload`            → KESİN HAYIR
 *   2. CLI `--upload`               → talep var
 *   3. AUTO_UPLOAD=false|0          → KESİN HAYIR
 *   4. AUTO_UPLOAD=true|1           → talep var
 *   5. (hiçbiri)                    → KESİN HAYIR (manuel onay şart)
 *
 * Talep varsa kapılar sırayla sorulur; biri bile geçilmezse upload yok.
 * Hiçbir eski config anahtarı, hiçbir yedek değer bu sırayı atlayamaz:
 * `resolveUploadPolicy` dışında upload'a izin veren başka kod yoktur.
 *
 * ================== V3: KAPI ≠ CELLAT ==================
 * İlk sözleşme yayını güvene aldı ama başka bir uca savruldu: EDİTORYAL
 * ölçütler de engelleyici yapıldı. Sonuç, üretimin tamamen durmasıydı —
 * özne doğrulaması için model olmadığından o kapı HER koşuda düşüyor, semantik
 * eylem eşiği üretimin ürettiğinin çok üstünde kalıyordu. Video üretiliyor,
 * artifact'e yazılıyor, kimse görmüyor; geri bildirim olmadığı için sistem
 * öğrenmiyordu.
 *
 * Artık iki ayrı soru var ve karıştırılmıyor:
 *   TEKNİK    → "bu dosya izleyicinin ekranında düzgün oynar mı?"  ENGELLER.
 *   EDİTORYAL → "bu video yeterince iyi mi?"                       ENGELLEMEZ.
 * Editoryal sonuç raporlanır ve `PUBLISHING WITH QUALITY WARNINGS` olarak
 * loglanır; `enforceEditorialGates: true` ile eski sıkı davranış geri gelir.
 */

const TRUE_RE = /^(1|true|yes|on)$/i;
const FALSE_RE = /^(0|false|no|off)$/i;

/** Ortam değişkenini üçlü mantığa çevir: true / false / null (tanımsız). */
export function envFlag(value) {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s) return null;
  if (TRUE_RE.test(s)) return true;
  if (FALSE_RE.test(s)) return false;
  return null; // anlaşılmayan değer = tanımsız (asla "açık" sayılmaz)
}

export const UPLOAD_BLOCKED_MESSAGE = 'UPLOAD BLOCKED: manual approval is required.';

/**
 * Yayın izni.
 *
 * @param {object} input
 * @param {boolean|undefined} input.cliUpload  --upload → true, --no-upload → false
 * @param {object} [input.env]                 process.env (test için enjekte edilir)
 * @param {boolean} input.hasCredentials       YouTube kimlik bilgisi var mı
 * @param {boolean} input.preflightOk          teknik preflight geçti mi
 * @param {object|null} input.qc               retention QC sonucu (yoksa null)
 * @param {object|null} [input.emergencyGate]  acil kalite kapısı sonucu
 * @param {object|null} [input.technicalGate]  evaluateTechnicalPublishGate çıktısı
 * @param {object|null} [input.publishGates]   EDİTORYAL kapılar — varsayılan olarak
 *   yayını DURDURMAZ (aşağıdaki nota bak)
 * @param {boolean} [input.enforceEditorialGates] editoryal kapılar da engellesin mi
 * @returns {{allowed:boolean, requested:boolean, code:string, reason:string,
 *            checks:object}}
 */
export function resolveUploadPolicy({
  cliUpload,
  env = process.env,
  hasCredentials = false,
  preflightOk = false,
  qc = null,
  emergencyGate = null,
  technicalGate = null,
  publishGates = null,
  enforceEditorialGates = false,
} = {}) {
  const autoUpload = envFlag(env.AUTO_UPLOAD);
  const requireApproval = envFlag(env.REQUIRE_MANUAL_APPROVAL) !== false; // varsayılan TRUE

  // ---- 1) TALEP VAR MI? (öncelik sırası) ----
  let requested;
  let source;
  if (cliUpload === false) { requested = false; source = 'cli:--no-upload'; }
  else if (cliUpload === true) { requested = true; source = 'cli:--upload'; }
  else if (autoUpload === false) { requested = false; source = 'env:AUTO_UPLOAD=false'; }
  else if (autoUpload === true) { requested = true; source = 'env:AUTO_UPLOAD=true'; }
  else { requested = false; source = 'default:manual-approval-required'; }

  const checks = {
    source,
    requested,
    requireManualApproval: requireApproval,
    hasCredentials: Boolean(hasCredentials),
    preflightOk: Boolean(preflightOk),
    qcPresent: Boolean(qc),
    qcPassed: null,
    emergencyBlock: Boolean(emergencyGate?.block),
    technicalPublishReady: null,
    publishGatesPassed: null,
    editorialQualityPassed: null,
  };

  const deny = (code, reason) => ({ allowed: false, requested, code, reason, checks });

  if (!requested) return deny('MANUAL_APPROVAL_REQUIRED', UPLOAD_BLOCKED_MESSAGE);

  // ---- 2) MANUEL ONAY ----
  // REQUIRE_MANUAL_APPROVAL açıkken (varsayılan) upload isteği yalnızca
  // AÇIKÇA insan tarafından verilebilir. Cron'un input'u yoktur; dolayısıyla
  // cron bu satırı hiçbir zaman geçemez.
  if (requireApproval && source === 'default:manual-approval-required') {
    return deny('MANUAL_APPROVAL_REQUIRED', UPLOAD_BLOCKED_MESSAGE);
  }

  // ---- 3) KİMLİK ----
  if (!hasCredentials) return deny('NO_CREDENTIALS', 'UPLOAD BLOCKED: YouTube kimlik bilgisi yok.');

  // ---- 4) TEKNİK PREFLIGHT ----
  if (!preflightOk) return deny('PREFLIGHT_FAILED', 'UPLOAD BLOCKED: teknik preflight geçilemedi.');

  // ---- 5) QC VAR MI? (EKSİK QC = HAYIR) ----
  // "Rapor üretilemedi" bir başarı değildir. Eskiden QC hatası yutuluyor ve
  // upload devam ediyordu.
  if (!qc || qc.report == null) {
    return deny('QC_MISSING', 'UPLOAD BLOCKED: QC raporu yok — doğrulanmamış video yayınlanmaz.');
  }
  const qcPassed = qc.blockUpload !== true && qc.ok !== false && qc.status !== 'needs_review';
  checks.qcPassed = qcPassed;
  if (!qcPassed) return deny('QC_FAILED', 'UPLOAD BLOCKED: QC geçilemedi.');

  // ---- 6) ACİL KALİTE KAPISI ----
  if (emergencyGate?.block) {
    return deny('EMERGENCY_GATE', `UPLOAD BLOCKED: ${(emergencyGate.blocking || []).join(', ')}`);
  }

  // ---- 7) TEKNİK YAYIN KAPISI (TEK ENGELLEYİCİ OTORİTE) ----
  //
  // "QC cellat değil editördür": yayını yalnızca TEKNİK olarak bozuk video
  // durdurur. Dosya açılmıyor, akış yok, tamamen siyah/sessiz, hash tutmuyor,
  // sahne sırası kırık, altyazı metni TTS'ten kopmuş — bunlar izleyicinin
  // ekranında somut arızadır. Kalite görüşü burada karar vermez.
  if (technicalGate) {
    checks.technicalPublishReady = technicalGate.technicalPublishReady === true;
    if (technicalGate.technicalPublishReady !== true) {
      const why = [...(technicalGate.blockers || []),
        ...(technicalGate.unverified || []).map((u) => `doğrulanamadı:${u}`)];
      return deny('TECHNICAL_GATE_FAILED', `UPLOAD BLOCKED: ${why.join(', ') || 'teknik kapı geçilemedi'}`);
    }
  }

  // ---- 8) EDİTORYAL KAPILAR — VARSAYILAN OLARAK ENGELLEMEZ ----
  //
  // Semantik eylem skoru, görsel çeşitlilik, özne doğrulaması, retention…
  // Bunlar videonun BOZUK olduğunu söylemez, "daha iyi olabilirdi" der.
  // Engel yapıldıklarında kanal tamamen durmuştu: her koşu üretiyor, hiçbiri
  // yayınlanmıyordu — dolayısıyla hiç geri bildirim, dolayısıyla hiç öğrenme.
  // Sonuç RAPORLANIR (checks + PUBLISHING WITH QUALITY WARNINGS logu) ama
  // yayını durdurmaz. Sıkı davranış isteyen çağıran enforceEditorialGates ile
  // eski davranışı açıkça geri alabilir.
  if (publishGates) {
    checks.publishGatesPassed = publishGates.passed === true;
    checks.editorialQualityPassed = publishGates.passed === true;
    if (enforceEditorialGates && publishGates.passed !== true) {
      return deny('PUBLISH_GATES_FAILED',
        `UPLOAD BLOCKED: ${(publishGates.failures || []).join(', ') || 'yayın kapıları geçilemedi'}`);
    }
  }

  return {
    allowed: true,
    requested: true,
    code: checks.editorialQualityPassed === false ? 'ALLOWED_WITH_QUALITY_WARNINGS' : 'ALLOWED',
    reason: checks.editorialQualityPassed === false
      ? 'teknik kapılar geçildi; editoryal uyarılarla yayınlanıyor'
      : 'tüm kapılar geçildi',
    checks,
  };
}

/** Kararı okunur biçimde logla (her kapı ayrı satır — tek skorla maskelenmez). */
export function logUploadDecision(decision, logger = console) {
  const c = decision.checks;
  logger.log(
    `[yayın] karar=${decision.allowed ? 'YÜKLE' : 'ENGELLİ'} (${decision.code}) | kaynak=${c.source}\n` +
    `        talep:${c.requested ? '✓' : '✗'} manuelOnay:${c.requireManualApproval ? 'gerekli' : 'gerekmiyor'} ` +
    `kimlik:${c.hasCredentials ? '✓' : '✗'} preflight:${c.preflightOk ? '✓' : '✗'} ` +
    `qcVar:${c.qcPresent ? '✓' : '✗'} qcGeçti:${c.qcPassed === null ? '—' : c.qcPassed ? '✓' : '✗'} ` +
    `acilKapı:${c.emergencyBlock ? 'BLOKE' : '✓'} ` +
    `teknik:${c.technicalPublishReady === null ? '—' : c.technicalPublishReady ? '✓' : '✗'} ` +
    `editoryal:${c.editorialQualityPassed === null ? '—' : c.editorialQualityPassed ? '✓' : '✗'}`,
  );
  if (!decision.allowed) logger.error(decision.reason);
  // Kalitesi düşük ama teknik olarak sağlam video YAYINLANIR — sessizce değil.
  else if (c.editorialQualityPassed === false) logger.warn('PUBLISHING WITH QUALITY WARNINGS');
}
