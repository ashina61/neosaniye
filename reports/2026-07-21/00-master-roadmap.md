# NeoSaniye AI Orchestra — Master Roadmap

**Synthesis date:** 2026-07-21  
**Mode:** Read-only audit synthesis; no implementation tasks are created here  
**Evidence base:** 13 completed specialist reports plus direct repository inspection

## Executive verdict

NeoSaniye is a capable automated media pipeline with a credible technical preflight core, but it is not yet safe for unattended publishing and cannot yet prove that its finished Shorts meet its own creative promise. The repository’s strongest mechanisms are technical: complete-file decode checks, loudness and stream validation, final-mix SFX measurement, deterministic motion checks, structured prompts, and a real—though incomplete—YouTube feedback loop. Its weakest mechanisms sit at the two ends of production: evidence before publishing and durable truth after publishing.

Three P0 root causes must be resolved before creative scaling:

1. Material claims and selected assets can publish without claim-source approval, complete rights evidence, or verification that the visible subject matches the narration. Published records contain disputed science stated as settled, `license:null` music, and a Bermuda building used for Parliament (`reports/2026-07-21/13-fact-check-license-director.md`, “Executive verdict”; `data/videos.json:4452-4458`, `data/videos.json:4521-4539`; `src/audio/musicSelect.js:91-110`).
2. Remote publishing occurs before durable production state. Ambiguous upload success, a crash, or a timeout can leave a live post with no local/Firestore identity, after which a rerun can create another (`reports/2026-07-21/15-software-reliability-engineer.md`, “P0 — Remote upload precedes durable intent/state”; `src/pipeline/run.js:406-456`, `src/pipeline/run.js:531-600`).
3. The existing release decision does not consume factual/licensing readiness and treats creative readiness as advisory in default warning mode. Recent records can be `productionReady:false` yet upload-eligible by override (`reports/2026-07-21/01-executive-producer.md`, “EP-01”; `reports/2026-07-21/12-editorial-qc-director.md`, “Executive verdict”; `src/config.js:69-81`; `data/qc-history.jsonl:1-3`).

After those safety foundations, the highest-leverage creative change is not another isolated effect. It is a retained, reviewable final-output evidence package tied to one shared spoken timeline. Hook, story, visual, edit, captions, sound, voice, and QC specialists independently found that the system plans or scores metadata rather than the combined rendered experience. The next creative layer should therefore align decisions to actual spoken beats, preserve complete representative outputs, and calibrate approval against human review and real platform outcomes.

This roadmap contains ten initiatives. Initiatives 1–3 are publishing-safety work. Initiatives 4–9 are creative-quality and measurement work. Initiative 10 is engineering efficiency and must follow correctness baselines. No claimed viewer uplift or speedup is invented; impact ratings are directional inferences from the cited failure modes.

## Audit coverage and gaps

### Completed reports read

- `01-executive-producer.md`
- `03-hook-director.md`
- `04-story-retention-director.md`
- `05-visual-director.md`
- `06-film-editor.md`
- `07-motion-design-director.md`
- `08-caption-typography-director.md`
- `09-sound-design-director.md`
- `10-tts-voice-director.md`
- `11-youtube-analytics-director.md`
- `12-editorial-qc-director.md`
- `13-fact-check-license-director.md`
- `14-ffmpeg-performance-engineer.md`
- `15-software-reliability-engineer.md`

### Missing specialist coverage

Reports `02-topic-strategy-director.md` and any reports numbered outside the user-supplied set are absent from `reports/2026-07-21/`. The orchestrator instructions refer broadly to reports `01` through `15`, but only the 13 reports listed above exist. Topic identity, topic-to-format fit, repeat-viewer strategy, and the topic-selection feedback loop are therefore covered only indirectly by the Executive Producer, Story/Retention, and YouTube Analytics reports. No consensus is claimed from a missing Topic Strategy report.

### Repository areas inspected

