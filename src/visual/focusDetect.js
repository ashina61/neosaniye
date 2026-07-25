/**
 * ODAK TESPİTİ — "daire/ok NEREYE oturacak?"
 *
 * Kullanıcı şikâyetinin kökü: sistem bir daireyi/oku görüntünün rastgele bir
 * yerine koyuyordu. Bir şeyi işaretliyorsan GERÇEKTEN o şeyin üstünde olmalı;
 * olamıyorsan hiç işaretleme.
 *
 * Nesne algılama modeli (ağır, bağımlılık ister) yerine görüntüden DOĞRUDAN
 * ölçülen bir belirginlik (saliency) sinyali kullanılır:
 *   - yerel parlaklık kontrastı (özne genelde en kontrastlı bölgedir)
 *   - renk doygunluğu (özne genelde arka plandan daha doygundur)
 *   - merkez eğilimi (kadrajlanmış fotoğrafta özne merkeze yakındır)
 * Bunlar bir ızgarada toplanır, en yüksek pencere seçilir ve GÜVEN skoru
 * çıkarılır. Güven eşiğin altındaysa null döner → çağıran işaret ÇİZMEZ.
 *
 * Bağımlılık YOK: ffmpeg ile küçük ham RGB okunur.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);

const GRID_W = 36;   // 9:16 için kaba ızgara (hız + gürültü bastırma)
const GRID_H = 64;

/** Küçültülmüş ham RGB (GRID_W x GRID_H x 3 bayt). */
async function rawRgb(imagePath) {
  const { stdout } = await run(
    'ffmpeg',
    ['-v', 'error', '-i', imagePath,
      '-vf', `scale=${GRID_W}:${GRID_H}`, '-pix_fmt', 'rgb24', '-f', 'rawvideo', '-'],
    { encoding: 'buffer', maxBuffer: 1 << 22 },
  );
  return stdout;
}

/**
 * Görüntüdeki baskın öznenin konumu.
 *
 * @param {string} imagePath
 * @param {object} [opts]
 * @param {number} [opts.minConfidence=1.35] bu skorun altı = "emin değilim"
 * @returns {Promise<{x:number,y:number,confidence:number}|null>}
 *          x,y normalize (0..1). null = işaret çizme.
 */
