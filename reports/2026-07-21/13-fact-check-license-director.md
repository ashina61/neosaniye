# Fact-check and Licensing Director Audit — 2026-07-21

## Audit basis, legal boundary, and verification method

This is a read-only repository audit, not legal advice. It evaluates whether each claim and asset can be defended from evidence retained by the system. Repository facts are cited as `path:line`. Representative factual claims were checked against authoritative institutional sources and primary research; this does not replace claim-by-claim expert review.

Evidence labels used below:

- **Repository-verified:** directly established by code, manifests, or retained production records.
- **Externally corroborated:** supported by an authoritative institution or primary paper linked in this report.
- **Externally contradicted/overstated:** stronger than the cited authoritative evidence permits.
- **Unverified:** no claim-to-source evidence is retained; truth is not assumed either way.
- **Legal uncertainty:** rights cannot be concluded from the repository evidence. This is a publishing disposition, not a legal opinion.

The repository contains no production output files for a complete retrospective asset-hash audit, so this audit evaluates retained records and acquisition logic. `data/videos.json` is sufficient to prove that multiple videos reached `status:"published"` with unsupported claim provenance and `music.license:null`, but not to reconstruct every byte used in those uploads.

## Executive verdict

The system cannot currently defend every published claim or asset. It relies on model instructions—“use widely accepted facts” and hedge uncertainty—rather than a research workflow. The script schema has no sources, claim IDs, quotations, confidence, or reviewer disposition; no claim-to-source mapping is persisted; factual QC is a narrow regex for words such as “proven” and “may”; and the hard gate contains no factual or licensing conditions. As a result, a plausible-sounding unsupported script can publish automatically.

That risk is realized in retained production data. The published magnetoreception Short states that animals “actually see” magnetic fields and presents the cryptochrome radical-pair mechanism as the operative explanation (`data/videos.json:4513-4539`). Primary research describes cryptochrome as a hypothesis with crucial missing evidence, and one experiment specifically rejects the strong visual-overlay form of that model. This is not merely absent citation; it is materially overstated scientific certainty.

Asset governance is uneven. The newer imported CC0 audio library is exemplary: pinned source commits, allow/reject paths, license evidence, hashes, and per-asset manifests are retained (`assets/audio/README.md:1-40`; `assets/audio/manifests/audio-manifest.json:1-32`). Programmatically generated motion SFX also have origin/version records (`assets/motion/manifests/sfx-manifest.json:1-64`). However, the renderer deliberately mixes that governed library with a legacy `assets/music/` pool whose selected tracks receive `license:null` (`src/audio/musicSelect.js:91-110`). Published records repeatedly show that null-license path, including Guy Fawkes and magnetoreception (`data/videos.json:4335-4339`; `data/videos.json:4487-4491`).

Stock, archive, ambience, and AI provenance are also incomplete. Stock records retain author and page URL but not license identity/version/evidence or file hash. Archive acquisition filters license metadata in memory, but durable state drops the license and attribution flag. Freesound is filtered to CC0 but returns and stores only name/duration/path, losing sound ID, creator, source URL, license, and hash. AI assets are recorded simply as `source:"ai"` without provider, model, prompt version, seed, generation ID, terms snapshot, or file hash.

Publishing disposition: **P0 fail-closed is warranted for any claim without approved source mapping, any material claim whose confidence exceeds its evidence, and any selected asset lacking durable rights evidence.** The current system instead publishes in warning mode if technical/editorial checks pass. No current gate establishes factual or license readiness.

## Verified findings

### FCL-01 — P0 — Claims are generated without sources and can publish without factual approval

**Affected claims/assets.** Every generated historical, scientific, and factual narration.

**Current evidence.** The prompt instructs the model to use “well-documented, widely-accepted facts” and hedge uncertain details (`src/script/generateScript.js:231-237`). The schema and returned production record contain narration and image prompts but no source list, claim ID, evidence excerpt, source date, confidence, or fact-check status (`src/pipeline/recordProduction.js:47-59`). Post-generation validation checks word count, hook selection, and ad-safe wording, not evidence (`src/script/generateScript.js:440-483`).

**Missing proof.** There is no claim-to-source map for any retained published script. No independent researcher or reviewer disposition is recorded.

