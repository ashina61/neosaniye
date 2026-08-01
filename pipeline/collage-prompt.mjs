/**
 * KOMPOZE ARŞİV KOLAJ PROMPT'U
 *
 * Hedef kalite, kullanıcının Aylesbury/1963 karesi: krem kağıt zemin üstünde
 * üst üste binmiş, gerçek dokulu arşiv belgeleri —
 *
 *   · zımba delikli, yırtık kenarlı takvim yaprağı, üstünde dev condensed tarih
 *   · takvimin kenarına taşan yuvarlak posta damgası
 *   · yırtık kenarlı gravür harita parçası, gerçek yer adlarıyla
 *   · haritadan aşağı inen KIRMIZI İP, iki ucunda pirinç iğne
 *   · gazete kupürü (tarife, ilan, manşet), okunur satırlarla
 *   · hardal renkli etiket şeridi
 *   · baskı kenarlı halftone siyah-beyaz arşiv fotoğrafı
 *
 * ================== NEDEN AYRI BİR PROMPT ==================
 *
 * `generate-cutouts.mjs` bunun TERSİNİ ister: tek özne, izole, magenta zeminde,
 * metin YOK. O prompt katmanlı kod kompozisyonu için doğru. Bu prompt ise TEK
 * BİTMİŞ KARE ister ve metni görselin içine koyar.
 *
 * İkisi birbirinin yerine geçmez, ikisi de gerekli:
 *   composed → anlatının olgusal/arşiv anları (varsayılan kayıt)
 *   cutout   → kodla çizilen veri sahnelerinin içine giren parça
 *
 * ================== METİN NEDEN SERBEST ==================
 *
 * Cutout prompt'unda metin yasak, çünkü etiketi Remotion çiziyor. Burada
 * serbest, hatta isteniyor: Aylesbury karesindeki "8 / AUG / 1963" görselin
 * en güçlü öğesi. Görsel modelleri KISA ve TEK PARÇA metni (tarih, yer adı,
 * iki kelimelik manşet) iyi diziyor; bozulma uzun cümlede başlıyor. O yüzden
 * kural referans PDF'ten alınıyor: en fazla 4 kelimelik, sayılı/tarihli
 * öğeler.
 */

/** Referans PDF'in stil bloğu — her prompt'ta birebir geçer. */
import {subjectFor} from './subject.mjs';

/**
 * KROMA ANAHTAR RENGİ — TEK KAYNAK.
 *
 * Bu değer İKİ yerde birden gerekiyor: parça prompt'unda (modele "zemini bu
 * renkle doldur" demek için) ve `cutout.py` çağrısında (o rengi silmek için).
 * Ayrı ayrı yazılırsa biri değiştiğinde alfa çıkarımı sessizce boş maske
 * üretir. Bu depoda aynı sınıf ayrışma dört kez ölçüldü.
 */
export const KEY_COLOUR = 'pure saturated magenta (#FF00FF)';

/**
 * STİL BLOĞU — KAYNAK PDF'TEN BİREBİR (SECTION 5).
 *
 * Belge "this is the style block that appears verbatim inside every image
 * prompt" diyor. Karşılaştırıldı ve bir sapma bulundu: "tan, ink black, and
 * halftone gray" yerine "tan, ink black and halftone gray" yazıyordu (Oxford
 * virgülü eksik). Küçük görünüyor ama "verbatim" denen bir blokta sapma,
 * sapmadır — ve bu depoda aynı sınıf sessiz ayrışma dört kez ölçüldü.
 */
const STYLE_BLOCK = [
  'hand-cut documentary paper collage on aged newsprint and archival map surfaces,',
  'black and white halftone photograph cutouts with rough scissor-cut edges and offset accent strokes,',
  'torn paper edges, masking tape fragments, typewriter caption strips, rubber stamp marks,',
  'red string and brass pins where the story calls for connections,',
  'desaturated archival palette of tan, ink black, and halftone gray with ONE hot red signal accent',
  'and a restrained mustard yellow secondary, condensed bold headline lettering only where a label is specified,',
  'visible print grain and paper fiber, matte, flat even documentary lighting with soft cutout drop shadows.',
].join(' ');

/**
 * CLOSER — KAYNAK PDF'TEN BİREBİR (SECTION 5, "The closer").
 *
 * Karşılaştırıldı ve KOCA BİR CÜMLE eksikti: "The composition stays clean,
 * minimal, and editorial with generous negative space." Ayrıca "no clutter" ve
 * "no text beyond the specified label" da yoktu. Üçü de kompozisyon
 * disiplinini taşıyan ifadeler; eksik olmaları promtun kalabalık kare
 * üretmesine açık kapı bırakıyordu.
 *
 * TEK KASITLI SAPMA: PDF "16:9" diyor, biz "9:16". Kullanıcı bunu açıkça
 * onayladı (Shorts kanalı) ve kendi engine çıktısı örneği de 9:16 yazıyor.
 */
const CLOSER = [
  'Every element must appear physically hand-cut and layered from real paper, with visible cutout edges,',
  'halftone print texture, and soft shadow separation between layers.',
  'The composition stays clean, minimal, and editorial with generous negative space.',
  'NOT digital illustration, NOT cartoon, NOT 3D render, NOT glossy, no gradients, no clutter,',
  'no watermark, no logos, no text beyond the specified label.',
  'Premium documentary collage aesthetic, 9:16, ultra-detailed, 8K.',
].join(' ');

/**
 * HARFSİZ STİL BLOĞU — harf daveti ÇIKARILMIŞ hâli.
 *
 * ============ NEDEN GEREKLİ: ÖLÇÜLDÜ ============
 *
 * Stil bloğu "condensed bold headline lettering only where a label is
 * specified" diyor. Etiket İSTENMEDİĞİNDE bu cümle teknik olarak ihlal
 * edilmiyor ama ölçüm başka şey gösterdi: 4. ve 5. turda plaka promtu
 * "ABSOLUTELY NO WRITING OF ANY KIND" derken bile bu cümleyi taşıyordu ve
 * 4 plakanın 4'ü uydurma manşetle geldi ("YOOLNI IIILNIIRIGLLLID").
 *
 * Yani bu modelde harften SÖZ ETMEK, harf çizmeye davettir. `PLATE_STYLE`
 * aynı sebeple aynı cümleyi çıkarıyor; burası onun kompoze kare karşılığı.
 */
