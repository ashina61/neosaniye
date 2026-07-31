import React from 'react';
import {CANVAS, SAFE, SAFE_BOX, PALETTE} from '../design/tokens';
import {rand} from '../motion/stepped';

/**
 * KAĞIT KATMANLARI — kareyi dolduran şey BİLGİ değil, MALZEME.
 *
 * ============ NEDEN ============
 *
 * Ölçüldü: eski şablonlar kareyi doldurmuyor (4. dilim %0.0-5.3, kanıt
 * masasında %42.3). Sebep, kanıt masasının ALTI öğe dizmesi, ötekilerin tek
 * bir kartı ortaya koyması.
 *
 * Boşluğu uydurma bilgiyle doldurmak yasak — bu deponun "dekoratif vs
 * semantik" kuralı. Ama referans karede boşluğu dolduran şey zaten bilgi
 * değil: ÜST ÜSTE BİNMİŞ KAĞITLAR. Aylesbury karesinde harita, takvim,
 * fotoğraf ve kupür birbirinin üstüne biniyor ve aralarındaki tonlar
 * kompozisyonu taşıyor.
 *
 * Stil bloğu da tam bunu istiyor ve birebir şu sözcüklerle:
 *   "hand-cut documentary paper collage ... torn paper edges ...
 *    offset accent strokes ... soft cutout drop shadows"
 *
 * Yani yırtık kağıt katmanı ve ofset vuruş UYDURMA DEĞİL, stilin kendisi.
 * Bu dosya ikisini de kodda çiziyor: sıfır kota, deterministik.
 */

/** Katman tonları — üstteki en açık. Kanıt masasının PAPER_TONES mantığı. */
/**
 * TONLAR ÖLÇÜMLE KOYULAŞTIRILDI. İlk sürüm '#E6DFCE'/'#EFEADC'/'#F3F1E8' idi
 * ve render'da kareyi SOLDURDU: katmanlar zeminin kendi lekelerini ve yaşlanma
 * dokusunu örtüp her yeri düz açık gri yaptı. Katman zeminden AYIRT EDİLMELİ,
 * yoksa dolduruyor gibi görünüp aslında siliyor.
 */
const TONES = ['#D9CFB8', '#E4DAC4', '#EDE6D6'] as const;

/**
 * ÜST ÜSTE BİNMİŞ YIRTIK SAYFALAR.
 *
 * Hero'nun ARKASINA konur (zIndex negatif değil, çağıran önce render eder).
 * Sayfalar kareyi taşar: referansta da kağıtlar kadraja sığmıyor, kenardan
 * kesiliyor — masaya serilmiş bir yığının ancak bir kısmı görünür.
 */
export const PaperStrata: React.FC<{
  seed?: number;
  count?: number;
  opacity?: number;
  /** Katmanların kapladığı dikey aralık (kanvas oranı). */
  from?: number;
  to?: number;
}> = ({seed = 5, count = 2, opacity = 1, from = 0.12, to = 0.96}) => (
  <>
    {Array.from({length: count}, (_, i) => {
      const r1 = rand(seed * 11 + i * 3);
      const r2 = rand(seed * 19 + i * 7);
      const r3 = rand(seed * 29 + i * 5);

      // Genişlik küçültüldü: 0.62-1.12 kareyi baştan başa kaplıyordu.
      const w = Math.round(SAFE_BOX.width * (0.48 + r1 * 0.34));
      const top = Math.round(CANVAS.height * (from + (to - from) * (i / count) * 0.72 + r2 * 0.06));
      const h = Math.round(CANVAS.height * (to - from) * (0.42 + r3 * 0.28));
      // Sayfalar dönüşümlü olarak sol ve sağ kenardan taşar.
      const left =
        i % 2 === 0
          ? Math.round(SAFE.left - SAFE_BOX.width * (0.10 + r1 * 0.12))
          : Math.round(SAFE.left + SAFE_BOX.width * (0.24 + r3 * 0.22));

      // Yırtık alt kenar: deterministik zikzak.
      const teeth = 20;
      const pts: string[] = ['0% 0%', '100% 0%'];
      for (let k = teeth; k >= 0; k -= 1) {
        pts.push(`${((k / teeth) * 100).toFixed(1)}% ${(100 - 2.6 * rand(seed * 13 + i * 31 + k)).toFixed(2)}%`);
      }

      return (
        <div
          key={i}
          style={{
            position: 'absolute',
            left,
            top,
            width: w,
            height: h,
            opacity: opacity * (0.66 + i * 0.10),
            transform: `rotate(${((r2 - 0.5) * 5).toFixed(2)}deg)`,
            transformOrigin: 'center center',
            background: TONES[i % TONES.length],
            clipPath: `polygon(${pts.join(', ')})`,
            filter: 'drop-shadow(0 3px 4px rgba(24,18,8,0.20)) drop-shadow(0 16px 22px rgba(24,18,8,0.16))',
            pointerEvents: 'none',
          }}
        />
      );
    })}
  </>
);

/**
 * OFSET AKSAN VURUŞU — hero'nun kenarından taşan İNCE şerit.
 *
 * Stil bloğunun "offset accent strokes" ve "ONE hot red signal accent"
 * maddesi: karenin tek sıcak noktası.
 *
 * ============ İLK SÜRÜM TAVANI ÜÇ KAT AŞTI ============
 *
 * İlk hâli hero kartının TAM BOYUTUNDA bir blok çiziyordu ve `hero_cutout`ta
 * hero bandı %66'ya çıkınca blok kareyi yuttu. Ölçüm: kırmızı payı **%25.9**,
 * oysa AGENTS.md tavanı %8 ve referansta ölçülen %3.6.
 *
 * Bu, 7. turda modeli eleştirdiğim hatanın birebir aynısı — orada "ONE hot red
 * signal accent" cümlesi dev kırmızı blok olarak çizilmişti ve %11.2 ölçmüştüm.
 * Kodda çizmek oranı garanti ETMİYOR; oranı garanti eden şey ÖLÇÜM.
 *
 * Vuruş artık ŞERİT: hero'nun bir kenarı boyunca uzanan, kalınlığı sabit bir
 * bant. Ofset vuruşun tanımı da bu — arkadan taşan bir kaydırma, ikinci bir
 * dolu blok değil.
 */
export const OffsetStroke: React.FC<{
  x: number;
  y: number;
  width: number;
  height: number;
  opacity?: number;
  color?: string;
  /** Şerit kalınlığı, piksel. Kareye oranla küçük kalmalı. */
  thickness?: number;
  /** Hangi kenardan taşacak. */
  edge?: 'left' | 'right' | 'bottom';
  dx?: number;
  dy?: number;
  zIndex?: number;
}> = ({
  x,
  y,
  width,
  height,
  opacity = 1,
  color = PALETTE.signal,
  thickness = 26,
  edge = 'left',
  dx = -16,
  dy = 14,
  zIndex,
}) => {
  const vertical = edge !== 'bottom';
  return (
    <div
      style={{
        position: 'absolute',
        left: edge === 'right' ? x + width + dx : x + dx,
        top: y + dy,
        width: vertical ? thickness : width,
        height: vertical ? height : thickness,
        opacity: opacity * 0.9,
        background: color,
        zIndex,
        pointerEvents: 'none',
      }}
    />
  );
};
