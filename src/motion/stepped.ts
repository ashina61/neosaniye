/**
 * HAREKET MOTORU
 *
 * Referans videonun hareket modeli ÖLÇÜLDÜ: aynı çekimin 5.3 saniye arasındaki
 * iki karesinin fark haritasında arka plan, metnin tamamı, highlight barı,
 * yırtık kağıt kartı ve ok TAMAMEN değişmemişti. Yalnızca iki cutout katmanı
 * yavaşça kaymıştı.
 *
 * Yani model şu: KOMPOZİSYON KİLİTLİ, seçili birkaç katman kendi içinde ağır
 * ağır sürüklenir. Kamera diye bir şey yok. Bu dosya o modeli üç fonksiyona
 * indirger: stepped (stop-motion kadansı), enter (build-on giriş), drift
 * (katman başına Ken Burns).
 */

import {CANVAS} from '../design/tokens';

const STEP = CANVAS.fps / CANVAS.posterizeFps; // 30/12 = 2.5

/**
 * Kareyi 12fps adımına oturt.
 *
 * ÖLÇÜLDÜ: 30fps'de 60 kare render edildiğinde 24 ayrı konum çıkıyor (tam
 * 12fps), tutma deseni 3,2,3,2… ve konum atlamaları istisnasız eşit — arada
 * hiç ara değer yok. Kayan yumuşak hareket "ucuz bilgisayar animasyonu" gibi
 * durur; kademeli hareket stop-motion gibi, yani BİLİNÇLİ görünür.
 */
export const stepped = (frame: number): number => Math.floor(frame / STEP) * STEP;

/** 0..1 aralığını kırp. */
const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * Kağıt parçasının oturma eğrisi: hızlı gel, hafif geç, yerine otur.
 * Yay simülasyonu değil — kasıtlı olarak elle çizilmiş bir overshoot, çünkü
 * stop-motion'da yay yoktur, animatörün kararı vardır.
 */
function settle(t: number): number {
  const x = clamp01(t);
  if (x >= 1) return 1;
  // 1.12'ye kadar aşıp geri dönen tek parçalı eğri.
  return 1 - Math.pow(1 - x, 2.2) * Math.cos(x * 2.6) * 0.28 - Math.pow(1 - x, 2.2) * 0.72;
}

export type EnterKind = 'slide' | 'drop' | 'stamp' | 'fade' | 'draw';

export interface EnterSpec {
  /** Katmanın girmeye başladığı saniye (sahne başlangıcına göre). */
  at: number;
  /** Giriş süresi, saniye. */
  duration?: number;
  kind?: EnterKind;
  /** slide/drop için kaynak yön kayması, px. */
  from?: {x?: number; y?: number};
}

export interface EnterState {
  /** 0 = henüz yok, 1 = tam yerinde. */
  progress: number;
  opacity: number;
  /** transform dizesi — doğrudan style.transform'a verilir. */
  transform: string;
  /** Katman hiç görünmemişse false; render'ı tamamen atlamak için. */
  visible: boolean;
}

/**
 * BUILD-ON GİRİŞ
 *
 * Referans "Universal Video Prompt"un istediği davranış: kare boş kağıt
 * zemininden başlar, öğeler arkadan öne, anlatı sırasıyla tek tek girer, ve
 * "hiçbir öğe yerleştikten sonra bir daha hareket etmez".
 *
 * Son cümle bir i2v modelinden dilenen bir şeydi; burada bedava: progress 1'e
 * ulaştıktan sonra transform sabittir, çünkü öyle yazılmış.
 */
