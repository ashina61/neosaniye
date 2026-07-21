# FFmpeg Performance Engineering Audit

**Audit date:** 2026-07-21  
**Scope:** Entire repository, with emphasis on FFmpeg/ffprobe process flow, filter graphs, synchronization, caching, memory, GitHub Actions, and exact-output QC  
**Method:** Static repository inspection plus review of checked-in artifacts. No production render, upload, dependency installation, benchmark, or code change was performed.

## Executive verdict

The pipeline has a defensible quality-first architecture: it normalizes inputs, creates the visual and audio masters separately, performs a stream-copy video mux, and runs multiple checks against the actual post-CTA MP4. The principal performance problem is not one pathological filter; it is accumulated whole-file and per-cue work. A normal render performs one H.264 normalization encode per media item, a full visual encode, a full audio encode, a mux that needlessly AAC-encodes that audio again, and—when CTA is applied—another complete H.264 encode and potentially a third AAC generation. Preflight then decodes the final file in overlapping passes, while SFX verification starts two FFmpeg processes per audible cue.

The most urgent quality-preserving correction is to stop the second AAC encode at the main mux. The most valuable structural optimization is to integrate the CTA overlay into the main visual/audio graphs, or at minimum prove through a controlled benchmark that a consolidated final render is visually and sonically equivalent. Preflight passes and SFX windows should be consolidated only after fixture-based equivalence tests; their current redundant decoding is costly but also supplies meaningful publishing safeguards.

The repository provides no render-stage wall-time/RSS/disk telemetry and no checked-in representative performance benchmark. Consequently, this report does not claim a percentage speedup or assert that GitHub-hosted runners currently exceed memory or disk. The verified constraint is a 30-minute workflow timeout that also includes setup, generation, QC, publishing, artifacts, and state persistence (`.github/workflows/daily-short.yml:44-68`, `.github/workflows/daily-short.yml:73-75`, `.github/workflows/daily-short.yml:137-165`).

## Verified findings

### P1 — Main mux performs an unnecessary second lossy AAC encode

`buildFullAudio` already produces stereo AAC at 160 kb/s (`src/video/renderVideo.js:722-728`). The immediately following mux copies video but requests AAC 160 kb/s again for the audio (`src/video/renderVideo.js:1105-1112`). This is verified duplicate encoding, not an estimate: the audio is decoded and lossy-encoded twice before CTA. Because the source is already an M4A/AAC stream with the desired channel count and rate, a stream-copy candidate exists. Acceptance must prove identical duration/channel metadata and bit-identical demuxed audio packets; if a particular FFmpeg/container combination requires transformation, retain the current path for that case.

### P1 — CTA creates a second full video encode and can create a third AAC generation

The main visual master is encoded with libx264, preset `fast`, CRF 21 (`src/video/renderVideo.js:1072-1081`). CTA rendering later burns ASS into that encoded MP4 and encodes the entire video again with libx264, preset `medium`, CRF 18 (`src/motion/ctaRenderer.js:56-83`). When CTA SFX is enabled, it also re-encodes the already twice-encoded audio to AAC 160 kb/s (`src/motion/ctaRenderer.js:59-80`). Without CTA SFX it correctly copies audio (`src/motion/ctaRenderer.js:75-80`). This is a verified generational-quality risk as well as CPU cost; the magnitude requires VMAF/SSIM and listening/measurement benchmarks. The safest target is to supply CTA ASS and CTA SFX to the original final visual/audio graphs before the first master encodes, not merely select a faster preset.

### P1 — QC repeatedly decodes the exact final file

Preflight correctly receives the final `outPath` after optional CTA replacement (`src/pipeline/run.js:240-263`). It then runs one ffprobe metadata process (`src/pipeline/preflight.js:68-80`), one complete decode (`src/pipeline/preflight.js:127-137`), a second full traversal for black/freeze/silence/volume filters (`src/pipeline/preflight.js:140-172`), a separate audio traversal for loudness (`src/pipeline/preflight.js:174-187`), and three separate seeks/processes for sampled-frame brightness (`src/pipeline/preflight.js:189-203`). SFX verification adds exactly two segment-measurement processes per eligible cue (`src/pipeline/outputVerify.js:87-123`). CTA itself adds an asset audibility process when applicable, an ffprobe validity check, and a one-frame two-input SSIM check (`src/motion/ctaRenderer.js:45-54`, `src/motion/ctaEngine.js:72-79`, `src/motion/ctaValidator.js:45-79`).

