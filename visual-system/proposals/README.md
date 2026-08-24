# Component proposals

A genuinely new visual behaviour is **proposed here first**. It is not invented
silently in an episode.

## Why this exists

The failure mode is not writing a bad component. It is writing a *third* way to
point at something, in a file called `ArrowFinal.tsx`, because searching took
longer than typing. Six months later the channel has three arrow styles and no
arrow style.

## Before proposing

1. **Search `visual-system/components.mjs`.** Seventy components are registered
   with what they are for and what they are *not* for.
2. **Check whether an existing component can express the requirement** — most
   "new" requirements are an existing component with a prop it does not have yet.
3. **Prefer composition.** `Callout` + `Measurement` + `Depth` is three
   registered components and no new vocabulary.
4. **Only then propose.**

Extending beats forking, always. There is no `Arrow2`, no `ArrowNew`, no
`BetterArrow` and no `ArrowFinal`. There is `Arrow`, and it takes props — the
lint refuses those names outright.

## The bar

A component is implemented only if it is **reusable across subjects**. A
component that only a reel about swords could use is not a component, it is that
reel's code living in the shared library where the next author has to read past
it.

The test: *name three unrelated episodes that would use this.* If two of them are
strained, it is not a component yet.

## Status

Every proposal is `PROPOSED` until somebody agrees. Only `ACCEPTED` proposals may
be implemented, and implementation adds the component to
`visual-system/components.mjs` in the same commit — an unregistered component is
an undiscoverable one, and undiscoverable components get rebuilt.

Copy `TEMPLATE.md` to `<component-name>.md`.
