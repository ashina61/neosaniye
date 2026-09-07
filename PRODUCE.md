# Make today's video

You are a fresh session with no memory of the eight before this one. Everything
you need is in this repository, and this file is the order to read it in.

**Budget about two hours and four renders. Do not rush the looking.**

---

## 0. Read these, in this order

| | |
|---|---|
| `AGENT_GUIDE.md` | the contract. `CLAUDE.md` sends you here first for a reason |
| `productions/MANIFESTO.md` | what kind of channel this is, and the three architectures it has found |
| `productions/STYLE_LEDGER.md` | **a list of things you may not do again.** This is the memory you do not have |
| `ink-theater/ADEM.md` | the character, the frame, the traps. Binding |
| `productions/ENVIRONMENT.md` | what this machine has, and the house numbers |

## 1. Take a topic

```bash
python3 bin/queue.py topic
```

104 of them are curated in `daily/topics.yaml`, each with the **mechanism**
already written down. That sentence is the truth your script may not
contradict. If you cannot find a mechanism you can draw, take the next topic —
a topic you cannot draw is not a topic, and swapping is free.

## 2. Design it against the ledger, before you write a line

Open `productions/STYLE_LEDGER.md` and write down, for this film:

- **design read** — one sentence saying what the frame *is*
- **signature device** — the one recurring element that carries the argument
- **layout set** — how the frame is divided across beats
- **motion character** — how things enter, move and stop
- **palette roles** — which colour means what. **One accent.** Ration it

**Overlap with any previous row on two of those five is a re-design.** Used so
far: an oscilloscope · a corrected physics page · a machine shop · a doorway
machine · the page going blank · a simulation · a prediction drawn ahead and
subtracted · a rotation gauge. And: constant velocity · spring overshoot ·
mechanical stepping · mocap locomotion · stillness · phase · anticipation ·
free fall.

The strongest films here did one of three things. Reach for one:

1. **Act it** — if the mechanism is something a person does, Adem does it.
2. **Run it** — if it is a rule a lot of things follow at once, integrate the
   model in Python and read the picture *and the soundtrack* out of one array.
3. **Perform it** — if it is an operation (a subtraction, a cancellation), make
   the mix actually do it. The seventh video's prediction is the touch's own
   waveform inverted; the eighth's punchline is a wet slap against a dry clack.

## 3. Script, then voice

**Eleven or twelve lines, ~38 seconds of speech, 45 seconds of film.** The house
range is **40-50 seconds** and `bin/build-ink.sh` refuses anything outside it.
This line used to say sixty, and sixty is what it got: three films ran 60-62s,
which is a minute of somebody's attention asked for by a channel that has not
earned a minute yet. Cut the third example, not the payoff.

Plain English, short
sentences, one idea per line, and a **last line that pays off**. Write it into
`projects/<slug>/artifacts/script_lines.json`, then:

```python
from kokoro_onnx import Kokoro                       # ~30s to load; load ONCE
k = Kokoro(".voices/kokoro/kokoro-v1.0.onnx", ".voices/kokoro/voices-v1.0.bin")
s, sr = k.create(text, voice="am_michael", speed=1.0, lang="en-us")   # sr 24000
```

Trim the near-silence off each line before you time anything against it, and
write the measured durations into `artifacts/narration_durations.json`.

## 4. Lay the film out on one clock

One JSON — `sim/events.json` — holding the narration times and every event the
picture *and* the mix both need. Both read it. That is what keeps them together.

## 5. Sound

`ink-theater/sfx.py` has everything: `ui_click` `thud` `clack` `scrape`
`whoosh` `pencil` `tone` `room` `reverb` `place`, and the mix rules.

- `DUCK = 0.86`, `VOICE_PEAK = 0.93`, key from `speech_key()`
- **print `voice_over_bed_db()`.** Under +10 dB and the build refuses to ship
- a `ui_click` at `subscribe_at + SUBSCRIBE_TAP`
- a reverb tail longer than the gap between events erases the rhythm
- music: self-produced only. A held low pedal that moves once is usually enough

## 6. The composition

Copy the engine in. **The character and the layers come from `ink-theater/`,
which is where they are maintained** — copying them from the last production is
how a session ends up shipping last week's drawing:

```bash
cp ink-theater/{ink-theater.js,ink-puppet.js,ink-figure.js,brand.js,annotate.js} \
   projects/<slug>/hyperframes/
mkdir -p projects/<slug>/hyperframes/assets
cp ink-theater/assets/patrickhand.ttf projects/<slug>/hyperframes/assets/
# only these two come from a previous production:
cp projects/<last>/hyperframes/{gsap.min.js,clips.js} projects/<slug>/hyperframes/
```

Non-negotiable, and every one of them cost a render:

- **line weight: 3 for structure, 2 for detail.** The figure's own lines were
  halved on 2026-09-07 to match the reference sheet; a set drawn at 5 makes him
  look pasted into someone else's drawing
- **`fig.face.turn = 1` turns his head to the camera.** New, and the one beat
  a talking-head moment needs
