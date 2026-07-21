# Motion Design Director Audit — 2026-07-21

## Executive verdict

NeoSaniye currently has a competent CTA overlay subsystem and a technically stable way to keep still images moving, but it does not yet have a general explanatory-motion system. Most scene movement is decorative: every media item receives an index-driven zoom/pan path regardless of its subject, focal point, narration, or informational purpose (`src/video/renderVideo.js:296`). The movement alternates zoom direction and cycles five fixed pan biases; the first item always receives an extra zoom punch (`src/video/renderVideo.js:305`). No face, object, label, region-of-interest, or narration anchor enters that calculation.

The visual-director prompt asks for arrows, rays, highlights, maps, routes, orbit diagrams, anatomy callouts, comparisons, and visible action results (`src/crew/visualDirector.js:146`). The implemented graphic vocabulary is instead a number counter and a numbered text-steps card (`src/media/renderTemplate.js:43`, `src/media/renderTemplate.js:166`). There are no implemented animated maps, timelines, cross-sections, comparison wipes, tracked labels, callout leaders, path traces, or mechanism diagrams. Worse, those full-screen graphic videos pass through the same generic Ken Burns filter as photos and stock video because `normalizeClip` does not exempt `gfx` or video sources (`src/video/renderVideo.js:325`, `src/pipeline/run.js:202`).

The CTA system is the repository's strongest motion work: it has adaptive cards, distinct icon behaviors, safe-area rules, deterministic templates, post-render layer verification, and fail-safe fallback (`src/motion/ctaTemplates.js:115`, `src/motion/ctaEngine.js:10`). However, “editorial” CTA timing and type selection are seeded random choices within a broad time window, not decisions tied to payoff, narration, or visual composition (`src/motion/ctaSelector.js:64`). Automatic subject avoidance is documented as absent, and the production call does not provide a subject box (`docs/neo-motion-engine.md:97`, `src/motion/ctaEngine.js:55`).

No P0 issue is verified. The absence of explanatory motion, focal tracking, and production-content motion QC is P1 because it materially limits comprehension and makes AI-still sequences feel animated without becoming more informative. Available acceptance artifacts use representative synthetic backgrounds rather than current NeoSaniye production videos (`artifacts/motion/acceptance/acceptance-report.md:3`). FFmpeg is unavailable in this workspace, so the retained synthetic MP4 fixtures could not be independently sampled. Rendered-motion judgments are therefore bounded to available contact sheets/reports and verified filter behavior.

## Verified findings

### MD-01 — P1: Camera movement is index-driven, not focal-point-aware

**Verified behavior.** `normalizeClip` computes zoom amount from whether the video is in animated style and from the item index. Even indexes zoom in; odd indexes zoom out. Horizontal and vertical drift cycle through fixed arrays of five values (`src/video/renderVideo.js:305`). Position is calculated from the frame center and those index values (`src/video/renderVideo.js:317`). No focal coordinates, subject box, face box, object track, saliency point, or shot-list camera path is accepted by the function (`src/video/renderVideo.js:299`).

**Inferred viewer effect.** A pan may move away from the person, artifact, insect, diagram step, or evidence detail named by narration. A zoom-out can weaken a reveal; a zoom-in can crop context required to understand a map or comparison. Because the pattern repeats every few items, longer sequences risk a visible mechanical cadence.

**Information motion should reveal.** Camera motion should guide the eye from context to the exact evidence: for Guy Fawkes, Parliament exterior to cellar location; for honeycomb, circular cell boundary to the shared wall becoming hexagonal; for animal magnetism, bird eye/cryptochrome region to the directional field response. Each path requires explicit start/end focal regions.

### MD-02 — P1: The same Ken Burns treatment is applied to photos, live video, and rendered graphics

**Verified behavior.** Media type changes only input looping behavior; all inputs receive the same grade, scale/crop, `zoompan`, and output scaling chain (`src/video/renderVideo.js:325`, `src/video/renderVideo.js:339`). The pipeline passes `gfx` as a flag, but `normalizeClip` does not read it (`src/pipeline/run.js:202`, `src/video/renderVideo.js:299`). Generated step/stat cards are 1080×1920 videos (`src/media/renderTemplate.js:52`, `src/media/renderTemplate.js:175`), then are normalized through this camera path like any other item.

