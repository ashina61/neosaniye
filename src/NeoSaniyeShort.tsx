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
import {TOPIC} from './generated/topic';
import {CUES, SCENE_STARTS, TOTAL_FRAMES} from './generated/timing';

const clamp = {
  extrapolateLeft: 'clamp' as const,
  extrapolateRight: 'clamp' as const,
};

const cuts = SCENE_STARTS.slice(1);

const Stars: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{background: 'radial-gradient(circle at 50% 18%, #182044, #070914 68%)'}}>
      {Array.from({length: 78}).map((_, index) => {
        const size = 2 + ((index * 7) % 8);
        const pulse = 0.24 + 0.76 * Math.abs(Math.sin(frame * 0.025 + index * 1.73));
        return (
          <div
            key={index}
            style={{
              position: 'absolute',
              left: (index * 149 + 43) % 1080,
              top: (index * 277 + 91) % 1920,
              width: size,
              height: size,
              borderRadius: '50%',
              background: index % 7 === 0 ? TOPIC.secondary : '#ffffff',
              opacity: pulse,
              boxShadow: size > 6 ? `0 0 18px ${TOPIC.secondary}` : undefined,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

const Header: React.FC = () => (
  <div
    style={{
      position: 'absolute',
      top: 58,
      left: 62,
      right: 62,
      zIndex: 20,
      display: 'flex',
      justifyContent: 'space-between',
      color: '#ffffff',
      fontFamily: 'Arial, sans-serif',
      fontWeight: 900,
      letterSpacing: 5,
      fontSize: 28,
    }}
  >
    <span>NEOSANIYE</span>
    <span style={{fontSize: 21, opacity: 0.7}}>{TOPIC.kicker}</span>
  </div>
);

const Planet: React.FC<{rings?: boolean; mercury?: boolean}> = ({rings = false, mercury = false}) => {
  const frame = useCurrentFrame();
  return (
    <div style={{position: 'relative', width: 590, height: 590}}>
      {rings ? (
        <div
          style={{
            position: 'absolute',
            left: -90,
            top: 220,
            width: 770,
            height: 145,
            border: `25px solid ${TOPIC.secondary}`,
            borderRadius: '50%',
            opacity: 0.72,
            transform: `rotate(-14deg) scaleX(${1 + Math.sin(frame * 0.02) * 0.02})`,
          }}
        />
      ) : null}
      <div
        style={{
          position: 'absolute',
          inset: 45,
          borderRadius: '50%',
          overflow: 'hidden',
          background: mercury
            ? 'radial-gradient(circle at 32% 25%, #e4e0d5, #8e8b85 62%, #3b3a40)'
            : `radial-gradient(circle at 30% 25%, #fff4b0 0 7%, ${TOPIC.accent} 32%, #7d2940 100%)`,
          border: '7px solid rgba(255,255,255,.58)',
          boxShadow: `0 0 65px ${TOPIC.accent}88, inset -44px -28px 75px rgba(0,0,0,.52)`,
          transform: `rotate(${frame * -0.08}deg)`,
        }}
      >
        {Array.from({length: 7}).map((_, index) => (
          <div
            key={index}
            style={{
              position: 'absolute',
              left: `${8 + index * 13}%`,
              top: `${12 + ((index * 19) % 60)}%`,
              width: 42 + (index % 3) * 25,
              height: 22 + (index % 2) * 18,
              borderRadius: '50%',
              background: 'rgba(255,255,255,.14)',
              filter: 'blur(5px)',
            }}
          />
        ))}
      </div>
    </div>
  );
};

const MoonVisual: React.FC = () => (
  <div style={{position: 'relative', width: 620, height: 620}}>
    <div
      style={{
        position: 'absolute',
        inset: 45,
        borderRadius: '50%',
        background: 'radial-gradient(circle at 30% 24%, #f4f1e8, #aaa79c 65%, #5e6069)',
        border: '7px solid rgba(255,255,255,.55)',
        boxShadow: '0 0 70px rgba(220,220,210,.35)',
      }}
    >
      {[{x: 95, y: 120, s: 68}, {x: 310, y: 90, s: 45}, {x: 345, y: 300, s: 82}, {x: 150, y: 350, s: 52}].map(
        (crater, index) => (
          <div
            key={index}
            style={{
              position: 'absolute',
              left: crater.x,
              top: crater.y,
              width: crater.s,
              height: crater.s,
              borderRadius: '50%',
              background: 'rgba(55,55,62,.24)',
              boxShadow: 'inset 8px 9px 14px rgba(0,0,0,.24)',
            }}
          />
        ),
      )}
      {[0, 1, 2, 3].map((index) => (
        <div
          key={index}
          style={{
            position: 'absolute',
            left: 120 + index * 72,
            top: 390 - index * 26,
            width: 32,
            height: 54,
            borderRadius: '48% 48% 42% 42%',
            border: '5px solid rgba(255,255,255,.65)',
            transform: `rotate(${-20 + index * 7}deg)`,
          }}
        />
      ))}
    </div>
  </div>
);

const OceanVisual: React.FC<{kind: 'shark' | 'octopus' | 'whale'}> = ({kind}) => {
  const frame = useCurrentFrame();
  return (
    <div style={{position: 'relative', width: 800, height: 560, overflow: 'hidden'}}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 60,
          background: 'linear-gradient(180deg, rgba(104,231,255,.35), rgba(2,28,60,.92))',
          border: '5px solid rgba(255,255,255,.22)',
        }}
      />
      {Array.from({length: 6}).map((_, index) => (
        <div
          key={index}
          style={{
            position: 'absolute',
            left: -120 + ((frame * (1.2 + index * 0.1) + index * 190) % 980),
            top: 80 + index * 74,
            width: 260,
            height: 18,
            borderRadius: '50%',
            background: 'rgba(255,255,255,.12)',
            transform: `rotate(${index % 2 ? -4 : 4}deg)`,
          }}
        />
      ))}
      {kind === 'shark' ? (
        <svg viewBox="0 0 700 280" style={{position: 'absolute', left: 60, top: 130, width: 680}}>
          <path d="M70 150 C180 45 470 40 600 135 C535 170 420 205 250 205 C160 205 105 185 70 150 Z" fill="#07101d" />
          <path d="M580 135 L680 70 L650 155 L680 235 Z" fill="#07101d" />
          <path d="M315 72 L370 8 L405 85 Z" fill="#07101d" />
          <circle cx="170" cy="125" r="8" fill="#ffffff" />
        </svg>
      ) : null}
      {kind === 'octopus' ? (
        <svg viewBox="0 0 500 500" style={{position: 'absolute', left: 170, top: 35, width: 470}}>
          <ellipse cx="250" cy="180" rx="135" ry="150" fill="#441638" stroke="#ffffff" strokeWidth="8" />
          {[0, 1, 2, 3, 4, 5, 6, 7].map((index) => {
            const x = 105 + index * 42;
            return <path key={index} d={`M${x} 275 C${x - 55} 360 ${x + 70} 400 ${x + (index % 2 ? 20 : -35)} 485`} fill="none" stroke="#441638" strokeWidth="34" strokeLinecap="round" />;
          })}
          <circle cx="205" cy="170" r="12" fill="#ffffff" />
          <circle cx="295" cy="170" r="12" fill="#ffffff" />
        </svg>
      ) : null}
      {kind === 'whale' ? (
        <svg viewBox="0 0 750 320" style={{position: 'absolute', left: 30, top: 115, width: 730}}>
          <path d="M80 180 C180 65 500 55 635 150 C585 245 260 270 110 215 Z" fill="#0b223d" stroke="#ffffff" strokeWidth="7" />
          <path d="M620 155 C690 80 735 80 700 175 C735 250 680 250 620 190 Z" fill="#0b223d" />
          <path d="M255 235 C290 305 350 290 372 230" fill="#0b223d" />
          <circle cx="175" cy="160" r="9" fill="#ffffff" />
        </svg>
      ) : null}
    </div>
  );
};

const TowerVisual: React.FC = () => (
  <svg viewBox="0 0 420 850" style={{width: 400, height: 810, filter: `drop-shadow(0 0 28px ${TOPIC.accent}77)`}}>
    <path d="M205 24 L153 315 L95 680 L35 807 M215 24 L267 315 L325 680 L385 807" fill="none" stroke="#ffffff" strokeWidth="28" strokeLinecap="round" />
    <path d="M159 305 L261 305 M117 540 L303 540 M62 705 L358 705 M34 807 L386 807" stroke={TOPIC.accent} strokeWidth="24" strokeLinecap="round" />
    <path d="M98 680 C130 625 290 625 322 680" fill="none" stroke="#ffffff" strokeWidth="25" />
  </svg>
);

const TimelineVisual: React.FC = () => (
  <div style={{position: 'relative', width: 860, height: 560}}>
    <div style={{position: 'absolute', left: 40, right: 40, top: 270, height: 14, background: '#ffffff', borderRadius: 20}} />
    {[
      {x: 60, label: 'PYRAMID', icon: '△'},
      {x: 390, label: 'CLEOPATRA', icon: '♛'},
      {x: 710, label: 'MOON', icon: '●'},
    ].map((item, index) => (
      <div key={item.label} style={{position: 'absolute', left: item.x, top: 140 + (index % 2) * 170, width: 150, textAlign: 'center', color: '#ffffff', fontFamily: 'Arial Black, Arial'}}>
        <div style={{fontSize: 86, color: index === 1 ? TOPIC.accent : TOPIC.secondary}}>{item.icon}</div>
        <div style={{fontSize: 22, letterSpacing: 2}}>{item.label}</div>
        <div style={{position: 'absolute', left: 68, top: index % 2 ? -45 : 128, width: 14, height: 70, background: '#ffffff'}} />
      </div>
    ))}
  </div>
);

const StormVisual: React.FC = () => {
  const frame = useCurrentFrame();
  const flash = Math.max(0, Math.sin(frame * 0.32)) ** 14;
  return (
    <div style={{position: 'relative', width: 760, height: 700}}>
      <div style={{position: 'absolute', left: 80, top: 40, width: 600, height: 230, borderRadius: '50%', background: '#252b45', boxShadow: '0 80px 0 -20px #252b45'}} />
      <svg viewBox="0 0 400 550" style={{position: 'absolute', left: 180, top: 170, width: 400, filter: `drop-shadow(0 0 ${30 + flash * 60}px #ffffff)`}}>
        <path d="M235 5 L80 300 L195 285 L120 545 L330 225 L210 245 Z" fill={TOPIC.accent} stroke="#ffffff" strokeWidth="12" />
      </svg>
      <div style={{position: 'absolute', inset: 0, background: '#ffffff', opacity: flash * 0.35, borderRadius: 60}} />
    </div>
  );
};

const SilenceVisual: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <div style={{position: 'relative', width: 800, height: 600}}>
      <div style={{position: 'absolute', left: 100, top: 145, width: 180, height: 300, borderRadius: '55% 55% 45% 45%', background: '#d7dbe7', border: '8px solid #ffffff'}} />
      {[0, 1, 2, 3].map((index) => (
        <div
          key={index}
          style={{
            position: 'absolute',
            left: 330 + index * 85,
            top: 300 - (70 + index * 34) / 2,
            width: 18,
            height: 70 + index * 34,
            border: `8px solid ${TOPIC.secondary}`,
            borderLeft: 0,
            borderRadius: '0 100% 100% 0',
            opacity: 0.22 + 0.12 * Math.sin(frame * 0.08 + index),
          }}
        />
      ))}
      <div style={{position: 'absolute', left: 280, top: 275, width: 430, height: 24, background: TOPIC.accent, transform: 'rotate(-36deg)', boxShadow: '0 0 25px rgba(255,255,255,.4)'}} />
    </div>
  );
};

const VolcanoVisual: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <div style={{position: 'relative', width: 820, height: 680}}>
      <svg viewBox="0 0 800 650" style={{width: 800, height: 650}}>
        <path d="M60 620 L285 190 L360 250 L420 110 L500 250 L560 190 L750 620 Z" fill="#6d2d31" stroke="#ffffff" strokeWidth="9" />
        <path d="M355 245 L420 110 L488 245 L450 290 L390 290 Z" fill={TOPIC.accent} />
        <path d="M420 110 C350 25 510 25 440 110" fill="none" stroke="#d9d9d9" strokeWidth="34" opacity={0.45 + 0.2 * Math.sin(frame * 0.05)} />
      </svg>
    </div>
  );
};

