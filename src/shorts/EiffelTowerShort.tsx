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
import {
  CollageFrame,
  FrameNumber,
  palette,
  Sparkles,
  StickerText,
  Tape,
  TornPaper,
} from './CollageKit';

const clamp = {
  extrapolateLeft: 'clamp' as const,
  extrapolateRight: 'clamp' as const,
};

export const EIFFEL_SHORT_DURATION = 1320;

const beats = {
  hook: {from: 0, duration: 105},
  newspaper: {from: 105, duration: 150},
  letters: {from: 255, duration: 180},
  auction: {from: 435, duration: 195},
  iron: {from: 630, duration: 165},
  payment: {from: 795, duration: 165},
  silence: {from: 960, duration: 150},
  final: {from: 1110, duration: 210},
};

const cuts = [105, 255, 435, 630, 795, 960, 1110];

export const EiffelTowerShort: React.FC = () => (
  <AbsoluteFill style={{backgroundColor: palette.paper}}>
    <Audio src={staticFile('audio/eiffel/voice.mp3')} volume={1} />
    <Audio
      src={staticFile('audio/eiffel/music.wav')}
      volume={(frame) => {
        const endingLift = interpolate(frame, [1110, 1295], [0, 0.055], clamp);
        const shameDrop = interpolate(frame, [960, 1010, 1090], [0, -0.045, 0], clamp);
        return 0.13 + endingLift + shameDrop;
      }}
    />

    <Sequence from={0} durationInFrames={42}><Audio src={staticFile('audio/eiffel/sfx/whoosh-entrance.wav')} volume={0.68} /></Sequence>
    <Sequence from={8} durationInFrames={20}><Audio src={staticFile('audio/eiffel/sfx/camera-shutter.wav')} volume={0.95} /></Sequence>
    <Sequence from={102} durationInFrames={38}><Audio src={staticFile('audio/eiffel/sfx/whoosh-quick-pan.wav')} volume={0.72} /></Sequence>
    <Sequence from={124} durationInFrames={42}><Audio src={staticFile('audio/eiffel/sfx/focus-hunt-left.wav')} volume={0.76} /></Sequence>
    <Sequence from={150} durationInFrames={54}><Audio src={staticFile('audio/eiffel/paper.wav')} volume={0.5} /></Sequence>
    <Sequence from={252} durationInFrames={45}><Audio src={staticFile('audio/eiffel/sfx/whoosh-quick-pan.wav')} volume={0.68} /></Sequence>
    <Sequence from={292} durationInFrames={30}><Audio src={staticFile('audio/eiffel/stamp.wav')} volume={0.78} /></Sequence>
    <Sequence from={334} durationInFrames={42}><Audio src={staticFile('audio/eiffel/sfx/focus-hunt-right.wav')} volume={0.7} /></Sequence>
    <Sequence from={430} durationInFrames={62}><Audio src={staticFile('audio/eiffel/sfx/whoosh-long-zoom.wav')} volume={0.72} /></Sequence>
    <Sequence from={520} durationInFrames={30}><Audio src={staticFile('audio/eiffel/stamp.wav')} volume={0.62} /></Sequence>
    <Sequence from={626} durationInFrames={50}><Audio src={staticFile('audio/eiffel/sfx/whoosh-quick-pan.wav')} volume={0.76} /></Sequence>
    <Sequence from={682} durationInFrames={45}><Audio src={staticFile('audio/eiffel/impact.wav')} volume={0.62} /></Sequence>
    <Sequence from={792} durationInFrames={55}><Audio src={staticFile('audio/eiffel/sfx/whoosh-entrance.wav')} volume={0.55} /></Sequence>
    <Sequence from={842} durationInFrames={75}><Audio src={staticFile('audio/eiffel/sfx/cha-ching.wav')} volume={0.84} /></Sequence>
    <Sequence from={869} durationInFrames={48}><Audio src={staticFile('audio/eiffel/coin.wav')} volume={0.46} /></Sequence>
    <Sequence from={958} durationInFrames={55}><Audio src={staticFile('audio/eiffel/sfx/focus-hunt-left.wav')} volume={0.55} /></Sequence>
    <Sequence from={996} durationInFrames={54}><Audio src={staticFile('audio/eiffel/heartbeat.wav')} volume={0.48} /></Sequence>
    <Sequence from={1042} durationInFrames={35}><Audio src={staticFile('audio/eiffel/stamp.wav')} volume={0.7} /></Sequence>
    <Sequence from={1106} durationInFrames={65}><Audio src={staticFile('audio/eiffel/sfx/whoosh-long-zoom.wav')} volume={0.75} /></Sequence>
    <Sequence from={1140} durationInFrames={180}><Audio src={staticFile('audio/eiffel/sfx/neon-buzz.wav')} volume={0.13} /></Sequence>
    <Sequence from={1258} durationInFrames={62}><Audio src={staticFile('audio/eiffel/boom.wav')} volume={0.74} /></Sequence>

    <Sequence from={beats.hook.from} durationInFrames={beats.hook.duration}><HookScene duration={beats.hook.duration} /></Sequence>
    <Sequence from={beats.newspaper.from} durationInFrames={beats.newspaper.duration}><NewspaperScene duration={beats.newspaper.duration} /></Sequence>
    <Sequence from={beats.letters.from} durationInFrames={beats.letters.duration}><LettersScene duration={beats.letters.duration} /></Sequence>
    <Sequence from={beats.auction.from} durationInFrames={beats.auction.duration}><AuctionScene duration={beats.auction.duration} /></Sequence>
    <Sequence from={beats.iron.from} durationInFrames={beats.iron.duration}><IronScene duration={beats.iron.duration} /></Sequence>
    <Sequence from={beats.payment.from} durationInFrames={beats.payment.duration}><PaymentScene duration={beats.payment.duration} /></Sequence>
    <Sequence from={beats.silence.from} durationInFrames={beats.silence.duration}><SilenceScene duration={beats.silence.duration} /></Sequence>
    <Sequence from={beats.final.from} durationInFrames={beats.final.duration}><FinalScene duration={beats.final.duration} /></Sequence>

    {cuts.map((cut) => (
      <Sequence key={cut} from={cut - 2} durationInFrames={8}>
        <TransitionFlash />
      </Sequence>
    ))}
  </AbsoluteFill>
);