**Inferred viewer effect.** Motion on already-moving stock can feel like an unnecessary digital push or alter the original shot's framing. Zooming a full-screen text graphic can reduce edge safety and move the information hierarchy after it was deliberately laid out. Generic motion makes different visual forms behave alike instead of respecting their function.

**Information motion should reveal.** Live footage should retain or selectively reframe its native action; stat cards should animate the number only; step graphics should reveal causal stages; maps should trace routes; comparisons should expose a controlled before/after boundary. Camera movement should not be the default animation for every source.

### MD-03 — P1: The directing prompt promises an explanatory-motion vocabulary that the renderer does not implement

**Verified behavior.** The director explicitly requests arrows/rays/highlights and specifies history maps, space-orbit diagrams, animal anatomy, demonstrations with visible result, and comparisons (`src/crew/visualDirector.js:146`, `src/crew/visualDirector.js:152`, `src/crew/visualDirector.js:161`). Its schema exposes only a `diagram` title plus two to four text steps (`src/crew/visualDirector.js:79`). The renderer reveals those steps as numbered lines at 0.9-second intervals (`src/media/renderTemplate.js:166`, `src/media/renderTemplate.js:206`). Validation checks only title and step count (`src/media/renderTemplate.js:250`).

No implementation for animated arrows, label anchors, map coordinates, routes, timelines, cross-sections, orbit paths, anatomy callouts, quantitative comparisons, or before/after reveals was found in `src/media/`, `src/motion/`, or `src/video/`.

**Consequence.** Sequential text can restate narration, but it cannot show where, how, how far, which direction, or what changed. The motion is progressive disclosure, not a diagram of the mechanism.

**Information motion should reveal.** Animal magnetism needs a light ray activating a paired-electron state, a field-axis rotation, then a bird-direction outcome. Honeycomb needs a controlled morph or overlay from circles to shared hexagonal walls. Lisbon needs a quake epicenter, tsunami route/time, fire spread, and reconstruction grid on a map/timeline.

### MD-04 — P1: “Motion” in shot planning means stock selection, not a motion-design plan

**Verified behavior.** The visual-director `motion` boolean is defined as whether to use real stock footage instead of a still (`src/crew/visualDirector.js:38`). Applying the shot list stores that boolean and stock keywords but no camera path, focal point, explanatory animation, or tracked feature (`src/crew/visualDirector.js:210`). Asset generation consumes it only to decide whether to search for stock video (`src/media/generateImages.js:209`). The renderer receives media path/type and a `gfx` flag, not the scene's intended motion or focal information (`src/pipeline/run.js:202`).

**Consequence.** The creative system cannot distinguish “the subject moves,” “the camera moves,” “a label tracks the subject,” and “a diagram changes state.” These have different comprehension functions but collapse into stock video versus generic zoompan.

**Information motion should reveal.** A motion plan should declare the moving entity, start/end state, focus target, reason, narration anchor, and whether the motion is native footage, camera reframing, overlay tracking, or explanatory transformation.

### MD-05 — P1: CTA selection is probabilistic, not tied to an editorial or visual beat

**Verified behavior.** In `editorial` mode, a seeded random draw decides whether a CTA appears; another selects type/template, duration, and a start time between the earliest and latest limits (`src/motion/ctaSelector.js:64`, `src/motion/ctaSelector.js:70`, `src/motion/ctaSelector.js:78`). The production call passes duration, seed, outro start, recent types, and language—but not scene boundaries, payoff time, edit plan, narration timings, visual focal data, or CTA intent (`src/pipeline/run.js:233`).

Retention QC evaluates the legacy editor-plan `subscribeScene`, not the Neo Motion CTA's actual `startSec` (`src/pipeline/retentionQC.js:253`). Thus a randomly timed Motion CTA can appear before payoff without that timing affecting the payoff score.

**Inferred viewer effect.** A well-animated card may interrupt a reveal, cover evidence during its only useful hold, or request “comment/save/follow” without relation to the story's value proposition. Polished movement then competes with understanding.

**Attention motion should guide.** CTA motion should occupy a verified low-information beat after delivered value, then direct attention to one relevant action. “Save” fits a reference-rich explainer; “comment” fits a genuine unresolved question; “follow” fits a clear series promise.

### MD-06 — P1: CTA safe-area logic is composition-blind in production

