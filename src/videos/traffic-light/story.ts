import type {StoryBeat} from '../../core/story/types';

export const beats: StoryBeat[] = [
  {id: 'hook', label: 'A Victorian invention', grammar: 'push-through', transitionOut: 'match-object'},
  {id: 'setup', label: 'London, 1868', grammar: 'editorial-collage', transitionOut: 'hard-cut'},
  {id: 'semaphore', label: 'Stop / caution', grammar: 'mechanism', transitionOut: 'match-object'},
  {id: 'night', label: 'Gas-lit colors', grammar: 'light-rig', transitionOut: 'occlusion'},
  {id: 'operator', label: 'Manually operated', grammar: 'character-portrait', transitionOut: 'hard-cut'},
  {id: 'explosion', label: 'The failure', grammar: 'impact', transitionOut: 'paper-reveal'},
  {id: 'payoff', label: 'A failed beginning', grammar: 'payoff', transitionOut: 'hard-cut'},
];

export const palette = {
  ink: '#17202a',
  paper: '#efe7d4',
  mustard: '#d9a23e',
  cyan: '#7fc9ca',
  red: '#a3423a',
  gas: '#f3d07d',
};
