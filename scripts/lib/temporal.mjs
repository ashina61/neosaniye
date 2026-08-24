/**
 * THE TEMPORAL CONSISTENCY ENGINE.
 *
 * Everything else in this pipeline judges a shot as an arrangement. This judges
 * it as a SEQUENCE OF STATES, and asks whether every one of them is possible.
 *
 * The distinction is not academic. A contact sheet takes four stills out of
 * sixty; the slot reel's two-values-at-once frame lived in the fifty-six that
 * were never sampled, survived two rounds of review, and was then hidden under
 * a soft mask rather than fixed. A defect that only exists between the frames
 * you look at needs a checker that looks at all of them.
 *
 * So this walks a shot frame by frame and asserts the invariants that make an
 * animated visual coherent: a counter does not go backwards, a reel shows one
 * value, gears actually mesh, a ring contains what it encircles, a timeline
 * stays in order. It calls the engine's own state functions, so it cannot drift
 * away from what is drawn.
 */
import {
  contains,
  counterValue,
  countWindow,
  gearTrainLayout,
  gearsMesh,
  insideFrame,
  slotReadableCount,
  GEAR_ASPECT,
} from '../../engine/state.mjs';

export {gearTrainLayout};

/**
 * A VISUAL STATE — one element, over one span of frames.
 *
 * The planning-time record of what is on screen and when. It is deliberately
 * not a renderer: nothing here draws. It is the vocabulary the checks below
 * reason in, and the shape the director's report records.
 */
export function visualState({
  stateId,
  frameStart,
  frameEnd,
  role,
  visible = [],
  values = {},
  relationships = [],
  z = 0,
}) {
  return {stateId, frameStart, frameEnd, role, visible, values, relationships, z};
}

/**
 * THE STATES A SHOT PASSES THROUGH.
 *
 * Read off the config rather than declared by hand, so it stays true as the
 * planner changes. Every element that arrives gets an interval; the checks then
 * ask what overlaps what.
 */
export function statesOf(scene, {fps = 30} = {}) {
  const p = scene.params ?? {};
  const end = scene.durationInFrames ?? 0;
  const out = [];
  const at = (v, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);

  const caption = Array.isArray(p.caption) ? p.caption : [];
  if (caption.length) {
    out.push(
      visualState({
        stateId: 'caption',
        frameStart: at(p.captionFrame),
        frameEnd: end,
        role: 'body',
        visible: caption,
        values: {lines: caption.length},
        z: 30,
      }),
    );
  }
  if (scene.diagram) {
    out.push(
      visualState({
        stateId: `diagram:${scene.diagram.type}`,
        frameStart: at(scene.diagram.from),
        frameEnd: end,
        role: 'primary',
        values: {countTo: scene.diagram.countTo ?? null},
        z: 20,
      }),
    );
  }
  for (const [i, prop] of (scene.props ?? []).entries()) {
    out.push(
      visualState({stateId: `prop:${prop.kind}:${i}`, frameStart: at(prop.from), frameEnd: end, role: 'secondary', z: 15}),
    );
  }
  if (p.title || p.spinTo || p.countTo !== undefined) {
    out.push(
      visualState({
        stateId: 'slate',
        frameStart: at(p.titleFrame),
        frameEnd: end,
        role: 'statement',
        values: {spinTo: p.spinTo ?? null, countTo: p.countTo ?? null},
        z: 40,
      }),
    );
  }
  return out;
}

/**
 * WALK THE SHOT AND CHECK EVERY FRAME.
 *
 * Cheap enough to run on every plan: a few hundred frames of arithmetic per
 * scene, no rendering, no browser.
 */