These checks are not meaningless duplication: full decode catches corruption, filters detect content defects, loudnorm measures integrated loudness, and cue windows enforce audible output. However, the first full decode and the filter traversal decode overlapping content. A benchmark prototype should split video/audio once and feed blackdetect, freezedetect, silencedetect, volumedetect, and loudnorm null sinks in a single process, while retaining a reliable failure signal for decode errors. SFX windows can potentially be measured in one audio decode/filter graph. Parser outputs must match existing fixtures before adoption.

### P1 — There is no resource evidence for the 30-minute production envelope

The scheduled job uses `ubuntu-latest` and has a hard 30-minute timeout (`.github/workflows/daily-short.yml:44-47`). That budget also covers apt FFmpeg installation, Python and Node dependency installation (`.github/workflows/daily-short.yml:55-66`), content production/publishing, reports, artifact upload, and Git state persistence. The workflow has no stage timing, peak RSS, scratch-disk, encoded-frame-speed, or cache-hit telemetry in the inspected definition. No repository benchmark file for the current full production path was found. Therefore “will exceed Actions limits” is unverified. The risk is P1 because timeout after costly generation can prevent completion/persistence, but actual headroom must be measured on the runner.

### P2 — Input normalization is sequential and computationally deliberate, but uncached

Each of `N` media items is normalized sequentially (`src/video/renderVideo.js:850-860`). Each normalization scales/crops at twice the target dimensions, runs `zoompan` at that supersampled resolution, scales to 1080x1920, enforces frame rate, optionally adds temporal grain, and H.264-encodes an intermediate (`src/video/renderVideo.js:296-356`). Those intermediates are decoded again in the final visual graph. The 2x path is explicitly intended to reduce Ken Burns jitter, so removing supersampling or grain is not a quality-preserving default recommendation.

Safe caching is possible for retry/re-render scenarios using a content-addressed key containing source-file hash, exact duration, dimensions, fps, clip index/motion parameters, category grade, animation/grain settings, FFmpeg version, and filter-version identifier. Cross-video hit rate is unknown because duration and motion parameters vary; benchmark it. Bounded parallel normalization might improve wall time but can multiply 2160x3840 filter/encoder memory and CPU contention, so test concurrency 1 versus 2 before considering a higher value.

### P2 — Deterministic SFX are regenerated per boundary instead of per unique recipe

For every non-null transition boundary, the renderer invokes `makeSfx` and writes a new WAV (`src/video/renderVideo.js:577-589`). The fallback plan cycles only four types (`src/video/renderVideo.js:800-815`), so repeated types in one video are synthesized repeatedly. Chime and click are also separate FFmpeg generations (`src/video/renderVideo.js:592-608`). The recipes are deterministic. Cache one canonical WAV per recipe/type/sample-rate/channel-layout/version and reuse it as multiple FFmpeg inputs. Guard with decoded PCM hashes to prove the cached asset is identical to current synthesis.

### P2 — Temporary lifecycle prevents resumable rendering and diagnostic reuse

Normalized clips, `fullv.mp4`, `fulla.m4a`, synthesized audio, and ASS files live in the render work directory. The directory is recursively deleted immediately after the mux (`src/video/renderVideo.js:1072-1117`). A crash before completion leaves work that may be overwritten; successful work cannot be reused by CTA/QC diagnostics. A content-addressed cache outside the ephemeral job directory, with atomic completion markers, size/age eviction, and rights-aware handling of downloaded assets, would enable retries without changing output. Do not preserve everything indefinitely: Actions disk pressure is unmeasured and downloaded media may carry lifecycle constraints.

### P2 — Scene synchronization shares an overall duration authority but not spoken-event timing

