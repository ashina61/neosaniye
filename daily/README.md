# Daily shorts pipeline

Two 40-second vertical science shorts a day, produced and published by GitHub
Actions: written by Gemini against a validated spec schema, narrated with Gemini
TTS, scored from scratch, cut over real Pexels/Pixabay footage, then published to
YouTube, Instagram and Facebook.

Run it from Actions → **Daily short**. Manual runs default to `upload: none`, so
the whole chain can be exercised without posting anything.

    daily/
      RUNBOOK.md      what a scheduled run does, and how to intervene
      SETUP.md        credentials, quota, and what is not automatable
      bootstrap.sh    prepares a fresh container (idempotent)
      topics.yaml     the queue of topics
      state.json      which topics are used up
      specs/          one spec per video
      lib/            the build and publish tooling
                        write_spec  Gemini drafts, the validator decides
                        tts         Gemini TTS, piper fallback
                        stock       Pexels/Pixabay search and normalisation
                        social      Instagram + Facebook
                        release     public URL for Instagram to fetch

Build one video from a spec:

    bash daily/bootstrap.sh
    source .venv/bin/activate && source .render-env
    python daily/lib/build.py daily/specs/<slug>.yaml
    python daily/lib/contact_sheet.py out/<slug>          # review before publishing

`build.py` runs narration → score → composition → lint → inspect → render → mix
→ encode and refuses to emit a file that fails a gate or comes out the wrong
duration, size, or without audio.

Scratch lives in `out/` and is not tracked. Deliverables land in `videos/<slug>/`.
