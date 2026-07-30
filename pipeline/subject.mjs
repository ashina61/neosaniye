/**
 * CÜMLENİN SOMUT ÖZNESİ — TEK KAYNAK, KONUDAN BAĞIMSIZ
 *
 * KULLANICININ BULDUĞU İKİ KUSUR
 *
 * 1. "konu anlatımına göre çizilen şekiller ve hareketler yanlış."
 *    Çizilen şekil ŞABLONUN SABİTİYDİ, cümlenin değil: `hero_cutout` her zaman
 *    insan silueti, `wide_establish` her zaman tekne. Şablon beat TÜRÜNÜ doğru
 *    seçiyordu; içine hangi NESNENİN çizileceği kararı hiç verilmemişti.
 *
 * 2. "farklı konularda sistem çuvallamasın."
 *    Çuvallıyordu. İlk sürümde bu dosyadaki sözlük tamamen Pasifik seyrüseferi
 *    kelimelerinden ibaretti (kano, pusula, ada, kabarma). Farklı bir konu
 *    verilip ÖLÇÜLDÜ — 1963 tren soygunu — ve 19 sahnenin 19'unda şekil
 *    bulunamadı. Yani semantik katman sessizce devre dışı kalıyor ve her sahne
 *    şablonun sabit siluetine geri dönüyor: 1. kusur aynen geri geliyor.
 *
 *    Bu, bu deponun KENDİ kuralının ihlaliydi: "konu başına kod yazılmaz".
 *    Konuya özgü veriyi hatta gömmek, konuya özgü bileşen yazmakla aynı hata.
 *
 * ŞİMDİKİ YAPI
 *   · sözlük GENEL: belgesel anlatılarında geçen ortak nesne aileleri
 *   · eşleşen KELİMENİN KENDİSİ kullanılıyor — "lorry" eşleşince prompt ve
 *     arşiv sorgusu "lorry" der, sözlüğe yazılmış hazır bir cümle değil.
 *     Kapsama, sözlük büyümeden genişler.
 *   · kapsama ÖLÇÜLÜP raporlanıyor (build-storyboard çıktısı). Sessiz bozulma
 *     yasak: kaç sahnede şekil bulunduğu her derlemede yazılır.
 *
 * İki tüketicisi var ve ikisi de AYNI listeden beslenmek zorunda:
 *   · build-storyboard.mjs → `payload.shape` (kodla çizilen prosedürel şekil)
 *   · generate-cutouts.mjs / fetch-archive.mjs → görsel prompt'u, arşiv sorgusu
 * Liste bir kez yalnızca cutout tarafındaydı: görsel modeline "kano" tarif
 * ediliyor, render aynı sahneye insan çiziyordu.
 */

/**
 * NESNE AİLELERİ.
 *
 * Her aile bir prosedürel siluete (`src/paper/Cutout.tsx`) karşılık gelir.
 * Kelimeler tekil yazılır; çoğul ve iyelik regex'te karşılanır.
 *
 * ÇAKIŞMAYI CÜMLE ÇÖZER: cümlede hem "driver" hem "train" varsa kazanan, cümlede
 * ÖNCE geçendir. Sözlüğün yazılış sırası yalnızca aynı konumda eşleşme olursa
 * devreye girer.
 */
