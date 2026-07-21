import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateMeasuredDuration, evaluateNarrationLength, narrationWordCount } from '../src/pipeline/durationPolicy.js';

test('narration policy rejects the short scripts that create fragmentary Shorts', () => {
  const scenes = [{ narration: 'A tiny story ends before the viewer gets an answer.' }];
  assert.equal(narrationWordCount(scenes), 10);
  assert.deepEqual(evaluateNarrationLength(scenes), { ok: false, words: 10, code: 'NARRATION_TOO_SHORT', direction: 'expand' });
});

test('narration policy accepts a complete 105-word story budget', () => {
  const scenes = [{ narration: Array.from({ length: 105 }, (_, i) => `word${i + 1}`).join(' ') }];
  assert.equal(evaluateNarrationLength(scenes).ok, true);
});

test('measured TTS duration is independently bounded before render', () => {
  assert.equal(evaluateMeasuredDuration(15).code, 'AUDIO_TOO_SHORT');
  assert.equal(evaluateMeasuredDuration(42).ok, true);
  assert.equal(evaluateMeasuredDuration(59).code, 'AUDIO_TOO_LONG');
});
