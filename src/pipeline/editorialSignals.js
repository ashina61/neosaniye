/**
 * EDİTORYAL SİNYALLER — saf, deterministik yardımcılar.
 *
 * Retention QC'nin "insan gözüyle" yakalanan sorunları sayısal ve
 * tekrarlanabilir biçimde ölçmesi için: pattern interrupt sayımı, mekanizma
 * (how-it-works) görsel kapsamı, ses tasarımı yeterliliği ve olgusal kesinlik
 * dili. LLM tahmini yoktur — hepsi elimizdeki manifest/kurgu verisinden hesaplanır.
 */

/** "How it works" / mekanizma anlatan cümle kalıpları. */
const MECHANISM_RE =
  /\b(how (it|they|this) works?|works? by|splits?|refracts?|reflects?|polari[sz]|because|the reason|mechanism|divides? (the )?light|bends? light|two (images|beams|rays))\b/i;

/** Kesin/mutlak iddia kalıpları (kaynak yoksa fazla iddialı). */
const ABSOLUTE_RE =
  /\b(definitely|certainly|proven|proved|for sure|without doubt|always|never fails|scientists? confirmed|it is a fact|the reason is)\b/i;
/**
 * V3 (§12) — BİLİMSEL BENZETMEYİ KESİN ÖLÇÜM GİBİ SUNAN kalıplar.
 *
 * brain-vs-ai-memory script'i şunları söylüyordu: "AI has perfect recall",
 * "AI never omits information", "AI cannot infer", "the brain holds exactly
 * 100,000 GB". Dördü de yanlış. Beynin kapasitesi ölçülmüş bir sayı değil,
 * bir BENZETMEDİR; AI sistemleri hem bilgi atlar hem çıkarım yapar.
 *
 * Bu kalıplar `overclaim` sayılır ve düzeltme önerisi üretir — hedge kelimesi
 * eklemek de yeterli değildir: "AI probably has perfect recall" hâlâ yanlış
 * bir iddiadır. Bu yüzden ayrı bir liste olarak tutulur.
 */
const FALSE_ABSOLUTE_RE = new RegExp([
  // Kusursuz/eksiksiz hafıza iddiaları
  'perfect (?:recall|memory)', 'never (?:forgets?|omits?|loses?|makes mistakes)',
  'remembers everything', 'total recall', 'flawless (?:recall|memory|accuracy)',
  // Yetenek yokluğu iddiaları
  'cannot (?:infer|reason|generalize|forget)', "can'?t (?:infer|reason|generalize)",
  'has no (?:context|understanding|memory)',
  // Benzetmeyi ölçüm gibi sunma
  'exactly \\d[\\d,.]*\\s*(?:gb|tb|mb|bytes?|petabytes?)',
  'holds (?:exactly )?\\d[\\d,.]*\\s*(?:gb|tb|mb)',
  'stores (?:exactly )?\\d[\\d,.]*\\s*(?:gb|tb|mb)',
  'the brain (?:has|holds|contains) \\d',
].join('|'), 'i');

/** Yanlış-mutlak iddialar için önerilen daha doğru anlatım. */
const CERTAINTY_REWRITES = [
  [/\bperfect (?:recall|memory)\b/i,
    'AI sistemleri saklanan örüntüleri tutarlı biçimde geri çağırır — bu insan hafızasıyla aynı şey değil'],
  [/\bnever (?:forgets?|omits?|loses?)\b/i,
    'kayıt güncellenmedikçe aynı veriyi döndürür (bilgi atlamaz demek yanlış olur)'],
  [/\bcannot (?:infer|reason|generalize)\b/i,
    'AI örüntülerden çıkarım yapabilir; insanlar gibi DENEYİM hatırlamaz'],
  [/\bexactly \d|the brain (?:has|holds|contains) \d/i,
    'bazı tahminler beynin kapasitesini on binlerce gigabayta BENZETİR — ölçülmüş bir sayı değildir'],
];

/**
 * Yanlış-mutlak iddiaları bul ve düzeltme önerisi üret.
 * @param {string} text
 * @returns {Array<{claim:string, suggestion:string}>}
 */