const FAMILIES = [
  {
    shape: 'figure',
    style: 'documentary photograph of a person, three-quarter view, plain background',
    words: [
      'man', 'men', 'woman', 'women', 'person', 'people', 'boy', 'girl', 'child', 'children',
      'worker', 'soldier', 'officer', 'driver', 'guard', 'prisoner', 'robber', 'thief', 'witness',
      'doctor', 'nurse', 'pilot', 'sailor', 'navigator', 'farmer', 'miner', 'engineer', 'scientist',
      'king', 'queen', 'president', 'crowd', 'family', 'passenger', 'survivor', 'inspector', 'detective',
    ],
  },
  {
    shape: 'vehicle',
    style: 'side profile of the vehicle, documentary photograph, plain background',
    words: [
      'train', 'locomotive', 'carriage', 'wagon', 'car', 'lorry', 'truck', 'van', 'bus', 'tram',
      'plane', 'aircraft', 'airplane', 'jet', 'helicopter', 'motorcycle', 'bicycle', 'cart',
      'ambulance', 'tank', 'rocket', 'spacecraft', 'capsule',
    ],
  },
  {
    shape: 'vessel',
    style: 'full side profile of the vessel on water, documentary photograph',
    words: ['canoe', 'boat', 'ship', 'vessel', 'raft', 'ferry', 'submarine', 'yacht', 'barge', 'tanker'],
  },
  {
    shape: 'building',
    style: 'a single building seen straight on, documentary photograph',
    words: [
      'house', 'farmhouse', 'building', 'factory', 'mill', 'prison', 'jail', 'church', 'temple',
      'mosque', 'station', 'hotel', 'tower', 'castle', 'hut', 'cabin', 'village', 'town', 'city',
      'school', 'hospital', 'warehouse', 'bunker', 'palace', 'bridge',
    ],
  },
  {
    shape: 'document',
    style: 'a single archival document photographed flat, high contrast',
    words: [
      'letter', 'note', 'banknote', 'money', 'cash', 'pound', 'dollar', 'newspaper', 'headline',
      'file', 'record', 'report', 'passport', 'ticket', 'contract', 'telegram', 'book', 'page',
      'diary', 'ledger', 'fingerprint', 'photograph', 'poster', 'stamp', 'licence', 'license',
    ],
  },
  {
    shape: 'machine',
    style: 'a single machine or device, three-quarter view, documentary photograph',
    words: [
      'engine', 'motor', 'radio', 'telegraph', 'telephone', 'camera', 'clock', 'machine', 'computer',
      'pump', 'generator', 'signal', 'lamp', 'lantern', 'projector', 'typewriter', 'reactor',
      'turbine', 'antenna', 'radar', 'battery', 'switch', 'lever',
    ],
  },
  {
    shape: 'instrument',
    style: 'an antique measuring instrument, isolated on its own',
    words: [
      'compass', 'sextant', 'instrument', 'gauge', 'dial', 'meter', 'barometer', 'thermometer',
      'telescope', 'microscope',
    ],
  },
  {
    shape: 'terrain',
    style: 'a wide landscape silhouette, documentary photograph',
    words: [
      'island', 'atoll', 'reef', 'mountain', 'hill', 'valley', 'field', 'forest', 'jungle', 'desert',
      'coast', 'shore', 'cliff', 'canyon', 'glacier', 'volcano', 'plain', 'border', 'railway', 'road',
      'track', 'tunnel', 'mine', 'crater',
    ],
  },
  {
    shape: 'wave',
    style: 'a study of water or weather texture, no horizon line',
    words: [
      'ocean', 'sea', 'water', 'wave', 'swell', 'current', 'tide', 'river', 'lake', 'flood',
      'storm', 'rain', 'snow', 'fog', 'wind', 'breeze', 'smoke', 'fire', 'cloud',
    ],
  },
  {
    shape: 'star',
    style: 'a night sky or star chart study',
    words: ['star', 'constellation', 'sky', 'night', 'moon', 'sun', 'planet', 'comet', 'orbit', 'galaxy', 'eclipse'],
  },
  {
    shape: 'bird',
    style: 'a single animal, side view, documentary photograph',
    words: ['bird', 'seabird', 'gull', 'eagle', 'crow', 'tern', 'horse', 'dog', 'cat', 'whale', 'fish', 'insect', 'rat'],
  },
  {
    shape: 'object',
    style: 'a single object isolated on its own, documentary photograph',
    words: [
      'box', 'crate', 'bag', 'sack', 'case', 'suitcase', 'barrel', 'bottle', 'glove', 'key', 'coin',
      'rope', 'chain', 'door', 'window', 'table', 'chair', 'gun', 'rifle', 'knife', 'bomb', 'helmet',
      'uniform', 'coat', 'boot', 'map', 'chart', 'flag', 'bell', 'ring', 'bone', 'skull', 'seed',
    ],
  },
];