The narration duration is probed once and drives the visual span (`src/video/renderVideo.js:753-755`, `src/video/renderVideo.js:820-845`). Individual scene durations are assigned by scene weights, then xfade overlap is subtracted; they are not derived from actual word timestamps (`src/video/renderVideo.js:823-837`). Audio cue delays are rounded to integer milliseconds (`src/video/renderVideo.js:658-680`), while ASS timestamps are rounded to centiseconds (`src/video/renderVideo.js:40-48`). The final mux uses `-shortest` (`src/video/renderVideo.js:1105-1111`), and preflight only warns on duration deviation or A/V stream-end gaps (`src/pipeline/preflight.js:86-90`, `src/pipeline/preflight.js:116-124`).

Verified conclusion: gross end synchronization is explicitly controlled and checked; semantic cut-to-spoken-word synchronization is not guaranteed by this timing model. The millisecond/centisecond rounding bounds are inherent in the code, but no artifact-based drift measurement was found. Quality-preserving improvement means deriving scene/cue boundaries from the same spoken timestamp authority and validating frame/sample PTS—not changing frame rate or trimming with looser tolerances.

### P2 — Some downloads and procedural audio use whole-file memory buffers

Stock downloads read the complete response into a Node Buffer before writing (`src/media/fetchMedia.js:182-187`); ambience does the same (`src/audio/fetchAmbience.js:61-67`). The procedural music generator allocates two Float64 arrays for the full duration and then a complete PCM16 output Buffer (`src/audio/makeMusic.js:73-78`, `src/audio/makeMusic.js:175-198`). From the code, its minimum working allocations include `16 * ceil(seconds * 44,100)` bytes for the two Float64 arrays plus approximately `4 * ceil(seconds * 44,100) + 44` bytes for the PCM buffer, excluding runtime overhead—about 882,000 bytes per second by formula. Streaming downloads to files and chunked/sample-block music synthesis can reduce peak Node memory without changing bytes, but exact peak RSS and output identity need measurement.

### P2 — Child-process log capture has bounded but avoidable memory exposure

Most rendering uses promisified `execFile` with 10–20 MiB `maxBuffer`; for example normalization and masters allow 20 MiB (`src/video/renderVideo.js:350-356`, `src/video/renderVideo.js:1072-1081`, `src/video/renderVideo.js:1105-1112`). Several production FFmpeg commands do not set `-v error`, so ordinary progress is captured in memory even though it is not consumed. Sequential execution limits simultaneous buffers, but verbose failures can still hit the cap and obscure the real error. Use `spawn` with inherited/streamed diagnostic logs or add an intentional log level, while retaining stderr excerpts and exit status for reports.

### P2 — Exact-output QC is technical and acoustic, not a complete rendered editorial analysis

Yes, important QC analyzes the exact rendered output: post-CTA preflight decodes/scans `outPath`, and SFX audibility is measured from it (`src/pipeline/run.js:259-287`). CTA presence compares a frame from original and CTA output (`src/motion/ctaEngine.js:72-79`). However, retention QC receives proportional `itemSeconds`, source metadata, plans, and preflight summaries rather than decoded final frames (`src/pipeline/run.js:326-377`). Preview frames are extracted later and are not shown as inputs to the publication decision (`src/pipeline/run.js:505-528`). Therefore the system verifies file integrity, stream properties, coarse black/freeze/silence/loudness, CTA difference, and cue energy on the exact output; it does not verify final caption legibility, visual semantic alignment, transition quality, or frame-accurate narration alignment from the rendered MP4.

### P3 — Probe and preview process starts can be reduced, but are not primary bottlenecks without measurements

The renderer probes narration duration and output duration in separate necessary lifecycle locations (`src/video/renderVideo.js:30-37`, `src/video/renderVideo.js:753-755`, `src/video/renderVideo.js:1117-1120`); CTA and preflight probe the later file versions. These probes are not all redundant because the file changes. By contrast, three brightness samples and two later preview frames each start separate FFmpeg processes (`src/pipeline/preflight.js:189-203`, `src/pipeline/run.js:523-528`). Consolidation can reduce startup overhead, but it should follow whole-file encode/decode work in priority and requires a benchmark on Shorts-length inputs.

