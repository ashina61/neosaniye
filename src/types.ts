export type TopicStat = {
  value: string;
  label: string;
};

export type TopicSpec = {
  slug: string;
  title: string;
  hook: string;
  kicker: string;
  visual: string;
  accent: string;
  secondary: string;
  stats: TopicStat[];
  narration: string[];
  source: string;
  tags: string[];
};
