/**
 * SEMANTİK KOMPOZİSYON RENDER — beat yapısını EKRANDA GERÇEKLEŞTİRİR.
 *
 * semanticDirector'ın çıkardığı yapıyı (adımlar / iki taraf / sayı / konum)
 * izleyicinin SESSİZ izlerken bile anlayacağı bir kompozisyona çevirir:
 *
 *   process  → numaralı adım kartları + aralarında İLERLEYEN yön oku
 *   compare  → split-screen bölücü + iki taraf etiketi + eksen rozeti
 *   number   → sayaç + ORANTILI dolan ölçek barı (büyüklük hissi)
 *   location → stilize harita (küre + meridyen) + nabız atan konum işareti
 *   behavior → yön izi: özne → eylem oku → sonuç (kare dizisiyle birlikte)
 *
 * Dekoratif hiçbir şey YOK: her çizgi bir bilgi taşır. Süs istiyorsan
 * motionPlan'daki kamera hareketi (Ken Burns) o işi zaten yapıyor — bu katman
 * SADECE anlam taşır (dekoratif/semantik ayrımı, kullanıcı şartı).
 */
import { assColor, assTime, roundRect, circlePath, esc } from './effects.js';
import { CANVAS, safeArea } from './coords.js';
import { buildMapPaths } from './geo.js';

const ACCENT = '3BD0C8';   // marka turkuazı
const INK = 'FFFFFF';
const CARD = '141A1E';

const D = (layer, style, s, e, tags, text = '') =>
  `Dialogue: ${layer},${assTime(s)},${assTime(e)},${style},,0,0,0,,${tags}${text}`;

/** Semantik katmanın kullanabileceği dikey bant (logo ve altyazıya girmez). */
function band(cfg = {}) {
  const sa = safeArea(cfg);
  return {
    top: Math.round((sa.top + 0.06) * CANVAS.h),      // logo altı
    bottom: Math.round((1 - sa.bottom - 0.03) * CANVAS.h), // altyazı üstü
  };
}

/** Yaklaşık metin genişliği (Montserrat SemiBold, px). Kutu ölçüsü için. */
function textWidth(text, fs) {
  return Math.round(String(text || '').length * fs * 0.56);
}

/**
 * Metni kutuya sığdır: gerekiyorsa satır böl (\N) ve font küçült.
 * Uzun etiketler kutuyu taşıyordu ("FAST AS THEIR PREDATORS" 470px kutuda).
 * @returns {{text:string, fs:number, lines:number}}
 */
function fitText(text, maxW, baseFs = 44, minFs = 32) {
  const raw = String(text || '').trim();
  if (!raw) return { text: '', fs: baseFs, lines: 1 };
  if (textWidth(raw, baseFs) <= maxW) return { text: raw, fs: baseFs, lines: 1 };

  // Önce iki satıra böl (kelime sınırında, dengeli).
  const words = raw.split(/\s+/);
  if (words.length > 1) {
    let best = null;
    for (let cut = 1; cut < words.length; cut += 1) {
      const a = words.slice(0, cut).join(' ');
      const b = words.slice(cut).join(' ');
      const worst = Math.max(a.length, b.length);
      if (!best || worst < best.worst) best = { a, b, worst };
    }
    for (let fs = baseFs; fs >= minFs; fs -= 2) {
      if (textWidth(best.worst === best.a.length ? best.a : best.b, fs) <= maxW) {
        return { text: `${best.a}\\N${best.b}`, fs, lines: 2 };
      }
    }
    return { text: `${best.a}\\N${best.b}`, fs: minFs, lines: 2 };
  }
  // Tek kelime: sadece küçült.
  for (let fs = baseFs; fs >= minFs; fs -= 2) {
    if (textWidth(raw, fs) <= maxW) return { text: raw, fs, lines: 1 };
  }
  return { text: raw, fs: minFs, lines: 1 };
}

/* ------------------------------------------------------------------ *
 * 1) PROCESS — sıralı adımlar + ilerleyen yön oku
 * ------------------------------------------------------------------ */
