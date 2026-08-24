/**
 * IS IT A GOOD ENOUGH PICTURE — measured from the file, never from its page.
 *
 * The semantic gate decides whether this is the right thing. This decides
 * whether it is a usable photograph of it, and it exists because the two fail
 * independently: an archive's only picture of the right object is often a
 * 400-pixel scan of a 1954 catalogue, and the correct answer to that is not to
 * ship it because the subject matched.
 *
 * Everything here comes from decoding the image. A provider's claimed width is
 * a claim; a soft image is soft whatever the metadata says; and "high
 * resolution" on a stock site means the file is large, not that anything in it
 * is sharp.
 */

const TARGET_W = 1080;
const TARGET_H = 1920;

/**
 * BLUR, as the energy left after a Laplacian.
 *
 * The standard measure, and the reason it is worth the extra decode: a
 * downscaled thumbnail of a sharp photograph and of a soft one have the same
 * histogram, the same contrast and the same size. They do not have the same
 * edges.
 */
async function sharpness(sharp, buffer) {
  const {data, info} = await sharp(buffer)
    .greyscale()
    .resize(320, 320, {fit: 'inside'})
    .raw()
    .toBuffer({resolveWithObject: true});
  const {width, height} = info;
  let sum = 0;
  let sumSq = 0;
  let n = 0;
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const i = y * width + x;
      const lap =
        4 * data[i] - data[i - 1] - data[i + 1] - data[i - width] - data[i + width];
      sum += lap;
      sumSq += lap * lap;
      n += 1;
    }
  }
  if (!n) return 0;
  const variance = sumSq / n - (sum / n) ** 2;
  return variance;
}

/**
 * WHERE THE DETAIL IS.
 *
 * Two numbers from one pass: how much edge energy sits in the middle of the
 * frame versus the outer band. A photograph whose detail is all at the edges is
 * a photograph of a room with the subject somewhere in it; one whose detail is
 * central has a subject. It also tells you whether the background will fight a
 * caption, which is the difference between a plate you can put type on and one
 * you cannot.
 */
async function detailMap(sharp, buffer) {
  const size = 96;
  const {data} = await sharp(buffer)
    .greyscale()
    .resize(size, size, {fit: 'fill'})
    .raw()
    .toBuffer({resolveWithObject: true});
  let centre = 0;
  let outer = 0;
  let centreN = 0;
  let outerN = 0;
  /**
   * CLIPPING, counted in the same pass.
   *
   * Exposure was first measured as a distance from mid-grey, and that is wrong
   * for the entire register this repository shoots in: a moon against a night
   * sky, a bronze fragment on a dark museum ground and a black-background
   * specimen plate are all correctly exposed and all a long way from 0.46. The
   * metric rejected every one of them.
   *
   * What actually makes a photograph unusable is DETAIL THAT IS NOT THERE —
   * pixels pinned at the top or bottom of the range, where no grade can
   * recover them. A dark picture is a choice; a blown one is a loss.
   */
  let blown = 0;
  let crushed = 0;
  for (let i = 0; i < data.length; i += 1) {
    if (data[i] > 250) blown += 1;
    else if (data[i] < 5) crushed += 1;
  }
  for (let y = 1; y < size - 1; y += 1) {
    for (let x = 1; x < size - 1; x += 1) {
      const i = y * size + x;
      const edge = Math.abs(data[i] - data[i + 1]) + Math.abs(data[i] - data[i + size]);
      // The middle half by both axes: the region a subject occupies and a
      // 9:16 crop is most likely to keep.
      const inMiddle = x > size * 0.25 && x < size * 0.75 && y > size * 0.25 && y < size * 0.75;
      if (inMiddle) {
        centre += edge;
        centreN += 1;
      } else {
        outer += edge;
        outerN += 1;
      }
    }
  }
  return {
    centre: centreN ? centre / centreN / 255 : 0,
    outer: outerN ? outer / outerN / 255 : 0,
    blown: blown / data.length,
    crushed: crushed / data.length,
  };
}

const clamp10 = (v) => Number(Math.max(0, Math.min(10, v)).toFixed(1));

