/**
 * PREPARING A SUPPLIED FILE FOR THE FRAME IT HAS TO LIVE IN.
 *
 * THE ORIGINAL IS NEVER TOUCHED. Everything here reads `assets/original/` and
 * writes `assets/processed/`, so a bad crop costs a rerun and not a file — and
 * so the provenance chain stays intact, because the thing the licence describes
 * is the original and not our version of it.
 *
 * The work is deliberately conservative. This layer is not a retoucher: it
 * squares up orientation, crops to the shot's frame around the subject the
 * brief points at, sizes for the push the camera will make, and leaves the
 * grade to `FilmLook`, which grades the whole reel once at the end. A picture
 * pre-graded here would be graded twice.
 */
import {mkdir} from 'node:fs/promises';
import path from 'node:path';
import {PROCESSED_DIR} from './casting.mjs';

/**
 * WHAT THE FRAME NEEDS, given what the shot will do to it.
 *
 * The push is the reason the output is bigger than the frame: at 1.5x the
 * viewer sees two thirds of the supplied picture at full size, so supplying
 * exactly 1080x1920 delivers a soft ending to every push in the reel.
 */
function targetFor(shot, frame) {
  const push = Math.max(1, shot?.camera?.maxPush ?? 1);
  return {
    width: Math.round(frame.width * push),
    height: Math.round(frame.height * push),
    push,
  };
}

/**
 * WHERE TO CROP FROM.
 *
 * `focus` is the subject's centre as a fraction of the source, supplied by a
 * human or measured. The crop is the largest 9:16 rectangle that fits inside
 * the source and contains that point, nudged so it does not run off an edge —
 * which is the whole of "smart crop" and behaves predictably, unlike anything
 * that tries to guess what the subject is.
 */
function cropBox({width, height}, aspect, focus) {
  const source = width / height;
  let cw = width;
  let ch = height;
  if (source > aspect) cw = Math.round(height * aspect);
  else ch = Math.round(width / aspect);

  const fx = Math.min(1, Math.max(0, focus?.x ?? 0.5));
  const fy = Math.min(1, Math.max(0, focus?.y ?? 0.5));
  const left = Math.round(Math.min(Math.max(0, width * fx - cw / 2), width - cw));
  const top = Math.round(Math.min(Math.max(0, height * fy - ch / 2), height - ch));
  return {left, top, width: cw, height: ch};
}

/**
 * Normalise one file for one brief.
 *
 * `options` is what a human may ask for and the machine will not decide alone:
 * where the subject is, whether the background should be removed, and whether
 * the result needs an alpha channel.
 */
export async function normalise(sharp, {buffer, brief, hash, options = {}}) {
  await mkdir(PROCESSED_DIR, {recursive: true});
  const shot = brief.shotRequirements;
  const frame = shot?.frame ?? {width: 1080, height: 1920};
  const target = targetFor(shot, frame);

  // Orientation first: a file whose EXIF says "rotate 90" is a file whose
  // width and height are a lie until this runs.
  let image = sharp(buffer).rotate();
  const meta = await image.metadata();

  const steps = [];
  const aspect = frame.width / frame.height;

  /**
   * SAFE MARGINS.
   *
   * The crop is taken slightly wider than the frame when the shot pans, so the
   * pan has somewhere to go. Asked for by the shot, not by preference.
   */
  const panPx = Math.max(...(shot?.camera?.panRange ?? [0]).map((v) => Math.abs(v)), 0);
  const margin = panPx > 0 ? Math.round(panPx * 1.2) : 0;

  const box = cropBox({width: meta.width ?? 0, height: meta.height ?? 0}, aspect, options.focus);
  if (box.width && box.height && (box.width !== meta.width || box.height !== meta.height)) {
    image = image.extract(box);
    steps.push(`cropped to 9:16 at ${box.left},${box.top} ${box.width}x${box.height}`);
  }

  image = image.resize(target.width + margin * 2, target.height, {fit: 'cover', position: 'centre'});
  steps.push(`resized to ${target.width + margin * 2}x${target.height} for a ${target.push.toFixed(2)}x push`);
  if (margin) steps.push(`${margin}px of side margin kept for a ${panPx}px pan`);

  /**
   * BACKGROUND REMOVAL IS ASKED FOR, NEVER ASSUMED.
   *
   * This repo's most expensive supply lesson: a clean cut-out needs a clean
   * source, and keying a photograph of an object in a room returns a rectangle.
   * So there is no automatic keying here. When a human asks for alpha they are
   * saying the source supports it, and all this does is carry the channel
   * through and record that they asked.
   */
  let format = 'jpg';
  if (options.alpha || options.removeBackground) {
    image = image.ensureAlpha();
    format = 'png';
    steps.push(
      options.removeBackground
        ? 'alpha kept for a supplied cut-out — no automatic keying was applied, because keying a photograph of an object in a room returns a rectangle'
        : 'alpha channel preserved',
    );
  }

  const out = path.join(PROCESSED_DIR, `${hash}-${brief.id.replace(/\//g, '_')}.${format}`);
  const written = format === 'png' ? await image.png().toBuffer() : await image.jpeg({quality: 92}).toBuffer();
  const {writeFile} = await import('node:fs/promises');
  await writeFile(out, written);

  return {
    processed: out,
    format,
    width: target.width + margin * 2,
    height: target.height,
    steps,
    /** The original is untouched, and this says so in the record. */
    originalUntouched: true,
  };
}
