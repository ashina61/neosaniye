# YouTube Analytics Director Audit — 2026-07-21

## Audit basis and metric taxonomy

This is a read-only audit of repository analytics collection, storage, feedback use, QC proxies, experiment design, and causal limits. No external YouTube account was queried, as the agent instructions prohibit that. Accordingly:

- **Platform-sourced record** means the repository code fetches the field from a YouTube API and retained state contains values with collection timestamps. It does not mean this audit independently verified the account response.
- **Derived metric** means a repository calculation from recorded platform fields.
- **Placeholder** means a declared field that is intentionally `null` and has no working collector.
- **Internal score** means a pre-publish deterministic QC measure, not viewer behavior.
- **Missing** means no ingestion/storage/use path was found.
- **Inference** means an interpretation that the available fields may support but do not directly measure.

## End-to-end analytics trace

1. At the beginning of a pipeline run, `updateVideoStats()` refreshes up to 25 YouTube-linked records when credentials exist (`src/pipeline/run.js:60-70`).
2. The YouTube Data API supplies current cumulative `viewCount`, `likeCount`, and `commentCount`; the YouTube Analytics API requests lifetime-to-date `averageViewPercentage` and `subscribersGained` from 2025-01-01 through the current date (`src/youtube/engage.js:60-80`, `src/youtube/engage.js:89-116`).
3. Those values are stored under each video's `stats` object with `statsAt` (`src/youtube/engage.js:104-116`; `src/lib/firestore.js:238-250`). Retained records contain values such as 873 views, 19 likes, one comment, 56.1% average view percentage, and three subscribers gained (`data/videos.json:3899-3906`).
4. The analyst groups videos by format, visual style, and category; calculates average cumulative views, mean average-view-percentage, and total subscribers gained; and produces a strategy brief when at least six videos have views (`src/crew/analyst.js:19-53`, `src/crew/analyst.js:122-157`).
5. Topic and hook retrieval independently ranks the top records by raw cumulative views (`src/lib/firestore.js:175-205`). The script prompt receives the strategy brief, top-performing topics, and winning hooks (`src/script/generateScript.js:322-357`, `src/script/generateScript.js:392-424`).
6. Separately, the 14-day publishing experiment declares hourly and 24-hour metrics, average percentage viewed, and viewed-vs-swiped-away, but `collectSlotMetrics()` always returns nulls (`src/analytics/experimentMetrics.js:1-36`). The render report also writes a fresh empty schema rather than collected results (`src/pipeline/run.js:498-505`).
7. The repository's `retentionScore` is calculated before publishing from script, timing, visual, caption, audio, and structural heuristics (`src/pipeline/retentionQC.js:280-319`, `src/pipeline/retentionQC.js:511-534`). It is stored alongside production metadata and QC history (`src/pipeline/recordProduction.js:31-43`; `src/pipeline/qcHistory.js:25-61`). It is not YouTube retention.

## Executive verdict

The system does learn from some genuine platform-sourced outcomes, so it is not purely proxy-driven. Public cumulative views, likes, and comments are refreshed; average view percentage and subscribers gained are requested through YouTube Analytics; retained records demonstrate that the latter two have populated for some videos. These results influence the next video's format/style/category strategy and raw-view-ranked topic/hook examples.

However, the loop is dominated by weakly normalized cumulative outcomes and internal pre-publish heuristics. Video age and exposure window are not controlled; subscriber totals are not normalized in the analyst; top topics and hooks are ranked by raw views; the most recent 25-record refresh can leave older candidates stale; and no causal attribution separates topic, hook, format, visual style, publishing slot, distribution volume, or audience mix. The analyst prompt says retention and subscribers should outweigh views, but its digest is sorted by average raw views and its mechanical fallback selects the view leader (`src/crew/analyst.js:21-27`, `src/crew/analyst.js:41-53`, `src/crew/analyst.js:87-93`).

The core Shorts diagnostics requested for this audit are absent: viewed versus swiped away is a null placeholder; first-second and first-three-second retention, completion, retention curves, shares, saves, and returning viewers are not collected; rewatch exists only as a possible interpretation of average percentage viewed above 100%, not a separately measured field. The 14-day slot experiment is labeled but cannot produce its planned outcome report from real records because its collector is unimplemented and unused.

