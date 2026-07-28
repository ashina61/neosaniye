import React from 'react';
import {
  AbsoluteFill,
  Audio,
  interpolate,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
} from 'remotion';
import {SCENES, TOTAL_FRAMES} from './generated/timing';

const C = {
  bg: '#11151d',
  blue: '#1d3b50',
  paper: '#eee6d3',
  venus: '#e5a14d',
  rust: '#824737',
  cyan: '#70d3d7',
  red: '#c75c54',
};
const clamp = {extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const};
const marks = [SCENES.hook, SCENES.explain, SCENES.rotation, SCENES.orbit, SCENES.compare, SCENES.reverse, SCENES.solar, TOTAL_FRAMES];
const step12 = (f: number) => Math.floor((f * 12) / 30) * 2.5;
const wobble = (f: number, seed = 0) => ({
  x: Math.sin(step12(f) * 0.19 + seed) * 1.5,
  y: Math.cos(step12(f) * 0.16 + seed) * 1.2,
  r: Math.sin(step12(f) * 0.11 + seed) * 0.18,
});

const Field: React.FC<{frame: number}> = ({frame}) => {
  const d = step12(frame) * 0.18;
  return (
    <AbsoluteFill style={{background: `radial-gradient(circle at 50% 35%, ${C.blue}, ${C.bg} 68%)`, overflow: 'hidden'}}>
      <AbsoluteFill style={{opacity: 0.17, backgroundImage: 'linear-gradient(rgba(238,230,211,.16) 1px,transparent 1px),linear-gradient(90deg,rgba(238,230,211,.16) 1px,transparent 1px)', backgroundSize: '96px 96px', transform: `translate(${-(d % 96)}px,${-((d * .7) % 96)}px)`}} />
      {Array.from({length: 14}).map((_, i) => <div key={i} style={{position: 'absolute', left: 60 + (i * 157) % 950, top: 90 + (i * 251) % 1720, width: i % 3 ? 18 : 50, height: 2, background: C.paper, opacity: .14, transform: `rotate(${i * 29}deg)`}} />)}
    </AbsoluteFill>
  );
};

const Texture: React.FC<{frame: number}> = ({frame}) => {
  const s = step12(frame);
  return (
    <AbsoluteFill style={{pointerEvents: 'none', transform: `translate(${Math.sin(s) * 1.3}px,${Math.cos(s * .8) * 1.1}px)`}}>
      <AbsoluteFill style={{opacity: .05, backgroundImage: 'repeating-linear-gradient(0deg,rgba(255,255,255,.15) 0 1px,transparent 1px 5px)'}} />
      <AbsoluteFill style={{opacity: .065, background: 'radial-gradient(circle at 15% 20%,#fff 0 1px,transparent 2px),radial-gradient(circle at 80% 65%,#fff 0 1px,transparent 2px)', backgroundSize: '43px 47px,59px 53px', transform: `translateY(${-(frame % 53)}px)`}} />
      <AbsoluteFill style={{boxShadow: 'inset 0 0 210px rgba(0,0,0,.56)'}} />
    </AbsoluteFill>
  );
};

const Header: React.FC<{label: string; index: number}> = ({label, index}) => (
  <>
    <div style={{position: 'absolute', left: 52, top: 52, width: 70, height: 70, borderLeft: `3px solid ${C.paper}`, borderTop: `3px solid ${C.paper}`, opacity: .75}} />
    <div style={{position: 'absolute', right: 52, top: 52, width: 70, height: 70, borderRight: `3px solid ${C.paper}`, borderTop: `3px solid ${C.paper}`, opacity: .75}} />
    <div style={{position: 'absolute', left: 54, top: 145, color: C.paper, fontFamily: 'Arial,sans-serif', fontWeight: 900, fontSize: 21, letterSpacing: 5}}>NEOSANIYE / {String(index + 1).padStart(2, '0')}</div>
    <div style={{position: 'absolute', right: 54, top: 145, color: C.cyan, fontFamily: 'Arial,sans-serif', fontWeight: 800, fontSize: 19, letterSpacing: 4}}>{label}</div>
  </>
);

