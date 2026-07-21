# Editorial QC Director Audit — 2026-07-21

## Audit basis and evidence classes

This is a read-only audit of the repository's editorial and technical QC, report generation, failure policy, rendered-output verification, tests, and retained artifacts. No production code, configuration, thresholds, or outputs were changed.

Evidence is classified as follows:

- **Rendered measurement:** derived from the final MP4's decoded pixels, streams, or mixed audio.
- **Manifest/config compliance:** derived from script fields, media labels, edit-plan metadata, layout math, or configured thresholds—not direct observation of the rendered experience.
- **Internal proxy:** a deterministic feature intended to approximate viewer/editor judgment without viewer or human ground truth.
- **Human/editor ground truth:** an explicit watch-through judgment against a rubric. None was found for current production videos.
- **Platform ground truth:** real viewer outcome data calibrated against QC. The repository states this relationship is future work (`src/pipeline/qcHistory.js:5-10`; `docs/retention-qc.md:187-189`).

## QC and publication path

1. The complete video and optional CTA are rendered before QC begins (`src/pipeline/run.js:240-263`). There is no equivalent early editorial rejection before TTS, media generation, and rendering.
2. Technical preflight decodes the final MP4 and checks file size, duration, streams, resolution, A/V duration, black/freeze/silence events, peak, and loudness (`src/pipeline/preflight.js:60-205`).
3. Output verification measures final-mix energy around declared SFX cues and validates CTA metadata/bounding-box geometry, language, and declared avoid zones (`src/pipeline/outputVerify.js:8-35`, `src/pipeline/outputVerify.js:63-142`, `src/pipeline/outputVerify.js:144-203`).
4. The hard gate blocks defined CTA, SFX, music-pool, and channel-layout failures regardless of warning-mode override (`src/pipeline/hardGate.js:1-19`, `src/pipeline/hardGate.js:32-78`).
5. Retention QC calculates a 100-point editorial proxy from script text, word timing, media types/sources, edit plan, estimated item durations, semantic keyword overlap, and technical metrics (`src/pipeline/retentionQC.js:15-30`, `src/pipeline/retentionQC.js:45-66`).
6. `editorialReady` requires score ≥85 and no editorial failures, but default `warning` mode still allows upload when that condition is false (`src/config.js:69-81`; `src/pipeline/retentionQC.js:468-480`).
7. A production report and append-only QC history retain proxy scores and policy decisions (`src/pipeline/retentionQC.js:511-544`; `src/pipeline/qcHistory.js:25-61`). Preview stills are generated only after the upload decision block and are not evaluated (`src/pipeline/run.js:406-423`, `src/pipeline/run.js:520-528`).

## Executive verdict

The QC system is materially better at preventing corrupt or configuration-contradictory output than at predicting a human editor's approval. It has a credible technical safety core: full decode, stream and format checks, final-file loudness/silence/black-frame measurements, CTA geometry/language gates, and final-mix SFX energy checks. QC exceptions fail closed in active modes, and hard-gate failures cannot be overridden by editorial warning mode.

The editorial layer, however, mostly validates internal production assumptions. Hook quality is inferred from length and trigger words; curiosity from scene count and conjunctions; payoff from the existence of `finale_text`, tail duration, and CTA timing; meaningful visual events from source/type changes; visual quality from source labels and keyword overlap; attention from the same features used to score the video. It does not watch the rendered sequence, compare the shown pixels with narration, hear whether audio is appropriate, detect contradictory or malformed imagery, or judge synthetic feel.

Predictive validity is unestablished. The strongest evidence is actually contrary: a test fixture with generic repeated narration—`Detail … but the truth turns out stranger until revealed` in all seven scenes—no relevance measurements, and mechanically favorable metadata is required to score at least 90 (`test/editorCritique.test.js:126-149`). That demonstrates conformance to proxy rules, not a compelling Short. QC history contains only four recent internal-score records and no joined viewer outcomes or human approvals (`data/qc-history.jsonl:1-4`).

Publication policy widens the gap. Default `warning` mode explicitly permits videos that are not editorial-ready to upload; three of four retained QC-history records show `editorialReady:false`, `productionReady:false`, and `policyOverride:true` (`data/qc-history.jsonl:1-3`). Therefore the system's current operational contract is: technical/hard-gate safety is enforceable, editorial quality is advisory. Verdict: **P1 editorial-validity and publishing-gate problem; strong technical compliance is not evidence of viewer quality.**

