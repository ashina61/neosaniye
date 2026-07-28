import React from 'react';
import {AbsoluteFill, Audio, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {CUES, SCENES, TOTAL_FRAMES} from './generated/timing';

const C = {space:'#070914', cream:'#fff4d6', orange:'#ff9d36', yellow:'#ffd45c', pink:'#ff5b84', cyan:'#68e7ff', ink:'#18131a'};
const clamp = {extrapolateLeft:'clamp' as const, extrapolateRight:'clamp' as const};
const accents = new Set(['VENÜS','GÜN','YILDAN','UZUN','243','225','117','TERS','BATIDAN','DOĞUDA']);
const clean = (word:string) => word.toLocaleUpperCase('tr-TR').replace(/[.,!?:;“”"'’]/g,'');

const Stars:React.FC = () => {
  const frame=useCurrentFrame();
  return <AbsoluteFill style={{background:'radial-gradient(circle at 50% 20%,#182044,#070914 66%)'}}>
    {Array.from({length:70}).map((_,i)=><div key={i} style={{position:'absolute',left:(i*149+43)%1080,top:(i*277+91)%1920,width:2+(i*7)%8,height:2+(i*7)%8,borderRadius:'50%',background:i%7===0?C.cyan:C.cream,opacity:.3+.7*Math.abs(Math.sin(frame*.025+i*1.7))}} />)}
  </AbsoluteFill>;
};

const Venus:React.FC<{size?:number;left?:number;top?:number;rotation?:number}> = ({size=520,left=280,top=260,rotation=0}) => {
  const frame=useCurrentFrame();
  return <div style={{position:'absolute',left,top,width:size,height:size,borderRadius:'50%',overflow:'hidden',transform:`rotate(${rotation}deg)`,background:'radial-gradient(circle at 30% 25%,#fff4b0 0 7%,#f6b94e 28%,#d06a2d 64%,#712c3c 100%)',border:'7px solid rgba(255,244,214,.62)',boxShadow:'0 0 55px rgba(255,157,54,.52),0 0 140px rgba(255,91,132,.18),inset -42px -30px 75px rgba(40,8,30,.5)'}}>
    <div style={{position:'absolute',inset:-80,transform:`translateX(${(frame*1.4)%size-size}px) rotate(-14deg)`,background:'repeating-linear-gradient(12deg,transparent 0 34px,rgba(255,245,185,.24) 38px 57px,transparent 62px 93px)',filter:'blur(7px)'}} />
    <div style={{position:'absolute',left:size*.13,top:size*.08,width:size*.28,height:size*.16,borderRadius:'50%',background:'rgba(255,255,255,.25)',filter:'blur(18px)',transform:'rotate(-28deg)'}} />
  </div>;
};

const Sun:React.FC<{size?:number;left:number;top:number}> = ({size=200,left,top}) => <div style={{position:'absolute',left,top,width:size,height:size,borderRadius:'50%',background:'radial-gradient(circle,#fffbd2 0 20%,#ffd45c 42%,#ff7a2d 75%,#cf2e42)',boxShadow:'0 0 45px rgba(255,212,92,.9),0 0 120px rgba(255,122,45,.42)'}} />;

const Header:React.FC<{label:string}> = ({label}) => <div style={{position:'absolute',top:65,left:62,right:62,display:'flex',justifyContent:'space-between',fontFamily:'Arial,sans-serif',fontWeight:900,letterSpacing:5,color:C.cream,fontSize:28}}><span>NEO<span style={{color:C.yellow}}>SANİYE</span></span><span style={{fontSize:21,opacity:.7}}>{label}</span></div>;

const Caption:React.FC = () => {
  const frame=useCurrentFrame();
  const cue=CUES.find((x)=>frame>=x.start&&frame<x.end);
  if(!cue)return null;
  const enter=interpolate(frame,[cue.start,cue.start+6],[0,1],clamp);
  const exit=interpolate(frame,[cue.end-5,cue.end],[1,0],clamp);
  const opacity=Math.min(enter,exit);
  const fontSize=cue.text.length>88?43:cue.text.length>62?49:56;
  return <div style={{position:'absolute',left:62,right:62,bottom:82,minHeight:174,padding:'28px 36px 32px',borderRadius:34,background:'rgba(8,10,22,.9)',border:'3px solid rgba(255,244,214,.3)',boxShadow:'0 22px 55px rgba(0,0,0,.42)',fontFamily:'Arial,sans-serif',fontWeight:850,fontSize,lineHeight:1.18,textAlign:'center',color:C.cream,opacity,transform:`translateY(${(1-opacity)*28}px)`}}>
    {cue.text.split(/(\s+)/).map((token,i)=><span key={i} style={accents.has(clean(token))?{color:C.ink,background:i%2?C.orange:C.yellow,borderRadius:10,padding:'1px 8px 3px',margin:'0 2px',boxDecorationBreak:'clone',WebkitBoxDecorationBreak:'clone'}:undefined}>{token}</span>)}
  </div>;
};

const NumberCard:React.FC<{value:string;label:string;color:string;left:number}> = ({value,label,color,left}) => <div style={{position:'absolute',left,top:380,width:390,height:620,borderRadius:46,background:`${color}20`,border:`6px solid ${color}`,display:'grid',placeItems:'center'}}><div style={{textAlign:'center',fontFamily:'Arial Black,Arial',color:C.cream}}><div style={{fontSize:152,lineHeight:.9}}>{value}</div><div style={{fontSize:38,color,marginTop:25}}>{label}</div></div></div>;

const Scene:React.FC = () => {
  const frame=useCurrentFrame();
  const {fps}=useVideoConfig();
  const marker=[SCENES.hook,SCENES.explain,SCENES.rotation,SCENES.orbit,SCENES.compare,SCENES.reverse,SCENES.solar,TOTAL_FRAMES];
  let index=0; while(index<6&&frame>=marker[index+1])index++;
  const start=marker[index]; const end=marker[index+1]; const local=frame-start; const duration=Math.max(1,end-start);
  const fadeIn=start===0?1:interpolate(local,[0,10],[0,1],clamp);
  const fadeOut=end===TOTAL_FRAMES?1:interpolate(local,[duration-10,duration],[1,0],clamp);
  const opacity=Math.min(fadeIn,fadeOut);
  const enter=spring({frame:local,fps,config:{damping:13,stiffness:115,mass:.75}});

  if(index===0)return <AbsoluteFill style={{opacity}}><Header label="VENÜS / ZAMAN"/><Venus size={585} left={248} top={220} rotation={local*-.1}/><div style={{position:'absolute',top:900,left:70,right:70,textAlign:'center',fontFamily:'Arial Black,Arial',fontWeight:950,color:C.cream,transform:`scale(${.7+enter*.3})`}}><div style={{fontSize:116,lineHeight:.88}}>1 GÜN</div><div style={{fontSize:150,lineHeight:.8,color:C.pink}}>&gt;</div><div style={{fontSize:116,lineHeight:.88}}>1 YIL</div><div style={{fontFamily:'Arial',fontSize:38,color:C.yellow,letterSpacing:7,marginTop:65}}>BU NASIL OLABİLİR?</div></div></AbsoluteFill>;

  if(index===1)return <AbsoluteFill style={{opacity}}><Header label="İKİ FARKLI ÖLÇÜ"/><div style={{position:'absolute',left:55,top:290,width:455,height:850,borderRadius:48,background:'rgba(255,157,54,.1)',border:'4px solid rgba(255,157,54,.55)',transform:`translateX(${(1-enter)*-220}px)`}}><Venus size={310} left={70} top={105} rotation={local*-.08}/><div style={{position:'absolute',top:500,left:25,right:25,textAlign:'center',fontFamily:'Arial Black,Arial',color:C.cream,fontSize:56}}>KENDİ EKSENİ<div style={{fontFamily:'Arial',fontSize:29,color:C.orange,marginTop:20}}>DÖNÜŞ SÜRESİ</div></div></div><div style={{position:'absolute',right:55,top:290,width:455,height:850,borderRadius:48,background:'rgba(104,231,255,.08)',border:'4px solid rgba(104,231,255,.5)',transform:`translateX(${(1-enter)*220}px)`}}><Sun size={165} left={145} top={190}/><div style={{position:'absolute',left:55,top:80,width:340,height:340,border:'5px dashed rgba(104,231,255,.7)',borderRadius:'50%'}}/><Venus size={92} left={310} top={195} rotation={local*-.2}/><div style={{position:'absolute',top:500,left:25,right:25,textAlign:'center',fontFamily:'Arial Black,Arial',color:C.cream,fontSize:56}}>GÜNEŞ TURU<div style={{fontFamily:'Arial',fontSize:29,color:C.cyan,marginTop:20}}>YIL SÜRESİ</div></div></div><div style={{position:'absolute',top:1240,left:100,right:100,textAlign:'center',fontFamily:'Arial Black,Arial',fontSize:70,color:C.yellow}}>AYNI ŞEY DEĞİL</div></AbsoluteFill>;

  if(index===2){const n=Math.round(interpolate(local,[0,62],[0,243],clamp));return <AbsoluteFill style={{opacity}}><Header label="EKSEN DÖNÜŞÜ"/><Venus size={680} left={200} top={270} rotation={local*-.055}/><div style={{position:'absolute',top:500,left:170,right:170,textAlign:'center',fontFamily:'Arial Black,Arial',color:C.cream,textShadow:'0 10px 35px #000'}}><div style={{fontSize:175,lineHeight:.88}}>{n}</div><div style={{fontSize:44,letterSpacing:6,color:C.yellow}}>DÜNYA GÜNÜ</div></div><div style={{position:'absolute',top:1110,left:110,right:110,textAlign:'center',fontFamily:'Arial Black,Arial',fontSize:58,color:C.orange}}>BİR TAM DÖNÜŞ</div><div style={{position:'absolute',left:170,top:1260,width:740,height:18,borderRadius:18,background:'rgba(255,255,255,.12)',overflow:'hidden'}}><div style={{height:'100%',width:`${interpolate(local,[0,duration-15],[0,100],clamp)}%`,background:`linear-gradient(90deg,${C.orange},${C.pink})`}}/></div></AbsoluteFill>}

  if(index===3){const a=interpolate(local,[0,duration],[0,Math.PI*2],clamp);const x=540+Math.cos(a)*340;const y=610+Math.sin(a)*235;const n=Math.round(interpolate(local,[0,58],[0,225],clamp));return <AbsoluteFill style={{opacity}}><Header label="VENÜS YILI"/><div style={{position:'absolute',left:190,top:260,width:700,height:500,border:'6px dashed rgba(104,231,255,.5)',borderRadius:'50%',transform:'rotate(-7deg)'}}/><Sun size={250} left={415} top={385}/><Venus size={130} left={x-65} top={y-65} rotation={local*-.2}/><div style={{position:'absolute',top:930,left:100,right:100,textAlign:'center',fontFamily:'Arial Black,Arial',color:C.cream}}><div style={{fontSize:175,lineHeight:.9}}>{n}</div><div style={{fontSize:44,letterSpacing:7,color:C.cyan}}>DÜNYA GÜNÜ</div><div style={{fontFamily:'Arial',fontWeight:900,fontSize:38,marginTop:32}}>GÜNEŞ ÇEVRESİNDE BİR TUR</div></div></AbsoluteFill>}

  if(index===4)return <AbsoluteFill style={{opacity}}><Header label="SONUÇ"/><NumberCard value="243" label="DÖNÜŞ" color={C.orange} left={100}/><NumberCard value="225" label="YIL" color={C.cyan} left={590}/><div style={{position:'absolute',top:610,left:485,width:110,textAlign:'center',fontFamily:'Arial Black,Arial',fontSize:130,color:C.pink}}>&gt;</div><div style={{position:'absolute',top:1110,left:120,right:120,padding:'30px',borderRadius:30,background:C.yellow,color:C.ink,textAlign:'center',fontFamily:'Arial Black,Arial',fontSize:53,transform:`rotate(-2deg) scale(${.72+enter*.28})`}}>YIL BİTİYOR<br/>DÖNÜŞ BİTMİYOR</div></AbsoluteFill>;

  if(index===5){const p=interpolate(local,[8,duration-15],[0,1],clamp);const x=interpolate(p,[0,1],[810,110],clamp);const y=900-Math.sin(p*Math.PI)*490;return <AbsoluteFill style={{opacity}}><Header label="TERS DÖNÜŞ"/><div style={{position:'absolute',left:-260,top:750,width:1600,height:800,borderRadius:'50%',background:'linear-gradient(180deg,#bc523c,#6c253e 52%,#20172a)',border:'8px solid rgba(255,244,214,.23)'}}/><Sun size={190} left={x} top={y}/><div style={{position:'absolute',top:280,left:95,fontFamily:'Arial Black,Arial',fontSize:58,color:C.orange}}>DOĞU</div><div style={{position:'absolute',top:280,right:95,fontFamily:'Arial Black,Arial',fontSize:58,color:C.cyan}}>BATI</div><div style={{position:'absolute',top:1120,left:100,right:100,textAlign:'center',fontFamily:'Arial Black,Arial',color:C.cream}}><div style={{fontSize:72,color:C.pink}}>GÜNEŞ BATIDAN DOĞAR</div><div style={{fontSize:43,marginTop:18}}>VE DOĞUDA BATAR</div></div></AbsoluteFill>}

  const n=Math.round(interpolate(local,[0,55],[0,117],clamp));const ring=interpolate(local,[0,duration-15],[0,360],clamp);return <AbsoluteFill style={{opacity}}><Header label="GÜNEŞ GÜNÜ"/><div style={{position:'absolute',left:165,top:250,width:750,height:750,borderRadius:'50%',background:`conic-gradient(${C.yellow} 0deg ${ring}deg,rgba(255,255,255,.1) ${ring}deg 360deg)`,padding:22,transform:`scale(${.78+enter*.22})`}}><div style={{width:'100%',height:'100%',borderRadius:'50%',background:C.space,display:'grid',placeItems:'center',border:'5px solid rgba(255,244,214,.2)'}}><div style={{textAlign:'center',fontFamily:'Arial Black,Arial',color:C.cream}}><div style={{fontSize:180,lineHeight:.86}}>{n}</div><div style={{fontSize:42,letterSpacing:7,color:C.yellow}}>DÜNYA GÜNÜ</div><div style={{fontFamily:'Arial',fontWeight:900,fontSize:31,marginTop:25,color:C.cyan}}>GÜNEŞ'İN GÖKYÜZÜNDEKİ TURU</div></div></div></div><div style={{position:'absolute',top:1120,left:80,right:80,textAlign:'center',fontFamily:'Arial Black,Arial',fontSize:78,lineHeight:.98,color:C.cream}}>VENÜS'TE ZAMAN<div style={{fontSize:110,color:C.pink}}>TERS KÖŞE</div></div></AbsoluteFill>;
};

export const VenusShort:React.FC = () => <AbsoluteFill style={{background:C.space,overflow:'hidden'}}>
  <Stars/>
  <Audio src={staticFile('audio/music.wav')} volume={.11}/><Audio src={staticFile('audio/rumble.wav')} volume={.035} loop/>
  <Sequence from={12}><Audio src={staticFile('audio/voice.mp3')} volume={1}/></Sequence>
  <Sequence from={0} durationInFrames={48}><Audio src={staticFile('audio/impact.wav')} volume={.82}/></Sequence>
  <Sequence from={Math.max(0,SCENES.explain-5)} durationInFrames={48}><Audio src={staticFile('audio/whoosh-a.wav')} volume={.56}/></Sequence>
  <Sequence from={Math.max(0,SCENES.rotation-4)} durationInFrames={42}><Audio src={staticFile('audio/tick.wav')} volume={.48}/></Sequence>
  <Sequence from={Math.max(0,SCENES.orbit-5)} durationInFrames={42}><Audio src={staticFile('audio/whoosh-b.wav')} volume={.62}/></Sequence>
  <Sequence from={Math.max(0,SCENES.compare-3)} durationInFrames={48}><Audio src={staticFile('audio/impact.wav')} volume={.66}/></Sequence>
  <Sequence from={Math.max(0,SCENES.reverse-8)} durationInFrames={60}><Audio src={staticFile('audio/reverse.wav')} volume={.58}/></Sequence>
  <Sequence from={Math.max(0,SCENES.solar-4)} durationInFrames={72}><Audio src={staticFile('audio/chime.wav')} volume={.52}/></Sequence>
  <Scene/><Caption/><AbsoluteFill style={{pointerEvents:'none',boxShadow:'inset 0 0 180px rgba(0,0,0,.48)'}}/>
</AbsoluteFill>;
