#!/usr/bin/env node
/**
 * A SCORE THAT BUILDS — synthesised, deterministic, no files, no licence.
 *
 * The robot narrator is gone. It was the honest option offline and it was also
 * the worst thing in the video: a 1980s formant synthesiser reading Turkish is
 * not a documentary voice, it is a novelty, and no amount of design survives
 * being scored by one. The format that works without a voice is the one this
 * reel is now — continuous motion, burnt-in type, and music that goes
 * somewhere.
 *
 * The whole thing is three ideas:
 *
 *   PULSE     a kick on the beat, arriving once the picture is moving. It is
 *             the clock the eye syncs to, and without it a thirty-second
 *             continuous zoom has no sense of how far through it is.
 *   RISE      an open fifth whose filter opens across the whole piece. Nothing
 *             changes key and nothing resolves: the subject does not resolve
 *             either, it just keeps doubling.
 *   ARRIVAL   everything stops at the payoff, one low hit lands, and the tail
 *             decays into silence. A reel that ends with the music still
 *             running feels cut off.
 *
 *   node scripts/make-score.mjs --episode=<id> [--seconds=30]
 */
import {mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {ROOT, episodeDir, parseArgs} from './lib/episode.mjs';
import {writeWav} from './lib/wav.mjs';

const RATE = 44_100;

/** A minor, low. Open fifths only — a third would commit to a mood, and this
 *  piece is about scale rather than about feeling a particular way. */
const ROOT_HZ = 55; // A1
const FIFTH = ROOT_HZ * 1.4983;
const OCTAVE = ROOT_HZ * 2;
const TWELFTH = ROOT_HZ * 3;

/** Deterministic noise. The same reel builds the same score twice. */
function noiseSource(seed = 0x2545f491) {
  let s = seed >>> 0;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) / 4294967296) * 2 - 1;
  };
}

/**
 * A KICK IS A PITCH DROP.
 *
 * A sine at a fixed low frequency is a hum; the same sine falling from 150Hz to
 * 45Hz in a tenth of a second is a struck object, because that is what struck
 * objects do. A little click on top so it survives a phone speaker, which
 * cannot reproduce 45Hz at all.
 */
function kick(out, at, gain = 1) {
  const start = Math.round(at * RATE);
  const length = Math.round(0.34 * RATE);
  let phase = 0;
  for (let i = 0; i < length && start + i < out.length; i += 1) {
    const t = i / RATE;
    const freq = 150 * Math.exp(-t * 22) + 46;
    phase += (2 * Math.PI * freq) / RATE;
    const env = Math.exp(-t * 11);
    const click = Math.exp(-t * 260) * 0.3;
    out[start + i] += (Math.sin(phase) * env + click) * gain;
  }
}

async function main() {
  const args = parseArgs();
  const id = typeof args.episode === 'string' ? args.episode : null;
  if (!id) {
    console.error('Usage: node scripts/make-score.mjs --episode=<episode-id> [--seconds=30]');
    process.exit(1);
  }

  const seconds = Number(args.seconds ?? 30);
  const total = Math.round(seconds * RATE);
  const mix = new Float32Array(total);

  /** Where the piece stops building and lands. Everything is timed off this. */
  const arrival = seconds - 4.2;
  const noise = noiseSource();

  let p1 = 0;
  let p2 = 0;
  let p3 = 0;
  let p4 = 0;
  let lp = 0;
  let hp = 0;

  for (let i = 0; i < total; i += 1) {
    const t = i / RATE;
    /** 0 → 1 across the build. Linear, like the fold count it is scoring. */
    const build = Math.min(1, Math.max(0, t / arrival));

    p1 += (2 * Math.PI * ROOT_HZ) / RATE;
    p2 += (2 * Math.PI * FIFTH) / RATE;
    p3 += (2 * Math.PI * OCTAVE) / RATE;
    p4 += (2 * Math.PI * TWELFTH) / RATE;

    // The upper voices are not there at the start. They arrive as the stack
    // starts outgrowing things, so the music gains weight exactly where the
    // picture does.
    const sub = Math.sin(p1) * 0.5;
    const fifth = Math.sin(p2) * 0.26 * Math.min(1, build * 2.2);
    const oct = Math.sin(p3) * 0.16 * Math.max(0, build * 1.6 - 0.35);
    const twelfth = Math.sin(p4) * 0.09 * Math.max(0, build * 1.5 - 0.62);

    // Air, opening as it climbs — the same trick as a riser, stretched over the
    // whole piece so it is felt rather than heard.
    lp += (0.0025 + build * build * 0.05) * (noise() - lp);
    hp = lp - hp * 0.0006;
    const air = lp * (0.1 + build * 0.5);

    // A slow tremolo, quickening. The ear reads an accelerating pulse as
    // something running out of time.
    const rate = 1.6 + build * 3.4;
    const trem = 0.82 + 0.18 * Math.sin(2 * Math.PI * rate * t);

    const tail = t > arrival ? Math.exp(-(t - arrival) * 1.5) : 1;
    mix[i] += (sub + fifth + oct + twelfth) * trem * 0.5 * tail + air * tail;
  }

  /**
   * THE PULSE, ON THE BEAT, GETTING CLOSER TOGETHER.
   *
   * Doubling every beat would be unlistenable inside ten seconds, so the
   * interval shortens smoothly instead: the FEELING of acceleration without the
   * arithmetic of it. The picture is already doing the arithmetic.
   */
  let at = 2.4;
  let step = 1.2;
  while (at < arrival - 0.2) {
    kick(mix, at, 0.5 + 0.5 * (at / arrival));
    step = Math.max(0.3, step * 0.955);
    at += step;
  }

  // ARRIVAL: one hit, twice the weight of any beat before it, then nothing but
  // the tail. This is the only moment in the piece that is louder than the one
  // before it.
  kick(mix, arrival, 1.7);

  const out = new Int16Array(total);
  let peak = 0;
  for (const value of mix) peak = Math.max(peak, Math.abs(value));
  const norm = peak > 0 ? 0.89 / peak : 1;
  for (let i = 0; i < total; i += 1) {
    // A soft clip rather than a hard one: a limiter that squares the tops off
    // adds harmonics that read as distortion on a phone speaker.
    const v = Math.tanh(mix[i] * norm * 1.1);
    const fade = Math.min(1, i / (RATE * 0.6), (total - i) / (RATE * 0.5));
    out[i] = Math.round(Math.max(-1, Math.min(1, v)) * fade * 32767);
  }

  const dir = path.join(episodeDir(id), 'audio');
  await mkdir(dir, {recursive: true});
  const file = path.join(dir, 'score.wav');
  await writeFile(file, writeWav(out, RATE));
  console.log(`✓ ${path.relative(ROOT, file)} — ${seconds}s, arrival at ${arrival.toFixed(1)}s`);
}

main().catch((error) => {
  console.error(error?.stack || error?.message || error);
  process.exit(1);
});