## Verified findings

### EQC-01 — P1 — The editorial score is uncalibrated against human approval or viewer behavior

**Signal.** A deterministic 100-point sum covers hook, visual pacing, curiosity, captions, visual variety, audio design, and payoff/loop (`src/pipeline/retentionQC.js:267-276`). The editor critique maps ≥90 to “low” overall retention risk and ≥80 to “medium” (`src/pipeline/editorCritique.js:85-96`).

**Ground truth.** None is attached. QC history deliberately accumulates data “before” establishing the score-to-real-view relationship (`src/pipeline/qcHistory.js:5-10`), and documentation says the analyst will connect score and actual views later (`docs/retention-qc.md:187-189`). No human watch-through verdict, inter-rater result, or platform-retention calibration was found.

**Failure mode.** The score and “swipe risk” labels can be read as measured audience predictions even though they are weighted policy choices.

**False-positive/negative risk.** A metadata-compliant but dull video can pass; an unusual but effective edit can be penalized for breaking thresholds. Both rates are unknown because no labeled validation set exists.

### EQC-02 — P1 — The test suite codifies a clear editorial false pass

**Signal.** The “strong” fixture repeats variants of the same generic line across seven scenes, deliberately includes the scoring keywords `but`, `turns out`, and `until`, provides favorable source/type/SFX metadata, and supplies an empty relevance array (`test/editorCritique.test.js:126-145`). The test requires this fixture to score ≥90 and have no improvement plan (`test/editorCritique.test.js:146-149`).

**Ground truth.** No human editor approves the sequence; its language is visibly repetitive and nonspecific in the fixture itself.

**Failure mode.** Lexical tokens, counts, and manifest diversity satisfy the scoring rules regardless of actual informativeness, originality, visual truth, or emotional progression.

**False-positive risk.** Verified by construction: a generic, repeated template is designated high quality. This is the strongest evidence that QC validates its own assumptions.

### EQC-03 — P1 — Hook scoring validates form, not the unified rendered opening

**Signal.** Hook points come from field presence, character/word limits, absence of weak regexes, presence of promise regexes, layout math, and first timestamp (`src/pipeline/retentionQC.js:107-138`).

**Ground truth.** There is no rendered first-frame semantic review, audible first-line assessment, subtitle/frame/SFX alignment judgment, or viewer stop rate.

**Failure mode.** A hook containing a number, question mark, “secret,” or “impossible” can score while the first image contradicts it or the opening feels overloaded. The first speech timestamp itself may be approximate depending on TTS alignment, but QC treats it as an observed onset.

**False-negative risk.** A quiet, visually undeniable opening without regex trigger language can lose points despite working for viewers.

### EQC-04 — P1 — Story scoring is circular with prompt-enforced structure and rewards lexical markers

**Signal.** Curiosity points reward 6–10 scenes, two or more twist words, no >1.5-second word gaps, mechanism metadata, and absence of a narrow absolute-language regex (`src/pipeline/retentionQC.js:160-176`). The script prompt already requires 8–11 scenes in a fixed question→mystery→evidence→reveal→twist→answer→payoff→loop arc and tells the model to vary beats (`src/script/generateScript.js:209-224`).

**Ground truth.** No moment-by-moment human question tracking, information novelty check, reveal comprehension, or payoff satisfaction is observed.

**Failure mode.** QC rewards the generator for emitting the schema it was prompted to emit. Words such as “but” and “then” count as twists even when no new causal or emotional turn occurs.

**False-positive risk.** High, demonstrated by EQC-02. **False-negative risk:** a coherent story can turn without the listed conjunctions.

### EQC-05 — P1 — Payoff and loop scoring can pass without a meaningful payoff or closed loop

**Signal.** Four points are granted for any nonempty `finale_text`, three for a short configured tail, and three for late/absent CTA (`src/pipeline/retentionQC.js:247-257`). Loop closure is a shared-keyword test; if false it adds a recommendation but does not remove payoff points (`src/pipeline/retentionQC.js:95-98`, `src/pipeline/retentionQC.js:258-260`).

**Ground truth.** The system does not determine whether the narration actually answers the opening promise or whether the final rendered beat lands emotionally.

**Failure mode.** A generic finale with one repeated hook noun can appear “closed”; a wholly unrelated finale can still retain all ten category points if it exists, the tail is short, and CTA is late.

