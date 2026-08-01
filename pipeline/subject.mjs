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
    style: 'documentary photograph of a person, three-quarter view',
    words: [
      'man', 'men', 'woman', 'women', 'person', 'people', 'boy', 'girl', 'child', 'children',
      'worker', 'soldier', 'officer', 'driver', 'guard', 'prisoner', 'robber', 'thief', 'witness',
      'doctor', 'nurse', 'pilot', 'sailor', 'navigator', 'farmer', 'miner', 'engineer', 'scientist',
      'king', 'queen', 'president', 'crowd', 'family', 'passenger', 'survivor', 'inspector', 'detective',
      'agent', 'judge', 'lawyer', 'sheriff', 'hijacker', 'suspect', 'victim', 'attendant', 'captain', 'crew',
      // ÖLÇÜMDEN EKLENENLER — dokuz görülmemiş konuda 27 cümle eşleşmedi ve en
      // büyük küme MESLEKTİ: "the governor sailed", "an archaeologist poured",
      // "the shipwright measured", "a sponge diver found". Hepsinde cümlenin
      // öznesi bir insan; sözlükte o mesleğin adı yoktu diye şekil çıkmıyordu.
      'governor', 'supervisor', 'archaeologist', 'shipwright', 'diver', 'fireman', 'firefighter',
      'operator', 'admiral', 'colonist', 'settler', 'commander', 'professor', 'dentist', 'priest',
      'teacher', 'mayor', 'clerk', 'spy', 'explorer', 'climber', 'astronaut', 'cosmonaut',
      'gunman', 'killer', 'murderer', 'hostage', 'refugee', 'monk', 'nun', 'servant', 'slave',
      'chief', 'colonel', 'sergeant', 'hunter', 'fisherman', 'mechanic', 'technician',
      'journalist', 'reporter', 'photographer', 'historian', 'student', 'apprentice', 'foreman',
      'widow', 'mother', 'father', 'son', 'daughter', 'brother', 'sister', 'wife', 'husband',
      'veteran', 'pioneer', 'trader', 'merchant', 'smuggler', 'pirate', 'rebel', 'interpreter',
      // Topluluklar: siluet yine insan. "a nearby tribe", "the regiment marched".
      'tribe', 'army', 'regiment', 'battalion', 'gang', 'jury', 'council', 'congregation',
      // Heykel bir insan silueti olarak okunur; taş olduğu için `rock` değil.
      'statue',
    ],
  },
  /**
   * ARAÇ ÜÇE AYRILDI — RENDER'A BAKARAK.
   *
   * Tek bir `vehicle` ailesi vardı ve içinde hem "lorry" hem "aircraft" geçiyordu.
   * Sonuç render'da göründü: "THE AIRCRAFT TOOK OFF AGAIN" cümlesinin altına
   * KAMYON silueti çizildi. Aile yaklaşımı doğru fikirdi ama aileyi fazla geniş
   * tutmak, düzeltmek için kurulan kusuru geri getiriyor — izleyici için uçak ve
   * kamyon "araç" diye tek şey değil.
   *
   * Ölçü: bir aile, ancak SİLUETİ AYNI OKUNAN nesneleri toplayabilir.
   */
  {
    shape: 'aircraft',
    style: 'side profile of the aircraft, documentary photograph, plain background',
    words: ['plane', 'aircraft', 'airplane', 'airliner', 'jet', 'helicopter', 'glider', 'bomber', 'fighter'],
  },
  {
    shape: 'rail',
    style: 'side profile of the locomotive or carriage, documentary photograph',
    words: ['train', 'locomotive', 'carriage', 'wagon', 'tram', 'railcar', 'freight'],
  },
  {
    shape: 'vehicle',
    style: 'side profile of the road vehicle, documentary photograph, plain background',
    words: [
      'car', 'lorry', 'truck', 'van', 'bus', 'motorcycle', 'bicycle', 'cart', 'ambulance', 'jeep',
      'tank', 'rocket', 'spacecraft', 'capsule',
    ],
  },
  {
    shape: 'vessel',
    style: 'full side profile of the vessel on water, documentary photograph',
    words: [
      'canoe', 'boat', 'ship', 'vessel', 'raft', 'ferry', 'submarine', 'yacht', 'barge', 'tanker',
      // Geminin PARÇASI da gemi silueti çizdirir: "water poured in through the
      // gun ports on the lower deck" cümlesinin resmi güverte değil, gemidir.
      'warship', 'wreck', 'hull', 'deck', 'keel', 'mast', 'sail', 'rudder', 'anchor', 'lifeboat', 'fleet',
    ],
  },
  {
    shape: 'building',
    style: 'a single building seen straight on, documentary photograph',
    words: [
      'house', 'farmhouse', 'building', 'factory', 'mill', 'prison', 'jail', 'church', 'temple',
      'mosque', 'station', 'hotel', 'tower', 'castle', 'hut', 'cabin', 'village', 'town', 'city',
      'school', 'hospital', 'warehouse', 'bunker', 'palace', 'bridge',
      'airport', 'bank', 'courthouse', 'museum', 'embassy', 'barracks',
      // YAPININ PARÇASI da yapı çizdirir. Ölçümde dört cümle buradan kaçtı:
      // "roof tiles broke", "carved into a post at the gate", "the roadway
      // began to twist", "found the settlement empty". Hiçbirinde ayrı bir
      // siluet gerekmiyor — anlatılan şey binanın kendisi.
      'roof', 'tile', 'wall', 'gate', 'post', 'fence', 'chimney', 'pillar', 'column', 'arch',
      'stair', 'staircase', 'floor', 'ceiling', 'roadway', 'span', 'girder', 'beam', 'railing',
      'settlement', 'camp', 'ruin', 'monument', 'harbour', 'harbor', 'dock', 'pier', 'dam',
      // `reactor` MAKİNEDEN buraya taşındı: bir kelime tek aileye yazılır,
      // yoksa iki aile aynı konumda eşleşir ve kazananı sözlüğün yazılış
      // sırası belirler — yani şekil, cümleden değil dosya düzeninden çıkar.
      'lighthouse', 'silo', 'shed', 'garage', 'terminal', 'refinery', 'reactor', 'observatory',
    ],
  },
  {
    shape: 'document',
    style: 'a single archival document photographed flat, high contrast',
    words: [
      'letter', 'note', 'banknote', 'money', 'cash', 'pound', 'dollar', 'newspaper', 'headline',
      'file', 'record', 'report', 'passport', 'ticket', 'contract', 'telegram', 'book', 'page',
      'diary', 'ledger', 'fingerprint', 'photograph', 'poster', 'stamp', 'licence', 'license',
      'envelope', 'warrant', 'sketch', 'receipt', 'cheque', 'check', 'will', 'testimony', 'confession',
      // 'bundle' burada: banknot destesi jenerik bir kutu değil, PARA.
      'bundle',
      // DÜZ, OKUNAN ŞEYLER. Ölçümde "the inscription on the plate names the
      // months" ve "an X ray revealed thirty gears" eşleşmedi; ikisinin de
      // resmi elde tutulan düz bir levha — belge silueti tam olarak bu.
      'inscription', 'carving', 'engraving', 'plaque', 'plate', 'tablet', 'scroll', 'manuscript',
      'radiograph', 'blueprint', 'plan', 'schedule', 'list', 'log', 'logbook',
      'transcript', 'affidavit', 'petition', 'treaty', 'certificate', 'invoice', 'manifest',
    ],
  },
  {
    shape: 'machine',
    style: 'a single machine or device, three-quarter view, documentary photograph',
    words: [
      'engine', 'motor', 'radio', 'telegraph', 'telephone', 'camera', 'clock', 'machine', 'computer',
      'pump', 'generator', 'signal', 'lamp', 'lantern', 'projector', 'typewriter',
      'turbine', 'antenna', 'radar', 'battery', 'switch', 'lever',
      'cable', 'wire', 'transmitter', 'receiver', 'recorder', 'furnace', 'boiler', 'compressor',
      'conveyor', 'crane', 'elevator', 'winch', 'periscope', 'siren', 'alarm', 'detector',
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
      'track', 'tunnel', 'mine', 'crater', 'sandbar', 'riverbank', 'swamp', 'ridge', 'woods',
    ],
  },
  {
    shape: 'wave',
    style: 'a study of water or weather texture, no horizon line',
    words: [
      'ocean', 'sea', 'water', 'wave', 'swell', 'current', 'tide', 'river', 'lake', 'flood',
      'storm', 'rain', 'snow', 'fog', 'wind', 'breeze', 'smoke', 'fire', 'cloud',
      // GAZ VE BUHAR da bu ailenin dokusu. Ölçümde "steam pressure lifted the
      // lid" ve "a surge of hot gas ran down the slope" eşleşmedi; ikisi de
      // görüntü olarak akışkan — yeni siluete gerek yok, kelimeye gerek vardı.
      'steam', 'gas', 'vapour', 'vapor', 'fume', 'mist', 'haze', 'draught', 'gust', 'blizzard',
      'hail', 'ice', 'frost', 'lightning', 'thunder', 'surge', 'stream', 'spray', 'foam', 'whirlpool',
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
  /**
   * `object` PARÇALANDI — "aynı şekiller sürekli çıkıyor".
   *
   * Tek bir `object` ailesi vardı ve içinde bomba, paraşüt, çanta, silah,
   * anahtar, eldiven, bayrak… hepsi geçiyordu. Hepsinin çizimi AYNI yuvarlak
   * kutuydu. Yani sözlük cümleyi doğru anlıyor, çizim onu ele veriyordu:
   * "there was a bomb in his briefcase" cümlesine kutu, "four parachutes"
   * cümlesine yine aynı kutu.
   *
   * Anlatının TAŞIYICI nesneleri kendi siluetini hak ediyor. Ölçüt: nesne
   * cümlenin konusuysa ve siluet olarak tanınabiliyorsa ayrı aile.
   */
  {
    shape: 'bomb',
    style: 'a single explosive device, isolated on its own, documentary photograph',
    words: ['bomb', 'explosive', 'dynamite', 'grenade', 'charge', 'detonator', 'fuse'],
  },
  {
    shape: 'parachute',
    style: 'a parachute canopy in the air, documentary photograph',
    words: ['parachute', 'canopy', 'chute', 'harness'],
  },
  {
    shape: 'case',
    style: 'a closed case or bag, three-quarter view, documentary photograph',
    words: ['briefcase', 'suitcase', 'case', 'bag', 'sack', 'crate', 'box', 'trunk', 'satchel', 'parcel'],
  },
  {
    shape: 'weapon',
    style: 'a single firearm or blade, side profile, documentary photograph',
    words: ['gun', 'pistol', 'revolver', 'rifle', 'shotgun', 'knife', 'blade', 'weapon'],
  },
  {
    shape: 'key',
    style: 'a single key or lock, photographed flat, high contrast',
    words: ['key', 'lock', 'padlock', 'handcuff', 'chain', 'safe', 'vault'],
  },
  /**
   * ============ ALTI YENİ AİLE — ÖLÇÜMDEN ÇIKTI ============
   *
   * Dokuz GÖRÜLMEMİŞ konuda (Çernobil, Apollo 13, Vasa, Pompeii, Antikythera,
   * Roanoke, Tacoma köprüsü, radyum kızları) 80 cümle tarandı ve kapsama
   * %66.3 çıktı: 27 cümlenin çizilecek nesnesi yoktu.
   *
   * Kaçanların ÇOĞU kelime eksiğiydi ve yukarıdaki ailelere yazıldı. Ama beş
   * küme kelime eklenerek çözülmüyordu, çünkü mevcut hiçbir siluet onları
   * anlatmıyor:
   *
   *   "poured plaster into the cavities"      → taş/kütle, kutu değil
   *   "showed the teeth of a gear"            → dişli, jenerik makine değil
   *   "point the brush with their lips"       → el aleti
   *   "the forest turned red and was buried"  → tek ağaç
   *   "a jaw bone came away in his hand"      → kemik
   *
   * Ölçüt bu dosyanın kendi kuralı: bir aile, ancak SİLUETİ AYNI OKUNAN
   * nesneleri toplayabilir. Dişliyi `machine` içine koymak, uçağı `vehicle`
   * içine koymakla aynı hata olurdu.
   */
  {
    shape: 'tool',
    style: 'a single hand tool, side view, documentary photograph',
    words: [
      'tool', 'hammer', 'brush', 'ruler', 'saw', 'spanner', 'wrench', 'drill', 'chisel', 'needle',
      'pliers', 'screwdriver', 'trowel', 'axe', 'pickaxe', 'scissors', 'syringe', 'scalpel', 'pen',
      'pencil', 'spade', 'shovel', 'rake', 'hoe', 'sickle', 'clamp', 'tongs',
    ],
  },
  {
    shape: 'rock',
    style: 'a single rough stone or block of debris, documentary photograph',
    words: [
      'stone', 'rock', 'boulder', 'rubble', 'debris', 'gravel', 'pebble', 'ore', 'coal', 'brick',
      'concrete', 'plaster', 'cement', 'ash', 'mud', 'clay', 'sand', 'slab', 'block', 'meteorite',
      'fossil', 'crystal', 'granite', 'marble', 'lava', 'pumice', 'graphite', 'dust',
    ],
  },
  {
    shape: 'gear',
    style: 'a single toothed gear or mechanical part, photographed flat, high contrast',
    words: [
      'gear', 'cog', 'sprocket', 'piston', 'valve', 'bolt', 'screw', 'bearing', 'rod',
      'shaft', 'crank', 'wheel', 'axle', 'gearwheel', 'flywheel', 'ratchet', 'bracket', 'hinge',
    ],
  },
  {
    shape: 'tree',
    style: 'a single tree seen whole, documentary photograph',
    words: [
      // `trunk` YOK: `case` ailesinde zaten var (sandık). Kelime iki yerde
      // durursa kazananı cümle değil dosya sırası belirler.
      'tree', 'oak', 'pine', 'palm', 'branch', 'timber', 'leaf', 'vine', 'crop', 'grain',
      'wheat', 'harvest', 'root', 'bush', 'hedge', 'orchard', 'flower', 'grass', 'moss', 'fern',
    ],
  },
  {
    shape: 'bone',
    style: 'a single bone or skull, photographed flat against a plain ground',
    words: [
      'bone', 'skull', 'skeleton', 'corpse', 'remains', 'grave', 'tomb', 'coffin', 'burial',
      'cemetery', 'mummy', 'jaw', 'rib',
    ],
  },
  {
    shape: 'flask',
    style: 'a single laboratory flask or glass vessel, documentary photograph',
    words: [
      'flask', 'vial', 'beaker', 'jar', 'bottle', 'canister', 'ampoule', 'phial',
      'sample', 'specimen', 'serum', 'poison', 'acid', 'compound', 'solution', 'dose', 'medicine',
    ],
  },
  {
    shape: 'object',
    style: 'a single object isolated on its own, documentary photograph',
    words: [
      // `bottle` → flask, `bone`/`skull` → bone, `shovel` → tool.
      // Bir kelime tek ailede durur; iki yerde durursa hangisinin kazandığını
      // cümle değil dosyanın satır sırası belirler.
      'barrel', 'glove', 'coin', 'rope', 'door', 'window', 'table', 'chair', 'helmet',
      'uniform', 'coat', 'boot', 'map', 'chart', 'flag', 'bell', 'ring', 'seed',
      'ladder', 'torch', 'mask', 'suit', 'tie', 'diamond', 'jewel',
      'bread', 'loaf', 'basket', 'blanket', 'cup', 'lid', 'wheelbarrow',
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
  'aircraft',
  'rail',
  'building',
  'document',
  'machine',
  'object',
  'bomb',
  'parachute',
  'case',
  'weapon',
  'key',
  'terrain',
  'instrument',
  'bird',
  'star',
  'wave',
  'tool',
  'rock',
  'gear',
  'tree',
  'bone',
  'flask',
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
  if (!m) return null;
  const phrase = nounPhrase(text, m);
  /**
   * CÜMLE ZATEN TARİF EDİYORSA SÖZLÜĞÜ EKLEME.
   *
   * Sözlüğün `style` alanı, cümle tek kelimelik bir isim verdiğinde ("a bomb")
   * modele ne çizeceğini anlatmak için var. Ama cümlenin kendisi tarif
   * ediyorsa ("a man in a dark suit") sözlük onun ÜSTÜNE yazıyor ve
   * genelleştiriyor — 5. turda promt "a man in a dark suit" yerine
   * "documentary photograph of a person" diyordu ve model genç bir kadın çizdi.
   *
   * Kural: öbek üç sözcük ya da daha uzunsa yazarın sözcükleri kalır.
   */
  if (phrase.split(/\s+/).length >= 3) return phrase;
  return `${phrase}: ${m.entry.style}`;
}

/**
 * ÖZNEYİ CÜMLENİN KENDİ SÖZCÜKLERİYLE YAZ.
 *
 * ============ BEAT'İN TARİFİ ÇÖPE GİDİYORDU ============
 *
 * Eski hâli `a ${m.word}` üretiyordu, yani cümledeki tek eşleşen isim dışında
 * HER ŞEY atılıyordu:
 *
 *   "a man in a dark suit"        → "a man: documentary photograph of a person"
 *   "He handed the attendant..."  → "a attendant: ..."      (artel hatası)
 *   "and the money came aboard"   → "a money: ..."          (sayılamayan isme artikel)
 *
 * Birincisi 5. turun asıl utancı: promtta "dark suit" yok, "1971 hijacker" yok,
 * geriye "a person" kalıyor ve model genç bir kadın portresi çizdi. Cümle
 * adamı tarif ediyordu, hat tarifi atıyordu.
 *
 * Burada eşleşen ismin ÖNÜNDEKİ sıfatlar ve ARDINDAKİ ilk niteleyici öbek
 * cümleden birebir alınıyor. Uydurma yok: yalnızca yazarın yazdığı sözcükler.
 */
const DET = /^(a|an|the|his|her|its|their|our|my|your|this|that|these|those|one|two|three|four|five|\d+)$/i;
const MODIFIER_TAIL = /^(in|with|of|on|from|wearing|marked|labelled|labeled|holding|carrying)$/i;
const UNCOUNTABLE = /^(money|water|rain|snow|fog|smoke|fire|wind|cash|gold|silver|evidence|luggage|cargo|mail)$/i;

function nounPhrase(text, m) {
  const words = String(text).replace(/[*"]/g, '').split(/\s+/);
  const clean = (w) => w.replace(/[^A-Za-z0-9’'-]/g, '');
  const at = words.findIndex((w) => clean(w).toLowerCase() === m.word.toLowerCase());
  if (at < 0) return withArticle(m.word);

  // Öndeki sıfatlar: belirteç görene ya da en fazla iki sözcük geriye kadar.
  let start = at;
  for (let k = at - 1; k >= 0 && at - k <= 2; k -= 1) {
    const w = clean(words[k]);
    if (!w) break;
    if (DET.test(w)) break;
    // Yalnızca sıfat gibi duran sözcükler; noktalama varsa öbek orada biter.
    if (/[,.;:]$/.test(words[k])) break;
    start = k;
  }

  // Arkadaki tek niteleyici öbek: "in a dark suit", "with a red seal".
  let end = at + 1;
  if (MODIFIER_TAIL.test(clean(words[at + 1] ?? ''))) {
    end = Math.min(at + 5, words.length);
    for (let k = at + 1; k < end; k += 1) {
      if (/[,.;:]$/.test(words[k])) {
        end = k + 1;
        break;
      }
    }
  }

  const phrase = words
    .slice(start, end)
    .map((w) => w.replace(/[,.;:]+$/, ''))
    .join(' ')
    .trim();
  return withArticle(phrase);
}

/**
 * Artikel uyumu: "a attendant" → "an attendant", "a money" → "money".
 *
 * Kural HARFE değil SESE bakar. Harf kuralı ölçülen çıktıda bozuldu:
 * "one-way ticket" sesli harfle başlıyor ama /w/ sesiyle okunuyor, yani
 * "an one-way ticket" yanlış. Aynı sınıf: "a European", "a university",
 * "a used ticket". Ters yönde de istisna var: "an hour", "an honest".
 */
const AN_EXCEPTIONS = /^(one|once|eu|ewe|uni|use|used|user|usual|ubiqu|ura|uti)/i;
const AN_NEEDED = /^(hour|honest|honou?r|heir)/i;

function withArticle(phrase) {
  const head = phrase.split(/\s+/)[0] ?? '';
  if (DET.test(head)) return phrase;
  if (UNCOUNTABLE.test(head)) return phrase;
  const vowelSound = AN_NEEDED.test(phrase) || (/^[aeiou]/i.test(phrase) && !AN_EXCEPTIONS.test(phrase));
  return `${vowelSound ? 'an' : 'a'} ${phrase}`;
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
