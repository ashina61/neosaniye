#!/usr/bin/env node
import {readFile, writeFile, rm} from 'node:fs/promises';

function replaceBetween(source, startMarker, endMarker, replacement, label) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0 || end <= start) throw new Error(`${label}: markers not found`);
  return source.slice(0, start) + replacement + source.slice(end);
}

function propertyRange(source, name) {
  const marker = `\n  ${name}: {`;
  const start = source.indexOf(marker);
  if (start < 0) return null;
  const braceStart = source.indexOf('{', start + marker.length - 1);
  let depth = 0;
  let mode = 'code';
  let quote = '';
  for (let i = braceStart; i < source.length; i += 1) {
    const ch = source[i];
    const next = source[i + 1];
    if (mode === 'line') { if (ch === '\n') mode = 'code'; continue; }
    if (mode === 'block') { if (ch === '*' && next === '/') { mode = 'code'; i += 1; } continue; }
    if (mode === 'string') { if (ch === '\\') { i += 1; continue; } if (ch === quote) mode = 'code'; continue; }
    if (ch === '/' && next === '/') { mode = 'line'; i += 1; continue; }
    if (ch === '/' && next === '*') { mode = 'block'; i += 1; continue; }
    if (ch === "'" || ch === '"' || ch === '`') { mode = 'string'; quote = ch; continue; }
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        let end = i + 1;
        if (source[end] === ',') end += 1;
        if (source[end] === '\r') end += 1;
        if (source[end] === '\n') end += 1;
        return {start, end};
      }
    }
  }
  throw new Error(`unterminated config property: ${name}`);
}

function removeProperty(source, name) {
  const range = propertyRange(source, name);
  return range ? source.slice(0, range.start) + source.slice(range.end) : source;
}

function replaceProperty(source, name, replacement) {
  const range = propertyRange(source, name);
  if (!range) throw new Error(`config property missing: ${name}`);
  return source.slice(0, range.start) + `\n${replacement}\n` + source.slice(range.end);
}

let config = await readFile('src/config.js', 'utf8');
for (const name of ['images', 'pexels', 'pixabay', 'freesound']) config = removeProperty(config, name);
config = replaceProperty(config, 'video', `  video: {
    // Final görüntü yalnız Remotion React/SVG procedural motion graphics'tir.
    visualPolicy: 'procedural-only',
    captionPolicy: 'none',
    tailSeconds: Number(process.env.VIDEO_TAIL_SECONDS || 0.4),
    sfx: process.env.VIDEO_SFX !== '0',
    music: process.env.VIDEO_MUSIC !== '0',
    musicDir: process.env.VIDEO_MUSIC_DIR || 'assets/music',
    musicPath: process.env.VIDEO_MUSIC_PATH || 'assets/music/bed.mp3',
    musicVolume: Number(process.env.VIDEO_MUSIC_VOL || 0.18),
  },`);
