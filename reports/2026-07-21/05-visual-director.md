# Visual Director Audit — 2026-07-21

## Executive verdict

The system has a strong *prompt-level* visual-director specification, but the production path does not reliably turn that specification into visual proof. The strongest verified failure is a published Guy Fawkes Short whose gunpowder scene records a rustic-winery Pexels clip and whose Parliament finale records Wikimedia's `Bermuda_-_Old_State_House.jpg`. This is not merely decorative weakness: the recorded imagery contradicts the subjects named in the narration and prompts (`data/videos.json:4354`, `data/videos.json:4407`, `data/videos.json:4452`, `data/videos.json:4461`).

The dominant systemic problem is circular relevance checking. Stock is accepted by comparing narration with the search phrase that the system itself generated, not with the returned asset's title, tags, description, frames, or depicted entities. AI, archive, and generated graphics receive no semantic relevance score at all (`src/media/generateImages.js:209`, `src/media/semanticRelevance.js:32`, `src/pipeline/run.js:353`). Consequently, QC can award visual-variety/relevance credit while being blind to the actual picture.

Representative recent records also show slideshow risk: the animal-magnetism, honeycomb, and Lisbon projects are almost entirely AI stills plus one text graphic, with long scenes split into a second image generated from the same scene prompt rather than designed as a new explanatory shot (`data/videos.json:4546`, `data/videos.json:4710`, `data/videos.json:4914`; `src/media/generateImages.js:288`). The repository contains no corresponding production image files or full rendered videos, so AI anatomy, facial artifacts, exact framing, crop quality, and frame-to-frame identity continuity cannot be visually verified in this audit. That limitation is itself important: current retained artifacts do not support a rendered-frame visual acceptance gate.

Overall visual-storytelling readiness: **not production-safe without human visual review**. P0 applies to the demonstrated published factual visual mismatch; P1 applies to the relevance/QC blind spots, missing explanatory graphic forms, AI-still dependence, and lack of retained rendered-video evidence.

## Verified findings

### VD-01 — P0: A published historical Short records visuals that contradict its narration

**Verified fact.** The Guy Fawkes record narrates a plot under Parliament, 36 barrels of gunpowder, and Parliament's survival; its visual prompts likewise request gunpowder barrels and the Houses of Parliament (`data/videos.json:4354`, `data/videos.json:4362`, `data/videos.json:4386`). The selected scene-1 stock record points to a Pexels URL whose recorded slug is `rustic-winery-with-oak-barrels`, while the finale archive record points to Wikimedia's `Bermuda_-_Old_State_House.jpg` (`data/videos.json:4407`, `data/videos.json:4452`). The same record is marked published (`data/videos.json:4461`).

**Visual consequence.** The winery barrels do not establish explosives, the cellar, or the conspiracy. The Bermuda building cannot prove that the Houses of Parliament survived. The finale therefore gives a false visual referent to a named historical place.

**Better evidence class.** Use a provenance-checked Parliament exterior/engraving for setup and payoff; a verified Gunpowder Plot cellar reconstruction, period diagram, or labeled evidence graphic for the barrels; and an archive reproduction of the anonymous Monteagle letter for the warning scene. Exact-entity validation must precede acceptance.

### VD-02 — P1: Stock relevance is circular and archive selection is first-result retrieval

**Verified fact.** `fetchStockVideoForKeywords` searches each generated query and accepts the first provider hit (`src/media/fetchMedia.js:190`). The Pexels adapter returns the requested search phrase as `keyword`; it does not return or validate the asset's depicted subject (`src/media/fetchMedia.js:45`). `generateImages` then checks narration against that same generated phrase (`src/media/generateImages.js:209`). The lexical relevance function only measures overlap between narration keywords and supplied asset tags (`src/media/semanticRelevance.js:32`). Thus a request for “historical gunpowder barrels” can pass even when the returned file is a winery.

Wikimedia and Met archive retrieval similarly accept the first sufficiently large/license-compatible search result, with no exact-person, object, place, or date verification after retrieval (`src/media/fetchArchive.js:33`, `src/media/fetchArchive.js:71`, `src/media/fetchArchive.js:97`).

**Inference.** Query specificity may improve search ranking, but it cannot establish visual correctness. The published mismatch demonstrates that ranking alone is insufficient.

**Better evidence class.** Preserve provider metadata and a representative frame, then compare depicted entities with a scene-specific required-subject list and forbidden-mismatch list. Archive scenes need title/creator/date/entity checks, not only query and license compatibility.