const StationVisual: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <div style={{position: 'relative', width: 850, height: 560, transform: `rotate(${Math.sin(frame * 0.03) * 2}deg)`}}>
      <div style={{position: 'absolute', left: 335, top: 205, width: 180, height: 150, background: '#dfe5ee', border: '8px solid #ffffff'}} />
      {[40, 555].map((left) => (
        <div key={left} style={{position: 'absolute', left, top: 165, width: 260, height: 230, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, background: '#0e264c', border: `8px solid ${TOPIC.secondary}`, padding: 10}}>
          {Array.from({length: 16}).map((_, index) => <div key={index} style={{background: '#2b65a7'}} />)}
        </div>
      ))}
      <div style={{position: 'absolute', left: 250, top: 270, width: 350, height: 18, background: '#ffffff'}} />
    </div>
  );
};

const NeutronVisual: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <div style={{position: 'relative', width: 700, height: 700}}>
      {[0, 1, 2].map((index) => (
        <div
          key={index}
          style={{
            position: 'absolute',
            left: 70 + index * 45,
            top: 265 - index * 45,
            width: 560 - index * 90,
            height: 170 + index * 90,
            border: `8px solid ${index === 1 ? TOPIC.secondary : TOPIC.accent}`,
            borderRadius: '50%',
            transform: `rotate(${frame * (index % 2 ? -0.9 : 0.7) + index * 55}deg)`,
            opacity: 0.68,
          }}
        />
      ))}
      <div style={{position: 'absolute', left: 210, top: 210, width: 280, height: 280, borderRadius: '50%', background: 'radial-gradient(circle, #ffffff, #b388ff 35%, #26194c 75%)', boxShadow: '0 0 90px #b388ffaa'}} />
    </div>
  );
};

