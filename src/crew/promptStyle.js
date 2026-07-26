/**
 * KATEGORİ BAZLI PROMPT STİLİ (§9) — "birbirine aykırı parçaları birlikte ekleme."
 *
 * ================== NEDEN VAR ==================
 * brain-vs-ai-memory promptu aynı anda şunları söylüyordu:
 *     "futuristic control room"
 *     "no futuristic or sci-fi elements"
 *     "no modern devices"
 * Üretici modele bu geldiğinde iki şey olur: ya çelişen kısıtlardan birini
 * rastgele yok sayar (çıktı öngörülemez olur), ya da ikisini birden
 * memnun etmeye çalışıp bulanık, karaktersiz bir görüntü üretir. Videonun
 * "hep aynı mavi hologram" görünmesinin sebeplerinden biri buydu.
 *
 * Sebep yapısaldı: yasak listesi GLOBAL'di. "Modern cihaz yok" kuralı doğa
 * belgeselleri için doğru, yapay zekâ konusu için saçmadır.
 *
 * ================== SÖZLEŞME ==================
 * Her kategori kendi `allow` / `forbid` / `prefer` listesini taşır.
 * `allow` listesindeki bir terim, başka bir kaynaktan gelen yasakla
 * ÇAKIŞIRSA yasak DÜŞER — izin açık bir editoryal karardır, yasak ise
 * genellikle savunma amaçlı geniş bir süpürgedir.
 */

/** Kategori → stil sözleşmesi. Anahtarlar script.category ile eşleşir. */
export const CATEGORY_STYLES = {
  science_future: {
    match: /\b(ai|artificial intelligence|robot|computer|algorithm|machine learning|neural|data|digital|quantum|space|future|technology|cyber)\b/i,
    allow: ['modern devices', 'servers', 'holographic interface', 'futuristic laboratory',
      'screens', 'circuit patterns', 'data visualization'],
    forbid: ['medieval objects', 'historical clothing', 'ancient ruins', 'oil painting style'],
    prefer: ['clean studio lighting', 'high contrast', 'shallow depth of field'],
  },
  history: {
    match: /\b(ancient|medieval|roman|egypt|empire|century|war|dynasty|archaeolog|ruins|historical|aqueduct|pyramid)\b/i,
    allow: ['period-accurate clothing', 'stone architecture', 'archival texture'],
    forbid: ['modern devices', 'holograms', 'futuristic architecture', 'smartphones',
      'neon lighting', 'digital screens'],
    prefer: ['natural daylight', 'documentary photography'],
  },
  nature: {
    match: /\b(animal|bird|fish|insect|plant|forest|ocean|species|wildlife|habitat|predator|migration|coral|jungle)\b/i,
    allow: ['natural habitat', 'wildlife photography', 'macro detail'],
    forbid: ['modern devices', 'holograms', 'futuristic architecture', 'text overlays',
      'human-made structures'],
    prefer: ['natural habitat', 'documentary photography', 'golden hour light'],
  },
  human_body: {
    match: /\b(brain|heart|blood|muscle|bone|cell|neuron|organ|immune|dna|body|memory|sleep|nerve)\b/i,
    allow: ['medical illustration', 'anatomical cross-section', 'scientific diagram',
      'modern devices', 'laboratory'],
    forbid: ['medieval objects', 'fantasy anatomy', 'gore'],
    prefer: ['clean clinical lighting', 'clear anatomical separation'],
  },
};

/** Hiçbir kategoriye girmeyen konular için nötr taban. */
export const NEUTRAL_STYLE = {
  allow: [],
  forbid: ['text', 'watermark', 'logo'],
  prefer: ['clear single subject', 'uncluttered background'],
};

/**
 * Konu/kategori metninden stil sözleşmesi seç.
 *
 * @param {object} script {topic, category, scenes}
 * @returns {{key:string, allow:string[], forbid:string[], prefer:string[]}}
 */