const Planet: React.FC<{frame: number; size: number; left: number; top: number; mono?: boolean}> = ({frame, size, left, top, mono = false}) => {
  const b = wobble(frame, 4);
  const f = step12(frame);
  return (
    <div style={{position: 'absolute', left: left + b.x, top: top + b.y, width: size, height: size, borderRadius: '50%', overflow: 'hidden', transform: `rotate(${f * -.07 + b.r}deg)`, background: mono ? 'radial-gradient(circle at 30% 25%,#f0eee7,#9b9a95 58%,#41434a)' : `radial-gradient(circle at 30% 25%,#fff4bd 0 7%,${C.venus} 34%,${C.rust} 100%)`, border: `5px solid rgba(238,230,211,.68)`, boxShadow: mono ? 'none' : '0 0 58px rgba(229,161,77,.4),inset -38px -28px 68px rgba(30,10,15,.5)'}}>
      <div style={{position: 'absolute', inset: -70, transform: `translateX(${(f * 1.5) % size - size}px) rotate(-14deg)`, background: 'repeating-linear-gradient(12deg,transparent 0 34px,rgba(255,247,205,.22) 38px 58px,transparent 63px 96px)', filter: 'blur(7px)', opacity: mono ? .16 : 1}} />
    </div>
  );
};

const Sun: React.FC<{size: number; left: number; top: number}> = ({size, left, top}) => <div style={{position: 'absolute', left, top, width: size, height: size, borderRadius: '50%', background: 'radial-gradient(circle,#fff7c7 0 18%,#f2c85d 42%,#d77b3d 76%,#8b3f38)', boxShadow: '0 0 58px rgba(242,200,93,.72)'}} />;

const Path: React.FC<{d: string; p: number; color?: string; width?: number; viewBox?: string; style?: React.CSSProperties}> = ({d, p, color = C.paper, width = 7, viewBox = '0 0 1000 1000', style}) => {
  const len = 1800;
  return <svg viewBox={viewBox} style={{position: 'absolute', inset: 0, width: '100%', height: '100%', ...style}}><path d={d} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={len} strokeDashoffset={len * (1 - p)} /></svg>;
};

const Portal: React.FC<{local: number; duration: number; frame: number}> = ({local, duration, frame}) => {
  const slow = interpolate(local, [0, duration * .42], [1, 1.14], clamp);
  const fast = interpolate(local, [duration * .42, duration * .72], [1.14, 6.6], clamp);
  const wall = local < duration * .42 ? slow : fast;
  const detach = interpolate(local, [duration * .56, duration * .76], [0, 1], clamp);
  const content = local < duration * .56 ? wall * .37 : interpolate(detach, [0, 1], [.78, 1], clamp);
  const blur = interpolate(local, [duration * .48, duration * .59, duration * .74], [0, 10, 0], clamp);
  const enter = spring({frame: Math.max(0, local - duration * .7), fps: 30, config: {damping: 14, stiffness: 115}});
  return (
    <AbsoluteFill style={{overflow: 'hidden'}}>
      <div style={{position: 'absolute', inset: 0, transform: `scale(${wall})`, transformOrigin: '50% 42%', filter: `blur(${blur}px)`, opacity: 1 - detach}}>
        <div style={{position: 'absolute', left: 80, right: 80, top: 270, bottom: 350, background: '#d9d1be', border: '3px solid #8d826f'}} />
        <div style={{position: 'absolute', left: 235, top: 410, width: 610, height: 610, border: '28px solid #5f594f', boxShadow: '0 24px 40px rgba(0,0,0,.32)'}} />
        <div style={{position: 'absolute', top: 1090, left: 355, width: 370, height: 90, background: '#c7bda8', display: 'grid', placeItems: 'center', fontFamily: 'Georgia,serif', color: '#35312c', fontSize: 29, letterSpacing: 3}}>VENUS / TIME STUDY</div>
      </div>
      <div style={{position: 'absolute', left: '50%', top: '42%', width: 610, height: 610, marginLeft: -305, marginTop: -305, transform: `scale(${wall * (1 + detach * .5)})`, border: '28px solid #5f594f', opacity: 1 - detach * .94, zIndex: 4}} />
      <div style={{position: 'absolute', left: '50%', top: '42%', width: 1080, height: 1080, marginLeft: -540, marginTop: -540, transform: `scale(${content})`, filter: `grayscale(${1 - detach})`, zIndex: 2}}>
        <div style={{position: 'absolute', inset: 0, background: `radial-gradient(circle,${C.blue},${C.bg} 72%)`}} />
        <Planet frame={frame} size={600} left={240} top={210} mono={detach < .5} />
        <Path d="M170 630 C310 235 750 210 900 610 C760 920 340 920 170 630" p={interpolate(local, [0, duration * .56], [0, 1], clamp)} color={C.cyan} />
      </div>
      <div style={{position: 'absolute', left: 70, right: 70, top: 1190, color: C.paper, textAlign: 'center', fontFamily: 'Arial Black,Arial', opacity: enter, transform: `translateY(${(1 - enter) * 55}px)`}}>
        <div style={{fontSize: 110, lineHeight: .88}}>A DAY</div>
        <div style={{fontSize: 58, color: C.cyan, margin: '24px 0'}}>OUTLASTS</div>
        <div style={{fontSize: 110, lineHeight: .88}}>A YEAR</div>
      </div>
    </AbsoluteFill>
  );
};

