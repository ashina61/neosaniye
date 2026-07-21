# Software Reliability and Unattended Operations Audit

**Audit date:** 2026-07-21  
**Scope:** Entire repository, emphasizing unattended GitHub Actions, publishing side effects, durable state, crash recovery, reruns, reports, tests, and operational visibility  
**Method:** Static inspection of workflows, pipeline code, publishing clients, state adapters, reports, tests, and checked-in operational artifacts. No external calls, uploads, production runs, state changes, or fault injection were performed.

## Executive verdict

The factory is not currently safe to operate unattended under ambiguous upload failures or reruns. Its technical/editorial upload gates are substantially stronger than its publishing transaction model. The decisive reliability flaw is ordering: YouTube and Meta publishing occur before the first durable production record is created (`src/pipeline/run.js:406-456`, `src/pipeline/run.js:531-560`). There is no stable production/content idempotency key passed to any platform, no pre-upload intent record, and no startup reconciliation with remote platforms. A process crash, runner timeout, or uncertain network error after remote acceptance but before `recordProduction` can therefore produce a remote post that the next run does not know exists. Because video records use an auto-generated Firestore document or a timestamped local ID, rerunning the same content creates another record rather than updating an existing attempt (`src/lib/firestore.js:137-151`). This is a P0 duplicate-publishing exposure.

Multi-platform status is also not durable. Instagram and Facebook publish concurrently after YouTube, each converts errors to `null`, and their returned IDs are not included in `report.json`, `recordProduction`, or the pipeline return value (`src/social/meta.js:138-207`, `src/social/meta.js:253-258`, `src/pipeline/run.js:437-456`, `src/pipeline/run.js:471-523`, `src/pipeline/run.js:533-596`). The record status becomes `published` solely when YouTube succeeded (`src/pipeline/run.js:551-558`). This prevents reliable per-platform retry or reconciliation and can label a YouTube-only partial success as fully published.

The repository does have valuable safeguards: one shared pre-publish quality gate covers all platforms; the production artifact steps use `if: always()`; scheduled jobs are serialized; Meta requests have explicit timeouts; QC history avoids duplicate rows by internal `videoId`; and top-level failures exit non-zero. These do not close the remote-side-effect gap. The required reliability model is a durable, stable production ledger with per-platform state transitions (`pending`, `uploading`, `remote_unknown`, `published`, `failed_retryable`, `failed_terminal`), remote IDs/checkpoints written immediately after each side effect, reconciliation before retry, and atomic/transactional state updates.

## Verified findings

### P0 — Remote upload precedes durable intent/state and is not idempotent

The script is generated and the output directory is selected before the main `try` (`src/pipeline/run.js:82-114`), but no production record is created. After QC, YouTube upload is the first durable external publishing side effect (`src/pipeline/run.js:406-424`), followed by comment, captions, and Meta (`src/pipeline/run.js:426-456`). Only afterward are reports written and `recordProduction` called (`src/pipeline/run.js:471-560`). `uploadVideo` creates a new YouTube video and accepts no application idempotency key or existing remote ID (`src/youtube/uploadVideo.js:29-66`).

Desired invariant: before any remote side effect, one stable production ID and content fingerprint must exist durably; every retry must resume/reconcile that record rather than issue another create. Acceptance test: terminate the process immediately after the remote API returns success but before the next state write, rerun the same production ID, and prove exactly one remote post exists and the ledger converges to its remote ID.

### P0 — Ambiguous upload outcomes can become duplicates

The YouTube client uses the library’s resumable upload call, but the repository persists neither upload-session URI nor an attempt record (`src/youtube/uploadVideo.js:5-9`, `src/youtube/uploadVideo.js:44-66`). There is no explicit request timeout, reconciliation query, or duplicate lookup in this path. A transport exception does not prove YouTube rejected the video. The outer catch writes a new minimal `failed` production record best-effort and rethrows (`src/pipeline/run.js:597-600`); if the remote accepted the upload, that failed record has no YouTube ID. A later manual rerun invokes a fresh create.

