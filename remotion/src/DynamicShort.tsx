import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Easing,
  interpolate,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import type {ProductionScene, ProductionSpec, ProceduralVisual, SfxCue, VisualMotif} from './schema';

const palette = {
  ink: '#171511', paper: '#efe6d3', paperLight: '#fff7e9', paperDark: '#d6c19d',
  gold: '#d7a72d', goldDark: '#93690f', teal: '#93c7c3', red: '#c14e43',
  navy: '#162432', white: '#fffdf8', grey: '#b9b0a2', green: '#6f8f75',
};

const clamp = {extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const};
const sceneSfx = (scene: ProductionScene): SfxCue[] => (scene.sfx || []).map((cue) => ({...cue, atFrame: scene.fromFrame + cue.atFrame}));

export const DynamicShort: React.FC<ProductionSpec> = (spec) => {
  const cues = [...(spec.globalSfx || []), ...spec.scenes.flatMap(sceneSfx)];
  return (
    <AbsoluteFill style={{backgroundColor: palette.paper}}>
      {spec.audio?.voicePath ? <Audio src={staticFile(spec.audio.voicePath)} volume={spec.audio.voiceVolume ?? 1} /> : null}
      {spec.audio?.musicPath ? (
        <Audio
          src={staticFile(spec.audio.musicPath)}
          volume={(frame) => {
            const intro = interpolate(frame, [0, 30], [0.07, spec.audio?.musicVolume ?? 0.18], clamp);
            const end = interpolate(frame, [spec.meta.durationInFrames - 90, spec.meta.durationInFrames], [spec.audio?.musicVolume ?? 0.18, 0.23], clamp);
            return Math.min(intro, end);
          }}
        />
      ) : null}
      {cues.map((cue, index) => (
        <Sequence key={`${cue.path}-${cue.atFrame}-${index}`} from={Math.max(0, cue.atFrame)} durationInFrames={cue.durationInFrames ?? 90}>
          <Audio src={staticFile(cue.path)} volume={cue.volume ?? 0.68} />
        </Sequence>
      ))}
      {spec.scenes.map((scene, index) => (
        <React.Fragment key={scene.id}>
          <Sequence from={scene.fromFrame} durationInFrames={scene.durationInFrames}>
            <Scene scene={scene} index={index} total={spec.scenes.length} />
          </Sequence>
          {index < spec.scenes.length - 1 ? (
            <Sequence from={scene.fromFrame + scene.durationInFrames - 2} durationInFrames={9}>
              <TransitionFlash type={scene.transition} />
            </Sequence>
          ) : null}
        </React.Fragment>
      ))}
    </AbsoluteFill>
  );
};

const Scene: React.FC<{scene: ProductionScene; index: number; total: number}> = ({scene, index, total}) => {
  switch (scene.template) {
    case 'hook-reveal': return <HookReveal scene={scene} />;
    case 'portrait-dossier': return <PortraitDossier scene={scene} />;
    case 'document': return <DocumentScene scene={scene} />;
    case 'map-route': return <MapRoute scene={scene} />;
    case 'stat-slot': return <StatSlot scene={scene} />;
    case 'explainer-diagram': return <ExplainerDiagram scene={scene} />;
    case 'transaction': return <TransactionScene scene={scene} />;
    case 'consequence': return <ConsequenceScene scene={scene} />;
    case 'final-twist': return <FinalTwist scene={scene} />;
    default: return <GenericCollage scene={scene} index={index} total={total} />;
  }
};

const entrance = (frame: number, fps: number, delay = 0) => spring({
  frame: Math.max(0, frame - delay), fps,
  config: {damping: 15, stiffness: 130, mass: 0.82},
  durationInFrames: Math.round(fps * 0.8),
});