const TransitionFlash: React.FC = () => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 1, 3, 7], [0, 0.82, 0.35, 0], clamp);
  const x = interpolate(frame, [0, 7], [-100, 100], clamp);
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <AbsoluteFill style={{background: palette.paperLight, opacity, mixBlendMode: 'screen'}} />
      <div style={{position: 'absolute', top: 0, bottom: 0, left: `${x}%`, width: 230, background: palette.gold, opacity: opacity * 0.7, transform: 'skewX(-18deg)'}} />
    </AbsoluteFill>
  );
};

const SceneShell: React.FC<React.PropsWithChildren<{duration: number; dark?: boolean; focusHunt?: boolean}>> = ({duration, dark = false, focusHunt = false, children}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 4, duration - 5, duration], [0, 1, 1, 0], clamp);
  const focus = focusHunt
    ? interpolate(frame, [0, 8, 18, 31, 45], [9, 4, 0, 2.8, 0], clamp)
    : 0;
  const scale = focusHunt ? interpolate(frame, [0, 24, duration], [0.94, 1, 1.045], clamp) : 1;
  return (
    <AbsoluteFill style={{opacity}}>
      <div style={{position: 'absolute', inset: -35, filter: `blur(${focus}px)`, transform: `scale(${scale})`}}>
        <CollageFrame dark={dark}>{children}</CollageFrame>
      </div>
    </AbsoluteFill>
  );
};

const EiffelTower: React.FC<{style?: React.CSSProperties; dark?: boolean; progress?: number; dismantle?: number}> = ({style, dark = false, progress = 1, dismantle = 0}) => {
  const frame = useCurrentFrame();
  const stepped = Math.floor(frame / 2) * 2;
  const sway = Math.sin(stepped * 0.055) * 0.9;
  const ink = dark ? palette.white : palette.ink;
  const customTransform = style?.transform ?? '';
  const mergedStyle = {...style};
  delete mergedStyle.transform;
  return (
    <svg viewBox="0 0 420 850" style={{position: 'absolute', overflow: 'visible', filter: 'drop-shadow(22px 28px 0 rgba(22,18,14,0.22))', ...mergedStyle, transform: `rotate(${sway}deg) scale(${0.82 + progress * 0.18}) ${customTransform}`}}>
      <g opacity={1 - dismantle * 0.45}>
        <path d="M205 24 L153 315 L95 680 L35 807 M215 24 L267 315 L325 680 L385 807" fill="none" stroke={ink} strokeWidth="28" strokeLinecap="round" />
        <path d="M159 305 L261 305 M117 540 L303 540 M62 705 L358 705 M34 807 L386 807" stroke={ink} strokeWidth="25" strokeLinecap="round" />
        <path d="M148 315 L272 315 L306 540 L114 540 Z M112 540 L308 540 L350 705 L70 705 Z" fill="none" stroke={palette.goldDark} strokeWidth="13" />
        <path d="M98 680 C130 625 290 625 322 680" fill="none" stroke={ink} strokeWidth="25" />
        <circle cx="210" cy="21" r="18" fill={palette.red} stroke={ink} strokeWidth="8" />
      </g>
    </svg>
  );
};

