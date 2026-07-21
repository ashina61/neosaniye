# 03 — Hook Director Audit Report

**Audit date:** 2026-07-21  
**Repository revision:** not recorded  
**Scope inspected:** full repository from the perspective of first-second retention, with emphasis on hook generation/prompts, `hook_text`, first narration, first visual/media path, first subtitle, voice onset, first sound, first animation, first transition, first-three-second pacing, QC, analytics, persisted productions, tests, and available artifacts  
**Evidence limitations:** no representative finished production MP4 or `preview-hook.jpg` is present locally under `output/`; FFmpeg/ffprobe is unavailable in this environment; available videos/contact sheets are synthetic regression or component fixtures. Therefore exact frame-zero composition, real first-subtitle timing, TTS delivery, mix quality, and first-three-second perceptual load cannot be verified by playback.

## Executive verdict

NeoSaniye has the pieces of a strong opening—short cover text, immediate narration, a literal first-scene image prompt, a high-contrast animated hook overlay, speech-synchronized captions, a fast opening zoom, music, and a designed payoff—but the repository does not assemble or validate them as one unified scroll-stopping event.

The core defect is orchestration, not the absence of hook features. `hook_text`, first narration, and first visual are produced in the same script response, but the winning hook is selected only from the language model’s own numeric scores. Downstream QC then awards up to 25 points from presence, character/word counts, simple phrase regexes, and first-word timing. It never tests whether the overlay, spoken sentence, literal first visual, subtitle, first movement, and sound all make the same promise. Recent persisted productions demonstrate the consequence: all four receive `hookScore:25`, although at least one opening pairs “EUROPE'S FATE: ONE QUAKE” with a calm Lisbon-festivities sentence and image, delaying the promised quake beyond the first beat.

At frame zero, the expected stack is already cognitively dense: branded logo, moving full-frame image, a large uppercase hook card fading/moving into position, possibly the first speech-derived subtitle, narration, music, and ambience. Yet the first purpose-built SFX cannot occur at time zero because the edit schema schedules sound only on boundaries between scenes. The first transition is likewise determined by the end of the word-weighted first scene, not by a first-three-second hook design. The system can therefore produce an attractive opening, but it cannot currently prove that the opening is singular, immediate, and multimodally aligned.

## Verified findings

### HD-01 — P1 — Hook selection is self-scored copy selection, not multimodal opening selection

**Verified facts.** The schema requests exactly six hook candidates with different verbal angles and asks the same model to assign each a 1–100 “scroll-stop” score (`src/script/generateScript.js:35-49`). Generation then filters candidates only by 6–30 characters and chooses the highest model-provided score (`src/script/generateScript.js:466-479`). The candidate objects contain only `text` and `score`; they do not contain or score a paired first narration, first visual, first subtitle phrase, voice delivery, sound cue, animation, or payoff (`src/script/generateScript.js:35-49`). The first narration and `image_prompt` are separate scene fields (`src/script/generateScript.js:71-95`).

**Inference.** The winning cover line may be the best standalone phrase but not the best combined first second. Because candidate scores come from the generating model rather than audience outcomes or an independent rubric, the number is an internal preference, not evidence of scroll-stop performance.

**Recommendation for a future implementation task.** Evaluate hook packages, not hook strings: candidate overlay + first spoken sentence + first visual concept + first caption phrase + opening audio/motion plan + promised payoff.

**Owner:** Hook Director + Script/Prompt owner.  
**Dependency:** representative rendered openings and real first-second/three-second metrics.  
**Acceptance criteria:** each candidate package has one explicit promise; overlay/narration/visual/payoff alignment is scored independently of model self-score; a candidate fails if any modality opens a different question; selection rationale is persisted for review.

### HD-02 — P1 — Full hook scores do not establish multimodal alignment or first-three-second strength

