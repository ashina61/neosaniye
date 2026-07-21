# Sound Design Director Audit — 2026-07-21

## Executive verdict

NeoSaniye has moved beyond configuration-only audio checks: its final-output path now measures whether each declared SFX was actually mixed and created at least a 3 dB local peak increase, and a hard gate blocks unverified cues (`src/pipeline/outputVerify.js:8`, `src/pipeline/hardGate.js:50`). The mix also includes narration EQ/compression, voice-keyed music ducking, SFX-keyed voice/music pockets, final loudness normalization, stereo enforcement, and optional ambience (`src/video/renderVideo.js:622`, `src/video/renderVideo.js:629`, `src/video/renderVideo.js:683`). These are meaningful technical foundations.

The system does not yet perform professional sound storytelling. Music is selected once by a coarse mood, begins at the source track's start, loops, and remains structurally unchanged except for amplitude ducking and a universal final fade (`src/video/renderVideo.js:543`, `src/video/renderVideo.js:710`). There is no beat grid, phrase selection, downbeat alignment, harmonic/reveal edit, tension automation, payoff resolution, or music-state map. SFX consist primarily of four fixed procedural transition sounds plus UI cues; they are positioned at scene transitions rather than named spoken or visible beats (`src/video/renderVideo.js:360`, `src/video/renderVideo.js:658`). Foley and event-specific spot effects are absent.

Ambience is one quiet, looped Freesound result for the entire video. It can add texture but cannot follow changing locations, historical actions, or visual events, and the existing local CC0 ambience library is not used as a runtime fallback (`src/audio/fetchAmbience.js:37`, `src/video/renderVideo.js:569`). Deliberate silence is not represented; continuous narration/music/ambience is the default, and silence detection treats sufficiently long quiet sections as warnings (`src/pipeline/preflight.js:140`).

The repository distinguishes audibility from quality in comments, but its automated verdict still proves only energy, not timbre, meaning, masking, emotional impact, or phone translation. The principal impact effect is dominated by 48/90 Hz tones, while the procedural music pulse falls from 70 to 52 Hz (`src/video/renderVideo.js:368`, `src/audio/makeMusic.js:125`). Those fundamentals are vulnerable on phone speakers; no mono, small-speaker-band, codec, or noisy-environment listening test exists.

No current production video/audio mix is retained for audition. The available bee files are explicitly synthetic code-path regression fixtures, not the real bee render (`artifacts/regression/bee-before-after.md:1`). Their measurements show five test cues above 3 dB and stereo output, but do not establish production sound quality (`artifacts/regression/bee-audio-cues.json:1`). The human music-review index remains unchecked for all twelve imported tracks and explicitly flags possible mood and masking problems (`artifacts/audio-review/audio-review-index.md:14`). FFmpeg is unavailable in this workspace, and no audio playback tool is provided, so subjective listening conclusions are reported as unknown.

No P0 is verified. Missing beat mapping, boundary-only SFX, absent Foley/silence design, and lack of production listening/phone QC are P1. Music-pool metadata, ambience design, and internal scoring discrepancies are P2 unless production listening reveals severe masking.

## Verified findings

### SD-01 — P1: Music fills the timeline but does not follow the story arc

**Verified behavior.** The editor selects one of five coarse moods for the whole Short (`src/crew/editorDirector.js:23`). The renderer chooses one track, loops it from its beginning, trims it to total duration, applies a fixed track-dependent gain, and ducks it under narration (`src/video/renderVideo.js:543`, `src/video/renderVideo.js:631`). The entire final mix receives a 1.1-second fade at the end (`src/video/renderVideo.js:710`).

The editor prompt describes lift under hook, a reveal drop/hit, pullback before twist, and settled payoff (`src/crew/editorDirector.js:79`), but the edit schema contains no music cue points, sections, stems, bar/beat metadata, automation, or track in/out offsets (`src/crew/editorDirector.js:25`).

**Sound-design judgment.** Music is an emotionally categorized bed, not a co-editor. Voice ducking creates space but does not create narrative contour.

**Needed event map.** Hook onset, tension build, evidence hold, pre-reveal withdrawal, reveal downbeat/hit, and payoff resolution should each have explicit musical behavior tied to actual narration timestamps.

### SD-02 — P2: Track diversity is guarded, but mood and mix suitability remain unreviewed

**Verified behavior.** Selection avoids the last five tracks, prefers a fresh mood match, then uses a fresh wide-pool track rather than repeat, and hard-gates unavoidable repeated fallback (`src/audio/musicSelect.js:122`, `src/audio/musicSelect.js:158`, `src/pipeline/hardGate.js:58`). This addresses exact-file repetition.

