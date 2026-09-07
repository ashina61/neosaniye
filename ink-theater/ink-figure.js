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


  /* ADEM — the channel's character. Everything here is his identity, and the
     point of it is that it does not change between videos.

     He replaced an earlier design (a fitter in a flat cap and a boiler suit).
     Two things about this one are better and worth keeping in mind if it is
     ever revisited: real proportions — about 6.7 heads, not 5.4 — and ONE
     solid mass on the whole figure, his hair. Everything else is line. A
     drawing with exactly one dark shape in it has a place for the eye to land,
     and that shape is what you recognise from across a room.

     Line weights are in PAGE pixels. The actor normally lives inside a scale
     group, so pass `unit: SCALE` when attaching and they come out matching the
     set instead of nearly twice its weight. */
  var ADEM = {
    headR: 40,                    // ~6.7 heads tall
    ink: "#333333",
    paper: "#FCFBF8",
    pencil: "#BDB7AA",            // the under-drawing, rubbed out after the ink
    weights: {
      arm0: 27, arm1: 17,         // shoulder to wrist
      leg0: 38, leg1: 21,         // hip to ankle
      body: 5.4,                  // torso, neck, head outline (page px)
      limb: 4.4,                  // arms, legs, shoes, hands
      seam: 3.6,                  // hems, sleeve edges, pocket
      face: 3.8
    },
    /* Width at hip, chest and shoulder: the pose's own span, floored. Side on
       the mocap gives about a 13-unit shoulder span, so the floor IS the
       answer; a body is roughly 0.21 of its height deep at the chest. `waist`
       is new — a torso that goes straight from chest to hip is a bag, and the
       reference sheet's shirt comes in before it flares at the hem. */
    torso: { hip: 1.02, chest: 0.88, shoulder: 1.02, waist: 0.86, armOut: 0.50,
             hipMin: 100, chestMin: 116, shoulderMin: 132 },
    /* The skull, as fractions of headR. It is not a circle: a jaw comes down
       from the cheek to a chin that is forward of centre, which is what gives
       the head a direction even before the face is drawn on it. */
    skull: { brow: 0.74, face: 0.94, cheek: 0.88, jaw: 0.72, chin: 0.30 },
    neck: { w0: 21, w1: 17 },
    /* The undercut. A solid ink band over the skull, thickest at the front
       where it sweeps up, tapering to nothing at the nape, with a few short
       strokes under it for the faded sides. It is the only filled shape on
       him. */
    hair: { front: -0.22, back: -1.06, thick: 13, quiff: 7 },
    /* EVERY NUMBER IS A FRACTION OF headR. They were absolute once, written
       for a 46 head and left alone when the head became 40, and the nose and
       mouth hung off the side of his face like whiskers for four videos. As
       fractions they cannot do that again. */
    face: { eyeNear: 0.58, eyeFar: 0.19, eyeY: 0.04, eyeW: 0.132, eyeH: 0.088,
            pupil: 4, pupilR: 0.062, browGap: 0.20, browW: 0.17,
            noseX: 0.72, noseY: -0.06,
            mouthX: 0.66, mouthY: 0.46, mouthW: 0.13 },
    /* A plain t-shirt over straight trousers: a crew neck, two short sleeves, a
       hem, one fold at the hip. The body stops being a shape and becomes a
       person dressed for a Tuesday. */
    shirt: { neck: 0.13, sleeve: 0.34, hem: 0.22, pocket: 0.30 },
    /* Trousers: `cuff` is how far down the shin the turn-up sits. One stroke,
       and the leg stops being a leg and becomes a trouser leg. */
    trouser: { cuff: 0.86 },
    /* A low sneaker. `instep` is where the upper rises over the foot; `sole`
       lifts the whole shoe so the outline sits ON the ground rather than
       through it. */
    shoe:  { heel: -14, ball: 7, toe: 29, instep: -4, w0: 18, w1: 13, sole: -4, plantOver: 55 },
    hand: 10,
    depth: 10                     // the far arm and leg, drawn this far behind
  };

  function attach(pup, opt) {
    opt = opt || {};
    var INK = opt.color || ADEM.ink;
    var PAPER = opt.paper || ADEM.paper;
    var headR = opt.headR || ADEM.headR;
    var W = ADEM.weights, F = ADEM.face, SH = ADEM.shirt;
    var wArm0 = W.arm0, wArm1 = W.arm1, wLeg0 = W.leg0, wLeg1 = W.leg1;
    /* Line weights are page pixels. He lives inside a scale group — the mocap
       skeleton is about 490 units tall and a portrait frame wants more — so
       without this every line on him renders at SCALE times the weight of the
       set he is standing in, and he looks pasted on. */
    var U = opt.unit || 1;
    function w(px) { return px / U; }
    var bodyStroke = w(W.body), limbStroke = w(W.limb);
    var DEPTH = opt.depth != null ? opt.depth : ADEM.depth;
    function back(p) { return [p[0] - DEPTH, p[1]]; }

    // The wireframe becomes the pencil under-drawing: thin, grey, and drawn
    // first. It is the same six paths InkPuppet already poses, restyled.
    var pencil = [pup.parts.head, pup.parts.spine, pup.parts.armL, pup.parts.armR,
                  pup.parts.legL, pup.parts.legR];
    pencil.forEach(function (p) {
      p.setAttribute("stroke", opt.pencil || ADEM.pencil);
      p.setAttribute("stroke-width", w(2.6));
    });

    /* Every part is a paper-filled shape with an ink outline — the same
       construction as the head, the doorway and the boxes. It is not decoration
       that they all match: the fill is what lets one limb pass in FRONT of
       another. A solid-ink limb crossing a solid-ink body is one black shape,
       and no amount of motion capture survives that. */
    var g = el("g", { opacity: 0 }, pup.ink);          // inside the boil group
    function part(sw) {
      return el("path", { fill: PAPER, stroke: INK, "stroke-width": sw || limbStroke,
                          "stroke-linejoin": "round", "stroke-linecap": "round" }, g);
    }
    function seam(sw) {
      return el("path", { fill: "none", stroke: INK, "stroke-width": sw || w(W.seam),
                          "stroke-linecap": "round", "stroke-linejoin": "round" }, g);
    }
    /* PAINT ORDER IS DEPTH ORDER, and this stack was rebuilt on 2026-09-07
       against a reference sheet: far arm, both legs, the shirt over the top of
       the trousers, then the neck, then the near arm, then the head. The old
       stack drew the near leg OVER the shirt, which is why the hem read as a
       line scribbled across his hip instead of the bottom of a t-shirt. */
    var armFar = part(), sleeveFarG = part(), handFar = part();
    var seat = part();                                  // the trousers' own body
    var legFar = part(), footFar = part(), soleF = seam(w(W.limb)), cuffF = seam();
    var legNear = part(), footNear = part(), soleN = seam(w(W.limb)), cuffN = seam();
    var torso = part(bodyStroke);                       // the t-shirt
    var hem = seam(), pocket = seam();
    var neck = part(bodyStroke);
    var collar = seam();
    var armNear = part(), sleeveNearG = part(), handNear = part();
    var head = part(bodyStroke);                        // a skull with a jaw
    var ear = seam(w(W.face));
    var hair = el("path", { fill: INK, stroke: "none" }, g);   // the one solid mass
    var fade = seam(w(W.face * 0.8));                   // the shaved sides
    var browN = seam(w(W.face)), browF = seam(w(W.face));
    var eyeNear = seam(w(W.face * 0.9)), eyeFar = seam(w(W.face * 0.9));
    var pupilN = el("circle", { fill: INK, r: F.pupil }, g);
    var pupilF = el("circle", { fill: INK, r: F.pupil }, g);
    var nose = seam(w(W.face)), mouth = seam(w(W.face * 0.9));

    /* A shoe that knows what the leg is doing. The ankle angle is not free: a
       planted foot lies flat on the ground whatever the shin is doing above it,
       and a foot in the air hangs off the shin at roughly a right angle. Drawn
       at a fixed angle instead — which is the obvious way — the feet skate,
       and skating feet are the single loudest tell that a walk is fake.

       The shoe itself is now a low sneaker rather than a wedge: an upper that
       rises over the instep, a toe that curves up off the ground, a midsole
       line the length of the shoe and a heel counter behind it. */
    function foot(ankle, knee, plantY) {
      var vx = ankle[0] - knee[0], vy = ankle[1] - knee[1], L = Math.hypot(vx, vy) || 1;
      var dx = vy / L, dy = -vx / L;                 // perpendicular to the shin
      if (dx < 0) { dx = -dx; dy = -dy; }            // toes point the way we face
      var p = Math.max(0, Math.min(1, 1 - (plantY - ankle[1]) / 55));   // 1 = planted
      dx = dx + (1 - dx) * p; dy = dy * (1 - p);     // flatten onto the ground
      var m = Math.hypot(dx, dy) || 1; dx /= m; dy /= m;
      var ux = dy, uy = -dx;                         // "up" in the foot's own frame
      function at(a, b) { return [ankle[0] + dx * a + ux * b, ankle[1] + dy * a + uy * b]; }
      var B = ADEM.shoe;
      // heel, sole, toe spring, over the toe box, the instep, the ankle collar
      var d = smooth([
        at(B.heel, B.sole), at(B.heel - 1, B.sole + 5), at(B.ball, B.sole - 1),
        at(B.toe - 2, B.sole + 1), at(B.toe, B.sole + 7), at(B.toe - 5, B.sole + 12),
        at(B.ball - 2, B.sole + 15), at(B.instep, B.sole + 21), at(B.heel + 3, B.sole + 20),
        at(B.heel - 1, B.sole + 12)
      ], true);
      return { d: d,
               sole: "M" + r2(at(B.heel - 1, B.sole + 4)[0]) + " " + r2(at(B.heel - 1, B.sole + 4)[1]) +
                     " L" + r2(at(B.toe - 3, B.sole + 4)[0]) + " " + r2(at(B.toe - 3, B.sole + 4)[1]) +
                     " M" + r2(at(B.heel + 2, B.sole + 19)[0]) + " " + r2(at(B.heel + 2, B.sole + 19)[1]) +
                     " L" + r2(at(B.heel + 4, B.sole + 9)[0]) + " " + r2(at(B.heel + 4, B.sole + 9)[1]) };
    }

    /* A HAND, not a circle. Four videos shipped with a paper disc stuck on the
       end of each arm, and at any size above a thumbnail that is exactly what
       it looked like. This is a mitt: the palm, a thumb on the side the figure
       faces, and a rounded set of fingers, all built in the forearm's own frame
       so it turns with the wrist instead of spinning. */
    function handShape(wrist, elbow) {
      var vx = wrist[0] - elbow[0], vy = wrist[1] - elbow[1], L = Math.hypot(vx, vy) || 1;
      var ax = vx / L, ay = vy / L;                  // along the forearm
      var bx = -ay, by = ax;                         // across it
      var H = ADEM.hand;
      function at(a, b) { return [wrist[0] + ax * a + bx * b, wrist[1] + ay * a + by * b]; }
      return smooth([
        at(-2, -H * 0.52), at(H * 0.62, -H * 0.66), at(H * 1.16, -H * 0.36),
        at(H * 1.22, H * 0.16), at(H * 0.86, H * 0.58), at(H * 0.16, H * 0.66),
        at(-H * 0.26, H * 0.30)
      ], true);
    }

    /* The sleeve: a short t-shirt sleeve that sits ON the upper arm and flares
       a little at its hem, drawn as its own paper shape so the shoulder reads
       as cloth over an arm rather than a line ruled across it. */
    function sleeveShape(root, elbow) {
      var vx = elbow[0] - root[0], vy = elbow[1] - root[1], L = Math.hypot(vx, vy) || 1;
      var ax = vx / L, ay = vy / L, bx = -ay, by = ax;
      var S = ADEM.shirt, w0 = wArm0 * 0.58, w1 = wArm0 * 0.52, Lc = L * S.sleeve;
      function at(a, b) { return [root[0] + ax * a + bx * b, root[1] + ay * a + by * b]; }
      return smooth([
        at(-w0 * 1.05, -w0 * 0.74), at(Lc * 0.5, -w1), at(Lc, -w1 * 0.94),
        at(Lc + 2, 0), at(Lc, w1 * 0.94), at(Lc * 0.5, w1), at(-w0 * 1.05, w0 * 0.74)
      ], true);
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
      var ax = sx / sL, ay = sy / sL;                        // up the spine
      var nx = -sy / sL, ny = sx / sL;                       // across the body
      var T = ADEM.torso;
      var wH = Math.max(T.hipMin, hipW * T.hip) / 2;
      var wC = Math.max(T.chestMin, shW * T.chest) / 2;
      var wS = Math.max(T.shoulderMin, shW * T.shoulder) / 2;
      var wW = wH * T.waist;                                 // the waist, which
      function off(p, w, s) { return [p[0] + nx * w * s, p[1] + ny * w * s]; }
      function up(p, d) { return [p[0] + ax * d, p[1] + ay * d]; }
      var waistPt = lerp(hipMid, po.chest, 0.42);
      var hemPt = lerp(hipMid, po.chest, 0.12);              // at the hip

      var A = ADEM.torso;
      var armRootF = up(off(lerp(po.shR, shMid, 0.30), wS * A.armOut * 0.55, -1), -7);
      var armRootN = off(lerp(po.shL, shMid, 0.22), wS * A.armOut, 1);

      function posed(c, sh, el0, ha0) {
        if (!(c.on > 0.001)) return [el0, ha0];
        var anchor = c.from === "point" ? ZERO
                   : c.from === "head" ? po.head
                   : c.from === "shoulder" ? sh : po.chest;
        var ik = reachArm(sh, el0, ha0, [anchor[0] + c.dx, anchor[1] + c.dy]);
        return [mixPt(el0, ik[0], c.on), mixPt(ha0, ik[1], c.on)];
      }
      var far = posed(hold, po.shR, po.elR, po.haR);
      var near = posed(carry, po.shL, po.elL, po.haL);
      var elN = near[0], haN = near[1];
      handNow = haN; handFarNow = far[1];

      // ── the far arm, behind everything ────────────────────────────────────
      armFar.setAttribute("d", taper([back(armRootF), back(far[0]), back(far[1])], wArm0, wArm1));
      handFar.setAttribute("d", handShape(back(far[1]), back(far[0])));
      sleeveFarG.setAttribute("d", sleeveShape(back(armRootF), back(far[0])));

      // ── the legs, under the shirt ─────────────────────────────────────────
      var plantY = Math.max(po.ftL[1], po.ftR[1]);
      var crotch = lerp(hipMid, lerp(po.knL, po.knR, 0.5), 0.22);
      seat.setAttribute("d", smooth([
        off(up(hipMid, 30), wH * 0.80, 1), off(hipMid, wH * 0.84, 1),
        [crotch[0] + nx * wH * 0.26, crotch[1] + ny * wH * 0.26],
        crotch,
        [crotch[0] - nx * wH * 0.26, crotch[1] - ny * wH * 0.26],
        off(hipMid, wH * 0.84, -1), off(up(hipMid, 30), wH * 0.80, -1)
      ], true));
      legFar.setAttribute("d", taper([back(po.hipR), back(po.knR), back(po.ftR)], wLeg0, wLeg1));
      legNear.setAttribute("d", taper([po.hipL, po.knL, po.ftL], wLeg0, wLeg1));
      var bF = foot(back(po.ftR), back(po.knR), plantY), bN = foot(po.ftL, po.knL, plantY);
      footFar.setAttribute("d", bF.d);   soleF.setAttribute("d", bF.sole);
      footNear.setAttribute("d", bN.d);  soleN.setAttribute("d", bN.sole);
      // a turn-up above each shoe: the one line that says "trousers" and not
      // "legs", and it is the line the reference sheet has and this did not
      cuffF.setAttribute("d", crossAt(back(po.knR), back(po.ftR), ADEM.trouser.cuff, wLeg1 * 0.62));
      cuffN.setAttribute("d", crossAt(po.knL, po.ftL, ADEM.trouser.cuff, wLeg1 * 0.62));

      // ── the t-shirt ───────────────────────────────────────────────────────
      // Sloped shoulders, a waist that comes in, a hem that flares back out.
      // The old outline was three widths and a smooth curve: a slab with a
      // rounded top, which is what it looked like.
      var nkBase = up(shMid, wS * 0.20);
      torso.setAttribute("d", smooth([
        off(up(shMid, wS * 0.14), wS * 0.34, 1),               // the collar
        off(up(shMid, wS * 0.05), wS * 0.70, 1),               // the shoulder slope
        off(shMid, wS * 0.94, 1), off(up(shMid, -wS * 0.34), wS * 0.98, 1),
        off(po.chest, wC, 1), off(waistPt, wW, 1),
        off(hemPt, wH * 1.00, 1), off(up(hemPt, -7), wH * 0.92, 1),
        off(up(hemPt, -9), 0, 1),
        off(up(hemPt, -7), wH * 0.92, -1), off(hemPt, wH * 1.00, -1),
        off(waistPt, wW, -1), off(po.chest, wC, -1),
        off(up(shMid, -wS * 0.34), wS * 0.98, -1), off(shMid, wS * 0.94, -1),
        off(up(shMid, wS * 0.05), wS * 0.70, -1),
        off(up(shMid, wS * 0.14), wS * 0.34, -1)
      ], true));

      var h0 = off(hemPt, wH * 0.98, -1), h1 = off(hemPt, wH * 0.98, 1);
      hem.setAttribute("d", smooth([h0, off(up(hemPt, -6), 0, 1), h1], false));
      // one fold where the shirt sits on the hip, on the side he faces
      pocket.setAttribute("d", smooth([
        off(lerp(hipMid, po.chest, 0.30), wH * 0.72, 1),
        off(lerp(hipMid, po.chest, 0.10), wH * 0.90, 1),
        off(lerp(hipMid, po.chest, -0.02), wH * 0.80, 1)
      ], false));

      var hx = po.head[0], hy = po.head[1] - headR * 0.32, R = headR;
      // ── the neck, and the collar over it ──────────────────────────────────
      var neckTop = [hx - headR * 0.18, hy + headR * 0.62];
      neck.setAttribute("d", taper([up(shMid, wS * 0.06), neckTop], ADEM.neck.w0, ADEM.neck.w1, 12));
      var cL = off(nkBase, wS * 0.30, -1), cR = off(nkBase, wS * 0.30, 1);
      var cD = off(up(nkBase, -wS * 0.22), wS * 0.05, 1);
      collar.setAttribute("d", smooth([cL, cD, cR], false));

      // ── the near arm, over the shirt ──────────────────────────────────────
      armNear.setAttribute("d", taper([armRootN, elN, haN], wArm0, wArm1));
      handNear.setAttribute("d", handShape(haN, elN));
      sleeveNearG.setAttribute("d", sleeveShape(armRootN, elN));

      // ── the head ──────────────────────────────────────────────────────────
      // A SKULL WITH A JAW. It was a circle for nine videos, and a circle has
      // no chin, no cheekbone and nowhere for an ear to be: the face read as
      // features floating on a ball. Every number below is a fraction of the
      // head radius, so changing the head size can no longer leave the nose
      // hanging off the side of his face — which it did, once, for four.
      var K = ADEM.skull;
      function hp(a, b) { return [hx + a * R, hy + b * R]; }
      head.setAttribute("d", smooth([
        hp(0, -1.02), hp(K.brow, -0.76), hp(K.face, -0.32), hp(K.cheek, 0.18),
        hp(K.jaw, 0.58), hp(K.chin, 0.80), hp(-0.28, 0.74), hp(-0.66, 0.40),
        hp(-0.92, -0.10), hp(-0.72, -0.72)
      ], true));
      // the ear, on the far side of the face, at eye height
      ear.setAttribute("d", smooth([hp(-0.48, -0.10), hp(-0.70, -0.02), hp(-0.66, 0.24),
                                    hp(-0.44, 0.26)], false));

      // THE HAIR — the one solid mass on the whole figure, and the silhouette.
      // A band over the skull: thick at the front where it sweeps up, tapering
      // to nothing at the nape. A band cannot self-intersect the way a single
      // out-and-back outline does, and the taper IS the undercut. Under it,
      // short strokes down the temple: the faded sides of the reference.
      var HR = ADEM.hair, pts = [], hi, tt, ang, th;
      function hairAng(t) { return Math.PI * (HR.front + (HR.back - HR.front) * t); }
      for (hi = 0; hi <= 24; hi++) {
        tt = hi / 24; ang = hairAng(tt);
        th = HR.thick * (1 - 0.80 * tt) + 2 + HR.quiff * Math.max(0, Math.sin(Math.PI * Math.min(1, tt / 0.42)));
        pts.push([hx + Math.cos(ang) * (R + th), hy + Math.sin(ang) * (R + th)]);
      }
      for (hi = 24; hi >= 0; hi--) {
        tt = hi / 24; ang = hairAng(tt);
        pts.push([hx + Math.cos(ang) * R * 0.985, hy + Math.sin(ang) * R * 0.985]);
      }
      hair.setAttribute("d", smooth(pts, true));
      var fd = "", fi, fa, fl, fx, fy;
      for (fi = 0; fi < 6; fi++) {
        fa = hairAng(0.80 + fi * 0.040);
        fl = R * (0.10 + fi * 0.011);
        fx = hx + Math.cos(fa) * R * 0.99; fy = hy + Math.sin(fa) * R * 0.99;
        fd += "M" + r2(fx) + " " + r2(fy) + " L" + r2(fx - fl * 0.30) + " " + r2(fy + fl) + " ";
      }
      fade.setAttribute("d", fd);

      // ── the face ──────────────────────────────────────────────────────────
      // Almond eyes with a lid, not two drilled holes. The near eye is the one
      // the viewer reads; the far one is smaller and closer to the nose,
      // because that is what a three-quarter head does.
      function eyeD(cx, cy, wid, hgt) {
        return smooth([[cx - wid, cy + hgt * 0.10], [cx - wid * 0.35, cy - hgt],
                       [cx + wid * 0.55, cy - hgt * 0.72], [cx + wid, cy + hgt * 0.10],
                       [cx + wid * 0.40, cy + hgt * 0.86], [cx - wid * 0.45, cy + hgt * 0.70]], true);
      }
      var eN = hp(F.eyeNear, F.eyeY), eF = hp(F.eyeFar, F.eyeY + 0.01);
      eyeNear.setAttribute("d", eyeD(eN[0], eN[1], R * F.eyeW, R * F.eyeH));
      eyeFar.setAttribute("d", eyeD(eF[0], eF[1], R * F.eyeW * 0.82, R * F.eyeH * 0.88));
      pupilN.setAttribute("cx", eN[0] + R * 0.03); pupilN.setAttribute("cy", eN[1] + R * 0.01);
      pupilF.setAttribute("cx", eF[0] + R * 0.02); pupilF.setAttribute("cy", eF[1] + R * 0.01);
      pupilN.setAttribute("r", R * F.pupilR); pupilF.setAttribute("r", R * F.pupilR * 0.9);
      // brows: a stroke with an arch, tilted by face.brow
      function browD(cx, cy, wid, tilt) {
        return smooth([[cx - wid, cy + tilt * 0.6], [cx - wid * 0.2, cy - wid * 0.30 + tilt * 0.2],
                       [cx + wid, cy - wid * 0.10 - tilt]], false);
      }
      browN.setAttribute("d", browD(eN[0], eN[1] - R * F.browGap, R * F.browW, face.brow));
      browF.setAttribute("d", browD(eF[0], eF[1] - R * F.browGap, R * F.browW * 0.86, face.brow * 0.8));
      // the nose: a bridge that turns into a nostril, on the side he faces
      nose.setAttribute("d", smooth([hp(F.noseX, F.noseY), hp(F.noseX + 0.10, F.noseY + 0.26),
                                     hp(F.noseX + 0.02, F.noseY + 0.34)], false));
      // and a small mouth that is not quite a straight line
      mouth.setAttribute("d", smooth([hp(F.mouthX - F.mouthW, F.mouthY),
                                      hp(F.mouthX, F.mouthY + 0.03),
                                      hp(F.mouthX + F.mouthW, F.mouthY - 0.01)], false));
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
                     toPose: toPose, ADEM: ADEM };
})(window);