export function temporalProblems(config) {
  const errors = [];
  const warnings = [];
  const width = config.width ?? 1080;
  const height = config.height ?? 1920;

  (config.scenes ?? []).forEach((scene, index) => {
    const where = `scene[${index}] "${scene.id}"`;
    const p = scene.params ?? {};
    const frames = scene.durationInFrames ?? 0;

    /**
     * THE SLOT REEL — one readable value, at every frame.
     *
     * The named defect. Asserted against the same function the component draws
     * with, so a future change to the mechanism cannot quietly reintroduce it.
     */
    if (p.spinTo) {
      const reel = Array.isArray(p.spinReel) ? p.spinReel : [];
      const count = [...reel.filter((r) => r !== p.spinTo), p.spinTo].length;
      const from = Number(p.titleFrame) || 0;
      const spin = Number(p.spinFrames) || 26;
      let worst = 0;
      for (let f = 0; f <= frames; f += 1) {
        worst = Math.max(worst, slotReadableCount(f, {from, spin, count}));
      }
      if (worst > 1) {
        errors.push(`${where}: the slot reel shows ${worst} values at once — only one may be readable`);
      }
      if (from + spin > frames) {
        errors.push(`${where}: the reel is still spinning at the cut (${from + spin} of ${frames}) — it never lands`);
      }
    }

    /**
     * COUNTERS — monotonic, and landing exactly on the figure they claim.
     */
    for (const [key, target] of [
      ['countTo', p.countTo],
      ['diagram', scene.diagram?.countTo],
    ]) {
      if (target === undefined || target === null) continue;
      /**
       * THE SAME WINDOW THE COMPONENT COUNTS THROUGH.
       *
       * This used to read `diagram.over` — the DRAWING's schedule — while the
       * component counted over its own derived window, so the assertion "the
       * figure reaches thirty" was true of a window nothing rendered, and 29
       * shipped on a shot about thirty gears.
       */
      /**
       * UNCLAMPED, EXACTLY AS THE COMPONENT READS IT.
       *
       * Passing the shot's length here would make the checker pull an over-long
       * window back inside the shot and then confirm that it fits — a checker
       * that repairs what it is measuring cannot fail. The planner clamps when
       * it WRITES the window; this reads what was written.
       */
      const win = key === 'diagram' ? countWindow(scene.diagram) : null;
      const from = win ? win.start : Number(p.titleFrame) || 0;
      const over = win ? win.over : Number(p.countOver) || Math.round(frames * 0.55);
      let previous = -Infinity;
      for (let f = 0; f <= frames; f += 1) {
        const value = counterValue(f, {from, over, to: Number(target)});
        if (value < previous) {
          errors.push(`${where}: the ${key} counter goes backwards at frame ${f}`);
          break;
        }
        previous = value;
      }
      if (counterValue(frames, {from, over, to: Number(target)}) !== Number(target)) {
        errors.push(`${where}: the ${key} counter never reaches ${target} before the cut`);
      }
      if (from + over > frames) {
        warnings.push(`${where}: the ${key} counter is still climbing at the cut — the figure lands off screen`);
      }
    }

    /**
     * GEARS — the mesh is physics, and physics is checkable.
     *
     * A train whose wheels do not touch is three things rotating near each
     * other, which is the decorative version of the same picture.
     */
    if (scene.diagram?.type === 'gearSystem') {
      const gears = Array.isArray(scene.diagram.gears) && scene.diagram.gears.length
        ? scene.diagram.gears
        : gearTrainLayout(scene.diagram.count ?? 8);
      const drive = gears[scene.diagram.drive ?? 0];
      for (const [i, gear] of gears.entries()) {
        if (gear === drive) continue;
        if (!gearsMesh(drive, gear, {aspect: GEAR_ASPECT})) {
          errors.push(`${where}: gear[${i}] does not mesh with the driven wheel — the teeth slide through each other`);
        }
      }
    }

    /**
     * A RING CONTAINS ITS SUBJECT, AND SITS INSIDE THE FRAME.
     *
     * The moon's orbit spent two renders enclosing empty sky above the
     * composition. Both halves are asserted: inside the frame, and around the
     * thing it is drawn around.
     */
    if (scene.diagram?.type === 'orbit') {
      const ring = {
        cx: (Number(scene.diagram.cx) || 0.5) * width,
        cy: (Number(scene.diagram.cy) || 0.45) * height,
        radius: (Number(scene.diagram.radius) || 0.3) * width,
      };
      if (!insideFrame(ring, {width, height})) {
        errors.push(`${where}: the orbit leaves the frame — it encloses sky rather than its subject`);
      }
      // The subject is the plate the ring is drawn over; a full-bleed photo is
      // taken to be centred, which is what the moon plate is.
      const subject = {cx: width / 2, cy: height * 0.42, radius: width * 0.24};
      if (Object.keys(scene.assets ?? {}).length && !contains(ring, subject)) {
        warnings.push(`${where}: the orbit may not contain the subject it is drawn around`);
      }
    }

    /** A TIMELINE'S EVENTS MUST BE IN ORDER, or it is not a timeline. */
    if (scene.diagram?.type === 'timeline') {
      const events = scene.diagram.events ?? [];
      for (let i = 1; i < events.length; i += 1) {
        if (Number(events[i].at) <= Number(events[i - 1].at)) {
          errors.push(`${where}: timeline events are out of order (${events[i - 1].at} then ${events[i].at})`);
        }
      }
      const gap = scene.diagram.gap;
      if (Array.isArray(gap) && (gap[1] <= gap[0])) {
        errors.push(`${where}: the timeline's gap runs backwards`);
      }
    }

    /**
     * NOTHING IS SCHEDULED AFTER THE CUT.
     *
     * Already checked for events; here it is checked for STATES, which catches
     * an element whose arrival is inside the shot but whose animation is not.
     */
    for (const state of statesOf(scene)) {
      if (state.frameStart >= frames) {
        errors.push(`${where}: ${state.stateId} begins at frame ${state.frameStart} of ${frames}`);
      }
    }

    /**
     * NOTHING LEAVES WITHOUT A REASON.
     *
     * An element that arrives and then stops being drawn has either exited —
     * which is an event, and events are stated — or it has been forgotten. The
     * viewer cannot tell those apart, and neither can any check that looks at
     * one frame: an object present at 40 and absent at 70 passes every still
     * either side of the moment it vanished.
     *
     * A recede is an exit and is allowed. An `until` with no recede and no
     * transition after it is a disappearance.
     */
    const recedes = Number.isFinite(Number(p.captionRecedeAt));
    for (const state of statesOf(scene)) {
      const ends = Number(state.frameEnd);
      if (!Number.isFinite(ends) || ends >= frames - 2) continue;
      if (state.exit || (state.stateId.startsWith('caption') && recedes)) continue;
      warnings.push(
        `${where}: ${state.stateId} stops at frame ${ends} of ${frames} with nothing to say it left`,
      );
    }

    /**
     * AND A FOREGROUND DOES NOT STAND IN FRONT OF THE SENTENCE.
     *
     * Atmosphere is drawn nearest the viewer, which is correct and is also the
     * one place a caption cannot survive: a fog bank at three quarters strength
     * across the band where the words are is a shot whose words are a rumour.
     * The type is the only part of a shot the viewer HAS to read.
     */
    const fog = Number(p.fog) || 0;
    const fogTop = 1 - (Number(p.fogHeight) || 0.62);
    const capY = (Number(p.captionY) || 0) / height;
    if (fog > 0.5 && Array.isArray(p.caption) && p.caption.length && capY > fogTop) {
      warnings.push(
        `${where}: fog at ${fog.toFixed(2)} sits over the caption band — the words are behind the weather`,
      );
    }
  });

  return {errors, warnings};
}

/**
 * CAUSAL CHAINS — does one thing happen BECAUSE of another?
 *
 * Reported rather than enforced, because causality is a judgement. What can be
 * measured is whether the shot's events are ordered like a chain (cause, then
 * effect, then reveal) or like a list (three things at once).
 *
 * A shot whose events all land within a few frames of each other is three
 * animations sharing a moment; one whose events are spaced and ordered is a
 * sequence, and a sequence is what reads as designed.
 */
export function causalShape(scene, {fps = 30} = {}) {
  const states = statesOf(scene).sort((a, b) => a.frameStart - b.frameStart);
  if (states.length < 2) return {shape: 'single', spread: 0, states: states.length};
  const first = states[0].frameStart;
  const last = states[states.length - 1].frameStart;
  const spread = (last - first) / fps;
  // Under a third of a second apart is one beat wearing several hats.
  if (spread < 0.34) return {shape: 'simultaneous', spread, states: states.length};
  return {shape: 'chain', spread, states: states.length};
}
