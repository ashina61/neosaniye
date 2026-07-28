import React from 'react';
import {
  AbsoluteFill,
  Audio,
  interpolate,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {SCENES, TOTAL_FRAMES} from './generated/timing';

const P = {
  black: '#080706',
  charcoal: '#151311',
  bone: '#f0e8d5',
  paper: '#d8cfba',
  red: '#e50914',
  amber: '#d6a85f',
};

const clamp = {
  extrapolateLeft: 'clamp' as const,
  extrapolateRight: 'clamp' as const,
};

const CUTS = [SCENES.explain, SCENES.rotation, SCENES.orbit, SCENES.compare, SCENES.reverse, SCENES.solar];

const textStyle: React.CSSProperties = {
  fontFamily: 'Arial Black, Arial, sans-serif',
  fontWeight: 900,
  textTransform: 'uppercase',
  color: P.bone,
};

const MonoLabel: React.FC<{children: React.ReactNode; style?: React.CSSProperties}> = ({children, style}) => (
  <div
    style={{
      fontFamily: 'Courier New, monospace',
      color: P.paper,
      fontSize: 22,
      letterSpacing: 4,
      fontWeight: 700,
      ...style,
    }}
  >
    {children}
  </div>
);

const FilmTexture: React.FC = () => {
  const frame = useCurrentFrame();
  const weaveX = Math.sin(frame * 0.31) * 1.8;
  const weaveY = Math.cos(frame * 0.23) * 1.2;
  return (
    <AbsoluteFill style={{pointerEvents: 'none', transform: `translate(${weaveX}px, ${weaveY}px)`}}>
      <AbsoluteFill
        style={{
          opacity: 0.16,
          backgroundImage:
            'repeating-linear-gradient(0deg, rgba(255,255,255,.045) 0 1px, transparent 1px 4px)',
          mixBlendMode: 'screen',
        }}
      />
      {Array.from({length: 34}).map((_, index) => (
        <div
          key={index}
          style={{
            position: 'absolute',
            left: (index * 191 + frame * (index % 3 === 0 ? 1.2 : -0.35)) % 1120,
            top: (index * 337 + frame * 0.7) % 1960,
            width: index % 5 === 0 ? 3 : 1,
            height: 18 + ((index * 43) % 150),
            background: index % 7 === 0 ? 'rgba(229,9,20,.22)' : 'rgba(240,232,213,.18)',
            opacity: 0.28 + (index % 4) * 0.08,
          }}
        />
      ))}
      <AbsoluteFill
        style={{
          background:
            'radial-gradient(circle at 50% 46%, transparent 0 46%, rgba(0,0,0,.18) 72%, rgba(0,0,0,.72) 100%)',
        }}
      />
    </AbsoluteFill>
  );
};

const WayfinderGrid: React.FC<{opacity?: number}> = ({opacity = 0.22}) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{opacity, overflow: 'hidden'}}>
      <div
        style={{
          position: 'absolute',
          inset: -240,
          backgroundImage:
            'linear-gradient(rgba(240,232,213,.18) 1px, transparent 1px), linear-gradient(90deg, rgba(240,232,213,.18) 1px, transparent 1px)',
          backgroundSize: '96px 96px',
          transform: `perspective(900px) rotateX(63deg) translateY(${430 + frame * 0.35}px) scale(1.35)`,
          transformOrigin: '50% 65%',
        }}
      />
      <div style={{position: 'absolute', left: 80, top: 180, width: 2, height: 1180, background: P.red}} />
      <div style={{position: 'absolute', left: 62, top: 180, width: 38, height: 2, background: P.red}} />
      <div style={{position: 'absolute', left: 62, top: 1360, width: 38, height: 2, background: P.red}} />
    </AbsoluteFill>
  );
};

