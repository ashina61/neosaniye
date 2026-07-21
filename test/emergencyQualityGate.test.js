import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateEmergencyQualityGate } from '../src/pipeline/emergencyQualityGate.js';

function validInput() {
  return {
    script: {
      hook_text: 'THE SKY TURNED GREEN',
      scenes: [{ narration: 'The storm changed the sky in seconds.' }],
    },
    wordTimings: [
      { word: 'The', start: 0.05, end: 0.2 },
      { word: 'storm', start: 0.21, end: 0.5 },
      { word: 'changed', start: 0.51, end: 0.8 },
    ],
    mediaItems: [{
      scene: 0, path: '/tmp/archive.jpg', source: 'archive', provider: 'wikimedia',
      assetId: 'commons:123', retrievedAt: '2026-07-21T00:00:00.000Z',
      license: 'CC BY-SA 4.0', licenseEvidence: 'https://commons.wikimedia.org/example',
    }],
    music: { source: 'repo-manifest', assetId: 'track', selectedAt: '2026-07-21T00:00:00.000Z', license: 'CC0-1.0', licenseEvidence: 'audio-manifest.json#track' },
    technical: { videoStreamPresent: true, audioStreamPresent: true, durationSeconds: 35 },
    timeline: { issues: [], items: [{ scene: 0, start: 0, end: 35, duration: 35 }] },
    renderPlan: { captionsIncluded: true, captionEventCount: 3 },
    duration: 35,
    musicRequired: true,
  };
}

test('complete existing evidence passes the emergency gate', () => {
  assert.deepEqual(evaluateEmergencyQualityGate(validInput()), { ok: true, block: false, failures: [], reasons: [] });
});

test('missing/effectively empty captions block publication', () => {
  const input = validInput();
  input.wordTimings = [{ word: 'Hi', start: 0, end: 0.1 }];
  const result = evaluateEmergencyQualityGate(input);
  assert.ok(result.failures.includes('CAPTIONS_MISSING_OR_EMPTY'));
});

test('opening package requires hook, narration, first visual, and speech timing data', () => {
  const input = validInput();
  input.script.hook_text = '';
  const result = evaluateEmergencyQualityGate(input);
  assert.ok(result.failures.includes('OPENING_ALIGNMENT_DATA_MISSING'));
});

test('missing streams and out-of-range duration block publication', () => {
  const input = validInput();
  input.technical = { videoStreamPresent: false, audioStreamPresent: false, durationSeconds: 8 };
  input.duration = 8;
  const result = evaluateEmergencyQualityGate(input);
  assert.ok(result.failures.includes('VIDEO_STREAM_MISSING'));
  assert.ok(result.failures.includes('AUDIO_STREAM_MISSING'));
  assert.ok(result.failures.includes('SHORTS_DURATION_OUT_OF_RANGE'));
});

test('null or absent asset license evidence blocks without pretending to inspect pixels', () => {
  const input = validInput();
  input.mediaItems[0] = { scene: 0, path: '/tmp/ai.jpg', source: 'ai', provider: 'gemini', license: null };
  const result = evaluateEmergencyQualityGate(input);
  assert.ok(result.failures.includes('ASSET_RIGHTS_EVIDENCE_MISSING:0'));
});

test('explicit P0 contradiction and duplicate script block publication', () => {
  const input = validInput();
  input.script.duplicate = true;
  input.script.production_failures = [{ severity: 'P0', code: 'WRONG_PLACE', reason: 'Archive subject contradicts narration' }];
  const result = evaluateEmergencyQualityGate(input);
  assert.ok(result.failures.includes('DUPLICATE_SCRIPT'));
  assert.ok(result.failures.includes('P0_CONTRADICTION'));
  assert.ok(result.reasons.some((x) => x.includes('Archive subject contradicts narration')));
});

test('invalid canonical timeline or absent caption render plan blocks publication', () => {
  const input = validInput();
  input.timeline.issues = ['TIMELINE_FINAL_SCENE_INCOMPLETE'];
  input.renderPlan.captionsIncluded = false;
  const result = evaluateEmergencyQualityGate(input);
  assert.ok(result.failures.includes('CANONICAL_TIMELINE_INVALID'));
  assert.ok(result.failures.includes('CAPTIONS_NOT_IN_RENDER_PLAN'));
});
