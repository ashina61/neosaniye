import {interpolate,spring} from 'remotion';
import type {MotionPreset} from './types';
const clamp={extrapolateLeft:'clamp' as const,extrapolateRight:'clamp' as const};
export const steppedFrame=(frame:number,step=3)=>Math.floor(frame/step)*step;
export function motionStyle(preset:MotionPreset,frame:number,duration:number):React.CSSProperties{
 const f=steppedFrame(frame,2),enter=spring({frame:f,fps:30,config:{damping:13,stiffness:130,mass:.8}}),exit=interpolate(f,[Math.max(0,duration-5),duration],[1,.94],clamp); let x=0,y=0,rotate=0,scale=enter*exit;
 if(['paper-slide','document-pull','torn-reveal','mechanical-reveal'].includes(preset))x=(1-enter)*(preset==='paper-slide'?-180:120);
 if(['paper-drop','stamp-hit','pin-drop','tape-press'].includes(preset))y=(1-enter)*-150;
 if(preset==='stamp-hit')scale*=interpolate(f,[0,5,8],[1.3,.96,1],clamp);
 if(preset==='halftone-flicker')rotate=Math.sin(f*.7)*.12;
 if(preset==='paper-corner-lift'||preset==='shadow-breathe')scale*=1+Math.sin(f*.08)*.004;
 return {transform:`translate(${x}px,${y}px) rotate(${rotate}deg) scale(${scale})`,opacity:interpolate(f,[0,4],[0,1],clamp)};
}
