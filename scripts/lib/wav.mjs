/**
 * A 16-bit mono WAV, written and read.
 *
 * Small enough to own outright, and owning it is the point: the narration has
 * to end up as a file the render can play, and going through a third-party
 * encoder to get there would put a dependency between the words and the reel.
 */

const HEADER = 44;

/** @param {Int16Array} samples @param {number} sampleRate */
export function writeWav(samples, sampleRate) {
  const bytes = samples.length * 2;
  const out = Buffer.alloc(HEADER + bytes);
  out.write('RIFF', 0, 'ascii');
  out.writeUInt32LE(36 + bytes, 4);
  out.write('WAVE', 8, 'ascii');
  out.write('fmt ', 12, 'ascii');
  out.writeUInt32LE(16, 16); // PCM chunk size
  out.writeUInt16LE(1, 20); // format: PCM
  out.writeUInt16LE(1, 22); // channels
  out.writeUInt32LE(sampleRate, 24);
  out.writeUInt32LE(sampleRate * 2, 28); // byte rate
  out.writeUInt16LE(2, 32); // block align
  out.writeUInt16LE(16, 34); // bits per sample
  out.write('data', 36, 'ascii');
  out.writeUInt32LE(bytes, 40);
  for (let i = 0; i < samples.length; i += 1) out.writeInt16LE(samples[i], HEADER + i * 2);
  return out;
}

/**
 * Samples out of a WAV, by walking to the `data` chunk.
 *
 * NOT by assuming 44 bytes: encoders write a LIST/INFO chunk of their own, and
 * a fixed offset then reads metadata as audio — which shifts every sample and,
 * downstream of here, every cut in the reel.
 */
export function readWav(buffer) {
  let offset = 12;
  while (offset + 8 <= buffer.length && buffer.toString('ascii', offset, offset + 4) !== 'data') {
    offset += 8 + buffer.readUInt32LE(offset + 4);
  }
  if (offset + 8 > buffer.length) throw new Error('no data chunk in the audio');
  const start = offset + 8;
  const length = Math.min(buffer.readUInt32LE(offset + 4), buffer.length - start);
  const samples = new Int16Array(length >> 1);
  for (let i = 0; i < samples.length; i += 1) samples[i] = buffer.readInt16LE(start + i * 2);
  return samples;
}

/**
 * SPOKEN CLIPS JOINED BY A KNOWN SILENCE.
 *
 * The exception to measuring, and the reason it is allowed: when the gaps are
 * put there by us rather than by a narrator, the boundaries are ARITHMETIC. A
 * one-pass reading has to be measured because only the reader knows where the
 * pauses fell; a set of per-line clips does not, because we are the one joining
 * them, and knowing beats measuring every time.
 *
 * The boundary sits near the END of the silence, a fixed lead before the next
 * clip speaks — the same rule the measurer applies to a one-pass reading, so
 * the two paths cut in the same place. Handing the WHOLE pause to the next line
 * instead was the older rule here, and it meant every shot opened with however
 * long the narrator happened to hold: on a take with 1.7-second pauses, nearly
 * two seconds of silent picture at the head of all thirteen shots.
 *
 * @param {Int16Array[]} clips
 * @param {number} sampleRate
 * @param {number} gapSeconds
 * @returns {{samples: Int16Array, boundaries: number[], duration: number}}
 */
export function joinWithGaps(clips, sampleRate, gapSeconds = 0.55, leadSeconds = 0.16) {
  const gap = Math.round(gapSeconds * sampleRate);
  /**
   * WHERE THE CUT GOES INSIDE THE PAUSE.
   *
   * One convention, and it has to be the same one the measurer uses or the
   * draft cut and the cut made from a real recording differ by the length of a
   * breath in every shot. The pause belongs to the OUTGOING line, except for a
   * short lead handed to the incoming one: picture arrives just before the
   * sentence does, which is how a cut is made, and by a fixed amount rather
   * than by however long the narrator happened to pause.
   */
  const lead = Math.min(Math.round(leadSeconds * sampleRate), Math.floor(gap / 2));
  const total = clips.reduce((sum, clip) => sum + clip.length, 0) + gap * Math.max(0, clips.length - 1);
  const samples = new Int16Array(total);

  const boundaries = [];
  let cursor = 0;
  clips.forEach((clip, i) => {
    samples.set(clip, cursor);
    cursor += clip.length;
    if (i < clips.length - 1) {
      boundaries.push((cursor + gap - lead) / sampleRate);
      cursor += gap;
    }
  });

  return {samples, boundaries, duration: total / sampleRate};
}
