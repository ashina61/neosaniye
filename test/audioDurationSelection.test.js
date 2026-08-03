import test from 'node:test';
import assert from 'node:assert/strict';
import { selectAuthoritativeDuration } from '../src/tts/generateAudio.js';

test('decoded audio duration wins over broken MP3 metadata', () => {
  assert.equal(
    selectAuthoritativeDuration({ decoded: 49.8, metadata: 8.1, timing: 49.5 }),
    49.8,
  );
});

test('subtitle timing is used when decode measurement is unavailable', () => {
  assert.equal(
    selectAuthoritativeDuration({ decoded: 0, metadata: 8.1, timing: 49.5 }),
    49.5,
  );
});
