/**
 * AKTÖR KATMANI (V3) — kadrajın İÇİNDE durum değiştiren görsel elemanlar.
 *
 * Fark (docs/visual-storytelling-v3.md):
 *   KART/PANEL  → kadrajın ÜSTÜNDE durur, görselin içeriğine dokunmaz = dekorasyon
 *   AKTÖR       → kadrajın İÇİNDE yaşar, zaman içinde DURUMU DEĞİŞİR = anlatım
 *
 * "Termit yürür, arkasında feromon izi oluşur, diğerleri takip eder" cümlesi
 * bir kartla anlatılamaz; walker + trail + followers aktörleriyle anlatılır.
 *
 * Tüm koordinatlar NORMALİZE (0..1). Zamanlar saniye (mutlak).
 * Çizim tamamen ASS/libass vektör — yeni bağımlılık yok.
 *
 * TASARIM NOTU (kanıt render'ından öğrenilen): bir izi tek bir çok-noktalı
 * `m ... l ... l ...` yolu olarak çizmek YANLIŞ — libass yolu KAPATIR ve
 * izin sonundan başına dönen hayalet bir çizgi görünür. Bu yüzden iz, her biri
 * kalın bir dörtgen olan AYRI SEGMENTLERden kurulur; segmentler sırayla
 * belirdiği için iz zaten "kendini çizmiş" olur (ayrıca clip animasyonu
 * gerekmez).
 */
import { assColor, assTime } from './effects.js';
import { CANVAS } from './coords.js';

const ACCENT = '3BD0C8';
// assColor() RRGGBB alır ve içinde BGR'ye çevirir → burada RRGGBB yazılır.
// (İlk sürümde BGR yazılmıştı: sıcak hava MAVİ, soğuk hava TURUNCU çıkıyordu.)
const HOT = 'F0522B';   // kırmızı-turuncu: yükselen sıcak hava
const COLD = '2B8CF0';  // mavi: inen soğuk hava
const INK = 'FFFFFF';

const D = (layer, style, s, e, tags, text = '') =>
  `Dialogue: ${layer},${assTime(s)},${assTime(e)},${style},,0,0,0,,${tags}${text}`;

const px = (p) => ({ x: Math.round(p[0] * CANVAS.w), y: Math.round(p[1] * CANVAS.h) });

/** Kalın çizgi = dörtgen. p1→p2 arası, w piksel kalınlıkta. */
function segmentQuad(p1, p2, w) {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * (w / 2);
  const ny = (dx / len) * (w / 2);
  const r = (v) => Math.round(v);
  return `m ${r(p1.x + nx)} ${r(p1.y + ny)} l ${r(p2.x + nx)} ${r(p2.y + ny)} ` +
    `l ${r(p2.x - nx)} ${r(p2.y - ny)} l ${r(p1.x - nx)} ${r(p1.y - ny)}`;
}

/** Yol uzunluğuna göre segment başına süre dağıt. */
function segmentTimes(points, start, end) {
  const pts = points.map(px);
  const lens = [];
  let total = 0;
  for (let i = 0; i < pts.length - 1; i += 1) {
    const l = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
    lens.push(l); total += l;
  }
  const span = Math.max(0.3, end - start);
  const times = [start];
  let acc = 0;
  for (const l of lens) { acc += l; times.push(start + span * (acc / (total || 1))); }
  return { pts, times };
}

/* ------------------------------------------------------------------ *
 * TRAIL — kendini çizen iz (feromon yolu, rota, akış hattı)
 * ------------------------------------------------------------------ */