**Verified facts.** Hook QC checks `hook_text` presence, character count, weak phrase regexes across overlay/first narration, promise-word regexes, hook word count, modeled overlay readability, and first-word start time (`src/pipeline/retentionQC.js:107-138`). It does not compare the semantic content of the overlay with the first narration or first visual, does not inspect first subtitle text, does not require a first sound/animation, and does not measure first-shot duration or event density within 0–3 seconds. Visual pacing is calculated from whole-video duration divided by total plan count plus whole-video longest static segment and source mix (`src/pipeline/retentionQC.js:68-80`, `src/pipeline/retentionQC.js:140-159`).

All four recent QC-history entries have `hookScore:25` despite overall scores of 81–85 (`data/qc-history.jsonl:1-4`). One persisted example has overlay “Europe's Fate: One Quake,” while its first narration describes Lisbon preparing for festivities and its first image is a bright, bustling city; the quake is introduced only in scene two (`data/videos.json:4874-4887`). Another overlays “Animals see Earth's magnetism?” while the first spoken question asks how birds navigate and the first image shows a robin flying over an ocean with an added field pattern (`data/videos.json:4506-4519`).

**Inference.** A full 25 is currently a structural-compliance score, not proof that the first second communicates one idea. The Lisbon opening in particular risks making the cover, speech, and picture compete: catastrophe promise versus calm historical setup.

**Recommendation for a future implementation task.** Add an opening-specific gate that evaluates the actual 0.0, 0.5, 1.0, and 3.0-second states as a sequence and checks cross-modal promise agreement.

**Owner:** Hook Director + Editorial QC Director.  
**Dependency:** rendered hook frames/audio and timestamps saved with each production.  
**Acceptance criteria:** a full hook result requires overlay/narration/visual/subtitle/audio agreement; first-shot/event timing is evaluated specifically within 0–3 seconds; known mismatched fixtures score lower than aligned fixtures; internal score is labeled separately from platform retention.

### HD-03 — P1 — The production audio path has no dedicated first-second hook sound event

**Verified facts.** The editor prompt says meaningful SFX may land on “hook entry,” but the edit schema defines effects only for boundaries **between** scenes (`src/crew/editorDirector.js:32-50`, `src/crew/editorDirector.js:71-86`). Rendering constructs the SFX plan from boundaries `k=1..N-1` and schedules each at the corresponding boundary offset (`src/video/renderVideo.js:577-589`, `src/video/renderVideo.js:658-665`). Thus no normal edit-plan field can request an SFX at time zero. The first audio bed consists of narration, music, and optional ambience; ambience fades in over 1.5 seconds (`src/video/renderVideo.js:622-655`). The synthetic bee regression includes a hook cue at 0.4 seconds (`artifacts/regression/bee-before-after.md:18-26`), but that artifact explicitly describes synthetic content rather than a representative production (`artifacts/regression/bee-before-after.md:1-5`).

**Inference.** A real production may begin audibly with voice and music, but there is no repository-grounded guarantee of a purposeful sound accent aligned to the overlay’s entry or the opening zoom. The editor prompt promises a capability the schema cannot express.

**Recommendation for a future implementation task.** Introduce an explicit, optional opening audio decision tied to a semantic hook beat, including silence as a valid deliberate choice.

**Owner:** Hook Director + Sound Design Director.  
**Dependency:** output-level audibility verification and phone-speaker review.  
**Acceptance criteria:** the opening plan records `sound at`, purpose, and expected relation to voice/overlay/motion; time-zero silence is explicit rather than accidental; any cue is verified in the final mix and does not mask the first word.

### HD-04 — P1 — The first narration can be long or weak while the overlay still receives a maximum hook score

**Verified facts.** The prompt requests each narration sentence at roughly 10–16 words and says scene one should open a necessary curiosity gap (`src/script/generateScript.js:209-225`). Documentation claims hook scoring includes a first sentence of 16 words or fewer (`docs/retention-qc.md:101-106`), but the current implementation does not count first-narration words in the hook section (`src/pipeline/retentionQC.js:107-138`). It checks only weak-start regexes and whether either overlay or narration contains a promise token. Persisted openings include 15 words before punctuation for Lisbon’s calm setup (`data/videos.json:4881-4887`), approximately 17 words for the honeycomb opening (`data/videos.json:4674-4683`), and approximately 17 words for the animals/magnetism question (`data/videos.json:4510-4519`); their latest QC history still records full hook scores for the corresponding productions (`data/qc-history.jsonl:2-4`). An older geyser record begins “Have you ever wondered…,” a weak construction explicitly targeted by QC, while its overlay is strong (`data/videos.json:3148-3153`).

