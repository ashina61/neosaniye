/**
 * CÜMLENİN SOMUT ÖZNESİ — TEK KAYNAK
 *
 * KULLANICININ BULDUĞU KUSUR
 *
 * "konu anlatımına göre çizilen şekiller ve hareketler yanlış."
 *
 * Haklıydı ve sebebi mimariydi: çizilen şekil ŞABLONUN SABİTİYDİ, cümlenin
 * değil. `hero_cutout` her zaman `shape="figure"`, `wide_establish` her zaman
 * `shape="vessel"` çiziyordu. Yani:
 *
 *   "He carried no compass"        → çöp adam      (pusula olmalıydı)
 *   "stepped onto a canoe"         → insan silueti (kano olmalıydı)
 *   "He read the wind and birds"   → insan silueti (kuş olmalıydı)
 *
 * Şablon, beat TÜRÜNÜ (olgu mu, yer mi, karşılaştırma mı) doğru seçiyordu;
 * yanlış olan, o şablonun içine hangi NESNENİN çizildiğiydi. İkisi ayrı karar
 * ve ikincisi hiç verilmemişti.
 *
 * Bu dosya o kararı verir ve iki tüketicisi var:
 *   · build-storyboard.mjs → `payload.shape` (kodla çizilen prosedürel şekil)
 *   · generate-cutouts.mjs → görsel modeli prompt'u
 * İkisi AYNI listeden beslenmek zorunda, yoksa üretilen fotoğraf ile yer tutucu
 * siluet farklı şeyler gösterir. Daha önce liste yalnızca cutout tarafında
 * vardı; render tarafı ondan habersizdi.
 */

/**
 * Somut nesne sözlüğü.
 *
 * `shape` → `src/paper/Cutout.tsx` içindeki prosedürel siluet kimliği.
 * `prompt` → görsel modeline verilecek özne tanımı.
 *
 * SIRA ÖNEMLİ: yukarıdaki daha belirgin. "sailing canoe" cümlesi hem `canoe`
 * hem `sail` içerir; kano daha bilgilendirici olduğu için önce gelir.
 */
export const CONCRETE = [
  {
    re: /\b(canoe|canoes|boat|boats|vessel|ship|ships|raft)\b/i,
    shape: 'vessel',
    prompt: 'a traditional double-hulled sailing canoe, full side profile',
    search: 'outrigger sailing canoe historic photograph',
  },
  {
    re: /\b(compass|sextant|instrument|instruments)\b/i,
    shape: 'instrument',
    prompt: 'an antique navigational instrument, isolated on its own',
    search: 'antique mariner compass instrument',
  },
  {
    re: /\b(star|stars|constellation|constellations)\b/i,
    shape: 'star',
    prompt: 'an antique celestial star chart fragment',
    search: 'antique celestial star chart engraving',
  },
  {
    re: /\b(bird|birds|seabird|frigatebird|tern)\b/i,
    shape: 'bird',
    prompt: 'a single seabird in flight, wings extended',
    search: 'seabird in flight photograph',
  },
  {
    re: /\b(wave|waves|swell|swells|current|currents)\b/i,
    shape: 'wave',
    prompt: 'a study of ocean swell, water surface texture only',
    search: 'ocean swell waves photograph',
  },
  {
    re: /\b(island|islands|shore|coast|atoll|reef)\b/i,
    shape: 'terrain',
    prompt: 'a low volcanic island seen from the sea, silhouette',
    search: 'volcanic island seen from sea photograph',
  },
  {
    re: /\b(map|maps|chart|charts)\b/i,
    shape: 'object',
    prompt: 'a folded antique nautical map',
    search: 'antique nautical chart map',
  },
  {
    re: /\b(radio|telegraph|engine|motor)\b/i,
    shape: 'object',
    prompt: 'a vintage radio set, three-quarter view',
    search: 'vintage radio receiver set',
  },
  {
    re: /\b(wind|winds|breeze|storm|storms)\b/i,
    shape: 'wave',
    prompt: 'a study of wind-driven cloud and spray, no horizon line',
    search: 'storm clouds sea spray photograph',
  },
  {
    re: /\b(house|houses|village|city|temple|hut)\b/i,
    shape: 'building',
    prompt: 'a single low building seen straight on, documentary photograph',
    search: 'historic village house photograph',
  },
  {
    re: /\b(ocean|sea|water|pacific|atlantic)\b/i,
    shape: 'wave',
    prompt: 'a study of open ocean surface, water texture only',
    search: 'open ocean surface photograph',
  },
  {
    re: /\b(sky|night|dusk|dawn|moon)\b/i,
    shape: 'star',
    prompt: 'a night sky study, stars only',
    search: 'night sky stars photograph',
  },
];

