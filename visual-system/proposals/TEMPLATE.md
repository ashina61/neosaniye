# `ComponentName`

**Status:** PROPOSED
**Proposed:** YYYY-MM-DD
**DNA version:** 1.0.0

## The problem

What cannot currently be shown. Describe the *visual* requirement, not the
episode that raised it — if this section names an episode, the proposal is
probably episode-specific code looking for a home.

## Why existing components cannot solve it

Name the components you checked and why each falls short. "I did not find one"
is not an answer; `visual-system/components.mjs` lists seventy.

| component checked | why it does not serve |
|---|---|
| | |

If the honest answer is "X almost does", **extend X** and withdraw this.

## Visual purpose

What the viewer understands from seeing it, that they would not otherwise.

## Motion purpose

Which motion family it belongs to (ENTRANCE / EMPHASIS / TRANSFORMATION /
CAUSAL / CAMERA / EXIT) and why. A component with no family is decoration.

## Example use

```tsx
```

## Visual DNA compliance

- **Typography:** which of the three families, at which role size
- **Colour:** accent, neutral or semantic — never a new hex
- **Stroke:** which of the four weights, or the marker register with a reason
- **Composition:** which plane; how it clears the caption band
- **Contrast:** how it stays above 3:1 against its ground

## Motion DNA compliance

- **Family:** one of six
- **Easing:** one of the nine, or which physical model
- **Duration:** within the family's range
- **Clock:** steps on the shared 12fps grid
- **Causality:** what causes it, and what it causes

## Reusability

Three unrelated episodes that would use this:

1.
2.
3.

If two are strained, this is not a component yet.

## Test requirements

What a regression test would assert. A component with no assertable behaviour
cannot be kept honest, and this repository's rule is that a check which does not
exist cannot fail.

- [ ]
- [ ]
