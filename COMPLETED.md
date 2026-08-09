# Completed Work

## Session 1 — Full Studio Build

### Infrastructure
- `src/tokens.ts` — design system: fps, 3 formats (portrait/landscape/square), 5 themes (dark/light/neon/paper/brutal), font sizes, font families, easings
- `src/lib/utils.ts` — clamp, lerp, mapRange, formatNumber
- `src/lib/fonts.ts` — Google Fonts loader (Bebas Neue, DM Sans, JetBrains Mono)
- `tsconfig.json` — updated `lib` to `es2022` for modern JS methods

### Hooks (`src/hooks/`)
| Hook | What it does |
|------|-------------|
| `useTextReveal` | Staggers opacity + translateY per word or character using spring |
| `useCountUp` | Animates a number from 0 → target via interpolate, returns formatted string |
| `useStagger` | Returns 0–1 progress for a single index in a staggered sequence |
| `useSlideIn` | Returns `{ x, y, opacity }` for directional spring-based slide-in |

### Reusable Components (`src/components/`)
| Component | What it does |
|-----------|-------------|
| `GradientBg` | Animated linear gradient background, rotates over composition duration |
| `AnimatedText` | Drop-in wrapper around `useTextReveal` for word/char animations |
| `ProgressBar` | Thin bar (top or bottom) that fills 0→100% over composition duration |
| `Noise` | SVG feTurbulence film-grain overlay, optional per-frame animation |
| `AudioTrack` | Wraps Remotion `<Audio>` with auto fade-in and fade-out via volume function |

### Templates (`src/templates/`)
Each template has a `schema.ts` (Zod) and `index.tsx` (React component). All content comes from props only.

| Template | Description |
|----------|-------------|
| `TitleCard` | Full-screen hero title with word-by-word reveal, optional subtitle, GradientBg + Noise |
| `TextSlide` | Single bold statement, word-by-word reveal, optional highlight word + icon |
| `BulletReveal` | Heading slides in from left, bullets stagger in sequentially, past bullets dim to 0.45 |
| `StatCard` | Animated count-up number (hero size, accent color) with context label and unit |
| `QuoteCard` | Italic quote with left accent border, slides in from right, attribution fades in |
| `ImageReveal` | Ken Burns scale 1.08→1.0 entry with fade, optional caption overlay gradient |
| `ListRace` | Ranked list with staggered slide-in from bottom, animated value bars |
| `OutroCard` | Bold CTA with pulse animation, handle in accent color, optional ProgressBar countdown |

### Videos
| Video | Format | Theme | Duration | Templates used |
|-------|--------|-------|----------|----------------|
| `Video002` — *AI Video Creation: Claude Code + Remotion* | Landscape 1920×1080 | Neon | 60s | TitleCard → TextSlide×3 → BulletReveal → StatCard → OutroCard |

### Bug Fixes
- **Checkered background between scenes** — root cause: template `opacity` fade-to-0 makes the entire div transparent; `<Series>` has no overlap between sequences. Fix: wrap `<Series>` in `<AbsoluteFill style={{ background: bg }}>` so the canvas is never transparent.
- **Hooks in `.map()` loop** — `BulletReveal` and `ListRace` originally called `useStagger()` inside `.map()`. Fixed by calling `useCurrentFrame()` once at the top and computing `interpolate()` inline.
- **`lib: ["es2015"]` too old** — updated to `es2022` to unlock `String.padStart()` and other modern APIs.

---

## Render Commands

```bash
# Preview
npx remotion preview src/index.ts

# Render Video002
npx remotion render src/index.ts Video002 --output=out/video002.mp4
```
