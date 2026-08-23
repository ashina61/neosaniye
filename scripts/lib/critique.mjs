/**
 * THE CRITIQUE — the check that can see a boring reel.
 *
 * `validateEpisodeConfig` answers "is this config well formed and are its files
 * on disk". It is a good question and it is not the one that has been failing.
 * Every reel this pipeline shipped passed it: the schema was right, the assets
 * were there, the durations summed, and the video was seven photographs being
 * slowly scaled.
 *
 * So this asks the other question. Not "will it render" but "is there anything
 * in it" — and each rule below is a defect that actually shipped, passed
 * validation, passed the tests, and was obvious in one still.
 *
 * ERRORS are things that cannot be intended: an event scheduled after the cut
 * that plays for nobody, a shot with nothing in it at all. WARNINGS are things
 * that are usually wrong and occasionally the point — a held shot, a long
 * closing card. `--strict` promotes them, which is what CI runs.
 */

const FPS_DEFAULT = 30;

/** Every scheduled moment in a scene, with a name, in scene frames. */
export function eventsOf(scene) {
  const p = scene.params ?? {};
  const out = [];
  const n = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

  if (Array.isArray(p.caption) && p.caption.length) out.push({kind: 'caption', at: n(p.captionFrame) ?? 0});
  for (const [i, prop] of (scene.props ?? []).entries()) {
    out.push({kind: `prop:${prop.kind}`, at: n(prop.from) ?? 0, index: i});
  }
  for (const [i, layer] of (scene.layers ?? []).entries()) {
    // A layer that arrives is an event. A layer that is simply there is scenery.
    if (layer.from !== undefined || layer.enter) out.push({kind: `layer:${layer.role}`, at: n(layer.from) ?? 0, index: i});
  }
  if (p.motif) out.push({kind: `motif:${p.motif}`, at: n(p.motifFrame) ?? 0});
  if (p.mark) out.push({kind: 'mark', at: n(p.markFrame) ?? 0});
  if (Array.isArray(p.shakeAt)) for (const at of p.shakeAt) out.push({kind: 'shake', at: n(at) ?? 0});
  // A COUNT AND A SPIN ARE THE CARD'S TITLE, not a second thing arriving with
  // it. Counting them separately reported the slate colliding with itself.
  const figure = p.countTo !== undefined ? 'count' : p.spinTo !== undefined ? 'spin' : null;
  if (figure) out.push({kind: figure, at: n(p.titleFrame) ?? 0});
  else if (p.title || p.kicker) out.push({kind: 'slate', at: n(p.titleFrame) ?? 0});
  /**
   * THE PORTAL'S FLIGHT IS THE SHOT.
   *
   * It does not express itself as a push, so a check that only knows about
   * `pushFrom`/`pushTo` called the most kinetic template in the engine "a
   * photograph with grain on it". A rule that cries wolf about the one shot
   * that is definitely moving is a rule people learn to ignore.
   */
  if (p.throughEndFrame !== undefined) {
    out.push({kind: 'flight', at: 0});
    out.push({kind: 'arrival', at: n(p.throughEndFrame) ?? 0});
  }
  for (const [i, item] of (Array.isArray(p.itemFrames) ? p.itemFrames : []).entries()) {
    out.push({kind: 'item', at: n(item) ?? 0, index: i});
  }
  // THE TEXT LAYER IS AN EVENT TOO. It lives on the scene rather than in
  // params, and leaving it out reported a shot with a sticker punching onto it
  // as a shot in which nothing happens.
  for (const [i, spec] of (scene.onScreenText ?? []).entries()) {
    out.push({kind: 'onScreenText', at: n(spec.atFrame) ?? 0, index: i});
  }
  return out.sort((a, b) => a.at - b.at);
}

/** How far the camera actually travels in this shot, as a fraction of frame. */
function cameraTravel(scene) {
  const p = scene.params ?? {};
  const from = typeof p.pushFrom === 'number' ? p.pushFrom : 1;
  const to = typeof p.pushTo === 'number' ? p.pushTo : 1;
  const pan = Math.abs(Number(p.panX) || 0) + Math.abs(Number(p.panY) || 0);
  // A portal flies rather than pushes, and a parallax punch scales its subject
  // harder than its plate. Both are camera moves; neither is a `pushTo`.
  const flight = Math.abs((Number(p.wallScaleEnd) || 1) - 1);
  const punchTravel = Math.abs((Number(p.charScale) || 1) - (Number(p.bgScale) || 1));
  // A slate's camera is its `creep` — the slow drift on the card behind the
  // type. Not knowing about it called every closing card a still.
  const creep = Math.abs((Number(p.creep) || 1) - 1);
  return Math.abs(to - from) + pan / 1080 + flight + punchTravel + creep;
}