Verdict: **P1 measurement and decision-quality gap.** The repository has a genuine but partial feedback loop; it cannot yet diagnose why Shorts succeed or validate most creative QC assumptions. No P0 issue is verified.

## Verified findings

### YA-01 — P1 — The system ingests real platform outcomes, but only a narrow subset

**Platform-sourced records.** `videos.list(part=statistics)` supplies views, likes, and comments (`src/youtube/engage.js:96-114`). `youtubeAnalytics.reports.query` requests `averageViewPercentage` and `subscribersGained` by video (`src/youtube/engage.js:60-80`). Stored examples include average view percentages of 39.2%, 90.5%, and 167%, with subscriber values (`data/videos.json:777-783`; `data/videos.json:901-906`; `data/videos.json:1818-1823`). Each snapshot has `statsAt`.

**Data-quality limit.** These are cumulative snapshots, not fixed post-publish windows. The Analytics query starts at a fixed 2025-01-01 date and ends “today,” while public counters are current totals (`src/youtube/engage.js:67-74`, `src/youtube/engage.js:99-114`). A two-day-old video and a ten-day-old video are therefore compared at unequal opportunity windows.

**Missing from this collector.** Viewed-vs-swiped-away, first/three-second retention, completion, shares, saves, returning viewers, audience source, impressions/shown-in-feed, and retention-curve points are not requested.

### YA-02 — P1 — Viewed versus swiped away is a placeholder, not an ingested metric

**Placeholder.** `viewedVsSwipedAwayRatio` exists in `emptySlotMetrics()` but is initialized to `null`; `source` and `collectedAt` are also null (`src/analytics/experimentMetrics.js:11-25`). `collectSlotMetrics()` unconditionally returns that empty object (`src/analytics/experimentMetrics.js:28-36`). Tests explicitly enforce null values because Analytics is considered unconnected in that adapter (`test/scheduleExperiment.test.js:105-113`).

**No decision use with real data.** The slot report can calculate a median if callers inject values, but no production collector provides them (`src/analytics/experimentMetrics.js:53-85`). No retained viewed-vs-swiped value was found. Therefore the system cannot distinguish a weak feed stop from weak post-start retention.

### YA-03 — P1 — First-second, first-three-second, completion, and retention curves are missing

**Missing platform fields.** The only platform watch-depth field requested is whole-video `averageViewPercentage` (`src/youtube/engage.js:67-80`). No elapsed-video retention dimensions, first-second/three-second checkpoints, completion count/rate, or audience-retention curve is queried or stored.

**Internal score confusion risk.** `firstSpeechMs`, visual event interval, twist count, loop closure, and other pre-publish properties are grouped under `retentionScore` (`src/pipeline/retentionQC.js:280-319`). Documentation illustrates that score and its internal metrics (`docs/retention-qc.md:152-180`). These are useful hypotheses about a render, but they contain no viewer sessions and cannot answer how many viewers remained at one second, three seconds, or completion.

### YA-04 — P1 — Average percentage viewed is genuine where populated, but windowing and aggregation weaken it

**Platform-sourced record.** `avgViewPct` comes from the Analytics API's `averageViewPercentage` response (`src/youtube/engage.js:67-80`). Populated repository values include 167% and 142.1%, which are possible for replayed Shorts and therefore should not be clamped (`data/videos.json:1818-1823`; `data/videos.json:2314-2319`).

**Inference limit.** Values above 100% are compatible with rewatching but do not expose unique viewers' replay rate, replay count distribution, or where loops occurred. The repository has no separate rewatch field.

**Aggregation issue.** The analyst computes an unweighted mean of per-video percentages and rounds it (`src/crew/analyst.js:29-50`). A low-view video and a high-view video receive equal weight within a group; neither publication age nor sample volume is shown. This may be acceptable for a “typical video” estimate, but it is not labeled as such and has no confidence interval.

### YA-05 — P1 — Completion and rewatch are not directly measured

**Completion: missing.** No completion rate/count field or final retention-curve point is collected. Average percentage viewed cannot substitute: two audience distributions can have the same APV with very different completion.

