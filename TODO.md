# TODO

## High Priority

### Audio — Background Music
- [ ] Document a workflow for sourcing royalty-free tracks (Pixabay, Free Music Archive, YouTube Audio Library)
- [ ] Add `audio` field to `data.ts` meta: `{ src: string, volume: number }`
- [ ] Wire `<AudioTrack>` into video `index.tsx` using that field
- [ ] Test fade-in/fade-out across full video duration

### AI Voiceover — ElevenLabs
- [ ] Create `scripts/generate-voiceover.ts`
  - Reads `sequence` from a video's `data.ts`
  - Builds a narration script from slide text fields
  - POSTs to ElevenLabs TTS API (`/v1/text-to-speech/{voice_id}`)
  - Saves MP3 to `public/audio/{videoId}-voiceover.mp3`
- [ ] Add `voiceover` field to `data.ts` meta with `src` + per-slide offset timestamps
- [ ] Wire voiceover audio into video `index.tsx`
- [ ] Add `ELEVENLABS_API_KEY` and `ELEVENLABS_VOICE_ID` to env vars
- [ ] Decide: one continuous audio file vs. per-slide clips

### B-Roll Stock Footage — Pexels
- [ ] Create `scripts/fetch-broll.ts`
  - Accepts a search query + output path
  - Calls Pexels Videos API (`GET /videos/search?query=...`)
  - Downloads selected clip to `public/video/`
- [ ] Build `VideoClip` template (extends `ImageReveal` concept but uses Remotion `<Video>`)
  - Props: `src`, `fit`, `caption`, `theme`, `durationInFrames`, `trimStart?`, `trimEnd?`
  - Same Ken Burns + fade entry as `ImageReveal`
- [ ] Add `PEXELS_API_KEY` to env vars
- [ ] Register `VideoClip` template in video `index.tsx` dispatch

---

## Medium Priority

### Scene Transitions
- [ ] Install `@remotion/transitions` (`npm install @remotion/transitions`)
- [ ] Replace `<Series>` with `<TransitionSeries>` in video `index.tsx`
- [ ] Add `transition` field to sequence items in `data.ts`: `fade | slide | wipe | none`
- [ ] Default to `fade` (duration: 10 frames) between all scenes

### New Video
- [ ] Decide on next topic + format + theme
- [ ] Write `src/videos/Video003/data.ts` + `index.tsx`
- [ ] Register in `Root.tsx`

### Template Improvements
- [ ] `TextSlide` — support multi-word `highlightWords: string[]` (currently only matches a single exact word)
- [ ] `BulletReveal` — add optional `icon` per bullet item
- [ ] `StatCard` — add animated accent bar under the number
- [ ] `OutroCard` — add optional social icons (simple SVG paths, no external libs)

---

## Low Priority / Nice to Have

### Developer Experience
- [ ] `scripts/new-video.ts` — CLI scaffold: prompts for title/format/theme, creates `VideoXXX/` directory with stubbed `data.ts` + `index.tsx`, auto-registers in `Root.tsx`
- [ ] `scripts/render-all.ts` — loops over all registered compositions and renders each to `out/`
- [ ] Add `out/` to `.gitignore`

### Audio Generation Alternatives
- [ ] Evaluate Suno / Udio APIs for AI-generated background music once they expose public APIs
- [ ] Consider `@remotion/media-utils` `getAudioData` for waveform-synced animations

### Quality
- [ ] Add eslint rule to catch raw hex codes in template files
- [ ] Write a validation script that checks all `data.ts` sequence timing sums to `meta.durationInFrames`
