/**
 * THE REEL-LEVEL EDITOR.
 *
 * Everything before this judges a SHOT. An editor judges the thing the shots
 * add up to, and the two verdicts are not the same: ten shots that each pass
 * can still be a slideshow, because "slideshow" is not a property any one of
 * them has. It is a property of the sequence — same representation, same
 * framing, same camera, same length, ten times.
 *
 * The failure this exists for is the reel that scored well everywhere and was
 * still described, correctly, as boring. Every shot had a photograph, a slow
 * push and a caption; the checks confirmed each shot had a photograph, a slow
 * push and a caption. Nothing was looking at the tenth one and asking whether
 * anybody could tell it from the first.
 *
 * Three measurements, each with a failure mode at both ends:
 *
 *   RHYTHM — do the shots vary in length? All-equal is a metronome; wildly
 *   uneven is a reel that has lost its footing.
 *   MOTION DENSITY — is something happening, and not everything at once?
 *   INFORMATION DENSITY — can the words be read in the time they are up?
 */
import {cameraFamily, eventsOf} from './critique.mjs';

const FPS_DEFAULT = 30;

/**
 * WHAT A SHOT IS, coarsely enough that two of them can be compared.
 *
 * Not what it contains — what KIND of thing it is. Two different photographs
 * shown the same way at the same size for the same length of time are the same
 * shot as far as a viewer is concerned, and that is the comparison the editor
 * has to be able to make.
 */
export function signatureOf(scene, {fps = FPS_DEFAULT} = {}) {
  const p = scene.params ?? {};
  const photo = Object.keys(scene.assets ?? {}).length > 0;
  const seconds = (scene.durationInFrames ?? 0) / fps;
  return {
    representation: scene.diagram ? (photo ? 'HYBRID' : 'PROCEDURAL') : photo ? 'PHOTO' : 'TYPOGRAPHY',
    template: scene.sceneType,
    camera: cameraFamily(scene) ?? 'none',
    // Framing as the viewer reads it: how much of the frame the subject fills.
    framing: p.plateWidth ? (p.plateWidth > 0.85 ? 'full' : p.plateWidth > 0.55 ? 'medium' : 'wide') : 'plate',
    arrival: scene.transition?.kind ?? 'cut',
    captioned: Array.isArray(p.caption) && p.caption.length > 0,
    // Half-second buckets. Two shots 2.6s and 2.7s long are the same length.
    length: Math.round(seconds * 2) / 2,
  };
}

/** How many of a list are the same value, as a fraction. */
function share(values) {
  if (!values.length) return 0;
  const tally = {};
  for (const v of values) tally[v] = (tally[v] ?? 0) + 1;
  const [kind, n] = Object.entries(tally).sort((a, b) => b[1] - a[1])[0];
  return {kind, share: n / values.length, count: n};
}

/**
 * IS THIS A REEL OR A SLIDESHOW?
 *
 * The test is deliberately about SAMENESS rather than about motion. A slideshow
 * is not "nothing moves" — every shot in the reel this was written for had a
 * camera push. It is "the same thing happens every time", and a slow push in
 * every shot is exactly that: motion that carries no information because it
 * never varies.
 */
export function slideshow(scenes, {fps = FPS_DEFAULT} = {}) {
  const signatures = scenes.map((s) => signatureOf(s, {fps}));
  if (signatures.length < 4) return null;
  // The four axes a viewer actually distinguishes shots by.
  const key = (s) => `${s.representation}|${s.camera}|${s.framing}|${s.length}`;
  const worst = share(signatures.map(key));
  if (worst.share >= 0.6) {
    return {
      kind: worst.kind,
      count: worst.count,
      share: worst.share,
      why: `${worst.count} of ${signatures.length} shots are the same shot — ${worst.kind.split('|').join(', ')}`,
    };
  }
  return null;
}

/**
 * RHYTHM — the spread of shot lengths.
 *
 * A short cuts fast at the hook and holds at the verdict. A reel whose shots
 * are all within a few frames of each other has no shape: the viewer stops
 * being told what matters, because length is the loudest way an edit says it.
 *
 * Reported as the coefficient of variation, which is scale-free — a 30-second
 * reel and a 60-second one are judged the same way.
 */
export function rhythm(scenes, {fps = FPS_DEFAULT} = {}) {
  const lengths = scenes.map((s) => (s.durationInFrames ?? 0) / fps);
  if (lengths.length < 3) return {variation: 0, mean: lengths[0] ?? 0, shortest: 0, longest: 0};
  const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  const sd = Math.sqrt(lengths.reduce((n, l) => n + (l - mean) ** 2, 0) / lengths.length);
  return {
    variation: Number((sd / Math.max(0.001, mean)).toFixed(2)),
    mean: Number(mean.toFixed(2)),
    shortest: Number(Math.min(...lengths).toFixed(2)),
    longest: Number(Math.max(...lengths).toFixed(2)),
  };
}

/**
 * MOTION DENSITY — per shot, not averaged over the reel.
 *
 * An average hides both failures at once: one shot with six things happening
 * and one with none average out to a reel that looks correctly paced and plays
 * as a strobe followed by a photograph.
 */
export function motionDensity(scenes, {fps = FPS_DEFAULT} = {}) {
  return scenes.map((scene, index) => {
    const frames = scene.durationInFrames ?? 0;
    const events = eventsOf(scene);
    /**
     * SIMULTANEOUS EVENTS ARE ONE EVENT, and too many of them are noise.
     *
     * Three things landing in the same fifth of a second is not three beats. It
     * is one moment that the viewer cannot decompose, and it is the other way
     * a shot fails — not empty, but unreadable.
     */
    const clusters = [];
    for (const event of events) {
      const last = clusters[clusters.length - 1];
      if (last && event.at - last.at <= fps * 0.2) last.n += 1;
      else clusters.push({at: event.at, n: 1});
    }
    return {
      index,
      id: scene.id,
      seconds: Number((frames / fps).toFixed(2)),
      events: events.length,
      beats: clusters.length,
      perSecond: Number((events.length / Math.max(0.1, frames / fps)).toFixed(2)),
      busiest: clusters.reduce((n, c) => Math.max(n, c.n), 0),
    };
  });
}

