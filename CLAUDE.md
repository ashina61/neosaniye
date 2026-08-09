# remotion-studio — Claude Code Instructions

## What This Project Is
A flexible, component-driven video studio built on Remotion and React.
Every video is a React component. Content lives in data files. Claude Code writes both.
No external APIs. No hardcoded content in templates. Renders to MP4.

---

## Tech Stack
- **Remotion** — video rendering engine
- **React + TypeScript** — all video content is components
- **@remotion/google-fonts** — typography
- **@remotion/motion-blur** — motion effects
- **Zod** — prop validation on templates
- **Local assets only** — /public for images, audio, video clips

---

## Project Structure

```
remotion-studio/
├── CLAUDE.md
├── package.json
├── tsconfig.json
├── remotion.config.ts
├── public/
│   ├── fonts/
│   ├── audio/
│   └── images/
├── src/
│   ├── Root.tsx                        ← registers ALL compositions
│   ├── index.ts                        ← remotion entry point
│   ├── tokens.ts                       ← ALL design tokens
│   ├── lib/
│   │   └── utils.ts                    ← shared helpers (easing, math, etc.)
│   ├── hooks/
│   │   ├── useTextReveal.ts
│   │   ├── useCountUp.ts
│   │   ├── useStagger.ts
│   │   └── useSlideIn.ts
│   ├── components/
│   │   ├── AnimatedText.tsx            ← reusable word/char animator
│   │   ├── ProgressBar.tsx             ← animated progress bar
│   │   ├── GradientBg.tsx             ← animated gradient background
│   │   ├── Noise.tsx                   ← film grain / noise overlay
│   │   └── AudioTrack.tsx             ← wraps <Audio> with fade in/out
│   ├── templates/
│   │   ├── TitleCard/
│   │   │   ├── index.tsx
│   │   │   └── schema.ts              ← zod schema for props
│   │   ├── TextSlide/
│   │   │   ├── index.tsx
│   │   │   └── schema.ts
│   │   ├── BulletReveal/
│   │   │   ├── index.tsx
│   │   │   └── schema.ts
│   │   ├── StatCard/
│   │   │   ├── index.tsx
│   │   │   └── schema.ts
│   │   ├── QuoteCard/
│   │   │   ├── index.tsx
│   │   │   └── schema.ts
│   │   ├── ImageReveal/
│   │   │   ├── index.tsx
│   │   │   └── schema.ts
│   │   ├── ListRace/
│   │   │   ├── index.tsx
│   │   │   └── schema.ts
│   │   └── OutroCard/
│   │       ├── index.tsx
│   │       └── schema.ts
│   └── videos/
│       └── Video001/
│           ├── data.ts
│           └── index.tsx
```

---

## Core Rules — Non-Negotiable

### Rule 1: Templates Are Dumb Display Components
Zero hardcoded strings, colors, or durations inside any template.
All content, styling, and timing comes from props validated by a Zod schema.

```tsx
// schema.ts
import { z } from 'zod'
export const titleCardSchema = z.object({
  title: z.string(),
  subtitle: z.string().optional(),
  theme: z.enum(['dark', 'light', 'neon', 'paper', 'brutal']),
  durationInFrames: z.number(),
  enterDuration: z.number().default(20),
})
export type TitleCardProps = z.infer<typeof titleCardSchema>

// index.tsx
export const TitleCard: React.FC<TitleCardProps> = (props) => { ... }
```

### Rule 2: data.ts Is the Entire Video
One file per video. Contains all text, timing, theme, asset paths, and sequence order.
Claude Code writes this file when creating a new video. Never touch template files for content.

