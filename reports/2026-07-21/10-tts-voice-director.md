# TTS and Voice Director Audit — 2026-07-21

## Audit basis and listening limit

This is a read-only repository audit of narration selection, synthesis, alignment, edit synchronization, and rendered voice QC. Findings labeled **Verified** are directly demonstrated by repository code or retained records. Findings labeled **Risk** are consequences that the implementation makes plausible but which require a listening test to confirm. **Unknown** means the repository contains no usable evidence.

No current production narration was available to audition. `data/videos.json` records production audio paths, for example the Guy Fawkes MP3, but the corresponding `output/` files are not present (`data/videos.json:4392`). The retained `artifacts/audio-review/` files are music previews, while the two retained regression videos are explicitly described as synthetic artifacts rather than real topic renders (`artifacts/regression/bee-before-after.md:3-5`). Therefore this audit does **not** claim that Andrew, Ryan, or any rendered delivery is natural, monotone, expressive, correctly pronounced, or intelligible by ear.

## Trace of the spoken path

1. The script prompt requests one dramatic narrator, 85–100 spoken words, short scene sentences, and varied sentence rhythm (`src/script/generateScript.js:206-224`). It does not produce machine-readable voice-performance direction.
2. Only scene narrations are spoken. They are trimmed, joined with a single space, and whitespace-normalized; the visual CTA is deliberately excluded (`src/tts/generateAudio.js:22-35`).
3. `auto` first synthesizes with Edge and falls back to Piper after any Edge error (`src/tts/generateAudio.js:58-81`). Edge receives one voice, one global rate, and one global pitch (`src/tts/edgeTts.js:71-94`). Piper receives only its model identifier (`src/tts/piper.js:18-40`).
4. Edge subtitle cues are converted into word timings by distributing each sentence cue according to character length (`src/tts/edgeTts.js:17-21`, `src/tts/edgeTts.js:42-60`). Piper audio is re-transcribed with faster-whisper for word timestamps (`src/tts/align.js:19-25`; `scripts/whisper_align.py:23-39`).
5. Those timings drive burned-in captions and uploaded SRT captions (`src/video/renderVideo.js:877-891`; `src/youtube/captions.js:20-43`). Scene and shot duration, however, is allocated from narration word counts, not spoken scene boundaries (`src/pipeline/run.js:144-150`; `src/video/renderVideo.js:820-836`).
6. The final narration is high-passed, presence-EQ'd, compressed, resampled, mixed, and loudness-normalized (`src/video/renderVideo.js:622-644`, `src/video/renderVideo.js:710-727`). Preflight checks stream presence, decode, silence, peak, duration, and loudness, but not spoken-word accuracy or performance (`src/pipeline/preflight.js:14-25`, `src/pipeline/preflight.js:93-125`, `src/pipeline/preflight.js:140-185`).

## Executive verdict

The system can reliably request and technically render a fast English narration, but it does not yet direct a performance. Its expressive intent exists mainly as prose in the script prompt—“single dramatic narrator” and varied sentence lengths—while synthesis receives one global Edge voice/rate/pitch or one Piper model for the entire Short. There is no beat-level pace, pause, stress, emotion, pronunciation, or take-selection representation.

Caption synchronization is not uniformly grounded in the actual spoken performance. The Edge path estimates word locations inside sentence-level SRT cues; the Piper path transcribes its own audio rather than forced-aligning it to the approved narration. Visual edits are then timed from word-count proportions even when word timestamps exist. As a result, captions may broadly follow the sound, but the repository does not demonstrate word-accurate synchronization, and cuts do not deliberately follow the narrator's actual phrasing.

The strongest production-safety feature is the operational fallback: a failed Edge call can still yield Piper audio. The creative cost is uncontrolled voice-identity and timing change. All 30 visible recent engine records are `edge-tts` (`data/videos.json:1251-4976`), so the repository supplies no retained evidence that fallback delivery, pronunciation, duration, or captions have been approved. Verdict: **P1 voice-direction and synchronization gap; no verified P0 defect; rendered performance quality remains unknown until production audio is retained and reviewed.**

## Verified findings

### TV-01 — P1 — Voice direction is global configuration, not story-beat direction

