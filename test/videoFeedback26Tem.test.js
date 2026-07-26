import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreHookRetention } from '../src/script/generateScript.js';
import { assessVisualNarration } from '../src/pipeline/visualNarrationQC.js';
import { config } from '../src/config.js';

// 26 Tem geri bildirimi (termite videosu) — dört somut kusur.

// ---------------- 1) SFX: ANLAMA BAĞLI ----------------
// İlk düzeltmede sesler tamamen kapatılmıştı. Kullanıcı sonra "olsun ama
// yerine göre ve mantıklı" dedi → motor anlamlı hale getirildi ve geri açıldı.
test('geçiş sesleri AÇIK ama anlama bağlı; CTA pop KAPALI', () => {
  assert.equal(config.video.sfx, true, 'anlamlı sfx motoru devre dışı');
  assert.equal(config.motion.cta.sfx, false, 'CTA pop sesi anlamla ilişkilendirilemiyor, kapalı kalmalı');
  // Seyreklik: en fazla 4 ses, aralarında en az 5sn.
  assert.ok(config.video.maxSfxPerVideo <= 4, 'ses üst sınırı çok yüksek');
  assert.ok(config.video.minSfxGapSeconds >= 5, 'sesler çok sık olabilir');
});

test('anlamsız anlatım ses üretmez (kota doldurma yok)', async () => {
  const { planSemanticSfx } = await import('../src/audio/semanticSfx.js');
  const scenes = ['a quiet field here', 'a calm morning again', 'the grass looked green']
    .map((n) => ({ narration: n }));
  assert.deepEqual(planSemanticSfx(scenes, [4, 8]), [null, null]);
});

// ---------------- 2) ÇİFT SAYAÇ ÇAKIŞMASI ----------------
test('gfx kartı olan sahne semantik kompozisyon ALMAZ', () => {
  // Canlıda 0:18'de iki sayaç üst üste sayıyordu ("71/125", "160/250"):
  // sahnenin gfx sayı kartı VE semantik number kompozisyonu birlikte çizilmişti.
  const media = [{ gfx: false }, { gfx: true }, { gfx: false }];
  const beats = [
    { kind: 'number', index: 1, start: 5 },   // gfx sahnesi → elenmeli
    { kind: 'process', index: 2, start: 9 },
  ];
  const gfxScenes = new Set(media.map((m, i) => (m.gfx ? i : -1)).filter((i) => i >= 0));
  const kept = beats.filter((b) => !gfxScenes.has(b.index));
  assert.equal(kept.length, 1, 'gfx sahnesindeki kompozisyon elenmedi');
  assert.equal(kept[0].kind, 'process');
});

// ---------------- 3) LOOP KAPANIŞI ----------------
test('loop kapanışı varsayılan AÇIK', () => {
  assert.equal(config.video.loopClosure, true);
});

test('loopEcho kasıtlı tekrardır: benzersizlik sayımını düşürmez', () => {
  const items = Array.from({ length: 11 }, (_, i) => ({
    visualHash: ((BigInt(i) * 0x9E3779B97F4A7C15n) % (2n ** 64n)).toString(16),
    assetId: `s${i}`,
  }));
  // Son plan ilk görsele döner (döngü kapanışı).
  items[10] = { ...items[0], assetId: 's0#loop', loopEcho: true };
  const beats = [
    { kind: 'process', index: 0, start: 1 }, { kind: 'number', index: 2, start: 8 },
    { kind: 'compare', index: 4, start: 15 }, { kind: 'location', index: 6, start: 22 },
  ];
  const r = assessVisualNarration({ items, beats, motionPlan: new Array(11).fill({}), duration: 39 });
  assert.equal(r.metrics.loopEchoes, 1);
  assert.equal(r.metrics.duplicatePairs, 0, 'loop tekrarı kopya sayıldı');
  assert.equal(r.metrics.uniqueVisuals, 10, 'loop tekrarı benzersiz sayımını bozdu');
  assert.equal(r.passed, true, JSON.stringify(r.failures));
});

// ---------------- 4) HOOK GÜCÜ ----------------
test('açıklayıcı BAŞLIK, gerilimli hook\'a yenilir', () => {
  // Canlıda seçilen hook: "How blind termites build homes" — bu bir başlık,
  // konuyu duyuruyor ve merak boşluğu bırakmıyordu. Eski skorlama "how" ile
  // başladığı için ona soru bonusu (+14) veriyordu.
  const baslik = scoreHookRetention('How blind termites build homes');
  const gerilim = scoreHookRetention('Blind builders. 13ft towers.');
  const soru = scoreHookRetention('Why do we yawn?');
  assert.ok(gerilim > baslik + 20, `gerilimli hook yeterince öne geçmedi: ${gerilim} vs ${baslik}`);
  assert.ok(soru > baslik, `gerçek soru başlığa yenildi: ${soru} vs ${baslik}`);
});

