export type CaptionCue = {start: number; end: number; text: string};

export const CUES: CaptionCue[] = [
  {
    "start": 12,
    "end": 138,
    "text": "A day on Venus is longer than a year on Venus."
  },
  {
    "start": 147,
    "end": 273,
    "text": "Here, day means one full rotation on the planet's axis."
  },
  {
    "start": 282,
    "end": 408,
    "text": "Venus needs 243 Earth days to complete that rotation."
  },
  {
    "start": 417,
    "end": 543,
    "text": "But it circles the Sun in only 225 Earth days."
  },
  {
    "start": 552,
    "end": 678,
    "text": "So its new year arrives before the planet finishes turning once."
  },
  {
    "start": 687,
    "end": 813,
    "text": "Venus also spins backward, making the Sun appear to rise in the west."
  },
  {
    "start": 822,
    "end": 948,
    "text": "From one sunrise to the next takes about 117 Earth days."
  }
];

export const SCENE_STARTS = [0, 147, 282, 417, 552, 687, 822] as const;
export const TOTAL_FRAMES = 972;
