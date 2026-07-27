#!/usr/bin/env node
import {readFile, writeFile} from 'node:fs/promises';

const target = new URL('../src/pipeline/run.js', import.meta.url);
const original = await readFile(target, 'utf8');
const before = "import { renderVideo } from '../video/renderVideo.js';";
const after = "import { renderWithConfiguredEngine as renderVideo } from '../video/renderRouter.js';";

if (!original.includes(before)) {
  throw new Error('REMOTION_SHADOW_PATCH_TARGET_NOT_FOUND');
}
if ((original.match(new RegExp(before.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length !== 1) {
  throw new Error('REMOTION_SHADOW_PATCH_TARGET_NOT_UNIQUE');
}

await writeFile(target, original.replace(before, after), 'utf8');
console.log('[remotion-shadow] Phase 4 import redirected to renderRouter for this Actions workspace only.');
