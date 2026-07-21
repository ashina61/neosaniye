# 01 — Executive Producer Audit Report

**Audit date:** 2026-07-21  
**Repository revision:** not recorded  
**Scope inspected:** repository documentation, prompts, orchestration, rendering and presentation configuration, editorial QC, analytics loop, persisted production/QC records, examples, tests, workflows, and available generated artifacts  
**Evidence limitations:** no representative finished production video exists under `output/`; FFmpeg/ffprobe is not installed in this environment; the inspectable videos and contact sheets are synthetic motion/regression fixtures rather than complete channel episodes. Consequently, emotional impact, final continuity, voice performance, and complete phone-viewing experience are not verified.

## Executive verdict

NeoSaniye has a coherent production ambition—English-language, curiosity-led, factual mini-stories with fast hooks, explicit payoff/loop structure, mixed visual evidence, and a restrained turquoise/dark presentation system—but it does not yet have repository evidence that this ambition reliably survives into a premium finished Short. The production logic is considerably more specific than a generic faceless-facts generator: it rotates five formats, requires question-to-payoff structure, asks for visual proof and source variety, and connects performance data back into prompts. Those are genuine strengths.

The principal product problem is a mismatch between the declared creative bar and the release policy. The configured editorial target is 90, yet the default QC mode is warning-only, and the latest four persisted audit records are all below 90; three scores of 81–82 were explicitly publish-eligible by policy override. This means the system can diagnose that a Short is below its own “great” bar and still treat uninterrupted publishing as the higher-order goal. That caps the creative ceiling more than any isolated font, transition, or shot issue.

Series identity is promising but incomplete. The channel owns a broad promise—surprising true stories and mechanisms across history, science, space, nature, and mystery—rather than a sharply recognizable viewer contract. Format rotation and visual-style randomization add variety, but no verified recurring editorial signature, emotional voice, or human-reviewed exemplar demonstrates why a repeat viewer would recognize and seek out a NeoSaniye episode specifically. The strongest next step is not more automated scoring; it is a small, representative set of finished episodes reviewed as whole experiences and tied to actual audience behavior.

## Verified findings

### EP-01 — P1 — The release policy knowingly permits work below the declared creative target

**Verified facts.** The default editorial QC mode is `warning`, described as reporting without blocking; 85 is the strict-mode minimum, while 90 is explicitly an editorial target rather than an upload gate (`src/config.js:69-81`). The QC documentation likewise states that sub-90 work can still publish (`docs/editorial-director-v2.md:23-29`). In persisted history, the first three experiment productions score 82, 81, and 82, are marked `editorialReady:false` and `productionReady:false`, yet have YouTube/Instagram/Facebook eligibility set to true through a policy override (`data/qc-history.jsonl:1-3`). The fourth scores 85 and is still below the 90 target (`data/qc-history.jsonl:4`).

**Inference.** A viewer cannot see the QC score, but repeated publication of work the system itself labels below target makes “daily throughput” the de facto product standard. This is a major risk to perceived originality, emotional impact, and repeat-viewer trust.

**Recommendation for a future implementation task.** Introduce an editorial release decision that cannot silently equate “technically publishable” with “worthy of the series.” It need not simply make score 90 a hard automated gate: a documented human approval or evidence-backed exception could be safer because the score is heuristic.

**Owner:** Executive Producer + Editorial QC Director.  
**Dependency:** representative rendered review and calibrated QC-to-audience evidence.  
**Acceptance criteria:** every published record below the declared target contains an explicit, reviewable approval and rationale; no record simultaneously says `productionReady:false` and becomes publish-eligible solely because warning is the default; the policy is tested against known strong and weak finished videos.

### EP-02 — P1 — Finished-product quality is not verifiable from the repository’s available outputs

**Verified facts.** The editorial design document states that real video could not be rendered in the documented environment and that only rules and deterministic QC behavior were reported (`docs/editorial-director-v2.md:42-49`). The motion acceptance report explicitly says real NeoSaniye videos were absent and its six backgrounds were representative test fixtures (`artifacts/motion/acceptance/acceptance-report.md:3-8`). The bee comparison also labels itself synthetic content using real code paths, not a real topic render (`artifacts/regression/bee-before-after.md:1-5`). The inspected motion contact sheet confirms CTA states and layout on synthetic backgrounds, but it does not contain a complete episode with narration, story progression, factual visuals, and payoff.

