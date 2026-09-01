# Daily shorts pipeline

Two vertical science shorts a day: written, narrated, scored, rendered,
uploaded to YouTube, and bundled for hand-posting to Instagram and Facebook.

    daily/
      RUNBOOK.md      what a scheduled run does, step by step
      SETUP.md        credentials, quota, and what is not automatable
      bootstrap.sh    prepares a fresh container (idempotent)
      topics.yaml     the queue of topics
      state.json      which topics are used up
      specs/          one spec per video
      lib/            the build and publish tooling

Build one video from a spec:

    bash daily/bootstrap.sh
    source .venv/bin/activate && source .render-env
    python daily/lib/build.py daily/specs/<slug>.yaml
    python daily/lib/contact_sheet.py out/<slug>          # review before publishing

`build.py` runs narration → score → composition → lint → inspect → render → mix
→ encode and refuses to emit a file that fails a gate or comes out the wrong
duration, size, or without audio.

Scratch lives in `out/` and is not tracked. Deliverables land in `videos/<slug>/`.
