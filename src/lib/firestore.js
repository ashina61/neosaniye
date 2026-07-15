import admin from 'firebase-admin';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';

/**
 * Durum (state) katmanı. İki backend:
 *   - Firestore: FIREBASE_SERVICE_ACCOUNT verilmişse (CI/prod için kalıcı).
 *   - Yerel JSON: verilmemişse data/ altına yazar (geliştirme/test için).
 *
 * Not: GitHub'ın barındırdığı runner'lar ephemeral olduğu için CI'da çalışmalar
 * arası kalıcılık (tekrar önleme, video geçmişi) yalnızca Firestore ile sağlanır.
 */

const STATE_DIR = process.env.STATE_DIR || 'data';
const USED_TOPICS = 'used_topics';
const VIDEOS = 'videos';

let db = null;
let initialized = false;

export function getFirestore() {
  if (initialized) return db;
  initialized = true;

  const { serviceAccountJson, projectId } = config.firebase;
  if (!serviceAccountJson) {
    console.warn(
      `[state] FIREBASE_SERVICE_ACCOUNT yok — yerel JSON yedeği kullanılıyor (${STATE_DIR}/).`,
    );
    return db;
  }
  try {
    const creds = JSON.parse(serviceAccountJson);
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(creds),
        projectId: projectId || creds.project_id,
      });
    }
    db = admin.firestore();
  } catch (err) {
    console.error('[state] Firestore başlatma hatası, yerele düşülüyor:', err.message);
    db = null;
  }
  return db;
}

/** Konu başlığını doc id olarak kullanılabilir hale getirir. */
export function normalizeTopic(topic) {
  return topic
    .toLocaleLowerCase('tr')
    .replaceAll('ı', 'i')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // birleşik aksan işaretlerini kaldır
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ---- yerel JSON yardımcıları ----
async function readLocal(file, fallback) {
  try {
    return JSON.parse(await readFile(path.join(STATE_DIR, file), 'utf8'));
  } catch {
    return fallback;
  }
}
async function writeLocal(file, data) {
  await mkdir(STATE_DIR, { recursive: true });
  await writeFile(path.join(STATE_DIR, file), JSON.stringify(data, null, 2));
}

// ---- used_topics ----

/** Son N kullanılmış konuyu döndürür (createdAt'e göre azalan). */
export async function getRecentUsedTopics(limit = 50) {
  const store = getFirestore();
  if (store) {
    const snap = await store
      .collection(USED_TOPICS)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();
    return snap.docs.map((d) => d.data());
  }
  const map = await readLocal(`${USED_TOPICS}.json`, {});
  return Object.values(map)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, limit);
}

/** Bir konunun daha önce kullanılıp kullanılmadığını kontrol eder. */
export async function isTopicUsed(topic) {
  const id = normalizeTopic(topic);
  const store = getFirestore();
  if (store) {
    const doc = await store.collection(USED_TOPICS).doc(id).get();
    return doc.exists;
  }
  const map = await readLocal(`${USED_TOPICS}.json`, {});
  return Boolean(map[id]);
}

/** Konuyu kullanılmış olarak işaretler. extra ile videoId vb. eklenebilir. */
export async function markTopicUsed(topic, extra = {}) {
  const id = normalizeTopic(topic);
  const store = getFirestore();
  if (store) {
    await store
      .collection(USED_TOPICS)
      .doc(id)
      .set(
        {
          topic,
          normalizedTopic: id,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          ...extra,
        },
        { merge: true },
      );
    return id;
  }
  const map = await readLocal(`${USED_TOPICS}.json`, {});
  map[id] = {
    ...map[id],
    topic,
    normalizedTopic: id,
    createdAt: map[id]?.createdAt || new Date().toISOString(),
    ...extra,
  };
  await writeLocal(`${USED_TOPICS}.json`, map);
  return id;
}

// ---- videos ----

/** Üretilen bir videoyu kaydeder, doküman id'sini döndürür. */
export async function logVideo(record) {
  const store = getFirestore();
  if (store) {
    const ref = await store.collection(VIDEOS).add({
      ...record,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return ref.id;
  }
  const list = await readLocal(`${VIDEOS}.json`, []);
  const id = `${record.normalizedTopic || 'video'}-${Date.now()}`;
  list.push({ id, ...record, createdAt: new Date().toISOString() });
  await writeLocal(`${VIDEOS}.json`, list);
  return id;
}

/** YouTube'a yüklenmiş son videoları döndürür (istatistik güncelleme için). */
export async function getVideosWithYouTube(limit = 25) {
  const store = getFirestore();
  if (store) {
    const snap = await store
      .collection(VIDEOS)
      .orderBy('createdAt', 'desc')
      .limit(limit * 2)
      .get();
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((v) => v.youtube?.videoId)
      .slice(0, limit);
  }
  const list = await readLocal(`${VIDEOS}.json`, []);
  return list
    .filter((v) => v.youtube?.videoId)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, limit);
}

/** En çok izlenen geçmiş konuları döndürür (konu seçimini besler). */
export async function getTopPerformingTopics(limit = 5) {
  try {
    const vids = await getVideosWithYouTube(50);
    return vids
      .filter((v) => v.stats?.views > 0)
      .sort((a, b) => (b.stats?.views || 0) - (a.stats?.views || 0))
      .slice(0, limit)
      .map((v) => ({ topic: v.topic, views: v.stats.views }));
  } catch {
    return [];
  }
}

/** En çok izlenen videoların HOOK'larını döndürür — yazar bunlardan üslup
 *  öğrenir (few-shot). hook_text eski kayıtlarda yok; başlık vekil olur. */
export async function getWinningHooks(limit = 3) {
  try {
    const vids = await getVideosWithYouTube(50);
    return vids
      .filter((v) => v.stats?.views > 0)
      .sort((a, b) => (b.stats?.views || 0) - (a.stats?.views || 0))
      .slice(0, limit)
      .map((v) => ({
        hook: v.script?.hook_text || v.script?.title || v.topic,
        views: v.stats.views,
      }))
      .filter((h) => h.hook);
  } catch {
    return [];
  }
}

/** Var olan bir video kaydını günceller (ör. Faz 6 YouTube bilgisi/status). */
export async function updateVideo(id, patch) {
  const store = getFirestore();
  if (store) {
    await store.collection(VIDEOS).doc(id).set(patch, { merge: true });
    return;
  }
  const list = await readLocal(`${VIDEOS}.json`, []);
  const idx = list.findIndex((v) => v.id === id);
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...patch };
    await writeLocal(`${VIDEOS}.json`, list);
  }
}
