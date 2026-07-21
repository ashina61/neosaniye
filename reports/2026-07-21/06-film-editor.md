# Film Editor Audit — 2026-07-21

## Executive verdict

The repository assembles technically coherent videos, but it does not yet perform a meaning-led professional edit. Its best editorial idea is sound: most boundaries should be cuts and animated transitions should mark emotional changes (`src/crew/editorDirector.js:71`). The rendered implementation, however, schedules every visual boundary from narration word-count proportions rather than the TTS engine's actual word timestamps (`src/pipeline/run.js:144`, `src/video/renderVideo.js:820`). Cuts therefore follow estimated text share, not the precise instant a sentence, pause, reveal word, visual referent, or vocal emphasis occurs.

The editor agent chooses only a transition and SFX category at each pre-existing scene boundary. It cannot move a cut inside a scene, specify an audio lead or visual lead, hold an evidence shot, reorder material, identify the climax timestamp, or place a reveal hit on a particular spoken word (`src/crew/editorDirector.js:25`, `src/crew/editorDirector.js:106`). SFX are subsequently centered on transition overlaps, so audio follows the mechanically calculated cut rather than motivating it (`src/video/renderVideo.js:526`, `src/video/renderVideo.js:658`). When the editor agent is unavailable, the system alternates short pseudo-cuts and animated transitions by boundary index and cycles SFX types without regard to story meaning (`src/video/renderVideo.js:764`, `src/video/renderVideo.js:798`).

The result is a scene connector with editorial decoration, not yet a fully responsive timeline. It can maintain continuous narration, avoid gross black/frozen/silent output, and add a fixed ending breath. It cannot prove that visuals enter on the noun they illustrate, that a reveal lands at the strongest vocal instant, that pacing accelerates or relaxes with dramatic function, or that the climax owns the strongest visual and sonic hierarchy.

No P0 issue is verified. The leading problems are P1 synchronization and QC-design failures. Current production MP4s and edit decision lists are not retained in the repository. The available bee MP4s are explicitly synthetic regression artifacts rather than the real topic render (`artifacts/regression/bee-before-after.md:1`). FFmpeg/ffprobe are unavailable in this workspace, so those fixtures could not be independently sampled. Viewer-effect judgments below are therefore labeled as inference or untested runtime behavior.

## Verified findings

### FE-01 — P1: Shot boundaries are proportional estimates, not narration-synchronized edit points

**Verified behavior.** The pipeline derives a weight for each scene from narration word count and estimates each scene's seconds as its share of the TTS duration (`src/pipeline/run.js:144`). If a long static scene is split, the same weight is divided evenly among its media items (`src/pipeline/run.js:165`). The renderer allocates the actual clip durations from these weights across the probed narration duration plus transition overlap (`src/video/renderVideo.js:820`).

The TTS path already supplies exact word start/end timings from Edge word boundaries or Whisper alignment (`src/tts/generateAudio.js:17`, `src/tts/generateAudio.js:84`). Those timestamps are sent to the renderer for captions (`src/pipeline/run.js:202`) but not used to locate visual boundaries.

**Inferred viewer effect.** Speech rate is not uniform. A scene with a deliberate pause, fast phrase, long proper name, or emphatic reveal can end earlier or later than its word-count allocation. The next visual may precede the noun it depicts, or the old visual may linger after the narration has moved on. Equal division of a split scene also places its internal cut at the temporal midpoint, irrespective of sentence structure.

**Better editorial decision.** Derive scene start/end times by mapping each scene's actual narration tokens to word timings. Permit intentional offsets—audio lead, visual lead, or hold—as explicit edit decisions relative to those anchors. A split scene needs a phrase/beat anchor, not an automatic half-duration cut.

### FE-02 — P1: The edit plan cannot describe professional cut placement or rhythm

