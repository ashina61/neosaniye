import test from 'node:test';
import assert from 'node:assert/strict';
import {applyGradeDelta, chooseLook} from '../src/story/look.js';
import {buildReelSpec} from '../src/video/buildReelSpec.js';

const TOPICS = [
  'The Titanic disaster',
  'A quantum computer experiment',
  'The Poyais fraud',
  'A whale migration',
  'The Netflix and Blockbuster deal',
  'The great emu war',
  'The Chernobyl control room',
  'A bank heist in Beirut',
  'The mantis shrimp punch',
  'The Antikythera mechanism',
  'A volcano that stopped a war',
  'The forger who fooled Berlin',
];

const LINES = [
  'In 1912 a ship left port carrying a promise.',
  'They refused to listen and laughed at the warning.',
  'So they built the opposite. No drills. No lifeboats. Speed first.',
  'The hull opened and fifteen hundred people died in the water.',
  'Today the wreck earns millions a year in exhibitions.',
  'This was the most expensive no in history.',
];

const specFor = (topic) =>
  buildReelSpec({
    script: {topic, title: topic, scenes: LINES.map((narration) => ({narration}))},
    audio: {duration: 24},
    timeline: {
      source: 'edge-tts',
      duration: 24,
      words: [],
      scenes: LINES.map((narration, index) => ({scene: index, start: index * 4, end: index * 4 + 4, duration: 4, narration})),
    },
  });

test('aynı konu her koşuda aynı görünümü alır', () => {
  assert.deepEqual(chooseLook('The Poyais fraud'), chooseLook('The Poyais fraud'));
  assert.deepEqual(specFor('The Poyais fraud').engine.look, specFor('The Poyais fraud').engine.look);
});

test('görünüm konuya göre gerçekten değişir — renk, doku, hareket', () => {
  const looks = TOPICS.map((topic) => chooseLook(topic));

  const accents = new Set(looks.map((look) => look.palette.accent));
  const grades = new Set(looks.map((look) => JSON.stringify(look.grade)));
  const grains = new Set(looks.map((look) => look.film.grainOpacity));
  assert.ok(accents.size >= 6, `vurgu rengi çeşitliliği düşük: ${accents.size}`);
  assert.ok(grades.size >= 10, `grade çeşitliliği düşük: ${grades.size}`);
  assert.ok(grains.size >= 4, `grain çeşitliliği düşük: ${grains.size}`);

  // Prop çizimleri ve koreografi polaritesi de dağılmalı: tek bir değerde
  // toplanırsa her video aynı çerçeveyi, aynı jesti, aynı yönü kullanır.
  for (const key of ['frame', 'gesture', 'masthead']) {
    const values = new Set(looks.map((look) => look.props[key]));
    assert.ok(values.size >= 2, `${key} tek değerde toplandı: ${[...values]}`);
    assert.ok([...values].every(Boolean), `${key} tanımsız değer üretti: ${[...values]}`);
  }
  const polarities = new Set(looks.map((look) => look.motion.polarity));
  assert.equal(polarities.size, 2, 'koreografi polaritesi hep aynı yöne düştü');
});

test('seçilen değerler kendi bandının içinde kalır', () => {
  for (const topic of TOPICS) {
    const {film, motion, grade} = chooseLook(topic);
    assert.ok(film.grainOpacity >= 0.38 && film.grainOpacity <= 0.68, `grain bandı dışında: ${film.grainOpacity}`);
    assert.ok(film.scanlinePeriod >= 6 && film.scanlinePeriod <= 11, `scan bandı dışında: ${film.scanlinePeriod}`);
    assert.ok(film.vignetteStrength >= 0.38 && film.vignetteStrength <= 0.6);
    assert.ok(film.weavePx >= 3 && film.weavePx <= 7);
    assert.ok(motion.punchBias >= 1.45 && motion.punchBias <= 1.9);
    assert.ok(motion.portalScale >= 5.6 && motion.portalScale <= 7.6);
    for (const value of Object.values(grade)) {
      assert.ok(Number.isFinite(value) && value > 0, `grade değeri bozuk: ${value}`);
    }
  }
});

