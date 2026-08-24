/**
 * THE SAME PICTURE TWICE IS ONE PICTURE AND ONE MISTAKE.
 *
 * Three kinds of repeat, in order of how obvious they are to a viewer and
 * inverse order of how easy they are to catch:
 *
 *   THE SAME ASSET. Same provider, same id, or identical bytes. Trivial, and
 *       it happens constantly because two lines about the same subject search
 *       the same words.
 *   A NEAR-DUPLICATE. A different file of the same moment — the next frame, a
 *       different crop, the same photograph re-uploaded at another size. A
 *       perceptual hash catches these and a content hash does not.
 *   THE SAME COMPOSITION. Different subjects, identical framing. Two shots in
 *       a row of a centred object on a dark ground read as one shot with the
 *       middle swapped, which is the slideshow failure this repo already has a
 *       reel-level check for.
 *
 * The last is a preference, not a refusal. Sometimes the story wants the same
 * frame twice — a before and an after are the same composition on purpose — so
 * it demotes rather than rejects, and says so.
 */
import {contentHash} from './cache.mjs';

/**
 * A 64-BIT DIFFERENCE HASH.
 *
 * Downscale to 9x8 greyscale, compare each pixel with its right-hand
 * neighbour, one bit per comparison. Robust to scale, compression and mild
 * colour shifts — which is exactly the set of differences between two uploads
 * of the same photograph — and blind to content, which is why it is a
 * near-duplicate test and not a similarity test.
 */
export async function perceptualHash(sharp, buffer) {
  const {data} = await sharp(buffer)
    .greyscale()
    .resize(9, 8, {fit: 'fill'})
    .raw()
    .toBuffer({resolveWithObject: true});
  let bits = 0n;
  let n = 0n;
  for (let y = 0; y < 8; y += 1) {
    for (let x = 0; x < 8; x += 1) {
      const i = y * 9 + x;
      if (data[i] > data[i + 1]) bits |= 1n << n;
      n += 1n;
    }
  }
  return bits.toString(16).padStart(16, '0');
}

export function hamming(a, b) {
  let x = BigInt(`0x${a}`) ^ BigInt(`0x${b}`);
  let bits = 0;
  while (x) {
    bits += Number(x & 1n);
    x >>= 1n;
  }
  return bits;
}

/** Under this many differing bits, two images are the same photograph. */
export const NEAR_DUPLICATE_BITS = 10;

/**
 * A COMPOSITION FINGERPRINT — where the mass is and how spread out, quantised.
 *
 * Deliberately coarse. The question is not "are these similar pictures" but
 * "would cutting between these look like one shot", and that is answered by
 * three numbers rounded hard.
 */
export function compositionKey(composition) {
  const m = composition?.measured ?? {};
  const q = (v, steps) => Math.round((Number(v) || 0) * steps);
  return `${q(m.massX, 4)}:${q(m.massY, 4)}:${q(m.spread, 5)}`;
}

/**
 * The ledger for one episode. Fed as assets are accepted, asked before the next
 * one is.
 */
export function makeLedger() {
  const byIdentity = new Map();
  const byContent = new Map();
  const perceptual = [];
  const compositions = new Map();

  return {
    /** Everything already accepted, for the manifest and the report. */
    accepted: [],

    check({candidate, buffer, phash, composition}) {
      const identity = `${candidate.provider}:${candidate.id}`;
      if (byIdentity.has(identity)) {
        return {duplicate: 'same asset', of: byIdentity.get(identity), reject: true};
      }
      const content = contentHash(buffer);
      if (byContent.has(content)) {
        return {duplicate: 'identical bytes', of: byContent.get(content), reject: true};
      }
      if (phash) {
        for (const prior of perceptual) {
          const distance = hamming(phash, prior.phash);
          if (distance <= NEAR_DUPLICATE_BITS) {
            return {duplicate: `near-duplicate (${distance} bits differ)`, of: prior.line, reject: true};
          }
        }
      }
      const key = compositionKey(composition);
      if (compositions.has(key)) {
        /**
         * Demoted, not refused: the story is allowed to want the same frame
         * twice, and this layer does not know whether it does.
         */
        return {duplicate: 'same composition', of: compositions.get(key), reject: false, penalty: 1.5};
      }
      return {duplicate: null, reject: false};
    },

    record({candidate, buffer, phash, composition, line}) {
      byIdentity.set(`${candidate.provider}:${candidate.id}`, line);
      byContent.set(contentHash(buffer), line);
      if (phash) perceptual.push({phash, line});
      compositions.set(compositionKey(composition), line);
      this.accepted.push(line);
    },
  };
}
