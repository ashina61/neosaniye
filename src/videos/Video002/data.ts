import { fps } from '../../tokens'

export const meta = {
  id: 'Video002',
  title: 'AI Video Creation: Claude Code + Remotion',
  format: 'landscape' as const,
  fps,
  durationInFrames: fps * 60,
}

export const sequence = [
  {
    template: 'TitleCard' as const,
    from: 0,
    durationInFrames: fps * 5,
    props: {
      title: 'AI VIDEO CREATION',
      subtitle: 'Claude Code CLI × Remotion',
      theme: 'neon' as const,
      enterDuration: 18,
    },
  },
  {
    template: 'TextSlide' as const,
    from: fps * 5,
    durationInFrames: fps * 10,
    props: {
      text: 'Remotion lets you write videos as React components and render them to MP4',
      highlightWord: 'React',
      icon: '🎬',
      theme: 'neon' as const,
    },
  },
  {
    template: 'TextSlide' as const,
    from: fps * 15,
    durationInFrames: fps * 10,
    props: {
      text: 'Claude Code is an AI agent that writes real production software from natural language',
      highlightWord: 'AI',
      icon: '🤖',
      theme: 'neon' as const,
    },
  },
  {
    template: 'BulletReveal' as const,
    from: fps * 25,
    durationInFrames: fps * 14,
    props: {
      heading: 'WHAT WE BUILT',
      bullets: [
        '8 video templates with full Zod validation',
        '4 animation hooks using Remotion primitives',
        '5 reusable components and a design token system',
        'Complete TypeScript — zero raw hex or hardcoded values',
      ],
      theme: 'neon' as const,
      staggerFrames: 18,
    },
  },
  {
    template: 'StatCard' as const,
    from: fps * 39,
    durationInFrames: fps * 9,
    props: {
      label: 'lines of production TypeScript — written by Claude',
      stat: 1000,
      unit: '+',
      theme: 'neon' as const,
      format: 'integer' as const,
    },
  },
  {
    template: 'TextSlide' as const,
    from: fps * 48,
    durationInFrames: fps * 7,
    props: {
      text: 'Every video is a React component you can version control and iterate on',
      highlightWord: 'version',
      icon: '⚡',
      theme: 'neon' as const,
    },
  },
  {
    template: 'OutroCard' as const,
    from: fps * 55,
    durationInFrames: fps * 5,
    props: {
      cta: 'Build your first AI video',
      handle: 'remotion.dev',
      theme: 'neon' as const,
      showProgressBar: true,
    },
  },
]
