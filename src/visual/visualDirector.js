/**
 * GÖRSEL YÖNETMEN (V2) — sahne metnini analiz edip DETERMİNİSTİK görsel anlatım
 * planı çıkarır (AI YOK, bedava).
 *
 * GÜVENLİK / KALİTE: Nesne algılama olmadığından ekranın ortasına bir şey
 * KONUMLANDIRAN efektler (spotlight = merkezi karart+oy, label_pop = anahtar
 * terim etiketi) güzel görüntünün üstünü kapatıp "rastgele yuvarlak/etiket"
 * hissi veriyor → KULLANILMIYOR. Yalnızca anlatımda GERÇEK bir sayı varsa,
 * o sayıyı sayan number_counter basılır (bilgilendirici, opt-in). Sayı yoksa
 * hiçbir overlay basılmaz — görüntü + altyazı + logo temiz kalır.
 *
 * effects.js render motoru spotlight/label_pop'u hâlâ ÇİZEBİLİR (birim testleri
 * ve olası ileride kullanım için); burada sadece OTOMATİK ÜRETİMDEN çıkarıldılar.
 */

const STOP = new Set(('the a an and or of to in on for with how why what is are this that it its your you we do ' +
  'does can will from at by as be his her their them they he she was were had has have but not just more most ' +
  'than then when who which into over under about after before could would should may might one two three each ' +
  'every some many much very also only even still yet because so if while during between around through').split(' '));

/** Anlatımda anlamlı bir sayı var mı? Sayaç değeri + BİRİM etiketi döner. */
function numberIn(text) {
  const m = String(text || '').match(/\b(\d{1,4})\s*(%|\+)?\s*([a-zA-Z]{3,14})?/);
  if (!m) return null;
  const value = Number(m[1]);
  if (!Number.isFinite(value) || value < 3) return null;
  let unit = (m[3] || '').toUpperCase();
  if (unit && STOP.has(unit.toLowerCase())) unit = '';       // "30 and" → birim yok
  if (!unit && m[2] === '%') unit = 'PERCENT';
  return { value, label: unit.slice(0, 16) };                // sayaç zaten sayıyı sayar → suffix SADECE birim
}

/**
 * Tek sahne (görsel beat) için efekt(ler). Zaman penceresi ABSOLUTE.
 * Yalnızca anlatımda gerçek bir sayı varsa number_counter üretir; aksi hâlde
 * boş döner (görüntü temiz kalır). spotlight/label_pop artık üretilmez.
 * @param {object} s {narration, index, start, end, part?}
 * @returns {Array} effects.js fx objeleri
 */
export function directScene(s = {}) {
  const start = Number(s.start) || 0;
  const end = Math.max(start + 0.8, Number(s.end) || start + 2);
  const dur = end - start;
  const text = s.narration || '';
  const effects = [];

  // Alt-çekim part1 ise ekstra overlay basma (part0 taşıdı) → kalabalık olmasın.
  if (s.part === 1) return effects;

  const num = numberIn(text);
  if (num) {
    effects.push({ type: 'number_counter', value: num.value, suffix: num.label,
      x: 0.5, y: 0.30, start: start + 0.3, end: Math.min(end, start + dur * 0.9) });
  }

  return effects;
}

/**
 * Tüm video için efekt listesi. Sadece anlamlı sayı sayaçları; ard arda aynı
 * sahnede tekrar etmesin diye anti-tekrar korunur.
 * @param {Array} timeline [{narration,index,start,end,part?}]
 * @param {object} cfg config.motion.visualStorytelling (şimdilik kullanılmıyor)
 * @returns {{effects:Array, plan:Array}}
 */
export function directVideo(timeline = [], cfg = {}) { // eslint-disable-line no-unused-vars
  const effects = [];
  const plan = [];

  for (const s of timeline) {
    const fx = directScene(s);
    effects.push(...fx);
    plan.push({ index: s.index, start: s.start, end: s.end, types: fx.map((f) => f.type) });
  }

  return { effects, plan };
}