**Rewatch: inferred only.** The retained 167% and 142.1% APV values suggest repeat consumption at aggregate level (`data/videos.json:1818-1823`; `data/videos.json:2314-2319`), but the code neither derives nor stores a rewatch metric. The system therefore cannot compare deliberate loop performance separately from general watch duration.

### YA-06 — P1 — Shares, saves, and returning viewers are missing; subscriber conversion is only partially usable

**Missing.** No YouTube analytics collector, state schema, or decision path was found for shares, saves, or returning viewers. The occurrence of “save” in motion CTA templates is a creative CTA type, not a platform save measurement (`src/motion/ctaSelector.js:10-17`; `src/motion/ctaTemplates.js:70-73`).

**Platform-sourced but incomplete.** `subscribersGained` is fetched as a cumulative video metric and stored as `subsGained` where available (`src/youtube/engage.js:67-80`, `src/youtube/engage.js:107-114`). The slot-report helper can derive subscribers per 1,000 24-hour views if fixed-window inputs exist (`src/analytics/experimentMetrics.js:64-81`), but production does not populate those inputs.

**Decision flaw.** The analyst sums subscribers by group instead of normalizing by views or number of videos (`src/crew/analyst.js:41-50`). Larger groups and higher-exposure videos can appear better even with lower conversion.

### YA-07 — P1 — Topic and hook feedback uses raw cumulative views, producing age and distribution bias

**Verified use.** `getTopPerformingTopics()` and `getWinningHooks()` rank up to 50 records by `stats.views` and pass the winners to script generation (`src/lib/firestore.js:175-205`; `src/script/generateScript.js:337-357`, `src/script/generateScript.js:392-424`). This is a genuine platform-outcome feedback loop.

**Confounding.** The ranking has no fixed age window, shown-in-feed denominator, viewed-vs-swiped control, format/category stratification, publishing-slot adjustment, or uncertainty. A record with more time in distribution can beat a newer, more efficient Short. A successful topic and its hook are inseparable because each video supplies one bundled observation. The prompt nevertheless calls the hooks “PROVEN” and says they “earned” the most views (`src/script/generateScript.js:351-356`), which overstates attribution.

**Freshness issue.** `updateVideoStats()` refreshes at most 25 recent YouTube records (`src/youtube/engage.js:89-98`), while the top-performer functions examine up to 50 (`src/lib/firestore.js:175-197`). Older contenders may be ranked with stale snapshots against freshly updated newer videos.

### YA-08 — P1 — The strategy analyst says it prioritizes retention/subscribers, but ordering and fallback prioritize views

**Verified mismatch.** The analyst instruction says retention and subscribers should weigh above raw views (`src/crew/analyst.js:21-27`). Yet grouped rows are sorted only by `avgViews` (`src/crew/analyst.js:41-53`), and the mechanical fallback calls the first view-ranked format/category/style the best (`src/crew/analyst.js:87-93`). Average view percentage and subscriber totals appear only as annotations in the LLM digest (`src/crew/analyst.js:66-84`).

**Impact.** If Gemini is absent or fails, the decision is explicitly view-led. If Gemini runs, there is no deterministic rule defining how APV and subscribers outweigh views, no minimum sample per group, and no uncertainty. Categories with one video can compete with categories having many observations.

### YA-09 — P1 — The 14-day slot experiment is instrumented for assignment, not outcomes

**Verified assignment.** The experiment fixes three UTC slots for 14 days and records slot metadata without automatic optimization (`src/pipeline/scheduleExperiment.js:1-22`; `docs/publishing-experiment.md:7-30`). QC history contains four labeled records across slots, with scheduled and actual timestamps (`data/qc-history.jsonl:1-4`).

**Placeholder outcomes.** Every render report writes `emptySlotMetrics()` (`src/pipeline/run.js:498-505`). `collectSlotMetrics()` is not invoked anywhere in production and returns null even if invoked (`src/analytics/experimentMetrics.js:28-36`). The documentation accurately states that metrics remain null until connected (`docs/publishing-experiment.md:27-30`).

