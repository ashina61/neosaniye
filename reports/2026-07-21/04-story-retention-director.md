# 04 — Story and Retention Director Audit Report

**Audit date:** 2026-07-21  
**Repository revision:** not recorded  
**Scope inspected:** complete repository from the perspective of storytelling and viewer retention, including script schemas/prompts, narration construction, format logic, scene purpose/emotion inference, edit planning and duration allocation, curiosity/payoff/loop QC, pattern-interrupt semantics, persisted scripts and QC history, tests, analytics feedback, documentation, and available artifacts  
**Evidence limitations:** no representative finished production MP4 is available locally; word-level production timings, full production reports, attention forecasts, retention curves, and first/last-frame loop playback are absent. Story judgments below are grounded in persisted narration and repository behavior; audience effects are explicitly labeled as inference until real retention data exists.

## Executive verdict

NeoSaniye can create genuine curiosity, but it does not reliably know when it has done so. Its strongest scripts create a causal chain in which each answer generates the next question. The honeycomb episode is the clearest repository example: “hidden genius” becomes “how do bees build it?”, then the round-cell reversal creates “how do circles become hexagons?”, temperature and surface tension answer that mechanism, efficiency supplies significance, and the ending reframes bees as engineers. That is earned progression, not merely template compliance (`data/videos.json:4671-4706`).

Other scripts follow the prescribed shape cosmetically. Lisbon escalates from earthquake to collapse to fire to tsunami, but its final claim about the Enlightenment and modern seismology arrives as a new consequence rather than the answer to a question the story has been developing (`data/videos.json:4874-4910`). The animals/magnetism episode answers the initial navigation question in scene two, then opens a different and better question—how animals “see” magnetism—only in scene three (`data/videos.json:4506-4542`). Guy Fawkes has a clear causal line, but the anonymous letter itself is revealed midway and the finale largely restates that it stopped the plot rather than deepening the unresolved mystery of who sent it (`data/videos.json:4354-4390`).

The system’s fixed “QUESTION → MYSTERY → EVIDENCE → REVEAL → TWIST → ANSWER → PAYOFF → LOOP” prompt is useful scaffolding, but the deterministic layer mostly identifies those functions by index and keywords. Curiosity points come from scene count, transition words such as “but” and “then,” absence of long audio gaps, finale presence, mechanism graphics, and hedging. Loop closure is a shared-keyword check, and a failed loop produces only a recommendation without reducing the 10-point payoff score. Consequently, a script can earn full curiosity/payoff while its viewer question stalls, changes subject, resolves too early, or receives a merely lexical ending.

The answer to the audit question is therefore: **the system sometimes creates genuine curiosity because the generation prompt and certain outputs form real causal sequences, but its QC and editorial labels primarily verify a fixed template and surface proxies.** It does not yet track the live viewer question beat by beat, prove that each beat changes knowledge/stakes/expectation, or validate story design against moment-level audience retention.

## Verified findings

### SR-01 — P1 — The mandatory universal arc encourages structure, but also template imitation

**Verified facts.** The system prompt requires every script to follow an exact eight-stage arc described as a “10M-view Shorts shape”: question, mystery, evidence, reveal, twist, answer, payoff, loop (`src/script/generateScript.js:206-220`). It also requires every beat to add new information and the last scene to answer the opening question (`src/script/generateScript.js:211-245`). Five formats exist—story, how-it-works, process, three-facts, and what-if—with distinct briefs (`src/script/generateScript.js:124-154`), but all pass through the same global exact-arc instruction (`src/script/generateScript.js:188-252`).

**Inference.** The arc is productive as a discipline, especially for causal explainers, but it does not naturally fit every format. A three-facts list has several mini-loops; a process story may build fascination rather than mystery; a historical consequence story may need causality rather than a twist. Requiring the same labels can generate connective words and finale copy without a genuine change in the viewer’s question.

