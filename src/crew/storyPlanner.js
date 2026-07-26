/**
 * GÖRSEL HİKÂYE PLANLAYICI (V3 Faz 2) — SIRALAMAYI TERSİNE ÇEVİRİR.
 *
 * Audit'in kök nedeni buydu (docs/visual-storytelling-v3.md §1.1):
 *   ESKİ: görsel üretilir → sonra anlam çözümlenir → anlam görselin ÜSTÜNE
 *         yapıştırılır. Bu dekorasyonun tanımıdır.
 *   YENİ: anlatım → GÖRSEL HİKÂYE → o hikâyeyi BARINDIRABİLECEK görsel.
 *
 * Somut fark: "Yuva sıcaklığı sabit kalıyor" cümlesi için eski sistem
 * "sinematik yuva çekimi, altın ışık" istiyordu; o görsel üretilince hava
 * akışını göstermek İMKÂNSIZ hale geliyordu çünkü kadrajda kesit yoktu.
 * Artık şablon 'mechanism' seçilir ve görselden KESİT istenir — böylece
 * aktör katmanı (sıcak/soğuk hava okları) çizilebilecek bir zemin bulur.
 *
 * DAYANIKLILIK: çekirdek DETERMİNİSTİKtir (AI gerekmez). Sağlayıcı zinciri
 * bu projede defalarca düştü; görsel hikâye planı bir LLM çağrısına bağlı
 * olamaz. classifyBeat zaten çevrimdışı çalışıyor ve şablon seçimi için
 * yeterli sinyali veriyor.
 */
import { classifyBeat } from '../visual/semanticDirector.js';
import { resolvePlace } from '../visual/geo.js';

/**
 * ŞABLON → GÖRSELDEN İSTENEN KOMPOZİSYON.
 *
 * Bu tablo Faz 2'nin kalbidir: her şablon, aktörlerinin çizilebilmesi için
 * görselin NE İÇERMESİ gerektiğini söyler. Metin doğrudan image_prompt'un
 * BAŞINA eklenir (üreticiler baştaki kelimelere daha çok ağırlık verir).
 */
