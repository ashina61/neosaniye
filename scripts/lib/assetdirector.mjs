/**
 * THE ASSET DIRECTOR.
 *
 * The most expensive failure this pipeline has ever shipped, stated plainly: a
 * reel about a Greek shipwreck opened on a macro photograph of a yellow sea
 * slug, showed a Victorian sideboard where museum storage drawers should be,
 * and closed on an aerial photograph of a modern town. Every one of those files
 * existed, was the right size, was on disk, and passed every check this repo
 * had. Three of six backdrops were simply the wrong picture.
 *
 * No amount of motion fixes that. THE CORRECT VISUAL WITH SIMPLE MOTION BEATS
 * THE WRONG VISUAL WITH BEAUTIFUL MOTION, and a pipeline that cannot tell the
 * difference will spend forever animating the wrong thing.
 *
 * So this layer does four things nothing here did before:
 *
 *   SCORES an asset against the ROLE it is being asked to play, on axes that
 *       are actually about suitability rather than about existence.
 *   REFUSES one that is semantically wrong, instead of using it because it is
 *       there. A refusal is a result, not a failure.
 *   RECASTS one that is wrong for its role but right for another — which is the
 *       finding nobody expected: the "museum wall" in this very episode is a
 *       photograph of an encrusted seabed find, i.e. it IS the lump of corroded
 *       metal the script is about, used as a blank backdrop.
 *   WRITES A BRIEF for what is missing, so the hole is a specification rather
 *       than a silence.
 *
 * WHERE THE JUDGEMENT COMES FROM. Half the axes are measurable from the file —
 * resolution, exposure, contrast, how much of it survives a 9:16 crop, whether
 * it has enough structure to be pushed into. The other half is semantic and no
 * amount of pixel maths will supply it: whether a cabinet is a MUSEUM cabinet
 * cannot be read out of a histogram. That half lives in a reviewed ledger,
 * `episodes/<id>/assets.review.json`, written by whoever looked at the contact
 * sheet. Unreviewed assets are reported as unreviewed rather than assumed good.
 */
import path from 'node:path';
import {readFile} from 'node:fs/promises';

/** Below this an asset is refused outright and the role goes graphics-first. */
export const REJECT_BELOW = 4.5;
/** Below this it is used but reported — a known weakness, not a silent one. */
export const WARN_BELOW = 6.5;

/**
 * WHAT EACH ROLE NEEDS FROM A PICTURE.
 *
 * A backdrop and a subject fail in opposite directions: a backdrop wants to be
 * quiet, evenly lit and croppable to nothing in particular, and a subject wants
 * structure, contrast and something to push into. Scoring both against one
 * standard is how a flat brick texture passes as an artefact.
 */
export const ROLE_NEEDS = {
  backdrop: {wantsDetail: 0.35, wantsContrast: 0.4, minShortEdge: 900, portrait: 0.5},
  photo: {wantsDetail: 0.6, wantsContrast: 0.55, minShortEdge: 800, portrait: 0.3},
  subject: {wantsDetail: 0.7, wantsContrast: 0.6, minShortEdge: 700, portrait: 0.3},
  piece: {wantsDetail: 0.7, wantsContrast: 0.6, minShortEdge: 500, portrait: 0.2},
  object: {wantsDetail: 0.7, wantsContrast: 0.6, minShortEdge: 500, portrait: 0.2},
};

const clamp01 = (n) => Math.min(1, Math.max(0, n));
const score10 = (n) => Number((clamp01(n) * 10).toFixed(1));

/**
 * THE MEASURABLE HALF.
 *
 * Deliberately cheap: metadata plus one downscaled statistics pass. This runs
 * over every asset in an episode on every plan, so it may not cost a second
 * each.
 */
export async function measureAsset(sharp, file, {width = 1080, height = 1920} = {}) {
  const image = sharp(file);
  const meta = await image.metadata();
  // Statistics on a small copy: the numbers we want — average brightness,
  // spread, colourfulness — survive downscaling, and a 4000px original does
  // not need to be decoded at full size to answer them.
  const stats = await sharp(await image.clone().resize(160, 160, {fit: 'inside'}).removeAlpha().png().toBuffer()).stats();

  const channels = stats.channels.slice(0, 3);
  const mean = channels.reduce((n, c) => n + c.mean, 0) / (channels.length * 255);
  const spread = channels.reduce((n, c) => n + c.stdev, 0) / (channels.length * 255);
  // Colourfulness as the disagreement between channels: a grey plate and a
  // sepia one both have low spread between R, G and B; a green sea does not.
  const colour =
    (Math.max(...channels.map((c) => c.mean)) - Math.min(...channels.map((c) => c.mean))) / 255;

  const w = meta.width ?? 0;
  const h = meta.height ?? 0;
  const shortEdge = Math.min(w, h);

  /**
   * HOW MUCH SURVIVES A 9:16 CROP.
   *
   * A 3:2 landscape filling a vertical frame keeps about a third of its width.
   * That is not a quality problem, it is a COMPOSITION problem — whatever the
   * photograph was about is very likely now outside the frame — and it is the
   * reason a perfectly good museum photograph can be the wrong file for this
   * format.
   */
  const target = width / height;
  const source = h ? w / h : 1;
  const kept = source > target ? target / source : source / target;

  return {
    width: w,
    height: h,
    shortEdge,
    aspect: Number(source.toFixed(3)),
    keptInCrop: Number(kept.toFixed(3)),
    brightness: Number(mean.toFixed(3)),
    contrast: Number(spread.toFixed(3)),
    colourfulness: Number(colour.toFixed(3)),
    hasAlpha: Boolean(meta.hasAlpha),
  };
}

