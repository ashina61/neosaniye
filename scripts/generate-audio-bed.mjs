import {mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const SAMPLE_RATE = 22050;
const AUDIO_ROOT = path.join(process.cwd(), 'public', 'audio');

function wav(durationSeconds, sampleAt) {
  const sampleCount = Math.ceil(durationSeconds * SAMPLE_RATE);
  const dataSize = sampleCount * 2;
  const buffer = Buffer.allocUnsafe(44 + dataSize);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVEfmt ', 8);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let index = 0; index < sampleCount; index += 1) {
    const time = index / SAMPLE_RATE;
    const sample = Math.max(-1, Math.min(1, sampleAt(time, durationSeconds)));
    buffer.writeInt16LE(Math.round(sample * 32767), 44 + index * 2);
  }
  return buffer;
}

function seededNoise(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return (state / 0xffffffff) * 2 - 1;
  };
}

async function main() {
  await mkdir(AUDIO_ROOT, {recursive: true});
  const musicNoise = seededNoise(1868);
  const impactNoise = seededNoise(61);
  const snapNoise = seededNoise(610);
  const files = {
    'music.wav': wav(46, (time, duration) => {
      const fadeIn = Math.min(1, time / 1.2);
      const fadeOut = Math.min(1, Math.max(0, (duration - time) / 2.4));
      const root = time < 15 ? 55 : time < 30 ? 61.74 : 49;
      const bass = Math.sin(2 * Math.PI * root * time) * 0.08;
      const pulse = Math.sin(2 * Math.PI * 45 * time) * Math.exp(-(time % 0.74) * 8) * 0.1;
      const hiss = musicNoise() * 0.006;
      return (bass + pulse + hiss) * fadeIn * fadeOut;
    }),
    'impact.wav': wav(1.6, (time) => (
      Math.sin(2 * Math.PI * (86 - 42 * time) * time) * Math.exp(-4.6 * time) * 0.85
      + impactNoise() * Math.exp(-15 * time) * 0.2
    )),
    'snap.wav': wav(0.38, (time) => (
      snapNoise() * Math.exp(-35 * time) * 0.55
      + Math.sin(2 * Math.PI * 170 * time) * Math.exp(-22 * time) * 0.24
    )),
    'chime.wav': wav(2, (time) => (
      (Math.sin(2 * Math.PI * 610 * time) + 0.55 * Math.sin(2 * Math.PI * 915 * time))
      * Math.exp(-2.5 * time) * 0.2
    )),
  };

  await Promise.all(Object.entries(files).map(([name, buffer]) => writeFile(path.join(AUDIO_ROOT, name), buffer)));
  console.log(JSON.stringify({output: path.relative(process.cwd(), AUDIO_ROOT), files: Object.keys(files)}, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
