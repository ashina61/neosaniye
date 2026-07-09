import { writeFile } from 'node:fs/promises';

/**
 * Prosedürel sinematik müzik motoru (tamamen çevrimdışı, %100 telifsiz).
 *
 * assets/music/ havuzu boşken kullanılır: kategoriye uygun akor progresyonlu,
 * katmanlı bir ambient yatak sentezler (bas + detune'lu pad + yumuşak doku).
 * Her video için seed'e göre küçük varyasyonlar üretir — hep aynı parça çalmaz.
 */

const SR = 44100;

// Nota frekansları (Hz) — 2. ve 3. oktav civarı pad için ideal.
const NOTE = {
  C2: 65.41, D2: 73.42, E2: 82.41, F2: 87.31, G2: 98.0, A2: 110.0, Bb2: 116.54, B2: 123.47,
  C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.0, A3: 220.0,
};

const MIN = [0, 3, 7, 12]; // minör
const MAJ = [0, 4, 7, 12]; // majör
const SUS = [0, 5, 7, 12]; // sus4 (askıda, gerilimli)

// Kategori -> {progresyon, segment süresi, doku seviyesi, parlaklık}
const MOODS = {
  history: {
    prog: [[NOTE.A2, MIN], [NOTE.F2, MAJ], [NOTE.C3, MAJ], [NOTE.G2, MAJ]],
    seg: 4.5, texture: 0.05, lp: 0.12,
  },
  mystery: {
    prog: [[NOTE.A2, MIN], [NOTE.E2, MIN], [NOTE.F2, MAJ], [NOTE.E2, SUS]],
    seg: 5.0, texture: 0.06, lp: 0.08,
  },
  space: {
    prog: [[NOTE.D2, MIN], [NOTE.Bb2, MAJ], [NOTE.F2, MAJ], [NOTE.C3, MAJ]],
    seg: 6.0, texture: 0.07, lp: 0.06,
  },
  science: {
    prog: [[NOTE.C3, MAJ], [NOTE.G2, MAJ], [NOTE.A2, MIN], [NOTE.F2, MAJ]],
    seg: 4.0, texture: 0.04, lp: 0.14,
  },
  nature: {
    prog: [[NOTE.G2, MAJ], [NOTE.D3, MAJ], [NOTE.E2, MIN], [NOTE.C3, MAJ]],
    seg: 4.5, texture: 0.045, lp: 0.16,
  },
};
const ALIAS = { 'human body': 'science', technology: 'science', default: 'history' };

/** Deterministik PRNG (seed ile tekrarlanabilir varyasyon). */
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Yumuşak trapez zarf: attack/release kosinüs rampalı. */
function envAt(t, dur, atk, rel) {
  if (t <= 0 || t >= dur) return 0;
  if (t < atk) return 0.5 - 0.5 * Math.cos((Math.PI * t) / atk);
  if (t > dur - rel) return 0.5 - 0.5 * Math.cos((Math.PI * (dur - t)) / rel);
  return 1;
}

/**
 * @param {object} opts
 * @param {string} opts.outPath - .wav çıktı yolu
 * @param {number} [opts.seconds=45]
 * @param {string} [opts.category='history']
 * @param {number} [opts.seed=1]
 */
