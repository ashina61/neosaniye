# NeoSaniye Factory Rules

- NeoSaniye uses one visual direction: historical editorial cut-paper collage.
- The main visual material must be generated scene artwork; Remotion only animates, titles and mixes audio.
- Output is 1080x1920, 30 FPS, 40-45 seconds.
- New topics are data-driven. Do not duplicate a complete Remotion video per topic.
- Do not add conventional subtitles. Use only short scene headlines and labels.
- Do not enable publishing or upload logic.
- GitHub Actions workflows must be manual-only unless the user explicitly requests scheduling.
- Never run a workflow, render or paid API call without explicit user instruction.
- Missing provider keys are skipped. Quota/provider errors must fall through to the next configured provider.