**Inference.** Code-level creative intent and component acceptance cannot establish whether the final experience feels cinematic, emotionally shaped, coherent, or synthetic. The absence of representative finished outputs prevents a high-confidence executive green light.

**Recommendation for a future implementation task.** Preserve a small, privacy- and license-safe “golden reel” of complete production outputs plus script, production report, and contact sheet for whole-product review.

**Owner:** Executive Producer + Editorial QC Director.  
**Dependency:** a non-publishing production run with usable assets and voice.  
**Acceptance criteria:** at least five complete Shorts cover three formats and three topic categories; each can be reviewed from first frame through loop on a phone-sized display; each has a signed creative verdict covering promise, originality, emotion, identity, and payoff; component tests remain supplementary rather than substitutes.

### EP-03 — P2 — The content promise is coherent, but series identity remains broad and partly randomized

**Verified facts.** The repository describes a fully automated “interesting facts / how it works / how to” Shorts system (`README.md:1-6`), while configuration defines the theme as surprising true stories and facts across five broad domains (`src/config.js:20-27`). Script generation rotates story, how-it-works, process, three-facts, and what-if formats (`src/script/generateScript.js:124-154`). Story/what-if videos are assigned an animated style at random about 40% of the time, while other formats stay photographic (`src/pipeline/run.js:131-142`). The brand presentation does have stable elements: Montserrat typography, `neosaniye` logo text, turquoise accent, and dark motion cards (`src/config.js:157-168`, `src/config.js:318-325`).

**Inference.** The system has a recognizable packaging palette and a coherent umbrella subject, but its editorial identity can vary substantially by topic, format, and randomly selected visual style. A repeat viewer may recognize “curiosity facts” more readily than a distinct NeoSaniye point of view.

**Recommendation for a future implementation task.** Define and validate a compact series bible based on recurring viewer promise, narrator attitude, evidence style, emotional curve, and ending behavior—not merely colors or format rotation.

**Owner:** Executive Producer + Topic Strategy Director.  
**Dependency:** review of representative finished outputs and actual returning-viewer data.  
**Acceptance criteria:** blinded reviewers can identify the intended NeoSaniye episode above chance among comparable faceless Shorts for stated editorial reasons; all formats preserve the same viewer promise and voice; visual-style selection is justified by story fit rather than randomness alone.

### EP-04 — P2 — The prompts establish a strong narrative/product intent, but automated compliance is not proof of originality or emotion

**Verified facts.** The writer prompt requires 85–100 spoken words, 8–11 scenes, a question→mystery→evidence→reveal→twist→answer→payoff→loop arc, new information in every beat, varied spoken rhythm, and explicit hook-to-finale closure (`src/script/generateScript.js:206-245`). The DP prompt requires shot variety, visual continuity, real/archive evidence, explanatory graphics, semantic relevance, and rejects AI-only runs (`src/crew/visualDirector.js:118-169`). The edit planner asks music to follow an emotional curve and places subscription messaging after payoff or omits it (`src/crew/editorDirector.js:81-95`).

**Verified counter-evidence.** The deterministic “human eye simulation” derives boredom and swipe risk from duration, source type, pattern interruption, and semantic-relevance thresholds (`src/pipeline/editorCritique.js:14-40`); its overall retention risk is then mapped directly from the internal score (`src/pipeline/editorCritique.js:85-95`). The system therefore evaluates proxies for craft, not a human’s response to originality, emotional specificity, performance, or meaning.

**Inference.** The creative architecture is stronger and more repository-specific than generic advice, but repeated use of a fixed “high-retention shape” can become formulaic. Emotional impact is requested in prompts but not meaningfully observed in output.

**Recommendation for a future implementation task.** Add whole-video human rubric data and explicitly score whether a beat feels surprising because of content, not because it occupies a required structural label.

**Owner:** Executive Producer + Story and Retention Director.  
**Dependency:** golden reel from EP-02.  
**Acceptance criteria:** reviewers separately rate promise clarity, novelty, emotional movement, payoff satisfaction, and synthetic/formulaic feel; internal QC is calibrated against those ratings; failures cannot be cleared merely by increasing scene or pattern-interrupt counts.

### EP-05 — P2 — The analytics loop is directionally useful but cannot yet validate the core creative promise

