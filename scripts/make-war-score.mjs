#!/usr/bin/env node
/**
 * SEPTEMBER 1939 — A SCORE, SYNTHESISED.
 *
 * No library, no licence, no attribution string, and nothing to download. The
 * same argument as the grain and the room tone, and it matters more here: a
 * film about this subject scored with a stock "epic war trailer" cue would be
 * telling the viewer how to feel about something it has not shown them yet.
 *
 * Five voices, each doing one job:
 *
 *   TICK    a clock, alone, before anything else. The only thing in the mix for
 *           four seconds, so its stopping is an event.
 *   HIT     one strike at 04:45. Everything that follows is downstream of it.
 *   DRONE   a low open fifth that never resolves, because this does not.
 *   SNARE   a march that starts as a roll and hardens into a beat. It speeds up
 *           twice — at the border and at the blitz — and stops dead at the
 *           declaration, which is the only silence in the middle of the film.
 *   SIREN   an air-raid two-tone, distant, under the advance. Not a sound
 *           effect: it is the only voice in the piece that is a real sound
 *           people heard, and it is mixed low enough to be recognised rather
 *           than announced.
 *
 *   node scripts/make-war-score.mjs --episode=<id> [--seconds=49]
 */
import {mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {ROOT, episodeDir, parseArgs} from './lib/episode.mjs';
import {writeWav} from './lib/wav.mjs';

const RATE = 44_100;

function noiseSource(seed = 0x1f123bb5) {
  let s = seed >>> 0;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) / 4294967296) * 2 - 1;
  };
}

/** A clock escapement: two clicks, unequal, because a real one is not even. */
function tick(out, at, gain) {
  const start = Math.round(at * RATE);
  const n = noiseSource(Math.round(at * 1000) + 7);
  for (let i = 0; i < Math.round(0.05 * RATE); i += 1) {
    const t = i / RATE;
    const env = Math.exp(-t * 260);
    const body = Math.sin(2 * Math.PI * 2400 * t) * 0.5 + n() * 0.5;
    if (start + i < out.length) out[start + i] += body * env * gain;
  }
}

/** A snare is noise with a tuned shell under it. Without the shell it is a
 *  hiss; the two together are a drum. */
function snare(out, at, gain, length = 0.16) {
  const start = Math.round(at * RATE);
  const n = noiseSource(Math.round(at * 977) + 13);
  const total = Math.round(length * RATE);
  let hp = 0;
  for (let i = 0; i < total; i += 1) {
    const t = i / RATE;
    const env = Math.exp(-t * 26);
    const raw = n();
    hp = raw - hp * 0.02;
    const shell = Math.sin(2 * Math.PI * 185 * t) * 0.34 + Math.sin(2 * Math.PI * 278 * t) * 0.2;
    if (start + i < out.length) out[start + i] += (hp * 0.8 + shell) * env * gain;
  }
}

/** The strike at 04:45: a pitch drop with a long tail of low noise behind it. */
function hit(out, at, gain) {
  const start = Math.round(at * RATE);
  const n = noiseSource(4045);
  let lp = 0;
  const total = Math.round(3.2 * RATE);
  let phase = 0;
  for (let i = 0; i < total; i += 1) {
    const t = i / RATE;
    const freq = 190 * Math.exp(-t * 9) + 38;
    phase += (2 * Math.PI * freq) / RATE;
    lp += 0.004 * (n() - lp);
    const env = Math.exp(-t * 2.1);
    if (start + i < out.length) out[start + i] += (Math.sin(phase) * 0.9 + lp * 2.4) * env * gain;
  }
}

async function main() {
  const args = parseArgs();
  const id = typeof args.episode === 'string' ? args.episode : null;
  if (!id) {
    console.error('Usage: node scripts/make-war-score.mjs --episode=<episode-id> [--seconds=49]');
    process.exit(1);
  }
  const seconds = Number(args.seconds ?? 49);
  const total = Math.round(seconds * RATE);
  const mix = new Float32Array(total);

  /** The film's own beats, in seconds. The score is written to them rather than
   *  laid over them. */
  const T = {invade: 4.4, border: 12.4, blitz: 19.6, wire: 25.4, east: 31.6, toll: 38.4, close: 43.6};

  // TICK — alone, then gone. Its absence after 04:45 is the point.
  for (let t = 0.55; t < T.invade - 0.1; t += 0.5) tick(mix, t, 0.5);

  hit(mix, T.invade, 1.0);
  hit(mix, T.east, 0.6);
  hit(mix, T.close, 0.85);

  // DRONE + SIREN, sample by sample.
  const n = noiseSource();
  let p1 = 0;
  let p2 = 0;
  let lp = 0;
  for (let i = 0; i < total; i += 1) {
    const t = i / RATE;
    const on = Math.max(0, Math.min(1, (t - T.invade) / 1.6));
    const away = t > T.toll ? Math.exp(-(t - T.toll) * 0.5) : 1;

    p1 += (2 * Math.PI * 49) / RATE;
    p2 += (2 * Math.PI * 73.4) / RATE;
    const drone = (Math.sin(p1) * 0.5 + Math.sin(p2) * 0.26) * on * away * 0.38;

    lp += 0.0016 * (n() - lp);
    const air = lp * 0.55 * on * away;

    // The two-tone, only under the advance and only just audible.
    const sirenOn = t > T.border && t < T.wire ? Math.min(1, (t - T.border) / 2) * Math.min(1, (T.wire - t) / 1.5) : 0;
    const wobble = 380 + 210 * (0.5 + 0.5 * Math.sin(2 * Math.PI * 0.22 * t));
    const siren = Math.sin(2 * Math.PI * wobble * t) * 0.07 * sirenOn;

    mix[i] += drone + air + siren;
  }

  /**
   * THE MARCH.
   *
   * A roll that hardens into a beat and steps up twice, then stops dead at the
   * wire report — the only silence in the middle of the film, and the reason
   * the typing lands.
   */
  let beat = T.invade + 1.2;
  let step = 0.62;
  while (beat < T.wire - 0.3) {
    const drive = beat > T.blitz ? 1 : beat > T.border ? 0.72 : 0.4;
    snare(mix, beat, 0.5 * drive);
    if (beat > T.border) snare(mix, beat + step / 2, 0.22 * drive, 0.1);
    if (beat > T.blitz) snare(mix, beat + step / 4, 0.14, 0.07);
    step = beat > T.blitz ? 0.3 : beat > T.border ? 0.44 : 0.62;
    beat += step;
  }
  beat = T.east;
  while (beat < T.toll - 0.2) {
    snare(mix, beat, 0.4);
    snare(mix, beat + 0.22, 0.18, 0.1);
    beat += 0.46;
  }

  const out = new Int16Array(total);
  let peak = 0;
  for (const v of mix) peak = Math.max(peak, Math.abs(v));
  const norm = peak > 0 ? 0.88 / peak : 1;
  for (let i = 0; i < total; i += 1) {
    const fade = Math.min(1, i / (RATE * 0.4), (total - i) / (RATE * 1.2));
    out[i] = Math.round(Math.max(-1, Math.min(1, Math.tanh(mix[i] * norm * 1.15))) * fade * 32767);
  }

  const dir = path.join(episodeDir(id), 'audio');
  await mkdir(dir, {recursive: true});
  const file = path.join(dir, 'score.wav');
  await writeFile(file, writeWav(out, RATE));
  console.log(`✓ ${path.relative(ROOT, file)} — ${seconds}s`);
}

main().catch((error) => {
  console.error(error?.stack || error?.message || error);
  process.exit(1);
});
