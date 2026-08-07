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
import {spawn} from 'node:child_process';
import {mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {ROOT, episodeDir, exists, parseArgs} from './lib/episode.mjs';
import {findBoundaries, loudness, windowsFromBoundaries} from './lib/measure.mjs';
import {joinWithGaps, writeWav} from './lib/wav.mjs';

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

/**
 * SPEAKING AND MEASURING ARE TWO STEPS.
 *
 * The clock used to depend on one vendor's timestamps endpoint, which means the
 * day that vendor errors the clock is gone. It does not have to: the pauses are
 * IN THE FILE, and finding them needs samples, not an API. So a provider only
 * has to return audio. If it also returns an alignment, that is used, because
 * exact beats measured — but nothing depends on it any more.
 *
 *   elevenlabs   audio + character alignment (exact)
 *   openai       audio only, measured off the samples
 *   file         no synthesis at all — measure an mp3 already on disk
 */
const PROVIDER = process.env.VOICE_PROVIDER || (process.env.ELEVENLABS_API_KEY ? 'elevenlabs' : 'openai');

/**
 * A missing key is the commonest way this script stops, and "not set" is not an
 * answer to "where do I put it". Say where the key comes from, where it goes,
 * and what the third option is when there is no key at all.
 */
function missing(name, where) {
  return (
    `${name} is not set — nothing was generated and nothing was changed.\n` +
    `   Get one at: ${where}\n` +
    `   Put it in:  repository Settings → Secrets and variables → Actions → New repository secret\n` +
    `   Then run:   Actions → "Voice the episode"\n` +
    '\n' +
    '   Or skip synthesis entirely: record the six lines yourself, save them as\n' +
    '   episodes/<id>/audio/vo.mp3, and run this again with --measure. The pauses\n' +
    '   are measured off the file, so any recording works.'
  );
}

async function speakElevenLabs(text) {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error(missing('ELEVENLABS_API_KEY', 'elevenlabs.io → Profile → API key (free tier is enough for a thirty-second script)'));
  // An ElevenLabs key starts with `sk_`. OpenAI's starts with `sk-`, and the two
  // are one character apart — so the commonest way this fails is the right kind
  // of secret in the wrong box. Say that here rather than spending a request to
  // be told "API key must start with 'sk_'" by the other end.
  if (!key.startsWith('sk_')) {
    throw new Error(
      `ELEVENLABS_API_KEY does not look like an ElevenLabs key — they start with "sk_", this one starts with "${key.slice(0, 3)}".\n` +
        '   An OpenAI key starts with "sk-" (a hyphen, not an underscore) and belongs in OPENAI_API_KEY.\n' +
        '   The ElevenLabs one is at elevenlabs.io → Profile → API key.',
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
  if (!response.ok) throw new Error(`ElevenLabs HTTP ${response.status} — ${(await response.text()).slice(0, 200)}`);
  const body = await response.json();
  if (!body?.audio_base64) throw new Error('no audio in response');
  return {audio: Buffer.from(body.audio_base64, 'base64'), alignment: body.alignment ?? null};
}

/**
 * The audio/speech protocol. No timestamps come back, and that is fine now —
 * the pauses get measured off the samples like any other recording.
 */
async function speakOpenAI(text) {
  const key = process.env.OPENAI_API_KEY || process.env.IMAGE_API_KEY;
  if (!key) throw new Error(missing('OPENAI_API_KEY', 'platform.openai.com → API keys'));
  const base = process.env.VOICE_BASE_URL || process.env.IMAGE_BASE_URL || 'https://api.openai.com/v1';

  const response = await fetch(`${base.replace(/\/$/, '')}/audio/speech`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json', Authorization: `Bearer ${key}`},
    body: JSON.stringify({
      model: process.env.VOICE_MODEL || 'gpt-4o-mini-tts',
      voice: process.env.VOICE_NAME || 'onyx',
      input: text,
      response_format: 'mp3',
      // The blank lines between paragraphs are what gets measured, so the
      // reading has to honour them rather than run the lines together.
      instructions: 'Read as a calm documentary narrator. Even pace, warm, unhurried. Pause clearly between paragraphs.',
    }),
    signal: AbortSignal.timeout(180_000),
  });
  if (!response.ok) throw new Error(`OpenAI HTTP ${response.status} — ${(await response.text()).slice(0, 200)}`);
  return {audio: Buffer.from(await response.arrayBuffer()), alignment: null};
}

/**
 * PIPER — free, offline, no account, no key, no bill.
 *
 * The answer to "the paid one errors and the other one costs money". It is a
 * small ONNX model and a binary; it runs on the Actions runner with nothing
 * configured, and the reel stops depending on anybody's service staying up.
 *
 * And it is the one provider that gets EXACT boundaries rather than measured
 * ones, because it is read a line at a time and WE join the clips. The rule
 * against per-line synthesis exists for a real reason — six clips with six
 * different amounts of air at their edges, when the thing being measured is the
 * gap between them. That reason disappears when the gap is ours: we put the
 * silence there, so we know to the sample where it starts.
 */
async function speakPiper(lines) {
  const binary = process.env.PIPER_BIN;
  const model = process.env.PIPER_VOICE;
  if (!binary || !model) {
    throw new Error(
      'PIPER_BIN and PIPER_VOICE are not set — piper needs a binary and a voice model.\n' +
        '   The "Voice the episode" workflow downloads both when provider is "piper"; nothing to configure.\n' +
        '   Locally: grab piper_linux_x86_64.tar.gz from rhasspy/piper releases and a voice from\n' +
        '   huggingface.co/rhasspy/piper-voices, then point these two at them.',
    );
  }

  // The model's own config says what rate it speaks at. Guessing 22050 works
  // until someone picks a voice that does not, and then everything is pitched.
  const config = JSON.parse(await readFile(`${model}.json`, 'utf8'));
  const sampleRate = config?.audio?.sample_rate ?? 22050;

  const clips = [];
  for (const line of lines) {
    const chunks = [];
    await new Promise((resolve, reject) => {
      const child = spawn(binary, ['-m', model, '--output_raw', '-q'], {
        env: {...process.env, LD_LIBRARY_PATH: path.dirname(binary)},
      });
      child.stdout.on('data', (chunk) => chunks.push(chunk));
      let stderr = '';
      child.stderr.on('data', (chunk) => (stderr += chunk));
      child.on('error', reject);
      child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`piper exited ${code} — ${stderr.slice(0, 200)}`))));
      child.stdin.end(`${line}\n`);
    });
    const raw = Buffer.concat(chunks);
    if (!raw.length) throw new Error(`piper returned no audio for: "${line.slice(0, 40)}…"`);
    const samples = new Int16Array(raw.length >> 1);
    for (let i = 0; i < samples.length; i += 1) samples[i] = raw.readInt16LE(i * 2);
    clips.push(samples);
  }

  const gap = Number(process.env.PIPER_GAP_SECONDS ?? 0.55);
  const {samples, boundaries, duration} = joinWithGaps(clips, sampleRate, gap);
  return {audio: writeWav(samples, sampleRate), alignment: null, boundaries, duration, extension: 'wav'};
}