The synthesis checked `README.md`, `docs/`, `src/`, `scripts/`, `test/`, `.github/workflows/`, `config/`, `package.json`, retained state, and artifacts. One documentation inconsistency matters operationally: `README.md` still describes cron as off while `.github/workflows/daily-short.yml:22-35` contains active schedules. This is a P3 documentation issue, not a separate roadmap initiative.

### Evidence limitations

- No representative complete current production Short is retained in the repository. Available MP4/contact-sheet evidence is described as synthetic regression or acceptance material (`artifacts/regression/bee-before-after.md:1-5`; `artifacts/motion/acceptance/acceptance-report.md:3-8`). Full-experience judgments are therefore unverified.
- Real external platform/account state was not queried. Upload ambiguity, analytics availability, and rights conclusions are based on repository behavior and records.
- No end-to-end performance benchmark or Actions RSS/disk telemetry exists. Performance gains remain hypotheses requiring measurement (`reports/2026-07-21/14-ffmpeg-performance-engineer.md`, “Executive verdict”).
- Specialist reports differ in whether some issues are P0 or P1; those differences are preserved below.

## Areas of consensus

1. **The current editorial QC does not predict the rendered human experience.** Executive, Hook, Story, Visual, Film Editing, Motion, Captions, Sound, Voice, and Editorial QC reports all identify metadata/proxy scoring or missing final-output review. Underlying examples include hook scoring from lexical/length features, unmeasured visual relevance receiving credit, and preview extraction occurring after the upload decision (`src/pipeline/retentionQC.js:140-209`; `src/pipeline/run.js:326-377`, `src/pipeline/run.js:523-528`).
2. **One spoken, beat-level timeline is missing.** Film Editing, Sound, Voice, Captions, Story, and FFmpeg reports converge on word-count scene allocation, transition-centered SFX, estimated caption timing, and absent performance intent (`src/video/renderVideo.js:820-845`, `src/video/renderVideo.js:658-680`; `src/tts/edgeTts.js:49`; `src/crew/editorDirector.js:25-37`).
3. **Visual intent exceeds implemented visual proof.** Visual and Motion agree that returned assets are not inspected robustly, AI-still runs create slideshow risk, the graphics vocabulary is essentially a steps card, and Ken Burns movement is index-driven rather than focal/explanatory (`src/pipeline/run.js:353-360`; `src/media/renderTemplate.js:166`; `src/video/renderVideo.js:296-336`). Fact/License independently confirms that wrong visual evidence reached a published record.
4. **Platform analytics cannot diagnose creative failure.** Executive, Hook, Story, Analytics, and Editorial QC agree that first-second/first-three-second behavior, viewed-versus-swiped, curves, completion, shares, saves, and returning viewers are missing or placeholders; raw unequal-age views are overused (`src/analytics/experimentMetrics.js:20-47`; `src/crew/analyst.js:41-93`).
5. **Publishing state is not recoverable enough for unattended operation.** Reliability finds no durable pre-upload intent, per-platform state, or ambiguous-outcome reconciliation. FFmpeg independently notes that temporary render lifecycle is non-resumable (`src/pipeline/run.js:406-600`; `src/video/renderVideo.js:1114-1115`).
6. **Safety and creative readiness must be distinct.** Executive and Editorial QC explicitly separate technical publishability from series-worthy quality; Fact/License requires hard safety gates; Reliability requires durable publishing state. A single heuristic score must not represent all three.
7. **No specialist supports lowering media quality or removing safeguards as the default performance solution.** FFmpeg calls for identity/equivalence benchmarks; Editorial QC emphasizes retaining exact-output checks.

## Areas of disagreement

