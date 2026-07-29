import test from 'node:test';
import assert from 'node:assert/strict';
import {jsonObject} from './json-object.mjs';
import {generateStoryJson} from './provider-chain.mjs';

test('üretim sağlayıcı zinciri bağımlılıklarıyla birlikte yüklenir', () => {
  assert.equal(typeof generateStoryJson, 'function');
});

// Bu, sahadaki gerçek regresyon: `indexOf('{}')` (BOŞ nesne) aranıyordu, bu
// yüzden kusursuz JSON döndüren yedi sağlayıcının HEPSİ "Provider did not
// return JSON" ile düştü ve hiçbir video üretilmedi.
test('düz JSON nesnesini ayrıştırır', () => {
  const real = '{\n  "title": "The First Traffic Bomb",\n  "scenes": [{"voiceover": "x"}]\n}';
  assert.equal(jsonObject(real).title, 'The First Traffic Bomb');
});

test('```json çitlerini soyar', () => {
  assert.equal(jsonObject('```json\n{"title":"A","scenes":[]}\n```').title, 'A');
});

test('JSON öncesi ve sonrası düzyazıyı yok sayar', () => {
  assert.equal(jsonObject('Here is your JSON:\n{"title":"B"}').title, 'B');
  assert.equal(jsonObject('{"title":"C"}\n\nHope this helps!').title, 'C');
});

test('string içindeki süslü parantezler ayrıştırmayı bozmaz', () => {
  const tricky = '{"title":"D {tuzak}","meta":{"a":{"b":1}},"note":"kapanış } var"} SON';
  const parsed = jsonObject(tricky);
  assert.equal(parsed.title, 'D {tuzak}');
  assert.equal(parsed.meta.a.b, 1);
});

test('kesik yanıtı (finish_reason: length) ayırt eder', () => {
  assert.throws(
    () => jsonObject('{"title":"E","scenes":[{"voiceover":"kes'),
    /truncated JSON/,
  );
});

test('JSON içermeyen yanıtta net hata verir', () => {
  assert.throws(() => jsonObject('I cannot help with that.'), /no JSON object/);
});