test('gerçek soru ile açıklayıcı başlık AYNI puanı almaz', () => {
  const soru = scoreHookRetention('How do they survive?');
  const baslik = scoreHookRetention('How they survive winter');
  assert.ok(soru > baslik, `soru işareti ayırt edilmedi: ${soru} vs ${baslik}`);
});

test('çelişki/gerilim kelimeleri ödüllendirilir', () => {
  assert.ok(scoreHookRetention('Dead but still moving') > scoreHookRetention('A moving object'));
  assert.ok(scoreHookRetention('Built without hands') > scoreHookRetention('Built by workers'));
});

test('klişe açılışlar hâlâ cezalı', () => {
  assert.ok(scoreHookRetention('Did you know termites build') < 40);
});

// ---------------- 5) HARİTA: TARİHÎ AD ≠ MODERN ÜLKE ----------------
// Canlı hata: "The Roman Empire" → "ROMAN" → gevşek önek eşleşmesi
// ("ROMANIA".startsWith("ROMAN")) → haritada modern ROMANYA vurgulandı.
test('ROMAN artık Romanya\'ya bağlanmaz', async () => {
  const { resolvePlace } = await import('../src/visual/geo.js');
  const r = resolvePlace('ROMAN');
  assert.equal(r.country, null, 'tarihî ad modern bir ülkeye bağlandı');
  assert.ok(r.lon > 6 && r.lon < 20, `Roma bölgesinde değil: ${r.lon}`);
  // Romanya'nın kendisi hâlâ doğru çözülmeli.
  assert.equal(resolvePlace('ROMANIA').country, 'Romania');
});

test('tarihî ad için ülke DOLGUSU çizilmez', async () => {
  const { buildMapPaths } = await import('../src/visual/geo.js');
  for (const p of ['ROMAN', 'OTTOMAN', 'SPARTA', 'ROME']) {
    const m = buildMapPaths(p, { w: 640, h: 320 });
    assert.ok(m, `${p} için harita üretilmedi`);
    assert.equal(m.target, null, `${p}: modern ülke vurgulandı (yanlış iddia)`);
  }
  // Gerçek ülkede dolgu OLMALI.
  assert.ok(buildMapPaths('JAPAN', { w: 640, h: 320 }).target, 'Japonya vurgulanmadı');
});

test('gevşek önek eşleşmesi kalmadı; demonim hâlâ çalışır', async () => {
  const { resolvePlace } = await import('../src/visual/geo.js');
  assert.equal(resolvePlace('ZORTAVIA'), null);
  assert.equal(resolvePlace('AUSTRALIAN').country, 'Australia', 'demonim bozuldu');
});

// ---------------- 6) LOOP: KARE GERÇEKTEN EŞLEŞSİN ----------------
test('loop karesi hareketsizdir (ilk karenin zoom\'uyla eşleşir)', async () => {
  const { selectSceneMotion } = await import('../src/video/motionPlan.js');
  const m = selectSceneMotion({ narration: 'x' }, { type: 'photo', loopEcho: true }, { index: 9 });
  assert.equal(m.type, 'static-hold', 'loop karesine kamera hareketi verildi');
  assert.equal(m.maxZoom, 1, 'loop karesi zoom yapıyor — dikiş tutmaz');
});

test('ilk klip zoom 1\'den başlar (pull-out loop dikişini bozardı)', async () => {
  const { selectSceneMotion } = await import('../src/video/motionPlan.js');
  // renderVideo'da zoom'u YÜKSEKTEN başlatan tek hareket 'slow-pull-out'.
  const first = selectSceneMotion({ narration: 'a', motion_type: 'slow-pull-out' },
    { type: 'photo' }, { index: 0 });
  assert.notEqual(first.type, 'slow-pull-out', 'ilk klip yakın kadrajdan başlıyor');

  // detail-zoom zaten zoom 1'den başlayıp içeri girer → dokunulmamalı
  // (aksi hâlde motionPlan'ın içerik-güdümlü seçimi bozulurdu).
  const detail = selectSceneMotion({ narration: 'a', motion_type: 'detail-zoom' },
    { type: 'photo' }, { index: 0 });
  assert.equal(detail.type, 'detail-zoom', 'zararsız hareket gereksiz yere değiştirildi');

  // Sonraki klipler serbest kalmalı.
  const later = selectSceneMotion({ narration: 'a', motion_type: 'slow-pull-out' },
    { type: 'photo' }, { index: 4 });
  assert.equal(later.type, 'slow-pull-out');
});