**Verified behavior.** `ctaSafeArea` can avoid a supplied face/main-subject bounding box (`src/motion/ctaSafeArea.js:36`). `applyCta` calls it with only requested position and card size (`src/motion/ctaEngine.js:47`). Documentation acknowledges there is no automatic face/subject detection in v1 (`docs/neo-motion-engine.md:97`). Caption, hook, bottom UI, and right-icon avoidance use fixed geometric zones (`src/motion/ctaSafeArea.js:36`).

**Consequence.** The CTA is protected from predictable interface zones but not from the actual subject, evidence, moving action, or generated text embedded elsewhere in a frame. The synthetic acceptance report's subject scenario does not prove production subject avoidance because current production metadata does not feed the subject box (`artifacts/motion/acceptance/acceptance-report.md:38`).

**Attention motion should guide.** Subject/evidence regions should be tracked across the CTA interval, and placement should choose a low-salience stable region. If no region remains, the CTA should be omitted.

### MD-07 — P1: Motion QC proves layer presence and technical safety, not motion quality or explanation

**Verified behavior.** CTA validation checks time bounds, safe-area existence, off-screen placement, and right-icon proximity (`src/motion/ctaValidator.js:12`). Post-render SSIM compares one frame at the CTA midpoint and treats a measurable difference as evidence that the layer exists (`src/motion/ctaValidator.js:39`). If SSIM cannot be measured, validation defaults to applied (`src/motion/ctaValidator.js:53`). Output verification checks CTA bbox, static avoid-zone overlap, language, and layer presence (`src/motion/ctaEngine.js:82`).

The acceptance report scores six synthetic backgrounds and explicitly says real NeoSaniye videos were unavailable (`artifacts/motion/acceptance/acceptance-report.md:3`). Its motion scores are documented judgments but not a coded measure of easing, focal guidance, obstruction over time, semantic timing, or phone-speed comprehension (`artifacts/motion/acceptance/acceptance-report.md:41`). General retention QC treats Ken Burns as static and rewards live-motion share, but does not assess where movement directs attention (`src/pipeline/retentionQC.js:140`).

**Consequence.** A CTA can be present, in bounds, and non-overlapping at its midpoint while entering over an important subject, crossing a caption at another instant, using weak easing, or interrupting the climax. Scene motion has no equivalent rendered QC at all.

**Information motion should reveal.** QC should verify the full motion interval, focal target retention, occlusion over time, intended state change, narration synchronization, and whether a viewer can correctly explain what the motion showed.

### MD-08 — P2: The first-scene punch and repeated pan cycle are decorative defaults

**Verified behavior.** The first item always receives a rapid additional zoom during roughly its first 0.3 seconds, then continues the standard movement (`src/video/renderVideo.js:311`). Animated visual style increases zoom maxima for every item (`src/video/renderVideo.js:307`). Long AI scenes are split into another same-prompt image partly on the rationale that the new plan index changes the Ken Burns direction (`src/media/generateImages.js:288`).

**Inferred viewer effect.** The hook punch can increase first-frame activity, but it is not connected to the hook's focal object or reveal and may add cognitive load when hook text is already moving. Alternating zoom direction makes a split feel different without guaranteeing new information; this is decorative variety rather than explanatory progression.

**Attention motion should guide.** The opening move should reveal the hook's exact anomaly—e.g., a controlled push to the unexpected object or a pullback that changes its meaning. A split should introduce a new evidence relationship, not merely reverse camera direction.

## Evidence table