**Inference.** A compact overlay can mask a slow or generic spoken launch in scoring. Within three seconds, long first sentences may still be setting up the question while the overlay has already promised the answer domain.

**Recommendation for a future implementation task.** Judge the first spoken clause—what is understood by one and three seconds—not merely total sentence form or overlay quality.

**Owner:** Hook Director + TTS/Voice Director.  
**Dependency:** actual word timestamps and rendered first-three-second previews.  
**Acceptance criteria:** first-clause meaning is intelligible by the three-second mark; weak prefatory phrases cannot be rescued solely by a strong overlay; documentation and implemented checks agree; known long/weak fixtures fail the intended rule.

### HD-05 — P2 — The visual opening is intentionally active, but not focal-point-aware or promise-validated

**Verified facts.** The DP normally forbids motion in scene one because it carries the hook cover (`src/crew/visualDirector.js:126-131`, `src/crew/visualDirector.js:219-227`). Media generation also excludes ordinary first-scene motion, but process videos are an exception and try stock video for every scene, including the first (`src/media/generateImages.js:135-145`, `src/media/generateImages.js:209-234`). For stills, normalization applies a first-scene zoom punch during roughly the first 0.3 seconds plus deterministic panning (`src/video/renderVideo.js:296-335`). The motion is based on plan index, not a detected subject/focal point. Scene-one graphics/stat diagrams are disallowed (`src/media/generateImages.js:169-195`).

**Inference.** The opening will rarely be truly static, which is helpful, but the same generic punch can enlarge empty space, move the subject behind text, or animate a visual that does not prove the hook. Process and non-process formats also have materially different first-motion policies without an opening-specific rationale.

**Recommendation for a future implementation task.** Make the first motion subordinate to the hook’s focal subject and evidence, and record whether the opening is a still punch, live action, or deliberate hold.

**Owner:** Hook Director + Visual/Motion Directors.  
**Dependency:** focal-point metadata or rendered-frame review.  
**Acceptance criteria:** first movement preserves subject visibility and hook readability at 0.0/0.5/1.0 seconds; it reinforces the promise rather than adding generic motion; process/non-process differences are justified by evidence.

### HD-06 — P2 — Frame-zero text hierarchy risks simultaneous overlay/subtitle/logo load

**Verified facts.** The hook overlay begins at 0.00 and remains for the configured hook duration; it uses uppercase Montserrat Black, a semi-opaque box, fade, blur reduction, scale, and vertical movement (`src/video/renderVideo.js:124-148`). Captions are created from the same word-timing stream and begin at the first word’s timestamp (`src/video/renderVideo.js:175-210`). The final video also receives a logo at the upper left before subtitles/hook are applied (`src/video/renderVideo.js:989-1002`, `src/video/renderVideo.js:1061-1069`). Config defaults the overlay to 2.8 seconds and captions to short three-word groups (`src/config.js:182-210`). QC models hook font size and caption layout independently rather than their combined frame composition (`src/video/readability.js:20-50`, `src/pipeline/retentionQC.js:178-207`).

**Inference.** Once speech begins, a viewer may simultaneously process brand mark, large cover statement, different lower caption words, moving image, and voice. Even if each layer is individually readable, their combined cognitive load may split attention, especially when overlay and narration phrase different promises.

**Recommendation for a future implementation task.** Define an explicit first-three-second hierarchy and test the combined rendered frame rather than separate mathematical readability models.

**Owner:** Hook Director + Caption/Typography Director.  
**Dependency:** frame grabs and phone-size review.  
**Acceptance criteria:** at every sampled opening frame there is one dominant verbal message; subtitle behavior during the hook is intentional; overlay, caption, and logo do not compete for first fixation; phone reviewers can repeat the promise after one viewing.

