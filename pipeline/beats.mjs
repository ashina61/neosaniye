/**
 * BEAT MOTORU
 *
 * Referans PDF'in beat matematiği: 2.5 kelime/saniye. Bir beat 2-3 saniye,
 * yani 5-8 kelime. Kısa cümle bir beat; uzun cümle doğal virgülünden ikiye
 * bölünür. Beat başına TEK görsel fikir.
 *
 * Burada API çağrısı yok: girdi düz metin, çıktı zamanlanmış beat listesi.
 * Tamamen deterministik, bu yüzden test edilebilir.
 */

/**
 * PDF'İN 2.5 DEĞERİ NEDEN DÜŞÜRÜLDÜ
 *
 * O sayı SESLENDİRİLMİŞ anlatı için yazılmış: izleyici dinlerken gözü serbest,
 * görsele bakabilir. Bizim videoda henüz seslendirme YOK, yani aynı metni göz
 * OKUYOR. Kullanıcının raporu buydu: "konu anlatımı hızlı devam ediyor."
 *
 * Hesap: 8 kelimelik bir başlık okumak yaklaşık 2 saniye alıyor. Beat 2.8
 * saniyeyse görsele bakmaya 0.8 saniye kalıyor — ve o 0.8 saniyede öğeler
 * hâlâ giriş yapıyor. Yani izleyici ya okuyor ya bakıyor, ikisini birlikte
 * yapamıyor.
 *
 * İKİNCİ DÜŞÜŞ (2.0 → 1.7): kullanıcı 2.0'da da "ekran takip edilemiyor
 * okunamıyor" dedi. Asıl sebep başlığın GEÇ girmesiydi (dört şablonda sahnenin
 * yarısından sonra) ve o ayrıca düzeltildi; ama okuma payı da dardı. 1.7'de 8
 * kelime 4.7 saniyede: okuma ~2 sn, görsele ~2.7 sn.
 *
 * Seslendirme eklendiğinde bu değer 2.5'e GERİ ÇIKMALI ve beat süreleri
 * gerçek ses dosyasından ölçülmeli — o zaman kısıt okuma hızı değil, konuşma
 * hızı olur.
 */
export const WORDS_PER_SECOND = 1.7;

/** PDF'in beat sayısı sağlaması: süreye göre beklenen aralık. */
export const BEAT_COUNT_RANGE = [
  {seconds: 30, min: 12, max: 15},
  {seconds: 60, min: 22, max: 30},
  {seconds: 120, min: 45, max: 60},
  {seconds: 180, min: 70, max: 90},
  {seconds: 300, min: 115, max: 150},
];

export function wordCount(text) {
  return String(text || '').trim().split(/\s+/).filter(Boolean).length;
}

/** Kelime sayısından saniye. PDF: 2.5 wps. */
export function secondsForWords(words) {
  return words / WORDS_PER_SECOND;
}

/**
 * Cümle bitirmeyen kısaltmalar. İlk sürüm yalnızca tek harfli baş harfleri
 * (U.S.) kolluyordu, o yüzden "He met Mr. Cooper in Seattle." iki cümleye
 * bölünüyordu.
 */
const ABBREVIATIONS = new Set([
  'mr', 'mrs', 'ms', 'dr', 'prof', 'sr', 'jr', 'st', 'mt', 'lt', 'col', 'gen', 'sgt', 'capt',
  'rev', 'hon', 'pres', 'gov', 'sen', 'rep', 'vs', 'etc', 'inc', 'ltd', 'co', 'no', 'fig',
  'jan', 'feb', 'mar', 'apr', 'jun', 'jul', 'aug', 'sep', 'sept', 'oct', 'nov', 'dec',
  'approx', 'est', 'dept', 'univ',
]);

/** Sonlandırıcıdan hemen sonra gelebilen kapanış işaretleri. */
const CLOSERS = new Set(['"', '”', "'", '’', ')', ']', '»']);

/**
 * Metni cümlelere böl.
 *
 * İki tuzak var, ikisi de testle kilitli:
 *   1. Kısaltmadaki nokta ("Mr. Cooper") cümle bitirmez.
 *   2. Kapanış tırnağı noktadan SONRA gelir ('… gone." Nobody …'), yani
 *      sonlandırıcının ardından boşluk beklemek yetmez; kapanış işaretleri
 *      önce yutulmalı.
 */
