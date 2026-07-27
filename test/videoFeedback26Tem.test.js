import test from 'node:test';
import assert from 'node:assert/strict';
import {scoreHookRetention} from '../src/script/generateScript.js';
import {assessVisualNarration} from '../src/pipeline/visualNarrationQC.js';

// 26 Tem geri bildiriminden renderer-bağımsız kalan gerçek ürün dersleri.

test('açıklayıcı başlık gerilimli hooka yenilir', () => {
  const title = scoreHookRetention('How blind termites build homes');
  const tension = scoreHookRetention('Blind builders. 13ft towers.');
  const question = scoreHookRetention('Why do we yawn?');
  assert.ok(tension > title + 20, `${tension} vs ${title}`);
  assert.ok(question > title, `${question} vs ${title}`);
});

test('gerçek soru ile açıklayıcı başlık aynı puanı almaz', () => {
  assert.ok(
    scoreHookRetention('How do they survive?') > scoreHookRetention('How they survive winter'),
  );
});

test('çelişki ve gerilim kelimeleri ödüllendirilir', () => {
  assert.ok(scoreHookRetention('Dead but still moving') > scoreHookRetention('A moving object'));
  assert.ok(scoreHookRetention('Built without hands') > scoreHookRetention('Built by workers'));
});

test('klişe açılışlar cezalıdır', () => {
  assert.ok(scoreHookRetention('Did you know termites build') < 40);
});

test('aynı görselin tekrar edilmesi görsel anlatım QC tarafından yakalanır', () => {
  const items = Array.from({length: 10}, () => ({
    visualHash: 'ffffffffffffffff',
    assetId: 'same-frame',
  }));
  const report = assessVisualNarration({
    items,
    beats: [],
    motionPlan: new Array(10).fill({}),
    duration: 39,
  });
  assert.equal(report.passed, false);
  assert.ok(report.failures.some((failure) => failure.startsWith('VISUAL_VARIETY_TOO_LOW')));
});

test('ROMAN modern Romanyaya bağlanmaz', async () => {
  const {resolvePlace} = await import('../src/visual/geo.js');
  const result = resolvePlace('ROMAN');
  assert.equal(result.country, null);
  assert.ok(result.lon > 6 && result.lon < 20, `Roma bölgesinde değil: ${result.lon}`);
  assert.equal(resolvePlace('ROMANIA').country, 'Romania');
});

test('tarihî ad için modern ülke dolgusu çizilmez', async () => {
  const {buildMapPaths} = await import('../src/visual/geo.js');
  for (const place of ['ROMAN', 'OTTOMAN', 'SPARTA', 'ROME']) {
    const map = buildMapPaths(place, {w: 640, h: 320});
    assert.ok(map, `${place} için harita üretilemedi`);
    assert.equal(map.target, null, `${place}: modern ülke yanlış vurgulandı`);
  }
  assert.ok(buildMapPaths('JAPAN', {w: 640, h: 320}).target);
});

test('gevşek önek eşleşmesi yoktur, demonim çalışır', async () => {
  const {resolvePlace} = await import('../src/visual/geo.js');
  assert.equal(resolvePlace('ZORTAVIA'), null);
  assert.equal(resolvePlace('AUSTRALIAN').country, 'Australia');
});