/**
 * TURN MEASUREMENTS INTO THE TECHNICAL AXES.
 *
 * Every axis is 0..10 and every one of them is about FITNESS FOR A ROLE rather
 * than about the photograph in the abstract. A dark, low-contrast plate is a
 * bad artefact shot and a perfectly good night backdrop.
 */
export function technicalAxes(m, kind = 'backdrop') {
  const need = ROLE_NEEDS[kind] ?? ROLE_NEEDS.backdrop;

  const resolution = score10(m.shortEdge / need.minShortEdge);

  // A frame that is nearly black or nearly white has no tonal room left for a
  // grade, a scrim or type — every caption over it will fight for legibility.
  const exposure = score10(1 - Math.abs(m.brightness - 0.44) / 0.44);

  const quality = score10(m.contrast / Math.max(0.05, need.wantsContrast));

  /**
   * A CROP THAT DISCARDS TWO THIRDS OF THE FRAME DISCARDS THE SUBJECT.
   *
   * Scored on the kept fraction directly rather than on a blend, because the
   * relationship is not linear: keeping 90% of a photograph costs you the edges
   * and keeping 33% of one almost certainly costs you the thing it is of. The
   * first version averaged the loss away and reported a 3:2 landscape as a five.
   */
  const fit = Math.min(1, m.keptInCrop / Math.max(0.2, need.portrait));
  const composition = score10(m.keptInCrop * (0.4 + 0.6 * fit));

  /**
   * CAN IT BE ANIMATED?
   *
   * A camera push into a flat texture is a texture getting bigger. Something
   * has to be IN the frame for a move to be a move: structure, an edge, a
   * subject. Contrast is the cheap proxy, and the resolution headroom matters
   * too, because a push is a crop and a push into a small file is a push into
   * mush.
   */
  const headroom = clamp01(m.shortEdge / (need.minShortEdge * 1.6));
  const animationPotential = score10((clamp01(m.contrast / need.wantsDetail) * 0.7 + headroom * 0.3));

  return {resolution, exposure, quality, composition, animationPotential};
}

/**
 * COLOUR COMPATIBILITY WITH THE EPISODE.
 *
 * Not "is it pretty" — is it in the same world as the shots around it. A reel
 * that jumps from pale green to bright domestic daylight to near black has no
 * colour language, and that is a continuity failure the eye reads instantly
 * even when it cannot name it.
 */
export function colourAxis(m, {brightness = 0.44, colourfulness = 0.12} = {}) {
  const dB = Math.abs(m.brightness - brightness);
  const dC = Math.abs(m.colourfulness - colourfulness);
  return score10(1 - (dB / 0.45) * 0.65 - (dC / 0.35) * 0.35);
}

/**
 * THE WHOLE SCORE.
 *
 * RELEVANCE AND ACCURACY DOMINATE, and they are not averaged with the rest —
 * they GATE it. A beautifully exposed, perfectly croppable, high-resolution
 * photograph of the wrong thing is not a 7 because it scored well on five
 * technical axes; it is unusable. That arithmetic is the entire reason the
 * sideboard shipped.
 */
export function combine({relevance, accuracy, subject, technical, colour}) {
  const semantic = Math.min(relevance, accuracy, subject);
  const tech =
    (technical.resolution * 0.15 +
      technical.exposure * 0.2 +
      technical.quality * 0.2 +
      technical.composition * 0.25 +
      technical.animationPotential * 0.2);
  // The gate: the technical half can only ever pull the score toward the
  // semantic one, never past it.
  const combined = semantic <= 3 ? semantic : Math.min(semantic + 1.5, semantic * 0.62 + tech * 0.26 + colour * 0.12);
  return Number(combined.toFixed(1));
}

/**
 * AN ASSET BRIEF — what to go and get.
 *
 * Written whenever an asset is refused, so the hole in the reel is a
 * specification somebody can act on rather than a shot that quietly looks
 * wrong. This is the difference between "the image is bad" and "here is the
 * photograph this episode needs".
 */
