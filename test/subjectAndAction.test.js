/**
 * ÖZNE KİMLİĞİ + SEMANTİK EYLEM — 26 Tem "sea cucumbers" regresyonu.
 *
 * Canlıda görülen: aynı videoda tırtıl, kırkayak, zırhlı solucan ve fantastik
 * bir yaratık; statik hayvan fotoğrafının üstüne "ORGANS → ESCAPE" etiketi;
 * "5 incredible facts" vaadi ama ortada beş madde yok; CTA final açıklamayı
 * kesiyor.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSubjectBible, subjectPromptPrefix, negativePromptFor, applySubjectBible,
  bibleSearchTerms,
} from '../src/crew/subjectBible.js';
import {
  scoreSemanticAction, assessSemanticActions, assessListStructure, declaredListCount,
  assessCta, detectRepetition,
} from '../src/pipeline/storyAudit.js';

// ---------------- SUBJECT BIBLE ----------------
test('deniz hıyarı için yanlış anatomi terimleri yasaklanır', () => {
  const b = buildSubjectBible({ topic: 'Sea Cucumbers', visual_anchor: 'sea cucumber' });
  assert.equal(b.phylum, 'echinoderm');
  const neg = negativePromptFor(b);
  for (const term of ['caterpillar anatomy', 'centipede legs', 'armored exoskeleton',
    'segmented insect body', 'shell', 'horns', 'fantasy creature']) {
    assert.ok(neg.includes(term), `yasak listede yok: ${term}`);
  }
});

test('pozitif prompt bilimsel tanımı taşır', () => {
  const b = buildSubjectBible({
    topic: 'Sea Cucumbers',
    subject_bible: {
      canonical_name: 'sea cucumber',
      scientific_category: 'marine echinoderm',
      required_traits: ['elongated soft cylindrical body', 'leathery skin', 'tube feet'],
    },
  });
  const p = subjectPromptPrefix(b);
  assert.match(p, /Scientifically accurate sea cucumber/);
  assert.match(p, /marine echinoderm/);
  assert.match(p, /tube feet/);
  assert.match(p, /anatomically plausible/);
});

test('kimlik BÜTÜN sahne promptlarına eklenir ve idempotenttir', () => {
  const script = {
    topic: 'Sea Cucumbers', visual_anchor: 'sea cucumber',
    scenes: [{ image_prompt: 'a reef' }, { image_prompt: 'the deep floor' }, { image_prompt: 'close up' }],
  };
  const { applied } = applySubjectBible(script);
  assert.equal(applied, 3);
  for (const s of script.scenes) {
    assert.match(s.image_prompt, /Scientifically accurate sea cucumber/);
    assert.ok(s.negative_prompt.includes('caterpillar anatomy'));
  }
  // İkinci çağrı prompt'u ikiye katlamaz.
  const again = applySubjectBible(script);
  assert.equal(again.applied, 0);
  assert.equal((script.scenes[0].image_prompt.match(/Scientifically accurate/g) || []).length, 1);
});

test('stok arama sorgusu kimliği taşır', () => {
  const b = buildSubjectBible({ topic: 'Sea Cucumbers', visual_anchor: 'sea cucumber' });
  assert.ok(bibleSearchTerms(b).includes('sea cucumber'));
});

test('kimlik türetilmişse QC bunu bilir (yanlış güven yok)', () => {
  assert.equal(buildSubjectBible({ topic: 'x' }).verifiedSource, 'derived');
  assert.equal(buildSubjectBible({ subject_bible: { canonical_name: 'ant' } }).verifiedSource, 'model');
});

// ---------------- NEGATİF PROMPT GERÇEKTEN GİDİYOR MU ----------------
test('negatif prompt SAĞLAYICI İSTEĞİNE gider (loglanmakla kalmaz)', async () => {
  const seen = [];
  const origFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    seen.push({ url: String(url), body: init?.body ? String(init.body) : '' });
    return {
      ok: true,
      arrayBuffer: async () => new Uint8Array(5000).buffer,
      json: async () => ({ data: [{ b64_json: Buffer.alloc(5000).toString('base64') }] }),
    };
  };
  try {
    const { generateAiImage, resetImageProviders } = await import('../src/media/generateImages.js');
    resetImageProviders();
    const dest = `${process.env.TMPDIR || '/tmp'}/neg-test.jpg`;
    await generateAiImage('a sea cucumber', dest, {
      width: 1080, height: 1920, seed: 1, negative: 'caterpillar, centipede',
    }).catch(() => {});
    assert.ok(seen.length, 'hiç istek yapılmadı');
    const req = seen[0];
    const carriesNegative = /caterpillar/.test(decodeURIComponent(req.url))
      || /caterpillar/.test(req.body);
    assert.ok(carriesNegative, `negatif prompt istekte yok: ${req.url.slice(0, 200)}`);
  } finally {
    globalThis.fetch = origFetch;
  }
});

// ---------------- SEMANTİK EYLEM TAMAMLAMA ----------------
test('sadece etiket/halka olan sahne BAŞARILI SAYILMAZ', () => {
  // Canlı örnek: statik hayvan fotoğrafı + "ORGANS → ESCAPE".
  const r = scoreSemanticAction({
    narration: 'sea cucumber ejects internal organs',
    actors: [{ type: 'ring', at: [0.5, 0.5] }],
    focus: { x: 0.5, y: 0.5 },
  });
  assert.equal(r.completionScore, 0, JSON.stringify(r));
  assert.equal(r.motionOrTransformationVisible, false);
});

test('özne + hareket + sonuç varsa sahne başarılı', () => {
  const r = scoreSemanticAction({
    narration: 'a termite walks out and marks the ground',
    actors: [
      { type: 'trail', path: [[0.2, 0.6], [0.6, 0.5]] },
      { type: 'walker', path: [[0.2, 0.6], [0.6, 0.5]] },
    ],
    focus: { x: 0.6, y: 0.5 },
  });
  assert.equal(r.completionScore, 1, JSON.stringify(r));
  assert.equal(r.causeEffectReadable, true);
});

test('hareket dizisi tek görselin yerini tutar', () => {
  const r = scoreSemanticAction({
    narration: 'it ejects its organs', actors: [], focus: null, hasSequence: true,
  });
  assert.ok(r.motionOrTransformationVisible);
  assert.ok(r.actorVisible);
});

test('ortalama, dekoratif sahneleri saklamaz', () => {
  const a = assessSemanticActions([
    { narration: 'x', actors: [{ type: 'ring', at: [0.5, 0.5] }], focus: { x: 0.5, y: 0.5 } },
    { narration: 'y', actors: [{ type: 'ring', at: [0.4, 0.4] }], focus: { x: 0.4, y: 0.4 } },
  ]);
  assert.equal(a.average, 0);
  assert.equal(a.decorativeOnly, 2);
});

// ---------------- LİSTE YAPISI ----------------
test('"5 incredible facts" beş madde ister', () => {
  assert.equal(declaredListCount('5 Incredible Facts About Sea Cucumbers!'), 5);
  assert.equal(declaredListCount('Three Weird Things About Ants'), 3);
  assert.equal(declaredListCount('What Sea Cucumbers Can Do'), null);
});

test('beş vaat / dört madde = GEÇERSİZ', () => {
  const r = assessListStructure({
    hook_text: '5 Incredible Facts',
    scenes: [1, 2, 3, 4].map((n) => ({ narration: 'x', list_index: n })),
  });
  assert.equal(r.declared, true);
  assert.equal(r.valid, false);
  assert.equal(r.detectedItemCount, 4);
});

test('beş vaat / beş sıralı işaret = GEÇERLİ', () => {
  const r = assessListStructure({
    hook_text: '5 Incredible Facts',
    scenes: [1, 2, 3, 4, 5].map((n) => ({ narration: 'x', list_index: n })),
  });
  assert.equal(r.valid, true);
  assert.deepEqual(r.renderedMarkers, [1, 2, 3, 4, 5]);
});

test('liste iddiası yoksa kapı uygulanmaz', () => {
  const r = assessListStructure({ hook_text: 'Why ants never sleep', scenes: [{}] });
  assert.equal(r.declared, false);
  assert.equal(r.valid, true);
});

// ---------------- CTA + TEKRAR ----------------
test('CTA final açıklamadan ÖNCE gelmeli', () => {
  // Canlı: "But here's the real kicker" → SUBSCRIBE → reveal.
  const bad = assessCta({ ctaStart: 32.07, ctaDuration: 0.8, duration: 39.5, revealStart: 31.5 });
  assert.equal(bad.interruptsReveal, true);
  const good = assessCta({ ctaStart: 20, ctaDuration: 0.8, duration: 39.5, revealStart: 31.5 });
  assert.equal(good.interruptsReveal, false);
});

test('CTA yoksa kapı sessiz', () => {
  assert.deepEqual(assessCta({ ctaStart: null }), { present: false, interruptsReveal: false });
});

test('tekrar eden anlatım ve altyazı başlangıcı yakalanır', () => {
  const r = detectRepetition({
    narrations: ['what sea cucumbers can do', 'something else', 'what sea cucumbers can do'],
    captionStarts: ['what sea', 'and then', 'what sea'],
  });
  assert.equal(r.status, 'fail');
  assert.equal(r.duplicateNarrationSpans.length, 1);
  assert.equal(r.duplicateCaptionStarts.length, 1);
});

test('tekrar yoksa geçer', () => {
  const r = detectRepetition({
    narrations: ['one thing', 'another thing'], captionStarts: ['one thing', 'another thing'],
  });
  assert.equal(r.status, 'pass');
});
