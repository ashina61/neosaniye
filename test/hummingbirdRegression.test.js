/**
 * 26 TEMMUZ 13:28 — "hummingbirds" KOŞUSU.
 *
 * Bu koşu yayın güvenliğini KANITLADI (upload engellendi) ama bir önceki turda
 * benim eklediğim üç şey geri adım attırdı. Üçü de burada kilitli.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  buildSubjectBible, shortCanonicalName, subjectPromptPrefix, applySubjectBible,
} from '../src/crew/subjectBible.js';
import { assignListMarkers, assessListStructure } from '../src/pipeline/storyAudit.js';
import { planScene } from '../src/crew/storyPlanner.js';

// ---------- 1) Kimlik kilidi çeşitliliği ÖLDÜRÜYORDU ----------
test('kanonik ad KISA olur — paragraf ad olarak kullanılmaz', () => {
  // Canlıda visual_anchor bir paragraftı ve 10 sahnenin 10'unun promptu bu
  // 200 karakterlik AYNI metinle başladı: 9 benzersiz plan, 7 sahne neredeyse
  // aynı, en uzun aynı-kaynak 18. Kimlik kilidi tekdüzelik üretti.
  const anchor = 'A vibrant ruby-throated hummingbird, metallic green and iridescent '
    + 'red, hovers near a brightly colored flower in a lush garden. The lighting is '
    + 'bright and natural, revealing sharp details and rich colors.';
  const b = buildSubjectBible({ topic: 'How Hummingbirds See Invisible Colors', visual_anchor: anchor });
  assert.equal(b.canonicalName, 'hummingbird');
  assert.ok(b.canonicalName.length <= 40);
  const prefix = subjectPromptPrefix(b);
  assert.ok(prefix.length < 130, `ön ek çok uzun (${prefix.length}): ${prefix}`);
  assert.ok(!prefix.includes('lush garden'), 'sahne tarifi kimliğe sızdı');
});

test('çoğul tür adı tekile indirilir', () => {
  assert.equal(shortCanonicalName('How Hummingbirds See Invisible Colors'), 'hummingbird');
  assert.equal(shortCanonicalName('Sea Cucumbers'), 'sea cucumber');
  assert.equal(shortCanonicalName('Why Ants Never Sleep'), 'ant');
  assert.equal(shortCanonicalName('Termite Mound Engineering'), 'termite');
});

test('ad çıkarılamıyorsa kimlik ön eki HİÇ kurulmaz', () => {
  const longNonName = 'x'.repeat(120);
  assert.equal(shortCanonicalName(longNonName), '');
  const b = buildSubjectBible({ topic: '', visual_anchor: longNonName });
  assert.equal(subjectPromptPrefix(b), '');
  const script = { visual_anchor: longNonName, scenes: [{ image_prompt: 'a reef' }] };
  const { applied } = applySubjectBible(script);
  assert.equal(applied, 0);
  assert.equal(script.scenes[0].image_prompt, 'a reef', 'dayanaksız ön ek prompta yazıldı');
});

test('kimlik ön eki sahne cümlesini boğmaz (uzunluk oranı)', () => {
  const script = {
    topic: 'How Hummingbirds See Invisible Colors',
    scenes: [{ image_prompt: 'a bird hovering beside a red flower at dawn' }],
  };
  applySubjectBible(script);
  const p = script.scenes[0].image_prompt;
  const prefixLen = p.indexOf('a bird hovering');
  assert.ok(prefixLen > 0 && prefixLen < 140, `ön ek ${prefixLen} karakter — sahneyi boğuyor`);
});

// ---------- 2) Bağlamsız liste numaraları ----------
test('hook liste vaat etmiyorsa numara ATANMAZ', () => {
  // Canlıda hook "See colors we can't?" idi (sayı yok) ama BAŞLIKTA sayı vardı
  // → ekrana 1..5 basıldı ve izleyici hiçbir listeyle karşılaşmadı.
  const script = {
    hook_text: "See colors we can't?",
    title: '5 colors humans miss',
    scenes: Array.from({ length: 10 }, () => ({ narration: 'x' })),
  };
  const r = assignListMarkers(script);
  assert.equal(r.declared, null, 'başlıktaki sayı liste sanıldı');
  assert.equal(r.assigned, 0);
  assert.ok(!script.scenes.some((s) => Number.isFinite(s.list_index)), 'numara atandı');
  assert.equal(assessListStructure(script).declared, false);
});

test('hook liste vaat ediyorsa numara atanır', () => {
  const script = {
    hook_text: '5 incredible facts',
    scenes: Array.from({ length: 10 }, () => ({ narration: 'x' })),
  };
  const r = assignListMarkers(script);
  assert.equal(r.declared, 5);
  assert.equal(r.assigned, 5);
});

// ---------- 3) CTA kapatmak, eski uygulamayı AÇIYORDU ----------
test('iki abone yolu da varsayılan KAPALI (biri diğerini açmaz)', async () => {
  const { config } = await import('../src/config.js');
  assert.equal(config.motion.cta.enabled, false, 'motion CTA varsayılan açık');
  assert.equal(config.video.subPrompt, false, 'video içi rozet varsayılan açık');
  // renderVideo'daki devretme mantığı: motionCtaOn false olunca eski rozet
  // açılıyordu. İkisi de kapalı olmalı.
  const src = await readFile('src/video/renderVideo.js', 'utf8');
  assert.match(src, /config\.video\.subPrompt && !motionCtaOn/);
});

// ---------- 4) atmosphere:7 — karşılaştırma cümlesi kaçıyordu ----------
test('karşıtlık cümlesi karşılaştırma şablonu alır', () => {
  assert.equal(
    planScene({ narration: 'Unlike humans with three, hummingbirds possess four distinct types' })
      .story_template,
    'comparison',
  );
  assert.equal(
    planScene({ narration: 'In contrast, most birds see only three colors' }).story_template,
    'comparison',
  );
});

test('ölçek cümlesi karşılaştırmaya kaymaz (eski davranış korunur)', () => {
  assert.equal(
    planScene({ narration: 'The nest is as tall as a two storey house' }).story_template,
    'scale',
  );
});