**Recommendation for a future implementation task.** Replace the universal beat prescription with format-specific question architecture while preserving the rule that every beat must change knowledge, stakes, or expectation.

**Owner:** Story and Retention Director + Script/Prompt owner.  
**Dependency:** beat-level evaluation and representative audience data.  
**Acceptance criteria:** every supported format declares its intended question progression; scripts are not required to fabricate a twist where none exists; each beat records what the viewer knew before, learns now, and asks next; known strong scripts retain their causal strengths.

### SR-02 — P1 — Retention QC measures curiosity proxies, not evolving viewer questions

**Verified facts.** Curiosity receives points for 6–10 scenes, counts of regex-matched twist words, no word gap over 1.5 seconds, presence of `finale_text`, mechanism-visual coverage, and absence of absolute overclaim (`src/pipeline/retentionQC.js:160-176`). It does not represent a viewer question, detect when it is answered, determine what next question replaces it, or verify that a beat adds information. The scene director assigns the first beat “hook/question,” regex matches reveal/twist, assigns the final two beats answer/payoff by position, and labels intervening beats mystery/evidence by which half of the story they occupy (`src/pipeline/sceneDirector.js:14-39`). Emotional labels are then a fixed lookup from those inferred purposes (`src/pipeline/sceneDirector.js:29-39`).

**Verified output evidence.** Recent productions receive curiosity scores from 10 to 15, with honeycomb and Lisbon both scoring the maximum 15 (`data/qc-history.jsonl:1-4`), although their question progressions differ materially: honeycomb develops a mechanism question, while Lisbon mainly accumulates chronological catastrophe before introducing a final intellectual consequence (`data/videos.json:4671-4706`, `data/videos.json:4874-4910`).

**Inference.** The deterministic labels describe where a beat sits and whether it contains certain words; they do not prove narrative function or emotional response. Full curiosity can mean “the script contains the expected signals,” not “a viewer has an increasingly urgent question.”

**Recommendation for a future implementation task.** Add a beat ledger that explicitly records active question, answer delivered, new question created, novelty, stakes change, and redundancy.

**Owner:** Story and Retention Director + Editorial QC Director.  
**Dependency:** story-specific fixtures with human annotations.  
**Acceptance criteria:** known question-stall, premature-answer, arbitrary-twist, and repeated-information fixtures score worse than causal progressions; keyword insertion alone cannot improve the result; human reviewers can audit the ledger against narration.

### SR-03 — P1 — Payoff and loop scoring can reach 10/10 without semantic closure or earned rewatch design

**Verified facts.** Loop closure is computed by checking whether any extracted finale keyword appears in the hook keywords (`src/pipeline/retentionQC.js:95-98`). The payoff score itself awards four points for any nonempty `finale_text`, three for a short tail, and three for a sufficiently late/absent CTA; lack of lexical loop closure only adds a recommended fix and does not subtract points (`src/pipeline/retentionQC.js:247-275`). Recent honeycomb and Lisbon records both have `payoffAndLoopScore:10` (`data/qc-history.jsonl:3-4`). Honeycomb’s hook is “Honeycomb's impossible secret” and finale is “nature's perfect geometry,” which share no obvious extracted content keyword; Lisbon’s hook/finale share “quake/Europe,” but the ending introduces seismology rather than visually/narratively returning to the opening festivities (`data/videos.json:4671-4706`, `data/videos.json:4874-4910`).

**Inference.** Reusing a noun can pass the loop heuristic without creating a rewatch transition, while a semantically satisfying ending can fail if it paraphrases rather than repeats. More importantly, the score can remain perfect even when `loop.closed` is false. The metric name overstates what it establishes.

**Recommendation for a future implementation task.** Separate payoff satisfaction, question closure, and replay transition; evaluate each semantically and on rendered audio/visual continuity.