## Evidence table

| Severity | Verified repository fact | Evidence | Performance/quality implication | Validation needed |
|---|---|---|---|---|
| P1 | Audio master AAC is AAC-encoded again at mux | `src/video/renderVideo.js:722-728`; `src/video/renderVideo.js:1105-1112` | Duplicate CPU and lossy generation | Demuxed packet hash, duration, channels, playback compatibility |
| P1 | CTA burns overlay through a second full H.264 encode; CTA SFX re-encodes AAC | `src/video/renderVideo.js:1072-1081`; `src/motion/ctaRenderer.js:56-83` | Major encode cost and generational loss risk | Wall time, VMAF/SSIM, frame diffs, LUFS/true peak, listening test |
| P1 | Preflight performs overlapping full traversals plus three sample processes | `src/pipeline/preflight.js:127-203` | Repeated final-file decode | Existing parser-fixture parity, corrupt-file detection parity, wall time/RSS |
| P1 | Each eligible SFX cue creates two final-output measurement processes | `src/pipeline/outputVerify.js:87-133` | Process count and repeated seeks scale as `2C` | Cue result parity and wall time across representative cue counts |
| P1 | Actions has a 30-minute whole-job timeout and no resource instrumentation | `.github/workflows/daily-short.yml:44-68`; `.github/workflows/daily-short.yml:137-165` | Unknown production headroom | Per-stage duration, peak RSS, disk high-water mark, failure stage |
| P2 | Normalization is `N` sequential H.264 encodes with 2x filters | `src/video/renderVideo.js:296-356`; `src/video/renderVideo.js:850-860` | CPU-intensive quality-directed work | Concurrency 1/2 benchmark; frame equivalence; peak RSS |
| P2 | Deterministic SFX are produced separately for each planned boundary | `src/video/renderVideo.js:577-608`; `src/video/renderVideo.js:800-815` | Repeated synthesis and file I/O | PCM hash equality and cache-hit rate |
| P2 | Render intermediates are deleted immediately after mux | `src/video/renderVideo.js:1072-1117` | No successful-stage resume/cache | Retry benchmark, cache size, eviction behavior |
| P2 | Scene timing is weight-based; cue delays and ASS use different precision | `src/video/renderVideo.js:40-48`; `src/video/renderVideo.js:820-845`; `src/video/renderVideo.js:658-680` | End sync controlled, semantic/frame sync not proven | Packet/frame PTS and spoken-boundary alignment fixtures |
| P2 | Downloads and music synthesis buffer whole payloads/durations | `src/media/fetchMedia.js:182-187`; `src/audio/fetchAmbience.js:61-67`; `src/audio/makeMusic.js:73-78`; `src/audio/makeMusic.js:175-198` | Avoidable Node peak memory | Peak RSS and byte/hash equality |
| P2 | Exact final file feeds technical/acoustic checks, not decoded editorial QC | `src/pipeline/run.js:259-377`; `src/pipeline/run.js:523-528` | QC cannot establish full human-viewing quality | Rendered-frame/caption/sync acceptance suite |

## Top five creative or technical blockers

1. **P1 — Duplicate AAC generations:** main mux re-encodes an already finished AAC master, and CTA SFX can encode it yet again.
2. **P1 — Full CTA re-render:** every applied CTA incurs a second whole-video H.264 generation instead of joining the original master graph.
3. **P1 — Overlapping exact-output QC passes:** integrity is strong, but full decode/filter/loudness and `2C` cue-window processes repeat expensive reads/decodes.
4. **P1 — Unmeasured Actions budget:** the only verified production limit is 30 minutes for setup through persistence; there is no stage/RSS/disk evidence to prioritize safely.
5. **P2 — No resumable content-addressed intermediates:** deterministic normalization/SFX/master stages are discarded, making retries repeat work.

## Quick wins