Meta has the same uncertainty at more boundaries: container/start, binary upload, and publish/finish. Request and binary timeouts exist (`src/social/meta.js:25-42`, `src/social/meta.js:107-132`), but timeout handlers return `null` through platform-level catches without persisting container/video IDs (`src/social/meta.js:138-207`). Desired invariant: timeout after a create or publish request enters `remote_unknown`, never immediate recreate. Acceptance test: inject timeout after each remote boundary, query/reconcile the recorded container or upload session, then prove retry publishes at most once.

### P1 — Partial YouTube/Instagram/Facebook outcomes are neither represented nor retryable

YouTube uploads first. Instagram and Facebook then execute concurrently (`src/pipeline/run.js:413-444`, `src/social/meta.js:253-258`). Platform functions catch errors and return `null`; an outer catch in `run.js` also converts any cross-post exception to two nulls (`src/social/meta.js:175-177`, `src/social/meta.js:204-206`, `src/pipeline/run.js:439-444`). Only success messages are logged. The `social` object leaves scope and is absent from the report, record, notification, and return result. The persisted `status` depends only on `youtube` (`src/pipeline/run.js:551-558`).

Desired invariant: every configured platform has its own durable attempt count, status, remote ID, last error class/message, timestamps, and next action. Acceptance test: make YouTube and Instagram succeed while Facebook fails; verify the run is recorded as partial, rerun retries only Facebook, and no second YouTube/Instagram post is created.

### P1 — State backends are exclusive fallbacks, not replicas, and cannot reconcile disagreement

`getFirestore` selects Firestore when configured; otherwise it selects local JSON. If Firestore initialization parsing/setup fails, it silently changes authority to local JSON for that process (`src/lib/firestore.js:22-46`). Every state read/write then uses only the selected backend (`src/lib/firestore.js:75-132`, `src/lib/firestore.js:137-172`, `src/lib/firestore.js:238-250`). There is no version, quorum, comparison, merge, or reconciliation between Firestore and local files. The workflow nevertheless commits local files after every run (`.github/workflows/daily-short.yml:152-165`).

If Firestore and local JSON disagree, verified behavior is not “Firestore wins after reconciliation”; it is “whichever backend this process selected is the only state observed.” A malformed/missing secret can expose stale local state and allow a repeated topic. Desired invariant: one declared system of record with fail-closed production publishing when unavailable, plus an explicit migration/reconciliation tool for any mirror. Acceptance test: seed contradictory versions and make Firestore unavailable; automatic publishing must stop with a visible state-authority error rather than use stale local dedup state.

### P1 — `recordProduction` is non-transactional and creates duplicate/orphan records

`recordProduction` first appends a video record, then separately marks the topic used (`src/pipeline/recordProduction.js:78-80`). Firestore `logVideo` uses `.add`, generating a new document every call; local mode uses `normalizedTopic-Date.now()` and appends (`src/lib/firestore.js:137-151`). If `markTopicUsed` fails, the video record exists without its dedup marker and the function throws. The outer catch then calls `recordProduction` again with `status: failed`, potentially creating another video record and retrying the marker (`src/pipeline/run.js:597-600`). There is no transaction or deterministic document ID.

Desired invariant: production record and topic reservation are atomically committed under a deterministic production/content ID, or recoverably linked by a state machine. Acceptance test: inject failure between `logVideo` and `markTopicUsed`; confirm one record exists, reservation is recoverable, and retry updates rather than appends.

### P1 — Duplicate topic detection is advisory after retry exhaustion

Script generation checks `isTopicUsed` and retries up to three times (`src/script/generateScript.js:381-446`). If all attempts fail to yield a fresh acceptable result, it returns the last script with `duplicate: true` (`src/script/generateScript.js:486-493`). The pipeline does not inspect `script.duplicate` before rendering or upload. `FORCE_TOPIC` explicitly bypasses the used-topic check (`src/script/generateScript.js:442-445`). Topic reservation is not made until after all remote publishing (`src/pipeline/run.js:531-560`).