```ts
// src/videos/Video001/data.ts
import { fps } from '../../tokens'

export const meta = {
  id: 'Video001',
  title: 'My First Video',
  format: 'portrait' as const,   // 'portrait' | 'landscape'
  fps,
  durationInFrames: fps * 60,
}

export const sequence = [
  {
    template: 'TitleCard',
    from: 0,
    durationInFrames: fps * 4,
    props: {
      title: 'Hook goes here',
      subtitle: 'Secondary line',
      theme: 'dark',
      enterDuration: 15,
    }
  },
  {
    template: 'BulletReveal',
    from: fps * 4,
    durationInFrames: fps * 25,
    props: {
      heading: 'Section title',
      bullets: ['First point', 'Second point', 'Third point'],
      theme: 'dark',
      staggerFrames: 18,
    }
  },
  {
    template: 'OutroCard',
    from: fps * 55,
    durationInFrames: fps * 5,
    props: {
      cta: 'Follow for more',
      handle: '@handle',
      theme: 'dark',
    }
  }
]
```

### Rule 3: tokens.ts Is the Design System
No raw hex codes, pixel values, or numbers in template files. Import everything from tokens.

```ts
// src/tokens.ts
export const fps = 30

export const formats = {
  portrait:  { width: 1080, height: 1920 },   // TikTok / Shorts
  landscape: { width: 1920, height: 1080 },   // YouTube
  square:    { width: 1080, height: 1080 },   // Instagram
}

export const themes = {
  dark: {
    bg: '#0a0a0a',
    text: '#ffffff',
    accent: '#f5c518',
    muted: '#666666',
    surface: '#1a1a1a',
  },
  light: {
    bg: '#f8f8f8',
    text: '#0a0a0a',
    accent: '#e63946',
    muted: '#999999',
    surface: '#eeeeee',
  },
  neon: {
    bg: '#04040f',
    text: '#ffffff',
    accent: '#00ffcc',
    muted: '#7b61ff',
    surface: '#0d0d2b',
  },
  paper: {
    bg: '#f5f0e8',
    text: '#1a1008',
    accent: '#c9541a',
    muted: '#8a7560',
    surface: '#ede8df',
  },
  brutal: {
    bg: '#ffffff',
    text: '#000000',
    accent: '#ff0000',
    muted: '#555555',
    surface: '#f0f0f0',
  },
}

export const fontSizes = {
  hero:    120,
  title:   80,
  heading: 56,
  body:    38,
  caption: 26,
}

export const fontFamilies = {
  display: 'Bebas Neue',
  body:    'DM Sans',
  mono:    'JetBrains Mono',
}

export const easings = {
  snap:    [0.19, 1, 0.22, 1] as const,
  bounce:  [0.34, 1.56, 0.64, 1] as const,
  smooth:  [0.4, 0, 0.2, 1] as const,
}
```

### Rule 4: Timing Always in Frames
```ts
// CORRECT
durationInFrames: fps * 5    // 5 seconds at 30fps = 150 frames

// WRONG
durationInFrames: 150
```

### Rule 5: Animation Uses Remotion Primitives Only
`spring()`, `interpolate()`, `useCurrentFrame()`, `useVideoConfig()`
No framer-motion, no gsap, no CSS keyframe animations.

### Rule 6: Sequences Must Not Overlap or Gap
In data.ts, every sequence item's `from + durationInFrames` must equal the next item's `from`.
Total must equal `meta.durationInFrames`.

---

## Hooks to Build

### useTextReveal.ts
Staggers opacity + translateY per word or character.
```ts
useTextReveal(
  text: string,
  mode: 'words' | 'chars',
  startFrame: number,
  staggerFrames?: number   // default 4
) → Array<{ opacity: number, y: number }>
```

### useCountUp.ts
Animates a number from 0 to target using interpolate().
```ts
useCountUp(
  target: number,
  startFrame: number,
  durationFrames: number,
  format?: 'integer' | 'decimal' | 'currency' | 'percent'
) → string   // formatted display value
```

### useStagger.ts
Generic stagger — returns a delay-adjusted progress value per index.
```ts
useStagger(
  index: number,
  total: number,
  startFrame: number,
  staggerFrames: number,
  durationFrames: number
) → number   // 0 to 1 progress
```

