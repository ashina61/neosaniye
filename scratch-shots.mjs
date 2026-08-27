import path from 'node:path';
import fs from 'node:fs/promises';
import {bundle} from '@remotion/bundler';
import {renderStill, selectComposition} from '@remotion/renderer';
import {sceneOffsets} from './engine/schema.mjs';
import {ROOT, episodeDir, loadConfig, pruneOptionalAssets, writeSceneOverrides} from './scripts/lib/episode.mjs';

const SCRATCH = '/tmp/claude-0/-home-user-neosaniye/06d260fe-0ac4-5b60-a721-2622b642b579/scratchpad/shots';
const id = process.argv[2];
const only = process.argv[3] ? process.argv[3].split(',') : null;
const AT = [0, 0.33, 0.66, 0.94];

const {config} = await loadConfig(id);
await pruneOptionalAssets(config, id);
await writeSceneOverrides(id);
const offsets = sceneOffsets(config);
const browserExecutable = process.env.REMOTION_BROWSER_EXECUTABLE;
const serveUrl = await bundle({entryPoint: path.join(ROOT, 'engine', 'index.ts'), publicDir: episodeDir(id), onProgress: () => undefined});
const composition = await selectComposition({serveUrl, id: 'Episode', inputProps: {}, browserExecutable});
await fs.mkdir(`${SCRATCH}/${id}`, {recursive: true});
const index = [];
for (let i = 0; i < config.scenes.length; i++) {
  const s = config.scenes[i];
  if (only && !only.includes(s.id)) continue;
  const start = offsets[i];
  const dur = s.durationInFrames;
  for (const a of AT) {
    const f = start + Math.min(dur - 1, Math.round(a * dur));
    const out = `${SCRATCH}/${id}/${String(i).padStart(2, '0')}-${s.id}-${Math.round(a * 100)}.png`;
    await renderStill({composition, serveUrl, output: out, frame: f, overwrite: true, inputProps: {}, browserExecutable});
    index.push({scene: i, id: s.id, at: a, frame: f, file: out});
  }
  console.log(`${String(i).padStart(2, '0')} ${s.id.padEnd(18)} ${s.sceneType.padEnd(20)} ${(dur / config.fps).toFixed(2)}s  frames ${start}..${start + dur - 1}`);
}
await fs.writeFile(`${SCRATCH}/${id}/index.json`, JSON.stringify(index, null, 2));