const Header: React.FC<{chapter: string; code: string}> = ({chapter, code}) => (
  <>
    <div style={{position: 'absolute', top: 58, left: 64, ...textStyle, fontSize: 26, letterSpacing: 7}}>
      NEO<span style={{color: P.red}}>SANIYE</span>
    </div>
    <MonoLabel style={{position: 'absolute', top: 62, right: 64, textAlign: 'right'}}>{code}</MonoLabel>
    <div style={{position: 'absolute', top: 112, left: 64, right: 64, height: 2, background: 'rgba(240,232,213,.32)'}} />
    <MonoLabel style={{position: 'absolute', top: 134, left: 64, color: P.amber}}>{chapter}</MonoLabel>
  </>
);

const Planet: React.FC<{size: number; left: number; top: number; spin?: number; muted?: boolean}> = ({
  size,
  left,
  top,
  spin = -0.08,
  muted = false,
}) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        position: 'absolute',
        left,
        top,
        width: size,
        height: size,
        borderRadius: '50%',
        overflow: 'hidden',
        background: muted
          ? 'radial-gradient(circle at 32% 24%, #ddd4c0 0 7%, #857d70 44%, #25211d 100%)'
          : 'radial-gradient(circle at 31% 24%, #fff1b2 0 6%, #d6a85f 28%, #8d3d2b 63%, #32171a 100%)',
        boxShadow: `0 0 0 5px rgba(240,232,213,.65), 0 0 80px ${muted ? 'rgba(240,232,213,.18)' : 'rgba(229,9,20,.26)'}, inset -42px -28px 72px rgba(0,0,0,.58)`,
        transform: `rotate(${frame * spin}deg)`,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: -80,
          transform: `translateX(${((frame * 1.1) % (size + 200)) - size}px) rotate(-13deg)`,
          background:
            'repeating-linear-gradient(10deg, transparent 0 28px, rgba(240,232,213,.19) 31px 46px, transparent 49px 78px)',
          filter: 'blur(6px)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.22,
          backgroundImage: 'radial-gradient(circle, rgba(8,7,6,.9) 0 1.4px, transparent 1.6px)',
          backgroundSize: '12px 12px',
          mixBlendMode: 'multiply',
        }}
      />
    </div>
  );
};

const PathLine: React.FC<{progress: number; top: number; left?: number; width?: number}> = ({progress, top, left = 120, width = 840}) => (
  <div style={{position: 'absolute', left, top, width, height: 72}}>
    <div style={{position: 'absolute', left: 0, right: 0, top: 34, height: 2, background: 'rgba(240,232,213,.28)'}} />
    <div style={{position: 'absolute', left: 0, top: 31, width: `${progress * 100}%`, height: 8, background: P.red}} />
    <div
      style={{
        position: 'absolute',
        left: `calc(${progress * 100}% - 18px)`,
        top: 18,
        width: 36,
        height: 36,
        transform: 'rotate(45deg)',
        background: P.bone,
        border: `7px solid ${P.red}`,
      }}
    />
  </div>
);

const BigNumber: React.FC<{value: string; label: string; progress: number; align?: 'left' | 'right'}> = ({
  value,
  label,
  progress,
  align = 'left',
}) => (
  <div
    style={{
      position: 'absolute',
      top: 620,
      left: align === 'left' ? 78 : 420,
      width: 590,
      textAlign: align,
      transform: `translateY(${(1 - progress) * 55}px)`,
      opacity: progress,
    }}
  >
    <div style={{...textStyle, fontSize: 245, lineHeight: 0.76, letterSpacing: -18}}>{value}</div>
    <MonoLabel style={{marginTop: 42, color: P.amber, fontSize: 25}}>{label}</MonoLabel>
  </div>
);

