import path from 'node:path';
import {copyFile, mkdir, rm, stat} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {buildRemotionSpec, writeRemotionSpec} from './buildRemotionSpec.js';
import {makeMusicBed} from '../audio/makeMusic.js';
import {makeRemotionSfxPack} from '../audio/makeRemotionSfx.js';

const run = promisify(execFile);

function safeId(value) {
  return String(value || 'run').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64) || 'run';
}

function seedNumber(value) {
  let hash = 2166136261;
  for (const char of String(value || 'neosaniye')) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619); }
  return hash >>> 0;
}

async function ffprobeDuration(filePath) {
  const {stdout} = await run('ffprobe', ['-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1',filePath]);
  return Number.parseFloat(stdout.trim()) || 0;
}

function extension(filePath, fallback = '.bin') { return path.extname(filePath || '').toLowerCase() || fallback; }

async function copyIntoPublic(sourcePath, runDir, fileName) {
  if (!sourcePath) return null;
  const source = path.resolve(sourcePath);
  const info = await stat(source).catch(() => null);
  if (!info?.isFile() || info.size === 0) return null;
  const destination = path.join(runDir, fileName);
  await copyFile(source, destination);
  return destination;
}

const ACTORS_BY_TEMPLATE = {
  'hook-reveal': ['procedural-hero', 'kinetic-headline', 'symbol-chips'],
  'portrait-dossier': ['vector-portrait', 'evidence-cards'],
  document: ['procedural-document', 'stamp-animation'],
  'map-route': ['vector-map', 'route-line', 'location-pins'],
  'stat-slot': ['slot-number', 'scale-glyph'],
  'explainer-diagram': ['procedural-machine', 'flow-nodes', 'arrows'],
  transaction: ['vector-currency', 'exchange-arrows'],
  consequence: ['impact-glyph', 'crack-lines'],
  'final-twist': ['final-glyph', 'scribble-emphasis'],
  'collage-generic': ['procedural-collage'],
};

function buildSceneMetadata(spec) {
  const actorsByScene = {};
  const sceneFocus = {};
  spec.scenes.forEach((scene, index) => {
    actorsByScene[index] = (ACTORS_BY_TEMPLATE[scene.template] || ACTORS_BY_TEMPLATE['collage-generic']).map((type) => ({type, source: 'procedural-remotion'}));
    sceneFocus[index] = {x: index % 2 ? 0.58 : 0.42, y: scene.template === 'document' ? 0.48 : 0.44, confidence: 1, source: 'procedural-layout'};
  });
  return {actorsByScene, sceneFocus, actorStats: {actorScenes: spec.scenes.length, cardScenes: spec.scenes.filter((s) => ['document','portrait-dossier'].includes(s.template)).length}};
}

async function normalizeLoudness(inputPath, outputPath) {
  await run('ffmpeg', [
    '-y','-i',inputPath,
    '-c:v','copy',
    '-af','loudnorm=I=-14:LRA=7:TP=-1.5',
    '-c:a','aac','-b:a','192k','-ar','48000',
    '-movflags','+faststart',
    outputPath,
  ], {maxBuffer: 32 * 1024 * 1024});
}

