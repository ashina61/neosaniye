/**
 * AKTİF GÖRSEL ANLATIM — "video yalnızca güzel AI görsellerinden oluşmamalı."
 *
 * brain-vs-ai-memory raporu: staticShare 0.99, aiShare 1.0,
 * semanticActionCompletionAverage 0.07, 10 sahnenin 9'u atmosphere.
 * İzleyicinin gördüğü: bilim insanı → sunucu odası → mavi beyin → tekrar
 * bilim insanı. Anlatım eylemden söz ediyordu, ekran hiçbir eylem göstermiyordu.
 *
 * Bu dosya o kaçışın kapatıldığını kanıtlar.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  planVisualStory, planScene, activeTemplateFor, actionDensity, MAX_ATMOSPHERE_SHARE,
} from '../src/crew/storyPlanner.js';
import { measureVisualNovelty, baseAssetOf, scoreVisualVariety } from '../src/pipeline/visualNovelty.js';

// ---------------- §3 EYLEM CÜMLESİ ATMOSPHERE OLAMAZ ----------------
const ACTIVE_CASES = [
  ['The brain filters out unimportant details.', 'filtering'],
  ['Your brain discards what it does not need.', 'filtering'],
  ['AI retrieves stored records instantly.', 'retrieval'],
  ['The system searches its stored data.', 'retrieval'],
  ['Your brain fills in the missing pieces.', 'reconstruct'],
  ['Human memory reconstructs experiences.', 'reconstruct'],
  ['Memories are linked to emotions.', 'emotion_link'],
  ['Each memory connects to a place and a sound.', 'emotion_link'],
  ['Unlike humans, AI stores exact copies.', 'comparison'],
  ['Neither stores memories the same way.', 'comparison'],
];

for (const [narration, expected] of ACTIVE_CASES) {
  test(`"${narration.slice(0, 42)}…" → ${expected}`, () => {
    assert.equal(activeTemplateFor(narration), expected);
    const plan = planScene({ narration, image_prompt: 'x' }, 0);
    assert.notEqual(plan.story_template, 'atmosphere',
      `eylem cümlesi atmosphere'a düştü: ${JSON.stringify(plan)}`);
  });
}

test('GERÇEKTEN sakin cümle atmosphere KALIR (uydurma şablon yok)', () => {
  // Sınırın diğer yarısı: her cümleye zorla eylem şablonu atamak, olmayan bir
  // iddiada bulunmaktır. Establishing shot ve nefes alan plan meşrudur.
  for (const narration of ['A quiet laboratory at dawn.', 'Soft light fills the room.', 'Silence.']) {
    assert.equal(activeTemplateFor(narration), null, narration);
    assert.equal(actionDensity(narration), 0, narration);
  }
});

test('eylem yoğunluğu birden çok sinyali sayar', () => {
  const many = 'Unlike humans, the brain filters details and retrieves stored records.';
  assert.ok(actionDensity(many) >= 3, String(actionDensity(many)));
  assert.equal(actionDensity('Silence.'), 0);
});

// ---------------- §3 ATMOSPHERE TAVANI ----------------
test('atmosphere tavanı aşılırsa EN EYLEM YOĞUN sahneler kurtarılır', () => {
  // brain-vs-ai-memory profili: eylem anlatan cümleler atmosphere'a düşmüş.
  const scenes = [
    'The brain filters out unimportant details.',
    'AI retrieves stored records instantly.',
    'Your brain fills in the missing pieces.',
    'Memories are linked to emotions.',
    'Unlike humans, AI stores exact copies.',
    'Human memory changes over the years.',
    'The system converts input into patterns.',
    'A quiet laboratory at dawn.',
    'Soft light fills the room.',
    'Silence.',
  ].map((narration) => ({ narration, image_prompt: 'base prompt' }));

  const r = planVisualStory({ scenes });
  const atmosphere = scenes.filter((s) => s.story_template === 'atmosphere').length;
  assert.ok(atmosphere <= 3, `atmosphere ${atmosphere}/10 — eylem sahneleri kurtarılmamış`);
  // Kurtarılanlar GERÇEKTEN eylem anlatanlar olmalı.
  assert.equal(scenes[0].story_template, 'filtering');
  assert.equal(scenes[1].story_template, 'retrieval');
  // Sakin olanlar dokunulmadan kalmalı.
  assert.equal(scenes[9].story_template, 'atmosphere');
  assert.ok(r.stats.atmosphereShare <= 0.35, JSON.stringify(r.stats));
});

test('tavan istatistiği raporlanır (gizlenmez)', () => {
  const scenes = Array.from({ length: 10 }, () => ({ narration: 'Silence.', image_prompt: 'x' }));
  const r = planVisualStory({ scenes });
  assert.equal(r.stats.atmosphereOnly, 10);
  assert.equal(r.stats.atmosphereShare, 1);
  assert.equal(r.stats.atmosphereCapExceeded, true);
  assert.ok(MAX_ATMOSPHERE_SHARE === 0.20);
});

test('kurtarılan sahne KOMPOZİSYON da alır (görsel gerçekten değişir)', () => {
  // Şablon adını değiştirip image_prompt'a dokunmamak hiçbir şey çözmezdi:
  // üretici yine aynı "güzel manzara"yı üretirdi.
  const scenes = [
    ...Array.from({ length: 8 }, () => ({ narration: 'The brain filters out details.', image_prompt: 'BASE' })),
    { narration: 'Silence.', image_prompt: 'BASE' },
    { narration: 'Stillness.', image_prompt: 'BASE' },
  ];
  planVisualStory({ scenes });
  const filtered = scenes.filter((s) => s.story_template === 'filtering');
  assert.ok(filtered.length >= 7, String(filtered.length));
  for (const s of filtered) {
    assert.ok(s.image_prompt.length > 'BASE'.length, s.image_prompt);
    assert.ok(/information cards|fragments/i.test(s.image_prompt), s.image_prompt);
  }
});

// ---------------- §7 TÜREV KLİP METRİĞİ ----------------
test('temel varlık kimliği türevlerden ayrıştırılır', () => {
  assert.equal(baseAssetOf('photo-3'), 'photo-3');
  assert.equal(baseAssetOf('photo-3#b'), 'photo-3');
  assert.equal(baseAssetOf('photo-3#c'), 'photo-3');
  assert.equal(baseAssetOf('photo-3#loop'), 'photo-3');
  assert.equal(baseAssetOf(null), null);
});

test('27 klip / 10 temel görsel = yenilik 0.37, "27 farklı plan" DEĞİL', () => {
  // Raporun kendini kandırdığı yer tam burasıydı.
  // 10 temel görsel: 7'sinden 3 klip, 3'ünden 2 klip = 27 klip.
  const items = [];
  for (let base = 0; base < 10; base += 1) {
    items.push({ assetId: `photo-${base}` });
    items.push({ assetId: `photo-${base}#b` });
    if (base < 7) items.push({ assetId: `photo-${base}#c` });
  }
  const n = measureVisualNovelty(items);
  assert.equal(n.derivedClipCount, 27);
  assert.equal(n.baseAssetCount, 10);
  assert.equal(n.trueVisualNoveltyRatio, 0.37);
  // 3'lü diziler ihlaldir: yedi yerde aynı fotoğraf üç kez arka arkaya.
  assert.equal(n.violations.length, 7, JSON.stringify(n.violations));
});

test('aynı temel görselden ardışık ÜÇ türev ihlaldir', () => {
  const n = measureVisualNovelty([
    { assetId: 'a' }, { assetId: 'a#b' }, { assetId: 'a#c' }, { assetId: 'b' },
  ]);
  assert.equal(n.longestSameBaseRun, 3);
  assert.equal(n.violations.length, 1);
  assert.equal(n.violations[0].baseAsset, 'a');
});

test('ardışık İKİ türev serbesttir', () => {
  const n = measureVisualNovelty([
    { assetId: 'a' }, { assetId: 'a#b' }, { assetId: 'b' }, { assetId: 'b#b' },
  ]);
  assert.deepEqual(n.violations, []);
  assert.equal(n.longestSameBaseRun, 2);
});

test('visualVariety türev sayısına göre DEĞİL temel varlığa göre puanlanır', () => {
  // Aynı klip sayısı (12), farklı gerçek: biri 12 ayrı görsel, diğeri 4 görselin
  // türevleri. Eski metrik ikisine de aynı puanı verirdi.
  const many = measureVisualNovelty(Array.from({ length: 12 }, (_, i) => ({ assetId: `p${i}` })));
  const few = measureVisualNovelty(
    Array.from({ length: 12 }, (_, i) => ({ assetId: `p${Math.floor(i / 3)}${i % 3 ? `#${i % 3}` : ''}` })),
  );
  const sources = Array(12).fill('ai');
  assert.ok(scoreVisualVariety(many, sources) > scoreVisualVariety(few, sources),
    `${scoreVisualVariety(many, sources)} vs ${scoreVisualVariety(few, sources)}`);
});

// ---------------- §15 SEMANTİK OTOMATİK DÜZELTME ----------------
test('düşük semantik skor cron\'u durdurmaz, DÜZELTME turu çalışır', async () => {
  const { repairSemanticActions, REPAIR_TRIGGER_AVERAGE } = await import('../src/pipeline/semanticRepair.js');
  const { assessSemanticActions } = await import('../src/pipeline/storyAudit.js');
  const script = {
    scenes: [
      { narration: 'The brain filters out unimportant details.', image_prompt: 'BASE', story_template: 'atmosphere' },
      { narration: 'AI retrieves stored records.', image_prompt: 'BASE', story_template: 'atmosphere' },
    ],
  };
  const sem = assessSemanticActions(script.scenes.map((s) => ({
    narration: s.narration, template: s.story_template, focus: null, hasSequence: false, actors: [],
  })));
  assert.ok(sem.average < REPAIR_TRIGGER_AVERAGE, String(sem.average));

  const r = repairSemanticActions(script, sem);
  assert.equal(r.attempted, true);
  assert.equal(r.repaired, true, JSON.stringify(r));
  assert.equal(r.qualityDegraded, false);
  assert.equal(script.scenes[0].story_template, 'filtering');
  assert.equal(script.scenes[1].story_template, 'retrieval');
  // Kompozisyon da değişmeli: şablon adını değiştirip prompt'a dokunmamak
  // hiçbir şey çözmez, üretici yine aynı kadrajı üretir.
  assert.ok(script.scenes[0].image_prompt !== 'BASE');
});

test('düzeltilecek şey yoksa quality_degraded ile DEVAM (cron kesilmez)', async () => {
  const { repairSemanticActions } = await import('../src/pipeline/semanticRepair.js');
  const script = { scenes: [{ narration: 'Silence.', image_prompt: 'BASE', story_template: 'atmosphere' }] };
  const r = repairSemanticActions(script, { average: 0.0, perScene: [{ completionScore: 0 }] });
  assert.equal(r.attempted, true);
  assert.equal(r.repaired, false);
  assert.equal(r.qualityDegraded, true, JSON.stringify(r));
  // Uydurma yapılmadı: sakin cümle sakin kaldı.
  assert.equal(script.scenes[0].story_template, 'atmosphere');
  assert.equal(script.scenes[0].image_prompt, 'BASE');
});

test('skor zaten iyiyse düzeltme HİÇ çalışmaz (çalışanı bozma)', async () => {
  const { repairSemanticActions } = await import('../src/pipeline/semanticRepair.js');
  const script = { scenes: [{ narration: 'The brain filters details.', image_prompt: 'BASE', story_template: 'flow' }] };
  const r = repairSemanticActions(script, { average: 0.85, perScene: [{ completionScore: 0.85 }] });
  assert.equal(r.attempted, false);
  assert.equal(script.scenes[0].story_template, 'flow');
  assert.equal(script.scenes[0].image_prompt, 'BASE');
});

test('şablon zaten HİKÂYE taşıyorsa onarım DOKUNMAZ', async () => {
  // GERÇEK REGRESYON (fungal-networks): bu tur render'dan ÖNCE koşuyor ve o
  // anda hiçbir sahnenin odağı/aktörü yok, dolayısıyla tüm skorlar 0. Onarım
  // her sahneyi aday sayıp GEÇERLİ şablonları eziyordu: sahne 0 search_reveal
  // → emotion_link, sahne 1 scale → emotion_link. İki komşu sahne aynı şablona
  // düşünce aynı overlay peş peşe iki kez çizildi.
  const { repairSemanticActions } = await import('../src/pipeline/semanticRepair.js');
  const script = { scenes: [
    { narration: 'Fungi connect trees somehow in a hidden network.', image_prompt: 'BASE', story_template: 'search_reveal' },
    { narration: 'Through tiny fungal networks deep underground, trees connect.', image_prompt: 'BASE', story_template: 'scale' },
  ] };
  const r = repairSemanticActions(script, { average: 0, perScene: [{ completionScore: 0 }, { completionScore: 0 }] });
  assert.equal(r.repaired, false, JSON.stringify(r.changedScenes));
  assert.equal(script.scenes[0].story_template, 'search_reveal');
  assert.equal(script.scenes[1].story_template, 'scale');
  assert.match(r.skipped[0].reason, /şablon zaten hikâye taşıyor/);
});

test('onarım ARDIŞIK aynı şablonu üretmez', async () => {
  const { repairSemanticActions } = await import('../src/pipeline/semanticRepair.js');
  const script = { scenes: [
    { narration: 'The brain filters out details.', image_prompt: 'BASE', story_template: 'filtering' },
    { narration: 'It filters out the noise as well.', image_prompt: 'BASE', story_template: 'atmosphere' },
  ] };
  const r = repairSemanticActions(script, { average: 0, perScene: [{ completionScore: 0 }, { completionScore: 0 }] });
  assert.equal(script.scenes[1].story_template, 'atmosphere', JSON.stringify(r));
  assert.ok(r.skipped.some((x) => /komşu sahne zaten filtering/.test(x.reason)), JSON.stringify(r.skipped));
});

test('hikâyesiz sahne YİNE onarılır (kapsam daralmadı)', async () => {
  const { repairSemanticActions } = await import('../src/pipeline/semanticRepair.js');
  const script = { scenes: [
    { narration: 'AI retrieves stored records.', image_prompt: 'BASE', story_template: 'atmosphere' },
  ] };
  const r = repairSemanticActions(script, { average: 0, perScene: [{ completionScore: 0 }] });
  assert.equal(r.repaired, true, JSON.stringify(r));
  assert.equal(script.scenes[0].story_template, 'retrieval');
});

test('ölçüm yoksa düzeltme uydurulmaz', async () => {
  const { repairSemanticActions } = await import('../src/pipeline/semanticRepair.js');
  const r = repairSemanticActions({ scenes: [] }, null);
  assert.equal(r.attempted, false);
  assert.match(r.reason, /ölçüm yok/);
});
