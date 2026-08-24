/**
 * THE COMPOSITION PREVIEW — the check that catches what scores cannot.
 *
 * An image can pass every gate in this pipeline and still be unusable, because
 * every gate asks a question about the IMAGE and none of them asks the question
 * a person asks in half a second: *will this work in that shot?*
 *
 * So the preview puts the four things the shot imposes on top of the picture:
 *
 *   THE FRAME          what the 9:16 crop actually keeps
 *   THE CAPTION BAND   where the words will be, in red, because the words win
 *   THE SUBJECT BOX    where the subject must sit to survive the push
 *   THE CAMERA BOUNDS  what is left at the end of the push
 *
 * This repository has shipped every one of these as a defect — a subject behind
 * a caption, a monument cropped out by a push, a plate with nothing outside the
 * frame to push into — and every one was obvious in a single annotated still.
 */
import {mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {PREVIEW_DIR} from './casting.mjs';

const ACCENT = '#d94f3d';
const SUBJECT = '#4fd98a';
const CAMERA = '#f2b53a';
const MUTED = '#cfc6ae';

/**
 * The overlay, as SVG composited over the picture rather than drawn into it.
 * The preview is a diagnostic, and a diagnostic that alters the thing it is
 * diagnosing is a bad diagnostic.
 */
function overlay({width, height, shot, label}) {
  const box = shot?.subjectBox;
  const caption = shot?.captionBand;
  const push = Math.max(1, shot?.camera?.maxPush ?? 1);
  const ax = shot?.camera?.anchorX ?? width / 2;
  const ay = shot?.camera?.anchorY ?? height * 0.55;

  /** What is still on screen when the push has finished. */
  const camLeft = ax + (0 - ax) / push;
  const camRight = ax + (width - ax) / push;
  const camTop = ay + (0 - ay) / push;
  const camBottom = ay + (height - ay) / push;

  const t = Math.max(2, width * 0.0035);
  const font = Math.max(14, width * 0.019);

  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <rect x="0" y="0" width="${width}" height="${height}" fill="none" stroke="${MUTED}" stroke-width="${t}" opacity="0.85"/>

  ${caption ? `<rect x="0" y="${caption.top}" width="${width}" height="${caption.bottom - caption.top}"
      fill="${ACCENT}" opacity="0.22"/>
  <rect x="0" y="${caption.top}" width="${width}" height="${caption.bottom - caption.top}"
      fill="none" stroke="${ACCENT}" stroke-width="${t}" stroke-dasharray="${t * 5} ${t * 3}"/>
  <text x="${width * 0.03}" y="${caption.top + font * 1.5}" font-family="monospace" font-size="${font}"
      fill="${ACCENT}" letter-spacing="2">CAPTION — KEEP THE SUBJECT OUT</text>` : ''}

  ${box ? `<rect x="${box.left}" y="${box.top}" width="${box.right - box.left}" height="${box.bottom - box.top}"
      fill="none" stroke="${SUBJECT}" stroke-width="${t}"/>
  <text x="${box.left + font * 0.4}" y="${box.top - font * 0.5}" font-family="monospace" font-size="${font}"
      fill="${SUBJECT}" letter-spacing="2">SUBJECT BOX</text>` : ''}

  <rect x="${camLeft}" y="${camTop}" width="${camRight - camLeft}" height="${camBottom - camTop}"
      fill="none" stroke="${CAMERA}" stroke-width="${t}" stroke-dasharray="${t * 2} ${t * 2}"/>
  <text x="${camLeft + font * 0.4}" y="${camBottom - font * 0.5}" font-family="monospace" font-size="${font}"
      fill="${CAMERA}" letter-spacing="2">END OF PUSH ${push.toFixed(2)}x — ANYTHING OUTSIDE IS GONE</text>

  <rect x="0" y="0" width="${width}" height="${font * 2.4}" fill="#0b0906" opacity="0.82"/>
  <text x="${width * 0.03}" y="${font * 1.6}" font-family="monospace" font-size="${font}"
      fill="${MUTED}" letter-spacing="2">${label}</text>
</svg>`);
}

/**
 * Render the preview for one supplied file against one brief.
 *
 * The picture is fitted the way the reel will fit it — cover, centred — so what
 * the preview shows is what the shot gets, not what the file looks like.
 */
export async function compositionPreview(sharp, {buffer, brief, hash}) {
  await mkdir(PREVIEW_DIR, {recursive: true});
  const shot = brief.shotRequirements;
  const frame = shot?.frame ?? {width: 1080, height: 1920};

  const fitted = await sharp(buffer)
    .rotate()
    .resize(frame.width, frame.height, {fit: 'cover', position: 'centre'})
    .toBuffer();

  const label = `${brief.id}  ·  ${brief.subject}  ·  ${(shot?.shots ?? []).join(' ')}`;
  const composed = await sharp(fitted)
    .composite([{input: overlay({width: frame.width, height: frame.height, shot, label}), top: 0, left: 0}])
    .png()
    .toBuffer();

  const out = path.join(PREVIEW_DIR, `${hash}-${brief.id.replace(/\//g, '_')}.png`);
  await writeFile(out, composed);
  return {preview: out, width: frame.width, height: frame.height};
}

/**
 * A preview for a brief with NO file yet — the empty plate.
 *
 * Worth generating, because it is the thing you hand somebody who is going out
 * to shoot: here is the frame, here is where the words go, here is where the
 * subject has to be. It answers the question before the picture exists.
 */
export async function briefPlate(sharp, brief) {
  await mkdir(PREVIEW_DIR, {recursive: true});
  const shot = brief.shotRequirements;
  const frame = shot?.frame ?? {width: 1080, height: 1920};
  const ground = await sharp({
    create: {width: frame.width, height: frame.height, channels: 3, background: {r: 22, g: 19, b: 15}},
  })
    .png()
    .toBuffer();
  const label = `NEEDED — ${brief.id}  ·  ${brief.subject}`;
  const composed = await sharp(ground)
    .composite([{input: overlay({width: frame.width, height: frame.height, shot, label}), top: 0, left: 0}])
    .png()
    .toBuffer();
  const out = path.join(PREVIEW_DIR, `NEEDED-${brief.id.replace(/\//g, '_')}.png`);
  await writeFile(out, composed);
  return {plate: out};
}