/**
 * Kelime listelerini tek regex'e derler.
 *
 * Çekim toleransı KASITLI OLARAK DAR: yalnızca `s`/`es` ve iyelik. Daha geniş
 * bir kök bulucu (ör. `-ing` atmak) yanlış eşleşme üretir — "training" kelimesi
 * "train"e düşerdi ve cümlede tren yokken tren çizilirdi. Yanlış görsel, görsel
 * olmamasından kötüdür.
 */
function compile(words) {
  const alts = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  return new RegExp(`\\b(${alts})(?:es|s)?(?:['’]s)?\\b`, 'i');
}

export const CONCRETE = FAMILIES.map((f) => ({shape: f.shape, style: f.style, re: compile(f.words)}));

/** Prosedürel siluet kimlikleri — Cutout.tsx'teki PlaceholderShape ile aynı. */
export const SHAPES = [
  'figure',
  'vessel',
  'vehicle',
  'building',
  'document',
  'machine',
  'object',
  'terrain',
  'instrument',
  'bird',
  'star',
  'wave',
];

/**
 * Cümlede özel isimle anılan bir kişi var mı?
 * "a man named Mau Piailug" → portre meşru. Yoksa portre istenmez.
 */
export function namedPerson(text) {
  const m = String(text).match(/\b(?:named|called)\s+([A-Z][A-Za-z’'-]+(?:\s+[A-Z][A-Za-z’'-]+)?)/);
  return m ? m[1] : null;
}

/**
 * Cümledeki TÜM aile eşleşmeleri, CÜMLEDEKİ SIRAYA göre.
 *
 * NEDEN SÖZLÜK SIRASI DEĞİL: ilk sürüm sözlüğü baştan tarayıp ilk eşleşeni
 * alıyordu, yani sırayı sözlüğün yazılış düzeni belirliyordu. "the swell, and
 * the flight of birds" cümlesinde sözlükte kuş dalgadan önce geçtiği için
 * birincil nesne KUŞ çıkıyordu — oysa cümle önce kabarmadan söz ediyor.
 */
function matches(text) {
  const t = String(text);
  const found = [];
  for (const entry of CONCRETE) {
    const m = t.match(entry.re);
    if (m && m.index !== undefined) found.push({entry, at: m.index, word: m[1]});
  }
  found.sort((a, b) => a.at - b.at);
  // Aynı şekli iki kez döndürmek iki ayrı nesne varmış gibi gösterir.
  const seen = new Set();
  return found.filter(({entry}) => (seen.has(entry.shape) ? false : seen.add(entry.shape)));
}

function match(text) {
  const all = matches(text);
  return all.length ? all[0] : null;
}

/**
 * Cümlede eşleşen SOMUT KELİME.
 *
 * Vurgu (altın highlight barı) bunu kullanır. Önceden vurgu "en uzun dolgu
 * olmayan kelime" kuralıyla seçiliyordu ve render'da şu çıktı:
 *   HE [CARRIED] NO COMPASS
 * Vurgulanan kelime "carried", cümlenin konusu ise PUSULA.
 */
export function nounFor(text) {
  const m = match(text);
  return m ? m.word : null;
}

/**
 * Cümlenin ÇİZİLECEK ŞEKLİ. Yoksa null → şablon kendi varsayılanını kullanır.
 *
 * `null` dönmesi başarısızlık değil: "Here is the strange part." cümlesinin
 * çizilecek bir nesnesi yoktur, o beat metinle ve işaretle anlatılır.
 */
