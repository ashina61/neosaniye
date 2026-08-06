/**
 * THE GUARD THAT KEEPS A SECOND EPISODE FREE.
 *
 * The engine is allowed to know about ROLES ("character", "background") and
 * about the shape of a config. It is never allowed to know about a FILE or an
 * EPISODE. The moment one asset name leaks into a template, episode two stops
 * being a folder and becomes a code change — and that happens quietly, in a
 * one-line "just for now" default, which is exactly why it needs a test rather
 * than a rule in a document.
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readdir, readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENGINE = path.join(ROOT, 'engine');

/** Written just before each bundle; it is the one file allowed to reach out. */
const GENERATED = 'episodeScenes.generated.ts';

async function engineFiles(dir = ENGINE) {
  const out = [];
  for (const entry of await readdir(dir, {withFileTypes: true})) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await engineFiles(full)));
    } else if (/\.(ts|tsx|mjs)$/.test(entry.name) && entry.name !== GENERATED) {
      out.push(full);
    }
  }
  return out;
}

/** Strip comments so prose about "assets/character.png" is not a violation. */
function code(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

test('no engine file names an asset file', async () => {
  const offenders = [];
  for (const file of await engineFiles()) {
    const body = code(await readFile(file, 'utf8'));
    const hits = body.match(/[\w./-]+\.(png|jpe?g|webp|gif|svg|mp4|mov|mp3|wav|m4a)\b/gi) ?? [];
    for (const hit of hits) {
      offenders.push(`${path.relative(ROOT, file)}: ${hit}`);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `engine/ must never name an asset file — templates read names from the config:\n${offenders.join('\n')}`,
  );
});

test('no engine file reaches into episodes/', async () => {
  const offenders = [];
  for (const file of await engineFiles()) {
    const body = code(await readFile(file, 'utf8'));
    if (/episodes\//.test(body)) offenders.push(path.relative(ROOT, file));
  }
  assert.deepEqual(
    offenders,
    [],
    `engine/ must not reference episodes/ — only the generated override module may:\n${offenders.join('\n')}`,
  );
});

test('no engine file hardcodes a shipped episode id', async () => {
  const ids = (await readdir(path.join(ROOT, 'episodes'), {withFileTypes: true}))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
  assert.ok(ids.length > 0, 'expected at least one episode to guard against');

  const offenders = [];
  for (const file of await engineFiles()) {
    const body = code(await readFile(file, 'utf8'));
    for (const id of ids) {
      if (body.includes(id)) offenders.push(`${path.relative(ROOT, file)}: ${id}`);
    }
  }
  assert.deepEqual(offenders, [], `engine/ must not mention an episode by id:\n${offenders.join('\n')}`);
});