const FilmTreatment: React.FC<React.PropsWithChildren<{dark?: boolean}>> = ({children, dark = false}) => {
  const frame = useCurrentFrame();
  const stepped = Math.floor(frame / 2) * 2;
  const weaveX = Math.sin(stepped * 0.43) * 1.45;
  const weaveY = Math.cos(stepped * 0.37) * 1.05;
  const grainX = ((stepped * 17) % 45) - 22;
  const grainY = ((stepped * 29) % 37) - 18;
  return (
    <AbsoluteFill style={{backgroundColor: dark ? palette.navy : palette.paper, overflow: 'hidden'}}>
      <AbsoluteFill style={{transform: `translate3d(${weaveX}px, ${weaveY}px, 0) scale(1.009)`, filter: `saturate(${dark ? 0.82 : 0.95}) contrast(${dark ? 1.14 : 1.07}) sepia(${dark ? 0.04 : 0.11})`}}>
        {children}
      </AbsoluteFill>
      <AbsoluteFill style={{pointerEvents: 'none', opacity: dark ? 0.07 : 0.15, backgroundImage: 'repeating-linear-gradient(5deg, transparent 0 11px, rgba(76,52,25,0.18) 12px, transparent 13px 31px), repeating-linear-gradient(93deg, transparent 0 29px, rgba(255,255,255,0.3) 30px, transparent 31px 57px)'}} />
      <AbsoluteFill style={{pointerEvents: 'none', inset: -45, opacity: 0.2, mixBlendMode: 'overlay', transform: `translate(${grainX}px, ${grainY}px)`, backgroundImage: 'repeating-radial-gradient(circle at 30% 20%, rgba(255,255,255,0.34) 0 0.7px, rgba(0,0,0,0.3) 0.9px 1.5px, transparent 1.8px 4px)', backgroundSize: '9px 11px'}} />
      <AbsoluteFill style={{pointerEvents: 'none', background: 'radial-gradient(ellipse 92% 82% at 50% 48%, transparent 0%, transparent 55%, rgba(0,0,0,0.48) 100%)'}} />
    </AbsoluteFill>
  );
};

const SceneShell: React.FC<React.PropsWithChildren<{scene: ProductionScene; focus?: boolean}>> = ({scene, focus = false, children}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 4, scene.durationInFrames - 5, scene.durationInFrames], [0, 1, 1, 0], clamp);
  const blur = focus ? interpolate(frame, [0, 9, 20, 34, 48], [10, 4, 0, 2.5, 0], clamp) : 0;
  const scale = focus ? interpolate(frame, [0, 30, scene.durationInFrames], [0.94, 1, 1.045], clamp) : 1;
  return (
    <AbsoluteFill style={{opacity}}>
      <div style={{position: 'absolute', inset: -30, filter: `blur(${blur}px)`, transform: `scale(${scale})`}}>
        <FilmTreatment dark={Boolean(scene.dark)}>{children}</FilmTreatment>
      </div>
    </AbsoluteFill>
  );
};

const TornPaper: React.FC<React.PropsWithChildren<{style?: React.CSSProperties; rotate?: number; fill?: string}>> = ({children, style, rotate = 0, fill = palette.paperLight}) => (
  <div style={{position: 'absolute', background: fill, clipPath: 'polygon(1% 4%,8% 1%,16% 4%,25% 1%,36% 3%,47% 0%,58% 4%,69% 1%,80% 4%,90% 1%,99% 5%,97% 17%,100% 30%,97% 44%,100% 57%,97% 72%,100% 87%,96% 98%,84% 96%,73% 100%,61% 97%,49% 100%,37% 97%,25% 100%,14% 96%,2% 99%,4% 83%,1% 68%,4% 52%,1% 35%,4% 19%)', transform: `rotate(${rotate}deg)`, boxShadow: '0 18px 28px rgba(33,25,16,0.22)', ...style}}>{children}</div>
);

const Tape: React.FC<{style?: React.CSSProperties; rotate?: number}> = ({style, rotate = -4}) => (
  <div style={{position: 'absolute', width: 190, height: 52, background: 'rgba(218,182,89,0.55)', border: '1px solid rgba(111,84,27,0.18)', boxShadow: 'inset 0 0 16px rgba(255,255,255,0.22)', transform: `rotate(${rotate}deg)`, clipPath: 'polygon(2% 7%,98% 0,96% 94%,3% 100%)', ...style}} />
);

const StickerText: React.FC<{text?: string | null; top?: number; left?: number; width?: number; size?: number; rotate?: number; fill?: string; color?: string; delay?: number}> = ({text, top = 120, left = 70, width = 940, size = 84, rotate = -1, fill = palette.gold, color = palette.ink, delay = 0}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const p = entrance(frame, fps, delay);
  if (!text) return null;
  return (
    <div style={{position: 'absolute', top, left, width, padding: '15px 28px 20px', textAlign: 'center', background: fill, color, fontFamily: 'Arial Black, Impact, sans-serif', fontSize: size, fontWeight: 900, lineHeight: 0.96, letterSpacing: -2, textTransform: 'uppercase', clipPath: 'polygon(2% 10%,98% 2%,100% 88%,4% 100%)', boxShadow: '0 14px 0 rgba(35,29,20,0.13)', transform: `translateY(${interpolate(p, [0, 1], [-70, 0])}px) rotate(${rotate}deg) scale(${0.84 + p * 0.16})`, opacity: interpolate(p, [0, 0.2, 1], [0, 1, 1])}}>{text}</div>
  );
};

