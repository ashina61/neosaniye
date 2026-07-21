# Safe viewer-first test render

Use `.github/workflows/viewer-first-test-render.yml` to generate one review package without publishing. The workflow passes `--no-upload`, does not receive YouTube or Meta credentials, has read-only repository permissions, and has no schedule trigger.

1. Open the repository on GitHub and select **Actions**.
2. Select **Viewer-First Test Render (No Upload)**.
3. Select **Run workflow**.
4. Choose the branch, optionally enter an exact test topic, then choose format and visual style.
5. Run the workflow and download `viewer-first-test-render-<run_number>` from the workflow summary.

The artifact contains the MP4, `production-report.json`, `production-report.md`, `report.json`, `asset-manifest.json`, and preview frames. A rendered artifact is not publication approval: `technicalReady`, `editorialReady`, `productionReady`, rights evidence, and every blocking reason in the production report must be reviewed first.

Local equivalent (still no upload):

```bash
FORCE_TOPIC="octopus camouflage" FORCE_FORMAT=howworks VIDEO_STYLE=photo npm run produce:dry
```
