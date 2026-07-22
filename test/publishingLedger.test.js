import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  buildPublishingAttemptId,
  DURABLE_PUBLISHING_STATE_ERROR,
  readPublishingAttempt,
  requireDurablePublishingState,
  reservePublishingAttempt,
  updatePublishingPlatform,
} from '../src/pipeline/publishingLedger.js';

const SCRIPT = {
  normalizedTopic: 'same-story', title: 'Same Story', hook_text: 'This changed everything',
  scenes: [{ narration: 'The exact same narration.' }], finale_text: 'Now you know why.',
};

async function withLedger(fn) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'publishing-ledger-'));
  try { return await fn(path.join(dir, 'ledger.json')); }
  finally { await rm(dir, { recursive: true, force: true }); }
}

test('same content produces a deterministic publishing attempt id', () => {
  assert.equal(buildPublishingAttemptId(SCRIPT), buildPublishingAttemptId(structuredClone(SCRIPT)));
  assert.notEqual(buildPublishingAttemptId(SCRIPT), buildPublishingAttemptId({ ...SCRIPT, finale_text: 'Different.' }));
});

test('manual rerun cannot reacquire an existing publishing attempt', async () => {
  await withLedger(async (file) => {
    const attemptId = buildPublishingAttemptId(SCRIPT);
    const first = await reservePublishingAttempt({ attemptId, topic: 'Same Story', configuredPlatforms: { youtube: true } }, { file, store: null });
    const rerun = await reservePublishingAttempt({ attemptId, topic: 'Same Story', configuredPlatforms: { youtube: true } }, { file, store: null });
    assert.equal(first.acquired, true);
    assert.equal(rerun.acquired, false);
    assert.equal(rerun.record.attemptId, attemptId);
  });
});

test('crash/timeout after upload starts remains remote_unknown and cannot be reacquired', async () => {
  await withLedger(async (file) => {
    const attemptId = buildPublishingAttemptId(SCRIPT);
    await reservePublishingAttempt({ attemptId, topic: 'Same Story', configuredPlatforms: { youtube: true } }, { file, store: null });
    await updatePublishingPlatform(attemptId, 'youtube', 'uploading', {}, { file, store: null });
    await updatePublishingPlatform(attemptId, 'youtube', 'remote_unknown', { lastError: 'timeout' }, { file, store: null });
    const saved = await readPublishingAttempt(attemptId, { file, store: null });
    assert.equal(saved.platforms.youtube.state, 'remote_unknown');
    assert.equal(saved.platforms.youtube.attempts, 1);
    const rerun = await reservePublishingAttempt({ attemptId, topic: 'Same Story' }, { file, store: null });
    assert.equal(rerun.acquired, false);
  });
});

test('platform outcomes remain independent for partial publishing', async () => {
  await withLedger(async (file) => {
    const attemptId = buildPublishingAttemptId(SCRIPT);
    await reservePublishingAttempt({
      attemptId, topic: 'Same Story', configuredPlatforms: { youtube: true, instagram: true, facebook: true },
    }, { file, store: null });
    await updatePublishingPlatform(attemptId, 'youtube', 'uploading', {}, { file, store: null });
    await updatePublishingPlatform(attemptId, 'youtube', 'published', { remoteId: 'yt-1' }, { file, store: null });
    await updatePublishingPlatform(attemptId, 'instagram', 'remote_unknown', { lastError: 'timeout' }, { file, store: null });
    const saved = await readPublishingAttempt(attemptId, { file, store: null });
    assert.equal(saved.platforms.youtube.state, 'published');
    assert.equal(saved.platforms.youtube.remoteId, 'yt-1');
    assert.equal(saved.platforms.instagram.state, 'remote_unknown');
    assert.equal(saved.platforms.facebook.state, 'pending');
  });
});

test('GitHub Actions mode refuses non-durable local fallback', async () => {
  await withLedger(async (file) => {
    await assert.rejects(
      reservePublishingAttempt({ attemptId: 'abc', topic: 'x' }, { file, store: null, requireDurable: true }),
      new RegExp(DURABLE_PUBLISHING_STATE_ERROR),
    );
  });
});

test('durable publishing preflight rejects a missing Firestore store', () => {
  assert.throws(
    () => requireDurablePublishingState({ store: null }),
    new RegExp(DURABLE_PUBLISHING_STATE_ERROR),
  );
});
