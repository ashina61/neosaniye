/**
 * WHAT THE SHOT NEEDS FROM THE PICTURE.
 *
 * A brief written from the sentence alone says what the image must be OF. This
 * says what it must be SHAPED like, and the difference is the one that gets
 * discovered at render time when it is too late: an image can be a perfect
 * photograph of the Baalbek trilithon and still be unusable because the shot it
 * has to serve pushes to 1.52 and puts a three-line caption across the bottom
 * third.
 *
 * Everything here is READ from `scene-config.json` and nothing is written back.
 * The scene is the director's; this layer only has to satisfy it.
 *
 * A line is usually served by SEVERAL shots — `blocks` is three of them — and a
 * supplied picture has to work in all of them. So every figure is the worst
 * case across the set: the largest push, the union of the caption bands, the
 * widest pan. A picture sized for the average shot fails in the hardest one.
 */
import {readFile} from 'node:fs/promises';
import path from 'node:path';

const FRAME = {width: 1080, height: 1920};

/** The slug a scene id belongs to: `s04-nolift-c` → `nolift`. */
export function slugOf(sceneId) {
  return String(sceneId).replace(/^s\d+-/, '').replace(/-[a-z]$/, '');
}

/**
 * THE CAPTION BAND, in frame coordinates.
 *
 * Where the words are is where the subject cannot be. Derived from the same
 * numbers the type layer uses, and widened by a line's worth of leading because
 * a caption that clears the subject by two pixels is a caption touching it.
 */
function captionBand(params, height) {
  const lines = Array.isArray(params.caption) ? params.caption.length : 0;
  if (!lines) return null;
  const size = Number(params.captionSize) || 80;
  const top = Number(params.captionY) || 0;
  const block = lines * size * 1.3;
  return {
    top: Math.max(0, top - size * 0.4),
    bottom: Math.min(height, top + block + size * 0.4),
  };
}

/**
 * HOW MUCH THE CAMERA EATS.
 *
 * A push of 1.5 about a point means the picture the viewer ends on is two
 * thirds of the one that was supplied — so a subject that must stay in frame
 * has to sit inside the region that survives the largest push, and a supplied
 * photograph needs enough resolution that the pushed-in crop is still sharp.
 */
function cameraOf(params) {
  const from = Number(params.pushFrom) || 1;
  const to = Number(params.pushTo) || 1;
  return {
    pushFrom: from,
    pushTo: to,
    maxPush: Math.max(from, to),
    panX: Number(params.panX) || 0,
    panY: Number(params.panY) || 0,
    anchorX: Number(params.anchorX) || FRAME.width * 0.5,
    anchorY: Number(params.anchorY) || FRAME.height * 0.55,
  };
}

/**
 * THE REGION A SUBJECT MAY OCCUPY.
 *
 * What survives the worst-case push about the shot's own anchor, minus the
 * platform's safe margins, minus the caption band. This is the box the
 * composition preview draws and the box a supplied picture is judged against.
 */
function subjectBox({camera, caption, width, height}) {
  // The push is about the anchor, so the surviving region is the frame mapped
  // back through it.
  const s = Math.max(1, camera.maxPush);
  const left = camera.anchorX + (0 - camera.anchorX) / s;
  const right = camera.anchorX + (width - camera.anchorX) / s;
  const top = camera.anchorY + (0 - camera.anchorY) / s;
  const bottom = camera.anchorY + (height - camera.anchorY) / s;

  /** Platform furniture: the bottom eighth and a strip at the top. */
  const safeTop = height * 0.04;
  const safeBottom = height * 0.9;

  let boxTop = Math.max(top, safeTop);
  let boxBottom = Math.min(bottom, safeBottom);
  // The caption wins. If it sits low, the subject moves up; if high, down.
  if (caption) {
    const captionHeight = caption.bottom - caption.top;
    const roomAbove = caption.top - boxTop;
    const roomBelow = boxBottom - caption.bottom;
    if (roomAbove >= roomBelow && roomAbove > captionHeight * 0.5) boxBottom = Math.min(boxBottom, caption.top);
    else if (roomBelow > 0) boxTop = Math.max(boxTop, caption.bottom);
  }
  return {
    left: Math.round(Math.max(left, width * 0.03)),
    right: Math.round(Math.min(right, width * 0.97)),
    top: Math.round(boxTop),
    bottom: Math.round(boxBottom),
  };
}

/**
 * Every shot one line is carried by, reduced to one set of requirements.
 */
export function requirementsFor(scenes, {width = FRAME.width, height = FRAME.height} = {}) {
  if (!scenes.length) return null;

  const cameras = scenes.map((s) => cameraOf(s.params ?? {}));
  const bands = scenes.map((s) => captionBand(s.params ?? {}, height)).filter(Boolean);

  /** The union of every caption band: type may appear anywhere any shot puts it. */
  const caption = bands.length
    ? {top: Math.min(...bands.map((b) => b.top)), bottom: Math.max(...bands.map((b) => b.bottom))}
    : null;

  const maxPush = Math.max(...cameras.map((c) => c.maxPush));
  const worst = cameras.find((c) => c.maxPush === maxPush) ?? cameras[0];
  const box = subjectBox({camera: worst, caption, width, height});

  /**
   * THE RESOLUTION THE PUSH DEMANDS.
   *
   * At the end of a 1.5x push the viewer is seeing two thirds of the supplied
   * frame at full size, so the file has to be 1.5x the frame to stay sharp.
   * Rounded up to something a person can shop for.
   */
  const needShort = Math.ceil((width * maxPush) / 100) * 100;

  return {
    shots: scenes.map((s) => s.id),
    sceneTypes: [...new Set(scenes.map((s) => s.sceneType))],
    frame: {width, height, aspect: '9:16'},
    camera: {
      maxPush: Number(maxPush.toFixed(2)),
      moves: [...new Set(scenes.map((s) => s.params?.cameraMove).filter(Boolean))],
      panRange: [Math.min(...cameras.map((c) => c.panX)), Math.max(...cameras.map((c) => c.panX))],
    },
    captionBand: caption ? {top: Math.round(caption.top), bottom: Math.round(caption.bottom)} : null,
    subjectBox: box,
    /** What a person actually needs to be told, in one sentence each. */
    demands: [
      `at least ${needShort}px on the short edge — the camera pushes to ${maxPush.toFixed(2)}x and a soft push is a wasted shot`,
      caption
        ? `keep the subject clear of y=${Math.round(caption.top)}–${Math.round(caption.bottom)}: that band carries the caption in at least one of these shots`
        : 'no caption band in these shots — the whole frame is available',
      `the subject should sit inside x ${box.left}–${box.right}, y ${box.top}–${box.bottom} after the push`,
      maxPush > 1.3
        ? `this shot pushes hard (${maxPush.toFixed(2)}x), so leave room around the subject — a subject touching the frame edge has nowhere to be revealed from`
        : 'the camera barely moves, so the supplied framing is close to the delivered framing',
    ],
  };
}

/** Load a config without touching it. */
export async function scenesFor(episodeDir, slug) {
  const file = path.join(episodeDir, 'scene-config.json');
  const config = JSON.parse(await readFile(file, 'utf8'));
  return {
    config,
    scenes: (config.scenes ?? []).filter((s) => slugOf(s.id) === slug),
  };
}