const STYLE_BLOCK_NO_TEXT = STYLE_BLOCK
  .replace('condensed bold headline lettering only where a label is specified, ', '')
  // "typewriter caption strips" bir KAĞIT değil, bir METİN öğesi: daktilo
  // şeridinin tanımı üstündeki yazıdır. Harfsiz kipte o da çıkıyor, yoksa
  // model şeridi çizip üstünü uydurma harfle dolduruyor — plaka hatasının
  // birebir aynısı.
  .replace('typewriter caption strips, ', '');

/**
 * CLOSER'IN HARFSİZ HÂLİ. Orijinali "no text beyond the specified label" diyor
 * ve etiket yokken bu ifade zaten hiçbir şeye izin vermiyor — ama koşullu
 * yazılmış bir yasak, koşulsuz yazılmış bir yasaktan zayıftır. Bu modelde
 * ölçülen davranış tam olarak bu.
 */
const CLOSER_NO_TEXT = CLOSER.replace(
  'no text beyond the specified label.',
  'no text, no letters, no numbers, no lettering of any kind anywhere in the image.',
);

/**
 * Beat türüne göre kompozisyon reçetesi.
 *
 * Her reçete TEK hero öğe (görsel ağırlığın ~%70'i) ve en fazla 2-3 destek
 * öğesi tanımlar. Referans PDF'in kompozisyon yasası bu; Aylesbury karesi de
 * buna uyuyor (hero = takvim yaprağı, destek = harita, foto, kupür).
 */
const RECIPES = {
  cold_open: {
    hero: 'a torn calendar page with punch holes along its top edge, pinned at a slight angle',
    heroText: 'the date set as one huge condensed numeral above two rule lines',
    support: [
      'a round postmark rubber stamp overlapping the calendar edge',
      'a torn fragment of an engraved county map behind it',
      'a strip of masking tape holding the calendar down',
    ],
  },
  place: {
    hero: 'a torn fragment of an engraved antique map, place names legible in small serif type',
    heroText: 'one mustard label strip naming the region',
    support: [
      'a brass pin pushed into one named location',
      'a small halftone photograph of a street or station with a white print border',
    ],
  },
  person: {
    hero: 'a halftone black and white portrait photograph with a white print border and torn lower edge',
    heroText: 'a typewriter caption strip under the photograph',
    support: ['a rubber stamp mark across one corner', 'a paper file tab clipped to the top edge'],
  },
  fact: {
    hero: 'a newspaper clipping with a legible headline and two columns of body type, torn from the page',
    heroText: 'the headline in condensed bold caps',
    support: ['a coffee ring stain on the paper', 'one red marker underline beneath a key line'],
  },
  sequence: {
    hero: 'an engraved railway or road map fragment with a route traced across it',
    heroText: 'two small labels naming the start and the end',
    support: [
      'red string running from one brass pin to another along the route',
      'a printed timetable clipping below the map',
    ],
  },
  data: {
    hero: 'a printed statistical table clipping with legible rows and a column of figures',
    heroText: 'one figure circled in red marker',
    support: ['a torn ledger edge', 'a rubber stamp reading a short word'],
  },
  scale: {
    hero: 'a printed register page with a column of repeated small entries, most struck through in red',
    heroText: 'one short label giving the surviving count',
    support: ['a paper clip at the top of the page', 'a faint fingerprint smudge'],
  },
  time: {
    hero: 'two torn calendar pages overlapping, the later one on top',
    heroText: 'both dates as condensed numerals',
    support: ['a red string stretched between the two pages', 'a small pocket watch photograph, halftone'],
  },
  compare: {
    hero: 'two halftone photographs laid side by side on the paper, each with a white print border',
    heroText: 'a short typewriter label under each photograph',
    support: ['a red marker line drawn between them', 'a torn newsprint strip beneath both'],
  },
  quote: {
    hero: 'a typed page fragment with one sentence visible, the rest torn away',
    heroText: 'the sentence in typewriter type',
    support: ['a red underline beneath three words', 'a paper clip at the corner'],
  },
  turn: {
    hero: 'a sealed envelope or folded document, partly opened, laid on the paper',
    heroText: 'no text',
    support: ['a broken wax seal', 'one brass pin holding the flap open'],
  },
  absence: {
    hero: 'an empty document form or blank register page, its fields unfilled',
    heroText: 'one rubber stamp reading a single short word',
    support: ['a torn corner where something was removed', 'a faint outline where an object once sat'],
  },
  cliffhanger: {
    hero: 'a single object photographed as evidence on plain paper, halftone, with a case tag beside it',
    heroText: 'a short case tag label',
    support: ['a red string leading off the edge of the frame', 'a rubber stamp across the corner'],
  },
};

const FALLBACK = RECIPES.fact;

/**
 * Destek öğesinin başındaki belirteci at: cümle "One a coffee ring stain"
 * değil "One coffee ring stain" olmalı. Küçük ama promt akan NESİR olmak
 * zorunda (PDF: "woven as natural prose in one block").
 */
function stripArticle(s) {
  return String(s).replace(/^(a|an|one|two)\s+/i, '');
}

/**
 * `subjectFor` makine biçimi döndürüyor: "a man: documentary photograph of a
 * person, three-quarter view, plain background". O biçim CUTOUT hattı için
 * yazıldı (izole özne, düz zemin) ve kompoze karede İKİ AYRI sorun çıkarıyor:
 * iki nokta üst üste nesri bozuyor, "plain background" ise kolaj zeminiyle
 * doğrudan çelişiyor.
 *
 * Kompoze kare için iki noktadan ÖNCEKİ isim yeterli — kullanıcının Mehmed
 * örneğinde de hero kısa bir isim ("Mehmed II on horseback"), uzun bir
 * fotoğraf tarifi değil. Nasıl render edileceğini zaten stil bloğu söylüyor.
 */
function heroNoun(subject) {
  const i = String(subject).indexOf(':');
  return i > 0 ? String(subject).slice(0, i).trim() : String(subject).trim();
}

