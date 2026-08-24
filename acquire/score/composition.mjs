/**
 * WILL IT WORK IN THE SHOT THAT WAS PLANNED.
 *
 * The axis the other two cannot see. A photograph can be of exactly the right
 * thing and be a good photograph and still be the wrong file, because the shot
 * it has to serve needs a side for the type, or negative space for a push, or
 * the subject standing on a floor rather than filling the frame edge to edge.
 *
 * This repo already has that rule in the engine — law 8, a subject plate does
 * not fill the frame — and the acquisition layer is where it becomes a purchase
 * decision instead of a repair job.
 *
 * The brief says where the subject should sit. This measures where it actually
 * does, and reports the gap.
 */

const clamp10 = (v) => Number(Math.max(0, Math.min(10, v)).toFixed(1));

/**
 * WHERE THE MASS IS, in thirds.
 *
 * Not object detection: the centre of gravity of the detail. A subject on the
 * left puts it left, a centred monument puts it in the middle, and a flat
 * texture puts it nowhere in particular — which is itself the answer for a
 * brief that wants a ground rather than a subject.
 */
async function weightCentre(sharp, buffer) {
  const size = 96;
  const {data} = await sharp(buffer)
    .greyscale()
    .resize(size, size, {fit: 'fill'})
    .raw()
    .toBuffer({resolveWithObject: true});
  let mx = 0;
  let my = 0;
  let total = 0;
  for (let y = 1; y < size - 1; y += 1) {
    for (let x = 1; x < size - 1; x += 1) {
      const i = y * size + x;
      const edge = Math.abs(data[i] - data[i + 1]) + Math.abs(data[i] - data[i + size]);
      mx += x * edge;
      my += y * edge;
      total += edge;
    }
  }
  if (!total) return {x: 0.5, y: 0.5, spread: 0};
  const cx = mx / total / size;
  const cy = my / total / size;
  // How concentrated it is — a low spread is a subject, a high one is a field.
  let variance = 0;
  for (let y = 1; y < size - 1; y += 1) {
    for (let x = 1; x < size - 1; x += 1) {
      const i = y * size + x;
      const edge = Math.abs(data[i] - data[i + 1]) + Math.abs(data[i] - data[i + size]);
      variance += edge * ((x / size - cx) ** 2 + (y / size - cy) ** 2);
    }
  }
  return {x: cx, y: cy, spread: Math.sqrt(variance / total)};
}

/**
 * WHAT THE BRIEF IS ASKING FOR, read out of its own composition sentence.
 *
 * The brief is prose because a human has to be able to read it. These are the
 * three things a scorer can act on: where the subject goes, how much of the
 * frame it should take, and whether the shot needs room for something else.
 */
function wants(brief) {
  const text = `${brief.preferred_composition ?? ''} ${brief.purpose ?? ''}`.toLowerCase();
  return {
    centred: /centr|middle|fills the frame|whole (object|structure)/.test(text),
    offCentre: /off-?centr|side|left|right|room for|space for|negative space/.test(text),
    needsRoomForType: /type|caption|text|negative space|room for/.test(text),
    wantsWholeObject: /whole (object|structure)|must fit|both sides|relation/.test(text),
    wantsClose: /close|macro|section|filling|60|70|80/.test(text),
  };
}

export async function scoreComposition(sharp, buffer, brief, quality) {
  const centre = await weightCentre(sharp, buffer);
  const want = wants(brief);
  const notes = [];

  /**
   * SUBJECT PLACEMENT. A shot that needs a side for type wants the mass off
   * centre; one that is about the object itself wants it centred. Both are
   * measured against the same number, in opposite directions.
   */
  const offset = Math.hypot(centre.x - 0.5, centre.y - 0.5);
  let placement = 7;
  if (want.offCentre || want.needsRoomForType) {
    placement = clamp10(4 + offset * 22);
    if (offset < 0.06) notes.push('subject dead centre in a shot that needs a side clear for type');
  } else if (want.centred) {
    placement = clamp10(10 - offset * 18);
    if (offset > 0.2) notes.push('subject well off centre in a shot composed around it');
  }

  /**
   * ROOM TO MOVE. A camera push needs picture outside the part that matters; a
   * subject already touching the frame edge has none, and the push becomes a
   * crop. `spread` standing in for how far the subject reaches.
   */
  const headroom = clamp10((0.42 - Math.min(0.42, centre.spread)) * 30 + 3);
  if (centre.spread > 0.34) notes.push('detail reaches the frame edges — a push will crop rather than reveal');

  /**
   * WHOLE-OBJECT briefs are the ones this repo has failed most often: a scale
   * shot whose object runs out of frame has lost the only thing it was for.
   * Approximated by the crop survival the quality pass already measured.
   */
  let containment = 8;
  if (want.wantsWholeObject) {
    containment = clamp10((quality?.measured?.keptInCrop ?? 0.6) * 14);
    if ((quality?.measured?.keptInCrop ?? 1) < 0.5) {
      notes.push('the brief needs the whole object and a 9:16 crop keeps less than half the frame');
    }
  }

  /** Somewhere quiet to put words, if the shot needs one. */
  let typeSpace = 8;
  if (want.needsRoomForType) {
    typeSpace = clamp10(quality?.axes?.backgroundComplexity ?? 7);
    if (typeSpace < 5) notes.push('nowhere quiet for a caption');
  }

  const axes = {placement, headroom, containment, typeSpace};
  const values = Object.values(axes);
  return {
    axes,
    measured: {
      massX: Number(centre.x.toFixed(3)),
      massY: Number(centre.y.toFixed(3)),
      spread: Number(centre.spread.toFixed(3)),
      asks: want,
    },
    score: Number((values.reduce((n, v) => n + v, 0) / values.length).toFixed(1)),
    notes,
  };
}

export const COMPOSITION_FLOOR = 4.5;

export function compositionVerdict(composition) {
  if (composition.score < COMPOSITION_FLOOR) {
    return {ok: false, why: `composition ${composition.score}/10 against the planned shot — ${composition.notes[0] ?? 'does not fit the framing the brief asks for'}`};
  }
  return {ok: true, why: null};
}
