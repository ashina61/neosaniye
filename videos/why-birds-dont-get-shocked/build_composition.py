"""Generate index.html for 'Why Birds Don't Get Shocked' (1080x1920, 30s).

Scene boundaries are locked to the narration beats in audio/timing.json.
All randomness is baked at build time (seeded) so the render stays deterministic.
"""
import json, random

T = json.load(open('audio/timing.json'))
rng = random.Random(20260901)

W, H, DUR, FPS = 1080, 1920, 30.0, 30

# scene, start, duration, track — adjacent scenes alternate tracks so they can cross-fade
SCENES = [
    ("s1", 0.00, 5.60, 2), ("s2", 5.35, 3.75, 3), ("s3", 8.85, 2.90, 2),
    ("s4", 11.50, 3.75, 3), ("s5", 15.00, 3.45, 2), ("s6", 18.20, 4.05, 3),
    ("s7", 22.00, 5.05, 2), ("s8", 26.80, 3.20, 3),
]

CAPTIONS = [
    (0.35, 2.55, "A bird lands on a live power line."),
    (2.62, 5.15, "Thousands of volts. Nothing happens."),
    (5.60, 8.81, "Electricity isn't hunting the bird — it wants the ground."),
    (9.01, 11.45, "Current only flows where there's a difference in voltage."),
    (11.60, 14.92, "Both feet on the same wire. Same voltage."),
    (15.07, 17.74, "No difference. No push. No current."),
    (18.24, 21.89, "The bird is a detour to nowhere."),
    (22.14, 26.67, "Touch a second wire — and that difference appears instantly."),
    (26.97, 29.28, "The biggest birds are the ones at risk."),
]

# ---------- baked decorative fields -----------------------------------------
stars = []
for i in range(46):
    stars.append((round(rng.uniform(2, 98), 2), round(rng.uniform(1, 46), 2),
                  round(rng.uniform(1.1, 2.9), 2), round(rng.uniform(0.18, 0.72), 2)))
star_html = "".join(
    f'<i style="left:{x}%;top:{y}%;width:{s}px;height:{s}px;opacity:{o}"></i>' for x, y, s, o in stars)

sparks = []
for i in range(26):
    sparks.append((round(rng.uniform(-150, 150), 1), round(rng.uniform(-130, 130), 1),
                   round(rng.uniform(0.55, 1.0), 2)))

# ---------- reusable art ------------------------------------------------------
def bird(idp, scale=1.0, flip=False, wing="rest"):
    """Perched songbird silhouette. wing: rest | spread"""
    tf = "scale(-1,1) translate(-200,0)" if flip else ""
    wing_d = ("M62,66 C86,44 128,42 150,60 C126,76 88,80 62,66 Z" if wing == "spread"
              else "M70,72 C92,58 124,58 142,70 C120,84 92,86 70,72 Z")
    return f'''<svg id="{idp}" class="bird" viewBox="0 0 200 170" style="transform:scale({scale})">
 <g transform="{tf}">
  <path class="bd" d="M58,74 L6,44 L13,90 L52,99 Z"/>
  <ellipse class="bd" cx="98" cy="78" rx="49" ry="35"/>
  <circle class="bd" cx="145" cy="47" r="24"/>
  <path class="bd" d="M140,30 C150,20 160,22 166,30 C158,32 148,32 140,30 Z"/>
  <polygon class="bk" points="166,44 196,52 166,60"/>
  <path class="wg" d="{wing_d}"/>
  <circle class="ey" cx="152" cy="42" r="3.6"/>
  <path class="lg" d="M88,110 L86,146 M110,110 L113,146"/>
  <path class="lg" d="M78,147 L96,147 M105,147 L123,147"/>
 </g></svg>'''

def pole(x, h):
    return f'''<g transform="translate({x},0)">
  <rect class="pl" x="-9" y="{1180-h}" width="18" height="{h+60}"/>
  <rect class="pl" x="-92" y="{1180-h+40}" width="184" height="13"/>
  <rect class="pl" x="-70" y="{1180-h+110}" width="140" height="11"/>
 </g>'''

