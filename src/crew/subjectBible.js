/**
 * SUBJECT BIBLE — bir videonun ana öznesinin DEĞİŞMEZ kimliği.
 *
 * 26 Tem canlı hatası: "sea cucumbers" videosunda sahneler sırayla tırtıl,
 * kırkayak, zırhlı halkalı solucan ve fantastik bir yaratık gösterdi. Sebep
 * yapısaldı: her sahnenin image_prompt'u BAĞIMSIZ üretiliyordu. Sahne 3'ün
 * promptu, sahne 2'de neyin çizildiğini bilmiyor; üretici modele her seferinde
 * "denizde uzun yumuşak canlı" gibi belirsiz bir tarif gidiyor ve model her
 * defasında başka bir şubeden hayvan çiziyordu.
 *
 * Çözüm: video başına TEK bir kimlik sözleşmesi. Bu sözleşme
 *   - her sahne promptunun BAŞINA girer,
 *   - yeniden üretimde (retry / dizi kareleri / alt kadrajlar) korunur,
 *   - stok arama sorgusuna girer,
 *   - negatif prompt olarak SAĞLAYICI İSTEĞİNE gönderilir (log'a değil),
 *   - QC tarafından doğrulanır.
 *
 * Model bir bible üretemezse deterministik bir taban kullanılır: yanlış güven
 * üretmemek için taban dar ve genel kalır, QC de onu "doğrulanmadı" sayar.
 */

/** Şube (phylum) bazlı yasak anatomi — çapraz-şube kaymasını engeller. */
const PHYLUM_FORBIDDEN = {
  echinoderm: ['segmented insect body', 'centipede legs', 'caterpillar anatomy',
    'armored exoskeleton', 'shell', 'horns', 'jointed legs', 'antennae'],
  mollusc: ['insect legs', 'exoskeleton', 'segmented worm body', 'fur', 'feathers'],
  arthropod: ['soft boneless body', 'fur', 'feathers', 'scales', 'tentacles'],
  insect: ['eight legs', 'fur', 'feathers', 'vertebrate skeleton', 'tentacles'],
  fish: ['legs', 'fur', 'insect anatomy', 'exoskeleton'],
  bird: ['fur', 'scales', 'insect anatomy', 'six legs'],
  mammal: ['exoskeleton', 'insect anatomy', 'feathers', 'scales', 'antennae'],
  reptile: ['fur', 'feathers', 'insect anatomy', 'exoskeleton'],
  amphibian: ['fur', 'feathers', 'exoskeleton', 'scales'],
  plant: ['animal anatomy', 'eyes', 'legs', 'face'],
  fungus: ['animal anatomy', 'eyes', 'legs', 'face'],
};

/** Her konuda geçerli yasaklar — bilimsel içerikte fantezi yok. */
const UNIVERSAL_FORBIDDEN = [
  'fantasy creature', 'alien monster', 'mythical beast', 'cartoon mascot',
  'incorrect anatomy', 'extra limbs', 'human face', 'text', 'watermark', 'logo',
];

/**
 * Konu metninden şube tahmini (deterministik, sözlük tabanlı).
 * Kelime listeleri ÇOĞUL TOLERANSLI regex'e çevrilir: "Hummingbirds" yazan bir
 * konu başlığı `\bhummingbird\b` ile eşleşmiyordu (sondaki "s" kelime
 * karakteri olduğu için sınır tutmuyor) ve ad "hummingbirds colors" gibi
 * saçmalıyordu.
 */