**False-positive risk.** A formal ending is mistaken for payoff quality.

### EQC-06 — P1 — “Meaningful” pattern interrupts remain metadata events, not semantic events

**Signal.** The first plan always counts. Subsequent events count when source label changes, photo changes to video, source is `gfx`, or an edit boundary names an SFX (`src/pipeline/editorialSignals.js:21-46`). Pacing awards up to five points for count and another three for motion share (`src/pipeline/retentionQC.js:140-159`).

**Ground truth.** No pixels or story function are evaluated. A source change can be visually near-identical or irrelevant; a `gfx` can be illegible; a video can be static in substance; an SFX can distract.

**Failure mode.** Decorative variation is treated as re-engagement. Although same-source split cuts are excluded, source/type diversity remains only a weak proxy for explanatory change.

**False-positive risk.** A stock→AI boundary earns meaning by label alone. **False-negative risk:** a powerful reveal within one continuous shot may not count.

### EQC-07 — P1 — Visual scoring does not inspect rendered imagery and treats missing relevance as success

**Signal.** Visual-variety points derive from number/run of source labels, absence of `placeholder`, and semantic relevance metadata (`src/pipeline/retentionQC.js:209-228`). Semantic relevance compares narration tokens with asset tags/keywords, not image content (`src/media/semanticRelevance.js:32-63`). In the pipeline, only stock/Pexels items with keywords are measured; AI, graphics, and archive items become `null` (`src/pipeline/run.js:353-361`).

**Circularity.** If relevance has zero observations, QC awards the full relevance points (`src/pipeline/retentionQC.js:223-225`). The same prompt-derived keyword can drive asset selection and then validate its relevance.

**Ground truth.** No rendered-frame model or human verifies visible subject, historical/scientific accuracy, continuity, duplicate composition, AI anatomy, text artifacts, contradiction with narration, or slideshow feel.

**False-positive risk.** An all-AI or archive sequence can evade semantic relevance entirely; a keyword-matching but visibly wrong stock clip can pass.

### EQC-08 — P1 — The “human eye simulation” is a restatement of the same proxies

**Signal.** Boredom increases for duration >4/5.5 seconds, absent pattern interrupt, Ken Burns, and low keyword relevance; swipe risk adds 0.15 before 12 seconds (`src/pipeline/editorCritique.js:14-40`). Strongest/weakest scenes reuse retention risk, interrupt presence, and relevance (`src/pipeline/editorCritique.js:44-66`).

**Ground truth.** There is no simulated perception model, rendered playback, human label, or viewer trace. The module itself says it is deterministic metadata arithmetic (`src/pipeline/editorCritique.js:4-11`).

**Failure mode.** The critique appears independent but is downstream of the same source/type/duration/relevance assumptions that create the score. `overallRetentionRisk` is directly thresholded from that score (`src/pipeline/editorCritique.js:87-95`).

**False-confidence risk.** Terms like “most boring moment,” “surprise likely,” and “HIGH swipe risk” imply predictive validation that the repository does not provide.

### EQC-09 — P1 — Caption QC validates layout math, not rendered readability or spoken accuracy

**Signal.** Caption scoring uses configured font size, shared layout math, maximum words, font floor, and estimated mobile size (`src/pipeline/retentionQC.js:178-207`). This is stronger than raw character estimation because the renderer and QC share layout logic.

**Circularity.** Sharing the same layout function proves implementation/config consistency, not independent correctness. If word timings are absent, QC still awards six of ten caption points from configuration defaults (`src/pipeline/retentionQC.js:203-207`).

**Ground truth.** No final frame is OCR'd or visually inspected for actual font rendering, contrast, overlap with uncontrolled imagery, timing lag, transcript mismatch, or cognitive collision with hook/finale/CTA text.

**False-positive risk.** A caption can fit mathematically yet be unreadable over a bright subject or mistimed against speech.

### EQC-10 — P1 — Audio scoring confuses planned SFX with audible, appropriate sound

**Signal.** Retention QC calls `sfxQuality()` on edit-plan boundary names and awards “audible SFX” points based on count, spacing, and identifier diversity (`src/pipeline/editorialSignals.js:92-120`; `src/pipeline/retentionQC.js:230-245`).

