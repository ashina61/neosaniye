# Caption and Typography Director Audit — 2026-07-21

## Executive verdict

NeoSaniye's burned-caption system has sensible mobile defaults: short one-line groups, embedded Montserrat/Playfair fonts, split-before-shrink behavior, strong outlines, a high lower-third baseline, and separate hierarchy for hook, captions, emphasis, finale, watermark, CTA, and graphics (`src/video/captionLayout.js:10`, `src/video/renderVideo.js:102`). These are good implementation foundations.

The system nevertheless cannot currently prove that captions are accurate, precisely synchronized, or readable in production pixels. On the default Edge TTS path, newer sentence-level subtitle cues are divided into “word timings” by character-count proportion rather than acoustic alignment (`src/tts/edgeTts.js:17`). On the Piper fallback, Whisper produces real word timestamps, but its recognized words are neither reconciled against the source narration nor confidence-checked (`scripts/whisper_align.py:23`). If alignment fails entirely, the pipeline continues with an empty timing list (`src/tts/generateAudio.js:84`), and caption QC can still award a full caption score from configuration alone (`src/pipeline/retentionQC.js:203`).

Readability QC is formula-based despite comments that describe it as exact. Width is estimated with average character factors; line height and safe area are approximations; “mobile pixels” are a simple 1920→640 scale conversion. The readability module explicitly says it uses a deterministic model instead of rendered-frame OCR/pixel analysis (`src/video/readability.js:1`). Only hook and midpoint previews are generated, and current production frames are not retained in the repository (`src/pipeline/run.js:524`). Therefore the required production rendered-readability verdict is **unknown**, not passed.

The available rendered artifacts are synthetic CTA acceptance fixtures. Visual inspection confirms clean high-contrast cards, but the CTA labels are materially smaller than nearby headline/caption samples; the artifact's own review calls them adequate rather than ideal on phones (`artifacts/motion/acceptance/acceptance-report.md:43`, `artifacts/motion/acceptance/acceptance-contact-sheet.png`). Those fixtures use representative backgrounds and, in several examples, legacy Turkish labels; they cannot establish current English production readability (`artifacts/motion/acceptance/acceptance-report.md:3`).

Captions probably improve comprehension when timings are valid because groups are brief and contrast is strong. They can increase cognitive load during the first 2.8 seconds and final 2.6 seconds, when caption streams overlap semantically with hook/finale overlays, and during graphic scenes where narration captions coexist with full-screen step/stat text. No QC evaluates concurrent text density across those layers.

No P0 is verified. Missing/approximate timing, false-positive QC, and lack of production pixel review are P1. Phrase grouping, layer competition, CTA scale, and accessibility-caption inconsistency are P2 unless production playback demonstrates more severe failure.

## Verified findings

### CT-01 — P1: Default Edge “word timings” can be inferred from character length rather than speech

**Verified fact.** Edge TTS writes an SRT and `parseSrt` handles newer versions that provide sentence-level cues. When a cue contains multiple words, the code distributes the cue duration in proportion to each word's character length and shortens every word event to 92% of that allocation (`src/tts/edgeTts.js:17`, `src/tts/edgeTts.js:49`). These values drive burned-caption grouping/start/end times (`src/video/renderVideo.js:175`) and uploaded SRT generation (`src/youtube/captions.js:20`).

**Inferred viewer effect.** Long spelling does not imply long spoken duration, and short function words can be stressed or paused. Captions may change early/late relative to speech even when the sentence cue itself is correct. The artificial 8% gap can also influence phrase segmentation near the 0.28-second rule on unusually long allocations.

**Required rendered evidence.** Compare caption event changes against the audio waveform/phonemes at fast speech, pauses, numbers, and proper names. No current production audio+caption proxy is retained.

### CT-02 — P1: Piper/Whisper captions are not checked against the source narration

**Verified fact.** The Piper path invokes faster-whisper with word timestamps and returns Whisper's recognized `word`, `start`, and `end` values directly (`scripts/whisper_align.py:23`). The result is not aligned back to `scriptToNarration`, and no confidence, deletion, insertion, substitution, punctuation, number-format, or proper-name comparison was found. If Whisper alignment throws, the error is caught and an empty word list is returned (`src/tts/generateAudio.js:84`).

**Consequence.** Caption word accuracy depends on recognition quality. Names, scientific terms, dates, and numbers can be wrong or absent even when the TTS audio is correct. This is especially important because the burned words and official YouTube captions share the same timing/word source.