Thus the same normalized content can pass to upload by verified control flow. Concurrency serialization reduces simultaneous scheduled races (`.github/workflows/daily-short.yml:37-39`) but does not address reruns or the upload-before-reservation window. Desired invariant: duplicate exhaustion blocks unattended publishing unless an explicit, auditable override supplies a new production ID and policy. Acceptance test: make all generated candidates used; prove rendering may be retained as an artifact but no platform create is called.

### P1 — Local JSON writes are not atomic or concurrency-safe

Local reads return the fallback for any error, including malformed/truncated JSON (`src/lib/firestore.js:60-67`). Writes replace the target directly with `writeFile`, without temporary-file rename, fsync, lock, revision, or compare-and-swap (`src/lib/firestore.js:68-71`). A crash during write can therefore turn valid state into malformed state; the next read silently treats it as empty. The workflow-level concurrency group serializes this one workflow, but manual/local processes and other workflows are not protected by the file layer itself.

Desired invariant: state is atomically written with schema/revision validation; corruption is surfaced and publishing fails closed. Acceptance test: truncate each JSON at every write boundary and run two writers; verify the previous valid revision remains recoverable and no empty-state publishing proceeds.

### P1 — Job timeout can interrupt the publish/state gap

The Actions job has a 30-minute timeout covering setup, generation, QC, upload, reports, artifact upload, and Git persistence (`.github/workflows/daily-short.yml:44-75`, `.github/workflows/daily-short.yml:116-165`). YouTube has no explicit application timeout in the repository (`src/youtube/uploadVideo.js:41-66`). Meta binary upload allows 180 seconds and Instagram processing polls for up to four minutes (`src/social/meta.js:107-168`). A job-level timeout can terminate execution without reaching `recordProduction`; whether later `if: always()` steps execute after this exact timeout condition is not guaranteed or tested by repository evidence. Even if artifacts run, they cannot reconstruct unrecorded remote IDs.

Desired invariant: reserve state before upload, impose bounded per-operation deadlines below the remaining job budget, persist checkpoints immediately, and stop starting side effects when insufficient time remains. Acceptance test: force timeout during YouTube response, Meta binary upload, Instagram processing, and state write; reconcile next run without duplicate posts.

### P1 — Git-based local-state persistence can fail after in-run success

The state-persistence step runs `git commit`, then permits `git pull --rebase` failure with `|| true`, then pushes (`.github/workflows/daily-short.yml:154-165`). If the pull/rebase or push cannot converge, the runner’s local JSON changes are lost when the ephemeral runner disappears. The comment in `firestore.js` correctly says cross-run persistence on hosted runners requires Firestore (`src/lib/firestore.js:6-13`), but the workflow comment presents committing local state as a fallback (`.github/workflows/daily-short.yml:152-154`). This fallback is best-effort and has no retry/reconciliation artifact.

Desired invariant: publishing must not depend on a post-upload Git push for dedup durability. Acceptance test: make Firestore absent and reject the state push after a successful remote upload; next run must discover the existing production remotely or fail closed.

### P2 — Reports and notifications conceal operationally material failures

`report.json`, `publish-kit.txt`, previews, notifications, comment uploads, caption uploads, stats updates, and several analytics/crew calls use catches that suppress failure or reduce it to a boolean/null (`src/pipeline/run.js:67-76`, `src/pipeline/run.js:426-456`, `src/pipeline/run.js:523-528`, `src/pipeline/run.js:582-591`). Some are appropriately best-effort for product continuity, but the durable production record lacks an operations section listing those degraded outcomes. Notification failure is fully suppressed, so the absence of an alert is indistinguishable from success.

Desired invariant: noncritical failures do not fail publishing, but are durably recorded with component, error category, attempt count, and timestamp. Acceptance test: fail each best-effort dependency and verify the final ledger/report exposes `degraded` status even though process exit remains zero.

### P2 — Artifact persistence is useful but incomplete for recovery