const VictorPortrait: React.FC<{style?: React.CSSProperties; dark?: boolean}> = ({style, dark = false}) => {
  const frame = useCurrentFrame();
  const stepped = Math.floor(frame / 2) * 2;
  const wobble = Math.sin(stepped * 0.12) * 0.8;
  const customTransform = style?.transform ?? '';
  const mergedStyle = {...style};
  delete mergedStyle.transform;
  return (
    <div style={{position: 'absolute', width: 440, height: 610, filter: 'drop-shadow(20px 24px 0 rgba(24,18,13,0.22))', ...mergedStyle, transform: `rotate(${wobble}deg) ${customTransform}`}}>
      <svg viewBox="0 0 440 610" width="100%" height="100%">
        <path d="M77 598 C86 438 133 377 219 365 C309 377 358 443 368 598 Z" fill={dark ? '#d9d5ca' : '#d8d2c5'} stroke={palette.ink} strokeWidth="14" />
        <path d="M151 377 L219 473 L289 377 L270 598 L166 598 Z" fill={palette.navy} stroke={palette.ink} strokeWidth="11" />
        <path d="M192 423 L219 468 L247 423 L238 520 L219 552 L199 520 Z" fill={palette.red} stroke={palette.ink} strokeWidth="8" />
        <ellipse cx="219" cy="239" rx="115" ry="142" fill="#d3c5ad" stroke={palette.ink} strokeWidth="14" />
        <path d="M110 213 C114 82 330 66 337 223 C292 168 148 166 110 213 Z" fill={palette.ink} />
        <path d="M103 214 C81 251 93 307 126 323" fill="none" stroke={palette.ink} strokeWidth="18" />
        <path d="M335 213 C358 247 346 305 314 324" fill="none" stroke={palette.ink} strokeWidth="18" />
        <ellipse cx="174" cy="242" rx="12" ry="9" fill={palette.ink} />
        <ellipse cx="265" cy="242" rx="12" ry="9" fill={palette.ink} />
        <path d="M205 279 C218 288 232 288 244 279" fill="none" stroke={palette.ink} strokeWidth="7" strokeLinecap="round" />
        <path d="M170 320 C203 343 240 343 272 319" fill="none" stroke={palette.ink} strokeWidth="9" strokeLinecap="round" />
        <path d="M147 116 C173 75 288 74 318 133" fill="none" stroke={palette.gold} strokeWidth="15" />
      </svg>
    </div>
  );
};

const ScribbleOval: React.FC<{progress: number; style?: React.CSSProperties}> = ({progress, style}) => (
  <svg viewBox="0 0 500 180" style={{position: 'absolute', overflow: 'visible', ...style}}>
    <path d="M28 103 C68 20 433 8 477 90 C509 153 92 188 29 111" fill="none" stroke={palette.gold} strokeWidth="13" strokeLinecap="round" strokeDasharray="1200" strokeDashoffset={1200 * (1 - progress)} />
    <path d="M51 111 C95 42 416 30 459 91" fill="none" stroke={palette.goldDark} strokeWidth="5" strokeLinecap="round" strokeDasharray="900" strokeDashoffset={900 * (1 - progress)} opacity={0.85} />
  </svg>
);

const KineticLine: React.FC<{text: string; delay?: number; color?: string; size?: number; rotate?: number; style?: React.CSSProperties}> = ({text, delay = 0, color = palette.ink, size = 72, rotate = 0, style}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const entered = spring({frame: Math.max(0, frame - delay), fps, config: {damping: 12, stiffness: 150, mass: 0.55}});
  return (
    <div style={{fontFamily: 'Arial Black, Impact, sans-serif', fontSize: size, lineHeight: 0.92, color, opacity: entered, transform: `translateY(${interpolate(entered, [0,1],[75,0],clamp)}px) scale(${0.74 + entered * 0.26}) rotate(${rotate}deg)`, ...style}}>
      {text}
    </div>
  );
};