const IceVisual: React.FC = () => (
  <div style={{position: 'relative', width: 820, height: 650}}>
    <div style={{position: 'absolute', left: 0, right: 0, top: 430, height: 160, background: 'linear-gradient(180deg, #68e7ff55, #0b3158)', borderRadius: 40}} />
    <svg viewBox="0 0 700 600" style={{position: 'absolute', left: 60, top: 20, width: 700}}>
      <path d="M80 430 L260 70 L355 225 L430 140 L620 430 Z" fill="#d9f5ff" stroke="#ffffff" strokeWidth="10" />
      <path d="M80 430 L620 430 L540 570 L170 570 Z" fill="#73bfd9" opacity=".72" />
    </svg>
  </div>
);

const WallVisual: React.FC = () => (
  <div style={{position: 'relative', width: 850, height: 570, transform: 'perspective(900px) rotateX(7deg) rotateY(-10deg)'}}>
    {Array.from({length: 6}).map((_, row) =>
      Array.from({length: 7}).map((__, column) => (
        <div
          key={`${row}-${column}`}
          style={{
            position: 'absolute',
            left: 30 + column * 110 + (row % 2) * 55,
            top: 80 + row * 70,
            width: 105,
            height: 62,
            background: row % 2 ? '#8a6945' : '#9e7b52',
            border: '4px solid #30251b',
            boxShadow: 'inset 0 0 12px rgba(255,255,255,.12)',
          }}
        />
      )),
    )}
  </div>
);