# ---------- scene bodies ------------------------------------------------------
S1 = f'''
<div class="stage">
 <svg class="art" viewBox="0 0 1080 1920" preserveAspectRatio="xMidYMid slice">
  <g id="s1-poles" class="silh">{pole(140, 710)}{pole(940, 710)}</g>
  <path id="s1-w1" class="wire" d="M-40,510 Q540,582 1120,510"/>
  <path id="s1-w2" class="wire" d="M-40,580 Q540,658 1120,580"/>
  <path id="s1-w3" class="wire" d="M-40,650 Q540,732 1120,650"/>
  <path id="s1-flow" class="flow" d="M-40,580 Q540,658 1120,580"/>
 </svg>
 <div id="s1-bird" class="birdwrap" style="left:440px;top:485px">{bird("s1-b", 1.8)}</div>
 <div id="s1-badge" class="badge" data-layout-allow-occlusion>
   <span class="badge-k">LIVE LINE</span>
   <span class="badge-v"><b id="s1-count">0</b> V</span>
 </div>
 <div id="s1-h1" class="kh">NOTHING</div>
 <div id="s1-h2" class="kh kh-amber">HAPPENS.</div>
</div>'''

S2 = f'''
<div class="stage">
 <svg class="art" viewBox="0 0 1080 1920" preserveAspectRatio="xMidYMid slice">
  <path id="s2-wire" class="wire wire-thick" d="M-40,420 L1120,420"/>
  <path id="s2-flow" class="flow flow-bright" d="M-40,420 L1120,420"/>
  <g id="s2-earth">
    <path class="earth" d="M170,1020 L910,1020"/>
    <path class="earth" d="M290,1072 L790,1072"/>
    <path class="earth" d="M400,1124 L680,1124"/>
    <path class="drop" d="M540,1020 L540,960"/>
  </g>
  <path id="s2-arrow" class="want" d="M540,460 L540,950"/>
 </svg>
 <div id="s2-bird" class="birdwrap" style="left:600px;top:281px">{bird("s2-b", 1.5)}</div>
 <div class="klines">
  <div id="s2-k1" class="kh">IT WANTS</div>
  <div id="s2-k2" class="kh kh-cyan">THE GROUND</div>
 </div>
</div>'''

S3 = '''
<div class="stage">
 <div class="card" id="s3-card">
   <div class="card-top">THE ONLY RULE</div>
   <div class="eq">
     <span class="eq-i">I</span>
     <span class="eq-op">=</span>
     <span class="eq-frac"><b id="s3-dv">&Delta;V</b><i></i><span>R</span></span>
   </div>
   <div class="eq-legend"><span id="s3-l1">&Delta;V &nbsp;=&nbsp; voltage <em>difference</em></span></div>
 </div>
 <div id="s3-zero" class="zerotag">no &Delta;V &nbsp;&rarr;&nbsp; no current</div>
</div>'''

S4 = '''
<div class="stage">
 <svg class="art" viewBox="0 0 1080 1920" preserveAspectRatio="xMidYMid slice">
  <rect id="s4-bar" class="copper" data-layout-allow-overflow x="-40" y="780" width="1160" height="46" rx="23"/>
  <path id="s4-cflow" class="flow flow-bright" d="M-40,803 L1120,803"/>
  <g id="s4-feet" class="feet">
    <path d="M415,782 C412,730 422,690 432,652 M478,782 C484,732 476,692 466,652"/>
    <path d="M602,782 C599,730 609,690 619,652 M665,782 C671,732 663,692 653,652"/>
  </g>
 </svg>
 <div id="s4-lt" class="pin pin-l">25,000 V</div>
 <div id="s4-rt" class="pin pin-r">25,000 V</div>
 <div id="s4-meter" class="meter" data-layout-allow-occlusion>
   <div class="meter-k">POTENTIAL DIFFERENCE</div>
   <div class="meter-v"><b id="s4-mv">25,000</b><span>V</span></div>
 </div>
 <div id="s4-cap" class="klines"><div class="kh">SAME WIRE.</div><div class="kh kh-amber">SAME VOLTAGE.</div></div>
</div>'''

S5 = '''
<div class="stage">
 <div id="s5-meter" class="meter meter-big" data-layout-allow-occlusion>
   <div class="meter-k">POTENTIAL DIFFERENCE</div>
   <div class="meter-v meter-zero"><b id="s5-mv">0</b><span>V</span></div>
 </div>
 <div class="stack">
   <div id="s5-a" class="slam">NO DIFFERENCE</div>
   <div id="s5-b" class="slam">NO PUSH</div>
   <div id="s5-c" class="slam slam-amber">NO CURRENT</div>
 </div>
</div>'''

S6 = '''
<div class="stage">
 <svg class="art" viewBox="0 0 1080 1920" preserveAspectRatio="xMidYMid slice">
  <rect class="copper" data-layout-allow-overflow x="-40" y="800" width="1160" height="40" rx="20"/>
  <path id="s6-flow" class="flow flow-bright" d="M-40,820 L1120,820"/>
  <path id="s6-arc" class="detour" d="M300,795 C340,250 740,250 780,795"/>
 </svg>
 <div id="s6-bird" class="birdwrap" style="left:440px;top:669px">''' + bird("s6-b", 2.0) + '''</div>
 <div id="s6-tag" class="detour-tag">a detour to nowhere</div>
 <div id="s6-k" class="klines"><div class="kh">THE CHARGE STAYS</div><div class="kh kh-cyan">IN THE COPPER</div></div>
</div>'''