### HD-07 — P2 — First transition timing is derived from narration weight, not designed as part of the hook

**Verified facts.** Pipeline scene durations are proportional to narration word count (`src/pipeline/run.js:144-170`). The render distributes narration duration across those weights and gives clips a minimum duration (`src/video/renderVideo.js:820-845`). The first transition type/SFX is then taken from the first scene boundary or a mechanical fallback (`src/video/renderVideo.js:764-816`), and it occurs only when the weighted first clip ends. QC evaluates average event interval across the full video, not whether the first transition lands before or at three seconds (`src/pipeline/retentionQC.js:68-80`, `src/pipeline/retentionQC.js:140-159`).

**Inference.** A wordy opening can delay the first genuine visual change beyond the first three seconds even though the whole video passes average pacing checks. The zoom punch is movement, but it is not a new piece of evidence or a first transition.

**Recommendation for a future implementation task.** Treat 0–3 seconds as its own editorial unit with a purposeful evidence beat or deliberate single-shot rationale.

**Owner:** Hook Director + Film Editor.  
**Dependency:** exact opening timestamps and rendered review.  
**Acceptance criteria:** first-three-second plan explicitly states first evidence event and first transition time; average whole-video pacing cannot hide a slow opening; aligned single-shot openings may pass only with documented visual progression.

### HD-08 — P2 — The repository lacks real first-second and first-three-second outcome data

**Verified facts.** Experiment metrics include `viewedVsSwipedAwayRatio`, average view duration, and average percentage viewed, but the collector currently returns null fields (`src/analytics/experimentMetrics.js:1-35`). The connected analytics updater requests only average view percentage and subscribers gained, not first-second or first-three-second retention (`src/youtube/engage.js:57-84`). Persisted QC history stores an internal `hookScore`, not platform opening-retention curves (`data/qc-history.jsonl:1-4`).

**Inference.** The labels “proven hooks” and numeric candidate/quality scores cannot currently be validated against the requested retention moments. Raw views can be heavily confounded by distribution and topic.

**Recommendation for a future implementation task.** Collect and version actual opening metrics or, if unavailable from APIs, establish a manual Studio export/review protocol.

**Owner:** Hook Director + YouTube Analytics Director.  
**Dependency:** YouTube analytics availability and stable observation windows.  
**Acceptance criteria:** each hook experiment records viewed/swiped, one-second and three-second retention when available, sample size, age, traffic context, and topic/format; internal scores are never labeled audience proof.

## Evidence table

| ID | Verified fact | Evidence (`path:line`) | Confidence | Assumption/unknown |
| --- | --- | --- | --- | --- |
| H-01 | Six text candidates are self-scored by the generating model. | `src/script/generateScript.js:35-49` | High | Correlation between those scores and real scroll-stop behavior is unknown. |
| H-02 | Highest valid candidate is selected using only text length and model score. | `src/script/generateScript.js:466-479` | High | Whether live environment receives exactly six valid candidates is unknown. |
| H-03 | Hook overlay starts at 0.00 with animated uppercase boxed text. | `src/video/renderVideo.js:124-148` | High | Actual libass/font rendering is unavailable locally. |
| H-04 | First subtitles start from TTS-derived first-word timings. | `src/video/renderVideo.js:175-210`; `src/tts/generateAudio.js:17-35` | High | Exact first timestamp and phrase are absent from persisted records. |
| H-05 | Edge SRT sentence cues are proportionally split into estimated word times. | `src/tts/edgeTts.js:17-62` | High | Word-level caption accuracy against audio was not auditioned. |
| H-06 | Normal production SFX can only be placed at scene boundaries. | `src/crew/editorDirector.js:32-50`; `src/video/renderVideo.js:577-589` | High | Music itself may contain an opening hit, but it is not planned or verified. |
| H-07 | Still openings receive a generic first-scene zoom punch. | `src/video/renderVideo.js:296-335` | High | Its interaction with the actual focal subject is unknown. |
| H-08 | Process mode may use live stock for scene one while other formats usually do not. | `src/media/generateImages.js:135-145`; `src/media/generateImages.js:209-234` | High | Actual source choice varies with keys and asset availability. |
| H-09 | Hook QC does not test multimodal semantic alignment. | `src/pipeline/retentionQC.js:107-138` | High | No separate hidden validation path was found. |
| H-10 | Whole-video average pacing is used instead of an opening window. | `src/pipeline/retentionQC.js:68-80`; `src/pipeline/retentionQC.js:140-159` | High | Actual first-transition times are not persisted. |
| H-11 | Recent Lisbon cover/speech/visual communicate different immediate states. | `data/videos.json:4874-4887` | High | Viewer response cannot be inferred without playback/analytics. |
| H-12 | Four recent productions all received full hook score. | `data/qc-history.jsonl:1-4` | High | Score configuration overrides in the live runner are unknown. |
| H-13 | Real opening-retention metrics are null/uncollected in the experiment adapter. | `src/analytics/experimentMetrics.js:1-35` | High | External Studio may contain data not represented in-repo. |
| H-14 | Available 0.4-second hook-sound evidence is synthetic. | `artifacts/regression/bee-before-after.md:1-5`; `artifacts/regression/bee-before-after.md:18-26` | High | It proves a fixture, not normal production scheduling. |

