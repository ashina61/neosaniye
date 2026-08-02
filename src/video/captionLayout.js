import { config } from '../config.js';

/**
 * ALTYAZI YERLEŞİM MATEMATİĞİ — saf fonksiyonlar.
 *
 * renderVideo.buildCaptionAss ile Retention QC aynı hesabı buradan kullanır;
 * böylece QC'nin "altyazı taşar mı?" cevabı render'ın gerçekte yaptığıyla
 * birebir aynıdır (tahmin değil).
 *
 * Kurallar:
 *  - Her altyazı olayı TEK satırdır (libass'e sarma bırakılmaz — uzun kelimeyi
 *    ortadan bölme rezaleti buradan çıkmıştı).
 *  - SPLIT-BEFORE-SHRINK: grup, fontu captionSplitRatio'nun altına ezecek
 *    kadar genişse önce İKİYE BÖLÜNÜR; küçültme son çaredir.
 *  - Font hiçbir koşulda minPx tabanının altına inmez; taban yetmiyorsa olay
 *    "belowFloor" işaretlenir (QC bunu görür, strict modda fail eder).
 */

/** Grubun tek satıra sığması için gereken font boyutu (taban sınırsız). */
export function requiredFontPx(group, { usableW, baseSize, charFactor, wordFactor }) {
  const raw = group.map((w) => w.word).join(' ');
  const longest = Math.max(1, ...group.map((w) => String(w.word).length));
  const fitWhole = usableW / (Math.max(1, raw.length) * charFactor);
  const fitWord = usableW / (longest * wordFactor);
  return Math.min(baseSize, Math.floor(fitWhole), Math.floor(fitWord));
}

/**
 * YAPIŞKAN KELİMELER — kendisinden SONRAKİ kelimeye bağlıdır, blok sonunda
 * yalnız bırakılamaz.
 *
 * Canlı hata (26 Tem): "These creatures can" / "their internal organs" —
 * "can" bir sonraki fiilini bekleyen yardımcı fiil, blok sonunda kalınca
 * cümle yarım okunuyor. Aynı şekilde "to", "of", "and" ile biten blok
 * izleyiciye eksik bir ifade gösterir.
 */
export const STICKY_FORWARD = new Set([
  // yardımcı / kip fiilleri
  'can', 'could', 'will', 'would', 'shall', 'should', 'may', 'might', 'must',
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'am',
  'do', 'does', 'did', 'has', 'have', 'had',
  // edatlar
  'to', 'of', 'in', 'on', 'at', 'by', 'for', 'with', 'from', 'into', 'onto',
  'over', 'under', 'through', 'across', 'between', 'about', 'against', 'within',
  // bağlaçlar
  'and', 'or', 'but', 'so', 'than', 'that', 'because', 'while', 'when', 'if',
  // belirteçler / iyelik
  'the', 'a', 'an', 'its', 'their', 'his', 'her', 'our', 'your', 'this',
  'these', 'those', 'each', 'every', 'one', 'two', 'some', 'no',
]);

