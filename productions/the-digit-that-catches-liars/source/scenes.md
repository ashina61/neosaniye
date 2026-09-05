# Shot list

Thirteen shots, 1698 frames at 30fps — 56.6 seconds. Every cut is hard; there is
not one dissolve in the video. Timings are measured, not planned: each narration
section was synthesised separately with Piper, its real duration read back from
the wav, and the animation cut to those numbers.

Manim class names are in `manim/benford.py`. The Remotion layer that sits over
all of them is `Composition.tsx`.

| # | frames | seconds | Manim scene | chip | what happens |
|---|---|---|---|---|---|
| sc01 | 0–156 | 0.00–5.20 | `S01Pile` | Real numbers | Twelve numbers of wildly different magnitude fly in from the edges at constant rate and stop dead. Nothing is labelled. |
| sc02 | 156–284 | 5.20–9.47 | `S02Grid` | The obvious guess | The pile recedes to 18%. A 3×3 grid of nine hollow boxes comes forward, each captioned 11.1%. Each number's leading digit lifts out in chartreuse and flies into its box. |
| sc03 | 284–436 | 9.47–14.53 | `S03Break` | What actually happens | The grid is replaced — in three quantised jumps, not a travel — by nine unequal bars. 1 is chartreuse at 30.1%; 9 is a stub at 4.6%. |
| sc04 | 436–526 | 14.53–17.53 | `S04Rule` | *(none)* | Everything clears. A single heavy bone rule draws itself across an empty frame at constant rate. The only shot in the video with no chip. |
| sc05 | 526–642 | 17.53–21.40 | `S05Ticks` | A ruler for multiplying | Dividers snap onto the rule at log10 positions, one at a time, with each stretch's digit appearing beneath it. The unevenness is never announced; the ticks simply land where they land. |
| sc06 | 642–760 | 21.40–25.33 | `S06Decades` | A ruler for multiplying | A chartreuse bar fills the first stretch. Then the labels step from `1 → 2` to `10 → 20` to `100 → 200` — **and the bar does not move.** That is scale invariance, shown by not animating anything. |
| sc07 | 760–882 | 25.33–29.40 | `S07Caliper` | .301 against .046 | The caliper closes on the first stretch and reads `.301`, then steps along the ruler digit by digit and closes on the ninth: `.046`. Both readings are left under their stretches. Remotion adds the bracket: **6.5 ×**. |
| sc08 | 882–1001 | 29.40–33.37 | `S08Drops` | .301 against .046 | Forty-four markers drop onto the ruler at uniformly random positions, accelerating from one every 0.115s to three a frame. Each lights where it fell and adds to a tally above its stretch. The tally builds the distribution in front of you. |
| sc09 | 1001–1112 | 33.37–37.07 | `S09StandUp` | The whole law | **The one continuous move.** The nine stretches detach, rotate upright keeping their widths as heights, and become the chart from sc03 — while the ruler behind them fades to 10%. Everything else in the video steps; this does not. |
| sc10 | 1112–1289 | 37.07–42.97 | `S10Ledger` | Why auditors run it | Twelve invented expense figures write themselves in, each adding to a hollow bone tally. The tally comes out nearly flat. Then the real distribution drops over it as a chartreuse staircase and does not match. Manim labels one curve, Remotion labels the other. |
| sc11 | 1289–1415 | 42.97–47.17 | `S11Greece` | One real case | `3.7%` alone in the frame. On the beat it is overwritten in place by `15.4%` — no travel, no morph, one frame. The old value is left struck through at 26%. |
| sc12 | 1415–1545 | 47.17–51.50 | `S12Span` | The condition | The ruler is rescaled to five decades. The caliper returns, but now it measures the *span* of a dataset: the jaws open across four decades of invoices in four steps. |
| sc13 | 1545–1698 | 51.50–56.60 | `S13Narrow` | The condition | The cloud is replaced by a magenta one crushed into a sliver — adult heights, then one precinct's votes — and the jaws close to almost nothing. `0.2 decades`, then `0.7`. **NOT ENOUGH RULER.** The video ends on the still frame with the caliper shut. |

## The audio

Ten Piper sections placed at their measured start times, with the gaps between
them cut into the edit rather than performed: 0.22, 0.16, 0.34, **0.55**, 0.20,
0.20, 0.16, 0.22, 0.42, then a 1.10s tail on the closing still. The 0.55 is the
pivot at sc04 — the frame is empty there and the silence is the point.

No music. The only non-voice sound is a machined tick — 55ms, two sine partials,
locally synthesised, sixteen of them — one per caliper move in sc07, sc12 and
sc13. It is the instrument's own sound and it appears nowhere else.

## The captions

Thirty-six chunks, built by `scripts/build_captions.py` from the script text and
the measured section durations, then hand-corrected in three places where the
chunker broke a number ("Greece reported a three point / seven percent deficit")
or left an orphan ("works:"). Twelve of them mark a load-bearing word in the
accent; the last one marks **anything** in the reserved colour, which is the
only magenta in the typography and lands on the same beat as the only magenta in
the drawing.