S7 = '''
<div class="stage">
 <div id="s7-flash" class="flash"></div>
 <svg class="art" viewBox="0 0 1080 1920" preserveAspectRatio="xMidYMid slice">
  <rect class="copper" data-layout-allow-overflow x="-40" y="760" width="1160" height="38" rx="19"/>
  <rect class="copper" data-layout-allow-overflow x="-40" y="1130" width="1160" height="38" rx="19"/>
  <path id="s7-flowA" class="flow flow-bright" d="M-40,779 L1120,779"/>
  <path id="s7-flowB" class="flow flow-danger" d="M-40,1149 L1120,1149"/>
  <path id="s7-bolt" class="bolt" d="M545,800 L505,905 L575,905 L520,1128"/>
 </svg>
 <div id="s7-bird" class="birdwrap" style="left:440px;top:623px">''' + bird("s7-b", 1.6, wing="spread") + '''</div>
 <div id="s7-meter" class="meter meter-danger" data-layout-allow-occlusion>
   <div class="meter-k">POTENTIAL DIFFERENCE</div>
   <div class="meter-v"><b id="s7-mv">0</b><span>V</span></div>
 </div>
 <div id="s7-k" class="klines"><div class="kh kh-red">TWO WIRES.</div><div class="kh kh-red">ONE BIRD.</div></div>
</div>'''

S8 = '''
<div class="stage">
 <svg class="art" viewBox="0 0 1080 1920" preserveAspectRatio="xMidYMid slice">
  <rect class="copper" data-layout-allow-overflow x="-40" y="1000" width="1160" height="34" rx="17"/>
  <path class="flow" d="M-40,1017 L1120,1017" opacity="0.5"/>
 </svg>
 <div id="s8-small" class="birdwrap" style="left:180px;top:855px">''' + bird("s8-a", 1.1) + '''</div>
 <div id="s8-big" class="birdwrap" style="left:620px;top:883px">''' + bird("s8-b", 2.9, wing="spread") + '''</div>
 <div id="s8-okay" class="chip chip-ok">safe</div>
 <div id="s8-risk" class="chip chip-risk">at risk</div>
 <div id="s8-end" class="endcard">
   <div class="end-1">WINGSPAN</div>
   <div class="end-2">IS THE RISK.</div>
 </div>
</div>'''

BODIES = {"s1": S1, "s2": S2, "s3": S3, "s4": S4, "s5": S5, "s6": S6, "s7": S7, "s8": S8}

scene_html = "\n".join(
    f'<div id="{n}" class="clip scene" data-start="{st}" data-duration="{du}" data-track-index="{tr}">{BODIES[n]}</div>'
    for n, st, du, tr in SCENES)

caption_html = "".join(
    f'<div id="cap{i}" class="cap"><span>{txt}</span></div>' for i, (a, b, txt) in enumerate(CAPTIONS))

spark_html = "".join(
    f'<i style="--dx:{dx}px;--dy:{dy}px;--s:{s}"></i>' for dx, dy, s in sparks)

# ---------- timeline ----------------------------------------------------------
tl = []
A = tl.append
A('const tl = gsap.timeline({ paused: true });')
A('const E = "power3.out", EI = "power2.inOut", B = "back.out(1.7)";')

# scene cross-fades
for n, st, du, tr in SCENES:
    A(f'tl.fromTo("#{n}", {{opacity:0}}, {{opacity:1, duration:0.42, ease:EI}}, {st});')
    if n != "s8":
        A(f'tl.to("#{n}", {{opacity:0, duration:0.34, ease:EI}}, {round(st+du-0.34,2)});')
        A(f'tl.set("#{n}", {{opacity:0}}, {round(st+du,2)});')