**Owner:** Story and Retention Director + Editorial QC Director + Film Editor.  
**Dependency:** final-to-first playback evidence and human ratings.  
**Acceptance criteria:** 10/10 requires the opening promise to be answered, the final beat to add meaning rather than restate a label, and the cut back to frame one to be coherent; lexical overlap alone is insufficient; semantically equivalent paraphrases can pass.

### SR-04 — P1 — Analytics feedback cannot diagnose story beats or distinguish genuine curiosity from distribution effects

**Verified facts.** The analyst groups videos by format, visual style, and category and can use average views, average view percentage, and subscribers gained (`src/crew/analyst.js:21-53`). It requires at least six viewed videos, then produces a short production directive that is injected into writer, visual, and edit prompts (`src/crew/analyst.js:122-153`; `src/pipeline/run.js:67-110`). The active experiment adapter currently returns null for average view duration, average percentage viewed, and viewed-versus-swiped-away (`src/analytics/experimentMetrics.js:1-35`). The analytics updater requests only video-level average view percentage and subscribers gained, not a retention curve or beat timestamps (`src/youtube/engage.js:57-84`).

**Inference.** Even when average percentage viewed becomes available, a whole-video average cannot show whether viewers left after the initial answer, during redundant evidence, at an unearned twist, or before payoff. Grouping by format/category cannot isolate story causality from topic appeal, slot, packaging, or distribution.

**Recommendation for a future implementation task.** Connect story beat timestamps to retention-curve changes or a documented manual review workflow, and keep story directives low-confidence until adequate samples exist.

**Owner:** Story and Retention Director + YouTube Analytics Director.  
**Dependency:** real analytics access, stable windows, and persisted beat timing.  
**Acceptance criteria:** each story analysis can identify retention change around question/reveal/payoff beats; sample size and confounders are disclosed; no story template is declared a winner from raw views or aggregate APV alone.

### SR-05 — P2 — Representative scripts demonstrate genuine curiosity when answers create new questions

**Verified facts and beat map: Honeycomb.**

| Beat | Repository narration | Viewer knowledge change | Likely active next question |
| --- | --- | --- | --- |
| 1 | Construction looks simple but hides genius (`data/videos.json:4677-4679`) | Establishes hidden mechanism. | What is the secret? |
| 2 | Bees secrete, chew, and mold wax (`data/videos.json:4681-4683`) | Gives process detail without answer. | How does this create exact hexagons? |
| 3 | Cells begin round (`data/videos.json:4685-4687`) | Reverses the assumed premise. | How do circles become hexagons? |
| 4 | Bees warm wax to 45°C (`data/videos.json:4689-4691`) | Supplies the trigger. | What does heat do? |
| 5 | Soft wax and surface tension form hexagons (`data/videos.json:4693-4695`) | Answers mechanism. | Why is that shape valuable? |
| 6 | Shape minimizes wax/maximizes storage (`data/videos.json:4697-4699`) | Supplies significance. | What does that make the bees? |
| 7 | Physics, not conscious geometry, makes them engineers (`data/videos.json:4701-4703`) | Reframes agency and closes the concept. | Satisfied; replay can reconsider “secret.” |

**Inference.** This is the best evidence of genuine curiosity in the checked-in recent cohort: the question evolves causally, the reversal matters, and payoff follows mechanism and significance. However, the persisted duration is 45.8 seconds and visual-pacing score is only 6 (`data/qc-history.jsonl:3`), so delivery may still weaken the written progression.

**Recommendation for a future implementation task.** Use this causal pattern as a positive fixture—not as a universal wording template—and validate it against rendered pacing and audience retention.

**Owner:** Story and Retention Director.  
**Dependency:** production output and retention data.  
**Acceptance criteria:** fixture annotations identify causal question handoffs; future evaluators reward the handoffs rather than the presence of words such as “but” or “magic.”

### SR-06 — P2 — Representative scripts expose premature answers, stalled questions, and unseeded payoffs