export function findFalseAbsolutes(text = '') {
  const sentences = String(text).split(/(?<=[.!?])\s+/).filter((x) => x.trim());
  const out = [];
  for (const sentence of sentences) {
    if (!FALSE_ABSOLUTE_RE.test(sentence)) continue;
    const hit = CERTAINTY_REWRITES.find(([re]) => re.test(sentence));
    out.push({
      claim: sentence.trim().slice(0, 120),
      suggestion: hit ? hit[1] : 'benzetmeyi kesin ölçüm gibi sunma; iddiayı ölçülebilir hâle getir',
    });
  }
  return out;
}
/** İddiayı yumuşatan (hedge) kalıplar. */
const HEDGE_RE =
  /\b(may|might|could|possibly|perhaps|likely|thought to|believed to|is believed|debated|some (historians|scientists)|experiments? (show|suggest)|it'?s possible|probably|appears? to|seems? to)\b/i;

/**
 * PATTERN INTERRUPT sayımı. Bir plan sınırı "güçlü kesinti" sayılır ancak:
 *  - yeni kaynak görüntü (source değişimi), VEYA
 *  - harekete geçiş (bu plan video, önceki değil), VEYA
 *  - gfx/diagram/stat kartı belirir, VEYA
 *  - o sınırda duyulur (none olmayan) bir sfx eşliğinde reveal var.
 * SAYILMAZ: aynı görselin tempo için 'cut'la bölünmüş parçaları (anlamsız
 * mikro değişim), yalnız altyazı kelimesinin değişmesi.
 *
 * @returns {{count:number, indices:number[]}}
 */
export function countPatternInterrupts({ itemSources = [], itemTypes = [], editPlan = null }) {
  const sources = itemSources;
  const types = itemTypes;
  const bounds = editPlan?.boundaries || [];
  const indices = [];
  // İlk plan her zaman bir "açılış olayı"dır.
  if (sources.length) indices.push(0);
  for (let i = 1; i < sources.length; i += 1) {
    const newSource = sources[i] !== sources[i - 1];
    const newMotion = (types[i] || 'photo') === 'video' && (types[i - 1] || 'photo') !== 'video';
    const gfx = sources[i] === 'gfx';
    const sfx = bounds[i - 1]?.sfx && bounds[i - 1].sfx !== 'none';
    if (newSource || newMotion || gfx || sfx) indices.push(i);
  }
  return { count: indices.length, indices };
}

/**
 * Mekanizma görsel kapsamı: bir "nasıl çalışır" cümlesi varsa en az bir
 * açıklayıcı görsel (gfx/diagram/stat kartı) bulunmalı — salt nesne B-roll'u
 * yetmez.
 * @returns {{isMechanism:boolean, hasExplanatoryVisual:boolean, ok:boolean}}
 */
export function detectMechanismCoverage(script = {}, itemSources = []) {
  const format = String(script.format || '');
  const narrations = (script.scenes || []).map((s) => String(s.narration || '')).join(' ');
  const isMechanism = format === 'howworks' || MECHANISM_RE.test(narrations);
  const hasExplanatoryVisual = itemSources.includes('gfx');
  return { isMechanism, hasExplanatoryVisual, ok: !isMechanism || hasExplanatoryVisual };
}

/**
 * Olgusal kesinlik — CÜMLE BAZLI. Bir cümle mutlak iddia içerip hedge
 * içermiyorsa "overclaim"dir; metnin başka yerinde hedge olması bunu affetmez
 * (her ana iddia kendi kesinlik seviyesine göre yazılmalı).
 * Seviye: established | supported | debated | speculative (en riskli kazanır).
 */
export function classifyFactualCertainty(text) {
  const sentences = String(text || '').split(/(?<=[.!?])\s+/).filter((s) => s.trim());
  let overclaim = false;
  let anyAbsolute = false;
  let anyHedged = false;
  let debated = false;
  for (const s of sentences) {
    const abs = ABSOLUTE_RE.test(s);
    const hed = HEDGE_RE.test(s);
    if (abs) anyAbsolute = true;
    if (hed) anyHedged = true;
    if (/\bdebat/i.test(s) || /some (historians|scientists)/i.test(s)) debated = true;
    if (abs && !hed) overclaim = true; // bu cümle kaynaksız mutlak iddia
  }
  let level;
  if (overclaim) level = 'established'; // kesin dille yazılmış (kaynaksız riskli)
  else if (debated) level = 'debated';
  else if (anyHedged) level = 'supported';
  else if (anyAbsolute) level = 'established';
  else level = 'speculative';
  // Yanlış-mutlak iddialar hedge ile AFFEDİLMEZ: "AI probably has perfect
  // recall" hâlâ yanlış bir iddiadır, yalnızca daha kibar söylenmiştir.
  const falseAbsolutes = findFalseAbsolutes(text);
  return {
    level: falseAbsolutes.length ? 'established' : level,
    absolute: anyAbsolute,
    hedged: anyHedged,
    overclaim: overclaim || falseAbsolutes.length > 0,
    falseAbsolutes,
  };
}

/**
 * Ses tasarımı yeterliliği. editPlan sınırlarındaki duyulur sfx'lerin sayısı,
 * zaman aralığı (birbirine çok yakın olmasın) ve çeşitliliği.
 * @param {object} editPlan
 * @param {number[]} itemSeconds - plan süreleri (sn); sınır zamanları kümülatif.
 * @param {{minGap?:number}} opts
 */
export function sfxQuality(editPlan, itemSeconds = [], { minGap = 3.0 } = {}) {
  const bounds = editPlan?.boundaries || [];
  // Sınır k, plan k-1 ile k arasındadır → zamanı ilk k planın toplam süresi.
  const times = [];
  let cum = 0;
  for (let k = 0; k < bounds.length; k += 1) {
    cum += itemSeconds[k] ?? 0;
    if (bounds[k]?.sfx && bounds[k].sfx !== 'none') times.push({ t: cum, sfx: bounds[k].sfx });
  }
  const count = times.length;
  let minGapSeconds = Infinity;
  for (let i = 1; i < times.length; i += 1) minGapSeconds = Math.min(minGapSeconds, times[i].t - times[i - 1].t);
  if (!Number.isFinite(minGapSeconds)) minGapSeconds = null;
  const distinctCount = new Set(times.map((x) => x.sfx)).size;
  const tooClose = minGapSeconds !== null && minGapSeconds < minGap;
  return {
    count,
    minGapSeconds: minGapSeconds === null ? null : +minGapSeconds.toFixed(2),
    distinctCount,
    spacedOk: !tooClose,
    cues: times.map((x) => ({ atSeconds: +x.t.toFixed(1), sfx: x.sfx })),
  };
}