const OfficialLetter: React.FC<{style?: React.CSSProperties; label?: string}> = ({style, label = 'CONFIDENTIAL'}) => (
  <TornPaper style={{width: 620, height: 770, padding: 52, color: palette.ink, ...style}} rotate={-2} fill={palette.paperLight}>
    <div style={{fontFamily: 'Georgia, serif', textAlign: 'center', fontWeight: 700, fontSize: 33}}>RÉPUBLIQUE FRANÇAISE</div>
    <div style={{height: 6, background: palette.ink, margin: '24px 0 36px'}} />
    <div style={{fontFamily: 'Courier New, monospace', fontSize: 25, lineHeight: 1.55}}>
      Ministry of Posts<br /><br />Subject: Eiffel Tower<br /><br />The structure will be dismantled and sold as scrap metal...
    </div>
    {Array.from({length: 6}).map((_, i) => <div key={i} style={{height: 5, background: palette.ink, opacity: 0.22, marginTop: 22, width: `${88 - i * 5}%`}} />)}
    <div style={{position: 'absolute', right: 48, bottom: 58, border: `11px double ${palette.red}`, borderRadius: '50%', width: 210, height: 210, display: 'grid', placeItems: 'center', color: palette.red, fontFamily: 'Arial Black, sans-serif', fontSize: 29, textAlign: 'center', transform: 'rotate(-13deg)'}}>{label}</div>
  </TornPaper>
);

const HookScene: React.FC<{duration: number}> = ({duration}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const towerIn = spring({frame, fps, config: {damping: 13, stiffness: 105, mass: 0.75}});
  const portraitIn = spring({frame: Math.max(0, frame - 12), fps, config: {damping: 14, stiffness: 125, mass: 0.65}});
  const sold = spring({frame: Math.max(0, frame - 25), fps, config: {damping: 9, stiffness: 190, mass: 0.48}});
  const twice = spring({frame: Math.max(0, frame - 51), fps, config: {damping: 10, stiffness: 170, mass: 0.52}});
  const scribble = interpolate(frame, [57, 72], [0, 1], clamp);
  const shutter = interpolate(frame, [8, 10, 14], [0, 0.95, 0], clamp);
  return (
    <SceneShell duration={duration} dark focusHunt>
      <Sparkles dark count={22} />
      <FrameNumber text="PARIS / 1925" />
      <EiffelTower dark progress={towerIn} style={{left: 338, top: 85, width: 455, height: 930, transformOrigin: '50% 80%'}} />
      <VictorPortrait dark style={{left: -55, top: 655, transform: `translateX(${interpolate(portraitIn,[0,1],[-390,0],clamp)}px) rotate(-4deg) scale(${0.92 + portraitIn * 0.08})`}} />
      <div style={{position: 'absolute', left: 80, right: 80, top: 1040}}>
        <KineticLine text="HE SOLD" color={palette.white} size={82} delay={2} rotate={-1} />
        <KineticLine text="THE EIFFEL TOWER" color={palette.gold} size={89} delay={11} rotate={1} />
        <div style={{position: 'relative', marginTop: 24, width: 650}}>
          <KineticLine text="TWICE." color={palette.white} size={122} delay={51} rotate={-2} />
          <ScribbleOval progress={scribble} style={{left: -40, top: -14, width: 560, height: 190}} />
        </div>
      </div>
      <div style={{position: 'absolute', right: 70, top: 585, width: 310, height: 150, border: `13px double ${palette.red}`, color: palette.red, fontFamily: 'Arial Black, sans-serif', fontSize: 55, display: 'grid', placeItems: 'center', transform: `rotate(-11deg) scale(${sold})`, background: 'rgba(16,24,32,0.88)'}}>SOLD</div>
      <div style={{position: 'absolute', right: 80, bottom: 80, fontFamily: 'Courier New, monospace', fontSize: 27, letterSpacing: 4, color: palette.paperLight, opacity: twice}}>BY A MAN WHO NEVER OWNED IT</div>
      <AbsoluteFill style={{background: palette.white, opacity: shutter, mixBlendMode: 'screen'}} />
    </SceneShell>
  );
};