**Verified facts and beat map: Animals see magnetism.** The first narration asks how birds navigate; scene two answers with magnetic sense. Scene three then opens the more distinctive claim that animals actually “see” the field; scenes four through six explain protein, reaction, and perceived pattern; scene seven restates the answer (`data/videos.json:4513-4539`).

**Inference.** The story contains a valid second curiosity loop, but it is poorly sequenced relative to the cover “Animals see Earth's magnetism?” The opening spoken question is broader and answered early; the true mechanism question begins only after that answer. The finale is a summary, not an additional payoff.

**Verified facts and beat map: Lisbon.** Scene one supplies calm historical setup, scenes two through five add earthquake, collapse, fire, and tsunami, scene six summarizes devastation, and scene seven asserts Enlightenment/seismology effects (`data/videos.json:4881-4907`).

**Inference.** Stakes escalate, but the viewer question does not visibly evolve; it is largely “what happened next?” The intellectual consequence is not seeded, so the final beat feels appended rather than inevitable. Escalation by magnitude is not the same as a curiosity loop.

**Verified facts and beat map: Guy Fawkes.** Threat, barrels, attack plan, anonymous warning letter, authorities, discovery, and prevention form a clear causal chain (`data/videos.json:4360-4387`).

**Inference.** This is narratively coherent, but the cover promises “the letter that saved a nation.” Once the letter appears in scene four, the remaining question becomes whether authorities will act/catch the conspirators; the script never develops the letter’s authorship despite “anonymous” being its most intriguing attribute. The finale restates prevention rather than paying off a deeper letter mystery.

**Recommendation for a future implementation task.** Require every early answer to open a deliberate successor question, and seed final consequences before the payoff.

**Owner:** Story and Retention Director + Script/Prompt owner.  
**Dependency:** beat ledger from SR-02.  
**Acceptance criteria:** no core cover question is accidentally answered before the story has a stronger successor; final consequences have prior causal setup; summary endings are distinguishable from payoff endings.

### SR-07 — P2 — Information-density controls are coarse and not comprehension-aware

**Verified facts.** The prompt specifies 85–100 spoken words, 8–11 scenes, roughly 10–16 words per scene, one new concrete detail per beat, and no filler (`src/script/generateScript.js:206-225`). Runtime validation only retries when total narration exceeds 105 words; it does not enforce the minimum, per-scene density, jargon load, novelty, causal clarity, or spoken comprehension (`src/script/generateScript.js:449-463`). Persisted scenes sometimes carry multiple concepts in one sentence, such as cryptochromes, blue light, chemical reaction, electron pairs, spin, and magnetic field across adjacent beats (`data/videos.json:4525-4535`).

**Inference.** Word count limits duration but not cognitive density. A short sentence can still contain several unfamiliar entities and causal steps; conversely, a slower emotional beat may be worthwhile. The system cannot currently distinguish information-rich from information-congested.

**Recommendation for a future implementation task.** Track new concepts, causal operations, numbers/names, and required prior knowledge per beat; allow breathing where comprehension demands it.

**Owner:** Story and Retention Director + TTS/Voice Director.  
**Dependency:** word timings and human comprehension tests.  
**Acceptance criteria:** each beat has a declared primary idea; unfamiliar terms are introduced before use; viewers can state the causal chain after one viewing; density targets vary by beat function rather than a uniform word range.

### SR-08 — P2 — Editorial timing follows word weight and surface emotion labels, not verified dramatic pressure

**Verified facts.** Scene durations are allocated in proportion to narration word count (`src/pipeline/run.js:144-170`). The editor agent chooses transitions, SFX, music mood, and subscribe placement, but not scene duration; its prompt describes an emotional curve and purposeful effects (`src/crew/editorDirector.js:71-95`). Rendering then distributes narration duration across scene weights (`src/video/renderVideo.js:820-845`). Attention forecasting derives boredom from duration, static type, pattern-interrupt presence, Ken Burns, and visual relevance; surprise is inferred from purpose/transition words (`src/pipeline/editorCritique.js:14-40`).