/** Prosedürel siluet kimlikleri — Cutout.tsx'teki PlaceholderShape ile aynı. */
export const SHAPES = ['figure', 'vessel', 'building', 'object', 'terrain', 'instrument', 'bird', 'star', 'wave'];

/**
 * Cümlede özel isimle anılan bir kişi var mı?
 * "a man named Mau Piailug" → portre meşru. Yoksa portre istenmez.
 */
export function namedPerson(text) {
  const m = String(text).match(/\b(?:named|called)\s+([A-Z][A-Za-z’'-]+(?:\s+[A-Z][A-Za-z’'-]+)?)/);
  return m ? m[1] : null;
}

/**
 * Cümledeki TÜM sözlük eşleşmeleri, CÜMLEDEKİ SIRAYA göre.
 *
 * NEDEN SÖZLÜK SIRASI DEĞİL: ilk sürüm sözlüğü baştan tarayıp ilk eşleşeni
 * alıyordu, yani sırayı sözlüğün yazılış düzeni belirliyordu. "the swell, and
 * the flight of birds" cümlesinde sözlükte kuş dalgadan önce geçtiği için
 * birincil nesne KUŞ çıkıyordu — oysa cümle önce kabarmadan söz ediyor.
 * Cümlenin kendi sırası, sözlüğün sırasından daha doğru bir sıralama.
 */
function matches(text) {
  const t = String(text);
  const found = [];
  for (const entry of CONCRETE) {
    const m = t.match(entry.re);
    if (m && m.index !== undefined) found.push({entry, at: m.index});
  }
  found.sort((a, b) => a.at - b.at);
  // Aynı şekli iki kez döndürmek (ör. "wind" ve "waves" ikisi de wave) iki
  // ayrı nesne varmış gibi gösterir; şekil bazında tekilleştiriliyor.
  const seen = new Set();
  return found.filter(({entry}) => (seen.has(entry.shape) ? false : seen.add(entry.shape)));
}

/** Cümlenin birincil eşleşmesi, yoksa null. */
function match(text) {
  const all = matches(text);
  return all.length ? all[0].entry : null;
}

/**
 * İKİ NESNELİ ŞABLONLAR İÇİN: cümlenin en fazla `max` somut şekli.
 *
 * `labeled_diagram` ve `split_compare` iki nesne çiziyor ve ikisi de sabitti
 * ("figure" + "vessel"). Render'da "the swell, and the flight of birds"
 * cümlesine bir İNSAN ve bir YELKENLİ çizildi — cümlede ikisi de yok.
 */
export function shapesFor(text, max = 2) {
  if (namedPerson(text)) {
    const rest = matches(text).map(({entry}) => entry.shape);
    return ['figure', ...rest].slice(0, max);
  }
  return matches(text)
    .map(({entry}) => entry.shape)
    .slice(0, max);
}

/**
 * Cümlede sözlükle eşleşen SOMUT KELİME.
 *
 * Vurgu (altın highlight barı) bunu kullanır. Önceden vurgu "en uzun dolgu
 * olmayan kelime" kuralıyla seçiliyordu ve render'da şu çıktı:
 *
 *   HE [CARRIED] NO COMPASS
 *
 * Vurgulanan kelime "carried" — cümlenin konusu ise PUSULA. Kural mekanik
 * olarak çalışıyordu ama anlamı ıskalıyordu; oysa o kelimeyi zaten biliyoruz,
 * çünkü çizilecek şekli ondan türetiyoruz.
 */