const TEMPLATES = {
  mechanism: {
    composition:
      'cutaway cross-section view showing the interior structure, side elevation, '
      + 'internal chambers and channels clearly visible, even neutral lighting, '
      + 'clear separation between inside and outside',
    camera: { start: 'wide', end: 'detail', motivation: 'follow-the-flow' },
    viewerTask: 'Follow where it moves inside',
  },
  flow: {
    composition:
      'wide establishing view with an open uncluttered middle ground where a path '
      + 'can be traced across the frame, the subject small and clearly separated '
      + 'from the background',
    camera: { start: 'wide', end: 'follow', motivation: 'follow-the-subject' },
    viewerTask: 'Follow the trail',
    actorFromFocus: true,
  },
  comparison: {
    composition:
      'two distinct subjects side by side in the same frame, equal visual weight, '
      + 'clean separation between them, uncluttered background',
    camera: { start: 'wide', end: 'wide', motivation: 'hold-both-sides' },
    viewerTask: 'Spot which one wins',
  },
  scale: {
    composition:
      'the subject shown next to a familiar everyday object for size reference, '
      + 'both fully visible in frame, plain background',
    camera: { start: 'detail', end: 'wide', motivation: 'pull-back-to-reveal-size' },
    viewerTask: 'Guess how big it really is',
  },
  search_reveal: {
    composition:
      'many similar elements filling the frame, exactly one of them visually '
      + 'distinct in colour or posture, high detail',
    camera: { start: 'wide', end: 'detail', motivation: 'scan-then-lock' },
    viewerTask: 'Find the odd one',
    // Halka ÖLÇÜLEN konuma kilitlenir; sınıflandırıcı sessiz kalsa bile aktör var.
    actorFromFocus: true,
  },
  construction: {
    composition:
      'layered structure seen from the side, base and top both visible, '
      + 'construction stages readable, plain sky or backdrop behind',
    camera: { start: 'low', end: 'up', motivation: 'rise-with-the-build' },
    viewerTask: 'Watch it rise',
    // Katmanlar ölçülen tabandan yukarı birikir (build_up aktörü).
    actorFromFocus: true,
  },
  map: {
    composition:
      'geographic context from high above, aerial or satellite-like view, '
      + 'terrain and coastline readable, no text',
    camera: { start: 'wide', end: 'detail', motivation: 'zoom-to-place' },
    viewerTask: 'Find where it happens',
  },
  chain: {
    composition:
      'the subject centred with clear empty space around it, uncluttered '
      + 'background so step markers stay readable',
    camera: { start: 'wide', end: 'detail', motivation: 'step-to-step' },
    viewerTask: 'Follow what triggers what',
  },
  quantity: {
    composition:
      'many countable instances of the subject spread across the frame, '
      + 'even lighting, plain background so the count reads clearly',
    camera: { start: 'detail', end: 'wide', motivation: 'reveal-the-amount' },
    viewerTask: 'Sense how many there are',
  },
  // --- audit §3.2'deki kalan şablonlar ---
  communication: {
    composition:
      'a single clearly separated subject in the centre with open empty space '
      + 'around it, a second subject visible further away in the same frame, '
      + 'plain uncluttered background',
    camera: { start: 'source', end: 'receiver', motivation: 'trace-the-signal' },
    viewerTask: 'See who the signal reaches',
    // Konumu ÖLÇÜLMÜŞ kaynaktan yayılan dalgalar çizilir.
    actorFromFocus: true,
  },
  cause_effect: {
    composition:
      'the trigger and its result both visible in one frame, the trigger small '
      + 'and sharp in the foreground, the consequence larger behind it, '
      + 'clean separation between the two',
    camera: { start: 'tight', end: 'wide', motivation: 'tight-then-wide' },
    viewerTask: 'See what sets it off',
    actorFromFocus: true,
  },
  chain_reaction: {
    composition:
      'many identical elements filling the frame with one obvious origin point, '
      + 'even spacing, plain background so the spread reads clearly',
    camera: { start: 'tight', end: 'wide', motivation: 'widen-with-the-spread' },
    viewerTask: 'Watch how far it spreads',
    actorFromFocus: true,
  },
  timeline: {
    composition:
      'the subject shown plainly with generous empty space in the lower third '
      + 'of the frame, uncluttered background, even lighting',
    camera: { start: 'wide', end: 'wide', motivation: 'hold-the-timeline' },
    viewerTask: 'See when it changed',
    // Zaman işaretleri UYDURULMAZ: anlatımdan en az 2 gerçek nokta çıkmalı.
    needsTimeMarks: true,
  },
  navigation: {
    composition:
      'wide aerial-like view of the terrain with a clear open route across the '
      + 'frame, start and destination both visible, no text',
    camera: { start: 'wide', end: 'follow', motivation: 'follow-the-route' },
    viewerTask: 'Follow the route',
    actorFromFocus: true,
  },
  problem_solution: {
    composition:
      'the obstacle and the subject facing it in the same frame, the obstacle '
      + 'dominant, the subject small but clearly visible, plain background',
    camera: { start: 'tight', end: 'wide', motivation: 'tight-then-open' },
    viewerTask: 'Spot how it gets around it',
    actorFromFocus: true,
  },
  // ---- V3 ŞABLONLARI (§4) ----
  // Hepsi AKTİF anlatım içindir: ekranda bir şey OLUR, sadece durmaz.
  //
  // FİLTRELEME — "beyin önemsiz ayrıntıları eler". Eski davranışta bu cümle
  // atmosphere'a düşüyor ve ekranda bir bilim insanı hologramına bakıyordu.
  // İzleyicinin göreceği şey: çok sayıda kart, önemliler parlak kalır,
  // önemsizler soluklaşıp kaybolur, sayaç azalır.
  filtering: {
    composition:
      'many small information cards or fragments spread across a dark uncluttered '
      + 'field, a few of them clearly brighter and sharper than the rest, '
      + 'the dim ones fading toward the edges, no text',
    camera: { start: 'wide', end: 'detail', motivation: 'watch-what-survives' },
    viewerTask: 'Watch what gets kept',
    actorFromFocus: true,
  },
  // YENİDEN KURMA — "eksik anıyı tamamlar". Parçalanmış görüntü, boşluklar,
  // parçaların sırayla yerleşmesi, son parçanın TAHMİN olduğu belli olacak.
  reconstruct: {
    composition:
      'a fragmented image broken into irregular pieces with visible gaps between '
      + 'them, several pieces missing entirely, the empty slots clearly outlined, '
      + 'plain background, no text',
    camera: { start: 'detail', end: 'wide', motivation: 'watch-it-complete' },
    viewerTask: 'Spot the piece that was guessed',
    actorFromFocus: true,
  },
  // GERİ ÇAĞIRMA — "veri deposundan kayıt bulunur". Depolama blokları, sorgu,
  // doğru bloğun aydınlanması, verinin merkeze taşınması.
  retrieval: {
    composition:
      'a grid of identical storage blocks filling the frame, one single block '
      + 'clearly brighter and isolated from the others, clean geometric layout, '
      + 'even lighting, no text',
    camera: { start: 'wide', end: 'detail', motivation: 'find-the-record' },
    viewerTask: 'Find the one that lights up',
    actorFromFocus: true,
  },
  // DUYGU BAĞI — "anılar duyguyla bağlanır". Merkezde anı, çevresinde bağlanan
  // düğümler; bağlantılar SIRAYLA oluşur (tek karede hepsi değil).
  emotion_link: {
    composition:
      'one central subject with several distinct smaller elements arranged around '
      + 'it at clear distances, empty space between them so connections can be '
      + 'drawn, plain uncluttered background, no text',
    camera: { start: 'detail', end: 'wide', motivation: 'watch-links-form' },
    viewerTask: 'Watch what connects to it',
    actorFromFocus: true,
  },
  // Yapı çıkarılamayan sahne: hikâye zorlanmaz, güzel ama SAKİN bir kadraj.
  atmosphere: {
    composition: null, // image_prompt'a dokunma
    camera: { start: 'wide', end: 'wide', motivation: 'let-it-breathe' },
    viewerTask: null,
  },
};

