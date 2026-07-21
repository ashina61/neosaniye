import test from 'node:test';
import assert from 'node:assert/strict';
import { buildVariantEditPlan, inspectProductionPlan, orderVariantMedia } from '../src/video/productionPlan.js';

const items = [
  { scene: 0, type: 'video', path: 'a0' }, { scene: 0, type: 'video', path: 'b0' },
  { scene: 1, type: 'photo', path: 'a1' }, { scene: 1, type: 'video', path: 'b1' },
  { scene: 2, type: 'video', path: 'a2' },
];
const timeline = { scenes: [{ scene: 0, duration: 4 }, { scene: 1, duration: 3 }, { scene: 2, duration: 2 }] };

test('production plan proves moving material, static run, and A/B long scenes', () => {
  assert.deepEqual(inspectProductionPlan(items, timeline), {
    ok: true, movingSegments: 4, maxConsecutiveStatic: 1, unsplitLongScenes: [], failures: [],
  });
});

test('variant plans reuse assets while changing A/B order and transition density', () => {
  const fast = orderVariantMedia(items, 'fast-cut');
  const balanced = orderVariantMedia(items, 'balanced');
  assert.notDeepEqual(fast.map((x) => x.path), balanced.map((x) => x.path));
  assert.equal(buildVariantEditPlan(fast, 'fast-cut').boundaries.length, fast.length - 1);
  assert.equal(buildVariantEditPlan(balanced, 'balanced').boundaries[0].transition, 'cut');
});

test('production plan fails metadata-only motion claims', () => {
  const fake = items.map((x) => ({ ...x, type: 'photo' }));
  const result = inspectProductionPlan(fake, timeline);
  assert.ok(result.failures.includes('MOVING_SEGMENTS_LT_3'));
  assert.ok(result.failures.includes('STATIC_SCENE_RUN_GT_2'));
});