const Compass: React.FC<{progress: number}> = ({progress}) => {
  const frame = useCurrentFrame();
  return (
    <div style={{position: 'absolute', left: 190, top: 330, width: 700, height: 700}}>
      {[0, 1, 2].map((ring) => (
        <div
          key={ring}
          style={{
            position: 'absolute',
            inset: 55 + ring * 70,
            borderRadius: '50%',
            border: `${ring === 0 ? 4 : 2}px solid rgba(240,232,213,${0.55 - ring * 0.12})`,
          }}
        />
      ))}
      {Array.from({length: 24}).map((_, index) => {
        const angle = (index / 24) * Math.PI * 2;
        const radius = 325;
        return (
          <div
            key={index}
            style={{
              position: 'absolute',
              left: 350 + Math.cos(angle) * radius,
              top: 350 + Math.sin(angle) * radius,
              width: index % 6 === 0 ? 34 : 18,
              height: 3,
              background: index % 6 === 0 ? P.red : P.bone,
              transform: `rotate(${(angle * 180) / Math.PI}deg)`,
              transformOrigin: '0 50%',
            }}
          />
        );
      })}
      <div
        style={{
          position: 'absolute',
          left: 340,
          top: 110,
          width: 20,
          height: 480,
          background: `linear-gradient(${P.red} 0 50%, ${P.bone} 50%)`,
          clipPath: 'polygon(50% 0, 100% 50%, 62% 50%, 62% 100%, 38% 100%, 38% 50%, 0 50%)',
          transform: `rotate(${interpolate(progress, [0, 1], [0, -180], clamp) + Math.sin(frame * 0.04) * 2}deg)`,
          transformOrigin: '50% 50%',
        }}
      />
      <div style={{position: 'absolute', left: 322, top: 322, width: 56, height: 56, borderRadius: '50%', background: P.red, border: `8px solid ${P.bone}`}} />
    </div>
  );
};

const TransitionFX: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{pointerEvents: 'none', zIndex: 50}}>
      {CUTS.map((cut, index) => {
        const local = frame - cut;
        if (local < -9 || local > 12) return null;
        const p = interpolate(local, [-9, 0, 12], [0, 1, 0], clamp);
        if (index % 3 === 0) {
          return (
            <React.Fragment key={cut}>
              <div style={{position: 'absolute', top: 0, bottom: 0, left: interpolate(local, [-9, 12], [-420, 1150], clamp), width: 360, background: P.red, transform: 'skewX(-12deg)', opacity: p}} />
              <AbsoluteFill style={{background: P.bone, opacity: p * 0.15, mixBlendMode: 'screen'}} />
            </React.Fragment>
          );
        }
        if (index % 3 === 1) {
          return (
            <React.Fragment key={cut}>
              {Array.from({length: 7}).map((_, row) => (
                <div
                  key={row}
                  style={{
                    position: 'absolute',
                    left: row % 2 === 0 ? 0 : 'auto',
                    right: row % 2 === 0 ? 'auto' : 0,
                    top: row * 275,
                    width: `${p * 88}%`,
                    height: 190,
                    background: row % 2 === 0 ? P.bone : P.red,
                  }}
                />
              ))}
            </React.Fragment>
          );
        }
        const shutter = interpolate(local, [-9, 1, 12], [0, 1, 0], clamp);
        return (
          <React.Fragment key={cut}>
            <div style={{position: 'absolute', left: 0, right: 0, top: 0, height: `${shutter * 51}%`, background: P.black}} />
            <div style={{position: 'absolute', left: 0, right: 0, bottom: 0, height: `${shutter * 51}%`, background: P.black}} />
            <AbsoluteFill style={{background: P.red, opacity: p * 0.12}} />
          </React.Fragment>
        );
      })}
    </AbsoluteFill>
  );
};

