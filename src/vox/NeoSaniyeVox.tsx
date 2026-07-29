import React from 'react';
import {AbsoluteFill, Audio, Img, Sequence, interpolate, staticFile, useCurrentFrame} from 'remotion';
import {VOX_SCENE_STARTS, VOX_TOTAL_FRAMES, type VoxScene, voxStory} from './story';

const clamp = {extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const};
const ink = '#17202a';
const paper = '#efe7d4';
const light = '#f7f1e3';
const mustard = '#d9a23e';
const font = 'Arial Black, Impact, Arial, sans-serif';
const torn = 'polygon(1% 2%, 10% .4%, 20% 1.5%, 31% 0%, 43% 1.4%, 55% .3%, 67% 1.7%, 79% .4%, 90% 1.3%, 99% .6%, 98.4% 98.3%, 88% 99.5%, 76% 98.2%, 64% 99.6%, 52% 98.4%, 40% 99.5%, 27% 98.4%, 15% 99.3%, 1% 98.1%)';

const Grain: React.FC = () => <AbsoluteFill style={{pointerEvents: 'none', zIndex: 70, opacity: 0.18, mixBlendMode: 'multiply', backgroundImage: 'radial-gradient(circle at 25% 20%, rgba(247,241,227,.25) 0 1px, transparent 1.6px), radial-gradient(circle at 70% 80%, rgba(23,32,42,.20) 0 1px, transparent 1.4px), linear-gradient(90deg, rgba(23,32,42,.05) 1px, transparent 1px)', backgroundSize: '13px 13px, 19px 19px, 100% 7px'}} />;

const stepped = (frame: number, start: number, end: number) => {
  const held = Math.floor(frame / 2) * 2;
  return interpolate(held, [start, end], [0, 1], clamp);
};

const layerTransform = (name: string, frame: number, duration: number) => {
  const starts: Record<string, number> = {background: 0, support: 5, hero: 11, foreground: 18};
  const end = Math.min(starts[name] + 10, Math.max(starts[name] + 1, duration - 3));
  const p = stepped(frame, starts[name], end);
  const directions: Record<string, [number, number, number]> = {
    background: [0, 0, 1],
    support: [-62, 26, -2.2],
    hero: [76, 18, 1.8],
    foreground: [0, -56, -1.2],
  };
  const [x, y, r] = directions[name];
  const settle = interpolate(p, [0, .72, 1], [.9, 1.025, 1], clamp);
  const livingStart = Math.max(24, duration - 18);
  const living = frame >= livingStart ? Math.sin((frame - livingStart) * .55) : 0;
  return {
    opacity: p,
    transform: `translate(${interpolate(p, [0, 1], [x, 0], clamp)}px, ${interpolate(p, [0, 1], [y, 0], clamp) + living * (name === 'foreground' ? .8 : .25)}px) scale(${settle}) rotate(${interpolate(p, [0, 1], [r, 0], clamp) + living * .025}deg)`,
  };
};

const SceneText: React.FC<{scene: VoxScene; frame: number}> = ({scene, frame}) => {
  const progress = stepped(frame, 20, 30);
  return <div style={{position: 'absolute', left: 58, right: 58, bottom: 132, zIndex: 80, opacity: progress, transform: `translateY(${interpolate(progress, [0, 1], [90, 0], clamp)}px)`}}>
    {scene.label ? <div style={{display: 'inline-block', marginBottom: 18, padding: '11px 22px 12px', background: mustard, color: ink, fontFamily: font, fontSize: 25, letterSpacing: 2.2, textTransform: 'uppercase', clipPath: torn}}>{scene.label}</div> : null}
    <br />
    <div style={{display: 'inline-block', maxWidth: 930, padding: '22px 28px 27px', background: 'rgba(247,241,227,.94)', color: ink, fontFamily: font, fontSize: scene.headline.length > 28 ? 68 : 82, lineHeight: .92, letterSpacing: -2.6, textTransform: 'uppercase', clipPath: torn, filter: 'drop-shadow(0 18px 25px rgba(0,0,0,.32))'}}>{scene.headline}</div>
  </div>;
};