The video/report artifact step uses `if: always()` and retains final MP4, publish kit, reports, and previews for seven days (`.github/workflows/daily-short.yml:137-150`). It does not persist a machine-readable publishing ledger containing platform IDs, attempt states, checksums, or upload-session/container identifiers. If report writes fail, the catches permit missing reports; `if-no-files-found: ignore` then permits an empty artifact selection (`src/pipeline/run.js:523-528`, `.github/workflows/daily-short.yml:137-150`). Artifacts support human inspection, not deterministic recovery.

### P2 — QC history idempotency is narrow and race-prone

QC history checks existing lines for the internal `videoId` and appends once (`src/pipeline/qcHistory.js:68-99`), with direct unit tests covering duplicate IDs and malformed lines (`test/qcHistory.test.js:64-102`). That internal ID is generated only after publishing, differs on rerun, and is not a content or remote idempotency key. The read-check-append operation has no lock, so concurrent writers could both append. This is useful observational deduplication, not publishing deduplication.

### P2 — Reliability test coverage does not exercise the production transaction

The test suite contains focused coverage for retention/upload eligibility, hard gates, preflight, output verification, QC history, scheduling, captions, motion, and audio import (`package.json:9-20`; files under `test/`). Repository search found no tests invoking `runPipeline`, `recordProduction`, `uploadVideo`, or `crossPost`. There are no fault-injection tests for remote success followed by crash, ambiguous timeout, partial platforms, Firestore/local disagreement, Git push loss, or rerun idempotency. This audit did not execute tests because the request is read-only analysis and coverage can be established statically; runtime pass status is therefore unverified.

## Evidence table

| Severity | Boundary | Verified current behavior | Evidence | Required invariant/test |
|---|---|---|---|---|
| P0 | YouTube create → state | Remote create precedes any production record | `src/pipeline/run.js:406-424`; `src/pipeline/run.js:531-560` | Kill after API success; rerun creates no duplicate |
| P0 | Ambiguous upload | No persisted YouTube session/attempt or remote reconciliation | `src/youtube/uploadVideo.js:29-66`; `src/pipeline/run.js:597-600` | Timeout becomes `remote_unknown`, then reconcile |
| P1 | Multi-platform publish | Meta errors become null; IDs/results are discarded | `src/social/meta.js:138-207`; `src/pipeline/run.js:437-456` | Persist per-platform state and retry only failed target |
| P1 | Firestore/local authority | Exactly one backend is selected; init failure falls to local | `src/lib/firestore.js:22-46`; `src/lib/firestore.js:75-172` | State-authority loss fails closed; reconcile explicitly |
| P1 | Video/topic state | Append record then separately mark topic | `src/pipeline/recordProduction.js:78-80`; `src/lib/firestore.js:137-151` | Atomic deterministic upsert/reservation |
| P1 | Duplicate content | Retry exhaustion returns `duplicate: true`; pipeline has no gate | `src/script/generateScript.js:419-493`; `src/pipeline/run.js:82-117` | Duplicate flag blocks unattended creates |
| P1 | Local files | Parse errors become empty fallback; writes replace in place | `src/lib/firestore.js:60-71` | Atomic revisioned writes; corruption fails closed |
| P1 | Job deadline | 30 minutes includes upload and post-upload persistence | `.github/workflows/daily-short.yml:44-75`; `.github/workflows/daily-short.yml:137-165` | Deadline-aware side effects and timeout recovery |
| P1 | Git fallback | Rebase failure is ignored; push is post-upload durability | `.github/workflows/daily-short.yml:152-165` | Dedup cannot depend on ephemeral post-upload push |
| P2 | Operational status | Best-effort failures are not durably summarized | `src/pipeline/run.js:426-456`; `src/pipeline/run.js:523-591` | Persist degraded components and errors |
| P2 | Artifacts | Final media/reports retained, no recovery ledger/session IDs | `.github/workflows/daily-short.yml:137-150` | Upload ledger artifact plus authoritative durable copy |
| P2 | Tests | No pipeline/publisher/state-machine fault tests found | `package.json:9-20`; `test/qcHistory.test.js:64-102` | Deterministic API fakes and crash-point suite |

## Top five creative or technical blockers

