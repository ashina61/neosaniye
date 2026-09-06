/* Ink Theater — ANNOTATION
 *
 * The note that came back from the seventh video was: in some shots you cannot
 * tell what you are looking at. That is not a drawing problem, it is a missing
 * layer — every technical illustration ever made has a layer of arrows and
 * handwritten labels on top of the picture, and this channel did not have one.
 *
 *   InkAnnotate.callout(tl, g, { at: 12.0, out: 15.4, text: "the copy",
 *                                x: 760, y: 300, to: [640, 560], bend: -46 });
 *   InkAnnotate.measure(tl, g, { at: 20, out: 24, from: [200,900], to: [200,400],
 *                                text: "75 cm" });
 *   InkAnnotate.ring(tl, g, { at: 8, out: 11, cx: 540, cy: 700, r: 120 });
 *
 * Everything here is drawn in the same hand as the rest of the frame: wobbled
 * strokes, one weight of line, Patrick Hand for the words, and it draws itself
 * on and rubs itself out rather than fading like a caption. A label that fades
 * in is a graphic laid over a drawing; a label that is written is part of it.
 *
 * RULES, learned the hard way and worth keeping:
 *  - An arrow must not cross the thing it points at. Aim at the EDGE, and use
 *    `bend` to swing the shaft clear of everything between.
 *  - Never annotate and narrate the same fact at the same instant. The label is
 *    for what the caption cannot say: which part of the picture is which.
 *  - Two labels on screen at once is the limit. Three is a diagram, and this
 *    channel does not make diagrams.
 *  - Keep them out of 1250-1400 (the caption band) and below 1450 (the Shorts
 *    chrome). The margins are 40-1040 wide and 200-1180 tall, same as the
 *    picture.
 */