function trailActor(a) {
  const points = a.path || [];
  if (points.length < 2) return [];
  const { pts, times } = segmentTimes(points, a.start, a.end);
  const col = assColor(a.color || ACCENT);
  const w = a.width || 14;
  const out = [];
  for (let i = 0; i < pts.length - 1; i += 1) {
    // Segment belirir ve sahne sonuna kadar KALIR → iz birikerek büyür.
    out.push(D(4, 'ActShape', times[i], a.holdUntil ?? a.end,
      `{\\an7\\pos(0,0)\\1c${col}\\1a&H28&\\bord0\\fad(120,0)\\p1}` +
      segmentQuad(pts[i], pts[i + 1], w) + '{\\p0}'));
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * WALKER — yol boyunca ilerleyen özne (+ gecikmeli takipçiler)
 * ------------------------------------------------------------------ */
function walkerActor(a) {
  const points = a.path || [];
  if (points.length < 2) return [];
  const { pts, times } = segmentTimes(points, a.start, a.end);
  const out = [];
  const r = a.radius || 15;
  const dot = `m ${-r} 0 b ${-r} ${-r} ${r} ${-r} ${r} 0 b ${r} ${r} ${-r} ${r} ${-r} 0`;

  const drawRunner = (delay, color, alpha, layer, scale) => {
    const rr = Math.round(r * (scale || 1));
    const shape = `m ${-rr} 0 b ${-rr} ${-rr} ${rr} ${-rr} ${rr} 0 b ${rr} ${rr} ${-rr} ${rr} ${-rr} 0`;
    for (let i = 0; i < pts.length - 1; i += 1) {
      const t0 = times[i] + delay;
      const t1 = times[i + 1] + delay;
      if (t0 >= a.end) break;
      out.push(D(layer, 'ActShape', t0, Math.min(t1, a.end),
        `{\\an5\\move(${pts[i].x},${pts[i].y},${pts[i + 1].x},${pts[i + 1].y})` +
        `\\1c${assColor(color)}\\1a&H${alpha}&\\bord0\\p1}${shape}{\\p0}`));
    }
  };

  drawRunner(0, a.color || 'FF8800', '00', 6, 1);              // öncü
  const followers = Math.max(0, Math.min(4, a.followers || 0));
  for (let k = 1; k <= followers; k += 1) {
    drawRunner(k * (a.lag || 0.5), a.followerColor || INK, '50', 5, 0.72);
  }
  void dot;
  return out;
}

/* ------------------------------------------------------------------ *
 * FLOW_ARROW — yön gösteren, İLERLEYEN ok (hava akışı, kuvvet, göç)
 * ------------------------------------------------------------------ */
function flowArrowActor(a) {
  if (!a.from || !a.to) return [];
  const p1 = px(a.from);
  const p2 = px(a.to);
  const col = assColor(a.color || (a.temp === 'hot' ? HOT : a.temp === 'cold' ? COLD : ACCENT));
  const out = [];
  const w = a.width || 12;

  // Gövde: kısa parçalara bölünüp sırayla belirir → ok "akar".
  const steps = 5;
  const span = Math.max(0.3, a.end - a.start) * 0.7;
  for (let i = 0; i < steps; i += 1) {
    const q1 = { x: p1.x + ((p2.x - p1.x) * i) / steps, y: p1.y + ((p2.y - p1.y) * i) / steps };
    const q2 = { x: p1.x + ((p2.x - p1.x) * (i + 1)) / steps, y: p1.y + ((p2.y - p1.y) * (i + 1)) / steps };
    out.push(D(4, 'ActShape', a.start + (span * i) / steps, a.end,
      `{\\an7\\pos(0,0)\\1c${col}\\1a&H25&\\bord0\\fad(100,0)\\p1}` +
      segmentQuad(q1, q2, w) + '{\\p0}'));
  }
  // Uç: gövde tamamlanınca belirir.
  const ang = Math.atan2(p2.y - p1.y, p2.x - p1.x);
  const hl = w * 2.6;
  const tip = (deg) => ({
    x: Math.round(p2.x - hl * Math.cos(ang + deg)),
    y: Math.round(p2.y - hl * Math.sin(ang + deg)),
  });
  const t1 = tip(0.5); const t2 = tip(-0.5);
  out.push(D(5, 'ActShape', a.start + span, a.end,
    `{\\an7\\pos(0,0)\\1c${col}\\1a&H10&\\bord0\\fad(120,0)\\p1}` +
    `m ${p2.x} ${p2.y} l ${t1.x} ${t1.y} l ${t2.x} ${t2.y}{\\p0}`));
  return out;
}

/* ------------------------------------------------------------------ *
 * RING — ÖLÇÜLMÜŞ konuma kilitlenen halka (search & reveal)
 * ------------------------------------------------------------------ */
function ringActor(a) {
  if (!a.at) return [];
  const c = px(a.at);
  const r = Math.round((a.radius || 0.12) * CANVAS.w);
  const col = assColor(a.color || ACCENT);
  const circle = `m ${-r} 0 b ${-r} ${-r} ${r} ${-r} ${r} 0 b ${r} ${r} ${-r} ${r} ${-r} 0`;
  const out = [];
  // Tarama → kilitlenme: geniş başlar, hedefe oturur.
  out.push(D(5, 'ActShape', a.start, a.end,
    `{\\an5\\pos(${c.x},${c.y})\\1a&HFF&\\3c${col}\\3a&H18&\\bord6\\fad(140,180)` +
    `\\fscx220\\fscy220\\t(0,420,\\fscx100\\fscy100)\\p1}${circle}{\\p0}`));
  // Nabız (kilitlendikten sonra).
  out.push(D(4, 'ActShape', a.start + 0.45, a.end,
    `{\\an5\\pos(${c.x},${c.y})\\1a&HFF&\\3c${col}\\3a&H70&\\bord3` +
    `\\fscx100\\fscy100\\t(0,1000,\\fscx145\\fscy145\\3a&HFF&)\\p1}${circle}{\\p0}`));
  return out;
}

/* ------------------------------------------------------------------ *
 * FILL_METER — bir SÜRECİN dolması (sayacı besleyen görsel)
 * ------------------------------------------------------------------ */
function fillMeterActor(a) {
  const c = px(a.at || [0.5, 0.60]);
  const w = Math.round((a.width || 0.52) * CANVAS.w);
  const h = a.height || 26;
  const col = assColor(a.color || ACCENT);
  const ratio = Math.max(0.02, Math.min(1, a.ratio ?? 1));
  const rise = Math.max(0.4, (a.end - a.start) * 0.6);
  const rect = (ww) => `m 0 0 l ${ww} 0 l ${ww} ${h} l 0 ${h}`;
  return [
    D(4, 'ActShape', a.start, a.end,
      `{\\an5\\pos(${c.x},${c.y})\\1c${assColor('0E1A20')}\\1a&H40&\\bord0\\fad(140,160)\\p1}` +
      rect(w) + '{\\p0}'),
    // Dolan kısım: SOLDAN sağa gerçekten büyür (sayacın "neden arttığı" bu).
    D(5, 'ActShape', a.start, a.end,
      `{\\an4\\pos(${c.x - Math.round(w / 2)},${c.y})\\1c${col}\\1a&H10&\\bord0\\fad(140,160)` +
      `\\fscx0\\t(0,${Math.round(rise * 1000)},\\fscx100)\\p1}` +
      rect(Math.round(w * ratio)) + '{\\p0}'),
  ];
}

/* ------------------------------------------------------------------ *
 * READOUT — sayı göstergesi. TEK BAŞINA GEÇERSİZ: onu besleyen bir
 * süreç aktörü (fill_meter / trail / chain) olmadan çizilmez.
 * ------------------------------------------------------------------ */
function readoutActor(a) {
  const target = Math.round(Number(a.value) || 0);
  if (!target) return [];
  const c = px(a.at || [0.5, 0.48]);
  const out = [];
  const rise = Math.min(Math.max(0.5, (a.end - a.start) * 0.55), 1.3);
  const steps = 14;
  for (let i = 0; i < steps; i += 1) {
    const t0 = a.start + (rise * i) / steps;
    const t1 = i === steps - 1 ? a.end : a.start + (rise * (i + 1)) / steps;
    const val = Math.round((target * (i + 1)) / steps);
    const shown = a.isPercent ? `${val}%` : val.toLocaleString('en-US');
    out.push(D(6, 'ActBig', t0, t1,
      `{\\an5\\pos(${c.x},${c.y})\\fs132\\b1${i === 0 ? '\\fad(150,0)' : ''}}`, shown));
  }
  if (a.unit) {
    out.push(D(6, 'ActText', a.start + 0.2, a.end,
      `{\\an5\\pos(${c.x},${c.y + 96})\\fs46\\1c${assColor(ACCENT)}\\fad(160,180)}`, String(a.unit)));
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * CHAIN — sebep→sonuç / zincir reaksiyonu: düğümler sırayla tetiklenir
 * ------------------------------------------------------------------ */
function chainActor(a) {
  const nodes = a.nodes || [];
  if (nodes.length < 2) return [];
  const out = [];
  const span = Math.max(0.6, a.end - a.start);
  const per = span / nodes.length;
  const col = assColor(a.color || ACCENT);
  const r = a.radius || 22;
  const circle = `m ${-r} 0 b ${-r} ${-r} ${r} ${-r} ${r} 0 b ${r} ${r} ${-r} ${r} ${-r} 0`;
  nodes.forEach((n, i) => {
    const c = px(n.at || [0.5, 0.5]);
    const t = a.start + per * i;
    out.push(D(5, 'ActShape', t, a.end,
      `{\\an5\\pos(${c.x},${c.y})\\1c${col}\\1a&H10&\\bord0\\fad(120,150)` +
      `\\fscx40\\fscy40\\t(0,220,\\fscx100\\fscy100)\\p1}${circle}{\\p0}`));
    if (n.label) {
      out.push(D(6, 'ActSmall', t + 0.1, a.end,
        `{\\an5\\pos(${c.x},${c.y - r - 26})\\fs34\\fad(120,150)}`, String(n.label)));
    }
    // Bir önceki düğümden bu düğüme ilerleyen bağ.
    if (i > 0) {
      const prev = px(nodes[i - 1].at || [0.5, 0.5]);
      out.push(...flowArrowActor({
        from: nodes[i - 1].at, to: n.at, start: t - per * 0.55, end: a.end, width: 8, color: a.color,
      }));
      void prev;
    }
  });
  return out;
}

const ACTORS = {
  trail: trailActor,
  walker: walkerActor,
  flow_arrow: flowArrowActor,
  ring: ringActor,
  fill_meter: fillMeterActor,
  readout: readoutActor,
  chain: chainActor,
};

const HEADER = (w, h) => `[Script Info]
ScriptType: v4.00+
PlayResX: ${w}
PlayResY: ${h}
ScaledBorderAndShadow: yes
WrapStyle: 2

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: ActShape,Montserrat SemiBold,40,${assColor(ACCENT)},${assColor('000000', '64')},${assColor('000000', '64')},0,0,0,0,100,100,0,0,1,0,0,7,0,0,0,1
Style: ActText,Montserrat SemiBold,44,${assColor(INK)},${assColor('05080A')},${assColor('000000', '50')},1,0,0,0,100,100,0,0,1,3,2,5,0,0,0,1
Style: ActSmall,Montserrat SemiBold,34,${assColor(INK)},${assColor('05080A')},${assColor('000000', '60')},1,0,0,0,100,100,0,0,1,3,2,5,0,0,0,1
Style: ActBig,Montserrat SemiBold,132,${assColor(INK)},${assColor('05080A')},${assColor('000000', '40')},1,0,0,0,100,100,0,0,1,5,3,5,0,0,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

/** Tek aktör → ASS satırları. Bilinmeyen tip / eksik veri → []. */
export function actorEvents(actor) {
  const fn = ACTORS[actor?.type];
  if (!fn) return [];
  if (!Number.isFinite(actor.start) || !Number.isFinite(actor.end) || actor.end <= actor.start) return [];
  try {
    return fn(actor) || [];
  } catch {
    return []; // tek aktör patlarsa video kırılmasın
  }
}

/**
 * Aktör listesini tek ASS'e derle.
 *
 * KURAL: 'readout' aktörü, aynı sahnede onu BESLEYEN bir süreç aktörü
 * (fill_meter / trail / chain / flow_arrow) yoksa ÇİZİLMEZ. Audit'teki
 * "7500 çıkıyor ama neyin 7500'ü?" sorunu tam olarak budur: sayı, kendisini
 * üreten görsel süreç olmadan havada kalır.
 *
 * @param {Array} actors
 * @returns {string} '' = çizilecek aktör yok (ekran temiz kalır)
 */
export function buildActorAss(actors = [], { width = CANVAS.w, height = CANVAS.h } = {}) {
  const SUPPORT = new Set(['fill_meter', 'trail', 'chain', 'flow_arrow', 'walker']);
  const events = [];
  for (const a of actors) {
    if (a?.type === 'readout') {
      const supported = actors.some((o) => o !== a && SUPPORT.has(o?.type)
        && Number.isFinite(o.start) && Math.abs(o.start - a.start) < 3.5);
      if (!supported) continue; // havada kalan sayaç çizilmez
    }
    events.push(...actorEvents(a));
  }
  if (!events.length) return '';
  return HEADER(width, height) + events.join('\n') + '\n';
}

export const ACTOR_TYPES = Object.keys(ACTORS);
