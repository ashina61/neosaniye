# The model sheet

Six poses of Adem side by side, plus his head at 2.6×, so the DRAWING can be
judged on its own instead of inside a film. Nothing here ships.

```bash
cd ink-theater/examples/model-sheet
ln -sf ../../ink-theater.js ../../ink-puppet.js ../../ink-figure.js ../../brand.js .
cp <any project>/hyperframes/{gsap.min.js,clips.js} .
mkdir -p assets && cp ../../assets/patrickhand.ttf assets/
npx hyperframes@0.8.29 snapshot . --at 0.02 -o /tmp/sheet
```

Then **look at it**. The character was rebuilt against a reference sheet on
2026-09-07 and every fault below was found this way and in no other way:

- the arms grew out of his sternum, because the clips are projected side on and
  both shoulders collapse onto the spine
- his shoulders were narrower than his chest — a pear, and the reason the arms
  hung off a point
- the hairline sat at his cheek, so the hair ran down over the eye
- the hands were paper discs
- the near leg was painted over the shirt, so the hem read as a line scribbled
  across his hip

None of them is visible in a film at 1.36×. All of them are obvious here.