1. **P0 — Upload-before-state transaction gap:** remote success can exist with no local or Firestore knowledge.
2. **P0 — No idempotency/reconciliation for ambiguous outcomes:** retry can issue a second remote create.
3. **P1 — Partial platform results are discarded:** Instagram/Facebook status and IDs cannot be resumed or audited.
4. **P1 — Non-atomic, split-brain-prone state:** Firestore/local are exclusive and video/topic writes are separate appends.
5. **P1 — Duplicate content can proceed by design:** retry exhaustion returns a flagged duplicate without an upload gate.

## Quick wins

- Add a pre-upload fail-closed check for `script.duplicate` and a verified content fingerprint; acceptance: used-topic exhaustion makes zero publisher calls.
- Include `social.instagram`, `social.facebook`, their errors, and configured/skipped status in the production report and record; acceptance: a partial run is visibly partial.
- Stop swallowing the top-level `crossPost` exception without recording it; keep YouTube independent, but persist the degraded outcome.
- Validate Firestore availability and authority before rendering/upload when unattended publishing is enabled; do not silently fall back to stale local state.
- Make local JSON writes temp-file + atomic-rename with schema/revision validation; acceptance: injected interruption preserves the last valid revision.
- Emit a final machine-readable operational summary even for best-effort failures, including production ID, fingerprint, platform statuses, and report/artifact write status.

## Structural improvements

1. **Durable production ledger before side effects.** Derive a stable production ID from scheduled content slot plus content/media fingerprint, create it transactionally as `rendered/eligible`, and reserve the normalized topic before upload.
2. **Per-platform state machines.** Store independent YouTube/Instagram/Facebook states, attempts, remote IDs, session/container IDs, errors, and timestamps. Overall status must be `published_all`, `published_partial`, `remote_unknown`, or `failed`, not inferred from YouTube alone.
3. **Outbox/reconciliation worker.** Publishing consumes durable pending intents. On startup/rerun, reconcile `uploading` or `remote_unknown` records with platform APIs before any create; retry only idempotently safe transitions.
4. **Transactional state authority.** Use deterministic Firestore document IDs and transactions for production/topic reservation. Treat Firestore outage as a publishing blocker. If local mode remains, describe it as a separate development authority, not an automatic production replica.
5. **Deadline-aware orchestration.** Track remaining Actions budget, apply explicit API deadlines, checkpoint after every remote response, and decline new publishes near the job deadline.
6. **Recovery-grade artifacts and reports.** Persist the ledger snapshot and final file checksum with artifacts, while keeping Firestore authoritative. Report state-write and notification failures rather than hiding them.
7. **Fault-injection test harness.** Fake every remote boundary and terminate after each transition; verify at-most-once remote creates and eventual convergence across reruns.

## Experiments to run

1. YouTube accepts upload, then process exits before `youtube = ...`; rerun the same production intent and verify one remote video.
2. YouTube succeeds, Instagram succeeds, Facebook fails; retry and verify only Facebook is called.
3. Manually rerun the same Actions run inputs/slot with identical fingerprint; verify the existing ledger is resumed and no successful platform is recreated.
4. Exit after YouTube response, after Instagram `media_publish`, and after Facebook `finish`, each before state persistence; reconcile remote IDs on restart.
5. Seed contradictory Firestore/local records and make Firestore initialization or an operation fail; verify unattended upload fails closed with a state-authority alarm.
6. Inject YouTube timeout before and after server acceptance; inject Meta binary/publish timeouts; verify `remote_unknown` and reconciliation, never blind retry.
7. Force the same normalized topic/content and a `duplicate: true` result; verify zero external publisher calls without explicit override.
8. Fail between `logVideo` and `markTopicUsed`, during atomic local write, and during Git push; verify one production record and retained dedup reservation.
9. Fail report, artifact preparation, QC history, and notification separately; verify the production ledger records each degradation and exit policy remains intentional.
10. Run two workers against the same production ID despite workflow serialization; transactionally prove only one acquires publishing ownership.

## Metrics that would validate improvement