export function shapeFor(text) {
  if (namedPerson(text)) return 'figure';
  const m = match(text);
  return m ? m.entry.shape : null;
}

/** İki nesneli şablonlar (labeled_diagram, split_compare) için en fazla `max` şekil. */
export function shapesFor(text, max = 2) {
  const rest = matches(text).map(({entry}) => entry.shape);
  const all = namedPerson(text) ? ['figure', ...rest.filter((s) => s !== 'figure')] : rest;
  return all.slice(0, max);
}

/** Cümledeki dört haneli yıl — arşiv sorgusunu döneme sabitler. */
function yearIn(text) {
  const m = String(text).match(/\b(1[5-9]\d{2}|20[0-4]\d)\b/);
  return m ? m[1] : null;
}

/**
 * ARŞİV ARAMA SORGUSU (Wikimedia Commons / Library of Congress).
 *
 * `subjectFor`den ayrı, çünkü ikisi farklı iş yapıyor: biri üretim modeline
 * verilen uzun tarif, öteki katalog için kısa isim. Uzun prompt'u arama motoruna
 * vermek sıfır sonuç döndürür.
 *
 * Sorgu EŞLEŞEN KELİMEDEN kurulur, sözlüğe yazılmış hazır cümleden değil:
 * "lorry" eşleşince sorgu "lorry 1963 historical photograph" olur ve sözlükte
 * lorry için ayrı satır yazmak gerekmez. Kapsamanın konudan bağımsız büyümesini
 * sağlayan şey bu.
 */
export function searchFor(text) {
  const person = namedPerson(text);
  if (person) return `${person} portrait photograph`;
  const m = match(text);
  if (!m) return null;
  const year = yearIn(text);
  return `${m.word} ${year ? `${year} ` : ''}historical photograph`;
}

/**
 * Görsel modeline verilecek özne tanımı. `null` dönerse o sahne için görsel
 * istenmez — uydurma bir fotoğraf üretmek yalan görsel olur.
 */
export function subjectFor(text) {
  if (namedPerson(text)) {
    return 'a head-and-shoulders documentary portrait of a person, calm expression, three-quarter view';
  }
  const m = match(text);
  return m ? `a ${m.word}: ${m.entry.style}` : null;
}

/**
 * Cümle bir şeyin YOKLUĞUNU mu söylüyor?
 *
 * "He carried no compass" cümlesinin öznesi pusuladır ama anlamı "pusula
 * YOK"tur. Pusulayı öylece çizmek cümlenin tersini söyler; Vox dilinde karşılığı
 * nesneyi çizip ÜSTÜNÜ ÇİZMEK.
 */
export function isNegated(text) {
  const t = String(text);
  // "not X but Y" olumsuzlama değil, düzeltmedir.
  if (/\bnot\b[^.]*\bbut\b/i.test(t)) return false;

  const m = match(t);
  if (!m) return false;

  /**
   * OLUMSUZLAMA NESNEYE Mİ BAĞLI, FİİLE Mİ?
   *
   * İlk sürüm cümlede olumsuzlama kelimesi ARAMAKLA yetiniyordu ve ölçümde
   * yanlış çıktı — gerçek storyboard'da şu üretildi:
   *   "In his mind, the canoe was never moving."  → kano ÇARPILI
   * Olumsuzlanan şey kano değil, HAREKET.
   *
   * Kural: olumsuzlama kelimesi, eşleşen nesnenin HEMEN ÖNÜNDE (en fazla iki
   * kelime arayla) olmalı.
   */
  const words = t.split(/\s+/);
  const NEG = /^(no|without|never|nothing|none|neither|nor)[,.;:]?$/i;
  for (let i = 0; i < words.length; i += 1) {
    if (!m.entry.re.test(words[i].replace(/[^A-Za-z’'-]/g, ''))) continue;
    for (let k = Math.max(0, i - 2); k < i; k += 1) {
      if (NEG.test(words[k])) return true;
    }
  }
  return false;
}