**Verified fact.** The default is Edge `en-US-AndrewNeural` at `+8%` and `+0Hz`; Piper fallback is `en_US-ryan-high` (`src/config.js:140-155`). Edge exposes those three global values to one synthesis command (`src/tts/edgeTts.js:71-94`). Piper exposes only the model (`src/tts/piper.js:18-32`). The script schema contains narration and visual emphasis words, but no vocal pace, pause, stress, emotion, pronunciation, or delivery fields (`src/script/generateScript.js:71-110`).

**Risk, not a listening claim.** Question, evidence, reveal, twist, and payoff can receive effectively the same synthesis settings. The prompt asks the writer to vary sentence length (`src/script/generateScript.js:222-225`), which can affect cadence indirectly, but that is not control over the voice's actual stress contour, emotional intensity, or pause behavior.

**Repository-specific consequence.** A first-scene question, the pivot “But ten days before the attack,” and the final Guy Fawkes payoff are all flattened into the same synthesis request (`data/videos.json:4362-4386`; `src/tts/generateAudio.js:32-35`). The voice system cannot explicitly lift the question, pause after “But,” stress “anonymous letter,” or land “forever.”

### TV-02 — P1 — Automatic fallback changes narrator identity and control surface without a creative gate

**Verified fact.** Any Edge failure in `auto` mode immediately selects Piper (`src/tts/generateAudio.js:63-80`). The configured identities are different model families—Andrew versus Ryan—and Piper receives neither the Edge rate nor pitch controls (`src/config.js:144-155`; `src/tts/piper.js:18-32`). The selected engine is logged (`src/pipeline/recordProduction.js:60-73`), but synthesis proceeds without a voice-consistency comparison or human approval.

**Risk.** A network or provider incident can change narrator timbre, pace, pause behavior, pronunciation, and total duration for otherwise identical scripts. This threatens series identity and makes a fallback-produced episode incomparable to Edge episodes.

**Unknown.** No Piper production record or retained Piper narration was found, so the magnitude of the audible identity shift cannot be judged. Recent records show Edge use, not fallback validation (`data/videos.json:1251-4976`).

### TV-03 — P1 — Scene boundaries are flattened, so intentional pauses are neither represented nor guaranteed

**Verified fact.** Scene narrations are joined with a plain space and collapsed to one flat string (`src/tts/generateAudio.js:25-35`). No SSML, pause token, phoneme markup, or scene-level synthesis call is passed to either provider (`src/tts/edgeTts.js:84-94`; `src/tts/piper.js:27-38`). The writer is told to produce one sentence per scene and vary rhythm (`src/script/generateScript.js:220-225`), so punctuation is the only remaining indirect pause signal.

**Risk.** A reveal can run directly into its evidence, and a payoff may not receive a deliberate breath. For the Lisbon script, the system cannot independently direct the pace changes between “Suddenly,” “Then,” and “Just hours later” (`data/videos.json:4882-4899`). Those transitions depend entirely on how a provider interprets punctuation at one global rate.

### TV-04 — P1 — Edge “word timings” are estimates inside sentence cues, not observed word boundaries

**Verified fact.** The Edge parser states that newer Edge SRT cues are sentence-level and divides their duration among words proportional to character length (`src/tts/edgeTts.js:17-21`, `src/tts/edgeTts.js:42-60`). It additionally shortens every allocated word end to 92% of its proportional duration (`src/tts/edgeTts.js:52-58`). This contradicts the higher-level comment that Edge supplies its own WordBoundary timing (`src/tts/generateAudio.js:17-19`) for the version behavior the parser actually handles.

**Impact.** Natural speech duration is not proportional to spelling length. “8.5-9.0,” “G.P.W.,” and “cryptochromes” can have timing behavior unlike the allocation. Burned-in caption grouping uses gaps and punctuation from these estimates (`src/video/captionLayout.js:62-97`), and the official SRT is built from the same timings (`src/youtube/captions.js:20-43`). Thus Edge captions are linked to the sentence envelope but not verified against actual word onsets and offsets.

### TV-05 — P1 — Piper alignment is unconstrained transcription and can silently lose the approved text

**Verified fact.** Piper returns no word timings (`src/tts/piper.js:40`). Faster-whisper transcribes the audio with word timestamps and outputs the recognized words directly; it receives the audio path and model only, not the source narration (`src/tts/align.js:19-25`; `scripts/whisper_align.py:20-39`). It records neither confidence nor a source-versus-transcript mismatch. If alignment throws, the pipeline catches the error and continues with an empty timing array (`src/tts/generateAudio.js:84-96`). Rendering then permits no subtitles when that array is empty (`src/video/renderVideo.js:877-891`).