| Issue | Positions and evidence | Orchestrator decision / remaining unknown |
|---|---|---|
| Should score 90 be a hard automatic release gate? | Executive and Editorial QC object to warning-mode publication below the declared target, but both also show that the score is uncalibrated and can reward generic proxy-conforming content (`reports/2026-07-21/01-executive-producer.md`, “EP-01”; `reports/2026-07-21/12-editorial-qc-director.md`, “EQC-01–12”). | **Do not hard-code 90 as truth.** Hard-block legal/factual/technical/reliability failures. For creative readiness, require explicit rendered review or a recorded experimental override until the score is calibrated. Whether 85, 90, or another threshold predicts audience quality remains unknown. |
| Severity of the Guy Fawkes wrong visual | Visual Director assigns P0 because a published contradictory subject invalidates historical proof (`reports/2026-07-21/05-visual-director.md`, “VD-01”). Fact/License assigns the specific Guy Fawkes item P1 while assigning the absent overall fact/license gate P0 (`reports/2026-07-21/13-fact-check-license-director.md`, “FCL-03/FCL-12”). | Preserve the severity dissent for the individual record. The **systemic ability to publish contradictory evidence is P0** under the orchestra definition because it can invalidate a factual production. |
| Can technical QC substitute for human review? | Editorial QC credits a strong exact-file technical core; creative specialists say it cannot establish pacing, visual truth, readability, voice, or sound quality. | Both are correct at different layers. Keep automated technical checks; add rendered evidence and human approval during calibration. Unknown: which creative checks can later be automated reliably. |
| Integrate CTA into the main render now? | FFmpeg identifies the second H.264/AAC generation as P1 and proposes integration; Motion values CTA’s isolated validation/fallback system (`src/motion/ctaRenderer.js:56-83`; `src/motion/ctaEngine.js:72-100`). | Defer integration until golden-output and validation parity exist. First remove only proven redundant work with identity tests. CTA consolidation remains conditional on visual/audio and fallback equivalence. |
| Is universal story structure inherently bad? | Story report shows the fixed arc sometimes produces genuine causal curiosity (honeycomb) but often produces cosmetic labels or premature resolution. | Retain the arc as optional scaffolding, not a scoring truth. Require explicit evolving viewer questions and format-fit evidence. Which formats need which arc remains open because report 02 is missing. |
| Should missing external data block all production? | Analytics recommends honest missingness and fixed windows; Executive still wants controlled experiments; Fact/License and Reliability require fail-closed behavior for safety/state evidence. | Missing **safety/state** evidence blocks publishing. Missing **audience** evidence lowers decision confidence but permits explicitly labeled experiments. Do not conflate the two.

## Duplicate findings merged

| Merged root finding | Specialist source IDs | Consolidated disposition |
|---|---|---|
| No defensible pre-publish fact/rights/visible-subject evidence | VD-01–03; FCL-01–05, FCL-07–12; EQC-07 | Initiatives 1 and 3 |
| Upload eligibility does not represent safe, creative, and operational readiness separately | EP-01; EQC-11–12; FCL-12; reliability P0 findings | Initiatives 1 and 2 |
| No representative final-output review or calibrated editorial QC | EP-02/04; HD-02/08; FE-06/09; VD-06; motion QC P1; caption P1; sound P1; TV-10; EQC-01–12; FFmpeg exact-output P2 | Initiative 4 |
| Timeline is not authored by actual spoken beats | FE-01–03/06; TV-04/05/08; caption timing P1; sound cue P1; SR-08; FFmpeg sync P2 | Initiative 5 |
| Hook and story are selected/scored as parts, not one evolving promise | HD-01–04; SR-01–03; EQC-03–05 | Initiative 6 |
| Visuals/motion decorate more than explain | VD-02–05/07–08; Motion top five; EQC-06–08 | Initiative 7 |
| Sound and voice lack beat-level performance direction and rendered audition | Sound top five; TV-01–10; FE-03; EQC-10 | Initiative 8 |
| Real Shorts outcomes are missing/confounded/placeholders | EP-05; HD-08; SR-04; YA-01–11; EQC-01 | Initiative 9 |
| Repeated encoding/decoding and no safe cache/telemetry | FFmpeg P1/P2 findings; Reliability timeout/artifact findings | Initiative 10 |
| Non-idempotent multi-platform publishing and inconsistent state | Reliability P0/P1 findings; FFmpeg resumability P2 | Initiative 2 |