const PHYLUM_WORDS = [
  [['sea cucumber', 'starfish', 'sea star', 'urchin', 'brittle star', 'echinoderm', 'sand dollar'], 'echinoderm'],
  [['octopus', 'squid', 'cuttlefish', 'snail', 'slug', 'clam', 'oyster', 'nautilus', 'mollusc', 'mollusk'], 'mollusc'],
  [['ant', 'bee', 'wasp', 'termite', 'beetle', 'butterfly', 'moth', 'dragonfly', 'cicada', 'insect'], 'insect'],
  [['spider', 'scorpion', 'crab', 'lobster', 'shrimp', 'crustacean', 'arachnid', 'centipede', 'millipede'], 'arthropod'],
  [['hummingbird', 'bird', 'eagle', 'owl', 'penguin', 'crow', 'raven', 'parrot'], 'bird'],
  [['fish', 'shark', 'ray', 'eel', 'salmon', 'tuna', 'seahorse'], 'fish'],
  [['whale', 'dolphin', 'bat', 'wolf', 'elephant', 'mouse', 'rat', 'primate', 'monkey', 'ape', 'mammal'], 'mammal'],
  [['snake', 'lizard', 'turtle', 'crocodile', 'gecko', 'reptile'], 'reptile'],
  [['frog', 'toad', 'salamander', 'newt', 'amphibian'], 'amphibian'],
  [['tree', 'flower', 'plant', 'moss', 'fern', 'orchid', 'seed', 'root'], 'plant'],
  [['fungus', 'fungi', 'mushroom', 'mycelium', 'mold'], 'fungus'],
];

const PHYLUM_HINTS = PHYLUM_WORDS.map(([words, p]) => [
  new RegExp(`\\b(${words.map((w) => w.replace(/\s/g, '\\s')).join('|')})(?:s|es)?\\b`, 'i'),
  p,
  new Set(words),
]);

function guessPhylum(text) {
  for (const [re, p] of PHYLUM_HINTS) if (re.test(text)) return p;
  return null;
}

/**
 * KISA KANONİK AD — bu fonksiyon olmadan sistem kendi ayağına sıktı.
 *
 * 26 Tem 13:28 koşusu: `canonicalName` yedeği olarak `visual_anchor` alındı ve
 * o alan bir AD değil, tam bir paragraftı:
 *   "A vibrant ruby-throated hummingbird, metallic green and iridescent red,
 *    hovers near a brightly colored flower in a lush garden. The lighting is..."
 * Sonuç: 10 sahnenin 10'unun promptu bu 200 karakterlik AYNI metinle başladı,
 * sahneyi ayıran cümle onun içinde boğuldu ve görsel çeşitlilik ÇÖKTÜ
 * (9 benzersiz plan, 7 sahne neredeyse aynı, en uzun aynı-kaynak 18).
 * Kimlik kilidi, tam da engellemesi gereken tekdüzeliği üretti.
 *
 * Ad artık kısa tutulur: tür sözlüğünde eşleşme varsa o (en güveniliri),
 * yoksa konudan çıkarılan 1-3 kelimelik çekirdek.
 */
const STOP = new Set(['how', 'why', 'what', 'when', 'where', 'the', 'a', 'an', 'of',
  'do', 'does', 'did', 'can', 'is', 'are', 'this', 'that', 'these', 'those',
  'see', 'sees', 'invisible', 'incredible', 'amazing', 'secret', 'secrets',
  'facts', 'fact', 'things', 'thing', 'about', 'inside', 'real', 'truth']);

export function shortCanonicalName(text = '') {
  const raw = String(text).trim();
  if (!raw) return '';
  // 1) Tür sözlüğünde eşleşme — en temiz ad. Çoğul tekile indirilir.
  for (const [re, , words] of PHYLUM_HINTS) {
    const m = raw.match(re);
    if (!m) continue;
    const hit = String(m[1] || m[0]).toLowerCase();
    return words.has(hit) ? hit : hit.replace(/(?:es|s)$/, '');
  }
  // 2) Konudan çekirdek: dolgu kelimeler atılır, en fazla 3 kelime kalır.
  const words = raw.replace(/[^\p{L}\p{N}\s-]/gu, ' ').split(/\s+/).filter(Boolean);
  const core = words.filter((w) => !STOP.has(w.toLowerCase())).slice(0, 3);
  const name = (core.length ? core : words.slice(0, 3)).join(' ').toLowerCase();
  // 3) Hâlâ uzunsa ad değildir — kimlik ön eki hiç kurulmaz.
  return name.length <= 40 ? name : '';
}

const clean = (v) => String(v || '').trim();
const list = (v) => (Array.isArray(v) ? v.map(clean).filter(Boolean) : []);

/**
 * Script'ten (ve varsa modelin ürettiği alandan) kimlik sözleşmesi kur.
 *
 * @param {object} script generateScript çıktısı
 * @returns {{canonicalName:string, scientificCategory:string|null,
 *            requiredTraits:string[], forbiddenTraits:string[],
 *            visualContinuity:object, verifiedSource:string}}
 */
