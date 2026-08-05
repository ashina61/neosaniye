import React from 'react';
import type {SceneProps} from './types';
import {PortalZoomReveal} from './PortalZoomReveal';
import {ParallaxPunch} from './ParallaxPunch';
import {StackedReveal} from './StackedReveal';
import {SplitShift} from './SplitShift';
import {EPISODE_SCENE_OVERRIDES} from '../episodeScenes.generated';

/**
 * THE TEMPLATE REGISTRY.
 *
 * Shared templates live here. An episode that genuinely needs a one-off scene
 * puts it in `episodes/{id}/scenes/index.tsx`, and the render script generates
 * the import — so an override never requires touching the engine, and the
 * engine never imports an episode by name.
 *
 * Lookup order is override first: an episode may replace a shared template for
 * itself without affecting any other episode.
 */
export const SHARED_SCENE_TYPES: Record<string, React.FC<SceneProps>> = {
  'portal-zoom-reveal': PortalZoomReveal,
  'parallax-punch': ParallaxPunch,
  'stacked-reveal': StackedReveal,
  'split-shift': SplitShift,
};

export function resolveSceneType(sceneType: string): React.FC<SceneProps> | null {
  return EPISODE_SCENE_OVERRIDES[sceneType] ?? SHARED_SCENE_TYPES[sceneType] ?? null;
}

export function knownSceneTypes(): string[] {
  return [...new Set([...Object.keys(SHARED_SCENE_TYPES), ...Object.keys(EPISODE_SCENE_OVERRIDES)])];
}
