import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {decidePublish} from '../src/pipeline/technicalPublishGate.js';

const wf = readFileSync('.github/workflows/daily-short.yml', 'utf8');

const TECH_OK = {
  technicalPublishReady: true,
  blockers: [],
  unverified: [],
  checks: {
    videoReadable: true,
    durationValid: true,
    dimensionsValid: true,
    audioPresent: true,
    finalVideoHashValid: true,
  },
};

test('teknik kapı sağlam çıktıyı yayınlanabilir sayar', () => {
  const decision = decidePublish({technical: TECH_OK, publishGates: {passed: true, failures: [], advisory: [], review: []}, cronPublishingEnabled: true});
  assert.equal(decision.technicalPublishReady, true);
  assert.equal(decision.uploadAllowed, true);
});

test('editoryal bulgular teknik olarak sağlam videoyu durdurmaz', () => {
  const decision = decidePublish({technical: TECH_OK, publishGates: {passed: false, failures: ['EDITORIAL_WARNING'], advisory: [], review: []}, cronPublishingEnabled: true});
  assert.equal(decision.technicalPublishReady, true);
  assert.equal(decision.uploadAllowed, true);
});

test('teknik arıza yayını durdurur', () => {
  const decision = decidePublish({technical: {...TECH_OK, technicalPublishReady: false, blockers: ['VIDEO_STREAM_MISSING']}, publishGates: {passed: true, failures: [], advisory: [], review: []}, cronPublishingEnabled: true});
  assert.equal(decision.allowed ?? decision.uploadAllowed, false);
});

test('üç alanlı sözleşme cron yayınını doğru anlatır', () => {
  const decision = decidePublish({
    technical: {...TECH_OK, checks: {finalVideoHashValid: true}},
    publishGates: {passed: false, failures: ['SEMANTIC_ACTION_INCOMPLETE'], advisory: [], review: []},
    cronPublishingEnabled: true,
  });
  assert.equal(decision.technicalPublishReady, true);
  assert.equal(decision.editorialQualityPassed, false);
  assert.equal(decision.uploadAllowed, true);
});

test('workflow metin/TTS sağlayıcılarını korur ama görsel sağlayıcılarını taşımaz', () => {
  const textProviders = [
    'GEMINI_API_KEY', 'GROQ_API_KEY', 'OPENROUTER_API_KEY', 'CEREBRAS_API_KEY',
    'MISTRAL_API_KEY', 'CLOUDFLARE_API_TOKEN', 'GITHUB_MODELS_TOKEN',
  ];
  const present = textProviders.filter((provider) => wf.includes(provider));
  assert.ok(present.length >= 4, `yalnızca ${present.length} metin sağlayıcısı bağlı`);
  for (const legacyVisualProvider of ['TOGETHER_API_KEY', 'HUGGINGFACE_API_KEY', 'PEXELS_API_KEY', 'PIXABAY_API_KEY', 'FREESOUND_API_KEY']) {
    assert.ok(!wf.includes(legacyVisualProvider), `eski görsel/ambiyans sağlayıcısı hâlâ bağlı: ${legacyVisualProvider}`);
  }
  assert.match(wf, /VISUAL_POLICY:\s*procedural-only/);
  assert.match(wf, /CAPTION_POLICY:\s*none/);
});

test('video üretilebildiyse artifact hata durumunda da korunur', () => {
  assert.match(wf, /upload-artifact/);
  assert.ok(/if:\s*always\(\)/.test(wf), 'artifact adımları if: always() kullanmıyor');
});