const RadiationVisual: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <div style={{position: 'relative', width: 720, height: 650}}>
      {[0, 1, 2].map((index) => (
        <div key={index} style={{position: 'absolute', left: 125 - index * 45, top: 90 - index * 45, width: 470 + index * 90, height: 470 + index * 90, borderRadius: '50%', border: `6px dashed ${TOPIC.secondary}`, transform: `rotate(${frame * (index % 2 ? -0.7 : 0.8)}deg)`, opacity: 0.35}} />
      ))}
      <div style={{position: 'absolute', left: 215, top: 145, width: 260, height: 360, borderRadius: '70% 25% 65% 30%', border: `70px solid ${TOPIC.accent}`, borderTopColor: 'transparent', borderRightColor: 'transparent', transform: 'rotate(-28deg)', filter: 'drop-shadow(0 0 25px rgba(255,255,255,.35))'}} />
    </div>
  );
};

const CoreVisual: React.FC = () => (
  <div style={{position: 'relative', width: 650, height: 650}}>
    {[
      {inset: 20, color: '#2878b8'},
      {inset: 85, color: '#7a3d28'},
      {inset: 155, color: '#ff7043'},
      {inset: 230, color: '#ffd45c'},
    ].map((layer, index) => (
      <div key={index} style={{position: 'absolute', inset: layer.inset, borderRadius: '50%', background: layer.color, border: '6px solid rgba(255,255,255,.45)', boxShadow: index === 3 ? '0 0 60px #ffd45caa' : undefined}} />
    ))}
  </div>
);

