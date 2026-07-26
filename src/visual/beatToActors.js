/**
 * KÖPRÜ — semantik beat → AKTÖR koreografisi (V3 Faz 1).
 *
 * Mevcut mimari korunur: semanticDirector cümleyi hâlâ sınıflandırır, ama
 * artık sonuç bir KART değil, kadrajın içinde durum değiştiren AKTÖRLER olur.
 * Aktöre çevrilemeyen beat eski kart yoluna düşer (semanticShots) — böylece
 * hiçbir sahne boşta kalmaz ve geri dönüş her zaman mümkündür.
 *
 * DÜRÜSTLÜK KURALI (bu projede daha önce yapılan hatanın tekrarı olmasın):
 * Bir aktör ancak DAYANAĞI VARSA çizilir.
 *   - Konum gerektiren aktörler (trail/walker/ring) yalnızca focusDetect
 *     görüntüde bir özne ÖLÇTÜYSE üretilir. Ölçüm yoksa aktör yok.
 *   - readout tek başına asla çizilmez; onu besleyen bir süreç aktörü şart
 *     (buildActorAss bunu ayrıca zorlar).
 */

/** Ölçülen odak noktasını güvenli kadraj içine sıkıştır. */
function safePoint(p) {
  return [
    Math.max(0.12, Math.min(0.88, p[0])),
    Math.max(0.16, Math.min(0.70, p[1])),
  ];
}

/**
 * Odağa VARAN bir yol üret: kenardan başlar, ölçülen öznede biter.
 * Yol şematiktir (görüntüdeki gerçek patika değil) ama VARIŞ NOKTASI gerçektir
 * — yani "bu şey buraya ulaşıyor" iddiası doğrulanmış konuma dayanır.
 */
function pathToFocus(focus) {
  const end = safePoint([focus.x, focus.y]);
  // Yol için YER olsun: her zaman hedefin UZAK tarafından başla. Yakın taraftan
  // başlamak yolu kısaltıp dikey salınımı baskın kılıyor ve keskin bir "V"
  // zikzağı üretiyordu (doğal bir patikaya benzemiyordu).
  const startX = end[0] > 0.5 ? 0.12 : 0.88;
  const startY = Math.max(0.20, Math.min(0.68, end[1] + (end[1] > 0.45 ? -0.14 : 0.14)));
  // Dikey salınım YATAY açıklığa oranlanır → uzun yolda yumuşak yay,
  // kısa yolda neredeyse düz çizgi. Asla keskin dönüş olmaz.
  const spanX = Math.abs(end[0] - startX);
  const amp = Math.min(0.06, spanX * 0.16);
  const pts = [];
  const N = 4; // 5 nokta = 4 segment: yeterince yumuşak, ucuz
  for (let i = 0; i <= N; i += 1) {
    const t = i / N;
    const x = startX + (end[0] - startX) * t;
    // Uçlarda sıfırlanan, ortada tepe yapan yay (sin) → varış NOKTASI tam odakta.
    const y = startY + (end[1] - startY) * t + Math.sin(Math.PI * t) * amp;
    pts.push([x, Math.max(0.16, Math.min(0.72, y))]);
  }
  pts[pts.length - 1] = end; // varış noktası ÖLÇÜLEN odak olmalı (yuvarlama kayması yok)
  return pts;
}

/**
 * Beat + (varsa) ölçülmüş odak → aktör listesi.
 * @param {object} beat semanticDirector çıktısı {kind,payload,start,end,focus?}
 * @returns {Array} aktör listesi ([] = aktöre çevrilemedi → kart yoluna düş)
 */
export function beatToActors(beat) {
  if (!beat || !Number.isFinite(beat.start) || !Number.isFinite(beat.end)) return [];
  const { start, end } = beat;
  const focus = beat.focus && Number.isFinite(beat.focus.x) ? beat.focus : null;

  switch (beat.kind) {
    // ---- DAVRANIŞ: özne yol boyunca ilerler, arkasında iz kalır, ----
    // ---- diğerleri takip eder. (Kullanıcının feromon örneği.)      ----
    case 'behavior': {
      if (!focus) return []; // konum ölçülmedi → uydurma yol çizme
      const path = pathToFocus(focus);
      return [
        { type: 'trail', path, start: start + 0.2, end, width: 15 },
        { type: 'walker', path, start: start + 0.2, end, followers: 3, lag: 0.5 },
        { type: 'ring', at: safePoint([focus.x, focus.y]), radius: 0.11,
          start: start + Math.min(1.2, (end - start) * 0.55), end },
      ];
    }

    // ---- SAYI: sayaç TEK BAŞINA havada kalmasın; onu besleyen ----
    // ---- dolum süreci ile birlikte. ("7500 ne?" sorunu.)        ----
    case 'number': {
      const { value, unit, isPercent } = beat.payload || {};
      if (!value) return [];
      return [
        { type: 'fill_meter', at: [0.5, 0.60], ratio: isPercent ? Math.min(1, value / 100) : 1,
          start: start + 0.15, end },
        { type: 'readout', value, unit, isPercent, at: [0.5, 0.46], start: start + 0.15, end },
      ];
    }

    // ---- SÜREÇ: adımlar zincir düğümü olur, aralarında ilerleyen bağ ----
    case 'process': {
      const steps = (beat.payload?.steps || []).slice(0, 4);
      if (steps.length < 2) return [];
      // Düğümler okunur bir eğri üzerine dizilir (üstten alta, hafif zikzak).
      const nodes = steps.map((label, i) => ({
        label,
        at: [i % 2 === 0 ? 0.33 : 0.67, 0.26 + (0.40 * i) / Math.max(1, steps.length - 1)],
      }));
      return [{ type: 'chain', nodes, start: start + 0.15, end }];
    }

    default:
      return []; // compare/location → kart yolu (doğru araç zaten kart)
  }
}

/**
 * Beat listesini aktörlere çevir; çevrilemeyenleri kart yoluna bırak.
 * @param {Array} beats
 * @returns {{actors:Array, cardBeats:Array, stats:object}}
 */
export function planActors(beats = []) {
  const actors = [];
  const cardBeats = [];
  const converted = {};
  for (const beat of beats) {
    const made = beatToActors(beat);
    if (made.length) {
      actors.push(...made);
      converted[beat.kind] = (converted[beat.kind] || 0) + 1;
    } else {
      cardBeats.push(beat);
    }
  }
  return {
    actors,
    cardBeats,
    stats: {
      actorScenes: Object.values(converted).reduce((a, b) => a + b, 0),
      cardScenes: cardBeats.length,
      byKind: converted,
    },
  };
}