/**
 * ÖZNE OKUNABİLİRLİĞİ — konuma bağlı aktörlerin ön şartı.
 *
 * Canlı ders (26 Tem, deniz hıyarı): sahneler baştan sona mercan dokusuyla
 * dolu üretildi. O kadrajlarda odak tespiti öznenin yerini ÖLÇEMEZ (kabarcık
 * tarlasına kilitlendi), ölçemeyince de halka/iz çizilmez ve sahne dekoratif
 * kalır. Yani "aktör yok" sorununun kaynağı aktör katmanı değil, GÖRSELDİ.
 *
 * Sığ alan derinliği tam olarak ölçüm için gereken şeyi üretir: kadrajda tek
 * bir net, doygun bölge — ölçülebilir bir özne. Konum gerektiren her şablonun
 * kompozisyonuna eklenir.
 */
const SUBJECT_CLARITY =
  ' Exactly one subject in sharp focus, everything else softly blurred '
  + '(shallow depth of field), the subject clearly brighter and more saturated '
  + 'than its surroundings, no busy foreground clutter';

/** Beat türü → şablon. Aktör katmanının ürettiğiyle hizalı. */
const BEAT_TO_TEMPLATE = {
  behavior: 'flow',
  process: 'mechanism',
  number: 'quantity',
  compare: 'comparison',
  location: 'map',
};

/**
 * ZAMAN İŞARETLERİ — anlatımdan ÇIKARILIR, uydurulmaz.
 *
 * timeline şablonu ancak gerçek iki zaman noktası varsa seçilir; yoksa eksen
 * boş kalırdı ve "zaman geçiyor" iddiası dayanaksız olurdu (tuzak 2: konum/veri
 * uydurma). En az 2 nokta bulunamazsa şablon devreye girmez.
 */
export function extractTimeMarks(text = '') {
  const years = [...new Set(text.match(/\b(?:1[5-9]\d{2}|20\d{2})\b/g) || [])];
  if (years.length >= 2) {
    return years.sort((a, b) => Number(a) - Number(b)).slice(0, 4).map((label) => ({ label }));
  }
  const rel = (text.match(/\b\d[\d,.]*\s*(?:million|billion|thousand)?\s*(?:years?|days?|hours?|months?|weeks?)\b/gi) || [])
    .map((s) => s.trim().replace(/\s+/g, ' '));
  const uniq = [...new Set(rel)];
  return uniq.length >= 2 ? uniq.slice(0, 4).map((label) => ({ label })) : [];
}