const EarthVisual: React.FC = () => (
  <div style={{position: 'relative', width: 650, height: 620}}>
    <div style={{position: 'absolute', left: 45, top: 60, width: 560, height: 510, borderRadius: '50%', background: 'radial-gradient(circle at 35% 28%, #68e7ff, #1c5791 68%, #082141)', border: '8px solid #ffffff', boxShadow: '0 0 70px #68e7ff55'}} />
    <div style={{position: 'absolute', left: 155, top: 170, width: 210, height: 110, borderRadius: '55% 45% 60% 40%', background: '#77a85b', transform: 'rotate(-18deg)'}} />
    <div style={{position: 'absolute', left: 350, top: 340, width: 150, height: 120, borderRadius: '50%', background: '#77a85b', transform: 'rotate(24deg)'}} />
  </div>
);

const Motif: React.FC = () => {
  switch (TOPIC.visual) {
    case 'orbit':
      return <Planet />;
    case 'saturn':
      return <Planet rings />;
    case 'mercury':
      return <Planet mercury />;
    case 'moon':
      return <MoonVisual />;
    case 'ocean':
      return <OceanVisual kind="shark" />;
    case 'octopus':
      return <OceanVisual kind="octopus" />;
    case 'whale':
      return <OceanVisual kind="whale" />;
    case 'tower':
      return <TowerVisual />;
    case 'timeline':
      return <TimelineVisual />;
    case 'storm':
      return <StormVisual />;
    case 'silence':
      return <SilenceVisual />;
    case 'volcano':
      return <VolcanoVisual />;
    case 'station':
      return <StationVisual />;
    case 'neutron':
      return <NeutronVisual />;
    case 'ice':
      return <IceVisual />;
    case 'wall':
      return <WallVisual />;
    case 'radiation':
      return <RadiationVisual />;
    case 'core':
      return <CoreVisual />;
    case 'earth':
      return <EarthVisual />;
    default:
      return <Planet />;
  }
};

const Caption: React.FC = () => {
  const frame = useCurrentFrame();
  const cue = CUES.find((item) => frame >= item.start && frame < item.end);
  if (!cue) return null;
  const enter = interpolate(frame, [cue.start, cue.start + 6], [0, 1], clamp);
  const exit = interpolate(frame, [cue.end - 5, cue.end], [1, 0], clamp);
  const opacity = Math.min(enter, exit);
  const fontSize = cue.text.length > 92 ? 42 : cue.text.length > 66 ? 48 : 55;
  return (
    <div
      style={{
        position: 'absolute',
        left: 62,
        right: 62,
        bottom: 78,
        zIndex: 40,
        minHeight: 168,
        padding: '28px 38px 31px',
        display: 'grid',
        placeItems: 'center',
        borderRadius: 34,
        background: 'rgba(8,10,22,.9)',
        border: '3px solid rgba(255,255,255,.26)',
        boxShadow: '0 22px 55px rgba(0,0,0,.46)',
        color: '#ffffff',
        fontFamily: 'Arial, sans-serif',
        fontWeight: 850,
        fontSize,
        lineHeight: 1.16,
        letterSpacing: -0.8,
        textAlign: 'center',
        opacity,
        transform: `translateY(${(1 - opacity) * 30}px) scale(${0.97 + opacity * 0.03})`,
      }}
    >
      {cue.text}
    </div>
  );
};

