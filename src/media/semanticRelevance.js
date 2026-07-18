/**
 * SEMANTİK GÖRSEL ALAKA — saf, deterministik.
 *
 * Bir sahnenin anlatımı ile o sahneye seçilen görselin (stok anahtar
 * kelimeleri / açıklaması) konuyla gerçekten örtüşüp örtüşmediğini ölçer.
 * Amaç: "stok bulundu diye" alakasız görsel (Viking navigasyon videosunda
 * kırsal bisikletli gibi) seçilmesini engellemek.
 *
 * LLM YOK — anlatım anahtar kelimeleri ile aday görsel etiketleri arasında
 * örtüşme + yasak-uyumsuzluk sözlüğü. Düşük skorlu asset kabul edilmez.
 */

const STOP = new Set(
  ('a an the of to in on at by for and or but with without this that these those ' +
    'is are was were be been being it its they them their he she his her you your ' +
    'we our us as from into over under how what when where why who which than then ' +
    'may might could would should can will just very more most some any all no not ' +
    'used use using did do does had have has one two three first special hidden').split(/\s+/),
);

/** Metinden anlamlı anahtar kelimeleri çıkarır (küçük harf, tekilleştirilmiş kök). */
export function extractKeywords(text) {
  const words = String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP.has(w))
    .map((w) => w.replace(/(ing|ed|es|s)$/i, '')); // kaba kök
  return [...new Set(words.filter(Boolean))];
}

/**
 * Anlatım ile aday görsel etiketleri arasındaki alaka skoru [0,1].
 * @param {string} narration
 * @param {string|string[]} assetTags - stok anahtar kelimeleri veya açıklama
 * @param {{forbiddenMismatches?:string[]}} opts - görülürse ağır ceza (alakasız konu)
 */
export function semanticRelevanceScore(narration, assetTags, { forbiddenMismatches = [] } = {}) {
  const narrKw = extractKeywords(narration);
  const tagText = Array.isArray(assetTags) ? assetTags.join(' ') : String(assetTags || '');
  const tagKw = extractKeywords(tagText);
  if (!narrKw.length || !tagKw.length) {
    return { score: 0, overlap: [], mismatch: false, narrationKeywords: narrKw, assetKeywords: tagKw };
  }
  const tagSet = new Set(tagKw);
  const overlap = narrKw.filter((w) => tagSet.has(w) || tagKw.some((t) => t.includes(w) || w.includes(t)));
  // Yasak uyumsuzluk: aday etiketlerde konuyla çelişen kelime varsa mismatch.
  const forbid = forbiddenMismatches.map((w) => w.toLowerCase());
  const mismatch = tagKw.some((t) => forbid.some((f) => t.includes(f) || f.includes(t)));
  // Skor: örtüşen kelime oranı; mismatch varsa tavan 0.2.
  let score = +(overlap.length / Math.min(narrKw.length, 6)).toFixed(2);
  score = Math.min(1, score);
  if (mismatch) score = Math.min(score, 0.2);
  return { score, overlap: [...new Set(overlap)], mismatch, narrationKeywords: narrKw, assetKeywords: tagKw };
}

/**
 * Bir asset kabul edilebilir mi? Alaka skoru eşiğin altında veya yasak
 * uyumsuzluk varsa REDDEDİLİR (çağıran bir sonraki adaya geçmeli).
 */
export function isAssetRelevant(narration, assetTags, { minScore = 0.34, forbiddenMismatches = [] } = {}) {
  const r = semanticRelevanceScore(narration, assetTags, { forbiddenMismatches });
  return { ...r, accepted: !r.mismatch && r.score >= minScore, minScore };
}

/**
 * Tüm sahneler için alaka özeti (QC girdisi). itemRelevance önceden
 * hesaplanmışsa (üretim sırasında) onu kullanır; yoksa null döner.
 * @param {number[]} scores - plan başına alaka skoru (0-1) veya boş
 */
export function summarizeRelevance(scores = []) {
  const valid = scores.filter((x) => Number.isFinite(x));
  if (!valid.length) return { count: 0, min: null, mean: null, mismatchCount: 0 };
  const mismatchCount = valid.filter((x) => x < 0.34).length;
  return {
    count: valid.length,
    min: +Math.min(...valid).toFixed(2),
    mean: +(valid.reduce((a, b) => a + b, 0) / valid.length).toFixed(2),
    mismatchCount,
  };
}
