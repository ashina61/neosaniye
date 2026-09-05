/*
 * Ink Puppet — plays real motion-capture "clips" (baked by mocap/bvh2clip.mjs)
 * onto a hand-drawn stick figure. Deterministic + seek-safe for HyperFrames.
 *
 * The agent never hand-tunes motion. It just:
 *   var p = InkPuppet.create(mount, {cx, ground});
 *   p.drawIn(tl, {start:0.3});                    // pencil sketches the figure
 *   InkPuppet.choreograph(tl, p, [                // then plays named mocap clips
 *     {clip:'wave', dur:3},
 *     {clip:'twist', dur:3},
 *     {clip:'jump', dur:3.5},
 *     {clip:'walk', dur:4}
 *   ], {start:2.6});
 *
 * Clip names must exist in mocap/catalog.json (unknown names warn + hold).
 *
 * Clips come from window.INK_CLIPS (load clips.js). Motion = professional mocap.
 */
(function (root) {
  "use strict";
  var NS = "http://www.w3.org/2000/svg";
  var GR = "#333";
  function el(tag, a) { var n = document.createElementNS(NS, tag); if (a) for (var k in a) n.setAttribute(k, a[k]); return n; }
  function P(pt) { return (Math.round(pt[0] * 10) / 10) + " " + (Math.round(pt[1] * 10) / 10); }

  var STAND = {
    hips: [0, 0], chest: [0, -88], neck: [0, -150], head: [0, -182],
    // L on +x, R on -x. That is the handedness every clip in mocap/clips.js
    // uses, and STAND had it the other way round: a figure that carries
    // something in its L hand carried it on the wrong side of the screen until
    // the first clip started, then jumped across the body.
    shR: [-52, -140], elR: [-64, -58], haR: [-72, 26], shL: [52, -140], elL: [64, -58], haL: [72, 26],
    hipR: [-26, -6], knR: [-32, 120], ftR: [-40, 262], hipL: [26, -6], knL: [32, 120], ftL: [40, 262],
    rootY: 0, groundY: 262
  };

  /* Every clip in mocap/clips.js opens with the skeleton's rest pose — arms
     straight out sideways — because that is the first frame of the BVH the
     converter read. It is one frame at 30fps, so it never shows up in a still;
     it shows up in the render as a T-pose flashing on for a single frame every
     time a segment starts. Measured against each clip's own median hand span
     the rest frame stands out by 2x to 11x, so it can be found rather than
     hard-coded, and it is dropped once, on first use, for every clip at once.

     Frame numbering shifts by one when this runs. Anything that names a frame
     index — InkPuppet.still() in particular — is numbering the trimmed clip. */
  var prepared = false;
  function prepare() {
    if (prepared) return;
    var CLIPS = root.INK_CLIPS;
    if (!CLIPS) return;                     // clips.js not loaded yet; try later
    prepared = true;
    Object.keys(CLIPS).forEach(function (k) {
      var c = CLIPS[k], F = c.frames;
      if (!F || F.length < 4) return;
      var span = F.map(function (f) { return Math.hypot(f.haL[0] - f.haR[0], f.haL[1] - f.haR[1]); });
      var med = span.slice().sort(function (a, b) { return a - b; })[span.length >> 1];
      var drop = 0;
      while (drop < 3 && span[drop] > med * 1.6) drop++;
      if (!drop) return;
      c.frames = F.slice(drop);
      c.frameCount = c.frames.length;
    });
  }

  function create(mount, opts) {
    prepare();
    opts = opts || {};
    var cx = opts.cx != null ? opts.cx : 960, ground = opts.ground != null ? opts.ground : 900;
    var sw = opts.strokeWidth || 6, headR = opts.headR || 46;
    var outer = el("g", {});
    var ink = el("g", opts.boil ? { filter: "url(#" + opts.boil + ")" } : {});
    var head = el("circle", { fill: "none", stroke: GR, "stroke-width": sw });
    function limb() { return el("path", { fill: "none", stroke: GR, "stroke-width": sw, "stroke-linecap": "round", "stroke-linejoin": "round" }); }
    var spine = limb(), armL = limb(), armR = limb(), legL = limb(), legR = limb();
    [spine, armL, armR, legL, legR, head].forEach(function (e) { ink.appendChild(e); });
    outer.appendChild(ink); mount.appendChild(outer);
    var parts = { head: head, spine: spine, armL: armL, armR: armR, legL: legL, legR: legR };
    var pup = {
      outer: outer, ink: ink, parts: parts, cx: cx, ground: ground, headR: headR,
      setPose: function (po) {
        head.setAttribute("cx", po.head[0]); head.setAttribute("cy", po.head[1] - headR * 0.32); head.setAttribute("r", headR);
        spine.setAttribute("d", "M " + P(po.hips) + " L " + P(po.chest) + " L " + P(po.neck) + " L " + P([po.head[0], po.head[1] + headR * 0.5]));
        armR.setAttribute("d", "M " + P(po.shR) + " L " + P(po.elR) + " L " + P(po.haR));
        armL.setAttribute("d", "M " + P(po.shL) + " L " + P(po.elL) + " L " + P(po.haL));
        legR.setAttribute("d", "M " + P(po.hipR) + " L " + P(po.knR) + " L " + P(po.ftR));
        legL.setAttribute("d", "M " + P(po.hipL) + " L " + P(po.knL) + " L " + P(po.ftL));
      },
      // originX/originY are where the pose's own (0,0) currently sits on the
      // page. Anything outside the figure that has to meet its hand — a door
      // handle, a crank, a rung — needs them to convert a page point into pose
      // coordinates, and they change every frame because rootY does.
      originX: cx, originY: ground,
      place: function (groundY, rootY) {
        pup.originY = ground - groundY + (rootY || 0);
        outer.setAttribute("transform", "translate(" + cx + "," + pup.originY + ")");
      },
      // pencil sketches the figure limb-by-limb, then holds
      drawIn: function (tl, o) {
        o = o || {}; var t0 = o.start != null ? o.start : 0.3, each = o.each || 0.55;
        pup.setPose(STAND); pup.place(STAND.groundY, 0);
        var seq = [head, spine, armL, armR, legL, legR], done = t0 + seq.length * each * 0.6 + each;
        seq.forEach(function (e, i) {
          var L = e.getTotalLength(); e.style.strokeDasharray = L; e.style.strokeDashoffset = L;
          tl.to(e, { strokeDashoffset: 0, duration: each, ease: "power1.inOut" }, t0 + i * each * 0.6);
        });
        seq.forEach(function (e) { tl.set(e, { strokeDasharray: "none" }, done); });
        pup._revealEnd = done;
        return done;
      }
    };
    pup.setPose(STAND); pup.place(STAND.groundY, 0);
    return pup;
  }

  // Sequence named mocap clips on the timeline. Each clip loops at native fps to
  // fill its duration. Seek-safe: pose is a pure function of the segment's local time.
  function choreograph(tl, pup, segments, opts) {
    prepare();
    opts = opts || {};
    var t = opts.start != null ? opts.start : 0;
    var CLIPS = root.INK_CLIPS || {};
    segments.forEach(function (seg) {
      var clip = CLIPS[seg.clip];
      if (!clip) {
        console.warn('[InkPuppet] unknown clip "' + seg.clip + '" — skipping ' + seg.dur + 's (holds pose). Known clips: ' + Object.keys(CLIPS).join(", "));
        t += seg.dur; return;
      }
      var proxy = { u: 0 };
      tl.to(proxy, {
        u: 1, duration: seg.dur, ease: "none",
        onUpdate: function () {
          var lt = proxy.u * seg.dur;
          var idx = Math.floor(lt * clip.fps);
          idx = seg.loop === false ? Math.min(idx, clip.frames.length - 1) : idx % clip.frames.length;
          var fr = clip.frames[idx];
          pup.setPose(fr);
          pup.place(clip.groundY, fr.rootY || 0);
        }
      }, t);
      t += seg.dur;
    });
    return t;
  }

  /* A standing pose, taken from a real clip rather than invented.
     STAND is hand-authored and a different size from the mocap (its ground is
     262 against the clips' ~344), so holding it between segments visibly
     shrinks the figure. `still("walk", 83)` registers a one-frame clip built
     from a frame where the feet are together and the arms hang — same
     skeleton, same scale, same handedness as the clip it came from — so a
     character can stand still in the middle of a shot and stay the same
     character.

       InkPuppet.still("walk", 83);                       // registers "still"
       InkPuppet.choreograph(tl, pup, [
         { clip: "walk",  dur: 3.2 },
         { clip: "still", dur: 2.8 },                     // stands and works
         { clip: "walk",  dur: 2.0 }
       ], { start: 3.2 });                                                    */
  function still(clipName, frameIndex, asName) {
    prepare();
    var CLIPS = root.INK_CLIPS || (root.INK_CLIPS = {});
    var src = CLIPS[clipName];
    if (!src) throw new Error('[InkPuppet] still(): unknown clip "' + clipName + '"');
    var name = asName || "still";
    var fr = src.frames[frameIndex % src.frames.length];
    // A clip's groundY is one number for the whole clip — the lowest the feet
    // ever get — so any single frame from it is usually a few units off the
    // floor. A still has to stand ON the floor, so take the ground from the
    // frame itself.
    var gy = Math.max(fr.ftL[1], fr.ftR[1]) + (fr.rootY || 0);
    CLIPS[name] = { name: name, fps: src.fps, height: src.height, groundY: gy,
                    frameCount: 1, frames: [fr] };
    return name;
  }

  root.InkPuppet = { create: create, choreograph: choreograph, still: still,
                     prepare: prepare, STAND: STAND };
})(window);
