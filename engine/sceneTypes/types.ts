import type {SceneSpec} from '../schema';

/**
 * What every scene template receives.
 *
 * Note what is NOT here: no file names, no episode id, no story. A template
 * gets its own spec, the resolved role→file map, and how long it has. That is
 * the entire contract, and it is why a template written for one episode works
 * for the next one without being touched.
 */
export type SceneProps = {
  scene: SceneSpec;
  /** role -> episode-relative file path, straight from the config. */
  assets: Record<string, string>;
  durationInFrames: number;
};