## Dependency map

```text
1 Safety release policy ───────┐
                               ├──> controlled publishing
2 Durable publishing ledger ──┤        │
                               │        ├──> 9 trustworthy outcome analytics
3 Evidence/provenance system ─┘        │
        │                               │
        └──> 4 rendered review + QC calibration
                  │
                  ├──> 5 shared spoken timeline
                  │       ├──> 6 unified hook/story design
                  │       └──> 8 voice/sound performance
                  └──> 7 explanatory visuals/motion

4 correctness baselines + 2 recovery identity ──> 10 performance/cache optimization
```

Initiative 1 can begin as a conservative quarantine policy, but its complete automated gate depends on Initiative 3’s evidence records and Initiative 2’s durable release state. Initiative 9 depends on stable platform IDs from Initiative 2. Initiative 10 depends on Initiative 4’s golden outputs and Initiative 2’s stable production identity so optimizations can prove equivalence and cache correctness.

## Prioritized roadmap initiatives

### 1. P0 — Establish a fail-closed publishing-safety decision

- **Class:** Publishing safety
- **Owner:** Fact-check/License Director + Editorial QC Director + Software Reliability Engineer
- **Source findings:** FCL-01/02/05/07/12, VD-01, EQC-11/12, EP-01
- **Expected viewer impact:** High indirect impact—prevents false, contradictory, or undefendable releases; does not promise retention uplift.
- **Engineering cost:** Medium
- **Risk:** Medium; an initially conservative gate may reduce throughput.
- **Dependencies:** Starts immediately; full automation depends on Initiatives 2 and 3.
- **Recommended order:** 1
- **Claude Code first:** **Yes—first tranche.** Start with narrow characterization tests and conservative blockers for already-verifiable unsafe states; this minimizes quota use and avoids broad creative rewrites.
- **Acceptance criteria:**
  - No platform publisher is called when a material claim lacks approved evidence, an asset lacks required rights/provenance, a visible-subject check is unresolved, `script.duplicate === true`, or production state authority is unavailable.
  - Technical safety, factual/licensing safety, editorial readiness, and experimental override are separate persisted fields.
  - A creative override cannot bypass P0 factual, rights, corrupt-output, duplicate, or remote-unknown conditions.
  - Fixtures for disputed claims, `license:null` music, missing ambience provenance, wrong-place imagery, duplicate content, and state outage all fail closed.
  - Any creative exception records owner, reason, evidence package, and expiry; no record is both `productionReady:false` and silently eligible solely because warning mode is default.

### 2. P0 — Build a durable idempotent production and multi-platform publishing ledger

- **Class:** Publishing safety / reliability
- **Owner:** Software Reliability Engineer
- **Source findings:** Reliability P0 upload-before-state and ambiguous-outcome findings; partial platform/state P1 findings; FFmpeg resumability P2
- **Expected viewer impact:** Neutral creatively; critical operational trust and duplicate prevention.
- **Engineering cost:** High
- **Risk:** High because it changes side-effect ordering and recovery semantics.
- **Dependencies:** Initiative 1 defines release states; supplies stable IDs to Initiatives 3, 4, 9, and 10.
- **Recommended order:** 2
- **Claude Code first:** **Yes, but only after Initiative 1’s characterization tests.** Claude should first implement/test the ledger contract with fake publishers before any live-path migration.
- **Acceptance criteria:**
  - A deterministic production ID/content fingerprint and durable intent exist before any remote create.
  - YouTube, Instagram, and Facebook each persist `pending/uploading/remote_unknown/published/failed_retryable/failed_terminal`, attempt count, timestamps, remote/session/container IDs, and sanitized errors.
  - Killing the process after every remote boundary and rerunning creates at most one post per platform.
  - If one platform fails, rerun calls only that platform; overall status remains `published_partial` until convergence.
  - Firestore is the declared unattended-production authority and fails closed when unavailable; local state never silently replaces stale production truth.
  - Video record and topic reservation are deterministic and transactional; local development writes are atomic and corruption-visible.
  - A timeout produces a resumable/reconcilable state, not an untracked failure record.