### VD-03 — P1: AI, archive, and graphics bypass visual relevance QC

**Verified fact.** Runtime QC builds relevance records only for stock/Pexels items; AI, graphic, and archive items are assigned `null`, with the comment that topic-derived assets are not penalized (`src/pipeline/run.js:353`). Retention QC awards relevance points when the relevance count is zero or when no recorded mismatch exists (`src/pipeline/retentionQC.js:209`). The scene director's `visualGoal` describes a source category—illustrate, explain, ground, or show live action—not whether the actual frame fulfills the claim (`src/pipeline/sceneDirector.js:74`).

**Visual consequence.** A generated image can be anatomically wrong, an archive image can depict the wrong landmark, and a graphic can merely restate narration while all three remain invisible to semantic QC.

**Better evidence class.** Require a content-level review record for every source class: depicted subject, claim supported, contradiction check, readable labels, and representative-frame approval. Absence of visual evidence should be “unknown,” not a passing relevance result.

### VD-04 — P1: “Diagram” output is a numbered text card, not the promised visual explanation

**Verified fact.** The visual-director prompt asks for maps, routes, cross-sections, orbit diagrams, anatomy, timelines, and comparisons when mechanisms require them (`src/crew/visualDirector.js:146`, `src/crew/visualDirector.js:161`). The renderer's only diagram-like implementation is `renderStepsCard`: a title plus two to four numbered text steps on a dark card (`src/media/renderTemplate.js:166`). Validation checks only that the title and step strings exist (`src/media/renderTemplate.js:250`). No repository renderer was found for maps, spatial routes, cross-sections, anatomy, orbit paths, before/after comparisons, or evidence-document callouts.

**Visual consequence.** The graphic can sequence words but cannot show spatial or causal relationships. In the animal-magnetism record, the graphic is assigned to the electron-pair explanation (`data/videos.json:4579`), yet the available renderer can only list steps; it cannot show paired electron spins, light activation, or directional change. In the honeycomb record, the core round-to-hexagonal transformation likewise lacks a geometry comparison or cross-section (`data/videos.json:4691`, `data/videos.json:4743`).

**Better evidence class.** Animal magnetism needs a labeled radical-pair orientation diagram plus a real-bird evidence shot; honeycomb needs a round-versus-hex comparison, heat/cross-section view, and observable before/after evidence; Lisbon needs a map, event timeline, archive plan, and seismology-document insert.

### VD-05 — P1: Recent outputs are AI-still sequences despite explicit anti-slideshow rules

**Verified fact.** The visual-director prompt says not to create AI-only runs and calls three or more consecutive AI stills a visual failure (`src/crew/visualDirector.js:168`). Nevertheless, the retained animal-magnetism media list is AI stills except for one graphic (`data/videos.json:4546`); the honeycomb list is AI stills except for one graphic (`data/videos.json:4710`); and Lisbon is AI stills except for its final graphic (`data/videos.json:4914`). Long static scenes receive a second AI image using the same scene prompt and a different seed (`src/media/generateImages.js:288`).

The honeycomb prompts repeatedly request macro/close-up bee or wax compositions while the narration's proof burden is a physical transformation from round cells to hexagons (`data/videos.json:4671`). Lisbon repeatedly requests cinematic disaster reconstructions rather than archive evidence, maps, plans, or comparisons (`data/videos.json:4874`).

**Inference, bounded by missing renders.** Source succession and same-prompt splits are strong slideshow-risk indicators, but exact perceived motion, crop variation, and composition repetition cannot be confirmed without rendered frames. Generic pan/zoom treatment of stills does not by itself make them explanatory footage; still rendering applies recurring zoom/pan modes (`src/video/renderVideo.js:296`).

**Better evidence class.** Break each topic into proof modes rather than image variations: observable real footage, verified archive, spatial diagram, comparison, document/detail insert, then a motivated reconstruction only where evidence cannot be filmed.

### VD-06 — P1: There is no repository-backed rendered-frame visual acceptance gate

**Verified fact.** The pipeline creates a hook preview at 0.5 seconds and a midpoint preview for reports, rather than a full-scene contact sheet or representative-frame set (`src/pipeline/run.js:471`). Available motion acceptance artifacts describe themselves as representative test material rather than production videos (`artifacts/motion/acceptance/acceptance-report.md:3`). Project documentation also states that the relevant environment did not perform a real render and used simulation for evaluation (`docs/editorial-director-v2.md:42`; `docs/retention-editorial-rules.md:64`). Production media paths recorded in `data/videos.json` do not have corresponding viewable production assets in the repository.