- Prototype `-c:a copy` at the main mux only. Accept it only when packet hash, duration, sample rate, stereo layout, final preflight, and platform playback match the baseline.
- Add `-nostdin` and an intentional FFmpeg log level to production commands, and stream diagnostics rather than retaining up to 20 MiB per child. Preserve exit codes and bounded failure excerpts.
- Generate each unique deterministic SFX recipe once per cache version and reference it at every cue. Require decoded PCM hash identity.
- Add read-only timings around normalization per clip, visual master, audio master, mux, CTA, preflight subpasses, SFX verification, and previews; record peak RSS and scratch-disk high-water mark on Actions.
- Avoid regenerating preview frames if equivalent final-output samples are deliberately retained from a consolidated QC extraction. Confirm timestamps and JPEG settings match their consumers.

## Structural improvements

1. **Single-generation CTA architecture:** decide CTA plan before final render and feed its ASS overlay and sound into the existing master graphs. Preserve layer ordering, sidechain behavior, CTA validation, and a no-CTA fallback. This removes a complete video generation and one potential audio generation.
2. **Consolidated exact-output analyzer:** construct one decoded video branch for black/freeze/sample statistics and one decoded audio branch for silence/volume/loudness/cue-window statistics. Keep corruption detection explicit and compare every old/new metric on fixtures, including deliberately corrupt files.
3. **Content-addressed render stages:** cache normalized clips, deterministic SFX, and optionally masters using complete configuration/source/version hashes and atomic completion. Track hits, bytes, and evictions; never infer cache identity from filenames alone.
4. **Unified media clock:** derive visual boundaries, audio cues, captions, and validation windows from one timeline expressed in integer frames and audio samples, with word timestamps as semantic anchors. Continue checking final stream PTS and duration gaps.
5. **Bounded-memory I/O:** stream network bodies to temporary files with size limits and atomic rename; synthesize procedural PCM in chunks or hand it to a streaming encoder. Preserve byte-identical outputs where applicable.
6. **Runner-capacity control:** benchmark normalization concurrency 1 and 2 on the actual Actions image, then cap by observed RSS/CPU. Add dependency caches only with explicit keys and integrity controls; do not cache mutable downloaded creative assets without provenance/lifecycle rules.

## Experiments to run

1. **Mux A/B:** current AAC re-encode versus audio stream-copy on representative outputs; measure mux wall time/CPU and compare demuxed packets, duration, channels, loudness, and player/platform acceptance.
2. **CTA graph A/B:** current two-generation render versus integrated CTA in the first master generation; compare wall time, encoded frames/s, size, VMAF, SSIM, selected lossless frame diffs, caption/CTA raster appearance, LUFS, true peak, and cue delta.
3. **Preflight consolidation:** current processes versus combined analyzer across valid, black-start, freeze, silence, clipping, duration-gap, and corrupted fixtures; require identical pass/fail and parsed values within declared tolerances.
4. **SFX batch analysis:** `2C` processes versus one decode/filter graph for C cues; require identical `maxDb`, delta, and hard-gate decision for boundary/overlapping cues.
5. **Normalization concurrency:** concurrency 1 versus 2 for the same media set on Actions; compare total wall time, peak RSS, disk, CPU utilization, and bitstream/frame equivalence. Do not test unbounded concurrency.
6. **Cache replay:** cold render, warm identical retry, and one-parameter invalidation; verify only correctly keyed stages hit and final output matches the chosen equivalence contract.
7. **Memory A/B:** buffered stock/audio downloads and music synthesis versus streaming/chunking; compare peak RSS, exact bytes/PCM hashes, failure cleanup, and partial-file behavior.
8. **Sync fixture:** spoken markers at known timestamps plus transitions/SFX/captions; measure actual decoded video frame PTS and audio sample PTS at start, scene boundaries, CTA, and end.

## Metrics that would validate improvement

