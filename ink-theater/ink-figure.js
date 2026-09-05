/*
 * Ink Figure — a properly drawn character on top of an Ink Puppet rig.
 *
 * InkPuppet gives you motion: it plays real motion-capture clips and hands you a
 * pose — sixteen joint positions — every frame. What it draws from that pose is
 * a wireframe: six uniform-width strokes and a circle. That is correct for a
 * capability demo and wrong for a channel, because a wireframe reads as a
 * placeholder no matter how good the motion under it is.
 *
 * This module replaces the drawing and keeps the motion. Same rig, same clips,
 * same determinism; a brush instead of a pen.
 *
 *   var pup = InkPuppet.create(mount, { cx: 540, ground: 1180, boil: "boil" });
 *   var fig = InkFigure.attach(pup, { headR: 46 });
 *   fig.pencilIn(tl, { start: 0.15 });     // the rough sketch draws itself
 *   fig.inkIn(tl, { at: 2.20 });           // then the ink goes on over it
 *   InkPuppet.choreograph(tl, pup, [...], { start: 6.0 });
 *
 * What it adds over the wireframe:
 *   · a torso with a silhouette instead of a spine line
 *   · limbs as tapered brush ribbons — thick at the shoulder, thin at the wrist
 *   · hands and feet, which is most of what separates a person from a diagram
 *   · a face on ONE side of the head, so the figure has a facing and a turn is
 *     legible; a symmetrical stick figure has neither
 *   · a two-stage reveal: pencil under-drawing first, then ink over it
 *
 * Determinism: every path is a pure function of the pose, rebuilt each frame.
 * No random per frame, no accumulated state, seek-safe like the rig it wraps.
 */