**Visual consequence.** The audit trail cannot demonstrate mobile legibility of evidence, crop safety, AI deformations, historical costume/object accuracy, continuity of recurring subjects, contradicting imagery, or whether the narration's key noun is visible at the right moment.

**Better evidence class.** Retain a scene-boundary/contact-sheet artifact and selected claim frames for every candidate video, with a human verdict for subject correctness, proof strength, continuity, and synthetic artifacts before publishing.

### VD-07 — P2: Continuity and accuracy are prompt constraints, not validated properties

**Verified fact.** The script and visual-director schemas define a visual anchor and continuity rules (`src/script/generateScript.js:63`, `src/crew/visualDirector.js:124`). Generation appends the anchor and style suffix to prompts and uses deterministic seeds (`src/media/generateImages.js:104`, `src/media/generateImages.js:161`). The configured suffix asks for historically accurate detail (`src/config.js:28`). No downstream vision comparison or identity/object consistency check was found.

**Inference.** Shared prompt text and seeds may improve stylistic consistency, but they cannot verify that a bird species, building, historical prop, face, uniform, or scientific structure remains correct across generated frames.

**Better evidence class.** Define continuity anchors as observable attributes and compare representative frames for identity, wardrobe/object state, geography, lighting/time, and directional continuity. Scientific/historical scenes need reference-led generation and a fact-review record.

### VD-08 — P2: Shot diversity is specified but measured mostly as source diversity

**Verified fact.** The visual-director prompt mandates shot-scale variation (`src/crew/visualDirector.js:165`). Retention QC's visual-variety score instead uses source-set size, maximum consecutive source type, and placeholder absence (`src/pipeline/retentionQC.js:209`). Pattern-interrupt logic counts a source change, live-motion entry, graphic, or sound effect rather than a meaningful new visual fact (`src/pipeline/editorialSignals.js:21`). Recent QC records award the published Guy Fawkes project a visual-variety score of 8 despite its documented winery and Bermuda mismatches, while the three AI-heavy examples receive 6 (`data/qc-history.jsonl:1`, `data/qc-history.jsonl:2`, `data/qc-history.jsonl:3`, `data/qc-history.jsonl:4`).

**Visual consequence.** A new source or new crop can increase the score without changing what the viewer understands. Conversely, a deliberately held evidence shot could be penalized even if it clearly proves the claim.

**Better evidence class.** Score changes in visual function: establishing context, identifying the subject, demonstrating mechanism, presenting primary evidence, comparing states, and delivering payoff. Shot scale should be reviewed separately from information gain.

## Evidence table

| ID | Severity | Verified repository evidence | Visual-storytelling judgment | Confidence / limitation |
|---|---|---|---|---|
| VD-01 | P0 | Guy Fawkes narration/prompts and media provenance conflict (`data/videos.json:4354`, `data/videos.json:4407`, `data/videos.json:4452`); record is published (`data/videos.json:4461`) | Wrong subjects undermine historical proof and invalidate the finale | High for recorded provenance; production frames absent |
| VD-02 | P1 | First-hit search and query-as-tag relevance (`src/media/fetchMedia.js:45`, `src/media/fetchMedia.js:190`, `src/media/generateImages.js:209`) | The checker validates its own query, not the selected picture | High |
| VD-03 | P1 | Non-stock sources receive no relevance record (`src/pipeline/run.js:353`); zero checks can pass (`src/pipeline/retentionQC.js:209`) | Most recent visual output is semantically unreviewed | High |
| VD-04 | P1 | Graphic taxonomy promised (`src/crew/visualDirector.js:146`) but renderer produces text steps (`src/media/renderTemplate.js:166`) | Mechanisms are narrated/illustrated, not visually explained | High for implementation; rendered readability unavailable |
| VD-05 | P1 | AI-dominant media runs (`data/videos.json:4546`, `data/videos.json:4710`, `data/videos.json:4914`) and same-prompt split (`src/media/generateImages.js:288`) | Strong slideshow and repetitive-composition risk | High for source runs; medium for perceived result without renders |
| VD-06 | P1 | Only hook/mid previews (`src/pipeline/run.js:471`); artifacts/docs disclose representative or simulated review (`artifacts/motion/acceptance/acceptance-report.md:3`, `docs/retention-editorial-rules.md:64`) | No evidence that rendered visual quality is accepted scene by scene | High |
| VD-07 | P2 | Continuity anchor and accuracy suffix exist (`src/crew/visualDirector.js:124`, `src/config.js:28`) but no visual validator was found | Consistency is requested, not demonstrated | High for code path; actual consistency unknown |
| VD-08 | P2 | Variety is source/run based (`src/pipeline/retentionQC.js:209`); interrupts are event-count based (`src/pipeline/editorialSignals.js:21`) | Scores can reward cosmetic change instead of new evidence | High |