However, the local mood pools are uneven: `assets/music/nature/` and `assets/music/science/` each contain one track, while the imported manifest music is primarily labeled neutral/cinematic/suspense (`assets/audio/README.md:92`). When a mood pool is exhausted, selection deliberately chooses any fresh wide-pool track (`src/audio/musicSelect.js:165`). The human review index has no completed decisions and flags `beatone`, `hippetyhop`, `chronos`, `fireworks`, and other tracks for possible documentary/mood/masking mismatch (`artifacts/audio-review/audio-review-index.md:14`).

**Sound-design judgment.** Exact repetition is controlled, but tonal mismatch can be introduced in the name of variety. A fresh track is not necessarily an appropriate track.

### SD-03 — P1: SFX vocabulary is small, fixed, and transition-centric; Foley is absent

**Verified behavior.** The main edit vocabulary is `whoosh`, `impact`, `riser`, and `shimmer` (`src/crew/editorDirector.js:22`). Each is synthesized from the same fixed oscillator/noise recipe every time (`src/video/renderVideo.js:360`). Main cues exist only per boundary between media items (`src/video/renderVideo.js:577`). CTA adds separate UI confirmation/pop/click sounds, but these serve interface animation rather than story-world action (`src/motion/ctaRenderer.js:12`).

No production path was found for scene-specific Foley or spot effects such as paper unfolding, fuse ignition, barrel movement, bee wing texture, wax handling, glass vibration, masonry collapse, water impact, fire spread, or archival projector/document sounds. The imported CC0 SFX/ambience library exists, but main story SFX generation does not select from it (`assets/audio/README.md:53`, `src/video/renderVideo.js:584`).

**Sound-design judgment.** The recurring vocabulary marks edits but rarely makes the depicted world tangible. This is a major contributor to narrated-slideshow synthetic feel.

### SD-04 — P1: Cue timing is boundary-based, not beat-aligned

**Verified behavior.** Main SFX begin at the transition midpoint (`src/video/renderVideo.js:658`). The edit plan can name a boundary SFX but cannot identify an anchor word, visual action, lead time, hit point, or tail (`src/crew/editorDirector.js:32`). A procedural riser lasts 0.9 seconds and spends 0.75 seconds fading in (`src/video/renderVideo.js:381`), so starting it at the reveal boundary makes it rise after the point it is supposed to build into.

The editor prompt asks for a hook-entry cue, but its schema only defines boundaries *between* scenes, so a true time-zero hook cue cannot be expressed by this path (`src/crew/editorDirector.js:32`, `src/crew/editorDirector.js:82`). The synthetic bee fixture includes a 0.4-second hook cue, but that fixture does not demonstrate the current production boundary planner (`artifacts/regression/bee-audio-cues.json:13`).

**Sound-design judgment.** Cue type may be semantically intended, but temporal placement prevents reliable emotional impact. Audio reacts to cuts rather than motivating or completing them.

### SD-05 — P2: Ambience is a single unverified bed and the local library is disconnected

**Verified behavior.** The editor requests one background ambience query for the story's main setting (`src/crew/editorDirector.js:59`). Freesound retrieval filters for CC0 and duration, sorts by downloads, and takes the first result with an MP3 preview (`src/audio/fetchAmbience.js:37`). The renderer loops that one file for the entire Short, band-limits it, applies fixed gain, and fades it in over 1.5 seconds (`src/video/renderVideo.js:569`, `src/video/renderVideo.js:647`). If API/key/network/search fails, ambience is simply absent (`src/audio/fetchAmbience.js:12`).

The repository contains local imported ambience assets, including hums, drones, room-like textures, vinyl, and nature textures (`assets/audio/README.md:70`), but `fetchAmbienceTrack` does not select them as fallback.

**Sound-design judgment.** One bed can support a stable setting, but it cannot express scene changes or foreground action. First-result popularity does not prove semantic or acoustic suitability, loop cleanliness, noise floor, or lack of distracting events.

### SD-06 — P1: Silence is monitored as a defect, not designed as an expressive beat

**Verified behavior.** Music and ambience loop across the total duration; narration is padded; final mixing trims the continuous result to total length (`src/video/renderVideo.js:536`, `src/video/renderVideo.js:710`). There is no schema for a music stop, ambience stop, pre-reveal vacuum, post-impact decay, or intentional quiet duration. Preflight reports silence lasting at least the configured threshold as a warning, distinguishing only trailing silence from other silence (`src/pipeline/preflight.js:140`).