# ---- S1
A('tl.fromTo("#s1-poles",{opacity:0,y:26},{opacity:1,y:0,duration:0.9,ease:E},0.05);')
A('tl.fromTo(["#s1-w1","#s1-w2","#s1-w3"],{opacity:0},{opacity:1,duration:0.7,stagger:0.08,ease:E},0.15);')
A('tl.fromTo("#s1-bird",{y:-260,opacity:0,rotation:-9},{y:0,opacity:1,rotation:0,duration:0.95,ease:"power2.out"},0.55);')
A('tl.to("#s1-bird",{y:-9,duration:0.22,ease:EI},1.5).to("#s1-bird",{y:0,duration:0.3,ease:"bounce.out"},1.72);')
A('tl.fromTo("#s1-w2",{attr:{d:"M-40,580 Q540,658 1120,580"}},{attr:{d:"M-40,580 Q540,676 1120,580"},duration:0.5,ease:EI},1.35);')
A('tl.fromTo("#s1-flow",{strokeDashoffset:900,opacity:0},{strokeDashoffset:0,opacity:0.85,duration:3.4,ease:"none"},1.3);')
A('tl.fromTo("#s1-badge",{opacity:0,y:22,scale:0.94},{opacity:1,y:0,scale:1,duration:0.5,ease:B},1.55);')
A('const c1={v:0}; tl.to(c1,{v:25000,duration:1.15,ease:"power2.out",onUpdate:()=>{document.getElementById("s1-count").textContent=Math.round(c1.v).toLocaleString("en-US");}},1.75);')
A('tl.fromTo("#s1-h1",{opacity:0,y:54},{opacity:1,y:0,duration:0.5,ease:E},3.95);')
A('tl.fromTo("#s1-h2",{opacity:0,y:54},{opacity:1,y:0,duration:0.5,ease:E},4.25);')
A('tl.fromTo("#s1 .stage",{scale:1},{scale:1.07,duration:5.3,ease:"none"},0.1);')

# ---- S2
A('tl.fromTo("#s2-wire",{opacity:0},{opacity:1,duration:0.4},5.45);')
A('tl.fromTo("#s2-flow",{strokeDashoffset:1400},{strokeDashoffset:0,duration:3.3,ease:"none"},5.5);')
A('tl.fromTo("#s2-bird",{opacity:0,scale:0.9},{opacity:1,scale:1,duration:0.5,ease:B},5.7);')
A('tl.fromTo("#s2-earth",{opacity:0,y:36},{opacity:1,y:0,duration:0.6,ease:E},6.15);')
A('tl.fromTo("#s2-arrow",{strokeDashoffset:900,opacity:0},{strokeDashoffset:0,opacity:1,duration:1.0,ease:"power2.inOut"},6.35);')
A('tl.fromTo("#s2-k1",{opacity:0,y:46},{opacity:1,y:0,duration:0.42,ease:E},6.75);')
A('tl.fromTo("#s2-k2",{opacity:0,y:46},{opacity:1,y:0,duration:0.42,ease:E},7.0);')

# ---- S3
A('tl.fromTo("#s3-card",{opacity:0,y:44,scale:0.96},{opacity:1,y:0,scale:1,duration:0.55,ease:B},8.95);')
A('tl.fromTo("#s3-dv",{color:"#F2F5FA",scale:1},{color:"#46E0FF",scale:1.16,duration:0.45,ease:B},9.75);')
A('tl.fromTo("#s3-l1",{opacity:0,y:20},{opacity:1,y:0,duration:0.4,ease:E},10.0);')
A('tl.fromTo("#s3-zero",{opacity:0,y:28},{opacity:1,y:0,duration:0.45,ease:E},10.5);')

# ---- S4
A('tl.fromTo("#s4-bar",{opacity:0,scaleY:0.4},{opacity:1,scaleY:1,duration:0.5,ease:E},11.6);')
A('tl.fromTo("#s4-cflow",{strokeDashoffset:1400},{strokeDashoffset:0,duration:3.4,ease:"none"},11.7);')
A('tl.fromTo("#s4-feet",{opacity:0,y:-18},{opacity:1,y:0,duration:0.5,ease:E},11.9);')
A('tl.fromTo("#s4-lt",{opacity:0,x:-40},{opacity:1,x:0,duration:0.45,ease:E},12.25);')
A('tl.fromTo("#s4-rt",{opacity:0,x:40},{opacity:1,x:0,duration:0.45,ease:E},12.45);')
A('tl.fromTo("#s4-meter",{opacity:0,y:-26,scale:0.94},{opacity:1,y:0,scale:1,duration:0.5,ease:B},12.95);')
A('tl.fromTo("#s4-cap",{opacity:0,y:34},{opacity:1,y:0,duration:0.45,ease:E},13.6);')