### useSlideIn.ts
Returns x/y/opacity for directional slide-in animations.
```ts
useSlideIn(
  direction: 'up' | 'down' | 'left' | 'right',
  startFrame: number,
  durationFrames?: number,   // default 20
  distance?: number          // default 60px
) → { x: number, y: number, opacity: number }
```

---

## Template Specs

### TitleCard
- Full-screen themed background (use GradientBg component for animated bg option)
- Hero title: fontSizes.hero, centered, useTextReveal word mode
- Optional subtitle: fontSizes.body, delayed fade
- Noise overlay for texture
- Exit: fade last 8 frames

### TextSlide
- Single bold statement filling ~75% screen width
- Word-by-word reveal via useTextReveal
- `highlightWord` prop: applies accent color to one specific word
- Optional icon or emoji prop displayed above text

### BulletReveal
- Heading at top (useSlideIn from left)
- Bullets reveal sequentially via useStagger
- Each bullet: index number in accent color + text
- Revealed bullets dim to 0.45 opacity when next appears
- Last bullet stays full opacity

### StatCard
- Context label above (caption size, muted color)
- Massive stat number (useCountUp, hero size, accent color)
- Unit label beside or below number
- Background: themed surface color with subtle border

### QuoteCard
- Large quote text (heading size, italic)
- Left accent border bar (4px, accent color)
- Attribution below: name bold, title muted
- Entry: useSlideIn from right

### ImageReveal
- Full-screen or contained image
- Props: `src`, `fit: 'cover' | 'contain'`, `caption?`
- Entry: scale from 1.08 → 1.0 (Ken Burns style) + fade
- Optional caption overlay at bottom

### ListRace
- Animated ranking list (think: top 5, top 10)
- Items slide in from bottom, staggered
- Each item: rank number + label + optional value bar
- Value bar animates width using useCountUp logic

### OutroCard
- Bold CTA text (title size)
- Handle / channel name (body size, accent)
- Subtle pulse animation on CTA (scale 1.0 → 1.03 loop)
- Optional: progress bar counting down to end

---

## Reusable Components

### GradientBg
Animated gradient background. Props: `colors[]`, `animated?: boolean`, `speed?: number`
Uses CSS hue-rotate or interpolated stops per frame.

### AnimatedText
Wraps useTextReveal into a drop-in component.
Props: `text`, `mode`, `startFrame`, `staggerFrames`, `style`

### ProgressBar
Thin bar (top or bottom of screen). Animates from 0% → 100% over composition duration.
Props: `color`, `height`, `position: 'top' | 'bottom'`

### Noise
SVG-based film grain overlay. Props: `opacity` (default 0.04), `animate?: boolean`

### AudioTrack
Wraps Remotion `<Audio>` with auto fade-in and fade-out.
Props: `src`, `volume`, `fadeInFrames`, `fadeOutFrames`

---

## Creating a New Video

When told "create a video about [TOPIC]":

1. Decide format based on topic (portrait for TikTok/Shorts, landscape for YouTube)
2. Choose theme that fits the tone
3. Write `src/videos/Video00N/data.ts`:
   - Strong hook (TitleCard, 3–5 sec)
   - 3–6 content beats using the best-fit templates
   - OutroCard (4–5 sec)
   - Portrait target: 30–60 sec total
   - Landscape target: 60–180 sec total
4. Write `src/videos/Video00N/index.tsx` mapping sequence → `<Series.Sequence>` blocks
5. Register in `Root.tsx`
6. Output the render command

---

## Render Commands

```bash
# Preview in browser (hot reload)
npx remotion preview src/index.ts

# Render specific video
npx remotion render src/index.ts Video001 --output=out/video001.mp4

# Render with specific props override
npx remotion render src/index.ts Video001 --props='{"theme":"neon"}' --output=out/video001.mp4

# Render landscape version
npx remotion render src/index.ts Video001Landscape --output=out/video001-landscape.mp4
```