## Top five creative or technical blockers

1. **P0 — Incorrect visual provenance can reach publication.** The Guy Fawkes winery and Bermuda records prove the gate is not hypothetical (`data/videos.json:4407`, `data/videos.json:4452`).
2. **P1 — Relevance validation does not inspect the returned visual.** Query overlap is mistaken for asset relevance, while AI/archive/graphics bypass checking (`src/media/generateImages.js:209`, `src/pipeline/run.js:353`).
3. **P1 — The explanatory-graphics vocabulary is effectively one text-step card.** It cannot deliver the maps, comparisons, cross-sections, mechanisms, and evidence inserts the directing prompt requests (`src/media/renderTemplate.js:166`).
4. **P1 — Recent media plans are long AI-still runs.** Different seeds and generic camera movement vary appearance but do not guarantee new information or visual proof (`src/media/generateImages.js:288`, `src/video/renderVideo.js:296`).
5. **P1 — No complete rendered-frame audit trail exists.** Synthetic artifacts and two preview frames cannot validate an entire Short's composition, continuity, accuracy, or evidence quality (`src/pipeline/run.js:471`).

## Quick wins

- Add a manual publishing hold for every archive/stock selection whose visible subject and provider title have not been checked against the narration's named person, place, object, species, or event. First apply it to historical/scientific claims.
- Reject the recorded Guy Fawkes winery and Bermuda assets; replace them only in a separately authorized implementation task with verified Gunpowder Plot/Parliament evidence.
- Treat missing relevance data as **unknown**, not pass, in editorial review. Review AI, graphics, and archive items explicitly.
- Require one concise “claim → required visible evidence” sentence per scene before asset search. For example: “viewer must see round cells becoming hexagonal,” not “cinematic macro honeycomb.”
- Produce and retain a scene contact sheet for human review. Include scene number, narration claim, source/provenance, and representative frame.
- Rename the current graphic mentally and editorially as a **steps card**; do not accept it as proof that a diagram requirement was fulfilled.
- Cap consecutive AI reconstruction scenes during editorial review until a real evidence shot, archive insert, diagram, map, or comparison intervenes.

## Structural improvements

1. **Asset-grounded relevance gate.** Carry provider title, description, tags, author, source URL, and thumbnail/frame through selection. Validate required and forbidden entities against the returned asset, not the query. Acceptance criterion: every selected source has a claim-specific evidence record; wrong-place and wrong-object fixtures fail.
2. **Visual-proof plan.** Extend editorial planning conceptually from `image_prompt` to a proof contract: claim, required visible subject/action, evidence class, acceptable reconstruction status, and forbidden substitutions. Acceptance criterion: each factual scene names what the frame proves.
3. **Explanatory graphic system.** Support distinct forms for maps/routes, timelines, before/after comparisons, labeled diagrams, cross-sections, document callouts, and quantitative scales. Acceptance criterion: graphic type matches the causal/spatial question and is visually reviewed at phone size.
4. **Rendered visual QC.** Generate a full contact sheet and sample critical moments inside each scene, not only 0.5 seconds and midpoint. Acceptance criterion: a reviewer can approve subject accuracy, continuity, crop, legibility, synthetic artifacts, and narration alignment before publish.
5. **Information-based variety model.** Separate source diversity, shot-scale diversity, and visual-information gain. Acceptance criterion: a visual event counts only when it answers or advances a viewer question.
6. **Reference-led continuity and accuracy.** Preserve approved reference frames/attributes for recurring people, places, animals, and objects. Acceptance criterion: repeated entities match documented anchors; historical/scientific reconstructions are labeled and reviewed.

## Experiments to run

1. **Evidence-led versus illustration-led honeycomb cut.** A: current AI macro sequence. B: real macro evidence plus round/hex comparison, heat cross-section, and transformation diagram. Hold narration constant.
2. **Archive-grounded Lisbon cut.** Replace two generic destruction reconstructions with a dated map/timeline and verified pre/post archive or city-plan evidence. Measure comprehension and perceived credibility.
3. **Animal-magnetism mechanism test.** Compare the text steps card with a labeled radical-pair diagram synchronized to narration, surrounded by real robin footage.
4. **Asset relevance blind review.** Give reviewers only the narration and selected frame—not the search query—and ask whether the frame proves, merely relates to, or contradicts the claim.
5. **AI-run interruption test.** Compare same-prompt seed variations with a proof-mode sequence (real subject → mechanism diagram → behavioral demonstration → payoff comparison).