**Rendered measurement strength.** A separate hard gate measures final-MP4 peak-energy delta at declared cue times and blocks missing/unmixed/low-delta cues (`src/pipeline/outputVerify.js:63-142`; `src/pipeline/hardGate.js:50-56`).

**Ground-truth limit.** Energy rise does not isolate the SFX from simultaneous narration/music transients and does not judge semantic appropriateness, timbre quality, masking, or distraction. The test proves a synthetic sine hit raises energy, not that a human hears the intended sound well in a real mix (`test/outputVerify.test.js:14-51`).

**False-positive/negative risk.** A coincident loud syllable can help a cue pass; an audible subtle texture can fail a 3 dB transient rule.

### EQC-11 — P1 — Default warning policy publishes editorial failures by design

**Signal.** `warning` is the default mode and “never blocks” low score/critical editorial failures (`src/config.js:69-81`; `src/pipeline/retentionQC.js:473-480`). The eligibility report explicitly calls this a policy override (`src/pipeline/retentionQC.js:404-423`).

**Retained evidence.** The first three QC-history records have scores 81–82, `editorialReady:false`, `productionReady:false`, and `policyOverride:true`, yet YouTube eligibility is true (`data/qc-history.jsonl:1-3`). Tests require warning-mode low quality not to block upload (`test/editorCritique.test.js:99-123`).

**Failure mode.** The report can truthfully state “not production-ready” while the operational gate publishes it. Editorial QC therefore cannot function as final editor approval in default production behavior.

**Risk.** Known placeholder, caption-safe-area, or other editorial `failures` inside retention QC also do not block in warning mode unless separately covered by the hard gate.

### EQC-12 — P1 — Rendered-video validation is technical and partial, not a watch-through

**Rendered measurements.** Preflight fully decodes the MP4, checks streams/format, detects black/freeze/silence, measures loudness, and samples brightness at 20/50/80% (`src/pipeline/preflight.js:68-205`). Output verification checks declared SFX energy, CTA box/language, music fallback, and stereo truth (`src/pipeline/run.js:272-324`).

**Missing rendered judgments.** No process watches all frames for contradictory visuals, repeated compositions, malformed AI images, bad crops, transition motivation, caption contrast/timing, narration-visual sync, voice pronunciation, synthetic feel, or payoff quality. Three brightness samples only establish that the whole video is not dark. CTA `layerPresent` and box coordinates are reported from renderer metadata, not image recognition (`src/pipeline/outputVerify.js:153-198`).

**Workflow evidence.** Hook and midpoint JPEG previews are created after the upload decision path and are not consumed by QC or a required human approval step (`src/pipeline/run.js:406-423`, `src/pipeline/run.js:520-528`).

### EQC-13 — P2 — Editorial rejection happens after expensive production, not at recoverable stages

**Signal.** Retention QC begins at phase 4.6 after TTS, media acquisition/generation, editing, rendering, CTA, preflight, and output verification (`src/pipeline/run.js:259-362`).

**Ground truth.** Some failures are knowable earlier: missing/weak hook fields, lexical story-template issues, absent mechanism plan, risky placeholder, missing timing, and obvious semantic gaps.

**Failure mode.** Strict mode can reject only after costs are incurred; warning mode merely reports. Recommendations are not fed into an automated revision and re-QC cycle.

**False-rejection risk.** Early gates must be scoped to recoverable structural violations, not aesthetic proxies, or they will prematurely kill unconventional viable work.

### EQC-14 — P2 — Report generation is informative but not authoritative or fully durable

**Strength.** The report clearly separates `technicalReady`, `editorialReady`, `productionReady`, policy allowance, execution status, scores, metrics, failures, and improvements (`src/pipeline/retentionQC.js:426-449`, `src/pipeline/retentionQC.js:511-535`). QC exceptions fail closed in active modes (`src/pipeline/run.js:389-397`). History is append-only and deduplicates by video ID (`src/pipeline/qcHistory.js:64-99`).

**Gap.** Report-write failure is logged but does not stop production (`src/pipeline/retentionQC.js:537-544`); history failure likewise never affects publishing (`src/pipeline/qcHistory.js:95-99`). The simplified `report.json` is written with a swallowed error after upload decision (`src/pipeline/run.js:520-523`). No human approval identity, review timestamp, player version, or annotated defects are stored.

## Evidence table