export function buildSubjectBible(script = {}) {
  const raw = script.subject_bible || {};
  const topicText = `${script.topic || ''} ${script.visual_anchor || ''}`.trim();
  // Ad KISA olmalı: uzun bir sahne tarifi ad değildir (yukarıdaki nota bakın).
  const canonicalName = clean(raw.canonical_name || raw.canonicalName)
    || shortCanonicalName(script.topic)
    || shortCanonicalName(script.visual_anchor);
  const phylum = clean(raw.phylum) || guessPhylum(`${canonicalName} ${topicText}`);
  const scientificCategory = clean(raw.scientific_category || raw.scientificCategory)
    || (phylum ? `${phylum}` : null);

  const requiredTraits = list(raw.required_traits || raw.requiredTraits);
  const forbiddenTraits = [
    ...list(raw.forbidden_traits || raw.forbiddenTraits),
    ...(phylum ? PHYLUM_FORBIDDEN[phylum] || [] : []),
    ...UNIVERSAL_FORBIDDEN,
  ];

  return {
    canonicalName,
    scientificCategory,
    phylum: phylum || null,
    requiredTraits,
    forbiddenTraits: [...new Set(forbiddenTraits)],
    visualContinuity: {
      bodyShape: clean(raw.body_shape) || null,
      surface: clean(raw.surface) || null,
      scaleClass: clean(raw.scale_class) || null,
      speciesVariationAllowed: true,
      crossPhylumVariationAllowed: false,
    },
    // Kimlik nereden geldi: model mi, tahmin mi? QC bunu okur.
    verifiedSource: raw.canonical_name || raw.canonicalName ? 'model' : 'derived',
  };
}

/**
 * POZİTİF PROMPT ÖN EKİ — her sahne promptunun başına girer.
 * Baştaki kelimeler üreticide daha ağır bastığı için kimlik EN BAŞTA durur.
 */
export function subjectPromptPrefix(bible) {
  if (!bible?.canonicalName) return '';
  const parts = [`Scientifically accurate ${bible.canonicalName}`];
  if (bible.scientificCategory) parts.push(`a ${bible.scientificCategory}`);
  if (bible.requiredTraits.length) parts.push(`with ${bible.requiredTraits.join(', ')}`);
  parts.push('natural documentary photography, anatomically plausible');
  return `${parts.join(', ')}.`;
}

/** NEGATİF PROMPT — sağlayıcı isteğine GÖNDERİLİR (yalnızca loglanmaz). */
export function negativePromptFor(bible) {
  if (!bible?.forbiddenTraits?.length) return '';
  return bible.forbiddenTraits.join(', ');
}

/**
 * Negatifi desteklemeyen (URL tabanlı) sağlayıcılar için metinsel dışlama.
 * Pollinations gövde parametresi almaz; kısıt prompt'un içine yazılır.
 */
export function inlineNegativeClause(bible, max = 10) {
  const terms = (bible?.forbiddenTraits || []).slice(0, max);
  return terms.length ? ` Absolutely not: ${terms.join(', ')}.` : '';
}

/** Stok görsel araması kimliği taşısın (alakasız stok gelmesin). */
export function bibleSearchTerms(bible) {
  if (!bible?.canonicalName) return [];
  return [bible.canonicalName, bible.scientificCategory].filter(Boolean);
}

/**
 * Script'in TÜM sahnelerine kimliği uygula (yerinde).
 * @returns {{bible:object, applied:number}}
 */
export function applySubjectBible(script = {}) {
  const bible = buildSubjectBible(script);
  const prefix = subjectPromptPrefix(bible);
  let applied = 0;
  if (prefix) {
    for (const scene of script.scenes || []) {
      if (!scene?.image_prompt) continue;
      if (scene.image_prompt.startsWith(prefix)) continue; // idempotent
      scene.image_prompt = `${prefix} ${scene.image_prompt}`;
      scene.negative_prompt = negativePromptFor(bible);
      applied += 1;
    }
  }
  script.subjectBible = bible;
  return { bible, applied };
}