### 3. P0 — Create claim, asset-rights, and visual-subject evidence records

- **Class:** Publishing safety / factual and licensing integrity
- **Owner:** Fact-check/License Director + Visual Director
- **Source findings:** FCL-01–12; VD-01–03/07; EQC-07
- **Expected viewer impact:** High trust and credibility; moderate likely improvement in visual relevance.
- **Engineering cost:** High
- **Risk:** Medium-high; stricter exact-entity requirements may reduce asset availability.
- **Dependencies:** Initiative 2 supplies stable production/asset IDs; Initiative 1 consumes disposition.
- **Recommended order:** 3
- **Claude Code first:** **Yes—schema, persistence, and fail fixtures first.** Research judgment and actual approvals should remain human/expert-led initially.
- **Acceptance criteria:**
  - Every material claim has a claim ID, exact wording, source URL/citation, source class, confidence, supported/hedged wording, reviewer/disposition, and link to scene/narration.
  - Every stock/archive/music/ambience/SFX/AI asset records provider, provider asset ID, source URL, creator, license/terms version or evidence snapshot, attribution requirement/text, acquisition timestamp, and content hash; AI also records model/provider/prompt version/seed or equivalent generation ID.
  - Returned assets—not merely search queries—are checked for required/forbidden people, places, objects, species, and events.
  - The Guy Fawkes winery/Bermuda fixtures, null-license legacy music, and unproven magnetoreception wording cannot receive publish-ready disposition.
  - Unknown evidence produces quarantine or a labeled explanatory alternative, never a loosely related substitute.

### 4. P1 — Retain final-output evidence and calibrate editorial release authority

- **Class:** Creative quality / QC
- **Owner:** Executive Producer + Editorial QC Director
- **Source findings:** EP-01/02/04; HD-02/08; VD-06; FE-09; Motion QC P1; caption/sound/voice rendered-review P1; EQC-01–14
- **Expected viewer impact:** High; enables real diagnosis and prevents proxy-compliant weak releases.
- **Engineering cost:** Medium
- **Risk:** Low-medium; storage and human-review throughput increase.
- **Dependencies:** Initiatives 1–3 for safe release/evidence identity; baseline for Initiatives 5–10.
- **Recommended order:** 4
- **Claude Code first:** **Yes—best low-regression creative tranche.** Artifact generation, report linking, abstention semantics, and characterization tests are bounded and measurable.
- **Acceptance criteria:**
  - Each candidate retains the exact final MP4 checksum, scene-boundary contact sheet, hook frames, reveal/payoff frames, caption-heavy frames, audio review proxy, script, timeline, provenance, QC report, and release disposition under one production ID.
  - A reviewer can watch/audition the complete phone-format output before creative approval and record approval, rejection reasons, confidence, and disagreement.
  - Automated QC distinguishes measured technical facts, editorial proxies, abstentions, human approval, and audience outcomes.
  - Missing captions/relevance/render evidence cannot earn perfect scores; generic repetitive fixtures no longer qualify as strong solely through lexical structure.
  - A calibration set contains at least 5–10 rights-safe current-format finished Shorts spanning formats/categories, with blinded human ratings. Threshold changes require evidence from this set and later platform outcomes.

### 5. P1 — Establish one spoken, frame/sample-accurate editorial timeline

