/**
 * ALTYAZI BÜTÜNLÜĞÜ — "seslendirilen her kelime ekranda göründü mü?"
 *
 * 26 Tem canlı hatası: izleyici altyazıda fiilin kaybolduğunu gördü
 * ("These creatures can" → "their internal organs"). Kelime teknik olarak
 * atılmamıştı; vurgu mekanizması onu cümleden koparıp 0.2 saniyelik tek
 * başına bir parlamaya çevirmişti. Yani hem TOKEN KAPSAMASI hem de İFADE
 * BÜTÜNLÜĞÜ ölçülmeli — birincisi kelime kaybını, ikincisi anlam kaybını
 * yakalar.
 */
import { canEndBlock } from './captionLayout.js';

/** Karşılaştırma için normalize: noktalama ve kesme işareti farkları erir. */
export function normalizeForCompare(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[^a-z0-9'\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenize(text) {
  const n = normalizeForCompare(text);
  return n ? n.split(' ') : [];
}

/**
 * @param {object} input
 * @param {Array} input.events  layout çıktısı [{words:[{word,start,end}], text}]
 * @param {string} input.ttsText TTS'e gönderilen normalize edilmiş metin
 * @returns {{tokenCoverage:number, missingTokens:string[], duplicateTokens:string[],
 *            grammarRiskBlocks:string[], timelineOverlapCount:number}}
 */
export function validateCaptionIntegrity({ events = [], ttsText = '' } = {}) {
  const captionTokens = [];
  for (const ev of events) {
    for (const w of ev.words || []) captionTokens.push(...tokenize(w.word));
  }
  const ttsTokens = tokenize(ttsText);

  // ---- TOKEN KAPSAMASI (çokluk duyarlı) ----
  const need = new Map();
  for (const t of ttsTokens) need.set(t, (need.get(t) || 0) + 1);
  const have = new Map();
  for (const t of captionTokens) have.set(t, (have.get(t) || 0) + 1);

  const missingTokens = [];
  let covered = 0;
  for (const [t, n] of need) {
    const h = have.get(t) || 0;
    covered += Math.min(n, h);
    for (let i = h; i < n; i += 1) missingTokens.push(t);
  }
  // Altyazıda FAZLADAN görünen (tekrarlanan) kelimeler.
  const duplicateTokens = [];
  for (const [t, h] of have) {
    const n = need.get(t) || 0;
    if (h > n) for (let i = n; i < h; i += 1) duplicateTokens.push(t);
  }
  const tokenCoverage = ttsTokens.length
    ? +(covered / ttsTokens.length).toFixed(4) : 1;

  // ---- İFADE BÜTÜNLÜĞÜ ----
  // Yapışkan kelimeyle biten blok = yarım okunan cümle. Tek kelimelik blok =
  // bağlamından koparılmış flaş. İkisi de canlıda görülen belirtiler.
  const grammarRiskBlocks = [];
  events.forEach((ev, i) => {
    const ws = ev.words || [];
    if (!ws.length) return;
    const isLast = i === events.length - 1;
    // Cümleyi kapatan tek kelime ("First.", "predators.") başlı başına
    // anlamlıdır — chunker da onu bilerek yalnız bırakır. Tutarlı olalım.
    const soloOk = /[.!?]$/.test(String(ws[0].word || ''));
    if (ws.length === 1 && !isLast && !soloOk) {
      grammarRiskBlocks.push(`SOLO_WORD:${i}:${ws[0].word}`);
    }
    if (!isLast && !canEndBlock(ws.at(-1))) {
      grammarRiskBlocks.push(`DANGLING_TAIL:${i}:${ws.at(-1).word}`);
    }
  });

  // ---- ZAMAN ÇAKIŞMASI ----
  let timelineOverlapCount = 0;
  for (let i = 1; i < events.length; i += 1) {
    const prevEnd = events[i - 1].words?.at(-1)?.end;
    const curStart = events[i].words?.[0]?.start;
    if (Number.isFinite(prevEnd) && Number.isFinite(curStart) && curStart < prevEnd - 0.01) {
      timelineOverlapCount += 1;
    }
  }

  // ---- TEKRAR EDEN BLOK BAŞLANGICI ----
  // ÜÇ kelimelik başlangıç: iki kelime ("can do", "the ant") normal İngilizcede
  // sık tekrar eder ve her videoyu yanlışlıkla düşürürdü. Üç kelimenin birebir
  // tekrarı ise gerçek bir tekrar sinyalidir.
  const starts = events
    .map((ev) => tokenize((ev.words || []).slice(0, 3).map((w) => w.word).join(' ')).join(' '))
    .filter((s2) => s2.split(' ').length >= 3);
  const seenStart = new Set();
  const duplicateCaptionStarts = [];
  for (const s of starts) {
    if (!s) continue;
    if (seenStart.has(s)) duplicateCaptionStarts.push(s);
    else seenStart.add(s);
  }

  return {
    tokenCoverage,
    missingTokens,
    duplicateTokens,
    duplicateCaptionStarts,
    grammarRiskBlocks,
    timelineOverlapCount,
  };
}
