#!/usr/bin/env node
/**
 * THE TWO SOUNDS A CUT NEEDS — SYNTHESISED, NOT SOURCED.
 *
 * Same argument as the room tone and the film grain: a render that depends on a
 * downloaded sample fails for a reason that has nothing to do with the episode.
 * And a free sample library is an attribution string, a licence that changes,
 * and a takedown risk on whichever platform the reel lands on — for a sound the
 * viewer is not supposed to notice.
 *
 *   thump   a low sine dropping in pitch, gone in a fifth of a second. Goes
 *           UNDER a hard change of picture: the ear confirms what the eye saw,
 *           and that is the whole difference between a cut and a jump.
 *   riser   filtered noise climbing for a second and a half, ending exactly on
 *           the cut. It creates the expectation the cut then satisfies —
 *           without it a reveal simply happens.
 *
 *   node scripts/make-sfx.mjs --episode=<id>
 */
import {mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {ROOT, episodeDir, parseArgs} from './lib/episode.mjs';
import {writeWav} from './lib/wav.mjs';

const RATE = 22_050;

/**
 * A KICK IS A PITCH DROP, NOT A CLICK.
 *
 * A sine at a fixed low frequency is a hum; the same sine falling from 120Hz to
 * 45Hz over 120 milliseconds is a hit, because a falling pitch is what a struck
 * object does. The decay has to be fast — anything that rings sounds like a
 * musical note and starts belonging to a key the reel does not have.
 */
function thump(seconds = 0.42) {
  const total = Math.round(seconds * RATE);
  const out = new Int16Array(total);
  let phase = 0;
  for (let i = 0; i < total; i += 1) {
    const t = i / RATE;
    const freq = 120 * Math.exp(-t * 16) + 42;
    phase += (2 * Math.PI * freq) / RATE;
    const env = Math.exp(-t * 13);
    // A touch of click at the very top so it reads on a phone speaker, which
    // cannot reproduce 45Hz at all and would otherwise play silence.
    const click = Math.exp(-t * 220) * (Math.random() * 0 + Math.sin(phase * 7)) * 0.25;
    out[i] = Math.max(-32768, Math.min(32767, Math.round((Math.sin(phase) * env + click) * 0.85 * 32767)));
  }
  return out;
}

/**
 * A RISER IS FILTERED NOISE THAT OPENS.
 *
 * Noise through a low-pass whose cutoff climbs: it starts as a rumble and ends
 * as a hiss, and the opening is what the ear hears as "something is coming".
 * It ends AT the cut, not after it — a riser that overshoots its landing is a
 * sound effect rather than a piece of edit.
 */
function riser(seconds = 1.5) {
  const total = Math.round(seconds * RATE);
  const out = new Int16Array(total);
  let lp = 0;
  // Deterministic noise: the same reel builds the same sound twice.
  let seed = 0x9e3779b9;
  const noise = () => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return ((seed >>> 0) / 4294967296) * 2 - 1;
  };
  for (let i = 0; i < total; i += 1) {
    const t = i / seconds / RATE;
    const cutoff = 0.004 + t * t * 0.28;
    lp += cutoff * (noise() - lp);
    const env = t ** 2.2;
    out[i] = Math.max(-32768, Math.min(32767, Math.round(lp * env * 0.9 * 32767)));
  }
  return out;
}

async function main() {
  const args = parseArgs();
  const id = typeof args.episode === 'string' ? args.episode : null;
  if (!id) {
    console.error('Usage: node scripts/make-sfx.mjs --episode=<episode-id>');
    process.exit(1);
  }
  const dir = path.join(episodeDir(id), 'audio');
  await mkdir(dir, {recursive: true});
  await writeFile(path.join(dir, 'thump.wav'), writeWav(thump(), RATE));
  await writeFile(path.join(dir, 'riser.wav'), writeWav(riser(), RATE));
  console.log(`✓ ${path.relative(ROOT, dir)}/thump.wav + riser.wav`);
}

main().catch((error) => {
  console.error(error?.stack || error?.message || error);
  process.exit(1);
});