async function speak(text, lines) {
  if (PROVIDER === 'elevenlabs') return speakElevenLabs(text);
  if (PROVIDER === 'openai') return speakOpenAI(text);
  if (PROVIDER === 'piper') return speakPiper(lines);
  throw new Error(`unknown VOICE_PROVIDER "${PROVIDER}" — use piper, elevenlabs, openai, or --measure on a file`);
}

/**
 * Decode to raw mono PCM with the ffmpeg that already ships inside Remotion's
 * renderer, so measurement adds no dependency of its own. A plain decode and
 * resample — no filtergraph, because that build carries a trimmed filter set.
 */
async function decode(file) {
  const require = createRequire(import.meta.url);
  const compositor = path.dirname(require.resolve('@remotion/compositor-linux-x64-gnu/package.json'));
  const binary = path.join(compositor, 'ffmpeg');

  const RATE = 16_000;
  // A wav file rather than a raw pipe: this build carries only the wav muxer,
  // and a header that says where the samples start beats guessing at an offset.
  const scratch = path.join(os.tmpdir(), `vo-${process.pid}-${Date.now()}.wav`);
  try {
    await new Promise((resolve, reject) => {
      const child = spawn(
        binary,
        ['-hide_banner', '-loglevel', 'error', '-y', '-i', file, '-ac', '1', '-ar', String(RATE), '-c:a', 'pcm_s16le', scratch],
        {env: {...process.env, LD_LIBRARY_PATH: compositor}},
      );
      let stderr = '';
      child.stderr.on('data', (chunk) => (stderr += chunk));
      child.on('error', reject);
      child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code} — ${stderr.slice(0, 200)}`))));
    });

    const wav = await readFile(scratch);
    // Walk the chunks to `data`. The header is not always 44 bytes — ffmpeg
    // writes a LIST/INFO chunk of its own, and assuming 44 shifts every sample.
    let offset = 12;
    while (offset + 8 <= wav.length && wav.toString('ascii', offset, offset + 4) !== 'data') {
      offset += 8 + wav.readUInt32LE(offset + 4);
    }
    if (offset + 8 > wav.length) throw new Error('no data chunk in the decoded audio');
    const start = offset + 8;
    const length = Math.min(wav.readUInt32LE(offset + 4), wav.length - start);
    const samples = new Int16Array(length >> 1);
    for (let i = 0; i < samples.length; i += 1) samples[i] = wav.readInt16LE(start + i * 2);
    return {samples, sampleRate: RATE, duration: samples.length / RATE};
  } finally {
    await rm(scratch, {force: true});
  }
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

  const outDir = path.join(dir, 'audio');
  await mkdir(outDir, {recursive: true});

  // --measure skips synthesis entirely and reads whatever is already there: a
  // voiceover recorded on a phone, one somebody sent over, or the output of a
  // provider this script has never heard of.
  let how;
  let alignment = null;
  let known = null;
  let file = path.join(outDir, 'vo.mp3');

  if (args.measure) {
    const wav = path.join(outDir, 'vo.wav');
    if (await exists(file)) how = 'measured';
    else if (await exists(wav)) (file = wav), (how = 'measured');
    else throw new Error(`--measure needs audio/vo.mp3 or audio/vo.wav in ${path.relative(ROOT, dir)}`);
    console.log(`${episodeId}: measuring ${path.basename(file)}…`);
  } else {
    console.log(`${episodeId}: ${lines.length} line(s), ${words} words — via ${PROVIDER}…`);
    const spoken = await speak(script, lines);
    if (spoken.extension === 'wav') {
      file = path.join(outDir, 'vo.wav');
      await rm(path.join(outDir, 'vo.mp3'), {force: true});
    } else {
      await rm(path.join(outDir, 'vo.wav'), {force: true});
    }
    await writeFile(file, spoken.audio);
    alignment = spoken.alignment;
    // A provider that JOINED the clips itself knows where the seams are. That
    // beats measuring, because measuring can only ever recover what is already
    // known here exactly.
    known = spoken.boundaries ? {boundaries: spoken.boundaries, duration: spoken.duration} : null;
    how = known ? 'exact' : alignment?.character_end_times_seconds?.length ? 'aligned' : 'measured';
  }

  let windows;
  if (how === 'exact') {
    windows = windowsFromBoundaries(lines, known.boundaries, known.duration);
  } else if (how === 'aligned') {
    windows = windowsFor(lines, alignment);
  } else {
    /**
     * NO ALIGNMENT, SO MEASURE IT. The pauses are in the file: find every quiet
     * run, take the longest (lines - 1) of them, and those are the cuts. Asking
     * for the longest N rather than everything past a threshold is what makes
     * this survive a narrator who breathes in the middle of a sentence.
     */
    const {samples, sampleRate, duration: seconds} = await decode(file);
    const WINDOW_MS = 20;
    const boundaries = findBoundaries(loudness(samples, sampleRate, WINDOW_MS), WINDOW_MS, lines.length - 1);
    if (boundaries.length < lines.length - 1) {
      throw new Error(
        `found ${boundaries.length} pause(s) in ${seconds.toFixed(1)}s but the script has ${lines.length} lines.\n` +
          '   The reading ran the lines together — ask for clearer pauses between paragraphs, or record it again.',
      );
    }
    windows = windowsFromBoundaries(lines, boundaries, seconds);
  }

  const duration = windows[windows.length - 1].end;
  await writeFile(
    path.join(outDir, 'vo.json'),
    `${JSON.stringify(
      {
        $comment: 'MEASURED from vo.mp3, not estimated. The planner cuts every scene to these windows.',
        how,
        provider: args.measure ? 'file' : PROVIDER,
        audio: `audio/${path.basename(file)}`,
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
  console.log(`\n→ ${path.relative(ROOT, file)} + vo.json — re-run the planner to cut to it.`);
}

// Only when run as a command; the tests import the window maths from here.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`✗ ${error?.message ?? error}`);
    process.exit(1);
  });
}
