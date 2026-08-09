# remotion-studio

Programmatic video studio powered by **Claude Code CLI** + **Remotion**. Write React components, render MP4s. Includes 8 templates, 4 animation hooks, 5 reusable components, a full design token system, and AI-generated explainer videos.

<p align="center">
  <a href="https://github.com/remotion-dev/logo">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://github.com/remotion-dev/logo/raw/main/animated-logo-banner-dark.apng">
      <img alt="Animated Remotion Logo" src="https://github.com/remotion-dev/logo/raw/main/animated-logo-banner-light.gif">
    </picture>
  </a>
</p>

---

## What this is

A video production system where every video is a React component. Claude Code CLI builds the templates, hooks, and per-video content files. Remotion renders them to MP4.

- **No hardcoded content** — every string, color, and duration lives in `data.ts`
- **Full TypeScript** — all template props validated by Zod schemas
- **Design token system** — 5 themes, 3 formats, zero raw hex values in templates
- **Claude Code native** — `CLAUDE.md` instructs the AI exactly how to build new videos

---

## Stack

| | |
|---|---|
| [Remotion](https://remotion.dev) | Frame-based React video rendering |
| [TypeScript](https://typescriptlang.org) | End-to-end type safety |
| [Zod](https://zod.dev) | Runtime prop validation on all templates |
| [@remotion/google-fonts](https://www.remotion.dev/docs/google-fonts) | Bebas Neue, DM Sans, JetBrains Mono |
| [@remotion/motion-blur](https://www.remotion.dev/docs/motion-blur) | Motion blur support |
| [Claude Code CLI](https://claude.ai/code) | AI agent that writes the videos |

---

## Output Formats

| Format | Dimensions | Use case |
|--------|-----------|----------|
| `portrait` | 1080×1920 | TikTok, YouTube Shorts |
| `landscape` | 1920×1080 | YouTube |
| `square` | 1080×1080 | Instagram |

---

## Templates

| Template | Description |
|----------|-------------|
| `TitleCard` | Hero title with word-by-word spring reveal, animated gradient, film grain |
| `TextSlide` | Bold single statement, word reveal, optional highlight word + icon |
| `BulletReveal` | Heading slides in, bullets stagger sequentially, past items dim |
| `StatCard` | Animated count-up number in accent color with context label |
| `QuoteCard` | Italic quote with accent border, slides in from right |
| `ImageReveal` | Ken Burns scale entry with fade, optional caption overlay |
| `ListRace` | Ranked list with staggered entry and animated value bars |
| `OutroCard` | CTA with pulse animation, handle, optional progress bar countdown |

---

## Videos

| ID | Title | Format | Theme | Duration |
|----|-------|--------|-------|----------|
| `Video002` | AI Video Creation: Claude Code + Remotion | Landscape | Neon | 60s |

---

## Getting Started

```bash
npm install
```

**Preview**
```bash
npx remotion preview src/index.ts
```

**Render**
```bash
npx remotion render src/index.ts Video002 --output=out/video002.mp4
```

---

## Making a New Video

Tell Claude Code:

```
Create a new video about [TOPIC].
Format: portrait or landscape.
Theme: dark / light / neon / paper / brutal.
Length: [N] seconds.
```

It writes `data.ts` + `index.tsx`, registers the composition in `Root.tsx`, and gives you the render command.

---

## Project Structure

```
src/
├── tokens.ts              # Design system — themes, formats, font sizes, easings
├── lib/
│   ├── fonts.ts           # Google Fonts loader
│   └── utils.ts           # clamp, lerp, mapRange, formatNumber
├── hooks/                 # useTextReveal, useCountUp, useStagger, useSlideIn
├── components/            # GradientBg, AnimatedText, ProgressBar, Noise, AudioTrack
├── templates/             # 8 templates, each with schema.ts + index.tsx
└── videos/
    └── Video002/          # data.ts (all content) + index.tsx (wiring)
```

---

## Roadmap

See [TODO.md](./TODO.md) for planned work including ElevenLabs AI voiceover, Pexels B-roll, and scene transitions.

---

## License

Note that for some entities a Remotion company license is needed. [Read the terms here](https://github.com/remotion-dev/remotion/blob/main/LICENSE.md).