export async function detectFocus(imagePath, { minConfidence = 1.35 } = {}) {
  let px;
  try {
    px = await rawRgb(imagePath);
  } catch {
    return null; // okunamadı → işaret çizme (sessiz, üretimi kilitleme)
  }
  if (!px || px.length < GRID_W * GRID_H * 3) return null;

  const lum = new Float64Array(GRID_W * GRID_H);
  const sat = new Float64Array(GRID_W * GRID_H);
  for (let i = 0; i < GRID_W * GRID_H; i += 1) {
    const r = px[i * 3] / 255;
    const g = px[i * 3 + 1] / 255;
    const b = px[i * 3 + 2] / 255;
    lum[i] = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const mx = Math.max(r, g, b);
    const mn = Math.min(r, g, b);
    sat[i] = mx > 0 ? (mx - mn) / mx : 0;
  }

  // Görüntünün ORTALAMA rengi — özne genelde bundan belirgin şekilde ayrışır.
  let mr = 0; let mg = 0; let mb = 0;
  for (let i = 0; i < GRID_W * GRID_H; i += 1) {
    mr += px[i * 3]; mg += px[i * 3 + 1]; mb += px[i * 3 + 2];
  }
  const n0 = GRID_W * GRID_H;
  mr /= n0 * 255; mg /= n0 * 255; mb /= n0 * 255;

  // Hücre ilgisi: yerel kontrast + doygunluk + ortalama renkten UZAKLIK.
  // Renk uzaklığı olmadan düz zemin üzerindeki net bir nesne (sadece kenarında
  // kontrast üretir) pencere ortalamasında eriyip kaçırılıyordu.
  const interest = new Float64Array(GRID_W * GRID_H);
  for (let y = 0; y < GRID_H; y += 1) {
    for (let x = 0; x < GRID_W; x += 1) {
      let sum = 0; let sum2 = 0; let n = 0;
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const nx = x + dx; const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= GRID_W || ny >= GRID_H) continue;
          const v = lum[ny * GRID_W + nx];
          sum += v; sum2 += v * v; n += 1;
        }
      }
      const mean = sum / n;
      const variance = Math.max(0, sum2 / n - mean * mean);
      const i0 = y * GRID_W + x;
      const dr = px[i0 * 3] / 255 - mr;
      const dg = px[i0 * 3 + 1] / 255 - mg;
      const db = px[i0 * 3 + 2] / 255 - mb;
      const colorDist = Math.hypot(dr, dg, db);
      // Merkez eğilimi YUMUŞAK: berabereliği bozar, kadraj dışı özneyi gizlemez.
      // (Sert eğilim, sağ-altta duran net bir nesneyi tamamen kaçırtıyordu.)
      const cxN = (x + 0.5) / GRID_W - 0.5;
      const cyN = (y + 0.5) / GRID_H - 0.5;
      const centerBias = 1 - Math.min(1, Math.hypot(cxN, cyN) / 0.72) * 0.18;
      interest[i0] = (Math.sqrt(variance) * 1.6 + sat[i0] * 0.5 + colorDist * 1.5) * centerBias;
    }
  }

  // En ilgi çekici pencere (yaklaşık kadrajın 1/3'ü).
  const winW = Math.max(3, Math.round(GRID_W / 3));
  const winH = Math.max(3, Math.round(GRID_H / 4));
  let best = { score: -1, x: 0, y: 0 };
  let total = 0;
  let windows = 0;
  const scores = [];
  for (let y = 0; y + winH <= GRID_H; y += 1) {
    for (let x = 0; x + winW <= GRID_W; x += 1) {
      let sc = 0;
      for (let j = 0; j < winH; j += 1) {
        for (let i = 0; i < winW; i += 1) sc += interest[(y + j) * GRID_W + (x + i)];
      }
      sc /= winW * winH;
      scores.push(sc);
      total += sc; windows += 1;
      if (sc > best.score) best = { score: sc, x, y };
    }
  }
  if (!windows) return null;

  // GÜVEN: en iyi pencere ortalamadan ne kadar ayrışıyor. Her yeri eşit
  // dokulu bir kare (mercan resifi gibi) düşük skor verir → işaret çizilmez.
  const mean = total / windows;
  const sd = Math.sqrt(scores.reduce((a, v) => a + (v - mean) ** 2, 0) / windows) || 1e-6;
  const confidence = mean > 0 ? best.score / mean : 0;
  const zScore = (best.score - mean) / sd;
  if (confidence < minConfidence || zScore < 1.2) return null;

  // İNCE AYAR: pencere MERKEZİ yerine pencere içindeki ilginin AĞIRLIK
  // MERKEZİ. Nesne pencerenin ortasında durmayabilir; kaba merkez halkayı
  // nesnenin biraz yanına düşürüyordu.
  let wsum = 0; let wx = 0; let wy = 0;
  for (let j = 0; j < winH; j += 1) {
    for (let i = 0; i < winW; i += 1) {
      const w = interest[(best.y + j) * GRID_W + (best.x + i)];
      wsum += w;
      wx += w * (best.x + i + 0.5);
      wy += w * (best.y + j + 0.5);
    }
  }
  const cx = wsum > 0 ? wx / wsum : best.x + winW / 2;
  const cy = wsum > 0 ? wy / wsum : best.y + winH / 2;

  return {
    x: +(cx / GRID_W).toFixed(3),
    y: +(cy / GRID_H).toFixed(3),
    confidence: +confidence.toFixed(2),
  };
}

/**
 * Birden çok görsel için odak tespiti (sırayla; her biri bağımsız hata yutar).
 * @param {Array<{path:string, index:number}>} images
 * @returns {Promise<Map<number, {x,y,confidence}>>}
 */
export async function detectFocusForAll(images = [], opts = {}) {
  const map = new Map();
  for (const img of images) {
    if (!img?.path) continue;
    const f = await detectFocus(img.path, opts).catch(() => null);
    if (f) map.set(img.index, f);
  }
  return map;
}
