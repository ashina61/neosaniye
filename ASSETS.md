# The asset acquisition layer

`acquire/` is a separate module. It is **not** part of the Remotion engine, it
does not import from `engine/`, and it never writes a scene config. Its output
is a manifest; what the reel does with that is the planner's business.

```
STORY → REPRESENTATION → ASSET BRIEF → SEARCH → CANDIDATES
      → SEMANTIC → QUALITY → COMPOSITION → LICENCE → DEDUPE
      → ACCEPT / REJECT → ASSET_MANIFEST.json → REMOTION
```

## Commands

```
npm run assets:providers                    # who is reachable from here, and why not
npm run assets:acquire -- --episode=<id>    # run the ladder for one episode
npm run assets:acquire -- --episode=a,b --force   # ignore the cache
npm run assets:acquire -- --episode=a --dry       # plan without contacting anyone
```

## The provider contract

Four functions and a name:

```js
search(query, {limit, brief, orientation})  // candidates, cheapest metadata that decides
metadata(candidate)                          // whatever search did not return
license(candidate)                           // normalised
download(candidate)                          // bytes
```

A **candidate is not an asset** — it is a claim by a remote service that an
asset exists, and the acquisition layer's job is to disbelieve it until it has
been scored. `search` returns the least it can; `download` runs for a handful of
survivors. A provider that downloads everything it finds costs a gigabyte a line.

Ten providers are implemented: `local`, `commons`, `openverse`, `loc`,
`archive`, `europeana`, `nasa`, `pexels`, `pixabay`, `generated`. Each is
independently replaceable.

### Availability is a fact, not a hope

Every provider is preflighted **once per run** and the result travels into the
report. The distinction that matters is between a refusal at the CONNECT stage
(the egress policy said no and no request was ever made) and an error from the
service (we reached it and it complained):

| why | means |
|---|---|
| `blocked` | the network refused the connection — firewall or egress policy |
| `unconfigured` | the provider needs an API key that is not set |
| `timeout` | no answer in time |
| `failing` | it answered and the answer was unusable |

Treating a 403 as an empty result set produces a run that reports "no suitable
images found" for an environment that never made a request. That is the most
expensive lie this layer could tell, so it is the one thing it is built not to
do.

## The brief

Eleven fields, derived from `assets.required.json` without touching the
representation selector:

`subject` · `purpose` · `representation` · `must_show` ·
`preferred_orientation` · `preferred_composition` · `historical_constraints` ·
`scientific_constraints` · `acceptable_substitutes` · `reject_if` ·
`license_requirements`

The two constraint fields are separate because they fail differently: a
historical error is a claim about the past a viewer could look up, a scientific
error is a claim about how something works. A brief about a strait has the
second and not the first. Collapsing them is how "close enough" gets in.

`reject_if` is the field this repository learned the hard way — a Greek
shipwreck was illustrated with an antique brass dial because nobody had written
down what "close enough" excluded — so a brief without one is rejected as
unusable.

## Three gates, and only one of them can reject alone

**SEMANTIC runs first, on metadata, before the download.** A wrong-subject
candidate costs nothing to refuse there and a full decode to refuse later. It is
also the honest place for it: whether this is a picture of the thing is a
question about what it depicts, not about its pixels.

- semantic relevance < **8** → REJECT
- historical or scientific accuracy < **8**, where the brief asserts one → REJECT

No arrangement of resolution, exposure and composition buys those back. Five
green technical axes averaged with two red semantic ones is exactly how a
Victorian console shipped as a museum store room.

**Evidence is ranked, and the ranking is reported.** A human review of *this
brief* outranks everything. Then a human description of what is in the picture.
Then the provider's description. Then the title — and a title-only candidate is
**capped below the floor**, because a filename is a claim about a picture and
not the picture. It can be shortlisted for a person to look at; it can never be
accepted outright.

### A review belongs to a casting, not to a file

The first version of the scorer read a human review as a property of the file.
A reviewer writing 9 for `museum-dark.jpg` meant *"9 as a dark museum ground for
the Antikythera reel"*. Read as a property of the file, that 9 travelled: one
photograph of a Roman lamp was accepted as a megalith, a harbour, a strait, a
human heart and a medieval forge, across five episodes, on the same borrowed
number — the exact failure this repository is named after, rebuilt inside the
machine meant to prevent it.

The numbers now transfer only where the file is cast in that role. What always
transfers is `depicts`: a person's description of what is in the picture, which
is a fact about the file rather than about a brief.

## Quality is measured from the file

Resolution against the frame it must fill, focus (Laplacian variance), exposure,
contrast, subject visibility, background complexity, crop survival to 9:16, and
orientation fit. The mean **and separately the worst** — one unusable axis is
not something the other seven average away.