**Required evidence.** Store source-to-aligned word error records and manually review high-risk tokens. No representative production word-alignment artifact exists in the repository.

### CT-03 — P1: Caption QC can pass when no captions will render

**Verified fact.** `renderVideo` considers subtitles present only when `wordTimings.length > 0` (`src/video/renderVideo.js:877`). In retention QC, when no word timing/layout exists, it awards grouping and fit points from configured `captionWordsPerLine`, in addition to font-size points (`src/pipeline/retentionQC.js:191`, `src/pipeline/retentionQC.js:203`). With defaults, that yields the full 10 caption points despite no burned caption events.

The latest retained QC rows all report caption score 10 (`data/qc-history.jsonl:1`, `data/qc-history.jsonl:2`, `data/qc-history.jsonl:3`, `data/qc-history.jsonl:4`), but those rows do not retain word count, alignment coverage, or rendered OCR results. They therefore do not prove captions appeared or matched speech.

**Consequence.** A failed alignment can silently remove captions without failing the editorial gate. This invalidates the caption score as evidence of comprehension support.

### CT-04 — P1: “Rendered readability” is estimated, not measured

**Verified fact.** Caption width is computed from raw character counts and constant width factors (`src/video/captionLayout.js:19`). Safe-area block height is `fontSize × 1.35`, described as an approximation (`src/video/captionLayout.js:101`). Mobile size is calculated by scaling nominal font pixels from 1920 to 640 (`src/video/readability.js:15`). The module explicitly says real-frame pixel/OCR analysis is not used (`src/video/readability.js:4`).

Hook sizing similarly assumes an average Montserrat character factor and two usable line widths without measuring actual libass line breaks or rendered glyph bounds (`src/video/readability.js:20`, `src/video/renderVideo.js:131`). CTA font fitting uses label length times a constant rather than rendered glyph extents (`src/motion/ctaTemplates.js:140`).

**Consequence.** Font substitution, actual kerning, italic overhang, outline/shadow expansion, wrapping balance, compression, background complexity, motion blur, and device UI cannot be certified. The model is useful preflight, but its results are not rendered proof.

### CT-05 — P2: Phrase grouping is pause/punctuation/count based, not syntactic

**Verified fact.** Burned captions close a group at three words, punctuation, a gap over 0.28 seconds, or before an emphasized word (`src/video/captionLayout.js:62`). Long groups are recursively split at the numerical midpoint (`src/video/captionLayout.js:28`). There is no phrase parser or protection for determiner+noun, preposition+object, auxiliary+verb, negation, proper-name spans, number+unit except when both happen to be emphasized, or clauses.

**Inferred viewer effect.** Groups can end on “the,” “of,” “could,” or “not,” leaving an incomplete thought and increasing rereading. Emphasis can isolate a word correctly for drama but also fragment a natural phrase. Three-word consistency reduces density yet can create rapid typographic flicker during fast narration.

**Required rendered evidence.** Review representative production captions at normal speed, especially scientific names, dates, possessives, negation, and number-unit phrases. Current fixtures do not include production narration captions.

### CT-06 — P2: Hook and finale create concurrent reading streams with narration captions

**Verified fact.** The hook overlay lasts from 0 to 2.8 seconds (`src/config.js:208`, `src/video/renderVideo.js:145`). Burned captions begin at the first word timing and are rendered in the same ASS file (`src/video/renderVideo.js:175`). The finale begins 2.6 seconds before the last spoken word ends, while normal captions continue, and remains 1.6 seconds beyond the last word (`src/video/renderVideo.js:151`).

Spatial separation exists: hook uses a higher center position, captions use a lower baseline, and finale uses a baseline 210 pixels above captions (`src/video/renderVideo.js:139`, `src/video/renderVideo.js:163`). However, no QC measures simultaneous word count, semantic duplication, visual scan distance, or whether moving hook/finale text and captions can be read together.

**Inferred viewer effect.** During the opening, viewers must process hook copy, the first spoken-caption phrase, the first visual, and a moving overlay at once. At the end, finale copy can paraphrase the still-spoken payoff while captions transcribe it, creating redundant competition rather than hierarchy.

### CT-07 — P2: Graphic scenes add a third text system without interaction QC

