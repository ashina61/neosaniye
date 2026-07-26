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

/** Merkezi (cx,cy) olan, MUTLAK kanvas koordinatlarında daire yolu. */
function circlePath(cx, cy, r) {
  const k = Math.round(r);
  // KONTROL NOKTASI (4/3)k OLMAK ZORUNDA, k DEĞİL.
  //
  // İlk sürüm kontrol noktalarını cy∓k'ya koyuyordu. Yarım daireyi tek kübik
  // Bézier ile çizerken bu YANLIŞTIR: t=0.5'te eğri yalnızca 0.75k yükselir,
  // yani şekil 2k genişliğinde ama 1.5k yüksekliğinde bir ELİPS olur.
  // Canlı kanıt (fungal-networks önizlemeleri): ekrandaki camgöbeği "daireler"
  // gözle görülür biçimde yayvandı. Sistemdeki BÜTÜN daireler (halka, düğüm,
  // nabız) bu hatayı taşıyordu.
  // Doğrusu: (P0+3P1+3P2+P3)/8 = cy-k olması için kontrol ofseti (4/3)k.
  const c = Math.round(k * 4 / 3);
  const x0 = Math.round(cx) - k;
  const x1 = Math.round(cx) + k;
  const y = Math.round(cy);
  return `m ${x0} ${y} ` +
    `b ${x0} ${y - c} ${x1} ${y - c} ${x1} ${y} ` +
    `b ${x1} ${y + c} ${x0} ${y + c} ${x0} ${y}`;
}

/**
 * ÖLÇEĞİ DEĞİŞEN HALKA — `\fscx` ile DEĞİL, her adımda gerçek yarıçapla.
 *
 * Kanıt render'ı (scratchpad/proof) şunu gösterdi: libass bir çizimi `\fscx`
 * ile ölçeklerken şekil `\pos` noktası etrafında büyümüyor; %400'lük bir dalga
 * öznenin belirgin şekilde SOLUNA ve ÜSTÜNE kayıyor. Kullanıcının "daire
 * nesnenin üstünde değil, yukarısında" şikâyetinin kaynağı tam olarak bu.
 * Yarıçapı adım adım yeniden çizmek, merkezi matematiksel olarak kilitler:
 * çizim mutlak koordinatlarda (`\an7\pos(0,0)`) yapılır, hiçbir hizalama ya da
 * ölçekleme araya girmez.
 */
