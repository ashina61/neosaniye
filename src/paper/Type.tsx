import React from 'react';
import {PALETTE, FONTS, TYPE} from '../design/tokens';
import {rand} from '../motion/stepped';

/**
 * ALTIN HIGHLIGHT BARI
 *
 * Referans videonun imza hareketi: cümlenin ANAHTAR kelimesinin arkasına
 * çekilmiş altın marker darbesi. Düz dikdörtgen değil — hafif eğik, kenarları
 * düzensiz, çünkü elle çekilmiş izlenimi vermesi gerek.
 *
 * `reveal` 0..1: bar soldan sağa açılır. Metin barın açılmasını beklemez,
 * çünkü referansta metin zaten oradadır, vurgu sonradan gelir.
 */
export const Highlight: React.FC<{
  children: React.ReactNode;
  reveal?: number;
  color?: string;
  seed?: number;
}> = ({children, reveal = 1, color = PALETTE.accentSoft, seed = 2}) => {
  const tilt = (rand(seed) - 0.5) * 1.1;
  const w = Math.max(0, Math.min(1, reveal)) * 100;
  return (
    <span style={{position: 'relative', display: 'inline-block', whiteSpace: 'pre'}}>
      <span
        style={{
          position: 'absolute',
          left: '-0.14em',
          right: '-0.14em',
          top: '0.13em',
          bottom: '0.06em',
          background: color,
          transform: `rotate(${tilt.toFixed(2)}deg)`,
          clipPath: `inset(0 ${(100 - w).toFixed(2)}% 0 0)`,
          // Marker darbesi kenarları köşeli değil, hafif yumuşak.
          borderRadius: '3px 5px 4px 6px',
          zIndex: 0,
        }}
      />
      <span style={{position: 'relative', zIndex: 1}}>{children}</span>
    </span>
  );
};

/**
 * Metni parçalara ayırıp yalnızca işaretli kelimeleri vurgular.
 * Sözdizimi: "He read *the wind*." → yıldızlar arası vurgulanır.
 * LLM'in üreteceği metinde bu işaretleme kolay ve bozulmaz.
 */
export function parseEmphasis(text: string): Array<{text: string; emphasis: boolean}> {
  const out: Array<{text: string; emphasis: boolean}> = [];
  const re = /\*([^*]+)\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push({text: text.slice(last, m.index), emphasis: false});
    out.push({text: m[1], emphasis: true});
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({text: text.slice(last), emphasis: false});
  return out.length ? out : [{text, emphasis: false}];
}

export const EmphasisText: React.FC<{
  text: string;
  reveal?: number;
  seed?: number;
  highlightColor?: string;
}> = ({text, reveal = 1, seed = 2, highlightColor}) => (
  <>
    {parseEmphasis(text).map((part, i) =>
      part.emphasis ? (
        <Highlight key={i} reveal={reveal} seed={seed + i} color={highlightColor}>
          {part.text}
        </Highlight>
      ) : (
        <span key={i}>{part.text}</span>
      ),
    )}
  </>
);

/** Condensed, sıkı satır aralıklı başlık. Bu stilin belkemiği. */
export const Headline: React.FC<{
  text: string;
  size?: number;
  align?: 'left' | 'center';
  color?: string;
  reveal?: number;
  upper?: boolean;
  seed?: number;
  style?: React.CSSProperties;
}> = ({text, size = TYPE.headline, align = 'left', color = PALETTE.ink, reveal = 1, upper = true, seed = 2, style}) => (
  <div
    style={{
      fontFamily: FONTS.display,
      fontWeight: 700,
      fontSize: size,
      lineHeight: 0.98,
      letterSpacing: '-0.012em',
      textTransform: upper ? 'uppercase' : 'none',
      color,
      textAlign: align,
      ...style,
    }}
  >
    <EmphasisText text={text} reveal={reveal} seed={seed} />
  </div>
);

