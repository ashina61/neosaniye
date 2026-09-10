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
    headR: 48,                    // 21% of his height, crown to chin — measured off the reference sheet
    ink: "#333333",
    paper: "#FCFBF8",
    pencil: "#BDB7AA",            // the under-drawing, rubbed out after the ink
    weights: {
      arm0: 27, arm1: 17,         // shoulder to wrist
      leg0: 33, leg1: 20,         // hip to ankle
      body: 3.0,                  // torso, neck, head outline (page px)
      limb: 2.6,                  // arms, legs, shoes, hands
      seam: 2.1,                  // hems, sleeve edges, pocket
      face: 2.4
    },
    /* Width at hip, chest and shoulder: the pose's own span, floored. Side on
       the mocap gives about a 13-unit shoulder span, so the floor IS the
       answer; a body is roughly 0.21 of its height deep at the chest. `waist`
       is new — a torso that goes straight from chest to hip is a bag, and the
       reference sheet's shirt comes in before it flares at the hem. */
    torso: { hip: 1.02, chest: 0.88, shoulder: 1.02, waist: 0.80, armOut: 0.88, armDrop: 0.16,
             hipMin: 100, chestMin: 116, shoulderMin: 132 },
    /* The skull, as fractions of headR. It is not a circle: a jaw comes down
       from the cheek to a chin that is forward of centre, which is what gives
       the head a direction even before the face is drawn on it. */
    /* The head is one curve, sampled: `rr(t)` is its radius at each angle.
       jawIn narrows the lower half, cheek0 puts a cheekbone on the face side,
       temple flattens above it, nape fills the back of the skull, tall is how
       much longer than wide it is. Measured against the reference: the head is
       0.21 of his height and its width is 0.69 of its height. */
    skull: { narrow: 0.82, tall: 0.96, jawIn: 0.24, cheek0: 0.05, temple: 0.08, nape: 0.05 },
    earAt: { t0: -3.55, t1: -2.75, out: 0.10 },
    neck: { w0: 24, w1: 20 },
    /* The undercut. A solid ink band over the skull, thickest at the front
       where it sweeps up, tapering to nothing at the nape, with a few short
       strokes under it for the faded sides. It is the only filled shape on
       him. */
    hair: { front: -0.16, back: -0.88, thick: 11, quiff: 8,
            fade0: 0.62, fadeStep: 0.062, fadeLen: 0.13 },
    /* EVERY NUMBER IS A FRACTION OF headR. They were absolute once, written
       for a 46 head and left alone when the head became 40, and the nose and
       mouth hung off the side of his face like whiskers for four videos. As
       fractions they cannot do that again. */
    face: { eyeNear: 0.56, eyeFar: 0.13, eyeNearF: 0.40, eyeFarF: -0.40,
            eyeY: -0.15, eyeW: 0.140, eyeH: 0.098,
            pupil: 4, pupilR: 0.066, browGap: 0.17, browW: 0.19, browTh: 0.035,
            noseX: 0.56, noseXF: 0.02, noseY: -0.08,
            mouthX: 0.62, mouthXF: 0.00, mouthY: 0.44, mouthW: 0.125 },
    /* A plain t-shirt over straight trousers: a crew neck, two short sleeves, a
       hem, one fold at the hip. The body stops being a shape and becomes a
       person dressed for a Tuesday. */
    shirt: { neck: 0.13, sleeve: 0.34, hem: 0.22, pocket: 0.30 },
    /* Trousers: `cuff` is how far down the shin the turn-up sits. One stroke,
       and the leg stops being a leg and becomes a trouser leg. */
    trouser: { cuff: 0.80 },
    /* A low sneaker. `instep` is where the upper rises over the foot; `sole`
       lifts the whole shoe so the outline sits ON the ground rather than
       through it. */
    shoe:  { heel: -15, ball: 9, toe: 30, instep: 2, w0: 18, w1: 13, sole: 15, plantOver: 55 },
    hand: 8.6,
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
    var fade = seam(w(W.face * 0.62));                   // the shaved sides
    var browN = el("path", { fill: INK, stroke: "none" }, g);
    var browF = el("path", { fill: INK, stroke: "none" }, g);
    var eyeNear = seam(w(W.face * 0.85)), eyeFar = seam(w(W.face * 0.85));
    var lidN = seam(w(W.face * 1.5)), lidF = seam(w(W.face * 1.35));
    var pupilN = el("circle", { fill: INK, r: F.pupil }, g);
    var pupilF = el("circle", { fill: INK, r: F.pupil }, g);
    var nose = seam(w(W.face)), mouth = seam(w(W.face * 1.15));

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
      // THE SHOE IS BUILT FROM THE GROUND UP. The old one was drawn from the
      // ankle outwards and ended up mostly ABOVE it, which is how a sneaker
      // becomes a slipper with a diagonal through it. `sole` is how far below
      // the ankle the ground is; every other number hangs off that.
      var G0 = -B.sole;                              // the sole, in foot units
      var d = smooth([
        at(B.heel, G0 + 2), at(B.heel + 6, G0),      // heel, then the sole
        at(B.ball, G0 - 0.5), at(B.toe - 6, G0 + 1),
        at(B.toe, G0 + 5), at(B.toe - 5, G0 + 10),   // the toe curls up
        at(B.ball - 2, G0 + 13), at(B.instep, G0 + 19),
        at(B.heel + 5, G0 + 22), at(B.heel - 1, G0 + 14)
      ], true);
      return { d: d,
               sole: "M" + r2(at(B.heel + 1, G0 + 5)[0]) + " " + r2(at(B.heel + 1, G0 + 5)[1]) +
                     " L" + r2(at(B.toe - 5, G0 + 5)[0]) + " " + r2(at(B.toe - 5, G0 + 5)[1]) +
                     " M" + r2(at(B.heel + 4, G0 + 21)[0]) + " " + r2(at(B.heel + 4, G0 + 21)[1]) +
                     " L" + r2(at(B.heel + 6, G0 + 8)[0]) + " " + r2(at(B.heel + 6, G0 + 8)[1]) };
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
      // the thumb is on the +b side, which is the side the figure faces
      return smooth([
        at(-2, -H * 0.44), at(H * 0.66, -H * 0.60), at(H * 1.22, -H * 0.34),
        at(H * 1.34, H * 0.14), at(H * 1.00, H * 0.50),
        at(H * 0.52, H * 0.72), at(H * 0.10, H * 0.62),   // the thumb's knuckle
        at(-H * 0.22, H * 0.24)
      ], true) +
      " M" + r2(at(H * 0.62, -H * 0.34)[0]) + " " + r2(at(H * 0.62, -H * 0.34)[1]) +
      " L" + r2(at(H * 0.78, H * 0.24)[0]) + " " + r2(at(H * 0.78, H * 0.24)[1]);
    }

    /* The sleeve: a short t-shirt sleeve that sits ON the upper arm and flares
       a little at its hem, drawn as its own paper shape so the shoulder reads
       as cloth over an arm rather than a line ruled across it. */
    function sleeveShape(root, elbow, k) {
      var vx = elbow[0] - root[0], vy = elbow[1] - root[1], L = Math.hypot(vx, vy) || 1;
      var ax = vx / L, ay = vy / L, bx = -ay, by = ax;
      var S = ADEM.shirt, kk = k || 1, w0 = wArm0 * 0.58 * kk, w1 = wArm0 * 0.52 * kk, Lc = L * S.sleeve;
      function at(a, b) { return [root[0] + ax * a + bx * b, root[1] + ay * a + by * b]; }
      return smooth([
        at(-w0 * 0.15, -w0 * 0.80), at(Lc * 0.5, -w1), at(Lc, -w1 * 0.94),
        at(Lc + 2, 0), at(Lc, w1 * 0.94), at(Lc * 0.5, w1), at(-w0 * 0.15, w0 * 0.80)
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
    var face = { brow: 0, turn: 0, open: 0 };

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
      // the deltoid: where the shoulder ends and the arm begins, on each side
      var deltN = off(up(shMid, -wS * A.armDrop), wS * A.armOut, 1);
      var deltF = off(up(shMid, -wS * A.armDrop), wS * A.armOut * 0.62, -1);
      var armRootN = deltN, armRootF = deltF;

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
      sleeveFarG.setAttribute("d", sleeveShape(back(armRootF), back(far[0]), 0.80));

      // ── the legs, under the shirt ─────────────────────────────────────────
      var plantY = Math.max(po.ftL[1], po.ftR[1]);
      var crotch = lerp(hipMid, lerp(po.knL, po.knR, 0.5), 0.22);
      seat.setAttribute("d", smooth([
        off(up(hipMid, 24), wH * 0.72, 1), off(hipMid, wH * 0.74, 1),
        [crotch[0] + nx * wH * 0.20, crotch[1] + ny * wH * 0.20],
        crotch,
        [crotch[0] - nx * wH * 0.20, crotch[1] - ny * wH * 0.20],
        off(hipMid, wH * 0.74, -1), off(up(hipMid, 24), wH * 0.72, -1)
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
        off(up(shMid, wS * 0.14), wS * 0.32, 1),               // the collar
        off(up(shMid, wS * 0.04), wS * 0.66, 1),               // the shoulder slope
        deltN,                                                 // and it turns here
        off(up(shMid, -wS * 0.46), wS * 0.92, 1),
        off(po.chest, wC, 1), off(waistPt, wW, 1),
        off(hemPt, wH * 1.00, 1), off(up(hemPt, -7), wH * 0.92, 1),
        off(up(hemPt, -9), 0, 1),
        off(up(hemPt, -7), wH * 0.92, -1), off(hemPt, wH * 1.00, -1),
        off(waistPt, wW, -1), off(po.chest, wC, -1),
        off(up(shMid, -wS * 0.34), wS * 0.98, -1), off(shMid, wS * 0.94, -1),
        off(up(shMid, wS * 0.05), wS * 0.70, -1),
        off(up(shMid, wS * 0.14), wS * 0.34, -1)
      ], true));

      // a short tick at each side where the hem turns, and nothing across the
      // middle: the torso outline is already the hem, and drawing it twice put
      // a heavy band across his hips
      hem.setAttribute("d",
        "M" + r2(off(hemPt, wH * 0.94, 1)[0]) + " " + r2(off(hemPt, wH * 0.94, 1)[1]) +
        " L" + r2(off(up(hemPt, 9), wH * 0.90, 1)[0]) + " " + r2(off(up(hemPt, 9), wH * 0.90, 1)[1]) +
        " M" + r2(off(hemPt, wH * 0.94, -1)[0]) + " " + r2(off(hemPt, wH * 0.94, -1)[1]) +
        " L" + r2(off(up(hemPt, 9), wH * 0.90, -1)[0]) + " " + r2(off(up(hemPt, 9), wH * 0.90, -1)[1]));
      // one fold where the shirt sits on the hip, on the side he faces
      pocket.setAttribute("d", smooth([
        off(lerp(hipMid, po.chest, 0.30), wH * 0.72, 1),
        off(lerp(hipMid, po.chest, 0.10), wH * 0.90, 1),
        off(lerp(hipMid, po.chest, -0.02), wH * 0.80, 1)
      ], false));

      var hx = po.head[0], hy = po.head[1] - headR * 0.32, R = headR;
      var K = ADEM.skull, NW = K.narrow;
      // ── the neck, and the collar over it ──────────────────────────────────
      var neckTop = [hx - headR * 0.14 * K.narrow, hy + headR * 0.68];
      neck.setAttribute("d", taper([up(shMid, wS * 0.06), neckTop], ADEM.neck.w0, ADEM.neck.w1, 12));
      var cL = off(nkBase, wS * 0.30, -1), cR = off(nkBase, wS * 0.30, 1);
      var cD = off(up(nkBase, -wS * 0.22), wS * 0.05, 1);
      collar.setAttribute("d", smooth([cL, cD, cR], false));

      // ── the near arm, over the shirt ──────────────────────────────────────
      armNear.setAttribute("d", taper([armRootN, elN, haN], wArm0, wArm1));
      handNear.setAttribute("d", handShape(haN, elN));
      sleeveNearG.setAttribute("d", sleeveShape(armRootN, elN));

      // ── the head ──────────────────────────────────────────────────────────
      // ONE CURVE, SAMPLED — not a ten-point polygon smoothed into lumps. The
      // outline is a function of the angle, so the cranium is round, the
      // temple flattens, the cheekbone comes out, the jaw turns a corner and
      // the chin is short: a head that reads as drawn rather than assembled.
      // Everything else on the head — the hair, the fade, the ear — is built
      // from the SAME function, so nothing floats off it.
      function hp(a, b) { return [hx + a * R * NW, hy + b * R]; }
      // rr(t): the radius at angle t, as a multiple of R. t = 0 is the face
      // side, -PI/2 the crown, PI/2 the chin.
      function rr(t) {
        var c = Math.cos(t), sn = Math.sin(t);
        var v = 1.0;
        v -= K.jawIn * Math.pow(Math.max(0, sn), 1.4) * (0.30 + 0.70 * Math.abs(c)); // jaw sides in, chin stays
        v += K.cheek0 * Math.max(0, c) * Math.max(0, 1 - Math.abs(sn - 0.18) * 2.2); // cheekbone
        v -= K.temple * Math.max(0, -sn) * Math.max(0, c) * 0.6;   // the temple flattens
        v += K.nape * Math.max(0, -c) * Math.max(0, 0.5 - Math.abs(sn + 0.10)) * 2; // the nape
        return v;
      }
      function skullPt(t, out) {
        var r = rr(t) + (out || 0);
        return [hx + Math.cos(t) * r * R * NW, hy + Math.sin(t) * r * R * K.tall];
      }
      var sp = [], si;
      for (si = 0; si < 40; si++) sp.push(skullPt(si / 40 * Math.PI * 2));
      head.setAttribute("d", smooth(sp, true));

      // the ear sits ON the outline, behind the face, at eye height
      var eA = ADEM.earAt;
      function earD(t0, t1) {
        return smooth([skullPt(t0, -0.04), skullPt(t0 + 0.10, eA.out),
                       skullPt(t1 - 0.10, eA.out), skullPt(t1, -0.04)], false);
      }
      ear.setAttribute("d", earD(eA.t0, eA.t1) + (TU > 0.5 ? earD(-eA.t1 - Math.PI * 2 + 0.0, -eA.t0 - Math.PI * 2) : ""));

      // THE HAIR — the one solid mass on the whole figure, and the silhouette.
      // It is the SKULL CURVE offset outwards, so it lies on the head instead
      // of hovering over it: an inner edge that is the head, an outer edge that
      // is the head plus a thickness which rises just behind the hairline and
      // dies at the nape. A band cannot self-intersect the way a single
      // out-and-back outline does, and the taper IS the undercut.
      var HR = ADEM.hair, pts = [], hi, tt, ang, th;
      function hairAng(t) { return Math.PI * (HR.front + (HR.back - HR.front) * t); }
      for (hi = 0; hi <= 26; hi++) {
        tt = hi / 26; ang = hairAng(tt);
        th = HR.thick * (1 - 0.62 * tt) + HR.quiff * Math.max(0, Math.sin(Math.PI * Math.min(1, tt / 0.5)));
        pts.push(skullPt(ang, th / R));
      }
      for (hi = 26; hi >= 0; hi--) {
        tt = hi / 26;
        pts.push(skullPt(hairAng(tt), -0.012));
      }
      hair.setAttribute("d", smooth(pts, true));
      // the fade: short even strokes hanging off the hair's lower edge above
      // the ear, which is where a fade is
      var fd = "", fi, fa, fl, p0, p1;
      for (fi = 0; fi < 5; fi++) {
        fa = hairAng(HR.fade0 + fi * HR.fadeStep);
        fl = HR.fadeLen * (1 - fi * 0.10);
        p0 = skullPt(fa, -0.02); p1 = skullPt(fa + 0.06, -0.02 - fl);
        fd += "M" + r2(p0[0]) + " " + r2(p0[1]) + " L" + r2(p1[0]) + " " + r2(p1[1]) + " ";
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
      // turn slides every feature toward the middle of the head
      var TU = Math.max(0, Math.min(1, face.turn));
      function tx(sideOn, frontOn) { return sideOn + (frontOn - sideOn) * TU; }
      var eN = hp(tx(F.eyeNear, F.eyeNearF), F.eyeY),
          eF = hp(tx(F.eyeFar, F.eyeFarF), F.eyeY + 0.01 * (1 - TU));
      function lidD(cx, cy, wid, hgt) {
        return smooth([[cx - wid * 0.94, cy - hgt * 0.10], [cx - wid * 0.35, cy - hgt],
                       [cx + wid * 0.55, cy - hgt * 0.72], [cx + wid * 0.96, cy - hgt * 0.02]], false);
      }
      lidN.setAttribute("d", lidD(eN[0], eN[1], R * F.eyeW * NW, R * F.eyeH));
      lidF.setAttribute("d", lidD(eF[0], eF[1], R * F.eyeW * 0.82 * NW, R * F.eyeH * 0.88));
      eyeNear.setAttribute("d", eyeD(eN[0], eN[1], R * F.eyeW * NW, R * F.eyeH));
      eyeFar.setAttribute("d", eyeD(eF[0], eF[1], R * F.eyeW * 0.82 * NW, R * F.eyeH * 0.88));
      pupilN.setAttribute("cx", eN[0] + R * 0.03); pupilN.setAttribute("cy", eN[1] + R * 0.01);
      pupilF.setAttribute("cx", eF[0] + R * 0.02); pupilF.setAttribute("cy", eF[1] + R * 0.01);
      pupilN.setAttribute("r", R * F.pupilR); pupilF.setAttribute("r", R * F.pupilR * 0.9);
      // brows: a stroke with an arch, tilted by face.brow
      // a lens: thick at the inner end, tapering to the outer one
      function browD(cx, cy, wid, tilt, th) {
        var t0 = th, t1 = th * 0.28;
        return smooth([
          [cx - wid, cy + tilt * 0.6 - t0 * 0.5], [cx - wid * 0.25, cy - wid * 0.26 + tilt * 0.2 - t0],
          [cx + wid, cy - wid * 0.08 - tilt - t1],
          [cx + wid, cy - wid * 0.08 - tilt + t1], [cx - wid * 0.25, cy - wid * 0.26 + tilt * 0.2 + t0 * 0.55],
          [cx - wid, cy + tilt * 0.6 + t0 * 0.5]
        ], true);
      }
      browN.setAttribute("d", browD(eN[0], eN[1] - R * F.browGap, R * F.browW * NW, face.brow, R * F.browTh));
      browF.setAttribute("d", browD(eF[0], eF[1] - R * F.browGap, R * F.browW * 0.92 * NW, face.brow * 0.8, R * F.browTh * 0.92));
      // the nose: a bridge that turns into a nostril, on the side he faces
      var nX = tx(F.noseX, F.noseXF);
      nose.setAttribute("d", smooth([hp(nX, F.noseY), hp(nX + 0.12 * (1 - TU * 0.5), F.noseY + 0.20),
                                     hp(nX - 0.06 - 0.08 * TU, F.noseY + 0.26)], false));
      // and a small mouth that is not quite a straight line -- and that OPENS.
      // The contact strip of video 10 caught nineteen seconds of a shut mouth
      // under his own narration. face.open is 0..1 and turns the line into a
      // lens; drive it per frame from the caller's sync(), not from a tween,
      // because speech is faster than any ease.
      var mX = tx(F.mouthX, F.mouthXF), mW = F.mouthW * (1 + 0.45 * TU);
      var mo = Math.max(0, Math.min(1, face.open || 0));
      if (mo > 0.08) {
        mouth.setAttribute("d", smooth([hp(mX - mW * (1 + 0.12 * mo), F.mouthY),
                                        hp(mX, F.mouthY + 0.01),
                                        hp(mX + mW * (1 + 0.12 * mo), F.mouthY - 0.01),
                                        hp(mX, F.mouthY + 0.05 + 0.085 * mo)], true));
      } else {
        mouth.setAttribute("d", smooth([hp(mX - mW, F.mouthY),
                                        hp(mX, F.mouthY + 0.03),
                                        hp(mX + mW, F.mouthY - 0.01)], false));
      }
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
      /** face.brow — flat at 0, tilts a few units. face.open — 0..1, the mouth.
          face.turn — 0 in profile, 1 facing camera. */
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