/**
 * Sahne metninden ek şablon sinyalleri (beat sınıfının üstüne biner).
 * SIRA ÖNEMLİ: ilk eşleşen kazanır, bu yüzden yapısal olarak daha belirgin
 * olanlar (yayılma, sebep-sonuç) genel olanlardan (mekanizma) ÖNCE gelir.
 */
const OVERRIDES = [
  { template: 'chain_reaction', re: /\b(spreads?|spreading|chain reaction|cascade|ripples? (?:out|through)|domino|outbreak|multiply|multiplies)\b/i },
  { template: 'cause_effect', re: /\b(causes?|caused|triggers?|triggered|leads? to|led to|results? in|sets? off)\b/i },
  { template: 'communication', re: /\b(signals?|signall\w+|warns?|warning|alarm|alerts?|communicat\w+|calls? out|message)\b/i },
  // KARŞILAŞTIRMA — canlı boşluk (26 Tem, kolibri): "Unlike humans with three,
  // hummingbirds possess four distinct types" apaçık bir karşılaştırmaydı ama
  // sınıflandırıcı sessiz kaldı, sahne 'atmosphere' oldu. Sahnelerin %70'i
  // hikâyesiz kalınca kapı haklı olarak düştü. Karşıtlık belirteçleri açık bir
  // yapısal sinyaldir.
  { template: 'comparison', re: /\b(unlike|whereas|in contrast|compared with|instead of|while (?:humans|we|most)|but (?:humans|we|most))\b/i },
  { template: 'search_reveal', re: /\b(hidden|camouflage|disguise|spot|find|invisible|blend)\b/i },
  { template: 'construction', re: /\b(build|builds|built|construct|assembl\w+|stack|layer|tower)\b/i },
  { template: 'navigation', re: /\b(route|migrat\w+|journey|navigat\w+|finds? its way|homing|way back)\b/i },
  { template: 'problem_solution', re: /\b(problem|solution|solves?|solved|overcomes?|gets? around|way around)\b/i },
  { template: 'scale', re: /\b(size of|as (?:big|tall|long) as|compared to a|towering|tiny|giant|massive)\b/i },
  { template: 'mechanism', re: /\b(cross-?section|inside|interior|chamber|tunnel|valve|pump|circulat\w+|ventilat\w+)\b/i },
];

/**
 * ================== ATMOSPHERE KAÇIŞI (§3) ==================
 *
 * brain-vs-ai-memory videosunda 10 sahnenin 9'u `atmosphere` sınıfına düştü.
 * Sonuç, izleyicinin gördüğü şeydi: bilim insanı holograma bakıyor → sunucu
 * odası → mavi beyin → tekrar bilim insanı. Anlatım eylemden söz ediyordu
 * ("beyin ayrıntıları filtreler", "AI kaydı geri çağırır") ama ekranda hiçbir
 * eylem yoktu, çünkü sınıflandırıcı sessiz kalınca sahne "güzel ama sakin
 * kadraj" oluyordu.
 *
 * YENİ KURAL: içinde EYLEM, KARŞILAŞTIRMA, DEĞİŞİM, FİLTRELEME, SEÇİM,
 * AKTARIM, DÖNÜŞÜM, SEBEP-SONUÇ ya da SÜREÇ bulunan cümle atmosphere OLAMAZ.
 * atmosphere yalnızca kısa establishing shot, duygu geçişi, ortam tanıtımı ve
 * final nefes alan plan için kalır.
 *
 * Sıra önemlidir: ilk eşleşen kazanır, en belirgin yapı en üstte.
 */