const Scene: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const markers = [SCENES.hook, SCENES.explain, SCENES.rotation, SCENES.orbit, SCENES.compare, SCENES.reverse, SCENES.solar, TOTAL_FRAMES];
  let index = 0;
  while (index < markers.length - 2 && frame >= markers[index + 1]) index += 1;
  const start = markers[index];
  const end = markers[index + 1];
  const local = frame - start;
  const duration = Math.max(1, end - start);
  const enter = spring({frame: local, fps, config: {damping: 16, stiffness: 92, mass: 0.8}});
  const exit = interpolate(local, [duration - 10, duration], [1, 0], clamp);
  const opacity = Math.min(enter, exit);
  const camera = interpolate(local, [0, duration], [1.045, 1], clamp);
  const base: React.CSSProperties = {
    opacity,
    transform: `scale(${camera}) translate(${Math.sin(local * 0.018 + index) * 5}px, ${Math.cos(local * 0.015 + index) * 4}px)`,
  };

  if (index === 0) {
    const slash = interpolate(local, [4, 35], [-140, 740], clamp);
    return (
      <AbsoluteFill style={base}>
        <Header chapter="FILE 01 / VENUS" code="COORD 03.3947°N" />
        <WayfinderGrid opacity={0.2} />
        <Planet size={720} left={520} top={210} spin={-0.05} />
        <div style={{position: 'absolute', left: 70, top: 385, width: 790}}>
          <div style={{...textStyle, fontSize: 116, lineHeight: 0.82, letterSpacing: -6}}>A DAY</div>
          <div style={{...textStyle, fontSize: 116, lineHeight: 0.82, letterSpacing: -6}}>OUTLIVES</div>
          <div style={{...textStyle, fontSize: 116, lineHeight: 0.82, letterSpacing: -6}}>A YEAR</div>
          <MonoLabel style={{marginTop: 50, color: P.amber}}>VENUS / TEMPORAL ANOMALY</MonoLabel>
        </div>
        <div style={{position: 'absolute', left: slash, top: 270, width: 120, height: 1120, background: P.red, transform: 'rotate(12deg)', mixBlendMode: 'screen', opacity: 0.9}} />
        <div style={{position: 'absolute', left: 68, top: 1185, width: 760, height: 2, background: P.bone}} />
        <MonoLabel style={{position: 'absolute', left: 68, top: 1220}}>243 / 225 / 117</MonoLabel>
      </AbsoluteFill>
    );
  }

  if (index === 1) {
    const path = interpolate(local, [5, duration - 18], [0, 1], clamp);
    return (
      <AbsoluteFill style={base}>
        <Header chapter="TWO CLOCKS / ONE PLANET" code="MAP 02" />
        <WayfinderGrid opacity={0.12} />
        <div style={{position: 'absolute', left: 74, top: 300, width: 420, height: 770, border: '2px solid rgba(240,232,213,.45)', background: 'rgba(21,19,17,.78)', padding: 42}}>
          <MonoLabel style={{color: P.red}}>A / ROTATION</MonoLabel>
          <Planet size={330} left={44} top={120} spin={-0.12} muted />
          <div style={{position: 'absolute', left: 42, right: 42, bottom: 62, ...textStyle, fontSize: 47, lineHeight: 1.02}}>ON ITS AXIS</div>
        </div>
        <div style={{position: 'absolute', right: 74, top: 300, width: 420, height: 770, border: '2px solid rgba(240,232,213,.45)', background: 'rgba(21,19,17,.78)', padding: 42}}>
          <MonoLabel style={{color: P.amber}}>B / ORBIT</MonoLabel>
          <div style={{position: 'absolute', left: 44, top: 138, width: 320, height: 320, borderRadius: '50%', border: `3px dashed ${P.amber}`, transform: `rotate(${local * 0.18}deg)`}} />
          <div style={{position: 'absolute', left: 152, top: 246, width: 105, height: 105, borderRadius: '50%', background: P.bone, boxShadow: `0 0 45px ${P.amber}`}} />
          <Planet size={68} left={312} top={260} spin={-0.2} />
          <div style={{position: 'absolute', left: 42, right: 42, bottom: 62, ...textStyle, fontSize: 47, lineHeight: 1.02}}>AROUND THE SUN</div>
        </div>
        <PathLine progress={path} top={1160} />
        <MonoLabel style={{position: 'absolute', left: 120, top: 1260, color: P.paper}}>THESE CLOCKS DO NOT AGREE</MonoLabel>
      </AbsoluteFill>
    );
  }

  if (index === 2) {
    const p = interpolate(local, [3, 50], [0, 1], clamp);
    const ticks = Math.round(interpolate(local, [0, 62], [0, 243], clamp));
    return (
      <AbsoluteFill style={base}>
        <Header chapter="ROTATION PERIOD" code="AXIS / 243" />
        <WayfinderGrid opacity={0.1} />
        <Planet size={760} left={460} top={260} spin={-0.035} muted />
        <BigNumber value={String(ticks)} label="EARTH DAYS / ONE FULL TURN" progress={p} />
        <div style={{position: 'absolute', left: 76, top: 1035, width: 760, height: 3, background: 'rgba(240,232,213,.3)'}}>
          <div style={{width: `${p * 100}%`, height: 9, marginTop: -3, background: P.red}} />
        </div>
        <MonoLabel style={{position: 'absolute', left: 76, top: 1080}}>SLOWER THAN THE CALENDAR</MonoLabel>
      </AbsoluteFill>
    );
  }

  if (index === 3) {
    const orbit = interpolate(local, [0, duration - 12], [0, Math.PI * 2], clamp);
    const count = Math.round(interpolate(local, [0, 58], [0, 225], clamp));
    return (
      <AbsoluteFill style={base}>
        <Header chapter="ORBITAL YEAR" code="SUN / 225" />
        <div style={{position: 'absolute', left: 115, top: 280, width: 850, height: 690, border: '2px solid rgba(240,232,213,.45)', borderRadius: '50%', transform: 'rotate(-8deg)'}} />
        <div style={{position: 'absolute', left: 440, top: 515, width: 200, height: 200, borderRadius: '50%', background: P.bone, boxShadow: `0 0 90px ${P.amber}`}} />
        <Planet size={116} left={540 + Math.cos(orbit) * 380 - 58} top={625 + Math.sin(orbit) * 280 - 58} spin={-0.22} />
        <div style={{position: 'absolute', left: 82, top: 1060, ...textStyle, fontSize: 220, lineHeight: 0.8, letterSpacing: -16}}>{count}</div>
        <MonoLabel style={{position: 'absolute', left: 92, top: 1260, color: P.amber}}>EARTH DAYS / ONE YEAR</MonoLabel>
        <div style={{position: 'absolute', right: 76, top: 1080, width: 250, height: 250, border: `2px solid ${P.red}`, transform: `rotate(${local * 0.7}deg)`}} />
      </AbsoluteFill>
    );
  }

  if (index === 4) {
    const split = interpolate(local, [0, 24], [0, 1], clamp);
    return (
      <AbsoluteFill style={base}>
        <Header chapter="THE CONTRADICTION" code="243 > 225" />
        <div style={{position: 'absolute', left: 0, top: 240, width: 540, height: 960, background: P.bone, transform: `translateX(${(1 - split) * -560}px)`}}>
          <div style={{position: 'absolute', left: 68, top: 170, ...textStyle, color: P.black, fontSize: 188, letterSpacing: -14}}>243</div>
          <MonoLabel style={{position: 'absolute', left: 74, top: 390, color: P.red}}>ROTATION</MonoLabel>
          <div style={{position: 'absolute', left: 70, top: 520, width: 360, height: 2, background: P.black}} />
          <div style={{position: 'absolute', left: 70, top: 575, ...textStyle, color: P.black, fontSize: 50}}>DAY</div>
        </div>
        <div style={{position: 'absolute', right: 0, top: 240, width: 540, height: 960, background: P.red, transform: `translateX(${(1 - split) * 560}px)`}}>
          <div style={{position: 'absolute', right: 68, top: 170, ...textStyle, color: P.bone, fontSize: 188, letterSpacing: -14, textAlign: 'right'}}>225</div>
          <MonoLabel style={{position: 'absolute', right: 74, top: 390, color: P.bone, textAlign: 'right'}}>YEAR</MonoLabel>
          <div style={{position: 'absolute', right: 70, top: 520, width: 360, height: 2, background: P.bone}} />
          <div style={{position: 'absolute', right: 70, top: 575, ...textStyle, color: P.bone, fontSize: 50, textAlign: 'right'}}>ORBIT</div>
        </div>
        <div style={{position: 'absolute', left: 82, right: 82, top: 1310, ...textStyle, fontSize: 76, lineHeight: 0.92}}>THE YEAR ENDS<br /><span style={{color: P.red}}>BEFORE THE TURN</span></div>
      </AbsoluteFill>
    );
  }

  if (index === 5) {
    const p = interpolate(local, [8, duration - 14], [0, 1], clamp);
    return (
      <AbsoluteFill style={base}>
        <Header chapter="RETROGRADE SPIN" code="WEST / EAST" />
        <Compass progress={p} />
        <div style={{position: 'absolute', left: 70, top: 1090, ...textStyle, fontSize: 95, lineHeight: 0.82}}>WEST</div>
        <div style={{position: 'absolute', right: 70, top: 1090, ...textStyle, fontSize: 95, lineHeight: 0.82, textAlign: 'right'}}>EAST</div>
        <div style={{position: 'absolute', left: 70, right: 70, top: 1240, height: 2, background: P.bone}} />
        <MonoLabel style={{position: 'absolute', left: 70, top: 1280, color: P.red}}>THE SUN APPEARS TO RISE IN THE WEST</MonoLabel>
      </AbsoluteFill>
    );
  }

  const p = interpolate(local, [2, 52], [0, 1], clamp);
  const count = Math.round(interpolate(local, [0, 54], [0, 117], clamp));
  const ring = interpolate(local, [0, duration - 12], [0, 360], clamp);
  return (
    <AbsoluteFill style={base}>
      <Header chapter="SUNRISE TO SUNRISE" code="SOLAR DAY / 117" />
      <div style={{position: 'absolute', left: 150, top: 270, width: 780, height: 780, borderRadius: '50%', background: `conic-gradient(${P.red} 0deg ${ring}deg, rgba(240,232,213,.16) ${ring}deg 360deg)`, display: 'grid', placeItems: 'center'}}>
        <div style={{position: 'relative', width: 660, height: 660, borderRadius: '50%', background: P.black, border: '2px solid rgba(240,232,213,.4)', display: 'grid', placeItems: 'center'}}>
          <Planet size={410} left={125} top={125} spin={-0.045} />
        </div>
      </div>
      <BigNumber value={String(count)} label="EARTH DAYS / SUNRISE TO SUNRISE" progress={p} align="right" />
      <div style={{position: 'absolute', left: 70, right: 70, top: 1330, ...textStyle, fontSize: 69, lineHeight: 0.9}}>
        ON VENUS,<br /><span style={{color: P.red}}>TIME LOSES.</span>
      </div>
    </AbsoluteFill>
  );
};