**Impact.** A misrecognized proper name or number becomes wrong in both burned-in captions and the uploaded SRT, even if Piper spoke something else. A total alignment failure does not reject the production; it merely removes timed captions and sets the reported duration estimate to zero, after which upstream scene estimates fall back to 40 seconds (`src/tts/generateAudio.js:94-98`; `src/pipeline/run.js:144-150`). The renderer probes real audio duration, preventing necessarily corrupt output (`src/video/renderVideo.js:753-755`), but caption and early QC evidence are lost.

### TV-06 — P1 — No pronunciation or number-normalization layer exists for known risky scripts

**Verified fact.** The approved narration is passed to TTS after whitespace normalization only (`src/tts/generateAudio.js:32-35`). Neither provider receives a pronunciation lexicon, phonemes, aliases, or normalized spoken forms (`src/tts/edgeTts.js:84-94`; `src/tts/piper.js:27-38`). Repository scripts contain concrete risk cases:

- “In 1605,” “Robert Catesby,” “36 barrels,” “Lord Monteagle,” and “Guy Fawkes” (`data/videos.json:4362-4383`).
- “cryptochromes” and an explanation of electron pairs (`data/videos.json:4526-4534`).
- “In 1755” and the numeric range “magnitude 8.5-9.0” (`data/videos.json:4882-4887`).
- Older records also include “Major G.P.W. Meredith” and “over 20,000 emus” (`data/videos.json:11-23`).

**Unknown.** Whether either voice pronounces these correctly is not established without the missing audio. The defect is the absence of a detection, override, and approval mechanism—not proof of a particular mispronunciation.

### TV-07 — P2 — Editorial emphasis controls typography, not vocal stress

**Verified fact.** The script model asks for 6–12 `emphasis_words` such as names, numbers, and twist words (`src/script/generateScript.js:104-110`). The pipeline passes them to rendering (`src/pipeline/run.js:202-216`), and captions turn them into a distinct emphasized style (`src/video/renderVideo.js:88-96`). `generateAudio` receives only the script and never maps `emphasis_words` into TTS controls (`src/pipeline/run.js:114-118`; `src/tts/generateAudio.js:45-65`).

**Impact.** The screen may shout a number or reveal that the narrator does not acoustically stress. This creates avoidable disagreement between voice and typography at the exact beats intended to feel important.

### TV-08 — P1 — Editing follows word-count allocation, not actual spoken phrasing

**Verified fact.** The pipeline estimates each scene's share from narration word count (`src/pipeline/run.js:144-150`), passes those weights into rendering (`src/pipeline/run.js:202-206`), and the renderer allocates the true audio span proportionally to those weights (`src/video/renderVideo.js:820-836`). It does not derive per-scene start/end times from the TTS word stream. The actual narration file determines only overall duration (`src/video/renderVideo.js:753-755`).

**Impact.** A slowly spoken proper name, numeric range, question pause, or emphatic short sentence does not move its cut. The visual for one scene can leave while its sentence is still being spoken, or linger into the next sentence. Captions may approximately follow the voice while the images follow word counts, so captions, edit, and performance do not share one timing authority.

### TV-09 — P2 — Script pace target is inferred from word budget, not validated from rendered delivery

**Verified fact.** The prompt equates 85–100 words with approximately 35–40 seconds (`src/script/generateScript.js:206-220`), while Edge is globally accelerated by `+8%` (`src/config.js:146-148`). The audio CLI reports only engine, paths, word count, estimated duration, and the first five words (`scripts/generate-audio.js:30-36`). Retention QC checks first-speech time and only counts inter-word gaps above 1.5 seconds (`src/pipeline/retentionQC.js:68-85`, `src/pipeline/retentionQC.js:132-137`).

**Impact.** There is no rendered WPM, articulation-rate, pause-ratio, per-beat pace, sentence-final pause, or payoff-breath target. A 35-second 100-word read and a 40-second 85-word read both satisfy the prompt's approximate framing but yield materially different energy. The current dead-air threshold detects gross silence, not expressive pacing.

### TV-10 — P1 — Rendered voice QC validates signal health, not narration quality