(function (root) {
  var NS = "http://www.w3.org/2000/svg";
  var seed = 1234567;
  function rnd() { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296 - 0.5; }
  function el(tag, a, parent) {
    var n = document.createElementNS(NS, tag);
    for (var k in a) n.setAttribute(k, a[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  // a straight run, drawn by a hand rather than a ruler
  function wob(a, b, amp, step) {
    var n = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / (step || 90))), o = [], i;
    for (i = 0; i <= n; i++) {
      var t = i / n, e = (i === 0 || i === n) ? 0 : 1;
      o.push([a[0] + (b[0] - a[0]) * t + rnd() * amp * 2 * e,
              a[1] + (b[1] - a[1]) * t + rnd() * amp * 2 * e]);
    }
    return o;
  }
  function dd(p) { var s = "", i; for (i = 0; i < p.length; i++) s += (i ? "L" : "M") + p[i][0].toFixed(1) + " " + p[i][1].toFixed(1) + " "; return s; }

  /* An arrow with a curved shaft. `bend` is how far the middle bows sideways —
     positive one way, negative the other — and it is the whole reason the shaft
     can get past whatever is in the way. Returns { shaft, head }. */
  function arrow(parent, from, to, o) {
    o = o || {};
    var col = o.color || "#333333", w = o.width || 6, bend = o.bend || 0;
    var hx = to[0] - from[0], hy = to[1] - from[1], L = Math.hypot(hx, hy) || 1;
    var nx = -hy / L, ny = hx / L;
    var mx = (from[0] + to[0]) / 2 + nx * bend, my = (from[1] + to[1]) / 2 + ny * bend;
    // stop short of the target so the head, not the shaft, touches it
    var back = o.gap != null ? o.gap : 26;
    var ex = to[0] - hx / L * back, ey = to[1] - hy / L * back;
    var pts = [], i, t, x, y;
    for (i = 0; i <= 16; i++) {                       // quadratic through the bow
      t = i / 16;
      x = (1 - t) * (1 - t) * from[0] + 2 * (1 - t) * t * mx + t * t * ex;
      y = (1 - t) * (1 - t) * from[1] + 2 * (1 - t) * t * my + t * t * ey;
      pts.push([x + (i && i < 16 ? rnd() * 2.6 : 0), y + (i && i < 16 ? rnd() * 2.6 : 0)]);
    }
    var shaft = el("path", { d: dd(pts), fill: "none", stroke: col, "stroke-width": w,
                             "stroke-linecap": "round", "stroke-linejoin": "round" }, parent);
    // the head points along the last bit of the shaft, not along the chord
    var p0 = pts[pts.length - 2], p1 = pts[pts.length - 1];
    var ax = p1[0] - p0[0], ay = p1[1] - p0[1], al = Math.hypot(ax, ay) || 1;
    ax /= al; ay /= al;
    var hs = o.head || 26;
    var head = el("path", { d: "M" + to[0].toFixed(1) + " " + to[1].toFixed(1) +
                               "L" + (to[0] - ax * hs + ay * hs * 0.52).toFixed(1) + " " + (to[1] - ay * hs - ax * hs * 0.52).toFixed(1) +
                               "L" + (to[0] - ax * hs * 0.62).toFixed(1) + " " + (to[1] - ay * hs * 0.62).toFixed(1) +
                               "L" + (to[0] - ax * hs - ay * hs * 0.52).toFixed(1) + " " + (to[1] - ay * hs + ax * hs * 0.52).toFixed(1) + "Z",
                            fill: col, stroke: "none" }, parent);
    return { shaft: shaft, head: head };
  }

  function words(parent, x, y, text, o) {
    o = o || {};
    var t = el("text", { x: x, y: y, "text-anchor": o.anchor || "middle",
                         "font-family": "InkHand, cursive", "font-size": o.size || 48,
                         fill: o.color || "#333333" }, parent);
    t.textContent = text;
    return t;
  }

  /* THE ONE TO REACH FOR: a handwritten word with an arrow from it to the thing
     it names. It writes itself on at `at` and is rubbed out at `out`. */
  function callout(tl, parent, o) {
    var g = el("g", {}, parent);
    var col = o.color || "#333333";
    var label = words(g, o.x, o.y, o.text, { size: o.size || 48, color: col, anchor: o.anchor });
    // the arrow leaves from just under the word, on the side the target is on
    var down = o.to[1] > o.y, side = o.to[0] > o.x ? 1 : -1;
    var fx = o.x + side * (o.text.length * (o.size || 48) * 0.20), fy = o.y + (down ? 22 : -46);
    var a = arrow(g, [fx, fy], o.to, { color: col, width: o.width || 6,
                                       bend: o.bend || 0, head: o.head || 26, gap: o.gap });
    var L = a.shaft.getTotalLength();
    a.shaft.style.strokeDasharray = L; a.shaft.style.strokeDashoffset = L;
    label.style.opacity = 0; a.head.style.opacity = 0;
    tl.to(label, { opacity: 1, duration: 0.22 }, o.at);
    tl.to(a.shaft, { strokeDashoffset: 0, duration: 0.42, ease: "power1.inOut" }, o.at + 0.14);
    tl.to(a.head, { opacity: 1, duration: 0.001 }, o.at + 0.56);
    if (o.out != null) tl.to(g, { opacity: 0, duration: 0.34 }, o.out);
    return g;
  }

  /* A dimension line: a run with a tick at each end and a number beside it.
     `side` pushes the number off the line. */
  function measure(tl, parent, o) {
    var g = el("g", {}, parent), col = o.color || "#8A857A";
    var dx = o.to[0] - o.from[0], dy = o.to[1] - o.from[1], L = Math.hypot(dx, dy) || 1;
    var nx = -dy / L, ny = dx / L, cap = o.cap || 20;
    var run = el("path", { d: dd(wob(o.from, o.to, 1.4, 110)), fill: "none", stroke: col,
                           "stroke-width": o.width || 5, "stroke-linecap": "round" }, g);
    var ticks = el("path", {
      d: "M" + (o.from[0] - nx * cap) + " " + (o.from[1] - ny * cap) + "L" + (o.from[0] + nx * cap) + " " + (o.from[1] + ny * cap) +
         "M" + (o.to[0] - nx * cap) + " " + (o.to[1] - ny * cap) + "L" + (o.to[0] + nx * cap) + " " + (o.to[1] + ny * cap),
      fill: "none", stroke: col, "stroke-width": o.width || 5, "stroke-linecap": "round" }, g);
    var s = o.side != null ? o.side : 44;
    var label = o.text ? words(g, (o.from[0] + o.to[0]) / 2 + nx * s, (o.from[1] + o.to[1]) / 2 + ny * s + 16,
                               o.text, { size: o.size || 44, color: o.textColor || col }) : null;
    var RL = run.getTotalLength();
    run.style.strokeDasharray = RL; run.style.strokeDashoffset = RL;
    ticks.style.opacity = 0; if (label) label.style.opacity = 0;
    tl.to(run, { strokeDashoffset: 0, duration: 0.40, ease: "power1.inOut" }, o.at);
    tl.to(ticks, { opacity: 1, duration: 0.001 }, o.at + 0.40);
    if (label) tl.to(label, { opacity: 1, duration: 0.22 }, o.at + 0.44);
    if (o.out != null) tl.to(g, { opacity: 0, duration: 0.34 }, o.out);
    return g;
  }

  /* Circling something on the page, the way anybody does it: round twice, not
     quite closed, not quite round. */
  function ring(tl, parent, o) {
    var col = o.color || "#333333", pts = [], i, a, r;
    for (i = 0; i <= 58; i++) {
      a = -0.5 + i / 58 * (Math.PI * 2 * 1.72);
      r = (o.r || 100) * (1 + 0.055 * Math.sin(a * 2.3 + 1) + i / 58 * 0.10) + rnd() * 3;
      pts.push([o.cx + Math.cos(a) * r * (o.sx || 1), o.cy + Math.sin(a) * r * (o.sy || 1)]);
    }
    var p = el("path", { d: dd(pts), fill: "none", stroke: col, "stroke-width": o.width || 6,
                         "stroke-linecap": "round" }, parent);
    var L = p.getTotalLength();
    p.style.strokeDasharray = L; p.style.strokeDashoffset = L;
    tl.to(p, { strokeDashoffset: 0, duration: o.dur || 0.60, ease: "power1.inOut" }, o.at);
    if (o.out != null) tl.to(p, { opacity: 0, duration: 0.34 }, o.out);
    return p;
  }

  root.InkAnnotate = { callout: callout, measure: measure, ring: ring,
                       arrow: arrow, words: words };
})(window);
