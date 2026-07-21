# NeoSaniye AI Orchestra

NeoSaniye AI Orchestra is a read-only, repository-grounded audit framework for the automated Shorts pipeline. Each specialist examines one non-overlapping concern, records verified facts separately from assumptions, and cites `path:line` evidence. The orchestra produces recommendations, not code changes.

## Run one agent manually with Codex

1. Start Codex at the repository root.
2. Ask it to follow one prompt, for example: `Read agents/03-hook-director.md, audit the repository, and save the report to reports/YYYY-MM-DD/03-hook-director.md.`
3. Replace `YYYY-MM-DD` with the audit date. Review the report before authorizing any implementation.

## Run all agents

Run specialists in the order below, saving every report in the same dated directory. Agents may run in parallel only inside a phase; later phases should read relevant earlier reports when useful. After all 15 specialist reports exist, run `agents/00-orchestrator.md` to create `reports/YYYY-MM-DD/00-master-roadmap.md`.

Recommended order:

1. Product direction: 01 Executive Producer, 02 Topic Strategy Director.
2. Viewer experience: 03 Hook, 04 Story and Retention, 05 Visual, 06 Film Editor.
3. Presentation craft: 07 Motion, 08 Caption and Typography, 09 Sound, 10 TTS and Voice.
4. Measurement and gates: 11 YouTube Analytics, 12 Editorial QC, 13 Fact-check and Licensing.
5. Production system: 14 FFmpeg Performance, 15 Software Reliability.
6. Synthesis: 00 Orchestrator.

## Evidence and report storage

Reports belong under `reports/YYYY-MM-DD/` and should use the matching agent filename. Copy `agents/report-template.md` as the starting form. A statement is **verified** only when supported by inspected repository evidence with precise `path:line` citations. Runtime behavior not demonstrated by code, tests, artifacts, logs, or metrics must be labeled an assumption, inference, unknown, or proposed experiment.

Agents audit before suggesting code because the repository already contains editorial rules, QC gates, analytics, publishing state, rendering, and tests; recommendations made without tracing those systems risk duplication, contradiction, and regressions.

## Deduplication and contradiction control

Each finding gets a stable short title, owner, severity, evidence, impact, and acceptance signal. Specialists stay within scope and cross-reference adjacent findings rather than restating them. The orchestrator merges findings only when root cause and remedy match, preserves dissent when evidence or tradeoffs differ, and never invents consensus.

## From audit to implementation

Treat the master roadmap as a decision document, not authorization to edit. Select an initiative, confirm its evidence and acceptance criteria, then issue a separate implementation task. Implementation tasks must be small, tested, and committed separately. Do not mix unrelated initiatives, production configuration changes, publishing, or uploads into an audit or implementation commit.
