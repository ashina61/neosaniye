import React, {useId} from 'react';
import {PALETTE, CANVAS} from '../design/tokens';
import {rand} from '../motion/stepped';

/**
 * İŞARETLER — ok, noktalı yol, marker dairesi, parıltı, deniz bandı.
 *
 * BURASI KODUN GÖRSEL MODELİNİ YENDİĞİ YER. Bir görsel modeli "Hawai'i'den
 * Tahiti'ye doğru bir ok" çizemez: yönü tutmaz, ucu bozulur, etiketi
 * karıştırır. Kod tam olarak istediğin iki noktayı birleştirir.
 *
 * Hepsi `progress` (0..1) alır ve stroke-dashoffset ile KENDİNİ ÇİZER. Referans
 * prompt'un "marker underlines and arrows draw themselves last" dediği davranış
 * bu; bir video modelinden rica edilmesi gerekmiyor.
 */

/** Bir SVG yolunun kendini çizmesi için gereken stroke stilleri. */
function drawStyle(length: number, progress: number): React.CSSProperties {
  const p = Math.max(0, Math.min(1, progress));
  return {
    strokeDasharray: length,
    strokeDashoffset: length * (1 - p),
  };
}

export const DrawnArrow: React.FC<{
  from: {x: number; y: number};
  to: {x: number; y: number};
  progress?: number;
  color?: string;
  width?: number;
  /** Yayın eğriliği: 0 düz, pozitif sağa/aşağı kavis. */
  curve?: number;
  head?: boolean;
  zIndex?: number;
}> = ({from, to, progress = 1, color = PALETTE.accent, width = 9, curve = 0.18, head = true, zIndex}) => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  // Kontrol noktası: orta noktadan dikey öteleme → yumuşak yay.
  const mx = (from.x + to.x) / 2 - dy * curve;
  const my = (from.y + to.y) / 2 + dx * curve;
  const d = `M ${from.x} ${from.y} Q ${mx} ${my} ${to.x} ${to.y}`;
  // Kuadratik yay uzunluğu ~ kirişten biraz uzun; dash için üst sınır yeter.
  const pathLen = len * (1 + Math.abs(curve) * 0.9);

  // Ok başı, yayın SON teğetine göre: teğet = to - kontrol noktası.
  const tx = to.x - mx;
  const ty = to.y - my;
  const ta = Math.atan2(ty, tx);
  const hl = width * 3.6;
  const spread = 0.42;
  const h1 = {x: to.x - hl * Math.cos(ta - spread), y: to.y - hl * Math.sin(ta - spread)};
  const h2 = {x: to.x - hl * Math.cos(ta + spread), y: to.y - hl * Math.sin(ta + spread)};

  // Ok başı, gövde %82 çizildikten sonra belirir — elle çizim sırası.
  const headOn = progress > 0.82 ? Math.min(1, (progress - 0.82) / 0.18) : 0;

  return (
    <svg
      width={CANVAS.width}
      height={CANVAS.height}
      style={{position: 'absolute', left: 0, top: 0, overflow: 'visible', zIndex, pointerEvents: 'none'}}
    >
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={width}
        strokeLinecap="round"
        style={drawStyle(pathLen, progress)}
      />
      {head && (
        <path
          d={`M ${h1.x} ${h1.y} L ${to.x} ${to.y} L ${h2.x} ${h2.y}`}
          fill="none"
          stroke={color}
          strokeWidth={width}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={headOn}
        />
      )}
    </svg>
  );
};

