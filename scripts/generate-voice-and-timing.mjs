import {mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import {validateStory} from './lib/story-schema.mjs';

const ROOT = process.cwd();
const STORY = path.join(ROOT, 'content', 'generated', 'current-story.json');
const AUDIO = path.join(ROOT, 'public', 'audio');
const GENERATED = path.join(ROOT, 'src', 'generated');
const FPS = 30;
const VOICE_OFFSET_FRAMES = 12;
const TAIL_FRAMES = 24;

function run(command, args, timeout = 180000) {
  const result = spawnSync(command, args, {encoding: 'utf8', timeout, killSignal: 'SIGKILL'});
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed: ${(result.stderr || result.stdout || '').slice(0, 1800)}`);
  return result.stdout.trim();
}

function duration(file) {
  return Number(run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', file], 30000));
}

function toSeconds(value) {
  const [hours, minutes, rest] = value.replace(',', '.').split(':');
  return Number(hours) * 3600 + Number(minutes) * 60 + Number(rest);
}

function timestamp(seconds) {
  const safe = Math.max(0, seconds);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const whole = Math.floor(safe % 60);
  const milliseconds = Math.round((safe - Math.floor(safe)) * 1000);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(whole).padStart(2, '0')},${String(milliseconds).padStart(3, '0')}`;
}

function parseSrt(text) {
  return text.trim().split(/\r?\n\s*\r?\n/).flatMap((block) => {
    const lines = block.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (lines.length < 3 || !lines[1].includes('-->')) return [];
    const [start, end] = lines[1].split('-->').map((item) => item.trim());
    return [{startSeconds: toSeconds(start), endSeconds: toSeconds(end), text: lines.slice(2).join(' ')}];
  });
}

function normalize(value) {
  return String(value || '').toLocaleLowerCase('en-US').replace(/[’‘]/g, "'").replace(/[^a-z0-9çğıöşü' ]+/gi, ' ').replace(/\s+/g, ' ').trim();
}

function cueStart(cues, fragment, ratio) {
  const needle = normalize(fragment);
  const match = cues.find((cue) => normalize(cue.text).includes(needle));
  return match ? match.startSeconds : (cues.at(-1)?.endSeconds || 0) * ratio;
}

async function main() {
  const story = validateStory(JSON.parse(await readFile(STORY, 'utf8')));
  await mkdir(AUDIO, {recursive: true});
  await mkdir(GENERATED, {recursive: true});
  const narration = String(story.narration || '').trim();
  if (!narration) throw new Error('Generated story has no narration.');

  const narrationFile = path.join(AUDIO, 'narration.txt');
  const rawMedia = path.join(AUDIO, 'voice-raw.mp3');
  const rawSrt = path.join(AUDIO, 'voice-raw.srt');
  const voiceFile = path.join(AUDIO, 'voice.mp3');
  const srtFile = path.join(AUDIO, 'voice.srt');
  await writeFile(narrationFile, narration, 'utf8');
  await Promise.all([rawMedia, rawSrt, voiceFile, srtFile].map((file) => rm(file, {force: true})));

  const targetVideoSeconds = Number(story.targetDurationSeconds || 42);
  const targetVoiceSeconds = targetVideoSeconds - (VOICE_OFFSET_FRAMES + TAIL_FRAMES) / FPS;
  const isTurkish = String(story.language || '').toLowerCase().startsWith('tr');
  const voices = isTurkish ? ['tr-TR-AhmetNeural', 'tr-TR-EmelNeural'] : ['en-US-AndrewNeural', 'en-US-BrianNeural'];
  let selectedVoice = null;
  let lastError;
  for (const voice of voices) {
    try {
      run('edge-tts', ['--voice', voice, '--rate=+0%', '--pitch=-2Hz', '--file', narrationFile, '--write-media', rawMedia, '--write-subtitles', rawSrt]);
      selectedVoice = voice;
      break;
    } catch (error) {
      lastError = error;
    }
  }
  if (!selectedVoice) throw lastError || new Error('Edge TTS failed.');

  const rawDuration = duration(rawMedia);
  const tempo = rawDuration / targetVoiceSeconds;
  if (!Number.isFinite(tempo) || tempo < 0.5 || tempo > 2) throw new Error(`Narration tempo would be unnatural: ${tempo.toFixed(3)}.`);
  run('ffmpeg', ['-y', '-i', rawMedia, '-filter:a', `atempo=${tempo.toFixed(6)}`, '-vn', '-codec:a', 'libmp3lame', '-q:a', '2', voiceFile]);

  const rawCues = parseSrt(await readFile(rawSrt, 'utf8'));
  if (!rawCues.length) throw new Error('Generated subtitles have no timing cues.');
  const scaled = rawCues.map((cue) => ({
    startSeconds: cue.startSeconds / tempo,
    endSeconds: Math.max(cue.startSeconds / tempo + 0.03, cue.endSeconds / tempo),
    text: cue.text,
  }));
  await writeFile(srtFile, `${scaled.map((cue, index) => `${index + 1}\n${timestamp(cue.startSeconds)} --> ${timestamp(cue.endSeconds)}\n${cue.text}`).join('\n\n')}\n`, 'utf8');

  const cues = scaled.map((cue) => ({
    start: Math.round(cue.startSeconds * FPS) + VOICE_OFFSET_FRAMES,
    end: Math.max(Math.round(cue.startSeconds * FPS) + VOICE_OFFSET_FRAMES + 1, Math.round(cue.endSeconds * FPS) + VOICE_OFFSET_FRAMES),
    text: cue.text,
  }));
  const beats = Array.isArray(story.beats) ? story.beats : story.scenes.map((scene) => ({id: scene.id, trigger: scene.voiceover}));
  const starts = Object.fromEntries(beats.map((beat, index) => [
    String(beat.id),
    index === 0 ? 0 : Math.round(cueStart(scaled, beat.trigger, index / beats.length) * FPS) + VOICE_OFFSET_FRAMES,
  ]));
  const totalFrames = Math.round(targetVideoSeconds * FPS);
  const timingModule = `export type CaptionCue = {start: number; end: number; text: string};\nexport const VOICE_OFFSET_FRAMES = ${VOICE_OFFSET_FRAMES};\nexport const CUES: CaptionCue[] = ${JSON.stringify(cues, null, 2)};\nexport const SCENES = ${JSON.stringify(starts, null, 2)} as const;\nexport const TOTAL_FRAMES = ${totalFrames};\nexport const VIDEO_SECONDS = ${(totalFrames / FPS).toFixed(3)};\n`;
  await writeFile(path.join(GENERATED, 'timing.ts'), timingModule, 'utf8');
  await writeFile(path.join(AUDIO, 'voice-selection.json'), `${JSON.stringify({selectedVoice, rawVoiceDurationSeconds: rawDuration, targetVoiceDurationSeconds: targetVoiceSeconds, tempoFactor: tempo, videoDurationSeconds: totalFrames / FPS}, null, 2)}\n`, 'utf8');
  await Promise.all([rawMedia, rawSrt].map((file) => rm(file, {force: true})));
  console.log(JSON.stringify({voice: selectedVoice, tempoFactor: Number(tempo.toFixed(4)), videoDurationSeconds: totalFrames / FPS, scenes: beats.length}, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