**Verified behavior.** The editor schema contains music mood, one transition/SFX pair per scene boundary, subscription placement, and ambience (`src/crew/editorDirector.js:25`). Its prompt receives scene narration only (`src/crew/editorDirector.js:106`). It has no fields for boundary time, anchor word, shot priority, minimum hold, J-cut/L-cut, action match, reaction beat, montage acceleration, climax, reveal frame, or ending cadence.

Scene order is inherited unchanged from the script. The renderer processes media sequentially (`src/video/renderVideo.js:850`). The scene director infers purpose through text-position and keyword rules—first scene/question is hook, last is payoff, penultimate is answer—rather than reading the assembled sequence (`src/pipeline/sceneDirector.js:18`).

**Inferred viewer effect.** Even a sensible transition label cannot correct a weak scene order or make a cut land on the moment the viewer understands new information. The edit has one pacing unit per generated scene, so rhythm is likely to repeat the script template rather than discover the strongest audiovisual version of the story.

**Better editorial decision.** Store a timeline beat sheet containing purpose, narration anchor, visual action, cut reason, desired relationship to sound, and hierarchy. Allow editorial review to merge, split, reorder, or hold shots before rendering; do not equate script paragraph boundaries with optimal cut points.

### FE-03 — P1: SFX are cut-led, not audio-led, and a riser is placed too late for its stated purpose

**Verified behavior.** Transition offsets are calculated from clip durations and overlaps (`src/video/renderVideo.js:526`). Every SFX is delayed to the center of its transition (`src/video/renderVideo.js:658`). The generated riser lasts 0.9 seconds and fades up for 0.75 seconds (`src/video/renderVideo.js:381`), yet it begins at the transition midpoint rather than ending there. This conflicts with the editor prompt's definition of a riser as tension building *into* a reveal (`src/crew/editorDirector.js:75`).

Impact, shimmer, and whoosh are likewise tied to boundaries, not a selected narration word or visible action. The planning schema has no cue offset (`src/crew/editorDirector.js:32`).

**Inferred viewer effect.** A reveal riser will build after the reveal boundary rather than resolve into it. Hits can land between words or under the beginning of the next sentence. This weakens the causal feeling that sound pulls the viewer into a cut.

**Better editorial decision.** Specify SFX by semantic anchor and alignment mode: `end_on`, `hit_on`, or `start_on`. Risers should end on the reveal word/frame; impacts should hit on the decisive word or action; whooshes should bridge an actual time/location change. Boundary SFX should remain optional.

### FE-04 — P1: Failure fallback produces unmotivated transition rhythm

**Verified behavior.** If the editor plan is absent or its boundary count is invalid, every even boundary receives an animated transition selected cyclically from configuration, while alternating boundaries receive a two-frame “cut” (`src/video/renderVideo.js:764`). SFX types are then cycled across animated boundaries with a video-dependent shift (`src/video/renderVideo.js:798`). The pipeline explicitly continues with this mechanical plan if the editor agent fails (`src/pipeline/run.js:100`).

The default transition list includes fades, slides, zoom, smooth moves, and a wipe (`src/config.js:170`). Their selection in fallback mode depends on ordinal position, not a time jump, location change, reveal, or matched movement.

**Inferred viewer effect.** Alternation creates a recognizable template pulse. An animated wipe may appear during continuous thought, while a significant revelation may receive the same treatment as an ordinary exposition boundary. Cycled sound compounds the arbitrary emphasis.

**Better editorial decision.** A safe fallback should use clean cuts by default and introduce a transition only from a deterministic, evidence-backed story condition such as explicit time/place change. Silence is preferable to incorrectly motivated SFX.

### FE-05 — P2: A configured “cut” is actually a two-frame fade overlap

**Verified behavior.** At 30 fps the renderer defines `CUT = 2 / fps`, labels it `fade`, and sends it through `xfade` (`src/video/renderVideo.js:766`, `src/video/renderVideo.js:778`, `src/video/renderVideo.js:960`). It is therefore approximately 66.7 ms of dissolve, not a zero-duration hard cut.