const ACTION_SIGNALS = [
  { template: 'filtering', re: /\b(filters?|filtered|filtering|discards?|discarded|ignores?|screens? out|weeds? out|prunes?|keeps? only|throws? away|sifts?|sorts? out)\b/i },
  { template: 'retrieval', re: /\b(retrieves?|retrieval|recalls?|looks? up|searches?|queries|queried|fetch(?:es|ed)?|pulls? up|finds? the record|stored? (?:data|records?))\b/i },
  { template: 'reconstruct', re: /\b(reconstructs?|rebuilds?|fills? (?:in|the gaps?)|pieces? together|completes? the|restores?|patches?|gaps?|missing (?:pieces?|parts?|details?))\b/i },
  { template: 'emotion_link', re: /\b(links?|linked|linking|connects?|connected|associat\w+|ties? (?:to|together)|bound (?:to|up)|attached to)\b/i },
  { template: 'comparison', re: /\b(unlike|whereas|in contrast|compared (?:with|to)|instead of|versus|vs\.?|while (?:humans?|we|most|ai)|but (?:humans?|we|most|ai)|neither|both)\b/i },
  { template: 'timeline', re: /\b(changes? over time|over the years|as time passes|later|decades?|gradually|slowly (?:becomes?|turns?)|ages?|fades? with)\b/i },
  { template: 'cause_effect', re: /\b(causes?|caused|triggers?|triggered|leads? to|led to|results? in|because|so that|which makes?)\b/i },
  // AKTARIM — canlı boşluk (fungal-networks): "Trees share nutrients with each
  // other through this connection" apaçık bir aktarım eylemiydi ama listede
  // `share` yoktu; sahne atmosphere'a düştü ve ekranda hiçbir şey olmadı.
  { template: 'flow', re: /\b(moves?|travels?|carries|carried|transfers?|transferred|sends?|passes? (?:through|to)|flows?|delivers?|shares?|shared|sharing|exchanges?|distributes?|supplies|supplied|feeds?|trades?)\b/i },
  { template: 'mechanism', re: /\b(works? by|process|processes|converts?|transforms?|turns? into|becomes?|encodes?|decodes?|breaks? down|builds? up)\b/i },
  { template: 'quantity', re: /\b\d[\d,.]*\s*(?:gb|tb|mb|kg|km|percent|%|times|million|billion|thousand)\b/i },
];

/**
 * Cümle bir EYLEM anlatıyor mu? Anlatıyorsa hangi şablon?
 * @param {string} text
 * @returns {string|null} şablon adı ya da null
 */
export function activeTemplateFor(text = '') {
  for (const a of ACTION_SIGNALS) if (a.re.test(text)) return a.template;
  return null;
}

/** Bir cümlenin "eylem yoğunluğu" — tavan aşıldığında hangi sahnenin önce
 *  yeniden sınıflandırılacağını seçmek için. Kaç ayrı sinyal eşleşiyor? */
export function actionDensity(text = '') {
  return ACTION_SIGNALS.reduce((n, a) => n + (a.re.test(text) ? 1 : 0), 0);
}

/** Bir videoda atmosphere sahnelerinin izin verilen en yüksek oranı. */
export const MAX_ATMOSPHERE_SHARE = 0.20;

/**
 * Bir sahne için görsel hikâye planı.
 * @param {object} scene {narration, image_prompt}
 * @param {number} index
 * @returns {object} plan
 */