(function (root) {
  "use strict";
  var NS = "http://www.w3.org/2000/svg";

  function el(tag, a, parent) {
    var n = document.createElementNS(NS, tag);
    for (var k in a) n.setAttribute(k, a[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function r2(x) { return Math.round(x * 100) / 100; }
  function lerp(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; }
  function nudge(p, dx, dy) { return [p[0] + dx, p[1] + dy]; }

  /* Catmull-Rom through the points, as cubic Béziers. Local copy so the module
     does not depend on which helpers InkTheater happens to export. */
  function smooth(pts, closed) {
    if (pts.length < 2) return "";
    var P = closed ? pts.concat([pts[0]]) : pts;
    var d = "M" + r2(P[0][0]) + " " + r2(P[0][1]), n = P.length, i;
    for (i = 0; i < n - 1; i++) {
      var p0 = P[i - 1] || (closed ? P[n - 2] : P[i]), p1 = P[i], p2 = P[i + 1];
      var p3 = P[i + 2] || (closed ? P[1] : p2);
      d += "C" + r2(p1[0] + (p2[0] - p0[0]) / 6) + " " + r2(p1[1] + (p2[1] - p0[1]) / 6) +
           " " + r2(p2[0] - (p3[0] - p1[0]) / 6) + " " + r2(p2[1] - (p3[1] - p1[1]) / 6) +
           " " + r2(p2[0]) + " " + r2(p2[1]);
    }
    return d + (closed ? "Z" : "");
  }

  function resample(pts, step) {
    var out = [pts[0]], acc = 0, prev = pts[0], i;
    for (i = 1; i < pts.length; i++) {
      var p = pts[i], dx = p[0] - prev[0], dy = p[1] - prev[1], d = Math.hypot(dx, dy);
      while (acc + d >= step && d > 1e-6) {
        var t = (step - acc) / d;
        prev = [prev[0] + dx * t, prev[1] + dy * t];
        out.push(prev);
        dx = p[0] - prev[0]; dy = p[1] - prev[1]; d = Math.hypot(dx, dy); acc = 0;
      }
      acc += d; prev = p;
    }
    out.push(pts[pts.length - 1]);
    return out;
  }

  /* A brush stroke that is thick at one end and thin at the other. InkTheater's
     own inkRibbon swells in the middle and thins at BOTH ends, which is right
     for a drawn line and wrong for a limb — an arm is widest at the shoulder. */
  function taper(pts, w0, w1, step) {
    var P = resample(pts, step || 16), n = P.length, left = [], right = [], i;
    for (i = 0; i < n; i++) {
      var a = P[Math.max(0, i - 1)], b = P[Math.min(n - 1, i + 1)];
      var tx = b[0] - a[0], ty = b[1] - a[1], L = Math.hypot(tx, ty) || 1;
      var nx = -ty / L, ny = tx / L;
      var t = n > 1 ? i / (n - 1) : 0;
      var hw = (w0 + (w1 - w0) * t) / 2;
      left.push([P[i][0] + nx * hw, P[i][1] + ny * hw]);
      right.push([P[i][0] - nx * hw, P[i][1] - ny * hw]);
    }
    // round the thin end so a limb finishes in a nib rather than a chisel
    var tip = P[n - 1], back = P[n - 2] || P[0];
    var tvx = tip[0] - back[0], tvy = tip[1] - back[1], tL = Math.hypot(tvx, tvy) || 1;
    var cap = [tip[0] + (tvx / tL) * (w1 / 2), tip[1] + (tvy / tL) * (w1 / 2)];
    return smooth(left, false) + " L" + r2(cap[0]) + " " + r2(cap[1]) + " " +
           smooth(right.reverse(), false).replace(/^M/, "L") + "Z";
  }

  /* 2D FABRIK, with the elbow forced onto the side the motion capture already
     has it. FABRIK on its own has no elbow preference — it seeds the chain
     straight and the joint can flip between frames, which reads as the arm
     snapping inside out. Taking the side from the mocap pose keeps the IK arm
     continuous with the body it is attached to. */
  function reachArm(sh, el0, ha0, target) {
    var L1 = Math.hypot(el0[0] - sh[0], el0[1] - sh[1]);
    var L2 = Math.hypot(ha0[0] - el0[0], ha0[1] - el0[1]);
    var pts = root.InkTheater.fabrik([L1, L2], sh, target);
    var elbow = pts[1], hand = pts[2];
    function side(a, b, c) {   // sign of (b-a) x (c-a)
      return Math.sign((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]));
    }
    var want = side(sh, ha0, el0), got = side(sh, hand, elbow);
    if (want !== 0 && got !== 0 && want !== got) {
      // mirror the elbow across the shoulder-to-hand axis
      var ax = hand[0] - sh[0], ay = hand[1] - sh[1], aL2 = ax * ax + ay * ay || 1;
      var vx = elbow[0] - sh[0], vy = elbow[1] - sh[1];
      var t = (vx * ax + vy * ay) / aL2;
      var px = sh[0] + ax * t, py = sh[1] + ay * t;
      elbow = [2 * px - elbow[0], 2 * py - elbow[1]];
    }
    return [elbow, hand];
  }
  function mixPt(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; }


  function attach(pup, opt) {
    opt = opt || {};
    var INK = opt.color || "#333333";
    var PAPER = opt.paper || "#FCFBF8";
    var headR = opt.headR || 46;
    var W = opt.weights || {};
    var wArm0 = W.arm0 || 30, wArm1 = W.arm1 || 19;
    var wLeg0 = W.leg0 || 40, wLeg1 = W.leg1 || 22;
    var bodyStroke = W.body || 7;
    var limbStroke = W.limb || 6;

    // The wireframe becomes the pencil under-drawing: thin, grey, and drawn
    // first. It is the same six paths InkPuppet already poses, restyled.
    var pencil = [pup.parts.head, pup.parts.spine, pup.parts.armL, pup.parts.armR,
                  pup.parts.legL, pup.parts.legR];
    pencil.forEach(function (p) {
      p.setAttribute("stroke", opt.pencil || "#BDB7AA");
      p.setAttribute("stroke-width", 3);
    });

    /* Every part is a paper-filled shape with an ink outline — the same
       construction as the head, the doorway and the boxes. It is not decoration
       that they all match: the fill is what makes one limb pass in front of
       another. A solid-ink limb crossing a solid-ink body is one black shape,
       and no amount of motion capture survives that. */
    var g = el("g", { opacity: 0 }, pup.ink);          // inside the boil group
    function part(w) {
      return el("path", { fill: PAPER, stroke: INK, "stroke-width": w || limbStroke,
                          "stroke-linejoin": "round", "stroke-linecap": "round" }, g);
    }
    // paint order is depth order: far side, body, near side, head
    var legFar = part(), footFar = part(), armFar = part();
    var handFar = el("circle", { fill: PAPER, stroke: INK, "stroke-width": limbStroke, r: 12 }, g);
    var neck = part(bodyStroke);
    var torso = part(bodyStroke);
    var legNear = part(), footNear = part(), armNear = part();
    var handNear = el("circle", { fill: PAPER, stroke: INK, "stroke-width": limbStroke, r: 12 }, g);
    var head = el("circle", { fill: PAPER, stroke: INK, "stroke-width": bodyStroke, r: headR }, g);
    var tuft = el("path", { fill: "none", stroke: INK, "stroke-width": 5,
                            "stroke-linecap": "round" }, g);
    var eyeA = el("circle", { fill: INK, r: 6 }, g);
    var eyeB = el("circle", { fill: INK, r: 6 }, g);
    var nose = el("path", { fill: "none", stroke: INK, "stroke-width": 6,
                            "stroke-linecap": "round" }, g);

    /* A shoe that knows what the leg is doing. The ankle angle is not free: a
       planted foot lies flat on the ground whatever the shin is doing above it,
       and a foot in the air hangs off the shin at roughly a right angle. Drawn
       at a fixed angle instead — which is the obvious way — the feet skate,
       and skating feet are the single loudest tell that a walk is fake. */
    function foot(ankle, knee, plantY) {
      var vx = ankle[0] - knee[0], vy = ankle[1] - knee[1], L = Math.hypot(vx, vy) || 1;
      var dx = vy / L, dy = -vx / L;                 // perpendicular to the shin
      if (dx < 0) { dx = -dx; dy = -dy; }            // toes point the way we face
      var p = Math.max(0, Math.min(1, 1 - (plantY - ankle[1]) / 55));   // 1 = planted
      dx = dx + (1 - dx) * p; dy = dy * (1 - p);     // flatten onto the ground
      var m = Math.hypot(dx, dy) || 1; dx /= m; dy /= m;
      var ux = dy, uy = -dx;                         // "up" in the foot's own frame
      function at(a, b) { return [ankle[0] + dx * a + ux * b, ankle[1] + dy * a + uy * b]; }
      return taper([at(-13, 4), at(6, -1), at(28, 4)], 17, 12, 9);
    }

    /* What the near arm is doing with itself. The body stays on motion capture;
       only this one chain is overridden, which is how every rig handles a
       character holding a prop — a generic walk cycle swings an empty arm, and
       an object riding in that hand reads as swinging loose rather than carried.

         on   0 = pure mocap, 1 = fully posed to the target
         from "shoulder", "chest" or "head" — what the target is measured from
         dx,dy  offset from it, in the figure's own units

       Measure from the shoulder unless you have a reason not to. The clips are
       not all shot from the same angle — a near-profile one collapses the
       shoulders onto the spine — so a chest-relative target that is a
       comfortable bent-arm reach in a walk is past the end of the arm in a
       shuffle, and FABRIK answers an unreachable target by straightening the
       arm and pointing at it. Shoulder-relative, the reach is the reach.

       All four are plain numbers so the timeline can tween them.

       The chain is the L side, which in this rig's projection is the side the
       face points at. Carrying with the far shoulder makes the arm cross the
       whole body, and — because the reach is then longer than the arm — FABRIK
       straightens it, so the one gesture the whole piece turns on reads as a
       bar laid across the chest. */
    var carry = { on: 0, from: "shoulder", dx: 39, dy: 123 };
    var handNow = [0, 0];

    function draw(po) {
      // The body is a closed outline around the spine, with its own width at
      // hips, chest and shoulders. Built the obvious way — a polygon through
      // shL, shR, hipR, hipL — it self-intersects the moment the shoulders
      // rotate past each other in a walk and the torso pinches into an
      // hourglass. Measuring every width off ONE axis cannot do that.
      var hipMid = lerp(po.hipL, po.hipR, 0.5);
      var shMid = lerp(po.shL, po.shR, 0.5);
      var hipW = Math.hypot(po.hipR[0] - po.hipL[0], po.hipR[1] - po.hipL[1]);
      var shW = Math.hypot(po.shR[0] - po.shL[0], po.shR[1] - po.shL[1]);
      var sx = shMid[0] - hipMid[0], sy = shMid[1] - hipMid[1];
      var sL = Math.hypot(sx, sy) || 1;
      var nx = -sy / sL, ny = sx / sL;                       // across the body
      var wH = Math.max(46, hipW * 1.06) / 2;
      var wC = Math.max(64, shW * 0.90) / 2;
      var wS = Math.max(58, shW * 0.86) / 2;
      function off(p, w, s) { return [p[0] + nx * w * s, p[1] + ny * w * s]; }
      torso.setAttribute("d", smooth([
        off(hipMid, wH, 1), off(po.chest, wC, 1), off(shMid, wS, 1),
        off(shMid, wS, -1), off(po.chest, wC, -1), off(hipMid, wH, -1),
        [hipMid[0] - sx / sL * 9, hipMid[1] - sy / sL * 9]
      ], true));
      neck.setAttribute("d", taper([nudge(shMid, 0, 4), nudge(po.head, 0, 10)], 30, 26, 12));

      // The L side reads as the near side: it is the side the face points at,
      // and the side that carries.
      var armRootF = lerp(po.shR, shMid, 0.22), armRootN = lerp(po.shL, shMid, 0.22);
      armFar.setAttribute("d", taper([armRootF, po.elR, po.haR], wArm0, wArm1));

      var elN = po.elL, haN = po.haL;
      if (carry.on > 0.001) {
        var anchor = carry.from === "head" ? po.head
                   : carry.from === "shoulder" ? po.shL : po.chest;
        var ik = reachArm(po.shL, po.elL, po.haL,
                          [anchor[0] + carry.dx, anchor[1] + carry.dy]);
        elN = mixPt(po.elL, ik[0], carry.on);
        haN = mixPt(po.haL, ik[1], carry.on);
      }
      handNow = haN;
      armNear.setAttribute("d", taper([armRootN, elN, haN], wArm0, wArm1));

      var plantY = Math.max(po.ftL[1], po.ftR[1]);
      legFar.setAttribute("d", taper([po.hipR, po.knR, po.ftR], wLeg0, wLeg1));
      legNear.setAttribute("d", taper([po.hipL, po.knL, po.ftL], wLeg0, wLeg1));
      footFar.setAttribute("d", foot(po.ftR, po.knR, plantY));
      footNear.setAttribute("d", foot(po.ftL, po.knL, plantY));
      handFar.setAttribute("cx", po.haR[0]); handFar.setAttribute("cy", po.haR[1]);
      handNear.setAttribute("cx", haN[0]); handNear.setAttribute("cy", haN[1]);

      var hx = po.head[0], hy = po.head[1] - headR * 0.32;
      head.setAttribute("cx", hx); head.setAttribute("cy", hy);
      // the face sits on one side. This is not decoration: it is the only thing
      // that gives a symmetrical figure a facing, and without it a turn is
      // invisible no matter how good the motion capture is.
      eyeA.setAttribute("cx", hx + 8);  eyeA.setAttribute("cy", hy - 10);
      eyeB.setAttribute("cx", hx + 27); eyeB.setAttribute("cy", hy - 10);
      nose.setAttribute("d", "M" + r2(hx + 41) + " " + r2(hy + 2) +
                             " L" + r2(hx + 58) + " " + r2(hy + 9));
      // a cowlick at the back of the head, not a crown across the top of it
      tuft.setAttribute("d",
        "M" + r2(hx - 24) + " " + r2(hy - headR + 12) + " L" + r2(hx - 34) + " " + r2(hy - headR - 4) +
        " M" + r2(hx - 12) + " " + r2(hy - headR + 3)  + " L" + r2(hx - 18) + " " + r2(hy - headR - 14));
    }

    var basePose = pup.setPose, lastPose = root.InkPuppet.STAND;
    pup.setPose = function (po) { lastPose = po; basePose(po); draw(po); };
    pup.setPose(root.InkPuppet.STAND);
    pup.place(root.InkPuppet.STAND.groundY, 0);

    return {
      group: g,
      pencil: pencil,
      /** what the near arm is doing — tween these from the timeline */
      carry: carry,
      /** where the near hand actually ended up, after any IK. Hang props here. */
      hand: function () { return handNow; },
      /** the pose currently on screen. Feed it back through pup.setPose() every
          frame if anything is parented to the hand — redraw() only repaints the
          figure, so a prop hung off the hand by the caller would not follow it. */
      pose: function () { return lastPose; },
      /** redraw the current pose; needed outside choreograph segments, and to
          pick up a carry change on a frame where the pose itself did not move */
      redraw: function () { draw(lastPose); },
      /** the rough sketch draws itself, limb by limb */
      pencilIn: function (tl, o) { return pup.drawIn(tl, o || {}); },
      /** then the ink goes on over it and the pencil is rubbed out */
      inkIn: function (tl, o) {
        o = o || {};
        var at = o.at != null ? o.at : 2.2, dur = o.dur || 0.55;
        tl.to(g, { opacity: 1, duration: dur, ease: "power2.out" }, at);
        tl.to(pencil, { opacity: 0, duration: dur * 0.9 }, at + dur * 0.35);
        return at + dur;
      }
    };
  }

  root.InkFigure = { attach: attach, taper: taper, smooth: smooth };
})(window);