const LayeredScene: React.FC<{scene: VoxScene; frame: number; duration: number}> = ({scene, frame, duration}) => {
  const images = scene.layerImages ?? {};
  const names = ['background', 'support', 'hero', 'foreground'] as const;
  const complete = names.every((name) => Boolean(images[name]));
  if (!complete) return <Img src={staticFile(scene.image)} style={{width: '100%', height: '100%', objectFit: 'cover'}} />;
  return <>
    {names.map((name, index) => {
      const motion = layerTransform(name, frame, duration);
      return <Img key={name} src={staticFile(images[name] as string)} style={{position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: motion.opacity, transform: motion.transform, transformOrigin: 'center center', zIndex: 10 + index * 10, filter: name === 'background' ? undefined : 'drop-shadow(0 12px 10px rgba(0,0,0,.18))'}} />;
    })}
  </>;
};

const SceneView: React.FC<{scene: VoxScene; frame: number; duration: number}> = ({scene, frame, duration}) => {
  const entrance = interpolate(frame, [0, 6], [.94, 1], clamp);
  const exit = interpolate(frame, [Math.max(0, duration - 8), duration], [1, .96], clamp);
  const impact = scene.camera === 'impact-push' ? interpolate(frame, [0, 8, 18, duration], [1, 1.025, 1.012, 1], clamp) : 1;
  return <AbsoluteFill style={{background: ink, overflow: 'hidden'}}>
    <div style={{position: 'absolute', inset: 22, overflow: 'hidden', clipPath: torn, background: paper, opacity: entrance * exit, transform: `scale(${impact})`, filter: 'drop-shadow(0 24px 30px rgba(0,0,0,.46))'}}>
      <LayeredScene scene={scene} frame={frame} duration={duration} />
    </div>
    <Grain />
    <SceneText scene={scene} frame={frame} />
    <div style={{position: 'absolute', left: 64, top: 72, zIndex: 90, padding: '9px 16px', background: 'rgba(23,32,42,.86)', color: light, fontFamily: font, fontSize: 20, letterSpacing: 3, clipPath: torn}}>NEOSANİYE</div>
  </AbsoluteFill>;
};

const PaperWipe: React.FC<{localFrame: number}> = ({localFrame}) => {
  const x = interpolate(localFrame, [-7, 0, 7], [-1300, 0, 1300], clamp);
  const opacity = interpolate(localFrame, [-7, -2, 2, 7], [0, 1, 1, 0], clamp);
  return <AbsoluteFill style={{pointerEvents: 'none', zIndex: 100, opacity}}><div style={{position: 'absolute', left: -180, top: -100, width: 1440, height: 2140, background: paper, clipPath: torn, transform: `translateX(${x}px) rotate(-5deg)`, filter: 'drop-shadow(0 0 26px rgba(0,0,0,.38))'}} /><Grain /></AbsoluteFill>;
};

const sfxFiles = {snap: 'audio/snap.wav', chime: 'audio/chime.wav', impact: 'audio/impact.wav'} as const;
const sfxVolumes = {snap: .42, chime: .34, impact: .72} as const;

export const NeoSaniyeVox: React.FC = () => {
  const frame = useCurrentFrame();
  let sceneIndex = 0;
  while (sceneIndex < voxStory.scenes.length - 1 && frame >= VOX_SCENE_STARTS[sceneIndex + 1]) sceneIndex += 1;
  const scene = voxStory.scenes[sceneIndex];
  const localFrame = frame - VOX_SCENE_STARTS[sceneIndex];
  const cut = VOX_SCENE_STARTS.slice(1, -1).find((value) => Math.abs(frame - value) <= 7);
  return <AbsoluteFill style={{background: ink, overflow: 'hidden'}}>
    <SceneView scene={scene} frame={localFrame} duration={scene.durationInFrames} />
    {cut !== undefined ? <PaperWipe localFrame={frame - cut} /> : null}
    <Audio src={staticFile('audio/music.wav')} volume={.12} />
    <Audio src={staticFile('audio/voice.mp3')} volume={1} />
    {voxStory.scenes.map((item, index) => item.sfx === 'none' ? null : <Sequence key={`${item.id}-${item.sfx}`} from={VOX_SCENE_STARTS[index]}><Audio src={staticFile(sfxFiles[item.sfx])} volume={sfxVolumes[item.sfx]} /></Sequence>)}
    <Sequence from={Math.max(0, VOX_TOTAL_FRAMES - 20)} durationInFrames={20}><AbsoluteFill style={{background: ink, opacity: interpolate(frame, [VOX_TOTAL_FRAMES - 20, VOX_TOTAL_FRAMES - 1], [0, 1], clamp), zIndex: 120}} /></Sequence>
  </AbsoluteFill>;
};