export async function scoreQuality(sharp, buffer, brief) {
  const image = sharp(buffer);
  const meta = await image.metadata();
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;
  const notes = [];

  const stats = await sharp(await image.clone().resize(160, 160, {fit: 'inside'}).removeAlpha().png().toBuffer()).stats();
  const channels = stats.channels.slice(0, 3);
  const brightness = channels.reduce((n, c) => n + c.mean, 0) / (channels.length * 255);
  const contrast = channels.reduce((n, c) => n + c.stdev, 0) / (channels.length * 255);

  const blurVariance = await sharpness(sharp, buffer);
  const detail = await detailMap(sharp, buffer);

  /**
   * RESOLUTION AGAINST THE FRAME IT HAS TO FILL, not against a megapixel count.
   * A 1200x800 photograph is small for a 1080x1920 reel and enormous for a
   * thumbnail, and only one of those is the question being asked.
   */
  const shortEdge = Math.min(w, h);
  const resolution = clamp10((shortEdge / TARGET_W) * 8);
  if (shortEdge < TARGET_W * 0.6) notes.push(`short edge ${shortEdge}px against a ${TARGET_W}px frame — it will be upscaled`);

  /**
   * Blur variance is unbounded and its useful range is narrow; 60 is roughly
   * where a photograph stops looking soft at full size.
   */
  const focus = clamp10(Math.log10(Math.max(1, blurVariance)) * 3.6);
  if (focus < 5) notes.push(`soft: Laplacian variance ${blurVariance.toFixed(0)}`);

  /**
   * EXPOSURE IS ABOUT LOST DETAIL, NOT ABOUT BEING DARK.
   *
   * Highlight clipping is punished about four times as hard as shadow
   * clipping, because it is four times as visible in this register: a dark reel
   * absorbs a black frame edge and cannot absorb a white one, and the defect
   * this measure was written for was a plate that brought its own white studio
   * sweep into a black-and-amber film.
   */
  const exposure = clamp10(10 - detail.blown * 62 - Math.max(0, detail.crushed - 0.45) * 16);
  if (detail.blown > 0.06) notes.push(`blown out: ${Math.round(detail.blown * 100)}% of the frame is at clipping`);
  if (detail.crushed > 0.6) notes.push(`crushed: ${Math.round(detail.crushed * 100)}% of the frame is pure black`);

  const contrastScore = clamp10(contrast * 34);
  if (contrast < 0.09) notes.push('flat: almost no tonal separation');

  /**
   * SUBJECT VISIBILITY as the ratio of central detail to edge detail. A
   * subject-led photograph is above 1; a room with something in it is below.
   */
  const subjectRatio = detail.outer > 0.001 ? detail.centre / detail.outer : 2;
  const subjectVisibility = clamp10(Math.min(2.2, subjectRatio) * 4.6);
  if (subjectRatio < 0.75) notes.push('detail sits at the edges rather than in the middle — no single subject');

  /** Background complexity, which is what a caption has to survive. */
  const backgroundComplexity = clamp10(10 - detail.outer * 40);
  if (detail.outer > 0.16) notes.push('busy background — type over this will need a scrim');

  /** How much of the picture survives the crop to 9:16. */
  const source = h ? w / h : 1;
  const target = TARGET_W / TARGET_H;
  const kept = source > target ? target / source : source / target;
  const cropPotential = clamp10(kept * 13);
  if (kept < 0.45) notes.push(`only ${Math.round(kept * 100)}% survives a 9:16 crop`);

  /** Whether the shape is the shape the brief asked for. */
  const wants = String(brief.preferred_orientation ?? '').toLowerCase();
  const isPortrait = h > w;
  let orientationFit = 7;
  if (/vertical|portrait/.test(wants)) orientationFit = isPortrait ? 10 : 5;
  else if (/landscape/.test(wants)) orientationFit = isPortrait ? 6 : 10;
  if (/either/.test(wants)) orientationFit = 9;

  const axes = {
    resolution,
    focus,
    exposure,
    contrast: contrastScore,
    subjectVisibility,
    backgroundComplexity,
    cropPotential,
    orientationFit: clamp10(orientationFit),
  };

  /**
   * The mean, and separately the WORST — because a single unusable axis is not
   * something the other seven can average away. A 300px scan is not rescued by
   * being well exposed.
   */
  const values = Object.values(axes);
  return {
    axes,
    measured: {
      width: w,
      height: h,
      shortEdge,
      aspect: Number(source.toFixed(3)),
      keptInCrop: Number(kept.toFixed(3)),
      brightness: Number(brightness.toFixed(3)),
      contrast: Number(contrast.toFixed(3)),
      blurVariance: Number(blurVariance.toFixed(1)),
      centreDetail: Number(detail.centre.toFixed(4)),
      outerDetail: Number(detail.outer.toFixed(4)),
      blownFraction: Number(detail.blown.toFixed(4)),
      crushedFraction: Number(detail.crushed.toFixed(4)),
    },
    score: Number((values.reduce((n, v) => n + v, 0) / values.length).toFixed(1)),
    worst: Number(Math.min(...values).toFixed(1)),
    notes,
  };
}

/** The floor. Set low on purpose: this axis advises, the semantic one rejects. */
export const QUALITY_FLOOR = 5;
export const QUALITY_WORST_FLOOR = 2.5;

export function qualityVerdict(quality) {
  if (quality.worst < QUALITY_WORST_FLOOR) {
    const [axis] = Object.entries(quality.axes).sort((a, b) => a[1] - b[1])[0];
    return {ok: false, why: `${axis} scored ${quality.worst}/10 — one unusable axis is not something the others average away`};
  }
  if (quality.score < QUALITY_FLOOR) {
    return {ok: false, why: `overall picture quality ${quality.score}/10 is below the floor of ${QUALITY_FLOOR}`};
  }
  return {ok: true, why: null};
}