These are proposed tests, not executed experiments.

## Metrics that would validate improvement

- **Claim-proof coverage:** percentage of factual claims with a reviewer-approved visible proof frame; target 100% for named historical/scientific claims.
- **Contradictory-subject escape rate:** wrong person/place/object/species assets found after approval or publication; target 0.
- **Unknown relevance rate:** assets lacking actual-frame/content review; target 0 before publish.
- **Explanatory visual share:** scenes where the visual adds mechanism, comparison, provenance, spatial context, or observable behavior rather than duplicating narration.
- **Consecutive illustrative-still run:** maximum uninterrupted AI/stock-still scenes without a new proof mode; track separately from source count.
- **Visual information gain:** blinded reviewer percentage marking each scene as advancing understanding; do not substitute transition/event counts.
- **Continuity error rate:** recurring-subject identity/object/geography inconsistencies per video.
- **Mobile evidence comprehension:** percentage of viewers who correctly identify what a diagram/map/comparison proves after one viewing.
- **Credibility and synthetic-feel ratings:** blinded human ratings for historical/scientific accuracy and perceived artificiality.
- **Retention at evidence/reveal moments:** compare drop, hold, and rewatch around newly explanatory shots; associate with actual viewer analytics, not internal visual-variety scores.

## Risks and regressions

- Exact-entity gates can reduce asset availability; the safe response is escalation or a labeled explanatory graphic, not a loosely related substitute.
- More graphics can become text overload. Maps and diagrams must encode spatial/causal information and be reviewed at rendered phone size.
- Additional archive material introduces licensing/provenance work; Agent 13 should own final license approval.
- Strict AI-run caps may force irrelevant stock if evidence class is not planned first. Source diversity must never outrank relevance.
- Reference-led generation can improve consistency while preserving the same factual error across scenes; references themselves require approval.
- Contact sheets can miss short-lived artifacts or mistimed contradictions. Critical scenes also need in-motion review.
- Human review adds cost and subjectivity; use explicit claim/proof criteria and preserve disagreement rather than converting taste into a false objective score.
- Visual changes may affect pacing, render time, and captions; those interactions require separate Film Editor, FFmpeg, and Caption Director review.

## Final P0/P1/P2/P3 list

### P0

- **VD-01:** Published Guy Fawkes media provenance records a winery for gunpowder evidence and Bermuda's Old State House for the Houses of Parliament (`data/videos.json:4407`, `data/videos.json:4452`, `data/videos.json:4461`).

### P1

- **VD-02:** Stock/archive selection validates search intent rather than the returned visual subject (`src/media/fetchMedia.js:190`, `src/media/fetchArchive.js:33`).
- **VD-03:** AI, archive, and graphic relevance are unmeasured, and absence of checks can score as a pass (`src/pipeline/run.js:353`, `src/pipeline/retentionQC.js:209`).
- **VD-04:** The implemented “diagram” is a numbered steps card and cannot express required maps, mechanisms, comparisons, or cross-sections (`src/media/renderTemplate.js:166`).
- **VD-05:** Recent records contain near-continuous AI-still runs despite the director's anti-slideshow rule (`src/crew/visualDirector.js:168`, `data/videos.json:4546`, `data/videos.json:4710`, `data/videos.json:4914`).
- **VD-06:** Retained production evidence is insufficient for rendered-frame visual acceptance across the full video (`src/pipeline/run.js:471`).

### P2

- **VD-07:** Accuracy and continuity rely on prompt language and shared anchors without visual verification (`src/crew/visualDirector.js:124`, `src/config.js:28`).
- **VD-08:** Visual-variety and pattern-interrupt scores emphasize source/event counts rather than explanatory information (`src/pipeline/retentionQC.js:209`, `src/pipeline/editorialSignals.js:21`).

### P3

- No independent P3 polish item is recommended until the P0/P1 proof and review failures are resolved.

## “No files were modified” confirmation

No application code, production configuration, prompts, assets, generated outputs, or existing repository files were modified. The only file created by this audit is this report: `reports/2026-07-21/05-visual-director.md`. No dependencies were installed, no publishing/upload command was run, and no commit or push was performed.