**Inferred viewer effect.** The overlap may be perceived as a soft or smeared edit on high-motion or high-contrast changes, especially when the intended cut is a punchline, reveal, graphic match, or sharp change in evidence. The effect may be negligible in some shots; current production frames are unavailable, so perceptual severity is untested.

**Better editorial decision.** Implement true concatenated cuts for `cut`, reserve xfade for actual transitions, and verify frame accuracy with a high-contrast cut fixture.

### FE-06 — P1: Editorial QC reconstructs a different timeline from the renderer

**Verified behavior.** After rendering, QC recomputes item durations by distributing the *final video duration* directly across weights (`src/pipeline/run.js:326`). It then calculates starts as a simple cumulative sum (`src/pipeline/run.js:336`). The real renderer instead distributes `narrationDur + transition overlaps`, applies minimum clip constraints and rescaling, subtracts transition overlap, and adds a fixed tail to the last shot (`src/video/renderVideo.js:817`, `src/video/renderVideo.js:838`). Optional outro timing further changes the final duration (`src/video/renderVideo.js:758`).

QC maps rendered SFX cues back to scenes using this reconstructed timeline (`src/pipeline/run.js:339`). The scene director and attention forecast consume the same approximate `itemSeconds` and starts (`src/pipeline/sceneDirector.js:59`, `src/pipeline/editorCritique.js:15`).

**Consequence.** Reported boring moments, scene starts, longest static holds, SFX-to-narration matches, and swipe-risk timestamps need not correspond to the actual rendered boundaries. Render QC can therefore approve or criticize the wrong moment.

**Better editorial decision.** Have the renderer return an authoritative edit decision list: each clip's source scene, start, end, overlap, transition, SFX cue, narration anchor, tail, CTA, and outro. All editorial QC must read that same timeline.

### FE-07 — P2: Pacing QC rewards event frequency, not dramatic rhythm

**Verified behavior.** Retention QC calculates average event interval as final duration divided by plan count and awards points for shorter intervals (`src/pipeline/retentionQC.js:68`, `src/pipeline/retentionQC.js:140`). Long photo durations, pattern-interrupt count, and motion share drive the remainder. The editor critique adds boredom risk at fixed duration thresholds of 4.0 and 5.5 seconds (`src/pipeline/editorCritique.js:14`).

The latest retained QC records show similar internal pacing outcomes across materially different stories: Guy Fawkes, animal magnetism, and Lisbon score 9, while honeycomb scores 6 (`data/qc-history.jsonl:1`, `data/qc-history.jsonl:2`, `data/qc-history.jsonl:3`, `data/qc-history.jsonl:4`). These are internal scores, not viewer retention measurements.

**Inferred viewer effect.** A necessary evidence hold, suspense pause, or emotional landing can be penalized for length, while an arbitrary same-scene split can improve the score. This encourages uniformly busy pacing rather than contrast between hook, setup, escalation, reveal, and payoff.

**Better editorial decision.** Evaluate whether duration fits function: hooks must resolve their initial load quickly; evidence holds until legible; a reveal gets preparation and landing; the payoff is not crowded by CTA/finale overlays. Measure rhythm variation and information transfer, not cuts per second alone.

### FE-08 — P2: Ending logic is fixed-duration and may compete with the spoken payoff

**Verified behavior.** The renderer adds 0.4 seconds to the last visual after narration (`src/config.js:177`, `src/video/renderVideo.js:838`) and fades the entire audio mix over its final 1.1 seconds (`src/video/renderVideo.js:710`). The finale text begins 2.6 seconds before the last word ends and remains until 1.6 seconds after it (`src/video/renderVideo.js:151`). The default outro is disabled because it breaks Shorts looping (`src/config.js:201`), which is editorially appropriate.

