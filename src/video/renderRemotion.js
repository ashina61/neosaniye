import path from 'node:path';
import {copyFile, mkdir, rm} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {buildRemotionSpec, writeRemotionSpec} from './buildRemotionSpec.js';
import {makeMusicBed} from '../audio/makeMusic.js';
import {makeRemotionSfxPack} from '../audio/makeRemotionSfx.js';

const run = promisify(execFile);

function safeId(value) {
  return String(value || 'run')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || 'run';
}

function seedNumber(value) {
  let hash = 2166136261;
  for (const char of String(value || 'neosaniye')) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

async function ffprobeDuration(filePath) {
  const {stdout} = await run('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    filePath,
  ]);
  return Number.parseFloat(stdout.trim()) || 0;
}

function extension(filePath, fallback = '.bin') {
  const ext = path.extname(filePath || '').toLowerCase();
  return ext || fallback;
}

async function copyIntoPublic(sourcePath, runDir, fileName) {
  if (!sourcePath) return null;
  const destination = path.join(runDir, fileName);
  await copyFile(sourcePath, destination);
  return destination;
}

export async function renderRemotion(job = {}) {
  const {
    audioPath,
    media = [],
    mediaScene = [],
    scenes = [],
    timeline = null,
    hookText = '',
    category = 'history',
    editPlan = null,
    emphasisWords = [],
    finaleText = '',
    ambiencePath = null,
    musicSeed = 'neosaniye',
    outPath,
    language = process.env.CONTENT_LANGUAGE || 'en',
    title = hookText || 'NeoSaniye story',
    topic = musicSeed || title,
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

  await rm(runDir, {recursive: true, force: true});
  await mkdir(runDir, {recursive: true});
  await mkdir(workDir, {recursive: true});

  const voiceName = `voice${extension(audioPath, '.mp3')}`;
  await copyIntoPublic(audioPath, runDir, voiceName);

  let ambiencePublic = null;
  if (ambiencePath) {
    const ambienceName = `ambience${extension(ambiencePath, '.mp3')}`;
    await copyIntoPublic(ambiencePath, runDir, ambienceName);
    ambiencePublic = `${publicPrefix}/${ambienceName}`;
  }

  const musicName = 'music.wav';
  await makeMusicBed({
    outPath: path.join(runDir, musicName),
    seconds: Math.max(1, duration),
    category,
    seed: seedNumber(musicSeed),
  });

  const sfxDir = path.join(runDir, 'sfx');
  const sfxLibrary = await makeRemotionSfxPack({
    outDir: sfxDir,
    publicPrefix: `${publicPrefix}/sfx`,
    seed: musicSeed,
  });

  const mediaItems = [];
  for (let index = 0; index < media.length; index += 1) {
    const item = media[index];
    if (!item?.path) continue;
    const mediaName = `media-${String(index).padStart(2, '0')}${extension(item.path, item.type === 'video' ? '.mp4' : '.jpg')}`;
    await copyIntoPublic(item.path, runDir, mediaName);
    mediaItems.push({
      ...item,
      scene: Number.isFinite(Number(mediaScene[index])) ? Number(mediaScene[index]) : Number(item.scene ?? index),
      publicPath: `${publicPrefix}/${mediaName}`,
    });
  }

  const script = {
    topic,
    title,
    language,
    hook_text: hookText,
    finale_text: finaleText,
    emphasis_words: emphasisWords,
    scenes,
  };

  const spec = buildRemotionSpec({
    script,
    audio: {duration},
    timeline,
    mediaItems,
    editPlan,
    voicePath: `${publicPrefix}/${voiceName}`,
    musicPath: `${publicPrefix}/${musicName}`,
    ambiencePath: ambiencePublic,
    sfxLibrary,
  });
  await writeRemotionSpec(spec, specPath);

  const remotionBin = path.join(remotionRoot, 'node_modules', '.bin', process.platform === 'win32' ? 'remotion.cmd' : 'remotion');
  await run(remotionBin, [
    'render',
    'src/index.ts',
    'NeoSaniyeDynamicShort',
    path.resolve(outPath),
    `--props=${path.resolve(specPath)}`,
    '--codec=h264',
    '--crf=17',
    '--pixel-format=yuv420p',
    '--concurrency=2',
  ], {
    cwd: remotionRoot,
    maxBuffer: 64 * 1024 * 1024,
    env: {...process.env, REMOTION_DISABLE_UPDATE_CHECK: '1'},
  });

  const outDuration = await ffprobeDuration(outPath);
  const sfxCues = spec.scenes.flatMap((scene) => (scene.sfx || []).map((cue) => ({
    atSeconds: (scene.fromFrame + cue.atFrame) / spec.meta.fps,
    sfxId: cue.family || path.basename(cue.path, path.extname(cue.path)),
    assetResolved: true,
    mixedInGraph: true,
  })));
  const semanticBeats = spec.scenes.map((scene, index) => ({
    index,
    kind: scene.template,
    start: scene.fromFrame / spec.meta.fps,
    end: (scene.fromFrame + scene.durationInFrames) / spec.meta.fps,
  }));
  const actorScenes = spec.scenes.filter((scene) => ['hook-reveal', 'portrait-dossier', 'map-route', 'explainer-diagram', 'transaction', 'consequence'].includes(scene.template)).length;

  return {
    outPath,
    duration: outDuration,
    width: spec.meta.width,
    height: spec.meta.height,
    clips: mediaItems.length,
    outro: false,
    musicTrack: null,
    musicDecision: {reason: 'procedural-bed', repeatedFallback: false, poolExhausted: false, silentFallback: false},
    sfxCues,
    timeline,
    semanticBeats,
    actorStats: {actorScenes, cardScenes: Math.max(0, spec.scenes.length - actorScenes)},
    actorsByScene: {},
    sceneFocus: {},
    renderPlan: {
      engine: 'remotion',
      overlayLayers: ['hook', 'kineticText', 'collage'],
      overlayWindows: {
        hook: spec.scenes.length ? [[0, Math.min(3.2, spec.scenes[0].durationInFrames / spec.meta.fps)]] : [],
        cta: [],
        diagram: spec.scenes.filter((scene) => scene.template === 'explainer-diagram').map((scene) => [scene.fromFrame / spec.meta.fps, (scene.fromFrame + scene.durationInFrames) / spec.meta.fps]),
        loopEcho: [],
        listMarker: [],
      },
      clips: spec.scenes.map((scene, index) => ({
        id: scene.id,
        scene: index,
        sequence: 0,
        renderOrder: index,
        loopEcho: false,
        start: +(scene.fromFrame / spec.meta.fps).toFixed(3),
        end: +((scene.fromFrame + scene.durationInFrames) / spec.meta.fps).toFixed(3),
        assetId: scene.assets?.[0]?.path || `${scene.template}:${scene.id}`,
        source: scene.assets?.[0] ? 'pipeline-media' : 'procedural-collage',
      })),
      expectedSceneCount: spec.scenes.length,
      sceneBoundaries: spec.scenes.slice(0, -1).map((scene) => (scene.fromFrame + scene.durationInFrames) / spec.meta.fps),
      transitions: spec.scenes.slice(0, -1).map((scene) => ({type: scene.transition || 'cut', atSeconds: (scene.fromFrame + scene.durationInFrames) / spec.meta.fps})),
      captionsIncluded: false,
      captionEventCount: 0,
      wordHighlightEventCount: 0,
      fallbackLadder: {engine: 'remotion', proceduralFallbacks: spec.scenes.filter((scene) => !scene.assets?.length).length},
      expectedSfxCount: sfxCues.length,
      motion: spec.scenes.map((scene, index) => ({index, type: scene.template, semantic: true})),
      motionIssues: [],
    },
    productionSpec: spec,
    productionSpecPath: specPath,
  };
}
