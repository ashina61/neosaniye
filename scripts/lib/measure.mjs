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
export function findBoundaries(windows, windowMs, count, {floor = 0.12, minPauseMs = 90, leadMs = 160} = {}) {
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

  /**
   * THE BOUNDARY IS WHERE THE NEXT LINE STARTS, NOT WHERE THE LAST ONE STOPPED.
   *
   * Taking the head of the silent run put every cut at the moment the previous
   * sentence ended, which sounds like the same thing and is not: the new shot
   * then sits on screen in silence for the whole length of the pause, and the
   * error GROWS with how cleanly the narrator reads. Measured against a take
   * whose true boundaries were known, every cut landed ~310ms early on a
   * 1.7-second pause — and the recording sheet asks for pauses that long,
   * because that is what makes them findable.
   *
   * So the boundary is the END of the run, pulled back by `leadMs`: picture
   * leads sound by a few frames, which is how a cut is made everywhere else,
   * and never by an amount that depends on how long somebody paused.
   *
   * `joinWithGaps` places its boundaries by the same rule, so a reel cut from
   * a synthesised draft and one cut from a real recording differ by the reading
   * and by nothing else.
   */
  const lead = leadMs / 1000;
  return inner
    .sort((a, b) => b.length - a.length)
    .slice(0, count)
    .map((run) => {
      const endsAt = ((run.start + run.length) * windowMs) / 1000;
      const startsAt = (run.start * windowMs) / 1000;
      // Never step back past the middle of the pause: on a short gap a fixed
      // lead would otherwise land inside the previous sentence.
      return Math.max((startsAt + endsAt) / 2, endsAt - lead);
    })
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

/**
 * A LINE'S WINDOW, SPLIT INTO ITS WORDS.
 *
 * The zeroth law, one level down. A line's window is measured off the file; the
 * words inside it were not, and a caption that arrives word by word needs to
 * know when each one is spoken or it is a typewriter effect with no relation to
 * the voice.
 *
 * Same rule as the line boundaries, for the same reason: the COUNT is known, so
 * the count is what gets asked for. A narrator does not leave a silence between
 * every pair of words — "the sky" runs together — so most readings will not
 * yield enough gaps, and that is expected rather than a failure.
 *
 * When they are not there, the window is split by WORD WEIGHT: a nine-letter
 * word holds the screen longer than "a". That is an estimate, and it says so,
 * because a caption timed by measurement and one timed by arithmetic should not
 * be indistinguishable in the file that records them.
 *
 * The remainder goes to the LAST word so the words add up to exactly the
 * window — the same rule the planner uses for parts inside a scene, and for the
 * same reason: a drift of a frame per word is a drift of a second per reel.
 *
 * @param {string} text the line as spoken
 * @param {Int16Array|null} samples that line's audio, or null to skip measuring
 * @param {number} sampleRate
 * @param {{start: number, end: number}} window the line's place in the reel
 * @returns {{words: {text: string, start: number, end: number}[], how: 'measured'|'weighted'}}
 */
export function wordWindows(text, samples, sampleRate, window) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const span = Math.max(0.001, window.end - window.start);
  if (words.length <= 1) {
    return {words: words.map((w) => ({text: w, start: window.start, end: window.end})), how: 'weighted'};
  }

  if (samples && samples.length) {
    const WINDOW_MS = 10;
    const spoken = samples.length / sampleRate;
    const cuts = findBoundaries(loudness(samples, sampleRate, WINDOW_MS), WINDOW_MS, words.length - 1, {
      floor: 0.16,
      minPauseMs: 30,
    });
    if (cuts.length === words.length - 1) {
      // The clip is the SPOKEN part; the window may be longer because the
      // silence before the line belongs to it. Times are measured from where
      // the speech actually starts, not from the top of the window.
      const speechStart = window.end - spoken;
      const edges = [0, ...cuts, spoken];
      return {
        words: words.map((w, i) => ({
          text: w,
          start: Number((speechStart + edges[i]).toFixed(3)),
          end: Number((speechStart + edges[i + 1]).toFixed(3)),
        })),
        how: 'measured',
      };
    }
  }

  // WEIGHT, NOT EVEN SHARES. Even shares give "a" the same screen time as
  // "extraordinary", and the caption falls behind the voice by the middle of
  // any line with a long word in it.
  const weights = words.map((w) => w.length + 1);
  const total = weights.reduce((sum, w) => sum + w, 0);
  const out = [];
  let cursor = window.start;
  words.forEach((w, i) => {
    const share = (weights[i] / total) * span;
    const start = cursor;
    const end = i === words.length - 1 ? window.end : cursor + share;
    cursor = end;
    out.push({text: w, start: Number(start.toFixed(3)), end: Number(end.toFixed(3))});
  });
  return {words: out, how: 'weighted'};
}
