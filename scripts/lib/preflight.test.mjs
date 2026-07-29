import assert from 'node:assert/strict';
import test from 'node:test';
import {commandVersionArguments} from './preflight.mjs';

test('uses the single-dash version flag required by FFmpeg tools', () => {
  assert.deepEqual(commandVersionArguments('ffmpeg'), ['-version']);
  assert.deepEqual(commandVersionArguments('ffprobe'), ['-version']);
});

test('uses the conventional long version flag for other commands', () => {
  assert.deepEqual(commandVersionArguments('edge-tts'), ['--version']);
});
