# NeoSaniye AI Orchestra

NeoSaniye AI Orchestra is a read-only, repository-grounded audit framework for
the Remotion Shorts factory. Each specialist examines one non-overlapping concern,
separates verified facts from assumptions, and cites `path:line` evidence. The
orchestra produces recommendations, not code changes.

## Run one agent manually with Codex

1. Start Codex at the repository root.
2. Ask it to follow one prompt, for example:
   `Read agents/07-motion-design-director.md, audit the repository, and save the report to reports/YYYY-MM-DD/07-motion-design-director.md.`
3. Replace `YYYY-MM-DD` with the audit date and review the report before authorizing implementation.

## Recommended order

1. Product direction: 01 Executive Producer, 02 Topic Strategy Director.
2. Viewer experience: 03 Hook, 04 Story and Retention, 05 Visual, 06 Film Editor.
3. Presentation craft: 07 Remotion Motion, 08 Caption and Typography, 09 Sound, 10 TTS and Voice.
4. Measurement and gates: 11 YouTube Analytics, 12 Editorial QC, 13 Fact-check and Licensing.
5. Production system: 14 Remotion Performance, 15 Software Reliability.
6. Synthesis: 00 Orchestrator.

After all specialist reports exist, run `agents/00-orchestrator.md` to create
`reports/YYYY-MM-DD/00-master-roadmap.md`.

## Evidence and report storage

Reports belong under `reports/YYYY-MM-DD/` and should use the matching agent
filename. Copy `agents/report-template.md` as the starting form. Runtime behavior
is verified only when supported by code, tests, `production.json`, final MP4,
workflow logs or artifacts. Anything else must be labeled assumption, inference,
unknown or proposed experiment.

## Deduplication and contradiction control

Each finding gets a stable title, owner, severity, evidence, impact and acceptance
signal. Specialists cross-reference adjacent findings instead of repeating them.
The orchestrator merges findings only when root cause and remedy match and
preserves dissent where evidence differs.

## From audit to implementation

The master roadmap is a decision document, not permission to edit or publish.
Implementation work must be separately authorized, small, tested and committed.
No audit task may change production configuration, upload settings or credentials.
