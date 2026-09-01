# Daily shorts — how it runs

Two 40-second vertical shorts a day, produced and published by GitHub Actions.
Nothing here needs a person in the loop; this file describes what the workflow
does, and how to intervene when it goes wrong.

## Why Actions and not the Claude Code environment

The repository's secrets — Gemini, Pexels, Pixabay, Freesound, YouTube, Meta —
exist only inside an Actions run; GitHub never returns their values through the
API, so they cannot reach a Claude Code container. That container's egress
policy also rejects every stock-media host and Meta's Graph API outright.

A GitHub-hosted runner has neither restriction, and this repository is public,
so Actions minutes are free and a release asset gets the public HTTPS URL that
Instagram's publishing API needs in order to fetch a video.

## The chain

`.github/workflows/daily-short.yml`, one job:

1. **Topic** — the next unused row from `topics.yaml`, skipping anything already
   in `state.json`.
2. **Script** — Gemini drafts ten beats and a scene plan; `write_spec.py`
   validates beat count, word budget, headline width, scene variety and motif
   names, and sends the problems back for a redraft. Four attempts, then it
   fails the run rather than shipping a spec that renders badly.
3. **Narration** — Gemini TTS (voice `Charon`). Durations are measured, never
   assumed, and the leftover time is spread across the gaps to land exactly on
   40 seconds.
4. **Score** — synthesized per video, chord changes on the narration's beats.
5. **Footage** — Pexels first, Pixabay second, vertical strongly preferred; each
   clip is cropped to 1080x1920 and trimmed before it reaches the renderer. A
   beat with no honest match falls back to graphics.
6. **Composition** — the HyperFrames template, then `lint` and `inspect`. Both
   must be clean or the build refuses to produce a file.
7. **Render, mix, encode** — H.264/AAC, music ducked under the voice, −14 LUFS.
8. **Publish** — see below.
9. **Commit** — spec, `state.json` and the deliverable go back to the branch.

## Running it by hand

Actions → **Daily short** → *Run workflow*:

| Input | Default | Notes |
| --- | --- | --- |
| `upload` | `none` | `none` builds and bundles only. `youtube`, or `all` for YouTube + Instagram + Facebook. |
| `privacy` | `unlisted` | YouTube only. |
| `topic` | blank | A topic id to force; blank takes the next in the queue. |

Scheduled runs use `upload: all` and `privacy: unlisted`.

Every run uploads a `review-<slug>` artifact holding the contact sheet, the MP4
and the spec — look at the contact sheet before promoting anything to public.

## When something fails

- **`write_spec.py` exhausts its attempts** — the model could not satisfy the
  rules. The log lists exactly which. Usually the topic's `mechanism` line is
  too vague to write ten honest beats from; sharpen it in `topics.yaml`.
- **A gate fails** — a real layout defect. The `inspect` output names the
  element and timestamp.
- **No footage for a beat** — logged, not fatal; that scene renders as graphics.
- **A platform fails** — the others still publish. `published.json` in the
  deliverable folder records what landed where.

Keep uploads unlisted until a few days of output have been watched. These
scripts are written and shipped without human review.

## Editing the look

Everything visual lives in `daily/lib/compose.py`: palette, type scale, the
vertical safe zones, seven scene archetypes, five motifs. Two rules there were
learned the expensive way and should not be relaxed:

- Headlines are `nowrap` in a condensed face; over ~16 characters they run off
  frame and no gate catches it.
- `card`, `compare` and `metric` draw their own panel, and a scene running stock
  footage has the footage as its art — the builder drops motifs in both cases
  because layering graphics there reads as clutter.