const TwoClocks: React.FC<{local: number; duration: number; frame: number}> = ({local, duration, frame}) => {
  const e = spring({frame: local, fps: 30, config: {damping: 13, stiffness: 105}});
  const p = interpolate(local, [8, duration * .58], [0, 1], clamp);
  const b = wobble(frame, 8);
  return (
    <AbsoluteFill>
      <Header label="TWO CLOCKS" index={1} />
      {[0, 1].map((side) => <div key={side} style={{position: 'absolute', left: side ? 580 : 80, top: 300, width: 420, height: 930, border: `3px solid rgba(238,230,211,.65)`, background: side ? 'rgba(112,211,215,.035)' : 'rgba(229,161,77,.04)', transform: `translateX(${(1 - e) * (side ? 260 : -260)}px) rotate(${side ? -b.r : b.r}deg)`}}>
        {side ? <><Sun size={150} left={135} top={180} /><Path d="M60 260 C85 45 335 45 360 260 C335 475 85 475 60 260" p={p} color={C.cyan} viewBox="0 0 420 520" style={{top: 90, height: 520}} /><Planet frame={frame} size={86} left={320} top={302} /></> : <><Planet frame={frame} size={310} left={55} top={90} /><Path d="M210 470 C120 610 120 760 210 880 C300 760 300 610 210 470" p={p} color={C.venus} viewBox="0 0 420 930" /></>}
        <div style={{position: 'absolute', left: 40, right: 40, bottom: 90, color: C.paper, fontFamily: 'Arial Black,Arial', fontSize: 42}}>{side ? 'ORBIT' : 'ROTATION'}<div style={{fontFamily: 'Arial,sans-serif', fontSize: 21, color: side ? C.cyan : C.venus, letterSpacing: 5, marginTop: 18}}>{side ? 'AROUND THE SUN' : 'AROUND ITS AXIS'}</div></div>
      </div>)}
      <div style={{position: 'absolute', left: 500, top: 730, width: 80, height: 80, borderRadius: '50%', border: `3px solid ${C.paper}`, display: 'grid', placeItems: 'center', color: C.paper, fontFamily: 'Arial Black,Arial', fontSize: 30, transform: `scale(${e})`}}>≠</div>
    </AbsoluteFill>
  );
};

