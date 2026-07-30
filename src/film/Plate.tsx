import React from 'react';

/**
 * SİYAH ÜSTÜNE ÇEKİLMİŞ PLAKAYI KOMPOZİTLEMEK
 *
 * Rehberdeki teknik: siyah zeminde duran bir öğe (duman, ateş, ışık, toz, film
 * kalıntısı, i2v modelinden gelen klip) alfa kanalı OLMADAN kompozitlenebilir —
 * `mix-blend-mode: screen` siyahı görünmez yapar, çünkü screen'de siyah nötr
 * elemandır.
 *
 * NEDEN BU HATTA ÖNEMLİ
 * Bu projede "şeffaf PNG isteyip JPEG almak" hatası bir kez yaşandı: prompt
 * şeffaflık talep ediyordu ama istenen format JPEG'di ve JPEG'de alfa kanalı
 * YOKTUR. Sağlayıcı zincirinin döndürdüğü çoğu şey opak. screen kompozitleme o
 * duvarı tamamen atlar: alfa istemez.
 *
 * ÜÇ PARÇA, ÜÇÜ DE GEREKLİ:
 *   1. screen        — siyahı düşürür
 *   2. kontrast kırma — "neredeyse siyah" gri sisi de düşürür; bu olmadan
 *                      plaka zeminin üstünde soluk bir dikdörtgen bırakır
 *   3. maske tüyleme  — plakanın KENARI kare olduğu için screen bile kesik bir
 *                      dikdörtgen sınırı gösterir; kenarı yumuşatmak şart
 *
 * Üçünden birini atlamak tekniği çalışmıyor gösterir. İlk denemede 2. adımı
 * atlarsam sonuç "ekrana yapıştırılmış video karesi" olur.
 */

export interface OnBlackPlateProps {
  /** Görsel ya da video karesi — siyah zeminli olmalı. */
  src?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Kontrast kırma miktarı: gri sisi ne kadar bastıracağız. */
  crush?: number;
  /** Kenar tüylemesi, kutu boyutunun oranı. 0 = tüyleme yok. */
  feather?: number;
  opacity?: number;
  transform?: string;
  rotate?: number;
  zIndex?: number;
  /** Sıcak/soğuk ton: arşiv plakası nadiren nötrdür. */
  tint?: string;
  children?: React.ReactNode;
}

export const OnBlackPlate: React.FC<OnBlackPlateProps> = ({
  src,
  x,
  y,
  width,
  height,
  crush = 1.45,
  feather = 0.18,
  opacity = 1,
  transform,
  rotate = 0,
  zIndex,
  tint,
  children,
}) => {
  const f = Math.max(0, Math.min(0.49, feather));
  const mask =
    f > 0
      ? `radial-gradient(ellipse ${((0.5 - f * 0.6) * 200).toFixed(0)}% ${((0.5 - f * 0.6) * 200).toFixed(0)}% at 50% 50%, rgba(0,0,0,1) ${(100 - f * 190).toFixed(0)}%, rgba(0,0,0,0) 100%)`
      : undefined;

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width,
        height,
        zIndex,
        opacity,
        // screen ÜST katmanda olmalı; wrapper'a verilmezse iç öğe kendi
        // yığınında karışır ve siyah geri gelir.
        mixBlendMode: 'screen',
        transform: [transform, rotate ? `rotate(${rotate}deg)` : ''].filter(Boolean).join(' ') || undefined,
        transformOrigin: 'center center',
        maskImage: mask,
        WebkitMaskImage: mask,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          // brightness biraz düşük + contrast yüksek: koyu griler sıfıra iner,
          // parlak kısımlar korunur. Sıra önemli değil (ikisi de doğrusal
          // olmayan nokta işlemi) ama okunabilirlik için brightness sonra.
          filter: `contrast(${crush}) brightness(0.92) saturate(0.9)`,
        }}
      >
        {src ? (
          <img src={src} style={{display: 'block', width: '100%', height: '100%', objectFit: 'cover'}} />
        ) : (
          children
        )}
      </div>
      {tint && (
        <div
          style={{position: 'absolute', inset: 0, background: tint, mixBlendMode: 'color', opacity: 0.5}}
        />
      )}
    </div>
  );
};

/**
 * IŞIK SIZMASI — siyah plakanın en sık kullanılan hâli, ama görsele ihtiyaç
 * duymayan versiyonu: prosedürel ışık huzmesi. Rehber bunu "light leak" diye
 * geçiyor; arşiv makarasının kenarından giren ışık.
 *
 * Statik. Animasyonlu ışık sızması kompozisyon kilidi ölçümünü düşürür ve o
 * kural bu projede ölçümle konuldu.
 */
export const LightLeak: React.FC<{
  /** Hangi köşeden giriyor. */
  corner?: 'tl' | 'tr' | 'bl' | 'br';
  opacity?: number;
  color?: string;
}> = ({corner = 'tr', opacity = 0.16, color = 'rgba(255,196,120,1)'}) => {
  const at =
    corner === 'tl' ? '4% 2%' : corner === 'tr' ? '96% 3%' : corner === 'bl' ? '5% 97%' : '95% 96%';
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: `radial-gradient(58% 34% at ${at}, ${color} 0%, rgba(255,170,90,0.42) 26%, rgba(255,150,70,0) 68%)`,
        mixBlendMode: 'screen',
        opacity,
        pointerEvents: 'none',
      }}
    />
  );
};