**Verified fact.** Step graphics contain a title and two to four numbered phrases that progressively appear (`src/media/renderTemplate.js:175`, `src/media/renderTemplate.js:198`). Stat cards contain a large value, unit, and label (`src/media/renderTemplate.js:43`). These rendered video items are composited beneath the global burned captions; the renderer does not suppress or retime captions for graphic scenes (`src/pipeline/run.js:202`, `src/video/renderVideo.js:1061`).

The graphic layouts intentionally avoid the lower caption band, but no shared layer model checks title + steps/value + global caption + watermark + CTA/finale at the actual timestamp. CTA avoidance uses a fixed caption zone rather than actual glyph boxes (`src/motion/ctaSafeArea.js:36`).

**Inferred viewer effect.** A steps card that says the same thing as the spoken captions asks the viewer to read two differently timed versions while listening. Spatial non-overlap is not the same as manageable cognitive load.

### CT-08 — P2: CTA typography is clean but undersized relative to the mobile system

**Verified rendered evidence.** Visual inspection of `artifacts/motion/acceptance/acceptance-contact-sheet.png`, `artifacts/motion/cta-contact-sheet.png`, and `artifacts/regression/bee-cta-positions.png` shows high-contrast dark cards, clear icons, and consistent alignment. It also shows CTA labels substantially smaller than nearby headline/caption text. The acceptance report independently notes that card/text size is “adequate but not ideal” on phone and suggests a 10–12% increase (`artifacts/motion/acceptance/acceptance-report.md:56`).

**Verified code.** CTA font size can fall to 26 px at 1080×1920 (`src/motion/ctaTemplates.js:151`), equivalent to 8.7 nominal pixels in the repository's 360×640 scaling model—well below the 15-pixel burned-caption threshold (`src/video/readability.js:59`). The CTA uses a dark card and bold style, which improves legibility, but CTA readability is not assessed by `assessCaptionReadability`.

**Limitation.** The inspected frames are synthetic/legacy, not current production English frames. They support a scale concern, not a claim that published CTA labels are unreadable.

### CT-09 — P2: Watermark and CTA geometry are checked incompletely across text layers

**Verified fact.** The watermark/logo is fixed at x=72, y=64 and 72 pixels high, or falls back to 44-pixel text at x=40, y=48 (`src/video/renderVideo.js:905`, `src/video/renderVideo.js:989`). This is separated from the normal caption baseline and generally above the hook, but no rendered overlap check evaluates a large/tall logo against hook wrapping.

CTA verification checks its deterministic box against fixed caption/UI zones and language (`src/pipeline/outputVerify.js:144`). It does not inspect actual caption glyph bounds, finale text, graphic text, hook wrapping, watermark bounds, or background contrast over the CTA interval.

**Consequence.** Static geometry prevents obvious collisions, but it cannot certify hierarchy and readability for all text combinations.

### CT-10 — P2: Uploaded accessibility captions use different grouping rules from burned captions

**Verified fact.** Burned captions use up to three words, a 0.28-second gap, and punctuation including comma/semicolon/colon (`src/video/captionLayout.js:62`). Uploaded SRT uses up to seven words, a 0.6-second gap, and only sentence-ending punctuation (`src/youtube/captions.js:20`). SRT groups receive a minimum 0.4-second duration but do not extend to the next group (`src/youtube/captions.js:36`).

**Consequence.** The accessibility track can present longer, differently segmented phrases than the burned design. That is not inherently wrong, but there is no documented intent or separate readability/accuracy validation for the accessibility experience.

## Evidence table