export function planScene(scene = {}, index = 0) {
  const narration = scene.narration || '';
  const beat = classifyBeat(narration);

  // Şablon seçimi: beat sınıfı temel, metin override'ı ince ayar.
  //
  // GÜÇLÜ BEAT'LER EZİLMEZ: 'number' ve 'compare' yapısal olarak nettir
  // (sayı var / iki taraf var). Genel kelimeler bunları ezmemeli — canlıda
  // "Over 3000 workers live INSIDE one colony" cümlesindeki "inside",
  // mekanizma override'ını tetikleyip sayım şablonunu eziyordu.
  const STRONG = new Set(['number', 'compare']);
  let template = beat ? BEAT_TO_TEMPLATE[beat.kind] : null;

  // HARİTA ŞABLONU GERÇEK COĞRAFYA İSTER.
  //
  // Canlı hata (26 Tem, deniz hıyarı): sınıflandırıcı "on the ocean floor",
  // "in the deep sea" gibi her yer ifadesini 'location' sayıyor, bu da harita
  // şablonunu seçiyordu. Şablon image_prompt'un başına "aerial or
  // satellite-like view, terrain and coastline readable" yazdığı için
  // 10 sahnenin 4'ü ÖZNESİZ geniş resif manzarası olarak üretildi —
  // videoda deniz hıyarını göremiyorsun. Üstelik yer adı Natural Earth'te
  // çözülemediği için harita paneli de zaten çizilmiyordu: kompozisyonu
  // mahvedip karşılığında hiçbir şey vermeyen bir şablon.
  //
  // Artık harita, ancak ad GERÇEK bir coğrafyaya çözülüyorsa seçilir.
  if (template === 'map' && !resolvePlace(beat?.payload?.place)) template = null;
  if (!beat || !STRONG.has(beat.kind)) {
    for (const o of OVERRIDES) {
      if (o.re.test(narration)) { template = o.template; break; }
    }
  }
  // ZAMAN EKSENİ dayanağı: işaret çıkmıyorsa timeline seçilmez.
  const marks = extractTimeMarks(narration);
  if (TEMPLATES[template]?.needsTimeMarks && marks.length < 2) template = null;
  // İki gerçek zaman noktası varsa bu bir SAYIM değil, bir zaman çizgisidir.
  // "Between 1969 and 2024..." cümlesinde sınıflandırıcı yılları sayı sanıp
  // sayaç şablonu seçiyordu — ekranda "2.024" diye dolan bir ölçek anlamsız.
  if (marks.length >= 2 && (!template || template === 'quantity')) template = 'timeline';
  // ATMOSPHERE'A DÜŞMEDEN ÖNCE SON SORU: bu cümle bir EYLEM anlatıyor mu?
  // Anlatıyorsa sakin kadraj yanlış cevaptır — izleyici anlatılan şeyi
  // göremeyecek demektir.
  if (!template) template = activeTemplateFor(narration);
  if (!template) template = 'atmosphere';
  const spec = TEMPLATES[template] || TEMPLATES.atmosphere;

  // MEKANİZMA AKIŞI — belgedeki amiral örneğin dayanağı ("sıcak hava yükselir,
  // soğuk hava iner"). Cümle gerçekten bir AKIŞTAN söz etmiyorsa ok çizilmez:
  // "inside/chamber" geçen her cümleye hava akışı oku koymak, olmayan bir
  // iddiada bulunmak olurdu (tuzak 2'nin akış hâli).
  let flow = null;
  if (template === 'mechanism') {
    if (/\b(heat|hot|warm|cold|cool|temperature|thermal)\b/i.test(narration)) flow = 'thermal';
    else if (/\b(air|flows?|flowing|moves? through|travels? through|carried|pumped|circulat\w+|ventilat\w+|drains?|rises?|sinks?)\b/i.test(narration)) flow = 'generic';
  }

  // AKTÖR BEAT'İ: eskiden yalnızca classifyBeat bir şey döndürdüğünde vardı;
  // bu yüzden override ile seçilen şablonlar (search_reveal, communication…)
  // hiç aktör alamıyor, sahne dekoratif kalıyordu. Artık şablonun kendisi
  // aktör üretebiliyorsa beat taşınır — sınıflandırıcı sessiz kalsa bile.
  const actorable = Boolean(beat) || spec.actorFromFocus
    || (spec.needsTimeMarks && marks.length >= 2) || Boolean(flow);

  return {
    story_template: template,
    // Görselden İSTENEN kompozisyon — image_prompt'un başına eklenecek.
    // Konuma bağlı aktör kullanacak şablonlar ayrıca ÖLÇÜLEBİLİR bir özne
    // ister: sığ alan derinliği olmadan odak tespiti kalabalık dokuda kaybolur.
    composition: spec.composition
      ? spec.composition + (spec.actorFromFocus ? SUBJECT_CLARITY : '')
      : null,
    viewer_task: spec.viewerTask,
    camera_plan: spec.camera,
    // Aktör katmanı için beat (renderVideo yeniden sınıflandırmasın).
    beat: actorable
      ? {
        kind: beat?.kind || 'story',
        payload: {
          ...(beat?.payload || {}),
          ...(marks.length >= 2 ? { marks } : {}),
          ...(flow ? { flow } : {}),
        },
        template,
      }
      : null,
    scene_index: index,
  };
}