**Verified facts.** Pipeline orchestration refreshes YouTube statistics and requests a performance brief before script generation (`src/pipeline/run.js:67-85`). The analyst requires at least six viewed videos and groups performance by format, visual style, and topic category (`src/crew/analyst.js:14-27`, `src/crew/analyst.js:122-153`). However, the active experiment documentation says YouTube Analytics integration is not yet connected and its richer metrics remain null rather than fabricated (`docs/publishing-experiment.md:27-30`). The planned decision uses medians, requires at least seven samples per slot, and avoids declaring a winner from one viral result (`docs/publishing-experiment.md:32-46`). Existing local published-video records show only raw views/likes/comments for older examples, including 2 and 4 views in the first two records (`data/videos.json:97-112`, `data/videos.json:209-224`).

**Inference.** The feedback loop can bias future production using sparse raw views before it can observe whether viewers accepted the promise, completed the story, rewatched, subscribed, or returned. That is insufficient to validate series identity or emotional payoff and can overfit distribution noise.

**Recommendation for a future implementation task.** Keep creative strategy briefs inactive or explicitly low-confidence until retention, rewatch, conversion, and returning-viewer data meet minimum samples; pair those metrics with human whole-video ratings.

**Owner:** Executive Producer + YouTube Analytics Director.  
**Dependency:** Analytics data access and metric definitions.  
**Acceptance criteria:** strategy briefs disclose sample size and metric coverage; no format/style winner is asserted from raw views alone; decisions use predefined windows and minimum samples; returning-viewer or subscriber-conversion evidence is included before claiming series-building impact.

### EP-06 — P2 — Stored production examples show legacy creative output that no longer represents the current promise

**Verified facts.** The three checked-in example scripts use a legacy `hook`/`body` format, generic calls to action, and broad visual keyword lists rather than the current scene schema (`examples/script-01-the-mystery-of-yawning.json:2-14`, `examples/script-02-why-the-sky-is-blue.json:2-15`, `examples/script-03-the-taste-of-chili-peppers.json:2-15`). Persisted published records likewise show eight-scene AI-only runs for Great Emu War (`data/videos.json:47-95`) and Voynich Manuscript (`data/videos.json:159-207`), while the current DP prompt explicitly treats three consecutive AI stills as failure (`src/crew/visualDirector.js:165-169`).

**Inference.** A new contributor or reviewer could mistake obsolete examples for the current intended viewing experience. The gap also makes progress difficult to judge: current creative claims are documented against outputs produced under older rules.

**Recommendation for a future documentation task.** Mark legacy examples and stored records clearly, then add current-schema, non-published reference packages once representative outputs exist.

**Owner:** Executive Producer + Software Reliability Engineer.  
**Dependency:** EP-02 golden reel and provenance-safe artifact storage.  
**Acceptance criteria:** every example declares schema/version and whether it represents current production; at least one current reference exists for each supported format; reviewers cannot confuse historical published records with current acceptance exemplars.

## Evidence table

| ID | Verified fact | Evidence (`path:line`) | Confidence | Assumption/unknown |
| --- | --- | --- | --- | --- |
| E-01 | NeoSaniye is an automated faceless Shorts pipeline for facts/how-it-works/how-to content. | `README.md:1-6` | High | Whether viewers perceive that promise consistently is unknown. |
| E-02 | Writer prompt mandates a defined retention arc, short word budget, new information, payoff, and loop. | `src/script/generateScript.js:206-245` | High | Prompt compliance and emotional effectiveness are not established. |
| E-03 | Five formats rotate with explicit weights and different topic-to-footage requirements. | `src/script/generateScript.js:124-154` | High | Audience preference for this mix is not yet established. |
| E-04 | DP instructions demand continuity, evidence graphics, semantic relevance, and mixed sources. | `src/crew/visualDirector.js:118-169` | High | Finished outputs following these instructions are unavailable locally. |
| E-05 | Default QC warns rather than blocks, and 90 is not an upload gate. | `src/config.js:69-81` | High | Whether environment overrides change live behavior was not verified. |
| E-06 | Three recent records at 81–82 were publish-eligible despite `productionReady:false`. | `data/qc-history.jsonl:1-3` | High | Actual platform success and audience response are absent from these rows. |
| E-07 | Fourth recent record scored 85, below the 90 target. | `data/qc-history.jsonl:4` | High | It records no actual publish time, so final publishing outcome is unknown. |
| E-08 | Real production renders are explicitly absent from local acceptance evidence. | `artifacts/motion/acceptance/acceptance-report.md:3-8` | High | A complete artifact may exist remotely but was not available here. |
| E-09 | Bee evidence is explicitly synthetic, though it exercises real code paths. | `artifacts/regression/bee-before-after.md:1-5` | High | It cannot establish full-episode creative quality. |
| E-10 | The “human eye” forecast is a deterministic heuristic based on coded proxies. | `src/pipeline/editorCritique.js:14-40` | High | Correlation with actual human judgments is unknown. |
| E-11 | Rich experiment analytics are documented as unconnected and null. | `docs/publishing-experiment.md:27-30` | High | Current external account state was not queried. |
| E-12 | Existing example JSON uses an older schema and generic CTAs. | `examples/script-01-the-mystery-of-yawning.json:2-14`; `examples/script-02-why-the-sky-is-blue.json:2-15`; `examples/script-03-the-taste-of-chili-peppers.json:2-15` | High | Examples may be intentionally historical, but they are not labeled as such in-file. |

