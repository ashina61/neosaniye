/**
 * KOREOGRAFİ PRİMİTİFLERİ
 *
 * NEDEN AYRI BİR DOSYA
 *
 * İlk sürümde hareket dili üç fonksiyondan ibaretti: stepped/enter/drift. Bu
 * referans videonun ÖLÇÜLEN modeliydi ve doğruydu, ama eksikti: sahne başına
 * yalnızca iki olay üretiyordu (bir giriş, bir sürüklenme). Ölçüm bunu açıkça
 * gösterdi — bizim videoda olay aralığı 0.98 sn, referansta 0.66 sn.
 *
 * O açığı parametre kurcalayarak kapatmayı iki kez denedim ve ikisinde de
 * ÖLÇÜM beni yanlış çıkardı: giriş sürelerini sıkıştırmak tempoyu 0.98'den
 * 1.31'e YAVAŞLATTI (öğeler üst üste binince fark haritası tek olay sayıyor).
 * Sonuç net: eksik olan hız değil, SAHNE BAŞINA OLAY SAYISI.
 *
 * Bu dosya olay sayısını artıran adlandırılmış teknikleri primitif hâline
 * getirir. Hepsi:
 *   · deterministik (Math.random yasak — testte kontrol ediliyor)
 *   · saf fonksiyon (React'e bağımlı değil, birim testi yazılabilir)
 *   · "adımlı mı yumuşak mı" ayrımına uyar: ANİMASYON adımlı (stop-motion),
 *     KAMERA/sürüklenme yumuşak. Bu ayrım stepped.ts'te ölçülerek konuldu.
 */

import {CANVAS} from '../design/tokens';
import {stepped, rand} from '../motion/stepped';

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Yumuşak giriş-çıkış; 0..1 → 0..1. */
const smooth = (t: number): number => {
  const x = clamp01(t);
  return 0.5 - 0.5 * Math.cos(Math.PI * x);
};

/* ------------------------------------------------------------------ */
/* CUE — girişleri SAHNE SÜRESİNE yay                                  */
/* ------------------------------------------------------------------ */
/**
 * ÖLÇÜLMÜŞ KUSUR
 *
 * Şablonların hepsi giriş zamanlarını SABİT saniyeyle yazıyordu: `at: 0.15`,
 * `at: 0.7`, `at: 1.2`… Sahne 1.6 saniye de olsa 4 saniye de olsa aynı. Sonuç,
 * 12 saniyelik dilimde kare-kare ölçüldü:
 *
 *   map_route (2.8 sn): tüm hareket 0.55 saniyede bitiyor, ardından ARDIŞIK
 *   DOKUZ örnekleme aralığında değişim %0.00. Videonun donmuş aralıklarının
 *   neredeyse yarısı tek bir sahneden geliyordu.
 *
 * Sebep basit: uzun sahnenin kuyruğu boş kalıyor çünkü giriş takvimi sahnenin
 * ne kadar sürdüğünü bilmiyor.
 *
 * cue() bunu düzeltir: n girişi sahnenin %12'sinden %86'sına yayar. Kısa
 * sahnede sıkışır, uzun sahnede açılır — ölü kuyruk kalmaz.
 *
 * NOT — DAHA ÖNCE YANLIŞ YAPILAN ŞEY: bu, girişleri SIKIŞTIRMAK değil. Onu bir
 * kez denedim ve ölçüm tempoyu 0.98'den 1.31 saniyeye YAVAŞLATTIĞINI gösterdi:
 * üst üste binen girişler fark haritasında tek olay sayılıyor. Buradaki hareket
 * ters yönde — girişleri AYIRMAK ve sahnenin sonuna kadar dağıtmak.
 */
export function cue(seconds: number, i: number, n: number): number {
  const first = 0.12;
  const last = Math.max(first + 0.3, seconds * 0.86 - 0.2);
  if (n <= 1) return first;
  const k = Math.max(0, Math.min(n - 1, i));
  return Math.round((first + ((last - first) * k) / (n - 1)) * 100) / 100;
}

/* ------------------------------------------------------------------ */
/* PARALLAX — derinliğe göre ölçeklenmiş sürüklenme                    */
/* ------------------------------------------------------------------ */
/**
 * Rehberin verdiği sayı: arka plan katmanı ön katmanın 0.6 katı hızla kayar.
 *
 * drift()'ten farkı: drift tek katmanın kendi Ken Burns'ü, parallax ise AYNI
 * hareketin katmanlar arasında derinliğe göre bölünmesi. İkisi bir arada
 * kullanılmaz; bir sahnede ya bir katman kendi başına sürüklenir ya da iki-üç
 * katman aynı yönde farklı hızlarda kayar.
 *
 * DİKKAT: bu, kamera hareketi DEĞİL. Kompozisyon kilidi ölçümü kareyi bütün
 * olarak kaydıran bir hareketi yakalar ve haklı olarak "kaydı" der. Burada
 * kayan şey katmanlar; zemin, metin ve işaretler çakılı kalır.
 */
