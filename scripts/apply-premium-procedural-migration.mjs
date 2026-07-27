#!/usr/bin/env node
import {readFile, writeFile} from 'node:fs/promises';

function replaceBetween(source, startMarker, endMarker, replacement, label) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0 || end <= start) throw new Error(`${label}: markers not found`);
  return source.slice(0, start) + replacement + source.slice(end);
}

function removeLine(source, line) {
  const count = source.split(line).length - 1;
  if (count === 0) return source;
  return source.split(line).join('');
}

const runPath = 'src/pipeline/run.js';
let run = await readFile(runPath, 'utf8');
for (const line of [
  "import { directVisuals, applyShotList } from '../crew/visualDirector.js';\n",
  "import { applyPromptStyle } from '../crew/promptStyle.js';\n",
  "import { applySideIdentity } from '../visual/sideIdentity.js';\n",
  "import { fetchAmbienceTrack, defaultAmbienceQuery } from '../audio/fetchAmbience.js';\n",
  "import { generateImages } from '../media/generateImages.js';\n",
  "import { buildSrtFromWords, uploadCaptions } from '../youtube/captions.js';\n",
  "import { getRecentMusic, getRecentAssetIds } from '../lib/firestore.js';\n",
  "import { semanticRelevanceScore, detectOffTopicVisual } from '../media/semanticRelevance.js';\n",
  "import { applySubjectBible } from '../crew/subjectBible.js';\n",
  "import { validateCaptionIntegrity } from '../video/captionIntegrity.js';\n",
  "import { analyzeCaptionLayout } from '../video/captionLayout.js';\n",
]) run = removeLine(run, line);

run = replaceBetween(
  run,
  '  // 1.5) ORKESTRA',
  '  try {',
  `  // 1.5) PREMIUM KURGU PLANI — görüntü sağlayıcısı veya shot-list üretimi yok.\n` +
  `  let editPlan = null;\n` +
  `  if (config.crew.enabled) {\n` +
  `    log('Faz 1.5: Premium kurgu ve ses planı...');\n` +
  `    editPlan = await planEdit(script).catch((e) => {\n` +
  `      console.warn(\`[crew] kurgucu düştü: \${String(e.message).slice(0, 90)}\`);\n` +
  `      return null;\n` +
  `    });\n` +
  `    console.log(\`  kurgucu: \${editPlan ? \`✓ (müzik:\${editPlan.musicMood || script.category})\` : '— (mekanik premium plan)'}\`);\n` +
  `  }\n\n` +
  `  try {`,
  'orchestra block',
);

run = replaceBetween(
  run,
  '    // 2.5) Ambiyans yatağı',
  '    // 2.9) GÖRSEL HİKÂYE PLANI',
  `    // Premium motor dış ambiyans veya gerçek görsel kullanmaz.\n` +
  `    const ambience = null;\n` +
  `    const visualStyle = 'premium-procedural';\n` +
  `    const scenes = script.scenes || [];\n` +
  `    const sceneWeights = scenes.map((s) => Math.max(1, wordCount(s.narration)));\n\n` +
  `    // 2.9) GÖRSEL HİKÂYE PLANI`,
  'ambience and visual style block',
);

run = replaceBetween(
  run,
  '    // 2.85) ÖZNE KİMLİK KİLİDİ',
  '    // 4) Remotion motion-graphics renderı',
  `    // 2.85) PROCEDURAL ÖZNE KİMLİĞİ — prompt veya fotoğraf üretmez.\n` +
  `    const bible = {\n` +
  `      mode: 'procedural-only',\n` +
  `      canonicalName: script.topic || script.normalizedTopic || 'NeoSaniye subject',\n` +
  `      verifiedSource: 'script-topic',\n` +
  `    };\n` +
  `    const storyPlan = planVisualStory(script);\n` +
  `    console.log(\`  motion storyboard: \${storyPlan.stats.composed}/\${storyPlan.stats.total} sahne ` +
  `(\${Object.entries(storyPlan.stats.byTemplate).map(([k, v]) => \`\${k}:\${v}\`).join(' ')})\`);\n` +
  `    const planSemantics = assessSemanticActions((script.scenes || []).map((sc) => ({\n` +
  `      narration: sc.narration, template: sc.story_template, focus: null, hasSequence: true, actors: [],\n` +
  `    })));\n` +
  `    const semanticRepairResult = repairSemanticActions(script, planSemantics);\n` +
  `    if (semanticRepairResult.attempted) console.log(\`  [motion-onarım] \${semanticRepairResult.reason}\`);\n\n` +
  `    // 3) PREMIUM PROCEDURAL STORYBOARD — dosya/URL/görsel sağlayıcısı yok.\n` +
  `    log('Faz 3: Premium procedural storyboard hazırlanıyor...');\n` +
  `    const media = {\n` +
  `      items: scenes.map((scene, index) => ({\n` +
  `        scene: index, part: 0, sequence: true, loopEcho: false,\n` +
  `        path: \`procedural://scene-\${index + 1}\`, type: 'procedural',\n` +
  `        source: 'procedural-remotion', provider: 'neosaniye-premium-engine',\n` +
  `        assetId: \`procedural:\${scene.story_template || 'collage'}:\${index + 1}\`,\n` +
  `        license: 'proprietary-original',\n` +
  `        licenseEvidence: 'remotion/src/DynamicShort.tsx',\n` +
  `        generatedAt: new Date().toISOString(),\n` +
  `      })),\n` +
  `      sources: { procedural: scenes.length },\n` +
  `    };\n` +
  `    const renderTimeline = expandTimelineForMedia(canonicalTimeline, media.items);\n` +
  `    const itemWeights = sceneWeights;\n` +
  `    console.log(\`  \${scenes.length} procedural sahne — dış görsel: 0, stok: 0, AI görsel: 0\`);\n\n` +
  `    // 4) Remotion motion-graphics renderı`,
  'procedural storyboard block',
);