export async function makeMusicBed({ outPath, seconds = 45, category = 'history', seed = 1 }) {
  const mood = MOODS[category] || MOODS[ALIAS[category] || 'history'] || MOODS.history;
  const rnd = mulberry32(seed * 7919 + 13);
  const n = Math.ceil(seconds * SR);
  const L = new Float64Array(n);
  const R = new Float64Array(n);

  const segDur = mood.seg;
  const overlap = 1.6; // akorlar birbirine yumuşak bağlansın
  const nSegs = Math.ceil((seconds + segDur) / (segDur - 0)) + 1;

  // --- Pad + bas katmanları (akor progresyonu) ---
  for (let s = 0; s < nSegs; s += 1) {
    const [root, shape] = mood.prog[s % mood.prog.length];
    const t0 = s * segDur - (s > 0 ? overlap * 0.5 : 0);
    const dur = segDur + overlap;
    const startI = Math.max(0, Math.floor(t0 * SR));
    const endI = Math.min(n, Math.ceil((t0 + dur) * SR));

    // Ses başına hafif rastgele faz + detune (canlılık).
    const voices = [];
    for (const st of shape) {
      const f = root * Math.pow(2, st / 12);
      voices.push({ f: f * (1 + 0.0016), ph: rnd() * Math.PI * 2, pan: 0.35 }); // L ağırlıklı
      voices.push({ f: f * (1 - 0.0016), ph: rnd() * Math.PI * 2, pan: -0.35 }); // R ağırlıklı
    }
    const bassF = root / 2;
    const bassPh = rnd() * Math.PI * 2;

    for (let i = startI; i < endI; i += 1) {
      const t = i / SR - t0;
      const e = envAt(t, dur, 1.6, 1.8);
      if (e === 0) continue;
      const tt = i / SR;
      // Çok yavaş nefes LFO'su.
      const lfo = 1 + 0.09 * Math.sin(2 * Math.PI * 0.055 * tt + 1.3);
      let l = 0;
      let r = 0;
      for (const v of voices) {
        // sin + hafif 2. harmonik = üçgene yakın, yumuşak ton
        const w = 2 * Math.PI * v.f * tt + v.ph;
        const sVal = Math.sin(w) + 0.18 * Math.sin(2 * w);
        const g = 0.11 * e * lfo;
        l += sVal * g * (1 + v.pan) * 0.5;
        r += sVal * g * (1 - v.pan) * 0.5;
      }
      const b = Math.sin(2 * Math.PI * bassF * tt + bassPh) * 0.16 * e;
      L[i] += l + b;
      R[i] += r + b;
    }
  }

  // --- Doku katmanı: alçak geçirenle yumuşatılmış kahverengi gürültü ---
  let br = 0;
  let lpL = 0;
  let lpR = 0;
  const texGain = mood.texture;
  const lpA = mood.lp; // tek kutuplu LP katsayısı (küçük = daha koyu)
  for (let i = 0; i < n; i += 1) {
    br = 0.996 * br + (rnd() * 2 - 1) * 0.03;
    lpL += lpA * (br - lpL);
    lpR += lpA * (br * 0.9 + (rnd() * 2 - 1) * 0.003 - lpR);
    const tt = i / SR;
    const swell = 1 + 0.35 * Math.sin(2 * Math.PI * 0.03 * tt);
    L[i] += lpL * texGain * swell;
    R[i] += lpR * texGain * swell;
  }

  // --- Kenar fade + normalize + yumuşak sıkıştırma (tanh) ---
  const edge = Math.floor(1.2 * SR);
  for (let i = 0; i < Math.min(edge, n); i += 1) {
    const g = i / edge;
    L[i] *= g; R[i] *= g;
    L[n - 1 - i] *= g; R[n - 1 - i] *= g;
  }
  let peak = 1e-9;
  for (let i = 0; i < n; i += 1) {
    const a = Math.max(Math.abs(L[i]), Math.abs(R[i]));
    if (a > peak) peak = a;
  }
  const norm = 0.5 / peak;

  // --- PCM16 stereo WAV yaz ---
  const dataBytes = n * 2 * 2;
  const buf = Buffer.alloc(44 + dataBytes);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataBytes, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(2, 22); // stereo
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 4, 28);
  buf.writeUInt16LE(4, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(dataBytes, 40);
  let o = 44;
  for (let i = 0; i < n; i += 1) {
    const l = Math.tanh(L[i] * norm * 1.4) * 0.95;
    const r = Math.tanh(R[i] * norm * 1.4) * 0.95;
    buf.writeInt16LE((l * 32767) | 0, o); o += 2;
    buf.writeInt16LE((r * 32767) | 0, o); o += 2;
  }
  await writeFile(outPath, buf);
  return outPath;
}