---

## Setup Commands (Run First)

```bash
mkdir remotion-studio && cd remotion-studio
npm create video@latest . -- --template=blank
npm install @remotion/google-fonts @remotion/motion-blur zod
```

Build order:
1. `src/tokens.ts`
2. `src/lib/utils.ts`
3. All 4 hooks
4. All 5 reusable components
5. All 8 templates (schema.ts + index.tsx each)
6. `src/Root.tsx`
7. `src/index.ts`
8. `src/videos/Video001/` — test video

---

## Quality Checklist (Run Before Every Render)

- [ ] No hardcoded strings in any template
- [ ] No raw hex/pixel values in templates — all from tokens
- [ ] All timing uses `fps * N`
- [ ] Sequence `from` values are contiguous (no gaps, no overlaps)
- [ ] Sum of sequence durations === `meta.durationInFrames`
- [ ] Every template prop validated by Zod schema
- [ ] Composition registered in Root.tsx with correct width/height/fps
- [ ] Video index.tsx wraps `<Series>` in `<AbsoluteFill style={{ background: bg }}>` (prevents checkered frames)
- [ ] TypeScript reports zero errors (`npx tsc --noEmit`)

---

## Do Not

- Do not install framer-motion, gsap, anime.js, or any animation library
- Do not call any external API inside components or hooks
- Do not use `setTimeout`, `setInterval`, or `Date.now()` inside components
- Do not hardcode ANY content in template files
- Do not use raw hex codes or pixel values in templates — tokens only
- Do not use CSS `@keyframes` — use Remotion's frame-based interpolation
- Do not use `<img>` tags — use Remotion's `<Img>` component
- Do not use `<video>` tags — use Remotion's `<Video>` component

---

## Gotchas

### Checkered / transparent background between scenes
**Cause:** Templates apply `opacity` to their entire root div. When a scene fades out to `opacity: 0`, the div becomes transparent and Remotion shows the canvas background (checkered in the preview, black in renders — but visually wrong either way).

**Fix:** Always wrap `<Series>` in `<AbsoluteFill>` with the theme background color in the video's `index.tsx`. The persistent background div is never affected by template opacity:

```tsx
import { AbsoluteFill, Series } from 'remotion'
import { themes } from '../../tokens'
import { sequence } from './data'

const bg = themes[sequence[0].props.theme].bg

export const VideoXXX: React.FC = () => (
  <AbsoluteFill style={{ background: bg }}>
    <Series>...</Series>
  </AbsoluteFill>
)
```

### Do not call hooks inside `.map()` loops
Hooks like `useTextReveal`, `useSlideIn`, `useCountUp` call `useCurrentFrame()` internally. React forbids calling hooks inside loops, conditionals, or nested functions.

**Wrong:**
```tsx
{bullets.map((b, i) => {
  const progress = useStagger(i, ...)  // ❌ hook inside .map()
})}
```

**Right:** Call `useCurrentFrame()` once at the top of the component, then use `interpolate()` directly inside the map:
```tsx
const frame = useCurrentFrame()
{bullets.map((b, i) => {
  const start = 20 + i * staggerFrames
  const progress = interpolate(frame, [start, start + 15], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
})}
```

### Google Fonts — correct import paths
The `@remotion/google-fonts` subpackage names do not always match the display name exactly:
- `@remotion/google-fonts/BebasNeue` ← Bebas Neue
- `@remotion/google-fonts/DMSans` ← DM Sans (not `DmSans`)
- `@remotion/google-fonts/JetBrainsMono` ← JetBrains Mono

Load all fonts at module level in `src/lib/fonts.ts` and import that file from `Root.tsx` (`import './lib/fonts'`).

### tsconfig `lib` must be `es2022` or later
The default Remotion starter sets `"lib": ["es2015"]`. This breaks methods like `String.padStart()` and `Array.at()`. Update tsconfig.json:
```json
"lib": ["es2022"]
```