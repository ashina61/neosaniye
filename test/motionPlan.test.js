import test from 'node:test';
import assert from 'node:assert/strict';
import { selectSceneMotion, validateMotionPlan } from '../src/video/motionPlan.js';

test('keeps diagrams static and uses content-led detail zoom', () => {
  assert.equal(selectSceneMotion({ image_prompt: 'labeled diagram' }, { source: 'gfx', type: 'photo' }).type, 'static-hold');
  assert.equal(selectSceneMotion({ image_prompt: 'macro close-up mechanism' }, { source: 'ai', type: 'photo' }).type, 'detail-zoom');
});

test('motion validation catches excessive zoom and duration mismatch', () => {
  const issues = validateMotionPlan([{ type: 'detail-zoom', maxZoom: 1.2, duration: 2 }], [3]);
  assert.ok(issues.includes('MOTION_EXCESSIVE_ZOOM:0'));
  assert.ok(issues.includes('MOTION_DURATION_MISMATCH:0'));
});
