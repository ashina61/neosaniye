import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateMeasuredDuration,
  evaluateNarrationLength,
  narrationWordCount,
  rateToFactor,
} from '../src/pipeline/durationPolicy.js';

test('narration policy rejects the short scripts that create fragmentary Shorts', () => {
  const scenes = [{ narration: 'A tiny story ends before the viewer gets an answer.' }];
  assert.equal(narrationWordCount(scenes), 10);
  const verdict = evaluateNarrationLength(scenes);
  assert.equal(verdict.ok, false);
  assert.equal(verdict.words, 10);
  assert.equal(verdict.code, 'NARRATION_TOO_SHORT');
  assert.equal(verdict.direction, 'expand');
});

test('kelime penceresi konuşma hızıyla birlikte kayar', () => {
  // Canlı hata: 130 kelime normal hızda geçiyordu, ama açıklayıcı konular
  // anlaşılırlık için -7% ile okunuyor ve ölçülen ses 61.0s çıkıp üretimi
  // düşürüyordu. Pencere artık okunacak GERÇEK hıza göre daralıyor.
  const scenes = [{ narration: Array.from({length: 130}, (_, i) => `word${i + 1}`).join(' ') }];
  assert.equal(evaluateNarrationLength(scenes).ok, true, '130 kelime normal hızda kabul edilmeli');

  const slow = evaluateNarrationLength(scenes, {rateFactor: rateToFactor('-7%')});
  assert.equal(slow.ok, false, 'yavaş okunan 130 kelime kabul edilmemeli');
  assert.equal(slow.code, 'NARRATION_TOO_LONG');
  assert.equal(slow.maxWords, 126);

  // Hızlı okunan bir konu ise daha fazla kelime taşıyabilir.
  const fast = evaluateNarrationLength(scenes, {rateFactor: rateToFactor('+18%')});
  assert.equal(fast.ok, true);
  assert.ok(fast.maxWords > 135);
});

test('hız yüzdesi çarpana çevrilir', () => {
  assert.equal(rateToFactor('+18%'), 1.18);
  assert.equal(Math.round(rateToFactor('-7%') * 100) / 100, 0.93);
  assert.equal(rateToFactor(undefined), 1);
  assert.equal(rateToFactor('bozuk'), 1);
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