| ID | Severity | Verified repository evidence | Motion-design judgment | Evidence status |
|---|---|---|---|---|
| MD-01 | P1 | Index-based zoom/pan arrays with no focal input (`src/video/renderVideo.js:299`, `src/video/renderVideo.js:305`) | Camera activity cannot reliably direct attention | Code verified; production perception untested |
| MD-02 | P1 | All media receives `zoompan`; gfx flag unused by normalizer (`src/video/renderVideo.js:325`, `src/pipeline/run.js:202`) | Native video and explanatory cards are treated as still illustrations | Verified |
| MD-03 | P1 | Prompt requests maps/arrows/callouts (`src/crew/visualDirector.js:146`); renderer reveals text steps (`src/media/renderTemplate.js:206`) | Explanatory animation vocabulary is missing | Verified repository gap |
| MD-04 | P1 | `motion` means stock footage and is not passed as a design plan (`src/crew/visualDirector.js:38`, `src/media/generateImages.js:209`) | Subject motion, camera motion, and information motion are conflated | Verified |
| MD-05 | P1 | CTA type/time are seeded random (`src/motion/ctaSelector.js:64`); production call has no story beat (`src/pipeline/run.js:233`) | CTA can interrupt instead of reinforce value delivery | Behavior verified; viewer effect inferred |
| MD-06 | P1 | Subject box is optional but not supplied (`src/motion/ctaSafeArea.js:48`, `src/motion/ctaEngine.js:55`) | CTA placement is UI-aware but composition-blind | Verified |
| MD-07 | P1 | Midpoint SSIM proves difference/presence (`src/motion/ctaValidator.js:45`); acceptance uses synthetic backgrounds (`artifacts/motion/acceptance/acceptance-report.md:3`) | QC does not prove explanatory or unobtrusive motion | Verified |
| MD-08 | P2 | Universal first-item punch and index-varied split rationale (`src/video/renderVideo.js:311`, `src/media/generateImages.js:288`) | Activity is substituted for a motivated reveal path | Behavior verified; viewer effect inferred |

## Top five creative or technical blockers

1. **P1 — No focal-point data reaches the camera path.** Pan/zoom direction follows item index rather than the visible subject or evidence (`src/video/renderVideo.js:305`).
2. **P1 — No explanatory animation grammar exists.** Maps, arrows, labels, timelines, cross-sections, comparisons, and tracked callouts exist in prompts but not rendering (`src/crew/visualDirector.js:161`, `src/media/renderTemplate.js:166`).
3. **P1 — Universal Ken Burns affects every source class.** Live footage and deliberately composed graphics receive the same reframing as still images (`src/video/renderVideo.js:325`).
4. **P1 — CTA timing and placement lack story/composition awareness.** Seeded timing ignores payoff/reveal beats, and subject avoidance is not wired (`src/motion/ctaSelector.js:78`, `src/motion/ctaEngine.js:55`).
5. **P1 — Motion QC checks technical presence, not attention or comprehension.** Synthetic acceptance and one midpoint SSIM sample cannot validate production motion behavior (`src/motion/ctaValidator.js:45`, `artifacts/motion/acceptance/acceptance-report.md:3`).

## Quick wins

- Exempt full-screen `gfx` from generic Ken Burns during editorial review; its internal animation and fixed layout should carry the scene.
- Treat live footage's native motion as primary and approve digital reframing only when it keeps a named subject visible.
- Add a manual focal-point note to every static shot: start region, end region, and the fact the move reveals. If that sentence is empty, hold the frame rather than moving it decoratively.
- Reclassify the current “diagram” as a sequential steps card; do not count it as an arrow/map/cross-section/comparison.
- Manually verify Motion CTA timing against the actual payoff/reveal before publication; omit it when it overlaps the only evidence shot.
- Review the entire CTA interval, not only its midpoint, on a phone-sized proxy.
- Stop treating a reversed pan/zoom on a same-prompt image as a new explanatory event.

## Structural improvements

1. **Focal-aware camera plan.** Carry normalized start/end focal coordinates, protected regions, and motion purpose from scene planning to rendering. Acceptance criterion: the named subject stays visible and ends at the intended attention point throughout the move.
2. **Source-specific motion policy.** Separate still reframing, native video, graphic animation, and tracked overlays. Acceptance criterion: gfx is not globally zoomed; live video is not digitally moved without an explicit reason.
3. **Explanatory motion primitives.** Implement route/map trace, labeled callout, timeline progression, before/after wipe, cross-section reveal, scale comparison, and causal-arrow sequence. Acceptance criterion: each primitive answers a specific spatial, temporal, causal, or quantitative question.
4. **Beat-aware CTA planner.** Consume narration/scene timings, payoff status, CTA intent, and low-information windows. Acceptance criterion: actual Motion CTA start is after delivered value and does not overlap reveal/climax/evidence.
5. **Dynamic occlusion model.** Track subject/evidence and caption boxes across the CTA interval. Acceptance criterion: no overlap in sampled frames throughout entry, hold, and exit; omit when no stable region exists.
6. **Motion-quality QC.** Preserve a review proxy and motion plan; measure focal retention, path completion, overlay occlusion, semantic synchronization, and comprehension. Acceptance criterion: a reviewer can state what every explanatory move taught.