export async function renderRemotion(job = {}) {
  const {
    audioPath, scenes = [], timeline = null, hookText = '', category = 'history', editPlan = null,
    emphasisWords = [], finaleText = '', musicPath = null, musicSeed = 'neosaniye', outPath,
    language = process.env.CONTENT_LANGUAGE || 'en', title = hookText || 'NeoSaniye story', topic = musicSeed || title,
  } = job;

  if (!audioPath) throw new Error('REMOTION_AUDIO_REQUIRED');
  if (!outPath) throw new Error('REMOTION_OUTPUT_REQUIRED');
  if (!Array.isArray(scenes) || scenes.length === 0) throw new Error('REMOTION_SCENES_REQUIRED');

  const repoRoot = path.resolve('.');
  const remotionRoot = path.join(repoRoot, 'remotion');
  const publicRoot = path.join(remotionRoot, 'public');
  const runId = safeId(path.basename(outPath, path.extname(outPath)) || topic);
  const publicPrefix = `runs/${runId}`;
  const runDir = path.join(publicRoot, 'runs', runId);
  const workDir = path.dirname(path.resolve(outPath));
  const specPath = path.join(workDir, 'production.json');
  const duration = await ffprobeDuration(audioPath);
  const keepPublicRun = process.env.REMOTION_KEEP_PUBLIC_RUNS === '1';
  const rawPath = path.join(workDir, `${runId}-raw.mp4`);

  await rm(runDir, {recursive: true, force: true});
  await mkdir(runDir, {recursive: true});
  await mkdir(workDir, {recursive: true});

  try {
    const voiceName = `voice${extension(audioPath, '.mp3')}`;
    if (!(await copyIntoPublic(audioPath, runDir, voiceName))) throw new Error('REMOTION_AUDIO_COPY_FAILED');

    let musicPublic;
    let musicTrack = null;
    let musicDecision;
    if (musicPath) {
      const suppliedName = `music${extension(musicPath, '.mp3')}`;
      if (await copyIntoPublic(musicPath, runDir, suppliedName)) {
        musicPublic = `${publicPrefix}/${suppliedName}`;
        musicTrack = musicPath;
        musicDecision = {reason: 'supplied-track', repeatedFallback: false, poolExhausted: false, silentFallback: false};
      }
    }
    if (!musicPublic) {
      const musicName = 'music.wav';
      await makeMusicBed({outPath: path.join(runDir, musicName), seconds: Math.max(1, duration + 1), category, seed: seedNumber(musicSeed)});
      musicPublic = `${publicPrefix}/${musicName}`;
      musicDecision = {reason: 'procedural-bed', repeatedFallback: false, poolExhausted: false, silentFallback: false};
    }

    const sfxLibrary = await makeRemotionSfxPack({outDir: path.join(runDir, 'sfx'), publicPrefix: `${publicPrefix}/sfx`, seed: musicSeed});
    const script = {topic, title, language, hook_text: hookText, finale_text: finaleText, emphasis_words: emphasisWords, scenes};
    const spec = buildRemotionSpec({script, audio: {duration}, timeline, editPlan, voicePath: `${publicPrefix}/${voiceName}`, musicPath: musicPublic, sfxLibrary});
    await writeRemotionSpec(spec, specPath);

    const remotionBin = path.join(remotionRoot, 'node_modules', '.bin', process.platform === 'win32' ? 'remotion.cmd' : 'remotion');
    const binInfo = await stat(remotionBin).catch(() => null);
    if (!binInfo?.isFile()) throw new Error('REMOTION_NOT_INSTALLED: run `npm install --prefix remotion`');

    await run(remotionBin, [
      'render','src/index.ts','NeoSaniyeDynamicShort',path.resolve(rawPath),`--props=${path.resolve(specPath)}`,
      '--codec=h264','--crf=16','--pixel-format=yuv420p',`--concurrency=${process.env.REMOTION_CONCURRENCY || '2'}`,
    ], {cwd: remotionRoot, maxBuffer: 96 * 1024 * 1024, env: {...process.env, REMOTION_DISABLE_UPDATE_CHECK: '1'}});

    await normalizeLoudness(rawPath, path.resolve(outPath));
    await rm(rawPath, {force: true});

    const outDuration = await ffprobeDuration(outPath);
    const sfxCues = spec.scenes.flatMap((scene) => (scene.sfx || []).map((cue) => ({
      atSeconds: (scene.fromFrame + cue.atFrame) / spec.meta.fps,
      sfxId: cue.family || path.basename(cue.path, path.extname(cue.path)), assetResolved: true, mixedInGraph: true,
    })));
    const semanticBeats = spec.scenes.map((scene, index) => ({index, kind: scene.template, start: scene.fromFrame / spec.meta.fps, end: (scene.fromFrame + scene.durationInFrames) / spec.meta.fps}));
    const sceneMeta = buildSceneMetadata(spec);

    return {
      outPath, duration: outDuration, width: spec.meta.width, height: spec.meta.height, clips: spec.scenes.length,
      outro: false, ctaCue: null, musicTrack, musicDecision, sfxCues, timeline, semanticBeats, ...sceneMeta,
      renderPlan: {
        engine: 'remotion-premium-procedural',
        visualPolicy: 'procedural-only',
        captionPolicy: 'none',
        overlayLayers: ['hook','kineticText','proceduralCollage','vectorDiagram'],
        overlayWindows: {
          hook: spec.scenes.length ? [[0, Math.min(3.2, spec.scenes[0].durationInFrames / spec.meta.fps)]] : [],
          cta: [],
          diagram: spec.scenes.filter((s) => s.template === 'explainer-diagram').map((s) => [s.fromFrame / spec.meta.fps, (s.fromFrame + s.durationInFrames) / spec.meta.fps]),
          loopEcho: [], listMarker: [],
        },
        clips: spec.scenes.map((scene, index) => ({
          id: scene.id, scene: index, sequence: 0, renderOrder: index, loopEcho: false,
          start: +(scene.fromFrame / spec.meta.fps).toFixed(3), end: +((scene.fromFrame + scene.durationInFrames) / spec.meta.fps).toFixed(3),
          assetId: `procedural:${scene.template}:${scene.visual.motif}:${scene.visual.variant}`,
          source: 'procedural-remotion',
        })),
        expectedSceneCount: spec.scenes.length,
        sceneBoundaries: spec.scenes.slice(0, -1).map((scene) => (scene.fromFrame + scene.durationInFrames) / spec.meta.fps),
        transitions: spec.scenes.slice(0, -1).map((scene) => ({type: scene.transition || 'cut', atSeconds: (scene.fromFrame + scene.durationInFrames) / spec.meta.fps})),
        captionsIncluded: false, captionEventCount: 0, wordHighlightEventCount: 0,
        fallbackLadder: {engine: 'remotion-premium-procedural', proceduralFallbacks: 0},
        expectedSfxCount: sfxCues.length,
        motion: spec.scenes.map((scene, index) => ({index, type: scene.template, motif: scene.visual.motif, semantic: true})),
        motionIssues: [],
      },
      productionSpec: spec,
      productionSpecPath: specPath,
    };
  } finally {
    await rm(rawPath, {force: true}).catch(() => {});
    if (!keepPublicRun) await rm(runDir, {recursive: true, force: true}).catch(() => {});
  }
}
