/**
 * WHERE THE NARRATOR STOPPED — measured off the audio itself.
 *
 * The reference build gets its scene lengths from a synthesiser that hands back
 * per-character timings. That is the exact way, and it ties the whole pipeline
 * to one vendor: the day that vendor errors, or bills, or drops the timestamps
 * endpoint from the free tier, the clock is gone.
 *
 * But the pauses are IN THE FILE. A documentary narrator leaves a real silence
 * between one sentence and the next, and finding those silences needs no API at
 * all — it needs the samples. So synthesis and measurement are two steps, and
 * only the first one belongs to anybody:
 *
 *   SPEAK    ElevenLabs, OpenAI, a microphone, a colleague. Anything.
 *   MEASURE  this file, on the mp3 that came out.
 *
 * Which also means a hand-recorded voiceover works, and so does one somebody
 * sends over — the pipeline stops caring where the words came from.
 *
 * Nothing here knows what an episode is. It takes samples and a count, and
 * returns seconds.
 */

/**
 * RMS per window, in a form the pause finder can walk.
 *
 * @param {Int16Array} samples mono PCM
 * @param {number} sampleRate
 * @param {number} windowMs
 * @returns {Float32Array} loudness 0..1 per window
 */
export function loudness(samples, sampleRate, windowMs = 20) {
  const size = Math.max(1, Math.round((sampleRate * windowMs) / 1000));
  const count = Math.ceil(samples.length / size);
  const out = new Float32Array(count);
  for (let w = 0; w < count; w += 1) {
    let sum = 0;
    const from = w * size;
    const to = Math.min(samples.length, from + size);
    for (let i = from; i < to; i += 1) sum += samples[i] * samples[i];
    out[w] = Math.sqrt(sum / Math.max(1, to - from)) / 32768;
  }
  return out;
}

/**
 * THE N-1 PLACES A SIX-LINE SCRIPT WAS CUT.
 *
 * Not "every silence" — a narrator pauses inside a sentence too, and a comma
 * can leave a longer gap than a full stop when the reading is expressive. What
 * is known is HOW MANY boundaries there are: one fewer than there are lines. So
 * every quiet run is found, the longest ones are taken, and they are put back
 * in time order. Asking for the longest N rather than everything over a
 * threshold is what makes this robust to a narrator who breathes oddly.
 *
 * The boundary is the START of the pause, because that is where the previous
 * line stopped being spoken — and the silence itself belongs to the line that
 * follows it, so the cut lands on the breath before a sentence rather than in
 * the middle of the one that just ended.
 *
 * @param {Float32Array} windows loudness per window
 * @param {number} windowMs
 * @param {number} count how many boundaries to find (lines - 1)
 * @param {{floor?: number, minPauseMs?: number}} [options]
 * @returns {number[]} boundary times in seconds, ascending
 */
export function findBoundaries(windows, windowMs, count, {floor = 0.12, minPauseMs = 90} = {}) {
  if (count <= 0) return [];

  // The threshold is relative to how loud THIS recording is. An absolute one
  // finds every window in a quiet render and none in a loud one.
  let peak = 0;
  for (const value of windows) if (value > peak) peak = value;
  const quiet = peak * floor;
  const minWindows = Math.max(1, Math.round(minPauseMs / windowMs));

  const runs = [];
  let start = -1;
  for (let i = 0; i <= windows.length; i += 1) {
    const isQuiet = i < windows.length && windows[i] <= quiet;
    if (isQuiet && start < 0) start = i;
    else if (!isQuiet && start >= 0) {
      if (i - start >= minWindows) runs.push({start, length: i - start});
      start = -1;
    }
  }

  // Leading silence is not a boundary between two lines — it is the top of the
  // file, and taking it would push every line one place along.
  const inner = runs.filter((run) => run.start > 0);
  return inner
    .sort((a, b) => b.length - a.length)
    .slice(0, count)
    .map((run) => (run.start * windowMs) / 1000)
    .sort((a, b) => a - b);
}

/**
 * Boundaries → one window per line, covering the file end to end.
 *
 * @param {string[]} lines
 * @param {number[]} boundaries
 * @param {number} duration seconds
 */
export function windowsFromBoundaries(lines, boundaries, duration) {
  const edges = [0, ...boundaries, duration];
  return lines.map((text, i) => ({
    text: text.trim(),
    start: edges[i] ?? 0,
    end: edges[i + 1] ?? duration,
  }));
}