**Design limit.** The planned minimum is seven videos per slot (`src/analytics/experimentMetrics.js:45-53`; `docs/publishing-experiment.md:42-46`). Fourteen days at one daily observation per slot would yield at most 14 per slot before failures, still too small to balance heterogeneous topics/formats reliably. Actual publish delays also vary; one QC record has no actual publish time (`data/qc-history.jsonl:1-4`). Slot labels alone do not establish treatment exposure.

### YA-10 — P1 — QC-normalized views treat an unvalidated proxy as a confounder adjustment

**Internal score.** QC history stores hook, pacing, curiosity, caption, visual-variety, audio-design, and payoff heuristic scores (`src/pipeline/qcHistory.js:25-61`). Four retained production entries contain scores of 81–85 and internal readiness judgments, not audience retention (`data/qc-history.jsonl:1-4`).

**Derived metric with unsupported causal meaning.** The slot report divides 24-hour views by `retentionScore / 100` and describes this as balancing quality differences (`src/analytics/experimentMetrics.js:70-82`). No repository evidence validates that the internal score is linearly proportional to expected views or that division removes creative-quality confounding. Because QC features may themselves affect the slot outcome, adjusting this way can distort rather than isolate slot effects.

### YA-11 — P2 — Analytics provenance and observation windows are not sufficiently retained

**Verified gap.** Stored `stats` includes counters, optional APV/subscribers, and one `statsAt` timestamp (`src/youtube/engage.js:104-115`). It does not retain API source per field, query start/end dates, video age at observation, publish-to-collection hours, previous snapshots, missing-field reason, or sample eligibility. A failed Analytics query returns `{}`, after which public counters are still stored with no explicit field-level failure status (`src/youtube/engage.js:60-86`, `src/youtube/engage.js:107-115`).

**Impact.** Missing APV can mean absent OAuth scope, API failure, unavailable data, or no result row. Downstream code treats all as absence. Overwriting `stats` discards earlier snapshots, preventing reconstruction of 1h/6h/24h growth.

## Named metric inventory

| Metric | Classification | Origin / repository state | Decision use |
|---|---|---|---|
| Views | Platform-sourced record | Current cumulative Data API count; retained with `statsAt` (`src/youtube/engage.js:99-115`) | Primary ranking for topics/hooks and analyst group ordering. |
| Likes | Platform-sourced record | Current cumulative Data API count (`src/youtube/engage.js:107-114`) | Stored; not used by topic/analyst loop. Planned slot engagement only. |
| Comments | Platform-sourced record | Current cumulative Data API count (`src/youtube/engage.js:107-114`) | Stored; not used by topic/analyst loop. Planned slot engagement only. |
| Average percentage viewed | Platform-sourced where populated | Lifetime-to-date Analytics response stored as `avgViewPct` (`src/youtube/engage.js:67-80`) | Included in analyst text, not deterministic ranking; null slot placeholder separately. |
| Viewed vs swiped away | Placeholder | Null `viewedVsSwipedAwayRatio`; no collector (`src/analytics/experimentMetrics.js:11-36`) | Synthetic-input slot reporter only. |
| First-second retention | Missing | Internal `firstSpeechMs` is not viewer retention (`src/pipeline/retentionQC.js:280-303`) | None. |
| First-three-second retention | Missing | No collection/storage field | None. |
| Completion | Missing | APV is not completion | None. |
| Rewatch | Inference only | APV above 100% is compatible with replay, but no separate measure | None. |
| Shares | Missing | No collection/storage field | None. |
| Saves | Missing | “save” CTA is not a measured save outcome (`src/motion/ctaTemplates.js:70-73`) | None. |
| Subscribers gained | Platform-sourced where populated | Lifetime-to-date Analytics response (`src/youtube/engage.js:67-80`) | Summed by analyst group; planned per-1,000 slot derivation lacks production inputs. |
| Subscriber conversion | Derived only in dormant reporter | `subscribersGained / views24h * 1000` (`src/analytics/experimentMetrics.js:64-81`) | No real production report. |
| Returning viewers | Missing | No collection/storage field | None. |
| 1h/6h/24h views | Placeholder | Null schema; snapshots overwritten rather than accumulated (`src/analytics/experimentMetrics.js:11-25`) | No real use. |
| `retentionScore` | Internal score | Pre-publish deterministic editorial QC (`src/pipeline/retentionQC.js:511-534`) | Upload policy, history, and invalid QC-normalized slot metric; not platform retention. |