**Inferred viewer effect.** The finale title can arrive while the last sentence is still unfolding, potentially announcing or visually competing with the payoff. The master fade begins roughly 0.7 seconds before narration ends under default tail timing, so the final spoken phrase, music resolution, and any late impact may be inside the fade. A universal 0.4-second breath cannot adapt to a clipped punchline, contemplative ending, or designed loop.

**Better editorial decision.** Anchor finale text and music resolution to the actual payoff phrase. Choose among snap-to-loop, brief hold, or longer emotional resolve by ending type. Verify that the final spoken emphasis and impact occur before—not inside—the destructive part of the master fade.

### FE-09 — P1: Render QC verifies technical continuity but not edit meaning

**Verified behavior.** Preflight checks duration range, stream presence, resolution, frame rate, decode integrity, black/freeze/silence events, loudness, and three brightness samples (`src/pipeline/preflight.js:81`, `src/pipeline/preflight.js:127`, `src/pipeline/preflight.js:140`, `src/pipeline/preflight.js:189`). It does not measure whether a cut lands on narration, whether a transition is motivated, whether a reveal visual arrives early, whether the climax is hierarchically strongest, or whether the ending breath feels intentional.

Only hook and midpoint preview frames are retained by the pipeline report path (`src/pipeline/run.js:524`). The available bee regression MP4s are synthetic code-path fixtures, and their report evaluates CTA, channel layout, SFX audibility, and hard-gate behavior rather than story edit (`artifacts/regression/bee-before-after.md:3`, `artifacts/regression/bee-before-after.md:9`).

**Consequence.** “Technical ready” and audible SFX do not establish professional editing. Current repository evidence cannot verify unnecessary micro-pauses, rushed phrase transitions, visual lag, or cinematic flow in published Shorts.

**Better editorial decision.** Retain a low-resolution review render plus timeline/contact sheet and require human playback at normal speed and muted. Review scene boundaries around hook, first evidence, reveal, climax, payoff, and loop point.

## Evidence table

| ID | Severity | Verified evidence | Editorial assessment | Evidence status |
|---|---|---|---|---|
| FE-01 | P1 | Word-count weights drive clip duration while exact word timings are caption-only (`src/pipeline/run.js:144`, `src/video/renderVideo.js:820`) | Cuts can precede or lag spoken beats | Behavior verified; viewer effect inferred |
| FE-02 | P1 | Edit schema contains boundary transition/SFX but no timing or beat anchors (`src/crew/editorDirector.js:25`) | Timeline connects scenes rather than shaping meaning within them | Verified capability gap |
| FE-03 | P1 | SFX starts at transition midpoint (`src/video/renderVideo.js:658`); riser itself rises afterward (`src/video/renderVideo.js:381`) | Reveal sound is structurally late | Timing verified; audible effect untested |
| FE-04 | P1 | Missing plan triggers alternating indexed transitions and cycled SFX (`src/video/renderVideo.js:764`, `src/video/renderVideo.js:798`) | Fallback rhythm is unmotivated and repetitive | Verified |
| FE-05 | P2 | `cut` becomes a 2-frame fade xfade (`src/video/renderVideo.js:766`, `src/video/renderVideo.js:778`) | Intended hard cuts may smear | Verified implementation; perception untested |
| FE-06 | P1 | QC timing formula differs from render timing (`src/pipeline/run.js:326`, `src/video/renderVideo.js:817`) | Scene/SFX QC can inspect the wrong timestamp | Verified |
| FE-07 | P2 | Pacing score uses plans/time and fixed static thresholds (`src/pipeline/retentionQC.js:68`, `src/pipeline/editorCritique.js:19`) | Faster/more events can score better without stronger drama | Verified scoring; viewer effect inferred |
| FE-08 | P2 | Fixed tail, 1.1-second master fade, and finale overlay timing (`src/video/renderVideo.js:838`, `src/video/renderVideo.js:710`, `src/video/renderVideo.js:167`) | Ending elements can compete with payoff | Verified timing; production playback unavailable |
| FE-09 | P1 | Preflight is technical; only two preview frames retained (`src/pipeline/preflight.js:81`, `src/pipeline/run.js:524`) | No professional rendered edit review is evidenced | Verified |