**Inference.** The most important reveal can receive no more breathing room than its word count implies, while a verbose setup can dominate time. Emotional pacing exists as prompt intent and labels, but not as evidence that tension rises, a reveal lands, or satisfaction is allowed to register.

**Recommendation for a future implementation task.** Let beat function influence timing, with explicit compression, hold, pre-reveal pause, and payoff-settle decisions validated in rendered output.

**Owner:** Story and Retention Director + Film Editor.  
**Dependency:** word/audio timing and beat ledger.  
**Acceptance criteria:** timing plan explains why each beat gets its duration; reveal/payoff timing is not determined solely by word count; human review confirms clarity and emotional contour without adding dead air.

### SR-09 — P2 — Pattern interrupts are more meaningful than raw cuts, but still can be editorially hollow

**Verified facts.** The interrupt counter ignores simple subdivisions of the same source and counts a source change, entry into live motion, graphics, or any non-`none` boundary SFX (`src/pipeline/editorialSignals.js:21-46`). Documentation explicitly says same-image tempo cuts do not count (`docs/retention-editorial-rules.md:11-18`). However, the implementation does not verify that a source change adds new information, nor does it confirm that an SFX boundary is a reveal despite comments describing that intent (`src/pipeline/editorialSignals.js:32-46`). QC awards pacing points from interrupt count (`src/pipeline/retentionQC.js:140-159`).

**Inference.** This is better than rewarding every cut, but a decorative stock change or arbitrary whoosh can still count. Meaningful interruption should alter the viewer’s model of the story, not merely the media source.

**Recommendation for a future implementation task.** Associate every interrupt with its information function and reject events that do not change knowledge, stakes, expectation, scale, or causal understanding.

**Owner:** Story and Retention Director + Film/Motion/Sound Directors.  
**Dependency:** beat ledger and rendered event mapping.  
**Acceptance criteria:** counted interrupts declare a narrative function; removing the event would reduce comprehension/tension/surprise; decorative changes do not improve retention score by count.

## Evidence table

| ID | Verified fact | Evidence (`path:line`) | Confidence | Assumption/unknown |
| --- | --- | --- | --- | --- |
| S-01 | All scripts receive one exact eight-stage retention arc. | `src/script/generateScript.js:206-220` | High | Actual model adherence varies and was not regenerated. |
| S-02 | Prompt explicitly asks every beat to add new information. | `src/script/generateScript.js:213-220` | High | Runtime does not verify semantic novelty. |
| S-03 | Runtime validates only an upper total-word threshold. | `src/script/generateScript.js:449-463` | High | Provider schema may influence length, but enforcement is absent. |
| S-04 | Curiosity QC relies on scene count, transition words, silence, finale, graphics, and hedging. | `src/pipeline/retentionQC.js:160-176` | High | No separate viewer-question evaluator was found. |
| S-05 | Scene purpose/emotion is inferred from position and regex. | `src/pipeline/sceneDirector.js:14-39` | High | Labels do not prove viewer emotion. |
| S-06 | Loop closure is one shared extracted keyword. | `src/pipeline/retentionQC.js:95-98` | High | Extractor behavior may remove some terms, but semantic closure is not tested. |
| S-07 | Payoff can score 10 without loop closure. | `src/pipeline/retentionQC.js:247-275` | High | A recommendation may appear, but score remains unchanged. |
| S-08 | Honeycomb narration forms a causal question chain. | `data/videos.json:4671-4706` | High | Audience experience is unverified without playback/metrics. |
| S-09 | Animals story changes from navigation question to visual-magnetism mechanism after an early answer. | `data/videos.json:4506-4542` | High | Whether viewers experience this as confusion or escalation is unknown. |
| S-10 | Lisbon escalates events and introduces intellectual consequence only at the final beat. | `data/videos.json:4874-4910` | High | Finished edit could foreshadow visually, but no output is available. |
| S-11 | Guy Fawkes has a causal threat→warning→search→prevention chain. | `data/videos.json:4354-4390` | High | Emotional delivery and timing are unknown. |
| S-12 | Honeycomb and Lisbon both received curiosity 15/payoff 10. | `data/qc-history.jsonl:3-4` | High | Live environment configuration overrides are unknown. |
| S-13 | Scene timing is proportional to words. | `src/pipeline/run.js:144-170`; `src/video/renderVideo.js:820-845` | High | Exact persisted beat timings are absent. |
| S-14 | Interrupt counting rejects same-source cuts but accepts any source change or SFX. | `src/pipeline/editorialSignals.js:21-46` | High | Narrative meaning is not represented. |
| S-15 | Current experiment metrics are null and lack beat-level curves. | `src/analytics/experimentMetrics.js:1-35` | High | External Studio may contain data unavailable to this audit. |

