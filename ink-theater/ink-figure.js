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


  /* NIB — the channel's recurring character. These are not defaults in the
     "some sensible starting numbers" sense; they are the character, and the
     point of them is that they do not change between videos. A viewer
     recognises a figure by its proportions long before its face. Read
     ink-theater/NIB.md before touching any of them. */
  var NIB = {
    headR: 46,                    // head radius; the figure is ~5.4 heads tall
    ink: "#333333",
    paper: "#FCFBF8",
    pencil: "#BDB7AA",            // the under-drawing, rubbed out after the ink
    weights: {
      arm0: 30, arm1: 19,         // shoulder → wrist
      leg0: 40, leg1: 22,         // hip → ankle
      body: 7,                    // torso, neck and head outline
      limb: 6                     // arms, legs, feet, hands
    },
    /* The torso's width is the pose's own span, floored. The floors matter
       more than the multipliers, because side-on the mocap gives a shoulder
       span of about 13 units and the floor is the whole answer. They were set
       for a front view and made him a slab. A body seen from the side is about
       0.24 of its height deep at the chest — 128 units on a 534 figure — and
       front on the multipliers land within a few units of the same numbers, so
       he is now the same mass whichever way the clip is projected. */
    torso: { hip: 1.06, chest: 0.90, shoulder: 0.86,   // × the pose's own spans
             hipMin: 104, chestMin: 128, shoulderMin: 116 },
    face: { eye: 6, eyeA: 8, eyeB: 27, eyeY: -10,      // both eyes on the +x side
            noseFrom: 41, noseTo: 58, noseStroke: 6 },
    foot: { heel: -13, ball: 6, toe: 28, w0: 17, w1: 12, plantOver: 55 },
    hand: 12,                     // the fist, a paper circle with an ink outline
    /* How far behind the near side the far arm and leg are drawn. In a true
       side view the two arms project onto each other almost exactly and read as
       one thick arm with two hands on the end of it. Every 2D animator offsets
       the far limbs a little for exactly this reason; the offset is backwards,
       away from the direction he faces. */
    depth: 11,

    /* THE COSTUME. A recurring character has to be recognisable as a
       SILHOUETTE, at thumbnail size, in one frame. A plain figure is not — it
       is every figure. So: he is a fitter. A flat cap, a boiler suit, boots,
       and a pencil behind his ear, which is also his name.

       That is not decoration either. It is what the channel does: it opens
       things up and looks inside them, and the toolbox has been in his hand
       since the first shot. Everything here is ink on paper — no colour. The
       palette carries meaning (orange is flow, red is the problem, blue is the
       resolution) and a character wearing one of those would be lying. */
    cap:   { band: 12, wide: 1.10, high: 0.82, peak: 26, thick: 16, stroke: 6 },
    suit:  { collar: 5, placket: 4, button: 5, pocket: 5, belt: 6, cuff: 5, turnup: 5 },
    boot:  { heel: -15, ball: 6, toe: 30, w0: 21, w1: 15, sole: 4, plantOver: 55 },
    quill: { back: 0.86, up: -0.14, len: 34, rise: 0.24, w0: 10, w1: 4 }
  };

  function attach(pup, opt) {
    opt = opt || {};
    var INK = opt.color || NIB.ink;
    var PAPER = opt.paper || NIB.paper;
    var headR = opt.headR || NIB.headR;
    var W = opt.weights || NIB.weights;
    var wArm0 = W.arm0 || NIB.weights.arm0, wArm1 = W.arm1 || NIB.weights.arm1;
    var wLeg0 = W.leg0 || NIB.weights.leg0, wLeg1 = W.leg1 || NIB.weights.leg1;
    var bodyStroke = W.body || NIB.weights.body;
    var limbStroke = W.limb || NIB.weights.limb;
    var DEPTH = opt.depth != null ? opt.depth : NIB.depth;
    function back(p) { return [p[0] - DEPTH, p[1]]; }

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
    function seam(w) {
      return el("path", { fill: "none", stroke: INK, "stroke-width": w,
                          "stroke-linecap": "round", "stroke-linejoin": "round" }, g);
    }
    // Paint order IS depth order, and every seam has to sit directly on the
    // thing it is sewn to: a cuff drawn after the torso but before the arm ends
    // up inside the sleeve, and a collar drawn after the arm lies across it.
    var legFar = part(), footFar = part(), soleF = seam(NIB.boot.sole), turnF = seam(NIB.suit.turnup);
    var armFar = part();
    var handFar = el("circle", { fill: PAPER, stroke: INK, "stroke-width": limbStroke, r: NIB.hand }, g);
    var cuffF = seam(NIB.suit.cuff);
    var torso = part(bodyStroke);                       // the boiler suit
    var collar = seam(NIB.suit.collar), placket = seam(NIB.suit.placket);
    var buttons = seam(NIB.suit.button), pocket = seam(NIB.suit.pocket), belt = seam(NIB.suit.belt);
    var neck = part(bodyStroke);
    var legNear = part(), footNear = part(), soleN = seam(NIB.boot.sole), turnN = seam(NIB.suit.turnup);
    var armNear = part();
    var handNear = el("circle", { fill: PAPER, stroke: INK, "stroke-width": limbStroke, r: NIB.hand }, g);
    var cuffN = seam(NIB.suit.cuff);
    var head = el("circle", { fill: PAPER, stroke: INK, "stroke-width": bodyStroke, r: headR }, g);
    // TWO shapes, not one. A cap outline that goes out along the peak and
    // comes back doubles direction, and a Catmull-Rom through a reversal loops:
    // every single-path attempt produced a thin hook where the peak should be.
    // Two convex blobs cannot do that. The peak goes down first so the crown's
    // edge covers its root.
    // The peak is SOLID ink against the paper crown. Outlined, at 15 units
    // thick against a 6px stroke, there is almost no paper left inside it and
    // it reads as a hollow loop. Solid, it is the one dark mass on him and it
    // anchors the whole silhouette.
    var capPeak = el("path", { fill: INK, stroke: "none" }, g);
    var capCrown = part(NIB.cap.stroke);
    var quill = el("path", { fill: INK, stroke: "none" }, g);    // a pencil behind the ear
    var eyeA = el("circle", { fill: INK, r: 6 }, g);
    var eyeB = el("circle", { fill: INK, r: 6 }, g);
    var brow = seam(5);
    var nose = seam(6);

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
      var B = NIB.boot;
      return { d: taper([at(B.heel, 5), at(B.ball, -1), at(B.toe, 5)], B.w0, B.w1, 9),
               sole: "M" + r2(at(B.heel, -3)[0]) + " " + r2(at(B.heel, -3)[1]) +
                     " L" + r2(at(B.toe - 3, -3)[0]) + " " + r2(at(B.toe - 3, -3)[1]) };
    }

    // a stroke laid across a limb — a cuff, a turn-up
    function crossAt(a, b, t, half) {
      var px = a[0] + (b[0] - a[0]) * t, py = a[1] + (b[1] - a[1]) * t;
      var vx = b[0] - a[0], vy = b[1] - a[1], L = Math.hypot(vx, vy) || 1;
      var ox = -vy / L * half, oy = vx / L * half;
      return "M" + r2(px - ox) + " " + r2(py - oy) + " L" + r2(px + ox) + " " + r2(py + oy);
    }

    /* What the near arm is doing with itself. The body stays on motion capture;
       only this one chain is overridden, which is how every rig handles a
       character holding a prop — a generic walk cycle swings an empty arm, and
       an object riding in that hand reads as swinging loose rather than carried.

         on   0 = pure mocap, 1 = fully posed to the target
         from "shoulder", "chest", "head", or "point" — what dx,dy mean.
              "point" is an absolute position in the figure's own coordinates,
              which is how the hand holds onto something that is not part of
              the figure and is moving on its own — a door handle, a crank, a
              rung. Convert the page position with InkFigure.toPose() every
              frame and write it into carry.dx / carry.dy.
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
    /* The same thing for the other arm. Two hands is not a luxury: you hold the
       bag in one and turn the handle with the other, and a character that has
       to put its only prop down before it can touch anything is a character
       that cannot act. `hold` drives the far arm; everything about it works
       exactly like `carry`. */
    var hold = { on: 0, from: "shoulder", dx: 39, dy: 123 };
    var handNow = [0, 0], handFarNow = [0, 0], ZERO = [0, 0];
    /* The one thing on his face that moves. No mouth and no eyebrows was the
       right call for a mascot; a brow that is flat by default and can tilt a
       few units is not mugging, it is the difference between deadpan and
       blank. Tween face.brow from the timeline; leave it at 0 and he is the
       same character he was. */
    var face = { brow: 0 };

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
      var T = NIB.torso;
      var wH = Math.max(T.hipMin, hipW * T.hip) / 2;
      var wC = Math.max(T.chestMin, shW * T.chest) / 2;
      var wS = Math.max(T.shoulderMin, shW * T.shoulder) / 2;
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

      function posed(c, sh, el0, ha0) {
        if (!(c.on > 0.001)) return [el0, ha0];
        var anchor = c.from === "point" ? ZERO
                   : c.from === "head" ? po.head
                   : c.from === "shoulder" ? sh : po.chest;
        var ik = reachArm(sh, el0, ha0, [anchor[0] + c.dx, anchor[1] + c.dy]);
        return [mixPt(el0, ik[0], c.on), mixPt(ha0, ik[1], c.on)];
      }
      var far = posed(hold, po.shR, po.elR, po.haR);
      handFarNow = far[1];
      armFar.setAttribute("d", taper([back(armRootF), back(far[0]), back(far[1])], wArm0, wArm1));

      var near = posed(carry, po.shL, po.elL, po.haL);
      var elN = near[0], haN = near[1];
      handNow = haN;
      armNear.setAttribute("d", taper([armRootN, elN, haN], wArm0, wArm1));

      var plantY = Math.max(po.ftL[1], po.ftR[1]);
      legFar.setAttribute("d", taper([back(po.hipR), back(po.knR), back(po.ftR)], wLeg0, wLeg1));
      legNear.setAttribute("d", taper([po.hipL, po.knL, po.ftL], wLeg0, wLeg1));
      var bF = foot(back(po.ftR), back(po.knR), plantY), bN = foot(po.ftL, po.knL, plantY);
      footFar.setAttribute("d", bF.d);   soleF.setAttribute("d", bF.sole);
      footNear.setAttribute("d", bN.d);  soleN.setAttribute("d", bN.sole);
      handFar.setAttribute("cx", handFarNow[0] - DEPTH); handFar.setAttribute("cy", handFarNow[1]);
      handNear.setAttribute("cx", haN[0]); handNear.setAttribute("cy", haN[1]);

      // ── the suit ──────────────────────────────────────────────────────
      // Seams are what turn a shape into a garment, and each one is a pure
      // function of the pose like everything else. +n is the side he faces, so
      // the placket runs down the front edge and the pocket sits on the chest.
      var vTip = off(lerp(shMid, po.chest, 0.42), wC * 0.20, 1);
      collar.setAttribute("d",
        "M" + r2(off(shMid, wS * 1.00, -1)[0]) + " " + r2(off(shMid, wS * 1.00, -1)[1]) +
        " L" + r2(vTip[0]) + " " + r2(vTip[1]) +
        " L" + r2(off(shMid, wS * 1.00, 1)[0]) + " " + r2(off(shMid, wS * 1.00, 1)[1]));
      var hemPt = off(lerp(hipMid, po.chest, 0.22), wH * 0.34, 1);
      placket.setAttribute("d", "M" + r2(vTip[0]) + " " + r2(vTip[1]) +
                                " L" + r2(hemPt[0]) + " " + r2(hemPt[1]));
      var bd = "";
      [0.34, 0.68].forEach(function (t) {
        var b = lerp(vTip, hemPt, t), rr = NIB.suit.button;
        bd += "M" + r2(b[0] - rr) + " " + r2(b[1]) + "a" + rr + " " + rr + " 0 1 0 " + (rr * 2) + " 0" +
              "a" + rr + " " + rr + " 0 1 0 " + (-rr * 2) + " 0 ";
      });
      buttons.setAttribute("d", bd);
      // a chest pocket, squared to the body's own axes
      // low enough on the chest that the torso is still full width there — at
      // 0.30 toward the shoulders the body has narrowed and the pocket hangs
      // outside the suit
      var pc = off(lerp(po.chest, shMid, 0.08), wC * 0.40, 1);
      var ax = sx / sL, ay = sy / sL;                  // up the spine
      function pp(u, v) { return [pc[0] + ax * u + nx * v, pc[1] + ay * u + ny * v]; }
      pocket.setAttribute("d", "M" + r2(pp(16, -13)[0]) + " " + r2(pp(16, -13)[1]) +
                               " L" + r2(pp(16, 13)[0]) + " " + r2(pp(16, 13)[1]) +
                               " L" + r2(pp(-20, 13)[0]) + " " + r2(pp(-20, 13)[1]) +
                               " L" + r2(pp(-20, -13)[0]) + " " + r2(pp(-20, -13)[1]) + " Z");
      // the belt, with a buckle at the front
      var bp = lerp(hipMid, po.chest, 0.20);
      var b0 = off(bp, wH * 1.04, -1), b1 = off(bp, wH * 1.04, 1);
      var bk = lerp(b0, b1, 0.80);
      belt.setAttribute("d", "M" + r2(b0[0]) + " " + r2(b0[1]) + " L" + r2(b1[0]) + " " + r2(b1[1]) +
                             " M" + r2(bk[0] + ax * 9) + " " + r2(bk[1] + ay * 9) +
                             " L" + r2(bk[0] - ax * 9) + " " + r2(bk[1] - ay * 9));
      // rolled sleeves and turned-up trousers
      cuffN.setAttribute("d", crossAt(elN, haN, 0.58, wArm1 * 0.80));
      cuffF.setAttribute("d", crossAt(back(far[0]), back(far[1]), 0.58, wArm1 * 0.80));
      turnN.setAttribute("d", crossAt(po.knL, po.ftL, 0.82, wLeg1 * 0.78));
      turnF.setAttribute("d", crossAt(back(po.knR), back(po.ftR), 0.82, wLeg1 * 0.78));

      // ── the head ──────────────────────────────────────────────────────────
      var hx = po.head[0], hy = po.head[1] - headR * 0.32;
      head.setAttribute("cx", hx); head.setAttribute("cy", hy);

      // The flat cap. It is the silhouette: a plain round head is every
      // character, and a peak also tells you which way he is looking from
      // across the room, which two 6px eyes do not.
      // THE CAP — the silhouette. A plain round head is every character; a cap
      // is one character, and its peak says which way he is looking from across
      // the room, which two 6px eyes do not.
      var C = NIB.cap, R = headR, band = hy - C.band;
      var cxk = hx - 4, rx = R * C.wide, ry = R * C.high, cp = [], ci;
      for (ci = 0; ci <= 18; ci++) {                    // a low dome, back to front
        var aa = Math.PI + Math.PI * ci / 18;
        cp.push([cxk + Math.cos(aa) * rx, band + Math.sin(aa) * ry]);
      }
      capCrown.setAttribute("d", smooth(cp, true));
      // it comes off the FRONT of the band and points forward and slightly
      // down, thick at the root. Starting it mid-head lays a sliver across his
      // face and doubles the band line.
      capPeak.setAttribute("d", smooth([
        [hx + R * 0.80, band - 4],
        [hx + R + C.peak, band + 4],
        [hx + R + C.peak * 0.86, band + C.thick + 4],
        [hx + R * 0.80, band + C.thick]
      ], true));

      // a pencil behind his ear, which is also his name
      var Q = NIB.quill;
      var qx = hx - headR * Q.back, qy = hy - headR * Q.up;
      quill.setAttribute("d", taper([[qx, qy], [qx - Q.len, qy - Q.len * Q.rise]], Q.w0, Q.w1, 8));

      // the face sits on one side. This is not decoration: it is the only thing
      // that gives a symmetrical figure a facing, and without it a turn is
      // invisible no matter how good the motion capture is.
      // everything on the face sits UNDER the brim, which is where a face goes
      // when a man is wearing a cap
      eyeA.setAttribute("cx", hx + 10); eyeA.setAttribute("cy", hy + 10);
      eyeB.setAttribute("cx", hx + 29); eyeB.setAttribute("cy", hy + 10);
      brow.setAttribute("d", "M" + r2(hx + 5) + " " + r2(hy - 2 + face.brow) +
                             " L" + r2(hx + 33) + " " + r2(hy - 1 - face.brow));
      nose.setAttribute("d", "M" + r2(hx + 41) + " " + r2(hy + 15) +
                             " L" + r2(hx + 57) + " " + r2(hy + 22));
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
      /** the same for the far arm, so he can use both hands at once */
      hold: hold,
      /** face.brow — flat at 0, tilts a few units. The only thing that moves. */
      face: face,
      /** where the near hand actually ended up, after any IK. Hang props here. */
      hand: function () { return handNow; },
      /** and the far one */
      handFar: function () { return handFarNow; },
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

  /* Page coordinates → pose coordinates. The figure normally sits inside a
     scale group (the mocap skeleton is about 490 units tall and a portrait
     frame wants more) and sometimes a flip group, so a point on the page — the
     handle of a door drawn in the world layer, say — is several transforms away
     from the numbers the pose is written in. Undo them in the order the browser
     applied them, outermost first.

       var p = InkFigure.toPose(pup, handleX + worldOffset, handleY,
                                { scale: 1.5, aboutX: CX, aboutY: GROUND });
       fig.carry.from = "point"; fig.carry.dx = p[0]; fig.carry.dy = p[1];

     pup.originY changes every frame (it carries the clip's ground and the
     pose's rootY), so this has to be recomputed per frame, not once. */
  function toPose(pup, px, py, o) {
    o = o || {};
    var s = o.scale || 1, f = o.flipX || 1;
    var ax = o.aboutX != null ? o.aboutX : pup.cx;
    var ay = o.aboutY != null ? o.aboutY : pup.ground;
    var x = ax + (px - ax) / s, y = ay + (py - ay) / s;   // undo the scale group
    x = ax + (x - ax) / f;                                // undo the flip group
    return [x - pup.originX, y - pup.originY];            // undo place()
  }

  root.InkFigure = { attach: attach, taper: taper, smooth: smooth,
                     toPose: toPose, NIB: NIB };
})(window);