**Risk.** Model fluency is treated as research. Unsupported names, quantities, causal claims, and debated mechanisms can pass as settled fact.

**Current gate.** None. Technical preflight and hard gate do not receive claim evidence (`src/pipeline/hardGate.js:21-30`; `src/pipeline/run.js:406-423`).

**Publishing disposition.** Block publication until every material claim has an approved source and confidence disposition; do not treat prompt compliance as evidence.

### FCL-02 — P0 — A published science script presents a disputed mechanism as settled fact

**Affected claims.** The retained Short says some animals “actually ‘see’ the magnetic field,” cryptochromes create electron pairs that respond to the field, this “allows them” to see directional patterns, and birds navigate by “literally seeing” an invisible compass (`data/videos.json:4521-4539`). The title also promises “Here’s How They Do It” (`data/videos.json:4507-4511`).

**External evidence.** Primary research describes the cryptochrome radical-pair mechanism as uncertain and says sensor molecules have not been unequivocally identified ([Kattnig & Hore, Scientific Reports](https://www.nature.com/articles/s41598-017-09914-7)). A later primary study calls cryptochrome a hypothesized magnetosensor with many unanswered questions ([Nature Communications, 2024](https://www.nature.com/articles/s41467-024-55124-x)). Another experiment concludes that its results disprove the ambitious model in which retinal cryptochrome produces a magnetic-field image superimposed on vision, while not excluding all radical-pair involvement ([Scientific Reports, 2020](https://www.nature.com/articles/s41598-020-60383-x)).

**Assessment.** Bird magnetoreception is real, and cryptochrome/radical-pair explanations have supporting evidence, but the repository's causal and literal-vision wording is stronger than the cited research permits. The narration needed repeated hypothesis language, separation of established behavior from proposed mechanism, and avoidance of “literally seeing” as settled perception.

**Why QC missed it.** Factual certainty QC recognizes only a narrow list of absolute and hedge words (`src/pipeline/editorialSignals.js:14-19`, `src/pipeline/editorialSignals.js:63-89`). The script avoids “definitely/proven,” so declarative causal language passes. The retained QC record has no failures despite the publication override (`data/qc-history.jsonl:2`).

**Publishing disposition.** Existing publication requires correction/review; future claims about cryptochrome, radical pairs, and visual patterns must remain blocked until sourced and phrased to evidence strength.

### FCL-03 — P1 — Guy Fawkes chronology is broadly supportable, but counterfactual framing and visual evidence are not

**Affected claims.** The script describes Robert Catesby, 36 barrels, the State Opening, the Monteagle letter, the search, and Fawkes's discovery (`data/videos.json:4362-4383`). Its title/hook say one letter “stopped a Parliament explosion” and “saved a nation,” and the finale claims the arrest prevented an act that “would have profoundly reshaped British history forever” (`data/videos.json:4355-4359`, `data/videos.json:4385-4387`).

**External evidence.** UK Parliament corroborates the core plot, anonymous Monteagle warning, search, and Fawkes's arrest, while explicitly noting uncertainty over the letter's authenticity/authorship and broader plot origins ([UK Parliament FAQ](https://www.parliament.uk/about/faqs/house-of-commons-faqs/gunpowder-plot/); [Parliament receives a tip-off](https://www.parliament.uk/about/living-heritage/evolutionofparliament/parliamentaryauthority/the-gunpowder-plot-of-1605/overview/the-plot-and-its-discovery/discovery-and-flight/)). Parliament materials also support the traditional 36-barrel account ([Gunpowder Plot leaflet](https://www.parliament.uk/globalassets/documents/heritage/gunpowder-trail-leaflet.pdf)).

**Assessment.** Core chronology is externally corroborated. “Saved a nation” and “would have reshaped British history forever” are counterfactual rhetoric, not sourced facts. “Monteagle … immediately alerted the authorities” simplifies the more specific record that he passed the letter to Robert Cecil. The script should distinguish traditional account, official-version uncertainty, and counterfactual interpretation.

**Visual contradiction.** The final payoff scene uses an archive image identified as `Bermuda_-_Old_State_House.jpg`, not the English Parliament (`data/videos.json:4452-4458`). The narration and prompt specify British parliamentary continuity (`data/videos.json:4385-4387`). This is repository-verifiable contradictory visual evidence in a published historical video.

**Publishing disposition.** Core claims can proceed only with attached sources and qualified counterfactual language; the Bermuda visual is reject/replace before publication.

### FCL-04 — P1 — Factual-certainty QC detects vocabulary, not evidentiary confidence

**Affected claims.** All claims that are declarative without the small absolute-word list, including the magnetoreception mechanism.

**Current evidence.** `classifyFactualCertainty()` labels sentences using regexes for words such as `definitely`, `proven`, `may`, and `experiments suggest`; text with neither becomes `speculative`, yet only `overclaim` loses points (`src/pipeline/editorialSignals.js:14-19`, `src/pipeline/editorialSignals.js:69-89`; `src/pipeline/retentionQC.js:171-176`).

**Missing proof.** It does not know whether a claim is historical consensus, a disputed hypothesis, a number with a confidence interval, or a fabricated detail. There is no source comparison.

**Risk.** “This subtle difference allows them to see…” is an absolute causal assertion semantically, but contains none of the watched tokens and receives no overclaim flag.

**Current gate.** It produces only score/fix effects inside editorial QC, whose default warning mode does not block publication (`src/config.js:69-81`).

**Publishing disposition.** Treat lexical certainty as a lint, never a fact gate. Require evidence-backed confidence per claim.

### FCL-05 — P0 — Published legacy music has no defensible per-track license record

**Affected assets.** Every selected file from `assets/music/`, including `Ancient Rite.mp3` and `Marianas.mp3` in recent published records (`data/videos.json:4335-4339`; `data/videos.json:4487-4491`). Other retained records also repeatedly contain `license:null` (`data/videos.json:3918-3922`; `data/videos.json:4041-4045`; `data/videos.json:4188-4192`; `data/videos.json:4634-4638`; `data/videos.json:4798-4802`).

**Current evidence.** The README makes a blanket claim that the pool is CC0/public domain and names a source archive, but provides no per-track source URL, commit, hash, license file, or imported-at record (`assets/music/README.md:1-12`). It also admits real Content ID claims occurred against files believed to be public domain (`assets/music/README.md:14-24`). The selector intentionally admits all legacy files and describes them with `license:null` (`src/audio/musicSelect.js:91-110`, `src/audio/musicSelect.js:135-148`).

**Missing proof.** No durable evidence ties each legacy byte to a licensor, work, license grant, source revision, and hash. Content ID risk is distinct from copyright permission, but the repository has proof of operational uncertainty on both provenance and claims handling.

**Current gate.** The hard gate blocks exhausted/repeated or silent music, not unknown licensing (`src/pipeline/hardGate.js:58-67`).

**Publishing disposition.** Block selection/publication of every `license:null` track until imported into the governed manifest or replaced by a verified/procedural asset.

### FCL-06 — P2 — The imported CC0 audio library is the strongest provenance model in the repository

**Affected assets.** 47 imported music/SFX/ambience assets under `assets/audio/`.

**Current evidence.** Sources are pinned to commits, paths are allowlisted/rejected, evidence files/sections are described, questionable sources are disabled, and per-asset records include repository, commit, path, license, SHA-256, PCM hash, technical properties, and attribution requirement (`assets/audio/README.md:1-51`; `assets/audio/manifests/audio-manifest.json:1-32`). The music selector admits only `type:"music"` manifest entries from this library (`src/audio/musicSelect.js:72-88`).

**Residual uncertainty.** This audit did not independently fetch each pinned repository/license file, and a source's CC0 assertion can itself be mistaken. The `sample-pi` source relies on a README rather than a separate license file (`assets/audio/README.md:21-27`). That is documented rather than hidden, which is good practice.

**Current gate.** Manifest absence excludes these library files from manifest-based selection, but legacy music bypass remains.

**Publishing disposition.** Approved in repository terms subject to periodic independent license evidence checks; use this structure as the minimum for all asset classes.

### FCL-07 — P0 — Freesound ambience loses all durable license provenance

**Affected assets.** Any remotely fetched ambience mixed into a video.

**Current evidence.** Search is filtered to `license:"Creative Commons 0"` (`src/audio/fetchAmbience.js:42-51`). However, the API request asks only for `id,name,duration,previews`, and the function returns only local path, name, and duration (`src/audio/fetchAmbience.js:47-67`). Production report retains only the ambience name (`src/pipeline/run.js:471-483`), and `recordProduction()` has no ambience field (`src/pipeline/recordProduction.js:31-46`).

**Missing proof.** Sound ID, creator, source page, exact license string/version, API response snapshot, downloaded preview URL, collection time, and hash are lost. A later audit cannot prove which sound was used or that it matched the filter at acquisition time.

**Current gate.** None. Ambience is not provided to the hard gate.

**Publishing disposition.** Remote ambience must be disabled or block publication unless a complete immutable rights record is persisted before mixing.

### FCL-08 — P1 — Stock provenance is identifiable but not license-defensible from retained records

**Affected assets.** Pexels and Pixabay videos/photos.

**Current evidence.** Acquisition retains Pexels asset ID, creator and creator URL in memory (`src/media/fetchMedia.js:45-91`), while Pixabay retains source page and author (`src/media/fetchMedia.js:103-154`). Retained production records keep source URL and author but discard provider-specific ID, creator URL, download URL, file hash, bytes, and any license field (`src/pipeline/recordProduction.js:62-70`). Example: a Pexels winery barrel video stands in for historical gunpowder barrels (`data/videos.json:4407-4414`).

**Missing proof.** No license name/version, terms URL/snapshot, acquisition timestamp, modification record, or hash is captured. The repository assumes provider API availability implies downstream permission; that is not a durable rights record. This report does not opine on Pexels/Pixabay legal terms.

**Attribution.** The upload description only adds credits for archive assets that set `attribution`; it does not generate stock provenance credits (`src/pipeline/run.js:414-421`). Attribution may not be contractually required for a given stock license, but the evidence record remains incomplete regardless.

**Current gate.** None for license/provenance completeness.

**Publishing disposition.** Block any stock asset without provider ID, source/creator, applicable terms identifier/snapshot, acquisition time, and hash. Attribution should follow the verified terms, not a blanket assumption.

### FCL-09 — P1 — Archive filtering is useful, but attribution and durable state are incomplete

**Affected assets.** Wikimedia Commons and Met Open Access images.

**Current evidence.** Wikimedia candidates are filtered to a license-name allowlist and store author, license, source URL, and whether attribution is required; Met objects are treated as CC0 (`src/media/fetchArchive.js:33-94`). In-memory media can produce description credits for CC BY/BY-SA (`src/pipeline/run.js:414-421`).

**Missing proof.** `recordProduction()` drops `license`, `attribution`, `provider`, and archive query (`src/pipeline/recordProduction.js:62-70`); the Guy Fawkes record therefore preserves only author and Commons URL (`data/videos.json:4452-4458`). Credits consist of creator, provider name, and short license name, without asset title, source link, license link/version, or modification indicator. Whether that satisfies each license is a legal question not resolved here.

**Accuracy flaw.** License filtering does not establish subject relevance; the Bermuda Old State House passed for a British Parliament payoff (FCL-03).

**Current gate.** No hard failure for missing attribution fields or archive subject mismatch.

**Publishing disposition.** Block when the complete original metadata/license snapshot and required credit text cannot be generated and retained; separately require subject verification.

### FCL-10 — P1 — AI image provenance, rights basis, and factual status are not retained

**Affected assets.** Gemini- and Pollinations-generated images, which dominate recent history/science records (`data/videos.json:4394-4450`; `data/videos.json:4546-4605`).

**Current evidence.** Generation can use configured Gemini model or Pollinations provider/model/seed (`src/media/generateImages.js:17-29`, `src/media/generateImages.js:51-76`, `src/media/generateImages.js:118-150`). Completed items are stored as only path/type/scene/`source:"ai"`; split variants likewise omit provider/model/seed (`src/media/generateImages.js:238-249`, `src/media/generateImages.js:292-297`). The production record retains the writer's `image_prompt`, but not necessarily the full prompt after visual anchor/style additions and director changes (`src/pipeline/recordProduction.js:54-57`; `src/media/generateImages.js:147-164`).

**Missing proof.** Provider, model/version, request ID, exact submitted prompt, seed, generation time, response metadata, file hash, provider terms snapshot, and any reference inputs are absent. “AI” is provenance category, not a rights grant. No repository evidence establishes downstream commercial rights for each provider/model configuration.

**Accuracy risk.** Generated reconstructions can look evidentiary despite being synthetic. YouTube upload correctly declares `containsSyntheticMedia:true` (`src/youtube/uploadVideo.js:53-58`), but disclosure does not validate historical/scientific accuracy or licensing.

**Current gate.** None for AI provenance/rights. Visual QC does not inspect factual accuracy.

**Publishing disposition.** Block any AI asset without provider/model/terms evidence and clear synthetic labeling policy; historical/scientific reconstructions additionally require scene-level accuracy approval.

### FCL-11 — P2 — Programmatically generated SFX have provenance, but ordinary transition SFX are not tied to it

**Affected assets.** Motion CTA SFX and transition SFX.

**Current evidence.** Motion SFX manifest entries state programmatic origin, NeoSaniye authorship, `proprietary-original`, FFmpeg synthesis, peak and version (`assets/motion/manifests/sfx-manifest.json:1-64`). Separately, transition SFX are synthesized during rendering by `makeSfx()` and mixed from temporary files (`src/video/renderVideo.js:366`, `src/video/renderVideo.js:577-605`). The production record retains only SFX type names (`src/pipeline/recordProduction.js:40-43`).

**Missing proof.** The exact synthesis recipe/version/hash used per published transition cue is not in the production record. `proprietary-original` is a repository assertion; ownership authority is not independently documented.

**Current gate.** Final output checks mixing/audibility, not provenance (`src/pipeline/hardGate.js:50-56`).

**Publishing disposition.** Motion manifest is provisionally defensible; transition SFX should be version/hash-linked to an original-asset manifest before they are treated as fully auditable.

### FCL-12 — P0 — No publication gate covers factual or licensing uncertainty

**Affected material.** All claims and every media/audio class.

**Current evidence.** The hard gate accepts only SFX output verification, CTA verification/language, music repetition/silence, and channel truth (`src/pipeline/hardGate.js:21-78`). Upload eligibility combines technical preflight, editorial QC policy, and those hard-gate results (`src/pipeline/run.js:406-423`). Licensing metadata is written after/beside selection, not validated as a prerequisite. Default editorial mode is warning, so even editorial failures can publish (`src/config.js:69-81`).

**Failure behavior.** Unknown license is not a failure: `license:null` music has published. Unsupported science claims are not a failure: the magnetoreception record published (`data/videos.json:4608-4615`).

**Publishing disposition.** Add a separate fail-closed factual/rights readiness decision before upload and cross-post. `unknown` must block, not warn.

## Asset-class defense matrix

| Class | Current durable evidence | Key gap | Current gate | Disposition |
|---|---|---|---|---|
| Script claims | Narration text only | No sources/confidence/reviewer | None | **Block** until claim map approved |
| Historical visuals | Prompt, source class; some URLs/authors | No scene-accuracy approval; AI reconstruction provenance absent | None | **Block** if evidentiary subject/era unverified |
| Scientific diagrams | Generated `gfx`/AI path | No source model or scientific review | None | **Block** until mechanism diagram reviewed |
| Pexels stock | Author/page URL retained | No license snapshot/hash/provider ID in durable record | None | **Block** pending rights record |
| Pixabay stock | Author/page URL retained | Same; provider may be lost because record labels fallback as `pexels` (`src/media/generateImages.js:265-272`) | None | **Block** pending correct provider/rights record |
| Wikimedia archive | Author/page URL retained | License/attribution/provider dropped; relevance unchecked | Description credit best-effort | **Block** if complete credit/evidence unavailable |
| Met archive | Source/author in memory | Provider/license dropped in durable record | None | **Block** pending persisted CC0 evidence |
| Gemini/Pollinations AI | `source:"ai"`, scene path | Provider/model/prompt/seed/terms/hash absent | Synthetic disclosure only | **Block** pending provenance and accuracy review |
| Legacy music | Filename, `license:null` | No per-track rights evidence/hash | Repetition/silence only | **Block immediately** |
| Imported audio music | Commit/path/license/hashes | Independent upstream assertion review remains | Manifest admission | Provisionally approve |
| Freesound ambience | Name/duration in transient object | ID/creator/URL/license/hash all lost | None | **Block immediately** |
| Imported CC0 SFX | Commit/path/license/hashes | Periodic evidence revalidation | Manifest admission | Provisionally approve |
| Motion SFX | Original-generation manifest/version | Per-use hash linkage/ownership evidence | Audibility only | Approve with documentation improvement |
| Transition SFX | Generated in code | No per-use recipe/version/hash record | Audibility only | Hold until linked manifest |

## Evidence table

| ID | Severity | Affected claim/asset | Evidence | Risk / gate result |
|---|---|---|---|---|
| FCL-01 | P0 | All claims | `src/script/generateScript.js:231-237`; `src/pipeline/recordProduction.js:47-59` | Prompt instruction replaces sourcing; no gate. |
| FCL-02 | P0 | Magnetoreception claims | `data/videos.json:4521-4539`; primary papers linked above | Debated hypothesis published as settled mechanism. |
| FCL-03 | P1 | Guy Fawkes claims/visual | `data/videos.json:4355-4387`; `data/videos.json:4452-4458` | Core history supportable; counterfactual unsourced; Bermuda visual contradicts narration. |
| FCL-04 | P1 | Confidence handling | `src/pipeline/editorialSignals.js:14-19`, `src/pipeline/editorialSignals.js:69-89` | Regex does not assess evidence. |
| FCL-05 | P0 | Legacy music | `src/audio/musicSelect.js:91-110`; `data/videos.json:4335-4339` | Published asset has null license; no rights gate. |
| FCL-06 | P2 | Imported CC0 audio | `assets/audio/README.md:1-40`; `assets/audio/manifests/audio-manifest.json:1-32` | Strong pinned provenance; residual upstream assertion uncertainty documented. |
| FCL-07 | P0 | Freesound ambience | `src/audio/fetchAmbience.js:42-67` | CC0 filter result is not durably preserved; no gate. |
| FCL-08 | P1 | Pexels/Pixabay | `src/media/fetchMedia.js:45-91`, `src/media/fetchMedia.js:103-154`; `src/pipeline/recordProduction.js:62-70` | Identifiable source, incomplete rights evidence. |
| FCL-09 | P1 | Commons/Met archive | `src/media/fetchArchive.js:33-94`; `src/pipeline/run.js:414-421` | In-memory filter/credit, incomplete durable attribution and no relevance gate. |
| FCL-10 | P1 | AI images | `src/media/generateImages.js:118-164`, `src/media/generateImages.js:238-249` | AI category retained, generation/rights provenance lost. |
| FCL-11 | P2 | Generated SFX | `assets/motion/manifests/sfx-manifest.json:1-64`; `src/video/renderVideo.js:366` | Motion assets documented; transition per-use provenance incomplete. |
| FCL-12 | P0 | All claims/assets | `src/pipeline/hardGate.js:21-78`; `src/pipeline/run.js:406-423` | No factual/license readiness input; unknowns publish. |

## Top five creative or technical blockers

1. **No claim-to-source workflow or gate (FCL-01/FCL-12).** Nothing proves material claims before automatic publication.
2. **Demonstrated scientific overstatement (FCL-02).** A live record turns a disputed mechanism into literal settled perception.
3. **Published null-license legacy music (FCL-05).** The renderer admits unmanifested tracks and the gate ignores license state.
4. **Remote/AI asset provenance is not durable (FCL-07/FCL-08/FCL-09/FCL-10).** Audit-critical fields disappear between acquisition and production state.
5. **Visual evidence can contradict narration (FCL-03).** License filtering and keyword matching did not prevent Bermuda from representing Parliament.

## Quick wins

These are recommendations only; no changes were made.

- Immediately quarantine every `assets/music/` file that resolves to `license:null`; allow only manifest-backed imported audio or procedural music until each legacy track is re-imported with evidence.
- Disable remote Freesound ambience in publish runs until its ID, creator, source URL, license string/version, API evidence, collection time, preview URL, and hash are persisted.
- Add a pre-upload report that lists every claim and asset with `verified`, `uncertain`, or `blocked`; fail on any missing row or `uncertain` material item.
- Correct the magnetoreception script's certainty and review the existing publication. Separate established magnetic orientation from the proposed cryptochrome/radical-pair mechanism and disputed visual-pattern interpretation.
- Reject the Bermuda Old State House image from the Guy Fawkes payoff and require an exact-subject check for every `real_subject` archive hit.
- Preserve fields already available in memory—Pexels ID/author URL, Pixabay provider, archive license/provider/attribution—rather than discarding them in `recordProduction()`.
- Label all AI historical/scientific visuals as reconstruction/illustration in the asset manifest and retain the exact generation request metadata.

## Structural improvements

1. **Create an atomic claim ledger.** Split narration into material claims with stable IDs; record exact wording, type (date/quantity/causal/mechanism/counterfactual), source URL/bibliography, evidence passage locator, source class, confidence, caveat, reviewer, and disposition.
2. **Require independent evidence.** The model that writes the script must not validate its own claims. Prefer primary sources for scientific mechanisms and authoritative archives/scholarship for history; use multiple sources for disputed or consequential claims.
3. **Version confidence language.** Map `established`, `strong evidence`, `supported hypothesis`, `contested`, and `unknown` to allowed narration patterns. Compare semantic claim strength, not keyword presence.
4. **Build one immutable asset manifest per video.** Include every final asset and derivative: role/scene, local hash, original hash, provider, asset ID, creator, source URL, download URL, license identifier/version, terms/evidence snapshot hash, attribution text, acquisition time, transformations, and final-file inclusion proof.
5. **Unify asset admission.** No legacy bypass. Music, SFX, ambience, stock, archive, AI, fonts, logos, and templates should pass the same rights-state enum: `verified`, `requires-attribution`, `restricted`, `unknown`, `rejected`.
6. **Separate rights from Content ID.** A rights-verified asset may still trigger a claim; store claim history and allow operational quarantine without implying the license was invalid. Conversely, no Content ID hit is not proof of permission.
7. **Add visual-evidence verification.** Exact-subject archive matches need title/description/entity checks and human review for high-risk historical/scientific scenes. Generated reconstructions must never masquerade as archive evidence.
8. **Persist required attribution before upload.** Generate platform-safe credit text from the manifest, validate required fields/links, and store the exact description posted to every platform. Cross-post failures must not erase the evidence record.
9. **Add a factual/rights hard gate.** It must receive claim-ledger readiness, per-asset rights readiness, required-attribution completeness, AI disclosure/provenance, and unresolved-risk counts. Any unavailable check fails closed.
10. **Retain review artifacts.** Store final video hash, claim ledger, asset manifest, exact published metadata, reviewer dispositions, and versioned policies together so a takedown, correction, or claim can be answered later.

## Experiments to run

| Experiment | Sample / ground truth | Decision rule |
|---|---|---|
| Claim-ledger pilot | Five recent history/science scripts; two independent fact-checkers | Publish only when all material claims have source agreement and confidence-language agreement; log disagreements. |
| Scientific certainty adversarial set | Established facts, active hypotheses, disputed mechanisms, and fabricated causal claims | Gate must block or hedge every unsupported/overstrong item and never treat absence of trigger words as certainty. |
| Archive subject-match test | Known correct images plus Bermuda/Parliament and similar hard negatives | Require high precision; uncertain matches abstain rather than fall through as “real evidence.” |
| Asset-manifest reconstruction | Reconstruct rights chain for five published videos from retained state | If any used byte cannot be tied to evidence, current schema is insufficient; target 100% before automated publication. |
| Legacy music quarantine | Manifest-only pool versus mixed legacy pool | Zero selected `license:null` assets and zero missing per-track hashes; monitor Content ID separately. |
| Attribution renderer test | CC BY, CC BY-SA, CC0, public-domain, stock, and unknown fixtures | Exact required fields must appear in stored/published metadata; unknown fixture must block. |
| AI provenance test | Gemini and Pollinations outputs with retries/splits | Every derivative must retain provider/model/request/prompt/seed/terms version/hash and synthetic status. |
| Freesound failure test | API success, missing field, changed license, timeout, and preview replacement | Only complete CC0 evidence admits the asset; all ambiguous cases abstain/block. |

## Metrics that would validate improvement

- Material claims with complete source mappings: target 100% before publish.
- Claims with confidence language matching reviewer-assessed evidence strength: target 100% for material claims.
- Unsupported or contradicted claim escape rate in post-publication audits: target 0.
- Fact-checker agreement rate and adjudication rate, separated by history/science/counterfactual claims.
- Assets in final MP4 with complete immutable rights records and hashes: target 100%.
- Selected assets with `license:null`, unknown provider, or missing source ID: target 0.
- Required attribution completeness and exact-published-metadata capture: target 100%.
- AI assets with provider/model/request/prompt/seed/terms/hash provenance: target 100%.
- Archive exact-subject precision and abstention rate on ambiguous matches.
- Content ID claim rate tracked separately from license-readiness rate; resolution evidence attached to each incident.
- Percentage of videos with unresolved factual/rights items at upload decision: target 0; overrides should be impossible for P0 unknowns.
- Time from discovered factual error to correction/unpublish decision, with immutable incident record.

## Risks and regressions

- This report is not legal advice; license compatibility, attribution sufficiency, publicity/privacy, trademark, and moral-rights questions may require qualified counsel.
- Web pages and provider terms change. Store dated evidence snapshots and hashes while respecting terms; a URL alone is not durable proof.
- Primary research can conflict or evolve. Confidence must be versioned and reviewed rather than frozen as eternal truth.
- Overly strict sourcing can remove valid common knowledge or slow production. Define “material claim” carefully, but do not exempt dates, numbers, causal mechanisms, named events, or counterfactual hooks.
- An automated source retriever can cite a paper that mentions a topic without supporting the exact claim. Require evidence locators and semantic entailment review.
- AI-provider terms may vary by account, model, geography, and date. Do not infer rights from provider identity.
- CC0/public-domain assertions can be erroneous or incomplete; retain the upstream declaration and periodically audit high-use sources.
- Attribution text can exceed platform description limits. Establish deterministic priority/overflow handling without silently dropping required credits.
- Hashing derivatives proves identity, not permission. It must accompany source/license evidence.
- Human reviewers can disagree or miss errors. Use two reviewers for high-risk science/history and retain adjudication.
- Quarantining legacy music and ambience may reduce variety; procedural/original or manifest-backed alternatives are safer than publishing unknown rights.
- Correcting an existing publication can affect performance and audience trust, but leaving a known overstatement unaddressed carries continuing credibility risk.

## Final P0/P1/P2/P3 list

### P0

- **FCL-01:** Material claims have no source mapping or factual approval gate.
- **FCL-02:** A published magnetoreception video presents disputed science as settled literal perception.
- **FCL-05:** Published legacy music assets have `license:null` and no per-track evidence.
- **FCL-07:** Freesound ambience loses all durable rights provenance before publication.
- **FCL-12:** No hard gate blocks unsupported claims, uncertain assets, missing attribution, or unknown rights.

### P1

- **FCL-03:** Guy Fawkes core history is supportable, but counterfactual claims are unsourced and a Bermuda archive image contradicts Parliament narration.
- **FCL-04:** Factual confidence is reduced to lexical regexes rather than evidence.
- **FCL-08:** Pexels/Pixabay records lack durable license/terms/hash evidence and can lose provider identity.
- **FCL-09:** Archive license filtering is not fully persisted; attribution and exact-subject validation are incomplete.
- **FCL-10:** AI assets lack provider/model/prompt/seed/terms/hash provenance and accuracy approval.

### P2

- **FCL-06:** Imported CC0 audio is well governed but still needs periodic independent evidence review.
- **FCL-11:** Motion SFX provenance is good; ordinary generated transition SFX need version/hash linkage per production.

### P3

- Add a versioned glossary for claim confidence, rights states, attribution status, synthetic reconstruction, correction status, and Content ID status after the hard-gate schema is defined.

## “No files were modified” confirmation

No application code, production configuration, prompts, tests, thresholds, manifests, assets, or existing documentation were modified. The only file created by this audit is `reports/2026-07-21/13-fact-check-license-director.md`. No assets were downloaded, no licenses were accepted, no publishing/upload command was run, and no commit or push was made.