## Experiments to run

1. **Generic versus focal-aware Ken Burns:** use the same still and narration; compare index motion with a path from context to the exact evidence detail.
2. **Hold versus decorative movement:** test a stable evidence frame against a generic pan to determine whether motion helps or harms comprehension.
3. **Steps card versus causal diagram:** for animal magnetism, compare numbered phrases with animated light → electron pair → field direction → bird response.
4. **Honeycomb comparison animation:** compare AI macro zooms with a registered circle-to-hex overlay/cross-section showing wall change.
5. **Random versus beat-aware CTA:** hold template constant and move it from seeded random time to a verified post-payoff low-information beat.
6. **CTA subject tracking:** compare static lower-third placement with dynamic selection using subject/evidence boxes across the full interval.

These experiments are proposed only; none were run during this read-only audit.

## Metrics that would validate improvement

- Focal-target retention: percentage of frames where the intended subject/evidence remains inside its protected region.
- Camera-path usefulness: blinded viewers correctly identify what the move directed them to.
- Explanatory comprehension: viewers correctly describe the mechanism, route, comparison, or state change after one view.
- Decorative-motion rate: percentage of moving scenes with no documented information/attention purpose; target downward.
- Repetitive-path rate: repeated zoom direction/pan vector across consecutive scenes.
- Gfx reframing violations and live-footage digital-motion violations per video.
- CTA overlap rate across all entry/hold/exit frames, including subject, evidence, captions, hook, and platform UI.
- CTA post-payoff placement rate based on actual rendered seconds, not legacy scene index.
- Retention and rewatch around explanatory animations versus decorative Ken Burns scenes.
- Human synthetic-feel and visual-understanding ratings on production review renders.

## Risks and regressions

- Focal tracking can follow the wrong object; every automatically detected target needs confidence and fallback-to-hold behavior.
- Removing generic movement can expose weak still selection. Do not restore decorative motion to disguise an uninformative image.
- Explanatory graphics can overload a phone screen; reveal only the currently narrated relation and test at rendered size.
- Dynamic CTA movement may itself distract. Prefer a stable safe region and minimal entry/exit once chosen.
- More motion primitives increase synchronization and QC complexity; each needs deterministic fixtures and an authoritative narration anchor.
- A before/after wipe can falsely imply causation if source states are not comparable. Fact/provenance review remains necessary.
- Focal-aware crops may remove context needed later in a sentence; plan start and end states against the whole narration beat.
- Motion improvements should not become a quota. A purposeful still hold can be stronger than constant movement.

## Final P0/P1/P2/P3 list

### P0

- None verified.

### P1

- **MD-01:** Camera movement is driven by item index and fixed pan arrays, with no focal subject or evidence target (`src/video/renderVideo.js:305`).
- **MD-02:** Photos, live video, and full-screen graphics all receive the same generic zoompan chain (`src/video/renderVideo.js:325`).
- **MD-03:** Promised maps, arrows, labels, timelines, comparisons, and mechanism animations are not implemented; the “diagram” is text-step disclosure (`src/crew/visualDirector.js:161`, `src/media/renderTemplate.js:206`).
- **MD-04:** The shot-list `motion` field controls stock retrieval rather than an explanatory/camera motion plan (`src/crew/visualDirector.js:38`, `src/media/generateImages.js:209`).
- **MD-05:** Motion CTA selection and timing are seeded random rather than payoff/beat-aware, and actual timing is not assessed by payoff QC (`src/motion/ctaSelector.js:64`, `src/pipeline/retentionQC.js:253`).
- **MD-06:** Production CTA placement does not receive subject/evidence boxes (`src/motion/ctaEngine.js:55`).
- **MD-07:** Motion QC verifies technical presence and static safety, not focal guidance, explanatory success, or production-content flow (`src/motion/ctaValidator.js:45`).

### P2

- **MD-08:** Universal opening punch and cyclic pan reversal create decorative variety without a verified information purpose (`src/video/renderVideo.js:311`).

### P3

- No independent polish item should precede focal tracking, explanatory primitives, and production motion review.

## “No files were modified” confirmation

No application code, production configuration, prompt, media asset, generated output, or existing repository file was modified. The only file created is this audit report: `reports/2026-07-21/07-motion-design-director.md`. No dependency was installed, no render/publish/upload command was run, and no commit or push was performed.
