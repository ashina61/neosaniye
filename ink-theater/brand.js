/* Ink Theater — THE CHANNEL'S MARKS
 *
 * The two things that appear in every video and belong to the channel rather
 * than to any one of them: the logo, and the one moment the film asks for
 * something. Both live here so a composition gets them in three lines and they
 * cannot drift apart between videos.
 *
 *   InkBrand.mark(defs, parent, { x: 44, y: 52, w: 132, accent: STEP });
 *   InkBrand.subscribe(tl, svgRoot, { at: 58.6, accent: STEP });
 *
 * THE LOGO TAKES THE VIDEO'S ACCENT COLOUR. The monogram is always ink; the
 * play triangle inside it is whatever colour that particular film has rationed
 * out to mean something. The mark is the channel's, the highlight is the
 * video's, and the brand never fights the palette.
 *
 * It is stored as two alpha masks — the monogram and the triangle, separated
 * out of the source artwork — so both are PAINTED, not drawn, and neither
 * carries a colour of its own. Base64, so a composition needs no asset file.
 *
 * WHERE IT GOES. Top left, clear of the Shorts chrome, at about 130px wide, and
 * at 0.72 opacity so it is a signature and not a sticker.
 */
(function (root) {
  var NS = "http://www.w3.org/2000/svg";
  var W = 384, H = 290;
  var INK_URI = "data:image/png;base64,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";
  var ACC_URI = "data:image/png;base64,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";
  var uid = 0;

  function el(tag, a, parent) {
    var n = document.createElementNS(NS, tag);
    for (var k in a) {
      if (k === "href") n.setAttributeNS("http://www.w3.org/1999/xlink", "href", a[k]);
      else n.setAttribute(k, a[k]);
    }
    if (parent) parent.appendChild(n);
    return n;
  }

  /* The logo. `defs` is the composition's <defs>, `parent` is where it goes.
     Returns the <g>, so a timeline can fade it. */
  function mark(defs, parent, o) {
    o = o || {};
    var x = o.x != null ? o.x : 44, y = o.y != null ? o.y : 52;
    var w = o.w || 132, h = w * H / W, id = "brand" + (++uid);
    var ink = o.ink || "#333333", accent = o.accent || "#333333";
    [["i", INK_URI], ["a", ACC_URI]].forEach(function (p) {
      var m = el("mask", { id: id + p[0], maskUnits: "userSpaceOnUse",
                           "mask-type": "alpha", x: x, y: y, width: w, height: h }, defs);
      el("image", { href: p[1], x: x, y: y, width: w, height: h,
                    preserveAspectRatio: "xMidYMid meet" }, m);
    });
    var g = el("g", {}, parent);
    el("rect", { x: x, y: y, width: w, height: h, fill: ink, mask: "url(#" + id + "i)" }, g);
    el("rect", { x: x, y: y, width: w, height: h, fill: accent, mask: "url(#" + id + "a)" }, g);
    g.setAttribute("opacity", o.opacity != null ? o.opacity : 0.72);
    return g;
  }

  /* The one moment the film asks for something. Drawn in the same hand as
     everything else: a pill scribbled into the caption band, the word, and a
     hand that comes up and taps it.
     Put it AFTER the last line, never over one — a film that interrupts its own
     argument to beg has lost the argument. Returns the time it finishes. */
  function subscribe(tl, svgRoot, o) {
    o = o || {};
    var at = o.at != null ? o.at : 0, accent = o.accent || "#333333";
    var ink = o.ink || "#333333", paper = o.paper || "#FCFBF8";
    var cx = o.cx || 540, cy = o.cy || 1312, w = o.w || 496, h = o.h || 116;
    var g = el("g", {}, svgRoot);
    var seed = 8675309;
    function rnd() { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296 - 0.5; }
    // a pill the way a hand draws one: round the outside in one stroke, wobbly
    var r = h / 2, half = w / 2 - r, pts = [], i, a, cxx;
    for (i = 0; i <= 76; i++) {
      a = -Math.PI / 2 + i / 76 * Math.PI * 2;
      cxx = cx + (Math.cos(a) >= 0 ? half : -half);
      pts.push([cxx + Math.cos(a) * r + rnd() * 2.6, cy + Math.sin(a) * r + rnd() * 2.6]);
    }
    var d = "", j;
    for (j = 0; j < pts.length; j++) d += (j ? "L" : "M") + pts[j][0].toFixed(1) + " " + pts[j][1].toFixed(1) + " ";
    var fillPill = el("path", { d: d + "Z", fill: accent, stroke: "none", opacity: 0 }, g);
    var pill = el("path", { d: d, fill: "none", stroke: ink, "stroke-width": 6,
                            "stroke-linecap": "round", "stroke-linejoin": "round" }, g);
    var word = el("text", { x: cx, y: cy + 22, "text-anchor": "middle",
                            "font-family": "InkHand, cursive", "font-size": 64,
                            fill: ink, opacity: 0 }, g);
    word.textContent = o.text || "SUBSCRIBE";
    var handG = el("g", { opacity: 0 }, g);
    var fx = cx + 150, fy = cy + 62;
    el("path", { d: "M" + fx + " " + fy + " l0 108 l104 0 l0 -78 q0 -17 -17 -17 l-9 0 q0 -14 -15 -14 " +
                    "q-15 0 -15 14 l-7 0 q0 -13 -14 -13 q-14 0 -14 13 l0 -60 q0 -16 -16 -16 q-16 0 -16 16 Z",
                 fill: paper, stroke: ink, "stroke-width": 6, "stroke-linejoin": "round" }, handG);
    var pop = el("path", {
      d: "M" + (cx + 128) + " " + (cy + 30) + " l-30 -22 M" + (cx + 172) + " " + (cy + 18) + " l-4 -36 " +
         "M" + (cx + 214) + " " + (cy + 30) + " l24 -28",
      fill: "none", stroke: accent, "stroke-width": 7, "stroke-linecap": "round", opacity: 0 }, g);

    var L = pill.getTotalLength();
    pill.style.strokeDasharray = L; pill.style.strokeDashoffset = L;
    tl.to(pill, { strokeDashoffset: 0, duration: 0.64, ease: "power1.inOut" }, at);
    tl.set(pill, { strokeDasharray: "none" }, at + 0.64);
    tl.to(word, { attr: { opacity: 1 }, duration: 0.30 }, at + 0.38);
    tl.fromTo(handG, { attr: { opacity: 0 }, y: 104 },
                     { attr: { opacity: 1 }, y: 0, duration: 0.44, ease: "power2.out" }, at + 0.80);
    tl.to(handG, { y: -30, duration: 0.14, ease: "power2.in" }, at + 1.34);          // the tap
    tl.to(fillPill, { attr: { opacity: 1 }, duration: 0.001 }, at + 1.48);
    tl.to(word, { attr: { fill: paper }, duration: 0.001 }, at + 1.48);
    tl.to(pop, { attr: { opacity: 1 }, duration: 0.001 }, at + 1.50);
    tl.to(handG, { y: 6, duration: 0.22, ease: "power2.out" }, at + 1.48);
    tl.to(pop, { attr: { opacity: 0 }, duration: 0.28 }, at + 1.70);
    tl.to(handG, { attr: { opacity: 0 }, y: 92, duration: 0.36, ease: "power2.in" }, at + 2.06);
    tl.to(g, { attr: { opacity: 0 }, duration: 0.46 }, at + 2.52);
    return at + 2.98;
  }

  root.InkBrand = { mark: mark, subscribe: subscribe, size: [W, H] };
})(window);
