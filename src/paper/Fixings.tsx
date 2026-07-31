import React, {useId} from 'react';
import {PALETTE, CANVAS} from '../design/tokens';
import {rand} from '../motion/stepped';

/**
 * TUTTURUCULAR — bant, iğne, ip, köşe kalkması.
 *
 * NEDEN AYRI BİR DOSYA
 *
 * `Marks.tsx` İŞARET çiziyor: ok, daire, çarpı. Onlar anlatının "buraya bak"
 * dediği şeyler ve hepsi `progress` ile kendini çizen SVG yolları.
 *
 * Buradakiler farklı bir sınıf: bunlar FİZİKSEL TUTTURUCU. Kolajın parçalarını
 * kağıda bağlayan şeyler — bant, iğne, ip — ve kağıdın kendi davranışı (köşenin
 * kalkması). İşaret değiller; sahnede bir şey SÖYLEMİYORLAR, bir şeyi TUTUYORLAR.
 *
 * Ayrımın pratik sonucu var: işaretler aksan renginde ve cimri kullanılır,
 * tutturucular ise malzeme rengindedir ve serbestçe tekrarlanır.
 *
 * ================== REFERANSTAN ÖLÇÜLDÜ ==================
 *
 * Kullanıcının doğrulanmış hareket referansında (Constantinople kolajı, 10 sn,
 * 24 fps) sıra kare kare şuydu:
 *   0.5s  yırtık tan kağıt düşer
 *   1.5s  halftone fotoğraf oturur
 *   2.0s  etiket kayar
 *   3.5s  BANT şeritleri üst köşelere bastırılır
 *   4.5s  hardal bant işareti
 *   5.0s  KIRMIZI İP kendini çizer, ucunda İĞNE
 *   5.5s  damgalar
 *   7.5s+ fotoğrafın KÖŞELERİ KALKAR — "yaşayan poster" fazı
 *
 * Son maddeye kadar hepsi bende vardı. Köşe kalkması yoktu ve tutuş fazını
 * ölü bırakan şey oydu: referansta son 2.5 saniyede tek olay o.
 */

/* ------------------------------------------------------------------ */
/* BANT — maskeleme bandı şeridi                                       */
/* ------------------------------------------------------------------ */
/**
 * Yarı saydam, hafif sarımsı, kenarları DÜZENSİZ yırtık bir şerit.
 *
 * Düz dikdörtgen çizmek yanlış olurdu: maskeleme bandı elle koparılır ve
 * kopma çizgisi testere dişlidir. Bu depoda aynı hata `TornCard`'da bir kez
 * yapıldı ve düzeltildi — kesik kağıt görünümünün tamamı kenardadır.
 */
export const Tape: React.FC<{
  x: number;
  y: number;
  width: number;
  height?: number;
  rotate?: number;
  seed?: number;
  opacity?: number;
  transform?: string;
  /** Hardal bant (işaret amaçlı) mı, nötr kağıt bandı mı? */
  tone?: 'paper' | 'mustard';
  zIndex?: number;
}> = ({x, y, width, height = 46, rotate = 0, seed = 0, opacity = 1, transform, tone = 'paper', zIndex}) => {
  const teeth = Math.max(3, Math.round(width / 26));
  // Kısa kenarlar testere dişli, uzun kenarlar düz: bant boyuna koparılır.
  const left: string[] = [];
  const right: string[] = [];
  for (let i = 0; i <= teeth; i += 1) {
    const t = i / teeth;
    const jitterL = (rand(seed * 3.1 + i) - 0.5) * 7;
    const jitterR = (rand(seed * 5.7 + i) - 0.5) * 7;
    left.push(`${jitterL} ${t * height}`);
    right.push(`${width + jitterR} ${(1 - t) * height}`);
  }
  const d = `M ${left[0]} ${left.slice(1).map((p) => `L ${p}`).join(' ')} ${right.map((p) => `L ${p}`).join(' ')} Z`;

  const fill = tone === 'mustard' ? PALETTE.accent : '#EDE6D2';
  return (
    <svg
      width={width + 16}
      height={height + 16}
      viewBox={`-8 -8 ${width + 16} ${height + 16}`}
      style={{
        position: 'absolute',
        left: x,
        top: y,
        opacity,
        transform: `${transform ?? ''} rotate(${rotate}deg)`,
        // Bant KAĞIDIN ÜSTÜNDE ama neredeyse yapışık: gölge çok kısa.
        filter: 'drop-shadow(0 2px 3px rgba(24,18,8,0.26))',
        pointerEvents: 'none',
        zIndex,
      }}
    >
      <path d={d} fill={fill} fillOpacity={tone === 'mustard' ? 0.92 : 0.78} />
      {/* Bandın kendi dokusu: boyuna hafif çizgiler. Düz bir dolgu plastik durur. */}
      {Array.from({length: 3}, (_, i) => (
        <line
          key={i}
          x1={2}
          y1={height * (0.28 + i * 0.22)}
          x2={width - 2}
          y2={height * (0.28 + i * 0.22) + (rand(seed + i) - 0.5) * 4}
          stroke="rgba(120,100,60,0.16)"
          strokeWidth={1.5}
        />
      ))}
    </svg>
  );
};