| ID | Severity | Verified repository evidence | Typography judgment | Evidence status |
|---|---|---|---|---|
| CT-01 | P1 | Sentence cues split by character duration (`src/tts/edgeTts.js:17`) | Timing can drift from spoken words | Algorithm verified; production drift unmeasured |
| CT-02 | P1 | Whisper words returned directly (`scripts/whisper_align.py:23`); failure becomes empty list (`src/tts/generateAudio.js:84`) | Accuracy/coverage are not guaranteed | Verified gap |
| CT-03 | P1 | Empty timings render no subs but QC awards configuration points (`src/video/renderVideo.js:877`, `src/pipeline/retentionQC.js:203`) | Caption QC can false-pass | Verified |
| CT-04 | P1 | Character-factor and nominal-pixel models replace rendered analysis (`src/video/captionLayout.js:19`, `src/video/readability.js:4`) | Mobile readability remains unverified | Verified |
| CT-05 | P2 | Grouping uses count/gap/punctuation/emphasis (`src/video/captionLayout.js:62`) | Natural phrases can fragment | Behavior verified; viewer effect inferred |
| CT-06 | P2 | Hook/finale time windows overlap captions (`src/video/renderVideo.js:145`, `src/video/renderVideo.js:167`) | Multiple simultaneous reading streams increase load risk | Timing verified; production perception unknown |
| CT-07 | P2 | Graphic text renders beneath always-on captions (`src/media/renderTemplate.js:166`, `src/video/renderVideo.js:1061`) | Non-overlap does not guarantee comprehension | Verified architecture; effect inferred |
| CT-08 | P2 | CTA minimum 26 px (`src/motion/ctaTemplates.js:151`); inspected synthetic contact sheets and report note small text (`artifacts/motion/acceptance/acceptance-report.md:56`) | Clean hierarchy but weak phone scale | Rendered synthetic evidence; production unknown |
| CT-09 | P2 | Fixed watermark and static CTA zones (`src/video/renderVideo.js:989`, `src/pipeline/outputVerify.js:189`) | Full text-layer interaction is not checked | Verified |
| CT-10 | P2 | Burned and uploaded caption grouping differ (`src/video/captionLayout.js:62`, `src/youtube/captions.js:20`) | Accessibility presentation is inconsistent and unreviewed | Verified |

## Top five creative or technical blockers

1. **P1 — Caption timing is not reliably acoustic.** Edge sentence cues are divided by character length, and Piper recognition is not reconciled to source text (`src/tts/edgeTts.js:49`, `scripts/whisper_align.py:23`).
2. **P1 — Missing caption data can receive a perfect caption score.** Render and QC disagree on what constitutes captions (`src/video/renderVideo.js:877`, `src/pipeline/retentionQC.js:203`).
3. **P1 — Production pixel readability is not audited.** The current system measures nominal math, not rendered glyphs, compression, or device frames (`src/video/readability.js:4`).
4. **P2 — Text layers are independently laid out but not jointly evaluated.** Hook/captions, finale/captions, graphics/captions, watermark, and CTA lack a shared timeline-aware density model (`src/video/renderVideo.js:124`, `src/media/renderTemplate.js:166`).
5. **P2 — Phrase boundaries are mechanical.** Three-word, punctuation, and gap rules do not protect natural semantic units (`src/video/captionLayout.js:62`).

## Quick wins

- Treat empty word timings as caption failure/unknown, never as a configuration-based pass.
- Add a per-video alignment summary: expected source tokens, aligned tokens, substitutions, missing tokens, and timing source (`edge-character-estimate`, `edge-word-boundary`, or `whisper`).
- Manually review the 0–3 second and last 3 seconds with all text layers visible; those are guaranteed overlap windows.
- Suppress redundant burned-caption phrases while a step/stat graphic already presents the same words, or reduce the graphic copy so each layer has a distinct job.
- Add CTA labels to the same phone-size readability review as captions; the 26-pixel floor should not be assumed legible because it sits on a card.
- Retain a contact sheet containing hardest typography moments: longest hook, longest word, emphasized number/unit, graphic+caption, CTA+caption, finale+caption, bright background, and platform-UI overlay.
- Review phrase groups for orphaned function words and split proper names/numbers before publish.

## Structural improvements

1. **Source-grounded forced alignment.** Align the known narration text to generated audio rather than proportionally dividing sentence cues or accepting unconstrained transcription. Acceptance criterion: complete source-token coverage with explicit exceptions and measured timing confidence.
2. **Caption-presence hard gate.** Require nonempty, monotonic, in-duration timings with adequate narration coverage. Acceptance criterion: no rendered video can receive caption points when burned-caption events are absent.
3. **Rendered typography QC.** Extract representative final frames and measure real glyph boxes, wrapping, contrast, clipping, safe-area/UI intersections, and font resolution. Acceptance criterion: every critical text-layer combination is reviewed on a 360×640 equivalent and at least one common physical phone viewport.
4. **Semantic phrase segmentation.** Combine punctuation/timing with phrase protections for names, number+unit, negation, auxiliaries, and prepositional phrases. Acceptance criterion: blinded reviewers mark at least 95% of groups as complete, natural reading units.
5. **Unified text-layer timeline.** Model hook, captions, emphasis, graphic copy, watermark, CTA, and finale together. Acceptance criterion: simultaneous word count, bounding boxes, and hierarchy pass at every sampled timestamp.
6. **Separate accessibility-caption specification.** Define intentional SRT grouping and validate it independently. Acceptance criterion: uploaded captions match source narration and meet readable duration/line-length targets.

