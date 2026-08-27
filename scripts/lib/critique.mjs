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

import {gearTrainLayout} from '../../engine/state.mjs';

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
   * THE QUALIFIER IS ITS OWN ARRIVAL.
   *
   * A closing card lands its figure and then the sentence that qualifies it —
   * two beats, and the second one was invisible to the counter because the
   * footer used to fade up with the whole block.
   */
  if (p.footer && p.footerFrame !== undefined) out.push({kind: 'footer', at: n(p.footerFrame) ?? 0});
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
  /**
   * A DRAWN VISUAL IS AN EVENT, AND USUALLY THE SHOT'S LARGEST.
   *
   * A gear train beginning to turn, a timeline drawing itself, a count climbing
   * to thirty — these were invisible to the event counter, so replacing three
   * duplicated index cards with one meshing mechanism made the motion score go
   * DOWN. A check that punishes the right decision is worse than no check.
   *
   * The count is its own second event: it lands after the drawing arrives, and
   * the landing is the thing the shot is built around.
   */
  if (scene.diagram) {
    const at = n(scene.diagram.from) ?? 0;
    out.push({kind: `diagram:${scene.diagram.type}`, at});
    if (scene.diagram.countTo !== undefined) {
      out.push({kind: 'diagram:count', at: at + (n(scene.diagram.over) ?? 20)});
    }
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
export function cameraTravel(scene) {
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

export function critiqueEpisode(config, {fps = config.fps ?? FPS_DEFAULT, holds = new Set()} = {}) {
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
      // A diagram is a drawn object — the largest one the engine makes. A plate
      // with a meshing gear train in front of it is a stack; reporting it as a
      // bare photograph sent the planner looking for a prop it did not need.
      if (layers.length === 1 && (scene.props ?? []).length === 0 && !scene.diagram) {
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

    /**
     * A SHOT THAT OUTLASTS ITS ONE IDEA — unless it is holding on purpose.
     *
     * A verdict is SUPPOSED to run long on few events: the claim lands and the
     * frame is left alone so it can be read. Warning about the one shot in the
     * reel that was deliberately given air is how a check teaches people to
     * ignore it.
     */
    if (seconds > 4.2 && events.length >= 2 && events.length < 3 && !holds.has(scene.id)) {
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
  /**
   * A RUN OF HARD CUTS IS NOT A TIC.
   *
   * The repeat rule was applied to `cut` alongside everything else, so a reel
   * that correctly left four seams plain was told off for it — and the only way
   * to satisfy the warning was to decorate one of them, which is precisely
   * backwards. A hard cut is the default grammar of documentary editing; it is
   * what most seams should be, and the plainness of most is what makes the
   * three that are not mean something. Only the DEVICES are held to the rule.
   */
  runsOfThree(
    // Blanked rather than removed: dropping the plain cuts would close the gaps
    // and report three slips at shots 2, 4 and 9 as three shots running.
    scenes.map((s) => (s.transition?.kind && s.transition.kind !== 'cut' ? s.transition.kind : null)),
    'transition',
    (m) => warnings.push(m),
  );
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
  runsOfThree(scenes.map((s) => cameraFamily(s) ?? ''), 'camera', (m) => warnings.push(m));
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

/* ══════════════════════════════════════════════════════════════════════════
 * SECOND STAGE — the art-direction checks.
 *
 * Everything above answers "does anything happen". These answer "was anything
 * DECIDED", which is the failure the first stage could not see: a reel where
 * every shot has three events, every caption lands, and the pictures are of the
 * wrong things, arriving through the same transition, on the same camera move,
 * ending on a whimper.
 * ══════════════════════════════════════════════════════════════════════════ */

/** Which family a shot's camera belongs to. Shared with the director's names. */
export function cameraFamily(scene) {
  const p = scene.params ?? {};
  // The director records what it chose. Inference below is only for configs
  // written before it did — and it cannot tell a drift from a push.
  if (typeof p.cameraMove === 'string') return p.cameraMove;
  /**
   * A CARD IS NOT HOLDING; IT HAS NO CAMERA.
   *
   * A title slate and a portal flight express their movement in their own
   * params, so reading them through `pushFrom`/`pushTo` reports them as locked
   * off — and two cards in a ten-shot reel were enough to make `hold` look like
   * forty per cent of the camera work while the quota, which counts what the
   * director actually chose, had spent two.
   */
  if (p.pushFrom === undefined && p.pushTo === undefined) return null;
  const from = typeof p.pushFrom === 'number' ? p.pushFrom : 1;
  const to = typeof p.pushTo === 'number' ? p.pushTo : 1;
  if (Math.abs(Number(p.panX) || 0) > 40) return 'pan';
  if (Math.abs(Number(p.panY) || 0) > 60) return 'tilt';
  if (to - from > 0.06) return 'push';
  if (from - to > 0.06) return 'pull';
  return 'hold';
}

/** Count, and report anything that takes more than its share of the reel. */
function dominance(values, label, share, warn, attribute = null) {
  const total = values.length;
  if (total < 4) return;
  const tally = {};
  for (const v of values) tally[v] = (tally[v] ?? 0) + 1;
  for (const [kind, count] of Object.entries(tally)) {
    const fraction = count / total;
    if (fraction > share) {
      /**
       * AND WHOSE FAULT IT IS.
       *
       * A move the brief wrote cannot be refused by a quota — written wins, and
       * that is the right law. Saying so turns a warning the planner cannot act
       * on into a note for the person who can.
       */
      const authored = attribute ? attribute(kind) : 0;
      warn(
        `${label}: "${kind}" on ${count} of ${total} shots (${Math.round(fraction * 100)}%) — ` +
          `over the ${Math.round(share * 100)}% ceiling; one device is carrying the reel` +
          (authored ? ` (${authored} of them written into the brief, which the quota cannot refuse)` : ''),
      );
    }
  }
}

/**
 * ART DIRECTION CHECKS.
 *
 * Separate from `critiqueEpisode` because they answer a different question and
 * because they need things the config alone does not carry — the asset
 * verdicts, and the story's reading of each line. Called with whatever is
 * available; every check degrades to silence rather than to a false alarm.
 */
export function critiqueDirection(config, {assets = {}, story = [], fps = config.fps ?? FPS_DEFAULT} = {}) {
  const errors = [];
  const warnings = [];
  const scenes = config.scenes ?? [];
  const total = scenes.length;

  /**
   * A PICTURE OF THE WRONG THING.
   *
   * The most expensive fault this pipeline has, and until the asset director
   * existed nothing could see it: every wrong file was the right size, on disk,
   * and well exposed. An asset still in the cut with a failing score is either
   * a decision somebody should own or an oversight.
   */
  const used = new Set();
  for (const scene of scenes) {
    for (const file of Object.values(scene.assets ?? {})) used.add(String(file).split('/').pop());
  }
  for (const name of used) {
    const verdict = assets[name];
    if (!verdict) continue;
    if (verdict.verdict === 'reject') {
      errors.push(
        `asset "${name}" scored ${verdict.score}/10 and is still in the cut — ` +
          `${verdict.depicts ? `it depicts ${verdict.depicts}` : 'it was refused'}`,
      );
    } else if (verdict.score < 6.5) {
      warnings.push(
        `asset "${name}" scored ${verdict.score}/10 — used knowingly` +
          (verdict.note ? `: ${verdict.note.slice(0, 90)}` : ''),
      );
    }
    if (!verdict.reviewed) {
      warnings.push(`asset "${name}" has never been reviewed — its relevance is unknown, not good`);
    }
  }

  /**
   * THE HOOK.
   *
   * The first shot is the single most consequential asset decision in a short,
   * and the last reel gave its longest duration to its worst photograph.
   */
  const first = scenes[0];
  if (first) {
    const longest = Math.max(...scenes.map((s) => s.durationInFrames ?? 0));
    const firstAsset = Object.values(first.assets ?? {})[0];
    const verdict = firstAsset ? assets[String(firstAsset).split('/').pop()] : null;
    if ((first.durationInFrames ?? 0) >= longest && total > 3) {
      warnings.push(
        `hook: the opening shot is the longest in the reel (${((first.durationInFrames ?? 0) / fps).toFixed(1)}s) — ` +
          `a short earns its next two seconds in the first one`,
      );
    }
    if (verdict && verdict.score < 6) {
      errors.push(`hook: the opening shot rests on "${verdict.file}", scored ${verdict.score}/10`);
    }
  }

  /**
   * THE ENDING.
   *
   * A verdict split across two shots puts the claim on the first and a quieter
   * repeat of it on the second, so the reel gets smaller as it finishes.
   */
  const last = scenes[scenes.length - 1];
  const before = scenes[scenes.length - 2];
  if (last && before) {
    const claim = String(last.params?.captionEmphasis ?? last.params?.title ?? '').toLowerCase();
    const earlier = String(before.params?.captionEmphasis ?? before.params?.title ?? '').toLowerCase();
    if (claim && claim === earlier) {
      errors.push(
        `ending: "${claim}" is the payload of both of the last two shots — ` +
          `the verdict is split and the reel finishes on the weaker half`,
      );
    }
    const events = eventsOf(last);
    const lastEvent = events.length ? events[events.length - 1].at : 0;
    const tail = ((last.durationInFrames ?? 0) - lastEvent) / fps;
    if (tail < 0.6 && (last.durationInFrames ?? 0) > 45) {
      warnings.push(
        `ending: the final shot keeps adding things until ${tail.toFixed(1)}s from the cut — ` +
          `a claim needs silence after it to land`,
      );
    }
  }

  // NO DEVICE CARRIES THE REEL.
  dominance(
    scenes.map(cameraFamily).filter(Boolean),
    'camera',
    0.34,
    (m) => warnings.push(m),
    (kind) => scenes.filter((s) => s.params?.cameraAuthored && cameraFamily(s) === kind).length,
  );
  /**
   * A TRANSITION'S SHARE IS OF THE WHOLE REEL, NOT OF THE DECORATED CUTS.
   *
   * Counting only the non-plain arrivals made three `slip`s in a ten-shot reel
   * report as fifty per cent — which is arithmetically true of a set nobody
   * watches and false of the thing on screen. `cut` is excluded from being
   * REPORTED, because a reel of hard cuts is correct, but it stays in the
   * denominator because it is a third of what the viewer sees.
   */
  const arrivals = scenes.map((s) => s.transition?.kind ?? 'cut');
  dominance(arrivals, 'transition', 0.34, (m) => {
    if (!m.includes('"cut"')) warnings.push(m);
  });

  /**
   * REUSING A PICTURE IS FINE. REUSING A FRAME IS NOT.
   *
   * Two shots of one plate must change the visual information — the crop, the
   * subject, the direction. A 1.45→1.50 difference is the same frame twice, and
   * the cut between them is a jump rather than an edit.
   */
  const byPlate = {};
  scenes.forEach((scene, i) => {
    const plate = Object.values(scene.assets ?? {})[0];
    if (!plate) return;
    (byPlate[String(plate)] ??= []).push({scene, i});
  });
  for (const [plate, shots] of Object.entries(byPlate)) {
    for (let n = 1; n < shots.length; n += 1) {
      const a = shots[n - 1].scene.params ?? {};
      const b = shots[n].scene.params ?? {};
      const startDelta = Math.abs((Number(b.pushFrom) || 1) - (Number(a.pushFrom) || 1));
      const anchorDelta =
        Math.abs((Number(b.anchorX) || 0) - (Number(a.anchorX) || 0)) +
        Math.abs((Number(b.anchorY) || 0) - (Number(a.anchorY) || 0));
      const sameMove = cameraFamily(shots[n - 1].scene) === cameraFamily(shots[n].scene);
      if (startDelta < 0.08 && anchorDelta < 90 && sameMove) {
        warnings.push(
          `scene[${shots[n].i}] "${shots[n].scene.id}": same plate as the shot before it ` +
            `(${String(plate).split('/').pop()}), same framing, same move — the cut shows nothing new`,
        );
      }
    }
  }

  /**
   * BLUR AND HAZE, WHICH MULTIPLY.
   *
   * A soft arrival over a lens hunt over fog over a low-contrast plate is not
   * four subtle treatments, it is mush. The last reel stacked all four.
   */
  scenes.forEach((scene, index) => {
    const p = scene.params ?? {};
    const frames = scene.durationInFrames ?? 0;
    const soft = scene.transition?.kind === 'rack' || scene.transition?.kind === 'blinds';
    const hunt = Number(p.focusPx) || 0;
    const fog = Number(p.fog) || 0;
    const arrival = Number(scene.transition?.frames) || 0;

    if (soft && hunt > 0) {
      warnings.push(
        `scene[${index}] "${scene.id}": arrives soft AND hunts focus — two blurs on one opening`,
      );
    }
    if (frames && arrival / frames > 0.16) {
      warnings.push(
        `scene[${index}] "${scene.id}": the arrival takes ${Math.round((arrival / frames) * 100)}% of the shot`,
      );
    }
    if (hunt > 0 && frames < 90) {
      warnings.push(
        `scene[${index}] "${scene.id}": a focus hunt on a ${(frames / fps).toFixed(1)}s shot — ` +
          `it clears a fifth of the way in, and a fifth of this shot is everything`,
      );
    }
    if (fog > 0.3) warnings.push(`scene[${index}] "${scene.id}": fog ${fog} — haze this heavy is a grade, not weather`);
  });

  // ATMOSPHERE ON EVERYTHING IS A FILTER, NOT A CHOICE.
  const fogged = scenes.filter((s) => (Number(s.params?.fog) || 0) > 0.05).length;
  if (total >= 4 && fogged / total > 0.6) {
    warnings.push(`atmosphere: fog on ${fogged} of ${total} shots — that is a look applied, not a place described`);
  }

  /**
   * THE SAME SENTENCE, THREE TIMES.
   *
   * Narration, a drawn card and a caption all carrying the same words is not
   * emphasis, it is an echo — and it costs the graphic its only job, which is
   * to carry what a voice cannot.
   */
  scenes.forEach((scene, index) => {
    const caption = (Array.isArray(scene.params?.caption) ? scene.params.caption : []).join(' ').toLowerCase();
    if (!caption) return;
    const words = (text) => new Set(String(text).toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []);
    const capWords = words(caption);
    for (const prop of scene.props ?? []) {
      // A wireframe and a beam draw no text, so whatever copy they carry is not
      // on screen and cannot be echoing anything.
      if (prop.kind === 'wire' || prop.kind === 'beam') continue;
      const copy = [prop.text, prop.heading, ...(prop.lines ?? [])].filter(Boolean).join(' ');
      if (!copy) continue;
      const propWords = words(copy);
      if (!propWords.size) continue;
      const shared = [...propWords].filter((w) => capWords.has(w) && w.length > 3).length;
      /**
       * THREE, NOT TWO — because a label legitimately shares its nouns.
       *
       * "Antikythera · 1901" over a line that says "in 1901 … off Antikythera"
       * is apparatus doing its job: it dates and places the shot, and the
       * narration naturally names the same place. An echo is a SENTENCE said
       * twice, and a sentence shares more than two words with itself.
       */
      if (shared >= 3) {
        warnings.push(
          `scene[${index}] "${scene.id}": the ${prop.kind} and the caption say the same thing — ` +
            `a graphic should carry the apparatus (a date, a place, a number), not repeat the line`,
        );
      }
    }
  });

  /**
   * FRAMING VARIETY.
   *
   * Twelve shots anchored within a few per cent of one another is twelve
   * versions of the same composition, however different the pictures are.
   */
  const anchors = scenes
    .filter((s) => s.params?.anchorX !== undefined)
    .map((s) => `${Math.round((Number(s.params.anchorX) / (config.width ?? 1080)) * 5)}-${Math.round((Number(s.params.anchorY) / (config.height ?? 1920)) * 5)}`);
  if (anchors.length >= 5 && new Set(anchors).size <= 2) {
    warnings.push(
      `framing: ${anchors.length} shots share ${new Set(anchors).size} anchor position(s) — ` +
        `no close-up, no wide, no off-centre composition in the whole reel`,
    );
  }

  /**
   * A GRAPHIC THAT PROVES NOTHING.
   *
   * `wire` and `beam` are the two pure decorations in the vocabulary. A
   * wireframe closing on an even texture encloses nothing; a shaft of light in
   * a shot with no light source is a smear on the lens.
   */
  scenes.forEach((scene, index) => {
    for (const prop of scene.props ?? []) {
      if (prop.kind !== 'beam') continue;
      const dark = Number(scene.params?.glowSize ?? 0) > 0;
      if (!dark) {
        warnings.push(
          `scene[${index}] "${scene.id}": a light beam with no light source in the shot — ` +
            `it proves nothing and reads as a lens smear`,
        );
      }
    }
  });

  return {errors, warnings};
}

/**
 * THE QUALITY GATES.
 *
 * Scored from what the config and the asset ledger actually say, so the number
 * cannot be talked up. A reel below seven on any of these is not production
 * ready, and the gate names the root cause rather than the symptom.
 */
export function qualityGates(config, {assets = {}, fps = config.fps ?? FPS_DEFAULT} = {}) {
  const scenes = config.scenes ?? [];
  const total = Math.max(1, scenes.length);
  const clamp = (n) => Number(Math.max(0, Math.min(10, n)).toFixed(1));

  // ASSET RELEVANCE — the mean of what is actually on screen, weighted by how
  // long each picture is up.
  let weighted = 0;
  let frames = 0;
  for (const scene of scenes) {
    const plate = Object.values(scene.assets ?? {})[0];
    const verdict = plate ? assets[String(plate).split('/').pop()] : null;
    const d = scene.durationInFrames ?? 0;
    frames += d;
    // A shot with no photograph is not penalised: a drawn field chosen on
    // purpose is a correct visual, and this axis is about correctness.
    weighted += d * (verdict ? verdict.score : plate ? 5 : 8);
  }
  /**
   * AND AN AXIS WITH NOTHING ON IT IS NOT A SCORE OF EIGHT.
   *
   * The default said "a shot with no photograph is not penalised", which is
   * right per shot and became a lie per reel: five episodes with no picture in
   * them at all reported assetRelevance 8.0 and passed the gate. The number
   * that was supposed to catch "you are showing the wrong thing" quietly
   * certified "you are showing nothing".
   *
   * So where the reel carries no photograph anywhere, the axis does not apply
   * and says so. It is dropped from the average rather than defaulted into it —
   * a measurement that cannot be taken must not be allowed to vote.
   */
  const photographic = scenes.some((s) => Object.keys(s.assets ?? {}).length > 0);
  const assetRelevance = photographic ? clamp(weighted / Math.max(1, frames)) : null;

  // VISUAL HIERARCHY — does each shot state a primary element, and is there
  // exactly one thing carrying it?
  const withPrimary = scenes.filter((s) => s.params?.captionEmphasis || s.params?.title || s.params?.countTo).length;
  const visualHierarchy = clamp((withPrimary / total) * 10);

  /**
   * MOTION DESIGN — how many shots OBEY LAW 18, not how many events there are.
   *
   * Scored as events per second, this rewarded quantity: three decorative wire
   * frames padded the number as effectively as three designed arrivals, and
   * REMOVING three meaningless graphics — the correct repair — dropped the
   * score by a point. A metric that punishes the right decision is worse than
   * no metric.
   *
   * The law is specific and therefore measurable: every shot gets at least two
   * events, spread out, the first one early; a shot under forty frames is a
   * flash and gets one; a long shot takes no more than five, because "play what
   * matters" is not "play everything".
   */
  const judged = scenes.map((scene) => {
    const list = eventsOf(scene);
    const length = scene.durationInFrames ?? 0;
    const want = length < 40 ? 1 : 2;
    const ceiling = length > 6 * fps ? 5 : 6;
    if (list.length < want) return 0;
    if (list.length > ceiling) return 0.5;
    // Spread: the first event early, and not everything in one moment.
    const early = list[0].at <= Math.max(8, length * 0.25);
    const spread = list.length < 2 || list[list.length - 1].at - list[0].at >= fps * 0.3;
    return early && spread ? 1 : 0.6;
  });
  const motionDesign = clamp((judged.reduce((a, b) => a + b, 0) / Math.max(1, judged.length)) * 10);

  // CAMERA + TRANSITION DIVERSITY — the share of the most-used device.
  const share = (values) => {
    if (!values.length) return 1;
    const tally = {};
    for (const v of values) tally[v] = (tally[v] ?? 0) + 1;
    return Math.max(...Object.values(tally)) / values.length;
  };
  const cameraDiversity = clamp((1 - Math.max(0, share(scenes.map(cameraFamily)) - 0.3) / 0.7) * 10);
  /**
   * TRANSITION QUALITY IS INTENTION, NOT VARIETY.
   *
   * Scoring it as diversity punished the correct answer. A reel of ten shots
   * with three devices and seven plain cuts scored 4.5 out of 10 — because
   * `cut` was the most common arrival and the metric read "most common" as
   * "monotonous". The only way to raise the number was to decorate more seams,
   * which is the failure the metric was supposed to detect.
   *
   * What actually goes wrong is over-editing and domination: past roughly
   * forty per cent decorated there are no plain cuts left to contrast against,
   * and any one device past a quarter of the reel is a template rather than a
   * choice. Both are measured; a reel that is mostly hard cuts scores ten,
   * which is right.
   */
  const arrivalKinds = scenes.slice(1).map((s) => s.transition?.kind ?? 'cut');
  const decorated = arrivalKinds.filter((k) => k !== 'cut');
  const seams = Math.max(1, arrivalKinds.length);
  const stylisedShare = decorated.length / seams;
  const worstDevice = decorated.length ? share(decorated) * (decorated.length / seams) : 0;
  const transitionQuality = clamp(
    10 - (Math.max(0, stylisedShare - 0.4) / 0.6) * 10 - (Math.max(0, worstDevice - 0.25) / 0.75) * 10,
  );

  /**
   * VISUAL CONTINUITY — one accent across the reel, and a grade that does not
   * wander. Measured rather than asserted: the number of distinct accents and
   * the number of scenes that override the episode's grade.
   */
  const accents = new Set(scenes.map((s) => String(s.params?.accent ?? '')).filter(Boolean));
  const overrides = scenes.filter((s) => s.gradeOverride).length;
  const visualContinuity = clamp(10 - (accents.size - 1) * 3 - Math.max(0, overrides - 2) * 1.5);

  /**
   * THE AVERAGE IS TAKEN OVER THE AXES THAT EXIST.
   *
   * Reweighted rather than renormalised against a missing term, so a reel with
   * no photography is judged on the six things it can be judged on instead of
   * being handed three tenths of a score for a picture nobody saw.
   */
  const weights = [
    [assetRelevance, 0.3],
    [visualHierarchy, 0.15],
    [motionDesign, 0.15],
    [cameraDiversity, 0.13],
    [transitionQuality, 0.12],
    [visualContinuity, 0.15],
  ].filter(([v]) => v !== null);
  const weighting = weights.reduce((n, [, w]) => n + w, 0);
  const professionalism = clamp(weights.reduce((n, [v, w]) => n + v * w, 0) / weighting);

  const gates = {
    ...(assetRelevance === null ? {} : {assetRelevance}),
    visualHierarchy,
    motionDesign,
    cameraDiversity,
    transitionQuality,
    visualContinuity,
    professionalism,
  };
  const failed = Object.entries(gates)
    .filter(([, v]) => v < 7)
    .map(([k, v]) => `${k} ${v}/10`);
  /**
   * AND A REEL WITH NO PICTURE IN IT IS NOT PRODUCTION READY, whatever the six
   * remaining axes say. This is not a score; it is a fact about the reel.
   */
  if (!photographic) failed.push('no photograph anywhere in the reel — every shot is drawn or typeset');
  return {gates, failed, productionReady: failed.length === 0, photographic};
}

/* ══════════════════════════════════════════════════════════════════════════
 * THIRD STAGE — geometry, representation, and the ending.
 *
 * These check things that are TRUE OR FALSE about the config rather than
 * matters of taste: a circle whose bounding box leaves the frame does not
 * enclose its subject, and no amount of art direction makes it do so.
 * ══════════════════════════════════════════════════════════════════════════ */

/**
 * WHERE A DRAWN THING ACTUALLY SITS, in frame pixels.
 *
 * Returned as a box so the clipping check can be arithmetic instead of a human
 * squinting at a contact sheet. The moon's dashed orbit had its top outside the
 * composition for two whole renders and passed every check in this file,
 * because nothing in here knew where anything was.
 */
export function boundsOf(scene, {width, height}) {
  const out = [];
  const p = scene.params ?? {};
  const n = (v, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);

  for (const [i, prop] of (scene.props ?? []).entries()) {
    const w = n(prop.width, width * 0.42);
    const x = n(prop.x, width * 0.5);
    const y = n(prop.y, height * 0.55);
    /**
     * A BEAM HAS NO BOUNDS TO CHECK.
     *
     * It is a shaft of light from a source outside the composition: it enters
     * at the top edge, spills past the sides and reaches the floor, and every
     * one of those is the point rather than a fault. Bounding it reported six
     * shots across four episodes as clipped, all of them correct as drawn — and
     * a check that is wrong about the easy case will be ignored on the hard one.
     */
    if (prop.kind === 'beam') continue;
    /**
     * PAPER IS WIDE AND SHORT; A WIRE IS SQUARE.
     *
     * A plaque modelled as a square of its own width is reported as reaching a
     * third of the way down the frame, which it does not — and a check that
     * flags things that are fine is a check people switch off.
     */
    const tall = prop.kind === 'wire' ? w : w * (prop.kind === 'plaque' ? 0.34 : 0.72);
    out.push({what: `prop[${i}] ${prop.kind}`, role: 'drawn', left: x - w / 2, right: x + w / 2, top: y - tall / 2, bottom: y + tall / 2});
  }

  if (p.mark) {
    const x = n(p.markX, 84);
    const y = n(p.markY, height * 0.4);
    out.push({
      /**
       * A MARK IS TYPOGRAPHY, NOT A GRAPHIC.
       *
       * A highlight, an underline and a box are drawn ON the emphasis word —
       * touching the type is the entire function. It is bounded like everything
       * else so it cannot leave the frame, but it is not something that can
       * collide with a sentence.
       */
      what: 'mark',
      role: 'type-mark',
      left: x,
      right: x + n(p.markWidth, width * 0.4),
      top: y,
      bottom: y + n(p.markHeight, 96),
    });
  }

  const d = scene.diagram;
  if (d?.type === 'orbit') {
    const cx = n(d.cx, 0.5) * width;
    const cy = n(d.cy, 0.45) * height;
    const r = n(d.radius, 0.3) * width;
    out.push({what: 'diagram orbit', role: 'drawn', left: cx - r, right: cx + r, top: cy - r, bottom: cy + r});
  }
  /**
   * A DERIVED TRAIN IS STILL GEOMETRY.
   *
   * This only ran when the config DECLARED its wheels, and the planner deletes
   * them so the engine can lay the train out from a count. So the check was
   * live on the case that never happens and silent on the one that always
   * does — and a rendered reel shipped with two wheels cut in half by the right
   * edge. The layout comes from the shared module, so the check measures the
   * same wheels the renderer draws.
   */
  if (d?.type === 'gearSystem') {
    const gears = Array.isArray(d.gears) && d.gears.length ? d.gears : gearTrainLayout(d.count ?? 8);
    for (const [i, g] of gears.entries()) {
      const r = n(g.radius, 0.15) * width;
      out.push({
        what: `diagram gear[${i}]`,
        role: 'drawn',
        camera: true,
        left: n(g.x, 0.5) * width - r,
        right: n(g.x, 0.5) * width + r,
        top: n(g.y, 0.5) * height - r,
        bottom: n(g.y, 0.5) * height + r,
      });
    }
  }
  /**
   * THE NEW DRAWINGS HAVE GEOMETRY TOO.
   *
   * Added five representations and the clipping check knew about none of them,
   * which is how a cross-section shipped with its band label reading "SURFA" —
   * the callout, its leader and its text ran past the right edge and nothing
   * measured it. Each of these mirrors the box its component lays out in.
   */
  if (d?.type === 'map') {
    // The plate uses the whole frame by design; what can leave it is a marker
    // label, so those are bounded rather than the coastlines.
    for (const [i, marker] of (d.markers ?? []).entries()) {
      const mx = n(marker.x, 0.5) * width;
      const my = n(marker.y, 0.5) * height;
      const text = String(marker.label ?? '').length * width * 0.013;
      // Past the midpoint the component hangs the label to the LEFT of its dot,
      // so the box has to follow it there or the check measures the wrong side.
      const flips = n(marker.x, 0.5) > 0.62;
      out.push({
        what: `map marker[${i}]`,
        role: 'drawn',
        left: flips ? mx - width * 0.018 - text : mx,
        right: flips ? mx : mx + width * 0.018 + text,
        top: my - 40,
        bottom: my + 40,
      });
    }
  }
  if (d?.type === 'crossSection') {
    out.push({what: 'diagram section', role: 'drawn', camera: true, left: width * 0.12, right: width * 0.88, top: height * 0.24, bottom: height * 0.66});
  }
  if (d?.type === 'anatomyFlow') {
    for (const [i, chamber] of (d.chambers ?? []).entries()) {
      const cx = n(chamber.x, 0.5) * width;
      const cy = n(chamber.y, 0.5) * height;
      const rx = n(chamber.rx, 0.08) * width;
      const ry = n(chamber.ry, 0.05) * height;
      out.push({what: `chamber[${i}]`, role: 'drawn', camera: true, left: cx - rx, right: cx + rx, top: cy - ry, bottom: cy + ry});
    }
  }
  if (d?.type === 'scaleHaulage') {
    /**
     * The same arithmetic the plate does, and it has to STAY the same: this
     * check reported a load eighty pixels off the left edge that was in fact
     * eighty-six pixels inside it, because the plate had been rewritten to haul
     * leftward from the right margin and the bounds were still measuring a
     * load that started at a third of the frame and travelled right.
     */
    const ow = n(d.object?.w, 0.3) * width;
    const oh = n(d.object?.h, 0.08) * height;
    const ground = height * 0.62;
    const humans = Math.max(0, n(d.humans, 2));
    const margin = width * 0.07;
    const leadPad = width * (0.05 + Math.max(0, humans - 1) * 0.045) + width * 0.035;
    const endLeft = margin + leadPad;
    const travelPx = Math.max(0, Math.min(n(d.travel, 0.14) * width, width - margin - endLeft - ow));
    out.push({what: 'haulage load', role: 'drawn', camera: true, left: endLeft, right: endLeft + travelPx + ow, top: ground - oh * 2, bottom: ground});
    const figW = width * 0.035;
    const leadX = endLeft - width * 0.05;
    out.push({
      what: 'haulage lead figure',
      role: 'drawn',
      camera: true,
      left: leadX - figW / 2,
      right: leadX + figW / 2,
      top: ground - n(d.humanHeight, 0.03) * height,
      bottom: ground,
    });
  }
  if (d?.type === 'process') {
    out.push({what: 'process object', role: 'drawn', camera: true, left: width * 0.2, right: width * 0.8, top: height * 0.3, bottom: height * 0.54});
  }
  if (d?.type === 'timeline') {
    // The rule is drawn at x = 0.3w between 0.24h and 0.78h, and its labels
    // reach to the right of it. Hard-coded in the component; mirrored here.
    out.push({what: 'diagram timeline', role: 'drawn', left: width * 0.27, right: width * 0.62, top: height * 0.22, bottom: height * 0.8});
  }

  /**
   * THE SLATE'S TYPE IS TYPE.
   *
   * Missing from the bounds entirely, which is why a dashed frame prop was
   * drawn straight through "FOURTEEN HUNDRED" and out the other side, striking
   * the footer through as it went, in a finished reel.
   */
  if (p.title || p.spinTo) {
    const size = n(p.titleSize, width * 0.115);
    const cy = n(p.titleY, height * 0.5);
    out.push({
      what: 'slate title',
      role: 'type',
      left: width * 0.08,
      right: width * 0.92,
      top: cy - size * 0.85,
      bottom: cy + size * 0.85 + (p.footer ? size * 0.8 : 0),
    });
  }
  if (p.motif) {
    const mw = n(p.motifSize, width * 0.3);
    out.push({
      what: `motif ${p.motif}`,
      role: 'drawn',
      left: n(p.motifX, width * 0.5) - mw / 2,
      right: n(p.motifX, width * 0.5) + mw / 2,
      top: n(p.motifY, height * 0.45) - mw / 2,
      bottom: n(p.motifY, height * 0.45) + mw / 2,
    });
  }

  const caption = Array.isArray(p.caption) ? p.caption : [];
  if (caption.length) {
    const size = n(p.captionSize, 88);
    const x = n(p.captionX, 84);
    out.push({
      what: 'caption',
      role: 'type',
      left: x,
      // The emphasis word is set larger than the rest, which is what put
      // "THIRTY GEARS" through the right edge of the frame.
      right: x + Math.max(...caption.map((l) => l.length)) * size * 0.58 * 1.16,
      top: n(p.captionY, 300),
      bottom: n(p.captionY, 300) + caption.length * size * 1.3,
    });
  }
  return out;
}


/**
 * WHERE THE DRAWING ACTUALLY IS, once the shot's camera has moved.
 *
 * Every box this file measures is measured AT REST, and for two years that was
 * the whole check. Then the drawings started taking the camera, and a magnified
 * cross-section composed to fit the frame exactly was panned two hundred and
 * sixty pixels and delivered with its right half outside the picture — through
 * a clipping checker whose entire job is that, because the checker was looking
 * at where the section would have been if nothing had moved.
 *
 * So the boxes go through the same transform the plates do, at the extremes:
 * both ends of the push, and the pan at full reach. Conservative on purpose. A
 * drawing is not a window onto a larger scene — there is nothing outside it to
 * pan onto — so a camera that takes any part of it off the edge is a camera
 * that has cropped the shot, whichever frame it happens on.
 *
 * Only DRAWN boxes: photographic plates have picture outside the frame, which
 * is the whole reason a push on one is free.
 */
const DIAGRAM_PUSH_SHARE = 0.3;
const DIAGRAM_PAN_DEPTH = 0.24;
/**
 * AND A CEILING, because a share of a portal is still a portal.
 *
 * One shot pushes from 1 to 6.4 — a zoom THROUGH a photographic plate into what
 * is behind it, which is free on a photograph because there is more picture
 * outside the frame. Three tenths of that is still 2.6, and a gear train at 2.6
 * is four wheels and the edges of three others. A drawing never enlarges by
 * more than the amount its own margins can absorb.
 */
const DIAGRAM_PUSH_CAP = 1.18;

export function throughTheCamera(scene, boxes, {width, height}) {
  const p = scene.params ?? {};
  const n = (v, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
  if (!scene.diagram) return boxes;
  const ox = n(p.anchorX, width * 0.5);
  const oy = n(p.anchorY, height * 0.55);
  /**
   * HOW MUCH OF THE SHOT'S CAMERA THIS DRAWING CAN AFFORD.
   *
   * Written into the scene by the planner, which is the only place that knows
   * both the camera and the drawing's extent. Absent means the full share.
   */
  const k = Math.max(0, Math.min(1, n(p.diagramCamera, 1)));
  const share = (v) => Math.min(DIAGRAM_PUSH_CAP, 1 + (n(v, 1) - 1) * DIAGRAM_PUSH_SHARE * k);
  const scales = [share(p.pushFrom), share(p.pushTo)];
  const dxs = [0, n(p.panX, 0) * DIAGRAM_PAN_DEPTH * k];
  const dys = [0, n(p.panY, 0) * DIAGRAM_PAN_DEPTH * k];
  return boxes.map((box) => {
    if (!box.camera) return box;
    let left = Infinity;
    let right = -Infinity;
    let top = Infinity;
    let bottom = -Infinity;
    for (const s of scales) {
      for (const dx of dxs) {
        for (const dy of dys) {
          left = Math.min(left, ox + (box.left - ox) * s + dx);
          right = Math.max(right, ox + (box.right - ox) * s + dx);
          top = Math.min(top, oy + (box.top - oy) * s + dy);
          bottom = Math.max(bottom, oy + (box.bottom - oy) * s + dy);
        }
      }
    }
    return {...box, left, right, top, bottom};
  });
}

/**
 * CLIPPING AND SAFE AREA, checked rather than eyeballed.
 *
 * The safe area on a vertical short is not the frame: the platform draws its
 * own caption, handle and buttons over the bottom eighth and a progress bar
 * across the very bottom. Type that is technically inside the composition and
 * underneath a share button is type nobody reads.
 */
export function clippingProblems(config) {
  const width = config.width ?? 1080;
  const height = config.height ?? 1920;
  const safe = {top: height * 0.04, bottom: height * 0.9, left: 40, right: width - 40};
  const errors = [];
  const warnings = [];

  (config.scenes ?? []).forEach((scene, index) => {
    for (const box of throughTheCamera(scene, boundsOf(scene, {width, height}), {width, height})) {
      const where = `scene[${index}] "${scene.id}": ${box.what}`;
      // OUTSIDE THE FRAME is an error: it is not a judgement, the thing is
      // partly not there.
      if (box.left < 0 || box.right > width || box.top < 0 || box.bottom > height) {
        errors.push(
          `${where} leaves the frame ` +
            `(${Math.round(box.left)},${Math.round(box.top)})–(${Math.round(box.right)},${Math.round(box.bottom)}) ` +
            `of ${width}x${height}`,
        );
        continue;
      }
      if (box.top < safe.top || box.bottom > safe.bottom || box.left < safe.left || box.right > safe.right) {
        warnings.push(`${where} sits outside the safe area — the platform draws its own furniture there`);
      }
    }

    /**
     * AND NOTHING IS DRAWN THROUGH THE WORDS.
     *
     * Clipping asks whether a thing is in the frame. This asks whether two
     * things are in the SAME PLACE, which is the other half of the same law and
     * the half that shipped: a dashed frame ruled straight through "FOURTEEN
     * HUNDRED" and struck the footer out on its way past, and a tally motif was
     * stacked on top of a timeline's first ticks. Both were obvious in one
     * still and invisible to every check, because every check knew where one
     * object was and none compared two.
     *
     * Type wins. A drawn object can be behind a photograph or beside a rule; it
     * cannot be through a sentence, because the sentence is the only part of
     * the shot the viewer has to READ.
     */
    const boxes = boundsOf(scene, {width, height});
    const type = boxes.filter((b) => b.role === 'type');
    const drawn = boxes.filter((b) => b.role === 'drawn');
    for (const t of type) {
      for (const g of drawn) {
        const over = overlap(t, g);
        if (over > 0.16) {
          errors.push(
            `scene[${index}] "${scene.id}": ${g.what} is drawn through ${t.what} ` +
              `(${Math.round(over * 100)}% of the type) — a graphic may not cross a sentence`,
          );
        } else if (over > 0.04) {
          warnings.push(`scene[${index}] "${scene.id}": ${g.what} touches ${t.what}`);
        }
      }
    }
    // Two drawn objects in one place are a collision too, just a quieter one.
    for (let i = 0; i < drawn.length; i += 1) {
      for (let j = i + 1; j < drawn.length; j += 1) {
        if (overlap(drawn[i], drawn[j]) > 0.35 && !drawn[i].what.startsWith('diagram gear')) {
          warnings.push(
            `scene[${index}] "${scene.id}": ${drawn[i].what} and ${drawn[j].what} occupy the same place`,
          );
        }
      }
    }
  });
  return {errors, warnings};
}

/** How much of `a` is covered by `b`, as a fraction of `a`'s area. */
function overlap(a, b) {
  const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
  const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  if (w <= 0 || h <= 0) return 0;
  const area = Math.max(1, (a.right - a.left) * (a.bottom - a.top));
  return (w * h) / area;
}

/**
 * THE ENDING, checked hard.
 *
 * A reel that stops is not a reel that ends. The last shot has to carry a
 * claim, show something, and then be quiet for long enough that the claim is
 * the last thing in the viewer's head rather than the cut.
 */

/**
 * CAN YOU SEE IT — the check for a drawing that is technically all present.
 *
 * A schematic of a human heart was delivered with its four chambers rendered as
 * grey discs against a wash running from bright ochre at the top of the frame.
 * Every existing check passed it. The chambers were inside the frame, inside
 * the safe area, correctly sized, not colliding with anything, valid at every
 * frame, and part of a sequence with good rhythm. They were also nearly the
 * same value as the air beside them, and the brightest thing in a shot about a
 * heart was the empty background.
 *
 * The measurement is relative luminance, the same one an accessibility contrast
 * ratio uses, because the question is the same question: can the eye separate
 * these two surfaces. A drawing is line work — it has no mass to carry itself
 * on — so it needs its ground to be a long way from its ink.
 *
 * Only DRAWN shots. Where a photograph survived, the local luminance behind any
 * given stroke is not knowable from the config, and a check that guesses is a
 * check that cries wolf.
 */
function luminance(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex ?? ''));
  if (!m) return null;
  const v = Number.parseInt(m[1], 16);
  const lin = [(v >> 16) & 255, (v >> 8) & 255, v & 255]
    .map((c) => c / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

/** The WCAG ratio, which is the number people have intuitions about. */
function contrastRatio(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  if (la === null || lb === null) return null;
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export function contrastProblems(config) {
  const errors = [];
  const warnings = [];
  (config.scenes ?? []).forEach((scene, index) => {
    const d = scene.diagram;
    if (!d) return;
    // A drawing over a surviving photograph is a hybrid; the ground is the
    // picture, and this file cannot read a picture.
    if ((scene.layers ?? []).length) return;
    const ground = (scene.params?.fieldColours ?? []).map(luminance).filter((v) => v !== null);
    if (!ground.length) return;
    /**
     * The BRIGHTEST stop, because a gradient shows all of them and the drawing
     * has to survive the worst part of it, not the average.
     */
    const lit = Math.max(...ground);
    const where = `scene[${index}] "${scene.id}"`;
    const inks = [
      ['accent', d.accent ?? scene.params?.accent],
      ['muted', d.muted ?? '#cfc6ae'],
    ].filter(([, hex]) => luminance(hex) !== null);
    if (!inks.length) return;
    const worst = inks
      .map(([name, hex]) => ({name, hex, ratio: (Math.max(lit, luminance(hex)) + 0.05) / (Math.min(lit, luminance(hex)) + 0.05)}))
      .sort((a, b) => a.ratio - b.ratio)[0];
    /**
     * 3:1 is the floor for a graphical object in the accessibility guidelines
     * and it is the right floor here too: below it the drawing is a shape you
     * can find if you already know where it is.
     */
    if (worst.ratio < 3) {
      errors.push(
        `${where}: the ${d.type} has no contrast against its ground — ` +
          `${worst.name} ${worst.hex} against the field's brightest stop is ${worst.ratio.toFixed(1)}:1`,
      );
    } else if (worst.ratio < 4.5) {
      warnings.push(
        `${where}: the ${d.type} is close in value to its ground (${worst.name} at ${worst.ratio.toFixed(1)}:1)`,
      );
    }
  });
  return {errors, warnings};
}

export function endingProblems(config, {fps = config.fps ?? FPS_DEFAULT} = {}) {
  const scenes = config.scenes ?? [];
  const last = scenes[scenes.length - 1];
  const errors = [];
  const warnings = [];
  if (!last) return {errors, warnings};

  const p = last.params ?? {};
  /**
   * A FIXTURE IS NOT A REEL.
   *
   * The ending gate is about a short that has to land; an eight-second,
   * two-scene test config has no ending to get wrong, and failing it teaches
   * people that the gate is noise.
   */
  const isReel = scenes.length >= 4;
  const claim = p.title || p.captionEmphasis || p.countTo || p.spinTo;
  if (!claim) {
    (isReel ? errors : warnings).push('ending: the last shot states no claim — the reel simply stops');
  }

  const shows = Object.keys(last.assets ?? {}).length > 0 || last.diagram || p.field || (last.props ?? []).length;
  if (!shows) warnings.push('ending: the last shot has nothing in it but words');

  const events = eventsOf(last);
  const lastAt = events.length ? events[events.length - 1].at : 0;
  const hold = ((last.durationInFrames ?? 0) - lastAt) / fps;
  if (hold < 0.7) {
    (isReel ? errors : warnings).push(
      `ending: only ${hold.toFixed(1)}s between the last event and the cut — ` +
        `a claim needs silence after it or the edit swallows it`,
    );
  }
  return {errors, warnings};
}

/**
 * REPRESENTATION COVERAGE.
 *
 * Reported rather than judged: how the reel chose to show things. A reel that
 * is all photographs has probably settled for some of them; a reel that is all
 * diagrams has stopped being a documentary and become a lecture.
 */
export function representationMix(config) {
  const scenes = config.scenes ?? [];
  const mix = {PHOTO: 0, HYBRID: 0, PROCEDURAL: 0, TYPOGRAPHY: 0};
  for (const scene of scenes) {
    const photo = Object.keys(scene.assets ?? {}).length > 0;
    const drawn = Boolean(scene.diagram);
    if (photo && drawn) mix.HYBRID += 1;
    else if (drawn) mix.PROCEDURAL += 1;
    else if (photo) mix.PHOTO += 1;
    else mix.TYPOGRAPHY += 1;
  }
  return mix;
}