export function splitSentences(text) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  if (!t) return [];

  const out = [];
  let buf = '';
  const chars = [...t];

  for (let i = 0; i < chars.length; i += 1) {
    buf += chars[i];
    if (!/[.!?]/.test(chars[i])) continue;

    // Sonlandırıcıdan sonraki kapanış işaretlerini bu cümleye dahil et.
    let j = i;
    while (CLOSERS.has(chars[j + 1] ?? '')) {
      j += 1;
      buf += chars[j];
    }

    const next = chars[j + 1];
    const after = chars[j + 2];
    // Cümle sonu: metin bittiyse, ya da boşluk + (büyük harf/tırnak/rakam).
    const ends = next === undefined || (next === ' ' && (after === undefined || /["“'‘A-Z0-9]/.test(after)));

    // Sondaki token kısaltma mı, ya da tek harfli baş harf mi (U.S., J. Smith)?
    const lastToken = buf.trim().split(/\s+/).pop() ?? '';
    const stem = lastToken.replace(/[^A-Za-z]/g, '').toLowerCase();
    const isAbbrev = /\.$/.test(lastToken) && (ABBREVIATIONS.has(stem) || /^[A-Za-z]$/.test(stem));

    if (ends && !isAbbrev) {
      out.push(buf.trim());
      buf = '';
      i = j;
    } else {
      i = j;
    }
  }

  if (buf.trim()) out.push(buf.trim());
  return out;
}

/**
 * Uzun cümleyi doğal virgül/bağlaç noktasından ikiye böl.
 * PDF: "uzun cümle doğal virgülünden ya da yan cümlesinden ayrılır".
 */
/**
 * Bir beat'in altına düşmemesi gereken kelime sayısı.
 *
 * NEDEN VAR: ilk sürüm yalnızca "ortaya en yakın virgül"e bakıyordu. "In 1976,
 * a man named Mau Piailug stepped onto a double-hulled canoe in Hawai'i."
 * cümlesindeki tek virgül 1. konumdaydı, sonuç "In 1976," diye iki kelimelik
 * bir beat oldu. İki kelime ne bir görsel fikir taşır ne de 0.8 saniyede
 * okunur — sadece kesme gürültüsü üretir.
 */
/**
 * Beat başına en az kelime.
 *
 * 4'ten 5'e çıkarıldı. Ölçülen storyboard'da 4 kelimelik parçalar üretiliyordu
 * ve bunlar cümle değil, kırıntıydı: "with a glove", "money while they waited".
 * Bir kırıntı ekranda tek başına durunca izleyici cümleyi zihninde tamamlamak
 * zorunda kalıyor ve bu, tempoyu hızlı hissettiren şeylerden biri.
 *
 * Yan etkisi istenen yönde: daha az bölme → daha az, daha uzun sahne.
 */
export const MIN_WORDS_PER_BEAT = 5;

/**
 * Beat ya da başlık sonunda asılı kalmaması gereken işlev kelimeleri.
 *
 * TEK LİSTE — daha önce İKİ liste vardı: burada ve build-storyboard'ın
 * kırpıcısında. İkisi ayrışmıştı ve fark render'da göründü: `has` yalnızca
 * kırpıcının listesindeydi, o yüzden BEAT BÖLÜCÜSÜ "The rest of the money has"
 * diye bir beat üretebiliyordu ve kırpıcının onu düzeltme şansı yoktu — metin
 * zaten öyle gelmişti.
 *
 * Aynı kuralın iki kopyası, bu depoda tekrar tekrar aynı sonucu verdi.
 */
export const DANGLING = new Set([
  'of', 'and', 'or', 'the', 'a', 'an', 'to', 'in', 'on', 'at', 'for', 'with', 'from', 'by', 'as',
  'his', 'her', 'their', 'its', 'that', 'which', 'but', 'into', 'onto', 'over', 'under',
  'was', 'were', 'is', 'are', 'had', 'has', 'have', 'been', 'still', 'never', 'not', 'than', 'then',
  // Özne zamirleri: "…southern Washington he" diye biten bir beat ÖLÇÜLDÜ.
  // Belirteç kuralını eklerken bölme noktası kaydı ve bu sefer zamir asılı
  // kaldı — bir kuralı düzeltirken açılan yeni delik.
  'he', 'she', 'it', 'they', 'we', 'i', 'you', 'who', 'there',
]);

/**
 * Belirteçler. Bir beat/başlık bunlardan HEMEN ÖNCE bitmemeli.
 *
 * ÖLÇÜLEN KUSUR: "Somewhere over southern Washington he lowered" — geçişli fiil
 * nesnesinden koparılmış. Fiili sözlükle yakalamak POS etiketleyici ister ama
 * ucuz ve sağlam bir gösterge var: İngilizcede bir cümle, çıplak bir belirtecin
 * hemen öncesinde nadiren biter. "…he lowered | the rear stair" bölünmemeli.
 *
 * NOKTALAMA MUAF: "He carried no compass, | the crew watched" gerçek bir cümle
 * sınırıdır. Kural yalnızca noktalamasız kelimeden sonra işler.
 */
const DETERMINER = new Set(['the', 'a', 'an', 'his', 'her', 'their', 'its', 'this', 'these', 'those', 'my', 'our']);

/**
 * Sayı sözcüğü mü? "two hundred and twenty" ortadan bölünmemeli.
 *
 * DIŞA AÇIK, çünkü aynı kural İKİ yerde gerekiyor: burada beat bölücüsünde ve
 * build-storyboard'ın başlık kırpıcısında. Bir yerde tutulup ötekinde
 * unutulduğunda ne olduğu ÖLÇÜLDÜ — render'da şu başlıklar çıktı:
 *   "He asked for two hundred"      (thousand dollars kayıp)
 *   "On the night of 24"            (November 1971 kayıp)
 * Doğru kural, yanlış katman: bu depoda daha önce sarkan kelime kuralında da
 * aynısı olmuştu.
 */
export const IS_NUMBER_WORD =
  /^(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|billion|dozen|\d[\d,.]*)$/i;

/** Ay adı — tarih zinciri de sayı zinciri gibi bölünmemeli. */
export const IS_MONTH =
  /^(january|february|march|april|may|june|july|august|september|october|november|december)$/i;

/** Dört haneli yıl. */
export const IS_YEAR = /^(1[0-9]{3}|20[0-4][0-9])$/;

const bare = (w) => String(w).toLowerCase().replace(/[^a-z0-9’'-]/g, '');

/**
 * `end` ile `next` arasında kesmek bir SAYI ya da TARİH zincirini kırar mı?
 *
 * Tarih ayrı ele alınıyor çünkü "24 | November 1971" sayı kuralına takılmıyor:
 * "November" bir sayı sözcüğü değil. Oysa kesik tarih, kesik sayı kadar bozuk.
 */
export function breaksChain(end, next) {
  const e = bare(end);
  const n = bare(next ?? '');
  if (!n) return false;
  if (IS_NUMBER_WORD.test(e) && (n === 'and' || IS_NUMBER_WORD.test(n))) return true;
  if (e === 'and' && IS_NUMBER_WORD.test(n)) return true;
  // "24 | November", "November | 1971"
  if (IS_NUMBER_WORD.test(e) && IS_MONTH.test(n)) return true;
  if (IS_MONTH.test(e) && IS_YEAR.test(n)) return true;
  return false;
}

/**
 * İKİ KELİME ARASINDA KESMEK METNİ BOZAR MI? — TEK YÜKLEM
 *
 * NEDEN TEK YERDE: bu kural üç parçadan oluşuyor (sarkan işlev kelimesi,
 * yarılan isim öbeği, kırılan sayı/tarih zinciri) ve İKİ tüketicisi var — beat
 * bölücüsü ve başlık kırpıcısı. Parçaları tek tek iki yere yazdım ve HER
 * SEFERİNDE biri eksik kaldı:
 *
 *   · sarkan kelime kuralı yalnızca bölücüdeydi  → "…TO TAHITI ACROSS"
 *   · `has` yalnızca kırpıcının listesindeydi     → "The rest of the money has"
 *   · sayı/tarih zinciri yalnızca bölücüdeydi     → "He asked for two hundred"
 *   · belirteç kuralı yalnızca bölücüdeydi        → "…Washington he lowered"
 *
 * Dördü de aynı hata: doğru kural, yanlış katman. Kuralı yüklem hâline getirmek
 * o hatanın beşinci kez yapılmasını imkânsız kılıyor.
 *
 * Ham token alır (kırpılmamış), çünkü noktalama kararın parçası: "compass,"
 * gerçek bir cümle sınırıdır, "compass" değil.
 */
export function danglesBetween(endToken, nextToken, {splitPoint = false} = {}) {
  const endWord = bare(endToken);
  const nextWord = bare(nextToken ?? '');
  if (DANGLING.has(endWord)) return true;
  if (breaksChain(endWord, nextWord)) return true;

  /**
   * BELİRTEÇ KURALI YALNIZCA BÖLMEDE GEÇERLİ — ölçülerek öğrenildi.
   *
   * Bölme ve kırpma FARKLI SORULAR sorar:
   *   · BÖLME: iki parça da kendi başına okunabilmeli. "…he lowered | the rear
   *     stair" bölünemez, çünkü sol parça nesnesiz bir geçişli fiille biter.
   *   · KIRPMA: metin öylece kesilir, kalanı gösterilmez. "He handed the
   *     attendant" tamamen düzgün bir kırpmadır.
   *
   * Kuralı ikisine birden uygulayınca kırpıcı belirteçlerden kaçmak için geri
   * geri sardı ve başlıklar ikiye indi: "He handed", "In Seattle the passengers
   * walked". Ortak yüklem doğru fikirdi ama iki soruyu bir sanmak yanlıştı.
   */
  if (splitPoint) {
    const punctuated = /[,;:.!?]$/.test(String(endToken ?? ''));
    if (!punctuated && DETERMINER.has(nextWord)) return true;
  }
  return false;
}

/** `i` konumundan sonra bölmek metni bozar mı? */
function danglesAt(words, i) {
  return danglesBetween(words[i], words[i + 1], {splitPoint: true});
}

/**
 * Cümleyi maxWords'ü aşmayacak beat'lere böl.
 *
 * Kırılma noktası seçimi üç kuralı BİRLİKTE sağlamak zorunda:
 *   1. iki taraf da MIN_WORDS_PER_BEAT tutacak
 *   2. beat sarkan işlev kelimesiyle bitmeyecek ("…navigators of")
 *   3. sayı zinciri ortadan kesilmeyecek ("two hundred | and twenty")
 *
 * Üçünü sağlayan nokta yoksa cümle BÖLÜNMEZ. Bir kelime uzun bir beat, anlamı
 * kopmuş iki beat'ten iyidir. İlk sürüm bunu yapmıyordu: doğal aday sarkınca
 * sarkan adaya geri dönüyor, aday hiç yokken de zorla bölüyordu.
 */
export function splitLongSentence(sentence, maxWords) {
  const words = sentence.trim().split(/\s+/);
  if (words.length <= maxWords) return [sentence.trim()];

  const lo = MIN_WORDS_PER_BEAT - 1;
  const hi = words.length - MIN_WORDS_PER_BEAT - 1;
  if (hi < lo) return [sentence.trim()]; // bölmeye yer yok

  // Aday kırılma noktaları: noktalama, sonra bağlaçlar.
  const candidates = new Set();
  words.forEach((w, i) => {
    if (/[,;:]$/.test(w)) candidates.add(i);
  });
  const conj = new Set(['and', 'but', 'because', 'which', 'while', 'when', 'then', 'so', 'yet', 'that']);
  words.forEach((w, i) => {
    if (i > 0 && conj.has(bare(w))) candidates.add(i - 1);
  });

  const valid = (i) => i >= lo && i <= hi && !danglesAt(words, i);
  const mid = words.length / 2;
  const nearest = (list) => list.reduce((best, i) => (Math.abs(i - mid) < Math.abs(best - mid) ? i : best), list[0]);

  // 1) Doğal ve temiz aday.
  const natural = [...candidates].filter(valid);
  let cut = natural.length ? nearest(natural) : -1;

  // 2) Doğal aday yok: ortadan dışa doğru tarayıp temiz nokta ara.
  if (cut < 0) {
    const span = Math.max(hi - lo, 1);
    for (let d = 0; d <= span && cut < 0; d += 1) {
      const start = Math.round(mid) - 1;
      for (const i of [start + d, start - d]) if (valid(i)) { cut = i; break; }
    }
  }

  // 3) Temiz nokta hiç yok: bölme. Cümle olduğu gibi tek beat kalır.
  if (cut < 0) return [sentence.trim()];

  const first = words.slice(0, cut + 1).join(' ').trim();
  const rest = words.slice(cut + 1).join(' ').trim();
  if (!first || !rest) return [sentence.trim()];
  return [first, ...splitLongSentence(rest, maxWords)];
}

/**
 * BEAT TÜRÜ SINIFLANDIRMA
 *
 * Anlatının bu cümlede ne YAPTIĞINI belirler; şablon seçimi buna dayanır.
 * Sıra önemli: daha özgül desenler önce denenir.
 *
 * Not: bu sınıflandırıcı yalnızca metne bakar. Görsel model tarafından yazılmış
 * anahtar kelimelere değil — eski repoda o hata vardı: sahne anahtar kelimeleri
 * ile görsel prompt'u aynı model yazdığı için her zaman birbirini onaylıyordu.
 */
/**
 * YAZIYLA YAZILMIŞ SAYILAR
 *
 * Fern stili sayıları yazıyla yazar: "four thousand kilometres", "two hundred
 * and twenty star positions", "Only five navigators". İlk sürüm `\d` arıyordu,
 * dolayısıyla ölçek taşıyan bütün beat'ler jenerik `fact`'e düşüyordu ve tek
 * bir grid_scale sahnesi bile üretilmiyordu.
 */
const NUMBER_WORD =
  '(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|billion|dozen)';
const NUM = `(?:\\d[\\d,.]*|${NUMBER_WORD}(?:[\\s-]+(?:and[\\s-]+)?${NUMBER_WORD})*)`;

/** SAYILABİLİR birimler — ikon ızgarası (grid_scale) bunlarda meşru. */
const COUNTABLE =
  '(?:people|men|women|children|navigators|survivors|witnesses|passengers|crew|villages|ships|canoes|positions|cases|families|workers)';

/** ÖLÇÜLEBİLİR ama sayılamaz birimler — ikon ızgarası bunlarda yanlış. */
const MEASURE =
  '(?:kilometres|kilometers|miles|metres|meters|feet|tonnes|tons|litres|liters|dollars|years|months|weeks|days|hours|minutes|degrees)';

const RULES = [
  // Alıntı: tırnak içinde geçen cümle.
  {kind: 'quote', test: (t) => /["“].+["”]/.test(t)},
  // DÖNÜŞ: anlatının yön değiştirdiği an. Fern DNA'sının imza cihazı ve
  // görsel olarak kendi sahnesini hak eder — jenerik olgu değil.
  {
    kind: 'turn',
    test: (t) =>
      /\b(here is the strange part|what nobody knew|but nobody|except|and yet|the problem was|then everything changed)\b/i.test(
        t,
      ),
  },
  // Karşılaştırma: iki şeyi karşı karşıya koyan diller.
  {
    kind: 'compare',
    test: (t) =>
      /\b(instead of|rather than|unlike|whereas|but not|versus|vs\.?)\b/i.test(t) || /\bnot\b[^.]*\bbut\b/i.test(t),
  },
  // Veri: yüzde, oran, eğilim.
  {
    kind: 'data',
    test: (t) =>
      new RegExp(`\\b${NUM}\\s?(?:percent|%)\\b`, 'i').test(t) ||
      /\b(doubled|tripled|halved|rose|fell|grew|dropped|collapsed)\b/i.test(t),
  },
  // ZAMAN: süre ve zaman atlaması. `scale`'DEN ÖNCE gelmeli — "Thirty-three
  // days later" hem sayı+birim hem zaman deseni; ölçek olarak sınıflanırsa
  // grid_scale sahnesi çıkıyor ve 33 tane insan ikonu çiziliyor, ki anlatının
  // söylediği şey bu değil.
  {
    kind: 'time',
    test: (t) =>
      new RegExp(`\\b${NUM}[\\s-]+(?:days|years|months|weeks|hours)\\s+later\\b`, 'i').test(t) ||
      /\b(by morning|by nightfall|within the hour|that night|every night|every day|for \w+ years)\b/i.test(t),
  },
  /**
   * ÖLÇEK — SAYILABİLİR küme. grid_scale tekrarlı insan/nesne ikonu çizer, o
   * yüzden yalnızca gerçekten sayılabilen birimlerde meşru: "beş seyir
   * ustası", "on kişiden biri".
   */
  {
    kind: 'scale',
    test: (t) =>
      new RegExp(`\\bone in\\s+${NUM}\\b`, 'i').test(t) ||
      new RegExp(`\\b(?:only|just)\\s+${NUM}\\s+${COUNTABLE}\\b`, 'i').test(t) ||
      new RegExp(`\\b${NUM}\\s+(?:\\w+\\s+)?${COUNTABLE}\\b`, 'i').test(t),
  },
  /**
   * BÜYÜKLÜK — mesafe/süre/hacim. Sayılamaz, o yüzden ikon ızgarası YANLIŞ
   * görsel: "dört bin kilometre" 4000 tane şey değil, tek bir uzunluktur.
   * Geniş kuruluş ya da grafik ister.
   */
  {
    kind: 'magnitude',
    test: (t) => new RegExp(`\\b${NUM}\\s+(?:\\w+\\s+)?${MEASURE}\\b`, 'i').test(t),
  },
  // Sıra/rota: iki yer arası hareket.
  {
    kind: 'sequence',
    test: (t) => /\bfrom\b[^.]*\bto\b/i.test(t) || /\b(sailed|travelled|traveled|flew|crossed|marched|drove)\b/i.test(t),
  },
  // Yokluk: "hiçbir şeyi yoktu" — görsel olarak boşluk/eksik anlatır.
  {kind: 'absence', test: (t) => /\b(no|without|never|nothing|none)\b/i.test(t) && !/\bnot\b[^.]*\bbut\b/i.test(t)},
  // Kişi: özel isim + tanıtım.
  {
    kind: 'person',
    test: (t) => /\b(a man|a woman|named|called)\b/i.test(t) && /[A-Z][a-z]+\s[A-Z][a-z]+/.test(t),
  },
  // Yer: coğrafi tanıtım.
  {kind: 'place', test: (t) => /\b(in|at|near|off the coast of|across)\s+[A-Z][A-Za-z’'-]+/.test(t)},
  // Soyut: izleyiciye dönük, ikinci tekil şahıs, soru.
  {kind: 'abstract', test: (t) => /\b(you|your|imagine|everyone|we)\b/i.test(t) || /\?\s*$/.test(t)},
];

export function classifyBeat(text, position) {
  const t = String(text || '');
  // İlk beat her zaman cold open: PDF'in en katı kuralı.
  if (position === 0) return 'cold_open';
  for (const r of RULES) if (r.test(t)) return r.kind;
  return 'fact';
}

/**
 * BEAT TÜRÜ → SAHNE ŞABLONU
 *
 * İki kayıt ayrımı burada uygulanıyor: soyut beat çöp adam alır, olgusal beat
 * halftone cutout alır. Referans videoda ölçülen kural bu.
 *
 * `used` seti: aynı şablon üst üste iki kez seçilmez. Şablon tekrarı
 * "şablondan çıkmış" hissinin birinci sebebi.
 */
const PRIMARY = {
  cold_open: ['wide_establish', 'headline_card'],
  fact: ['hero_cutout', 'headline_card', 'labeled_diagram', 'wide_establish'],
  place: ['map_route', 'wide_establish'],
  person: ['headline_card', 'hero_cutout'],
  compare: ['split_compare'],
  sequence: ['map_route', 'archival_timeline'],
  scale: ['grid_scale', 'data_annotate'],
  // Büyüklük sayılamaz: ikon ızgarası değil, geniş kuruluş ya da grafik.
  magnitude: ['wide_establish', 'data_annotate', 'map_route'],
  data: ['data_annotate', 'grid_scale'],
  time: ['archival_timeline', 'star_field', 'wide_establish'],
  absence: ['hero_cutout', 'stick_beat', 'headline_card'],
  turn: ['pull_quote', 'star_field'],
  abstract: ['stick_beat'],
  quote: ['pull_quote'],
  cliffhanger: ['star_field', 'headline_card'],
};

/**
 * Şablon seç.
 *
 * `recent` son seçilen şablonlar (en yenisi başta). Bir geriye değil İKİ geriye
 * bakılır: tek adım geriye bakmak A,B,A,B,A,B salınımını engellemiyor — ilk
 * sürümde 22 sahnenin 16'sı iki şablon arasında gidip geliyordu ve "ardışık
 * tekrar: 0" raporu bunu yakalamıyordu, çünkü teknik olarak tekrar yoktu.
 */
export function templateForBeat(kind, recent = []) {
  const options = PRIMARY[kind] ?? PRIMARY.fact;
  const look = recent.slice(0, 2);
  const fresh = options.find((o) => !look.includes(o));
  if (fresh) return fresh;
  const notLast = options.find((o) => o !== look[0]);
  return notLast ?? options[0];
}

/**
 * Anlatıyı zamanlanmış beat listesine çevir.
 *
 * @param {string} narration  tek blok sürekli anlatı (Fern stili)
 * @param {object} [opts]
 * @param {number} [opts.maxWordsPerBeat]  PDF: 5-8 kelime, tavan 8
 * @returns {{beats: Array, totalSeconds: number, words: number}}
 */
export function buildBeats(narration, {maxWordsPerBeat = 8} = {}) {
  const sentences = splitSentences(narration);
  const chunks = [];
  sentences.forEach((s, si) => {
    // SON CÜMLE BÖLÜNMEZ. PDF: cliffhanger 12 kelimeden kısa, tek parça iner
    // ve isim/tarih/kısa bildirimle biter. Bölmek vuruşu öldürür — ilk sürüm
    // "Nobody had made that" / "crossing for six hundred years." diye ikiye
    // ayırıp cümleyi anlamsızlaştırıyordu.
    const isFinal = si === sentences.length - 1;
    if (isFinal && wordCount(s) <= 14) chunks.push(s.trim());
    else chunks.push(...splitLongSentence(s, maxWordsPerBeat));
  });

  let t = 0;
  /** Son seçilen şablonlar, en yenisi başta. */
  const recent = [];
  const beats = chunks.map((text, i) => {
    const words = wordCount(text);
    const seconds = secondsForWords(words);
    const isLast = i === chunks.length - 1;
    const kind = isLast && i > 0 ? 'cliffhanger' : classifyBeat(text, i);
    const template = templateForBeat(kind, recent);
    recent.unshift(template);
    const beat = {
      index: i,
      text,
      words,
      start: Number(t.toFixed(2)),
      seconds: Number(seconds.toFixed(2)),
      kind,
      template,
    };
    t += seconds;
    return beat;
  });

  return {beats, totalSeconds: Number(t.toFixed(2)), words: wordCount(narration)};
}

/**
 * ŞABLON ÇEŞİTLİLİĞİ ÖLÇÜSÜ
 *
 * "Ardışık tekrar: 0" yanıltıcı bir metrikti: A,B,A,B,A,B dizisi bu testi
 * geçiyor ama izleyiciye iki şablon gibi görünüyor. Gerçek ölçü, en sık
 * şablonun toplam içindeki payı.
 */
/**
 * ŞABLON–PAYLOAD SÖZLEŞMESİ
 *
 * Bir şablon, ihtiyacı olan veri gelmediğinde BOŞ çizer. Ölçümde tam bu oldu:
 * `archival_timeline` iki sahnede seçildi, ama anlatıda tek yıl geçtiği için
 * (`1976`) zaman çizelgesi satırları hiç dolmadı ve iki sahne yalnızca alt
 * başlıktan ibaret kaldı. 19 sahnenin 2'si boştu.
 *
 * Bu yüzden şablon seçimi artık iki aşamalı: tür şablonu ÖNERİR, sözleşme
 * onaylar. Onaylamazsa öneri listesinde ilerlenir.
 */
export const TEMPLATE_REQUIREMENTS = {
  // archive_clip beat türünden SEÇİLMEZ; ingest-clips.mjs klip bulduğu sahnenin
  // şablonunu buna çevirir. Sözleşmesi burada, çünkü registry testi her şablonun
  // kayıtta olmasını istiyor.
  archive_clip: (p) => Boolean(p.clip && p.clip.src),
  archival_timeline: (p) => Array.isArray(p.timeline) && p.timeline.length >= 2,
  split_compare: (p) => Array.isArray(p.sides) && p.sides.length === 2,
  grid_scale: (p) => !!p.ratio && p.ratio.total >= 2,
  data_annotate: (p) => Array.isArray(p.series) && p.series.length >= 3,
  map_route: (p) => Array.isArray(p.route) && p.route.length >= 2,
  pull_quote: (p) => typeof p.quote === 'string' && p.quote.trim().length > 0,
  labeled_diagram: (p) => typeof p.headline === 'string' && p.headline.trim().length > 0,
  // Kalanlar yalnızca başlık ister; başlıksız sahne de boş sayılır.
};

export function canRender(template, payload) {
  const req = TEMPLATE_REQUIREMENTS[template];
  if (req) return Boolean(req(payload));
  return Boolean(
    (payload.headline && String(payload.headline).trim()) ||
      (payload.quote && String(payload.quote).trim()) ||
      (payload.label && String(payload.label).trim()),
  );
}

/**
 * Türün öneri listesini sözleşmeye göre süz.
 * `build` bir şablon adı alıp o şablon için payload üretir (derleyici verir).
 */
/** Tür listesi tükendiğinde başvurulacak genel havuz (başlıkla çizebilenler). */
const GENERAL_POOL = ['hero_cutout', 'headline_card', 'wide_establish', 'stick_beat', 'star_field'];

export function resolveTemplate(kind, recent, build) {
  const options = PRIMARY[kind] ?? PRIMARY.fact;
  const look = recent.slice(0, 2);

  /** Sırayla dene, sözleşmeyi geçen ilkini döndür. */
  const tryAll = (list) => {
    for (const t of list) {
      const payload = build(t);
      if (canRender(t, payload)) return {template: t, payload};
    }
    return null;
  };

  // 1) Türün önerileri, son iki sahnede kullanılmayanlar önce.
  const fresh = options.filter((o) => !look.includes(o));
  let hit = tryAll(fresh);
  if (hit) return hit;

  /**
   * 2) Türün listesi tükendi. Burada doğrudan tekrara düşmek yerine GENEL
   * havuzdan taze bir şablon denenir.
   *
   * NEDEN: ölçümde 1. ve 2. sahne ikisi de `wide_establish` çıktı. 2. sahnenin
   * türü `place`, önerisi `map_route`; ama cümlede tek yer adı geçtiği için
   * rota sözleşmesi reddetti ve liste `wide_establish`e, yani bir önceki
   * sahnenin şablonuna düştü. Genel havuz bu çıkmazı açar.
   */
  hit = tryAll(GENERAL_POOL.filter((o) => !look.includes(o)));
  if (hit) return hit;

  // 3) Son çare: türün listesi (tekrar pahasına), sonra hero_cutout.
  hit = tryAll(options);
  if (hit) return hit;
  return {template: 'hero_cutout', payload: build('hero_cutout')};
}

export function templateVariety(beats) {
  const counts = {};
  for (const b of beats) counts[b.template] = (counts[b.template] ?? 0) + 1;
  const n = beats.length || 1;
  const top = Math.max(0, ...Object.values(counts));
  const pairs = beats.filter((b, i) => i > 1 && b.template === beats[i - 2].template).length;
  return {
    distinct: Object.keys(counts).length,
    topShare: Number((top / n).toFixed(3)),
    alternating: pairs,
    counts,
  };
}

/** Beat sayısı PDF'in aralığında mı? Uyarı üretir, hata atmaz. */
export function checkBeatCount(beats, totalSeconds) {
  const row = BEAT_COUNT_RANGE.reduce((best, r) =>
    Math.abs(r.seconds - totalSeconds) < Math.abs(best.seconds - totalSeconds) ? r : best,
  );
  const n = beats.length;
  if (n < row.min) return {ok: false, message: `beat sayısı az: ${n} < ${row.min} (${row.seconds}s referansı)`};
  if (n > row.max) return {ok: false, message: `beat sayısı fazla: ${n} > ${row.max} (${row.seconds}s referansı)`};
  return {ok: true, message: `beat sayısı uygun: ${n} ∈ [${row.min},${row.max}]`};
}
