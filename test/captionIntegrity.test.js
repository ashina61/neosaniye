/**
 * ALTYAZI BÜTÜNLÜĞÜ REGRESYONU — 26 Tem "kaybolan fiil".
 *
 * Canlı belirti (0:04-0:05, kare kare doğrulandı):
 *     "These creatures can"  →  [EJECT]  →  "their internal organs"
 * Fiil cümleden koparılıp 0.2 saniyelik tek başına, bambaşka fontta bir
 * parlamaya çevrilmişti. İzleyici için bu "kelime kayboldu" demektir.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  groupCaptionWords, repairPhraseBoundaries, canEndBlock, choosePhraseSplit,
} from '../src/video/captionLayout.js';
import { validateCaptionIntegrity, tokenize } from '../src/video/captionIntegrity.js';

const mk = (sentence, step = 0.36) => {
  let t = 0;
  return sentence.split(' ').map((w) => {
    const o = { word: w, start: +t.toFixed(2), end: +(t + step * 0.9).toFixed(2) };
    t += step;
    return o;
  });
};
const asEvents = (groups) => groups.map((g) => ({ words: g, text: g.map((w) => w.word).join(' ') }));

// ---------------- FİİL KOPARILMAZ ----------------
test('vurgulu fiil cümleden KOPARILMAZ (canlı regresyon)', () => {
  const s = 'These creatures can eject their internal organs to escape predators';
  const groups = groupCaptionWords(mk(s), { perLine: 4, isEmph: (w) => /eject/i.test(w) });
  const texts = groups.map((g) => g.map((w) => w.word).join(' '));
  assert.ok(!texts.includes('eject'), `fiil hâlâ tek başına: ${JSON.stringify(texts)}`);
  const withVerb = texts.find((t) => t.includes('eject'));
  assert.ok(/can eject/.test(withVerb), `fiil öznesinden ayrı: ${withVerb}`);
});

test('vurgu, gruplamayı HİÇ etkilemez', () => {
  const words = mk('the ant carries fifty times its own weight');
  const a = groupCaptionWords(words, { perLine: 4, isEmph: () => false });
  const b = groupCaptionWords(words, { perLine: 4, isEmph: () => true });
  assert.deepEqual(a.map((g) => g.length), b.map((g) => g.length));
});

// ---------------- YAPIŞKAN KUYRUK ----------------
test('yardımcı fiil/edat blok sonunda YALNIZ bırakılmaz', () => {
  for (const w of ['can', 'to', 'their', 'and', 'the', 'into']) {
    assert.equal(canEndBlock({ word: w }), false, `${w} blok kapatabiliyor`);
  }
  for (const w of ['organs', 'predators', 'first.', 'weight']) {
    assert.equal(canEndBlock({ word: w }), true, `${w} blok kapatamıyor`);
  }
});

test('onarım yapışkan kuyruğu sonraki bloğa taşır, kelime SAYISI değişmez', () => {
  const g = [mk('these creatures can'), mk('eject their organs')];
  const before = g.flat().length;
  const out = repairPhraseBoundaries(g);
  assert.equal(out.flat().length, before, 'kelime kaybı/çoğalması');
  assert.equal(out[0].map((w) => w.word).join(' '), 'these creatures');
  assert.equal(out[1].map((w) => w.word).join(' '), 'can eject their organs');
});

test('bölme noktası ifadeyi ortadan kesmez', () => {
  const g = mk('cool air is pulled back inside');
  const at = choosePhraseSplit(g);
  assert.ok(canEndBlock(g[at - 1]), `bölme "${g[at - 1].word}" üzerinde yapıldı`);
});

// ---------------- TOKEN KAPSAMASI ----------------
test('TTS metnindeki hiçbir kelime kaybolmaz', () => {
  const s = 'Sea cucumbers can regrow lost body parts within weeks';
  const ev = asEvents(groupCaptionWords(mk(s), { perLine: 4 }));
  const r = validateCaptionIntegrity({ events: ev, ttsText: s });
  assert.equal(r.tokenCoverage, 1, JSON.stringify(r.missingTokens));
  assert.deepEqual(r.missingTokens, []);
  assert.deepEqual(r.duplicateTokens, []);
});

test('kelime düşerse kapsama 1 OLMAZ (doğrulayıcı gerçekten ölçüyor)', () => {
  const s = 'these creatures can eject their organs';
  const words = mk(s).filter((w) => w.word !== 'eject'); // kasten düşür
  const ev = asEvents(groupCaptionWords(words, { perLine: 4 }));
  const r = validateCaptionIntegrity({ events: ev, ttsText: s });
  assert.ok(r.tokenCoverage < 1);
  assert.deepEqual(r.missingTokens, ['eject']);
});

test('noktalama ve kesme işareti farkı kelime kaybı sayılmaz', () => {
  const ev = asEvents([mk("it's here, now.")]);
  const r = validateCaptionIntegrity({ events: ev, ttsText: "It's here now" });
  assert.equal(r.tokenCoverage, 1);
});

// ---------------- DİLBİLGİSİ RİSKİ ----------------
test('yalnız kalan kelime ve sarkan kuyruk RAPORLANIR', () => {
  const r = validateCaptionIntegrity({
    events: [
      { words: mk('these creatures can') },   // yapışkan kuyruk
      { words: [{ word: 'eject', start: 1.2, end: 1.4 }] }, // tek kelime
      { words: mk('their organs') },
    ],
    ttsText: 'these creatures can eject their organs',
  });
  assert.ok(r.grammarRiskBlocks.some((b) => b.startsWith('DANGLING_TAIL')), JSON.stringify(r));
  assert.ok(r.grammarRiskBlocks.some((b) => b.startsWith('SOLO_WORD')), JSON.stringify(r));
});

test('tekrar eden altyazı başlangıcı yakalanır', () => {
  const r = validateCaptionIntegrity({
    events: [{ words: mk('what sea cucumbers') }, { words: mk('what sea cucumbers') }],
    ttsText: 'what sea cucumbers what sea cucumbers',
  });
  assert.ok(r.duplicateCaptionStarts.length > 0);
});

test('zaman çakışması sayılır ama TOKEN SİLİNMEZ', () => {
  const r = validateCaptionIntegrity({
    events: [
      { words: [{ word: 'one', start: 0, end: 1.0 }] },
      { words: [{ word: 'two', start: 0.5, end: 1.5 }] },
    ],
    ttsText: 'one two',
  });
  assert.equal(r.timelineOverlapCount, 1);
  assert.equal(r.tokenCoverage, 1, 'çakışmada token silinmiş');
});

test('tokenize boş girdide çökmez', () => {
  assert.deepEqual(tokenize(''), []);
  assert.deepEqual(tokenize(null), []);
});