- **Class:** Creative quality / synchronization
- **Owner:** Film Editor + TTS/Voice Director + Caption Director
- **Source findings:** FE-01–06; TV-04/05/08; caption timing P1; SR-08; sound cue timing P1; FFmpeg sync P2
- **Expected viewer impact:** High—better comprehension, reveal timing, vocal rhythm, and caption trust.
- **Engineering cost:** High
- **Risk:** High; changes established timing across video, captions, audio, and CTA.
- **Dependencies:** Initiative 4 golden outputs; supports Initiatives 6 and 8.
- **Recommended order:** 5
- **Claude Code first:** **No.** Begin only after golden fixtures and timing contracts exist; use Claude later for bounded parser/timeline tests, not an immediate pipeline rewrite.
- **Acceptance criteria:**
  - Approved narration text, TTS/ASR tokens, scene boundaries, captions, cut points, SFX/music cues, CTA, and validation windows share one explicit integer frame/audio-sample timebase.
  - Piper/ASR output is reconciled to approved text; Edge estimates are labeled and confidence-gated rather than treated as exact.
  - Scene cuts and reveal hits can target actual words/pauses; risers end at their intended reveal rather than begin at a transition midpoint.
  - Known-marker fixtures keep caption/cut/SFX errors within declared frame/millisecond tolerances at start, boundaries, CTA, and end.
  - Existing A/V duration, technical preflight, and final-output hard gates remain passing with no new clipping, gaps, or lost captions.

### 6. P1 — Design and validate a unified hook-to-payoff question system

- **Class:** Creative quality / retention
- **Owner:** Hook Director + Story/Retention Director + Executive Producer
- **Source findings:** HD-01–08; SR-01–09; EQC-03–05
- **Expected viewer impact:** Very high if validated; directly targets scroll-stop, curiosity continuity, payoff, and rewatch.
- **Engineering cost:** Medium-high
- **Risk:** Medium; over-constrained templates can reduce originality.
- **Dependencies:** Initiatives 4 and 5; Initiative 9 validates outcomes.
- **Recommended order:** 6
- **Claude Code first:** **No for creative generation changes.** Claude may later implement deterministic evidence fields/tests after directors define the editorial contract.
- **Acceptance criteria:**
  - Each hook candidate is evaluated as one package: first frame, overlay, first spoken clause, first subtitle, first movement, first sound, first transition, and promised payoff.
  - Hook selection cannot reach maximum without demonstrated multimodal promise alignment and first-three-second pacing evidence.
  - Every story persists the viewer’s active question per beat, what changes, what remains unresolved, and how the payoff answers or deliberately reframes it.
  - Premature-answer, stalled-question, unseeded-payoff, lexical-loop-only, and generic-connector fixtures fail editorial review.
  - Fixed arc labels are optional scaffolding; at least three format-specific structures are evaluated on matched topics.
  - Adoption requires improved blinded hook/story ratings and, when available, first-second/three-second retention, completion, and rewatch without factual-quality regression.

### 7. P1 — Replace decorative visual motion with evidence-led explanatory visuals

- **Class:** Creative quality / visual communication
- **Owner:** Visual Director + Motion Design Director
- **Source findings:** VD-02–08; Motion top five; EQC-06–08
- **Expected viewer impact:** High—clearer proof, lower slideshow feel, stronger comprehension.
- **Engineering cost:** High
- **Risk:** Medium-high; added graphics can increase cognitive load or introduce factual errors.
- **Dependencies:** Initiative 3 evidence records; Initiative 4 rendered review; Initiative 5 timing.
- **Recommended order:** 7
- **Claude Code first:** **No for the full system.** A single map/comparison prototype may follow approved visual specifications and golden fixtures.
- **Acceptance criteria:**
  - The media plan distinguishes proof, context, mechanism, comparison, map/timeline, archive, and emotional/reaction functions.
  - Implemented vocabulary includes at minimum validated map/route, labeled mechanism/cross-section, comparison, and timeline forms—not only text-step cards.
  - Camera paths consume focal/region-of-interest data; live footage and deliberately composed graphics are not automatically subjected to generic Ken Burns.
  - No three-item AI-still run passes without a documented information change; same-prompt splits do not count as explanatory diversity.
  - Rendered review verifies subject truth, crop, continuity, graphic legibility, and narration alignment; wrong-place/object fixtures fail.