const AudioBed: React.FC = () => (
  <>
    <Audio src={staticFile('audio/voice.mp3')} volume={0.98} />
    <Audio src={staticFile('audio/music.wav')} volume={0.17} />
    <Sequence from={0} durationInFrames={50}><Audio src={staticFile('audio/impact.wav')} volume={0.5} /></Sequence>
    {CUTS.map((cut, index) => {
      const sounds = ['whoosh-a.wav', 'swipe.wav', 'sub-hit.wav', 'reverse.wav', 'glitch.wav', 'riser.wav'];
      return (
        <Sequence key={cut} from={Math.max(0, cut - 5)} durationInFrames={65}>
          <Audio src={staticFile(`audio/${sounds[index]}`)} volume={index === 4 ? 0.32 : 0.42} />
        </Sequence>
      );
    })}
    <Sequence from={Math.max(0, SCENES.solar + 12)} durationInFrames={80}>
      <Audio src={staticFile('audio/chime.wav')} volume={0.34} />
    </Sequence>
  </>
);

export const VenusShort: React.FC = () => (
  <AbsoluteFill style={{background: P.black, overflow: 'hidden'}}>
    <WayfinderGrid opacity={0.05} />
    <Scene />
    <TransitionFX />
    <FilmTexture />
    <AudioBed />
  </AbsoluteFill>
);
