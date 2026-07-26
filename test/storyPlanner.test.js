import test from 'node:test';
import assert from 'node:assert/strict';
import { planScene, planVisualStory, STORY_TEMPLATES } from '../src/crew/storyPlanner.js';

const scene = (narration, image_prompt = 'a beautiful cinematic shot') => ({ narration, image_prompt });

// ---------------- SIRALAMA TERSİNE: görsel hikâyeye HİZMET EDER ----------------
test('mekanizma cümlesi görselden KESİT ister (audit\'in çekirdek örneği)', () => {
  // Eski akış: "sinematik yuva çekimi" → o görselde hava akışı GÖSTERİLEMEZ,
  // çünkü kadrajda kesit yok. Hikâye görselden sonra geldiği için çaresizdi.
  const s = scene('Termites keep the mound at a constant temperature inside');
  planVisualStory({ scenes: [s] });
  assert.equal(s.story_template, 'mechanism');
  assert.match(s.image_prompt, /cross-section/i, 'görselden kesit istenmedi');
  assert.match(s.image_prompt, /interior|internal/i);
  // Orijinal prompt KORUNMALI (üstüne eklenir, silinmez).
  assert.match(s.image_prompt, /beautiful cinematic shot/);
});

test('kompozisyon gereği promptun BAŞINA eklenir (ağırlık baştadır)', () => {
  const s = scene('Warm air rises through the interior chamber', 'a mound');
  planVisualStory({ scenes: [s] });
  assert.ok(s.image_prompt.indexOf('cross-section') < s.image_prompt.indexOf('a mound'),
    'kompozisyon sona eklenmiş — üretici baştaki kelimelere ağırlık verir');
});

test('davranış cümlesi iz için AÇIK ORTA ZEMİN ister', () => {
  const s = scene('A single termite walks out and marks the ground behind it');
  planVisualStory({ scenes: [s] });
  assert.equal(s.story_template, 'flow');
  assert.match(s.image_prompt, /path can be traced|uncluttered/i);
  assert.equal(s.viewer_task, 'Follow the trail');
});

test('sayı cümlesi SAYILABİLİR örnekler ister', () => {
  const s = scene('Over 3000 workers live inside one colony');
  planVisualStory({ scenes: [s] });
  assert.equal(s.story_template, 'quantity');
  assert.match(s.image_prompt, /countable/i);
});

// ---------------- DOLGU SAHNE ZORLANMAZ ----------------
test('yapısı olmayan cümlenin promptuna DOKUNULMAZ', () => {
  const s = scene('It was a quiet ordinary afternoon', 'warm empty landscape');
  planVisualStory({ scenes: [s] });
  assert.equal(s.story_template, 'atmosphere');
  assert.equal(s.image_prompt, 'warm empty landscape', 'dolgu sahneye hikâye zorlandı');
  assert.equal(s.viewer_task, null);
});

// ---------------- ŞABLON SEÇİMİ ----------------
test('metin override\'ı beat sınıfını EZER', () => {
  // "hidden/spot" → search_reveal, beat ne olursa olsun.
  assert.equal(planScene({ narration: 'The insect stays hidden against the bark' }).story_template,
    'search_reveal');
  assert.equal(planScene({ narration: 'Workers build the tower layer by layer' }).story_template,
    'construction');
  assert.equal(planScene({ narration: 'The nest is as tall as a two storey house' }).story_template,
    'scale');
});

test('her şablonun kamera planı ve tanımı var', () => {
  // audit §3.2'nin 14 şablonu + sayım (quantity) + dolgu (atmosphere)
  // + V3'ün dört aktif anlatım şablonu (filtering/reconstruct/retrieval/
  // emotion_link). V3'te eklendiler çünkü "beyin ayrıntıları filtreler" gibi
  // apaçık eylem cümleleri karşılıksız kalıp atmosphere'a düşüyordu.
  const KNOWN = ['mechanism', 'flow', 'comparison', 'scale', 'search_reveal',
    'construction', 'map', 'chain', 'quantity', 'communication', 'cause_effect',
    'chain_reaction', 'timeline', 'navigation', 'problem_solution',
    'filtering', 'reconstruct', 'retrieval', 'emotion_link', 'atmosphere'];
  for (const t of STORY_TEMPLATES) {
    assert.ok(KNOWN.includes(t), `bilinmeyen şablon: ${t}`);
  }
  assert.equal(STORY_TEMPLATES.length, KNOWN.length, 'şablon kütüphanesi eksik');
  const p = planScene({ narration: 'Warm air rises through the chamber inside' });
  assert.ok(p.camera_plan?.motivation, 'kamera gerekçesi yok');
  assert.ok(p.camera_plan.start && p.camera_plan.end);
});

// ---------------- AKTÖR KATMANIYLA HİZA ----------------
test('plan, aktör katmanının kullanacağı beat\'i taşır', async () => {
  const { beatToActors } = await import('../src/visual/beatToActors.js');
  const s = scene('A single termite walks out and marks the ground behind it');
  planVisualStory({ scenes: [s] });
  assert.ok(s.story_beat, 'beat taşınmadı — renderVideo yeniden sınıflandırmak zorunda kalır');
  const actors = beatToActors({ ...s.story_beat, start: 0, end: 5,
    focus: { x: 0.6, y: 0.5, confidence: 2 } });
  assert.ok(actors.some((a) => a.type === 'trail'), 'planlanan beat aktöre çevrilemedi');
});

// ---------------- DAYANIKLILIK ----------------
test('AI olmadan çalışır ve bozuk girdide çökmez', () => {
  assert.doesNotThrow(() => planVisualStory({}));
  assert.doesNotThrow(() => planVisualStory({ scenes: [] }));
  assert.doesNotThrow(() => planVisualStory({ scenes: [{}] }));
  const r = planVisualStory({ scenes: [{ narration: 'x' }] });
  assert.equal(r.stats.total, 1);
});

test('istatistikler raporlanır (QC ve log için)', () => {
  const scenes = [
    scene('Termites keep the mound at a constant temperature inside'),
    scene('A single termite walks out and marks the ground'),
    scene('It was a quiet ordinary afternoon'),
  ];
  const { stats } = planVisualStory({ scenes });
  assert.equal(stats.total, 3);
  assert.equal(stats.composed, 2, 'kompozisyonu kısıtlanan sahne sayısı yanlış');
  assert.equal(stats.atmosphereOnly, 1);
  assert.equal(stats.viewerTasks, 2);
});
