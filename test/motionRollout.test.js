import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeRollout, rolloutMarkdown } from '../scripts/motion-rollout-report.js';

/** Uygulanmış CTA kaydı üretir. */
function applied(type, id, i, over = {}) {
  return {
    videoId: `vid-${i}`, videoDurationSec: 36, statusProxy: 'published', videoPath: `output/x-${i}/x.mp4`,
    motion: {
      enabled: true, ctaRequested: true, ctaApplied: true, ctaId: id, ctaType: type,
      startSec: 15 + (i % 5), durationSec: 2.2, position: 'lower_third_left',
      selectionReason: 'editorial-rule', safeAreaPassed: true, sfxId: 'pop', warnings: [], failures: [], ...over,
    },
  };
}
/** CTA uygulanmamış (skip) kaydı. */
function skipped(reason, i) {
  return {
    videoId: `vid-${i}`, videoDurationSec: 36, statusProxy: 'published', videoPath: null,
    motion: { enabled: true, ctaRequested: reason === 'probability-skip', ctaApplied: false,
      ctaId: null, ctaType: null, startSec: null, durationSec: null, position: null,
      selectionReason: reason, safeAreaPassed: false, sfxId: null, warnings: [], failures: [] },
  };
}

// 20 video: ~%35 CTA (7 uygulanmış, tipler karışık), 13 skip → PASS beklenir.
function healthySet() {
  const types = [['subscribe', 'neo_subscribe_minimal'], ['like', 'neo_like_pop'], ['bell', 'neo_bell_ring'],
    ['comment', 'neo_comment_slide'], ['follow', 'neo_follow_compact'], ['subscribe', 'neo_subscribe_pulse'], ['like', 'neo_like_pop']];
  const arr = types.map(([t, id], i) => applied(t, id, i));
  for (let i = 7; i < 20; i += 1) arr.push(skipped(i % 2 ? 'probability-skip' : 'editorial-skip', i));
  return arr;
}

test('PENDING: 20\'den az video', () => {
  const s = summarizeRollout([applied('like', 'neo_like_pop', 0)], 20);
  assert.equal(s.verdict, 'PENDING');
  assert.ok(s.flags.some((f) => f.includes('PENDING')));
});

test('PASS: sağlıklı 20 video seti tüm kriterleri karşılar', () => {
  const s = summarizeRollout(healthySet(), 20);
  assert.equal(s.verdict, 'PASS', `flags: ${s.flags}`);
  assert.equal(s.reviewedRealVideos, 20);
  assert.equal(s.ctaAppliedCount, 7);
  assert.equal(s.actualApplyRate, 0.35);
  assert.equal(s.maxCtaPerVideo, 1);
  assert.equal(s.manualReview.length, 3);
  assert.ok(s.manualReview[0].ctaTimestamp.includes('→'));
});

test('REVIEW: CTA oranı çok düşük (%5)', () => {
  const arr = [applied('like', 'neo_like_pop', 0)];
  for (let i = 1; i < 20; i += 1) arr.push(skipped('probability-skip', i));
  const s = summarizeRollout(arr, 20);
  assert.equal(s.verdict, 'REVIEW');
  assert.ok(s.flags.some((f) => f.includes('CTA oranı')));
});

test('REVIEW: aynı CTA tipi art arda 4 kez', () => {
  const arr = [];
  for (let i = 0; i < 8; i += 1) arr.push(applied('subscribe', 'neo_subscribe_minimal', i)); // 8 ardışık subscribe
  for (let i = 8; i < 20; i += 1) arr.push(skipped('editorial-skip', i));
  const s = summarizeRollout(arr, 20);
  // Oran %40 (PASS aralığında) ama art arda >3 ve tek tip aşırı yoğun → REVIEW.
  assert.equal(s.verdict, 'REVIEW');
  assert.ok(s.maxConsecutiveSameCta >= 4);
});

test('FAIL: motion kapalıyken CTA görülmüş (limit dolmasa bile)', () => {
  const arr = [applied('like', 'neo_like_pop', 0, { enabled: false })];
  const s = summarizeRollout(arr, 20);
  assert.equal(s.verdict, 'FAIL');
  assert.ok(s.flags.some((f) => f.includes('kapalı videoda CTA')));
});

test('FAIL: CTA timeline sınırını aşmış', () => {
  const arr = [applied('like', 'neo_like_pop', 0, { startSec: 35, durationSec: 3 })]; // 38 > 36
  const s = summarizeRollout(arr, 20);
  assert.equal(s.verdict, 'FAIL');
  assert.ok(s.flags.some((f) => f.includes('timeline')));
});

test('FAIL: uygulanmış ama safeAreaPassed=false', () => {
  const arr = [applied('like', 'neo_like_pop', 0, { safeAreaPassed: false })];
  const s = summarizeRollout(arr, 20);
  assert.equal(s.verdict, 'FAIL');
  assert.ok(s.flags.some((f) => f.includes('safeAreaPassed=false')));
});

test('FAIL: alan eksik/tutarsız', () => {
  const bad = { videoId: 'x', videoDurationSec: 36, statusProxy: 'published', motion: { ctaApplied: true, ctaType: 'like' } };
  const s = summarizeRollout([bad], 20);
  assert.equal(s.verdict, 'FAIL');
  assert.ok(s.flags.some((f) => f.includes('eksik')));
});

test('FAIL: motion kaynaklı ana render failure', () => {
  const arr = [{ ...applied('like', 'neo_like_pop', 0), statusProxy: 'failed' }];
  const s = summarizeRollout(arr, 20);
  assert.equal(s.verdict, 'FAIL');
});

test('markdown null-güvenli (boş set nulls yazmaz)', () => {
  const md = rolloutMarkdown({ ...summarizeRollout([], 20), generatedAt: 'x' });
  assert.ok(!md.includes('nulls'));
  assert.ok(md.includes('Ortalama CTA başlangıç: —'));
});

test('skip reason ve tip/şablon/konum dağılımı doğru sayılır', () => {
  const s = summarizeRollout(healthySet(), 20);
  assert.ok(s.skipReasonDistribution['probability-skip'] > 0);
  assert.ok(Object.keys(s.distributionByType).length >= 3);
  assert.equal(s.distributionByPosition['lower_third_left'], 7);
});
