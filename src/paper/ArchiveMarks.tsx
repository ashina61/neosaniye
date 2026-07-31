import React from 'react';
import {CANVAS, SAFE, SAFE_BOX, PALETTE, FONTS, TYPE} from '../design/tokens';
import {rand} from '../motion/stepped';

/**
 * ARŞİV İŞARETLERİ — kareye GERÇEK bilgi taşıyan küçük öğeler.
 *
 * ============ NEDEN ============
 *
 * Kağıt katmanları (`Strata`) kareyi malzemeyle doldurdu ve ölçüm 16.4'ten
 * 21.1'e çıktı — ama kanıt masasının 31.0'ı hâlâ uzaktaydı. Aradaki fark
 * malzeme değil, ÖĞE ÇEŞİTLİLİĞİ: kanıt masasında dev tarih, damga, harita,
 * kupür ve ip var; öteki şablonlarda tek ikon.
 *
 * Bu dosya o boşluğu UYDURMADAN kapatıyor. İki öğe, ikisi de gerçek veriden:
 *
 *   · DÖNEM DAMGASI — anlatının kendi yılı (`storyboard.era`). Anlatı
 *     "24 November 1971" diyor, yıl oradan çıkıyor. Yıl yoksa çizilmez.
 *   · DOSYA SEKMESİ — sahnenin sırası. Arşiv kolajının en yaygın öğesi ve
 *     uydurma değil: sahne gerçekten o sırada.
 *
 * Referansta ikisinin karşılığı da var: posta damgası tarihi taşıyor,
 * BUCKINGHAMSHIRE etiketi bölgeyi. İkisi de küçük, ikisi de bilgi.
 */

/**
 * KAUÇUK DÖNEM DAMGASI.
 *
 * `Type.tsx`teki `Stamp` dikdörtgen çerçeveli ve altın; bu daha soluk, hafif
 * eğik ve mürekkebi kağıda tam oturmamış — arşiv damgası öyle görünür.
 */
export const EraStamp: React.FC<{
  era: string;
  x: number;
  y: number;
  size?: number;
  opacity?: number;
  transform?: string;
  rotate?: number;
  zIndex?: number;
}> = ({era, x, y, size = 190, opacity = 1, transform, rotate = -11, zIndex}) => {
  const ink = 'rgba(120,52,44,0.52)';
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: size,
        height: Math.round(size * 0.52),
        // Damga mürekkebi kağıda tam oturmaz.
        opacity: opacity * 0.9,
        zIndex,
        transform: [transform, `rotate(${rotate}deg)`].filter(Boolean).join(' '),
        transformOrigin: 'center center',
        border: `5px solid ${ink}`,
        borderRadius: 6,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: FONTS.display,
        fontWeight: 700,
        fontSize: Math.round(size * 0.28),
        letterSpacing: '0.16em',
        color: ink,
      }}
    >
      {era}
    </div>
  );
};

/**
 * DOSYA SEKMESİ — kağıdın üst kenarından çıkan etiketli çıkıntı.
 *
 * Numara sahnenin SIRASI. Uydurma bir dosya kodu değil; izleyici için de
 * "bu bir dosyanın kaçıncı sayfası" bilgisi.
 */
export const FileTab: React.FC<{
  n: number;
  x: number;
  y: number;
  width?: number;
  opacity?: number;
  transform?: string;
  zIndex?: number;
}> = ({n, x, y, width = 128, opacity = 1, transform, zIndex}) => (
  <div
    style={{
      position: 'absolute',
      left: x,
      top: y,
      width,
      opacity,
      zIndex,
      transform,
      background: PALETTE.accent,
      // Üst köşeler yuvarlak: sekme kağıttan ÇIKAR, üstüne yapışmaz.
      borderRadius: '7px 7px 0 0',
      padding: '9px 0 7px',
      textAlign: 'center',
      fontFamily: FONTS.display,
      fontWeight: 700,
      fontSize: Math.round(TYPE.stamp * 0.82),
      letterSpacing: '0.18em',
      color: 'rgba(28,22,10,0.86)',
      filter: 'drop-shadow(0 4px 6px rgba(24,18,8,0.22))',
    }}
  >
    {String(n).padStart(2, '0')}
  </div>
);

/**
 * İKİSİNİ BİRDEN YERLEŞTİREN SARMALAYICI.
 *
 * Konum deterministik ve KENARLARA yaslı: arşiv işaretleri kompozisyonun
 * merkezinde durmaz, kenardan girer. Hero'nun üstüne binmemesi için sağ üst
 * ve sol alt köşeler seçiliyor — şablonların hero'yu ortaya koyduğu ölçüldü.
 */
export const ArchiveMarks: React.FC<{
  era?: string;
  index: number;
  seed?: number;
  opacity?: number;
  transform?: string;
}> = ({era, index, seed = 3, opacity = 1, transform}) => {
  const r = rand(seed * 41);
  return (
    <>
      {era && (
        <EraStamp
          era={era}
          x={r < 0.5 ? Math.round(CANVAS.width * 0.66) : Math.round(SAFE.left)}
          y={Math.round(SAFE.top + SAFE_BOX.height * 0.03)}
          opacity={opacity}
          transform={transform}
          rotate={r < 0.5 ? -11 : 8}
        />
      )}
      <FileTab
        n={index + 1}
        x={r < 0.5 ? Math.round(SAFE.left) : Math.round(CANVAS.width * 0.72)}
        y={Math.round(SAFE.top + SAFE_BOX.height * 0.10)}
        opacity={opacity}
        transform={transform}
      />
    </>
  );
};