/** İtalik serif alıntı. Referansta anlatının en duygusal cümlesi burada durur. */
export const PullQuote: React.FC<{
  text: string;
  size?: number;
  color?: string;
  reveal?: number;
  seed?: number;
  style?: React.CSSProperties;
}> = ({text, size = TYPE.quote, color = PALETTE.ink, reveal = 1, seed = 4, style}) => (
  <div
    style={{
      fontFamily: FONTS.quote,
      fontStyle: 'italic',
      fontWeight: 400,
      fontSize: size,
      lineHeight: 1.22,
      color,
      textAlign: 'center',
      ...style,
    }}
  >
    <EmphasisText text={text} reveal={reveal} seed={seed} />
  </div>
);

/**
 * ETİKET KARTI — ince çerçeveli küçük kağıt kart, içinde 1-4 kelime büyük harf.
 * Referans PDF'in metin yasası: varsayılan metin YOK; tarih/isim/sayı varsa
 * TEK etiket, en fazla 4 kelime. Bu bileşen o kuralı kod düzeyinde uygular.
 */
export const LABEL_MAX_WORDS = 4;

export const LabelCard: React.FC<{
  text: string;
  x: number;
  y: number;
  transform?: string;
  opacity?: number;
  rotate?: number;
  accent?: boolean;
  size?: number;
  zIndex?: number;
}> = ({text, x, y, transform, opacity = 1, rotate = 0, accent = false, size = TYPE.label, zIndex}) => {
  const words = text.trim().split(/\s+/);
  // Yasayı sessizce ihlal etmek yerine kırp: 4 kelimeden uzun etiket, görsel
  // modelinde de kodda da bozulur.
  const shown = words.slice(0, LABEL_MAX_WORDS).join(' ');
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        opacity,
        zIndex,
        transform: [transform, rotate ? `rotate(${rotate}deg)` : ''].filter(Boolean).join(' ') || undefined,
        transformOrigin: 'center center',
        background: accent ? PALETTE.accent : PALETTE.paper,
        border: `2px solid ${accent ? 'rgba(0,0,0,0.28)' : 'rgba(24,36,48,0.34)'}`,
        padding: '10px 20px 12px',
        filter: 'drop-shadow(0 8px 12px rgba(24,18,8,0.26))',
        fontFamily: FONTS.display,
        fontWeight: 700,
        fontSize: size,
        letterSpacing: '0.10em',
        textTransform: 'uppercase',
        color: PALETTE.ink,
        whiteSpace: 'nowrap',
      }}
    >
      {shown}
    </div>
  );
};

/** Lastik damga — eğik, çerçeveli, aksan renkli. Tarih/durum için. */
export const Stamp: React.FC<{
  text: string;
  x: number;
  y: number;
  transform?: string;
  opacity?: number;
  rotate?: number;
  zIndex?: number;
}> = ({text, x, y, transform, opacity = 1, rotate = -7, zIndex}) => (
  <div
    style={{
      position: 'absolute',
      left: x,
      top: y,
      // Damga mürekkebi tam örtmez; 0.88 çarpanı o soluğu verir.
      opacity: opacity * 0.88,
      zIndex,
      transform: [transform, `rotate(${rotate}deg)`].filter(Boolean).join(' '),
      transformOrigin: 'center center',
      border: `4px solid ${PALETTE.accent}`,
      padding: '8px 18px 10px',
      fontFamily: FONTS.display,
      fontWeight: 700,
      fontSize: 34,
      letterSpacing: '0.14em',
      textTransform: 'uppercase',
      color: PALETTE.accent,
      whiteSpace: 'nowrap',
    }}
  >
    {text}
  </div>
);

/** Daktilo şeridi — ince, uzun, açık kağıt üstünde küçük punto. */
export const TypewriterStrip: React.FC<{
  text: string;
  x: number;
  y: number;
  width?: number;
  transform?: string;
  opacity?: number;
  zIndex?: number;
}> = ({text, x, y, width, transform, opacity = 1, zIndex}) => (
  <div
    style={{
      position: 'absolute',
      left: x,
      top: y,
      width,
      opacity,
      zIndex,
      transform,
      background: PALETTE.paper,
      padding: '8px 16px',
      fontFamily: FONTS.display,
      fontWeight: 400,
      fontSize: TYPE.stamp,
      letterSpacing: '0.06em',
      color: 'rgba(24,36,48,0.86)',
      filter: 'drop-shadow(0 6px 9px rgba(24,18,8,0.2))',
    }}
  >
    {text}
  </div>
);