const Rotation: React.FC<{local: number; duration: number; frame: number}> = ({local, duration, frame}) => {
  const p = interpolate(local, [5, duration * .72], [0, 1], clamp);
  const n = Math.round(interpolate(local, [0, Math.min(58, duration * .6)], [0, 243], clamp));
  return <AbsoluteFill><Header label="AXIS ROTATION" index={2} /><div style={{position: 'absolute', left: 115, top: 280, width: 850, height: 850}}><Planet frame={frame} size={650} left={100} top={85} /><Path d="M500 70 C790 150 865 570 620 770" p={p} width={9} /><div style={{position: 'absolute', left: 492, top: 45, width: 4, height: 770, background: C.cyan, transform: 'rotate(-14deg)', opacity: .75}} /></div><div style={{position: 'absolute', left: 80, right: 80, top: 1160, borderTop: `2px solid rgba(238,230,211,.65)`, paddingTop: 65, color: C.paper}}><div style={{fontFamily: 'Arial Black,Arial', fontSize: 190, lineHeight: .9, letterSpacing: -10}}>{String(n).padStart(3, '0')}</div><div style={{fontFamily: 'Arial,sans-serif', fontWeight: 850, fontSize: 28, color: C.venus, letterSpacing: 8, marginTop: 22}}>EARTH DAYS / ONE TURN</div></div></AbsoluteFill>;
};

const Orbit: React.FC<{local: number; duration: number; frame: number}> = ({local, duration, frame}) => {
  const p = interpolate(local, [0, duration - 8], [0, 1], clamp);
  const a = p * Math.PI * 2;
  const x = 540 + Math.cos(a) * 345;
  const y = 660 + Math.sin(a) * 245;
  const n = Math.round(interpolate(local, [0, Math.min(58, duration * .6)], [0, 225], clamp));
  return <AbsoluteFill><Header label="ORBITAL YEAR" index={3} /><Path d="M190 660 C210 325 870 325 890 660 C870 995 210 995 190 660" p={Math.min(1, p * 1.35)} color={C.cyan} /><Sun size={240} left={420} top={540} /><Planet frame={frame} size={120} left={x - 60} top={y - 60} /><div style={{position: 'absolute', left: 80, right: 80, top: 1180, borderTop: `2px solid rgba(238,230,211,.65)`, paddingTop: 65, color: C.paper}}><div style={{fontFamily: 'Arial Black,Arial', fontSize: 190, lineHeight: .9, letterSpacing: -10}}>{String(n).padStart(3, '0')}</div><div style={{fontFamily: 'Arial,sans-serif', fontWeight: 850, fontSize: 28, color: C.cyan, letterSpacing: 8, marginTop: 22}}>EARTH DAYS / ONE ORBIT</div></div></AbsoluteFill>;
};

const Compare: React.FC<{local: number}> = ({local}) => {
  const e = spring({frame: local, fps: 30, config: {damping: 12, stiffness: 130}});
  return <AbsoluteFill><Header label="THE CONTRADICTION" index={4} /><div style={{position: 'absolute', left: 75, top: 330, width: 930, height: 880, border: `3px solid rgba(238,230,211,.68)`, overflow: 'hidden'}}><div style={{position: 'absolute', inset: 0, background: 'linear-gradient(104deg,rgba(229,161,77,.18) 0 49%,rgba(112,211,215,.11) 51% 100%)'}} /><div style={{position: 'absolute', left: 465, top: -80, width: 5, height: 1080, background: C.paper, transform: 'rotate(8deg)'}} />{[{v: '243', l: 'ROTATION', c: C.venus, x: 55}, {v: '225', l: 'YEAR', c: C.cyan, x: 545}].map((o, i) => <div key={o.v} style={{position: 'absolute', left: o.x, top: 105, width: 330, color: C.paper, transform: `translateX(${(1 - e) * (i ? 230 : -230)}px)`, textAlign: i ? 'right' : 'left'}}><div style={{fontFamily: 'Arial Black,Arial', fontSize: 165, lineHeight: .9}}>{o.v}</div><div style={{fontFamily: 'Arial,sans-serif', fontWeight: 850, color: o.c, fontSize: 28, letterSpacing: 7, marginTop: 22}}>{o.l}</div><div style={{width: 300, height: i ? 190 : 300, borderRadius: '50%', border: `5px solid ${o.c}`, marginTop: 110, marginLeft: i ? 30 : 0}} /></div>)}<div style={{position: 'absolute', left: 410, top: 350, width: 130, height: 130, borderRadius: '50%', background: C.paper, color: C.bg, display: 'grid', placeItems: 'center', fontFamily: 'Arial Black,Arial', fontSize: 76, transform: `scale(${e})`}}>&gt;</div></div><div style={{position: 'absolute', left: 90, right: 90, top: 1325, color: C.paper, fontFamily: 'Arial Black,Arial', fontSize: 66, lineHeight: 1.02}}>THE YEAR ENDS<br /><span style={{color: C.cyan}}>BEFORE THE TURN</span></div></AbsoluteFill>;
};

