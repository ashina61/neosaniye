import {words} from './utils.mjs';

const TRAFFIC_SCRIPT = 'Aralık 1868. Londra, Westminster. Bir polis memuru, Parlamento önündeki kalabalık caddede demir bir kolu çevirdi. Yukarıdaki semafor at arabalarına dur ya da geç işareti verdi. Bu düzenek, demiryolu sinyallerinden esinlenen dünyanın ilk trafik ışığıydı. Gündüz iki hareketli kol görünüyordu. Geceyse kırmızı ve yeşil ışıklar gazla yakılıyordu. Sistem otomatik değildi. Altındaki polis, kolları ve lambayı elle yönetiyordu. Ama gaz borusundaki sızıntı kısa süre sonra patlamaya yol açtı. Görevli polis yaralandı. Tehlikeli düzenek kaldırıldı. Elektrikli sinyaller onlarca yıl sonra yaygınlaştı. Bugünkü ışıkların atası, motorlu otomobillerden önce doğmuştu. İlk trafik ışığı, Westminster önünde kısa ve tehlikeli bir deneydi.';
export function buildScript({projectId,topic,language,duration,research}){
  if(language!=='tr') throw new Error('Offline MVP script provider yalnızca tr dilini destekler. Bir LLM provider yapılandırın.');
  if(!research.verifiedFacts.length) throw new Error('Doğrulanmış araştırma olmadan senaryo üretilemez.');
  const text=TRAFFIC_SCRIPT.replace(/—/g,'-'); const sentences=text.match(/[^.]+\./g).map((x)=>x.trim());
  const result={projectId,language,title:'Dünyanın İlk Trafik Işığının Tuhaf Hikâyesi',durationTargetSeconds:duration,targetWords:Math.round(duration*2.5),actualWords:words(text).length,hook:'Aralık 1868. Londra, Westminster.',script:text,sentences:sentences.map((value,index)=>({id:`sentence-${String(index+1).padStart(3,'0')}`,text:value,function:index<3?'cold_open':index===sentences.length-1?'resolution':'development'})),factClaims:research.verifiedFacts.map(({id,claim})=>({id,claim,supportedBy:id}))};
  if(result.actualWords < result.targetWords*.95 || result.actualWords > result.targetWords*1.05) throw new Error(`Senaryo kelime hedefi dışında: ${result.actualWords}/${result.targetWords}.`);
  return result;
}
