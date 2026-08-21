/**
 * IS THIS FILE ACTUALLY THE PICTURE THAT WAS ASKED FOR?
 *
 * The most expensive open question this pipeline has. An episode about a wreck
 * off Antikythera asked for "dark green water over a rocky seabed" and got a
 * photograph of a SEA SLUG; it asked for "a plain grey laboratory wall" and got
 * an inkwell; it asked for "a dark green water surface" and got Green Bay,
 * Wisconsin, from orbit. Five of seven files were unrelated to the sentence
 * they were drawn for, and every one of them passed validation, passed the
 * tests, and rendered — because the only question ever asked was "does the file
 * exist and is it non-empty".
 *
 * Answering it properly needs a model that can look at an image. That is the
 * gate this file is shaped around and deliberately leaves open: `describe` is
 * injected, so the day a vision provider is reachable it plugs in here and
 * nothing else changes.
 *
 * WHAT CAN BE ANSWERED WITHOUT ONE is narrower but not nothing, and it is all
 * failure modes this repo has actually shipped:
 *
 *   · a file that is one flat colour — a download that failed politely, a
 *     stand-in nobody replaced, a generator that returned a blank canvas
 *   · the same picture standing in for two different roles, which is how a
 *     six-line episode came out as eleven scenes and eight files with four of
 *     them repeats
 *   · a shape that cannot be what it claims — a "backdrop" that is wider than
 *     it is tall has no chance of filling a 1080x1920 frame without cropping
 *     away most of what was asked for
 */
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

/** Loose on purpose: a gate that cries wolf gets switched off. */
export const ASSET_LIMITS = {
  /** Standard deviation of brightness below this is a flat fill, not a picture. */
  spread: 0.03,
  /** Share of pixels in one brightness bucket above this is the same thing. */
  flat: 0.9,
  /** A backdrop wider than this ratio cannot fill a vertical frame honestly. */
  landscape: 1.15,
};

/**
 * @param {string} file absolute path
 * @returns {Promise<{spread: number, flat: number, width: number, height: number, digest: string}>}
 */
export async function inspectAsset(file) {
  const bytes = await readFile(file);
  const digest = createHash('sha1').update(bytes).digest('hex');
  const image = sharp(bytes);
  const meta = await image.metadata();

  // Small enough to be quick, large enough that a picture still looks like one.
  const {data, info} = await image.clone().greyscale().resize(96, 96, {fit: 'fill'}).raw().toBuffer({
    resolveWithObject: true,
  });
  const total = info.width * info.height;

  const buckets = new Uint32Array(32);
  let sum = 0;
  for (let i = 0; i < total; i += 1) {
    sum += data[i];
    buckets[data[i] >> 3] += 1;
  }
  const mean = sum / total;
  let variance = 0;
  for (let i = 0; i < total; i += 1) variance += (data[i] - mean) ** 2;
  let peak = 0;
  for (const count of buckets) if (count > peak) peak = count;

  return {
    spread: Math.sqrt(variance / total) / 255,
    flat: peak / total,
    width: meta.width ?? 0,
    height: meta.height ?? 0,
    digest,
  };
}

/**
 * Every asset an episode names, checked against the three things that can be
 * known from the pixels alone.
 *
 * @param {{role: string, file: string, absolute: string, kind?: string}[]} assets
 * @param {{describe?: (absolute: string) => Promise<string>, wanted?: Record<string, string>}} [options]
 *   `describe` is the hook a vision provider fills. Absent, the relevance check
 *   is SKIPPED AND SAID TO BE SKIPPED — silently downgrading to "looks fine" is
 *   how five wrong files shipped in the first place.
 * @returns {Promise<{notes: string[], checkedRelevance: boolean}>}
 */
export async function auditAssets(assets, {describe, wanted = {}} = {}) {
  const notes = [];
  const seen = new Map();

  for (const asset of assets) {
    let stats;
    try {
      stats = await inspectAsset(asset.absolute);
    } catch (error) {
      notes.push(`${asset.file}: could not be read as an image — ${error.message}`);
      continue;
    }

    if (stats.spread < ASSET_LIMITS.spread || stats.flat > ASSET_LIMITS.flat) {
      notes.push(
        `${asset.file}: is one flat tone (spread ${stats.spread.toFixed(3)}) — a blank canvas, ` +
          'a stand-in, or a download that wrote an error page',
      );
    }

    if (asset.kind === 'backdrop' && stats.height > 0 && stats.width / stats.height > ASSET_LIMITS.landscape) {
      notes.push(
        `${asset.file}: is ${stats.width}x${stats.height} — a landscape plate in a 9:16 frame ` +
          'crops away most of what was asked for',
      );
    }

    const twin = seen.get(stats.digest);
    if (twin) notes.push(`${asset.file}: is byte-identical to ${twin} — two roles, one picture`);
    else seen.set(stats.digest, asset.file);
  }

  /**
   * AND THE QUESTION THAT MATTERS, when there is something that can answer it.
   *
   * Deliberately blunt: the description comes back, and the words the brief
   * asked for either appear in it or they do not. A subtler score would need
   * tuning against examples this repo does not have; "the sentence said seabed
   * and the picture is described as a sea slug" needs no tuning at all.
   */
  if (!describe) return {notes, checkedRelevance: false};

  for (const asset of assets) {
    const want = wanted[asset.file];
    if (!want) continue;
    const said = (await describe(asset.absolute).catch(() => '')).toLowerCase();
    if (!said) continue;
    const terms = want
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((word) => word.length > 3);
    const hits = terms.filter((term) => said.includes(term));
    if (terms.length >= 2 && hits.length === 0) {
      notes.push(`${asset.file}: asked for "${want}" but reads as "${said.slice(0, 90)}"`);
    }
  }
  return {notes, checkedRelevance: true};
}

/** The assets a config names, as absolute paths, with their recipe kind. */
export function assetsOf(config, dir, recipes = {}) {
  const out = [];
  const push = (file) => {
    if (!file || out.some((a) => a.file === file)) return;
    out.push({role: file, file, absolute: path.join(dir, file), kind: recipes[path.basename(file)]?.kind});
  };
  for (const scene of config?.scenes ?? []) {
    for (const file of Object.values(scene.assets ?? {})) push(String(file));
  }
  return out;
}