- Duplicate remote posts per 1,000 production intents: target zero in fault tests and operations.
- Productions in `remote_unknown`, their age, and reconciliation success/failure latency.
- Per-platform success, partial-success, retry, terminal-failure, and duplicate-prevented counts.
- Percentage of remote posts with a durable production intent created before upload and remote ID checkpointed immediately after response.
- State divergence/corruption count, Firestore authority failures, local fallback attempts, and transaction conflicts.
- Rerun behavior: publisher create calls per already-successful platform must be zero.
- Orphan remote posts, orphan production records, and video records lacking topic reservations.
- Time remaining at each upload start, API timeout frequency, job timeout frequency, and last durable transition before termination.
- Report/artifact/notification/QC-history write success recorded per production.
- Fault-injection transition coverage and state-machine invariant coverage, not only line coverage.

## Risks and regressions

- A fail-closed state authority will reduce output during Firestore outages; this is preferable to silent duplicate publishing but requires clear alerts and replay tooling.
- Content fingerprints must include the rendered file or canonical inputs/config; weak fingerprints can conflate distinct edits, while overly broad fingerprints defeat deduplication.
- Platform search cannot always prove identity; ambiguous results must remain quarantined for operator review rather than guessed.
- Firestore transactions and leases need expiry/fencing tokens so a dead worker cannot block forever or a stale worker cannot publish after lease loss.
- Automatic retry must classify rate limits and transport failures separately from policy/auth/media terminal failures.
- Persisting tokens or raw upload-session URLs in artifacts may leak credentials; recovery metadata must be secret-safe and access-controlled.
- Per-platform retry can create inconsistent captions/comments if auxiliary operations lack their own idempotency; model them as separate sub-transitions.
- Atomic local rename semantics and fsync behavior vary by filesystem; test on the Actions/Linux environment and preserve backups.
- Reconciliation changes operational semantics; deploy initially in observe-only mode and compare decisions before enabling automatic recovery.

## Final P0/P1/P2/P3 list

### P0

- Close the remote-upload-before-durable-state window with a pre-upload intent and stable idempotency identity (`src/pipeline/run.js:406-424`, `src/pipeline/run.js:531-560`).
- Quarantine and reconcile ambiguous YouTube/Meta outcomes instead of blindly recreating (`src/youtube/uploadVideo.js:44-66`, `src/social/meta.js:138-207`).

### P1

- Persist per-platform partial success, remote IDs, errors, and retry state (`src/pipeline/run.js:437-456`, `src/pipeline/run.js:551-558`).
- Make production record/topic reservation deterministic and transactional (`src/pipeline/recordProduction.js:78-80`, `src/lib/firestore.js:137-151`).
- Fail closed when production state authority is unavailable; add explicit Firestore/local reconciliation (`src/lib/firestore.js:22-46`).
- Block unattended upload for `duplicate: true` content and reserve topics before publishing (`src/script/generateScript.js:442-493`).
- Make local state writes atomic, revisioned, and corruption-visible (`src/lib/firestore.js:60-71`).
- Add deadline-aware upload/checkpoint behavior within the 30-minute Actions job (`.github/workflows/daily-short.yml:44-75`).
- Remove Git push as a required post-upload dedup guarantee (`.github/workflows/daily-short.yml:152-165`).

### P2

- Persist all best-effort/degraded outcomes in the production ledger and reports (`src/pipeline/run.js:426-456`, `src/pipeline/run.js:523-591`).
- Add a recovery ledger/checksum to retained artifacts (`.github/workflows/daily-short.yml:137-150`).
- Replace QC-history’s narrow internal-ID dedup role with ledger-linked observational records while preserving append history (`src/pipeline/qcHistory.js:68-99`).
- Add pipeline, publisher, state-backend, rerun, timeout, and crash-point fault-injection tests.

### P3

- Document platform error classification, retry budgets, operator recovery procedures, and the exact meaning of every overall status.
- Add dashboards/alerts for partial, unknown, orphaned, and state-degraded productions.

## “No files were modified” confirmation

No application code, production configuration, workflow, dependency, state file, source asset, or existing report was modified. The only file created is this audit report: `reports/2026-07-21/15-software-reliability-engineer.md`. No upload, commit, or push was performed.