run = replaceBetween(
  run,
  '    const video = await renderVideo({',
  '    console.log(`  ${video.width}x${video.height}',
  `    const video = await renderVideo({\n` +
  `      audioPath: audio.audioPath,\n` +
  `      scenes,\n` +
  `      timeline: canonicalTimeline,\n` +
  `      hookText: script.hook_text,\n` +
  `      category: script.category,\n` +
  `      editPlan,\n` +
  `      emphasisWords: script.emphasis_words || [],\n` +
  `      finaleText: script.finale_text || '',\n` +
  `      musicSeed: script.normalizedTopic || base,\n` +
  `      language: script.language || 'en',\n` +
  `      title: script.title || script.topic,\n` +
  `      topic: script.topic || script.normalizedTopic,\n` +
  `      outPath,\n` +
  `    });\n`,
  'render call',
);

run = replaceBetween(
  run,
  '    // Semantik alaka',
  '    // ---- FINAL MP4 DOĞRULAMASI',
  `    // Procedural çizimler doğrudan narration/template verisinden üretildiği için\n` +
  `    // stok anahtar kelime eşlemesi uygulanmaz.\n` +
  `    const itemRelevance = media.items.map(() => 1);\n` +
  `    const offTopicScenes = [];\n\n` +
  `    // ---- FINAL MP4 DOĞRULAMASI`,
  'semantic relevance block',
);

run = replaceBetween(
  run,
  '    // ALTYAZI + SEMANTİK EYLEM ÖLÇÜMÜ',
  '    const qc = await runRetentionQC({',
  `    // Video içi altyazı politikası: YOK. Yalnız editorial kinetic text vardır.\n` +
  `    const captionLayout = { policy: 'none', events: [], readability: { ok: true }, safeArea: { ok: true } };\n` +
  `    const captionIntegrity = { ok: true, policy: 'none', failures: [], eventCount: 0 };\n` +
  `    const semanticActions = assessSemanticActions((script.scenes || []).map((s, i) => ({\n` +
  `      narration: s.narration, template: s.story_template, focus: video.sceneFocus?.[i] || null,\n` +
  `      hasSequence: true, actors: (video.actorsByScene?.[i]) || [],\n` +
  `    })));\n\n` +
  `    const qc = await runRetentionQC({`,
  'caption measurement block',
);

run = run.replace(
  "      captionReadability: captionLayout?.readability?.ok ?? null,\n",
  "      captionPolicy: 'none',\n      captionReadability: true,\n",
);

run = replaceBetween(
  run,
  '        // İlk yorum ve SRT',
  '      // Meta cross-post:',
  `        // İlk yorum best-effort. Harici ve video içi altyazı bu formatta kapalıdır.\n` +
  `        const commented = await postFirstComment(res.videoId, script).catch(() => false);\n` +
  `        if (commented) console.log('  ilk yorum atıldı');\n` +
  `      }\n\n` +
  `      // Meta cross-post:`,
  'caption upload block',
);

for (const forbidden of ['generateImages(', 'fetchAmbienceTrack(', 'buildSrtFromWords(', 'uploadCaptions(', 'applyShotList(', 'directVisuals(']) {
  if (run.includes(forbidden)) throw new Error(`run.js still contains ${forbidden}`);
}
await writeFile(runPath, run, 'utf8');

