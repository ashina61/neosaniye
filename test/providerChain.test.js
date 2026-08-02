import test from 'node:test';
import assert from 'node:assert/strict';
import { repairTruncatedJson } from '../src/script/generateScript.js';

// ---------------- KESİK JSON ONARIMI ----------------
// 25 Tem 23:31 koşusu: OpenRouter iki kez kesik JSON döndürdü
// ("Unterminated string in JSON at position 55") ve TÜM run çöpe gitti.
test('tam ve çitli JSON olduğu gibi okunur', () => {
  assert.deepEqual(repairTruncatedJson('{"topic":"x","n":1}'), { topic: 'x', n: 1 });
  assert.deepEqual(repairTruncatedJson('```json\n{"topic":"x"}\n```'), { topic: 'x' });
});

test('string ortasında kesilen yanıt kurtarılır', () => {
  const r = repairTruncatedJson('{"topic":"Coral reefs","title":"The secret lang');
  assert.equal(r.topic, 'Coral reefs');
});

test('sahne dizisi ortasında kesilen yanıt TAM sahnelere kadar kurtarılır', () => {
  // En sık gerçek vaka: model token bütçesinde sahnelerin ortasında kesiyor.
  const r = repairTruncatedJson(
    '{"topic":"x","scenes":[{"narration":"a"},{"narration":"b"},{"narr',
  );
  assert.equal(r.scenes.length, 2, 'yarım sahne atılmalıydı');
  assert.equal(r.scenes[1].narration, 'b');
});

test('asılı virgül temizlenir', () => {
  const r = repairTruncatedJson('{"topic":"x","scenes":[{"a":1},');
  assert.equal(r.scenes.length, 1);
});

test('kurtarılamayan yanıt için UYDURMA yapılmaz (null döner)', () => {
  assert.equal(repairTruncatedJson('not json at all'), null);
  assert.equal(repairTruncatedJson(''), null);
  assert.equal(repairTruncatedJson(null), null);
  // Yarım kalan tek bir değer: kurtarılacak tam yapı yok.
  assert.equal(repairTruncatedJson('{"topic'), null);
});

test('onarılan JSON gerçekten geçerli bir nesnedir', () => {
  const r = repairTruncatedJson('{"a":{"b":[1,2,{"c":"tru');
  assert.ok(r === null || typeof r === 'object', 'nesne değilse null olmalı');
  if (r) JSON.parse(JSON.stringify(r)); // tur atabilmeli
});

// ---------------- SAĞLAYICI ZİNCİRİ ----------------
test('config: ek ücretsiz sağlayıcılar tanımlı ve anahtarsızken pasif', async () => {
  const { config } = await import('../src/config.js');
  for (const key of ['cerebras', 'githubModels', 'mistral', 'cloudflareAi']) {
    assert.ok(config[key], `${key} config'te yok`);
    assert.ok(config[key].model, `${key} için model tanımı yok`);
  }
  // Anahtar yoksa sağlayıcı zincire GİRMEMELİ (sessiz atlama).
  assert.equal(typeof config.cerebras.apiKey, 'undefined');
});