/**
 * Script'e görsel hikâye planı uygula. Sahneleri YERİNDE zenginleştirir:
 *   scene.story_template, scene.viewer_task, scene.camera_plan, scene.story_beat
 *   scene.image_prompt  ← kompozisyon gereği BAŞA eklenir
 *
 * @param {object} script generateScript çıktısı
 * @returns {{script:object, stats:object}}
 */
export function planVisualStory(script = {}) {
  const scenes = script.scenes || [];
  const counts = {};
  let composed = 0;

  scenes.forEach((scene, i) => {
    const plan = planScene(scene, i);
    scene.story_template = plan.story_template;
    scene.viewer_task = plan.viewer_task;
    scene.camera_plan = plan.camera_plan;
    scene.story_beat = plan.beat;

    // KRİTİK: kompozisyon gereği image_prompt'un BAŞINA eklenir. Görsel artık
    // hikâyeyi barındırmak ZORUNDA — "güzel manzara" değil, "kesit" istenir.
    if (plan.composition && scene.image_prompt) {
      scene.image_prompt = `${plan.composition}. ${scene.image_prompt}`;
      composed += 1;
    }
    counts[plan.story_template] = (counts[plan.story_template] || 0) + 1;
  });

  // ---- ATMOSPHERE TAVANI (§3): en fazla %20 ----
  //
  // Tek tek bakıldığında her sahne haklı olarak atmosphere olabilir; toplamda
  // videonun %90'ı atmosphere olduğunda ortaya "güzel görseller slayt gösterisi"
  // çıkar. Tavan aşılırsa EN EYLEM YOĞUN atmosphere sahneleri yeniden
  // sınıflandırılır — en zayıf olanlar değil, çünkü amaç en çok kazandıracak
  // sahneyi kurtarmak.
  const reclassified = [];
  const limit = Math.max(1, Math.floor(scenes.length * MAX_ATMOSPHERE_SHARE));
  let atmosphereIdx = scenes
    .map((sc, i) => ({ i, sc, density: actionDensity(sc.narration || '') }))
    .filter((x) => x.sc.story_template === 'atmosphere');

  if (atmosphereIdx.length > limit) {
    // Eylem yoğunluğu YÜKSEK olan önce kurtarılır; hiç sinyali olmayanlar
    // gerçekten sakin sahnelerdir ve atmosphere olarak kalmayı hak eder.
    atmosphereIdx.sort((a, b) => b.density - a.density);
    const toFix = atmosphereIdx.filter((x) => x.density > 0).slice(0, atmosphereIdx.length - limit);
    for (const { i, sc } of toFix) {
      const forced = activeTemplateFor(sc.narration || '');
      if (!forced || forced === 'atmosphere') continue;
      const spec = TEMPLATES[forced];
      counts.atmosphere -= 1;
      counts[forced] = (counts[forced] || 0) + 1;
      sc.story_template = forced;
      sc.viewer_task = spec.viewerTask;
      sc.camera_plan = spec.camera;
      sc.story_beat = { kind: 'story', payload: {}, template: forced };
      if (spec.composition && sc.image_prompt) {
        sc.image_prompt = `${spec.composition}. ${sc.image_prompt}`;
        composed += 1;
      }
      reclassified.push({ scene: i, to: forced });
    }
  }

  const atmosphereOnly = counts.atmosphere || 0;
  const atmosphereShare = scenes.length ? +(atmosphereOnly / scenes.length).toFixed(2) : 0;

  return {
    script,
    stats: {
      total: scenes.length,
      composed,                       // kompozisyonu hikâyeye göre kısıtlanan sahne
      byTemplate: counts,
      viewerTasks: scenes.filter((s) => s.viewer_task).length,
      atmosphereOnly,
      atmosphereShare,
      atmosphereCapExceeded: atmosphereShare > MAX_ATMOSPHERE_SHARE,
      reclassified,
    },
  };
}

export const STORY_TEMPLATES = Object.keys(TEMPLATES);

/**
 * Şablon tanımları — semantik düzeltme turu bir sahneyi yükseltirken aynı
 * kompozisyon/kamera/izleyici-görevi sözleşmesini kullanmak zorunda. İki yerde
 * ayrı ayrı tanımlanan şablonlar zamanla birbirinden ayrılır.
 */
export const STORY_TEMPLATE_SPECS = TEMPLATES;
