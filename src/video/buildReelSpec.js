/**
 * REEL SPEC BUILDER.
 *
 * The beat sheet says what each line becomes; this turns that into the single
 * machine-readable file the renderer runs — `production.json`. No topic-specific
 * React is ever written: a new story is a new spec, not a new component.
 */

import path from 'node:path';
import {mkdir, writeFile} from 'node:fs/promises';
import {buildBeatSheet} from '../story/beatSheet.js';
import {chooseLook} from '../story/look.js';

const FPS = 30;

/**
 * What is the same in every video: the stop-motion step and the fact that the
 * film treatment exists. Everything else about the look — colours, how hard the
 * treatment bites, which drawing each prop uses, which way the choreography
 * runs — is chosen per video from the topic. See `src/story/look.js`.
 */
const POSTERIZE_FPS = 12;

/**
 * Where each effect lands inside its beat. An effect is placed on an EVENT of
 * the rig — the shutter on the frame the photo is struck, the paper on the
 * frame the card lands — never at a fixed offset to fill a quota.
 */
function sfxCuesForBeat(beat, sfxLibrary) {
  const {props, durationInFrames, rig} = beat;
  const at = (value, fallbackRatio) =>
    Number.isFinite(Number(value)) ? Math.max(0, Math.round(Number(value))) : Math.round(durationInFrames * fallbackRatio);

  let plan = [];
  switch (rig) {
    case 'portal-zoom':
      plan = [['camera-shutter', 0], ['whoosh-long', at(props.pushEndFrame, 0.38)]];
      break;
    case 'villain-punch':
      plan = [['whoosh-entrance', at(props.riseFrame, 0.06)], ['impact', at(props.slotFrame, 0.5)]];
      break;
    case 'paper-drop':
      plan = (props.cardFrames || []).slice(0, 3).map((frame) => ['paper', at(frame, 0.2)]);
      break;
    case 'grounded-punch':
      plan = [['focus-hunt', 0], ['heartbeat', at(props.shiftFrame, 0.5)]];
      break;
    case 'money-room':
      plan = [['neon-buzz', 0], ['cash', at((props.flickerFrames || [])[0], 0.2)]];
      break;
    case 'finale-clone':
      plan = [['whoosh-long', at(props.gestureFrame, 0.2)], ['final-boom', Math.round(durationInFrames * 0.62)]];
      break;
    default:
      plan = [];
  }

  return plan
    .map(([family, atFrame]) => {
      const asset = sfxLibrary?.[family];
      if (!asset) return null;
      return {
        path: typeof asset === 'string' ? asset : asset.path,
        family,
        atFrame,
        durationInFrames: typeof asset === 'object' ? asset.durationInFrames : undefined,
        volume: typeof asset === 'object' ? asset.volume : undefined,
      };
    })
    .filter(Boolean);
}

/**
 * Bind whatever the media layer actually returned to the roles the rig asked
 * for. The pipeline finds photographs; it cannot promise a clean cut-out, so a
 * rig must still stand up with one plate and nothing else.
 */
function bindAssets(beat, mediaItems, index, publicPathForAsset, usedPaths = new Set()) {
  const available = (mediaItems || [])
    .filter((item) => Number(item.scene) === index && item.path)
    .map((item) => ({
      path: publicPathForAsset ? publicPathForAsset(item.path, item, index) : item.publicPath || item.path,
      type: item.type === 'video' ? 'video' : 'image',
    }))
    .filter((item) => item.path);

  // NO PHOTOGRAPH APPEARS TWICE IN ONE REEL.
  //
  // The publish gate treats two look-alike windows as a HARD failure when they
  // resolve to the same asset, and a live run was blocked exactly this way:
  // DUPLICATE_SHOT across five windows. The media layer legitimately returns
  // the same picture for two similar queries — that is its business — but a
  // reel that shows one picture twice is a reel that looks like it stalled.
  // So the binding, not the fetcher, is where a repeat is refused: a used path
  // is skipped, and if nothing is left the beat falls through to its coded set,
  // which is always a different image.
  const fresh = available.filter((item) => !usedPaths.has(item.path));

  const roles = beat.assetRequests.map((request) => request.role);
  const bound = [];
  let cursor = 0;
  for (const role of roles) {
    const item = fresh[cursor];
    if (!item) break;
    bound.push({...item, role});
    usedPaths.add(item.path);
    cursor += 1;
  }
  // Anything left over rides along as texture — a rig may use it for parallax.
  for (; cursor < fresh.length && bound.length < 4; cursor += 1) {
    bound.push({...fresh[cursor], role: 'texture'});
    usedPaths.add(fresh[cursor].path);
  }
  return bound;
}

/** Windows where narration is speaking, so the music can duck under the words. */
function duckWindows(timeline, fps) {
  return (timeline?.scenes || [])
    .map((scene) => [Math.round(Number(scene.start || 0) * fps), Math.round(Number(scene.end || 0) * fps)])
    .filter(([from, to]) => Number.isFinite(from) && Number.isFinite(to) && to > from);
}