/* ------------------------------------------------------------------ */
/* PİRİNÇ İĞNE                                                         */
/* ------------------------------------------------------------------ */
/** İpin ucundaki başlık: küçük, parlak kenarlı pirinç nokta. */
export const BrassPin: React.FC<{
  cx: number;
  cy: number;
  r?: number;
  opacity?: number;
  transform?: string;
  zIndex?: number;
}> = ({cx, cy, r = 13, opacity = 1, transform, zIndex}) => (
  <svg
    width={r * 4}
    height={r * 4}
    viewBox={`0 0 ${r * 4} ${r * 4}`}
    style={{
      position: 'absolute',
      left: cx - r * 2,
      top: cy - r * 2,
      opacity,
      transform,
      filter: 'drop-shadow(0 3px 4px rgba(24,18,8,0.45))',
      pointerEvents: 'none',
      zIndex,
    }}
  >
    <circle cx={r * 2} cy={r * 2} r={r} fill={PALETTE.accent} />
    {/* Işık alan üst-sol kenar: iğnenin yuvarlak olduğunu okutan tek detay. */}
    <circle cx={r * 2 - r * 0.32} cy={r * 2 - r * 0.32} r={r * 0.42} fill={PALETTE.accentSoft} opacity={0.85} />
    <circle cx={r * 2} cy={r * 2} r={r} fill="none" stroke="rgba(70,50,16,0.5)" strokeWidth={1.6} />
  </svg>
);

/* ------------------------------------------------------------------ */
/* KIRMIZI İP                                                          */
/* ------------------------------------------------------------------ */
/**
 * İki iğne arasına gerilmiş kırmızı iplik. `progress` ile KENDİNİ ÇİZER.
 *
 * `DottedPath`'ten farkı sadece renk değil: ip SARKAR. Yerçekimi altındaki bir
 * iplik düz gitmez; kontrol noktası iki uç arasının ORTASINDAN AŞAĞI kayar.
 * Referans videoda bu sarkma açıkça görünüyor ve ipi "çizilmiş bir çizgi"
 * olmaktan çıkarıp fiziksel bir nesne yapan şey o.
 */
