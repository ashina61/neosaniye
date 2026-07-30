import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildBeats,
  splitSentences,
  splitLongSentence,
  classifyBeat,
  templateForBeat,
  templateVariety,
  secondsForWords,
  wordCount,
  MIN_WORDS_PER_BEAT,
  WORDS_PER_SECOND,
} from '../pipeline/beats.mjs';

/* ---------------- Fern beat matematiği ---------------- */

test('kelime/saniye OKUMA hızına ayarlı ve zamanlama ondan türüyor', () => {
  /**
   * PDF'in değeri 2.5 ve o değer SESLENDİRİLMİŞ anlatı için doğru: dinleyicinin
   * gözü serbesttir, görsele bakabilir. Bizim videoda seslendirme henüz yok,
   * yani aynı metni GÖZ okuyor — kullanıcının raporu "konu anlatımı hızlı
   * devam ediyor" idi.
   *
   * Bu test sabiti 2.5'e çivilemek yerine iki gerçek şeyi denetler:
   *   · değer okuma hızı aralığında (1.8-2.2)
   *   · süre hesabı sabitle TUTARLI — asıl regresyon riski burada
   *
   * Seslendirme eklendiğinde değer 2.5'e geri çıkacak ve aralık güncellenecek;
   * o zaman kısıt okuma değil konuşma hızı olur.
   */
  assert.ok(
    WORDS_PER_SECOND >= 1.8 && WORDS_PER_SECOND <= 2.2,
    `okuma hızı aralığının dışında: ${WORDS_PER_SECOND}`,
  );
  assert.equal(secondsForWords(WORDS_PER_SECOND * 30), 30);
  assert.equal(secondsForWords(WORDS_PER_SECOND * 60), 60);
  // 8 kelimelik bir başlık, okunacak kadar ekranda kalmalı: en az 3.5 saniye.
  assert.ok(secondsForWords(8) >= 3.5, `8 kelime çok kısa gösteriliyor: ${secondsForWords(8)} sn`);
});

/* ---------------- cümle bölme ---------------- */

test('kısaltmadaki nokta cümle bitirmez', () => {
  const s = splitSentences('He met Mr. Cooper in Seattle. Then he vanished.');
  assert.equal(s.length, 2);
  assert.match(s[0], /Mr\. Cooper/);
});

test('cümle sonu tırnakla geliyorsa da ayrılır', () => {
  const s = splitSentences('He said one thing. "The parachute is gone." Nobody believed him.');
  assert.equal(s.length, 3);
});

/* ---------------- beat bölme kuralları ---------------- */

test('kısa cümle bölünmez', () => {
  assert.deepEqual(splitLongSentence('He carried no compass.', 8), ['He carried no compass.']);
});

test('hiçbir beat asgari kelime sayısının altına düşmez', () => {
  // Bu cümledeki tek virgül 1. konumda; ilk sürüm "In 1976," diye iki
  // kelimelik bir beat üretiyordu.
  const parts = splitLongSentence("In 1976, a man named Mau Piailug stepped onto a canoe in Hawai'i.", 8);
  assert.ok(parts.length >= 2, 'uzun cümle bölünmeli');
  for (const p of parts) {
    assert.ok(
      wordCount(p) >= MIN_WORDS_PER_BEAT,
      `beat çok kısa (${wordCount(p)} kelime): ${JSON.stringify(p)}`,
    );
  }
});

test('beat sarkan işlev kelimesiyle bitmez', () => {
  // İlk sürüm "Only five navigators of" üretiyordu.
  const parts = splitLongSentence('Only five navigators of his tradition were still living.', 8);
  for (const p of parts) {
    assert.doesNotMatch(p.trim(), /\b(of|and|the|to|in|for|with|from|his|her|their)$/i, `sarkan kelime: ${p}`);
  }
});

test('yazıyla yazılmış sayı ortadan bölünmez', () => {
  // İlk sürüm "He had memorized two hundred" / "and twenty star positions" idi.
  const parts = splitLongSentence('He had memorized two hundred and twenty star positions as a boy.', 8);
  const joined = parts.join(' | ');
  assert.match(joined, /two hundred and twenty/, `sayı zinciri kırılmış: ${joined}`);
});

test('temiz bölme noktası yoksa cümle bütün kalır', () => {
  // 9 kelime, tavan 8: iki taraf da asgari 4 tutacak nokta yalnızca "of" ve
  // "his" sonrası; ikisi de sarkan. Doğru davranış bölmemek.
  const parts = splitLongSentence('Only five navigators of his tradition were still living.', 8);
  assert.equal(parts.length, 1);
});

/* ---------------- sınıflandırma ---------------- */

test('ilk beat her zaman cold_open', () => {
  assert.equal(classifyBeat('Anything at all here.', 0), 'cold_open');
});