- **captions at `top: 1250px`.** Below 1400 is under the Shorts title block
- picture in **y 200–1180**, nothing load-bearing right of x 900 below y 950
- `InkFigure.attach(pup, { unit: SCALE })`, and `InkPuppet.still("shuffle", 34)`
- **derive per-frame state from `t`. Never from a `tl.set` on a data object** —
  a timeline renders children in start-time order, so a set at 21.6 lands after
  the sync at position 0 and a seek draws the old value
- **pick one opacity channel per element and never mix.** `gsap.set` writes an
  inline style and beats both `setAttribute` and a later `{attr:{opacity}}`
- measure `getTotalLength()` **once at build time**, never in a callback
- rows of anything go into the DOM **back row first**, and jitter every one
- `InkBrand.mark(defs, brandLayer, {..., accent: <this film's accent>})` outside
  the camera group; `InkBrand.subscribe(tl, brandLayer, { at: DUR - 3.3 })`
- **`InkAnnotate.callout` / `measure` / `ring` wherever a shot does not say what
  it is.** Two on screen at a time, never in the caption band. This is the note
  that came back twice; do not make a shot the viewer has to decode

## 7. Look at it. This is the part that cannot be skipped

```bash
cd projects/<slug>/hyperframes
npx hyperframes@0.8.29 lint . && npx hyperframes@0.8.29 validate .
npx hyperframes@0.8.29 snapshot . --at 12.5 -o /tmp/s
```

Snapshot eight or ten moments, **stack them into one image and actually look at
it**, and fix what you see. Expect to do this three times. Every defect this
channel has shipped was visible here and nobody looked.

Two you will hit: a shot that holds still for more than ~4 seconds is the
static-shot trap, and a diagram that does not change for ten seconds is the same
trap wearing a lab coat.

## 8. Build

```bash
bin/build-ink.sh <slug>
```

Simulation → mix → lint → validate → render → delivery encode → checks → ship.
It refuses to ship on: voice under +10 dB over the bed, captions below y=1400,
not 1080×1920, loudness outside −14 ±1, true peak above −1.0, over 12 Mbps.

Then **look at the 61-frame contact sheet it leaves in `renders/strip/`.**
Three of the worst defects here were invisible in a still and obvious in a strip.

## 9. Write it down

- `source-docs/art-direction.md` — the five ledger fields, and *why*
- `source-docs/scenes.md` — the beat sheet
- `productions/<slug>/spec.yaml` — title, hook, description, **real sources**,
  hashtags. Cite author, title, journal, volume, pages, year. **Never invent a
  DOI or a URL** — a citation without a link is fine, a wrong link is not
- a row in `productions/STYLE_LEDGER.md`, and anything that cost you a render
  goes into `ink-theater/ADEM.md` so tomorrow does not repeat it

## 9b. The copy, and why it is short

`spec.yaml`'s `copy` block is what the channel actually shows. The first eight
films went up with 1800-character descriptions and one visible hashtag, which
is a wall of text nobody opens and, in practice, no tags at all. The shape now:

```
copy:
  title:  the on-screen claim, under 100 characters
  hook:   one line — it becomes the first comment
  caption: 2-3 sentences, for the bundle and for Meta
  description: |-
    The claim, in one line. This is all most people see.

    The mechanism, two or three sentences. No bibliography.

    Source: Author, Journal (year).

    #Four #Or #Five #Visible #Shorts
  hashtags: [four, to, fifteen, keyword, tags, no, hashes]
```

150-700 characters, first line under 160, at least four hashtags **in the
description** — `hashtags:` is API metadata and nobody can see it. The full
citations belong in `source/`, not under the video.

```bash
python3 bin/check-copy.py productions/<slug>/spec.yaml
```

The publisher runs the same check before every upload, and a failure keeps the
entry `pending`. Run it yourself rather than finding out there.

## 10. Queue it and push

```bash
python3 bin/queue.py add <slug> --topic <topic-id>
git add -A && git commit && git push -u origin claude/openmontage-setup-dh10g0
git push origin claude/openmontage-setup-dh10g0:main    # mirror, see below
```

It goes in as `pending`. **The queue publishes two a day**, 09:00 and 20:00
Istanbul, and there are two producer runs a day to feed it. So the line is
short: a film made this morning can be on the channel this evening. There is no
multi-day review window any more — the build gates and your own judgement are
the review. `python3 bin/queue.py status` prints a **runway** line; if it says
under 1.5 days, the channel is one missed run from going quiet, and that is
worth saying in your report.

**Push to both.** The publisher's cron can only fire from `main`, so the
workflow file has to be there, but the job checks out
`claude/openmontage-setup-dh10g0` and reads the queue from it. Mirroring the
branch onto `main` after your push keeps the scheduler and the workflow file
current. It is a fast-forward; if it is refused, say so in your report rather
than forcing it.

Never touch `enabled` in `QUEUE.yaml`; that switch is not yours.

---

## If you cannot finish

Push what you have and say so in the commit. A half-built project in
`projects/<slug>/` is a fine place for tomorrow to start. **Do not ship
something you have not looked at, and do not add it to the queue.** An empty
slot costs nothing; a bad video on the channel costs more than an empty slot —
and at two a day it is seen sooner.