config = config.replace(/\nexport function assertPexels\([\s\S]*?\n}\n\n(?=export function assertGemini)/, '\n');
for (const field of ['minCaptionPx', 'maxCaptionWords', 'captionMinPreviewPx', 'captionBottomSafePx', 'captionTopSafeRatio']) {
  config = config.replace(new RegExp(`^\\s*${field}:.*\\n`, 'm'), '');
}
if (/\bimages\s*:\s*\{|\bpexels\s*:\s*\{|\bpixabay\s*:\s*\{|\bfreesound\s*:\s*\{/.test(config)) throw new Error('legacy provider config remains');
await writeFile('src/config.js', config, 'utf8');

let retention = await readFile('src/pipeline/retentionQC.js', 'utf8');
retention = retention.replace("import { analyzeCaptionLayout } from '../video/captionLayout.js';\n", '');
retention = retention.replace("import { assessHookReadability, assessCaptionReadability } from '../video/readability.js';", "import { assessHookReadability } from '../video/readability.js';");
retention = replaceBetween(
  retention,
  '  // ---------- D) EDITORIAL TEXT POLICY (10) ----------',
  '  // ---------- E) GÖRSEL ÇEŞİTLİLİK',
  `  // ---------- D) EDITORIAL KINETIC TEXT POLICY (10) ----------\n` +
  `  // NeoSaniye premium formatında konuşmayı tekrar eden video-içi altyazı yoktur.\n` +
  `  // Hook, isim, tarih, sayı ve twist sahnenin kompozisyonu olarak çizilir.\n` +
  `  const captions = 10;\n` +
  `  const capLayout = { policy: 'none', events: [], safeArea: { ok: true } };\n` +
  `  const capRead = { ok: true, policy: 'editorial-kinetic-text-only' };\n\n` +
  `  // ---------- E) GÖRSEL ÇEŞİTLİLİK`,
  'retention caption policy',
);
retention = retention.replace('  // ---------- E) GÖRSEL ÇEŞİTLİLİK  // ---------- E) GÖRSEL ÇEŞİTLİLİK + SEMANTİK ALAKA (10) ----------', '  // ---------- E) GÖRSEL ÇEŞİTLİLİK + SEMANTİK ALAKA (10) ----------');
if (/analyzeCaptionLayout|assessCaptionReadability|config\.video\.caption/.test(retention)) throw new Error('retention still imports caption renderer');
await writeFile('src/pipeline/retentionQC.js', retention, 'utf8');

let visualQc = await readFile('src/pipeline/visualNarrationQC.js', 'utf8');
visualQc = visualQc.replace("import { hammingDistance } from '../media/imageHash.js';\n", `function hammingDistance(a, b) {\n  let value = BigInt(a) ^ BigInt(b);\n  let count = 0;\n  while (value) { count += Number(value & 1n); value >>= 1n; }\n  return count;\n}\n`);
visualQc = visualQc.replace(/generateImages çıktısı \(visualHash taşıyabilir\)/g, 'procedural storyboard kimlikleri');
visualQc = visualQc.replace(/Aynı görsel tekrar ediyor: sahne başına farklı seed \+ farklı kadraj zorla \(IMAGE_FIXED_SEED=1 açık olabilir\)\./g, 'Aynı procedural kompozisyon tekrar ediyor: motif, şablon ve varyant dağılımını çeşitlendir.');
await writeFile('src/pipeline/visualNarrationQC.js', visualQc, 'utf8');

await writeFile('test/subjectAndAction.test.js', `import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport {\n  scoreSemanticAction, assessSemanticActions, assessListStructure, declaredListCount,\n  assessCta, detectRepetition,\n} from '../src/pipeline/storyAudit.js';\n\ntest('dekoratif halka semantik eylem sayılmaz', () => {\n  const result = scoreSemanticAction({narration: 'the mechanism opens', actors: [{type: 'ring'}], focus: {x: .5, y: .5}});\n  assert.equal(result.completionScore, 0);\n});\n\ntest('procedural hareket dizisi semantik eylemdir', () => {\n  const result = scoreSemanticAction({narration: 'the gears rotate and unlock the door', hasSequence: true, actors: []});\n  assert.equal(result.motionOrTransformationVisible, true);\n});\n\ntest('dekoratif sahneler ortalamada saklanmaz', () => {\n  const result = assessSemanticActions([\n    {narration: 'x', actors: [{type: 'ring'}], focus: {x:.5,y:.5}},\n    {narration: 'y', actors: [{type: 'ring'}], focus: {x:.4,y:.4}},\n  ]);\n  assert.equal(result.average, 0);\n  assert.equal(result.decorativeOnly, 2);\n});\n\ntest('liste vaadi tam sayıda marker ister', () => {\n  assert.equal(declaredListCount('5 Incredible Facts'), 5);\n  const bad = assessListStructure({hook_text:'5 Incredible Facts', scenes:[1,2,3,4].map((n)=>({narration:'x',list_index:n}))});\n  assert.equal(bad.valid, false);\n  const good = assessListStructure({hook_text:'5 Incredible Facts', scenes:[1,2,3,4,5].map((n)=>({narration:'x',list_index:n}))});\n  assert.equal(good.valid, true);\n});\n\ntest('CTA yoksa kapı sessizdir', () => {\n  assert.deepEqual(assessCta({ctaStart:null}), {present:false, interruptsReveal:false});\n});\n\ntest('tekrar eden anlatım yakalanır', () => {\n  const result = detectRepetition({narrations:['same line','other','same line'],captionStarts:[]});\n  assert.equal(result.status, 'fail');\n});\n`, 'utf8');

await writeFile('test/hummingbirdRegression.test.js', `import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport {readFile} from 'node:fs/promises';\nimport {assignListMarkers, assessListStructure} from '../src/pipeline/storyAudit.js';\nimport {planScene} from '../src/crew/storyPlanner.js';\n\ntest('hook liste vaat etmiyorsa numara atanmaz', () => {\n  const script={hook_text:\"See colors we can't?\",title:'5 colors humans miss',scenes:Array.from({length:10},()=>({narration:'x'}))};\n  const result=assignListMarkers(script);\n  assert.equal(result.declared,null); assert.equal(result.assigned,0); assert.equal(assessListStructure(script).declared,false);\n});\n\ntest('hook liste vaat ediyorsa numara atanır', () => {\n  const script={hook_text:'5 incredible facts',scenes:Array.from({length:10},()=>({narration:'x'}))};\n  const result=assignListMarkers(script); assert.equal(result.declared,5); assert.equal(result.assigned,5);\n});\n\ntest('tek renderer premium Remotiondur', async () => {\n  const source=await readFile('src/video/renderVideo.js','utf8'); assert.match(source,/renderRemotion/); assert.doesNotMatch(source,/drawtext|filter_complex/);\n});\n\ntest('karşıtlık cümlesi comparison şablonu alır', () => {\n  assert.equal(planScene({narration:'Unlike humans with three, hummingbirds possess four distinct types'}).story_template,'comparison');\n});\n\ntest('ölçek cümlesi scale şablonu alır', () => {\n  assert.equal(planScene({narration:'The nest is as tall as a two storey house'}).story_template,'scale');\n});\n`, 'utf8');

await writeFile('test/semanticNarration.test.js', `import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport {classifyBeat, directSemantics} from '../src/visual/semanticDirector.js';\nimport {assessVisualNarration} from '../src/pipeline/visualNarrationQC.js';\n\ntest('süreç, karşılaştırma, sayı ve konum cümleleri sınıflandırılır', () => {\n  assert.equal(classifyBeat('Coral releases signals that travel through water and reach fish').kind,'process');\n  assert.equal(classifyBeat('Reef fish are twice as fast as predators').kind,'compare');\n  assert.equal(classifyBeat('Over 4000 species live here').kind,'number');\n  assert.equal(classifyBeat('These reefs sit off the coast of Australia').payload.place,'AUSTRALIA');\n});\n\ntest('dolgu cümlesi semantik beat üretmez', () => { assert.equal(classifyBeat('It was a quiet ordinary afternoon'),null); });\n\ntest('directSemantics yalnız gösterilebilir cümleleri planlar', () => {\n  const timeline=['signals travel through water','quiet ordinary afternoon','over 4000 species live here'].map((narration,index)=>({narration,index,start:index*3,end:index*3+3}));\n  const {beats,stats}=directSemantics(timeline); assert.equal(beats.length,2); assert.equal(stats.none,1);\n});\n\ntest('görsel anlatım QC aynı procedural asset kimliğini yakalar', () => {\n  const items=Array.from({length:10},()=>({assetId:'procedural:same'}));\n  const report=assessVisualNarration({items,beats:[],motionPlan:new Array(10).fill({}),duration:39});\n  assert.equal(report.passed,false); assert.equal(report.metrics.uniqueVisuals,1);\n});\n\ntest('çeşitli procedural şablonlar QC kapısını geçer', () => {\n  const items=Array.from({length:11},(_,index)=>({assetId:\`procedural:template:\${index}\`}));\n  const beats=[{kind:'process',index:0,start:1},{kind:'number',index:2,start:8},{kind:'compare',index:4,start:15},{kind:'location',index:6,start:22}];\n  const report=assessVisualNarration({items,beats,motionPlan:new Array(11).fill({}),duration:39});\n  assert.equal(report.passed,true,JSON.stringify(report.failures));\n});\n`, 'utf8');

let v3 = await readFile('test/v3Editorial.test.js', 'utf8');
v3 = replaceBetween(
  v3,
  '// ---------------- §13 ALTYAZI ----------------',
  "test('SESSİZ HATA REGRESYONU",
  `// ---------------- §13 PREMIUM TEXT POLICY ----------------\n` +
  `test('premium format konuşmayı tekrar eden altyazı taşımaz', () => {\n` +
  `  assert.equal(config.video.captionPolicy, 'none');\n` +
  `  assert.equal(config.video.visualPolicy, 'procedural-only');\n` +
  `});\n\n` +
  `test('SESSİZ HATA REGRESYONU`,
  'v3 caption tests',
);
await writeFile('test/v3Editorial.test.js', v3, 'utf8');

const deletePaths = [
  'src/audio/fetchAmbience.js','src/audio/semanticSfx.js','src/audio/sfxPlan.js',
  'src/crew/promptStyle.js','src/crew/subjectBible.js','src/crew/visualDirector.js',
  'src/media/fetchArchive.js','src/media/fetchMedia.js','src/media/generateImages.js','src/media/imageHash.js','src/media/renderTemplate.js',
  'src/video/captionIntegrity.js','src/video/captionLayout.js','src/youtube/captions.js','src/visual/sideIdentity.js',
  'scripts/dry-run-gates.js','scripts/fetch-media.js','scripts/plan-premium-prune.mjs',
  'test/imageProviderChain.test.js','test/captionIntegrity.test.js','test/captionLayout.test.js','test/semanticSfx.test.js','test/sfxPlan.test.js',
  '.github/workflows/premium-prune-audit.yml',
];
for (const file of deletePaths) await rm(file, {force:true});
console.log(`Premium legacy subsystem pruned: ${deletePaths.length} files removed.`);
