import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolveUploadPolicy} from '../src/pipeline/uploadPolicy.js';
import {decidePublish} from '../src/pipeline/technicalPublishGate.js';
import {detectSlot, EXPERIMENT} from '../src/pipeline/scheduleExperiment.js';

const wf = await readFile('.github/workflows/daily-short.yml', 'utf8');

test('cron ifadeleri geçerli 5 alanlı cron sözdizimi', () => {
  const crons = [...wf.matchAll(/- cron:\s*"([^"]+)"/g)].map((match) => match[1]);
  assert.ok(crons.length >= 1, 'hiç cron yok — cron çalışmaz');
  for (const cron of crons) {
    const fields = cron.trim().split(/\s+/);
    assert.equal(fields.length, 5, `${cron}: 5 alan olmalı`);
    assert.match(fields[0], /^(\*|\d{1,2}(?:,\d{1,2})*|\*\/\d+)$/, `${cron}: dakika alanı`);
    assert.match(fields[1], /^(\*|\d{1,2}(?:,\d{1,2})*|\*\/\d+|\d{1,2}-\d{1,2})$/, `${cron}: saat alanı`);
  }
});

test('workflow cron saatleri kodun bildiği slotlarla aynıdır', () => {
  const hours = [...wf.matchAll(/- cron:\s*"\d+\s+(\d+)\s/g)].map((match) => Number(match[1]));
  const slotHours = EXPERIMENT.slots.map((slot) => Number(slot.split(':')[0]));
  assert.deepEqual(
    [...hours].sort((a, b) => a - b),
    [...slotHours].sort((a, b) => a - b),
    `workflow saatleri ${hours} ≠ kod slotları ${slotHours}`,
  );
});

test('her cron saati kendi slotunu üretir', () => {
  const hours = [...wf.matchAll(/- cron:\s*"(\d+)\s+(\d+)\s/g)]
    .map((match) => ({minute: Number(match[1]), hour: Number(match[2])}));
  for (const {minute, hour} of hours) {
    const date = new Date(Date.UTC(2026, 6, 20, hour, minute, 5));
    const actual = detectSlot(date, {eventName: 'schedule', manualSlot: ''}).slot;
    const expected = `${String(hour).padStart(2, '0')}:00`;
    assert.equal(actual, expected, `${expected} cronu ${actual} slotuna düştü`);
  }
});

test('scheduled workflow dosyasında schedule tetiği tanımlıdır', () => {
  // GitHub PR checkout'u detached HEAD kullanır; yerel .git/HEAD varsayılan dalı
  // kanıtlayamaz. Burada doğrulanabilir sözleşme workflow'un schedule bloğudur.
  assert.match(wf, /^\s{2}schedule:/m, 'workflow schedule tetiği tanımlamıyor');
});

test('cron ile manuel run aynı script ve aynı env setini kullanır', () => {
  const steps = [...wf.matchAll(/generate-and-publish\.js/g)];
  assert.equal(steps.length, 1, 'birden fazla üretim adımı var — config ikiye ayrılmış');
  assert.match(wf, /github\.event_name == 'schedule' \|\| inputs\.auto_upload/);
  const occurrences = [...wf.matchAll(/github\.event_name == 'schedule' \|\| inputs\.auto_upload/g)];
  assert.ok(occurrences.length >= 2, 'bayrak ve AUTO_UPLOAD env aynı koşulu kullanmıyor');
});

test('cron upload ister', () => {
  assert.ok(
    !/\$\{\{\s*inputs\.auto_upload\s*&&\s*'--upload'/.test(wf),
    'cron yayın isteyemeyen eski ifade geri gelmiş',
  );
});

const TECH_OK = {technicalPublishReady: true, blockers: [], unverified: []};
const BASE = {
  hasCredentials: true,
  preflightOk: true,
  qc: {report: {}, blockUpload: false, ok: true},
  emergencyGate: {block: false, blocking: []},
};

test('semantik skor düşük ve teknik geçer ise upload uyarıyla izinlidir', () => {
  const decision = resolveUploadPolicy({
    ...BASE,
    cliUpload: true,
    env: {},
    technicalGate: TECH_OK,
    publishGates: {passed: false, failures: ['SEMANTIC_ACTION_INCOMPLETE: ortalama 0.07']},
  });
  assert.equal(decision.allowed, true, JSON.stringify(decision));
  assert.equal(decision.code, 'ALLOWED_WITH_QUALITY_WARNINGS');
});

test('editoryal bulgular teknik olarak sağlam videoyu durdurmaz', () => {
  for (const finding of [
    'SFX_INAUDIBLE',
    'CAPTION_TOO_SMALL',
    'FINAL_VIDEO/SIMILAR_SHOT:1',
    'SUBJECT_VERIFICATION_UNAVAILABLE',
    'RETENTION_BELOW_TARGET',
  ]) {
    const decision = resolveUploadPolicy({
      ...BASE,
      cliUpload: true,
      env: {},
      technicalGate: TECH_OK,
      publishGates: {passed: false, failures: [finding]},
    });
    assert.equal(decision.allowed, true, `${finding} yayını durdurdu`);
  }
});

test('teknik arıza yayını durdurur', () => {
  const decision = resolveUploadPolicy({
    ...BASE,
    cliUpload: true,
    env: {},
    technicalGate: {technicalPublishReady: false, blockers: ['DECODE_FAILED'], unverified: []},
    publishGates: {passed: true, failures: []},
  });
  assert.equal(decision.allowed, false);
  assert.equal(decision.code, 'TECHNICAL_GATE_FAILED');
});

test('üç alanlı sözleşme cron yayınını doğru anlatır', () => {
  const decision = decidePublish({
    technical: {...TECH_OK, checks: {finalVideoHashValid: true}},
    publishGates: {
      passed: false,
      failures: ['SEMANTIC_ACTION_INCOMPLETE'],
      advisory: [],
      review: [],
    },
    cronPublishingEnabled: true,
  });
  assert.equal(decision.technicalPublishReady, true);
  assert.equal(decision.editorialQualityPassed, false);
  assert.equal(decision.uploadAllowed, true);
});

test('workflow birden çok AI sağlayıcı anahtarı geçirir', () => {
  const providers = [
    'GEMINI_API_KEY',
    'GROQ_API_KEY',
    'OPENROUTER_API_KEY',
    'CEREBRAS_API_KEY',
    'MISTRAL_API_KEY',
    'CLOUDFLARE_API_TOKEN',
    'GITHUB_MODELS_TOKEN',
  ];
  const present = providers.filter((provider) => wf.includes(provider));
  assert.ok(present.length >= 4, `yalnızca ${present.length} metin sağlayıcısı bağlı`);
  for (const provider of ['TOGETHER_API_KEY', 'HUGGINGFACE_API_KEY']) {
    assert.ok(wf.includes(provider), `görsel yedeği eksik: ${provider}`);
  }
});

test('video üretilebildiyse artifact hata durumunda da korunur', () => {
  assert.match(wf, /upload-artifact/);
  assert.ok(/if:\s*always\(\)/.test(wf), 'artifact adımları if: always() kullanmıyor');
});
