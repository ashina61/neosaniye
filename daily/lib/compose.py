"""Render a video spec into a HyperFrames composition (1080x1920 vertical).

The template owns the look — palette, type system, motion grammar, the vertical
safe zones, and the HyperFrames contract rules that lint/inspect enforce. A spec
only supplies content: the script, which scene archetype each beat uses, and the
words on screen. Scene timing is derived from measured narration, never guessed.

Learned constraints baked in here (each one cost a render to find):
  * Zones: art 260-1120, headline 1150-1420, caption 1490-1740. Overlapping the
    caption band is the most common way a scene becomes unreadable.
  * Headlines are Anton (condensed) and set `nowrap`; at 118px a 16-character
    line just fits the 924px column.
  * Adjacent scenes alternate tracks so they can cross-fade without a same-track
    overlap error.
  * Every fade-out that lands on a clip boundary needs a `tl.set` hard kill, or
    non-linear seeking leaves stale opacity behind.
  * The vignette is painted under the scenes, not over them. Above them it
    counts as an opaque coverer, and any headline near the frame edge then
    trips `text_occluded` — a class of failure no per-element escape hatch
    settles, because the next scene layout finds a new way to hit it.
"""
from __future__ import annotations

import html
import json
import random
from pathlib import Path

W, H, FPS = 1080, 1920, 30
ZONE_HEADLINE, CAPTION_TOP = 1150, 1490
XFADE = 0.35


def esc(s: str) -> str:
    return html.escape(str(s), quote=True)


# ----------------------------------------------------------------- backdrops
def _stars(rng: random.Random) -> str:
    out = []
    for _ in range(46):
        out.append('<i style="left:%.2f%%;top:%.2f%%;width:%.2fpx;height:%.2fpx;opacity:%.2f"></i>'
                   % (rng.uniform(2, 98), rng.uniform(1, 46),
                      rng.uniform(1.1, 2.9), rng.uniform(1.1, 2.9), rng.uniform(.18, .72)))
    return "".join(out)


def _motif(kind: str, idp: str) -> str:
    """A large, animated focal element for the art zone (y 260-1120).

    The generic template has no subject to draw, so without one of these the
    upper two thirds of the frame reads as dead space and the piece looks like
    captions on a gradient. Each motif is a plain SVG the timeline animates.
    """
    if kind == "wave":
        pts = " ".join(f"{x},{690 - 210 * (1 if (x // 60) % 2 else -1) * (0.35 + 0.65 * abs(((x - 540) / 540)) ** 0.6):.0f}"
                       for x in range(60, 1021, 60))
        bars = "".join(
            f'<rect class="mfbar" x="{x}" y="{690 - h}" width="26" height="{2*h}" rx="13"/>'
            for x, h in ((x, int(60 + 250 * (1 - abs((x - 540) / 520) ** 1.6))) for x in range(70, 1011, 52)))
        return f'<g id="{idp}-motif" class="motif">{bars}</g>'
    if kind == "rings":
        return (f'<g id="{idp}-motif" class="motif">'
                + "".join(f'<circle class="mfring" cx="540" cy="690" r="{r}"/>' for r in (140, 240, 340, 440))
                + f'<circle class="mfdot" cx="540" cy="690" r="54"/></g>')
    if kind == "beam":
        return (f'<g id="{idp}-motif" class="motif">'
                f'<path class="mfbeam" d="M120,420 L960,420"/>'
                f'<path class="mfbeam" d="M120,690 L960,690"/>'
                f'<path class="mfbeam" d="M120,960 L960,960"/>'
                f'<circle class="mfdot" cx="200" cy="690" r="40"/>'
                f'<circle class="mfdot mfdot-2" cx="880" cy="690" r="40"/></g>')
    if kind == "split":
        return (f'<g id="{idp}-motif" class="motif">'
                f'<path class="mfsplit" d="M540,340 L540,560"/>'
                f'<path class="mfsplit mfsplit-a" d="M540,560 C540,760 300,780 260,1000"/>'
                f'<path class="mfsplit mfsplit-b" d="M540,560 C540,760 780,780 820,1000"/>'
                f'<circle class="mfdot" cx="540" cy="560" r="26"/></g>')
    if kind == "particles":
        rng2 = random.Random(hash(idp) & 0xFFFF)
        dots = "".join(
            f'<circle class="mfp" cx="{rng2.uniform(120, 960):.0f}" cy="{rng2.uniform(340, 1040):.0f}" '
            f'r="{rng2.uniform(5, 17):.1f}" opacity="{rng2.uniform(.25, .85):.2f}"/>' for _ in range(34))
        return f'<g id="{idp}-motif" class="motif">{dots}</g>'
    return ""