## Experiments to run

1. **Timing comparison:** character-proportional Edge timing versus source-text forced alignment, reviewed against waveform and perceived sync.
2. **Grouping comparison:** current three-word rules versus semantic phrase grouping, holding typography and audio constant.
3. **Opening density test:** hook+captions together versus hook-only for the first beat followed by captions; measure comprehension and first-second retention.
4. **Graphic-scene test:** full burned captions over steps card versus complementary/minimal captions; measure mechanism recall.
5. **CTA scale test:** current 26–46 px versus a phone-validated larger minimum, tested on bright, noisy, and caption-dense frames.
6. **Finale hierarchy test:** simultaneous finale+captions versus finale appearing after the spoken payoff.

These are proposed experiments; none were run during this read-only audit.

## Metrics that would validate improvement

- Caption word error rate against source narration.
- Source-token alignment coverage and percentage of timings that are acoustically derived.
- Median/95th-percentile caption onset and offset error against speech.
- Caption presence rate in final rendered MP4s; target 100% when captions are required.
- Rendered glyph clipping/wrapping failure rate and UI/safe-area overlap rate.
- Minimum measured glyph height and contrast on final compressed 360×640 frames.
- Natural phrase-boundary approval rate and orphaned-function-word rate.
- Maximum simultaneous text words and concurrent independent reading streams by timestamp.
- Single-view comprehension with captions on versus off, including graphic scenes.
- CTA label recognition at normal playback speed on phone.
- Accessibility SRT word accuracy and readable-duration compliance.

## Risks and regressions

- Forced alignment can fail on stylized pronunciation or TTS omissions; failures must be visible and reviewable, not silently replaced with estimates.
- Larger captions/CTA labels can obscure visual evidence. Solve hierarchy and placement jointly rather than shrinking text below readability thresholds.
- Semantic groups may remain longer on screen and increase density; timing and phrase completeness must be balanced.
- Suppressing captions over graphics can reduce accessibility if the graphic is not understandable alone; retain audio-equivalent information in the uploaded caption track.
- OCR-based QC can misread stylized fonts; combine measured boxes/contrast with human frame review.
- Removing opening captions may harm muted viewing. Test hook-only versus reduced opening captions rather than assuming one solution.
- Font substitution can alter all metrics; verify the actual embedded/resolved font in the final render.

## Final P0/P1/P2/P3 list

### P0

- None verified.

### P1

- **CT-01:** Default Edge sentence cues can produce character-proportional pseudo-word timings rather than acoustic synchronization (`src/tts/edgeTts.js:17`).
- **CT-02:** Whisper caption words are not reconciled with source narration, and alignment failure silently yields no timings (`scripts/whisper_align.py:23`, `src/tts/generateAudio.js:84`).
- **CT-03:** Empty timings produce no burned captions but can still receive full caption QC points (`src/video/renderVideo.js:877`, `src/pipeline/retentionQC.js:203`).
- **CT-04:** Caption, hook, and mobile readability QC is mathematical estimation rather than final-frame verification (`src/video/readability.js:4`).

### P2

- **CT-05:** Mechanical grouping can split natural phrases and create rapid isolated emphasis (`src/video/captionLayout.js:62`).
- **CT-06:** Hook/finale and captions create overlapping reading streams without cognitive-density QC (`src/video/renderVideo.js:145`, `src/video/renderVideo.js:167`).
- **CT-07:** Graphic text and burned captions are independently composed without timestamp-level hierarchy checks (`src/media/renderTemplate.js:166`).
- **CT-08:** CTA text can fall to 26 px and appears small in available synthetic phone-oriented artifacts (`src/motion/ctaTemplates.js:151`).
- **CT-09:** Watermark/CTA checks do not cover actual glyph bounds or every text layer (`src/pipeline/outputVerify.js:189`).
- **CT-10:** Official YouTube captions use a different, unvalidated segmentation system (`src/youtube/captions.js:20`).

### P3

- No standalone typography polish should precede accurate timing, caption-presence gating, and rendered-frame review.

## “No files were modified” confirmation

No application code, production configuration, prompt, font, asset, generated output, or existing repository file was modified. The only file created is this audit report: `reports/2026-07-21/08-caption-typography-director.md`. Existing rendered artifacts were inspected read-only. No dependency was installed, no render/publish/upload command was run, and no commit or push was performed.
