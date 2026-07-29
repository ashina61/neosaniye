import assert from 'node:assert/strict';
import test from 'node:test';
import {validateStory} from '../scripts/lib/story-schema.mjs';

const narration = Array.from({length: 100}, (_, index) => `word${index}`).join(' ');
const story = () => ({
  slug: 'valid-story',
  title: 'Valid Story',
  language: 'en',
  targetDurationSeconds: 42,
  narration,
  scenes: Array.from({length: 8}, (_, index) => ({
    id: `scene-${String(index + 1).padStart(2, '0')}`,
    voiceover: `Narration beat ${index + 1}`,
    headline: `Scene Headline ${index + 1}`,
    visualPrompt: `Vertical historical collage scene ${index + 1}`,
    camera: 'slow-push-in',
    sfx: 'none',
    image: `generated/valid-story/scene-${String(index + 1).padStart(2, '0')}.jpg`,
  })),
});

test('validateStory accepts a complete factory story', () => {
  const value = story();
  assert.equal(validateStory(value, {requireImages: true}), value);
});

test('validateStory rejects duplicate scenes and invalid enums', () => {
  const duplicate = story();
  duplicate.scenes[1].id = duplicate.scenes[0].id;
  assert.throws(() => validateStory(duplicate), /Duplicate scene id/);
  const camera = story();
  camera.scenes[0].camera = 'zoom-wildly';
  assert.throws(() => validateStory(camera), /camera is unsupported/);
});

test('validateStory enforces duration, narration, and safe image paths', () => {
  const duration = story();
  duration.targetDurationSeconds = 50;
  assert.throws(() => validateStory(duration), /between 40 and 45/);
  const short = story();
  short.narration = 'too short';
  assert.throws(() => validateStory(short), /90-132 words/);
  const unsafe = story();
  unsafe.scenes[0].image = '../secret.jpg';
  assert.throws(() => validateStory(unsafe, {requireImages: true}), /inside public/);
});
