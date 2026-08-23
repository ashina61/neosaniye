import path from 'node:path';
import {bundle} from '@remotion/bundler';
import {renderStill, selectComposition} from '@remotion/renderer';
import {ROOT, episodeDir, loadConfig, pruneOptionalAssets, writeSceneOverrides} from './scripts/lib/episode.mjs';

const id = process.argv[2];
const picks = process.argv.slice(3).map(Number);
const {config} = await loadConfig(id);
await pruneOptionalAssets(config, id);
await writeSceneOverrides(id);
const serveUrl = await bundle({entryPoint: path.join(ROOT, 'engine', 'index.ts'), publicDir: episodeDir(id), onProgress: () => undefined});
const inputProps = {config};
const browserExecutable = process.env.REMOTION_BROWSER_EXECUTABLE || undefined;
const composition = await selectComposition({serveUrl, id: 'Episode', inputProps, browserExecutable});
const dir = '/tmp/claude-0/-home-user-neosaniye/06d260fe-0ac4-5b60-a721-2622b642b579/scratchpad';
for (const f of picks) {
  const out = `${dir}/f-${id}-${f}.png`;
  await renderStill({composition, serveUrl, output: out, frame: f, overwrite: true, inputProps, browserExecutable});
  console.log(out);
}