const Scene: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const markers = [...SCENE_STARTS, TOTAL_FRAMES];
  let index = 0;
  while (index < SCENE_STARTS.length - 1 && frame >= markers[index + 1]) index += 1;
  const start = markers[index];
  const end = markers[index + 1];
  const local = frame - start;
  const duration = Math.max(1, end - start);
  const entrance = spring({frame: local, fps, config: {damping: 13, stiffness: 115, mass: 0.75}});
  const fadeIn = index === 0 ? 1 : interpolate(local, [0, 9], [0, 1], clamp);
  const fadeOut = index === 6 ? 1 : interpolate(local, [duration - 9, duration], [1, 0], clamp);
  const opacity = Math.min(fadeIn, fadeOut);
  const cameraScale = 1.01 + interpolate(local, [0, duration], [0, 0.055], clamp);
  const content = TOPIC.narration[index] ?? TOPIC.hook;

  if (index === 0) {
    return (
      <AbsoluteFill style={{opacity, transform: `scale(${cameraScale})`}}>
        <Header />
        <div style={{position: 'absolute', left: 245, top: 185, transform: `scale(${0.72 + entrance * 0.28})`}}>
          <Motif />
        </div>
        <div style={{position: 'absolute', left: 62, right: 62, top: 955, color: '#ffffff', fontFamily: 'Arial Black, Arial', fontSize: 82, lineHeight: 0.96, textAlign: 'center', textTransform: 'uppercase', transform: `translateY(${(1 - entrance) * 95}px)`}}>
          {TOPIC.title}
        </div>
        <div style={{position: 'absolute', left: 190, right: 190, top: 1280, height: 12, borderRadius: 20, background: TOPIC.accent, transform: `scaleX(${entrance})`}} />
      </AbsoluteFill>
    );
  }

  if (index === 1) {
    return (
      <AbsoluteFill style={{opacity, transform: `scale(${cameraScale})`}}>
        <Header />
        <div style={{position: 'absolute', left: 270, top: 210, transform: `translateX(${(1 - entrance) * 220}px) scale(.78)`}}>
          <Motif />
        </div>
        <div style={{position: 'absolute', left: 80, right: 80, top: 1010, padding: '42px 48px', borderRadius: 42, background: 'rgba(255,255,255,.08)', border: `5px solid ${TOPIC.secondary}`, color: '#ffffff', fontFamily: 'Arial Black, Arial', fontSize: 62, lineHeight: 1.04, textAlign: 'center', transform: `translateY(${(1 - entrance) * 130}px)`}}>
          {content}
        </div>
      </AbsoluteFill>
    );
  }

  if (index === 2 || index === 3) {
    const stat = TOPIC.stats[index - 2];
    return (
      <AbsoluteFill style={{opacity, transform: `scale(${cameraScale})`}}>
        <Header />
        <div style={{position: 'absolute', left: 230, top: 190, transform: 'scale(.72)'}}>
          <Motif />
        </div>
        <div style={{position: 'absolute', left: 90, right: 90, top: 930, height: 430, borderRadius: 54, background: 'rgba(255,255,255,.07)', border: `7px solid ${index === 2 ? TOPIC.accent : TOPIC.secondary}`, display: 'grid', placeItems: 'center', transform: `scale(${0.72 + entrance * 0.28}) rotate(${index === 2 ? -1.5 : 1.5}deg)`}}>
          <div style={{textAlign: 'center', color: '#ffffff', fontFamily: 'Arial Black, Arial'}}>
            <div style={{fontSize: stat.value.length > 8 ? 120 : 178, lineHeight: 0.88}}>{stat.value}</div>
            <div style={{fontSize: 35, letterSpacing: 5, marginTop: 35, color: index === 2 ? TOPIC.accent : TOPIC.secondary}}>{stat.label}</div>
          </div>
        </div>
      </AbsoluteFill>
    );
  }

  if (index === 4) {
    return (
      <AbsoluteFill style={{opacity, transform: `scale(${cameraScale})`}}>
        <Header />
        {TOPIC.stats.map((stat, statIndex) => (
          <div key={stat.label} style={{position: 'absolute', left: statIndex ? 565 : 65, top: 330, width: 450, height: 650, borderRadius: 48, background: 'rgba(255,255,255,.07)', border: `6px solid ${statIndex ? TOPIC.secondary : TOPIC.accent}`, display: 'grid', placeItems: 'center', transform: `translateX(${(1 - entrance) * (statIndex ? 260 : -260)}px)`}}>
            <div style={{textAlign: 'center', fontFamily: 'Arial Black, Arial', color: '#ffffff'}}>
              <div style={{fontSize: stat.value.length > 8 ? 82 : 126}}>{stat.value}</div>
              <div style={{fontSize: 28, lineHeight: 1.1, color: statIndex ? TOPIC.secondary : TOPIC.accent, marginTop: 30}}>{stat.label}</div>
            </div>
          </div>
        ))}
        <div style={{position: 'absolute', left: 100, right: 100, top: 1090, padding: '34px 40px', borderRadius: 34, background: TOPIC.accent, color: '#080a16', textAlign: 'center', fontFamily: 'Arial Black, Arial', fontSize: 50, lineHeight: 1.05, transform: `scale(${0.75 + entrance * 0.25})`}}>
          {content}
        </div>
      </AbsoluteFill>
    );
  }

  if (index === 5) {
    return (
      <AbsoluteFill style={{opacity, transform: `scale(${cameraScale})`}}>
        <Header />
        <div style={{position: 'absolute', left: 230, top: 170, transform: `rotate(${Math.sin(local * 0.04) * 2}deg) scale(.78)`}}>
          <Motif />
        </div>
        <div style={{position: 'absolute', left: 90, right: 90, top: 1040, color: '#ffffff', fontFamily: 'Arial Black, Arial', fontSize: 68, lineHeight: 1.02, textAlign: 'center', textTransform: 'uppercase', textShadow: `0 0 34px ${TOPIC.accent}`, transform: `translateY(${(1 - entrance) * 100}px)`}}>
          {content}
        </div>
        <div style={{position: 'absolute', left: 260, right: 260, top: 1360, height: 9, background: TOPIC.secondary, transform: `scaleX(${entrance})`}} />
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill style={{opacity}}>
      <Header />
      <div style={{position: 'absolute', left: 230, top: 180, transform: `scale(${0.65 + entrance * 0.15})`}}>
        <Motif />
      </div>
      <div style={{position: 'absolute', left: 80, right: 80, top: 1000, color: '#ffffff', fontFamily: 'Arial Black, Arial', fontSize: 70, lineHeight: 1.02, textAlign: 'center', transform: `scale(${0.72 + entrance * 0.28})`}}>
        {content}
      </div>
      <div style={{position: 'absolute', left: 120, right: 120, top: 1310, padding: '22px 30px', border: '3px solid rgba(255,255,255,.3)', borderRadius: 24, color: '#ffffff', opacity: 0.68, fontFamily: 'Arial, sans-serif', fontWeight: 800, fontSize: 26, textAlign: 'center'}}>
        SOURCE: {TOPIC.source}
      </div>
    </AbsoluteFill>
  );
};

