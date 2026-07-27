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
`  const renderStart = src.indexOf('const video = await renderVideo({');\n` +
`  const renderEnd = src.indexOf('const vnQC = assessVisualNarration', renderStart);\n` +
`  const renderCall = src.slice(renderStart, renderEnd);\n` +
`  assert.ok(renderStart >= 0 && renderEnd > renderStart, 'renderVideo çağrısı bulunamadı');\n` +
`  assert.doesNotMatch(renderCall, /media|mediaScene|assets/);\n` +
`  assert.doesNotMatch(src, /generateImages/);\n` +
`  assert.match(src, /procedural-remotion/);\n` +
`  assert.match(render, /procedural:/);\n` +
`  assert.match(render, /visualPolicy:\\s*'procedural-only'/);\n` +
`  assert.match(render, /captionPolicy:\\s*'none'/);\n` +
`});\n`;
await writeFile(filePath, source, 'utf8');
console.log('Premium upload-safety contract applied.');