const KineticLine: React.FC<{text?: string | null; style?: React.CSSProperties; delay?: number; color?: string; size?: number; align?: 'left' | 'center' | 'right'}> = ({text, style, delay = 0, color = palette.ink, size = 64, align = 'left'}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const p = entrance(frame, fps, delay);
  if (!text) return null;
  return <div style={{position: 'absolute', color, fontFamily: 'Arial Black, Impact, sans-serif', fontWeight: 900, fontSize: size, lineHeight: 0.98, textTransform: 'uppercase', letterSpacing: -1.5, textAlign: align, opacity: p, transform: `translateY(${interpolate(p, [0, 1], [55, 0])}px) scale(${0.86 + p * 0.14})`, ...style}}>{text}</div>;
};

const TransitionFlash: React.FC<{type?: ProductionScene['transition']}> = ({type = 'whip-flash'}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 1, 3, 8], [0, 0.84, 0.34, 0], clamp);
  const x = interpolate(frame, [0, 8], [-120, 115], clamp);
  const color = type === 'shutter' ? palette.white : type === 'paper-tear' ? palette.red : palette.gold;
  return <AbsoluteFill style={{pointerEvents: 'none'}}><AbsoluteFill style={{background: palette.paperLight, opacity, mixBlendMode: 'screen'}} /><div style={{position: 'absolute', top: 0, bottom: 0, left: `${x}%`, width: type === 'shutter' ? 520 : 230, background: color, opacity: opacity * 0.72, transform: 'skewX(-18deg)'}} /></AbsoluteFill>;
};

const Sparkles: React.FC<{dark?: boolean; count?: number}> = ({dark = false, count = 16}) => {
  const frame = useCurrentFrame();
  const stepped = Math.floor(frame / 2) * 2;
  return <>{Array.from({length: count}).map((_, i) => { const x = 55 + ((i * 137) % 930); const y = 170 + ((i * 211) % 1470); const pulse = 0.35 + 0.65 * Math.abs(Math.sin(stepped * 0.055 + i)); return <div key={i} style={{position: 'absolute', left: x, top: y, width: i % 3 === 0 ? 14 : 8, height: i % 3 === 0 ? 14 : 8, opacity: pulse, background: dark ? palette.gold : i % 2 ? palette.red : palette.gold, transform: `rotate(${45 + stepped * 0.3}deg)`, clipPath: 'polygon(50% 0,60% 38%,100% 50%,60% 62%,50% 100%,40% 62%,0 50%,40% 38%)'}} />; })}</>;
};

const ScribbleOval: React.FC<{progress: number; style?: React.CSSProperties; color?: string}> = ({progress, style, color = palette.gold}) => (
  <svg viewBox="0 0 500 180" style={{position: 'absolute', overflow: 'visible', ...style}}><path d="M28 103 C68 20 433 8 477 90 C509 153 92 188 29 111" fill="none" stroke={color} strokeWidth="13" strokeLinecap="round" strokeDasharray="1200" strokeDashoffset={1200 * (1 - progress)} /><path d="M51 111 C95 42 416 30 459 91" fill="none" stroke={palette.goldDark} strokeWidth="5" strokeLinecap="round" strokeDasharray="900" strokeDashoffset={900 * (1 - progress)} opacity={0.85} /></svg>
);

const MotifGlyph: React.FC<{visual: ProceduralVisual; dark?: boolean; style?: React.CSSProperties}> = ({visual, dark = false, style}) => {
  const frame = useCurrentFrame();
  const stepped = Math.floor(frame / 2) * 2;
  const wobble = Math.sin(stepped * 0.08 + (visual.variant || 1)) * 1.2;
  const ink = dark ? palette.white : palette.ink;
  const accent = visual.motif === 'nature' ? palette.green : visual.motif === 'science' || visual.motif === 'signal' ? palette.teal : palette.gold;
  return (
    <svg viewBox="0 0 520 620" style={{position: 'absolute', overflow: 'visible', filter: 'drop-shadow(20px 25px 0 rgba(20,18,14,0.2))', transform: `rotate(${wobble}deg)`, ...style}}>
      <MotifPaths motif={visual.motif} ink={ink} accent={accent} frame={stepped} />
    </svg>
  );
};