## Top five creative or technical blockers

1. **P1 — Visual boundaries are not anchored to actual speech.** Exact TTS timestamps exist, but word-count proportions place every shot (`src/tts/generateAudio.js:84`, `src/pipeline/run.js:144`).
2. **P1 — The edit plan has no beat-level vocabulary.** It cannot express an audio lead, visual lead, internal cut, reaction hold, climax hit, or reveal-frame alignment (`src/crew/editorDirector.js:25`).
3. **P1 — QC does not use the rendered timeline.** Its reconstructed scene starts diverge from transition, clamp, tail, and outro math (`src/pipeline/run.js:326`, `src/video/renderVideo.js:817`).
4. **P1 — SFX timing follows transition geometry rather than story beats.** The riser placement directly contradicts its intended “build into reveal” function (`src/video/renderVideo.js:658`, `src/crew/editorDirector.js:75`).
5. **P1 — No current production sequence is retained for professional playback review.** Technical preflight and two stills cannot establish pacing, motivation, or synchronization (`src/pipeline/preflight.js:127`, `src/pipeline/run.js:524`).

## Quick wins

- Generate a scene-to-word timing map from existing TTS word timings and use it as the review baseline before changing render behavior.
- In fallback mode, prefer hard cuts and silence; do not alternate transitions or cycle SFX merely because a boundary exists.
- Treat `cut` as a true cut in edit terminology and reporting. Until implementation changes are separately authorized, flag the current two-frame fade as a pseudo-cut.
- Move riser editorial cues conceptually so their peak/end, not their start, meets the reveal boundary.
- Preserve one authoritative rendered timeline in each production report, including actual clip starts/ends, overlaps, transitions, and cues.
- Add manual playback checks at every hook, reveal, climax, and payoff boundary before upload.
- Review finale overlay onset and master fade against the last spoken words; do not assume the fixed defaults fit every ending.

## Structural improvements

1. **Speech-anchored timeline.** Map each scene and phrase to actual word timings. Acceptance criterion: visual boundaries match selected word/phrase anchors within two frames, except documented intentional leads/lags.
2. **Beat-level edit decision list.** Represent cut reason, anchor, offset, transition, visual function, SFX alignment, and minimum hold. Acceptance criterion: every nontrivial transition states a narrative motivation; every reveal/climax has an explicit audiovisual landing.
3. **Authoritative renderer telemetry.** Return actual per-item timing after clamps, overlaps, tail, CTA, and outro. Acceptance criterion: QC timestamps equal probed/rendered boundary timestamps within one frame.
4. **True-cut and motivated-transition paths.** Keep hard cuts separate from xfade. Acceptance criterion: `cut` has no blended frames; animated transitions occur only on approved semantic changes.
5. **Function-aware pacing review.** Assess duration against hook/setup/evidence/escalation/reveal/payoff roles. Acceptance criterion: no score improves solely because the same scene was automatically split.
6. **Rendered editorial gate.** Retain a review proxy and inspect sound-on and muted. Acceptance criterion: a human reviewer approves narration/visual sync, transition motivation, climax hierarchy, ending rhythm, and loop behavior.

## Experiments to run

1. **Word-count versus speech-anchored cut A/B:** render the same script with current proportional timing and phrase-end timing; conduct blinded sync/flow review.
2. **Fallback transition test:** compare current alternating effects with all true cuts, holding shots and narration constant.
3. **Reveal SFX alignment test:** compare riser-start-at-boundary with riser-end-on-reveal-word and measure perceived reveal strength.
4. **Rhythm contour test:** compare uniform 3–4 second scene pacing with purposeful acceleration into climax followed by a payoff hold.
5. **Ending variants:** snap loop, 0.4-second resolve, and phrase-anchored longer resolve; measure loop detection and rewatch.
6. **Muted edit review:** ask blinded reviewers to identify hook, evidence, reveal, climax, and payoff from picture rhythm alone.