const bare = (w) => String(w?.word ?? w).toLowerCase().replace(/[^a-z0-9']/g, '');

/** Bu kelime bloğun SONUNDA yalnız kalabilir mi? */
export function canEndBlock(word) {
  const t = bare(word);
  if (!t) return true;
  // Noktalama ile biten kelime cümleyi kapatır — yapışkanlık düşer.
  if (/[.!?,;:]$/.test(String(word?.word ?? word))) return true;
  return !STICKY_FORWARD.has(t);
}

/**
 * Bölme noktası seç: ortaya en yakın, AMA ilk parçanın sonunda yapışkan bir
 * kelime BIRAKMAYAN indeks. Kör ortadan bölme "their internal / organs" ya da
 * "these creatures can / eject" gibi yarım ifadeler üretiyordu.
 */
export function choosePhraseSplit(group) {
  const mid = Math.ceil(group.length / 2);
  const candidates = [];
  for (let i = 1; i < group.length; i += 1) candidates.push(i);
  candidates.sort((a, b) => Math.abs(a - mid) - Math.abs(b - mid) || a - b);
  for (const i of candidates) {
    if (canEndBlock(group[i - 1])) return i;
  }
  return mid; // hepsi yapışkansa çaresiz ortadan böl (kelime ASLA atılmaz)
}

/**
 * SPLIT-BEFORE-SHRINK: grup gereğinden fazla küçülecekse böl (kelime
 * sınırından, İFADE GÜVENLİ noktadan). Tek kelimeye kadar iner; tek kelime
 * hâlâ sığmıyorsa bölünemez, küçültülür. Kelime asla düşürülmez/kırpılmaz.
 * @returns {Array<Array>} alt gruplar (zaman damgaları korunur)
 */
export function splitBeforeShrink(group, opts) {
  const { baseSize, splitRatio } = opts;
  const fit = requiredFontPx(group, opts);
  if (fit >= baseSize * splitRatio || group.length < 2) return [group];
  const at = choosePhraseSplit(group);
  return [
    ...splitBeforeShrink(group.slice(0, at), opts),
    ...splitBeforeShrink(group.slice(at), opts),
  ];
}

/** Tek grubun nihai yerleşimi: gerekirse böl, sonra tabana kadar küçült. */
export function layoutGroup(group, opts) {
  const { baseSize, minSize } = opts;
  return splitBeforeShrink(group, opts).map((part) => {
    const fit = requiredFontPx(part, opts);
    const fontSize = Math.max(minSize, Math.min(baseSize, fit));
    return {
      words: part,
      text: part.map((w) => w.word).join(' '),
      fontSize,
      lines: 1, // tek satır garanti — sığdırma yukarıda çözülür
      belowFloor: fit < minSize, // taban bile yetmedi (çok uzun tek kelime)
      splitFrom: splitBeforeShrink(group, opts).length > 1 ? group.length : null,
    };
  });
}

/**
 * Kelime akışını render ile AYNI kurallarla gruplar: doğal duraklar (>0.28s),
 * noktalama, perLine üst sınırı; vurgulu kelimeler kendi koşusunu alır (max 3).
 */
export function groupCaptionWords(words, { perLine, isEmph = () => false, maxWords = 6 } = {}) {
  void isEmph; // artık GRUPLAMAYI etkilemez — aşağıdaki nota bakın
  const groups = [];
  let cur = [];
  const flush = () => {
    if (cur.length) groups.push(cur);
    cur = [];
  };
  // VURGU ARTIK CÜMLEYİ BÖLMEZ.
  //
  // Eski davranış: vurgulu kelime kendi grubunu alıyordu (flush + solo run).
  // Canlıda bu, fiili cümleden koparıp 0.2 saniyelik tek başına bir italik
  // serif parlamasına çeviriyordu:
  //     "These creatures can" → [EJECT] → "their internal organs"
  // İzleyici için bu "kelime kayboldu" demektir; kullanıcı da tam olarak
  // bunu bildirdi. Vurgu artık akışın İÇİNDE, satır içi stille verilir.
  for (let i = 0; i < words.length; i += 1) {
    const w = words[i];
    cur.push(w);
    const next = words[i + 1];
    const gap = next ? next.start - w.end : Infinity;
    const punct = /[.!?,;:]$/.test(String(w.word));
    const full = cur.length >= perLine;
    // Yapışkan kelimede DURMA: "can", "to", "their" ile biten blok üretme.
    const mayEnd = canEndBlock(w) || cur.length >= maxWords;
    if (!next || ((full || gap > 0.28 || punct) && mayEnd)) flush();
  }
  return repairPhraseBoundaries(groups, { maxWords });
}

/**
 * İFADE SINIRI ONARIMI — gruplama sonrası son kontrol.
 *  1. Yapışkan kelimeyle biten blok: o kelime SONRAKİ bloğa taşınır.
 *  2. Tek kelimelik blok: komşusuyla birleştirilir (yalnız kelime, anlamsız
 *     bir flaş olur — düzeltilmek istenen hatanın ta kendisi).
 * Kelime sayısı hiçbir adımda değişmez.
 */
export function repairPhraseBoundaries(groups, { maxWords = 6 } = {}) {
  const out = groups.map((g) => [...g]);
  for (let i = 0; i < out.length - 1; i += 1) {
    // 1) yapışkan kuyruk → sonraki bloğun başına
    let guard = 0;
    // Sonraki blok doluysa bile taşı: sarkan kuyruk bırakmaktansa biraz uzun
    // blok yeğdir — yerleşim aşaması onu ifade-güvenli noktadan böler.
    while (out[i].length > 1 && !canEndBlock(out[i].at(-1))
      && out[i + 1].length < maxWords + 2 && guard < maxWords) {
      out[i + 1].unshift(out[i].pop());
      guard += 1;
    }
  }
  // 2) tek kelimelik bloklar
  // İki istisna: (a) cümleyi kapatan tek kelime ("First.") başlı başına
  // anlamlıdır, (b) araya uzun bir suskunluk giriyorsa birleştirmek altyazıyı
  // sessizlik boyunca ekranda tutar. Zaman komşuluğu korunmalı.
  const NEAR = 0.28;
  const gapAfter = (i) => {
    const a = out[i]?.at(-1)?.end;
    const b = out[i + 1]?.[0]?.start;
    return Number.isFinite(a) && Number.isFinite(b) ? b - a : Infinity;
  };
  for (let i = 0; i < out.length; i += 1) {
    if (out[i].length !== 1) continue;
    const solo = out[i][0];
    if (/[.!?]$/.test(String(solo?.word || ''))) continue; // tam cümle
    if (i + 1 < out.length && out[i + 1].length < maxWords && gapAfter(i) <= NEAR) {
      out[i + 1].unshift(...out[i].splice(0));
    } else if (i > 0 && out[i - 1].length < maxWords && gapAfter(i - 1) <= NEAR) {
      out[i - 1].push(...out[i].splice(0));
    }
  }
  return out.filter((g) => g.length);
}

/**
 * Güvenli alan kontrolü (alignment=2, alt-orta ASS konumu):
 *  - alt kenar boşluğu (marginV) YouTube Shorts UI bandının üstünde kalmalı,
 *  - en büyük olası altyazı bloğunun ÜST kenarı ekranın üst yarısına taşmamalı.
 */
export function checkCaptionSafeArea({
  height = 1920,
  marginV = config.video.captionMarginV,
  maxFontPx,
  bottomSafePx = config.retention.captionBottomSafePx,
  topSafeRatio = config.retention.captionTopSafeRatio,
}) {
  const lineHeight = Math.ceil(maxFontPx * 1.35); // ASS satır yüksekliği yaklaşımı
  const blockTopPx = height - marginV - lineHeight;
  const bottomOk = marginV >= bottomSafePx;
  const topOk = blockTopPx >= height * topSafeRatio;
  return { ok: bottomOk && topOk, bottomOk, topOk, bottomMarginPx: marginV, blockTopPx };
}

/**
 * QC için tam analiz: kelime akışını render kurallarıyla yerleştirir ve özet
 * döndürür. Deterministiktir — render'daki gerçek davranışın birebir modeli.
 */
export function analyzeCaptionLayout(words, {
  width = 1080,
  height = 1920,
  emphasisWords = [],
  baseSize = config.video.captionSize,
  perLine = config.video.captionWordsPerLine,
  marginV = config.video.captionMarginV,
  minSize = config.video.captionMinPx,
  emphMinSize = config.video.captionEmphMinPx,
  splitRatio = config.video.captionSplitRatio,
} = {}) {
  const marginH = 90;
  const usableW = width - 2 * marginH;
  const normWord = (w) => String(w).toLocaleLowerCase('tr-TR').replace(/[^\p{L}\p{N}]/gu, '');
  const emphSet = new Set(emphasisWords.map(normWord).filter(Boolean));
  const isEmph = (w) => config.video.emphasis && (/\d/.test(w) || emphSet.has(normWord(w)));

  const groups = groupCaptionWords(words, { perLine, isEmph });
  const emphSize = Math.round(baseSize * 1.5);
  const events = [];
  for (const g of groups) {
    const opts = g.isEmph
      ? { usableW, baseSize: emphSize, minSize: emphMinSize, charFactor: 0.5, wordFactor: 0.5, splitRatio: 0 } // vurgu koşusu bölünmez (sayı+birim ikilisi)
      : { usableW, baseSize, minSize, charFactor: 0.56, wordFactor: 0.62, splitRatio };
    for (const ev of layoutGroup(g, opts)) events.push({ ...ev, isEmph: Boolean(g.isEmph) });
  }

  const minFontUsed = events.length ? Math.min(...events.map((e) => e.fontSize)) : baseSize;
  const maxFontUsed = events.length ? Math.max(...events.map((e) => e.fontSize)) : emphSize;
  const safeArea = checkCaptionSafeArea({ height, marginV, maxFontPx: maxFontUsed });
  const timingIssues = [];
  events.forEach((event, index) => {
    const start = event.words[0]?.start;
    const end = event.words.at(-1)?.end;
    const duration = Number(end) - Number(start);
    const chars = event.text.length;
    if (event.lines > 2) timingIssues.push(`CAPTION_TOO_MANY_LINES:${index}`);
    if (event.words.length > 5) timingIssues.push(`CAPTION_TOO_MANY_WORDS:${index}`);
    if (chars > 34) timingIssues.push(`CAPTION_TOO_MANY_CHARACTERS:${index}`);
    if (duration < 0.28) timingIssues.push(`CAPTION_TOO_SHORT:${index}`);
    if (duration > 2.8) timingIssues.push(`CAPTION_TOO_LONG:${index}`);
    if (duration > 0 && chars / duration > 20) timingIssues.push(`CAPTION_READING_SPEED_HIGH:${index}`);
    if (index && start < events[index - 1].words.at(-1)?.end - 0.01) timingIssues.push(`CAPTION_OVERLAP:${index}`);
  });
  if (!safeArea.ok) timingIssues.push('CAPTION_OUTSIDE_SAFE_AREA');
  return {
    eventCount: events.length,
    splitCount: events.filter((e) => e.splitFrom).length,
    belowFloorCount: events.filter((e) => e.belowFloor).length,
    maxLinesUsed: events.length ? Math.max(...events.map((e) => e.lines)) : 0,
    maxWordsOnScreen: events.length ? Math.max(...events.map((e) => e.words.length)) : 0,
    minFontUsed,
    maxFontUsed,
    safeArea,
    timingIssues,
    events,
  };
}