export const RedString: React.FC<{
  from: {x: number; y: number};
  to: {x: number; y: number};
  progress?: number;
  /** Sarkma miktarı, uçlar arası mesafenin oranı. */
  sag?: number;
  width?: number;
  color?: string;
  pins?: boolean;
  zIndex?: number;
}> = ({from, to, progress = 1, sag = 0.22, width = 7, color = PALETTE.signal, pins = true, zIndex}) => {
  const dist = Math.hypot(to.x - from.x, to.y - from.y);
  const mx = (from.x + to.x) / 2;
  const my = (from.y + to.y) / 2 + dist * sag;
  const d = `M ${from.x} ${from.y} Q ${mx} ${my} ${to.x} ${to.y}`;
  const len = dist * (1 + sag * 1.4);
  const p = Math.max(0, Math.min(1, progress));
  const clipId = `rs${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <>
      <svg
        width={CANVAS.width}
        height={CANVAS.height}
        style={{position: 'absolute', left: 0, top: 0, overflow: 'visible', zIndex, pointerEvents: 'none'}}
      >
        <defs>
          <clipPath id={clipId} />
        </defs>
        {/* İpin gölgesi: kağıttan bir tık yukarıda durduğunu okutur. */}
        <path
          d={d}
          fill="none"
          stroke="rgba(24,18,8,0.28)"
          strokeWidth={width}
          strokeLinecap="round"
          transform="translate(2,4)"
          strokeDasharray={len}
          strokeDashoffset={len * (1 - p)}
        />
        <path
          d={d}
          fill="none"
          stroke={color}
          strokeWidth={width}
          strokeLinecap="round"
          strokeDasharray={len}
          strokeDashoffset={len * (1 - p)}
        />
      </svg>
      {/* İğneler: başlangıç ipin ilk karesinde, bitiş ip TAM ulaştığında.
          Sırayı bozmak ipin havada bir iğneye bağlanmasını gösterirdi. */}
      {pins && p > 0.02 && <BrassPin cx={from.x} cy={from.y} zIndex={zIndex} />}
      {pins && p > 0.97 && <BrassPin cx={to.x} cy={to.y} zIndex={zIndex} />}
    </>
  );
};

/* ------------------------------------------------------------------ */
/* KÖŞE KALKMASI — "yaşayan poster" fazının tek olayı                  */
/* ------------------------------------------------------------------ */
/**
 * Yapıştırılmış bir kağıdın köşesi hava akımında kalkar.
 *
 * NEDEN GEREKLİ: referans videoda 7.5. saniyeden sonra kompozisyon tamamen
 * kilitli, ama kare ölü DEĞİL — fotoğrafın üst köşeleri birkaç milimetre
 * kalkıp iniyor. Bendeki tutuş fazında yalnızca `holdJitter` (bir-iki piksel
 * titreşim) ve film titremesi vardı; ölçümde bu, sahnenin son üçte birini
 * "%99 sabit" gösteren şeydi.
 *
 * Bu bileşen bir GÖLGE ÜÇGENİ + AÇIK KAĞIT ÜÇGENİ çiziyor: kalkan köşenin alt
 * yüzü ışık alır, altındaki kağıda gölge düşer. Kağıdı gerçekten bükmek
 * (3B transform) denenebilirdi ama `peel` primitifinde ölçüldü — tam ekran bir
 * düzleme rotateY vermek öğeyi yüzlerce piksel savuruyor ve perspektif ÖĞEYE
 * değil EKRANA uygulanmış oluyor. İki üçgen aynı okumayı bedavaya veriyor.
 *
 * `phase` sahne saatinden gelir; genlik kasten küçük (referansta da öyle).
 */
export const CornerCurl: React.FC<{
  /** Kalkacak kağıdın kutusu. */
  x: number;
  y: number;
  width: number;
  height: number;
  corner?: 'tl' | 'tr' | 'bl' | 'br';
  /** 0..1 — kalkma miktarı. Sahne saatinden salınımla beslenir. */
  amount?: number;
  /** Köşenin en büyük hâlinin kenar uzunluğu, piksel. */
  size?: number;
  opacity?: number;
  zIndex?: number;
}> = ({x, y, width, height, corner = 'tr', amount = 1, size = 86, opacity = 1, zIndex}) => {
  const a = Math.max(0, Math.min(1, amount));
  const s = size * (0.35 + a * 0.65);
  if (s < 4) return null;

  // Köşe noktası ve iki komşu kenar yönü.
  const cx = corner === 'tl' || corner === 'bl' ? x : x + width;
  const cy = corner === 'tl' || corner === 'tr' ? y : y + height;
  const sx = corner === 'tl' || corner === 'bl' ? 1 : -1;
  const sy = corner === 'tl' || corner === 'tr' ? 1 : -1;

  // Kalkan üçgen: köşeden iki kenar boyunca s kadar. Kıvrılan uç köşeden
  // DIŞARI ve YUKARI taşar — kağıdın kalınlığı buradan okunuyor.
  const lift = s * 0.26 * a;
  const tip = {x: cx - sx * lift * 0.5, y: cy - sy * lift};
  const p1 = {x: cx + sx * s, y: cy};
  const p2 = {x: cx, y: cy + sy * s};

  return (
    <svg
      width={CANVAS.width}
      height={CANVAS.height}
      style={{position: 'absolute', left: 0, top: 0, overflow: 'visible', opacity, zIndex, pointerEvents: 'none'}}
    >
      {/* 1. Altındaki kağıda düşen gölge — kalkma miktarıyla büyür. */}
      <path
        d={`M ${p1.x} ${p1.y} L ${cx + sx * lift * 0.7} ${cy + sy * lift * 0.7} L ${p2.x} ${p2.y} Z`}
        fill="rgba(24,18,8,0.30)"
        transform={`translate(${sx * lift * 0.5} ${sy * lift * 0.6})`}
      />
      {/* 2. Kalkan köşenin ARKA yüzü: ışık aldığı için zeminden açık. */}
      <path
        d={`M ${p1.x} ${p1.y} L ${tip.x} ${tip.y} L ${p2.x} ${p2.y} Z`}
        fill={PALETTE.paper}
      />
      {/* 3. Kıvrım çizgisi: iki yüzü ayıran ince koyu hat. */}
      <path
        d={`M ${p1.x} ${p1.y} L ${p2.x} ${p2.y}`}
        stroke="rgba(24,18,8,0.22)"
        strokeWidth={1.6}
        fill="none"
      />
    </svg>
  );
};