test('konunun anlamı tonu büker, ama seçenek listesi yoktur', () => {
  // Anlam rengi ÇEKER: ateş sıcak, uzay soğuk, su mavi-yeşil tarafta.
  assert.match(chooseLook('The reactor fire that burned for days').name, /ateş/);
  assert.match(chooseLook('A telescope in orbit around the moon').name, /uzay/);
  assert.match(chooseLook('The diver who found the wreck under the sea').name, /su/);
  // Sinyal yoksa renk yine de üretilir — "varsayılan görünüm" diye bir şey yok.
  assert.match(chooseLook('A story with no signal words at all').name, /serbest/);
});

test('renk seçilmiyor, üretiliyor: yüz konu yüze yakın ayrı dünya verir', () => {
  const topics = Array.from({length: 100}, (_, i) => `random topic number ${i}`);
  const looks = topics.map((topic) => chooseLook(topic));

  const accents = new Set(looks.map((look) => look.palette.accent));
  const inks = new Set(looks.map((look) => look.palette.ink));
  assert.ok(accents.size >= 90, `vurgu rengi tekrar ediyor: ${accents.size}/100`);
  assert.ok(inks.size >= 85, `mürekkep tekrar ediyor: ${inks.size}/100`);

  // Üretilen her renk okunabilirlik sınırları içinde kalmalı: mürekkep koyu,
  // kâğıt açık. Sınır estetik değil, tipografinin okunması meselesi.
  const luma = (hex) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  for (const look of looks) {
    assert.ok(luma(look.palette.ink) < 0.16, `mürekkep fazla açık: ${look.palette.ink}`);
    assert.ok(luma(look.palette.paperLight) > 0.7, `kâğıt fazla koyu: ${look.palette.paperLight}`);
    assert.ok(
      luma(look.palette.paperLight) - luma(look.palette.ink) > 0.6,
      `kontrast yetersiz: ${look.palette.ink} / ${look.palette.paperLight}`,
    );
  }
});

test('rig, videonun gradesini değiştirir; yerine geçmez', () => {
  const spec = specFor('The Titanic disaster');
  const base = spec.engine.grade;
  const fall = spec.beats.find((beat) => beat.rig === 'grounded-punch' || beat.rig === 'finale-clone');
  assert.ok(fall, 'düşüş beati yok');
  // Kasvetli beat videonun KENDİ gradesinden daha az doygun olmalı.
  assert.ok(fall.grade.saturate < base.saturate, 'düşüş beati doygunluk kaybetmedi');

  // Ve iki farklı videonun aynı rigi aynı kareyi vermemeli.
  const other = specFor('A whale migration');
  const otherFall = other.beats.find((beat) => beat.rig === fall.rig);
  assert.notDeepEqual(fall.grade, otherFall.grade, 'aynı rig iki videoda birebir aynı grade aldı');
});

test('görünüm videonun tamamında tektir, sahne başına değişmez', () => {
  const spec = specFor('The Poyais fraud');
  assert.ok(spec.engine.look.palette.accent);
  assert.equal(spec.look.seed, spec.engine.look.seed);
  // Beat gradeleri tek bir taban etrafında toplanmalı: her sahnenin kendi
  // renk dünyası olsaydı altı sahne altı ayrı videodan kesilmiş gibi dururdu.
  const ratios = spec.beats.map((beat) => beat.grade.saturate / spec.engine.grade.saturate);
  for (const ratio of ratios) assert.ok(ratio >= 0.6 && ratio <= 1.2, `sahne grade tabandan koptu: ${ratio}`);
});

test('grade deltası çarpar, sıfırlamaz', () => {
  const grade = {saturate: 0.8, contrast: 1.1, sepia: 0.2, brightness: 0.95};
  assert.deepEqual(applyGradeDelta(grade, {}), grade);
  assert.equal(applyGradeDelta(grade, {saturate: 0.5}).saturate, 0.4);
  assert.equal(applyGradeDelta(grade, {sepia: 0}).sepia, 0);
});
