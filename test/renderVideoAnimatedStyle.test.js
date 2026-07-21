import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { renderVideo } from '../src/video/renderVideo.js';
import { config } from '../src/config.js';

const run = promisify(execFile);

test('animated render plan reaches the real montage path without a scope error', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'animated-render-'));
  const original = {
    outro: config.video.outro,
    tailSeconds: config.video.tailSeconds,
    subPrompt: config.video.subPrompt,
  };
  try {
    config.video.outro = false;
    config.video.tailSeconds = 0;
    config.video.subPrompt = false;

    const audioPath = path.join(dir, 'voice.wav');
    const imagePath = path.join(dir, 'scene.png');
    const outPath = path.join(dir, 'render.mp4');
    await run('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=1', audioPath]);
    await run('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'color=c=navy:s=64x96', '-frames:v', '1', imagePath]);

    const result = await renderVideo({
      audioPath,
      media: [{ path: imagePath, type: 'photo' }],
      outPath,
      visualStyle: 'animated',
      scenes: [{ narration: 'A tiny animated render.' }],
    }, { width: 64, height: 96, fps: 5, workDir: path.join(dir, 'work') });

    assert.equal(result.outPath, outPath);
    assert.ok(result.duration > 0);
  } finally {
    Object.assign(config.video, original);
    await rm(dir, { recursive: true, force: true });
  }
});