/**
 * INFORMATION DENSITY — can the words be read in the time they are up?
 *
 * Reading is measured, not guessed: a viewer reads on-screen text at roughly
 * three words a second when it is not the thing they came for, and a caption
 * that arrives at frame 40 of a 58-frame shot has six frames of reading time
 * per word. That caption is decoration; it is not language.
 */
export const READING = {READ_RATE: 3.2, SUPPORTED: 0.6};

/**
 * HOW LONG THESE WORDS NEED TO BE ON SCREEN, in frames.
 *
 * Exported so the planner schedules against the same number the editor judges
 * against. A checker with its own reading speed is a checker that argues with
 * the thing it is checking.
 */
export function readingFrames(words, fps = FPS_DEFAULT) {
  return Math.ceil((words / READING.READ_RATE) * READING.SUPPORTED * fps);
}

export function informationDensity(scenes, {fps = FPS_DEFAULT} = {}) {
  /**
   * WHAT "READABLE" MEANS WHEN THE LINE IS ALSO BEING SPOKEN.
   *
   * Three words a second is cold silent reading. These captions are not read
   * cold — the narrator is saying the same words, so the eye is confirming
   * rather than decoding, and holding every caption to the silent rate would
   * flag most of a correctly cut reel.
   *
   * The failure worth catching is the caption that appears with under a second
   * left on a two-second shot: on screen for a third of the time its own words
   * need, gone before the sentence it belongs to has finished. That is not a
   * tight caption, it is a caption nobody read.
   */
  const {READ_RATE, SUPPORTED} = READING;
  return scenes.map((scene, index) => {
    const p = scene.params ?? {};
    const caption = Array.isArray(p.caption) ? p.caption : [];
    const words = caption.join(' ').split(/\s+/).filter(Boolean).length;
    const from = Number(p.captionFrame) || 0;
    const onScreen = Math.max(0, (scene.durationInFrames ?? 0) - from) / fps;
    return {
      index,
      id: scene.id,
      words,
      onScreen: Number(onScreen.toFixed(2)),
      needed: Number((words / READ_RATE).toFixed(2)),
      readable: words === 0 || onScreen >= (words / READ_RATE) * SUPPORTED,
    };
  });
}

/**
 * THE EDIT, JUDGED AS A WHOLE.
 *
 * Errors are things that make the reel not work. Warnings are things a person
 * should look at. The distinction matters because this runs in CI: a rule that
 * fails a build over a judgement call gets deleted within a week.
 */
export function editReel(config) {
  const fps = config.fps ?? FPS_DEFAULT;
  const scenes = config.scenes ?? [];
  const errors = [];
  const warnings = [];

  const slide = slideshow(scenes, {fps});
  if (slide) errors.push(`the edit is a slideshow: ${slide.why}`);

  const beat = rhythm(scenes, {fps});
  if (scenes.length >= 4 && beat.variation < 0.18) {
    warnings.push(
      `rhythm: every shot is about ${beat.mean}s (variation ${beat.variation}) — length is how an edit says what matters, and this edit says nothing`,
    );
  }
  if (beat.variation > 0.85) {
    warnings.push(`rhythm: shots run ${beat.shortest}s to ${beat.longest}s — the reel loses its footing rather than varying`);
  }

  const density = motionDensity(scenes, {fps});
  for (const shot of density) {
    if (shot.events === 0) {
      errors.push(`scene[${shot.index}] "${shot.id}": ${shot.seconds}s and nothing happens in it`);
    } else if (shot.beats === 1 && shot.seconds > 2.4) {
      warnings.push(
        `scene[${shot.index}] "${shot.id}": ${shot.seconds}s with one beat — a shot this long needs somewhere to arrive`,
      );
    }
    /**
     * THE OTHER END OF THE SAME RULE.
     *
     * "Add more motion" has a failure mode, and it is the one that looks
     * expensive from a distance and unreadable up close. Four things landing
     * together is not four times as much design.
     */
    if (shot.busiest >= 4) {
      warnings.push(
        `scene[${shot.index}] "${shot.id}": ${shot.busiest} things land within a fifth of a second — that is one unreadable moment, not four beats`,
      );
    }
  }

  for (const shot of informationDensity(scenes, {fps})) {
    if (!shot.readable) {
      warnings.push(
        `scene[${shot.index}] "${shot.id}": ${shot.words} words with ${shot.onScreen}s on screen (they need ${shot.needed}s) — the caption is gone before it is read`,
      );
    }
  }

  /**
   * AND THE SHAPE OF THE REEL, reported rather than judged.
   *
   * How often the KIND of shot changes. A reel that alternates photograph and
   * drawing reads as an argument; one that shows four photographs and then four
   * drawings reads as two reels stapled together.
   */
  const kinds = scenes.map((s) => signatureOf(s, {fps}).representation);
  const changes = kinds.filter((k, i) => i > 0 && k !== kinds[i - 1]).length;
  const variety = scenes.length > 1 ? Number((changes / (scenes.length - 1)).toFixed(2)) : 0;
  if (scenes.length >= 6 && variety < 0.2) {
    warnings.push(`the reel changes its kind of image ${changes} time(s) in ${scenes.length} shots — one idea, repeated`);
  }

  return {errors, warnings, rhythm: beat, variety, density};
}