# ---- S5 : the punch
A('tl.fromTo("#s5-meter",{opacity:0,scale:0.9},{opacity:1,scale:1,duration:0.4,ease:B},15.1);')
A('const c5={v:25000}; tl.to(c5,{v:0,duration:0.75,ease:"power4.out",onUpdate:()=>{document.getElementById("s5-mv").textContent=Math.round(c5.v).toLocaleString("en-US");}},15.2);')
A('tl.fromTo("#s5-meter",{x:0},{x:0,duration:0.01},15.9);')
for i, (idn, at) in enumerate([("#s5-a", 16.05), ("#s5-b", 16.62), ("#s5-c", 17.12)]):
    A(f'tl.fromTo("{idn}",{{opacity:0,scale:1.5,y:26}},{{opacity:1,scale:1,y:0,duration:0.34,ease:B}},{at});')
    A(f'tl.fromTo("#s5 .stage",{{x:-7}},{{x:0,duration:0.26,ease:"elastic.out(1,0.35)"}},{at});')

# ---- S6
A('tl.fromTo("#s6-flow",{strokeDashoffset:1500},{strokeDashoffset:0,duration:3.7,ease:"none"},18.3);')
A('tl.fromTo("#s6-bird",{opacity:0,y:-24},{opacity:1,y:0,duration:0.5,ease:E},18.4);')
A('tl.fromTo("#s6-arc",{strokeDashoffset:1300,opacity:0},{strokeDashoffset:0,opacity:1,duration:0.9,ease:EI},18.9);')
A('tl.fromTo("#s6-tag",{opacity:0,y:18},{opacity:1,y:0,duration:0.4,ease:E},19.5);')
A('tl.fromTo("#s6-k",{opacity:0,y:38},{opacity:1,y:0,duration:0.45,ease:E},20.15);')

# ---- S7 : danger
A('tl.fromTo("#s7-flowA",{strokeDashoffset:1500},{strokeDashoffset:0,duration:4.6,ease:"none"},22.1);')
A('tl.fromTo("#s7-flowB",{strokeDashoffset:1500,opacity:0},{strokeDashoffset:0,opacity:1,duration:2.9,ease:"none"},23.9);')
A('tl.fromTo("#s7-bird",{opacity:0,y:-30,scale:0.94},{opacity:1,y:0,scale:1,duration:0.55,ease:E},22.2);')
A('tl.to("#s7-bird",{y:58,duration:1.25,ease:"power2.inOut"},23.1);')
A('tl.fromTo("#s7-bolt",{strokeDashoffset:640,opacity:0},{strokeDashoffset:0,opacity:1,duration:0.34,ease:"none"},24.32);')
A('tl.fromTo("#s7-flash",{opacity:0},{opacity:0.92,duration:0.09,ease:"none"},24.32);')
A('tl.to("#s7-flash",{opacity:0,duration:0.55,ease:"power2.out"},24.42);')
A('tl.fromTo("#s7 .stage",{x:14},{x:0,duration:0.5,ease:"elastic.out(1,0.3)"},24.34);')
A('tl.fromTo("#s7-meter",{opacity:0,scale:0.9},{opacity:1,scale:1,duration:0.3,ease:B},24.4);')
A('const c7={v:0}; tl.to(c7,{v:50000,duration:0.7,ease:"power3.out",onUpdate:()=>{document.getElementById("s7-mv").textContent=Math.round(c7.v).toLocaleString("en-US");}},24.5);')
A('tl.fromTo("#s7-k",{opacity:0,y:34},{opacity:1,y:0,duration:0.4,ease:E},25.3);')

# ---- S8
A('tl.fromTo("#s8-small",{opacity:0,y:22},{opacity:1,y:0,duration:0.45,ease:E},26.95);')
A('tl.fromTo("#s8-big",{opacity:0,y:22,scale:0.94},{opacity:1,y:0,scale:1,duration:0.5,ease:E},27.15);')
A('tl.fromTo("#s8-okay",{opacity:0,scale:0.8},{opacity:1,scale:1,duration:0.3,ease:B},27.5);')
A('tl.fromTo("#s8-risk",{opacity:0,scale:0.8},{opacity:1,scale:1,duration:0.3,ease:B},27.72);')
A('tl.fromTo("#s8-end .end-1",{opacity:0,y:44},{opacity:1,y:0,duration:0.45,ease:E},28.1);')
A('tl.fromTo("#s8-end .end-2",{opacity:0,y:44},{opacity:1,y:0,duration:0.45,ease:E},28.34);')

# ---- ambience: horizon hue shifts with the story
A('tl.fromTo("#glow",{opacity:0.55,backgroundColor:"#12325a"},{opacity:0.7,backgroundColor:"#173a63",duration:18,ease:"none"},0);')
A('tl.to("#glow",{backgroundColor:"#5e1c1c",opacity:0.8,duration:2.4,ease:EI},22.0);')
A('tl.to("#glow",{backgroundColor:"#1b3556",opacity:0.62,duration:2.2,ease:EI},26.6);')
A('tl.fromTo("#stars i",{opacity:0},{opacity:1,duration:1.2,stagger:{each:0.012,from:"random"},ease:E},0.1);')

