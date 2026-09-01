# Daily video runbook

You are a scheduled run. Produce **one** finished vertical short, upload it to
YouTube if credentials exist, and leave a hand-post bundle for Instagram and
Facebook. Work top to bottom; do not skip a gate.

Budget roughly 25 minutes. Bootstrap ~6 min, render ~6 min, the rest is writing.

## 0. Bootstrap

```bash
bash daily/bootstrap.sh
source .venv/bin/activate && source .render-env
```

Re-runnable and mostly cached. If it fails, stop and report — do not hand-patch
around a broken environment.

## 1. Take a topic

```bash
python daily/lib/topics_queue.py status
```

Take the first remaining topic. Never reuse a topic already in `state.json`.
If fewer than 6 topics remain, say so clearly in your final report so the queue
gets refilled before it runs dry.

## 2. Write the script

Eight beats, **65–75 words total**. Piper speaks about 2.9 words per second, so
75 words is roughly 26 seconds of speech and the gaps take it to 30. If
`build.py` says the script is too long, cut words — never shorten the gaps.

Shape, learned from the two videos that worked:

1. **Hook** — the surprising fact, stated flat. No "did you know".
2. **Reframe** — overturn the assumption the hook created.
3. **Setup** — name the mechanism's two parts.
4. **Part one.**
5. **Part two.**
6. **The rule** — the one sentence that does the explaining.
7. **Consequence** — what follows from the rule.
8. **Payoff** — land it; echo the hook's language.

Write plainly. Short sentences. No hedging, no filler adjectives, no "basically".
Say the mechanism, not a metaphor for it. Every claim must be one you can
defend — this is the part no gate can check for you, so if a beat overstates
something, rewrite it before it ships.

## 3. Write the spec

Copy `daily/specs/why-your-recorded-voice-sounds-wrong.yaml` as the model.
One scene per beat, eight scenes, in beat order.

Scene types: `hook`, `statement`, `card`, `metric`, `list`, `compare`, `endcard`.
Motifs: `wave`, `rings`, `beam`, `split`, `particles`. Backdrops: `plain`,
`flowlines`, `grid`, `orbit`.

Rules that keep it readable:

- **Every scene needs a motif**, except `card` and `compare` — those draw their
  own panel in the art zone, and the builder drops a motif behind them because
  it reads as clutter. Without a motif elsewhere the top two thirds of the frame
  is dead space and the piece looks like captions on a gradient.
- **Headlines are one line each, max ~16 characters.** They are set `nowrap` in
  a condensed face; longer text runs off the frame and no gate will catch it.
- **Vary the scene types.** Four `statement` scenes in a row reads as a slideshow.
- Pick the motif that means something for the beat — `split` for a fork, `wave`
  for anything oscillating, `compare` for two options, `rings` for spreading.
- Set `mood` from the topic row. Set `turn_beat` only if the story genuinely
  darkens (it tints the frame red); most topics should leave it out.

## 4. Build

```bash
python daily/lib/build.py daily/specs/<slug>.yaml
```

It runs narration → score → composition → **lint** → **inspect** → render → mix →
encode, and refuses to produce a file if a gate fails or the final duration,
frame size, or audio stream is wrong. A gate failure is a real defect: fix the
spec and rebuild. Never bypass a gate.

## 5. Look at it

```bash
python daily/lib/contact_sheet.py out/<slug>
```

Read the contact sheet before publishing. You are checking for: text colliding
with the caption band, a headline running off frame, an empty art zone, a motif
that contradicts the words. If something is wrong, fix the spec and rebuild —
one rebuild is cheaper than a bad video on the channel.

## 6. Publish

Write the copy: a title (≤100 chars, ends with `#Shorts`), an Instagram hook
line, a caption, a YouTube description, and 5–8 hashtags. Then:

```bash
python daily/lib/publish.py out/<slug> --spec daily/specs/<slug>.yaml \
  --title "…" --hook "…" --caption "…" --description "…" \
  --hashtags "science,physics,shorts" --privacy unlisted
```

Uploads run only when `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET` and
`YOUTUBE_REFRESH_TOKEN` are set. Without them the step reports `SKIPPED` and the
bundle is still written — that is a normal outcome, not a failure.

**Privacy stays `unlisted` until a human says otherwise.** These scripts ship
without review; unlisted means a bad one is recoverable.

Instagram and Facebook are blocked at this network's egress gateway, so they are
never uploaded from here. The bundle lands in `videos/<slug>/` — that is what
gets posted by hand, and it is the part that gets committed. Everything under
`out/` is scratch and is not tracked.

## 7. Record and commit

```bash
python -c "import sys;sys.path.insert(0,'daily/lib');import topics_queue;\
topics_queue.mark('<topic-id>', youtube='<video id or skipped>')"
git add -A && git commit -m "Daily short: <slug>" && git push -u origin <branch>
```

Commit the spec, `state.json`, and the finished MP4. The intermediate audio and
render artefacts are ignored.

## 8. Report

State in one short paragraph: the topic, where the video is, whether it uploaded
or was skipped and why, anything you had to fix, and how many topics remain.
If any step failed, say so plainly — a silent failure is worse than a red run.