def _backdrop(kind: str, rng: random.Random, idp: str) -> str:
    """Scene backdrop plus its focal motif, as one SVG. Seeded at build time."""
    layers = []
    if kind == "flowlines":
        for i in range(7):
            y = 300 + i * 130 + rng.uniform(-18, 18)
            layers.append(f'<path class="bdflow" d="M-40,{y:.0f} Q540,{y+rng.uniform(-70,70):.0f} 1120,{y:.0f}"/>')
    elif kind == "grid":
        layers += [f'<path class="bdgrid" d="M{x},240 L{x},1400"/>' for x in range(60, 1081, 145)]
        layers += [f'<path class="bdgrid" d="M40,{y} L1040,{y}"/>' for y in range(280, 1401, 160)]
    elif kind == "orbit":
        layers += [f'<ellipse class="bdring" cx="540" cy="690" rx="{r}" ry="{int(r*0.42)}"/>'
                   for r in (220, 350, 480)]
    if not layers and not idp:
        return ""
    return ('<svg class="art" viewBox="0 0 1080 1920" preserveAspectRatio="xMidYMid slice">'
            + "".join(layers) + "</svg>")


# -------------------------------------------------------------- scene bodies
def _scene_body(sc: dict, sid: str, rng: random.Random) -> str:
    t = sc["type"]
    # `card` and `compare` already fill the art zone with a panel; a motif behind
    # one competes with it and reads as clutter, so it is dropped rather than
    # left to a spec author to remember.
    # A scene running stock footage drops both backdrop and motif: the footage is
    # the art, and graphics layered on it just fight for the frame.
    on_footage = bool(sc.get("_has_stock"))
    wants_motif = sc.get("motif") and t not in ("card", "compare", "metric") and not on_footage
    art = sc.get("art_svg") or ("" if on_footage else (
        _backdrop(sc.get("backdrop", "plain"), rng, sid)
        + ('<svg class="art" viewBox="0 0 1080 1920" preserveAspectRatio="xMidYMid slice">'
           + _motif(sc["motif"], sid) + "</svg>" if wants_motif else "")))

    if t == "hook":
        badge = ""
        if sc.get("badge"):
            b = sc["badge"]
            badge = (f'<div id="{sid}-badge" class="badge">'
                     f'<span class="badge-k">{esc(b["label"])}</span>'
                     f'<span class="badge-v"><b id="{sid}-count">0</b> {esc(b.get("unit",""))}</span></div>')
        heads = "".join(
            f'<div id="{sid}-h{i}" class="kh{" kh-amber" if i else ""}" '
            f'style="position:absolute;left:78px;top:{ZONE_HEADLINE + i*122}px">{esc(x)}</div>'
            for i, x in enumerate(sc.get("headline", [])[:2]))
        return f'<div class="stage">{art}{badge}{heads}</div>'

    if t == "statement":
        lines = sc.get("headline", [])[:2]
        acc = sc.get("accent", "cyan")
        body = "".join(f'<div id="{sid}-k{i}" class="kh{"" if i == 0 else f" kh-{acc}"}">{esc(x)}</div>'
                       for i, x in enumerate(lines))
        return f'<div class="stage">{art}<div id="{sid}-lines" class="klines">{body}</div></div>'

    if t == "card":
        legend = (f'<div id="{sid}-lg" class="eq-legend">{sc["legend"]}</div>'
                  if sc.get("legend") else "")
        tag = (f'<div id="{sid}-tag" class="zerotag">{esc(sc["tagline"])}</div>'
               if sc.get("tagline") else "")
        return (f'<div class="stage">{art}<div id="{sid}-card" class="card">'
                f'<div class="card-top">{esc(sc.get("eyebrow","THE RULE"))}</div>'
                f'<div id="{sid}-body" class="card-body">{sc["body"]}</div>{legend}</div>{tag}</div>')

    if t == "metric":
        heads = "".join(f'<div class="kh{" kh-amber" if i else ""}">{esc(x)}</div>'
                        for i, x in enumerate(sc.get("headline", [])[:2]))
        return (f'<div class="stage">{art}'
                f'<div id="{sid}-meter" class="meter{" meter-danger" if sc.get("danger") else ""}">'
                f'<div class="meter-k">{esc(sc["label"])}</div>'
                f'<div class="meter-v"><b id="{sid}-mv">0</b><span>{esc(sc.get("unit",""))}</span></div></div>'
                f'<div id="{sid}-k" class="klines">{heads}</div></div>')

    if t == "list":
        items = sc.get("items", [])[:3]
        body = "".join(
            f'<div id="{sid}-i{i}" class="slam{" slam-amber" if i == len(items)-1 else ""}">{esc(x)}</div>'
            for i, x in enumerate(items))
        return f'<div class="stage">{art}<div class="stack">{body}</div></div>'

    if t == "compare":
        cols = sc.get("columns", [])[:2]
        cells = "".join(
            f'<div id="{sid}-c{i}" class="col">'
            f'<div class="chip chip-{"risk" if c.get("risk") else "ok"}">{esc(c["chip"])}</div>'
            f'<div class="col-big">{esc(c["value"])}</div>'
            f'<div class="col-lab">{esc(c["label"])}</div></div>'
            for i, c in enumerate(cols))
        return f'<div class="stage">{art}<div class="cols">{cells}</div></div>'

    if t == "endcard":
        l = sc.get("lines", ["", ""])
        return (f'<div class="stage">{art}<div id="{sid}-end" class="endcard">'
                f'<div class="end-1">{esc(l[0])}</div><div class="end-2">{esc(l[1] if len(l)>1 else "")}</div>'
                f'</div></div>')

    raise ValueError(f"unknown scene type {t!r}")


