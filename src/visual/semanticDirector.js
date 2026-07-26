/**
 * SEMANTİK GÖRSEL YÖNETMEN — "cümleyi ekranda GERÇEKLEŞTİR".
 *
 * Eski sistem (visualDirector) dekoratifti: en uzun kelimeyi etiket yapıp
 * ekranın ortasına basıyor, rastgele bir daireyi "spotlight" diye çiziyordu.
 * Bunlar görsel ANLATIM değil, süstü — sessiz izleyiciye hiçbir bilgi vermiyordu.
 *
 * Bu motor anlatım cümlesinin YAPISINI çıkarır ve o yapıyı gösteren bir
 * kompozisyon ister:
 *   process  → sıralı adımlar + yön oku       ("A, B'yi tetikler, B C'ye ulaşır")
 *   compare  → split-screen, iki taraf         ("X, Y'den daha ...")
 *   number   → sayaç + ölçek barı              ("30 tür", "%90")
 *   location → harita + konum işareti          ("Pasifik'te", "Avustralya açıkları")
 *   behavior → kare dizisi (2-3 kare)          ("balık yön değiştirir")
 *
 * DİSİPLİN: yapı çıkarılamıyorsa NULL döner — dekoratif dolgu ÜRETİLMEZ.
 * Bir sahnede gösterecek semantik bir şey yoksa ekran temiz kalır; sahte
 * "görsel olay" saymak, slayt hissini gizlemekten başka işe yaramıyordu.
 */

const STOP = new Set(('the a an and or of to in on for with is are this that it its your you we do does ' +
  'can will from at by as be their them they he she was were had has have but not just more most than ' +
  'then when who which into over under about after before could would should may might one some many ' +
  'much very also only even still yet because so if while during between around through what why how')
  .split(' '));