## Evidence table

| ID | Severity | Classification | Evidence | Conclusion |
|---|---|---|---|---|
| YA-01 | P1 | Platform + data-quality gap | `src/youtube/engage.js:60-80`, `src/youtube/engage.js:96-116` | Five platform fields are fetched, but snapshots are cumulative and unequal-age. |
| YA-02 | P1 | Placeholder | `src/analytics/experimentMetrics.js:11-36` | Viewed-vs-swiped is declared but always null. |
| YA-03 | P1 | Missing / internal proxy | `src/pipeline/retentionQC.js:280-319` | Early retention and curves are absent; QC metrics are not viewer behavior. |
| YA-04 | P1 | Platform + weak aggregation | `src/crew/analyst.js:29-53`; `data/videos.json:1818-1823` | APV is real where present, but unweighted and unwindowed. |
| YA-05 | P1 | Missing / inference | `data/videos.json:2314-2319` | Completion absent; rewatch only suggested by APV above 100%. |
| YA-06 | P1 | Missing / partial platform | `src/youtube/engage.js:67-80`; `src/crew/analyst.js:41-50` | Shares/saves/returning absent; subscribers are summed, not converted. |
| YA-07 | P1 | Platform used with confounding | `src/lib/firestore.js:175-205`; `src/script/generateScript.js:337-357` | Raw cumulative views directly steer topic/hook prompts. |
| YA-08 | P1 | Decision-policy mismatch | `src/crew/analyst.js:21-27`, `src/crew/analyst.js:41-53`, `src/crew/analyst.js:87-93` | Claimed retention priority is not encoded in sorting/fallback. |
| YA-09 | P1 | Assignment only / placeholder outcome | `src/pipeline/run.js:498-505`; `docs/publishing-experiment.md:27-46` | Slot labels exist, outcome collection does not. |
| YA-10 | P1 | Internal score / invalid adjustment | `src/analytics/experimentMetrics.js:70-82`; `data/qc-history.jsonl:1-4` | QC-normalized views assumes unsupported linear causal adjustment. |
| YA-11 | P2 | Provenance gap | `src/youtube/engage.js:83-115` | Missingness, source window, video age, and prior snapshots are not retained. |

## Top five creative or technical blockers

1. **No feed-entry or early-retention measurements (YA-02/YA-03).** The system cannot tell whether viewers fail to stop, leave in the first seconds, or exit later.
2. **No fixed observation windows (YA-01/YA-11).** Raw cumulative views and lifetime APV/subscribers make video comparisons age-biased and prevent fair topic/hook learning.
3. **Outcome attribution is bundled and confounded (YA-07/YA-08).** Topic, hook, format, style, slot, channel growth, and distribution are treated as though raw views identify a winner.
4. **The publishing experiment has no real outcome collector (YA-09).** Slot assignment is recorded, but all planned metrics remain null.
5. **Internal QC is treated too much like retention truth (YA-03/YA-10).** A deterministic editorial score is named retention and used as an unsupported normalization factor.

## Quick wins

These are audit recommendations only; no code was changed.

- Rename every surfaced internal `retentionScore` label in analysis/reporting context to “editorial retention proxy” while retaining schema compatibility. Never display it beside platform retention without the source label.
- Preserve each existing stats fetch as an append-only observation with `videoId`, `publishedAt`, `collectedAt`, age-hours, query start/end, field source, and missingness reason. Existing `statsAt` proves when only the latest overwrite occurred (`src/youtube/engage.js:104-115`).
- Stop calling view-ranked hooks “PROVEN”; label them “high cumulative-view examples, causality unestablished” in the prompt (`src/script/generateScript.js:351-356`).
- Remove QC-normalized views from experiment decisions until the proxy is empirically calibrated against held-out platform outcomes (`src/analytics/experimentMetrics.js:70-82`).
- Produce a coverage table on every analyst run: eligible videos, age range, refreshed/stale count, APV coverage, subscriber coverage, and which requested metrics are unavailable.
- Require minimum group count and report group sample sizes before an analyst directive can call a format/style/category best. Counts already exist in the digest (`src/crew/analyst.js:43-50`).