### 8. P1 — Author voice, music, and sound as beat-level performance

- **Class:** Creative quality / audio
- **Owner:** TTS/Voice Director + Sound Design Director + Film Editor
- **Source findings:** TV-01–10; Sound top five; FE-03; EQC-10
- **Expected viewer impact:** Medium-high—stronger emotion, clarity, reveal impact, and phone translation.
- **Engineering cost:** Medium-high
- **Risk:** Medium; excessive direction/SFX can reduce naturalness or mask speech.
- **Dependencies:** Initiatives 4 and 5; Initiative 6 supplies dramatic beats.
- **Recommended order:** 8
- **Claude Code first:** **No.** Performance vocabulary and listening criteria need director approval before implementation.
- **Acceptance criteria:**
  - Narration plan carries pace, pause, stress, pronunciation, number/name normalization, and emotional intent per beat; provider/fallback identity changes are visible and approval-gated.
  - A pronunciation lexicon/fixture covers current historical/scientific proper names and numbers; approved text remains caption-aligned.
  - Music has hook/build/reveal/payoff arc markers; SFX include story-world/foley/ambience choices rather than only four transition markers.
  - Cue peaks/ends align to spoken/action beats on the shared timeline.
  - Final mixes pass intelligibility, loudness/true-peak, mono/phone-speaker translation, masking, and human audition checks.

### 9. P1 — Build a real, provenance-labeled Shorts analytics feedback loop

- **Class:** Measurement / creative learning
- **Owner:** YouTube Analytics Director + Topic Strategy Director (report missing) + Executive Producer
- **Source findings:** YA-01–11; EP-05; HD-08; SR-04; EQC-01
- **Expected viewer impact:** High long-term; prevents optimizing internal scores and raw-view confounding.
- **Engineering cost:** Medium-high, subject to platform API availability.
- **Risk:** Medium; sparse/noisy data can drive false conclusions.
- **Dependencies:** Initiative 2 stable platform IDs/status; Initiative 4 human/QC labels.
- **Recommended order:** 9
- **Claude Code first:** **Yes for schema/provenance and fixed-window collection only; no for autonomous strategy changes.** This is bounded and prevents placeholder misuse.
- **Acceptance criteria:**
  - Every metric is labeled `platform`, `derived`, `placeholder`, or `editorial_proxy`, with source, observation window, video age, collected-at time, and missingness reason.
  - Collect fixed-window snapshots for all available genuine fields; never substitute internal QC for viewed-versus-swiped, early retention, completion, rewatch, shares, saves, conversion, or returning viewers.
  - Analyst comparisons control at minimum for age/exposure and report sample size/uncertainty; raw lifetime views cannot alone declare a topic/hook winner.
  - Slot experiment produces a real outcome table only when minimum sample and metric availability rules are satisfied; otherwise it reports “insufficient evidence.”
  - Creative changes are evaluated with predeclared hypotheses and matched/confound-aware cohorts; exploration budget prevents premature convergence.

### 10. P1/P2 — Optimize FFmpeg and Actions only against quality/reliability baselines

- **Class:** Engineering efficiency / scalability
- **Owner:** FFmpeg Performance Engineer + Software Reliability Engineer
- **Source findings:** FFmpeg P1/P2 findings; Reliability timeout/artifact findings
- **Expected viewer impact:** Low direct; moderate indirect through reliable throughput and reduced generational loss.
- **Engineering cost:** Medium-high
- **Risk:** Medium-high if filter order, codec generations, cache identity, or QC coverage changes.
- **Dependencies:** Initiatives 2 and 4; timing-sensitive changes also depend on Initiative 5.
- **Recommended order:** 10
- **Claude Code first:** **Yes only for instrumentation and the isolated AAC-copy experiment.** Do not start with CTA graph fusion, parallelism, or cache rollout.
- **Acceptance criteria:**
  - Actions records per-stage wall time, CPU/encoded speed where available, peak RSS, scratch disk, process count, and remaining job budget.
  - Main mux audio stream-copy is adopted only if demuxed audio identity/compatibility, duration, channels, preflight, and platform playback match baseline (`src/video/renderVideo.js:722-728`, `src/video/renderVideo.js:1105-1112`).
  - CTA integration, QC pass consolidation, SFX batching, normalization concurrency, streaming, and caches each pass golden-output VMAF/SSIM/frame, PCM/LUFS/true-peak, sync, gate-decision, corrupt-fixture, and fallback parity tests.
  - Cache keys include source content, exact timing, configuration, fonts/assets, filter/code version, and FFmpeg version; stale-hit fault tests pass.
  - No default optimization lowers resolution/fps, weakens supersampling/effects, selects hardware encoding, or removes final-output safeguards without explicit quality evidence.

