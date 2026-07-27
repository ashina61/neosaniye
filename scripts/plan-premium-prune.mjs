#!/usr/bin/env node
import {readdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';

async function walk(root) {
  const result = [];
  for (const entry of await readdir(root, {withFileTypes: true}).catch(() => [])) {
    const target = path.join(root, entry.name);
    if (entry.isDirectory()) result.push(...await walk(target));
    else if (/\.(?:js|mjs|ts|tsx)$/.test(entry.name)) result.push(target);
  }
  return result;
}

const roots = ['src', 'scripts', 'test'];
const files = (await Promise.all(roots.map(walk))).flat().map((file) => path.normalize(file));
const fileSet = new Set(files.map((file) => path.resolve(file)));
const incoming = new Map(files.map((file) => [path.resolve(file), []]));
const importRe = /(?:from\s*|import\s*\(|require\s*\()\s*['"]([^'"]+)['"]/g;
const configUsage = {video: {}, images: {}, pexels: {}, pixabay: {}, freesound: {}};

for (const importer of files) {
  const source = await readFile(importer, 'utf8').catch(() => '');
  for (const match of source.matchAll(importRe)) {
    const specifier = match[1];
    if (!specifier.startsWith('.')) continue;
    const base = path.resolve(path.dirname(importer), specifier);
    const possibilities = [base, `${base}.js`, `${base}.mjs`, `${base}.ts`, `${base}.tsx`, path.join(base, 'index.js')];
    const resolved = possibilities.find((candidate) => fileSet.has(candidate));
    if (resolved) incoming.get(resolved)?.push(path.normalize(importer));
  }
  for (const section of Object.keys(configUsage)) {
    const re = new RegExp(`config\\.${section}\\.([A-Za-z0-9_]+)`, 'g');
    for (const match of source.matchAll(re)) {
      const field = match[1];
      (configUsage[section][field] ||= []).push(importer);
    }
  }
}

const focusPrefixes = ['src/media/', 'src/crew/', 'src/visual/', 'src/video/', 'src/audio/'];
const focus = files.filter((file) => focusPrefixes.some((prefix) => file.startsWith(prefix)));
const legacyPattern = /(generateImages|fetchMedia|Pexels|Pixabay|Pollinations|Together|Hugging|imageHash|renderTemplate|visualDirector|promptStyle|sideIdentity|subjectBible|caption|subtitle|fetchAmbience|freesound)/i;
const report = focus.map((file) => ({file, incoming: incoming.get(path.resolve(file)) || [], legacyNamed: legacyPattern.test(file)}));
const removableRoots = report.filter((entry) => entry.legacyNamed && entry.incoming.length === 0).map((entry) => entry.file);
await writeFile('premium-prune-plan.json', JSON.stringify({generatedAt: new Date().toISOString(), report, removableRoots, configUsage}, null, 2) + '\n');
console.log(`Audited ${focus.length} focused files; ${removableRoots.length} unreferenced legacy roots.`);