**Sound-design judgment.** The system seeks continuous coverage. It cannot use a brief drop to focus attention before a twist, expose a meaningful pause, or let a payoff land without bed clutter. Filling silence is not the same as storytelling.

### SD-07 — P1: Phone-speaker translation is untested, and key energy is sub-heavy

**Verified behavior.** Impact uses 48 Hz and 90 Hz sine components plus a short high-frequency click (`src/video/renderVideo.js:368`). The procedural bed adds a pulse that falls from 70 Hz to 52 Hz and bass roots below the declared pad notes (`src/audio/makeMusic.js:99`, `src/audio/makeMusic.js:125`). Output is forced to stereo and measured for integrated loudness/peak, but no small-speaker high-pass audition, mono fold-down, codec preview, spectral-balance threshold, or noisy-room test was found (`src/video/renderVideo.js:710`, `src/pipeline/preflight.js:174`).

**Inferred playback effect.** Phone speakers may lose much of the impact/pulse body, leaving only the transient click or making effects feel inconsistent across devices. Stereo metadata does not guarantee useful stereo imaging on a phone.

**Required listening evidence.** Audition final compressed mixes through a mono 150–200 Hz high-pass phone proxy and actual phones at low volume. No such evidence is retained.

### SD-08 — P1: Final-output verification establishes audibility, not quality

**Verified behavior.** For each cue, QC compares maximum volume in a 0.30-second pre-cue window with a 0.55-second during-cue window; a delta of at least 3 dB passes (`src/pipeline/outputVerify.js:23`, `src/pipeline/outputVerify.js:120`). It also catches missing/unmixed assets and excessive identical cue IDs (`src/pipeline/outputVerify.js:78`). This is materially stronger than trusting the edit plan.

**Limitations.** The metric cannot isolate SFX energy from a simultaneous loud syllable, music accent, or cut transient. It does not measure spectral masking, harshness, distortion, timbral quality, semantic fit, cue onset precision, tail collision, intelligibility loss, or phone audibility. A large energy increase can be obnoxious; a subtle but effective effect can fail.

The synthetic bee regression reports deltas of 7.8–18.2 dB and a pass (`artifacts/regression/bee-before-after.md:18`). Those values prove energetic prominence in that fixture, not professional balance. The inspected waveform visibly shows large cue spikes, but a waveform cannot establish tone or narrative fit (`artifacts/regression/bee-audio-waveform.png`).

### SD-09 — P2: Ducking is technically robust but not content-adaptive

**Verified behavior.** Narration lightly sidechains music with fixed threshold/ratio/attack/release (`src/video/renderVideo.js:631`). The combined SFX bus sidechains voice and music, then SFX is added to the mix (`src/video/renderVideo.js:683`). Real tracks are capped at gain 0.32, procedural music uses the larger configured music gain, ambience uses fixed 0.18, and the final mix is normalized to -14 LUFS (`src/video/renderVideo.js:635`, `src/config.js:224`, `src/config.js:229`).

**Unknown quality.** Fixed gains do not account for each track's spectral density or master loudness. The review index explicitly notes loud source tracks that may remain dominant despite ducking (`artifacts/audio-review/audio-review-index.md:29`). SFX ducking the voice can protect the effect but may momentarily reduce the very reveal word it should support. Final integrated normalization cannot repair frequency masking or bad local balance.

### SD-10 — P2: Internal “audio design” scoring still uses planned cues, not rendered cues

**Verified behavior.** `sfxQuality` counts transition names from `editPlan`, estimates their timing from reconstructed item durations, and calls them the audio-design basis (`src/pipeline/editorialSignals.js:92`). Retention QC uses that result to award SFX count, spacing, and diversity points (`src/pipeline/retentionQC.js:231`). Actual final-output cue measurements are stored separately and hard-gated, but are not the inputs to the 10-point audio-design score (`src/pipeline/run.js:272`, `src/pipeline/run.js:362`).

**Consequence.** A plan can score for quantity/diversity without proving semantic appropriateness or matching actual rendered timing. Conversely, a strong sparse design can lose points because the metric expects three to six events. The latest retained rows show audio scores of 8 or 10, but these are internal scores, not listening verdicts (`data/qc-history.jsonl:1`, `data/qc-history.jsonl:2`, `data/qc-history.jsonl:3`, `data/qc-history.jsonl:4`).

## Evidence table