const NewspaperScene: React.FC<{duration: number}> = ({duration}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const paperIn = spring({frame, fps, config: {damping: 15, stiffness: 102, mass: 0.78}});
  const redHit = spring({frame: Math.max(0, frame - 64), fps, config: {damping: 10, stiffness: 180, mass: 0.5}});
  const underline = interpolate(frame, [75, 96], [0, 1], clamp);
  return (
    <SceneShell duration={duration} focusHunt>
      <FrameNumber text="THE IDEA" />
      <TornPaper style={{left: 62, top: 105, width: 956, height: 1370, transform: `translateY(${interpolate(paperIn,[0,1],[180,0],clamp)}px) rotate(-1deg)`, padding: 52}} fill="#eee3cd">
        <div style={{fontFamily: 'Georgia, serif', fontWeight: 900, fontSize: 59, textAlign: 'center'}}>LE JOURNAL DE PARIS</div>
        <div style={{height: 8, background: palette.ink, margin: '25px 0'}} />
        <div style={{fontFamily: 'Arial Black, sans-serif', fontSize: 78, lineHeight: 0.96}}>THE TOWER IS TOO EXPENSIVE TO MAINTAIN</div>
        <div style={{position: 'relative', marginTop: 28, height: 740}}>
          <EiffelTower progress={1} style={{left: 290, top: 30, width: 340, height: 680}} />
          <VictorPortrait style={{left: -40, top: 310, width: 330, height: 455, transform: 'rotate(5deg)'}} />
        </div>
        <div style={{fontFamily: 'Georgia, serif', fontSize: 30, lineHeight: 1.32}}>Victor Lustig read about the rising maintenance costs—and saw the perfect opening.</div>
      </TornPaper>
      <div style={{position: 'absolute', right: 78, top: 1040, background: palette.red, color: palette.white, border: `8px solid ${palette.ink}`, padding: '18px 28px', fontFamily: 'Arial Black, sans-serif', fontSize: 49, transform: `rotate(6deg) scale(${redHit})`}}>TOO EXPENSIVE!</div>
      <svg viewBox="0 0 640 80" style={{position: 'absolute', left: 185, top: 450, width: 650, height: 90}}><path d="M18 56 C155 72 380 25 625 48" fill="none" stroke={palette.goldDark} strokeWidth="12" strokeLinecap="round" strokeDasharray="800" strokeDashoffset={800 * (1 - underline)} /></svg>
    </SceneShell>
  );
};

const LettersScene: React.FC<{duration: number}> = ({duration}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const letter = spring({frame, fps, config: {damping: 14, stiffness: 95, mass: 0.75}});
  const badge = spring({frame: Math.max(0, frame - 47), fps, config: {damping: 11, stiffness: 150, mass: 0.58}});
  const stamp = spring({frame: Math.max(0, frame - 31), fps, config: {damping: 8, stiffness: 210, mass: 0.45}});
  return (
    <SceneShell duration={duration} dark focusHunt>
      <Sparkles dark count={15} />
      <FrameNumber text="FORGED GOVERNMENT FILE" />
      {[0,1,2,3].map((i) => (
        <TornPaper key={i} style={{left: 30 + i * 205, top: 245 + (i % 2) * 540, width: 360, height: 250, opacity: interpolate(frame,[i*8, i*8+16],[0,0.6],clamp), transform: `translateX(${interpolate(frame,[i*8,i*8+20],[i%2?-300:300,0],clamp)}px) rotate(${i%2?7:-8}deg)`}} fill="#d7cab0" rotate={0}><div style={{fontFamily:'Courier New,monospace',fontSize:26,padding:28}}>PRIVATE INVITATION<br/><br/>SCRAP DEALER #{i+1}</div></TornPaper>
      ))}
      <OfficialLetter style={{left: 54, top: 175, transform: `translateX(${interpolate(letter,[0,1],[-650,0],clamp)}px) rotate(-3deg)`}} />
      <VictorPortrait dark style={{right: -35, top: 745, width: 375, height: 520}} />
      <div style={{position: 'absolute', right: 42, top: 220, width: 345, background: palette.gold, color: palette.ink, border: `8px solid ${palette.ink}`, padding: 27, fontFamily: 'Arial Black, sans-serif', fontSize: 39, textAlign: 'center', transform: `rotate(5deg) scale(${badge})`}}>SENIOR OFFICIAL</div>
      <div style={{position: 'absolute', left: 142, top: 655, width: 520, height: 180, border: `14px double ${palette.red}`, color: palette.red, display: 'grid', placeItems: 'center', fontFamily: 'Arial Black, sans-serif', fontSize: 58, transform: `rotate(-10deg) scale(${stamp})`}}>CONFIDENTIAL</div>
      <Tape style={{left: 235, top: 145}} rotate={-7} />
    </SceneShell>
  );
};

const DealerCard: React.FC<{index: number; progress: number; style?: React.CSSProperties}> = ({index, progress, style}) => (
  <div style={{position:'absolute',width:235,height:285,background:palette.paperLight,border:`9px solid ${palette.ink}`,boxShadow:'13px 15px 0 rgba(0,0,0,0.22)',transform:`scale(${progress}) rotate(${index%2?-5:4}deg)`,padding:20,...style}}>
    <div style={{height:125,background:palette.teal,border:`6px solid ${palette.ink}`,display:'grid',placeItems:'center',fontFamily:'Arial Black,sans-serif',fontSize:52}}>#{index}</div>
    <div style={{fontFamily:'Arial Black,sans-serif',fontSize:28,marginTop:18}}>SCRAP DEALER</div>
    <div style={{fontFamily:'Georgia,serif',fontSize:22}}>Paris, France</div>
  </div>
);

