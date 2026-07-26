/**
 * FALLBACK HİYERARŞİSİ (§16) — "hiçbir sahne animasyon problemi yüzünden
 * tüm videoyu durdurmasın."
 *
 * Bir sahne için ideal anlatım kurulamadığında sessizce boş bırakmak, videoyu
 * yine "güzel fotoğraf slayt gösterisi"ne çevirir. Bunun yerine merdivenden
 * aşağı inilir; her basamak bir öncekinden ucuz ama HÂLÂ anlatıya bağlıdır.
 *
 *   1. Semantic SVG/diagram          (şablonun kendi aktörleri)
 *   2. Split-screen comparison       (iki taraf yan yana)
 *   3. Before/after                  (aynı kadraj, iki durum)
 *   4. Animated labels + arrows      (işaret + ok)
 *   5. Crop sequence + focus ring    (kadraj hareketi + halka)
 *   6. Ken Burns + caption           (en alt basamak — asla boş kalmaz)
 *
 * En alt basamak HER ZAMAN üretilebilir; dolayısıyla bu fonksiyon hiçbir
 * koşulda boş dönmez ve hiçbir sahne "anlatımsız" kalmaz.
 */

export const LADDER = [
  'semantic_diagram',
  'split_screen',
  'before_after',
  'labels_arrows',
  'crop_focus',
  'ken_burns',
];

/**
 * Bir sahne için en yüksek uygulanabilir basamağı seç ve aktörlerini üret.
 *
 * @param {object} input
 * @param {Array}  input.actors      şablonun ürettiği aktörler ([] = 1. basamak yok)
 * @param {string} input.side        'human'|'ai'|'both'|null (2. basamak için)
 * @param {object|null} input.focus  ölçülmüş odak (4-5. basamak için)
 * @param {number} input.start
 * @param {number} input.end
 * @param {string} [input.accent]    taraf rengi (varsa)
 * @returns {{rung:string, actors:Array, reason:string}}
 */
export function planWithFallback({
  actors = [], side = null, focus = null, start = 0, end = 4, accent = null,
} = {}) {
  const span = Math.max(0.6, end - start);
  const col = accent || undefined;

  // 1) ŞABLONUN KENDİ AKTÖRLERİ — en anlamlı basamak.
  if (actors.length) {
    return { rung: 'semantic_diagram', actors, reason: 'şablon aktörleri üretildi' };
  }

  // 2) SPLIT-SCREEN — sahne iki tarafı birden anlatıyorsa.
  if (side === 'both') {
    return {
      rung: 'split_screen',
      actors: [
        { type: 'focus_box', at: [0.27, 0.48], width: 0.34, height: 0.32, color: col,
          start: start + 0.2, end: start + span * 0.5 },
        { type: 'focus_box', at: [0.73, 0.48], width: 0.34, height: 0.32, color: col,
          start: start + span * 0.52, end },
      ],
      reason: 'sahne iki tarafı birden anlatıyor',
    };
  }

  // 3) BEFORE/AFTER — tek taraf belliyse: taramadan sonra o tarafa kilitlen.
  if (side && side !== 'both') {
    return {
      rung: 'before_after',
      actors: [
        { type: 'scan_line', from: 0.2, to: 0.75, color: col, start: start + 0.15, end: start + Math.min(1.4, span * 0.45) },
        { type: 'focus_box', at: focus ? [focus.x, focus.y] : [0.5, 0.5],
          width: 0.30, height: 0.26, color: col,
          start: start + Math.min(1.4, span * 0.45), end },
      ],
      reason: `taraf kimliği var (${side})`,
    };
  }

  // 4) İŞARET + OK — odak ÖLÇÜLDÜYSE nereye bakılacağı bellidir.
  if (focus) {
    return {
      rung: 'labels_arrows',
      actors: [
        { type: 'arrow_pointer', at: [focus.x, focus.y], color: col,
          start: start + 0.25, end },
        { type: 'ring', at: [focus.x, focus.y], radius: 0.11, color: col,
          start: start + 0.45, end },
      ],
      reason: 'odak ölçüldü, hedef belli',
    };
  }

  // 5) KADRAJ + HALKA — odak yok ama sahne yeterince uzunsa kadrajın
  //    ortasına yumuşak bir spotlight koymak, hiçbir şey yapmamaktan iyidir.
  if (span >= 2.2) {
    return {
      rung: 'crop_focus',
      actors: [
        { type: 'spotlight', at: [0.5, 0.46], width: 0.52, height: 0.40, alpha: '70',
          start: start + 0.3, end },
      ],
      reason: 'odak yok, sahne uzun — yumuşak spotlight',
    };
  }

  // 6) EN ALT BASAMAK — aktör yok. Ken Burns + altyazı zaten render
  //    katmanında her sahnede var; burada AÇIKÇA "bu sahne sade" denir.
  //    Sessizce boş dönmek ile bunu söylemek arasındaki fark, raporun
  //    dürüstlüğüdür.
  return { rung: 'ken_burns', actors: [], reason: 'kısa sahne, aktör kurulamadı — sade kamera' };
}

/**
 * Tüm sahneler için merdiven raporu — hangi basamakta kaç sahne kaldı.
 * Videonun ne kadar "aktif" olduğunun tek bakışta ölçüsü.
 *
 * @param {Array<{rung:string}>} results
 */
export function summarizeLadder(results = []) {
  const byRung = {};
  for (const r of results) byRung[r.rung] = (byRung[r.rung] || 0) + 1;
  const total = results.length || 1;
  const active = results.filter((r) => r.rung !== 'ken_burns').length;
  return {
    byRung,
    activeSceneShare: +(active / total).toFixed(2),
    plainSceneCount: byRung.ken_burns || 0,
  };
}
