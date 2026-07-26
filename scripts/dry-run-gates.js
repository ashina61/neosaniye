#!/usr/bin/env node
/**
 * KAPI KURU KOŞUSU — upload KAPALI, dış sağlayıcı YOK.
 *
 * Amaç: 26 Tem'de yayına çıkan "sea cucumbers" videosunun verisini boru
 * hattının karar katmanlarından geçirip, bugün AYNI çıktının yayınlanıp
 * yayınlanamayacağını göstermek. Görsel/TTS üretmez (bu ortamda sağlayıcı
 * uçları kapalı); script + altyazı + kapı mantığını gerçek kodla çalıştırır.
 *
 * Kullanım: node scripts/dry-run-gates.js
 */
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { applySubjectBible } from '../src/crew/subjectBible.js';
import { planVisualStory } from '../src/crew/storyPlanner.js';
import { groupCaptionWords } from '../src/video/captionLayout.js';
import { validateCaptionIntegrity } from '../src/video/captionIntegrity.js';
import {
  assessSemanticActions, assessListStructure, assessCta, detectRepetition, assignListMarkers,
} from '../src/pipeline/storyAudit.js';
import { evaluatePublishGates } from '../src/pipeline/publishGates.js';
import { resolveUploadPolicy, logUploadDecision } from '../src/pipeline/uploadPolicy.js';

// 26 Tem canlı videosunun anlatımı (altyazılardan birebir çıkarıldı).
const NARRATION = [
  'Sea cucumbers can eject their entire digestive system.',
  'These creatures can eject their internal organs to escape predators.',
  'They can absorb toxins and clean the sediment they live in.',
  'What sea cucumbers can do with their bodies is astonishing.',
  'The interesting part is how they navigate tight spaces.',
  'They play a crucial role on the ocean floor.',
  'This unique feeding method helps maintain sediment quality.',
  'Their work could be crucial for reef restoration efforts.',
  'But here is what sea cucumbers can do that might surprise you.',
  'Sea cucumbers can eject their entire digestive system.',
];

const script = {
  topic: 'Sea Cucumbers',
  title: '5 Incredible Facts About Sea Cucumbers!',
  hook_text: '5 Incredible Facts About Sea Cucumbers!',
  visual_anchor: 'sea cucumber',
  category: 'nature',
  emphasis_words: ['eject', 'liquefy', 'toxins'],
  finale_text: 'LIQUEFY!',
  scenes: NARRATION.map((narration) => ({
    narration,
    image_prompt: 'beautiful sea cucumber on a coral reef, cinematic',
  })),
};

const outDir = path.join(process.cwd(), 'output', 'dry-run');
await mkdir(outDir, { recursive: true });

// --- 1) Liste yapısı ---
const listPlan = assignListMarkers(script);

// --- 2) Özne kimliği ---
const { bible, applied } = applySubjectBible(script);

// --- 3) Görsel hikâye planı ---
const story = planVisualStory(script);

// --- 4) Altyazı ---
let t = 0.4;
const words = script.scenes.flatMap((s) => s.narration.split(' ').map((w) => {
  const o = { word: w, start: +t.toFixed(2), end: +(t + 0.3).toFixed(2) };
  t += 0.34;
  return o;
}));
const groups = groupCaptionWords(words, {
  perLine: 4,
  isEmph: (w) => script.emphasis_words.some((e) => new RegExp(e, 'i').test(w)),
});
const events = groups.map((g) => ({ words: g, text: g.map((w) => w.word).join(' ') }));
const captionIntegrity = validateCaptionIntegrity({
  events, ttsText: script.scenes.map((s) => s.narration).join(' '),
});

// --- 5) Semantik eylem (odak ölçümü YOK: bu ortamda görsel üretilmedi) ---
const semanticActions = assessSemanticActions(script.scenes.map((s) => ({
  narration: s.narration, template: s.story_template, focus: null, actors: [],
})));

// --- 6) Liste / CTA / tekrar ---
const listStructure = assessListStructure(script);
const ctaReport = assessCta({ ctaStart: 32.07, ctaDuration: 0.8, duration: 39.5, revealStart: 31.5 });
const repetition = detectRepetition({
  narrations: script.scenes.map((s) => s.narration),
  captionStarts: events.map((e) => e.words.slice(0, 3).map((w) => w.word).join(" ")),
});

// --- 7) Yayın kapıları ---
const publishGates = evaluatePublishGates({
  captionIntegrity, subjectContinuity: null, semanticActions, listStructure, repetition,
  cta: ctaReport,
});

// --- 8) Yayın kararı (cron koşulları: bayrak yok, env yok) ---
const decision = resolveUploadPolicy({
  cliUpload: undefined,
  env: {},
  hasCredentials: true,
  preflightOk: true,
  qc: { report: {}, blockUpload: false, ok: true },
  emergencyGate: { block: false, blocking: [] },
  publishGates,
});

const report = {
  listPlan,
  subjectBible: bible,
  bibleAppliedToScenes: applied,
  storyTemplates: story.stats.byTemplate,
  scenePrompts: script.scenes.map((s, i) => ({
    index: i, image_prompt: s.image_prompt, negative_prompt: s.negative_prompt,
    story_template: s.story_template, list_index: s.list_index ?? null,
  })),
  captionBlocks: events.map((e) => e.text),
  captionIntegrity,
  semanticActions: { average: semanticActions.average, decorativeOnly: semanticActions.decorativeOnly },
  listStructure,
  ctaReport,
  repetition,
  publishGates,
  uploadDecision: decision,
};

await writeFile(path.join(outDir, 'dry-run-report.json'), JSON.stringify(report, null, 2));

console.log('=== KURU KOŞU: 26 Tem sea-cucumbers verisi, bugünkü kapılardan ===\n');
console.log(`liste      : ${listPlan.strippedClaim
  ? `"5 facts" iddiası KALDIRILDI → hook: "${script.hook_text}"`
  : `${listPlan.assigned}/${listPlan.declared} madde işaretlendi`}`);
console.log(`özne kilidi: "${bible.canonicalName}" (${bible.scientificCategory}) — ` +
  `${applied} sahneye uygulandı, ${bible.forbiddenTraits.length} yasak terim`);
console.log(`negatif    : ${bible.forbiddenTraits.slice(0, 6).join(', ')} …`);
console.log(`altyazı    : kapsama ${captionIntegrity.tokenCoverage}, ` +
  `eksik ${captionIntegrity.missingTokens.length}, ` +
  `dilbilgisi riski ${captionIntegrity.grammarRiskBlocks.length}, ` +
  `tekrar eden başlangıç ${captionIntegrity.duplicateCaptionStarts.length}`);
console.log(`eylem      : ortalama ${semanticActions.average}, ` +
  `dekoratif ${semanticActions.decorativeOnly}`);
console.log(`tekrar     : ${repetition.status} ` +
  `(anlatım ${repetition.duplicateNarrationSpans.length})`);
console.log(`CTA        : reveal keser mi → ${ctaReport.interruptsReveal ? 'EVET' : 'hayır'}`);
console.log(`\nyayın kapıları: ${publishGates.status.toUpperCase()}`);
for (const f of publishGates.failures) console.log(`  ✗ ${f}`);
for (const r of publishGates.review) console.log(`  ? ${r}`);
console.log('');
logUploadDecision(decision);
console.log(`\nrapor: ${path.join(outDir, 'dry-run-report.json')}`);