const AuctionScene: React.FC<{duration: number}> = ({duration}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const hotel = spring({frame, fps, config: {damping: 15, stiffness: 92, mass: 0.85}});
  const towerPunch = interpolate(frame,[0,115],[1,1.16],{...clamp,easing:Easing.out(Easing.cubic)});
  return (
    <SceneShell duration={duration} focusHunt>
      <FrameNumber text="SECRET AUCTION" />
      <TornPaper style={{left: 60, top: 80, width: 960, height: 310, padding: 42, transform: `scale(${0.84 + hotel * 0.16})`}} rotate={1} fill={palette.navy}>
        <div style={{color: palette.white, fontFamily: 'Arial Black, sans-serif', fontSize: 70, textAlign: 'center'}}>HÔTEL DE CRILLON</div>
        <div style={{color: palette.gold, fontFamily: 'Georgia, serif', fontSize: 39, textAlign: 'center', marginTop: 22}}>“France will secretly demolish the tower.”</div>
      </TornPaper>
      <EiffelTower progress={1} style={{left: 355, top: 430, width: 375, height: 760, transform:`scale(${towerPunch})`,transformOrigin:'50% 100%'}} />
      {[1,2,3,4,5].map((index) => {
        const p = spring({frame: Math.max(0,frame-25-index*10),fps,config:{damping:12,stiffness:135,mass:0.62}});
        const positions = [{left:55,top:480},{left:765,top:500},{left:50,top:850},{left:765,top:870},{left:420,top:1230}];
        return <DealerCard key={index} index={index} progress={p} style={positions[index-1]} />;
      })}
      <StickerText text="ONE SECRET BUYER" top={1380} left={150} width={780} fontSize={67} fill={palette.red} color={palette.white} rotate={-1} delay={112} />
    </SceneShell>
  );
};

const RollingNumber: React.FC<{delay?: number}> = ({delay=0}) => {
  const frame = useCurrentFrame();
  const progress = interpolate(frame,[delay,delay+30],[0,1],{...clamp,easing:Easing.out(Easing.back(1.7))});
  const values = ['9,900','8,200','7,800','7,300'];
  const idx = Math.min(values.length-1,Math.floor(progress*values.length));
  return <div style={{fontFamily:'Arial Black,Impact,sans-serif',fontSize:142,color:palette.gold,lineHeight:0.9,textShadow:'0 10px 0 rgba(0,0,0,0.25)',transform:`scale(${0.8+progress*0.2})`}}>{values[idx]}</div>;
};

const IronScene: React.FC<{duration: number}> = ({duration}) => {
  const frame = useCurrentFrame();
  const {fps}=useVideoConfig();
  const hit=spring({frame:Math.max(0,frame-47),fps,config:{damping:9,stiffness:190,mass:0.5}});
  const dismantle=interpolate(frame,[70,135],[0,1],clamp);
  return (
    <SceneShell duration={duration} dark focusHunt>
      <Sparkles dark count={18}/>
      <FrameNumber text="THE OFFER"/>
      <EiffelTower dark progress={1} dismantle={dismantle} style={{left:105,top:160,width:340,height:700,transform:`scale(${1+dismantle*0.2})`,opacity:1-dismantle*0.25}}/>
      {Array.from({length:10}).map((_,i)=><div key={i} style={{position:'absolute',left:interpolate(dismantle,[0,1],[280,560+(i%2)*100],clamp),top:410+i*62,width:350-(i%3)*45,height:18,background:i%2?palette.gold:palette.paperLight,border:`5px solid ${palette.ink}`,transform:`rotate(${(i%2?1:-1)*(6+i)}deg)`,opacity:dismantle}}/>)}
      <div style={{position:'absolute',left:430,right:55,top:300,textAlign:'center'}}>
        <RollingNumber delay={8}/>
        <KineticLine text="TONS" color={palette.white} size={94} delay={32}/>
        <KineticLine text="OF IRON" color={palette.gold} size={102} delay={47}/>
      </div>
      <div style={{position:'absolute',left:115,right:115,bottom:235,background:palette.red,border:`11px solid ${palette.ink}`,padding:'28px 34px',fontFamily:'Arial Black,sans-serif',fontSize:64,color:palette.white,textAlign:'center',transform:`rotate(-2deg) scale(${hit})`}}>FOR SALE AS SCRAP</div>
      <div style={{position:'absolute',right:58,bottom:70,fontFamily:'Courier New,monospace',color:palette.paperLight,fontSize:26,letterSpacing:4}}>A NATIONAL LANDMARK — PRICED BY WEIGHT</div>
    </SceneShell>
  );
};