test('yazıyla yazılmış sayı + sayılabilir birim ölçek sayılır', () => {
  // İlk sürüm \d arıyordu, bu yüzden hepsi jenerik fact'e düşüyordu.
  assert.equal(classifyBeat('Only five navigators were still living.', 3), 'scale');
  assert.equal(classifyBeat('One in ten survived the winter.', 3), 'scale');
});

test('mesafe ölçek değil büyüklüktür (ikon ızgarası çizilmemeli)', () => {
  // "dört bin kilometre" 4000 sayılabilir şey değil.
  assert.equal(classifyBeat('He crossed four thousand kilometres of open water.', 3), 'magnitude');
  assert.notEqual(templateForBeat('magnitude', []), 'grid_scale');
});

test('zaman atlaması ölçekten önce gelir', () => {
  // "Thirty-three days later" hem sayı+birim hem zaman deseni; zaman kazanmalı.
  assert.equal(classifyBeat('Thirty-three days later, the canoe reached Tahiti.', 5), 'time');
});

test('dönüş cümlesi kendi türünü alır', () => {
  assert.equal(classifyBeat('Here is the strange part.', 7), 'turn');
});

test('alıntı ve karşılaştırma ayırt edilir', () => {
  assert.equal(classifyBeat('"The parachute was never found."', 4), 'quote');
  assert.equal(classifyBeat('Instead of instruments, he used the stars.', 4), 'compare');
});

/* ---------------- şablon seçimi ---------------- */

test('şablon iki geriye bakarak seçilir (A,B,A salınımı olmaz)', () => {
  // Tek adım geriye bakmak A,B,A,B,A,B'yi engellemiyordu.
  const first = templateForBeat('fact', []);
  const second = templateForBeat('fact', [first]);
  const third = templateForBeat('fact', [second, first]);
  assert.notEqual(third, first);
  assert.notEqual(third, second);
});

test('soyut beat çöp adam alır, olgusal beat almaz', () => {
  // Referans videonun iki kayıt ayrımı: soyut → vektör figür, olgu → cutout.
  assert.equal(templateForBeat('abstract', []), 'stick_beat');
  assert.notEqual(templateForBeat('fact', []), 'stick_beat');
});

/* ---------------- uçtan uca ---------------- */

const NARRATION =
  "In 1976, a man named Mau Piailug stepped onto a double-hulled canoe in Hawai'i. " +
  'He carried no compass, no charts, and no radio. ' +
  "He sailed from Hawai'i to Tahiti across four thousand kilometres of open water. " +
  'Instead of instruments, he used the stars, the swell, and the flight of birds. ' +
  'He had memorized two hundred and twenty star positions as a boy. ' +
  'Only five navigators of his tradition were still living. ' +
  'Thirty-three days later, the canoe reached Tahiti. ' +
  'Here is the strange part. ' +
  'Nobody had made that crossing for six hundred years.';

test('uçtan uca: zaman çizgisi kümülatif ve boşluksuz', () => {
  const {beats, totalSeconds} = buildBeats(NARRATION);
  assert.ok(beats.length > 8);
  let t = 0;
  for (const b of beats) {
    assert.ok(Math.abs(b.start - t) < 0.02, `beat ${b.index} zaman kayması: ${b.start} ≠ ${t.toFixed(2)}`);
    t += b.seconds;
  }
  assert.ok(Math.abs(totalSeconds - t) < 0.05);
});

test('uçtan uca: son beat cliffhanger ve bölünmemiş', () => {
  const {beats} = buildBeats(NARRATION);
  const last = beats[beats.length - 1];
  assert.equal(last.kind, 'cliffhanger');
  // PDF: son satır tek parça iner, 12 kelimeden kısa.
  assert.equal(last.text, 'Nobody had made that crossing for six hundred years.');
  assert.ok(last.words <= 12);
});

test('uçtan uca: tek şablon sahnelerin üçte birinden fazlasını kaplamaz', () => {
  const {beats} = buildBeats(NARRATION);
  const v = templateVariety(beats);
  assert.ok(v.distinct >= 6, `çok az şablon çeşidi: ${v.distinct}`);
  assert.ok(v.topShare <= 0.34, `bir şablon fazla baskın: %${(v.topShare * 100).toFixed(0)}`);
  assert.equal(v.alternating, 0, 'A,B,A salınımı var');
});

test('uçtan uca: hiçbir beat asgari uzunluğun altında değil', () => {
  const {beats} = buildBeats(NARRATION);
  for (const b of beats) {
    assert.ok(b.words >= MIN_WORDS_PER_BEAT, `${b.index}: ${b.words} kelime — ${JSON.stringify(b.text)}`);
  }
});

test('deterministik: aynı anlatı iki kez aynı storyboard verir', () => {
  const a = JSON.stringify(buildBeats(NARRATION));
  const b = JSON.stringify(buildBeats(NARRATION));
  assert.equal(a, b);
});
