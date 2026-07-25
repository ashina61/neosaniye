/**
 * ALGISAL GÖRSEL HASH (dHash) — "aynı görsel tekrar mı?" kapısı.
 *
 * Gerçek koşuda 10-11 sahnelik bir video tek bir resmin üstünde zoom yapan
 * slayta dönüşmüştü (ffmpeg 0.05 eşiğinde SIFIR sahne kesmesi). Sebep: tüm
 * sahnelerin aynı seed + neredeyse aynı prompt ile üretilmesiydi. Bu modül
 * üretilen kareleri karşılaştırıp "pratikte aynı" olanı yakalar; çağıran
 * (generateImages) o sahneyi farklı seed/kadrajla yeniden üretir.
 *
 * Bağımlılık YOK: ffmpeg ile 9x8 gri ham piksele indirger, komşu piksel
 * karşılaştırmasıyla 64 bitlik parmak izi çıkarır. Fark ölçüsü = Hamming.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);

/** dHash için 9x8 gri ham piksel (72 bayt). */
async function grayPixels(imagePath) {
  const { stdout } = await run(
    'ffmpeg',
    ['-v', 'error', '-i', imagePath, '-vf', 'scale=9:8,format=gray', '-f', 'rawvideo', '-'],
    { encoding: 'buffer', maxBuffer: 1 << 20 },
  );
  return stdout;
}

/**
 * Görselin 64 bitlik algısal parmak izi.
 * @param {string} imagePath
 * @returns {Promise<bigint|null>} okunamazsa null (kapı sessizce atlanır)
 */
export async function perceptualHash(imagePath) {
  let px;
  try {
    px = await grayPixels(imagePath);
  } catch {
    return null; // ffmpeg okuyamadı (bozuk/eksik dosya) → kapıyı zorlama
  }
  if (!px || px.length < 72) return null;
  let hash = 0n;
  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      const left = px[row * 9 + col];
      const right = px[row * 9 + col + 1];
      hash = (hash << 1n) | (left > right ? 1n : 0n);
    }
  }
  return hash;
}

/**
 * İki parmak izi arasındaki Hamming mesafesi (0 = birebir aynı, 64 = zıt).
 * @returns {number}
 */
export function hammingDistance(a, b) {
  if (a == null || b == null) return 64; // bilinmiyor → "farklı" say, üretimi kilitleme
  let x = a ^ b;
  let dist = 0;
  while (x) { dist += Number(x & 1n); x >>= 1n; }
  return dist;
}

/**
 * Aday görsel, daha önce kabul edilenlerin herhangi birine çok mu benziyor?
 * @param {bigint|null} candidate
 * @param {Array<bigint|null>} accepted
 * @param {number} minDistance eşik (bu değerin ALTI = çok benzer)
 * @returns {{tooSimilar:boolean, nearest:number}}
 */
export function isTooSimilar(candidate, accepted = [], minDistance = 10) {
  if (candidate == null) return { tooSimilar: false, nearest: 64 };
  let nearest = 64;
  for (const prev of accepted) {
    const d = hammingDistance(candidate, prev);
    if (d < nearest) nearest = d;
  }
  return { tooSimilar: nearest < minDistance, nearest };
}
