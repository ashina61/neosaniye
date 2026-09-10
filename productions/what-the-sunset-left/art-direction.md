# What The Sunset Left — art direction

## The read

**One beam, and the only variable is how far it has come.**

Every other version of this film I could have made puts two pictures side by
side: a short path and a long path, a noon diagram and a sunset diagram, a
round Earth with rays coming in at two angles. None of that is necessary,
because the physics has exactly one independent variable — how much air the
light crossed — and a single line already has a length.

So the middle of the film is one sunbeam crossing a band of air from left to
right, made of individual photons, with **two marks on it**. "noon" near the
start, where there is still blue in the beam and a great deal of blue leaving
it. "sunset" at the far end, where there is not. The x-axis is the argument.

## The signature device

**The blue that left.** Every blue photon that turns out of the beam keeps
going, off into the page, and fades. Those are the sky. By the sunset mark the
beam is red because all of its blue is above somebody else — which is the last
line of the script, drawn about twenty seconds before it is spoken.

The film cashes this once more, on purpose. On the noon beat we cut back
outside, where Adem is standing under a sky drawn out of blue specks, and a
dozen of them come down out of it and into his eye — **the same colour, the
same radius, the same dot** as the ones leaving the beam two cuts earlier.

## Motion character

**Traffic.** Nothing eases, springs or falls. Two hundred and thirty photons
launch on a fixed schedule and travel at one constant speed (268 px/s) for the
whole film, and the only thing that ever happens to one is that it turns once
and leaves. The scatter distance comes from `1/λ⁴` doing what it does: blue
within a few hundred pixels, red mostly off the right of the page.

They **recycle**. The first pass launched each photon once, so the schedule ran
out at t=20.7 and the entire second half of the film — the sunset half, the
half the film is named after — was an empty pair of lines. Each photon now
relaunches every 15.6 s and draws a fresh distance and angle from a hash of
(index, cycle), so it is deterministic, seek-safe and never repeats.

## Palette

**Two accents, and this film breaks the house rule on purpose.** Blue `#2F6FA8`
is short wavelengths and warm `#C8562B` is long ones, and neither appears on
anything that is not light. The rule exists to stop decorative colour; here
colour is the subject, and a one-accent version of this film would have to
explain in words what a viewer can otherwise see.

The sky over Adem is drawn out of the same dots the diagram is made of,
because that is what a sky **is**: light that was knocked sideways on its way
past.

## Sound

The claim is subtractive — nothing is added to sunlight on its way to a sunset,
something is taken out — so the soundtrack is subtractive too. **The bed loses
its top end as the film runs.** It opens as a bright afternoon: air with
sparkle in it, three birds, and a shimmer of 6–11 kHz ticks that is the
scattering itself. From 28.6 s a low-pass walks from 13 kHz down to 1.1 kHz, so
the last two lines land in a room with nothing above a kilohertz in it.

Nothing is faded and nothing is swapped: it is the same bed with its short
wavelengths removed. Measured and gated in `sim/mix.py` — the bed carries
17.8 dB less above 4 kHz at dusk than it did in the afternoon, and the build
stops if that drops under 12.

The birds stop before the light does, because they do.
