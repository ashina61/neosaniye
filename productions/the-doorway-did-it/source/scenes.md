# Beat list

Nine beats, 1411 frames at 30fps — 47.03 seconds, and **one shot**. There is no
cut anywhere in this video after the first frame. Timings are measured: each
narration section was synthesised with Piper, its real duration read back, and
the acting cut to those numbers.

| # | seconds | clip | what happens |
|---|---|---|---|
| b01 | 0.00–3.81 | `draw_in` | Empty paper. The pencil sketches the figure in, part by part, under a scratch. On the last word an orange errand pops into its hand. Nothing else exists yet — no floor, no door. |
| b02 | 3.81–5.98 | *(hold)* | The ground draws in, and the doorway with it: two uprights, a lintel, hatch above to say it is a hole in a wall rather than a goalpost, and a barrier arm folded flat up the left post. The figure does not react to any of it. |
| b03 | 5.98–11.48 | `march` | The figure marches on the spot while a plain measured rule draws along the floor. It is walking and getting nowhere, which is the whole content of "same distance every time". **The world does not slide in this beat** — that is the joke. |
| b04 | 11.48–15.65 | `walk` | It breaks into a walk and the world starts sliding left at 37.6 px/s. The arm cocks past vertical at 13.5s, like a trap being set. The figure still does not see it. |
| b05 | 15.65–23.16 | `walk` | **The beat.** At 20.33s, on the word *closes*, the arm drops to horizontal and sweeps the errand out of the hand. It falls, a box appears around it, the lid stamps shut with a clack. The figure walks on with nothing in its hand for two full seconds of silence, and its stride does not change. |
| b06 | 23.16–29.29 | `shuffle` → `walk` mirrored | One speech balloon — *why did I come in here* — the only written joke and the only balloon. Then it creeps around the empty room, turns (scaleX flip about its own ground point) and walks back the way it came. |
| b07 | 29.29–34.15 | `kick` | It arrives at the box. Red flashes once around the lid seam. It kicks the box. The box does not move. |
| b08 | 34.15–37.65 | `sit` | Three more orange errands rise and circle above its head, crowding it. It sits down. |
| b09 | 37.65–47.03 | *(stands)* | The camera pulls back to 0.55. The one box turns out to be the near end of a line of closed boxes running off the left edge — every room it ever finished. Blue draws along all of them in one stroke. Everything stops. |

## The audio

Ten Piper sections at their measured start times, with the gaps cut into the
edit rather than performed: 0.55, 0.45, 0.30, 0.50, **2.20**, **1.60**, **1.00**,
0.55, 0.45, then a 2.60s tail on the closing image.

The three long ones are the whole reason this piece has room to act. 2.20s after
the errand is taken and the character keeps walking. 1.60s for the balloon and
the search. 1.00s after the kick, in which nothing happens.

Three sounds, one per physical event, all synthesised locally with numpy: a
pencil scratch gated into six bursts (0.18s), a wooden clack at 232 Hz and 617 Hz
(20.61s), a duller thud at 96 Hz and 141 Hz on the kick (30.62s). No music.

## The captions

28 chunks from `scripts/build_captions.py`, then a hand pass marking the
load-bearing word in 13 of them. Orange for the ordinary marks, red on *door*
and *didn't*, blue on *understanding* — the caption colour follows the drawing's
colour on the same beat.