| ID | Severity | Verified repository evidence | Sound-design judgment | Evidence status |
|---|---|---|---|---|
| SD-01 | P1 | One looped track with ducking/final fade (`src/video/renderVideo.js:543`, `src/video/renderVideo.js:710`) | Music fills silence but does not map the story | Verified architecture; emotional result unlistened |
| SD-02 | P2 | Fresh-wide fallback can abandon mood (`src/audio/musicSelect.js:165`); human review unchecked (`artifacts/audio-review/audio-review-index.md:14`) | Diversity can produce mismatch | Verified; track quality unknown |
| SD-03 | P1 | Four fixed procedural boundary effects (`src/video/renderVideo.js:360`) | No scene-specific Foley or sonic world-building | Verified repository gap |
| SD-04 | P1 | Cues begin at transition midpoint (`src/video/renderVideo.js:658`) | Riser/hit timing is not beat-accurate | Verified timing; perceived result unknown |
| SD-05 | P2 | First Freesound result, one looped ambience (`src/audio/fetchAmbience.js:37`, `src/video/renderVideo.js:569`) | Texture is generic and brittle | Verified |
| SD-06 | P1 | Continuous beds and no silence-plan schema; silence becomes warning (`src/pipeline/preflight.js:140`) | No expressive negative space | Verified |
| SD-07 | P1 | Impact/pulse energy at 48–90/52–70 Hz (`src/video/renderVideo.js:368`, `src/audio/makeMusic.js:125`) | Phone translation is at risk and untested | Frequencies verified; playback effect inferred |
| SD-08 | P1 | 3 dB max-energy delta check (`src/pipeline/outputVerify.js:23`) | Audibility is not quality, meaning, or masking control | Verified; synthetic fixture only |
| SD-09 | P2 | Fixed ducking/gains and final loudnorm (`src/video/renderVideo.js:629`) | Technically sensible but not source/content adaptive | Verified; subjective mix unknown |
| SD-10 | P2 | Retention score counts edit-plan SFX (`src/pipeline/editorialSignals.js:99`) | Internal score is not a rendered listening verdict | Verified |

## Top five creative or technical blockers

1. **P1 — No production mix is retained for human audition.** Synthetic energy measurements cannot establish cinematic sound, masking, or emotional effect (`artifacts/regression/bee-before-after.md:3`).
2. **P1 — Music has no beat/arc map.** One looped track and automatic ducking cannot perform hook, tension, reveal, and payoff structure (`src/video/renderVideo.js:543`).
3. **P1 — SFX are transition markers rather than story-world sound.** Four repeated synthesized types and no Foley leave scenes sonically generic (`src/video/renderVideo.js:360`).
4. **P1 — Cue timing cannot target words/actions.** Starting every effect at a transition midpoint makes risers structurally late and hits imprecise (`src/video/renderVideo.js:658`).
5. **P1 — Phone translation is unknown.** Loudness/stereo checks do not test loss of low-frequency impact on small speakers (`src/pipeline/preflight.js:174`).

## Quick wins

- Require a human listen to the final compressed mix on studio headphones and an actual phone before publication; record timestamps and device.
- For every SFX, document the exact narration word/visible action and purpose. Remove any cue whose only reason is “there is a transition.”
- Place risers so they end on the reveal; place impacts on the reveal word/action; do not start them at the boundary by default.
- Complete the existing twelve-track listening checklist before treating manifest mood labels as authoritative.
- Use the local CC0 ambience library as a reviewed fallback instead of silently losing ambience when Freesound fails.
- Add at least one midrange component to phone-critical impacts during future implementation review; verify rather than merely increasing volume.
- Manually create one deliberate quiet pocket before the principal reveal and compare it with continuous-bed output.

## Structural improvements

1. **Authoritative audio beat map.** Define narration/visual anchors, music state, SFX type, lead/hit/tail alignment, ambience state, Foley, and silence. Acceptance criterion: every non-voice event has a timestamped narrative purpose.
2. **Music edit system.** Analyze or annotate BPM, downbeats, sections, energy, density, and safe excerpt points; support level/filter/section automation. Acceptance criterion: hook, reveal, and payoff land on intentionally selected musical moments.
3. **Story SFX/Foley vocabulary.** Select reviewed assets by depicted event and material, with variations and provenance. Acceptance criterion: each factual action that benefits from sound has a semantically matched, non-repetitive cue—or intentional silence.
4. **Scene-aware ambience.** Support reviewed local fallback, loop-point validation, location changes, and foreground/background distinction. Acceptance criterion: ambience matches each setting and contains no distracting unplanned events.
5. **Rendered perceptual QC.** Combine energy checks with speech intelligibility, spectral masking, true peak, cue timing, mono/small-speaker proxy, and human listening. Acceptance criterion: final compressed output passes headphone, phone, and low-volume review.
6. **Rendered-cue scoring.** Derive audio-design metrics from actual cue telemetry and beat intent, not edit-plan names/count quotas. Acceptance criterion: sparse purposeful sound can pass; arbitrary audible cues cannot.

