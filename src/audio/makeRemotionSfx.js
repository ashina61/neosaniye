import path from 'node:path';
import {mkdir, writeFile} from 'node:fs/promises';

const SR = 44100;

function clamp(value, low = -1, high = 1) {
  return Math.max(low, Math.min(high, value));
}

function seedHash(value) {
  let h = 2166136261;
  for (const ch of String(value || 'neosaniye')) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function random(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function wavBuffer(seconds, channels, sampleFn) {
  const frames = Math.ceil(seconds * SR);
  const bytesPerFrame = channels * 2;
  const dataBytes = frames * bytesPerFrame;
  const buffer = Buffer.alloc(44 + dataBytes);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataBytes, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(SR, 24);
  buffer.writeUInt32LE(SR * bytesPerFrame, 28);
  buffer.writeUInt16LE(bytesPerFrame, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataBytes, 40);
  let offset = 44;
  for (let i = 0; i < frames; i += 1) {
    const t = i / SR;
    const values = sampleFn(t, seconds);
    for (let channel = 0; channel < channels; channel += 1) {
      const value = Array.isArray(values) ? values[channel] : values;
      buffer.writeInt16LE(Math.round(clamp(value) * 32767), offset);
      offset += 2;
    }
  }
  return buffer;
}

function smoothedNoise(seed) {
  const rnd = random(seed);
  const points = Array.from({length: 16386}, () => rnd() * 2 - 1);
  return (t, speed = 1) => {
    const position = (t * speed) % 16384;
    const index = Math.floor(position);
    let fraction = position - index;
    fraction = fraction * fraction * (3 - 2 * fraction);
    return points[index] + (points[index + 1] - points[index]) * fraction;
  };
}

async function writeEffect(outDir, name, seconds, sampleFn) {
  const filePath = path.join(outDir, `${name}.wav`);
  await writeFile(filePath, wavBuffer(seconds, 1, sampleFn));
  return filePath;
}

export async function makeRemotionSfxPack({outDir, publicPrefix, seed = 'neosaniye'} = {}) {
  if (!outDir || !publicPrefix) throw new Error('REMOTION_SFX_OUTPUT_REQUIRED');
  await mkdir(outDir, {recursive: true});
  const base = seedHash(seed);
  const n1 = smoothedNoise(base + 11);
  const n2 = smoothedNoise(base + 29);

  const definitions = {
    'whoosh-entrance': [1.25, (t, d) => n1(t, 150) * Math.sin(Math.PI * t / d) ** 1.8 * 0.58],
    'whoosh-long': [2.1, (t, d) => (n1(t, 85) + Math.sin(2 * Math.PI * (95 + 260 * t) * t) * 0.22) * Math.sin(Math.PI * t / d) ** 1.55 * 0.5],
    'whoosh-pan': [0.85, (t, d) => n2(t, 220) * Math.sin(Math.PI * t / d) ** 2 * 0.62],
    'camera-shutter': [0.65, (t) => n2(t, 620) * Math.exp(-31 * t) * 0.72 + Math.sin(2 * Math.PI * 115 * t) * Math.exp(-20 * t) * 0.32],
    'focus-hunt': [1.45, (t, d) => Math.sin(2 * Math.PI * (170 + 760 * t / d) * t) * Math.sin(Math.PI * t / d) ** 2 * 0.27 + n1(t, 35) * 0.06],
    paper: [1.55, (t, d) => (n1(t, 250) * 0.28 + n2(t, 53) * 0.18) * Math.sin(Math.PI * t / d) ** 0.65],
    stamp: [0.75, (t) => Math.sin(2 * Math.PI * 62 * t) * Math.exp(-9 * t) * 0.82 + n1(t, 290) * Math.exp(-19 * t) * 0.42],
    cash: [1.55, (t) => (Math.sin(2 * Math.PI * 1420 * t) + 0.55 * Math.sin(2 * Math.PI * 2030 * t)) * Math.exp(-4 * t) * 0.25 + n2(t, 190) * Math.exp(-4.5 * t) * 0.09],
    impact: [1.25, (t) => Math.sin(2 * Math.PI * (74 - 25 * t) * t) * Math.exp(-4.2 * t) * 0.86 + n1(t, 90) * Math.exp(-13 * t) * 0.34],
    heartbeat: [2.6, (t) => {
      const phase = t % 1.02;
      const first = phase < 0.24 ? Math.sin(2 * Math.PI * 54 * phase) * Math.exp(-24 * phase) : 0;
      const secondPhase = phase - 0.18;
      const second = secondPhase >= 0 && secondPhase < 0.2 ? Math.sin(2 * Math.PI * 47 * secondPhase) * Math.exp(-28 * secondPhase) : 0;
      return first * 0.62 + second * 0.38;
    }],
    'final-boom': [1.7, (t) => Math.sin(2 * Math.PI * (47 - 9 * t) * t) * Math.exp(-1.85 * t) * 0.9 + Math.sin(2 * Math.PI * 23 * t) * Math.exp(-2.6 * t) * 0.4],
    // Elektrik uğultusu: para odasındaki sallanan lambanın altında durur;
    // ışığın kodla çizildiğini kulakla da doğrular.
    'neon-buzz': [2.4, (t) => {
      const flicker = t < 0.35 && Math.sin(2 * Math.PI * 31 * t) < 0 ? 0.35 : 1;
      return (Math.sin(2 * Math.PI * 120 * t) * 0.18 + Math.sin(2 * Math.PI * 240 * t) * 0.07 + n2(t, 400) * 0.05) * flicker;
    }],
  };

  const library = {};
  for (const [family, [seconds, sampleFn]] of Object.entries(definitions)) {
    await writeEffect(outDir, family, seconds, sampleFn);
    library[family] = {
      path: `${publicPrefix}/${family}.wav`,
      durationInFrames: Math.ceil(seconds * 30),
      // Karışım kuralı: kelimeler her zaman kazanır. Uğultu ve kalp atışı gibi
      // altta duran aileler kısık, olay vuruşları (whoosh, impact) tam gelir.
      volume: family === 'neon-buzz' ? 0.3 : family === 'heartbeat' ? 0.42 : family === 'paper' ? 0.48 : 0.68,
      license: 'proprietary-original',
      licenseEvidence: 'src/audio/makeRemotionSfx.js',
    };
  }
  return library;
}
