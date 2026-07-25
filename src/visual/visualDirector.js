/**
 * GÖRSEL YÖNETMEN (V2) — sahne metnini analiz edip DETERMİNİSTİK görsel anlatım
 * planı çıkarır (AI YOK, bedava). Her sahneye anlatıyla ilişkili en az bir görsel
 * olay verir → "seslendirilmiş slayt" biter.
 *
 * GÜVENLİK: Nesne algılama olmadığından ARROW/CIRCLE gibi belirli bir noktayı
 * iddia eden efektler VARSAYILAN kullanılmaz (eski "rastgele ok" şikâyeti,
 * renderVideo.js:1173). Odak metadata'sı (focus) gelirse kullanılır. Güvenli
 * palet: label_pop (anahtar terim), number_counter (sayı), spotlight (merkez
 * odak), zoom_to_region (clip-fx). Bunlar yanlış-nesne riski taşımaz.
 */

const STOP = new Set(('the a an and or of to in on for with how why what is are this that it its your you we do ' +
  'does can will from at by as be his her their them they he she was were had has have but not just more most ' +
  'than then when who which into over under about after before could would should may might one two three each ' +
  'every some many much very also only even still yet because so if while during between around through').split(' '));

/** Anlatımdaki en "öğretici" tek terim: en uzun, büyük harfli/teknik eğilimli. */
function keyTerm(text) {
  const raw = String(text || '');
  // Önce cümle-ortası büyük harfli özel/teknik terim (Chromatophores, TMAO).
  const caps = (raw.match(/(?<=\s)[A-Z][\p{L}-]{4,}/gu) || []).filter((w) => !STOP.has(w.toLowerCase()));
  if (caps.length) return caps.sort((a, b) => b.length - a.length)[0];
  // Yoksa en uzun anlamlı kelime (>=6 harf).
  const words = (raw.toLowerCase().match(/[\p{L}]{6,}/gu) || []).filter((w) => !STOP.has(w));
  if (!words.length) return null;
  return words.sort((a, b) => b.length - a.length)[0];
}

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

const REVEAL = /\b(secret|hidden|reveal|mystery|truth|but|yet|turns out|actually|surprising|no one|nobody|impossible)\b/i;

/**
 * Tek sahne (görsel beat) için efekt(ler). Zaman penceresi ABSOLUTE.
 * @param {object} s {narration, index, start, end, focus?, part?}
 * @returns {Array} effects.js fx objeleri
 */
export function directScene(s = {}) {
  const start = Number(s.start) || 0;
  const end = Math.max(start + 0.8, Number(s.end) || start + 2);
  const dur = end - start;
  const idx = Number(s.index) || 0;
  const text = s.narration || '';
  const effects = [];

  // Alt-çekim part1 ise ekstra overlay basma (part0 taşıdı) → kalabalık olmasın.
  if (s.part === 1) return effects;

  const num = numberIn(text);
  if (num) {
    effects.push({ type: 'number_counter', value: num.value, suffix: num.label,
      x: 0.5, y: 0.30, start: start + 0.3, end: Math.min(end, start + dur * 0.9) });
  } else if (idx === 0 || idx % 2 === 0) {
    // Anahtar terim etiketi (her sahnede değil → altyazıyla yarışmasın).
    const term = keyTerm(text);
    if (term) effects.push({ type: 'label_pop', text: term,
      x: 0.5, y: 0.30, start: start + 0.35, end: Math.min(end, start + Math.min(dur * 0.85, 2.2)) });
  }

  // Reveal/hook beat → spotlight (merkez odak; odak metadata varsa oraya).
  if (idx === 0 || REVEAL.test(text)) {
    effects.push({ type: 'spotlight', x: s.focus?.x ?? 0.5, y: s.focus?.y ?? 0.36,
      radius: 0.27, start: start + 0.1, end: Math.min(end, start + Math.min(dur * 0.7, 1.9)) });
  }

  return effects;
}

/**
 * Tüm video için efekt listesi. Anti-tekrar + ilk-3sn garanti + üst sınır.
 * @param {Array} timeline [{narration,index,start,end,focus?,part?}]
 * @param {object} cfg config.motion.visualStorytelling
 * @returns {{effects:Array, plan:Array}}
 */
export function directVideo(timeline = [], cfg = {}) {
  const effects = [];
  const plan = [];
  let lastType = null;
  let labelCount = 0;
  const maxLabels = Math.max(2, Math.ceil(timeline.length * 0.5)); // etiket enflasyonunu engelle

  for (const s of timeline) {
    let fx = directScene(s);
    // Etiket üst sınırı: aşınca label yerine spotlight'a düş.
    fx = fx.filter((f) => {
      if (f.type === 'label_pop') {
        if (labelCount >= maxLabels) return false;
        labelCount += 1;
      }
      return true;
    });
    // Anti-tekrar: bir önceki sahnenin son tipiyle aynı ilk efekti at.
    if (fx.length && fx[0].type === lastType && fx.length > 1) fx = fx.slice(1);
    if (fx.length) lastType = fx[fx.length - 1].type;
    effects.push(...fx);
    plan.push({ index: s.index, start: s.start, end: s.end, types: fx.map((f) => f.type) });
  }

  // İlk-3sn garanti: 0-3sn arası hiç overlay yoksa hook'a spotlight ekle.
  const first3 = effects.filter((f) => f.start < 3).length;
  if (first3 < (cfg.minFirstThreeSecondsEvents || 2) && timeline[0]) {
    effects.unshift({ type: 'spotlight', x: 0.5, y: 0.34, radius: 0.28,
      start: 0.2, end: Math.min(2.6, (timeline[0].end || 2.6)) });
  }
  return { effects, plan };
}