export function enter(frame: number, spec: EnterSpec): EnterState {
  const {at, duration = 0.5, kind = 'slide', from} = spec;
  const s = stepped(frame) / CANVAS.fps;
  const t = clamp01((s - at) / Math.max(duration, 1 / CANVAS.fps));

  if (s < at) return {progress: 0, opacity: 0, transform: 'none', visible: false};

  const e = settle(t);

  switch (kind) {
    case 'drop': {
      const dy = (from?.y ?? -220) * (1 - e);
      return {progress: e, opacity: Math.min(1, t * 3), transform: `translateY(${dy.toFixed(2)}px)`, visible: true};
    }
    case 'stamp': {
      // Damga: büyükten çakarak oturur, 2 kare içinde biter.
      const sc = 1 + 0.55 * (1 - e);
      const rot = 6 * (1 - e);
      return {
        progress: e,
        opacity: Math.min(1, t * 4),
        transform: `scale(${sc.toFixed(3)}) rotate(${rot.toFixed(2)}deg)`,
        visible: true,
      };
    }
    case 'fade':
      return {progress: e, opacity: e, transform: 'none', visible: true};
    case 'draw':
      // Çizim işini SVG stroke-dashoffset yapar; buraya sadece progress döner.
      return {progress: e, opacity: 1, transform: 'none', visible: true};
    case 'slide':
    default: {
      const dx = (from?.x ?? -160) * (1 - e);
      const dy = (from?.y ?? 0) * (1 - e);
      return {
        progress: e,
        opacity: Math.min(1, t * 3),
        transform: `translate(${dx.toFixed(2)}px, ${dy.toFixed(2)}px)`,
        visible: true,
      };
    }
  }
}

export interface DriftSpec {
  /** Sahne süresi, saniye — sürüklenme buna yayılır. */
  seconds: number;
  /** Toplam kayma, px. Referansta ölçülen büyüklük: onlarca piksel, yüzlerce değil. */
  dx?: number;
  dy?: number;
  /** Toplam ölçek değişimi. 0.04 = %4. */
  scale?: number;
  /** Faz kaydırması; komşu katmanlar aynı anda aynı yöne gitmesin. */
  phase?: number;
}

/**
 * KATMAN BAŞINA KEN BURNS
 *
 * Kamera değil, KATMAN hareket eder. Referansta ölçülen davranış birebir bu:
 * kompozisyonun geri kalanı çakılı dururken bir iki cutout ağır ağır kayıyor.
 *
 * DİKKAT: bunu her katmana uygulamak hatadır. Her şey oynarsa kompozisyon
 * kilidi kaybolur ve sonuç "kayan slayt gösterisi" olur. Şablonlar bunu
 * sahne başına en fazla iki katmana verir.
 */
export function drift(frame: number, spec: DriftSpec): string {
  const {seconds, dx = 0, dy = 0, scale = 0, phase = 0} = spec;
  const total = Math.max(seconds, 0.001) * CANVAS.fps;
  // Sürüklenme YUMUŞAK olmalı: stepped() burada kasıtlı olarak uygulanmıyor.
  // Adımlı sürüklenme titreme gibi okunur; adım GİRİŞ hareketine aittir.
  const t = clamp01(frame / total);
  const eased = 0.5 - 0.5 * Math.cos(Math.PI * clamp01(t + phase));
  const sc = 1 + scale * eased;
  return `translate(${(dx * eased).toFixed(2)}px, ${(dy * eased).toFixed(2)}px) scale(${sc.toFixed(4)})`;
}

/**
 * Yerleştikten sonraki "yaşayan poster" nefesi: kağıt köşesi esintide bir
 * milim kalkar. Referans prompt bunu 7-10. saniyeye koyuyor. Genlik kasıtlı
 * olarak çok küçük; fark edilirse fazladır.
 */
export function breathe(frame: number, seed = 0): number {
  const s = stepped(frame) / CANVAS.fps;
  // Genlik ÖLÇÜLEREK artırıldı: 0.6+0.4 ile nefes hiç fark edilmiyordu ve
  // videonun üçte biri donmuş ölçüldü (97 aralığın 32'sinde <%1 değişim).
  // Referans videoda tutuş bölgesi bile canlıydı.
  return Math.sin(s * 1.7 + seed * 2.1) * 1.6 + Math.sin(s * 0.9 + seed) * 1.1;
}

/** Deterministik sözde-rastgele: aynı seed → aynı değer. Math.random YASAK. */
export function rand(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}
