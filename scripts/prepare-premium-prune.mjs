#!/usr/bin/env node
import {readFile, writeFile} from 'node:fs/promises';

const file = 'scripts/prune-premium-legacy.mjs';
let source = await readFile(file, 'utf8');
const before = "for (const name of ['images', 'pexels', 'pixabay', 'freesound']) config = removeProperty(config, name);";
const after = "for (const name of ['images', 'pexels', 'pixabay', 'freesound']) { let guard = 0; while (propertyRange(config, name)) { config = removeProperty(config, name); if (++guard > 10) throw new Error(`provider removal loop: ${name}`); } }";
if (source.includes(before)) source = source.replace(before, after);
if (!source.includes('provider removal loop')) throw new Error('provider removal loop patch not applied');
await writeFile(file, source, 'utf8');
console.log('Premium prune script prepared.');