**Verified fact.** The final voice chain adds high-pass filtering, presence EQ, compression, and makeup gain before the mix (`src/video/renderVideo.js:622-644`). SFX can also sidechain-compress narration around cues (`src/video/renderVideo.js:683-703`). Final preflight checks audio stream presence, A/V duration, silence, peak, and loudness (`src/pipeline/preflight.js:93-125`, `src/pipeline/preflight.js:140-185`). Retention tests use fabricated word timings such as `w0`, `w1`, and exercise first speech/dead air rather than spoken accuracy (`test/retention.test.js:60-65`, `test/retention.test.js:159-175`). No TTS parser/alignment/pronunciation tests were found.

**Risk.** A technically valid, -14 LUFS render may still contain a wrong name, rushed number, clipped consonant, synthetic pause, strained compression, monotone payoff, or caption mismatch. Signal audibility is not evidence of intentional delivery. Because no production narration is retained here, post-chain intelligibility and phone-speaker translation are unknown.

## Evidence table

| ID | Severity | Status | Repository evidence | What the evidence establishes |
|---|---|---|---|---|
| TV-01 | P1 | Verified capability gap | `src/config.js:140-155`; `src/tts/edgeTts.js:71-94`; `src/tts/piper.js:18-32` | One global Edge setting set or one Piper model; no beat-level voice control. |
| TV-02 | P1 | Verified behavior / audible impact unknown | `src/tts/generateAudio.js:63-80`; `src/pipeline/recordProduction.js:60-73` | Provider errors switch voice family automatically; engine is logged after the choice. |
| TV-03 | P1 | Verified | `src/tts/generateAudio.js:22-35` | All scene text becomes one space-joined utterance; scene pauses are not encoded. |
| TV-04 | P1 | Verified | `src/tts/edgeTts.js:17-21`, `src/tts/edgeTts.js:42-60` | Sentence cue time is divided by character length; it is not measured word alignment. |
| TV-05 | P1 | Verified | `scripts/whisper_align.py:23-39`; `src/tts/generateAudio.js:84-96` | Piper captions use unconstrained ASR; alignment failure degrades to no timings. |
| TV-06 | P1 | Verified mechanism gap / pronunciation unknown | `src/tts/generateAudio.js:32-35`; `data/videos.json:4362-4383`; `data/videos.json:4526-4534`; `data/videos.json:4882-4887` | Risky names/numbers exist, with no normalization or override path. |
| TV-07 | P2 | Verified | `src/script/generateScript.js:104-110`; `src/video/renderVideo.js:88-96` | Emphasis metadata changes captions only, not vocal stress. |
| TV-08 | P1 | Verified | `src/pipeline/run.js:144-150`; `src/video/renderVideo.js:820-836` | Edit durations use word-count proportions rather than spoken scene boundaries. |
| TV-09 | P2 | Verified | `src/script/generateScript.js:206-224`; `src/pipeline/retentionQC.js:68-85` | Pace is prompted approximately; QC catches only start delay and long gaps. |
| TV-10 | P1 | Verified QC gap / rendered quality unknown | `src/video/renderVideo.js:622-727`; `src/pipeline/preflight.js:140-185` | Final QC measures signal properties, not pronunciation, prosody, or text agreement. |
| L-01 | — | Listening limit | `data/videos.json:4392`; `artifacts/regression/bee-before-after.md:3-5` | Records refer to absent production audio; retained regression is synthetic. |

## Top five creative or technical blockers

1. **No performance plan reaches synthesis (TV-01/TV-03/TV-07).** The story knows which words matter visually, but voice delivery has no beat-level pace, pause, stress, or emotional intent.
2. **Caption timing lacks a single trustworthy source (TV-04/TV-05).** Edge estimates words within sentence cues; Piper substitutes ASR output for the approved narration.
3. **Cuts do not follow spoken scene boundaries (TV-08).** The edit is proportional to word counts, so narrator phrasing cannot author the timeline.
4. **Names and numbers have no pronunciation gate (TV-06).** Existing history/science scripts contain exactly the forms most likely to need normalization or review.
5. **No rendered performance acceptance gate exists (TV-02/TV-10).** A provider identity change or poor take can pass technical audio checks and proceed without listening evidence.

## Quick wins

These are audit recommendations, not changes made in this task.