const Reverse: React.FC<{local: number; duration: number; frame: number}> = ({local, duration, frame}) => {
  const p = interpolate(local, [5, duration - 10], [0, 1], clamp);
  const x = interpolate(p, [0, 1], [820, 105], clamp);
  const y = 780 - Math.sin(p * Math.PI) * 420;
  return <AbsoluteFill><Header label="RETROGRADE" index={5} /><div style={{position: 'absolute', left: -230, top: 780, width: 1540, height: 920, borderRadius: '50%', background: `linear-gradient(180deg,${C.rust},#402438 55%,#161620)`, border: `4px solid rgba(238,230,211,.6)`}} /><Path d="M830 780 C760 190 290 190 100 780" p={interpolate(local, [10, duration * .72], [0, 1], clamp)} width={9} /><Sun size={180} left={x} top={y} /><div style={{position: 'absolute', left: 75, top: 305, color: C.cyan, fontFamily: 'Arial Black,Arial', fontSize: 48}}>WEST</div><div style={{position: 'absolute', right: 75, top: 305, color: C.venus, fontFamily: 'Arial Black,Arial', fontSize: 48}}>EAST</div><div style={{position: 'absolute', left: 80, right: 80, top: 1220, color: C.paper, fontFamily: 'Arial Black,Arial', fontSize: 72, lineHeight: .98}}>THE SUN APPEARS<br />TO MOVE <span style={{color: C.cyan}}>BACKWARD</span></div><div style={{position: 'absolute', right: 85, bottom: 170, width: 180, height: 180, borderRadius: '50%', border: `3px solid rgba(238,230,211,.7)`, transform: `rotate(${step12(frame) * -.7}deg)`}}><div style={{position: 'absolute', left: 86, top: 12, width: 8, height: 72, background: C.red}} /></div></AbsoluteFill>;
};

const Solar: React.FC<{local: number; duration: number; frame: number}> = ({local, duration, frame}) => {
  const p = interpolate(local, [0, duration - 12], [0, 1], clamp);
  const n = Math.round(interpolate(local, [0, Math.min(55, duration * .55)], [0, 117], clamp));
  const e = spring({frame: local, fps: 30, config: {damping: 14, stiffness: 100}});
  return <AbsoluteFill><Header label="SUNRISE TO SUNRISE" index={6} /><div style={{position: 'absolute', left: 115, top: 260, width: 850, height: 850, transform: `scale(${.88 + e * .12})`}}><svg viewBox="0 0 850 850" style={{position: 'absolute', inset: 0}}><circle cx="425" cy="425" r="335" fill="none" stroke={C.cyan} strokeWidth="10" strokeLinecap="round" strokeDasharray={2105} strokeDashoffset={2105 * (1 - p)} transform="rotate(-90 425 425)" /></svg><Planet frame={frame} size={430} left={210} top={210} /><div style={{position: 'absolute', left: 160, right: 160, top: 315, color: C.paper, textAlign: 'center'}}><div style={{fontFamily: 'Arial Black,Arial', fontSize: 178, lineHeight: .88, letterSpacing: -8}}>{String(n).padStart(3, '0')}</div><div style={{fontFamily: 'Arial,sans-serif', fontWeight: 850, fontSize: 25, color: C.cyan, letterSpacing: 7, marginTop: 24}}>EARTH DAYS</div></div></div><div style={{position: 'absolute', left: 100, right: 100, top: 1210, color: C.paper, fontFamily: 'Arial Black,Arial', fontSize: 62, lineHeight: 1.02}}>ONE SUNRISE<br /><span style={{color: C.venus}}>TO THE NEXT</span></div><div style={{position: 'absolute', left: 100, bottom: 145, color: C.paper, opacity: .58, fontFamily: 'Arial,sans-serif', fontSize: 19, letterSpacing: 4}}>NASA SCIENCE / VENUS FACTS</div></AbsoluteFill>;
};