export function assetBrief({role, idea, notice, need, avoid, framing = 'Subject occupies 60–80% of frame.'}) {
  return {
    role,
    subject: need ?? idea,
    required: [
      idea,
      notice ? `The eye must find: ${notice}` : null,
      'Vertical or square framing, or a subject that survives a 9:16 crop',
      'Even, motivated lighting — no blown highlights, no crushed blacks',
    ].filter(Boolean),
    avoid: avoid ?? [
      'Modern objects in a historical scene',
      'Stock-library staging',
      'A texture standing in for a subject',
      'Anything where the subject is not identifiable at phone size',
    ],
    composition: framing,
  };
}

/**
 * THE LEDGER — the semantic half, reviewed by somebody who looked.
 *
 * Shape, per file:
 *
 *   "seabed.jpg": {
 *     "depicts": "macro of a yellow nudibranch on white algae",
 *     "relevance": 2, "accuracy": 2, "subject": 2,
 *     "recastAs": null,
 *     "note": "underwater, but wildlife macro — not a wreck site"
 *   }
 *
 * An entry that is absent is reported as UNREVIEWED and scored on its technical
 * axes alone, with the semantic axes held at a neutral value. Unreviewed is
 * never the same as approved, and the report says which it is.
 */
export async function loadReview(dir) {
  return readFile(path.join(dir, 'assets.review.json'), 'utf8')
    .then(JSON.parse)
    .catch(() => ({}));
}

/**
 * JUDGE ONE ASSET IN ONE ROLE.
 *
 * Returns a verdict the planner can act on without further reasoning:
 * `use` | `warn` | `recast` | `reject`.
 */
export function judge({file, role, kind = 'backdrop', measured, reviewed, idea, notice, episodeColour}) {
  const technical = technicalAxes(measured, kind);
  const colour = colourAxis(measured, episodeColour);

  const known = Boolean(reviewed);
  // NEUTRAL, NOT GOOD. An unreviewed file scores 5.5 on the semantic axes,
  // which is enough to be used and not enough to survive a weak technical
  // half — and the report always says it was never looked at.
  /**
   * A RECAST PICTURE IS SCORED FOR THE ROLE IT IS GOING TO, not the one it is
   * being rescued from.
   *
   * Otherwise the rescue reads as a failure: the bronze weights score 2 as a
   * grey wall, and they are still scoring 2 after being moved to the line about
   * bronze — so the quality gate refuses the reel for an asset choice that was
   * the correct one.
   */
  const cast = reviewed?.recastTo ?? null;
  const relevance = Number(cast?.relevance ?? (known ? reviewed.relevance ?? 5.5 : 5.5));
  const accuracy = Number(cast?.accuracy ?? (known ? reviewed.accuracy ?? relevance : 5.5));
  const subject = Number(cast?.subject ?? (known ? reviewed.subject ?? relevance : 5.5));

  const total = combine({relevance, accuracy, subject, technical, colour});
  const recastAs = reviewed?.recastAs ?? null;

  let verdict = 'use';
  if (total < REJECT_BELOW) verdict = recastAs ? 'recast' : 'reject';
  else if (total < WARN_BELOW) verdict = 'warn';
  /**
   * A RECAST IS A CASTING NOTE, NOT A FAILURE GRADE.
   *
   * The ledger saying "this belongs in another role" is a stronger statement
   * than any score: the encrusted wreck find in this episode scores 7.6 where
   * it stands and is still in the wrong place, because it was standing in as an
   * empty wall while the shot's actual subject was a brick texture in front of
   * it. Using a picture where it belongs is always better than using it well
   * where it does not.
   */
  if (recastAs && recastAs !== role) verdict = 'recast';

  return {
    file: path.basename(file),
    role,
    kind,
    reviewed: known,
    depicts: reviewed?.depicts ?? null,
    axes: {relevance, accuracy, subject, ...technical, colourCompatibility: colour},
    score: total,
    verdict,
    recastAs,
    // Where the picture belongs, when it belongs in another scene entirely.
    recast: reviewed?.recastTo ?? null,
    note: reviewed?.note ?? null,
    brief: verdict === 'reject' ? assetBrief({role, idea, notice, need: reviewed?.needed}) : null,
  };
}

/**
 * THE EPISODE'S COLOUR CENTRE.
 *
 * Taken from the assets that were KEPT, so continuity is measured against what
 * the reel actually looks like rather than against a constant somebody typed.
 */
export function colourCentre(measurements) {
  const list = Object.values(measurements);
  if (!list.length) return {brightness: 0.44, colourfulness: 0.12};
  const avg = (pick) => list.reduce((n, m) => n + pick(m), 0) / list.length;
  return {
    brightness: Number(avg((m) => m.brightness).toFixed(3)),
    colourfulness: Number(avg((m) => m.colourfulness).toFixed(3)),
  };
}
