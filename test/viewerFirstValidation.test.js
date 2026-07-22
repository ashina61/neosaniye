import test from 'node:test';
import assert from 'node:assert/strict';
import { validateViewerFirstScript, validatePacing, validateAssetRepetition } from '../src/pipeline/viewerFirstValidation.js';

test('rejects generic hooks and like-only CTA', () => {
  const r = validateViewerFirstScript({ hook_text: 'Did you know', cta: 'Like for more', scenes: [{ narration: 'Did you know this fact?', image_prompt: 'fact card' }] });
  assert.ok(r.failures.includes('WEAK_GENERIC_HOOK'));
  assert.ok(r.failures.includes('SUBSCRIBE_CTA_MISSING'));
  assert.ok(r.failures.includes('LIKE_CTA_FORBIDDEN'));
});

test('visual repetition detects duplicate selected assets', () => {
  const issues = validateAssetRepetition([{ assetId: 'a', source: 'stock' }, { assetId: 'a', source: 'stock' }]);
  assert.ok(issues.includes('VISUAL_ASSET_REPEATED:0:1'));
});

test('accepts aligned concrete hook and subscribe CTA', () => {
  const r = validateViewerFirstScript({
    hook_text: 'Octopuses vanish instantly', cta: 'Subscribe for the next ocean secret.', finale_text: 'skin becomes the disguise',
    scenes: [
      { narration: 'An octopus can vanish against coral in less than a second.', image_prompt: 'octopus vanishing against coral reef' },
      { narration: 'Pigment cells spread color across its skin.' },
      { narration: 'But texture cells also copy the coral surface.', beat: 'rehook' },
      { narration: "That is why its skin becomes the complete disguise." },
    ],
  });
  assert.equal(r.ok, true);
});

test('rejects an opening without a promise, question, contradiction, or number', () => {
  const r = validateViewerFirstScript({
    hook_text: 'Honeybees navigate home',
    cta: 'Subscribe for more nature stories.',
    finale_text: 'The answer is their sun compass.',
    scenes: Array.from({ length: 8 }, (_, i) => ({
      narration: i === 0
        ? 'Honeybees navigate home using familiar landscape details every day.'
        : i === 4
          ? 'But polarized light gives their internal compass another reliable signal.'
          : i === 7
            ? 'The answer is their sun compass and remembered landscape.'
            : 'Workers compare changing light with familiar flowers near their hive.',
      image_prompt: 'honeybee navigating flowers in sunlight',
    })),
  });
  assert.ok(r.failures.includes('HOOK_PROMISE_MISSING'));
});

test('pacing flags long opening holds and decorative transition excess', () => {
  const issues = validatePacing({
    timeline: { items: [{ duration: 4 }, { duration: 2 }, { duration: 1 }] },
    mediaItems: [{ type: 'photo' }, { type: 'photo' }, { type: 'photo' }], transitions: ['fade', 'wipe'],
  });
  assert.ok(issues.includes('FIRST_VISUAL_HELD_TOO_LONG'));
  assert.ok(issues.includes('TOO_MANY_TRANSITIONS'));
});