| ID | Severity | Signal | Ground truth | Primary failure risk | Evidence |
|---|---|---|---|---|---|
| EQC-01 | P1 | 100-point proxy | None | Uncalibrated score presented as retention risk | `src/pipeline/retentionQC.js:267-319`; `src/pipeline/qcHistory.js:5-10` |
| EQC-02 | P1 | Synthetic “strong” fixture | Fixture text itself is generic/repetitive | Verified false pass | `test/editorCritique.test.js:126-149` |
| EQC-03 | P1 | Hook regex/length/timing | No rendered opening or viewer stop rate | Formal hook passes while opening fails | `src/pipeline/retentionQC.js:107-138` |
| EQC-04 | P1 | Scene/twist-word counts | No evolving-question review | Prompt compliance mistaken for story quality | `src/pipeline/retentionQC.js:160-176`; `src/script/generateScript.js:209-224` |
| EQC-05 | P1 | Finale presence/tail/CTA | No payoff judgment | Nonempty finale earns full category | `src/pipeline/retentionQC.js:247-260` |
| EQC-06 | P1 | Source/type/SFX changes | No semantic event observation | Decorative changes count as meaningful | `src/pipeline/editorialSignals.js:21-46` |
| EQC-07 | P1 | Source labels/tag overlap | No rendered pixels | Missing relevance passes; AI/archive unreviewed | `src/pipeline/retentionQC.js:209-228`; `src/pipeline/run.js:353-361` |
| EQC-08 | P1 | Reused proxy arithmetic | No human/viewer labels | “Human eye” wording creates false authority | `src/pipeline/editorCritique.js:14-40`, `src/pipeline/editorCritique.js:85-96` |
| EQC-09 | P1 | Shared caption layout math | No rendered OCR/contrast/timing review | Implementation agrees with itself | `src/pipeline/retentionQC.js:178-207` |
| EQC-10 | P1 | Planned names + final energy delta | No isolated perceptual/semantic test | Audibility/appropriateness conflated | `src/pipeline/editorialSignals.js:92-120`; `src/pipeline/outputVerify.js:23-35` |
| EQC-11 | P1 | Warning-mode override | History shows non-ready eligibility | Editorial failure publishes | `src/pipeline/retentionQC.js:404-423`; `data/qc-history.jsonl:1-3` |
| EQC-12 | P1 | Decode/filter/geometry checks | No full watch-through | Technical pass mistaken for editorial pass | `src/pipeline/preflight.js:127-205`; `src/pipeline/run.js:272-324` |
| EQC-13 | P2 | Post-render QC | Recoverable early defects | Costly late rejection, no revision loop | `src/pipeline/run.js:259-362` |
| EQC-14 | P2 | Reports/history | No required durable approval | Evidence can fail to persist while pipeline continues | `src/pipeline/retentionQC.js:537-544`; `src/pipeline/qcHistory.js:95-99` |

## Top five creative or technical blockers

1. **No independent editorial ground truth (EQC-01/EQC-08).** The score, critique, and attention forecast all derive from overlapping internal metadata.
2. **No rendered visual/story review (EQC-03/EQC-07/EQC-09/EQC-12).** QC cannot see contradiction, synthetic feel, malformed imagery, real caption readability, or narrative-visual synchronization.
3. **Default publication bypasses editorial readiness (EQC-11).** A known failed editorial verdict remains upload-eligible.
4. **Circular scoring rewards template compliance (EQC-02/EQC-04/EQC-05).** A deliberately generic fixture can earn ≥90.
5. **Events and audio quality are reduced to counts/labels/energy (EQC-06/EQC-10).** The system does not establish that they are meaningful, motivated, or pleasant.

## Quick wins

These are recommendations only; no implementation occurred.

- Rename `retentionScore`, “human eye simulation,” “swipe risk,” and “surprise likely” in user-facing reports as **editorial proxy**, **heuristic risk**, and **rule match** until calibrated. Preserve fields if compatibility requires it, but remove implied measurement authority.
- Add a coverage section to every production report showing which signals inspected final pixels/audio versus manifest/config only. Explicitly mark AI/archive visual relevance as unmeasured and empty word timings as unassessed, not passed.
- Change review policy documentation so `productionReady:false` cannot be described as approved. If warning-mode publishing remains intentional, label the artifact “published without editorial approval” prominently.
- Add adversarial QC fixtures: grammatically polished nonsense, repeated twist words without turns, source-label changes with identical frames, keyword-matching wrong visuals, nonempty but irrelevant finales, bright captions over bright footage, and loud non-SFX transients at cue times.
- Require the two generated previews to be created before upload eligibility and attach them to the review record. They are insufficient for full approval, but they can catch obvious first-frame/midpoint failures.
- Make zero relevance observations, zero caption timings, and absent final-pixel checks explicit `unknown` states rather than awarding default points.