## Experiments to run

1. **Flat bed versus beat-mapped music:** same voice/picture, with current looped bed versus hook/reveal/payoff automation.
2. **Transition-only versus Foley-rich:** add claim-specific paper/fuse/bee/wax/quake/water/fire cues to representative scenes while reducing generic whooshes.
3. **Continuous bed versus designed silence:** introduce a 250–500 ms pre-reveal music/ambience withdrawal and measure reveal recall.
4. **Boundary riser versus end-on-reveal riser:** blinded timing/impact assessment.
5. **Sub impact versus phone-translating impact:** compare current 48/90 Hz design with controlled midrange harmonics on actual phones.
6. **Mood-matched versus fresh-wide fallback:** blind-review track-story fit before measuring retention.

These are proposed experiments; none were run during this read-only audit.

## Metrics that would validate improvement

- Human semantic-fit score for every SFX/ambience/music choice.
- Cue timing error relative to target narration word or visible action.
- Dialogue intelligibility and short-term loudness before/during each cue.
- Spectral masking between voice, music, ambience, and SFX in the speech band.
- Phone-proxy and actual-phone detection rate for critical impacts at low volume.
- Music mood/energy agreement and reveal/downbeat alignment rate.
- Foley coverage of meaningful visible actions, without introducing a quota.
- Deliberate-silence count and reveal recall/retention around quiet pockets.
- Exact track and effect repetition across recent videos, plus perceptual similarity.
- Integrated LUFS, short-term LUFS, true peak, clipping, mono compatibility, and codec-output comparison.
- Viewer retention/rewatch around beat-mapped reveals versus flat-bed controls.

## Risks and regressions

- More Foley can become literal, noisy, or comedic; only add sounds that clarify material, scale, action, or emotion.
- Stronger midrange impacts can mask consonants. Align pockets around, not over, critical words.
- Beat-mapping may force unnatural edits if music dominates narration; story timing remains primary.
- Deliberate silence may trigger existing technical warnings; intentional quiet must be declared so defects remain detectable.
- Mood diversity can be reduced by strict matching; grow reviewed pools rather than accepting mismatched variety.
- Local ambience loops can reveal seams; validate loop points and avoid distinctive repeated events.
- Loudness normalization can make a denser mix seem equivalent numerically while increasing fatigue; use perceptual review.
- Phone proxy filters are not a substitute for real device listening.

## Final P0/P1/P2/P3 list

### P0

- None verified.

### P1

- **SD-01:** Music is a single looped, ducked bed without beat/section mapping to hook, reveal, climax, or payoff (`src/video/renderVideo.js:543`).
- **SD-03:** The main SFX vocabulary is four fixed procedural transition sounds with no scene-specific Foley path (`src/video/renderVideo.js:360`).
- **SD-04:** SFX begin at transition midpoints instead of target narration/action beats; risers therefore build after their intended reveal (`src/video/renderVideo.js:658`).
- **SD-06:** No intentional silence/negative-space plan exists; continuous coverage is the default (`src/video/renderVideo.js:710`).
- **SD-07:** Critical low-frequency impact/pulse content has no phone-speaker or mono translation test (`src/video/renderVideo.js:368`).
- **SD-08:** Final-output verification proves local energy increase, not timbre, masking, semantic fit, or professional quality (`src/pipeline/outputVerify.js:23`).

### P2

- **SD-02:** Music diversity fallback can sacrifice mood fit, while the human review checklist remains incomplete (`src/audio/musicSelect.js:165`, `artifacts/audio-review/audio-review-index.md:14`).
- **SD-05:** Ambience is one first-result external loop with no runtime local-library fallback or scene evolution (`src/audio/fetchAmbience.js:37`).
- **SD-09:** Fixed gains/ducking and integrated loudnorm are not source- or beat-adaptive (`src/video/renderVideo.js:629`).
- **SD-10:** The internal audio-design score counts planned rather than rendered, semantically verified cues (`src/pipeline/editorialSignals.js:99`).

### P3

- No standalone polish item should precede beat mapping, event-specific sound, production listening, and phone translation.

## “No files were modified” confirmation

No application code, production configuration, prompt, audio asset, generated output, or existing repository file was modified. The only file created is this audit report: `reports/2026-07-21/09-sound-design-director.md`. Existing waveform, audio metadata, and documentation artifacts were inspected read-only. No dependency was installed, no audio/render/publish/upload command was run, and no commit or push was performed.
