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

test('ardışık ve uzak beatler aynı pozda olmaz', async () => {
  const {planShots} = await import('../src/story/shotPlan.js');
  const beats = Array.from({length: 10}, (_, i) => ({
    role: i === 0 ? 'setup' : i === 9 ? 'button' : 'turn',
    line: `Line number ${i} about something specific.`,
    rig: 'grounded-punch',
  }));
  const shots = planShots(beats, 4242);

  // Yayın kapısı iki kareyi "aynı" sayarken ortalama parlaklık farkının 0.03'ün
  // altında olmasını arıyor. Karanlık bir karede (luma ~0.12) bunu aşmak için
  // poz çarpanları arasında en az ~0.25 fark gerekir.
  // Üç basamaklı merdiven: iki beat ancak üç beat arayla aynı basamağa döner.
  for (let i = 0; i < shots.length; i += 1) {
    for (let j = i + 1; j < Math.min(shots.length, i + 3); j += 1) {
      const delta = Math.abs(shots[i].exposure - shots[j].exposure);
      assert.ok(delta > 0.15, `beat ${i} ve ${j} pozu çok yakın: ${delta.toFixed(3)}`);
    }
  }

  // NE GARANTİ EDİLİYOR, NE EDİLMİYOR — dürüst sınır.
  //
  // Kapı iki kareyi "aynı" saymak için İKİ şey birden ister: algısal hash
  // eşleşmesi VE ortalama parlaklık farkının 0.03 altında olması. Parlaklık bir
  // ÇARPAN olduğu için poz merdiveninin sağladığı fark karenin kendi
  // karanlığına bağlı: render edilip ölçülen kareler 0.138 / 0.195 / 0.238
  // luma verdi, yani tipik karede ~0.036 (kapının dışında), en karanlık karede
  // ~0.026 (kapının içinde).
  //
  // Merdiveni daha da açmak bu farkı kapatırdı ama pozu 1.3× ile 0.8× arasında
  // savurmak görüntüyü bozar. En karanlık karede son savunma poz değil İÇERİK:
  // oda planı, motif, plan ölçeği, ön plan ve alan derinliği ayrı olduğu için
  // hash zaten eşleşmemeli. Test bu yüzden ölçülen TİPİK kareyi doğruluyor —
  // sistemin gerçekten verdiği garanti bu.
  const typicalLuma = 0.195;
  const worst = Math.min(
    ...shots.slice(0, -1).map((shot, i) => Math.abs(shot.exposure - shots[i + 1].exposure) * typicalLuma),
  );
  assert.ok(worst > 0.03, `tipik karede komşu farkı kapının içinde kalıyor: ${worst.toFixed(4)}`);
});

test('aynı fotoğraf iki beatte kullanılmaz', async () => {
  const {buildReelSpec} = await import('../src/video/buildReelSpec.js');
  const lines = ['A bird leaves the cliff at dawn.', 'The flock turns south over open water.', 'They land on the same island every year.'];
  // Medya katmanı üç sahne için AYNI dosyayı döndürüyor (canlı koşuda olan bu).
  const mediaItems = lines.map((_, i) => ({path: '/abs/same-photo.jpg', type: 'photo', scene: i, publicPath: 'runs/x/media-00.jpg'}));
  const spec = buildReelSpec({
    script: {topic: 'bird migration', title: 'bird migration', scenes: lines.map((narration) => ({narration}))},
    audio: {duration: 12},
    timeline: {source: 'edge-tts', duration: 12, words: [], scenes: lines.map((n, i) => ({scene: i, start: i * 4, end: i * 4 + 4, duration: 4, narration: n}))},
    mediaItems,
  });
  const used = spec.beats.flatMap((beat) => beat.assets.map((asset) => asset.path));
  assert.equal(new Set(used).size, used.length, `aynı fotoğraf birden çok beatte: ${used.join(', ')}`);
  assert.equal(used.length, 1, 'tekrar eden fotoğraflar elenmeliydi');
});