const MotifPaths: React.FC<{motif: VisualMotif; ink: string; accent: string; frame: number}> = ({motif, ink, accent, frame}) => {
  const spin = frame * 0.55;
  if (motif === 'person') return <><path d="M106 596 C120 430 180 356 262 356 C345 356 405 430 420 596 Z" fill="#d6d0c4" stroke={ink} strokeWidth="15"/><ellipse cx="262" cy="230" rx="120" ry="145" fill="#d6c3a7" stroke={ink} strokeWidth="15"/><path d="M143 215 C152 65 382 68 385 228 C326 162 202 161 143 215 Z" fill={ink}/><path d="M190 315 C235 350 292 350 336 315" fill="none" stroke={ink} strokeWidth="10" strokeLinecap="round"/><circle cx="218" cy="232" r="11" fill={ink}/><circle cx="305" cy="232" r="11" fill={ink}/><path d="M221 410 L262 475 L303 410" fill={accent} stroke={ink} strokeWidth="10"/></>;
  if (motif === 'monument') return <><path d="M260 25 L205 250 L130 552 M260 25 L315 250 L390 552" fill="none" stroke={ink} strokeWidth="30" strokeLinecap="round"/><path d="M205 250 L315 250 M170 390 L350 390 M105 555 L415 555" stroke={ink} strokeWidth="26"/><path d="M150 520 C190 455 330 455 370 520" fill="none" stroke={accent} strokeWidth="18"/><circle cx="260" cy="25" r="22" fill={palette.red} stroke={ink} strokeWidth="8"/></>;
  if (motif === 'machine') return <><g transform={`rotate(${spin} 215 300)`}><circle cx="215" cy="300" r="135" fill={palette.paperLight} stroke={ink} strokeWidth="18"/><circle cx="215" cy="300" r="55" fill={accent} stroke={ink} strokeWidth="14"/>{Array.from({length: 12}).map((_,i)=><rect key={i} x="199" y="130" width="32" height="62" rx="8" fill={ink} transform={`rotate(${i*30} 215 300)`}/>)}</g><g transform={`rotate(${-spin*1.35} 380 420)`}><circle cx="380" cy="420" r="85" fill={palette.teal} stroke={ink} strokeWidth="15"/><circle cx="380" cy="420" r="28" fill={palette.paperLight} stroke={ink} strokeWidth="10"/></g><path d="M65 510 C135 470 185 465 250 498" fill="none" stroke={palette.red} strokeWidth="14" strokeDasharray="20 15"/></>;
  if (motif === 'map' || motif === 'ocean') return <><path d="M40 100 C120 60 190 105 260 70 C345 30 425 80 485 52 L485 525 C410 565 337 520 260 555 C175 595 105 548 40 575 Z" fill={motif==='ocean'?palette.teal:palette.paperLight} stroke={ink} strokeWidth="15"/><path d="M85 180 C165 125 206 245 285 215 C355 188 380 300 450 260" fill="none" stroke={palette.red} strokeWidth="16" strokeDasharray="18 18"/><circle cx="85" cy="180" r="20" fill={accent} stroke={ink} strokeWidth="8"/><circle cx="450" cy="260" r="20" fill={palette.red} stroke={ink} strokeWidth="8"/>{motif==='ocean'?Array.from({length:4}).map((_,i)=><path key={i} d={`M75 ${360+i*45} Q145 ${325+i*45} 215 ${360+i*45} T355 ${360+i*45} T485 ${360+i*45}`} fill="none" stroke={ink} strokeWidth="10" opacity={0.55}/>):null}</>;
  if (motif === 'document') return <><path d="M78 45 L435 70 L408 574 L52 548 Z" fill={palette.paperLight} stroke={ink} strokeWidth="16"/><path d="M115 145 L360 160 M110 205 L380 225 M100 275 L345 292 M95 345 L365 370" stroke={ink} strokeWidth="13" strokeLinecap="round"/><circle cx="320" cy="455" r="74" fill="none" stroke={palette.red} strokeWidth="16"/><path d="M270 455 L370 455 M320 405 L320 505" stroke={palette.red} strokeWidth="13"/></>;
  if (motif === 'money') return <><path d="M55 165 L430 105 L475 410 L100 470 Z" fill={palette.green} stroke={ink} strokeWidth="16"/><circle cx="265" cy="290" r="92" fill={palette.paperLight} stroke={ink} strokeWidth="14"/><path d="M264 224 C212 224 212 278 264 285 C322 293 318 355 259 355 C224 355 199 338 190 316" fill="none" stroke={ink} strokeWidth="20" strokeLinecap="round"/><path d="M264 195 L264 385" stroke={accent} strokeWidth="13"/><path d="M75 500 L450 500" stroke={palette.red} strokeWidth="22" strokeDasharray="45 18"/></>;
  if (motif === 'eye') return <><path d="M35 315 C135 145 385 145 485 315 C385 485 135 485 35 315 Z" fill={palette.paperLight} stroke={ink} strokeWidth="18"/><circle cx="260" cy="315" r="118" fill={palette.teal} stroke={ink} strokeWidth="16"/><circle cx="260" cy="315" r="48" fill={ink}/><path d="M260 80 L260 155 M260 475 L260 550 M25 165 L95 215 M425 415 L495 465" stroke={accent} strokeWidth="14" strokeLinecap="round"/></>;
  if (motif === 'science') return <><g transform={`rotate(${spin} 260 305)`}><ellipse cx="260" cy="305" rx="190" ry="70" fill="none" stroke={ink} strokeWidth="14"/><ellipse cx="260" cy="305" rx="190" ry="70" fill="none" stroke={accent} strokeWidth="14" transform="rotate(60 260 305)"/><ellipse cx="260" cy="305" rx="190" ry="70" fill="none" stroke={palette.red} strokeWidth="14" transform="rotate(-60 260 305)"/></g><circle cx="260" cy="305" r="58" fill={accent} stroke={ink} strokeWidth="15"/></>;
  if (motif === 'nature') return <><path d="M270 560 C265 400 225 240 130 95 C270 95 380 185 390 310 C400 425 330 505 270 560 Z" fill={palette.green} stroke={ink} strokeWidth="16"/><path d="M270 550 C275 365 300 235 390 125" fill="none" stroke={accent} strokeWidth="18"/><path d="M270 350 C205 330 165 292 130 245 M285 285 C340 270 375 238 405 198" fill="none" stroke={ink} strokeWidth="12"/></>;
  if (motif === 'signal') return <><circle cx="260" cy="320" r="34" fill={palette.red} stroke={ink} strokeWidth="12"/><path d="M190 250 C130 315 130 390 190 455 M330 250 C390 315 390 390 330 455 M125 190 C25 300 25 430 125 540 M395 190 C495 300 495 430 395 540" fill="none" stroke={accent} strokeWidth="20" strokeLinecap="round"/><path d="M260 350 L260 570" stroke={ink} strokeWidth="24"/></>;
  if (motif === 'mystery') return <><path d="M155 180 C155 70 365 60 385 205 C395 280 335 330 280 365 C245 388 238 425 238 465" fill="none" stroke={ink} strokeWidth="42" strokeLinecap="round"/><circle cx="240" cy="555" r="28" fill={palette.red} stroke={ink} strokeWidth="10"/><path d="M75 105 L120 145 M420 115 L382 155 M75 505 L125 470 M420 500 L375 465" stroke={accent} strokeWidth="16"/></>;
  return <><path d="M70 110 L450 80 L465 525 L55 555 Z" fill={palette.paperLight} stroke={ink} strokeWidth="16"/><circle cx="165" cy="280" r="90" fill={accent} stroke={ink} strokeWidth="14"/><rect x="265" y="190" width="135" height="190" rx="20" fill={palette.teal} stroke={ink} strokeWidth="14"/><path d="M100 450 C185 400 310 420 415 465" fill="none" stroke={palette.red} strokeWidth="16" strokeDasharray="25 16"/></>;
};

