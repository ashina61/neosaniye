import assert from 'node:assert/strict';
import test from 'node:test';
import {evaluatePreflight} from '../scripts/lib/preflight.mjs';

const tools = {'edge-tts': true, ffmpeg: true, ffprobe: true};
const styleReference = Buffer.alloc(1200);

test('preflight accepts configured story and keyless image providers', () => {
  const result = evaluatePreflight({
    env: {STORY_PROVIDER_CHAIN: 'groq', GROQ_API_KEY: 'secret', IMAGE_PROVIDER_CHAIN: 'pollinations'},
    commands: tools,
    styleReference,
  });
  assert.equal(result.ok, true);
  assert.equal(result.storyProviders[0].available, true);
  assert.equal(result.imageProviders[0].available, true);
});

test('preflight reports provider credentials and command failures', () => {
  const result = evaluatePreflight({
    env: {STORY_PROVIDER_CHAIN: 'groq', IMAGE_PROVIDER_CHAIN: 'openai'},
    commands: {...tools, ffprobe: false},
    styleReference: Buffer.alloc(10),
  });
  assert.equal(result.ok, false);
  assert.match(result.storyProviders[0].reason, /GROQ_API_KEY/);
  assert.match(result.imageProviders[0].reason, /OPENAI_API_KEY/);
  assert.ok(result.errors.includes('Required command is missing: ffprobe.'));
  assert.ok(result.errors.includes('Style reference is missing or invalid.'));
});

test('preflight rejects unsupported providers instead of silently skipping all', () => {
  const result = evaluatePreflight({env: {STORY_PROVIDER_CHAIN: 'made-up', IMAGE_PROVIDER_CHAIN: 'pollinations'}, commands: tools, styleReference});
  assert.equal(result.ok, false);
  assert.equal(result.storyProviders[0].reason, 'unsupported-provider');
});
