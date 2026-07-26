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
 * ŞABLONA ÖZGÜ KOREOGRAFİ (V3 Faz 3d).
 *
 * Sınıflandırıcının 5 beat türü, audit'in istediği 14 hikâye şablonunu
 * karşılamıyordu: "hidden", "spreads", "warns" gibi cümleler hiçbir beat'e
 * girmediği için sahne aktörsüz kalıyor, geriye yalnızca kamera hareketi —
 * yani dekorasyon — kalıyordu. Artık şablonun kendisi koreografi seçer.
 *
 * Hepsi aynı dürüstlük kuralına tabidir: konum gerektiren her aktör ÖLÇÜLMÜŞ
 * odak ister; ölçüm yoksa aktör üretilmez ve sahne temiz kalır.
 */
const TEMPLATE_ACTORS = {
  // Sinyal ÖLÇÜLMÜŞ kaynaktan yayılır; alıcı kadrajın karşı tarafındadır.
  communication: (b, focus) => {
    if (!focus) return [];
    const at = safePoint([focus.x, focus.y]);
    const to = safePoint([at[0] > 0.5 ? at[0] - 0.34 : at[0] + 0.34, at[1] + 0.12]);
    return [{ type: 'signal_wave', at, to, start: b.start + 0.2, end: b.end }];
  },
  // Yayılma: ölçülen noktadan DIŞARI doğru çoğalma.
  chain_reaction: (b, focus) => {
    if (!focus) return [];
    return [{ type: 'spread', at: safePoint([focus.x, focus.y]), start: b.start + 0.15, end: b.end }];
  },
  // Sebep → sonuç: tetikten sonuca ilerleyen tek ok + sonuçta halka.
  cause_effect: (b, focus) => {
    if (!focus) return [];
    const to = safePoint([focus.x, focus.y]);
    const from = safePoint([to[0] > 0.5 ? 0.16 : 0.84, Math.min(0.68, to[1] + 0.18)]);
    return [
      { type: 'flow_arrow', from, to, start: b.start + 0.2, end: b.end },
      { type: 'ring', at: to, radius: 0.11, start: Math.min(b.end - 0.4, b.start + 1.1), end: b.end },
    ];
  },
  // Rota: davranışla aynı dil (iz + yürüyücü) ama takipçi yok — tek yolculuk.
  navigation: (b, focus) => {
    if (!focus) return [];
    const path = pathToFocus(focus);
    return [
      { type: 'trail', path, start: b.start + 0.2, end: b.end, width: 13 },
      { type: 'walker', path, start: b.start + 0.2, end: b.end, followers: 0 },
    ];
  },
  // Kalabalıkta hedefi bul: halka ÖLÇÜLEN konuma kilitlenir.
  search_reveal: (b, focus) => {
    if (!focus) return [];
    return [{ type: 'ring', at: safePoint([focus.x, focus.y]), radius: 0.13,
      start: b.start + 0.3, end: b.end }];
  },
  // Engel → çözüm: engelin etrafından geçen yol.
  problem_solution: (b, focus) => {
    if (!focus) return [];
    const at = safePoint([focus.x, focus.y]);
    const path = pathToFocus(focus);
    return [
      { type: 'ring', at, radius: 0.12, start: b.start + 0.25, end: b.end },
      { type: 'trail', path, start: b.start + 0.5, end: b.end, width: 12 },
    ];
  },
  // MEKANİZMA — belgenin amiral örneği: kesitte AKIŞ. Sıcak yukarı, soğuk
  // aşağı; iki ok zamanlamayla SIRAYLA belirir, yani sahne içinde bir olay
  // dizisi yaşanır (§3.1'in visual_story'si, ayrı bir veri yapısı olarak
  // değil aktör zamanlaması olarak). Cümle akıştan söz etmiyorsa payload.flow
  // boştur ve hiç ok çizilmez.
  mechanism: (b, focus) => {
    if (!focus || !b.payload?.flow) return [];
    const c = safePoint([focus.x, focus.y]);
    const clampX = (v) => Math.max(0.14, Math.min(0.86, v));
    const up = Math.max(0.18, c[1] - 0.20);
    const down = Math.min(0.72, c[1] + 0.16);
    // Karşı taraf: dönüş kolu kadrajın diğer yarısında yaşar → döngü okunur.
    const side = c[0] > 0.5 ? -1 : 1;
    const back = clampX(c[0] + side * 0.22);
    const span = Math.max(1, b.end - b.start);
    const thermal = b.payload.flow === 'thermal';
    return [
      { type: 'flow_arrow', from: [c[0], down], to: [c[0], up],
        temp: thermal ? 'hot' : undefined, start: b.start + 0.2, end: b.end },
      { type: 'flow_arrow', from: [back, up], to: [back, down],
        temp: thermal ? 'cold' : undefined, start: b.start + Math.min(1.4, span * 0.42), end: b.end },
    ];
  },
  // İnşa: katmanlar ölçülen tabandan yukarı doğru birikir.
  construction: (b, focus) => {
    if (!focus) return [];
    return [{ type: 'build_up', at: safePoint([focus.x, focus.y]), start: b.start + 0.2, end: b.end }];
  },
  // Zaman ekseni: işaretler anlatımdan ÇIKARILMIŞtır, konum gerektirmez.
  timeline: (b) => {
    const marks = b.payload?.marks || [];
    if (marks.length < 2) return [];
    return [{ type: 'axis', marks, start: b.start + 0.2, end: b.end }];
  },
};

/**
 * Konum ÖLÇÜMÜ gerektiren şablonlar — renderVideo bu sahnelerde focusDetect
 * çalıştırır. Listede olmayan şablon için ölçüm yapılmaz (boşuna maliyet).
 */
export const FOCUS_TEMPLATES = new Set(
  Object.keys(TEMPLATE_ACTORS).filter((k) => k !== 'timeline'),
);

/**
 * Beat + (varsa) ölçülmüş odak → aktör listesi.
 * @param {object} beat semanticDirector çıktısı {kind,payload,start,end,focus?,template?}
 * @returns {Array} aktör listesi ([] = aktöre çevrilemedi → kart yoluna düş)
 */
export function beatToActors(beat) {
  if (!beat || !Number.isFinite(beat.start) || !Number.isFinite(beat.end)) return [];
  const { start, end } = beat;
  const focus = beat.focus && Number.isFinite(beat.focus.x) ? beat.focus : null;

  // Şablon koreografisi ÖNCE denenir (daha spesifik); üretemezse beat türüne
  // düşülür, o da üretemezse kart yoluna.
  const byTemplate = TEMPLATE_ACTORS[beat.template];
  if (byTemplate) {
    const made = byTemplate(beat, focus) || [];
    if (made.length) return made;
  }

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
  const byActor = {};
  for (const beat of beats) {
    const made = beatToActors(beat);
    if (made.length) {
      actors.push(...made);
      for (const a of made) byActor[a.type] = (byActor[a.type] || 0) + 1;
      // Şablonla gelen beat'lerde kind 'story' olabilir; log/QC için şablon adı
      // daha bilgilendirici.
      const key = beat.kind === 'story' ? (beat.template || 'story') : beat.kind;
      converted[key] = (converted[key] || 0) + 1;
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
      // Ekranda GERÇEKTEN çizilen aktör türleri — beat sınıfı ile aynı olmak
      // zorunda değil (şablon koreografisi sınıfı ezebilir).
      byActor,
    },
  };
}