const SymbolChips: React.FC<{visual: ProceduralVisual; dark?: boolean; top?: number}> = ({visual, dark = false, top = 1320}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  return <div style={{position: 'absolute', top, left: 70, right: 70, display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 18}}>{(visual.symbols || []).slice(0, 5).map((symbol, i) => { const p = entrance(frame, fps, 12 + i * 5); return <div key={`${symbol}-${i}`} style={{padding: '10px 20px', background: i % 2 ? palette.red : palette.gold, color: dark ? palette.white : palette.ink, border: `6px solid ${dark ? palette.white : palette.ink}`, fontFamily: 'Arial Black, Impact, sans-serif', fontSize: 33, lineHeight: 1, transform: `rotate(${i % 2 ? 2 : -2}deg) scale(${0.75 + p * 0.25})`, opacity: p, boxShadow: '7px 8px 0 rgba(0,0,0,0.16)'}}>{symbol}</div>; })}</div>;
};

const HookReveal: React.FC<{scene: ProductionScene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const p = entrance(frame, fps, 2);
  const zoom = interpolate(frame, [0, scene.durationInFrames], [0.9, 1.07], clamp);
  return <SceneShell scene={scene} focus><Sparkles /><StickerText text={scene.headline} top={115} size={90} rotate={-1.5} /><MotifGlyph visual={scene.visual} style={{width: 620, height: 760, left: 230, top: 475, transform: `scale(${zoom}) rotate(${interpolate(p,[0,1],[-8,0])}deg)`}}/><TornPaper rotate={2} style={{left: 145, right: 125, bottom: 250, height: 250, padding: 40}}><KineticLine text={scene.kicker || scene.visual.subject} size={64} align="center" style={{position: 'relative', width: '100%'}}/><div style={{position:'absolute',left:40,right:40,bottom:35,height:16,background:palette.red,transform:`scaleX(${p})`,transformOrigin:'left'}}/></TornPaper><SymbolChips visual={scene.visual} top={1515}/></SceneShell>;
};