function processShot(beat, cfg) {
  const steps = (beat.payload.steps || []).slice(0, 4).map(esc).filter(Boolean);
  if (steps.length < 2) return [];
  const { top, bottom } = band(cfg);
  const out = [];
  const s = beat.start;
  const dur = Math.max(1.2, beat.end - beat.start);
  // Adımlar pencereyi eşit böler; her adım kendi sırası geldiğinde belirir
  // ve sahne sonuna kadar EKRANDA KALIR (izleyici zinciri bütün görür).
  const slot = dur / (steps.length + 0.5);

  const cardW = 860;
  const cardH = 132;
  const x0 = Math.round((CANVAS.w - cardW) / 2);
  const usable = bottom - top;
  const gap = Math.min(200, Math.max(150, Math.round((usable - cardH) / Math.max(1, steps.length - 1))));
  const startY = Math.round(top + (usable - (gap * (steps.length - 1) + cardH)) / 2);

  steps.forEach((text, i) => {
    const y = startY + i * gap;
    const appear = s + slot * i;
    // Kart zemini — soldan sağa açılarak gelir (okuma yönü).
    out.push(D(4, 'SemShape', appear, beat.end,
      `{\\an7\\pos(${x0},${y})\\1c${assColor(CARD, '28')}\\bord0\\fad(140,180)` +
      `\\fscx0\\t(0,220,\\fscx100)\\p1}` + roundRect(cardW, cardH, 20) + '{\\p0}'));
    // Sıra numarası rozeti (dolu daire + rakam) — SIRAYI gösterir.
    const badgeR = 40;
    const bx = x0 + 34;
    const by = y + Math.round(cardH / 2) - badgeR;
    out.push(D(5, 'SemShape', appear + 0.1, beat.end,
      `{\\an7\\pos(${bx},${by})\\1c${assColor(ACCENT)}\\bord0\\fad(120,160)` +
      `\\fscx60\\fscy60\\t(0,200,\\fscx100\\fscy100)\\p1}` + circlePath(badgeR) + '{\\p0}'));
    out.push(D(6, 'SemNum', appear + 0.1, beat.end,
      `{\\an5\\pos(${bx + badgeR},${by + badgeR})\\fs52\\1c${assColor('06121A')}\\fad(120,160)}`,
      String(i + 1)));
    // Adım metni.
    out.push(D(6, 'SemText', appear + 0.12, beat.end,
      `{\\an4\\pos(${x0 + 116},${y + Math.round(cardH / 2)})\\fs46\\fad(140,180)}`, text));

    // YÖN OKU: bu adımdan bir sonrakine doğru İLERLER (süreç yönü).
    if (i < steps.length - 1) {
      const ax = Math.round(CANVAS.w / 2);
      const ayTop = y + cardH + 6;
      const ayBot = y + gap - 6;
      if (ayBot > ayTop + 20) {
        const shaft = 'm -4 0 l 4 0 l 4 %H% l 16 %H% l 0 %E% l -16 %H% l -4 %H%'
          .replace(/%H%/g, String(ayBot - ayTop - 22))
          .replace(/%E%/g, String(ayBot - ayTop));
        out.push(D(5, 'SemShape', appear + slot * 0.55, beat.end,
          `{\\an7\\move(${ax},${ayTop - 14},${ax},${ayTop},0,260)\\1c${assColor(ACCENT)}` +
          `\\1a&H30&\\bord0\\fad(160,160)\\p1}` + shaft + '{\\p0}'));
      }
    }
  });
  return out;
}

/* ------------------------------------------------------------------ *
 * 2) COMPARE — split-screen bölücü + iki taraf + eksen rozeti
 * ------------------------------------------------------------------ */
