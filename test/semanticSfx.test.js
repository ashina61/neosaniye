import test from 'node:test';
import assert from 'node:assert/strict';
import { sfxForNarration, planSemanticSfx, describeSfxPlan } from '../src/audio/semanticSfx.js';

const scenes = (arr) => arr.map((n) => ({ narration: n }));

test('anlam taşımayan cümle SES ALMAZ', () => {
  assert.equal(sfxForNarration('It was an ordinary afternoon here'), null);
  assert.equal(sfxForNarration('Beautiful'), null); // 3 kelimeden kısa
});

test('her anlam doğru sese eşlenir', () => {
  assert.equal(sfxForNarration('But the whole tower collapsed overnight'), 'impact');
  assert.equal(sfxForNarration('Scientists discovered a glowing chamber inside'), 'shimmer');
  assert.equal(sfxForNarration('Pressure slowly began building under the surface'), 'riser');
  assert.equal(sfxForNarration('The signal travels across the entire colony'), 'whoosh');
  assert.equal(sfxForNarration('Each tunnel measures exactly 4 millimetres wide'), 'click');
});

test('KOTA DOLDURMA YOK: hiçbir sahne hak etmiyorsa plan tamamen sessiz', () => {
  // Eski normalizeSfxPlan burada 3 ses uydururdu (%24/%54/%82 konumlarına).
  const s = scenes(['a quiet field', 'a calm morning here', 'the grass was green',
    'an ordinary looking hill', 'nothing seemed unusual then']);
  const plan = planSemanticSfx(s, [4, 8, 12, 16]);
  assert.deepEqual(plan, [null, null, null, null], 'anlamsız yere ses basıldı');
  assert.equal(describeSfxPlan(plan).count, 0);
});

test('ses, sınırda BAŞLAYAN sahneden türetilir', () => {
  const s = scenes(['calm opening line here', 'But everything suddenly collapsed inward']);
  const plan = planSemanticSfx(s, [5]);
  assert.equal(plan[0], 'impact', 'gelen sahnenin anlamı kullanılmadı');
});

test('üst sınır ve minimum aralık uygulanır', () => {
  const s = scenes(['x', ...Array.from({ length: 8 }, () => 'But it suddenly collapsed again')]);
  const times = [1, 2, 3, 4, 5, 6, 7, 8]; // hepsi çok yakın
  const plan = planSemanticSfx(s, times, { maxCues: 4, minGapSeconds: 5 });
  const used = plan.map((t, i) => (t ? times[i] : null)).filter((x) => x !== null);
  assert.ok(used.length <= 4, `üst sınır aşıldı: ${used.length}`);
  for (let i = 1; i < used.length; i += 1) {
    assert.ok(Math.abs(used[i] - used[i - 1]) >= 5, `sesler çok yakın: ${used.join(',')}`);
  }
});

test('editör "none" dediği sınıra ses BASILMAZ', () => {
  const s = scenes(['calm line one here', 'But it suddenly collapsed inward']);
  const plan = planSemanticSfx(s, [5], { editorPlan: ['none'] });
  assert.equal(plan[0], null, 'editörün sessiz kesme isteği ezildi');
});

test('geçersiz zaman damgası ses üretmez', () => {
  const s = scenes(['x', 'But it suddenly collapsed inward']);
  assert.deepEqual(planSemanticSfx(s, [null]), [null]);
  assert.deepEqual(planSemanticSfx([], []), []);
});
