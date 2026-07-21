import { readdirSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';

/**
 * MÜZİK SEÇİCİ — havuz + CC0 kütüphane manifesti.
 *
 * Kaynaklar:
 *  1) Eski havuz: assets/music/<mood>/ (mood klasörleri).
 *  2) CC0 kütüphanesi: assets/audio/ — YALNIZCA audio-manifest.json'da kayıtlı
 *     ve type='music' olan dosyalar (lisans manifesti kapısı).
 *
 * ÇEŞİTLİLİK KURALLARI (bee-honeycomb "hep Marianas" regresyonunun kökü):
 *  - Aynı müzik ardışık 2 videoda KULLANILMAZ.
 *  - Son N (varsayılan 5) videonun parçaları elenir (`avoid`).
 *  - Mood klasörü tek parçaya düşer ve o parça 'son kullanılan' ise, o parçayı
 *    TEKRAR ETMEK yerine GENİŞ havuzdan taze bir parçaya düşülür (eski hata:
 *    mood tek dosyaya düşünce hep aynı parça geliyordu).
 *  - Deterministik: aynı videoId → aynı seçim; farklı videolar → çeşitlenir.
 *  - Havuzda tek uygun parça varsa poolExhausted=true bildirir (sessiz aynı
 *    fallback'i saklamaz — sert kapı bunu görür).
 */

const EXTS = ['.mp3', '.m4a', '.wav', '.ogg', '.aac', '.opus'];
const ALIAS = { 'human body': 'science', technology: 'science', history: 'ancient' };

function listDir(d) {
  try {
    return readdirSync(d, { withFileTypes: true });
  } catch {
    return [];
  }
}
function audioFiles(dir) {
  return listDir(dir)
    .filter((e) => e.isFile() && EXTS.includes(path.extname(e.name).toLowerCase()))
    .map((e) => path.join(dir, e.name));
}

/** 32-bit FNV hash → deterministik seed. */
function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < String(str).length; i += 1) {
    h ^= String(str).charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
/** mulberry32 deterministik PRNG. */
function mulberry32(a) {
  return function next() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Benzersizleştir (basename bazında) + sırayı koru. */
function uniqByBase(list) {
  const seen = new Set();
  const out = [];
  for (const p of list) {
    const b = path.basename(p);
    if (seen.has(b)) continue;
    seen.add(b);
    out.push(p);
  }
  return out;
}

/** CC0 kütüphane manifestini okur; yoksa null (kütüphane devre dışı). */
export function loadAudioManifest(audioRoot = 'assets/audio') {
  try {
    return JSON.parse(readFileSync(path.join(audioRoot, 'manifests', 'audio-manifest.json'), 'utf8'));
  } catch {
    return null;
  }
}

/** Manifestteki type='music' asset'lerinden mood eşleşenleri (dosyası mevcut olanlar). */
function manifestMusic(manifest, audioRoot, mood) {
  if (!manifest?.assets) return [];
  return manifest.assets
    .filter((a) => a.type === 'music')
    .filter((a) => !mood || (a.moods || []).includes(mood))
    .map((a) => path.resolve(audioRoot, a.filename))
    .filter((p) => existsSync(p));
}

/** Seçilen parçanın lisans künyesi (video başına production manifesti için). */
export function describeMusicTrack(trackPath, audioRoot = 'assets/audio') {
  if (!trackPath) return null;
  const base = path.basename(trackPath);
  const manifest = loadAudioManifest(audioRoot);
  const entry = manifest?.assets?.find((a) => path.basename(a.filename) === base);
  if (entry) {
    return {
      file: base,
      assetId: entry.id,
      title: entry.title,
      source: entry.sourceRepository,
      sourceCommit: entry.sourceCommit,
      license: entry.license,
      licenseEvidence: entry.licenseEvidence,
      sha256: entry.sha256,
    };
  }
  // Eski havuz (assets/music): manifest dışı — künye dosya adıyla sınırlı.
  return { file: base, assetId: null, source: 'assets/music havuzu', license: null };
}

/**
 * Müzik seçim KARARI (detaylı). Çeşitlilik + çıkış doğrulaması için tüm
 * meta ile döner.
 *
 * @returns {{
 *   track: string|null, mood: string, matchedMood: boolean, repeatedFallback: boolean,
 *   poolExhausted: boolean, silentFallback: boolean, moodPoolSize: number,
 *   widePoolSize: number, freshCount: number, reason: string,
 * }}
 */
export function selectMusic(category = '', {
  avoid = [],
  seed = '',
  musicDir = config.video.musicDir || 'assets/music',
  audioRoot = 'assets/audio',
  manifest = undefined,
} = {}) {
  const dir = path.resolve(musicDir);
  const key = String(category || '').toLowerCase();
  const mood = ALIAS[key] || key;
  const mf = manifest === undefined ? loadAudioManifest(audioRoot) : manifest;
  const avoidSet = new Set(avoid.map((f) => path.basename(String(f))));

  // Mood havuzu: eski klasör(ler) + manifest mood müzikleri.
  const moodDirs = [...new Set([key, mood])].filter(Boolean);
  const moodPool = uniqByBase([
    ...moodDirs.flatMap((m) => audioFiles(path.join(dir, m))),
    ...manifestMusic(mf, audioRoot, mood),
  ]);

  // Geniş havuz: kök + tüm alt klasörler + tüm manifest müzikleri.
  const wide = audioFiles(dir);
  for (const e of listDir(dir)) {
    if (e.isDirectory()) wide.push(...audioFiles(path.join(dir, e.name)));
  }
  wide.push(...manifestMusic(mf, audioRoot, null));
  const widePool = uniqByBase(wide);

  const rng = mulberry32(hashSeed(seed || category || 'music'));
  const pick = (list) => (list.length ? list[Math.floor(rng() * list.length)] : null);

  const base = {
    mood, moodPoolSize: moodPool.length, widePoolSize: widePool.length,
    matchedMood: false, repeatedFallback: false, poolExhausted: false, silentFallback: false,
  };

  const freshMood = moodPool.filter((p) => !avoidSet.has(path.basename(p)));
  const freshWide = widePool.filter((p) => !avoidSet.has(path.basename(p)));

  // 1) Mood'a uyan ve son videolarda kullanılmamış taze parça (ideal).
  if (freshMood.length) {
    return { ...base, track: pick(freshMood), matchedMood: true, freshCount: freshMood.length, reason: 'mood-fresh' };
  }
  // 2) Mood tükendi ama havuzda taze başka parça var → TEKRAR YERİNE ÇEŞİTLİLİK.
  if (freshWide.length) {
    return { ...base, track: pick(freshWide), matchedMood: false, freshCount: freshWide.length, reason: 'wide-fresh-variety' };
  }
  // 3) Her parça son videolarda kullanıldı → global tükeniş; tekrar kaçınılmaz.
  if (widePool.length) {
    return {
      ...base, track: pick(widePool), poolExhausted: true,
      repeatedFallback: true, freshCount: 0, reason: 'pool-exhausted-repeat',
    };
  }
  // 4) Hiç gerçek parça yok → prosedürel yatak (sessiz değil; ama havuz boş).
  const single = path.resolve(config.video.musicPath);
  if (existsSync(single)) {
    return { ...base, track: single, poolExhausted: true, repeatedFallback: true, freshCount: 0, reason: 'single-fallback' };
  }
  return { ...base, track: null, poolExhausted: true, silentFallback: false, freshCount: 0, reason: 'procedural-bed' };
}

/**
 * Geriye dönük sarmalayıcı: yalnızca parça yolunu döndürür (eski çağrılar).
 */
export function pickMusicTrack(category = '', opts = {}) {
  return selectMusic(category, opts).track;
}
