import React from 'react';
import {AbsoluteFill, staticFile} from 'remotion';
import {PALETTE, CANVAS, FONTS} from '../design/tokens';
import {rand} from '../motion/stepped';

/**
 * Fontlar repoya gömülü (public/fonts). Sistem fontuna güvenmiyoruz: GitHub
 * runner'ında Roboto Condensed yok, ve font değişirse tüm kompozisyon kayar.
 * Lisanslar public/fonts içinde duruyor (Roboto: Apache-2.0, EB Garamond: OFL).
 */
export const FontFaces: React.FC = () => (
  <style>{`
    @font-face {
      font-family: 'Roboto Condensed';
      src: url('${staticFile('fonts/RobotoCondensed-Bold.ttf')}') format('truetype');
      font-weight: 700; font-style: normal; font-display: block;
    }
    @font-face {
      font-family: 'Roboto Condensed';
      src: url('${staticFile('fonts/RobotoCondensed-Regular.ttf')}') format('truetype');
      font-weight: 400; font-style: normal; font-display: block;
    }
    @font-face {
      font-family: 'EB Garamond';
      src: url('${staticFile('fonts/EBGaramond12-Italic.otf')}') format('opentype');
      font-weight: 400; font-style: italic; font-display: block;
    }
  `}</style>
);

/**
 * KAĞIT LİFİ DOKUSU
 *
 * Steril düz renk "dijital" durur; kağıt hissi lif gürültüsünden gelir.
 * feTurbulence deterministiktir (seed sabit), yani her render aynı dokuyu
 * üretir — Math.random ile üretilmiş bir gürültü determinizmi bozardı.
 */
const GRAIN_ID = 'np-grain';

export const PaperTexture: React.FC<{opacity?: number}> = ({opacity = 0.42}) => (
  <>
    <svg width={0} height={0} style={{position: 'absolute'}}>
      <filter id={GRAIN_ID} x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.82" numOctaves={4} seed={7} result="n" />
        <feColorMatrix
          in="n"
          type="matrix"
          values="0 0 0 0 0.5  0 0 0 0 0.47  0 0 0 0 0.42  0 0 0 0.9 0"
        />
      </filter>
    </svg>
    <AbsoluteFill
      style={{filter: `url(#${GRAIN_ID})`, opacity, mixBlendMode: 'multiply', pointerEvents: 'none'}}
    />
  </>
);

/** Kenarlarda hafif kararma — basılı sayfanın ışık düşüşü. */
export const PaperVignette: React.FC = () => (
  <AbsoluteFill
    style={{
      background:
        'radial-gradient(120% 80% at 50% 44%, rgba(0,0,0,0) 52%, rgba(40,30,16,0.10) 84%, rgba(30,22,10,0.20) 100%)',
      pointerEvents: 'none',
    }}
  />
);

/**
 * Zemine serpiştirilmiş leke/kir. Konum deterministik (rand(seed)), yani her
 * render aynı yere aynı lekeyi koyar.
 */
export const PaperStains: React.FC<{seed?: number; count?: number}> = ({seed = 3, count = 5}) => (
  <>
    {Array.from({length: count}, (_, i) => {
      const r1 = rand(seed * 10 + i);
      const r2 = rand(seed * 20 + i * 3);
      const r3 = rand(seed * 30 + i * 7);
      const size = 90 + r3 * 260;
      return (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: r1 * (CANVAS.width - size),
            top: r2 * (CANVAS.height - size),
            width: size,
            height: size * (0.6 + r3 * 0.6),
            borderRadius: '50%',
            background: `radial-gradient(circle, rgba(120,96,56,${(0.05 + r3 * 0.05).toFixed(3)}) 0%, rgba(120,96,56,0) 70%)`,
            pointerEvents: 'none',
          }}
        />
      );
    })}
  </>
);

/**
 * YAŞLANMIŞ ARŞİV YÜZEYİ — BULUTLU FOXING.
 *
 * ============ NEDEN KODA ALINDI ============
 *
 * Bu doku beş turdur görsel modelinden isteniyordu ("zemin plakası"). Ölçüm:
 * 4. ve 5. turda üretilen 4 plakanın 4'ü de UYDURMA MANŞET METNİYLE geldi ve
 * biri yüz taşıyordu; 5. tur, metni büyük harfle yasaklayan promtla koştu.
 * Serbest uçtaki schnell sınıfı FLUX'ta olumsuz talimat tutmuyor.
 *
 * Ama plakayı büsbütün kapatmak da ölçüldü ve bedeli görüldü: `PaperStains`in
 * alfası 0.05-0.10 aralığında ve kompoze kare DÜZ KREM kalıyor — engine'in
 * "aged newsprint and archival map surfaces" dünyasına hiç benzemiyor.
 *
 * Bu bileşen ikisinin arasını kapatıyor: dokuyu deterministik olarak KOD
 * çiziyor. `feTurbulence` düşük frekansta bulutlu bir maske veriyor, sepya
 * tonlanıp multiply ile basılıyor — kağıdın yaş lekeleri (foxing) böyle
 * görünür. Harf üretme riski sıfır, çünkü ortada dil modeli yok.
 */