# ---- captions
for i, (a, b, txt) in enumerate(CAPTIONS):
    A(f'tl.fromTo("#cap{i}",{{opacity:0,y:20}},{{opacity:1,y:0,duration:0.26,ease:E}},{round(a,2)});')
    A(f'tl.to("#cap{i}",{{opacity:0,y:-14,duration:0.22,ease:EI}},{round(b-0.02,2)});')
    A(f'tl.set("#cap{i}",{{opacity:0}},{round(b+0.20,2)});')

# ---- progress
A(f'tl.fromTo("#prog",{{scaleX:0}},{{scaleX:1,duration:{DUR},ease:"none"}},0);')

timeline_js = "\n      ".join(tl)

HTML = f'''<!doctype html>
<html lang="en" data-resolution="portrait">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width={W}, height={H}" />
    <title>Why Birds Don't Get Shocked</title>
    <script src="node_modules/gsap/dist/gsap.min.js"></script>
    <style>
      @font-face {{ font-family:"AntonL"; src:url("public/fonts/anton-400.woff2") format("woff2"); font-weight:400; font-display:block; }}
      @font-face {{ font-family:"InterL"; src:url("public/fonts/inter-400.woff2") format("woff2"); font-weight:400; font-display:block; }}
      @font-face {{ font-family:"InterL"; src:url("public/fonts/inter-600.woff2") format("woff2"); font-weight:600; font-display:block; }}
      @font-face {{ font-family:"InterL"; src:url("public/fonts/inter-800.woff2") format("woff2"); font-weight:800; font-display:block; }}

      * {{ margin:0; padding:0; box-sizing:border-box; }}
      html, body {{ width:{W}px; height:{H}px; overflow:hidden; background:#05070E; }}
      body {{ font-family:"InterL", system-ui, sans-serif; -webkit-font-smoothing:antialiased; }}

      #root {{ position:relative; width:{W}px; height:{H}px; overflow:hidden; }}

      /* ---------- persistent background ---------- */
      #bg {{ position:absolute; inset:0; background:
             radial-gradient(120% 70% at 50% 4%, #16233F 0%, #0A1122 42%, #05070E 78%); }}
      #glow {{ position:absolute; left:-10%; right:-10%; bottom:-16%; height:52%;
               background:#12325a; filter:blur(120px); border-radius:50%; opacity:0.6; }}
      #stars {{ position:absolute; inset:0; }}
      #stars i {{ position:absolute; display:block; background:#CFE2FF; border-radius:50%; }}
      #vig {{ position:absolute; inset:0; pointer-events:none;
              background:radial-gradient(115% 78% at 50% 44%, rgba(0,0,0,0) 52%, rgba(0,0,0,0.62) 100%); }}
      #grain {{ position:absolute; inset:0; opacity:0.055; mix-blend-mode:overlay;
                background-image:repeating-linear-gradient(0deg,#fff 0 1px,transparent 1px 3px),
                                 repeating-linear-gradient(90deg,#fff 0 1px,transparent 1px 3px); }}

      /* ---------- scenes ---------- */
      .scene {{ position:absolute; inset:0; }}
      .stage {{ position:absolute; inset:0; transform-origin:50% 46%; }}
      .art {{ position:absolute; inset:0; width:{W}px; height:{H}px; }}

      .silh rect.pl, .pl {{ fill:#243149; }}
      .wire {{ fill:none; stroke:#2E3C55; stroke-width:7; stroke-linecap:round; }}
      .wire-thick {{ stroke-width:16; stroke:#33425E; }}
      .flow {{ fill:none; stroke:#46E0FF; stroke-width:7; stroke-linecap:round;
               stroke-dasharray:26 46; filter:drop-shadow(0 0 14px rgba(70,224,255,0.75)); }}
      .flow-bright {{ stroke-width:11; stroke-dasharray:34 56; }}
      .flow-danger {{ stroke:#FF5A5A; filter:drop-shadow(0 0 16px rgba(255,90,90,0.8)); }}
      .copper {{ fill:#6B4A2A; stroke:#8A5F33; stroke-width:3; }}
      .earth {{ stroke:#8A96AC; stroke-width:11; stroke-linecap:round; }}
      .drop {{ stroke:#8A96AC; stroke-width:11; stroke-linecap:round; }}
      .want {{ fill:none; stroke:#46E0FF; stroke-width:9; stroke-linecap:round;
               stroke-dasharray:22 26; opacity:0.95; }}
      .detour {{ fill:none; stroke:#F5B942; stroke-width:7; stroke-dasharray:16 20;
                 stroke-linecap:round; opacity:0.9; }}
      .feet path {{ fill:none; stroke:#F5B942; stroke-width:15; stroke-linecap:round; }}
      .bolt {{ fill:none; stroke:#FFFFFF; stroke-width:12; stroke-linejoin:round; stroke-linecap:round;
               stroke-dasharray:640; filter:drop-shadow(0 0 26px rgba(255,255,255,0.95)); }}
      .flash {{ position:absolute; inset:0; background:
                radial-gradient(60% 34% at 50% 50%, #fff 0%, rgba(255,120,120,0.55) 40%, rgba(0,0,0,0) 72%);
                opacity:0; }}

      /* ---------- bird ---------- */
      .birdwrap {{ position:absolute; width:200px; height:170px; transform-origin:50% 96%; }}
      .bird {{ width:200px; height:170px; overflow:visible; display:block; transform-origin:50% 96%; }}
      .bird .bd {{ fill:#0E1626; stroke:#4A6183; stroke-width:2.5; }}
      .bird .wg {{ fill:#1A2740; }}
      .bird .bk {{ fill:#F5B942; }}
      .bird .ey {{ fill:#F2F5FA; }}
      .bird .lg {{ stroke:#F5B942; stroke-width:7; stroke-linecap:round; fill:none; }}

      /* ---------- type ---------- */
      .kh {{ font-family:"AntonL", sans-serif; font-size:118px; line-height:0.98; white-space:nowrap;
             letter-spacing:0.01em; color:#F2F5FA; text-transform:uppercase; }}
      .kh-amber {{ color:#F5B942; }} .kh-cyan {{ color:#46E0FF; }} .kh-red {{ color:#FF6161; }}
      #s1-h1 {{ position:absolute; left:78px; top:1150px; }}
      #s1-h2 {{ position:absolute; left:78px; top:1272px; }}
      .klines {{ position:absolute; left:78px; top:1160px; }}
      #s4-cap {{ top:1180px; }} #s6-k {{ top:1150px; }} #s7-k {{ top:220px; }}
      .note {{ position:absolute; left:82px; top:1420px; font-size:40px; color:#8A96AC;
               font-weight:600; letter-spacing:0.04em; }}

      .badge {{ position:absolute; left:78px; top:760px; padding:22px 32px; border-radius:20px;
                background:rgba(9,16,30,0.82); border:2px solid rgba(70,224,255,0.35);
                backdrop-filter:blur(6px); }}
      .badge-k {{ display:block; font-size:26px; letter-spacing:0.26em; color:#46E0FF; font-weight:800; }}
      .badge-v {{ display:block; margin-top:8px; font-size:76px; font-weight:800; color:#F2F5FA; }}
      .badge-v b {{ font-family:"AntonL", sans-serif; font-weight:400; }}

      .card {{ position:absolute; left:78px; right:78px; top:590px; padding:56px 48px 52px;
               border-radius:34px; background:rgba(10,18,34,0.9);
               border:2px solid rgba(138,150,172,0.22); text-align:center; }}
      .card-top {{ font-size:28px; letter-spacing:0.3em; color:#8A96AC; font-weight:800; }}
      .eq {{ margin-top:38px; display:flex; align-items:center; justify-content:center; gap:26px;
             font-family:"AntonL", sans-serif; color:#F2F5FA; }}
      .eq-i {{ font-size:152px; }} .eq-op {{ font-size:96px; color:#8A96AC; }}
      .eq-frac {{ display:inline-block; text-align:center; }}
      .eq-frac b {{ display:block; font-size:120px; font-weight:400; }}
      .eq-frac i {{ display:block; height:6px; background:#8A96AC; margin:12px 0; border-radius:3px; }}
      .eq-frac span {{ display:block; font-size:120px; }}
      .eq-legend {{ margin-top:34px; font-size:40px; color:#B9C4D6; font-weight:600; }}
      .eq-legend em {{ color:#46E0FF; font-style:normal; font-weight:800; }}
      .zerotag {{ position:absolute; left:78px; right:78px; top:1120px; text-align:center;
                  font-family:"AntonL", sans-serif; font-size:74px; color:#46E0FF; }}

      .pin {{ position:absolute; top:520px; padding:16px 26px; border-radius:16px;
              background:rgba(9,16,30,0.88); border:2px solid rgba(245,185,66,0.4);
              font-size:42px; font-weight:800; color:#F5B942; }}
      .pin-l {{ left:290px; }} .pin-r {{ right:290px; }}

      .meter {{ position:absolute; left:50%; transform:translateX(-50%); top:900px;
                min-width:620px; padding:30px 44px; border-radius:26px; text-align:center;
                background:rgba(9,16,30,0.92); border:2px solid rgba(70,224,255,0.35); }}
      .meter-k {{ font-size:24px; letter-spacing:0.24em; color:#8A96AC; font-weight:800; }}
      .meter-v {{ margin-top:10px; font-size:96px; color:#F2F5FA; font-weight:800;
                  display:flex; align-items:baseline; justify-content:center; gap:14px; }}
      .meter-v b {{ font-family:"AntonL", sans-serif; font-weight:400; }}
      .meter-v span {{ font-size:46px; color:#8A96AC; }}
      .meter-big {{ top:700px; }}
      .meter-danger {{ top:1200px; }}
      .meter-zero b {{ color:#46E0FF; }}
      .meter-danger {{ border-color:rgba(255,90,90,0.5); }}
      .meter-danger .meter-v b {{ color:#FF6161; }}

      .stack {{ position:absolute; left:78px; right:78px; top:1000px; }}
      .slam {{ font-family:"AntonL", sans-serif; font-size:112px; line-height:1.04; white-space:nowrap;
               color:#F2F5FA; text-transform:uppercase; transform-origin:0% 50%; }}
      .slam-amber {{ color:#F5B942; }}

      .detour-tag {{ position:absolute; left:50%; transform:translateX(-50%); top:240px;
                     padding:14px 26px; border-radius:14px; font-size:38px; font-weight:700;
                     color:#F5B942; background:rgba(9,16,30,0.85);
                     border:2px dashed rgba(245,185,66,0.55); }}

      .chip {{ position:absolute; padding:12px 24px; border-radius:999px; font-size:34px;
               font-weight:800; letter-spacing:0.06em; }}
      .chip-ok {{ left:190px; top:735px; color:#5BE39A; background:rgba(12,40,28,0.9);
                  border:2px solid rgba(91,227,154,0.45); }}
      .chip-risk {{ left:600px; top:440px; color:#FF6161; background:rgba(46,12,12,0.9);
                    border:2px solid rgba(255,97,97,0.5); }}
      .endcard {{ position:absolute; left:78px; right:78px; top:1150px; text-align:center; }}
      .end-1 {{ font-family:"AntonL", sans-serif; font-size:124px; color:#F2F5FA; }}
      .end-2 {{ font-family:"AntonL", sans-serif; font-size:124px; color:#F5B942; }}

      /* ---------- captions + hud ---------- */
      #caps {{ position:absolute; left:64px; right:64px; bottom:180px; height:250px; }}
      .cap {{ position:absolute; left:0; right:0; bottom:0; text-align:center; opacity:0; }}
      .cap span {{ display:inline-block; padding:18px 30px; border-radius:20px;
                   background:rgba(5,8,16,0.78); font-size:48px; line-height:1.25;
                   font-weight:700; color:#F2F5FA; letter-spacing:0.005em;
                   box-shadow:0 10px 40px rgba(0,0,0,0.45); }}
      #hud {{ position:absolute; left:0; right:0; top:0; height:8px; }}
      #prog {{ position:absolute; inset:0; transform-origin:0% 50%; transform:scaleX(0);
               background:linear-gradient(90deg,#46E0FF,#F5B942); opacity:0.85; }}
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-width="{W}" data-height="{H}"
         data-duration="{DUR}" data-fps="{FPS}">

      <div id="bgclip" class="clip" data-start="0" data-duration="{DUR}" data-track-index="1">
        <div id="bg"></div>
        <div id="glow" data-layout-ignore></div>
        <div id="stars">{star_html}</div>
        <div id="grain"></div>
      </div>

{scene_html}

      <div id="fx" class="clip" data-start="0" data-duration="{DUR}" data-track-index="6">
        <div id="vig" data-layout-ignore></div>
      </div>

      <div id="caps" class="clip" data-start="0" data-duration="{DUR}" data-track-index="4">{caption_html}</div>

      <div id="hud" class="clip" data-start="0" data-duration="{DUR}" data-track-index="5"><div id="prog"></div></div>
    </div>

    <script>
      window.__timelines = window.__timelines || {{}};
      {timeline_js}
      window.__timelines["main"] = tl;
    </script>
  </body>
</html>
'''
open('index.html', 'w').write(HTML)
print("index.html yazıldı:", len(HTML), "byte")