export const PARALLAX_DEPTH_FACTOR = 0.6;

export interface ParallaxSpec {
  seconds: number;
  /** Toplam kayma (ön katman için), px. */
  dx?: number;
  dy?: number;
  /** 0 = en ön (tam hız), 1 = bir kademe arka, 2 = iki kademe arka. */
  depth?: number;
}

export function parallax(frame: number, spec: ParallaxSpec): string {
  const {seconds, dx = 0, dy = 0, depth = 0} = spec;
  const k = Math.pow(PARALLAX_DEPTH_FACTOR, Math.max(0, depth));
  const e = smooth(frame / Math.max(seconds * CANVAS.fps, 1));
  return `translate(${(dx * k * e).toFixed(2)}px, ${(dy * k * e).toFixed(2)}px)`;
}

/* ------------------------------------------------------------------ */
/* ZOOM-THROUGH-FRAME — çerçevenin içinden geçen yaklaşma               */
/* ------------------------------------------------------------------ */
/**
 * Rehberdeki teknik: bir kolaj öğesi (pencere, kapı, fotoğraf çerçevesi)
 * büyütülerek kareyi doldurur, izleyici "içinden geçmiş" olur.
 *
 * Burada iki değer döner: büyüyen katmanın ölçeği ve içeriğin açılma payı.
 * Sahne bunu KESMEDEN ÖNCEKİ son yarım saniyeye koyar; böylece sert kesme
 * (referansta 16 kesmenin hepsi sert) hareketin doruğunda gelir. Bedava bir
 * olay: yeni öğe eklemeden sahne başına bir olay daha.
 */
export interface ZoomThroughSpec {
  seconds: number;
  /** Hareketin başladığı saniye. Varsayılan: sahnenin son 0.6 saniyesi. */
  at?: number;
  duration?: number;
  /** Bitişteki ölçek. 1.6 = %60 büyüme. */
  to?: number;
}

export function zoomThrough(frame: number, spec: ZoomThroughSpec): {scale: number; opacity: number} {
  const {seconds, duration = 0.6, to = 1.55} = spec;
  const at = spec.at ?? Math.max(0, seconds - duration);
  // Yaklaşma ANİMASYONDUR, kamera değil: adımlı okunur.
  const s = stepped(frame) / CANVAS.fps;
  const t = clamp01((s - at) / Math.max(duration, 1 / CANVAS.fps));
  const e = t * t; // hızlanan: gerçek bir yaklaşmada son kareler en hızlıdır
  return {scale: 1 + (to - 1) * e, opacity: 1 - 0.15 * e};
}

/* ------------------------------------------------------------------ */
/* FOCUS-HUNT — odak arayan lens                                       */
/* ------------------------------------------------------------------ */
/**
 * Rehberdeki teknik: kare bulanık açılır, lens odağı "arar" ve netlenir.
 * Arşiv görüntüsünü film kamerasıyla çekilmiş gibi gösteren en ucuz hile.
 *
 * NEDEN OLAY SAYAR: netlenme, fark haritasında girişten AYRI bir olaydır.
 * Öğe zaten yerine oturmuşken bile kare değişmeye devam eder — tempo ölçümünde
 * ölü zamanı dolduran şey tam olarak bu.
 *
 * Odak ADIMLIDIR: gerçek odak çekme sürekli olur ama biz stop-motion dilinde
 * konuşuyoruz; sürekli bulanıklık rampası "dijital" durur.
 */
export interface FocusHuntSpec {
  /** Netlenmenin tamamlandığı saniye. */
  at?: number;
  duration?: number;
  /** Başlangıç bulanıklığı, px. */
  from?: number;
  /** Odağın "arama" salınımı: netlenmeden önce bir kez hafif geçer. */
  hunt?: boolean;
}

