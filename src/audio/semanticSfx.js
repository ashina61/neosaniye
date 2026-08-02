/**
 * ANLAMLI SES EFEKTİ PLANLAYICI — "ses sahnede olanı desteklesin".
 *
 * Eski sistem sesi KOTAYLA dolduruyordu: editör yeterince öneri vermezse
 * normalizeSfxPlan zaman çizelgesinin %24/%54/%82'sine körlemesine
 * ['whoosh','shimmer','impact','riser'] döngüsünden bir ses basıyordu.
 * Sesin ekranda olanla ya da söylenenle hiçbir ilişkisi yoktu — canlıda
 * "çok alakasız ve salakça" bulundu (26 Tem). Bu, kaldırılan dekoratif
 * overlay katmanının aynı hastalığı: boşluğu anlamsız içerikle doldurmak.
 *
 * Bu motor sesi ANLATIMDAN türetir. Bir sınırda ses, ancak o sınırda başlayan
 * sahnenin anlatımı o sesi HAK EDİYORSA çalar:
 *   impact  → sert dönüş/şok/çarpma      ("but", "turns out", "collapsed")
 *   riser   → bir açığa çıkışa TIRMANIŞ  ("slowly", "began to", "until")
 *   shimmer → keşif/ışık/hayret          ("discovered", "glow", "reveal")
 *   whoosh  → fiziksel hareket/atlayış   ("travels", "across", "years later")
 *   click   → kesinlik/sayım/mekanizma   ("exactly", "locks", sayılar)
 * Hiçbiri eşleşmiyorsa SES YOK. Kota yok, dolgu yok.
 */

/** Anlam → tetikleyici kalıplar. Sıra önceliktir (üstteki daha güçlü sinyal). */
const MEANINGS = [
  {
    type: 'impact',
    // Sert dönüş, çarpışma, yıkım, kesin olumsuzluk.
    re: /\b(but|yet|however|turns? out|actually|suddenly|collapsed?|crashed?|destroyed?|shattered?|died|killed|failed|struck|hit|slammed?|exploded?|broke|never|nobody|impossible)\b/i,
  },
  {
    type: 'riser',
    // Bir şeye doğru tırmanan gerilim (sonrasında ödeme gelir).
    re: /\b(slowly|gradually|began|begins|started|starts|building|builds up|rising|rises|approaching|closer|until|about to|moments before|tension|pressure)\b/i,
  },
  {
    type: 'shimmer',
    // Keşif, ışık, güzellik, "işte bu" anı.
    re: /\b(discovered?|reveals?|revealed|uncovered?|glow(?:s|ing)?|shine?s?|shining|light|sunlight|crystal|golden|beautiful|glitter|sparkl\w*|magic\w*|wonder)\b/i,
  },
  {
    type: 'whoosh',
    // Fiziksel hareket, mesafe kat etme, zaman/mekân atlaması.
    re: /\b(travels?|traveled|flies|flew|flying|rush\w*|sweep\w*|across|through|toward|carried|carries|wind|storm|current|years later|centuries later|meanwhile|far away|migrat\w*)\b/i,
  },
  {
    type: 'click',
    // Kesinlik, mekanizma, sayım — sayaç animasyonuyla da uyumlu.
    re: /\b(exactly|precise\w*|locks?|locked|snaps?|clicks?|measures?|counts?|mechanis\w*|gears?|switch\w*)\b|\b\d[\d,.]*\b/i,
  },
];

/**
 * Bir anlatım cümlesinin hak ettiği ses (yoksa null).
 * @param {string} narration
 * @returns {string|null}
 */
export function sfxForNarration(narration) {
  const text = String(narration || '');
  if (text.trim().split(/\s+/).length < 3) return null;
  for (const { type, re } of MEANINGS) {
    if (re.test(text)) return type;
  }
  return null;
}

/**
 * Sınır başına anlamlı ses planı.
 *
 * Sınır k, sahne k ile k+1 arasındadır; ses o sınırda BAŞLAYAN sahneyi
 * noktalar (gelen şeyi duyururuz, gideni değil).
 *
 * @param {Array<{narration:string}>} scenes sahne listesi (sıralı)
 * @param {number[]} boundaryTimes sınır zamanları (saniye), scenes.length-1 uzunluk
 * @param {object} [opts]
 * @param {number} [opts.maxCues=4]        üst sınır (kalabalık olmasın)
 * @param {number} [opts.minGapSeconds=5]  iki ses arası en az mesafe
 * @param {string[]} [opts.editorPlan]     editörün önerisi (yalnız DOĞRULAMA için)
 * @returns {Array<string|null>} her sınır için ses tipi ya da null
 */
export function planSemanticSfx(scenes = [], boundaryTimes = [], {
  maxCues = 4,
  minGapSeconds = 5,
  editorPlan = null,
} = {}) {
  const out = new Array(Math.max(0, boundaryTimes.length)).fill(null);

  // Aday listesi: yalnızca anlatımı bir sesi HAK EDEN sınırlar.
  const candidates = [];
  for (let k = 0; k < out.length; k += 1) {
    const incoming = scenes[k + 1]?.narration;
    const type = sfxForNarration(incoming);
    if (!type) continue;
    // Editör aynı sınırda 'none' dediyse ona saygı duy (sessiz kesme isteği).
    if (editorPlan && editorPlan[k] === 'none') continue;
    candidates.push({ k, type, time: boundaryTimes[k] });
  }

  // Öncelik: impact > shimmer > riser > whoosh > click. Sonra zaman sırası.
  const rank = { impact: 0, shimmer: 1, riser: 2, whoosh: 3, click: 4 };
  candidates.sort((a, b) => (rank[a.type] ?? 9) - (rank[b.type] ?? 9) || a.time - b.time);

  const chosen = [];
  for (const c of candidates) {
    if (chosen.length >= maxCues) break;
    if (!Number.isFinite(c.time)) continue;
    // Üst üste binmesin: seçilenlerin hepsinden yeterince uzak olmalı.
    if (chosen.some((s) => Math.abs(s.time - c.time) < minGapSeconds)) continue;
    // Aynı ses arka arkaya gelmesin (tekdüzelik).
    const prev = chosen.slice().sort((a, b) => a.time - b.time).at(-1);
    if (prev && prev.type === c.type && Math.abs(prev.time - c.time) < minGapSeconds * 2) continue;
    chosen.push(c);
  }

  for (const c of chosen) out[c.k] = c.type;
  return out;
}

/** Plan özeti (log/QC için). */
export function describeSfxPlan(plan = []) {
  const used = plan.filter(Boolean);
  const counts = used.reduce((a, t) => ({ ...a, [t]: (a[t] || 0) + 1 }), {});
  return { count: used.length, types: counts };
}