## Structural improvements

1. **Separate safety, compliance, proxy, and approval.** Keep technical/hard gates as machine safety. Put manifest rules in a compliance report. Keep predictive features as calibrated proxies. Reserve `editorialApproved` for an independent rendered watch-through.
2. **Introduce staged QC.** Before expensive generation: schema, factual-source presence, hook/first-line relationship, word budget, and mechanism-plan checks. Before render: asset completeness, duplicate detection, source/license readiness, and scene-level visual contradiction review. After render: full audiovisual review and technical gates.
3. **Review the final rendered sequence.** Evaluate sampled and boundary frames plus audio-aligned segments for first-frame truth, visual-narration agreement, duplicate/slideshow composition, AI artifacts, caption contrast/overlap, cut synchronization, audio masking, and ending payoff. Fail closed on unavailable required review rather than treating missing evidence as success.
4. **Build a human-labeled validation set.** Have at least two editors independently rate retained, reviewable Shorts against a concise rubric: approve/reject, hook coherence, evolving curiosity, visual proof, synthetic feel, pacing, readability, audio intelligibility, payoff, and top defect timestamps. Adjudicate disagreements.
5. **Calibrate, do not hand-weight indefinitely.** Measure false-pass/false-reject rates of each proxy against held-out human labels and real viewer outcomes. Use confidence intervals and abstain when evidence is missing. Keep causal claims out of score names.
6. **Make visual evidence independent.** Inspect rendered pixels rather than prompt/keyword echoes. Use asset hashes/perceptual similarity for duplicate compositions and separate historical/scientific correctness review from generic semantic similarity.
7. **Make meaningful-event judgment semantic.** An event should identify what viewer understanding or emotion changed, which evidence appears, and how it advances the active question. Count only independently verified changes, not source labels.
8. **Unify final timing truth.** Derive scene/caption/cut checks from actual speech timing and rendered frame timestamps, then flag visual lines that start/end outside their narration.
9. **Strengthen approval durability.** Persist immutable QC inputs, tool versions, final-video hash, full findings, reviewer identity/type, decision, override owner/reason, and timestamps before upload.
10. **Keep overrides exceptional and reviewable.** Any editorial override should be explicit, scoped to a named defect, time-stamped, and excluded from “approved” training labels.

## Experiments to run

| Experiment | Ground truth | Sample and baseline | Decision rule |
|---|---|---|---|
| Blind human validation | Two independent editor approve/reject labels plus defect timestamps | At least 30 retained production Shorts across score bands; current ≥85 rule as baseline | Do not call score predictive until false-pass/false-reject rates and agreement are reported on a held-out set. |
| Adversarial proxy suite | Known intentionally bad fixtures | Current test suite versus nonsense/repetition/identical-frame/irrelevant-finale cases | Every known-bad case must fail or abstain; no missing observation may earn positive evidence. |
| Rendered visual review | Human frame/sequence labels | Same videos reviewed from manifests only and from final MP4 | Rendered review must materially reduce contradiction, duplicate, crop, AI-artifact, and caption false passes. |
| Meaningful-event annotation | Editors mark timestamps where understanding/emotion changes | Current pattern-interrupt count | Replace/count a proxy only if precision and recall against annotations are useful and stable by format. |
| Hook coherence test | Human unified-opening rating plus viewed-vs-swiped when available | Current hook score on matched videos | Require out-of-sample association after controlling topic/format; otherwise retain as compliance only. |
| SFX verification isolation | Human audibility/appropriateness labels and isolated stem checks | Current 3 dB final-mix delta | Gate must distinguish intended SFX from coincident program peaks and avoid rejecting approved subtle cues. |
| Warning versus approval policy | Override defect audit and post-publish outcomes | Existing warning-mode records versus reviewed strict cohort | Continue automatic editorial overrides only if defect escape rate is acceptably low and explicitly approved. |

## Metrics that would validate improvement