const PaymentScene: React.FC<{duration: number}> = ({duration}) => {
  const frame = useCurrentFrame();
  const {fps}=useVideoConfig();
  const money=spring({frame:Math.max(0,frame-22),fps,config:{damping:10,stiffness:150,mass:0.57}});
  const paid=spring({frame:Math.max(0,frame-50),fps,config:{damping:8,stiffness:210,mass:0.45}});
  const bribe=spring({frame:Math.max(0,frame-77),fps,config:{damping:10,stiffness:170,mass:0.5}});
  const vanish=interpolate(frame,[108,158],[0,1],{...clamp,easing:Easing.in(Easing.cubic)});
  return (
    <SceneShell duration={duration} dark>
      <Sparkles dark count={14}/>
      <FrameNumber text="THE PAYMENT"/>
      <div style={{position:'absolute',left:65,top:155,width:405,height:600,background:palette.paperLight,border:`12px solid ${palette.ink}`,clipPath:'polygon(2% 4%,98% 0,100% 96%,4% 100%)',transform:'rotate(-3deg)',padding:28}}>
        <div style={{fontFamily:'Arial Black,sans-serif',fontSize:50,color:palette.ink}}>ANDRÉ POISSON</div>
        <div style={{fontFamily:'Georgia,serif',fontSize:31,color:palette.ink}}>scrap-metal dealer</div>
        <div style={{marginTop:38,height:310,background:palette.teal,border:`9px solid ${palette.ink}`,display:'grid',placeItems:'center',fontFamily:'Arial Black,sans-serif',fontSize:84,color:palette.ink}}>?</div>
      </div>
      {Array.from({length:6}).map((_,i)=><div key={i} style={{position:'absolute',right:80+(i%3)*105,top:260+Math.floor(i/3)*170,width:260,height:120,background:palette.gold,border:`9px solid ${palette.ink}`,boxShadow:'11px 12px 0 rgba(0,0,0,0.22)',transform:`translateY(${interpolate(money,[0,1],[260,0],clamp)}px) rotate(${(i-3)*3}deg)`,display:'grid',placeItems:'center',fontFamily:'Arial Black,sans-serif',fontSize:42,color:palette.ink}}>CASH</div>)}
      <div style={{position:'absolute',right:105,top:625,width:410,border:`14px double ${palette.red}`,color:palette.red,padding:'28px 22px',fontFamily:'Arial Black,sans-serif',fontSize:83,textAlign:'center',transform:`rotate(-8deg) scale(${paid})`}}>PAID</div>
      <div style={{position:'absolute',left:130,top:840,width:440,background:palette.paperLight,border:`9px solid ${palette.ink}`,padding:'22px 28px',fontFamily:'Arial Black,sans-serif',fontSize:48,color:palette.ink,transform:`rotate(5deg) scale(${bribe})`}}>+ A “PRIVATE FEE”</div>
      <VictorPortrait dark style={{right:-30-vanish*520,top:850,width:420,height:580,opacity:1-vanish*0.72}}/>
      <KineticLine text="THEN HE FLED." color={palette.gold} size={83} delay={105} rotate={-2} style={{position:'absolute',left:90,bottom:155}}/>
    </SceneShell>
  );
};

const SilenceScene: React.FC<{duration:number}> = ({duration}) => {
  const frame=useCurrentFrame();
  const {fps}=useVideoConfig();
  const report=spring({frame,fps,config:{damping:16,stiffness:100,mass:0.8}});
  const ashamed=spring({frame:Math.max(0,frame-46),fps,config:{damping:9,stiffness:195,mass:0.46}});
  const blank=interpolate(frame,[80,115],[0,1],clamp);
  return (
    <SceneShell duration={duration} focusHunt>
      <FrameNumber text="POLICE REPORT"/>
      <TornPaper style={{left:80,top:145,width:920,height:1120,padding:58,transform:`rotate(-1deg) scale(${0.86+report*0.14})`}} fill="#e5d8c1">
        <div style={{fontFamily:'Arial Black,sans-serif',fontSize:76}}>POLICE REPORT</div>
        <div style={{height:7,background:palette.ink,margin:'27px 0'}}/>
        <div style={{fontFamily:'Courier New,monospace',fontSize:40,lineHeight:1.5}}>SUSPECT: VICTOR LUSTIG<br/>VICTIM: ANDRÉ POISSON<br/>COMPLAINT: <span style={{opacity:1-blank}}>NONE</span></div>
        <div style={{position:'absolute',left:100,right:100,bottom:180,height:8,background:palette.ink,opacity:0.22}}/>
        <div style={{position:'absolute',left:100,right:210,bottom:125,height:8,background:palette.ink,opacity:0.22}}/>
      </TornPaper>
      <div style={{position:'absolute',left:145,top:720,width:790,height:260,border:`16px double ${palette.red}`,color:palette.red,display:'grid',placeItems:'center',fontFamily:'Arial Black,sans-serif',fontSize:72,textAlign:'center',transform:`rotate(-7deg) scale(${ashamed})`,background:'rgba(229,216,193,0.82)'}}>TOO ASHAMED<br/>TO REPORT IT</div>
      <div style={{position:'absolute',inset:0,background:'radial-gradient(circle at 50% 48%, transparent 20%, rgba(16,24,32,0.72) 82%)',opacity:interpolate(frame,[35,90],[0,0.55],clamp),pointerEvents:'none'}}/>
    </SceneShell>
  );
};

