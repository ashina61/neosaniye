#!/usr/bin/env node
/**
 * ROOM TONE — SYNTHESISED, NOT SOURCED.
 *
 * The same argument as the film grain in `FilmLook`, which is drawn rather than
 * loaded for a reason worth repeating here: a render that depends on a texture
 * file can fail for something that has nothing to do with the episode. Noise is
 * one of the few things a machine makes perfectly, and so is a low tone.
 *
 * And the alternative is worse than a dependency. Every free music library
 * carries an attribution string, a licence that changes, and a takedown risk on
 * whichever platform the reel lands on — for a sound the viewer is not supposed
 * to notice. A bed that gets a video muted is not worth having.
 *
 *   node scripts/make-bed.mjs --episode=<id> [--seconds=40] [--mood=cold-noir]
 *
 * Deterministic: the episode id is the seed, so the same episode gets the same
 * room every time it is built. Re-running does not quietly change the reel.
 *
 * This is NOT a score. It is the floor the narration stands on — the thing that
 * stops a gap between two sentences being absolute digital silence, which no
 * room has ever been and which the ear reads as the audio dropping out.
 */
import {mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {ROOT, episodeDir, parseArgs} from './lib/episode.mjs';
import {writeWav} from './lib/wav.mjs';

const RATE = 22_050;

/** The same seeded generator the planner uses, for the same reason. */
function seeded(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * WHAT EACH MOOD SOUNDS LIKE, in the only two numbers that matter: how low the
 * tone sits, and how much air is around it. Bounds, not settings — the same
 * rule the look follows, so two episodes in one mood are cousins and two moods
 * are strangers.
 */
const MOODS = {
  'gold-heat': {root: 62, air: 0.34, drift: 0.06},
  'cold-noir': {root: 48, air: 0.5, drift: 0.04},
  'green-rot': {root: 55, air: 0.44, drift: 0.05},
  'ash-grey': {root: 44, air: 0.58, drift: 0.03},
};

async function main() {
  const args = parseArgs();
  const episodeId = typeof args.episode === 'string' ? args.episode : null;
  if (!episodeId) {
    console.error('Usage: node scripts/make-bed.mjs --episode=<episode-id> [--seconds=40] [--mood=cold-noir]');
    process.exit(1);
  }

  const dir = episodeDir(episodeId);
  let mood = typeof args.mood === 'string' ? args.mood : null;
  if (!mood) {
    mood = await import('node:fs/promises')
      .then((fs) => fs.readFile(path.join(dir, 'brief.json'), 'utf8'))
      .then((raw) => JSON.parse(raw).mood)
      .catch(() => 'cold-noir');
  }
  const shape = MOODS[mood] ?? MOODS['cold-noir'];

  const seconds = Math.max(4, Number(args.seconds ?? 45));
  const rand = seeded(`${episodeId}::bed`);
  const total = Math.round(seconds * RATE);
  const out = new Int16Array(total);

  /**
   * THREE VOICES AND NOTHING ELSE.
   *
   * A root, a fifth a hair out of tune with it, and filtered air. The fifth is
   * detuned on purpose: two exactly-tuned sine waves beat against each other in
   * a way the ear hears as an electronic artefact, and a few cents of drift is
   * the difference between a room and a test tone.
   */
  const fifth = shape.root * 1.4983;
  const detune = 1 + (rand() - 0.5) * 0.004;

  // A one-pole low pass on white noise. Cheap, and the only thing standing
  // between "air" and "hiss".
  let lp = 0;
  const cutoff = 0.012 + rand() * 0.006;

  for (let i = 0; i < total; i += 1) {
    const t = i / RATE;
    // The whole bed breathes very slowly, so it never sits still enough to be
    // heard as a loop point.
    const breathe = 1 + Math.sin(t * shape.drift * Math.PI * 2) * 0.22;

    const tone =
      Math.sin(2 * Math.PI * shape.root * t) * 0.55 + Math.sin(2 * Math.PI * fifth * detune * t) * 0.28;

    lp += cutoff * ((rand() * 2 - 1) - lp);
    const air = lp * shape.air;

    // FADE THE HEAD AND THE TAIL. The bed loops under the reel, and a loop that
    // starts at full amplitude puts a click on every wrap — which is far more
    // audible than the bed itself.
    const edge = Math.min(1, Math.min(t, seconds - t) / 1.5);

    const value = (tone * 0.5 + air) * breathe * edge * 0.5;
    out[i] = Math.max(-32768, Math.min(32767, Math.round(value * 32767)));
  }

  const audioDir = path.join(dir, 'audio');
  await mkdir(audioDir, {recursive: true});
  const file = path.join(audioDir, 'bed.wav');
  await writeFile(file, writeWav(out, RATE));

  console.log(
    `✓ ${path.relative(ROOT, file)} — ${seconds.toFixed(0)}s of ${mood} room tone ` +
      `(root ${shape.root}Hz, air ${shape.air})`,
  );
  console.log('  Re-run the planner: it picks the file up and sets `bed` in the config.');
}

main().catch((error) => {
  console.error(error?.stack || error?.message || error);
  process.exit(1);
});
