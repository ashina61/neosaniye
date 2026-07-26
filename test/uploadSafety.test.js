/**
 * YAYIN GÜVENLİĞİ — "cron bir daha onaysız yayın yapamaz."
 *
 * 26 Tem: kalite kontrolünden kalan sea-cucumbers.mp4 cron tarafından
 * YouTube + Instagram + Facebook'a yüklendi. Bu dosya, o yolun her adımını
 * kapatan davranışı kilitler.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolveUploadPolicy, envFlag, UPLOAD_BLOCKED_MESSAGE } from '../src/pipeline/uploadPolicy.js';
import { evaluatePublishGates } from '../src/pipeline/publishGates.js';

const OK = {
  hasCredentials: true,
  preflightOk: true,
  qc: { report: {}, blockUpload: false, ok: true },
  emergencyGate: { block: false, blocking: [] },
  publishGates: { passed: true, failures: [] },
};

// ---------------- VARSAYILAN GÜVENLİ ----------------
test('cron varsayılanı: bayrak yok, env yok → YÜKLEME YOK', () => {
  const d = resolveUploadPolicy({ ...OK, cliUpload: undefined, env: {} });
  assert.equal(d.allowed, false);
  assert.equal(d.code, 'MANUAL_APPROVAL_REQUIRED');
  assert.equal(d.reason, UPLOAD_BLOCKED_MESSAGE);
});

test('log mesajı tam olarak istenen cümle', () => {
  assert.equal(UPLOAD_BLOCKED_MESSAGE, 'UPLOAD BLOCKED: manual approval is required.');
});

test('AUTO_UPLOAD=false kesin engeller', () => {
  for (const v of ['false', '0', 'no', 'off', 'FALSE']) {
    const d = resolveUploadPolicy({ ...OK, cliUpload: undefined, env: { AUTO_UPLOAD: v } });
    assert.equal(d.allowed, false, `AUTO_UPLOAD=${v} geçirdi`);
  }
});

test('AUTO_UPLOAD=true + tüm kapılar geçerse yükler', () => {
  const d = resolveUploadPolicy({ ...OK, cliUpload: undefined, env: { AUTO_UPLOAD: 'true' } });
  assert.equal(d.allowed, true, JSON.stringify(d));
});

// ---------------- ÖNCELİK SIRASI ----------------
test('--no-upload her şeyi ezer (AUTO_UPLOAD=true olsa bile)', () => {
  const d = resolveUploadPolicy({ ...OK, cliUpload: false, env: { AUTO_UPLOAD: 'true' } });
  assert.equal(d.allowed, false);
  assert.equal(d.checks.source, 'cli:--no-upload');
});

test('--upload, AUTO_UPLOAD=false\'u ezer (bilinçli insan kararı)', () => {
  const d = resolveUploadPolicy({ ...OK, cliUpload: true, env: { AUTO_UPLOAD: 'false' } });
  assert.equal(d.allowed, true);
  assert.equal(d.checks.source, 'cli:--upload');
});

test('anlaşılmayan env değeri ASLA "açık" sayılmaz', () => {
  assert.equal(envFlag('maybe'), null);
  assert.equal(envFlag(''), null);
  assert.equal(envFlag(undefined), null);
  const d = resolveUploadPolicy({ ...OK, cliUpload: undefined, env: { AUTO_UPLOAD: 'maybe' } });
  assert.equal(d.allowed, false);
});

// ---------------- KAPILAR ----------------
test('QC başarısızsa upload YOK', () => {
  const d = resolveUploadPolicy({
    ...OK, cliUpload: true, env: {}, qc: { report: {}, blockUpload: true },
  });
  assert.equal(d.allowed, false);
  assert.equal(d.code, 'QC_FAILED');
});

test('QC raporu EKSİKSE upload YOK (rapor üretilememesi başarı değildir)', () => {
  for (const qc of [null, undefined, { report: null }, { score: null }]) {
    const d = resolveUploadPolicy({ ...OK, cliUpload: true, env: {}, qc });
    assert.equal(d.allowed, false, JSON.stringify(qc));
    assert.equal(d.code, 'QC_MISSING');
  }
});

test('QC needs_review upload YOK', () => {
  const d = resolveUploadPolicy({
    ...OK, cliUpload: true, env: {}, qc: { report: {}, status: 'needs_review' },
  });
  assert.equal(d.allowed, false);
});

test('preflight düşerse upload YOK', () => {
  const d = resolveUploadPolicy({ ...OK, cliUpload: true, env: {}, preflightOk: false });
  assert.equal(d.allowed, false);
  assert.equal(d.code, 'PREFLIGHT_FAILED');
});

test('acil kalite kapısı bloke ederse upload YOK', () => {
  const d = resolveUploadPolicy({
    ...OK, cliUpload: true, env: {},
    emergencyGate: { block: true, blocking: ['CAPTIONS_MISSING_OR_EMPTY'] },
  });
  assert.equal(d.allowed, false);
  assert.equal(d.code, 'EMERGENCY_GATE');
});

test('yayın kapıları düşerse upload YOK', () => {
  const d = resolveUploadPolicy({
    ...OK, cliUpload: true, env: {},
    publishGates: { passed: false, failures: ['CAPTION_TOKENS_LOST'] },
  });
  assert.equal(d.allowed, false);
  assert.equal(d.code, 'PUBLISH_GATES_FAILED');
});

test('kimlik bilgisi yoksa upload YOK', () => {
  const d = resolveUploadPolicy({ ...OK, cliUpload: true, env: {}, hasCredentials: false });
  assert.equal(d.allowed, false);
  assert.equal(d.code, 'NO_CREDENTIALS');
});

// ---------------- YAYIN KAPILARI: needs_review = engel ----------------
test('özne doğrulanamıyorsa DANIŞMA olarak bildirilir, yayını durdurmaz', () => {
  // POLİTİKA DEĞİŞİKLİĞİ (kullanıcı kararı): bu kapı önce needs_review üretip
  // upload'ı engelliyordu. Görüntü semantiğini doğrulayacak bir model OLMADIĞI
  // için kapı her koşuda aynı sonucu veriyordu ve hiçbir video hiçbir zaman
  // yayınlanamıyordu — otomatik yayın tanım gereği imkânsızdı.
  // Bulgu GİZLENMİYOR: advisory listesinde raporlanmaya devam ediyor.
  const g = evaluatePublishGates({
    finalVideo: { ok: true, failures: [], warnings: [] },
    runIntegrity: { chainHash: 'x', parts: { finalVideo: 'y' } },
    captionIntegrity: { tokenCoverage: 1, missingTokens: [], duplicateTokens: [],
      grammarRiskBlocks: [], timelineOverlapCount: 0 },
    subjectContinuity: null, // model yok → yanlış güven üretme
    semanticActions: { average: 0.9 },
  });
  assert.ok(g.advisory.includes('SUBJECT_VERIFICATION_UNAVAILABLE'), JSON.stringify(g));
  assert.ok(!g.review.includes('SUBJECT_VERIFICATION_UNAVAILABLE'));
  assert.equal(g.status, 'pass', JSON.stringify(g));
  assert.equal(g.passed, true);
});

test('düşük semantik eylem ortalaması yayını durdurmaz ama raporlanır', () => {
  const g = evaluatePublishGates({
    finalVideo: { ok: true, failures: [], warnings: [] },
    runIntegrity: { chainHash: 'x', parts: { finalVideo: 'y' } },
    captionIntegrity: { tokenCoverage: 1, missingTokens: [], duplicateTokens: [],
      grammarRiskBlocks: [], timelineOverlapCount: 0 },
    subjectContinuity: { verified: true, score: 0.9, suspectedWrongSubjectScenes: [] },
    semanticActions: { average: 0.07 },   // üretimin gerçekte ürettiği değer
  });
  assert.ok(g.advisory.some((a) => a.startsWith('SEMANTIC_ACTION_INCOMPLETE')), JSON.stringify(g));
  assert.equal(g.passed, true, JSON.stringify(g));
});

test('DANIŞMA listesi BOZUK VİDEO bulgularını asla yutmaz', () => {
  // Kritik sınır: kapıları gevşetmek, kırık çıktının geçmesi anlamına GELMEZ.
  const g = evaluatePublishGates({
    finalVideo: { ok: false, failures: ['DURATION_MISMATCH:12 vs 49', 'TIMELINE_ORDER_INVALID:OVERLAP'], warnings: [] },
    runIntegrity: { chainHash: 'x', parts: { finalVideo: 'y' } },
    captionIntegrity: { tokenCoverage: 0.9, missingTokens: ['eject'], duplicateTokens: [],
      grammarRiskBlocks: [], timelineOverlapCount: 0 },
    subjectContinuity: null,
    semanticActions: { average: 0.07 },
  });
  assert.equal(g.status, 'fail');
  assert.equal(g.passed, false);
  assert.ok(g.failures.some((f) => f.includes('DURATION_MISMATCH')), JSON.stringify(g.failures));
  assert.ok(g.failures.some((f) => f.includes('TIMELINE_ORDER_INVALID')), JSON.stringify(g.failures));
  assert.ok(g.failures.some((f) => f.startsWith('CAPTION_TOKENS_LOST')), JSON.stringify(g.failures));
});

test('tek bir kapı düşerse genel skor yüksek olsa bile FAIL', () => {
  const g = evaluatePublishGates({
    captionIntegrity: { tokenCoverage: 0.96, missingTokens: ['eject'], duplicateTokens: [],
      grammarRiskBlocks: [], timelineOverlapCount: 0 },
    subjectContinuity: { verified: true, score: 0.95, suspectedWrongSubjectScenes: [] },
    semanticActions: { average: 0.95 },
  });
  assert.equal(g.status, 'fail');
  assert.ok(g.failures.some((f) => f.startsWith('CAPTION_TOKENS_LOST')));
});

// ---------------- WORKFLOW ----------------
test('workflow: cron OTOMATİK yayınlar, artifact yine üretilir', async () => {
  const wf = await readFile('.github/workflows/daily-short.yml', 'utf8');
  // Eski TERS mantıklı input kalmamalı.
  assert.ok(!/inputs\.no_upload/.test(wf), 'eski no_upload mantığı duruyor');
  // CRON YAYINLAR: `schedule` tetiğinde inputs yoktur, bu yüzden tetik türü
  // AÇIKÇA sorulmalı. Sadece `inputs.auto_upload`a bakan ifade boş stringe
  // düşer ve cron hiçbir zaman yayınlayamaz — bu tam olarak eski hataydı.
  assert.match(wf, /github\.event_name == 'schedule' \|\| inputs\.auto_upload\) && '--upload' \|\| '--no-upload'/);
  assert.match(wf, /AUTO_UPLOAD: \$\{\{ \(github\.event_name == 'schedule' \|\| inputs\.auto_upload\) && 'true' \|\| 'false' \}\}/);
  assert.match(wf, /REQUIRE_MANUAL_APPROVAL: "false"/);
  // Artifact'ler: video + rapor + script + sahne planı + kapı sonucu.
  for (const f of ['*.mp4', 'publish-gates.json', 'script.json', 'scene-plan.json',
    'production-report.json', 'cover.jpg']) {
    assert.ok(wf.includes(f), `artifact eksik: ${f}`);
  }
});

test('generate-and-publish: bayraksız çağrı upload İSTEMEZ', async () => {
  const src = await readFile('scripts/generate-and-publish.js', 'utf8');
  assert.match(src, /--no-upload'\) \? false/);
  assert.match(src, /--upload'\) \? true/);
  assert.ok(!/\? false : undefined/.test(src), 'eski "bayrak yoksa undefined" mantığı duruyor');
});

// ---------------- KAPININ ÇALIŞMASI ARIZA DEĞİLDİR ----------------
test('bilinçli engelleme "hiçbir platforma yüklenemedi" hatası ÜRETMEZ', async () => {
  // 26 Tem 17:01 koşusu: kullanıcı --upload verdi, yayın kapıları videoyu
  // HAKLI OLARAK engelledi ("QC geçilemedi"), sonra bu kontrol exception attı
  // ve iş kırmızıya döndü. Kapının doğru çalışması arıza gibi raporlanıyordu.
  // Kontrol yalnızca upload GERÇEKTEN denendiğinde (canUpload) anlamlıdır.
  const src = await readFile('src/pipeline/run.js', 'utf8');
  const m = src.match(/if \(([^)]*?)configuredPlatforms > 0 && successfulPlatforms === 0\)/);
  assert.ok(m, 'sessiz upload başarısızlığı kontrolü bulunamadı');
  assert.match(m[1], /\bcanUpload\b/,
    'kontrol canUpload ile korunmuyor: engellenen koşu "upload başarısız" sayılır');
});

// ---------------- MEDYA ALANLARI DOĞRULAMAYA ULAŞMALI ----------------
test('run.js medya eşlemesi loopEcho/part/assetId alanlarını DÜŞÜRMEZ', async () => {
  // SESSİZ KAYIP (brain-vs-ai-memory, 26 Tem): run.js, media öğelerini
  // renderVideo'ya daraltılmış bir nesne olarak veriyordu ve loopEcho düşüyordu.
  // Sonuç: overlayWindows.loopEcho DAİMA boş kaldı, kasıtlı döngü kapanışı
  // muafiyeti üretimde HİÇ çalışmadı ve her koşu DUPLICATE_SHOT +
  // HOOK_OUTSIDE_PLAN ile engellendi. Hata sessizdi çünkü eksik alanlar
  // "undefined" olarak tamamen makul görünüyor.
  const src = await readFile('src/pipeline/run.js', 'utf8');
  const call = src.slice(src.indexOf('const video = await renderVideo({'));
  const mapping = call.slice(0, call.indexOf('mediaScene:'));
  for (const field of ['loopEcho', 'part', 'assetId', 'source']) {
    assert.match(mapping, new RegExp(`\\b${field}\\b`),
      `renderVideo'ya geçen medya eşlemesinde '${field}' yok — doğrulayıcı onu asla göremez`);
  }
});