export function styleForScript(script = {}) {
  const explicit = String(script.category || '').toLowerCase().replace(/[\s-]+/g, '_');
  if (CATEGORY_STYLES[explicit]) return { key: explicit, ...CATEGORY_STYLES[explicit] };

  const text = [script.topic, script.visual_anchor,
    ...(script.scenes || []).map((s) => s.narration)].filter(Boolean).join(' ');
  for (const [key, spec] of Object.entries(CATEGORY_STYLES)) {
    if (spec.match?.test(text)) return { key, ...spec };
  }
  return { key: 'neutral', ...NEUTRAL_STYLE };
}

/**
 * ÇELİŞKİ TEMİZLEME — kategorinin AÇIKÇA izin verdiği bir şey yasaklanamaz.
 *
 * Karşılaştırma normalize edilir (küçük harf, tekil-ish) çünkü listeler farklı
 * kaynaklardan gelir ve "modern devices" ile "modern device" aynı şeydir.
 *
 * @param {string[]} forbidden aday yasak listesi
 * @param {string[]} allowed   kategorinin izin verdikleri
 * @returns {{kept:string[], removed:string[]}}
 */
// Çakışma aramasında anlam taşımayan kelimeler: "modern style elements" ile
// "modern devices" arasındaki tek ortaklık "modern" olabilir ve bu bir çakışma
// KANITI değildir.
const STYLE_STOPWORDS = new Set(['style', 'element', 'elements', 'object', 'objects',
  'thing', 'things', 'look', 'quality', 'detail', 'details', 'photo', 'image']);

/** Kelime kökü — çoğul/çekim farklarını yutar, ilk 6 harf yeterli ayrım verir. */
const stems = (term) => String(term).toLowerCase()
  .replace(/[^a-z\s-]/g, ' ')
  .split(/[\s-]+/)
  .filter((w) => w.length >= 4 && !STYLE_STOPWORDS.has(w))
  .map((w) => w.slice(0, 6));

export function resolveContradictions(forbidden = [], allowed = []) {
  // SUBSTRING YETMİYOR. "holograms" ile "holographic interface" arasında
  // substring ilişkisi YOKTUR ("hologram", "holographic" içinde geçmez —
  // 'holograp' diye ayrılır) ama ikisi apaçık aynı şeyi kastediyor. İlk
  // sürümde tam bu kaçtı: kategori holografik arayüze izin verirken negatif
  // prompt hâlâ "holograms" diyordu, yani çelişki temizleyicinin kendisi
  // çelişkiyi kaçırıyordu. Kök (ilk 6 harf) örtüşmesi bunu yakalar.
  const allowStems = new Set(allowed.flatMap(stems));
  const kept = [];
  const removed = [];
  for (const term of forbidden) {
    const clashes = stems(term).some((st) => allowStems.has(st));
    if (clashes) removed.push(term); else kept.push(term);
  }
  return { kept, removed };
}

/**
 * Script'e kategori stilini uygula: prompt'a tercihleri ekler, negatif
 * prompt'tan çelişenleri ÇIKARIR.
 *
 * Sahneleri YERİNDE değiştirir.
 *
 * @param {object} script
 * @returns {{style:string, contradictionsRemoved:string[], scenesTouched:number}}
 */
export function applyPromptStyle(script = {}) {
  const style = styleForScript(script);
  const removedAll = new Set();
  let touched = 0;

  for (const scene of script.scenes || []) {
    if (!scene.image_prompt) continue;
    // 1) Negatif prompt: kategorinin yasakları eklenir, çelişenler atılır.
    const current = String(scene.negative_prompt || '').split(',').map((x) => x.trim()).filter(Boolean);
    const merged = [...new Set([...current, ...style.forbid])];
    const { kept, removed } = resolveContradictions(merged, style.allow);
    for (const r of removed) removedAll.add(r);
    scene.negative_prompt = kept.join(', ');

    // 2) Pozitif tercihler prompt'un SONUNA eklenir (baş, kompozisyon
    // kısıtının yeri — storyPlanner orayı kullanıyor).
    const prefer = style.prefer.filter((p) => !scene.image_prompt.toLowerCase().includes(p.toLowerCase()));
    if (prefer.length) scene.image_prompt = `${scene.image_prompt} ${prefer.join(', ')}.`;
    touched += 1;
  }

  script.promptStyle = style.key;
  return { style: style.key, contradictionsRemoved: [...removedAll], scenesTouched: touched };
}
