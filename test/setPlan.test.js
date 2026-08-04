import test from 'node:test';
import assert from 'node:assert/strict';
import {planSet, SET_GRAMMAR} from '../src/story/setPlan.js';

const plan = (line, topic = '', seed = 12345, index = 0) => planSet({line, topic, seed, index});

test('oda seçilmiyor, kuruluyor: yüz satır neredeyse yüz ayrı oda verir', () => {
  const plans = Array.from({length: 100}, (_, i) => plan(`A line about subject number ${i}`, '', 999, i));
  const signatures = new Set(
    plans.map((p) => `${p.structure}|${p.count}|${p.rhythm}|${p.ground}|${p.aperture}|${Math.round(p.horizon * 20)}`),
  );
  assert.ok(signatures.size >= 85, `oda çeşitliliği düşük: ${signatures.size}/100`);
});

test('anlam sadece anlam taşıyan parçayı sabitler, gerisini üretir', () => {
  const seas = Array.from({length: 12}, (_, i) => plan(`The diver went under the sea on day ${i}`, '', 4242, i));
  // Denizle ilgili her satır suyun üstünde geçer…
  for (const p of seas) assert.equal(p.ground, 'water', 'deniz satırı suda geçmiyor');
  // …ama iki deniz hikâyesi aynı denizi paylaşmaz.
  const lights = new Set(seas.map((p) => `${p.light.x}|${p.light.tone}|${p.haze}`));
  assert.ok(lights.size >= 8, `aynı deniz tekrar ediyor: ${lights.size}/12`);
});

test('üretilen her plan çizilebilir sınırlar içinde', () => {
  for (let i = 0; i < 200; i += 1) {
    const p = plan(`random line ${i}`, `topic ${i % 7}`, i * 13, i);
    assert.ok(SET_GRAMMAR.STRUCTURES.includes(p.structure), `bilinmeyen yapı: ${p.structure}`);
    assert.ok(SET_GRAMMAR.GROUNDS.includes(p.ground) || p.ground === 'limb', `bilinmeyen zemin: ${p.ground}`);
    assert.ok(SET_GRAMMAR.APERTURES.includes(p.aperture), `bilinmeyen açıklık: ${p.aperture}`);
    assert.ok(SET_GRAMMAR.RHYTHMS.includes(p.rhythm));
    assert.ok(p.horizon > 0.15 && p.horizon < 0.9, `ufuk kadraj dışında: ${p.horizon}`);
    assert.ok(p.count >= 0 && p.count <= 12);
    assert.ok(p.light.x >= 0 && p.light.x <= 1 && p.light.y >= 0 && p.light.y <= 1);
    assert.ok(['accent', 'cool', 'paperLight'].includes(p.light.tone));
    assert.ok(p.haze >= 0 && p.haze <= 0.4);
  }
});

test('aynı satır aynı odayı verir', () => {
  assert.deepEqual(plan('The vault door opened at midnight'), plan('The vault door opened at midnight'));
});