/** The direction a camera moved, so three of the same can be spotted. */
function cameraKind(scene) {
  const p = scene.params ?? {};
  const from = typeof p.pushFrom === 'number' ? p.pushFrom : 1;
  const to = typeof p.pushTo === 'number' ? p.pushTo : 1;
  if (Math.abs(Number(p.panX) || 0) > 40) return 'pan';
  if (to - from > 0.06) return 'push';
  if (from - to > 0.06) return 'pull';
  return 'hold';
}

/** Three of anything in a row, reported once per run. */
function runsOfThree(values, label, push) {
  let run = 1;
  for (let i = 1; i <= values.length; i += 1) {
    if (i < values.length && values[i] && values[i] === values[i - 1]) {
      run += 1;
      continue;
    }
    // Reported ONCE per run. Five in a row used to print three near-identical
    // warnings, and a list nobody can scan is a list nobody reads.
    if (run >= 3 && values[i - 1]) {
      push(`${label}: "${values[i - 1]}" ${run} shots running (${i - run + 1}-${i}) — a device that repeats is a tic`);
    }
    run = 1;
  }
}

export function critiqueEpisode(config, {fps = config.fps ?? FPS_DEFAULT} = {}) {
  const errors = [];
  const warnings = [];
  const scenes = config.scenes ?? [];
  const height = config.height ?? 1920;

  scenes.forEach((scene, index) => {
    const where = `scene[${index}] "${scene.id}"`;
    const frames = scene.durationInFrames ?? 0;
    const seconds = frames / fps;
    const events = eventsOf(scene);
    const p = scene.params ?? {};

    /**
     * AN EVENT AFTER THE CUT IS AN EVENT NOBODY SEES.
     *
     * The portal template scheduled its caption at `push + 48` — frame 69 of a
     * 58-frame shot. It rendered, it validated, and the shot was silent.
     */
    for (const event of events) {
      if (event.at >= frames) {
        errors.push(`${where}: ${event.kind} is scheduled at frame ${event.at} of ${frames} — it plays for nobody`);
      }
    }

    /**
     * A SHOT WITH NOTHING IN IT.
     *
     * The whole reason this file exists. Four of the last reel's seven shots
     * were a photograph and a slow scale for four and a half seconds.
     */
    if (frames >= 40 && events.length === 0) {
      // NOTHING AT ALL cannot be intended. There is no shot this describes.
      errors.push(`${where}: ${seconds.toFixed(1)}s and nothing happens — a camera push is the floor, not an event`);
    } else if (frames >= 40 && events.length < 2) {
      // ONE EVENT can be a deliberate hold, and a reel needs a few of those to
      // give the rest somewhere to land. It is almost never deliberate here,
      // so it is said out loud every run rather than kept behind a flag.
      warnings.push(
        `${where}: ${seconds.toFixed(1)}s on one event — the shot will read as a still with a caption`,
      );
    }

    // NOTHING HAPPENS UNTIL HALFWAY. The opening seconds are the whole budget.
    const first = events[0]?.at ?? Infinity;
    if (frames >= 40 && first > frames * 0.45) {
      warnings.push(`${where}: first event at frame ${first} of ${frames} — the shot opens on a still`);
    }

    // A CAMERA THAT DOES NOT MOVE, in a shot that is not choosing to hold.
    const travel = cameraTravel(scene);
    if (frames >= 50 && travel < 0.04 && events.length < 3) {
      warnings.push(`${where}: camera travels ${travel.toFixed(3)} — a photograph with grain on it`);
    }

    /**
     * A COMPOSITE OF ONE LAYER IS NOT A COMPOSITE.
     *
     * Law 4: a shot is a stack. One plate scaling is a zoom, and the depth the
     * whole template is built around is mathematically absent — there is
     * nothing for it to be relative to.
     */
    if (scene.sceneType === 'composite') {
      const layers = scene.layers ?? [];
      if (layers.length === 1 && (scene.props ?? []).length === 0) {
        warnings.push(`${where}: one layer and no drawn objects — nothing can move in front of anything`);
      }
      const depths = layers.map((l) => l.depth ?? 1);
      if (layers.length > 1 && Math.max(...depths) - Math.min(...depths) < 0.15) {
        warnings.push(`${where}: every layer at the same depth — the stack will scale as one plate`);
      }
    }

    /**
     * WORDS THAT LEAVE THE FRAME, or arrive too late to be read.
     *
     * The engine clamps both now, but a config that needs clamping is a config
     * whose numbers are wrong, and the next template to grow a caption will not
     * have the clamp.
     */
    const caption = Array.isArray(p.caption) ? p.caption : [];
    if (caption.length) {
      const size = Number(p.captionSize) || 88;
      const block = caption.length * size * 1.3;
      const y = Number(p.captionY) || 0;
      if (y + block > height - 120) {
        warnings.push(`${where}: caption block ends at ${Math.round(y + block)} of ${height} — outside the safe area`);
      }
      if (Number(p.captionFrame) > frames * 0.7) {
        warnings.push(`${where}: caption lands at ${p.captionFrame} of ${frames} — too late to read before the cut`);
      }
      const emphasis = String(p.captionEmphasis ?? '').trim().toLowerCase();
      if (emphasis) {
        const words = caption.join(' ').toLowerCase().replace(/[^\p{L}\p{N} ]/gu, ' ');
        if (!words.includes(emphasis.replace(/[^\p{L}\p{N} ]/gu, ' ').trim())) {
          warnings.push(`${where}: emphasis "${p.captionEmphasis}" is not in the caption — nothing will be emphasised`);
        }
      }
    }

    // A SHOT THAT OUTLASTS ITS ONE IDEA. Not said twice: a single-event shot has
    // already been reported above, and one finding printed two ways is noise.
    if (seconds > 4.2 && events.length >= 2 && events.length < 3) {
      warnings.push(`${where}: ${seconds.toFixed(1)}s on ${events.length} event(s) — it will feel held`);
    }

    // TWO THINGS ON THE SAME FRAME ARE ONE THING WITH A THICKNESS.
    for (let i = 1; i < events.length; i += 1) {
      /**
       * WHAT IS ALLOWED TO SHARE A BEAT.
       *
       * Frame zero is not a beat: a continuation stands the same objects in the
       * same room and they are simply THERE when the shot opens. An impact is
       * not a separate event either — the camera is struck BECAUSE the thing
       * landed, and scheduling the hit anywhere else breaks the cause. And the
       * portal's arrival is the moment its words are meant to land on.
       */
      const paired = new Set(['shake', 'flight', 'arrival']);
      if (
        events[i].at > 1 &&
        events[i].at - events[i - 1].at < 3 &&
        events[i].kind !== events[i - 1].kind &&
        !paired.has(events[i].kind) &&
        !paired.has(events[i - 1].kind)
      ) {
        warnings.push(
          `${where}: ${events[i - 1].kind} and ${events[i].kind} both land at ~${events[i].at} — one beat, not two`,
        );
      }
    }
  });

  // ACROSS THE REEL: repetition is the thing a per-scene check cannot see.
  runsOfThree(scenes.map((s) => s.transition?.kind ?? 'cut'), 'transition', (m) => warnings.push(m));
  /**
   * COMPOSITE IS THE GENERAL CASE, NOT A DEVICE.
   *
   * The other six templates ARE devices — a portal flight three shots running
   * is exhausting and a title card three shots running is a lecture. A reel
   * that is mostly composites is a reel that is mostly shots, which is correct,
   * and warning about it drowns every real finding in the list.
   */
  runsOfThree(
    scenes.map((s) => (s.sceneType === 'composite' ? '' : s.sceneType)),
    'template',
    (m) => warnings.push(m),
  );
  runsOfThree(scenes.map(cameraKind), 'camera', (m) => warnings.push(m));
  runsOfThree(
    scenes.map((s) => String(s.params?.captionReveal ?? '')),
    'text reveal',
    (m) => warnings.push(m),
  );

  const total = scenes.reduce((n, s) => n + (s.durationInFrames ?? 0), 0);
  const seconds = total / fps;
  const events = scenes.reduce((n, s) => n + eventsOf(s).length, 0);

  /**
   * THE PACE OF THE WHOLE THING.
   *
   * The reference short is about fifteen shots in thirty-two seconds. Below
   * roughly one shot every four seconds a reel is a slideshow however good each
   * frame is, and above one every second it is a strobe.
   */
  const perShot = scenes.length ? seconds / scenes.length : 0;
  if (perShot > 3.6) warnings.push(`pace: ${perShot.toFixed(1)}s per shot — a short cuts about every two`);
  if (perShot < 0.9 && scenes.length > 3) warnings.push(`pace: ${perShot.toFixed(1)}s per shot — nothing has time to land`);
  if (seconds < 12) warnings.push(`length: ${seconds.toFixed(1)}s — under the floor for a short`);
  if (seconds > 75) warnings.push(`length: ${seconds.toFixed(1)}s — over the ceiling for a short`);

  return {
    errors,
    warnings,
    stats: {
      scenes: scenes.length,
      seconds: Number(seconds.toFixed(2)),
      events,
      eventsPerSecond: Number((events / Math.max(1, seconds)).toFixed(2)),
      secondsPerShot: Number(perShot.toFixed(2)),
    },
  };
}