# ------------------------------------------------------------------ timeline
def _motif_tweens(sc: dict, sid: str, st: float, A) -> None:
    kind = sc.get("motif")
    if not kind or sc["type"] in ("card", "compare", "metric") or sc.get("_has_stock"):
        return                                          # see _scene_body
    if kind == "wave":
        A(f'tl.fromTo("#{sid}-motif .mfbar",{{scaleY:0.06,opacity:0}},'
          f'{{scaleY:1,opacity:.55,duration:.7,ease:B,stagger:{{each:.026,from:"center"}}}},{st+0.15:.2f});')
        A(f'tl.to("#{sid}-motif .mfbar",{{scaleY:0.45,duration:1.6,ease:"sine.inOut",'
          f'stagger:{{each:.02,from:"edges"}}}},{st+1.5:.2f});')
    elif kind == "rings":
        A(f'tl.fromTo("#{sid}-motif .mfring",{{scale:.2,opacity:0}},'
          f'{{scale:1,opacity:.42,duration:1.0,ease:E,stagger:.14}},{st+0.15:.2f});')
        A(f'tl.fromTo("#{sid}-motif .mfdot",{{scale:0}},{{scale:1,duration:.45,ease:B}},{st+0.3:.2f});')
    elif kind == "beam":
        A(f'tl.fromTo("#{sid}-motif .mfbeam",{{opacity:0,scaleX:.3}},'
          f'{{opacity:1,scaleX:1,duration:.6,ease:E,stagger:.1}},{st+0.15:.2f});')
        A(f'tl.fromTo("#{sid}-motif .mfdot",{{x:0}},{{x:680,duration:2.2,ease:"power1.inOut"}},{st+0.5:.2f});')
        A(f'tl.fromTo("#{sid}-motif .mfdot-2",{{x:0}},{{x:-680,duration:2.2,ease:"power1.inOut"}},{st+0.5:.2f});')
    elif kind == "split":
        A(f'tl.fromTo("#{sid}-motif .mfsplit",{{strokeDashoffset:900,opacity:0}},'
          f'{{strokeDashoffset:0,opacity:1,duration:1.1,ease:EI,stagger:.18}},{st+0.15:.2f});')
        A(f'tl.fromTo("#{sid}-motif .mfdot",{{scale:0}},{{scale:1,duration:.4,ease:B}},{st+0.45:.2f});')
    elif kind == "particles":
        A(f'tl.fromTo("#{sid}-motif .mfp",{{scale:0,opacity:0}},'
          f'{{scale:1,opacity:.6,duration:.8,ease:B,stagger:{{each:.018,from:"random"}}}},{st+0.15:.2f});')
        A(f'tl.to("#{sid}-motif .mfp",{{y:-46,duration:2.6,ease:"sine.inOut",'
          f'stagger:{{each:.02,from:"random"}}}},{st+0.9:.2f});')