### Exposure is lost detail, not distance from mid-grey

The first version scored exposure as distance from 0.46 and rejected every
correctly-exposed dark plate in this repo's register: a moon against a night
sky, bronze on a dark museum ground, a black-background specimen. What makes a
photograph unusable is detail that is *not there* — pixels pinned at the top or
bottom of the range, where no grade recovers them. Highlight clipping is
punished about four times as hard as shadow clipping, because a dark reel
absorbs a black frame edge and cannot absorb a white one.

## Composition is judged against the planned shot

Where the mass actually sits, versus where the brief says the subject should be.
A shot needing a side clear for type wants the mass off centre; one composed
around its object wants it centred. Both are the same measurement in opposite
directions. Also: headroom for a push, containment for a whole-object brief, and
somewhere quiet for a caption.

## Licence

Two absolute refusals — **non-commercial** (a reel may be monetised, and the
licence is decided at publication) and **no-derivatives** (a reel crops, pushes,
grades and overlays). Plus:

- CC BY / CC BY-SA with no recorded creator → refused; it cannot be credited.
- **Public domain with no source and source URL → refused.** Anything else at
  least names a licensor; "public domain" names nobody, so provenance is the
  only thing that claim rests on.
- A contradictory record — licence "CC BY 2.0", author "All rights reserved,
  …" — is refused. The pipeline does not get to pick the convenient reading.

Every accepted asset records source, source URL, creator, licence, licence URL,
retrieval date, asset id and local filename. `source` is the **original
publisher**, not where we happened to read it: the local corpus is a cache of
the archives, and recording "local" as the source of a Wikimedia photograph is
the absence of provenance, not provenance.

## Cache

Keyed on `provider + assetId + variant` and nothing else — not the query, not
the brief, not the episode. The same file requested for two lines is one file,
and keying on the request would store it twice and then fail to notice it was a
duplicate. This is what makes "run the benchmark again" mean the same thing
twice.

## Deduplication

Three kinds of repeat, in inverse order of how easy they are to catch:

1. **The same asset** — same provider and id, or identical bytes. Refused.
2. **A near-duplicate** — a 64-bit difference hash; a re-encoded, resized copy
   scores 0 bits apart while two different photographs score 26. Refused.
3. **The same composition** — different subject, identical framing. **Demoted,
   not refused**: a before and an after are the same composition on purpose, and
   this layer does not know whether the story wants that.

## The ladder

| rung | | usable when |
|---|---|---|
| 1 | reviewed local asset | always — it is a directory |
| 2 | reliable external photograph | commons / openverse / pexels / pixabay reachable |
| 3 | public-domain archive | loc / archive / europeana / nasa reachable |
| 4 | generated illustration | `IMAGE_API_URL` or `IMAGE_API_KEY` set |
| 5 | procedural representation | always — the engine draws it |
| 6 | typography | **only for a genuinely abstract claim** |

Rung six is guarded. A line about a place, a process, a body, a mechanism, a
size or the inside of a material cannot be carried by words: it reaches rung six
only as a counted, reported `REPRESENTATION_REQUIRED` hole. Falling through
silently is what produced forty-one text cards out of forty-five lines.

### Generated assets never claim to be photographs

Every rung-four asset records prompt, provider, model and generation date, and
carries a disclosure plate. Where the subject is a reconstruction rather than
something anybody could have seen, that plate reads **ILLUSTRATIVE
RECONSTRUCTION** — the same plate the procedural library already draws, for the
same reason: a drawing presented as a record is a worse lie than a wrong
photograph, because the viewer cannot check it.

The brief's `reject_if` becomes the generator's negative prompt. It is the one
place in this pipeline where refusing a wrong photograph and instructing a
generator are literally the same list.

## Output

| file | what it holds |
|---|---|
| `episodes/<id>/ASSET_MANIFEST.json` | every accepted asset with full provenance and its scores |
| `episodes/<id>/CREDITS.md` | the attribution the licences require, per file |
| `episodes/<id>/asset-review.json` | every candidate, where it was rejected and why, plus provider availability and the ladder state |

`CREDITS.md` says what it is for: CC BY and CC BY-SA require credit **wherever
the reel is published** — in the video description, not only in a repository
nobody reading the description will open.

---

# Human-in-the-loop casting

When no provider can be reached — or when a provider simply has nothing — a
person supplies the file. Same three gates, same licence rules, same manifest;
the only difference is who found the picture.

```
ASSET_REQUIRED → ASSET BRIEF → HUMAN SUPPLIES FILE → INGESTION
  → SEMANTIC → QUALITY → COMPOSITION → LICENCE/PROVENANCE
  → ACCEPT / REJECT → ASSET_MANIFEST.json → RENDER
```

