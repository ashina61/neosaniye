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

const STYLE_BLOCK = [
  'hand-cut documentary paper collage on aged newsprint and archival map surfaces,',
  'black and white halftone photograph cutouts with rough scissor-cut edges and offset accent strokes,',
  'torn paper edges, masking tape fragments, typewriter caption strips, rubber stamp marks,',
  'red string and brass pins where the story calls for connections,',
  'desaturated archival palette of tan, ink black and halftone gray with ONE hot red signal accent',
  'and a restrained mustard yellow secondary, condensed bold headline lettering only where a label is specified,',
  'visible print grain and paper fiber, matte, flat even documentary lighting with soft cutout drop shadows.',
].join(' ');

/**
 * Kapanış bloğu. Referans PDF'te `16:9` yazıyor; biz Shorts kanalıyız, 9:16
 * bağlayıcı — kullanıcı bunu açıkça onayladı.
 */
const CLOSER = [
  'Every element must appear physically hand-cut and layered from real paper, with visible cutout edges,',
  'halftone print texture, and soft shadow separation between layers.',
  'NOT digital illustration, NOT cartoon, NOT 3D render, NOT glossy, no gradients, no watermark, no logos.',
  'Premium documentary collage aesthetic, vertical 9:16, ultra-detailed, 8K.',
].join(' ');

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

export function composedCollagePrompt(beat, story = {}) {
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

  const textClause = labels.length
    ? `Text in the image is limited to: ${labels.slice(0, 2).join(' and ')}. ` +
      'Set it in condensed bold type on a paper strip, a stamp, or as a large numeral. ' +
      'No other words, no sentences, no paragraphs.'
    : 'No text anywhere in the image.';

  const hero = concrete
    ? `A halftone paper cutout of ${concrete}, pinned to the archival ground as the dominant element`
    : recipe.hero;

  return [
    FRAME_PREFIX,
    `${hero.charAt(0).toUpperCase()}${hero.slice(1)}.`,
    recipe.heroText === 'no text' ? '' : `On the hero element: ${recipe.heroText}.`,
    `Supporting elements, no more than three: ${recipe.support.join('; ')}.`,
    `The subject matter is drawn from this documentary line: "${text}".`,
    textClause,
    STYLE_BLOCK,
    CLOSER,
  ]
    .filter(Boolean)
    .join(' ');
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
