import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { getFirestore } from '../lib/firestore.js';

const COLLECTION = 'publishing_attempts';
const DEFAULT_FILE = () => path.join(process.env.STATE_DIR || 'data', 'publishing-attempts.json');
const PLATFORMS = ['youtube', 'instagram', 'facebook'];

export const DURABLE_PUBLISHING_STATE_ERROR =
  'Unattended publishing requires Firestore. Set the FIREBASE_SERVICE_ACCOUNT GitHub Actions secret before enabling uploads.';

/**
 * Hosted runners disappear after a job, so their JSON fallback cannot safely
 * record an upload reservation. Check this before any expensive generation
 * work, not only immediately before the remote side effect.
 */
export function requireDurablePublishingState(opts = {}) {
  const store = opts.store === undefined ? getFirestore() : opts.store;
  if (!store) throw new Error(DURABLE_PUBLISHING_STATE_ERROR);
  return store;
}

function stableContent(script = {}) {
  return {
    normalizedTopic: script.normalizedTopic || '',
    title: script.title || '',
    hook: script.hook_text || '',
    scenes: (script.scenes || []).map((s) => String(s.narration || '').trim()),
    finale: script.finale_text || '',
  };
}

export function buildPublishingAttemptId(script) {
  return createHash('sha256').update(JSON.stringify(stableContent(script))).digest('hex').slice(0, 32);
}

async function readLocal(file) {
  try {
    const value = JSON.parse(await readFile(file, 'utf8'));
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('publishing ledger şeması geçersiz');
    return value;
  } catch (err) {
    if (err.code === 'ENOENT') return {};
    throw err;
  }
}

async function writeLocalAtomic(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify(value, null, 2));
  await rename(tmp, file);
}

function initialPlatforms(configured = {}) {
  return Object.fromEntries(PLATFORMS.map((name) => [name, {
    state: configured[name] ? 'pending' : 'not_configured',
    attempts: 0,
    remoteId: null,
    lastError: null,
    updatedAt: null,
  }]));
}

/** Reserve once before any remote create. Existing attempts are never blindly reacquired. */
export async function reservePublishingAttempt({ attemptId, topic, configuredPlatforms = {} }, opts = {}) {
  if (!attemptId) throw new Error('publishing attemptId gerekli');
  const now = new Date().toISOString();
  const record = {
    attemptId,
    topic: topic || null,
    state: 'reserved',
    createdAt: now,
    updatedAt: now,
    platforms: initialPlatforms(configuredPlatforms),
  };

  const store = opts.requireDurable
    ? requireDurablePublishingState(opts)
    : (opts.store === undefined ? getFirestore() : opts.store);
  if (store) {
    const ref = store.collection(COLLECTION).doc(attemptId);
    return store.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (snap.exists) return { acquired: false, record: { attemptId, ...snap.data() } };
      tx.set(ref, record);
      return { acquired: true, record };
    });
  }

  const file = opts.file || DEFAULT_FILE();
  const map = await readLocal(file);
  if (map[attemptId]) return { acquired: false, record: map[attemptId] };
  map[attemptId] = record;
  await writeLocalAtomic(file, map);
  return { acquired: true, record };
}

export async function updatePublishingPlatform(attemptId, platform, state, patch = {}, opts = {}) {
  if (!PLATFORMS.includes(platform)) throw new Error(`bilinmeyen platform: ${platform}`);
  const now = new Date().toISOString();
  const store = opts.store === undefined ? getFirestore() : opts.store;
  if (opts.requireDurable && !store) throw new Error('Durable publishing state unavailable.');

  if (store) {
    const ref = store.collection(COLLECTION).doc(attemptId);
    await store.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new Error(`publishing attempt bulunamadı: ${attemptId}`);
      const current = snap.data();
      const previous = current.platforms?.[platform] || {};
      const platforms = {
        ...current.platforms,
        [platform]: {
          ...previous,
          ...patch,
          state,
          attempts: Number(previous.attempts || 0) + (state === 'uploading' ? 1 : 0),
          updatedAt: now,
        },
      };
      const overallState = state === 'remote_unknown'
        ? 'remote_unknown'
        : PLATFORMS.every((p) => ['published', 'not_configured'].includes(platforms[p]?.state))
          ? 'published'
          : current.state;
      tx.set(ref, {
        state: overallState,
        updatedAt: now,
        platforms,
      }, { merge: true });
    });
    return;
  }

  const file = opts.file || DEFAULT_FILE();
  const map = await readLocal(file);
  const current = map[attemptId];
  if (!current) throw new Error(`publishing attempt bulunamadı: ${attemptId}`);
  const previous = current.platforms?.[platform] || {};
  current.platforms[platform] = {
    ...previous,
    ...patch,
    state,
    attempts: Number(previous.attempts || 0) + (state === 'uploading' ? 1 : 0),
    updatedAt: now,
  };
  current.updatedAt = now;
  if (state === 'remote_unknown') current.state = 'remote_unknown';
  else if (PLATFORMS.every((p) => ['published', 'not_configured'].includes(current.platforms[p]?.state))) current.state = 'published';
  map[attemptId] = current;
  await writeLocalAtomic(file, map);
}

export async function readPublishingAttempt(attemptId, opts = {}) {
  const store = opts.store === undefined ? getFirestore() : opts.store;
  if (store) {
    const snap = await store.collection(COLLECTION).doc(attemptId).get();
    return snap.exists ? { attemptId, ...snap.data() } : null;
  }
  const map = await readLocal(opts.file || DEFAULT_FILE());
  return map[attemptId] || null;
}