const FinalScene: React.FC<{duration:number}> = ({duration}) => {
  const frame=useCurrentFrame();
  const {fps}=useVideoConfig();
  const tower=spring({frame,fps,config:{damping:13,stiffness:108,mass:0.72}});
  const returnText=spring({frame:Math.max(0,frame-22),fps,config:{damping:11,stiffness:150,mass:0.55}});
  const again=spring({frame:Math.max(0,frame-64),fps,config:{damping:9,stiffness:190,mass:0.48}});
  const exposed=spring({frame:Math.max(0,frame-105),fps,config:{damping:10,stiffness:170,mass:0.5}});
  const title=interpolate(frame,[128,158],[0,1],clamp);
  const scribble=interpolate(frame,[158,179],[0,1],clamp);
  const flash=interpolate(frame,[103,107,114],[0,0.75,0],clamp);
  return (
    <SceneShell duration={duration} dark focusHunt>
      <Sparkles dark count={24}/>
      <FrameNumber text="SECOND ATTEMPT"/>
      <EiffelTower dark progress={tower} style={{left:340,top:60,width:445,height:900,transformOrigin:'50% 85%'}}/>
      <VictorPortrait dark style={{left:-50,top:680,width:420,height:580}}/>
      <div style={{position:'absolute',left:320,top:845,width:710,background:palette.paperLight,border:`10px solid ${palette.ink}`,padding:'20px 26px',fontFamily:'Arial Black,sans-serif',fontSize:57,color:palette.ink,textAlign:'center',transform:`rotate(3deg) scale(${returnText})`}}>HE CAME BACK TO PARIS</div>
      <div style={{position:'absolute',right:70,top:1070,width:530,background:palette.red,color:palette.white,border:`12px solid ${palette.ink}`,padding:'28px 32px',textAlign:'center',transform:`rotate(-4deg) scale(${again})`,boxShadow:`15px 16px 0 ${palette.gold}`}}>
        <div style={{fontFamily:'Arial Black,sans-serif',fontSize:82,lineHeight:0.9}}>AND TRIED</div>
        <div style={{fontFamily:'Arial Black,sans-serif',fontSize:105,lineHeight:0.9}}>AGAIN.</div>
      </div>
      <div style={{position:'absolute',left:115,top:1120,width:405,height:150,border:`13px double ${palette.gold}`,color:palette.gold,fontFamily:'Arial Black,sans-serif',fontSize:48,display:'grid',placeItems:'center',textAlign:'center',transform:`rotate(9deg) scale(${exposed})`}}>SCAM EXPOSED</div>
      <AbsoluteFill style={{background:palette.white,opacity:flash,mixBlendMode:'screen'}}/>
      <div style={{position:'absolute',left:70,right:70,bottom:115,opacity:title,textAlign:'center'}}>
        <div style={{fontFamily:'Arial Black,sans-serif',fontSize:65,lineHeight:0.95,color:palette.white}}>THE MAN WHO SOLD</div>
        <div style={{fontFamily:'Arial Black,sans-serif',fontSize:78,lineHeight:0.95,color:palette.gold}}>THE EIFFEL TOWER</div>
        <div style={{position:'relative',display:'inline-block',marginTop:9}}>
          <div style={{fontFamily:'Arial Black,sans-serif',fontSize:107,lineHeight:0.9,color:palette.white}}>TWICE</div>
          <ScribbleOval progress={scribble} style={{left:-110,top:-40,width:540,height:170}}/>
        </div>
      </div>
      <div style={{position:'absolute',right:50,bottom:42,fontFamily:'Courier New,monospace',color:palette.white,fontSize:26,letterSpacing:5}}>NEOSANIYE</div>
    </SceneShell>
  );
};
