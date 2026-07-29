import {spawnSync} from 'node:child_process';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import {commandVersionArguments, evaluatePreflight} from './lib/preflight.mjs';

const ROOT = process.cwd();

function commandAvailable(command) {
  const result = spawnSync(command, commandVersionArguments(command), {encoding: 'utf8', timeout: 15000});
  return !result.error && result.status === 0;
}

async function main() {
  const styleText = await readFile(path.join(ROOT, 'content', 'style', 'vox-reference.base64'), 'utf8');
  const result = evaluatePreflight({
    env: process.env,
    commands: Object.fromEntries(['edge-tts', 'ffmpeg', 'ffprobe'].map((name) => [name, commandAvailable(name)])),
    styleReference: Buffer.from(styleText.trim(), 'base64'),
  });
  const output = path.join(ROOT, 'out', 'factory', 'preflight.json');
  await mkdir(path.dirname(output), {recursive: true});
  await writeFile(output, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) throw new Error(`Factory preflight failed: ${result.errors.join(' ')}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
