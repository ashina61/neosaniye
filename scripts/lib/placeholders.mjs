/**
 * THE STAND-IN LEDGER.
 *
 * A placeholder and a finished drawing are both just a PNG on disk, so nothing
 * downstream can tell them apart — the validator passes, the render succeeds,
 * and an episode of labelled grey boxes looks exactly like a finished one. This
 * file is the difference: the placeholder script adds names to it, the
 * generator removes the ones it has really drawn, and the validator says out
 * loud how many are left.
 *
 * It is a note, not a gate. A stand-in is a legitimate state for an episode
 * being cut; pretending it is finished is not.
 */
import {readFile, rm, writeFile} from 'node:fs/promises';
import path from 'node:path';

const LEDGER = 'assets/.placeholders.json';

export async function readPlaceholders(episodeDirPath) {
  return readFile(path.join(episodeDirPath, LEDGER), 'utf8')
    .then((raw) => {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed?.placeholders) ? parsed.placeholders : [];
    })
    .catch(() => []);
}

async function write(episodeDirPath, names) {
  const file = path.join(episodeDirPath, LEDGER);
  if (!names.length) {
    await rm(file, {force: true});
    return;
  }
  await writeFile(
    file,
    `${JSON.stringify(
      {
        $comment:
          'These assets are stand-ins, not finished artwork. scripts/generate-assets.mjs removes each name as it draws it for real.',
        placeholders: [...names].sort(),
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
}

/** Adds names to the ledger. */
export async function markPlaceholders(episodeDirPath, names) {
  if (!names.length) return;
  const existing = await readPlaceholders(episodeDirPath);
  await write(episodeDirPath, [...new Set([...existing, ...names])]);
}

/** Removes names from the ledger — they have been drawn for real. */
export async function clearPlaceholders(episodeDirPath, names) {
  if (!names.length) return;
  const existing = await readPlaceholders(episodeDirPath);
  const drawn = new Set(names);
  const remaining = existing.filter((name) => !drawn.has(name));
  if (remaining.length !== existing.length) await write(episodeDirPath, remaining);
}