## Top five creative or technical blockers

1. **P1 — Universal fixed arc substitutes for format-specific question design:** it can manufacture labels and twist words without natural curiosity.
2. **P1 — QC does not track the viewer’s active question:** maximum curiosity can coexist with premature answers, stalled questions, or appended consequences.
3. **P1 — Payoff/loop score is structurally misleading:** 10/10 is possible without semantic closure or an earned replay transition.
4. **P1 — Analytics cannot locate story failures:** whole-video averages and sparse/null data cannot identify where curiosity collapses.
5. **P2 — Timing and density are not dramatic/comprehension-aware:** word weight and word caps stand in for emotional pressure and clarity.

## Quick wins

- In a future audit/reporting task, add a one-line “viewer asks next” field for every scene in production reports.
- Rename or annotate `curiosityScore` and `payoffAndLoopScore` as internal heuristic components until calibrated; acceptance: reports cannot imply measured human retention.
- Add known positive/negative story fixtures: honeycomb causal progression, animals premature-answer handoff, Lisbon unseeded final consequence, and lexical-only loop.
- Persist scene start/end timestamps with the story beat label; acceptance: reviewers can align narration and later retention curves.
- Reconcile documentation and current scoring behavior, especially loop scoring and scene-count ranges; acceptance: documented points match executable logic.

## Structural improvements

1. **Build a viewer-question ledger.** For each beat: active question, new fact, changed stakes/expectation, answer status, successor question, and risk of redundancy.
2. **Create format-specific narrative contracts.** Story, mechanism, process, facts3, and what-if should use different curiosity structures while sharing evidence and payoff standards.
3. **Separate payoff, closure, and loop.** Score semantic answer, emotional/intellectual significance, and final-to-first replay transition independently.
4. **Make timing beat-aware.** Allocate duration using comprehension and dramatic function alongside word count, then inspect rendered timing.
5. **Close the analytics loop at beat level.** Persist beat timestamps and compare them with retention-curve changes and human comprehension/satisfaction reviews.

## Experiments to run