/** 4 kelime kuralı: uzun etiketi görsel modeli bozar. */
function shortLabel(text, maxWords = 4) {
  return String(text || '')
    .replace(/[*"“”]/g, '')
    .trim()
    .split(/\s+/)
    .slice(0, maxWords)
    .join(' ');
}

function firstDate(text) {
  const y = String(text).match(/\b(1[0-9]{3}|20[0-9]{2})\b/);
  const m = String(text).match(
    /\b(January|February|March|April|May|June|July|August|September|October|November|December)\b/i,
  );
  const d = String(text).match(/\b([0-3]?\d)(?:st|nd|rd|th)?\s+(?:of\s+)?(?:January|February|March|April|May|June|July|August|September|October|November|December)\b/i);
  if (y && m) return `${d ? d[1] + ' ' : ''}${m[1].toUpperCase().slice(0, 3)} ${y[1]}`;
  if (y) return y[1];
  return null;
}

/**
 * Ay adları özel isim SAYILMAZ: tarih zaten ayrı çıkarılıyor ve ikisi birden
 * geçince prompt "the date 24 NOV 1971 and the name NOVEMBER" diyordu — aynı
 * bilgiyi iki kez, biri yanlış kategoride.
 */
const MONTH_NAME =
  /^(january|february|march|april|may|june|july|august|september|october|november|december)$/i;

function properNouns(text, limit = 2) {
  const words = String(text).split(/\s+/).slice(1);
  const out = [];
  let run = [];
  for (const w of words) {
    const bare = w.replace(/[^A-Za-z’'-]/g, '');
    if (/^[A-Z][a-z’'-]{2,}$/.test(bare) && !MONTH_NAME.test(bare)) run.push(bare);
    else if (run.length) {
      out.push(run.join(' '));
      run = [];
    }
  }
  if (run.length) out.push(run.join(' '));
  return out.slice(0, limit);
}

/**
 * Bir beat için kompoze kolaj prompt'u kur.
 *
 * @param {{text: string, kind: string}} beat
 * @param {{title?: string, subtitle?: string}} story
 * @returns {string}
 */
/**
 * 9:16 ÇERÇEVE VE GÜVENLİ ALAN ÖN EKİ — kullanıcının doğrulanmış prompt setinden.
 *
 * BENDE OLMAYAN VE KRİTİK OLAN PARÇA BUYDU. Benim prompt'um görselin nereye
 * ne koyacağını söylemiyordu; oysa Remotion tarafı başlığı ÜST banda, etiketi
 * ALT banda çiziyor. Üretilen görselde o bantlar doluysa iki katman üst üste
 * biner ve metin okunmaz — kontakt sayfasında kod tarafında aynı çakışmayı
 * zaten ölçtüm.
 *
 * Yani bu cümleler süs değil, İKİ HATTIN SÖZLEŞMESİ: model üst %20 ile alt
 * %20'yi boş bırakacak, kod oraya yazacak.
 */
const FRAME_PREFIX =
  'Vertical 9:16 editorial documentary paper collage composition for YouTube Shorts, ' +
  'one dominant hero element centered in the middle safe zone, ' +
  'upper 20 percent kept visually clean for hook text, ' +
  'lower 20 percent kept visually clean for subtitles, generous side margins, ' +
  'no important subject touching the frame edges.';

/**
 * @param {{text: string, kind: string}} beat
 * @param {object} [story]
 * @param {{withText?: boolean}} [opts] — `withText` VARSAYILAN OLARAK KAPALI.
 *   Gerekçe `STYLE_BLOCK_NO_TEXT` başında: bedava uçtaki model okunur harf
 *   basamıyor ve harften söz etmek uydurma harf çizdiriyor. Harfi Remotion
 *   çiziyor — üstelik gerçek tarihle ve deterministik.
 */
export function composedCollagePrompt(beat, story = {}, opts = {}) {
  const withText = opts.withText === true;
  const text = String(beat.text || '').replace(/[*"]/g, '').trim();
  const recipe = RECIPES[beat.kind] ?? FALLBACK;

  /**
   * HERO CÜMLENİN NESNESİNDEN GELİR, BEAT TÜRÜNDEN DEĞİL.
   *
   * Bu, render tarafında düzelttiğim hatanın prompt tarafındaki ikizi: reçete
   * beat TÜRÜNE (fact/place/scale) bağlıydı, cümlenin ne dediğine değil.
   * Sonuç paket çıktısında göründü — "and jumped with a parachute" beat'i için
   * istenen kare "A newspaper clipping with a legible headline" idi. Paraşüt
   * promtta hiç geçmiyordu.
   *
   * Cümlede somut nesne varsa hero O olur; yoksa tür reçetesi devreye girer.
   * Aynı `subjectFor` iki hattı da besliyor: kodla çizilen siluet ile modele
   * tarif edilen nesne artık AYNI kaynaktan geliyor.
   */
  const concrete = subjectFor(text);

  // Görselin içine girecek metin: yalnızca tarih ve özel isim. Anlatı cümlesi
  // ASLA görsele yazdırılmaz — model uzun metni bozar ve zaten anlatımı ses
  // taşıyor.
  const date = firstDate(text);
  const names = properNouns(text);
  const labels = [];
  if (date) labels.push(`the date ${date}`);
  for (const n of names) labels.push(`the name ${n.toUpperCase()}`);

  /**
   * METİN-GÖRSELDE YASASI (PDF Section 5).
   *
   * "Default is NO text. When a beat carries a date, a name, or a number that
   * matters, ONE label of 1-4 words may appear on a paper strip, a stamp, or a
   * torn headline. Image models mangle longer text, so never exceed 4 words."
   *
   * Önceki sürüm İKİ etiket birden verebiliyordu ("the date X and the name Y").
   * Belge TEK diyor; ikisi varsa tarih kazanıyor çünkü cold_open'ın taşıdığı
   * bilgi o.
   */
  const label = date ? date : names[0] ? names[0].toUpperCase() : null;

  /**
   * SANSÜR BARI — gerçek bir kişi ima ediliyorsa gözlerin üstüne siyah bar.
   * Hem stilin imzası hem de gerçek kişiyi teşhis edilebilir çizmemenin yolu.
   */
  const isPerson = PERSON_RE.test(usableHero(concrete) ?? '');

  /**
   * DESTEK ÖĞELER: en fazla iki (PDF "Composition law").
   *
   * ARTİKEL KORUNUYOR. Önce `stripArticle` uygulanıyordu ve çıktı
   * "round postmark rubber stamp overlapping the calendar edge and torn
   * fragment of an engraved county map" oluyordu — bozuk İngilizce. Örnek
   * promtlar artikeli koruyor: "one strip of masking tape at its corner and
   * a faint coffee-ring stain nearby".
   */
  const supports = recipe.support.slice(0, 2).map((x) => String(x).trim());

  const usable = usableHero(concrete);
  const hero = usable
    ? `a halftone black and white photograph cutout of ${heroNoun(usable)}`
    : stripArticleKeepText(recipe.hero);

  /**
   * ============ SAHNE CÜMLESİ: MOTORUN ŞEKLİ, BİREBİR ============
   *
   * Kullanıcının verdiği üç örnek promt aynı kalıbı kullanıyor ve kalıp
   * TEK AKAN CÜMLE, virgülle bağlı:
   *
   *   "A single torn calendar page dominates the frame AS THE HERO ELEMENT,
   *    hand-torn from aged newsprint, carrying the stamp-printed label
   *    NOV 24 1971 in condensed black type inside a red rubber-stamp box,
   *    pinned at a slight angle to a bare archival paper surface, one strip of
   *    masking tape at its corner and a faint coffee-ring stain nearby
   *    AS THE ONLY SUPPORTING ELEMENTS, wide empty margins around it."
   *
   * ============ ÖNCEKİ SÜRÜMÜN DÖRT SAPMASI ============
   *
   * Bunlar ÖLÇÜLDÜ: stil bloğu ve closer birebir çıktı (closer'da yalnızca
   * izin verilen 16:9 → 9:16), ama sahne cümlesi yapı olarak sapmıştı.
   *
   * 1. "Vertical 9:16 editorial documentary paper collage." ÖN EKİ.
   *    Örneklerin hiçbirinde yok. Kategori adını en başa koymak özneyi
   *    geriye itiyor — bu deponun parça promtunda birebir aynı hata ölçüldü
   *    ("A single hand-cut paper collage element: a man" → çıkan şey adam
   *    değil yırtık kağıttı). En-boy zaten closer'da yazıyor.
   * 2. DÖRT AYRI CÜMLE. Örnekler tek cümle; nokta ağırlığı böler, virgül
   *    öğeleri aynı sahnenin parçası olarak bağlar.
   * 3. "as the hero element" ve "as the only supporting elements" İŞARETLERİ
   *    YOKTU. İkincisi kalabalığı kesen ifade — "no clutter" kuralının
   *    olumlu hâli.
   * 4. ETİKET AYRI CÜMLEDEYDİ: 'A short stamp label reads "24 NOV 1971".'
   *    Örnekler etiketi HERO'NUN İÇİNE gömüyor ve NASIL göründüğünü de
   *    söylüyor: "carrying the stamp-printed label NOV 24 1971 in condensed
   *    black type inside a red rubber-stamp box". Model etiketi nereye
   *    koyacağını böyle biliyor.
   */
  const labelClause =
    withText && label
      ? `carrying the stamp-printed label ${shortLabel(label, 4)} in condensed black type inside a red rubber-stamp box`
      : null;

  /**
   * ZEMİN CÜMLESİ. Örneklerin üçünde de hero bir YÜZEYE konuyor:
   * "pinned at a slight angle to a bare archival paper surface",
   * "placed on an aged archival map of the Pacific Northwest",
   * "aged newsprint background with wide clean margins".
   */
  /**
   * TEKRARI ÖNLE: reçetelerin bazı hero'ları zaten "pinned at a slight angle"
   * diyor ve zemin cümlesi aynı ifadeyi ikinci kez ekliyordu — ölçülen çıktıda
   * cümle içinde iki kez geçti. Hero zaten iğneliyse zemin sade söylenir.
   */
  const pinned = /\bpin(ned)?\b/i.test(hero);
  const surface = story.place
    ? `placed on an aged archival map of ${story.place}`
    : pinned
      ? 'on a bare archival paper surface'
      : 'pinned at a slight angle to a bare archival paper surface';

  const scene = [
    `${capitalise(hero)} dominates the frame as the hero element`,
    // Fotoğraf cutout'unda kırmızı ofset vuruş: örneklerin ikisinde de var ve
    // karenin TEK sıcak rengini oraya yerleştiriyor.
    usable ? 'rough scissor-cut edges with an offset red accent stroke behind it' : null,
    isPerson ? 'a black censor bar across the eyes' : null,
    labelClause,
    surface,
    supports.length
      ? `${supports.join(' and ')} as the only supporting elements`
      : 'everything else empty aged paper',
    'wide empty margins around it',
  ]
    .filter(Boolean)
    .join(', ');

  return [
    `${scene}.`,
    withText ? STYLE_BLOCK : STYLE_BLOCK_NO_TEXT,
    withText ? CLOSER : CLOSER_NO_TEXT,
  ].join(' ');
}

/** İlk harfi büyüt — sahne cümlesi özneyle açılıyor. */
function capitalise(t) {
  return `${t.charAt(0).toUpperCase()}${t.slice(1)}`;
}

/**
 * Reçetenin hero'sunu olduğu gibi bırakır (artikeli DE korur).
 * `stripArticle` destek öğeler için; hero cümlenin öznesi ve "A single torn
 * calendar page" gibi artikelli okunmalı.
 */
function stripArticleKeepText(t) {
  return String(t).trim();
}

/**
 * Universal Video Prompt — Flow'a verilecek hareket talimatı.
 *
 * Referans PDF'ten alındı, iki değişiklikle:
 *   · 9:16
 *   · süre 5 saniye (kullanıcının Flow denemesi 5 s üretti; 10 s isteyip
 *     5 s almak zamanlamayı bozuyor)
 *
 * ÖLÇÜM NOTU: kullanıcının Flow çıktısı ölçüldü ve prompt'un "verilen görseli
 * birebir koru" talimatını TUTMUYOR — gravür harita renkli bir haritayla
 * değişti, tarife içeriği yeniden yazıldı, orijinalde olmayan sayfa kıvrımı
 * eklendi, ilk kareye göre fark %14'ün altına hiç inmedi. Talimat yine de
 * elde tutuluyor çünkü sapmayı azaltıyor; ama çıktıdaki TARİH ve SAYILAR elle
 * kontrol edilmeli.
 */
/**
 * UNIVERSAL VIDEO PROMPT — kullanıcının doğrulanmış 10 saniyelik sürümü,
 * SÜRESİ PARAMETRELİ.
 *
 * NEDEN PARAMETRELİ: kullanıcının metni 10 saniye ve 0-7 sn kurulum, 7-10 sn
 * tutuş diyor. Bizim beat'ler 3.6-6.5 saniye. 10 saniyelik klibi 4 saniyeye
 * kırpmak iki kötü seçenekten birini dayatıyor: ya KURULUMU (asıl seyredilecek
 * şey) ya da OTURMUŞ KAREYİ kaybediyorsun.
 *
 * Çözüm oranı korumak: kurulum sürenin %70'i, tutuş %30'u — kullanıcının
 * 7/10 bölünmesinin aynısı. Yapı, dil ve katı kamera kilidi birebir onun
 * metninden; yalnızca sayılar beat'e oturuyor.
 *
 * Klip başına tek sahne varsayımı: `ingest-clips.mjs` klibin SONUNU beat'in
 * sonuna hizalıyor, yani oturmuş kare kesmeye denk geliyor.
 */
export function universalVideoPrompt(seconds = 10) {
  const total = Math.max(3, Math.round(seconds * 10) / 10);
  const build = Math.round(total * 0.7 * 10) / 10;
  return `Transform the provided image into a ${total}-second premium editorial documentary paper-collage animation. Preserve the final composition of the provided image exactly. Do not redesign, reposition, resize, or replace any element, and do not rewrite any text, date or number that appears in it. The provided image is the FINISHED frame that the animation builds toward.

Style: hand-cut documentary paper collage in motion. Aged newsprint and archival surfaces, halftone photo cutouts, torn edges, tape, stamps, red string, typewriter strips. Every element moves as a rigid physical paper piece. Visible cutout thickness, print grain, soft layered shadows. Stop-motion cadence, stepped easing, 2-3 frame holds, the hand-made "cutting on twos" feel. Never smooth CGI motion.

CAMERA, STRICT: the camera stays completely locked for the entire clip. No zoom, no pan, no tilt, no rotation, no orbit, no dolly, no tracking, no handheld shake, no focus pulls, no reframing, no cuts, no transitions, no morphing, no object replacement, no time skips. One continuous static shot.

0 TO ${build} SECONDS, BUILD-ON ASSEMBLY: the frame opens on the EMPTY background plate only: the bare aged-newsprint or archival surface with its stains, grain, and any fixed scaffolding (a map base, a timeline line, a corkboard), with every story element absent. Elements then enter one by one, back to front, in narrative order: background scraps settle first, then the hero cutout slides in with paper drag and a small settle, supporting cutouts drop or pin on with a 2-frame stamp settle, tape presses down, typewriter strips slide in, stamps slap on, red string draws itself from pin to pin, marker underlines and arrows draw themselves last. Each entrance lands with a tiny handcrafted bounce and casts a real layered shadow. No element moves again after it lands. By ${build} seconds the frame exactly matches the provided image.

${build} TO ${total} SECONDS, LIVING PAPER POSTER: everything holds position. Only subtle life remains: paper corners lift a millimeter in a draft, halftone dots shimmer faintly, string tension quivers once, shadows breathe, stamp ink glistens subtly. Nothing changes location, nothing scales, nothing rotates significantly, nothing enters or exits.

AUDIO: no music, no narration, no voices. Only close-up paper ASMR and faint scene-appropriate ambience: paper sliding, cardstock taps, tape press, stamp thud, string zip, pin click, soft room tone. All subtle.

FINAL RULE: the finished clip must feel like a real editorial paper collage assembling itself on a table, then holding as a living poster, matching the provided image exactly from ${build} seconds to the end.`;
}

/**
 * ÖLÇÜM NOTU — kullanıcının Flow çıktısı ölçüldü ve "verilen görseli birebir
 * koru" talimatını TUTMUYOR: gravür harita renkli bir haritayla değişti,
 * tarife içeriği yeniden yazıldı, orijinalde olmayan sayfa kıvrımı eklendi,
 * ilk kareye göre fark %14'ün altına hiç inmedi. Talimat yine de elde
 * tutuluyor çünkü sapmayı azaltıyor; ama çıktıdaki TARİH ve SAYILAR elle
 * kontrol edilmeli.
 */
export const UNIVERSAL_VIDEO_PROMPT = universalVideoPrompt(10);

export const RECIPE_KINDS = Object.keys(RECIPES);

/* ================================================================== */
/* B YOLU — PARÇA BAZLI KOLAJ                                          */
/* ================================================================== */
/**
 * NEDEN PARÇA BAZLI
 *
 * Tek bitmiş kolaj karesi alırsak Remotion onu AYIRAMAZ: öğeler piksele
 * gömülüdür, yapılabilecek tek şey kareyi bütün olarak kaydırmak. Oysa bu
 * deponun hareket motoru (`enter`, `cue`, `CastShadow`) tam da öğeleri TEK TEK
 * girdirmek için yazıldı — kullanıcının hareket promtunun 0-7 saniyede istediği
 * "build-on assembly" davranışı.
 *
 * Yani parçalar ayrı gelirse o davranış koda geçiyor ve bedava oluyor: kamera
 * gerçekten kilitli, tarih ve sayı değişmiyor, çıktı deterministik. Flow'dan
 * beklenip ÖLÇÜMLE alınamayan üç şey de bunlardı.
 *
 * ÜÇ TÜR DOSYA
 *   PLAKA  — zemin. Opak, tam kare, HİÇBİR öykü öğesi yok. Yalnızca yaşlanmış
 *            kağıt/harita/pano yüzeyi ve sabit iskele (zaman çizgisi çizgisi,
 *            ızgara). Sahne bununla AÇILIR.
 *   PARÇA  — düz magenta zeminde TEK nesne. `cutout.py` kroma anahtarıyla
 *            zemini siler, alfa PNG kalır. Konumlandırmayı KOD yapar; prompt'a
 *            yer tarif edilmez, çünkü güvenli alanı kod biliyor.
 *   YEDEK  — tek bitmiş kare (A yolu). Bir sahne için parça üretmek zahmetliyse
 *            bu kullanılır; o sahne build-on yapmaz, yalnızca film katmanı ve
 *            sürüklenme alır.
 */

/**
 * Parçanın zemin şartı — alfa çıkarımının tek dayanağı.
 *
 * ============ MAGENTA İKİ CANLI ÇALIŞTIRMADA DA BAŞARISIZ ============
 *
 * 1. TUR: 5 görselin beşinde de zemin magenta değildi (köşe skorları 0-37,
 *    eşik 87). Sebep prompt'taki çelişkiydi ("no colour" + neon magenta) ve
 *    gömülü özneydi. İkisi de düzeltildi.
 *
 * 2. TUR: yine %0.0. Ama bu sefer ölçüm asıl sorunu gösterdi — magenta
 *    ZEMİNDE değil, ÖZNENİN İÇİNDEYDİ:
 *      01-a  kenar  0  MERKEZ 16      01-c  kenar -5  MERKEZ 42
 *    Yani model "magenta" kelimesini duyunca ÖZNEYİ pembe boyadı. Kesilen
 *    parçalarda opak piksellerin %82'si (01-b) ve %47'si (01-c) pembeydi;
 *    kompoze karede ekranda pembe lekeler duruyordu.
 *
 * SONUÇ: magenta'dan söz etmek özneyi kirletiyor. İki tur prompt mühendisliği
 * bunu değiştirmedi, üçüncüsü de değiştirmezdi.
 *
 * ============ NEDEN BEYAZ ÇALIŞIR ============
 *
 * Aynı 2. turda TEK temiz parça portreydi: `02-fact-a`, pembe %0.0, ortalama
 * kroma 5.8, düz beyaz zeminde siyah-beyaz fotoğraf — ve `matte` modu onu
 * kusursuz kesti. 1. turda da matte 5/5 geçmişti.
 *
 * Yani modelin ZATEN vermek istediği şey bu: beyaz zeminde koyu özne. Ona
 * karşı kürek çekmek yerine istediğimiz o. `matte` modu (kenardan
 * taşma-doldurma) zeminin rengini bilmek zorunda değil, tekdüze olması yeter;
 * ve `keep_largest_blob` öznenin içindeki açık bölgeleri geri kapatıyor, yani
 * beyaz gömlek delik olmuyor.
 *
 * `KEY_COLOUR` yine de duruyor: kroma modu ve A yolu için geçerli, ve biri
 * elle magenta zeminli parça üretirse zincir onu hâlâ tanıyor.
 */
/**
 * PARÇANIN MALZEME STİLİ — kullanıcının doğrulanmış STYLE_BLOCK'undan.
 *
 * ============ BU BLOK PARÇA PROMT'UNDA HİÇ YOKTU ============
 *
 * `STYLE_BLOCK` depoda duruyor ve `composedCollagePrompt` (A yolu) ile
 * `platePrompt` onu kullanıyor. Ama MALZEMEYİ ASIL ÜRETEN parça promtuna hiç
 * girmemişti. Ölçüldü: üçüncü turda parça promtunda "aged newsprint" yok,
 * "archival" yok, "torn paper" yok, dönem bilgisi yok.
 *
 * Sonuç 3. turun alfa sayfasında görüldü: teknik olarak kusursuz kesilmiş
 * ama TAMAMEN YANLIŞ malzeme — 2020'lerin tişörtlü stüdyo portreleri, 1971
 * arşiv fotoğrafı değil. Üstelik bunu ben azdırdım: magenta'dan kaçarken
 * "plain seamless white studio backdrop, evenly lit" + "flat even documentary
 * lighting" yazdım, ki bu birebir modern ürün/portre fotoğrafı brief'i.
 *
 * Zemin TEMİZ kalmalı (ölçüldü: matte onu kusursuz kesiyor) ama "stüdyo"
 * denmemeli. Doğrusu: arşiv kontakt sayfasından kesilmiş bir baskı.
 */
/**
 * PARÇANIN MALZEME BLOĞU.
 *
 * ============ STİL BLOĞU BİREBİR, PARAFRAZ DEĞİL ============
 *
 * Kaynak PDF Section 7 açık: "STYLE BLOCK, include verbatim in every prompt".
 * Önceki sürümde buraya benim ELDEN YAZDIĞIM bir özet konuyordu — belgenin
 * dilini taşıyordu ama birebir değildi. Bir kolajın 17 karesi aynı filmden
 * çıkacaksa hepsinin AYNI stil metnini görmesi gerekiyor; parafraz, sapmanın
 * sessiz hâli.
 *
 * Stil bloğu tek kare için yazılmış ("collage on aged newsprint...") ama tek
 * PARÇA için de doğru okunuyor: parça o kolajdan makasla kesilmiş bir öğe.
 * Altına eklenen tek cümle o bağlamı kuruyor.
 */
/**
 * ============ ZEMİNİ ARTIK MODELDEN İSTEMİYORUZ ============
 *
 * Bu blok beş tur boyunca modele "BACKGROUND: blank flat white, completely
 * empty" dedi ve 5. turun ölçümü şu: beş görselin BEŞİNDE de dış %4 şeridinde
 * beyaz piksel oranı %0.0. Aynı turda "ABSOLUTELY NO WRITING OF ANY KIND" ve
 * "A black censor bar runs across the eyes" talimatları da tutmadı.
 *
 * Üç talimat, tek tur, üçü de boşa gitti. Sebep promtun kelimeleri değil:
 * Pollinations'ın bedava ucu schnell sınıfı, guidance damıtılmış bir FLUX ve o
 * sınıfta "no X" biçimindeki talimatın yönlendirme gücü pratikte sıfır.
 *
 * Kesme işi `pipeline/segment.py`e taşındı. Dolayısıyla promtun tek işi kaldı:
 * SEGMENTASYONUN AYIRABİLECEĞİ bir kare üretmek — yani karede tartışmasız TEK
 * bir baskın özne olsun. Zeminin ne olduğu artık önemsiz; model yaşlanmış
 * arşiv sayfası çizmek istiyorsa çizsin, özneyi biz kaldırıyoruz.
 *
 * STYLE_BLOCK buradan ÇIKARILDI. O blok bir KOMPOZİSYONU tarif ediyor
 * ("masking tape fragments, typewriter caption strips, rubber stamp marks,
 * red string and brass pins", "condensed bold headline lettering") ve tek
 * parça promtuna konduğunda modelin çizdiği şey tam olarak o oldu: parça
 * değil, üstünde parça olan bir sayfa. Parçaya gereken yalnızca MALZEME.
 */
/**
 * PARÇANIN MALZEMESİ — DÖNEME GÖRE.
 *
 * ============ NEDEN SABİT DEĞİL ============
 *
 * Sabitti ve her konuya "Black and white archival halftone photograph" diyordu.
 * Konu havuzu tek döneme (1971, 1963) bağlıyken bu görünmüyordu. Havuz on
 * konuya çıkınca ölçüldü ve promt şunu yazdı:
 *
 *   "A warship: full side profile of the vessel on water, documentary
 *    photograph. Period-accurate for 1628 … Black and white archival halftone
 *    photograph"
 *
 * 1628'de fotoğraf YOK. Fotoğraf 1839, gazetede halftone tramı 1880'ler.
 * Yani promt modelden var olmayan bir nesneyi istiyor ve model ne yaparsa
 * yapsın sonuç yanlış: ya bir replikanın modern fotoğrafı, ya "eskitilmiş"
 * sahte bir kare. İkisi de belgesel iddiasıyla bağdaşmıyor.
 *
 * Bu, otomatik üretimi SESSİZCE bozan sınıftan bir hata: koşu başarılı biter,
 * MP4 çıkar, görseller yanlıştır.
 *
 * ============ SINIRLAR ============
 *
 *   1885 →     gazete halftone'u; referans kolajın kendi malzemesi
 *   1839-1884  fotoğraf var, halftone tramı YOK — kolodyum/albümin baskı
 *   -1838      fotoğraf YOK — gravür, ağaç baskı, litografi
 *
 * Üçüncüsü kaçamak değil, belgesel kolajın gerçek çözümü: fotoğraf öncesi
 * dönemi anlatan her arşiv gravürle çalışır.
 *
 * OLUMSUZLAMAYA GÜVENİLMİYOR. Bu deponun ölçümü net: bedava uçtaki schnell
 * sınıfı FLUX guidance damıtılmış ve olumsuzlamanın yönlendirme gücü yok.
 * O yüzden ağırlık OLUMLU tarifte — tarama çizgisi, çapraz tarama, plaka izi.
 * Sondaki tek olumsuz cümle bedava bir ek, taşıyıcı değil.
 */
const MATERIAL_BY_ERA = [
  {
    from: 1885,
    text: [
      'Black and white archival halftone photograph, visible print grain and paper fibre,',
      'desaturated tan and ink-black tones, matte, flat documentary lighting.',
    ].join(' '),
  },
  {
    from: 1839,
    text: [
      'An early photographic print from the collodion and albumen era: warm sepia and grey tones,',
      'slightly soft edges, the frozen stillness of a long exposure, visible plate blemishes,',
      'mounted on card with paper fibre showing, matte, flat documentary lighting.',
    ].join(' '),
  },
  {
    from: -Infinity,
    text: [
      'A printed copperplate engraving on aged rag paper: the image is built from fine parallel',
      'hatching and cross-hatching lines rather than continuous tone, ink black on warm cream paper,',
      'the plate mark pressed into the sheet, paper fibre and foxing visible, matte.',
    ].join(' '),
  },
];

/** Dönem yılı → malzeme cümlesi. Yıl yoksa halftone (kanalın varsayılanı). */
export function pieceMaterial(era) {
  const y = Number.parseInt(String(era ?? '').replace(/\D+/g, ''), 10);
  if (!Number.isFinite(y)) return MATERIAL_BY_ERA[0].text;
  return MATERIAL_BY_ERA.find((m) => y >= m.from).text;
}

/**
 * Segmentasyonun işini kolaylaştıran tek cümle: kare TEK özneli olsun.
 * Olumsuzlama yok — ölçüldü ki bu modelde olumsuzlama çalışmıyor. Bunun
 * yerine olumlu ve somut: özne büyük, ortada, tek.
 */
const PIECE_BACKGROUND = [
  'ONE subject, centred, large in the frame, clearly separated from whatever is behind it.',
].join(' ');

/**
 * ZEMİN PLAKASI PROMT'U — sahnenin açıldığı boş yüzey.
 *
 * Öykü öğesi İSTENMEZ ve bu kritik: plaka üstünde bir fotoğraf ya da etiket
 * varsa build-on bozulur, çünkü sahne "boş kağıttan başlar" kuralı ihlal edilir
 * ve o öğe hiç girmemiş gibi orada durur.
 */
/**
 * PLAKA STİL BLOĞU — harf daveti ÇIKARILMIŞ hâli.
 *
 * ============ PLAKA İKİ KEZ METİNLE KİRLENDİ ============
 *
 * 4. turda iki plakanın ikisinde de uydurma yazı çıktı ("YOOLNI IIILNIIRIGLLLID")
 * ve birinde ayrıca bir YÜZ vardı. Oysa prompt "ABSOLUTELY NO story elements:
 * ... no labels, no text" diyor.
 *
 * Sebep promtun kendi içinde: stil bloğu "condensed bold headline lettering
 * only where a label is specified" diyor. Modele önce "hiç yazı olmasın" deyip
 * sonra "manşet harfleri" demek — magenta hatasının birebir aynısı, ve o hata
 * bu depoda iki tur kaybettirdi.
 *
 * Plaka için o cümle çıkarılıyor. Stil bloğunun geri kalanı (yaşlanmış
 * newsprint, arşiv harita yüzeyi, baskı greni, kağıt lifi) plakanın ta kendisi.
 */
const PLATE_STYLE = STYLE_BLOCK.replace(
  'condensed bold headline lettering only where a label is specified, ',
  '',
);

export function platePrompt(beat) {
  const kind = String(beat.kind || 'fact');
  const scaffold =
    kind === 'sequence' || kind === 'place'
      ? 'a faint engraved map base covering the surface'
      : kind === 'time'
        ? 'one faint horizontal rule running across the middle as a timeline base'
        : 'no scaffolding, just the bare surface';
  return [
    FRAME_PREFIX.replace('one dominant hero element centered in the middle safe zone, ', ''),
    'An EMPTY background plate: aged newsprint and archival paper surface with stains, foxing, fibre and print grain,',
    `${scaffold}.`,
    'ABSOLUTELY NO story elements: no photographs, no cutouts, no people, no faces, no objects,',
    'no labels, no tape, no stamps, no string, no pins. Only the bare aged surface.',
    'ABSOLUTELY NO WRITING OF ANY KIND: no words, no letters, no headlines, no printed lines of type,',
    'no handwriting, no numbers. The surface is blank, weathered paper.',
    PLATE_STYLE,
    'NOT digital illustration, NOT cartoon, NOT 3D render, NOT glossy, no gradients, no watermark, no logos.',
    'Premium documentary collage aesthetic, vertical 9:16, ultra-detailed, 8K.',
  ].join(' ');
}

/**
 * PARÇA PROMT'LARI — sahnenin tek tek girecek öğeleri.
 *
 * Birinci parça HERO ve cümlenin somut nesnesinden gelir; gerisi beat türünün
 * reçetesinden. En fazla dört parça: referans kolajlarda ölçülen yoğunluk
 * hero + 2-3 destek.
 */
/**
 * KODUN ZATEN ÇİZDİĞİ DESTEKLER MODELDEN İSTENMEZ.
 *
 * Reçetelerin destek listeleri bu deponun tutturucuları yazılmadan önce
 * kurulmuştu ve hâlâ bant, damga, ip, iğne, altı çizme, ataç istiyordu —
 * beşini de `paper/Fixings.tsx` ve `paper/Marks.tsx` çiziyor, hem daha temiz
 * hem deterministik hem bedava.
 *
 * İkinci canlı çalıştırma bunun sadece israf değil ZARARLI olduğunu gösterdi:
 * başarısız olan parçalar tam olarak bunlardı ("a coffee ring stain",
 * "a torn calendar page"), çünkü model soyut bir kağıt tarifini SAHNE olarak
 * yorumluyor. Temiz çıkan tek parça somut bir nesneydi (portre).
 *
 * Kural: modelden yalnızca FOTOĞRAFLANABİLİR bir nesne istenir.
 */
/**
 * FOTOĞRAFLANAMAYAN ÖZNELER.
 *
 * `subjectFor` cümledeki İLK somut ismi seçiyor ve "On the night of 24 November
 * 1971" cümlesinde o isim "night" oluyor → "a night sky or star chart study".
 * 4. turda çıkan görsel yıldızlı bir ovalin içinde alakasız bir kadın portresi
 * oldu; beat'in anlattığı şeyle hiçbir ilgisi yok.
 *
 * Zaman sözcükleri bir ANI adlandırır, bir NESNEYİ değil. Onlar hero olamaz;
 * o beat'te reçetenin hero'su devreye girmeli — cold_open için "a torn calendar
 * page", ki cümlenin taşıdığı bilgi (tarih) tam olarak orada duruyor.
 */
const NOT_PHOTOGRAPHABLE = /^(a |an |the )?(night|morning|evening|afternoon|day|year|hour|minute|moment|time|week|month)\b/i;

/** Hero olarak kullanılabilir mi? Yoksa reçeteye düşülür. */
/** Öznenin bir kişi olup olmadığı — sansür barı kararı buna bağlı. */
const PERSON_RE = /\b(a man|a woman|a person|figure|portrait|attendant|boy|girl|passenger|crew)\b/i;

function usableHero(subject) {
  return subject && !NOT_PHOTOGRAPHABLE.test(subject) ? subject : null;
}

const CODE_DRAWS = /stamp|tape|string|\bpin\b|brass pin|underline|marker|paper clip|clipped|coffee ring|rule line|wax seal|fingerprint/i;

/**
 * DÖNEM ÇIPASI — anlatının yılından türer.
 *
 * ÖLÇÜLDÜ: dönem söylenmeyince model BUGÜNÜ çiziyor. Üçüncü turun alfa
 * sayfasında 1971 D.B. Cooper anlatısı için gelen iki "adam" da tişörtlü,
 * modern saç kesimli, 2020'ler stüdyo portresiydi. Teknik olarak kusursuz
 * kesilmişlerdi ve tamamen kullanılamazdılar.
 *
 * Yıl anlatıda zaten var (cold_open "24 November 1971" diyor); `firstDate`
 * onu çıkarıyor. Yoksa çıpa atlanır — uydurma bir dönem dayatmak, uydurma
 * nesne çizmekle aynı sınıf hata olurdu.
 */
function eraClause(era) {
  if (!era) return '';
  return (
    `Period-accurate for ${era}: clothing, hairstyle, equipment and printing style all from that era. ` +
    'Absolutely nothing modern in the frame.'
  );
}

/**
 * @param {{text: string, kind: string}} beat
 * @param {{era?: string}} [opts] — `era` anlatının yılı, örn. "1971".
 */
export function piecePrompts(beat, opts = {}) {
  const text = String(beat.text || '').replace(/[*"]/g, '').trim();
  const recipe = RECIPES[beat.kind] ?? FALLBACK;
  const concrete = subjectFor(text);

  const subjects = [usableHero(concrete) ?? recipe.hero, ...recipe.support.filter((x) => !CODE_DRAWS.test(x))].slice(0, 3);

  return subjects.map((subject, i) => ({
    slot: String.fromCharCode(97 + i), // a, b, c, d
    role: i === 0 ? 'hero' : 'support',
    /**
     * ÖZNE EN BAŞTA. Önceki sürüm "A single hand-cut paper collage element:
     * a man" diye başlıyordu ve ölçülen çıktı ADAM DEĞİL, yırtık kağıttı —
     * baştaki uzun tanım özneyi eziyordu. Artık cümle özneyle açılıyor,
     * MALZEME ve DÖNEM ondan sonra geliyor.
     */
    prompt: [
      /**
       * "cut out and isolated" KALDIRILDI. Modele kesilmiş bir öğe istediğimizi
       * söylemek, onun çizdiği şeyi kesilmiş öğeye çevirmedi — 5. turda ÇERÇEVE
       * İÇİNDE monte edilmiş bir baskı çizdi, yani "kesilmiş öğe" tarifini
       * sahne olarak resmetti. Kesme işi artık `pipeline/segment.py`de.
       */
      `${subject.charAt(0).toUpperCase()}${subject.slice(1)}.`,
      /**
       * SANSÜR BARI — engine yasası: gerçek bir kişi ima ediliyorsa gözlerin
       * üstüne siyah bar.
       *
       * DİKKAT: 5. turda bu cümle promtta VARDI ve model uygulamadı (portrede
       * bar yok). Yani bu satır bir GARANTİ değil, yalnızca bir talep; kişinin
       * teşhis edilebilirliğine karşı asıl koruma kaynak seçiminde ve
       * `PERSON_RE`nin gerçek kişi adı vermemesinde.
       */
      PERSON_RE.test(subject) ? 'A black censor bar across the eyes.' : '',
      eraClause(opts.era),
      pieceMaterial(opts.era),
      PIECE_BACKGROUND,
      'Vertical 9:16.',
    ]
      .filter(Boolean)
      .join(' '),
  }));
}

/**
 * Anlatının yılı — `piecePrompts`'a dönem çıpası olarak verilir.
 *
 * GİRDİ STORYBOARD'UN KENDİSİ, `story.json` DEĞİL. Sebep ölçüldü: workflow
 * `build-storyboard.mjs content/story-db-cooper.json` çalıştırıyor ama
 * `build-flow-pack` `content/story.json`'u sabit okuyordu — yani render edilen
 * konu Cooper'ken dönem başka bir hikâyeden (pusula/okyanus) geliyordu.
 * Storyboard hangi konu render ediliyorsa ONUN beat'lerini taşıyor, dolayısıyla
 * tek doğru kaynak o.
 *
 * Yıl bulunamazsa null döner ve çıpa atlanır: uydurma bir dönem dayatmak,
 * uydurma nesne çizmekle aynı sınıf hata olurdu.
 */
export function eraOf(storyboard) {
  const text = (storyboard?.scenes ?? []).map((s) => s?._beat?.text ?? '').join(' ');
  const y = text.match(/\b(1[0-9]{3}|20[0-9]{2})\b/);
  return y ? y[1] : null;
}