export function focusHunt(frame: number, spec: FocusHuntSpec = {}): number {
  const {at = 0.35, duration = 0.55, from = 9, hunt = true} = spec;
  const s = stepped(frame) / CANVAS.fps;
  const t = clamp01((s - at) / Math.max(duration, 1 / CANVAS.fps));
  if (t >= 1) return 0;
  // Tek salınımlı düşüş: 0.72 civarında bir kez net olur, hafif geri kaçar,
  // sonra oturur. Salınım yoksa düz rampa.
  const overshoot = hunt ? Math.max(0, Math.sin(t * Math.PI * 1.35) * 0.18) : 0;
  const px = from * (Math.pow(1 - t, 1.9) + overshoot * (1 - t));
  return Math.max(0, Math.round(px * 10) / 10);
}

/** focusHunt çıktısını doğrudan style.filter'a verilebilir dizeye çevirir. */
export function focusFilter(px: number): string | undefined {
  return px > 0.05 ? `blur(${px.toFixed(1)}px)` : undefined;
}

/* ------------------------------------------------------------------ */
/* PEEL — sahte 3B kalkma                                              */
/* ------------------------------------------------------------------ */
/**
 * Rehberdeki teknik: düz bir kağıt öğesi perspektifte hafifçe döndürülerek
 * kalkıyormuş gibi gösterilir. Gerçek 3B yok; tek bir rotateY + perspective.
 *
 * Genlik kasıtlı olarak küçük (varsayılan 9°): büyük açılar kolajı "PowerPoint
 * geçişi"ne çevirir. Amaç öğeye kalınlık hissi vermek, çevirmek değil.
 */
export interface PeelSpec {
  seconds: number;
  at?: number;
  duration?: number;
  /** Bitişteki açı, derece. */
  deg?: number;
  /** Perspektif mesafesi, px. Küçük = güçlü perspektif. */
  perspective?: number;
  /** Hangi kenardan kalkıyor. */
  edge?: 'left' | 'right' | 'top' | 'bottom';
}

export function peel(frame: number, spec: PeelSpec): {transform: string; origin: string} {
  const {at = 0.2, duration = 0.7, deg = 9, perspective = 1400, edge = 'left'} = spec;
  const s = stepped(frame) / CANVAS.fps;
  const t = clamp01((s - at) / Math.max(duration, 1 / CANVAS.fps));
  // Kalkıp yerine oturur: girişte açı büyük, sonunda küçük ama sıfır değil —
  // sıfır olursa öğe düz kağıda döner ve teknik boşa gider.
  const a = deg * (1 - smooth(t) * 0.72);
  const axis = edge === 'left' || edge === 'right' ? 'rotateY' : 'rotateX';
  const sign = edge === 'right' || edge === 'bottom' ? -1 : 1;
  const origin =
    edge === 'left' ? 'left center' : edge === 'right' ? 'right center' : edge === 'top' ? 'center top' : 'center bottom';
  return {
    transform: `perspective(${perspective}px) ${axis}(${(a * sign).toFixed(2)}deg)`,
    origin,
  };
}

/* ------------------------------------------------------------------ */
/* HOLD-KEYFRAME TİTREMESİ                                             */
/* ------------------------------------------------------------------ */
/**
 * Elle çizilmiş stop-motion'da animatör aynı çizimi iki kare tutar ama çizim
 * BİREBİR aynı olmaz — kağıt bir piksel kayar, çizgi kalınlığı oynar. O küçük
 * kararsızlık "canlı" hissini veren şeydir; matematiksel olarak sabit tutulan
 * bir katman ölü durur.
 *
 * Genlik ÇOK küçük tutuluyor (birkaç piksel, yarım derece): kompozisyon kilidi
 * ölçümü tol=6 ile çalışıyor ve bu titremenin onu düşürmemesi gerekiyor.
 * Katman içi titreme, kare geneli kayma değildir — kamera testi bunu görmez.
 */
export function holdJitter(frame: number, seed = 0): string {
  const step = Math.floor(frame / (CANVAS.fps / CANVAS.posterizeFps));
  const jx = (rand(seed * 7.3 + step) - 0.5) * 2.2;
  const jy = (rand(seed * 11.7 + step * 1.3) - 0.5) * 2.2;
  const jr = (rand(seed * 3.1 + step * 2.7) - 0.5) * 0.5;
  return `translate(${jx.toFixed(2)}px, ${jy.toFixed(2)}px) rotate(${jr.toFixed(3)}deg)`;
}

/**
 * Birden çok transform parçasını tek dizede birleştirir. undefined/boş
 * parçaları atar — şablonlarda `[a, b].filter(Boolean).join(' ')` tekrarını
 * ortadan kaldırmak için.
 */
export function compose(...parts: Array<string | undefined | false>): string | undefined {
  const out = parts.filter((p): p is string => Boolean(p) && p !== 'none');
  return out.length ? out.join(' ') : undefined;
}
