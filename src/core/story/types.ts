export type SceneGrammar =
  | 'push-through'
  | 'editorial-collage'
  | 'mechanism'
  | 'light-rig'
  | 'character-portrait'
  | 'impact'
  | 'payoff';

export type TransitionKind =
  | 'hard-cut'
  | 'match-object'
  | 'occlusion'
  | 'push-through'
  | 'paper-reveal';

export type StoryBeat = {
  id: string;
  label: string;
  grammar: SceneGrammar;
  transitionOut: TransitionKind;
};