function compareShot(beat, cfg) {
  const { left, right, axis } = beat.payload;
  if (!left || !right) return [];
  const { top, bottom } = band(cfg);
  const out = [];
  const s = beat.start;
  const midX = Math.round(CANVAS.w / 2);
  const midY = Math.round((top + bottom) / 2);
  const halfH = Math.round((bottom - top) / 2);

  // İki yarıyı ayıran çizgi — YUKARIDAN AŞAĞI açılır (bölünme hissi).
  out.push(D(4, 'SemShape', s, beat.end,
    `{\\an7\\pos(${midX - 3},${top})\\1c${assColor(ACCENT)}\\bord0\\fad(140,180)` +
    `\\fscy0\\t(0,300,\\fscy100)\\p1}` + roundRect(6, bottom - top, 3) + '{\\p0}'));

  // Her yarıya okunabilirlik scrim'i + etiket. Kutu metne göre ölçülür ve
  // yarı genişliğini AŞMAZ (uzun etiketler kutuyu taşıyordu).
  const halfW = Math.round(CANVAS.w / 2);
  const maxBoxW = halfW - 46;
  const sides = [
    { label: esc(left), cx: Math.round(CANVAS.w * 0.25), from: -160 },
    { label: esc(right), cx: Math.round(CANVAS.w * 0.75), from: 160 },
  ];
  for (const side of sides) {
    const fit = fitText(side.label, maxBoxW - 40, 44, 30);
    const boxW = Math.min(maxBoxW, Math.max(280, textWidth(
      fit.text.split('\\N').reduce((a, b) => (a.length > b.length ? a : b), ''), fit.fs) + 56));
    const boxH = fit.lines === 2 ? 168 : 116;
    out.push(D(4, 'SemShape', s + 0.12, beat.end,
      `{\\an5\\pos(${side.cx},${midY})\\1c${assColor(CARD, '30')}\\bord0\\fad(160,180)\\p1}` +
      roundRect(boxW, boxH, 18) + '{\\p0}'));
    out.push(D(6, 'SemText', s + 0.15, beat.end,
      `{\\an5\\move(${side.cx + side.from},${midY},${side.cx},${midY},0,300)\\fs${fit.fs}\\fad(160,180)}`,
      fit.text));
  }

  // Eksen rozeti (TWICE / FASTER...) tam ortada — karşılaştırmanın NE olduğu.
  // Zemin ve metin AYNI noktada (\an5 zaten ortalar); eskiden metin 37px
  // aşağı kayıp rozetin dışına düşüyordu.
  if (axis) {
    const t = esc(axis);
    const fs = 44;
    const w = Math.min(400, textWidth(t, fs) + 88);
    const badgeY = midY - halfH + 74;
    out.push(D(5, 'SemShape', s + 0.25, beat.end,
      `{\\an5\\pos(${midX},${badgeY})\\1c${assColor(ACCENT)}\\bord0\\fad(140,180)` +
      `\\fscx70\\fscy70\\t(0,240,\\fscx100\\fscy100)\\p1}` + roundRect(w, 76, 38) + '{\\p0}'));
    out.push(D(6, 'SemNum', s + 0.25, beat.end,
      `{\\an5\\pos(${midX},${badgeY})\\fs${fs}\\1c${assColor('06121A')}\\fad(140,180)}`, t));
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * 3) NUMBER — sayaç + orantılı dolan ölçek barı
 * ------------------------------------------------------------------ */
function numberShot(beat, cfg) {
  const { value, unit, isPercent } = beat.payload;
  const target = Math.max(0, Math.round(Number(value) || 0));
  if (!target) return [];
  const { top, bottom } = band(cfg);
  const out = [];
  const s = beat.start;
  const dur = Math.max(1.2, beat.end - beat.start);
  const cy = Math.round((top + bottom) / 2) - 60;
  const cx = Math.round(CANVAS.w / 2);

  // Sayaç: pencereyi adımlara böl, artan değer (ASS'te canlı sayaç yok).
  const rise = Math.min(dur * 0.55, 1.3);
  const steps = 16;
  for (let i = 0; i < steps; i += 1) {
    const t0 = s + (rise * i) / steps;
    const t1 = i === steps - 1 ? beat.end : s + (rise * (i + 1)) / steps;
    const val = Math.round((target * (i + 1)) / steps);
    const shown = isPercent ? `${val}%` : val.toLocaleString('en-US');
    out.push(D(6, 'SemBig', t0, t1,
      `{\\an5\\pos(${cx},${cy})\\fs150\\b1${i === 0 ? '\\fad(160,0)' : ''}}`, shown));
  }
  if (unit) {
    out.push(D(6, 'SemText', s + 0.2, beat.end,
      `{\\an5\\pos(${cx},${cy + 110})\\fs52\\1c${assColor(ACCENT)}\\fad(160,180)}`, esc(unit)));
  }

  // ÖLÇEK BARI: yüzde ise gerçek orana, değilse tam dolar. Büyüklüğü GÖSTERİR.
  const barW = 760;
  const barX = Math.round((CANVAS.w - barW) / 2);
  const barY = cy + 190;
  const fillRatio = isPercent ? Math.min(1, target / 100) : 1;
  const fillW = Math.max(8, Math.round(barW * fillRatio));
  // Boş kanal.
  out.push(D(4, 'SemShape', s + 0.15, beat.end,
    `{\\an7\\pos(${barX},${barY})\\1c${assColor(CARD, '40')}\\bord0\\fad(160,180)\\p1}` +
    roundRect(barW, 22, 11) + '{\\p0}'));
  // Dolan kısım — sayaçla aynı sürede soldan sağa büyür.
  out.push(D(5, 'SemShape', s + 0.15, beat.end,
    `{\\an7\\pos(${barX},${barY})\\1c${assColor(ACCENT)}\\bord0\\fad(160,180)` +
    `\\fscx0\\t(0,${Math.round(rise * 1000)},\\fscx100)\\p1}` +
    roundRect(fillW, 22, 11) + '{\\p0}'));
  // Yüzdede %100 referans çentiği (ölçek okunabilsin).
  if (isPercent) {
    out.push(D(5, 'SemShape', s + 0.15, beat.end,
      `{\\an7\\pos(${barX + barW - 3},${barY - 10})\\1c${assColor(INK, '60')}\\bord0\\fad(160,180)\\p1}` +
      roundRect(6, 42, 3) + '{\\p0}'));
    out.push(D(6, 'SemSmall', s + 0.15, beat.end,
      `{\\an8\\pos(${barX + barW},${barY + 40})\\fs30\\1c${assColor(INK, '50')}\\fad(160,180)}`, '100%'));
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * 4) LOCATION — stilize harita + nabız atan konum işareti
 * ------------------------------------------------------------------ */
function locationShot(beat, cfg) {
  const place = esc(beat.payload.place);
  if (!place) return [];
  const { top, bottom } = band(cfg);
  const out = [];
  const s = beat.start;

  // GERÇEK HARİTA. Sahte ızgara + rastgele işaret kaldırıldı: yer adı Natural
  // Earth sınırlarına çözülür, ülke haritada GERÇEK yerinde vurgulanır ve
  // işaret GERÇEK enlem/boylama oturur. Ad tanınmıyorsa hiçbir şey çizilmez
  // (uydurma harita göstermektense göstermemek doğru).
  const panelW = 680;
  const mapH = 340;
  const panelH = mapH + 110;
  const px = Math.round((CANVAS.w - panelW) / 2);
  const py = Math.round((top + bottom) / 2 - panelH / 2) - 20;

  const map = buildMapPaths(beat.payload.place, { w: panelW - 36, h: mapH });
  if (!map) return [];
  const mapX = px + 18;
  const mapY = py + 18;

  // Panel zemini (deniz) + ince turkuaz kenar.
  out.push(D(4, 'SemShape', s, beat.end,
    `{\\an7\\pos(${px},${py})\\1c${assColor('08161D', '20')}\\3c${assColor(ACCENT)}\\3a&H50&\\bord3` +
    `\\fad(160,200)\\fscx88\\fscy88\\t(0,240,\\fscx100\\fscy100)\\p1}` +
    roundRect(panelW, panelH, 24) + '{\\p0}'));

  // Harita çizimleri panelin DIŞINA taşmasın: pencereye kırp. (Kırpma olmadan
  // komşu kıtalar panel kenarını aşıp ekrana yayılıyordu.)
  const clip = `\\clip(${mapX},${mapY},${mapX + panelW - 36},${mapY + mapH})`;

  // Kara parçaları (gerçek sınırlar) — bağlam için sönük.
  out.push(D(4, 'SemShape', s + 0.06, beat.end,
    `{\\an7\\pos(${mapX},${mapY})${clip}\\1c${assColor('4A6B78')}\\1a&H40&\\bord0\\fad(200,200)\\p1}` +
    map.land + '{\\p0}'));
  // Hedef ülke — marka renginde dolu (hangi ülke olduğu tartışmasız).
  if (map.target) {
    out.push(D(5, 'SemShape', s + 0.18, beat.end,
      `{\\an7\\pos(${mapX},${mapY})${clip}\\1c${assColor(ACCENT)}\\1a&H10&\\bord0\\fad(200,200)\\p1}` +
      map.target + '{\\p0}'));
  }

  // Konum işareti: GERÇEK enlem/boylamda, nabız atan halka + dolu nokta.
  const mx = mapX + map.marker.x;
  const my = mapY + map.marker.y;
  out.push(D(5, 'SemShape', s + 0.3, beat.end,
    `{\\an5\\pos(${mx},${my})\\1a&HFF&\\3c${assColor(ACCENT)}\\3a&H30&\\bord4` +
    `\\fscx20\\fscy20\\t(0,900,\\fscx180\\fscy180\\3a&HFF&)\\p1}` + circlePath(30) + '{\\p0}'));
  out.push(D(6, 'SemShape', s + 0.3, beat.end,
    `{\\an5\\pos(${mx},${my})\\1c${assColor(ACCENT)}\\bord0\\fad(160,180)` +
    `\\fscx50\\fscy50\\t(0,240,\\fscx100\\fscy100)\\p1}` + circlePath(14) + '{\\p0}'));
  // İşaretten yer adına inen bağ çizgisi (işaret ↔ etiket ilişkisi net olsun).
  const labelY = py + mapH + 66;
  if (labelY > my + 30) {
    out.push(D(5, 'SemShape', s + 0.42, beat.end,
      `{\\an7\\pos(${mx - 1},${my + 18})\\1c${assColor(ACCENT)}\\1a&H40&\\bord0\\fad(180,180)` +
      `\\fscy0\\t(0,260,\\fscy100)\\p1}` + roundRect(2, labelY - my - 40, 1) + '{\\p0}'));
  }

  // Yer adı — panelin İÇİNDE, haritanın ALTINDAKİ şeritte.
  const fit = fitText(place, panelW - 120, 52, 34);
  const badgeW = Math.min(panelW - 60, textWidth(fit.text, fit.fs) + 72);
  out.push(D(5, 'SemShape', s + 0.35, beat.end,
    `{\\an5\\pos(${px + panelW / 2},${labelY})\\1c${assColor(ACCENT)}\\bord0\\fad(160,200)` +
    `\\fscx70\\t(0,240,\\fscx100)\\p1}` + roundRect(badgeW, 78, 20) + '{\\p0}'));
  out.push(D(6, 'SemNum', s + 0.35, beat.end,
    `{\\an5\\pos(${px + panelW / 2},${labelY})\\fs${fit.fs}\\1c${assColor('06121A')}\\fad(160,200)}`,
    fit.text));
  return out;
}

/* ------------------------------------------------------------------ *
 * 5) BEHAVIOR — özne → eylem oku → sonuç (yön izi)
 * ------------------------------------------------------------------ */
function behaviorShot(beat, cfg) {
  const { subject, action } = beat.payload;
  if (!subject || !action) return [];
  const { top, bottom } = band(cfg);
  const s = beat.start;

  // GERÇEK ÖZNEYİ İŞARETLE: kare üzerinde odak DOĞRULANMIŞSA daire tam o
  // nesnenin üstüne oturur ve ok oraya bakar. Odak yoksa (focusDetect emin
  // değilse) işaret ÇİZİLMEZ — soyut yön izine düşülür. Rastgele konuma
  // daire çizmek tam da düzeltilmek istenen hataydı.
  if (beat.focus && Number.isFinite(beat.focus.x) && Number.isFinite(beat.focus.y)) {
    return focusHighlightShot(beat, cfg);
  }

  const out = [];
  const cy = Math.round((top + bottom) / 2);
  const leftX = Math.round(CANVAS.w * 0.26);
  const rightX = Math.round(CANVAS.w * 0.74);

  // Özne rozeti (solda).
  const sw = Math.min(400, 120 + esc(subject).length * 26);
  out.push(D(4, 'SemShape', s, beat.end,
    `{\\an5\\pos(${leftX},${cy})\\1c${assColor(CARD, '28')}\\bord0\\fad(140,180)` +
    `\\fscx70\\t(0,220,\\fscx100)\\p1}` + roundRect(sw, 86, 20) + '{\\p0}'));
  out.push(D(6, 'SemText', s, beat.end,
    `{\\an5\\pos(${leftX},${cy})\\fs44\\fad(140,180)}`, esc(subject)));

  // EYLEM OKU: soldan sağa GERÇEKTEN ilerler (hareket yönü).
  const arrowLen = rightX - leftX - 180;
  if (arrowLen > 40) {
    const shaft = `m 0 -5 l ${arrowLen - 26} -5 l ${arrowLen - 26} -18 l ${arrowLen} 0 ` +
      `l ${arrowLen - 26} 18 l ${arrowLen - 26} 5 l 0 5`;
    out.push(D(5, 'SemShape', s + 0.25, beat.end,
      `{\\an4\\move(${leftX + 70},${cy},${leftX + 90},${cy},0,320)\\1c${assColor(ACCENT)}` +
      `\\bord0\\fad(160,180)\\fscx0\\t(0,420,\\fscx100)\\p1}` + shaft + '{\\p0}'));
    // Eylem adı okun üstünde.
    out.push(D(6, 'SemSmall', s + 0.3, beat.end,
      `{\\an5\\pos(${Math.round((leftX + rightX) / 2)},${cy - 46})\\fs38\\1c${assColor(ACCENT)}\\fad(160,180)}`,
      esc(action)));
  }

  // Sonuç noktası (sağda) — nabızla vurgulanır.
  out.push(D(5, 'SemShape', s + 0.55, beat.end,
    `{\\an5\\pos(${rightX + 40},${cy})\\1a&HFF&\\3c${assColor(ACCENT)}\\3a&H30&\\bord4` +
    `\\fscx30\\fscy30\\t(0,700,\\fscx150\\fscy150\\3a&HFF&)\\p1}` + circlePath(30) + '{\\p0}'));
  out.push(D(6, 'SemShape', s + 0.55, beat.end,
    `{\\an5\\pos(${rightX + 40},${cy})\\1c${assColor(ACCENT)}\\bord0\\fad(160,180)\\p1}` +
    circlePath(13) + '{\\p0}'));
  return out;
}

/* ------------------------------------------------------------------ *
 * 6) ODAK VURGUSU — DOĞRULANMIŞ konuma daire + ona bakan ok
 * ------------------------------------------------------------------ */
function focusHighlightShot(beat, cfg) {
  const { subject, action } = beat.payload;
  const { top, bottom } = band(cfg);
  const out = [];
  const s = beat.start;

  // Odak noktası — focusDetect'in GERÇEKTEN ölçtüğü konum (normalize → px).
  //
  // KONUM ASLA KAYDIRILMAZ. Önceki sürüm halkayı "güvenli banda" sıkıştırıyordu
  // ve bu, halkayı nesnenin ~100px yukarısına taşıyıp tam da düzeltilmek
  // istenen hatayı üretiyordu (daire nesnenin üstünde değil). Doğru davranış:
  // ya halka nesnenin GERÇEK yerinde durur, ya da hiç çizilmez.
  const fxN = beat.focus.x;
  const fyN = beat.focus.y;
  const R = 128;
  // Halka ekrana sığmıyorsa (logo bandı / altyazı bandı) işaretlemeyi bırak.
  const minY = (top + R * 0.55) / CANVAS.h;
  const maxY = (bottom + R * 0.35) / CANVAS.h;
  if (fyN < minY || fyN > maxY) return [];
  if (fxN < 0.12 || fxN > 0.88) return [];
  const fx = Math.round(fxN * CANVAS.w);
  const cyClamped = Math.round(fyN * CANVAS.h);

  // 1) Nesnenin çevresinde halka — nabızla kilitlenir (ilgi oraya gider).
  out.push(D(5, 'SemShape', s + 0.1, beat.end,
    `{\\an5\\pos(${fx},${cyClamped})\\1a&HFF&\\3c${assColor(ACCENT)}\\3a&H18&\\bord6\\fad(160,200)` +
    `\\fscx55\\fscy55\\t(0,300,\\fscx104\\fscy104)\\t(300,520,\\fscx100\\fscy100)\\p1}` +
    circlePath(R) + '{\\p0}'));
  // İnce dış halka (nabız) — canlı his, konum aynı.
  out.push(D(4, 'SemShape', s + 0.1, beat.end,
    `{\\an5\\pos(${fx},${cyClamped})\\1a&HFF&\\3c${assColor(ACCENT)}\\3a&H70&\\bord3` +
    `\\fscx60\\fscy60\\t(0,1100,\\fscx150\\fscy150\\3a&HFF&)\\p1}` + circlePath(R) + '{\\p0}'));

  // 2) Etiket, halkanın ÜSTÜNDE ya da ALTINDA — hangisi sığıyorsa.
  const labelText = `${esc(subject)} ${esc(action)}`;
  const fit = fitText(labelText, 620, 44, 32);
  const labelW = Math.min(700, textWidth(fit.text.split('\\N')[0], fit.fs) + 64);
  // Etiket halkadan yeterince UZAK olmalı, yoksa aradaki ok sığmıyor
  // (önceki mesafede ok hiç çizilmiyordu).
  const labelGap = 150;
  const above = cyClamped - R - labelGap - 60 > top;
  const labelY = above ? cyClamped - R - labelGap : cyClamped + R + labelGap;
  const labelX = Math.round(Math.max(labelW / 2 + 40, Math.min(CANVAS.w - labelW / 2 - 40, fx)));

  out.push(D(4, 'SemShape', s + 0.3, beat.end,
    `{\\an5\\pos(${labelX},${labelY})\\1c${assColor(CARD, '26')}\\bord0\\fad(160,180)` +
    `\\fscx70\\t(0,240,\\fscx100)\\p1}` +
    roundRect(labelW, fit.lines === 2 ? 150 : 92, 20) + '{\\p0}'));
  out.push(D(6, 'SemText', s + 0.32, beat.end,
    `{\\an5\\pos(${labelX},${labelY})\\fs${fit.fs}\\fad(160,180)}`, fit.text));

  // 3) Etiketten HALKAYA bakan ok — işaret ettiği şey tartışmasız olsun.
  const gapTop = above ? labelY + 50 : cyClamped + R + 6;
  const gapBot = above ? cyClamped - R - 6 : labelY - 50;
  if (gapBot - gapTop > 26) {
    const len = gapBot - gapTop;
    // Yukarı bakan ok (etiket altta) ya da aşağı bakan ok (etiket üstte).
    const arrow = above
      ? `m -4 0 l 4 0 l 4 ${len - 20} l 15 ${len - 20} l 0 ${len} l -15 ${len - 20} l -4 ${len - 20}`
      : `m -4 ${len} l 4 ${len} l 4 20 l 15 20 l 0 0 l -15 20 l -4 20`;
    out.push(D(5, 'SemShape', s + 0.42, beat.end,
      `{\\an7\\pos(${fx},${gapTop})\\1c${assColor(ACCENT)}\\1a&H20&\\bord0\\fad(170,170)` +
      `\\fscy0\\t(0,280,\\fscy100)\\p1}` + arrow + '{\\p0}'));
  }
  return out;
}

const RENDERERS = {
  process: processShot,
  compare: compareShot,
  number: numberShot,
  location: locationShot,
  behavior: behaviorShot,
};

const HEADER = (w, h) => `[Script Info]
ScriptType: v4.00+
PlayResX: ${w}
PlayResY: ${h}
ScaledBorderAndShadow: yes
WrapStyle: 2

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: SemShape,Montserrat SemiBold,40,${assColor(ACCENT)},${assColor('000000', '64')},${assColor('000000', '64')},0,0,0,0,100,100,0,0,1,0,0,7,0,0,0,1
Style: SemText,Montserrat SemiBold,46,${assColor(INK)},${assColor('05080A')},${assColor('000000', '50')},1,0,0,0,100,100,0,0,1,3,2,5,0,0,0,1
Style: SemNum,Montserrat SemiBold,50,${assColor('06121A')},${assColor('06121A', '90')},${assColor('000000', '90')},1,0,0,0,100,100,0,0,1,0,0,5,0,0,0,1
Style: SemBig,Montserrat SemiBold,150,${assColor(INK)},${assColor('05080A')},${assColor('000000', '40')},1,0,0,0,100,100,0,0,1,5,3,5,0,0,0,1
Style: SemSmall,Montserrat SemiBold,36,${assColor(INK)},${assColor('05080A')},${assColor('000000', '60')},1,0,0,0,100,100,0,0,1,3,2,5,0,0,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

/**
 * Tek beat → ASS event satırları.
 * @param {object} beat semanticDirector çıktısı {kind,payload,start,end}
 * @param {object} cfg safe-area config
 */
export function beatEvents(beat, cfg = {}) {
  const fn = RENDERERS[beat?.kind];
  if (!fn) return [];
  try {
    return fn(beat, cfg) || [];
  } catch {
    return []; // tek beat patlarsa video kırılmasın
  }
}

/**
 * Tüm semantik beat'leri tek ASS'e derle.
 * @param {Array} beats
 * @param {object} opts {width,height,cfg}
 * @returns {string} '' = gösterilecek semantik yapı yok (ekran temiz kalır)
 */
export function buildSemanticAss(beats = [], { width = CANVAS.w, height = CANVAS.h, cfg = {} } = {}) {
  const events = [];
  for (const beat of beats) events.push(...beatEvents(beat, cfg));
  if (!events.length) return '';
  return HEADER(width, height) + events.join('\n') + '\n';
}

export const SEMANTIC_KINDS = Object.keys(RENDERERS);