export function nounFor(text) {
  const t = String(text);
  const m = match(t);
  if (!m) return null;
  const hit = t.split(/\s+/).find((w) => m.re.test(w.replace(/[^A-Za-z’'-]/g, '')));
  return hit ? hit.replace(/[^A-Za-z’'-]/g, '') : null;
}

/**
 * Cümlenin ÇİZİLECEK ŞEKLİ.
 *
 * Kişi adı geçiyorsa figür; somut nesne geçiyorsa o nesne; hiçbiri yoksa null
 * döner ve şablon kendi varsayılanını kullanır. `null` dönmesi başarısızlık
 * değil: "The distance was impossible" cümlesinin çizilecek bir nesnesi yoktur,
 * o beat metinle ve işaretle anlatılır.
 */
export function shapeFor(text) {
  if (namedPerson(text)) return 'figure';
  const m = match(text);
  return m ? m.shape : null;
}

/**
 * ARŞİV ARAMA TERİMİ.
 *
 * `prompt`ten ayrı bir alan, çünkü ikisi farklı iş yapıyor: prompt bir üretim
 * modeline verilen tarif (uzun, stil talimatlı), `search` bir arşiv kataloğuna
 * verilen sorgu (kısa, isim tabanlı). Uzun prompt'u arama motoruna vermek sıfır
 * sonuç döndürür.
 */
export function searchFor(text) {
  if (namedPerson(text)) return `${namedPerson(text)} portrait photograph`;
  const m = match(text);
  return m ? m.search : null;
}

/**
 * Görsel modeline verilecek özne tanımı. `null` dönerse o sahne için görsel
 * istenmez — uydurma bir fotoğraf üretmek yalan görsel olur.
 */
export function subjectFor(text) {
  if (namedPerson(text)) {
    return 'a head-and-shoulders documentary portrait of a Pacific Islander man, calm expression, three-quarter view';
  }
  const m = match(text);
  return m ? m.prompt : null;
}

/**
 * Cümle bir şeyin YOKLUĞUNU mu söylüyor?
 *
 * NEDEN AYRI BİR SORU: "He carried no compass" cümlesinin öznesi pusuladır ama
 * anlamı "pusula YOK"tur. Pusulayı öylece çizmek cümlenin tersini söyler.
 * Vox dilinde bunun karşılığı nesneyi çizip ÜSTÜNÜ ÇİZMEK — kalemle atılmış
 * çarpı. `payload.negated` bunu şablona taşır.
 *
 * DİKKAT: `beats.mjs` içindeki `absence` sınıfıyla aynı deseni kullanır ama
 * aynı şey değildir. Orada soru "bu beat hangi TÜR", burada "çizilen nesnenin
 * üstü çizilecek mi". Bir beat `fact` sınıfına girip yine olumsuz olabilir.
 */
export function isNegated(text) {
  const t = String(text);
  // "not X but Y" olumsuzlama değil, düzeltmedir: çarpı yanlış olur.
  if (/\bnot\b[^.]*\bbut\b/i.test(t)) return false;

  const m = match(t);
  if (!m) return false;

  /**
   * OLUMSUZLAMA NESNEYE Mİ BAĞLI, FİİLE Mİ?
   *
   * İlk sürüm cümlede olumsuzlama kelimesi ARAMAKLA yetiniyordu ve ölçümde
   * yanlış çıktı — gerçek storyboard'da şu sahne üretildi:
   *
   *   "In his mind, the canoe was never moving."  → kano ÇARPILI
   *
   * Oysa olumsuzlanan şey kano değil, HAREKET. Kanonun üstünü çizmek "kano
   * yok" der ve cümlenin söylediğinin tersidir — tam olarak kaçınmak için bu
   * mekanizmayı kurduğum hata.
   *
   * Kural: olumsuzlama kelimesi, eşleşen nesnenin HEMEN ÖNÜNDE (en fazla iki
   * kelime arayla) olmalı. "no compass" ✓ · "without charts" ✓ ·
   * "was never moving" ✗ (fiili olumsuzluyor) · "Nobody had made" ✗.
   */
  const words = t.split(/\s+/);
  const NEG = /^(no|without|never|nothing|none|neither|nor)[,.;:]?$/i;
  for (let i = 0; i < words.length; i += 1) {
    if (!m.re.test(words[i].replace(/[^A-Za-z’'-]/g, ''))) continue;
    for (let k = Math.max(0, i - 2); k < i; k += 1) {
      if (NEG.test(words[k])) return true;
    }
  }
  return false;
}