const Transition: React.FC<{frame: number}> = ({frame}) => <AbsoluteFill style={{pointerEvents: 'none'}}>{marks.slice(1, -1).map((cut, i) => {
  const l = frame - cut;
  if (l < -8 || l > 10) return null;
  const p = interpolate(l, [-8, 0, 10], [0, 1, 0], clamp);
  if (i % 3 === 0) return <div key={cut} style={{position: 'absolute', left: interpolate(l, [-8, 10], [-350, 1430], clamp), top: -220, width: 380, height: 2360, borderRadius: '50%', background: C.venus, transform: 'rotate(12deg)', filter: 'blur(4px)', opacity: p}} />;
  if (i % 3 === 1) return <div key={cut} style={{position: 'absolute', left: 440, top: 860, width: 200, height: 200, borderRadius: '50%', border: `24px solid ${C.paper}`, transform: `scale(${interpolate(l, [-8, 1, 10], [.2, 7, 10], clamp)})`, opacity: p}} />;
  return <div key={cut} style={{position: 'absolute', left: -120, right: -120, top: interpolate(l, [-8, 10], [-500, 2100], clamp), height: 560, background: C.blue, transform: 'rotate(-8deg)', opacity: p}} />;
})}</AbsoluteFill>;

const Timeline: React.FC = () => {
  const frame = useCurrentFrame();
  let index = 0;
  while (index < marks.length - 2 && frame >= marks[index + 1]) index += 1;
  const start = marks[index];
  const end = marks[index + 1];
  const local = frame - start;
  const duration = Math.max(1, end - start);
  const opacity = Math.min(start === 0 ? 1 : interpolate(local, [0, 5], [0, 1], clamp), end === TOTAL_FRAMES ? 1 : interpolate(local, [duration - 4, duration], [1, 0], clamp));
  const scene = index === 0 ? <Portal local={local} duration={duration} frame={frame} /> : index === 1 ? <TwoClocks local={local} duration={duration} frame={frame} /> : index === 2 ? <Rotation local={local} duration={duration} frame={frame} /> : index === 3 ? <Orbit local={local} duration={duration} frame={frame} /> : index === 4 ? <Compare local={local} /> : index === 5 ? <Reverse local={local} duration={duration} frame={frame} /> : <Solar local={local} duration={duration} frame={frame} />;
  return <AbsoluteFill style={{opacity, transform: `scale(${interpolate(local, [0, duration], [1.025, 1], clamp)})`}}>{scene}</AbsoluteFill>;
};

export const VenusShort: React.FC = () => {
  const frame = useCurrentFrame();
  return <AbsoluteFill style={{background: C.bg, overflow: 'hidden'}}><Field frame={frame} /><Timeline /><Transition frame={frame} /><Texture frame={frame} /><Audio src={staticFile('audio/music.wav')} volume={.2} /><Audio src={staticFile('audio/voice.mp3')} volume={1} /><Sequence from={0}><Audio src={staticFile('audio/impact.wav')} volume={.72} /></Sequence><Sequence from={SCENES.explain}><Audio src={staticFile('audio/whoosh-a.wav')} volume={.52} /></Sequence><Sequence from={SCENES.rotation}><Audio src={staticFile('audio/snap.wav')} volume={.5} /></Sequence><Sequence from={SCENES.orbit}><Audio src={staticFile('audio/whoosh-b.wav')} volume={.48} /></Sequence><Sequence from={SCENES.compare}><Audio src={staticFile('audio/sub-hit.wav')} volume={.64} /></Sequence><Sequence from={SCENES.reverse}><Audio src={staticFile('audio/reverse.wav')} volume={.58} /></Sequence><Sequence from={SCENES.solar}><Audio src={staticFile('audio/chime.wav')} volume={.45} /></Sequence></AbsoluteFill>;
};