## Top five creative or technical blockers

1. **P1 — No unified hook-package selection:** the winning `hook_text` is selected independently of narration, visual, subtitle, sound, movement, and payoff.
2. **P1 — Hook QC can award 25/25 to misaligned openings:** it measures structural proxies rather than the combined first-second experience.
3. **P1 — No expressible production hook cue at time zero:** SFX scheduling begins at the first scene boundary despite prompt language about hook entry.
4. **P1 — Spoken openings can remain long/generic behind a strong cover:** current implementation does not enforce the documented first-sentence-length rule or first-clause payoff.
5. **P2 — No representative rendered opening or true first-second/three-second retention data:** creative and analytic validation are both incomplete.

## Quick wins

- In a future report/schema task, persist the first 3 seconds as a compact plan: overlay, first clause, first visual proof, first caption, motion, sound, and first transition timestamp.
- Add explicit “overlay says / voice says / image proves” fields to hook review; acceptance: a reviewer can see mismatches without opening source code.
- Store generated `preview-hook.jpg` references and extraction success in production records; the pipeline already attempts a 0.5-second frame (`src/pipeline/run.js:471-529`).
- Reconcile documentation with implementation for first-sentence length; acceptance: the documented hook rubric and tested code describe the same checks.
- Label `hookScore` as an internal heuristic in reports; acceptance: it is never presented as first-second retention.

## Structural improvements

1. **Create a multimodal Hook Contract.** One machine-readable object should define the single opening promise, cover text, spoken first clause, visual proof, subtitle treatment, motion, sound, first evidence event, and payoff linkage.
2. **Render-gate the opening window.** Sample final output at 0.0/0.5/1.0/3.0 seconds and inspect combined layers plus audio—not component formulas in isolation.
3. **Give opening audio its own timeline decision.** Hook sound, deliberate silence, music attack, and first-word priority need a time-zero-capable representation.
4. **Separate first-window pacing from whole-video pacing.** Record the first shot duration, first meaningful visual change, first transition, and information delivered by three seconds.
5. **Calibrate against real behavior.** Compare hook packages and internal assessments with viewed/swiped, one-second, three-second, and downstream payoff metrics using controlled samples.

## Experiments to run