const TransitionFX: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{pointerEvents: 'none', zIndex: 30}}>
      {cuts.map((cut, index) => {
        const distance = frame - cut;
        if (distance < -5 || distance > 10) return null;
        const progress = interpolate(distance, [-5, 2, 10], [0, 1, 0], clamp);
        const x = interpolate(distance, [-5, 10], [-320, 1240], clamp);
        return (
          <React.Fragment key={cut}>
            <div style={{position: 'absolute', top: 0, bottom: 0, left: x, width: 260, background: index % 2 ? TOPIC.secondary : TOPIC.accent, opacity: progress * 0.72, transform: 'skewX(-14deg)', filter: 'blur(3px)'}} />
            <AbsoluteFill style={{background: '#ffffff', opacity: progress * 0.2, mixBlendMode: 'screen'}} />
            {index % 3 === 2
              ? Array.from({length: 8}).map((_, line) => (
                  <div key={line} style={{position: 'absolute', left: 0, right: 0, top: 180 + line * 175, height: 5 + (line % 3) * 4, background: '#ffffff', opacity: progress * 0.3, transform: `translateX(${(line % 2 ? -1 : 1) * progress * 85}px)`}} />
                ))
              : null}
          </React.Fragment>
        );
      })}
    </AbsoluteFill>
  );
};

