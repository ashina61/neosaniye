/**
 * TASARIM TOKEN'LARI
 *
 * Buradaki renkler tahmin değil: referans videonun (Wayfinder) 17 çekiminden
 * alınan tüm pikseller 5 bit/kanala indirgenip sayıldı, baskın kovalar alındı.
 * Ölçüm ve oranlar yorumda duruyor ki biri "bu rengi neden seçtin" diye
 * sorduğunda cevap "ölçtüm" olsun.
 */

export const CANVAS = {
  width: 1080,
  height: 1920,
  fps: 30,
  /** Hareketin oturduğu adım. 30/12 = 2.5 kare tutma → stop-motion hissi. */
  posterizeFps: 12,
} as const;

export const PALETTE = {
  /** Krem zemin. Ölçüm: tüm piksellerin %19.6'sı, tek başına en baskın renk. */
  ground: '#E4E4D8',
  /** Sıcak krem varyantı (yaşlanmış kağıt). Ölçüm: %5.0 */
  groundWarm: '#E4D8CC',
  /** Kart/şerit kağıdı, zeminden bir ton açık. */
  paper: '#F0EDE2',
  /** Mat teal deniz/su bandı. Ölçüm: %4.3 + %1.9 iki komşu kova. */
  sea: '#9CC0C0',
  /** Koyu lacivert zemin (gece/yıldız sahneleri). Ölçüm: %2.9 */
  ink: '#182430',
  /** En koyu, neredeyse siyah lacivert. Ölçüm: %3.3 */
  night: '#0C0C18',
  /**
   * TEK aksan. Ölçüm: doygunluğu >0.45 olan piksellerin baskın kovası #D2A03C,
   * ve bu piksellerin TAMAMI karenin yalnızca %3.6'sı. Yani aksan cimri
   * kullanılıyor. ACCENT_MAX_SHARE bu disiplini kural hâline getirir.
   */
  accent: '#D2A03C',
  /** Aksanın soluk hâli (highlight barı, gölge). */
  accentSoft: '#E8C77A',
  /**
   * KIRMIZI SİNYAL — ikinci aksan, ÇOK cimri.
   *
   * NEDEN İKİNCİ BİR AKSAN VAR: bu deponun kuralı "tek aksan" idi ve o kural
   * ölçümden geliyordu. Ama ölçüm bir Vox videosundan yapılmıştı; NeoSaniye'nin
   * hedef dili arşiv-kolaj ve kullanıcının doğrulanmış prompt bloğu baştan beri
   * "ONE hot red signal accent and a restrained mustard yellow secondary"
   * diyordu. İki referans malzemesi de bunu doğruladı: kırmızı ip, kırmızı
   * mühür, hardal bant.
   *
   * BÖLÜŞÜM NET, yoksa iki aksan birbirini yer:
   *   · `accent` (hardal/altın) = MALZEME. Bant, etiket kartı, damga, zaman
   *     çizelgesi noktası. Karede yüzde birkaç yer kaplar.
   *   · `signal` (kırmızı) = İŞARET. İp, marker dairesi, çarpı, altı çizme.
   *     Yalnızca "buraya bak" diyen şey. Referans videoda TEK kırmızı öğe ip.
   *
   * Kırmızıyı malzemeye vermek (bant kırmızı, etiket kırmızı) dili bozar:
   * her şey bağırınca hiçbir şey bağırmıyor demektir.
   */
  signal: '#C0392B',
  /** Halftone fotoğrafların mürekkebi. */
  inkBlack: '#111111',
} as const;

/**
 * Aksan disiplini: altın, karenin bu orandan fazlasını kaplamamalı.
 * Ölçülen referans değeri %3.6; tavanı %8'e koyup nefes payı bırakıyoruz.
 * QC bunu ölçer, çünkü "her yere altın sür" amatörlüğün birinci belirtisi.
 */
export const ACCENT_MAX_SHARE = 0.08;

export const FONTS = {
  /** Başlıklar, etiketler, damgalar. Condensed olması bu stilin belkemiği. */
  display: '"Roboto Condensed", "Liberation Sans Narrow", sans-serif',
  /** Alıntılar. İtalik serif, editoryal ses. */
  quote: '"EB Garamond", "Liberation Serif", Georgia, serif',
} as const;

/**
 * 1080 genişlik için tip ölçeği. Shorts'ta metin telefonda okunacak, o yüzden
 * masaüstü ölçeklerinden belirgin şekilde büyük.
 */
export const TYPE = {
  hook: 132,
  headline: 104,
  subhead: 68,
  quote: 62,
  label: 36,
  stamp: 30,
  caption: 44,
} as const;

export const SPACE = {
  xs: 12,
  sm: 24,
  md: 48,
  lg: 88,
  xl: 140,
} as const;

/**
 * GÜVENLİ ALAN — Shorts arayüzü karenin kenarlarını yiyor: altta başlık ve
 * açıklama, sağda beğen/yorum/paylaş kolonu, üstte durum çubuğu. Anlam taşıyan
 * hiçbir şey bu kutunun dışına çıkmamalı.
 */
export const SAFE = {
  top: 150,
  bottom: 330,
  left: 70,
  right: 150,
} as const;

export const SAFE_BOX = {
  x: SAFE.left,
  y: SAFE.top,
  width: CANVAS.width - SAFE.left - SAFE.right,
  height: CANVAS.height - SAFE.top - SAFE.bottom,
} as const;

/**
 * 9:16 KOMPOZİSYON YASASI
 *
 * Referans PDF'in kompozisyon yasası 16:9 için yazılmış ("tek hero %70 görsel
 * ağırlık, yanında 2-3 destek"). Yatayda destekler hero'nun YANINA girer;
 * dikeyde yan yoktur. Dikeyde katmanlar ÜST ÜSTE dizilir:
 *
 *   üst şerit    → başlık / kicker           (yüksekliğin ~%18'i)
 *   orta blok    → hero                      (~%52)
 *   alt şerit    → etiket / caption / alıntı  (~%30)
 *
 * Bu yüzden şablonlar hero'yu tam ortaya değil, optik merkeze (biraz yukarı)
 * oturtur; altta metin için yer kalsın.
 */
export const VERTICAL_BANDS = {
  top: {y: SAFE.top, height: Math.round(SAFE_BOX.height * 0.18)},
  hero: {y: SAFE.top + Math.round(SAFE_BOX.height * 0.18), height: Math.round(SAFE_BOX.height * 0.52)},
  bottom: {y: SAFE.top + Math.round(SAFE_BOX.height * 0.70), height: Math.round(SAFE_BOX.height * 0.30)},
} as const;