## Claude Code first tranche

To minimize quota consumption and regression risk, Claude Code should receive only bounded, evidence-heavy work after separate implementation tasks are authorized. Recommended first sequence:

1. **Initiative 1:** characterization tests and narrow fail-closed blockers for already explicit unsafe inputs; no creative prompt redesign.
2. **Initiative 2:** ledger schema/state-machine tests with fake publishers and crash points before live-path migration.
3. **Initiative 3:** evidence/provenance schemas, persistence tests, and known-bad fixtures; human/expert approval remains outside automated judgment.
4. **Initiative 4:** final-output artifact indexing, report linkage, abstention semantics, and golden-fixture harness.
5. **Initiative 9:** metric provenance/fixed-window schema and collectors, with strategy automation disabled.
6. **Initiative 10:** observability first, then the isolated main-mux AAC stream-copy experiment.

Initiatives 5–8 should not be handed to Claude Code as broad first changes. They alter coupled creative behavior and need approved golden outputs, editorial contracts, and small separately tested changes. This is prioritization, not a set of implementation tasks.

## Deferred items

- A definitive topic/series strategy initiative is deferred until `02-topic-strategy-director.md` exists. Series identity remains embedded in Initiatives 6 and 9 only as a dependency/measurement concern.
- P3 terminology, score naming, README/workflow synchronization, exemplar indexing, and operational runbooks should follow the underlying state/evidence schemas.
- A generalized cache, CTA graph fusion, hardware encoding, or broad parallel rendering is deferred until Initiative 10 instrumentation and golden equivalence exist.
- Autonomous creative optimization from analytics is deferred until fixed-window outcome data, stable platform identity, and confounding controls exist.
- A fully automated “human eye/ear” approval claim is deferred indefinitely unless predictive validity is demonstrated; automation should abstain when it lacks evidence.

## Final P0/P1/P2/P3 list

### P0

1. Fail-closed publishing-safety decision separating factual/licensing/technical/duplicate safety from creative experimentation.
2. Durable idempotent production and per-platform publishing ledger with ambiguous-outcome reconciliation.
3. Claim-source, asset-rights, AI provenance, and visible-subject evidence records consumed by the safety gate.

### P1

4. Retained final-output evidence and calibrated editorial release authority.
5. Shared spoken, frame/sample-accurate editorial timeline.
6. Unified multimodal hook and evolving-question/payoff system.
7. Evidence-led explanatory visual and motion system.
8. Beat-level voice, music, and sound performance system.
9. Genuine, provenance-labeled, fixed-window Shorts analytics loop.
10. Quality-preserving FFmpeg/Actions optimization for duplicate codec/QC passes and measured resource limits.

### P2

- Content-addressed render/SFX caches, bounded-memory streaming, richer series identity, phrase grouping, text-layer density, and exploratory visual/audio variants are contained within Initiatives 4, 5, 7, 8, and 10 after their P1 foundations.

### P3

- Documentation/glossary cleanup, stale README workflow status, dashboards, runbooks, and exemplar indexing after schemas and operating states stabilize.

No application code, production configuration, specialist report, state file, asset, or workflow was modified. Only this master roadmap was created. No implementation task, upload, commit, or push was performed.
