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

/**
 * SAHNE GÖRSELİ KONUNUN DIŞINDA MI? (dar ve kanıtlı kontrol)
 *
 * ================== NEDEN AYRI BİR KONTROL ==================
 * Ham örtüşme skoru AI görsellerde ZAYIFTIR: "fungi" ile "mushroom",
 * "network" ile "threads" aynı şeyi anlatır ama kelime olarak eşleşmez.
 * Ölçülen değerler (fungal-networks): doğru eşleşen sahneler 0.17, yanlış
 * sahne 0.00 — ayrım var ama eşik koymak için bant çok dar. Eşiğe bağlanan
 * bir kapı ya her sahneyi suçlar ya hiçbirini.
 *
 * Bu yüzden soru daraltıldı ve KANITA bağlandı:
 *   "Görselin tarifi, sahnenin ya da videonun SÖZ ETTİĞİ hiçbir şeyi
 *    içermiyor mu?"
 * Cevap evetse görsel gerçekten başka bir şeyi gösteriyordur.
 *
 * Canlı kanıt: "But how do these networks actually work?" anlatımına karşılık
 * "mikroskopla toprak inceleyen bir araştırmacı" görseli üretildi. Sahne
 * anahtar kelimeleri (researcher, microscope, soil) prompt'ta VARDI ama
 * videonun konusu (fungal, network, tree) hiç geçmiyordu — mantar ağları
 * videosunun ortasında konusuz bir laboratuvar planı.
 *
 * @param {object} input
 * @param {string} input.narration
 * @param {string} input.imageText   görselin tarifi (çekirdek prompt / etiketler)
 * @param {string[]} [input.sceneKeywords]
 * @param {string[]} [input.topicWords] videonun konu kelimeleri
 * @returns {{offTopic:boolean, matched:string[], checked:boolean}}
 */
export function detectOffTopicVisual({
  narration = '', imageText = '', sceneKeywords = [], topicWords = [],
} = {}) {
  const text = String(imageText).toLowerCase();
  if (!text.trim()) return { offTopic: false, matched: [], checked: false };

  // SAHNE ANAHTARLARI DAİRESELDİR: aynı model hem anahtarları hem prompt'u
  // yazdığı için ikisi daima uyuşur. İlk sürümde bu yüzden mikroskop sahnesi
  // "konuyla ilgili" çıktı — kendi anahtarları (researcher, microscope, soil)
  // prompt'ta vardı. Anahtarlar ancak KONUYA bağlıysa dağarcığa girer;
  // konuyla hiç ilgisi olmayan anahtar seti, sahnenin kaymış olduğunun
  // kanıtıdır, mazereti değil.
  const stem = (w) => w.slice(0, 4);
  const topicKw = topicWords.flatMap((k) => extractKeywords(String(k))).filter((w) => w.length >= 4);
  const topicStems = new Set(topicKw.map(stem));
  const sceneKw = sceneKeywords.flatMap((k) => extractKeywords(String(k))).filter((w) => w.length >= 4);
  const keywordsConnected = sceneKw.some((w) => topicStems.has(stem(w)));

  const vocab = [...new Set([
    ...extractKeywords(narration),
    ...(keywordsConnected ? sceneKw : []),
    ...topicKw,
  ])].filter((w) => w.length >= 4);

  // Dağarcık çok küçükse (retorik soru, "Silence." gibi) iddia üretilmez.
  if (vocab.length < 2) return { offTopic: false, matched: [], checked: false };

  // Eşleşme kökten yapılır: "fungi" ile "fungal", "root" ile "roots" aynı şeydir.
  const matched = vocab.filter((w) => text.includes(w) || text.includes(stem(w)));
  return { offTopic: matched.length === 0, matched, keywordsConnected, checked: true };
}
