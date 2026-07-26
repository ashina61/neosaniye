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
  },
  construction: {
    composition:
      'layered structure seen from the side, base and top both visible, '
      + 'construction stages readable, plain sky or backdrop behind',
    camera: { start: 'low', end: 'up', motivation: 'rise-with-the-build' },
    viewerTask: 'Watch it rise',
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
  // Yapı çıkarılamayan sahne: hikâye zorlanmaz, güzel ama SAKİN bir kadraj.
  atmosphere: {
    composition: null, // image_prompt'a dokunma
    camera: { start: 'wide', end: 'wide', motivation: 'let-it-breathe' },
    viewerTask: null,
  },
};

/** Beat türü → şablon. Aktör katmanının ürettiğiyle hizalı. */
const BEAT_TO_TEMPLATE = {
  behavior: 'flow',
  process: 'mechanism',
  number: 'quantity',
  compare: 'comparison',
  location: 'map',
};

/** Sahne metninden ek şablon sinyalleri (beat sınıfının üstüne biner). */
const OVERRIDES = [
  { template: 'search_reveal', re: /\b(hidden|camouflage|disguise|spot|find|invisible|blend)\b/i },
  { template: 'construction', re: /\b(build|builds|built|construct|assembl\w+|stack|layer|tower)\b/i },
  { template: 'scale', re: /\b(size of|as (?:big|tall|long) as|compared to a|towering|tiny|giant|massive)\b/i },
  { template: 'mechanism', re: /\b(cross-?section|inside|interior|chamber|tunnel|valve|pump|circulat\w+|ventilat\w+)\b/i },
];

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
  if (!beat || !STRONG.has(beat.kind)) {
    for (const o of OVERRIDES) {
      if (o.re.test(narration)) { template = o.template; break; }
    }
  }
  if (!template) template = 'atmosphere';
  const spec = TEMPLATES[template] || TEMPLATES.atmosphere;

  return {
    story_template: template,
    // Görselden İSTENEN kompozisyon — image_prompt'un başına eklenecek.
    composition: spec.composition,
    viewer_task: spec.viewerTask,
    camera_plan: spec.camera,
    // Aktör katmanı için beat (renderVideo yeniden sınıflandırmasın).
    beat: beat ? { kind: beat.kind, payload: beat.payload } : null,
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

  return {
    script,
    stats: {
      total: scenes.length,
      composed,                       // kompozisyonu hikâyeye göre kısıtlanan sahne
      byTemplate: counts,
      viewerTasks: scenes.filter((s) => s.viewer_task).length,
      atmosphereOnly: counts.atmosphere || 0,
    },
  };
}

export const STORY_TEMPLATES = Object.keys(TEMPLATES);