## Top five creative or technical blockers

1. **P1 — Editorial target has no dependable release authority:** warning mode allows knowingly sub-target work to publish (`src/config.js:69-81`; `data/qc-history.jsonl:1-3`).
2. **P1 — No representative finished Short is available for whole-experience review:** synthetic fixtures cannot validate promise, emotion, continuity, or payoff (`artifacts/motion/acceptance/acceptance-report.md:3-8`).
3. **P2 — Series identity is broad and partly randomized:** five formats and random storybook/photo assignment lack a verified recurring editorial signature (`src/script/generateScript.js:124-154`; `src/pipeline/run.js:131-142`).
4. **P2 — Internal QC proxies are being asked to stand in for human response:** deterministic scores do not verify originality, emotional specificity, or synthetic feel (`src/pipeline/editorCritique.js:14-40`).
5. **P2 — Analytics cannot yet validate repeat-viewer value:** richer metrics are absent, while sparse raw views can feed production strategy (`docs/publishing-experiment.md:27-30`; `src/crew/analyst.js:122-153`).

## Quick wins

- In a separate documentation-only task, label all checked-in examples and stored output records as legacy/current with schema and production date; acceptance: every exemplar has an unambiguous status.
- Add an executive review block to production reports that records promise, payoff, originality, emotional movement, series fit, and reviewer confidence; acceptance: no field is inferred automatically from the QC score.
- Require every strategy brief to display sample count, available metrics, and a low-confidence warning when only views exist; acceptance: raw-view-only briefs cannot use “performs best” without qualification.
- Create a read-only index of representative finished artifacts when they become available; acceptance: reviewers can find the complete video, script, report, and provenance without accessing production credentials.
- Treat any below-target publish decision as an explicit exception in operational reporting; acceptance: exception owner and rationale are visible beside eligibility.

## Structural improvements

1. **Establish a golden-reel approval system.** Preserve five to ten representative, rights-safe finished Shorts spanning formats and categories. Review them as complete phone experiences, not as prompt compliance. Use these to define the actual product bar.
2. **Separate release safety, editorial readiness, and experimentation.** A technically safe upload, a creatively approved episode, and an intentionally published experiment are different states. Preserve those meanings in the release decision and reporting.
3. **Codify a series bible around a viewer contract.** Define what NeoSaniye always promises, how its narrator relates to the viewer, how evidence appears, what emotional turn occurs, and how endings reward attention. Allow format variety inside that contract.
4. **Calibrate automation against people and outcomes.** Compare deterministic QC with blinded human whole-video judgments and actual first-three-second, completion, rewatch, share, subscriber-conversion, and returning-viewer metrics before treating score movement as product improvement.
5. **Version creative exemplars and rules together.** A report or example generated under old prompts must not be accepted as proof of current output. Tie reference artifacts to prompt/QC versions and production metadata.

## Experiments to run

