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

function camera(scene: VoxScene, frame: number, duration: number) {
  const progress = interpolate(frame, [0, Math.max(1, duration - 1)], [0, 1], clamp);
  let scale = interpolate(progress, [0, 1], [1.05, 1.14], clamp);
  let x = 0;
  let y = 0;
  let rotate = 0;
  if (scene.camera === 'slow-push-out') scale = interpolate(progress, [0, 1], [1.15, 1.06], clamp);
  if (scene.camera === 'pan-left') {scale = 1.12; x = interpolate(progress, [0, 1], [42, -42], clamp);}
  if (scene.camera === 'pan-right') {scale = 1.12; x = interpolate(progress, [0, 1], [-42, 42], clamp);}
  if (scene.camera === 'drift-up') {scale = 1.11; y = interpolate(progress, [0, 1], [38, -38], clamp);}
  if (scene.camera === 'drift-down') {scale = 1.11; y = interpolate(progress, [0, 1], [-38, 38], clamp);}
  if (scene.camera === 'impact-push') {
    scale = interpolate(frame, [0, 10, 22, 38], [1.03, 1.08, 1.18, 1.13], clamp);
    x = frame > 12 && frame < 34 ? Math.sin(frame * 2.6) * 8 : 0;
    rotate = frame > 12 && frame < 34 ? Math.sin(frame * 2.1) * 0.35 : 0;
  }
  return `translate(${x}px, ${y}px) scale(${scale}) rotate(${rotate}deg)`;
}

const Grain: React.FC = () => (
  <AbsoluteFill style={{pointerEvents: 'none', zIndex: 30, opacity: 0.2, mixBlendMode: 'multiply', backgroundImage: 'radial-gradient(circle at 25% 20%, rgba(247,241,227,.25) 0 1px, transparent 1.6px), radial-gradient(circle at 70% 80%, rgba(23,32,42,.20) 0 1px, transparent 1.4px), linear-gradient(90deg, rgba(23,32,42,.05) 1px, transparent 1px)', backgroundSize: '13px 13px, 19px 19px, 100% 7px'}} />
);

const SceneText: React.FC<{scene: VoxScene; frame: number}> = ({scene, frame}) => {
  const progress = interpolate(frame, [4, 18], [0, 1], clamp);
  return (
    <div style={{position: 'absolute', left: 58, right: 58, bottom: 132, zIndex: 50, opacity: progress, transform: `translateY(${interpolate(progress, [0, 1], [90, 0], clamp)}px)`}}>
      {scene.label ? <div style={{display: 'inline-block', marginBottom: 18, padding: '11px 22px 12px', background: mustard, color: ink, fontFamily: font, fontSize: 25, letterSpacing: 2.2, textTransform: 'uppercase', clipPath: torn}}>{scene.label}</div> : null}
      <br />
      <div style={{display: 'inline-block', maxWidth: 930, padding: '22px 28px 27px', background: 'rgba(247,241,227,.94)', color: ink, fontFamily: font, fontSize: scene.headline.length > 28 ? 68 : 82, lineHeight: 0.92, letterSpacing: -2.6, textTransform: 'uppercase', clipPath: torn, filter: 'drop-shadow(0 18px 25px rgba(0,0,0,.32))'}}>{scene.headline}</div>
    </div>
  );
};

const SceneView: React.FC<{scene: VoxScene; frame: number; duration: number}> = ({scene, frame, duration}) => {
  const entrance = interpolate(frame, [0, 10], [0.88, 1], clamp);
  const exit = interpolate(frame, [Math.max(0, duration - 10), duration], [1, 0.94], clamp);
  return (
    <AbsoluteFill style={{background: ink, overflow: 'hidden'}}>
      <Img src={staticFile(scene.image)} style={{position: 'absolute', inset: -70, width: 1220, height: 2060, objectFit: 'cover', filter: 'blur(22px) saturate(.72) brightness(.56)', transform: 'scale(1.08)', opacity: 0.82}} />
      <div style={{position: 'absolute', inset: 22, overflow: 'hidden', clipPath: torn, background: paper, opacity: entrance * exit, filter: 'drop-shadow(0 24px 30px rgba(0,0,0,.46))'}}>
        <Img src={staticFile(scene.image)} style={{width: '100%', height: '100%', objectFit: 'cover', transform: camera(scene, frame, duration), transformOrigin: 'center center'}} />
        <AbsoluteFill style={{background: 'linear-gradient(180deg, rgba(23,32,42,.08) 0%, transparent 30%, transparent 55%, rgba(23,32,42,.22) 74%, rgba(23,32,42,.72) 100%)'}} />
      </div>
      <Grain />
      <SceneText scene={scene} frame={frame} />
      <div style={{position: 'absolute', left: 64, top: 72, zIndex: 55, padding: '9px 16px', background: 'rgba(23,32,42,.86)', color: light, fontFamily: font, fontSize: 20, letterSpacing: 3, clipPath: torn}}>NEOSANİYE</div>
    </AbsoluteFill>
  );
};

const PaperWipe: React.FC<{localFrame: number}> = ({localFrame}) => {
  const x = interpolate(localFrame, [-9, 0, 9], [-1300, 0, 1300], clamp);
  const opacity = interpolate(localFrame, [-9, -2, 3, 9], [0, 1, 1, 0], clamp);
  return <AbsoluteFill style={{pointerEvents: 'none', zIndex: 80, opacity}}><div style={{position: 'absolute', left: -180, top: -100, width: 1440, height: 2140, background: paper, clipPath: torn, transform: `translateX(${x}px) rotate(-5deg)`, filter: 'drop-shadow(0 0 26px rgba(0,0,0,.38))'}} /><Grain /></AbsoluteFill>;
};

const sfxFiles = {snap: 'audio/snap.wav', chime: 'audio/chime.wav', impact: 'audio/impact.wav'} as const;
const sfxVolumes = {snap: 0.42, chime: 0.34, impact: 0.72} as const;

export const NeoSaniyeVox: React.FC = () => {
  const frame = useCurrentFrame();
  let sceneIndex = 0;
  while (sceneIndex < voxStory.scenes.length - 1 && frame >= VOX_SCENE_STARTS[sceneIndex + 1]) sceneIndex += 1;
  const scene = voxStory.scenes[sceneIndex];
  const localFrame = frame - VOX_SCENE_STARTS[sceneIndex];
  const cut = VOX_SCENE_STARTS.slice(1, -1).find((value) => Math.abs(frame - value) <= 9);
  return (
    <AbsoluteFill style={{background: ink, overflow: 'hidden'}}>
      <SceneView scene={scene} frame={localFrame} duration={scene.durationInFrames} />
      {cut !== undefined ? <PaperWipe localFrame={frame - cut} /> : null}
      <Audio src={staticFile('audio/music.wav')} volume={0.12} />
      <Audio src={staticFile('audio/voice.mp3')} volume={1} />
      {voxStory.scenes.map((item, index) => {
        if (item.sfx === 'none') return null;
        const key = item.sfx;
        return <Sequence key={`${item.id}-${key}`} from={VOX_SCENE_STARTS[index]}><Audio src={staticFile(sfxFiles[key])} volume={sfxVolumes[key]} /></Sequence>;
      })}
      <Sequence from={Math.max(0, VOX_TOTAL_FRAMES - 20)} durationInFrames={20}><AbsoluteFill style={{background: ink, opacity: interpolate(frame, [VOX_TOTAL_FRAMES - 20, VOX_TOTAL_FRAMES - 1], [0, 1], clamp), zIndex: 100}} /></Sequence>
    </AbsoluteFill>
  );
};
