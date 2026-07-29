import {words} from './utils.mjs';
export function makeBeats(script,duration,fps=30){
  const all=words(script.script); const groups=[]; for(let i=0;i<all.length;){const remaining=all.length-i; const size=remaining<10?remaining:Math.min(7,remaining); groups.push(all.slice(i,i+size)); i+=size;}
  let cursor=0; const beats=groups.map((group,index)=>{const end=index===groups.length-1?Math.round(duration*fps):Math.round((duration*fps*(index+1))/groups.length); const beat={id:`beat-${String(index+1).padStart(3,'0')}`,sentenceId:script.sentences.find((s)=>s.text.includes(group[0]))?.id||script.sentences[Math.min(index,script.sentences.length-1)].id,startSeconds:cursor/fps,endSeconds:end/fps,startFrame:cursor,durationInFrames:end-cursor,narration:group.join(' '),coreIdea:group.slice(0,4).join(' '),importance:index===0?'hook':index===groups.length-1?'resolution':'context'}; cursor=end; return beat;});
  const reconstructed=beats.flatMap((b)=>words(b.narration)).join(' '); if(reconstructed!==all.join(' ')) throw new Error('Beat kelime kapsamı yüzde 100 değil.');
  return {fps,durationSeconds:cursor/fps,beats,alignment:{method:'estimated',warning:'Kelime alignment sağlayıcısı yok; deterministik oransal zamanlama kullanıldı.'}};
}