def _scene_tweens(sc: dict, sid: str, st: float, du: float, A) -> None:
    _motif_tweens(sc, sid, st, A)
    t = sc["type"]
    if t == "hook":
        if sc.get("badge"):
            A(f'tl.fromTo("#{sid}-badge",{{opacity:0,y:22,scale:.94}},'
              f'{{opacity:1,y:0,scale:1,duration:.5,ease:B}},{st+0.9:.2f});')
            tgt = sc["badge"].get("count_to", 0)
            A(f'const c_{sid}={{v:0}}; tl.to(c_{sid},{{v:{tgt},duration:1.15,ease:"power2.out",'
              f'onUpdate:()=>{{document.getElementById("{sid}-count").textContent='
              f'Math.round(c_{sid}.v).toLocaleString("en-US");}}}},{st+1.1:.2f});')
        for i in range(len(sc.get("headline", [])[:2])):
            A(f'tl.fromTo("#{sid}-h{i}",{{opacity:0,y:54}},{{opacity:1,y:0,duration:.5,ease:E}},'
              f'{st+du-1.6+i*0.3:.2f});')
        A(f'tl.fromTo("#{sid} .stage",{{scale:1}},{{scale:1.07,duration:{du:.2f},ease:"none"}},{st:.2f});')
    elif t == "statement":
        for i in range(len(sc.get("headline", [])[:2])):
            A(f'tl.fromTo("#{sid}-k{i}",{{opacity:0,y:46}},{{opacity:1,y:0,duration:.42,ease:E}},'
              f'{st+0.45+i*0.25:.2f});')
    elif t == "card":
        A(f'tl.fromTo("#{sid}-card",{{opacity:0,y:44,scale:.96}},'
          f'{{opacity:1,y:0,scale:1,duration:.55,ease:B}},{st+0.15:.2f});')
        if sc.get("legend"):
            A(f'tl.fromTo("#{sid}-lg",{{opacity:0,y:20}},{{opacity:1,y:0,duration:.4,ease:E}},{st+0.95:.2f});')
        if sc.get("tagline"):
            A(f'tl.fromTo("#{sid}-tag",{{opacity:0,y:28}},{{opacity:1,y:0,duration:.45,ease:E}},{st+1.35:.2f});')
    elif t == "metric":
        A(f'tl.fromTo("#{sid}-meter",{{opacity:0,scale:.9}},{{opacity:1,scale:1,duration:.4,ease:B}},{st+0.2:.2f});')
        frm, to = sc.get("count_from", 0), sc.get("count_to", 0)
        A(f'const m_{sid}={{v:{frm}}}; tl.to(m_{sid},{{v:{to},duration:.8,ease:"power4.out",'
          f'onUpdate:()=>{{document.getElementById("{sid}-mv").textContent='
          f'Math.round(m_{sid}.v).toLocaleString("en-US");}}}},{st+0.35:.2f});')
        A(f'tl.fromTo("#{sid}-k",{{opacity:0,y:34}},{{opacity:1,y:0,duration:.45,ease:E}},{st+1.3:.2f});')
    elif t == "list":
        for i in range(len(sc.get("items", [])[:3])):
            at = st + 0.35 + i * min(0.62, max(0.34, (du - 1.0) / 3))
            A(f'tl.fromTo("#{sid}-i{i}",{{opacity:0,scale:1.5,y:26}},'
              f'{{opacity:1,scale:1,y:0,duration:.34,ease:B}},{at:.2f});')
            A(f'tl.fromTo("#{sid} .stage",{{x:-7}},{{x:0,duration:.26,ease:"elastic.out(1,0.35)"}},{at:.2f});')
    elif t == "compare":
        for i in range(len(sc.get("columns", [])[:2])):
            A(f'tl.fromTo("#{sid}-c{i}",{{opacity:0,y:30}},{{opacity:1,y:0,duration:.45,ease:E}},'
              f'{st+0.3+i*0.22:.2f});')
    elif t == "endcard":
        A(f'tl.fromTo("#{sid}-end .end-1",{{opacity:0,y:44}},{{opacity:1,y:0,duration:.45,ease:E}},{st+0.3:.2f});')
        A(f'tl.fromTo("#{sid}-end .end-2",{{opacity:0,y:44}},{{opacity:1,y:0,duration:.45,ease:E}},{st+0.55:.2f});')


