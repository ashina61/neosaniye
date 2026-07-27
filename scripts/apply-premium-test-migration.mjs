#!/usr/bin/env node
import {readFile, writeFile} from 'node:fs/promises';

const filePath = 'test/uploadSafety.test.js';
let source = await readFile(filePath, 'utf8');
const marker = '// ---------------- MEDYA ALANLARI DOĞRULAMAYA ULAŞMALI ----------------';
const start = source.indexOf(marker);
if (start < 0) {
  if (/procedural storyboard kimliği render planına ulaşır/.test(source)) {
    console.log('Premium upload-safety test already applied.');
    process.exit(0);
  }
  throw new Error('legacy media mapping test marker not found');
}
source = source.slice(0, start) + `// ---------------- PROCEDURAL STORYBOARD KİMLİĞİ ----------------\n` +
`test('procedural storyboard kimliği render planına ulaşır', async () => {\n` +
`  const src = await readFile('src/pipeline/run.js', 'utf8');\n` +
`  const render = await readFile('src/video/renderRemotion.js', 'utf8');\n` +
`  assert.doesNotMatch(src, /media:\\s*media\\.items|mediaScene:|generateImages/);\n` +
`  assert.match(src, /procedural-remotion/);\n` +
`  assert.match(render, /assetId:\\s*\\`procedural:/);\n` +
`  assert.match(render, /visualPolicy:\\s*'procedural-only'/);\n` +
`  assert.match(render, /captionPolicy:\\s*'none'/);\n` +
`});\n`;
await writeFile(filePath, source, 'utf8');
console.log('Premium upload-safety contract applied.');