const FilmFX: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{pointerEvents: 'none', zIndex: 50}}>
      <AbsoluteFill style={{boxShadow: 'inset 0 0 190px rgba(0,0,0,.52)'}} />
      <AbsoluteFill style={{opacity: 0.075, backgroundImage: 'repeating-linear-gradient(0deg, transparent 0 4px, rgba(255,255,255,.16) 5px, transparent 6px)', transform: `translateY(${frame % 6}px)`}} />
      <AbsoluteFill style={{opacity: 0.06, backgroundImage: 'radial-gradient(circle, #ffffff 0 1px, transparent 1.5px)', backgroundSize: '9px 11px', transform: `translate(${frame % 9}px, ${(frame * 3) % 11}px)`}} />
      <div style={{position: 'absolute', top: -400, left: -350 + ((frame * 7) % 1800), width: 180, height: 2500, background: 'rgba(255,255,255,.06)', transform: 'rotate(18deg)', filter: 'blur(20px)'}} />
    </AbsoluteFill>
  );
};

export const NeoSaniyeShort: React.FC = () => (
  <AbsoluteFill style={{background: '#070914', overflow: 'hidden'}}>
    <Stars />
    <Audio src={staticFile('audio/music.wav')} volume={0.11} />
    <Audio src={staticFile('audio/rumble.wav')} volume={0.035} loop />
    <Sequence from={12}>
      <Audio src={staticFile('audio/voice.mp3')} volume={1} />
    </Sequence>

    <Sequence from={0} durationInFrames={48}>
      <Audio src={staticFile('audio/impact.wav')} volume={0.82} />
    </Sequence>
    {cuts.map((cut, index) => (
      <React.Fragment key={cut}>
        <Sequence from={Math.max(0, cut - 8)} durationInFrames={52}>
          <Audio src={staticFile(index % 2 === 0 ? 'audio/whoosh-a.wav' : 'audio/whoosh-b.wav')} volume={0.48} />
        </Sequence>
        {index === 1 ? (
          <Sequence from={Math.max(0, cut + 10)} durationInFrames={18}>
            <Audio src={staticFile('audio/snap.wav')} volume={0.44} />
          </Sequence>
        ) : null}
        {index === 3 ? (
          <Sequence from={Math.max(0, cut - 4)} durationInFrames={60}>
            <Audio src={staticFile('audio/sub-hit.wav')} volume={0.56} />
          </Sequence>
        ) : null}
        {index === 4 ? (
          <Sequence from={Math.max(0, cut - 8)} durationInFrames={24}>
            <Audio src={staticFile('audio/glitch.wav')} volume={0.34} />
          </Sequence>
        ) : null}
      </React.Fragment>
    ))}
    <Sequence from={Math.max(0, SCENE_STARTS[6] - 40)} durationInFrames={55}>
      <Audio src={staticFile('audio/riser.wav')} volume={0.36} />
    </Sequence>
    <Sequence from={Math.max(0, SCENE_STARTS[6] - 3)} durationInFrames={72}>
      <Audio src={staticFile('audio/chime.wav')} volume={0.5} />
    </Sequence>

    <Scene />
    <TransitionFX />
    <Caption />
    <FilmFX />
  </AbsoluteFill>
);