- Human-editor approval precision: among machine-approved videos, percentage humans approve.
- Human-editor approval recall: percentage of human-approved videos the machine does not wrongly reject.
- Critical defect escape rate by class: contradiction, AI artifact, irrelevant visual, unreadable caption, sync, masking, factual/license, incomplete payoff.
- Inter-rater agreement and adjudication rate; low agreement should produce abstention, not synthetic certainty.
- Signal coverage: percentage of plans inspected from final pixels, percentage of narration aligned to visuals, percentage of captions assessed in rendered frames, percentage of audio cues perceptually verified.
- Missing-evidence rate and number of points previously awarded from missing observations.
- Meaningful-event precision/recall against editor timestamp annotations, reported separately from raw event count.
- Calibration by score band: observed human approval rate and viewer outcomes for 0–69, 70–79, 80–84, 85–89, and 90–100.
- Override rate, override owner/reason coverage, and defect rate among overridden publications.
- Early-rejection savings: render minutes/API cost avoided, paired with wrongful early-rejection rate.
- Viewer validation only after human calibration: viewed-vs-swiped, 1s/3s retention, completion/APV, rewatch signal, shares, and subscriber conversion, controlled for topic/format/distribution.
- Report durability: percentage of uploads with final hash, technical report, editorial review, approval/override record, and artifacts persisted before publication.

## Risks and regressions

- A stricter gate without independent validation can scale false rejections and suppress unconventional successful work.
- Human review adds latency and inconsistency; use a short rubric, multiple raters on calibration samples, and explicit abstention.
- Automated pixel/audio review can hallucinate or miss defects. Treat it as evidence with confidence, not authority, and retain frames/timestamps for inspection.
- Early rejection can waste fewer resources but may reject fixable creative experiments. Restrict early hard failures to objective/recoverable requirements.
- Changing score definitions breaks historical comparability. Version every rubric and never compare scores across versions without mapping.
- Viewer metrics are confounded by topic, distribution, audience, and publish time. They validate prediction only with controlled analysis, not raw correlation.
- Making report persistence a hard gate can block safe publishing during storage incidents; use durable retry/recovery rather than silent continuation.
- Final-video hashing and retained review media increase storage and privacy/licensing obligations; define retention and access policies.
- Frame sampling alone can miss one-frame artifacts and timing problems; full sequence/audio review remains necessary for final approval.
- SFX stem isolation may not reflect mix perception; validate both isolated presence and final-mix audibility/appropriateness.
- Removing proxy points for unknown evidence can lower all historical scores. This is preferable to false confidence, but thresholds must be re-baselined rather than silently preserved.

## Final P0/P1/P2/P3 list

### P0

- None newly verified. The existing technical/hard gates address several corrupt-output and publishing-safety cases, but this audit does not establish complete safety coverage.

### P1

- **EQC-01:** Editorial score and risk labels have no human or viewer calibration.
- **EQC-02:** The test suite requires a generic, repetitive, relevance-unmeasured fixture to score ≥90.
- **EQC-03:** Hook scoring does not assess the unified rendered opening.
- **EQC-04:** Story scoring is circular with prompt structure and lexical markers.
- **EQC-05:** Payoff points do not require a meaningful payoff or closed loop.
- **EQC-06:** Pattern interrupts are metadata changes, not verified meaningful events.
- **EQC-07:** Visual QC does not inspect rendered pixels and awards points when relevance is unmeasured.
- **EQC-08:** “Human eye simulation” reuses the same unvalidated proxies.
- **EQC-09:** Caption QC proves shared layout consistency, not rendered readability or spoken alignment.
- **EQC-10:** Audio QC conflates edit-plan counts/final energy with audible, appropriate sound design.
- **EQC-11:** Default warning mode publishes videos explicitly marked not editorial-ready.
- **EQC-12:** Rendered validation is technical/partial and contains no required audiovisual watch-through.

### P2

- **EQC-13:** Most editorial rejection occurs only after the full render and has no revision loop.
- **EQC-14:** Reports are useful but can fail to persist without blocking publication and lack durable human approval evidence.

### P3

- Add versioned terminology/glossary documentation after score roles are separated, including examples of rendered measurement, compliance, proxy, abstention, approval, and override.

## “No files were modified” confirmation

No application code, production configuration, prompts, tests, thresholds, assets, or existing documentation were modified. The only file created by this audit is `reports/2026-07-21/12-editorial-qc-director.md`. No publishing/upload command was run, and no commit or push was made.