## Structural improvements

1. **Build a versioned observation model.** Store immutable metric snapshots at standard age windows (for example 1h, 6h, 24h, 72h, and 7d), plus late/backfill status. Do not overwrite the only historical state.
2. **Separate metric families.** Use explicit namespaces such as `platform`, `derived`, `editorialProxy`, and `experiment`. Attach source, unit, denominator, observation window, and availability status to every field.
3. **Collect the Shorts funnel.** Where authorized and available, ingest shown-in-feed/viewed-vs-swiped, early retention/retention curve, average view duration, APV, completion proxy with a documented definition, subscribers gained/lost, shares, and returning-viewer measures. If a requested field is unavailable through the chosen API, record it as unavailable rather than inventing it.
4. **Use fair outcome windows for topic/hook feedback.** Rank or model videos using matched-age outcomes, exposure denominators, and shrinkage/minimum samples. Keep APV and subscriber conversion separate from reach; do not collapse all objectives into raw views.
5. **Preserve creative treatment metadata.** Version the exact topic, hook, first spoken line, first visual type, format, style, duration, CTA, voice, music, slot, and QC proxy features so later analysis can control obvious confounders.
6. **Define decision rules before experiments.** Specify primary outcome, secondary outcomes, window, exclusions, minimum sample, practical effect threshold, and stopping rule. The existing median/minimum-sample policy is a useful start (`src/analytics/experimentMetrics.js:45-93`) but requires real collection and matched treatments.
7. **Validate proxies prospectively.** Test whether each QC component predicts held-out platform outcomes after controlling for topic, age, and exposure. Retire or recalibrate components that do not generalize; never divide outcomes by a proxy without a justified model.
8. **Make feedback recommendations auditable.** Record the exact snapshot set and deterministic digest used for each `strategyBrief`, then associate the brief with the resulting video's treatment and outcome.

## Experiments to run

| Experiment | Primary outcome and window | Sample / baseline | Confounder controls | Decision rule |
|---|---|---|---|---|
| Analytics collection shadow run | Field coverage and snapshot timeliness at 1h/6h/24h | At least 10 newly published Shorts; current overwrite-only collector as baseline | Same credentials/channel; log API availability and late data | Proceed only when required fields have documented definitions, ≥95% eligible snapshot completion, and no synthetic values. |
| Hook treatment test | Viewed-vs-swiped and 3-second retention at matched age | Predeclare a practical minimum effect; use multiple matched topic pairs, not one video | Match topic family, format, duration, slot, visual proof, and channel period | Call a winner only after the predeclared sample/effect rule; otherwise inconclusive. |
| Story pacing test | Completion/APV plus retention-curve change at reveal/payoff | Baseline from recent matched-age videos in same format | Hold hook promise/topic family/style/slot as constant as practicable | Require improvement in the targeted curve region without worse feed entry or subscriber conversion. |
| Topic-family test | 24h views per feed exposure and 7d subscribers per 1,000 views | Minimum group count per family with age-matched observations | Stratify by format, slot, channel week, and hook class | Favor a family only if reach efficiency and subscriber conversion agree or the objective tradeoff is explicit. |
| Publishing-slot test | Predeclared 24h reach efficiency, APV, subscribers/1k | Existing three slots; extend beyond 14 days if balance/power is inadequate | Randomize or balance topic/format across slots; use actual publish time | No winner below minimum samples or practical effect; report uncertainty and actual-time deviations. |
| QC predictive validation | Held-out 24h APV/completion and 7d subscriber conversion | Historical training cohort plus later untouched validation cohort | Control age, topic, format, exposure, slot, and production version | Keep a proxy only if it predicts held-out outcomes with stable direction and useful calibration. |

The repository does not yet contain enough standardized observations to set defensible numeric lift thresholds. Thresholds must be preregistered after a baseline period, not chosen after results are seen.

## Metrics that would validate improvement

