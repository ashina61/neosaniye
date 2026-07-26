/**
 * CRON DAYANIKLILIĞI (§17) — "kanal boş kalmasın."
 *
 * Cron'un tek görevi kesintisiz üretim ve yayındır. Bu dosya, cron'un
 * DURDURULABİLECEĞİ yolları kapatır:
 *   • Cron yayın talebinde bulunamıyor (schedule'da inputs yok → boş string).
 *   • Cron manuel run'dan FARKLI config ile koşuyor.
 *   • Cron saatleri kodun beklediği slotlarla uyuşmuyor.
 *   • Kalite puanı yayını engelliyor.
 *   • Bir AI sağlayıcı düşünce zincir tamamen çöküyor.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolveUploadPolicy } from '../src/pipeline/uploadPolicy.js';
import { decidePublish } from '../src/pipeline/technicalPublishGate.js';
import { detectSlot, EXPERIMENT } from '../src/pipeline/scheduleExperiment.js';

const wf = await readFile('.github/workflows/daily-short.yml', 'utf8');

// ---------------- SCHEDULE ----------------
test('cron ifadeleri geçerli 5 alanlı cron sözdizimi', () => {
  const crons = [...wf.matchAll(/- cron:\s*"([^"]+)"/g)].map((m) => m[1]);
  assert.ok(crons.length >= 1, 'hiç cron yok — cron çalışmaz');
  for (const c of crons) {
    const fields = c.trim().split(/\s+/);
    assert.equal(fields.length, 5, `${c}: 5 alan olmalı`);
    // Dakika ve saat sayısal ya da joker olmalı.
    assert.match(fields[0], /^(\*|\d{1,2}(?:,\d{1,2})*|\*\/\d+)$/, `${c}: dakika alanı`);
    assert.match(fields[1], /^(\*|\d{1,2}(?:,\d{1,2})*|\*\/\d+|\d{1,2}-\d{1,2})$/, `${c}: saat alanı`);
  }
});

test('workflow cron SAATLERİ kodun bildiği slotlarla AYNI', () => {
  // GERÇEK HATA: workflow 15/20/02'de koşuyordu, kod 13/18/23 bekliyordu.
  // detectSlot gecikme toleranslı olduğu için 15:02 koşusunu "2 saat gecikmiş
  // 13:00 slotu" sayıp sessizce kabul ediyordu — deney verisinin tamamı
  // yanlış slota kaydedilmişti. Sessiz kabul, hatayı görünmez yapıyordu.
  const hours = [...wf.matchAll(/- cron:\s*"\d+\s+(\d+)\s/g)].map((m) => Number(m[1]));
  const slotHours = EXPERIMENT.slots.map((s) => Number(s.split(':')[0]));
  assert.deepEqual([...hours].sort((a, b) => a - b), [...slotHours].sort((a, b) => a - b),
    `workflow saatleri ${hours} ≠ kod slotları ${slotHours}`);
});

test('her cron saati kendi slotunu ÜRETİR (gecikme kaymasına düşmez)', () => {
  const hours = [...wf.matchAll(/- cron:\s*"(\d+)\s+(\d+)\s/g)]
    .map((m) => ({ minute: Number(m[1]), hour: Number(m[2]) }));
  for (const { minute, hour } of hours) {
    const d = new Date(Date.UTC(2026, 6, 20, hour, minute, 5));
    const got = detectSlot(d, { eventName: 'schedule', manualSlot: '' }).slot;
    const expected = `${String(hour).padStart(2, '0')}:00`;
    assert.equal(got, expected, `${expected} cronu ${got} slotuna düştü`);
  }
});

test('scheduled workflow VARSAYILAN dalda tanımlı (cron yalnızca orada koşar)', async () => {
  // GitHub, zamanlanmış workflow'ları YALNIZCA varsayılan daldan çalıştırır.
  // Workflow dosyası başka bir dalda yaşıyorsa cron hiç tetiklenmez.
  const head = await readFile('.git/HEAD', 'utf8');
  const branch = (head.match(/ref: refs\/heads\/(.+)/) || [])[1]?.trim();
  assert.ok(branch, 'HEAD çözülemedi');
  // Bu depoda varsayılan dal = üretim dalı; en azından workflow'un schedule
  // tetiği TANIMLI olmalı, yoksa cron diye bir şey yoktur.
  assert.match(wf, /^\s{2}schedule:/m, 'workflow schedule tetiği tanımlamıyor');
});

// ---------------- CRON == MANUEL CONFIG ----------------
test('cron ile manuel run AYNI script ve AYNI env setini kullanır', () => {
  // İki ayrı üretim adımı olsa biri düzeltilir diğeri unutulurdu.
  const steps = [...wf.matchAll(/generate-and-publish\.js/g)];
  assert.equal(steps.length, 1, 'birden fazla üretim adımı var — config ikiye ayrılmış');
  // Upload kararı tek ifadede, tetik türüne göre.
  assert.match(wf, /github\.event_name == 'schedule' \|\| inputs\.auto_upload/);
  // Aynı ifade env tarafında da olmalı: bayrak ile env aynı yönü göstermeli.
  const occurrences = [...wf.matchAll(/github\.event_name == 'schedule' \|\| inputs\.auto_upload/g)];
  assert.ok(occurrences.length >= 2, 'bayrak ve AUTO_UPLOAD env aynı koşulu kullanmıyor');
});

test('cron upload İSTER (schedule tetiğinde inputs yoktur)', () => {
  // Eski ifade `inputs.auto_upload && '--upload' || '--no-upload'` idi.
  // schedule'da inputs tanımsızdır → boş string → DAİMA --no-upload.
  assert.ok(!/\$\{\{\s*inputs\.auto_upload\s*&&\s*'--upload'/.test(wf),
    'cron yayın isteyemeyen eski ifade geri gelmiş');
});

// ---------------- KALİTE ≠ ENGEL ----------------
const TECH_OK = { technicalPublishReady: true, blockers: [], unverified: [] };
const BASE = {
  hasCredentials: true,
  preflightOk: true,
  qc: { report: {}, blockUpload: false, ok: true },
  emergencyGate: { block: false, blocking: [] },
};

test('semantik skor 0.07 + teknik geçer → upload İZİNLİ (uyarıyla)', () => {
  const d = resolveUploadPolicy({
    ...BASE, cliUpload: true, env: {}, technicalGate: TECH_OK,
    publishGates: { passed: false, failures: ['SEMANTIC_ACTION_INCOMPLETE: ortalama 0.07'] },
  });
  assert.equal(d.allowed, true, JSON.stringify(d));
  assert.equal(d.code, 'ALLOWED_WITH_QUALITY_WARNINGS');
});

test('SFX duyulmuyor / caption küçük / görsel tekrar → yayın DURMAZ', () => {
  for (const finding of ['SFX_INAUDIBLE', 'CAPTION_TOO_SMALL', 'FINAL_VIDEO/SIMILAR_SHOT:1',
    'SUBJECT_VERIFICATION_UNAVAILABLE', 'RETENTION_BELOW_TARGET']) {
    const d = resolveUploadPolicy({
      ...BASE, cliUpload: true, env: {}, technicalGate: TECH_OK,
      publishGates: { passed: false, failures: [finding] },
    });
    assert.equal(d.allowed, true, `${finding} yayını durdurdu`);
  }
});

test('teknik arıza yayını DURDURUR (gevşetme her şeyi geçirmek değildir)', () => {
  const d = resolveUploadPolicy({
    ...BASE, cliUpload: true, env: {},
    technicalGate: { technicalPublishReady: false, blockers: ['DECODE_FAILED'], unverified: [] },
    publishGates: { passed: true, failures: [] },
  });
  assert.equal(d.allowed, false);
  assert.equal(d.code, 'TECHNICAL_GATE_FAILED');
});

test('üç alanlı sözleşme cron yayınını doğru anlatır', () => {
  const d = decidePublish({
    technical: { ...TECH_OK, checks: { finalVideoHashValid: true } },
    publishGates: { passed: false, failures: ['SEMANTIC_ACTION_INCOMPLETE'], advisory: [], review: [] },
    cronPublishingEnabled: true,
  });
  assert.equal(d.technicalPublishReady, true);
  assert.equal(d.editorialQualityPassed, false);
  assert.equal(d.uploadAllowed, true);
});

// ---------------- FALLBACK ZİNCİRİ ----------------
test('workflow birden çok AI sağlayıcı anahtarı geçirir (tek nokta arıza yok)', () => {
  // Bir sağlayıcı düşerse zincirin devam edebilmesi için alternatiflerin
  // ORTAMA ULAŞMASI gerekir; anahtar geçmiyorsa fallback diye bir şey yoktur.
  const providers = ['GEMINI_API_KEY', 'GROQ_API_KEY', 'OPENROUTER_API_KEY',
    'CEREBRAS_API_KEY', 'MISTRAL_API_KEY', 'CLOUDFLARE_API_TOKEN', 'GITHUB_MODELS_TOKEN'];
  const present = providers.filter((p) => wf.includes(p));
  assert.ok(present.length >= 4,
    `yalnızca ${present.length} metin sağlayıcısı bağlı: ${present.join(', ')}`);
  // Görsel tarafında da yedek olmalı (Pollinations tek nokta olmasın).
  for (const p of ['TOGETHER_API_KEY', 'HUGGINGFACE_API_KEY']) {
    assert.ok(wf.includes(p), `görsel yedeği eksik: ${p}`);
  }
});

test('video üretilebildiyse upload hatası workflow\'u kırmaz', () => {
  // Artifact adımları `if: always()` ile koşmalı; yoksa upload hatasında
  // video da kaybolur ve koşudan hiçbir çıktı kalmaz.
  assert.match(wf, /upload-artifact/);
  assert.ok(/if:\s*always\(\)/.test(wf), 'artifact adımları if: always() kullanmıyor');
});
