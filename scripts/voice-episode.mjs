#!/usr/bin/env node
/**
 * THE VOICEOVER IS THE CLOCK.
 *
 * Not a layer laid on at the end — the timeline itself. The reference build
 * says it three times and it is the one structural idea this pipeline was
 * missing:
 *
 *   "once that paragraph is locked, it decides everything: what's on screen,
 *    what the words say, when each shot cuts, even HOW LONG EACH SHOT LASTS."
 *
 *   "That 30-second MP3 is the SPINE — every scene's length was cut to fit its
 *    gaps."
 *
 *   "This becomes the TIMELINE — I cut every scene to the pauses between these
 *    lines."
 *
 * Until now every duration in this repo came from `words / 2.7 * 30`, which is
 * a GUESS standing in for a MEASUREMENT. A narrator does not read at a constant
 * rate: they lean on a number, they pause before a turn, and those pauses are
 * exactly where a cut belongs. Estimating them away is how nine scenes all came
 * out at the same length.
 *
 * So the whole script is spoken in ONE pass — one pass, because line-by-line
 * synthesis gives six clips with six different amounts of air at their edges,
 * and the gaps BETWEEN lines are the thing being measured. The alignment that
 * comes back is per character, so each line's window is exact.
 *
 *   node scripts/voice-episode.mjs --episode=mansa-musa
 *
 * Writes audio/vo.mp3 and audio/vo.json. The planner reads the second one and
 * cuts to it; without it, it falls back to the estimate and says so.
 *
 * Needs ELEVENLABS_API_KEY. Without one this exits saying what is missing and
 * changes nothing — a reel with estimated timings is a legitimate draft, and it
 * is the state every episode in this repo is in today.
 */
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {ROOT, episodeDir, parseArgs} from './lib/episode.mjs';

const API = process.env.ELEVENLABS_BASE_URL || 'https://api.elevenlabs.io/v1';
/** "Clear narrator for documentary" — overridable, because a voice is a look. */
const VOICE = process.env.ELEVENLABS_VOICE_ID || 'onwK4e9ZLuTAKqWW03F9';
const MODEL = process.env.ELEVENLABS_MODEL || 'eleven_multilingual_v2';

/** One line, one paragraph. The blank line is what the narrator pauses on. */
export const JOIN = '\n\n';

export function scriptOf(lines) {
  return lines.map((line) => line.vo.trim()).join(JOIN);
}

/**
 * WHERE EACH LINE STARTS AND ENDS IN THE SPOKEN AUDIO.
 *
 * The alignment is per character, so a line's window is just the times of its
 * first and last character — no searching, no matching, because we built the
 * text and know every offset.
 *
 * The gap between one line's end and the next line's start is a real silence in
 * the file. It is handed to the FOLLOWING line rather than split or dropped: a
 * cut lands on the breath before a sentence, not in the middle of the one that
 * just finished.
 *
 * @param {string[]} lines the spoken lines, in order
 * @param {{characters: string[], character_start_times_seconds: number[], character_end_times_seconds: number[]}} alignment
 * @returns {{text: string, start: number, end: number}[]}
 */
export function windowsFor(lines, alignment) {
  const starts = alignment?.character_start_times_seconds ?? [];
  const ends = alignment?.character_end_times_seconds ?? [];
  const total = ends.length ? ends[ends.length - 1] : 0;

  const spans = [];
  let cursor = 0;
  for (const line of lines) {
    const text = line.trim();
    const from = cursor;
    const to = cursor + text.length - 1;
    cursor = to + 1 + JOIN.length;
    spans.push({
      text,
      start: starts[from] ?? 0,
      end: ends[Math.min(to, ends.length - 1)] ?? total,
    });
  }

  // Hand each silence to the line that follows it, and let the last line run to
  // the end of the file so nothing is clipped off the tail.
  return spans.map((span, i) => ({
    text: span.text,
    start: i === 0 ? 0 : spans[i - 1].end,
    end: i === spans.length - 1 ? Math.max(span.end, total) : span.end,
  }));
}

async function speak(text) {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) {
    throw new Error(
      'ELEVENLABS_API_KEY is not set — no voiceover was generated and nothing was changed.\n' +
        '   The planner will keep estimating durations from word counts, which is a draft, not a cut.',
    );
  }

  const response = await fetch(`${API}/text-to-speech/${VOICE}/with-timestamps`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json', 'xi-api-key': key},
    body: JSON.stringify({
      text,
      model_id: MODEL,
      voice_settings: {stability: 0.5, similarity_boost: 0.75, style: 0.11},
    }),
    signal: AbortSignal.timeout(180_000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} — ${(await response.text()).slice(0, 200)}`);
  const body = await response.json();
  if (!body?.audio_base64) throw new Error('no audio in response');
  if (!body?.alignment?.character_end_times_seconds?.length) {
    // Without the alignment there is no clock, only a sound file — and a sound
    // file the planner cannot read is worse than none, because it looks done.
    throw new Error('no character alignment in response — cannot cut to it');
  }
  return body;
}

async function main() {
  const args = parseArgs();
  const episodeId = typeof args.episode === 'string' ? args.episode : null;
  if (!episodeId) {
    console.error('Usage: node scripts/voice-episode.mjs --episode=<episode-id>');
    process.exit(1);
  }

  const dir = episodeDir(episodeId);
  const brief = JSON.parse(await readFile(path.join(dir, 'brief.json'), 'utf8'));
  const lines = brief.lines.map((line) => line.vo.trim());
  const script = scriptOf(brief.lines);
  const words = script.split(/\s+/).filter(Boolean).length;

  console.log(`${episodeId}: ${lines.length} line(s), ${words} words — speaking in one pass…`);
  const spoken = await speak(script);
  const windows = windowsFor(lines, spoken.alignment);

  const outDir = path.join(dir, 'audio');
  await mkdir(outDir, {recursive: true});
  await writeFile(path.join(outDir, 'vo.mp3'), Buffer.from(spoken.audio_base64, 'base64'));

  const duration = windows[windows.length - 1].end;
  await writeFile(
    path.join(outDir, 'vo.json'),
    `${JSON.stringify(
      {
        $comment: 'MEASURED from vo.mp3, not estimated. The planner cuts every scene to these windows.',
        voice: VOICE,
        model: MODEL,
        duration,
        lines: brief.lines.map((line, i) => ({
          slug: line.slug ?? `line-${i + 1}`,
          text: windows[i].text,
          start: Number(windows[i].start.toFixed(3)),
          end: Number(windows[i].end.toFixed(3)),
        })),
      },
      null,
      2,
    )}\n`,
    'utf8',
  );

  console.log(`\n${duration.toFixed(1)}s of narration:`);
  for (const [i, w] of windows.entries()) {
    console.log(`  ${String(i + 1).padStart(2)}  ${w.start.toFixed(2)}–${w.end.toFixed(2)}s  (${(w.end - w.start).toFixed(2)}s)  ${w.text.slice(0, 52)}`);
  }
  console.log(`\n→ ${path.relative(ROOT, outDir)}/vo.mp3 + vo.json — re-run the planner to cut to it.`);
}

// Only when run as a command; the tests import the window maths from here.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`✗ ${error?.message ?? error}`);
    process.exit(1);
  });
}