- **Collection integrity:** eligible-video count; metric coverage by field; on-time 1h/6h/24h/72h snapshot rate; API error/missing-reason distribution; stale-record count.
- **Feed entry:** viewed-versus-swiped with its exact numerator/denominator and fixed window; shown-in-feed volume so rate and reach are not conflated.
- **Early retention:** viewers remaining at one and three seconds, with cohort size and retention-curve source; not `firstSpeechMs`.
- **Depth:** average view duration, average percentage viewed, a documented completion measure or final-curve retention, and curve points around reveal/payoff.
- **Replay:** a platform-provided replay/unique-view measure if available; otherwise label APV above 100% as an aggregate replay signal, not a rewatch rate.
- **Engagement:** shares per 1,000 views, likes/comments per 1,000 views, and saves only if a genuine platform field with a defined denominator is available.
- **Channel value:** subscribers gained and lost, net subscribers per 1,000 views, and returning-viewer measures with a documented channel/video attribution window.
- **Fair comparison:** video age, feed exposure, actual publish time, topic/format/style strata, sample size, median and dispersion/confidence interval.
- **Feedback quality:** percentage of strategy claims traceable to snapshots; out-of-sample lift versus a predeclared baseline; rate of “insufficient evidence” decisions.
- **Proxy validity:** correlation and calibrated prediction error between each editorial proxy component and held-out platform outcomes, with confounder-adjusted and unadjusted results shown separately.

## Risks and regressions

- Analytics fields can be delayed, revised, suppressed at low volume, or unavailable by scope/API. Missingness must not become zero.
- More metrics increase false discovery risk. Predeclare one primary outcome per experiment and treat others as diagnostic.
- Optimizing viewed-vs-swiped alone can reward misleading hooks; guard with completion, satisfaction/engagement, and subscriber conversion.
- Optimizing APV alone can favor very short videos or loops that replay without delivering value. Compare duration and completion context.
- Subscriber attribution is not causal proof that a specific hook caused subscription; the whole Short and channel context contribute.
- Returning viewers are fundamentally channel/cohort measures and may not be cleanly attributable to one video.
- Raw share/save counts without exposure denominators favor high-reach videos; use rates and retain counts.
- Small topic strata can produce unstable leaders. Shrink estimates or report insufficiency rather than allowing one outlier to steer generation.
- Strategy feedback can create exploitation lock-in: repeatedly favoring early winners reduces exploration and makes future comparisons endogenous.
- Changing collection during the active slot experiment can mix definitions. Version schemas and analyze only comparable windows.
- Actual publish delays can contaminate nominal-slot comparisons; use actual time and predeclared deviation exclusions.
- Privacy and API policy requirements must be reviewed before retaining granular audience/cohort data; store only what is necessary.

## Final P0/P1/P2/P3 list

### P0

- None verified.

### P1

- **YA-01:** Existing platform metrics are cumulative unequal-age snapshots, not comparable fixed-window outcomes.
- **YA-02:** Viewed versus swiped away is an unpopulated placeholder.
- **YA-03:** First-second, first-three-second, completion, and retention curves are missing; internal QC is not viewer retention.
- **YA-04:** Genuine APV is aggregated without weighting, age controls, or uncertainty.
- **YA-05:** Completion and rewatch are not directly measured.
- **YA-06:** Shares, saves, and returning viewers are absent; subscriber conversion is not used correctly in the live analyst.
- **YA-07:** Topic and hook learning ranks raw cumulative views and overstates attribution.
- **YA-08:** Analyst sorting and fallback prioritize views despite stated retention/subscriber priority.
- **YA-09:** The slot experiment records assignments but has no working outcome collector.
- **YA-10:** QC-normalized views applies an unvalidated internal proxy as though it removes quality confounding.

### P2

- **YA-11:** Metric provenance, windows, missingness reasons, age at observation, and prior snapshots are not retained.
- The analyst has no deterministic exploration budget, so feedback may converge prematurely on early winners.

### P3

- Document a shared analytics glossary and dashboard labels after the observation schema is defined, including explicit “platform,” “derived,” “placeholder,” and “editorial proxy” badges.

## “No files were modified” confirmation

No application code, production configuration, prompts, tests, assets, schemas, or existing documentation were modified. The only file created by this audit is `reports/2026-07-21/11-youtube-analytics-director.md`. No external account was queried, no publishing/upload command was run, and no commit or push was made.