const PortraitDossier: React.FC<{scene: ProductionScene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const p = entrance(frame, fps, 3);
  return <SceneShell scene={scene} focus><StickerText text={scene.headline} top={115} size={80} rotate={1.2}/><TornPaper rotate={-2} style={{left: 80, top: 390, width: 590, height: 1080}}><MotifGlyph visual={{...scene.visual,motif:'person'}} style={{width: 520,height:620,left:35,top:130}}/><div style={{position:'absolute',left:55,right:55,bottom:120,fontFamily:'Georgia,serif',fontSize:34,lineHeight:1.25,color:palette.ink}}>{scene.visual.subject}<br/><b>{scene.visual.date || scene.visual.location || 'CASE FILE'}</b></div><Tape style={{left:185,top:-20}} rotate={-3}/></TornPaper><div style={{position:'absolute',right:70,top:520,width:330,display:'grid',gap:28}}>{(scene.visual.symbols||[]).slice(0,4).map((x,i)=><div key={x} style={{padding:'20px 18px',background:i%2?palette.teal:palette.paperLight,border:`9px solid ${palette.ink}`,fontFamily:'Arial Black,Impact,sans-serif',fontSize:34,textAlign:'center',transform:`translateX(${interpolate(p,[0,1],[140,0])}px) rotate(${i%2?2:-2}deg)`,boxShadow:'12px 14px 0 rgba(0,0,0,.15)'}}>{x}</div>)}</div></SceneShell>;
};

const DocumentScene: React.FC<{scene: ProductionScene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const stamp = interpolate(frame,[18,36],[0,1],clamp);
  return <SceneShell scene={scene} focus><StickerText text={scene.headline} top={110} size={78}/><TornPaper rotate={-5} style={{left:95,top:425,width:720,height:1050,padding:55}}><div style={{fontFamily:'Georgia,serif',fontWeight:700,fontSize:48,borderBottom:`8px solid ${palette.ink}`,paddingBottom:24}}>{scene.visual.subject || 'OFFICIAL RECORD'}</div>{Array.from({length:7}).map((_,i)=><div key={i} style={{height:18,background:palette.ink,opacity:0.72,width:`${88-(i%3)*12}%`,marginTop:45}}/>)}<div style={{position:'absolute',right:70,bottom:80,width:250,height:250,border:`18px solid ${palette.red}`,borderRadius:'50%',display:'grid',placeItems:'center',color:palette.red,fontFamily:'Arial Black,Impact,sans-serif',fontSize:42,transform:`scale(${0.3+stamp*0.7}) rotate(-13deg)`,opacity:stamp}}>SEALED</div><Tape style={{left:250,top:-25}}/></TornPaper><TornPaper rotate={6} fill={palette.teal} style={{right:55,top:705,width:360,height:455,padding:30}}><KineticLine text={scene.kicker || scene.visual.date || 'EVIDENCE'} size={48} align="center" style={{position:'relative',width:'100%',top:70}}/></TornPaper><SymbolChips visual={scene.visual} top={1530}/></SceneShell>;
};