- Per-stage wall time, CPU time, encoded frames/s, peak RSS, and scratch-disk high-water mark.
- Count of FFmpeg and ffprobe processes per production, including formula inputs `N` media items and `C` verified cues.
- Number of full H.264 and AAC generations reaching the published output; target after validation: one final H.264 generation and one AAC generation.
- Cache hit/miss rate, bytes reused, invalidation correctness, and warm-retry wall time.
- VMAF, SSIM, PSNR or lossless frame-diff results at hook, captions, transitions, CTA, and high-motion frames; visual acceptance still requires rendered-frame review.
- Demuxed audio packet/decoded PCM hashes where identity is expected; otherwise integrated LUFS, true peak, channel layout, duration, and cue delta parity.
- Final video/audio start PTS, end PTS, duration gap, frame count, sample count, and semantic boundary error in frames/milliseconds.
- Preflight and hard-gate decision parity across valid and intentionally defective fixtures.
- Actions p50/p95 total and render-stage time, timeout rate, peak RSS/disk, and failure-stage distribution over enough runs to be meaningful.

## Risks and regressions

- Audio stream-copy may expose container/timestamp incompatibilities currently normalized by re-encoding; retain an evidence-based fallback.
- Integrating CTA changes filter/layer ordering and can alter typography rasterization, sidechain timing, or failure fallback even at the same CRF.
- Combining QC filters can change filter scheduling, log formatting, or error propagation; parser parity alone is insufficient without defective-file fixtures.
- Parallel normalization can increase wall time through contention or exhaust runner memory despite fewer elapsed seconds in local tests.
- Caches can serve stale creative or technical output if keys omit FFmpeg version, fonts, configuration, filter code, motion index, or source content hash.
- Streaming downloads need atomic temporary files, byte limits, timeout handling, and cleanup to avoid treating partial assets as valid.
- Replacing float timestamps with a unified integer timebase can shift established cuts by a frame; review sync and editorial rhythm, not only duration.
- Faster presets, hardware encoders, lower resolution/fps, reduced supersampling, disabled grain, or weaker QC are not accepted as default optimizations without explicit quality evidence.

## Final P0/P1/P2/P3 list

### P0

- None verified in this audit.

### P1

- Remove the duplicate AAC encode at main mux after compatibility and identity validation (`src/video/renderVideo.js:722-728`, `src/video/renderVideo.js:1105-1112`).
- Eliminate or integrate the CTA whole-file second video/audio generation with measured visual/audio parity (`src/motion/ctaRenderer.js:56-83`).
- Consolidate overlapping final-output decode and per-cue analysis only with complete gate-equivalence fixtures (`src/pipeline/preflight.js:127-203`, `src/pipeline/outputVerify.js:87-133`).
- Instrument the 30-minute Actions envelope before choosing concurrency or weaker checks (`.github/workflows/daily-short.yml:44-68`).

### P2

- Add content-addressed, versioned caching for normalized clips, deterministic SFX, and retryable masters (`src/video/renderVideo.js:577-608`, `src/video/renderVideo.js:850-860`, `src/video/renderVideo.js:1114-1115`).
- Unify scene, cue, caption, and validation timing around frame/sample/word timestamp authority (`src/video/renderVideo.js:40-48`, `src/video/renderVideo.js:820-845`).
- Stream media downloads and chunk procedural audio to bound Node memory (`src/media/fetchMedia.js:182-187`, `src/audio/makeMusic.js:73-78`).
- Extend exact-final-output QC from technical/acoustic checks to rendered editorial evidence (`src/pipeline/run.js:259-377`, `src/pipeline/run.js:523-528`).
- Stream FFmpeg logs or set deliberate log levels while preserving diagnostics (`src/video/renderVideo.js:350-356`, `src/video/renderVideo.js:1072-1112`).

### P3

- Consolidate sample/preview extraction process starts after larger passes are addressed and benchmarked (`src/pipeline/preflight.js:189-203`, `src/pipeline/run.js:523-528`).
- Document the expected FFmpeg-process formula and quality-equivalence contract for future optimization reviews.

## “No files were modified” confirmation

No application code, production configuration, dependency, source asset, or existing file was modified. The only file created by this audit is this report: `reports/2026-07-21/14-ffmpeg-performance-engineer.md`. No commit or push was performed.