function radialSteps(centerPx, {
  r0, r1, start, end, color, bord = 5, fromAlpha = 0x20, toAlpha = 0xFF,
  steps = 10, layer = 4,
}) {
  const out = [];
  const span = Math.max(0.2, end - start);
  const dt = span / steps;
  for (let i = 0; i < steps; i += 1) {
    const t = i / Math.max(1, steps - 1);
    const r = r0 + (r1 - r0) * t;
    const alpha = Math.round(fromAlpha + (toAlpha - fromAlpha) * t);
    if (alpha >= 0xFA) break; // görünmez adımı çizme
    const t0 = start + dt * i;
    const t1 = Math.min(end, t0 + dt * 1.7); // hafif bindirme → basamak görünmesin
    out.push(D(layer, 'ActShape', t0, t1,
      `{\\an7\\pos(0,0)\\1a&HFF&\\3c${color}\\3a&H${alpha.toString(16).padStart(2, '0').toUpperCase()}&` +
      `\\bord${bord}\\fad(70,90)\\p1}${circlePath(centerPx.x, centerPx.y, r)}{\\p0}`));
  }
  return out;
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
  const lock = Math.min(0.5, Math.max(0.25, (a.end - a.start) * 0.25));
  const out = [];
  // Tarama → kilitlenme: geniş başlar, hedefin ÜSTÜNE oturur. Merkez her
  // adımda yeniden hesaplandığı için halka gerçekten özneyi çevreler.
  out.push(...radialSteps(c, {
    r0: r * 2.1, r1: r, start: a.start, end: a.start + lock,
    color: col, bord: 6, fromAlpha: 0x60, toAlpha: 0x14, steps: 7, layer: 5,
  }));
  // Kilitlenmiş halka: sahne sonuna kadar hedefin üstünde DURUR.
  out.push(D(5, 'ActShape', a.start + lock, a.end,
    `{\\an7\\pos(0,0)\\1a&HFF&\\3c${col}\\3a&H14&\\bord6\\fad(0,180)\\p1}` +
    `${circlePath(c.x, c.y, r)}{\\p0}`));
  // Nabız: dışarı doğru sönen tek dalga (dikkati halkaya çeker).
  out.push(...radialSteps(c, {
    r0: r, r1: r * 1.5, start: a.start + lock + 0.15, end: Math.min(a.end, a.start + lock + 1.15),
    color: col, bord: 3, fromAlpha: 0x70, toAlpha: 0xF0, steps: 8, layer: 4,
  }));
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

/* ------------------------------------------------------------------ *
 * SIGNAL_WAVE — kaynaktan yayılan sinyal (iletişim, uyarı, koku, ses)
 * Kaynak ÖLÇÜLMÜŞ konumdur; dalgalar oradan çıkar. "Bu noktadan bir şey
 * yayılıyor" iddiası, doğrulanmış bir konuma dayanır.
 * ------------------------------------------------------------------ */
function signalWaveActor(a) {
  if (!a.at) return [];
  const c = px(a.at);
  const col = assColor(a.color || ACCENT);
  const r = Math.round((a.radius || 0.05) * CANVAS.w);
  const out = [];
  const span = Math.max(0.8, a.end - a.start);
  const life = Math.min(1.6, span * 0.65);

  // Kaynak: sahne boyunca duran çekirdek (sinyalin NEREDEN çıktığı).
  out.push(D(5, 'ActShape', a.start, a.end,
    `{\\an7\\pos(0,0)\\1c${col}\\1a&H10&\\bord0\\fad(140,160)\\p1}` +
    `${circlePath(c.x, c.y, Math.round(r * 0.42))}{\\p0}`));

  // Dalgalar: sırayla çıkar, büyürken saydamlaşır → "yayılıyor".
  // Yarıçap adım adım çizilir; merkez kaynaktan HİÇ kaymaz.
  const waves = 3;
  const gap = Math.max(0.3, (span - life) / waves);
  for (let i = 0; i < waves; i += 1) {
    const t0 = a.start + 0.15 + gap * i;
    if (t0 + 0.35 >= a.end) break;
    out.push(...radialSteps(c, {
      r0: r * 0.5, r1: r * 3.4, start: t0, end: Math.min(a.end, t0 + life),
      color: col, bord: 5, fromAlpha: 0x20, toAlpha: 0xF5, steps: 9, layer: 4,
    }));
  }

  // Alıcı (varsa): sinyal ulaştığında yanar — sinyalin BİR HEDEFİ olduğunu gösterir.
  if (a.to) {
    const t = px(a.to);
    const arrive = Math.min(a.end - 0.25, a.start + life * 0.75);
    out.push(D(5, 'ActShape', arrive, a.end,
      `{\\an7\\pos(0,0)\\1c${col}\\1a&H18&\\bord0\\fad(160,180)\\p1}` +
      `${circlePath(t.x, t.y, Math.round(r * 0.5))}{\\p0}`));
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * SPREAD — bir noktadan DIŞARI doğru çoğalma (zincir reaksiyonu, salgın,
 * koloni büyümesi). chain'den farkı: sıralı bir yol değil, RADYAL yayılım.
 * ------------------------------------------------------------------ */
function spreadActor(a) {
  if (!a.at) return [];
  const o = px(a.at);
  const col = assColor(a.color || ACCENT);
  const span = Math.max(0.8, a.end - a.start);
  const out = [];
  // Dikey yarıçap piksel cinsinden eşit olsun (kadraj 9:16, normalize koordinat değil).
  const aspect = CANVAS.w / CANVAS.h;
  const rings = [
    { r: 0.13, count: 4, phase: 0.42 },
    { r: 0.23, count: 6, phase: 0 },
  ];

  out.push(D(5, 'ActShape', a.start, a.end,
    `{\\an7\\pos(0,0)\\1c${col}\\1a&H10&\\bord0\\fad(120,150)\\p1}` +
    `${circlePath(o.x, o.y, 20)}{\\p0}`));

  rings.forEach((ring, ri) => {
    for (let k = 0; k < ring.count; k += 1) {
      const ang = ring.phase + (Math.PI * 2 * k) / ring.count;
      const nx = a.at[0] + Math.cos(ang) * ring.r;
      const ny = a.at[1] + Math.sin(ang) * ring.r * aspect;
      // KADRAJ DIŞINA taşan düğüm ÇİZİLMEZ (yeniden konumlandırılmaz —
      // konumu kaydırmak, düzeltilmek istenen "uydurma konum" hatasıdır).
      if (nx < 0.08 || nx > 0.92 || ny < 0.12 || ny > 0.76) continue;
      const p = px([nx, ny]);
      const t0 = a.start + 0.25 + span * 0.28 * ri + k * 0.07;
      if (t0 + 0.25 >= a.end) continue;
      // Merkezden düğüme uzanan ince bağ: yayılımın YÖNÜNÜ okutur.
      out.push(D(3, 'ActShape', t0, a.end,
        `{\\an7\\pos(0,0)\\1c${col}\\1a&H60&\\bord0\\fad(120,150)\\p1}` +
        segmentQuad(o, p, 5) + '{\\p0}'));
      out.push(D(5, 'ActShape', t0 + 0.06, a.end,
        `{\\an7\\pos(0,0)\\1c${col}\\1a&H1A&\\bord0\\fad(140,150)\\p1}` +
        `${circlePath(p.x, p.y, ri === 0 ? 15 : 12)}{\\p0}`));
    }
  });
  return out;
}

/* ------------------------------------------------------------------ *
 * AXIS — zaman ekseni + ilerleyen imleç. İşaretler UYDURULMAZ: anlatımdan
 * çıkarılmış gerçek zaman noktaları (yıl/süre) verilmezse çizilmez.
 * ------------------------------------------------------------------ */
function axisActor(a) {
  const marks = (a.marks || []).slice(0, 5);
  if (marks.length < 2) return [];
  const y = Math.round((a.y ?? 0.70) * CANVAS.h);
  const x0 = Math.round(0.13 * CANVAS.w);
  const x1 = Math.round(0.87 * CANVAS.w);
  const w = x1 - x0;
  const col = assColor(a.color || ACCENT);
  const span = Math.max(0.8, a.end - a.start);
  const grow = Math.min(1.4, span * 0.55);
  const out = [];

  // Eksen çizgisi SOLDAN sağa uzar (fillMeter ile aynı kanıtlanmış numara).
  out.push(D(4, 'ActShape', a.start, a.end,
    `{\\an4\\pos(${x0},${y})\\1c${col}\\1a&H25&\\bord0\\fad(140,180)` +
    `\\fscx0\\t(0,${Math.round(grow * 1000)},\\fscx100)\\p1}` +
    `m 0 0 l ${w} 0 l ${w} 7 l 0 7{\\p0}`));

  marks.forEach((m, i) => {
    const fx = marks.length === 1 ? 0.5 : i / (marks.length - 1);
    const mx = Math.round(x0 + w * fx);
    const t = a.start + 0.15 + grow * fx;
    if (t >= a.end) return;
    out.push(D(5, 'ActShape', t, a.end,
      `{\\an7\\pos(0,0)\\1c${col}\\1a&H10&\\bord0\\fad(120,160)\\p1}` +
      `${circlePath(mx, y, 9)}{\\p0}`));
    if (m.label) {
      out.push(D(6, 'ActSmall', t + 0.05, a.end,
        `{\\an5\\pos(${mx},${y - 48})\\fs36\\fad(120,160)}`, String(m.label)));
    }
  });

  // İmleç: eksen boyunca ilerler — "zaman akıyor".
  out.push(D(6, 'ActShape', a.start + 0.15, Math.min(a.end, a.start + 0.15 + grow),
    `{\\an5\\move(${x0},${y},${x1},${y})\\1c${assColor(INK)}\\1a&H10&\\bord0\\fad(120,120)\\p1}` +
    `m -13 -22 l 13 -22 l 0 6{\\p0}`));
  return out;
}

/* ------------------------------------------------------------------ *
 * BUILD_UP — katman katman YÜKSELEN yapı (inşa, birikme, tabakalaşma).
 * Taban ÖLÇÜLMÜŞ odaktır; katmanlar oradan yukarı doğru birikir, üste
 * doğru daralır. "Watch it rise" görevinin ekrandaki karşılığı.
 * ------------------------------------------------------------------ */
function buildUpActor(a) {
  if (!a.at) return [];
  const layers = Math.max(3, Math.min(6, a.layers || 5));
  const col = assColor(a.color || ACCENT);
  const baseW = Math.round((a.width || 0.30) * CANVAS.w);
  const total = Math.round((a.height || 0.24) * CANVAS.h);
  const bandH = Math.round(total / layers);
  const cx = Math.round(a.at[0] * CANVAS.w);
  const baseY = Math.round(Math.min(0.82, a.at[1] + 0.10) * CANVAS.h);
  const span = Math.max(0.6, a.end - a.start);
  const per = Math.min(0.42, (span * 0.7) / layers);
  const out = [];
  for (let i = 0; i < layers; i += 1) {
    // Üste doğru daralan gövde → kule silueti okunur.
    const w = Math.round(baseW * (1 - (i / layers) * 0.55));
    const top = baseY - bandH * (i + 1);
    const t0 = a.start + per * i;
    if (t0 + 0.2 >= a.end) break;
    out.push(D(4, 'ActShape', t0, a.end,
      // Yarı saydam: katman fotoğrafın üstünü KAPATMAZ, yapıyı okutur.
      `{\\an7\\pos(0,0)\\1c${col}\\1a&H${i % 2 ? '68' : '58'}&\\bord0\\fad(160,180)\\p1}` +
      `m ${cx - Math.round(w / 2)} ${top} l ${cx + Math.round(w / 2)} ${top} ` +
      `l ${cx + Math.round(w / 2)} ${top + bandH - 3} l ${cx - Math.round(w / 2)} ${top + bandH - 3}{\\p0}`));
  }
  return out;
}

/* ================================================================== *
 * V3 §5 — OKLAR, İŞARETLER VE EKRANA KİTLEME
 *
 * ANA KURAL: her overlay şu soruyu cevaplamalı — "izleyici şu anda tam olarak
 * NEREYE ve NEDEN bakmalı?" Cevabı olmayan overlay çizilmez. Bu yüzden
 * aşağıdaki aktörlerin hepsi bir HEDEF (`at` / `to`) ister ve hedefsiz
 * çağrıldıklarında boş döner — rastgele dekorasyon üretmezler.
 * ================================================================== */

/* ------------------------------------------------------------------ *
 * ARROW_POINTER — "şuraya bak". Kısa, keskin, hedefe DOKUNAN ok.
 * flow_arrow'dan farkı: o bir AKIŞI (A'dan B'ye taşınma) anlatır, bu bir
 * İŞARETTİR. İkisini karıştırmak "veri buraya aktı" ile "buraya bak"ı
 * aynı görsele indirir.
 * ------------------------------------------------------------------ */
function arrowPointerActor(a) {
  if (!a.at) return [];
  const tip = px(a.at);
  const col = assColor(a.color || ACCENT);
  const len = Math.round((a.length || 0.16) * CANVAS.w);
  // Geliş yönü: hedef solda ise sağdan, sağdaysa soldan gelir (kadraj dışına
  // taşmasın diye). Dikey kaçış payı sabit.
  const dir = a.at[0] > 0.5 ? -1 : 1;
  const tail = { x: tip.x - dir * len, y: tip.y - Math.round(len * 0.42) };
  const head = 16;
  const dx = tip.x - tail.x; const dy = tip.y - tail.y;
  const L = Math.hypot(dx, dy) || 1;
  const ux = dx / L; const uy = dy / L;
  // Uç, hedefin ÜSTÜNE binmesin: 10px önce durur.
  const stop = { x: Math.round(tip.x - ux * 10), y: Math.round(tip.y - uy * 10) };
  const grow = Math.min(0.45, Math.max(0.22, (a.end - a.start) * 0.3));
  const r = Math.round;
  return [
    // Gövde: soldan sağa GERÇEKTEN uzar (\fscx ile değil, an7 çizim +
    // clip yerine iki adımlı süre; libass \fscx çizimi \pos etrafında
    // ölçeklemiyor, bu ders daha önce halkalarda alındı).
    D(5, 'ActShape', a.start, a.end,
      `{\\an7\\pos(0,0)\\1c${col}\\1a&H18&\\bord0\\fad(120,160)` +
      `\\clip(${Math.min(tail.x, stop.x) - 4},${Math.min(tail.y, stop.y) - 20},` +
      `${Math.min(tail.x, stop.x) - 4},${Math.max(tail.y, stop.y) + 20})` +
      `\\t(0,${r(grow * 1000)},\\clip(${Math.min(tail.x, stop.x) - 4},${Math.min(tail.y, stop.y) - 20},` +
      `${Math.max(tail.x, stop.x) + 4},${Math.max(tail.y, stop.y) + 20}))\\p1}` +
      segmentQuad(tail, stop, a.width || 9) + '{\\p0}'),
    // Uç üçgeni: gövde uzadıktan SONRA belirir → "vardı" hissi.
    D(6, 'ActShape', a.start + grow, a.end,
      `{\\an7\\pos(0,0)\\1c${col}\\1a&H10&\\bord0\\fad(90,160)\\p1}` +
      `m ${r(stop.x + ux * head)} ${r(stop.y + uy * head)} ` +
      `l ${r(stop.x - uy * head * 0.62)} ${r(stop.y + ux * head * 0.62)} ` +
      `l ${r(stop.x + uy * head * 0.62)} ${r(stop.y - ux * head * 0.62)}{\\p0}`),
  ];
}

/* ------------------------------------------------------------------ *
 * FOCUS_BOX — hedefi çerçeveleyen köşe parantezleri.
 * Tam dikdörtgen yerine DÖRT KÖŞE: fotoğrafın içeriğini kapatmaz, yine de
 * "bu bölge" der. Kamera vizörü dili, izleyici anında tanır.
 * ------------------------------------------------------------------ */
function focusBoxActor(a) {
  if (!a.at) return [];
  const c = px(a.at);
  const w = Math.round((a.width || 0.26) * CANVAS.w);
  const h = Math.round((a.height || 0.20) * CANVAS.h);
  const col = assColor(a.color || ACCENT);
  const arm = Math.round(Math.min(w, h) * 0.30);
  const t = a.thickness || 7;
  const x0 = c.x - Math.round(w / 2); const x1 = c.x + Math.round(w / 2);
  const y0 = c.y - Math.round(h / 2); const y1 = c.y + Math.round(h / 2);
  const P = (x, y) => ({ x, y });
  const corner = (cx, cy, sx, sy) => [
    segmentQuad(P(cx, cy), P(cx + sx * arm, cy), t),
    segmentQuad(P(cx, cy), P(cx, cy + sy * arm), t),
  ];
  const paths = [
    ...corner(x0, y0, 1, 1), ...corner(x1, y0, -1, 1),
    ...corner(x0, y1, 1, -1), ...corner(x1, y1, -1, -1),
  ];
  // Hafif dışarıdan içeri oturma: 6px büyükten gelip yerine kilitlenir.
  const lock = Math.min(0.4, Math.max(0.2, (a.end - a.start) * 0.22));
  return [
    D(5, 'ActShape', a.start, a.start + lock,
      `{\\an7\\pos(0,0)\\1c${col}\\1a&H55&\\bord0\\fad(100,0)\\p1}` +
      paths.join(' ') + '{\\p0}'),
    D(5, 'ActShape', a.start + lock, a.end,
      `{\\an7\\pos(0,0)\\1c${col}\\1a&H18&\\bord0\\fad(0,180)\\p1}` +
      paths.join(' ') + '{\\p0}'),
  ];
}

/* ------------------------------------------------------------------ *
 * SPOTLIGHT — çevreyi karart, hedefi bırak.
 * libass'te gerçek maske yok; hedefin ETRAFINA dört karartma dikdörtgeni
 * konur. Sonuç aynı: göz tek aydınlık bölgeye gider.
 * ------------------------------------------------------------------ */
function spotlightActor(a) {
  if (!a.at) return [];
  const c = px(a.at);
  const w = Math.round((a.width || 0.34) * CANVAS.w);
  const h = Math.round((a.height || 0.26) * CANVAS.h);
  const x0 = Math.max(0, c.x - Math.round(w / 2));
  const x1 = Math.min(CANVAS.w, c.x + Math.round(w / 2));
  const y0 = Math.max(0, c.y - Math.round(h / 2));
  const y1 = Math.min(CANVAS.h, c.y + Math.round(h / 2));
  const rect = (ax, ay, bx, by) => `m ${ax} ${ay} l ${bx} ${ay} l ${bx} ${by} l ${ax} ${by}`;
  // Karartma yumuşak: %45 saydam. Fotoğraf görünmeye devam eder, yalnızca
  // hiyerarşi değişir — tamamen siyah bir çerçeve videoyu ucuzlatırdı.
  const alpha = a.alpha || '8C';
  return [
    D(3, 'ActShape', a.start, a.end,
      `{\\an7\\pos(0,0)\\1c${assColor('05080A')}\\1a&H${alpha}&\\bord0\\fad(200,220)\\p1}` +
      [rect(0, 0, CANVAS.w, y0), rect(0, y1, CANVAS.w, CANVAS.h),
        rect(0, y0, x0, y1), rect(x1, y0, CANVAS.w, y1)].join(' ') + '{\\p0}'),
  ];
}

/* ------------------------------------------------------------------ *
 * CARD_DISSOLVE — FİLTRELEME şablonunun aktörü.
 * "Beyin önemsiz ayrıntıları eler" cümlesinin görsel karşılığı: çok sayıda
 * kart gelir, önemliler PARLAK kalır, önemsizler SOLUKLAŞIP KAYBOLUR.
 * Bilim insanı fotoğrafı bu cümleyi anlatmaz; bu anlatır.
 * ------------------------------------------------------------------ */
function cardDissolveActor(a) {
  const total = Math.max(6, Math.min(14, a.count || 10));
  const keep = Math.max(1, Math.min(total - 1, a.keep ?? 3));
  const col = assColor(a.color || ACCENT);
  const cw = Math.round(0.13 * CANVAS.w);
  const ch = Math.round(0.055 * CANVAS.h);
  const span = Math.max(1.0, a.end - a.start);
  const out = [];
  // Deterministik yerleşim: kartlar ızgaraya oturur, rastgelelik yok —
  // aynı sahne iki kez render edilirse aynı görüntü çıkar.
  const cols = 3;
  for (let i = 0; i < total; i += 1) {
    const cx = Math.round((0.22 + (i % cols) * 0.28) * CANVAS.w);
    const cy = Math.round((0.30 + Math.floor(i / cols) * 0.115) * CANVAS.h);
    const survives = i < keep;
    const rect = `m ${cx - cw / 2} ${cy - ch / 2} l ${cx + cw / 2} ${cy - ch / 2} ` +
      `l ${cx + cw / 2} ${cy + ch / 2} l ${cx - cw / 2} ${cy + ch / 2}`;
    if (survives) {
      // Kalanlar: parlak, kenarlıklı, sahne sonuna kadar DURUR.
      out.push(D(5, 'ActShape', a.start, a.end,
        `{\\an7\\pos(0,0)\\1c${col}\\1a&H2A&\\3c${assColor(INK)}\\3a&H30&\\bord3` +
        `\\fad(160,200)\\p1}${rect}{\\p0}`));
    } else {
      // Elenenler: kısa süre görünür, SONRA söner. Sönme zamanları kademeli
      // olduğu için ekranda "azalma" hareketi oluşur.
      const outAt = a.start + 0.35 + (span * 0.55 * ((i - keep + 1) / Math.max(1, total - keep)));
      if (outAt <= a.start + 0.2) continue;
      out.push(D(4, 'ActShape', a.start, Math.min(a.end, outAt),
        `{\\an7\\pos(0,0)\\1c${assColor('7C8B92')}\\1a&H72&\\bord0` +
        `\\fad(140,${Math.round(320)})\\p1}${rect}{\\p0}`));
    }
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * PIECE_FILL — YENİDEN KURMA şablonunun aktörü.
 * Boş yuvalar sırayla dolar; SON parça farklı renkte gelir çünkü o bir
 * TAHMİNDİR. "Beyin eksik anıyı tamamlar" cümlesinin dürüst görselleştirmesi:
 * tamamlanan şeyin uydurma olduğu ekranda görünür.
 * ------------------------------------------------------------------ */
function pieceFillActor(a) {
  const slots = Math.max(3, Math.min(6, a.slots || 4));
  const col = assColor(a.color || ACCENT);
  const guess = assColor(a.guessColor || 'F0A72B');
  const c = px(a.at || [0.5, 0.5]);
  const pw = Math.round(0.15 * CANVAS.w);
  const ph = Math.round(0.075 * CANVAS.h);
  const gap = 10;
  const totalW = slots * pw + (slots - 1) * gap;
  const span = Math.max(1.0, a.end - a.start);
  const per = Math.min(0.5, (span * 0.7) / slots);
  const out = [];
  for (let i = 0; i < slots; i += 1) {
    const x = c.x - Math.round(totalW / 2) + i * (pw + gap);
    const rect = `m ${x} ${c.y - ph / 2} l ${x + pw} ${c.y - ph / 2} ` +
      `l ${x + pw} ${c.y + ph / 2} l ${x} ${c.y + ph / 2}`;
    // Boş yuva: kesik görünümlü ince çerçeve, baştan sona durur.
    out.push(D(4, 'ActShape', a.start, a.end,
      `{\\an7\\pos(0,0)\\1a&HFF&\\3c${assColor(INK)}\\3a&H88&\\bord3\\fad(140,180)\\p1}` +
      `${rect}{\\p0}`));
    // Parça yerine oturur.
    const t0 = a.start + 0.25 + per * i;
    if (t0 + 0.15 >= a.end) continue;
    const last = i === slots - 1;
    out.push(D(5, 'ActShape', t0, a.end,
      `{\\an7\\pos(0,0)\\1c${last ? guess : col}\\1a&H${last ? '30' : '1C'}&\\bord0` +
      `\\fad(180,180)\\p1}${rect}{\\p0}`));
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * BLOCK_GRID — GERİ ÇAĞIRMA şablonunun aktörü.
 * Depolama blokları ızgarası; DOĞRU blok aydınlanır ve merkeze taşınır.
 * "AI kaydı bulur" cümlesi bir sunucu odası fotoğrafıyla değil böyle anlatılır.
 * ------------------------------------------------------------------ */
function blockGridActor(a) {
  const cols = Math.max(3, Math.min(6, a.cols || 5));
  const rows = Math.max(2, Math.min(5, a.rows || 4));
  const col = assColor(a.color || ACCENT);
  const bw = Math.round(0.11 * CANVAS.w);
  const bh = Math.round(0.045 * CANVAS.h);
  const gap = 12;
  const gridW = cols * bw + (cols - 1) * gap;
  const gridH = rows * bh + (rows - 1) * gap;
  const cx = Math.round((a.at?.[0] ?? 0.5) * CANVAS.w);
  const cy = Math.round((a.at?.[1] ?? 0.46) * CANVAS.h);
  const x0 = cx - Math.round(gridW / 2);
  const y0 = cy - Math.round(gridH / 2);
  // Hedef blok deterministik: ortaya yakın ama tam ortada değil (aranıp
  // bulunduğu hissi için).
  const hitCol = a.hitCol ?? Math.min(cols - 1, Math.floor(cols / 2) + 1);
  const hitRow = a.hitRow ?? Math.min(rows - 1, Math.floor(rows / 2));
  const span = Math.max(1.2, a.end - a.start);
  const findAt = a.start + span * 0.42;
  const out = [];
  const rect = (x, y) => `m ${x} ${y} l ${x + bw} ${y} l ${x + bw} ${y + bh} l ${x} ${y + bh}`;
  for (let r = 0; r < rows; r += 1) {
    for (let cIdx = 0; cIdx < cols; cIdx += 1) {
      const x = x0 + cIdx * (bw + gap);
      const y = y0 + r * (bh + gap);
      const isHit = r === hitRow && cIdx === hitCol;
      // Sıradan bloklar: sönük, eşit, ayırt edilemez → "aranan hangisi?" hissi.
      out.push(D(4, 'ActShape', a.start, a.end,
        `{\\an7\\pos(0,0)\\1c${assColor('47575E')}\\1a&H7A&\\bord0\\fad(160,180)\\p1}` +
        `${rect(x, y)}{\\p0}`));
      if (!isHit) continue;
      // Doğru blok: arama süresi dolunca AYDINLANIR.
      out.push(D(6, 'ActShape', findAt, a.end,
        `{\\an7\\pos(0,0)\\1c${col}\\1a&H12&\\3c${assColor(INK)}\\3a&H28&\\bord3` +
        `\\fad(140,180)\\p1}${rect(x, y)}{\\p0}`));
      // Nabız halkası: bulunma anını işaretler.
      out.push(...radialSteps({ x: x + Math.round(bw / 2), y: y + Math.round(bh / 2) }, {
        r0: Math.round(bw * 0.6), r1: Math.round(bw * 1.35),
        start: findAt, end: Math.min(a.end, findAt + 0.9),
        color: col, bord: 3, fromAlpha: 0x60, toAlpha: 0xF0, steps: 7, layer: 5,
      }));
    }
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * LINK_BURST — DUYGU BAĞI şablonunun aktörü.
 * Merkezdeki anı + çevresindeki düğümler; bağlantılar SIRAYLA oluşur.
 * Hepsinin aynı anda belirmesi bir diyagram olurdu; sırayla oluşması bir OLAY.
 * ------------------------------------------------------------------ */
function linkBurstActor(a) {
  const c = px(a.at || [0.5, 0.46]);
  const n = Math.max(3, Math.min(6, a.nodes || 4));
  const col = assColor(a.color || ACCENT);
  const R = Math.round((a.radius || 0.24) * CANVAS.w);
  const span = Math.max(1.2, a.end - a.start);
  const per = Math.min(0.55, (span * 0.72) / n);
  const out = [];
  // MERKEZ: İÇİ BOŞ HALKA, dolu disk DEĞİL.
  //
  // İlk sürüm `\1a&H22&` ile neredeyse opak, 0.24R yarıçaplı bir disk
  // çiziyordu: 1080 genişlikte ~124 piksellik camgöbeği bir leke. Canlı
  // çıktıda (fungal-networks) orman fotoğrafının ortasında hiçbir şey
  // anlatmayan bir blob olarak duruyordu — tam da "rastgele dekorasyon
  // eklenmemelidir" kuralının ihlali. Merkez, bağlantıların NEREDE
  // buluştuğunu göstermeli; görüntüyü kapatmamalı.
  const rc = Math.round(R * 0.16);
  out.push(D(5, 'ActShape', a.start, a.end,
    `{\\an7\\pos(0,0)\\1a&HFF&\\3c${col}\\3a&H20&\\bord5\\fad(160,200)\\p1}` +
    `${circlePath(c.x, c.y, rc)}{\\p0}`));
  for (let i = 0; i < n; i += 1) {
    // Düğümler tam daire üzerinde, üstten başlayıp saat yönünde.
    const ang = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    const nx = Math.round(c.x + Math.cos(ang) * R);
    const ny = Math.round(c.y + Math.sin(ang) * R * 0.62);
    const t0 = a.start + 0.2 + per * i;
    if (t0 + 0.15 >= a.end) break;
    // Bağlantı çizgisi önce, düğüm sonra: "bağ kuruldu" okunur.
    out.push(D(4, 'ActShape', t0, a.end,
      `{\\an7\\pos(0,0)\\1c${col}\\1a&H4E&\\bord0\\fad(200,180)\\p1}` +
      segmentQuad({ x: c.x, y: c.y }, { x: nx, y: ny }, 5) + '{\\p0}'));
    out.push(D(5, 'ActShape', t0 + 0.12, a.end,
      `{\\an7\\pos(0,0)\\1a&HFF&\\3c${col}\\3a&H1C&\\bord5\\fad(160,180)\\p1}` +
      `${circlePath(nx, ny, Math.round(R * 0.13))}{\\p0}`));
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * SCAN_LINE — yukarıdan aşağı süpüren ince çizgi. "İnceleniyor" dili.
 * Tek başına anlatı taşımaz; YARDIMCI katmandır (bütçede öyle sayılır).
 * ------------------------------------------------------------------ */
function scanLineActor(a) {
  const col = assColor(a.color || ACCENT);
  const y0 = Math.round((a.from ?? 0.18) * CANVAS.h);
  const y1 = Math.round((a.to ?? 0.78) * CANVAS.h);
  const ms = Math.round(Math.max(0.6, a.end - a.start) * 1000);
  const w = CANVAS.w;
  return [
    D(3, 'ActShape', a.start, a.end,
      `{\\an7\\move(0,${y0},0,${y1},0,${ms})\\1c${col}\\1a&H5A&\\bord0\\fad(180,220)\\p1}` +
      `m 0 0 l ${w} 0 l ${w} 3 l 0 3{\\p0}`),
  ];
}

/* ------------------------------------------------------------------ *
 * SPLIT_SCREEN — GERÇEK karşılaştırma: ekran ikiye bölünür.
 *
 * Kullanıcı isteği aynen: "karşılaştırma yapıyorsak ekranı ikiye bölersin
 * sağ sol şeklinde alt alta animasyon olacak şekilde yazarsın."
 *
 * Önceki hâli iki köşe parantezinden ibaretti — izleyici neyin neyle
 * karşılaştırıldığını göremiyordu. Artık: dikey ayırıcı, iki başlık ve
 * SIRAYLA beliren satırlar. Satırlar alt alta gelirken göz iki tarafı
 * eşleştirir; hepsi aynı anda gelse tablo olur, sırayla gelince olay olur.
 * ------------------------------------------------------------------ */
function splitScreenActor(a) {
  const left = a.left || {};
  const right = a.right || {};
  const rowsL = (left.rows || []).slice(0, 4);
  const rowsR = (right.rows || []).slice(0, 4);
  if (!left.label && !right.label && !rowsL.length) return [];
  const colL = assColor(left.color || 'F0A72B');
  const colR = assColor(right.color || ACCENT);
  const midX = Math.round(CANVAS.w / 2);
  const topY = Math.round((a.top ?? 0.30) * CANVAS.h);
  const rowGap = Math.round(0.062 * CANVAS.h);
  const span = Math.max(1.2, a.end - a.start);
  const rows = Math.max(rowsL.length, rowsR.length);
  const per = rows ? Math.min(0.75, (span * 0.72) / rows) : 0;
  const out = [];

  // Karartma paneli: yazılar fotoğrafın üstünde OKUNUR olsun. Panelsiz metin
  // orman dokusunun üstünde kayboluyordu.
  const panelTop = topY - Math.round(0.085 * CANVAS.h);
  const panelBot = topY + rowGap * (rows + 0.4);
  out.push(D(2, 'ActShape', a.start, a.end,
    `{\\an7\\pos(0,0)\\1c${assColor('05080A')}\\1a&H74&\\bord0\\fad(200,220)\\p1}` +
    `m 0 ${panelTop} l ${CANVAS.w} ${panelTop} l ${CANVAS.w} ${panelBot} l 0 ${panelBot}{\\p0}`));

  // Dikey ayırıcı: yukarıdan aşağı ÇİZİLİR (bölünme bir olay olarak okunur).
  out.push(D(4, 'ActShape', a.start, a.end,
    `{\\an7\\pos(0,0)\\1c${assColor(INK)}\\1a&H55&\\bord0\\fad(180,200)` +
    `\\clip(${midX - 3},${panelTop},${midX + 3},${panelTop})` +
    `\\t(0,420,\\clip(${midX - 3},${panelTop},${midX + 3},${panelBot}))\\p1}` +
    `m ${midX - 2} ${panelTop} l ${midX + 2} ${panelTop} l ${midX + 2} ${panelBot} l ${midX - 2} ${panelBot}{\\p0}`));

  // Başlıklar: iki tarafın kimliği. Renk taraf kimliğinden gelir (§8).
  const headY = topY - Math.round(0.038 * CANVAS.h);
  if (left.label) {
    out.push(D(6, 'ActText', a.start + 0.1, a.end,
      `{\\an5\\pos(${Math.round(midX / 2)},${headY})\\fs52\\b1\\1c${colL}\\fad(160,180)}`,
      String(left.label).toUpperCase()));
  }
  if (right.label) {
    out.push(D(6, 'ActText', a.start + 0.1, a.end,
      `{\\an5\\pos(${Math.round(midX * 1.5)},${headY})\\fs52\\b1\\1c${colR}\\fad(160,180)}`,
      String(right.label).toUpperCase()));
  }

  // Satırlar ALT ALTA ve SIRAYLA.
  for (let i = 0; i < rows; i += 1) {
    const t0 = a.start + 0.35 + per * i;
    if (t0 + 0.2 >= a.end) break;
    const y = topY + rowGap * (i + 0.6);
    if (rowsL[i]) {
      out.push(D(6, 'ActSmall', t0, a.end,
        `{\\an5\\pos(${Math.round(midX / 2)},${y})\\fs38\\1c${assColor(INK)}\\fad(180,160)}`,
        String(rowsL[i])));
    }
    if (rowsR[i]) {
      out.push(D(6, 'ActSmall', t0 + Math.min(0.28, per * 0.4), a.end,
        `{\\an5\\pos(${Math.round(midX * 1.5)},${y})\\fs38\\1c${assColor(INK)}\\fad(180,160)}`,
        String(rowsR[i])));
    }
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * LABEL_TAG — ÖLÇÜLEN özneyi yuvarlağa al ve ADINI yaz.
 *
 * Kullanıcı isteği aynen: "karıncaları anlatıyorsak kraliçeyi yuvarlak içine
 * alırsın." Halka tek başına "buraya bak" der ama NEYE baktığını söylemez;
 * etiket onu bir bilgiye çevirir. Bağlayıcı çizgi, etiketin hangi nesneye ait
 * olduğunu belirsiz bırakmaz.
 *
 * ÖLÇÜLMÜŞ KONUM ŞART: `at` yoksa çizilmez (etiketi boşluğa koymak yalan olur).
 * ------------------------------------------------------------------ */
function labelTagActor(a) {
  if (!a.at || !a.label) return [];
  const c = px(a.at);
  const col = assColor(a.color || ACCENT);
  const r = Math.round((a.radius || 0.105) * CANVAS.w);
  const out = [...ringActor({ ...a, radius: a.radius || 0.105 })];
  // Etiket, halkanın kadraj İÇİNDE kalan tarafına konur.
  const side = a.at[0] > 0.5 ? -1 : 1;
  const lx = Math.max(0.14 * CANVAS.w, Math.min(0.86 * CANVAS.w, c.x + side * (r + Math.round(0.16 * CANVAS.w))));
  const ly = Math.max(Math.round(0.16 * CANVAS.h), c.y - Math.round(0.075 * CANVAS.h));
  const appear = a.start + Math.min(0.65, Math.max(0.35, (a.end - a.start) * 0.3));
  if (appear + 0.2 >= a.end) return out;
  // Bağlayıcı: halkanın kenarından etikete.
  out.push(D(5, 'ActShape', appear, a.end,
    `{\\an7\\pos(0,0)\\1c${col}\\1a&H30&\\bord0\\fad(150,170)\\p1}` +
    segmentQuad({ x: c.x + side * r, y: c.y - Math.round(r * 0.3) }, { x: lx, y: ly }, 4) + '{\\p0}'));
  // Etiket kutusu + metin: fotoğrafın üstünde okunur olmak zorunda.
  const text = String(a.label).toUpperCase();
  const w = Math.round(text.length * 22 + 34);
  const h = 56;
  out.push(D(5, 'ActShape', appear, a.end,
    `{\\an5\\pos(${lx},${ly})\\1c${assColor('05080A')}\\1a&H3C&\\3c${col}\\3a&H28&\\bord2` +
    `\\fad(150,170)\\p1}m ${-w / 2} ${-h / 2} l ${w / 2} ${-h / 2} l ${w / 2} ${h / 2} l ${-w / 2} ${h / 2}{\\p0}`));
  out.push(D(6, 'ActSmall', appear, a.end,
    `{\\an5\\pos(${lx},${ly})\\fs36\\b1\\1c${col}\\fad(160,170)}`, text));
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
  signal_wave: signalWaveActor,
  spread: spreadActor,
  axis: axisActor,
  build_up: buildUpActor,
  // V3 §5
  arrow_pointer: arrowPointerActor,
  focus_box: focusBoxActor,
  spotlight: spotlightActor,
  card_dissolve: cardDissolveActor,
  piece_fill: pieceFillActor,
  block_grid: blockGridActor,
  link_burst: linkBurstActor,
  scan_line: scanLineActor,
  split_screen: splitScreenActor,
  label_tag: labelTagActor,
};

/**
 * OVERLAY BÜTÇESİ (§5) — "ekranı doldurup okunmaz hâle getirme."
 *
 * Aynı anda en fazla: 1 ANA semantik overlay + 1 YARDIMCI hareket.
 * (Altyazı ayrı katman, render tarafında zaten tek.)
 *
 * Ana aktörler anlatının kendisini taşır; ikisi üst üste binerse hangisinin
 * anlatıldığı belirsizleşir. Yardımcılar (tarama çizgisi, spotlight, işaret)
 * dikkat yönlendirir, anlatı taşımaz — biri geçerlidir.
 */
const PRIMARY_ACTORS = new Set(['trail', 'walker', 'flow_arrow', 'fill_meter', 'chain',
  'signal_wave', 'spread', 'axis', 'build_up', 'card_dissolve', 'piece_fill',
  'block_grid', 'link_burst']);
const HELPER_ACTORS = new Set(['ring', 'readout', 'arrow_pointer', 'focus_box',
  'spotlight', 'scan_line']);

/** İki aktörün zaman aralıkları kesişiyor mu? */
const overlaps = (a, b) => a.start < b.end - 0.05 && b.start < a.end - 0.05;

/**
 * Bütçeyi uygula: zaman sırasına göre gez, kesişen fazlalıkları AT.
 * @param {Array} actors
 * @returns {{kept:Array, dropped:Array}}
 */
export function applyOverlayBudget(actors = [], { reservedWindows = [] } = {}) {
  const sorted = [...actors].filter((a) => Number.isFinite(a?.start) && Number.isFinite(a?.end))
    .sort((a, b) => a.start - b.start);
  const kept = [];
  const dropped = [];
  // AYRILMIŞ PENCERELER — hook gibi ekranın zaten dolu olduğu aralıklar.
  // Canlı çıktıda (fungal-networks, önizleme-hook) 0.5. saniyede ekranda AYNI
  // ANDA hook başlığı, altyazı ve bir link_burst halkası vardı. Bütçe yalnızca
  // aktörleri sayıyordu; hook'u hesaba katmıyordu. Hook'un tek işi ilk saniyede
  // izleyiciyi durdurmaktır — üstüne overlay binmez.
  const inReserved = (a) => reservedWindows.some(([s, e]) => a.start < e - 0.05 && s < a.end - 0.05);
  for (const a of sorted) {
    if (inReserved(a)) {
      dropped.push({ type: a.type, start: a.start, reason: 'ayrılmış pencere (hook) — ekran zaten dolu' });
      continue;
    }
    const isPrimary = PRIMARY_ACTORS.has(a.type);
    const isHelper = HELPER_ACTORS.has(a.type);
    if (!isPrimary && !isHelper) { kept.push(a); continue; }
    const sameClass = kept.filter((k) => (isPrimary ? PRIMARY_ACTORS.has(k.type) : HELPER_ACTORS.has(k.type)));
    if (sameClass.some((k) => overlaps(k, a))) {
      dropped.push({ type: a.type, start: a.start, reason: isPrimary
        ? 'aynı anda ikinci ANA overlay' : 'aynı anda ikinci YARDIMCI overlay' });
      continue;
    }
    kept.push(a);
  }
  return { kept, dropped };
}

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
export function buildActorAss(actors = [], {
  width = CANVAS.w, height = CANVAS.h, budget = true, reservedWindows = [],
} = {}) {
  const SUPPORT = new Set(['fill_meter', 'trail', 'chain', 'flow_arrow', 'walker',
    'spread', 'axis', 'signal_wave', 'card_dissolve', 'block_grid', 'piece_fill']);
  // §5 BÜTÇESİ: ekran kalabalıklaşırsa hiçbiri okunmaz.
  const { kept, dropped } = budget
    ? applyOverlayBudget(actors, { reservedWindows })
    : { kept: actors, dropped: [] };
  if (dropped.length) {
    console.warn(`[aktör] overlay bütçesi: ${dropped.length} overlay atlandı `
      + `(${dropped.slice(0, 3).map((d) => `${d.type}@${d.start.toFixed(1)}s`).join(', ')})`);
  }
  const events = [];
  for (const a of kept) {
    if (a?.type === 'readout') {
      const supported = kept.some((o) => o !== a && SUPPORT.has(o?.type)
        && Number.isFinite(o.start) && Math.abs(o.start - a.start) < 3.5);
      if (!supported) continue; // havada kalan sayaç çizilmez
    }
    events.push(...actorEvents(a));
  }
  if (!events.length) return '';
  return HEADER(width, height) + events.join('\n') + '\n';
}

export const ACTOR_TYPES = Object.keys(ACTORS);