CSS = """
      @font-face { font-family:"AntonL"; src:url("assets/fonts/anton-400.woff2") format("woff2"); font-weight:400; font-display:block; }
      @font-face { font-family:"InterL"; src:url("assets/fonts/inter-400.woff2") format("woff2"); font-weight:400; font-display:block; }
      @font-face { font-family:"InterL"; src:url("assets/fonts/inter-600.woff2") format("woff2"); font-weight:600; font-display:block; }
      @font-face { font-family:"InterL"; src:url("assets/fonts/inter-800.woff2") format("woff2"); font-weight:800; font-display:block; }
      * { margin:0; padding:0; box-sizing:border-box; }
      html, body { width:1080px; height:1920px; overflow:hidden; background:#05070E; }
      body { font-family:"InterL", system-ui, sans-serif; -webkit-font-smoothing:antialiased; }
      #root { position:relative; width:1080px; height:1920px; overflow:hidden; }
      #bg { position:absolute; inset:0; background:radial-gradient(120% 70% at 50% 4%, #16233F 0%, #0A1122 42%, #05070E 78%); }
      #glow { position:absolute; left:-10%; right:-10%; bottom:-16%; height:52%; background:#12325a; filter:blur(120px); border-radius:50%; opacity:.6; }
      #stars { position:absolute; inset:0; }
      #stars i { position:absolute; display:block; background:#CFE2FF; border-radius:50%; }
      #vig { position:absolute; inset:0; pointer-events:none; background:radial-gradient(115% 78% at 50% 44%, rgba(0,0,0,0) 52%, rgba(0,0,0,.62) 100%); }
      video.stock { position:absolute; inset:0; width:1080px; height:1920px; object-fit:cover; }
      /* Footage cannot be contrast-checked statically, so this ramp is the only
         guarantee that headlines stay readable over it. It stays light through
         the art zone and deepens from 62% down, where the headline band sits. */
      #scrim { position:absolute; inset:0; background:
               linear-gradient(180deg, rgba(5,7,14,.74) 0%, rgba(5,7,14,.34) 24%,
                                       rgba(5,7,14,.42) 50%, rgba(5,7,14,.66) 62%,
                                       rgba(5,7,14,.92) 80%, rgba(5,7,14,.97) 100%); }
      .scene { position:absolute; inset:0; }
      .stage { position:absolute; inset:0; transform-origin:50% 46%; }
      .art { position:absolute; inset:0; width:1080px; height:1920px; }
      .bdflow { fill:none; stroke:#46E0FF; stroke-width:5; stroke-linecap:round; stroke-dasharray:26 46; opacity:.42; }
      .bdgrid { fill:none; stroke:#3E5170; stroke-width:2; opacity:.75; }
      .bdring { fill:none; stroke:#3E5170; stroke-width:4; opacity:.85; }
      .motif { transform-box:fill-box; }
      .mfbar { fill:#46E0FF; opacity:.55; transform-box:fill-box; transform-origin:50% 50%; }
      .mfring { fill:none; stroke:#46E0FF; stroke-width:5; opacity:.42; transform-box:fill-box; transform-origin:50% 50%; }
      .mfdot { fill:#F5B942; filter:drop-shadow(0 0 22px rgba(245,185,66,.75)); }
      .mfdot-2 { fill:#46E0FF; filter:drop-shadow(0 0 22px rgba(70,224,255,.75)); }
      .mfbeam { fill:none; stroke:#33425E; stroke-width:12; stroke-linecap:round; }
      .mfsplit { fill:none; stroke:#8A96AC; stroke-width:10; stroke-linecap:round; stroke-dasharray:900; }
      .mfsplit-a { stroke:#46E0FF; } .mfsplit-b { stroke:#F5B942; }
      .mfp { fill:#46E0FF; }
      .kh { font-family:"AntonL", sans-serif; font-size:118px; line-height:.98; white-space:nowrap; letter-spacing:.01em; color:#F2F5FA; text-transform:uppercase; }
      .kh-amber { color:#F5B942; } .kh-cyan { color:#46E0FF; } .kh-red { color:#FF6161; }
      .klines { position:absolute; left:78px; top:1160px; }
      .badge { position:absolute; left:78px; top:760px; padding:22px 32px; border-radius:20px; background:rgba(9,16,30,.82); border:2px solid rgba(70,224,255,.35); }
      .badge-k { display:block; font-size:26px; letter-spacing:.26em; color:#46E0FF; font-weight:800; }
      .badge-v { display:block; margin-top:8px; font-size:76px; font-weight:800; color:#F2F5FA; }
      .badge-v b { font-family:"AntonL", sans-serif; font-weight:400; }
      .card { position:absolute; left:78px; right:78px; top:590px; padding:56px 48px 52px; border-radius:34px; background:rgba(10,18,34,.9); border:2px solid rgba(138,150,172,.22); text-align:center; }
      .card-top { font-size:28px; letter-spacing:.3em; color:#8A96AC; font-weight:800; }
      .card-body { margin-top:34px; font-family:"AntonL", sans-serif; font-size:96px; line-height:1.05; color:#F2F5FA; }
      .card-body em { color:#46E0FF; font-style:normal; }
      .eq-legend { margin-top:30px; font-size:40px; color:#B9C4D6; font-weight:600; }
      .eq-legend em { color:#46E0FF; font-style:normal; font-weight:800; }
      .zerotag { position:absolute; left:78px; right:78px; top:1120px; text-align:center; font-family:"AntonL", sans-serif; font-size:74px; color:#46E0FF; }
      .meter { position:absolute; left:50%; transform:translateX(-50%); top:700px; min-width:620px; padding:30px 44px; border-radius:26px; text-align:center; background:rgba(9,16,30,.92); border:2px solid rgba(70,224,255,.35); }
      .meter-k { font-size:24px; letter-spacing:.24em; color:#8A96AC; font-weight:800; }
      .meter-v { margin-top:10px; font-size:96px; color:#F2F5FA; font-weight:800; display:flex; align-items:baseline; justify-content:center; gap:14px; }
      .meter-v b { font-family:"AntonL", sans-serif; font-weight:400; }
      .meter-v span { font-size:46px; color:#8A96AC; }
      .meter-danger { border-color:rgba(255,90,90,.5); }
      .meter-danger .meter-v b { color:#FF6161; }
      .stack { position:absolute; left:78px; right:78px; top:1000px; }
      .slam { font-family:"AntonL", sans-serif; font-size:112px; line-height:1.04; white-space:nowrap; color:#F2F5FA; text-transform:uppercase; transform-origin:0% 50%; }
      .slam-amber { color:#F5B942; }
      .cols { position:absolute; left:78px; right:78px; top:600px; display:flex; gap:36px; }
      .col { flex:1; padding:36px 26px; border-radius:28px; background:rgba(9,16,30,.85); border:2px solid rgba(138,150,172,.2); text-align:center; }
      .col-big { margin-top:22px; font-family:"AntonL", sans-serif; font-size:104px; color:#F2F5FA; line-height:1; }
      .col-lab { margin-top:16px; font-size:34px; color:#B9C4D6; font-weight:600; }
      .chip { display:inline-block; padding:12px 24px; border-radius:999px; font-size:32px; font-weight:800; letter-spacing:.06em; }
      .chip-ok { color:#5BE39A; background:rgba(12,40,28,.9); border:2px solid rgba(91,227,154,.45); }
      .chip-risk { color:#FF6161; background:rgba(46,12,12,.9); border:2px solid rgba(255,97,97,.5); }
      .endcard { position:absolute; left:78px; right:78px; top:1150px; text-align:center; }
      .end-1, .end-2 { font-family:"AntonL", sans-serif; font-size:124px; white-space:nowrap; }
      .end-1 { color:#F2F5FA; } .end-2 { color:#F5B942; }
      #caps { position:absolute; left:64px; right:64px; bottom:180px; height:250px; }
      .cap { position:absolute; left:0; right:0; bottom:0; text-align:center; opacity:0; }
      .cap span { display:inline-block; padding:18px 30px; border-radius:20px; background:rgba(5,8,16,.78); font-size:48px; line-height:1.25; font-weight:700; color:#F2F5FA; box-shadow:0 10px 40px rgba(0,0,0,.45); }
      #hud { position:absolute; left:0; right:0; top:0; height:8px; }
      #prog { position:absolute; inset:0; transform-origin:0% 50%; transform:scaleX(0); background:linear-gradient(90deg,#46E0FF,#F5B942); opacity:.85; }
"""


