const TRAFFIC = {
  topic:'Dünyanın ilk trafik ışığı',
  verifiedFacts:[
    {id:'fact-001',claim:'Dünyanın ilk trafik sinyali Aralık 1868 tarihinde Londra Westminster bölgesinde Parlamento yakınında kuruldu.',confidence:0.98,sources:[{title:'UK Parliament, Traffic lights',url:'https://www.parliament.uk/about/living-heritage/transformingsociety/transportcomms/roadsrail/overview/trafficlights/'}]},
    {id:'fact-002',claim:'Sinyal demiryolu semaforlarını örnek alıyor, geceleri gazla aydınlatılıyordu ve bir polis memuru tarafından elle çalıştırılıyordu.',confidence:0.96,sources:[{title:'UK Parliament, Traffic lights',url:'https://www.parliament.uk/about/living-heritage/transformingsociety/transportcomms/roadsrail/overview/trafficlights/'}]},
    {id:'fact-003',claim:'Gaz sızıntısının yol açtığı patlama görevli polisi yaraladı ve düzenek kaldırıldı.',confidence:0.9,sources:[{title:'Historic England, Traffic lights',url:'https://historicengland.org.uk/listing/what-is-designation/heritage-highlights/traffic-lights/'}]}
  ],uncertainClaims:[],conflictingClaims:[],forbiddenClaims:['Patlamada ölüm olduğu iddiası'],visualObjects:['gazla çalışan trafik semaforu','Westminster','at arabaları']
};
export function researchTopic(topic){
  if(/trafik.*(ış|is)|traffic light/iu.test(topic)) return {...TRAFFIC,topic};
  return {topic,verifiedFacts:[],uncertainClaims:[{claim:'Bu konu için yapılandırılmış araştırma sağlayıcısı veya editör kaynağı yok.',reason:'no-provider'}],conflictingClaims:[],forbiddenClaims:[],visualObjects:[],warning:'Araştırma sağlayıcısı yok. Kritik iddialar doğrulanmadan render durdurulur.'};
}

export class ResearchProvider {
  constructor(name, lookup) { this.name=name; this.lookup=lookup; }
  async research(topic) { return this.lookup(topic); }
}
export const fixtureResearchProvider = new ResearchProvider('verified-fixture', researchTopic);