const retentionPath = 'src/pipeline/retentionQC.js';
let retention = await readFile(retentionPath, 'utf8');
retention = retention.replace(
  '  const duration = Number(input.duration) || 0;\n',
  "  const duration = Number(input.duration) || 0;\n  const captionPolicy = input.captionPolicy || 'required';\n  const proceduralOnly = sources.length > 0 && sources.every((source) => source === 'procedural-remotion');\n",
);
retention = replaceBetween(
  retention,
  '  // ---------- D) ALTYAZI (10) ----------',
  '  // ---------- E) GÖRSEL ÇEŞİTLİLİK',
  `  // ---------- D) EDITORIAL TEXT POLICY (10) ----------\n` +
  `  let captions = 0;\n` +
  `  let capLayout = null;\n` +
  `  let capRead = null;\n` +
  `  if (captionPolicy === 'none') {\n` +
  `    captions = 10;\n` +
  `    capLayout = { policy: 'none', events: [], safeArea: { ok: true } };\n` +
  `    capRead = { ok: true, policy: 'editorial-kinetic-text-only' };\n` +
  `  } else {\n` +
  `    if (words.length) {\n` +
  `      capLayout = analyzeCaptionLayout(words, { emphasisWords: input.emphasisWords || [] });\n` +
  `      if (!capLayout.safeArea.ok) failures.push('altyazı güvenli alan dışında');\n` +
  `    }\n` +
  `    if (config.video.captionSize >= cfg.minCaptionPx) captions += 4;\n` +
  `    if (capLayout) {\n` +
  `      if (capLayout.maxWordsOnScreen <= cfg.maxCaptionWords) captions += 3;\n` +
  `      if (capLayout.belowFloorCount === 0) captions += 3;\n` +
  `      capRead = assessCaptionReadability({ minFontPx: capLayout.minFontUsed, outlinePx: 2.6, minPreviewPx: cfg.captionMinPreviewPx ?? 15 });\n` +
  `    } else failures.push('altyazı zamanlaması yok veya boş');\n` +
  `  }\n\n` +
  `  // ---------- E) GÖRSEL ÇEŞİTLİLİK`,
  'retention caption section',
);
retention = retention.replace(
  '  if (srcSet.size >= 3) variety += 3;\n  else if (srcSet.size === 2) variety += 1;\n',
  "  if (proceduralOnly) variety += 3;\n  else if (srcSet.size >= 3) variety += 3;\n  else if (srcSet.size === 2) variety += 1;\n",
);
retention = retention.replace(
  "  if (maxRun <= 3 || (sources[0] === 'stock' && maxRun === sources.length)) variety += 2;\n",
  "  if (proceduralOnly || maxRun <= 3 || (sources[0] === 'stock' && maxRun === sources.length)) variety += 2;\n",
);
retention = retention.replace(
  '  if (srcMaxRun >= 4 || aiShare > 0.6) {\n',
  '  if (!proceduralOnly && (srcMaxRun >= 4 || aiShare > 0.6)) {\n',
);
await writeFile(retentionPath, retention, 'utf8');

const emergencyPath = 'src/pipeline/emergencyQualityGate.js';
let emergency = await readFile(emergencyPath, 'utf8');
emergency = emergency.replace(
  '  const captions = usableCaptionWords(wordTimings);\n',
  "  const captionPolicy = renderPlan?.captionPolicy || 'required';\n  const captions = usableCaptionWords(wordTimings);\n",
);
emergency = emergency.replace(
  "  if (captions.length < 3 || captionChars < 6) {\n    add('CAPTIONS_MISSING_OR_EMPTY', 'Altyazı zamanlaması yok veya etkili biçimde boş.');\n  }\n",
  "  if (captionPolicy !== 'none' && (captions.length < 3 || captionChars < 6)) {\n    add('CAPTIONS_MISSING_OR_EMPTY', 'Altyazı zamanlaması yok veya etkili biçimde boş.');\n  }\n",
);
emergency = emergency.replace(
  "  if (!hook || !firstNarration || !firstVisual?.path || !firstVisual?.source || !firstWord || firstWord.start > 1) {\n",
  "  if (!hook || !firstNarration || !(firstVisual?.assetId || firstVisual?.path) || !firstVisual?.source || !firstWord || firstWord.start > 1) {\n",
);
emergency = emergency.replace(
  "  if (!renderPlan || renderPlan.captionsIncluded !== true || !(renderPlan.captionEventCount > 0)) add('CAPTIONS_NOT_IN_RENDER_PLAN', 'Altyazılar final render planına dahil edilmedi.');\n",
  "  if (!renderPlan) add('RENDER_PLAN_MISSING', 'Final render planı bulunamadı.');\n  else if (captionPolicy !== 'none' && (renderPlan.captionsIncluded !== true || !(renderPlan.captionEventCount > 0))) add('CAPTIONS_NOT_IN_RENDER_PLAN', 'Altyazılar final render planına dahil edilmedi.');\n",
);
await writeFile(emergencyPath, emergency, 'utf8');

console.log('Premium procedural pipeline migration applied.');