const MapRoute: React.FC<{scene: ProductionScene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const route = interpolate(frame,[12,scene.durationInFrames*0.65],[0,1],clamp);
  return <SceneShell scene={scene}><StickerText text={scene.headline} top={110} size={78} rotate={-1}/><svg viewBox="0 0 900 980" style={{position:'absolute',left:90,top:430,width:900,height:980,filter:'drop-shadow(18px 22px 0 rgba(0,0,0,.15))'}}><path d="M50 110 C185 50 300 145 420 90 C575 22 720 118 850 65 L845 870 C700 930 580 840 430 900 C285 960 165 862 45 930 Z" fill={scene.visual.motif==='ocean'?palette.teal:palette.paperLight} stroke={palette.ink} strokeWidth="18"/><path d="M120 270 C260 140 360 445 505 310 C630 195 685 520 790 405" fill="none" stroke={palette.red} strokeWidth="18" strokeDasharray="24 20" strokeDashoffset={1200*(1-route)}/><circle cx="120" cy="270" r="25" fill={palette.gold} stroke={palette.ink} strokeWidth="10"/><circle cx="790" cy="405" r="25" fill={palette.red} stroke={palette.ink} strokeWidth="10"/><path d="M720 420 l70 -15 -35 62" fill={palette.red} stroke={palette.ink} strokeWidth="8"/>{Array.from({length:4}).map((_,i)=><path key={i} d={`M100 ${600+i*60} Q220 ${550+i*60} 340 ${600+i*60} T580 ${600+i*60} T820 ${600+i*60}`} fill="none" stroke={palette.ink} strokeWidth="10" opacity={0.2+i*0.08}/>)}</svg><KineticLine text={scene.visual.location || scene.kicker || 'THE ROUTE'} size={58} align="center" style={{left:100,right:100,bottom:230}}/></SceneShell>;
};

const StatSlot: React.FC<{scene: ProductionScene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const p = entrance(frame,fps,4);
  const shake = frame < 28 ? Math.sin(frame*2.4)*10*(1-frame/30) : 0;
  return <SceneShell scene={scene} focus><StickerText text={scene.headline} top={110} size={74}/><TornPaper rotate={-2} style={{left:75,right:75,top:520,height:610,background:palette.navy,border:`14px solid ${palette.ink}`}}><div style={{position:'absolute',inset:45,border:`10px solid ${palette.gold}`,display:'grid',placeItems:'center',overflow:'hidden'}}><div style={{fontFamily:'Arial Black,Impact,sans-serif',fontSize:185,lineHeight:.9,color:palette.white,letterSpacing:-8,transform:`translateY(${interpolate(p,[0,1],[250,0])}px) translateX(${shake}px) scale(${0.7+p*0.3})`}}>{scene.stat || scene.visual.date || '100%'}</div><div style={{position:'absolute',bottom:60,color:palette.gold,fontFamily:'Arial Black,Impact,sans-serif',fontSize:72}}>{scene.statLabel || scene.kicker || scene.visual.subject}</div></div></TornPaper><MotifGlyph visual={scene.visual} style={{width:350,height:420,right:45,bottom:150,opacity:.9}}/><SymbolChips visual={scene.visual} top={1350}/></SceneShell>;
};

const ExplainerDiagram: React.FC<{scene: ProductionScene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const progress = interpolate(frame,[8,scene.durationInFrames-20],[0,1],clamp);
  return <SceneShell scene={scene}><StickerText text={scene.headline} top={110} size={76}/><MotifGlyph visual={{...scene.visual,motif:scene.visual.motif==='generic'?'machine':scene.visual.motif}} style={{width:620,height:730,left:230,top:470}}/><svg viewBox="0 0 900 420" style={{position:'absolute',left:90,bottom:210,width:900,height:420}}>{[0,1,2].map((i)=><g key={i}><circle cx={150+i*300} cy={170+(i%2)*70} r="70" fill={i===1?palette.teal:palette.paperLight} stroke={palette.ink} strokeWidth="15"/><text x={150+i*300} y={185+(i%2)*70} textAnchor="middle" fontFamily="Arial Black,Impact,sans-serif" fontSize="38" fill={palette.ink}>{(scene.visual.symbols||[])[i]||`STEP ${i+1}`}</text>{i<2?<path d={`M225 ${170+(i%2)*70} C300 ${100+i*60} 340 ${280-i*50} 385 ${170+((i+1)%2)*70}`} fill="none" stroke={palette.red} strokeWidth="16" strokeDasharray="18 12" strokeDashoffset={500*(1-progress)}/>:null}</g>)}</svg></SceneShell>;
};