## Commands

```
npm run assets:briefs -- --episode=baalbek [--plates]   what has to be supplied, and why
npm run assets:list                                     what is in the inbox and what became of it
npm run assets:match [-- --describe="…"]                score the inbox against every open brief
npm run assets:validate -- --file=… --id=… [--source=… --license=… …]
npm run assets:report                                   one page: what is still needed
```

## `assets/casting.json` is the deliverable

One file that answers *"what images do I need to supply?"* without opening
anything else. Per brief: `id`, `episode`, `shot`, `subject`, `purpose`,
`representation`, `must_show`, `preferred_orientation`,
`preferred_composition`, `historical_constraints`, `scientific_constraints`,
`reject_if`, `status` — plus the line it serves, what the reel currently does
instead, search terms, and the shape the shot demands.

Regenerating never discards human work: status, candidates, provenance and
decisions are carried across by `id`.

### Status is a lifecycle

| status | meaning |
|---|---|
| `OPEN` | nobody has supplied anything |
| `CANDIDATE` | a file is in, scored, awaiting a decision |
| `PROVENANCE_REQUIRED` | the picture is right and we do not know where it came from |
| `ACCEPTED` | it passed every gate and is in the manifest |
| `REJECTED` | refused, with the reason recorded |

`PROVENANCE_REQUIRED` is separate from `REJECTED` because the two need
different actions: a rejected picture needs a different picture, an
unprovenanced one needs somebody to write down where they got it. Collapsing
them loses a usable asset and teaches nobody anything.

## The shot's demands are read, not guessed

A brief written from the sentence says what the image must be OF. The scene
config says what it must be SHAPED like, and that is the half discovered too
late. For each line, `acquire/shot.mjs` unions every shot that line is carried
by and takes the **worst case**: the hardest push, the union of the caption
bands, the widest pan. A picture sized for the average shot fails in the
hardest one.

From `baalbek/blocks`, served by three shots:

```
at least 1700px on the short edge — the camera pushes to 1.52x
keep the subject clear of y=1312–1581: that band carries the caption
the subject should sit inside x 185–895, y 361–1312 after the push
this shot pushes hard, so leave room — a subject touching the frame edge
  has nowhere to be revealed from
```

Nothing writes back to the scene config. The scene is the director's.

## The filename carries no authority

A file called `baalbek-trilithon.jpg` is a file somebody *named*
`baalbek-trilithon.jpg`. `assets:match` scores what is in it against **every**
open brief and returns a ranking with reasons — never an assignment.

A supplied file also has no description, and the semantic scorer is not allowed
to trust a filename, so **somebody has to say what the picture is**
(`--describe`). A file nobody will describe cannot be cast.

### When two roles score alike, a person decides

Casting is automatic only when the top brief leads the runner-up by more than
`CONFIRM_MARGIN` (0.25). Below that the pipeline stops and asks, because the
cost of an automatic wrong cast is the failure this repository is named after
and the cost of asking is one question.

```
Baalbek stone 9.2 · generic megalith 8.9   → suggests Baalbek stone
lamp shot     9.3 · ancient artefact  9.1   → asks
```

## The original is never touched

`assets/original/` holds the supplied file under its content hash, unmodified —
not cropped, not resized, not re-encoded. Two people supplying the same
photograph under two names is one photograph. Everything downstream reads that
copy and writes to `assets/processed/`, so a bad normalisation costs a rerun
rather than a file, and the provenance chain stays attached to the thing the
licence actually describes.

Normalisation squares up EXIF orientation, crops 9:16 around a supplied focus
point, sizes for the push the camera will make, and keeps side margin for a pan.
It does **not** grade — `FilmLook` grades the whole reel once at the end, and a
pre-graded picture is graded twice.

**Background removal is asked for, never assumed.** A clean cut-out needs a
clean source; keying a photograph of an object in a room returns a rectangle.
When a human asks for alpha they are asserting the source supports it, and the
record says they asked.

## The composition preview

The check no score can make. Every candidate gets a full-frame preview with four
overlays: the 9:16 crop, the **caption band** in red (the words win), the
**subject box** in green, and the **end-of-push bounds** in yellow. This
repository has shipped every one of these as a defect — a subject behind a
caption, a monument cropped out by a push, a plate with nothing to push into —
and every one was obvious in a single annotated still.

`--plates` generates the empty version: the frame, the caption band and the
subject box on a blank ground, which is what you hand somebody going out with a
camera. It answers the question before the picture exists.

## Provenance is stated, never inferred

`source`, `sourceUrl`, `creator`, `license`, `licenseUrl`, `retrievalDate`,
`notes`. `source` and `license` are mandatory; the rest are required by whichever
licence applies. **No licence is ever inferred from a file.**
