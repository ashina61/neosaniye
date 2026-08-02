import path from 'node:path';
import {copyFile, mkdir, rm, stat} from 'node:fs/promises';
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
  return path.extname(filePath || '').toLowerCase() || fallback;
}

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
  'hook-reveal': ['hero-cutout', 'kinetic-headline'],
  'portrait-dossier': ['portrait-cutout', 'evidence-card'],
  document: ['document-sheet', 'highlight-marker'],
  'map-route': ['route-line', 'location-pins'],
  'stat-slot': ['stat-counter', 'scale-marker'],
  'explainer-diagram': ['process-nodes', 'flow-arrows'],
  transaction: ['value-counter', 'exchange-arrows'],
  consequence: ['cause-marker', 'impact-rings'],
  'final-twist': ['final-reveal', 'loop-anchor'],
  'collage-generic': ['collage-cutout'],
};

function buildSceneMetadata(spec) {
  const actorsByScene = {};
  const sceneFocus = {};
  let actorScenes = 0;

  spec.scenes.forEach((scene, index) => {
    const actors = (ACTORS_BY_TEMPLATE[scene.template] || ACTORS_BY_TEMPLATE['collage-generic'])
      .map((type) => ({type, source: 'remotion-template'}));
    actorsByScene[index] = actors;
    sceneFocus[index] = {
      x: scene.template === 'map-route' ? 0.5 : index % 2 ? 0.58 : 0.42,
      y: scene.template === 'document' ? 0.47 : 0.44,
      confidence: 1,
      source: 'remotion-layout',
    };
    if (actors.length) actorScenes += 1;
  });

  return {
    actorsByScene,
    sceneFocus,
    actorStats: {
      actorScenes,
      cardScenes: spec.scenes.filter((scene) => ['document', 'portrait-dossier'].includes(scene.template)).length,
    },
  };
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
    musicPath = null,
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
  const keepPublicRun = process.env.REMOTION_KEEP_PUBLIC_RUNS === '1';

  await rm(runDir, {recursive: true, force: true});
  await mkdir(runDir, {recursive: true});
  await mkdir(workDir, {recursive: true});

  try {
    const voiceName = `voice${extension(audioPath, '.mp3')}`;
    const voiceFile = await copyIntoPublic(audioPath, runDir, voiceName);
    if (!voiceFile) throw new Error('REMOTION_AUDIO_COPY_FAILED');

    let ambiencePublic = null;
    if (ambiencePath) {
      const ambienceName = `ambience${extension(ambiencePath, '.mp3')}`;
      if (await copyIntoPublic(ambiencePath, runDir, ambienceName)) {
        ambiencePublic = `${publicPrefix}/${ambienceName}`;
      }
    }

    let musicPublic;
    let musicTrack = null;
    let musicDecision;
    if (musicPath) {
      const suppliedName = `music${extension(musicPath, '.mp3')}`;
      if (await copyIntoPublic(musicPath, runDir, suppliedName)) {
        musicPublic = `${publicPrefix}/${suppliedName}`;
        musicTrack = musicPath;
        musicDecision = {
          reason: 'supplied-track',
          repeatedFallback: false,
          poolExhausted: false,
          silentFallback: false,
        };
      }
    }
    if (!musicPublic) {
      const musicName = 'music.wav';
      await makeMusicBed({
        outPath: path.join(runDir, musicName),
        seconds: Math.max(1, duration),
        category,
        seed: seedNumber(musicSeed),
      });
      musicPublic = `${publicPrefix}/${musicName}`;
      musicDecision = {
        reason: 'procedural-bed',
        repeatedFallback: false,
        poolExhausted: false,
        silentFallback: false,
      };
    }

    const sfxLibrary = await makeRemotionSfxPack({
      outDir: path.join(runDir, 'sfx'),
      publicPrefix: `${publicPrefix}/sfx`,
      seed: musicSeed,
    });

    const mediaItems = [];
    for (let index = 0; index < media.length; index += 1) {
      const item = media[index];
      if (!item?.path) continue;
      const mediaName = `media-${String(index).padStart(2, '0')}${extension(
        item.path,
        item.type === 'video' ? '.mp4' : '.jpg',
      )}`;
      if (!(await copyIntoPublic(item.path, runDir, mediaName))) continue;
      mediaItems.push({
        ...item,
        scene: Number.isFinite(Number(mediaScene[index]))
          ? Number(mediaScene[index])
          : Number(item.scene ?? index),
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
      musicPath: musicPublic,
      ambiencePath: ambiencePublic,
      sfxLibrary,
    });
    await writeRemotionSpec(spec, specPath);

    const remotionBin = path.join(
      remotionRoot,
      'node_modules',
      '.bin',
      process.platform === 'win32' ? 'remotion.cmd' : 'remotion',
    );
    const binInfo = await stat(remotionBin).catch(() => null);
    if (!binInfo?.isFile()) {
      throw new Error('REMOTION_NOT_INSTALLED: run `npm install --prefix remotion`');
    }

    await run(remotionBin, [
      'render',
      'src/index.ts',
      'NeoSaniyeDynamicShort',
      path.resolve(outPath),
      `--props=${path.resolve(specPath)}`,
      '--codec=h264',
      '--crf=17',
      '--pixel-format=yuv420p',
      `--concurrency=${process.env.REMOTION_CONCURRENCY || '2'}`,
    ], {
      cwd: remotionRoot,
      maxBuffer: 96 * 1024 * 1024,
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
    const sceneMeta = buildSceneMetadata(spec);

    return {
      outPath,
      duration: outDuration,
      width: spec.meta.width,
      height: spec.meta.height,
      clips: spec.scenes.length,
      outro: false,
      ctaCue: null,
      musicTrack,
      musicDecision,
      sfxCues,
      timeline,
      semanticBeats,
      ...sceneMeta,
      renderPlan: {
        engine: 'remotion',
        overlayLayers: ['hook', 'kineticText', 'collage'],
        overlayWindows: {
          hook: spec.scenes.length
            ? [[0, Math.min(3.2, spec.scenes[0].durationInFrames / spec.meta.fps)]]
            : [],
          cta: [],
          diagram: spec.scenes
            .filter((scene) => scene.template === 'explainer-diagram')
            .map((scene) => [
              scene.fromFrame / spec.meta.fps,
              (scene.fromFrame + scene.durationInFrames) / spec.meta.fps,
            ]),
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
        sceneBoundaries: spec.scenes.slice(0, -1)
          .map((scene) => (scene.fromFrame + scene.durationInFrames) / spec.meta.fps),
        transitions: spec.scenes.slice(0, -1).map((scene) => ({
          type: scene.transition || 'cut',
          atSeconds: (scene.fromFrame + scene.durationInFrames) / spec.meta.fps,
        })),
        captionsIncluded: false,
        captionEventCount: 0,
        wordHighlightEventCount: 0,
        fallbackLadder: {
          engine: 'remotion',
          proceduralFallbacks: spec.scenes.filter((scene) => !scene.assets?.length).length,
        },
        expectedSfxCount: sfxCues.length,
        motion: spec.scenes.map((scene, index) => ({
          index,
          type: scene.template,
          semantic: true,
        })),
        motionIssues: [],
      },
      productionSpec: spec,
      productionSpecPath: specPath,
    };
  } finally {
    if (!keepPublicRun) await rm(runDir, {recursive: true, force: true}).catch(() => {});
  }
}