const TransactionScene: React.FC<{scene: ProductionScene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const p = entrance(frame,fps,3);
  return <SceneShell scene={scene} focus><StickerText text={scene.headline} top={110} size={78}/><TornPaper rotate={-4} style={{left:80,top:480,width:430,height:650,padding:30,background:palette.green}}><MotifGlyph visual={{...scene.visual,motif:'money'}} style={{width:390,height:480,left:20,top:80}}/></TornPaper><div style={{position:'absolute',left:470,top:760,width:160,height:24,background:palette.red,transform:`scaleX(${p}) rotate(-8deg)`,transformOrigin:'left'}}/><div style={{position:'absolute',left:600,top:700,fontSize:130,color:palette.red,fontFamily:'Arial Black,Impact,sans-serif',transform:`scale(${0.6+p*0.4})`}}>→</div><TornPaper rotate={5} style={{right:55,top:500,width:400,height:620,padding:35}}><KineticLine text={scene.stat || scene.visual.subject || 'THE DEAL'} size={86} align="center" style={{position:'relative',width:'100%',top:160}}/><KineticLine text={scene.statLabel || scene.kicker || 'PAID IN CASH'} size={46} align="center" color={palette.red} style={{position:'relative',width:'100%',top:245}}/></TornPaper><SymbolChips visual={scene.visual} top={1410}/></SceneShell>;
};

const ConsequenceScene: React.FC<{scene: ProductionScene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const pulse = 1+Math.sin(frame*.45)*.04;
  const crack = interpolate(frame,[15,scene.durationInFrames*.7],[0,1],clamp);
  return <SceneShell scene={scene}><Sparkles dark count={10}/><StickerText text={scene.headline} top={110} size={82} fill={palette.red} color={palette.white}/><MotifGlyph visual={scene.visual} dark style={{width:600,height:720,left:245,top:500,transform:`scale(${pulse})`}}/><svg viewBox="0 0 900 700" style={{position:'absolute',left:90,top:480,width:900,height:700,pointerEvents:'none'}}><path d="M450 40 L380 180 L465 245 L330 390 L430 470 L280 660" fill="none" stroke={palette.red} strokeWidth="18" strokeDasharray="1000" strokeDashoffset={1000*(1-crack)}/><path d="M450 245 L590 335 L515 455 L680 590" fill="none" stroke={palette.gold} strokeWidth="12" strokeDasharray="700" strokeDashoffset={700*(1-crack)}/></svg><KineticLine text={scene.kicker || scene.visual.secondary || 'THE CONSEQUENCE'} size={58} color={palette.white} align="center" style={{left:100,right:100,bottom:245}}/><SymbolChips visual={scene.visual} dark top={1440}/></SceneShell>;
};

const FinalTwist: React.FC<{scene: ProductionScene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const p = entrance(frame,fps,2);
  const scribble = interpolate(frame,[25,70],[0,1],clamp);
  return <SceneShell scene={scene} focus><Sparkles dark count={22}/><div style={{position:'absolute',left:70,right:70,top:220,textAlign:'center',color:palette.white,fontFamily:'Arial Black,Impact,sans-serif',fontSize:96,lineHeight:.92,letterSpacing:-3,transform:`scale(${.75+p*.25})`,opacity:p}}>{scene.headline}</div><MotifGlyph visual={{...scene.visual,motif:scene.visual.motif==='generic'?'mystery':scene.visual.motif}} dark style={{width:560,height:650,left:260,top:620}}/><ScribbleOval progress={scribble} style={{left:285,top:1225,width:510}}/><KineticLine text={scene.kicker || scene.visual.subject} size={62} color={palette.gold} align="center" style={{left:100,right:100,bottom:260}}/><SymbolChips visual={scene.visual} dark top={1510}/><div style={{position:'absolute',left:0,right:0,bottom:0,height:80,background:palette.red,transform:`scaleX(${interpolate(frame,[scene.durationInFrames-35,scene.durationInFrames-5],[0,1],clamp)})`}}/></SceneShell>;
};

const GenericCollage: React.FC<{scene: ProductionScene; index: number; total: number}> = ({scene,index,total}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const p = entrance(frame,fps,4);
  return <SceneShell scene={scene}><StickerText text={scene.headline} top={105} size={76} rotate={index%2?1.5:-1.5}/><TornPaper rotate={index%2?4:-4} style={{left:index%2?315:80,top:455,width:680,height:850}}><MotifGlyph visual={scene.visual} style={{width:570,height:680,left:55,top:80}}/><Tape style={{left:240,top:-20}}/></TornPaper><div style={{position:'absolute',left:80,right:80,bottom:230,height:190,background:index%2?palette.teal:palette.paperLight,border:`10px solid ${palette.ink}`,transform:`translateY(${interpolate(p,[0,1],[100,0])}px) rotate(${index%2?-2:2}deg)`,display:'grid',placeItems:'center',fontFamily:'Arial Black,Impact,sans-serif',fontSize:54,textAlign:'center'}}>{scene.kicker || `${index+1} / ${total}`}</div><SymbolChips visual={scene.visual} top={1390}/></SceneShell>;
};