export function buildReelSpec({
  script,
  audio,
  timeline,
  mediaItems = [],
  fps = FPS,
  width = 1080,
  height = 1920,
  publicPathForAsset,
  voicePath = null,
  musicPath = null,
  ambiencePath = null,
  sfxLibrary = {},
} = {}) {
  if (!script || !Array.isArray(script.scenes) || script.scenes.length === 0) {
    throw new Error('REEL_SPEC_LINES_REQUIRED');
  }

  const topic = String(script.topic || script.normalizedTopic || script.title || 'NeoSaniye story').trim();
  const look = chooseLook(topic);
  const sheet = buildBeatSheet({script, timeline, look, fps});

  const usedPaths = new Set();
  const beats = sheet.beats.map((beat, index) => ({
    id: beat.id,
    rig: beat.rig,
    role: beat.role,
    line: beat.line,
    fromFrame: beat.fromFrame,
    durationInFrames: beat.durationInFrames,
    captions: beat.captions,
    assets: bindAssets(beat, mediaItems, index, publicPathForAsset, usedPaths),
    sfx: sfxCuesForBeat(beat, sfxLibrary),
    props: beat.props,
    grade: beat.grade,
    ...(beat.clonedFrom ? {clonedFrom: beat.clonedFrom} : {}),
  }));

  const measuredDuration = Number(audio?.duration || 0);
  const durationInFrames = Math.max(
    Math.round(measuredDuration * fps),
    ...beats.map((beat) => beat.fromFrame + beat.durationInFrames),
  );

  return {
    version: 2,
    meta: {
      topic,
      title: String(script.title || script.topic || 'NeoSaniye story').trim(),
      language: String(script.language || process.env.CONTENT_LANGUAGE || 'en').trim(),
      fps,
      width,
      height,
      durationInFrames,
    },
    engine: {
      posterizeFps: POSTERIZE_FPS,
      gateWeavePx: look.film.weavePx,
      weaveScale: look.film.weaveScale,
      grade: look.grade,
      film: look.film,
      look,
    },
    audio: {
      voicePath,
      musicPath,
      ambiencePath,
      voiceVolume: 1,
      musicVolume: 0.16,
      musicDuckVolume: 0.07,
      duckWindows: duckWindows(timeline, fps),
    },
    beats,
    globalSfx: [],
    // Kept for the QC layer: how much of the beat sheet was measured against
    // real speech versus guessed. A run that had to guess is a warning.
    look: {name: look.name, seed: look.seed},
    timing: {
      source: sheet.timingSource,
      measuredCaptions: sheet.measuredCaptions,
      estimatedCaptions: sheet.estimatedCaptions,
    },
  };
}

/**
 * The beat sheet as a human reads it — one row per spoken line. This is the
 * document you check before you look at a single frame: if a row's on-screen
 * words are not in its voiceover line, the reel is already wrong.
 */
export function renderBeatSheetMarkdown(spec) {
  const fps = spec.meta.fps;
  const seconds = (frames) => `${(frames / fps).toFixed(2)}s`;
  const rows = spec.beats.map((beat, index) => {
    const words = (beat.captions || []).map((caption) => `"${caption.text}" @${seconds(caption.atFrame)}`).join(' · ') || '—';
    const assets = (beat.assets || []).map((asset) => asset.role).join(', ') || 'coded only';
    const cues = (beat.sfx || []).map((cue) => cue.family).join(', ') || '—';
    return `| ${index + 1} · ${beat.role} | ${beat.line} | \`${beat.rig}\` | ${words} | ${assets} | ${cues} | ${seconds(beat.fromFrame)} → ${seconds(beat.fromFrame + beat.durationInFrames)} |`;
  });

  return [
    `# Beat sheet — ${spec.meta.title}`,
    '',
    `Konu: ${spec.meta.topic}`,
    `Süre: ${seconds(spec.meta.durationInFrames)} · ${spec.beats.length} beat · ${fps}fps · ${spec.meta.width}×${spec.meta.height}`,
    `Zamanlama kaynağı: ${spec.timing?.source || 'unknown'} ` +
      `(ölçülen ${spec.timing?.measuredCaptions ?? 0} / tahmin ${spec.timing?.estimatedCaptions ?? 0} yerleşim)`,
    '',
    '| Beat | Seslendirme satırı | Rig | Ekrandaki kelimeler | Varlıklar | SFX | Pencere |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    ...rows,
    '',
    'Her satırın ekrandaki kelimeleri, o satırın KENDİ sözlerinden birebir alınır',
    've söylendiği karede belirir. Yazılmış, uydurulmuş veya kaydırılmış metin yoktur.',
    '',
  ].join('\n');
}

export async function writeBeatSheet(spec, outputPath) {
  await mkdir(path.dirname(outputPath), {recursive: true});
  await writeFile(outputPath, renderBeatSheetMarkdown(spec), 'utf8');
  return outputPath;
}

export async function writeReelSpec(spec, outputPath) {
  if (!spec?.meta || !Array.isArray(spec?.beats)) throw new Error('REEL_SPEC_INVALID');
  await mkdir(path.dirname(outputPath), {recursive: true});
  await writeFile(outputPath, `${JSON.stringify(spec, null, 2)}\n`, 'utf8');
  return outputPath;
}
