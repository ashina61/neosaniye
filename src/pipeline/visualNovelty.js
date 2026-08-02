/**
 * GÖRSEL YENİLİK ÖLÇÜMÜ — "27 klip" ile "27 farklı görüntü" aynı şey değildir.
 *
 * ================== NEDEN VAR ==================
 * brain-vs-ai-memory raporu 27 klip sayıyor ve görsel çeşitliliği bu sayıya
 * göre puanlıyordu. Gerçekte 10 temel görsel vardı; kalan 17 klip aynı
 * dosyanın farklı kırpımlarıydı (`assetId`, `assetId#b`, `assetId#c`).
 * İzleyici için bu ÜÇ FARKLI PLAN DEĞİL, aynı fotoğrafta gezinen bir kameradır.
 * Metrik kendini kandırdığı için "çeşitlilik iyi" diyordu ve staticShare 0.99
 * ile birlikte gerçeği tarif etmiyordu.
 *
 * Bu modül üç sayı üretir:
 *   baseAssetCount         kaç FARKLI kaynak görsel var
 *   derivedClipCount       bunlardan kaç klip türetildi
 *   trueVisualNoveltyRatio base / derived — 1.0 = her klip yeni bir görüntü
 */

/**
 * Bir klip kimliğinin TEMEL varlığı. `photo-3#b`, `photo-3#loop`, `photo-3#c`
 * hepsi `photo-3`tür. Yol verilmişse dosya adı temel alınır.
 *
 * @param {string|null} assetId
 * @returns {string|null}
 */
export function baseAssetOf(assetId) {
  if (!assetId) return null;
  return String(assetId).split('#')[0];
}

/**
 * Görsel yenilik ölçümü + ardışık türev ihlalleri.
 *
 * KURAL: aynı temel görselden ARKA ARKAYA en fazla iki türev kullanılabilir.
 * Üçüncüsü, izleyiciye yeni hiçbir şey göstermeden ekranda geçen üçüncü
 * saniyedir; o noktada anlamlı bir overlay, diyagram ya da farklı kompozisyon
 * gerekir.
 *
 * @param {Array<{assetId?:string, path?:string, source?:string}>} items
 * @param {object} [opts]
 * @param {number} [opts.maxConsecutiveDerived] varsayılan 2
 * @returns {{baseAssetCount:number, derivedClipCount:number,
 *            trueVisualNoveltyRatio:number, longestSameBaseRun:number,
 *            violations:Array<{baseAsset:string, from:number, length:number}>}}
 */
export function measureVisualNovelty(items = [], opts = {}) {
  const { maxConsecutiveDerived = 2 } = opts;
  const bases = items.map((it) => baseAssetOf(it?.assetId || it?.path) || null);
  const derivedClipCount = items.length;
  const baseAssetCount = new Set(bases.filter(Boolean)).size;
  const trueVisualNoveltyRatio = derivedClipCount
    ? +(baseAssetCount / derivedClipCount).toFixed(2)
    : 0;

  const violations = [];
  let longestSameBaseRun = bases.length ? 1 : 0;
  let runStart = 0;
  for (let i = 1; i <= bases.length; i += 1) {
    const same = i < bases.length && bases[i] != null && bases[i] === bases[i - 1];
    if (same) continue;
    const length = i - runStart;
    longestSameBaseRun = Math.max(longestSameBaseRun, length);
    if (bases[runStart] && length > maxConsecutiveDerived) {
      violations.push({ baseAsset: bases[runStart], from: runStart, length });
    }
    runStart = i;
  }

  return {
    baseAssetCount,
    derivedClipCount,
    trueVisualNoveltyRatio,
    longestSameBaseRun,
    violations,
  };
}

/**
 * visualVariety puanı (0-10) — TÜREV SAYISINA DEĞİL, temel varlık ve kaynak
 * çeşitliliğine bakar.
 *
 * @param {object} novelty measureVisualNovelty çıktısı
 * @param {string[]} sources her klibin kaynağı ('ai','archive','stock','gfx'…)
 * @returns {number}
 */
export function scoreVisualVariety(novelty, sources = []) {
  const distinctSources = new Set(sources.filter(Boolean)).size;
  // Temel görsel sayısı: 10+ farklı görsel tam puanın yarısını verir.
  const baseScore = Math.min(5, novelty.baseAssetCount / 2);
  // Yenilik oranı: her klip yeni görüntüyse 3 puan.
  const noveltyScore = Math.min(3, novelty.trueVisualNoveltyRatio * 3);
  // Kaynak çeşitliliği: tek kaynaktan beslenen video 0 alır.
  const sourceScore = Math.min(2, Math.max(0, distinctSources - 1));
  const raw = baseScore + noveltyScore + sourceScore;
  // Ardışık türev ihlali her biri yarım puan götürür.
  return +Math.max(0, Math.min(10, raw - novelty.violations.length * 0.5)).toFixed(1);
}
