#!/usr/bin/env node
import {readFile, writeFile, rm} from 'node:fs/promises';

function removeExact(source, fragment, label) {
  const count = source.split(fragment).length - 1;
  if (count !== 1) throw new Error(`${label}: expected 1 occurrence, found ${count}`);
  return source.replace(fragment, '');
}

function replaceExact(source, before, after, label) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected 1 occurrence, found ${count}`);
  return source.replace(before, after);
}

function replaceBetween(source, startMarker, endMarker, replacement, label) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0 || end <= start) throw new Error(`${label}: markers not found`);
  if (source.indexOf(startMarker, start + 1) >= 0) throw new Error(`${label}: duplicate start marker`);
  return source.slice(0, start) + replacement + source.slice(end);
}

const runPath = 'src/pipeline/run.js';
let run = await readFile(runPath, 'utf8');
run = removeExact(run, "import { execFile } from 'node:child_process';\n", 'execFile import');
run = removeExact(run, "import { promisify } from 'node:util';\n", 'promisify import');
run = removeExact(run, "const execFileAsync = promisify(execFile);\n", 'execFileAsync declaration');
run = removeExact(run, "import { applyCta } from '../motion/ctaEngine.js';\n", 'CTA import');
run = removeExact(run, "import { getRecentCtaTypes } from '../lib/firestore.js';\n", 'CTA history import');
run = replaceExact(run, '    // 4) Montaj (ffmpeg)\n', '    // 4) Remotion motion-graphics renderı\n', 'phase 4 comment');
run = replaceExact(
  run,
  "    log('Faz 4: Video montajı (ffmpeg)...');\n",
  "    log('Faz 4: Remotion motion-graphics renderı...');\n",
  'phase 4 log',
);
run = replaceBetween(
  run,
  '    // 4.2) NEO MOTION ENGINE',
  '    // 4.5) Yayın öncesi TEKNİK kalite kontrolü',
  `    // CTA ve kinetic typography artık ProductionSpec içinde Remotion tarafından\n` +
    `    // üretilir; final MP4 üzerinde ikinci bir görsel post-pass yoktur.\n` +
    `    const motionReport = {\n` +
    `      enabled: true,\n` +
    `      ctaRequested: false,\n` +
    `      ctaApplied: false,\n` +
    `      selectionReason: 'integrated-in-remotion',\n` +
    `      ctaVerification: null,\n` +
    `      languageMatch: true,\n` +
    `      sfxId: null,\n` +
    `    };\n\n`,
  'legacy CTA block',
);
run = replaceBetween(
  run,
  "    // CTA 'pop' cue'su (ayrı pass'te bindirildi) — o da doğrulanır.",
  '    // SFX kapalıyken doğrulanacak cue yoktur;',
  '',
  'legacy CTA SFX cue block',
);
for (const forbidden of ['applyCta', 'getRecentCtaTypes', 'execFileAsync', 'config.motion']) {
  if (run.includes(forbidden)) throw new Error(`run.js still contains ${forbidden}`);
}
await writeFile(runPath, run, 'utf8');

const configPath = 'src/config.js';
let config = await readFile(configPath, 'utf8');
const motionStart = config.indexOf('  // NEO MOTION ENGINE v1');
const configEndMarker = '\n};\n\nexport function assertYouTube';
const configEnd = config.indexOf(configEndMarker, motionStart);
if (motionStart < 0 || configEnd < 0) throw new Error('config.motion block markers not found');
config = config.slice(0, motionStart) + '};\n\nexport function assertYouTube' + config.slice(configEnd + configEndMarker.length);
if (/\bmotion\s*:\s*\{/.test(config)) throw new Error('config.motion block still exists');
await writeFile(configPath, config, 'utf8');

const testPath = 'test/remotionOnly.test.js';
let testSource = await readFile(testPath, 'utf8');
testSource = replaceExact(
  testSource,
  "  'src/motion/ctaTemplates.js',\n",
  "  'src/motion/ctaTemplates.js',\n  'src/motion/ctaEngine.js',\n",
  'removed CTA path list',
);
const oldTestStart = "test('eski post-render CTA çağrısı videoyu değiştirmeyen uyumluluk katmanıdır'";
const nextTest = "test('Remotion package bağımsız ve sürümleri sabitlenmiştir'";
const start = testSource.indexOf(oldTestStart);
const next = testSource.indexOf(nextTest, start);
if (start < 0 || next < 0) throw new Error('legacy CTA architecture test markers not found');
const newTest = `test('orkestratör eski CTA motorunu ve config.motion ayarını taşımaz', async () => {\n` +
  `  const runSource = await readFile('src/pipeline/run.js', 'utf8');\n` +
  `  const configSource = await readFile('src/config.js', 'utf8');\n` +
  `  assert.doesNotMatch(runSource, /applyCta|getRecentCtaTypes|config\\.motion|execFileAsync/);\n` +
  `  assert.doesNotMatch(configSource, /\\bmotion\\s*:\\s*\\{/);\n` +
  `  assert.match(runSource, /integrated-in-remotion/);\n` +
  `});\n\n`;
testSource = testSource.slice(0, start) + newTest + testSource.slice(next);
await writeFile(testPath, testSource, 'utf8');

await rm('src/motion/ctaEngine.js', {force: true});
await rm('scripts/prune-remotion-compat.mjs', {force: true});
await rm('.github/workflows/remotion-final-prune.yml', {force: true});

console.log('Legacy CTA compatibility layer and config.motion were removed.');
