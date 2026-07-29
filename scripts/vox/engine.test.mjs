import assert from 'node:assert/strict';
import test from 'node:test';
import {makeBeats} from './beats.mjs';
import {researchTopic} from './research.mjs';
import {buildScript} from './script-engine.mjs';
import {parseArgs} from './utils.mjs';

test('VOX CLI güvenli varsayılanlar ve aralık doğrulaması kullanır',()=>{const value=parseArgs(['--topic','Dünyanın ilk trafik ışığı']);assert.equal(value.language,'tr');assert.equal(value.noUpload,true);assert.throws(()=>parseArgs(['--topic','x','--duration','50']),/35 ile 45/);});
test('araştırma destekli senaryo hedef kelime aralığında ve em dash olmadan üretilir',()=>{const research=researchTopic('Dünyanın ilk trafik ışığı');const script=buildScript({projectId:'test',topic:research.topic,language:'tr',duration:40,research});assert.ok(script.actualWords>=95&&script.actualWords<=105);assert.equal(script.script.includes('—'),false);assert.ok(script.factClaims.every((x)=>x.supportedBy));});
test('beat motoru kelimeleri kayıpsız kapsar ve frame toplamını sabitler',()=>{const research=researchTopic('trafik ışığı');const script=buildScript({projectId:'test',topic:research.topic,language:'tr',duration:40,research});const result=makeBeats(script,40);assert.equal(result.beats.map((x)=>x.narration).join(' '),script.script);assert.equal(result.beats.at(-1).startFrame+result.beats.at(-1).durationInFrames,1200);assert.ok(result.beats.every((x)=>x.durationInFrames>=30));});