/** Noktalı rota çizgisi — harita ve uçuş yolu sahnelerinin dili. */
export const DottedPath: React.FC<{
  points: Array<{x: number; y: number}>;
  progress?: number;
  color?: string;
  width?: number;
  dash?: number;
  zIndex?: number;
}> = ({points, progress = 1, color = PALETTE.ink, width = 6, dash = 16, zIndex}) => {
  if (points.length < 2) return null;
  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  let len = 0;
  for (let i = 1; i < points.length; i += 1) {
    len += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  const p = Math.max(0, Math.min(1, progress));
  // clipPath id'si sahnede birden fazla yol olduğunda çakışmasın.
  const clipId = `dp${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  // Yolun soldan sağa uzandığı varsayımıyla yatay clip; rota sahneleri
  // referansta hep bu yönde ilerliyor. Dikey yollar için dasharray ile
  // çizilme aynı özniteliği paylaşacağından clip yaklaşımı zorunlu.
  const minX = Math.min(...points.map((q) => q.x));
  const maxX = Math.max(...points.map((q) => q.x));
  return (
    <svg
      width={CANVAS.width}
      height={CANVAS.height}
      style={{position: 'absolute', left: 0, top: 0, overflow: 'visible', zIndex, pointerEvents: 'none'}}
    >
      {/* Noktalı görünüm dasharray ile; çizilme ilerlemesi clip ile — ikisi
          aynı dasharray'i paylaşamaz, o yüzden maske kullanılıyor. */}
      <defs>
        <clipPath id={clipId}>
          <rect x={0} y={0} width={minX + (maxX - minX + width) * p} height={CANVAS.height} />
        </clipPath>
      </defs>
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={width}
        strokeLinecap="round"
        strokeDasharray={`${dash} ${dash * 1.5}`}
        clipPath={`url(#${clipId})`}
      />
    </svg>
  );
};

/**
 * MARKER DAİRESİ — "kraliçe karıncayı yuvarlak içine al" işi.
 * Elle çizilmiş izlenimi için tam elips değil: iki turlu, hafif kaçık.
 */
export const MarkerCircle: React.FC<{
  cx: number;
  cy: number;
  rx: number;
  ry?: number;
  progress?: number;
  color?: string;
  width?: number;
  seed?: number;
  zIndex?: number;
}> = ({cx, cy, rx, ry, progress = 1, color = PALETTE.accent, width = 10, seed = 6, zIndex}) => {
  const b = ry ?? rx * 0.78;
  // İki tur, ikinci tur birinciden hafif kaçık — elle çizim izlenimi.
  const wob = 1 + rand(seed) * 0.06;
  const pts: string[] = [];
  const turns = 1.85;
  const steps = 96;
  for (let i = 0; i <= steps; i += 1) {
    const a = (i / steps) * Math.PI * 2 * turns - 0.6;
    const k = 1 + 0.035 * Math.sin(a * 3 + seed) + (i / steps) * (wob - 1);
    pts.push(`${(cx + rx * k * Math.cos(a)).toFixed(1)} ${(cy + b * k * Math.sin(a)).toFixed(1)}`);
  }
  const d = `M ${pts[0]} L ${pts.slice(1).join(' L ')}`;
  const len = 2 * Math.PI * ((rx + b) / 2) * turns * 1.05;
  return (
    <svg
      width={CANVAS.width}
      height={CANVAS.height}
      style={{position: 'absolute', left: 0, top: 0, overflow: 'visible', zIndex, pointerEvents: 'none'}}
    >
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={width}
        strokeLinecap="round"
        style={drawStyle(len, progress)}
      />
    </svg>
  );
};

/**
 * ÜSTÜ ÇİZİLMİŞ NESNE — olumsuzlamanın görsel dili.
 *
 * NEDEN VAR
 *
 * "He carried no compass" cümlesinin öznesi pusuladır ama söylediği şey pusula
 * YOK'tur. Pusulayı öylece çizmek cümlenin TERSİNİ söyler ve izleyici görsele
 * güvenmeyi bırakır. Vox dilinde karşılığı nesneyi çizip üstüne kalemle çarpı
 * atmaktır: nesne tanınır, reddedildiği de anlaşılır.
 *
 * İki darbe SIRAYLA çizilir, aynı anda değil — elle çizim tek hareketle iki
 * çizgi atmaz. `progress` 0..0.5 birinci darbe, 0.5..1 ikinci.
 */
export const MarkerCross: React.FC<{
  cx: number;
  cy: number;
  size: number;
  progress?: number;
  color?: string;
  width?: number;
  seed?: number;
  zIndex?: number;
}> = ({cx, cy, size, progress = 1, color = PALETTE.accent, width = 14, seed = 9, zIndex}) => {
  const r = size / 2;
  // Darbeler tam simetrik değil: her uç seed'e bağlı birkaç piksel kaçık.
  const j = (k: number) => (rand(seed * 3.7 + k) - 0.5) * size * 0.09;
  const strokes: Array<[string, number]> = [
    [
      `M ${(cx - r + j(1)).toFixed(1)} ${(cy - r + j(2)).toFixed(1)} L ${(cx + r + j(3)).toFixed(1)} ${(cy + r + j(4)).toFixed(1)}`,
      Math.max(0, Math.min(1, progress / 0.5)),
    ],
    [
      `M ${(cx + r + j(5)).toFixed(1)} ${(cy - r + j(6)).toFixed(1)} L ${(cx - r + j(7)).toFixed(1)} ${(cy + r + j(8)).toFixed(1)}`,
      Math.max(0, Math.min(1, (progress - 0.5) / 0.5)),
    ],
  ];
  const len = size * 1.45;
  return (
    <svg
      width={CANVAS.width}
      height={CANVAS.height}
      style={{position: 'absolute', left: 0, top: 0, overflow: 'visible', zIndex, pointerEvents: 'none'}}
    >
      {strokes.map(([d, p], i) => (
        <path
          key={i}
          d={d}
          fill="none"
          stroke={color}
          strokeWidth={width}
          strokeLinecap="round"
          style={drawStyle(len, p)}
        />
      ))}
    </svg>
  );
};

/** Altın dört köşeli parıltı — referansın her yerde kullandığı dolgu öğesi. */
export const Sparkle: React.FC<{
  x: number;
  y: number;
  size?: number;
  color?: string;
  opacity?: number;
  rotate?: number;
  zIndex?: number;
}> = ({x, y, size = 34, color = PALETTE.accent, opacity = 1, rotate = 0, zIndex}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 100 100"
    style={{
      position: 'absolute',
      left: x - size / 2,
      top: y - size / 2,
      opacity,
      transform: rotate ? `rotate(${rotate}deg)` : undefined,
      zIndex,
      pointerEvents: 'none',
    }}
  >
    <path d="M50 0 C54 36 64 46 100 50 C64 54 54 64 50 100 C46 64 36 54 0 50 C36 46 46 36 50 0 Z" fill={color} />
  </svg>
);

/**
 * Sahneye deterministik parıltı serpiştir. Konumlar seed'e bağlı, yani her
 * render aynı yere koyar — ama sahne başına farklı seed farklı dağılım verir.
 */
export const SparkleField: React.FC<{
  count?: number;
  seed?: number;
  progress?: number;
  bounds?: {x: number; y: number; width: number; height: number};
}> = ({count = 4, seed = 9, progress = 1, bounds}) => {
  const b = bounds ?? {x: 60, y: 200, width: CANVAS.width - 120, height: CANVAS.height - 600};
  return (
    <>
      {Array.from({length: count}, (_, i) => {
        const r1 = rand(seed * 7 + i * 13);
        const r2 = rand(seed * 11 + i * 17);
        const r3 = rand(seed * 5 + i * 3);
        // Parıltılar sırayla belirir, hepsi bir anda değil.
        const own = Math.max(0, Math.min(1, (progress - i * 0.12) / 0.3));
        return (
          <Sparkle
            key={i}
            x={b.x + r1 * b.width}
            y={b.y + r2 * b.height}
            size={22 + r3 * 26}
            opacity={own * (0.55 + r3 * 0.45)}
            rotate={r3 * 40}
          />
        );
      })}
    </>
  );
};

/**
 * DENİZ / ZEMİN BANDI — referansın kompozisyonu ikiye bölme yolu.
 * Üst kenarı düz değil, yumuşak dalgalı; kağıt şerit gibi kesilmiş.
 */
export const SeaBand: React.FC<{
  y: number;
  height?: number;
  color?: string;
  progress?: number;
  seed?: number;
  zIndex?: number;
}> = ({y, height = 420, color = PALETTE.sea, progress = 1, seed = 8, zIndex}) => {
  const w = CANVAS.width;
  const amp = 16;
  const seg = 6;
  let d = `M 0 ${amp}`;
  for (let i = 1; i <= seg; i += 1) {
    const x = (i / seg) * w;
    const px = ((i - 0.5) / seg) * w;
    const py = amp + (rand(seed * 3 + i) - 0.5) * amp * 1.8;
    d += ` Q ${px} ${py} ${x} ${amp + (rand(seed * 5 + i) - 0.5) * amp}`;
  }
  d += ` L ${w} ${height} L 0 ${height} Z`;
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: y,
        width: w,
        height,
        zIndex,
        // Bant aşağıdan yukarı doğru açılır.
        clipPath: `inset(${((1 - Math.max(0, Math.min(1, progress))) * 100).toFixed(1)}% 0 0 0)`,
      }}
    >
      <svg width={w} height={height} style={{display: 'block'}}>
        <path d={d} fill={color} />
      </svg>
    </div>
  );
};