- Add a pre-synthesis narration manifest to each production report: exact spoken text, provider, voice/model, rate, pitch, expected spoken forms for every number/name, and whether fallback occurred. This makes the existing engine log (`src/pipeline/recordProduction.js:60-73`) actionable.
- Define a small repository-specific pronunciation review list seeded by current scripts: `G.P.W.`, `20,000`, `Cicada 3301`, `Catesby`, `Monteagle`, `cryptochromes`, `1755`, and `8.5-9.0` (`data/videos.json:11-23`; `data/videos.json:4362-4383`; `data/videos.json:4526-4534`; `data/videos.json:4882-4887`). Record intended spoken forms; do not assume provider defaults.
- Make alignment-text mismatch and empty timings visible as a blocking voice-QC result rather than only a warning. The current empty-array recovery is at `src/tts/generateAudio.js:84-96`.
- Report actual narration WPM, first-word onset, sentence pause distribution, longest internal gap, and final-word-to-video-end gap from the produced audio/timings. This extends the narrow metrics at `src/pipeline/retentionQC.js:68-85`.
- Require a short audition sheet for primary and fallback voices using the same hook, proper-name line, numeric line, mechanism line, and payoff. Store scores and identity approval; do not call a voice “natural” from its model name or configuration comment.

## Structural improvements

1. **Create a voice-performance contract before synthesis.** For each scene, represent intent such as `question`, `evidence`, `turn`, `reveal`, or `payoff`; target pace band; pre/post pause; stressed tokens; and pronunciation overrides. Keep it independent from provider syntax so Edge and Piper can be evaluated against the same editorial intent.
2. **Preserve scene boundaries through synthesis.** Either synthesize boundary-aware segments with controlled joins or use a provider-supported pause/prosody mechanism that can be measured. The approved narration must remain textually identical after normalization, and joins must be checked for clicks, doubled pauses, and voice discontinuity.
3. **Adopt source-constrained alignment.** Align the synthesized waveform to the approved narration, retain confidence/mismatch data, and reject missing, inserted, or substituted content—especially numbers and proper names. Do not use unconstrained ASR text as the official caption transcript.
4. **Make spoken timing the edit authority.** Map every scene's approved token span to actual audio timestamps, then derive shot boundaries and caption events from those spans. Word-count estimates can remain a pre-synthesis planning fallback, not the final timeline.
5. **Separate operational fallback from editorial approval.** A fallback can preserve a draft render, but publishing should require that the fallback voice is identity-approved, passes pronunciation/text checks, and meets duration/pacing tolerances relative to the primary.
6. **Add rendered voice QC.** Run it after EQ, compression, SFX ducking, mixing, and mux—not on raw TTS alone. It should include source-text agreement, pronunciation checklist disposition, clipping/true peak, intelligibility spot checks on phone/laptop speakers, and human ratings for intent, emphasis, pacing, and series consistency.
7. **Retain reviewable evidence.** Keep a small, explicitly licensed/internal set of representative production voice excerpts or hashes plus machine metrics and human review records. The current repository cannot support an evidence-based listening verdict.

## Experiments to run

| Experiment | Controlled comparison | Required material | Decision rule |
|---|---|---|---|
| Primary voice delivery | Andrew at current `+8%` versus slower/global alternative versus beat-directed delivery | Same 90-word script containing question, reveal, name, number, payoff | Advance only if blinded reviewers prefer intent/emphasis without lower intelligibility or excessive duration. |
| Primary versus fallback identity | Edge Andrew versus Piper Ryan on identical normalized text | Same five-line audition sheet and final post-processing chain | Approve automatic publishing only if identity consistency, pronunciation, and pace remain within predefined tolerances. |
| Pause architecture | Current flat join versus explicit scene pauses with reveal/payoff-specific durations | Guy Fawkes and Lisbon scripts | Choose the version with better comprehension and payoff ratings without a worse first-3-second hold or completion proxy. |
| Alignment method | Current Edge proportional timing / Piper ASR versus source-constrained alignment | Audio with `G.P.W.`, `36`, `Monteagle`, `cryptochromes`, `8.5-9.0` | Require zero transcript substitutions and materially lower median/P95 word-boundary error. |
| Edit authority | Word-count scene timing versus audio-aligned scene timing | Same narration, visuals, transitions | Prefer aligned timing if boundary spill is reduced and human raters report stronger narration–visual coherence. |
| Post-chain intelligibility | Raw TTS versus final EQ/compression/mix on phone speaker | Hook, dense mechanism line, quiet consonants, SFX cue overlap | Final chain must not reduce transcription accuracy or human word recognition; no cue may obscure a key word. |