/**
 * ============ feTurbulence DENENDİ VE ÖLÇÜLDÜ: İŞE YARAMADI ============
 *
 * İlk sürüm bu dokuyu `feTurbulence` + `feColorMatrix` ile kuruyordu. Ölçüm
 * (zemin bölgesi 32'ye indirgenip geniş ölçek std'si alınarak):
 *
 *   plakasız (dokusuz)   geniş ölçek std = 11.70
 *   feTurbulence v1      geniş ölçek std = 11.72   → hiçbir şey
 *   feTurbulence v2      geniş ölçek std = 11.33   → yalnızca düz koyulaşma
 *
 * Yani filtre lekeyi değil, sabit bir ton kaymasını basıyordu. Kağıdın yaş
 * lekesi GENİŞ ÖLÇEKLİ ve DÜZENSİZ; fractalNoise'un ortalaması ise düz.
 *
 * Bu yüzden leke alanı DOM'da kuruluyor: her leke ayrı bir radial-gradient
 * ve konumu `rand(seed)` ile deterministik. Ölçülebilir, ayarlanabilir ve
 * render motorunun filtre davranışına bağlı değil.
 */
export const PaperAged: React.FC<{seed?: number; count?: number}> = ({seed = 11, count = 22}) => (
  <>
    {Array.from({length: count}, (_, i) => {
      const r1 = rand(seed * 13 + i * 5);
      const r2 = rand(seed * 29 + i * 11);
      const r3 = rand(seed * 47 + i * 17);
      const r4 = rand(seed * 61 + i * 23);
      // Geniş bulutlardan küçük foxing benegine kadar: boyut dağılımı kareli,
      // yani çoğu leke küçük, birkaçı büyük — gerçek yaşlanmanın dağılımı.
      const size = 120 + r3 * r3 * 900;
      // Koyuluk boyutla TERS: büyük bulutlar soluk, küçük benekler keskin.
      const alpha = 0.05 + (1 - r3) * 0.13;
      return (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: r1 * CANVAS.width - size / 2,
            top: r2 * CANVAS.height - size / 2,
            width: size,
            height: size * (0.55 + r4 * 0.75),
            borderRadius: '50%',
            background:
              `radial-gradient(circle, rgba(126,96,52,${alpha.toFixed(3)}) 0%, ` +
              `rgba(126,96,52,${(alpha * 0.45).toFixed(3)}) 45%, rgba(126,96,52,0) 72%)`,
            pointerEvents: 'none',
          }}
        />
      );
    })}
    {/* Kenar kararması: arşiv kağıdı en çok kenarından sararır. */}
    <AbsoluteFill
      style={{
        background:
          'radial-gradient(115% 75% at 50% 46%, rgba(0,0,0,0) 46%, rgba(112,84,44,0.10) 78%, rgba(96,70,34,0.22) 100%)',
        pointerEvents: 'none',
      }}
    />
  </>
);

export type Ground = 'cream' | 'warm' | 'ink' | 'night';

const GROUND_COLOR: Record<Ground, string> = {
  cream: PALETTE.ground,
  warm: PALETTE.groundWarm,
  ink: PALETTE.ink,
  night: PALETTE.night,
};

/**
 * Her sahnenin tabanı. "Build-on assembly" burada başlar: sahne açıldığında
 * ekranda YALNIZCA bu vardır — boş kağıt zemin, lekeleriyle. Öyküye ait her
 * öğe sonradan girer.
 */
export const PaperBase: React.FC<{
  ground?: Ground;
  stains?: boolean;
  /**
   * Yaşlanmış arşiv yüzeyi. Varsayılan KAPALI, çünkü her sahne arşiv sayfası
   * değil; `collage_build` plakasız çalıştığında açılıyor (gerekçe `PaperAged`).
   */
  aged?: boolean;
  grain?: boolean;
  vignette?: boolean;
  seed?: number;
  children?: React.ReactNode;
}> = ({ground = 'cream', stains = true, aged = false, grain = true, vignette = true, seed = 3, children}) => {
  const dark = ground === 'ink' || ground === 'night';
  return (
    <AbsoluteFill style={{backgroundColor: GROUND_COLOR[ground], fontFamily: FONTS.display}}>
      <FontFaces />
      {aged && !dark && <PaperAged seed={seed} />}
      {stains && !dark && <PaperStains seed={seed} />}
      {children}
      {grain && <PaperTexture opacity={dark ? 0.22 : 0.42} />}
      {vignette && <PaperVignette />}
    </AbsoluteFill>
  );
};