| Hypothesis | Change | Control | Sample/window | Guardrail | Decision rule |
| --- | --- | --- | --- | --- | --- |
| A consistent narrator attitude and evidence style creates stronger series recognition than palette alone. | Apply a written series bible to matched topics. | Current prompts/branding without the bible. | Minimum 10 published pairs or an explicitly exploratory pilot if traffic is insufficient. | Same slot mix, format balance, length band, and production quality. | Adopt only if blinded recognition and returning-viewer/subscriber conversion improve without reducing completion. |
| Human review of sub-90 work prevents weak releases better than warning-only automation. | Require one whole-video approval for sub-target episodes. | Historical warning-mode cohort. | First 20 eligible productions. | Do not publish legally/technically unsafe work; record reviewer disagreement. | Continue if rejection reasons predict lower human ratings or audience retention and throughput cost remains acceptable. |
| Story-fit visual style outperforms random style selection. | Choose photo/animated via an explicit story-fit rubric. | Existing approximately 40% random animated choice for story/what-if. | At least 10 comparable episodes per arm. | Balance categories and topic showability. | Replace randomness only if completion/rewatch and human coherence ratings improve with no material originality loss. |
| A distinctive payoff formulation improves satisfaction and loops without feeling formulaic. | Test a series-specific payoff/return motif. | Current generic hook-to-finale overlap approach. | 20 episodes across at least three formats. | Human reviewers flag forced/incomplete endings. | Adopt if payoff satisfaction and rewatch improve while synthetic/formulaic ratings do not worsen. |
| Strategy based on richer audience signals beats view-count grouping. | Activate briefs only after retention/conversion minimums are met. | Briefs based on available raw views. | Predefined 28-day or sufficiently sampled cohort. | No winner below minimum sample; disclose confounding. | Prefer richer strategy only if future episodes improve APV/rewatch/subscriber conversion, not merely views. |

## Metrics that would validate improvement

- **Viewer promise:** viewed-versus-swiped-away and first-three-second retention, segmented by hook/format; establish a baseline before setting a target.
- **Payoff and completeness:** completion rate and average percentage viewed, with duration-normalized comparisons.
- **Rewatch loop:** replay/rewatch proxy and APV above 100%, interpreted alongside duration and distribution source.
- **Emotional/share value:** shares and saves per 1,000 views plus blinded human emotional-impact ratings.
- **Series identity:** subscriber conversion per 1,000 views, returning-viewer rate, and blinded recognition of NeoSaniye’s editorial signature.
- **Originality/synthetic feel:** reviewer rubric scores and repeated-template flags; these must not be substituted with pattern-interrupt counts.
- **Release calibration:** false-pass/false-reject rate of internal QC against human approval and later audience outcomes.
- **Data quality:** metric coverage, sample count, observation window, and missingness shown for every strategic conclusion.

No numeric uplift is claimed because the repository contains neither a stable audience baseline for these measures nor enough connected analytics data to justify one (`docs/publishing-experiment.md:27-30`, `docs/publishing-experiment.md:42-46`).

## Risks and regressions

- Tightening creative release control without calibrated human review could halt useful experiments or overfit one reviewer’s taste; mitigate with explicit exceptions and disagreement records.
- A stronger series bible could become formulaic; guard with novelty ratings and format diversity rather than enforcing identical structures.
- Preserving finished artifacts can create storage, privacy, or licensing exposure; retain only rights-safe review assets with provenance and access rules.
- Story-fit style selection could reduce visual experimentation; keep a controlled exploratory allocation.
- Human review may not scale at three daily slots; sample-based review or staged rollout is safer than pretending automation already predicts taste.
- Optimizing early-retention metrics alone may encourage sensational promises that damage payoff trust; evaluate opening and satisfaction together.
- Analytics-driven creative changes may be confounded by topic, slot, distribution, and sample size; use matched cohorts and predefined decision rules.
- Updating examples without versioning could erase useful historical evidence; preserve legacy status rather than overwriting records.

## Final P0/P1/P2/P3 list

- **P0:** None verified within this executive-product audit. Legal, factual, duplicate-upload, and corrupt-output determinations belong to their specialist audits.
- **P1:** EP-01 release policy permits work below the declared creative target; EP-02 representative finished-product evidence is absent, preventing a defensible whole-experience approval.
- **P2:** EP-03 broad/partly randomized series identity; EP-04 prompt/QC compliance does not validate originality or emotional impact; EP-05 analytics cannot yet validate the core creative promise; EP-06 legacy examples do not represent current intended output.
- **P3:** Create clearer exemplar indexing and executive-review documentation after P1/P2 evidence foundations exist.

## “No files were modified” confirmation

No files were modified.
