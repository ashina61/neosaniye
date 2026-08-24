# Asset acquisition — benchmark

## The headline, first, because it is the whole result

**No external asset provider is reachable from this environment.** All eight are
refused at the CONNECT stage by the egress policy, before any request is made.
The acquisition layer is built, tested and running; it has nothing to acquire
from.

```
$ npm run assets:providers

  ok  local       Local reviewed corpus          77 reviewed file(s) on disk
 DOWN commons     Wikimedia Commons              blocked — HTTP 403 at commons.wikimedia.org
 DOWN openverse   Openverse                      blocked — HTTP 403 at api.openverse.org
 DOWN loc         Library of Congress            blocked — HTTP 403 at www.loc.gov
 DOWN archive     Internet Archive               blocked — HTTP 403 at archive.org
 DOWN europeana   Europeana                      blocked — HTTP 403 at api.europeana.eu
 DOWN nasa        NASA Image and Video Library   blocked — HTTP 403 at images-api.nasa.gov
 DOWN pexels      Pexels                         blocked — HTTP 403 at api.pexels.com
 DOWN pixabay     Pixabay                        blocked — HTTP 403 at pixabay.com
 DOWN generated   Configured image generator     unconfigured — set IMAGE_API_URL

1/10 provider(s) reachable · image generation not configured
```

The refusal is at the proxy's CONNECT, confirmed in its own log:

```
{"kind":"connect_rejected",
 "detail":"gateway answered 403 to CONNECT (policy denial or upstream failure)",
 "host":"commons.wikimedia.org:443"}
```

This is an **environment fact, not a provider fact**, and it is reported as one.
Every provider is written against its real API and will work the day the
allowlist opens; none of them is a stub.

## Asset relevance

| | before | after |
|---|---|---|
| assetRelevance | **6.0** | **6.0** |

Unchanged, and it could not have changed. That axis is 6.0 because the five
benchmark reels contain no photography, and no photography could be acquired
because no provider answered. **Moving that number without moving the pictures
would have required faking the benchmark**, which is the one outcome the brief
ruled out.

## What the run actually did

45 briefs across five episodes, against the one reachable provider.

| episode | requested | accepted | candidates scored | procedural | typography | `REPRESENTATION_REQUIRED` | blocking |
|---|---|---|---|---|---|---|---|
| Baalbek | 9 | 0 | 56 | 8 | 0 | 1 | 1 |
| Roman concrete | 9 | 0 | 51 | 8 | 1 | 0 | 0 |
| Hormuz | 9 | 0 | 46 | 6 | 2 | 1 | 1 |
| Human heart | 9 | 0 | 41 | 7 | 1 | 1 | 1 |
| Medieval sword | 9 | 0 | 33 | 6 | 0 | 3 | 3 |
| **Total** | **45** | **0** | **227** | **35** | **4** | **6** | **6** |

### Provider success rates

| provider | searches | candidates returned | scored | accepted | failed |
|---|---|---|---|---|---|
| `local` | 135 | 227 | 227 | 0 | 0 |
| the other nine | 0 | — | — | — | unreachable |

### Rejection reasons

All 227 candidates were refused at the **semantic gate**, none reached quality,
composition, licence or dedupe. That is the correct shape for this run: the local
corpus holds pictures fetched for *other* episodes — a Roman lamp, a sea slug, a
chest of drawers, a full moon — and none of them is a picture of a megalith, a
strait, a human heart or a forge.

Example: `File:Post Medieval, Inkwell (FindID 152296).jpg`, offered for
Baalbek's scale brief — *"semantic relevance 0/10 is below the floor of 8 — it
is not a picture of scale."*

### Licence coverage

100% of accepted assets carry full provenance, because acceptance requires it:
source, source URL, creator, licence, licence family, retrieval date, asset id
and local filename. Zero assets were accepted in the five benchmark episodes, so
the coverage figure that matters is the control run below.

## The control: proving the gate can accept

A gate that refuses everything passes every rejection test ever written and is
worthless. So the same pipeline was run against **antikythera**, the one episode
whose local corpus was fetched and reviewed for its own subjects:

```
✓ antikythera — 6 requested · 1 accepted · 29 candidate(s) rejected
```

The accepted asset:

| | |
|---|---|
| line | `moon` — a celestial claim |
| title | *File:Full moon in night sky - India.jpg* |
| source | Wikimedia Commons (via the local cache) |
| creator | Ksheera Piraati |
| licence | CC BY 4.0 — credit required, and recorded |
| semantic relevance | 9 |
| accuracy | 9 |
| quality | 9.3 |
| composition | 7.5 |
| rung | 1 — reviewed local asset |

A real photograph of the right subject, licence-clean, fully credited. The
pipeline accepts.

And two rejections from the same run show the other gates firing on real files:

- *Roman lamp, reconstructed view* — passed semantic, refused at **licence**:
  the file says `CC BY 2.0` and its author field says `All rights reserved,
  Julian Watters`. A contradictory record is resolved by a person, not guessed.
- *Full moon* offered for a **material** brief — passed semantic on a different
  line, refused at **quality** elsewhere on exposure.

## Two defects found and fixed during the build

Both were caught by running the pipeline on real data, not by reading it.

### A review belongs to a casting, not to a file

The first working run accepted **one photograph of a Roman oil lamp as a
megalith, a harbour, a strait, a human heart and a medieval forge** — five
episodes, five subjects, one file, relevance 9 every time.

Cause: the scorer read a human review as a property of the file. The reviewer
who wrote 9 for `museum-dark.jpg` meant *"9 as a dark museum ground for the
Antikythera reel"*. Read as absolute, that 9 travelled. It is the exact failure
this repository is named after, rebuilt inside the machine meant to prevent it.

Fixed: numeric scores transfer only where the file is cast in that role,
established from the scene config. What always transfers is `depicts` — a
person's description of what is in the picture, which is a fact about the file.

### Exposure was measured as distance from mid-grey

Which rejected every correctly-exposed dark plate in this repo's register: a
moon against a night sky (exposure 1.4/10), bronze on a dark museum ground, a
black-background specimen plate. What makes a photograph unusable is detail that
is *not there* — pixels pinned at the ends of the range. Rewritten as clipping,
with highlight clipping punished about four times as hard as shadow: the moon
now scores 10, and the plate that brings its own white studio sweep into a
black-and-amber film scores 0 with *"blown out: 66% of the frame is at
clipping"*.

## Remaining ASSET_REQUIRED

**45**, unchanged, across the five episodes — 6 of them `BLOCKING` (a line about
something type cannot depict, with no drawing covering it). Nothing was acquired,
so nothing was removed from the list.

Of the 45 lines: 35 are carried by procedural drawings, 4 by typography for
genuinely abstract claims, and **6 are holes** counted and reported rather than
disguised.

## Re-render

All five re-rendered from unchanged scene configs. Acquisition writes a manifest
and never touches a scene config, so `git status` after the run shows **zero
scene-config changes** — which is the architectural claim, checked rather than
asserted. 304 tests pass, 12 episodes valid.

## What it would take to move the number

One allowlist entry. `commons.wikimedia.org` and `upload.wikimedia.org` alone
would open rung two for every episode here; `www.loc.gov` and `archive.org` open
rung three. Europeana, Pexels and Pixabay additionally need a free API key in
`EUROPEANA_API_KEY`, `PEXELS_API_KEY`, `PIXABAY_API_KEY`. Rung four opens with
`IMAGE_API_URL`.

The layer is finished and the benchmark is honest: it reports zero because zero
is what a blocked network yields.
