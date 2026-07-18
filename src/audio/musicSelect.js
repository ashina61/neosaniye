import { readdirSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';

/**
 * MÜZİK SEÇİCİ — havuz + CC0 kütüphane manifesti.
 *
 * Kaynaklar:
 *  1) Eski havuz: assets/music/<mood>/ (mevcut davranış birebir korunur).
 *  2) CC0 kütüphanesi: assets/audio/ — YALNIZCA audio-manifest.json'da kayıtlı
 *     ve type='music' olan dosyalar seçilebilir (lisans manifesti kapısı).
 *
 * Tekrar önleme: `avoid` (son videolarda kullanılan dosya adları) alternatif
 * varsa dışlanır; havuz tek parçaya düşerse tekrar serbesttir (müzik >
 * sessizlik). Dosya eksikse güvenli fallback: null → prosedürel yatak.
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
      sha256: entry.sha256,
    };
  }
  // Eski havuz (assets/music): manifest dışı — künye dosya adıyla sınırlı.
  return { file: base, assetId: null, source: 'assets/music havuzu', license: null };
}

/**
 * Parça seçer. Mevcut davranış korunur: önce mood klasörü, sonra tüm havuz,
 * sonra tek dosya; hiçbiri yoksa null (prosedürel yatak devreye girer).
 * CC0 kütüphanesindeki müzikler mood adayı olarak havuza katılır (manifest kapılı).
 */
export function pickMusicTrack(category = '', {
  avoid = [],
  musicDir = config.video.musicDir || 'assets/music',
  audioRoot = 'assets/audio',
  manifest = undefined, // test enjeksiyonu; undefined = diskten oku
} = {}) {
  const dir = path.resolve(musicDir);
  const key = String(category || '').toLowerCase();
  const mood = ALIAS[key] || key;
  const mf = manifest === undefined ? loadAudioManifest(audioRoot) : manifest;
  const avoidSet = new Set(avoid.map((f) => path.basename(String(f))));
  const pick = (list) => {
    if (!list.length) return null;
    const fresh = list.filter((p) => !avoidSet.has(path.basename(p)));
    const cands = fresh.length ? fresh : list; // hepsi 'son kullanılan' ise tekrar serbest
    return cands[Math.floor(Math.random() * cands.length)];
  };

  // 1) Mood: eski havuz klasörü + manifest müzikleri birlikte.
  // (Eski havuzda history klasörü var; alias'lı mood klasör adını da dene.)
  const moodDirs = [...new Set([key, mood])].filter(Boolean);
  const moodPool = moodDirs.flatMap((m) => audioFiles(path.join(dir, m)));
  moodPool.push(...manifestMusic(mf, audioRoot, mood));
  const chosen1 = pick(moodPool);
  if (chosen1) return chosen1;

  // 2) Havuzun tamamı (kök + alt klasörler) + tüm manifest müzikleri.
  const all = audioFiles(dir);
  for (const e of listDir(dir)) {
    if (e.isDirectory()) all.push(...audioFiles(path.join(dir, e.name)));
  }
  all.push(...manifestMusic(mf, audioRoot, null));
  const chosen2 = pick(all);
  if (chosen2) return chosen2;

  // 3) Tek dosya fallback.
  const single = path.resolve(config.video.musicPath);
  return existsSync(single) ? single : null;
}
