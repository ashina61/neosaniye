import test from 'node:test';
import assert from 'node:assert/strict';
import {renderWithConfiguredEngine, resolveRenderPolicy} from '../src/video/renderRouter.js';

const quiet = {log() {}, warn() {}, error() {}};

test('defaults to the existing FFmpeg renderer', async () => {
  const calls = [];
  const result = await renderWithConfiguredEngine({id: 1}, {
    env: {},
    logger: quiet,
    ffmpegRenderer: async (job) => { calls.push(['ffmpeg', job]); return {outPath: 'old.mp4'}; },
    remotionRenderer: async () => { throw new Error('should not run'); },
  });
  assert.equal(result.renderEngine, 'ffmpeg');
  assert.equal(result.outPath, 'old.mp4');
  assert.deepEqual(calls, [['ffmpeg', {id: 1}]]);
});

test('uses Remotion only when explicitly selected', async () => {
  const result = await renderWithConfiguredEngine({id: 2}, {
    env: {RENDER_ENGINE: 'remotion', REMOTION_MODE: 'shadow'},
    logger: quiet,
    ffmpegRenderer: async () => { throw new Error('should not run'); },
    remotionRenderer: async () => ({outPath: 'new.mp4'}),
  });
  assert.equal(result.renderEngine, 'remotion');
  assert.equal(result.outPath, 'new.mp4');
});

test('shadow mode may use an explicitly enabled FFmpeg fallback', async () => {
  const result = await renderWithConfiguredEngine({}, {
    env: {RENDER_ENGINE: 'remotion', REMOTION_MODE: 'shadow', REMOTION_FALLBACK: 'ffmpeg'},
    logger: quiet,
    remotionRenderer: async () => { throw new Error('render exploded'); },
    ffmpegRenderer: async () => ({outPath: 'fallback.mp4'}),
  });
  assert.equal(result.renderEngine, 'ffmpeg-fallback');
  assert.equal(result.outPath, 'fallback.mp4');
  assert.match(result.remotionFailure, /render exploded/);
});

test('public Remotion mode always fails closed even when fallback is requested', async () => {
  let fallbackCalled = false;
  await assert.rejects(
    renderWithConfiguredEngine({}, {
      env: {RENDER_ENGINE: 'remotion', REMOTION_MODE: 'public', REMOTION_FALLBACK: 'ffmpeg'},
      logger: quiet,
      remotionRenderer: async () => { throw new Error('public render failed'); },
      ffmpegRenderer: async () => { fallbackCalled = true; return {}; },
    }),
    /public render failed/,
  );
  assert.equal(fallbackCalled, false);
});

test('invalid policy values return conservative defaults', () => {
  const policy = resolveRenderPolicy({
    RENDER_ENGINE: 'magic',
    REMOTION_MODE: 'live-now',
    REMOTION_FALLBACK: 'always',
  });
  assert.equal(policy.engine, 'ffmpeg');
  assert.equal(policy.mode, 'shadow');
  assert.equal(policy.fallback, 'none');
  assert.equal(policy.invalidEngine, true);
});