These are proposed experiments; none were run during this read-only audit.

## Metrics that would validate improvement

- Median and 95th-percentile absolute error between intended narration anchor and rendered cut.
- Percentage of cuts with a documented semantic motivation.
- Percentage of reveal/climax cues landing within two frames of their target word or visual action.
- Rate of animated transitions judged motivated in blinded review.
- False scene assignment rate for SFX and attention-risk timestamps in QC.
- Viewer-rated audiovisual synchronization and cinematic-flow score.
- Retention delta in the one second before and two seconds after reveal/climax cuts.
- Ending drop-off, final-second retention, and rewatch rate by ending strategy.
- Rhythm variation by narrative phase, interpreted alongside comprehension—not as a target for more cuts.
- Human-detected rushed beats, dead holds, premature visuals, lagging visuals, and repetitive transition patterns per video.

## Risks and regressions

- Exact speech anchoring can become mechanical if every cut lands on a sentence end; purposeful J/L cuts and reaction holds must remain available.
- True cuts expose mismatched composition or motion more clearly than dissolves; visual continuity review remains necessary.
- Removing fallback effects may make weak asset plans feel static. The solution is stronger shot planning, not decorative wipes.
- More precise cues can overemphasize every beat. Preserve silence and hierarchy so only major moments receive major treatment.
- Reordering or splitting scenes can desynchronize captions and factual context; all downstream timing must consume one authoritative timeline.
- A longer payoff hold may hurt loops, while a snap ending may reduce comprehension. Ending strategy must be tested by story type.
- Human edit review adds cost and taste variance; reviewers should cite exact timestamps and cut purposes.

## Final P0/P1/P2/P3 list

### P0

- None verified.

### P1

- **FE-01:** Clip boundaries use narration word-count proportions instead of actual spoken-scene timing (`src/pipeline/run.js:144`, `src/video/renderVideo.js:820`).
- **FE-02:** The edit plan cannot specify beat-level placement, audio/visual leads, climax alignment, internal cuts, or reordering (`src/crew/editorDirector.js:25`).
- **FE-03:** SFX begin at transition centers rather than aligning their peak/end to narration or action; risers are structurally late (`src/video/renderVideo.js:658`).
- **FE-04:** Editor failure invokes indexed alternating transitions and cycled SFX without narrative motivation (`src/video/renderVideo.js:764`).
- **FE-06:** QC reconstructs timing differently from the renderer and can assign cues/risks to wrong moments (`src/pipeline/run.js:326`, `src/video/renderVideo.js:817`).
- **FE-09:** Technical preflight and two still previews do not evaluate professional edit flow or synchronization (`src/pipeline/preflight.js:127`, `src/pipeline/run.js:524`).

### P2

- **FE-05:** A declared hard cut is implemented as an approximately two-frame fade (`src/video/renderVideo.js:766`, `src/video/renderVideo.js:778`).
- **FE-07:** Pacing QC rewards event frequency and fixed duration thresholds rather than narrative-function rhythm (`src/pipeline/retentionQC.js:140`).
- **FE-08:** Fixed finale, tail, and master-fade timing can crowd or soften the final payoff (`src/video/renderVideo.js:167`, `src/video/renderVideo.js:710`).

### P3

- No standalone polish recommendation should take priority over the P1 timeline and review gaps.

## “No files were modified” confirmation

No application code, production configuration, prompt, media asset, generated output, or existing repository file was modified. The only file created is this audit report: `reports/2026-07-21/06-film-editor.md`. Temporary contact-sheet extraction was attempted under `/tmp`, but FFmpeg was unavailable and no temporary output was produced. No dependency was installed, no render/publish/upload command was run, and no commit or push was performed.
