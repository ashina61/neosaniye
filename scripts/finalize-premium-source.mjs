#!/usr/bin/env node
import {readFile, writeFile, readdir} from 'node:fs/promises';
import path from 'node:path';

const runPath = 'src/pipeline/run.js';
let source = await readFile(runPath, 'utf8');

const replacements = [
  ['  try {  try {', '  try {'],
  ['    // 2.9) GÖRSEL HİKÂYE PLANI    // 2.9) GÖRSEL HİKÂYE PLANI — SIRALAMA BURADA TERSİNE DÖNER (V3 Faz 2).', '    // 2.9) GÖRSEL HİKÂYE PLANI — anlatım önce procedural sahne şablonuna bağlanır.'],
  ['    // 4) Remotion motion-graphics renderı    // 4) Remotion motion-graphics renderı', '    // 4) Remotion motion-graphics renderı'],
  ["    // Son 5 videonun müziği tekrar seçilmesin (çeşitlilik; state yoksa boş).\n    const recentMusic = await getRecentMusic(5).catch(() => []);\n", ''],
];
for (const [before, after] of replacements) {
  if (source.includes(before)) source = source.replace(before, after);
}
for (const forbidden of ['getRecentMusic(', 'generateImages(', 'buildSrtFromWords(', 'uploadCaptions(', 'fetchAmbienceTrack(']) {
  if (source.includes(forbidden)) throw new Error(`run.js still contains ${forbidden}`);
}
await writeFile(runPath, source, 'utf8');

async function walk(root) {
  const out = [];
  for (const entry of await readdir(root, {withFileTypes: true}).catch(() => [])) {
    const file = path.join(root, entry.name);
    if (entry.isDirectory()) out.push(...await walk(file));
    else if (/\.(?:js|mjs|ts|tsx|json|yml|yaml|md)$/.test(entry.name)) out.push(file);
  }
  return out;
}

const files = (await Promise.all(['src', 'scripts', 'test', '.github', 'docs'].map(walk))).flat();
const needles = [
  'generateImages', 'visualDirector', 'fetchAmbience', 'buildSrtFromWords', 'uploadCaptions',
  'captionIntegrity', 'captionLayout', 'PEXELS_API_KEY', 'PIXABAY_API_KEY', 'HUGGINGFACE_API_KEY',
  'TOGETHER_API_KEY', 'FREESOUND_API_KEY', 'renderTemplate', 'imageHash', 'semanticRelevance',
];
const matches = {};
for (const file of files) {
  const text = await readFile(file, 'utf8').catch(() => '');
  for (const needle of needles) {
    if (text.includes(needle)) (matches[needle] ||= []).push(file);
  }
}
await writeFile('premium-dead-code-report.json', JSON.stringify({generatedAt: new Date().toISOString(), matches}, null, 2) + '\n');
console.log('Premium source finalized; legacy reference audit written.');