/** Kısa, okunur adım metni (telefonda tek bakışta): en fazla 5 kelime. */
function tidyStep(text) {
  const words = String(text || '')
    .replace(/[^\p{L}\p{N}\s%-]/gu, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return null;
  // Baştaki VE sondaki bağlaçları at: "and then the coral..." → "coral...",
  // "fast as their predators in" → "fast as their predators".
  while (words.length > 1 && STOP.has(words[0].toLowerCase())) words.shift();
  while (words.length > 1 && STOP.has(words[words.length - 1].toLowerCase())) words.pop();
  const kept = words.slice(0, 5);
  while (kept.length > 1 && STOP.has(kept[kept.length - 1].toLowerCase())) kept.pop();
  const out = kept.join(' ');
  return out.length >= 3 ? out.toUpperCase() : null;
}

/**
 * Süreç bölücü: SADECE bağlayıcı "tutkal" kelimeler (that/which/and/then...).
 * Eylem fiilleri (releases/travels/reaches) KASITLI olarak bölücü DEĞİL —
 * onları bölücü yapmak adımın öznesini yutuyordu ("Coral releases signals"
 * adımı "CHEMICAL SIGNALS"e düşmüştü). Fiil, ait olduğu adımda kalmalı.
 */
const PROCESS_SPLIT = /\s*(?:,|\band then\b|\bwhich then\b|\bthat then\b|\bwhich in turn\b|\bwhich\b|\bthat\b|\bthen\b|\band\b|\bso that\b|\bso\b|\buntil\b|\bbecause\b)\s*/i;
/**
 * Süreç/mekanizma fiilleri. GENİŞ tutulur: "ışık suya çarpar, renklere ayrılır,
 * resife saçılır" gibi mekanizma cümleleri dar listede LOCATION'a düşüyordu —
 * oysa bunlar tam olarak ok+sıra ile gösterilmesi gereken süreçlerdir.
 */
const PROCESS_CUE = /\b(first|then|next|finally|causes?|caused|leads? to|led to|turns? into|triggers?|releases?|sends?|travels?|reaches?|becomes?|creates?|produces?|makes? the|allows?|forces?|pushes?|pulls?|breaks? down|builds?|hits?|strikes?|splits?|scatters?|bends?|reflects?|absorbs?|filters?|traps?|carries?|carr(?:y|ies)|drives?|spreads?|forms?|feeds?|heats?|cools?|expands?|contracts?|grows?|shrinks?|rises?|falls?|sinks?|floats?|attracts?|repels?|blocks?|opens?|closes?|locks?|bursts?|explodes?|collapses?|freezes?|melts?|dissolves?|reacts?|converts?|transforms?|stores?|emits?|generates?)\b/i;

/** Karşılaştırma kalıpları. */
const COMPARE_RE = /\b(more|less|bigger|smaller|faster|slower|stronger|weaker|hotter|colder|older|younger|heavier|lighter|higher|lower|longer|shorter)\s+than\b|\b(unlike|compared to|whereas|versus|vs\.?)\b|\b(twice|three times|half|double|ten times)\s+(?:as|the)\b/i;

/** Konum ipuçları — özel ada bağlı yer. */
const LOCATION_RE = /\b(?:in|on|off|near|across|throughout|around|beneath|under|along)\s+(?:the\s+)?((?:[A-Z][\p{L}-]+(?:\s+(?:of|the|and)\s+)?){1,3})\b/u;
const PLACE_HINT = /\b(ocean|sea|reef|island|coast|desert|forest|mountain|river|lake|valley|cave|arctic|antarctic|pacific|atlantic|indian|amazon|sahara|himalaya|andes|africa|asia|europe|australia|america|antarctica)\b/i;

/** Canlı davranışı — özne + eylem. */
/**
 * Canlı davranışı. LİSTE GENİŞ tutulur: ilk sürümde "walk" yoktu ve tam da
 * amaçlanan örnek ("a termite WALKS out and MARKS the ground behind it")
 * davranış sayılmıyor, dolayısıyla iz/yürüyen özne koreografisi hiç
 * üretilmiyordu. Yürüme/işaretleme/iz bırakma fiilleri bu katmanın çekirdeği.
 */
const BEHAVIOR_RE = /\b(walk|walks|walking|crawl|crawls|crawling|march|marches|marching|wander|wanders|roam|roams|swim|swims|swimming|fly|flies|flying|hunt|hunts|hunting|feed|feeds|feeding|forage|forages|foraging|migrate|migrates|migrating|hide|hides|hiding|attack|attacks|attacking|escape|escapes|escaping|flee|flees|dance|dances|dancing|build|builds|building|dig|digs|digging|climb|climbs|climbing|chase|chases|chasing|follow|follows|following|lead|leads|leading|turn|turns|turning|move|moves|moving|gather|gathers|gathering|signal|signals|signaling|mark|marks|marking|leave|leaves|leaving|trail|trails|carry|carries|carrying|warn|warns|warning|call|calls|calling|nest|nests|nesting|guard|guards|guarding)\b/i;

/** Anlamlı sayı + birim. */
function extractNumber(text) {
  const raw = String(text || '');
  // "30 species", "90%", "1,200 years", "three times"
  const m = raw.match(/\b(\d[\d,.]*)\s*(%|percent)?\s*([a-zA-Z]{3,16})?/);
  if (!m) return null;
  const value = Number(String(m[1]).replace(/[,.]/g, ''));
  if (!Number.isFinite(value) || value < 2) return null;
  let unit = (m[2] ? 'PERCENT' : (m[3] || '')).toUpperCase();
  if (unit && STOP.has(unit.toLowerCase())) unit = '';
  const isPercent = Boolean(m[2]);
  return { value, unit: unit.slice(0, 16), isPercent };
}

/** Süreç adımlarını sırayla çıkar (2-4 adım). */
function extractProcess(text) {
  const raw = String(text || '').trim();
  if (!PROCESS_CUE.test(raw)) return null;
  const parts = raw
    .split(PROCESS_SPLIT)
    .map((p) => (p || '').trim())
    .filter((p) => p.split(/\s+/).length >= 2);
  if (parts.length < 2) return null;
  const steps = [];
  for (const p of parts) {
    const s = tidyStep(p);
    if (s && !steps.includes(s)) steps.push(s);
    if (steps.length === 4) break;
  }
  return steps.length >= 2 ? { steps } : null;
}

/** Karşılaştırmanın iki tarafını çıkar. */
function extractCompare(text) {
  const raw = String(text || '').trim();
  const hit = raw.match(COMPARE_RE);
  if (!hit) return null;
  const idx = hit.index ?? -1;
  if (idx < 0) return null;
  const left = tidyStep(raw.slice(0, idx));
  const right = tidyStep(raw.slice(idx + hit[0].length));
  if (!left || !right) return null;
  // Karşılaştırma ekseni ("FASTER", "BIGGER"...) — ortadaki kelime.
  const axis = tidyStep(hit[1] || hit[2] || hit[3] || '') || null;
  return { left, right, axis };
}

/**
 * Yer adını çıkar. ÖZEL AD önceliklidir: "off the coast of Australia" için
 * haritada işaretlenmesi gereken AUSTRALIA'dır, COAST değil.
 */
function extractLocation(text) {
  const raw = String(text || '');
  // 1) Cümle başı olmayan büyük harfli özel adlar (gerçek yer adayları).
  const propers = (raw.match(/(?<=\s)[A-Z][\p{L}-]{2,}/gu) || [])
    .filter((w) => !STOP.has(w.toLowerCase()));
  if (propers.length) {
    // Konum edatından SONRA geleni tercih et (öznenin adı değil, yerin adı).
    const prep = raw.search(/\b(?:in|on|off|near|across|around|beneath|under|along|throughout)\b/i);
    const afterPrep = prep >= 0
      ? propers.find((w) => raw.indexOf(w) > prep)
      : null;
    const pick = afterPrep || propers[0];
    if (pick) return { place: pick.toUpperCase().slice(0, 18) };
  }
  // 2) Özel ad yoksa coğrafi tür ipucu ("pacific", "reef", "desert"...).
  const hint = raw.match(PLACE_HINT);
  if (hint) return { place: hint[0].toUpperCase() };
  // 3) Son çare: edat sonrası öbek.
  const m = raw.match(LOCATION_RE);
  if (m && m[1]) {
    const place = tidyStep(m[1]);
    if (place && place.split(' ').length <= 3) return { place };
  }
  return null;
}

/** Canlı davranışı çıkar (kare dizisi için). */
function extractBehavior(text) {
  const raw = String(text || '');
  const m = raw.match(BEHAVIOR_RE);
  if (!m) return null;
  const action = m[0].toUpperCase();
  // Eylemden önceki en yakın anlamlı isim = özne.
  const before = raw.slice(0, m.index || 0).trim().split(/\s+/).filter(Boolean);
  let subject = null;
  for (let i = before.length - 1; i >= 0; i -= 1) {
    const w = before[i].replace(/[^\p{L}]/gu, '');
    if (w.length >= 3 && !STOP.has(w.toLowerCase())) { subject = w.toUpperCase(); break; }
  }
  return subject ? { subject, action } : null;
}

/**
 * Bir anlatım bloğunu sınıflandır. Yapı yoksa null (dolgu ÜRETME).
 * Öncelik: sayı > süreç > karşılaştırma > konum > davranış.
 * (Sayı ve süreç sessiz izleyiciye en çok bilgi veren iki tiptir.)
 * @param {string} narration
 * @returns {{kind:string, payload:object}|null}
 */
export function classifyBeat(narration) {
  const text = String(narration || '').trim();
  if (text.split(/\s+/).length < 3) return null;

  const num = extractNumber(text);
  if (num) return { kind: 'number', payload: num };

  const proc = extractProcess(text);
  if (proc) return { kind: 'process', payload: proc };

  const cmp = extractCompare(text);
  if (cmp) return { kind: 'compare', payload: cmp };

  const loc = extractLocation(text);
  if (loc) return { kind: 'location', payload: loc };

  const beh = extractBehavior(text);
  if (beh) return { kind: 'behavior', payload: beh };

  return null;
}

/**
 * Tüm zaman çizelgesi için semantik plan.
 *
 * Her sahne KENDİ yapısına göre kompozisyon alır. Aynı tip arka arkaya
 * gelmesin diye yumuşak rotasyon uygulanır (ikinci öncelik denenir);
 * hiçbir yapı yoksa sahne temiz bırakılır.
 *
 * @param {Array} timeline [{narration,index,start,end,part?}]
 * @returns {{beats:Array, stats:object}}
 */
export function directSemantics(timeline = []) {
  const beats = [];
  const counts = { number: 0, process: 0, compare: 0, location: 0, behavior: 0, none: 0 };
  let lastKind = null;

  for (const s of timeline || []) {
    // Alt-çekim (part1) ana çekimin devamı — üstüne ikinci kompozisyon binmesin.
    if (s.part === 1) { counts.none += 1; continue; }
    const beat = classifyBeat(s.narration);
    if (!beat) { counts.none += 1; lastKind = null; continue; }

    // Aynı tip üst üste gelirse görsel monotonluk olur; sahnede başka bir yapı
    // varsa ona geç (yoksa yine de bas — bilgi süsten önemlidir).
    let chosen = beat;
    if (beat.kind === lastKind) {
      const alt = alternativeBeat(s.narration, beat.kind);
      if (alt) chosen = alt;
    }

    const start = Number(s.start) || 0;
    const end = Math.max(start + 0.8, Number(s.end) || start + 2);
    beats.push({
      ...chosen,
      index: s.index,
      start,
      end,
      narration: s.narration,
    });
    counts[chosen.kind] += 1;
    lastKind = chosen.kind;
  }

  return {
    beats,
    stats: {
      ...counts,
      total: beats.length,
      coverage: timeline.length ? +(beats.length / timeline.length).toFixed(2) : 0,
    },
  };
}

/** Verilen tip DIŞINDA bir yapı bulmayı dene (art arda tekrarı kırmak için). */
function alternativeBeat(narration, exclude) {
  const text = String(narration || '');
  const tries = [
    ['process', extractProcess],
    ['compare', extractCompare],
    ['location', extractLocation],
    ['behavior', extractBehavior],
    ['number', extractNumber],
  ];
  for (const [kind, fn] of tries) {
    if (kind === exclude) continue;
    const payload = fn(text);
    if (payload) return { kind, payload };
  }
  return null;
}

export const BEAT_KINDS = ['number', 'process', 'compare', 'location', 'behavior'];