No publishing experiment should begin until offline rendered comparisons pass voice QC. Online retention can validate the winning approved variants later, but it cannot diagnose a mispronunciation by itself.

## Metrics that would validate improvement

- **Source-text agreement:** 100% approved-token preservation; zero number/proper-name substitutions in official captions.
- **Alignment accuracy:** median and P95 absolute word-onset error against a manually annotated sample; scene-boundary error; caption lead/lag distribution. Set thresholds only after baselining actual audio.
- **Pronunciation pass rate:** 100% disposition for flagged names/numbers; zero unresolved high-risk utterances at publish gate.
- **Performance ratings:** blinded 1–5 ratings for intentionality, emotional contour, stress accuracy, pause quality, payoff landing, and series-voice consistency; report inter-rater agreement.
- **Pacing:** actual WPM and articulation rate by story beat; pause ratio; first-word onset; longest unintended gap; final spoken word to ending interval.
- **Fallback parity:** primary/fallback duration delta, WPM delta, source-text agreement, pronunciation pass rate, and identity-consistency rating.
- **Rendered intelligibility:** human word recognition and ASR word-error rate on the final mix, including phone-speaker playback and SFX-overlap windows.
- **Editorial synchronization:** percentage of scene cuts within an approved tolerance of spoken scene boundaries; count of visuals that change before their narration finishes.
- **Viewer outcomes after offline approval:** first-second and first-three-second retention for hook delivery; completion and average percentage viewed for pace; rewatch for payoff/loop. Segment by provider/voice and script format to avoid attributing topic or visual differences to voice.

## Risks and regressions

- Explicit pauses can lengthen the Short, weaken urgency, and move every downstream cut; duration and retention gates must be recalibrated from measured audio.
- Segment synthesis can create timbre, loudness, room-tone, or prosody discontinuities at joins even with one voice model.
- Pronunciation normalization can change the caption source if display text and spoken text are not kept as separate, traceable fields.
- A forced aligner can report confident-looking timestamps for bad audio; retain mismatch/confidence evidence and human spot checks.
- Beat-level direction can become exaggerated or theatrical. Compare against a restrained baseline and judge clarity before novelty.
- Rejecting fallback voice changes can reduce operational availability. Preserve draft rendering if useful, but keep publish approval fail-closed for unapproved identity changes.
- Replacing proportional timings may alter caption grouping because grouping depends on gaps above 0.28 seconds (`src/video/captionLayout.js:62-97`); rendered captions need regression review.
- Moving cuts to spoken boundaries can disrupt transition and SFX placement, including narration ducking (`src/video/renderVideo.js:683-703`). Recheck key-word intelligibility at every shifted cue.
- Stronger voice dynamics may interact with the fixed compressor and loudness normalization (`src/video/renderVideo.js:622-627`, `src/video/renderVideo.js:710-727`), flattening emphasis or raising breaths.
- Online metric changes will be confounded by topic, hook wording, visual source, format, and publishing slot unless voice variants are randomized or tightly matched.

## Final P0/P1/P2/P3 list

### P0

- None verified from the available repository evidence.

### P1

- **TV-01:** No beat-level performance direction reaches either TTS provider.
- **TV-02:** Automatic fallback can change narrator identity and pacing without an editorial approval gate.
- **TV-03:** Flat scene joining provides no explicit pause architecture.
- **TV-04:** Edge word timings are character-proportional estimates inside sentence cues.
- **TV-05:** Piper captions use unconstrained ASR, and alignment failure silently degrades to empty timings.
- **TV-06:** Proper names, acronyms, years, quantities, and numeric ranges have no pronunciation/normalization gate.
- **TV-08:** Visual timing follows word counts rather than actual spoken scene boundaries.
- **TV-10:** Rendered QC measures technical signal health but not text accuracy, pronunciation, intelligibility, prosody, or voice identity.

### P2

- **TV-07:** Caption emphasis metadata is not translated into vocal stress.
- **TV-09:** Actual delivery pace and expressive pause distribution are not measured or acceptance-tested.

### P3

- Add a documented, versioned audition rubric and representative test utterance set after P1 timing and publish-gate work is defined.

## “No files were modified” confirmation

No application code, production configuration, prompts, tests, assets, or existing documentation were modified. The only file created by this audit is `reports/2026-07-21/10-tts-voice-director.md`. No dependencies were installed, no audio was generated, no publishing/upload command was run, and no commit or push was made.