| Hypothesis | Change | Control | Sample/window | Guardrail | Decision rule |
| --- | --- | --- | --- | --- | --- |
| Exact overlay/voice/visual agreement reduces first-second loss. | Same promise expressed by all three modalities. | Current independently phrased opening. | Minimum 10 matched topic/format pairs or clearly labeled exploratory pilot. | Same slot, duration band, voice, and production quality. | Adopt if viewed rate and 3-second retention improve without lowering completion/payoff satisfaction. |
| A direct first clause beats prefatory questions. | Begin with the contradiction/result in ≤8 spoken words. | “Have you ever wondered…”/historical setup opening. | 20 comparable episodes across formats. | No misleading claim; payoff must satisfy wording. | Prefer direct clause if 1s/3s retention improves and corrections/negative feedback do not rise. |
| Delaying the first subtitle reduces overload when overlay is present. | Suppress/rephrase caption during the cover window, or make it identical to the overlay. | Simultaneous distinct overlay and speech caption. | 10 matched pairs. | Accessibility preserved after cover window; voice remains clear. | Adopt only if mobile recall and 3-second retention improve without comprehension loss. |
| A purposeful 0.2–0.5s hook accent improves stopping power. | Add verified semantic cue or deliberate micro-silence/music hit. | Voice+music bed without dedicated cue. | 15 matched openings. | Cue must not mask first phoneme or clip on phone speakers. | Keep only if viewed/3s retention and human quality ratings improve. |
| Focal-aware motion beats generic zoom punch. | Move toward the proof subject/reveal detail. | Current index-based zoom/pan. | 10 still-led openings. | Hook text remains readable; no face/object cropping. | Adopt if subject recognition, coherence rating, and 3-second retention improve. |
| First evidence by 2.5s beats extended setup. | Introduce the contradiction/proof before first transition. | Word-weighted first scene without opening deadline. | 20 episodes. | No incomprehensible jump or factual overclaim. | Adopt if 3-second retention rises without reducing completion or payoff clarity. |

## Metrics that would validate improvement

- Viewed versus swiped away, from a real platform source and fixed observation window.
- Retention at 1.0 and 3.0 seconds; if unavailable by API, use documented Studio exports rather than internal estimates.
- First-frame-to-first-word delay and first-word audibility in the final mix.
- Time to first meaningful visual evidence and first transition, not merely motion onset.
- Mobile one-view promise recall: viewer can state what will be answered after seeing only three seconds.
- Cross-modal agreement rating for overlay, spoken clause, visual, subtitle, sound, and payoff.
- Hook-to-payoff satisfaction and completion rate, guarding against strong-but-misleading openings.
- Negative feedback/correction signals for sensational or inaccurate hooks.
- Sample count, topic, format, slot, video age, and traffic source to control confounding.

No target uplift is asserted because the repository currently exposes no real 1-second or 3-second baseline (`src/analytics/experimentMetrics.js:1-35`).

## Risks and regressions

- Forcing literal repetition across overlay, voice, and subtitle could feel redundant; semantic unity need not mean identical wording.
- Suppressing early captions may reduce accessibility; test identical/simplified captions before removal.
- A loud time-zero SFX can mask the first word or feel synthetic; silence must remain a valid planned option.
- An aggressive direct claim can improve stopping while damaging trust if the payoff hedges or contradicts it.
- Hard first-transition deadlines can create meaningless cuts; require new evidence, not movement by count.
- Focal-aware movement can crop context or induce motion discomfort; retain safe-area and phone review.
- Optimizing only 1s/3s retention can produce bait-and-switch hooks; completion, payoff satisfaction, and negative feedback are required guardrails.
- Small samples and topic/slot differences can falsely crown a hook style; use matched cohorts and disclose uncertainty.
- A multimodal gate may slow throughput; begin with review logging and known mismatch fixtures before blocking production.

## Final P0/P1/P2/P3 list

- **P0:** None verified in this hook-only audit.
- **P1:** HD-01 hook selection is text-only/model-self-scored; HD-02 maximum hook score does not verify multimodal alignment or opening pacing; HD-03 no dedicated time-zero hook sound exists in normal production planning; HD-04 weak/long first narration can be masked by strong overlay scoring.
- **P2:** HD-05 first motion is active but not focal/promise-aware; HD-06 combined frame-zero text hierarchy is unvalidated; HD-07 first transition is word-weight-derived rather than hook-designed; HD-08 real opening retention and representative rendered evidence are absent.
- **P3:** Clarify hook-score labeling, align documentation with implemented rules, and index generated hook-preview artifacts.

## “No files were modified” confirmation

No files were modified.
