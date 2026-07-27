import {renderVideo} from './renderVideo.js';
import {renderRemotion} from './renderRemotion.js';

const VALID_ENGINES = new Set(['ffmpeg', 'remotion']);
const VALID_MODES = new Set(['shadow', 'unlisted', 'public']);
const VALID_FALLBACKS = new Set(['none', 'ffmpeg']);

function normalized(value, fallback) {
  return String(value || fallback).trim().toLowerCase();
}

export function resolveRenderPolicy(env = process.env) {
  const requestedEngine = normalized(env.RENDER_ENGINE, 'ffmpeg');
  const requestedMode = normalized(env.REMOTION_MODE, 'shadow');
  const requestedFallback = normalized(env.REMOTION_FALLBACK, 'none');

  const engine = VALID_ENGINES.has(requestedEngine) ? requestedEngine : 'ffmpeg';
  const mode = VALID_MODES.has(requestedMode) ? requestedMode : 'shadow';
  const fallback = VALID_FALLBACKS.has(requestedFallback) ? requestedFallback : 'none';

  return {
    engine,
    mode,
    fallback,
    invalidEngine: engine !== requestedEngine,
    invalidMode: mode !== requestedMode,
    invalidFallback: fallback !== requestedFallback,
    publicFailClosed: mode === 'public',
  };
}

/**
 * Select the rendering engine without changing the default production behavior.
 *
 * - No environment flag: current FFmpeg renderer.
 * - Remotion shadow/unlisted + explicit ffmpeg fallback: recover to FFmpeg.
 * - Remotion public: always fail closed; never silently publish a different cut.
 */
export async function renderWithConfiguredEngine(job, {
  env = process.env,
  ffmpegRenderer = renderVideo,
  remotionRenderer = renderRemotion,
  logger = console,
} = {}) {
  const policy = resolveRenderPolicy(env);

  if (policy.invalidEngine) logger.warn(`[render-router] bilinmeyen RENDER_ENGINE; ffmpeg kullanılıyor.`);
  if (policy.invalidMode) logger.warn(`[render-router] bilinmeyen REMOTION_MODE; shadow kullanılıyor.`);
  if (policy.invalidFallback) logger.warn(`[render-router] bilinmeyen REMOTION_FALLBACK; none kullanılıyor.`);

  if (policy.engine === 'ffmpeg') {
    logger.log('[render-router] motor=ffmpeg (mevcut üretim yolu)');
    const result = await ffmpegRenderer(job);
    return {...result, renderEngine: 'ffmpeg', renderPolicy: policy};
  }

  logger.log(`[render-router] motor=remotion mod=${policy.mode} fallback=${policy.fallback}`);
  try {
    const result = await remotionRenderer(job);
    return {...result, renderEngine: 'remotion', renderPolicy: policy};
  } catch (error) {
    const reason = String(error?.message || error).slice(0, 240);
    const mayFallback = !policy.publicFailClosed && policy.fallback === 'ffmpeg';
    if (!mayFallback) {
      logger.error(`[render-router] Remotion başarısız; fail-closed: ${reason}`);
      throw error;
    }

    logger.warn(`[render-router] Remotion başarısız; shadow/unlisted FFmpeg yedeği: ${reason}`);
    const result = await ffmpegRenderer(job);
    return {
      ...result,
      renderEngine: 'ffmpeg-fallback',
      renderPolicy: policy,
      remotionFailure: reason,
    };
  }
}