def build(spec: dict, timing: dict, out: Path, stock: dict | None = None) -> Path:
    """Emit index.html for `spec`, cut to the measured narration in `timing`.

    `stock` maps a scene index to a downloaded, normalised clip. Video elements
    must be direct children of the composition root — the framework owns their
    playback — so footage cannot sit inside the scene divs and gets its own
    tracks underneath instead.
    """
    beats = timing["beats"]
    dur = float(timing["target"])
    rng = random.Random(spec.get("seed", 20260901))
    scenes = spec["scenes"]
    stock = stock or {}
    for i, sc in enumerate(scenes):
        sc["_has_stock"] = i in stock
    if len(scenes) != len(beats):
        raise ValueError(f"spec has {len(scenes)} scenes but the script has {len(beats)} beats")

    # each scene spans its beat, overlapping the next by XFADE for the cross-fade
    placed = []
    for i, (sc, b) in enumerate(zip(scenes, beats)):
        st = max(0.0, b["start"] - (XFADE if i else b["start"]))
        end = (beats[i + 1]["start"] + XFADE * 0.0) if i + 1 < len(beats) else dur
        end = min(dur, end + (XFADE if i + 1 < len(beats) else 0.0))
        placed.append((f"s{i+1}", sc, round(st, 2), round(end - st, 2), 6 + (i % 2)))

    body = "\n".join(
        f'      <div id="{sid}" class="clip scene" data-start="{st}" data-duration="{du}" '
        f'data-track-index="{tr}">{_scene_body(sc, sid, rng)}</div>'
        for sid, sc, st, du, tr in placed)

    # Footage cuts on the beat while the text above it cross-fades. Alternating
    # tracks keep two adjacent clips off the same track during the dissolve.
    stock_html, stock_ids = [], []
    for i, info in sorted(stock.items()):
        start = beats[i]["start"] - (0.25 if i else 0.0)
        end = (beats[i + 1]["start"] + 0.25) if i + 1 < len(beats) else dur
        vid = f"stk{i}"
        stock_ids.append((vid, round(start, 2)))
        stock_html.append(
            f'<video id="{vid}" class="stock" data-start="{round(start,2)}" '
            f'data-duration="{round(min(end, dur) - start, 2)}" '
            f'data-track-index="{2 + (i % 2)}" data-media-start="0" muted '
            f'src="{esc(info["rel"])}"></video>')
    stock_markup = chr(10).join("      " + v for v in stock_html)
    scrim = (f'      <div id="scrimclip" class="clip" data-start="0" data-duration="{dur}" '
             f'data-track-index="4"><div id="scrim" data-layout-ignore></div></div>'
             if stock else "")

    caps = "".join(f'<div id="cap{i}" class="cap"><span>{esc(b.get("caption") or b["text"])}</span></div>'
                   for i, b in enumerate(beats))

    tl: list[str] = []
    A = tl.append
    A('const tl = gsap.timeline({ paused: true });')
    A('const E="power3.out", EI="power2.inOut", B="back.out(1.7)";')
    for sid, sc, st, du, _tr in placed:
        A(f'tl.fromTo("#{sid}",{{opacity:0}},{{opacity:1,duration:.42,ease:EI}},{st});')
        if st + du < dur - 0.01:
            A(f'tl.to("#{sid}",{{opacity:0,duration:.34,ease:EI}},{round(st+du-0.34,2)});')
            A(f'tl.set("#{sid}",{{opacity:0}},{round(st+du,2)});')   # hard kill for seeking
        _scene_tweens(sc, sid, st, du, A)

    turn = spec.get("turn_time")
    A(f'tl.fromTo("#glow",{{opacity:.55,backgroundColor:"#12325a"}},'
      f'{{opacity:.7,backgroundColor:"#173a63",duration:{dur*0.6:.1f},ease:"none"}},0);')
    if turn:
        A(f'tl.to("#glow",{{backgroundColor:"#5e1c1c",opacity:.8,duration:2.4,ease:EI}},{turn:.2f});')
        A(f'tl.to("#glow",{{backgroundColor:"#1b3556",opacity:.62,duration:2.2,ease:EI}},{min(turn+4.5,dur-1.5):.2f});')
    A('tl.fromTo("#stars i",{opacity:0},{opacity:1,duration:1.2,stagger:{each:.012,from:"random"},ease:E},.1);')
    for vid, vst in stock_ids:
        A(f'tl.fromTo("#{vid}",{{opacity:0}},{{opacity:1,duration:.38,ease:EI}},{vst:.2f});')
    for i, b in enumerate(beats):
        A(f'tl.fromTo("#cap{i}",{{opacity:0,y:20}},{{opacity:1,y:0,duration:.26,ease:E}},{b["start"]:.2f});')
        A(f'tl.to("#cap{i}",{{opacity:0,y:-14,duration:.22,ease:EI}},{b["end"]-0.02:.2f});')
        A(f'tl.set("#cap{i}",{{opacity:0}},{b["end"]+0.20:.2f});')
    A(f'tl.fromTo("#prog",{{scaleX:0}},{{scaleX:1,duration:{dur},ease:"none"}},0);')

    doc = f"""<!doctype html>
<html lang="en" data-resolution="portrait">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width={W}, height={H}" />
    <title>{esc(spec.get('title', 'Untitled'))}</title>
    <script src="node_modules/gsap/dist/gsap.min.js"></script>
    <style>{CSS}    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-width="{W}" data-height="{H}"
         data-duration="{dur}" data-fps="{FPS}">
      <div id="bgclip" class="clip" data-start="0" data-duration="{dur}" data-track-index="1">
        <div id="bg"></div><div id="glow" data-layout-ignore></div>
        <div id="stars">{_stars(rng)}</div>
      </div>
{stock_markup}
{scrim}
      <div id="fx" class="clip" data-start="0" data-duration="{dur}" data-track-index="5"><div id="vig" data-layout-ignore></div></div>
{body}
      <div id="caps" class="clip" data-start="0" data-duration="{dur}" data-track-index="8">{caps}</div>
      <div id="hud" class="clip" data-start="0" data-duration="{dur}" data-track-index="9"><div id="prog"></div></div>
    </div>
    <script>
      window.__timelines = window.__timelines || {{}};
      {chr(10) + '      '.join(tl)}
      window.__timelines["main"] = tl;
    </script>
  </body>
</html>
"""
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(doc)
    return out