| Hypothesis | Change | Control | Sample/window | Guardrail | Decision rule |
| --- | --- | --- | --- | --- | --- |
| Explicit successor questions improve mid-video retention. | Each answer must create a planned next question until payoff. | Current fixed arc without a question ledger. | Minimum 20 matched episodes across formats. | No artificial withholding or misleading claims. | Adopt if retention between answer/reveal beats improves and payoff satisfaction does not decline. |
| Format-specific arcs outperform the universal template. | Use causal-mechanism, chronological-stakes, three-mini-loop, process-transformation, or consequence-chain contracts. | Current exact eight-stage arc. | At least 10 comparable videos per tested format. | Balance topic, length, slot, and visual quality. | Prefer only where APV/completion/rewatch and human coherence improve. |
| Seeding the final consequence makes payoff feel earned. | Foreshadow Lisbon-style intellectual consequence in an early/mid beat. | Consequence introduced only in finale. | 10 matched history/consequence stories. | Do not spoil the reveal or add unsupported causality. | Adopt if payoff satisfaction and final-20% retention improve. |
| One clear mechanism question beats an early broad answer plus later reframing. | Open directly on how animals see magnetism. | Navigation question answered in scene two. | 10 matched explainers. | Same claim confidence and visual evidence. | Adopt if 3-second and mid-story retention rise without comprehension loss. |
| Semantic payoff validation outperforms keyword overlap. | Human/structured causal answer + replay-transition rubric. | Shared-keyword loop heuristic. | 30 historical scripts and at least 10 renders. | Paraphrases must be allowed; no forced repeated wording. | Adopt if evaluator agrees with blinded human closure ratings materially better than lexical baseline. |
| Beat-aware timing improves comprehension without slowing perceived pace. | Give mechanism/reveal/payoff intentional duration and compress redundant setup. | Word-proportional timing. | 15 paired edits. | Same total length band and facts. | Adopt if comprehension/payoff ratings improve with no first- or mid-retention regression. |

## Metrics that would validate improvement

- Retention curve at each persisted beat boundary, especially after question, early answer, reveal, and payoff.
- Completion and final-20% retention, interpreted with duration and traffic context.
- Average percentage viewed and replay/rewatch proxy, not treated alone as proof of a loop.
- Viewer-question continuity: after each beat, reviewers can state the active next question without inventing one.
- One-view causal recall: viewers can reproduce the mechanism/event chain in correct order.
- Payoff satisfaction: opening promise answered, significance understood, no bait-and-switch.
- Redundancy and novelty ratings per beat; repeated phrasing or unchanged knowledge should not pass as escalation.
- Emotional contour ratings for tension, surprise, satisfaction, and synthetic/formulaic feel.
- Shares/saves/subscriber conversion and returning viewers as longer-horizon evidence of story value.
- Sample count, topic, format, slot, video age, and traffic source for confounding control.

No numerical uplift target is defensible because the repository currently has no beat-level retention baseline and its experiment adapter leaves core metrics null (`src/analytics/experimentMetrics.js:1-35`).

## Risks and regressions

- Explicit question ledgers can produce mechanical scripts if surfaced verbatim; they should guide causality, not dictate copy.
- Format-specific structures may fragment series identity; retain a shared viewer promise and evidence standard.
- Requiring every answer to open another question can become manipulative withholding; allow genuine resolution and breathing.
- Beat-aware timing may lengthen videos or create dead air; validate comprehension and perceived pace together.
- Semantic loop evaluation may become subjective; use annotated fixtures, disagreement records, and rendered review.
- Optimizing curve dips can remove necessary setup or nuance; factual clarity and payoff satisfaction are guardrails.
- Human ratings can overfit reviewer taste; use multiple blinded reviewers and real audience outcomes.
- Retention curves are confounded by topic, packaging, slot, and distribution; matched cohorts and sufficient samples are mandatory.
- Stronger endings may reduce literal replay if they feel complete; rewatch should be earned by added insight, not deliberate incompleteness.

## Final P0/P1/P2/P3 list

- **P0:** None verified in this storytelling-only audit.
- **P1:** SR-01 universal fixed arc can substitute for format-fit curiosity; SR-02 QC does not track evolving viewer questions; SR-03 payoff/loop can score perfectly without semantic closure; SR-04 analytics cannot diagnose story-beat retention.
- **P2:** SR-05 genuine causal curiosity exists in strong outputs but is not recognized robustly; SR-06 premature answers/stalled questions/unseeded payoffs occur in representative scripts; SR-07 density controls are not comprehension-aware; SR-08 timing is word-weighted rather than dramatically calibrated; SR-09 some counted interrupts remain editorially hollow.
- **P3:** Clarify heuristic metric names, synchronize documentation with code, and persist beat/question/timestamp review fields.

## “No files were modified” confirmation

No files were modified.
