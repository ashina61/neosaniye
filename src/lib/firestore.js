import admin from 'firebase-admin';
import { config } from '../config.js';

let db = null;
let initialized = false;

/**
 * Firestore bağlantısını (tembel) döndürür.
 * FIREBASE_SERVICE_ACCOUNT yoksa null döner ve tüm fonksiyonlar
 * "no-op" olarak çalışır — böylece Faz 1'i Firebase kurmadan test edebilirsin.
 */
export function getFirestore() {
  if (initialized) return db;
  initialized = true;

  const { serviceAccountJson, projectId } = config.firebase;
  if (!serviceAccountJson) {
    console.warn(
      '[firestore] FIREBASE_SERVICE_ACCOUNT yok — Firestore devre dışı (yerel test modu).',
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
    console.error('[firestore] başlatma hatası:', err.message);
    db = null;
  }
  return db;
}

/** Konu başlığını doc id olarak kullanılabilir hale getirir (Türkçe karakter -> ascii, tire). */
export function normalizeTopic(topic) {
  return topic
    .toLocaleLowerCase('tr')
    .replaceAll('ı', 'i')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // birleşik aksan işaretlerini kaldır
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const USED_TOPICS = 'used_topics';

/** Son N kullanılmış konuyu döndürür (prompt'a "bunları seçme" olarak verilir). */
export async function getRecentUsedTopics(limit = 50) {
  const store = getFirestore();
  if (!store) return [];
  const snap = await store
    .collection(USED_TOPICS)
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .get();
  return snap.docs.map((d) => d.data());
}

/** Bir konunun daha önce kullanılıp kullanılmadığını (normalize edilmiş id üzerinden) kontrol eder. */
export async function isTopicUsed(topic) {
  const store = getFirestore();
  if (!store) return false;
  const id = normalizeTopic(topic);
  const doc = await store.collection(USED_TOPICS).doc(id).get();
  return doc.exists;
}

/** Konuyu kullanılmış olarak işaretler. extra ile videoId/scriptId gibi alanlar eklenebilir. */
export async function markTopicUsed(topic, extra = {}) {
  const store = getFirestore();
  if (!store) return;
  const id = normalizeTopic(topic);
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
}
