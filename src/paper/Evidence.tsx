import React from 'react';
import {PALETTE, FONTS} from '../design/tokens';
import {rand} from '../motion/stepped';

/**
 * KANIT MASASI PRİMİTİFLERİ — referans karenin gerçekten neyden yapıldığı.
 *
 * ============ REFERANS KARE SÖKÜLDÜ ============
 *
 * Kullanıcının kalite çıtası olarak verdiği Aylesbury karesi (8 AUG 1963)
 * öğelerine ayrıldığında şu çıkıyor:
 *
 *   · dev yırtık takvim yaprağı "8 / AUG / 1963"     → TİPOGRAFİ
 *   · "8 AUG 1963 9-AM BUCKS" posta damgası halkası  → TİPOGRAFİ
 *   · BUCKINGHAMSHIRE altın etiket                    → TİPOGRAFİ
 *   · gravür ilçe haritası, yer adlarıyla             → ÇİZGİ + TİPOGRAFİ
 *   · L.N.W.R. tarife kupürü (saat tablosu)           → TİPOGRAFİ
 *   · bant, pirinç raptiye, kırmızı ip                → ÇİZİM
 *   · Aylesbury istasyonu                             → TEK FOTOĞRAF
 *
 * Karede fotoğraf BİR TANE ve kabaca alanın onda biri. Geri kalanı yazı,
 * çizgi ve kağıt.
 *
 * Bizim hat ise bunların HEPSİNİ görsel modelinden istiyordu: "a torn calendar
 * page with punch holes" diye sordu, 6. turda yuvarlak köşeli siyah çerçeve
 * içinde modern bir kız portresi geldi. Bedava uçtaki FLUX okunur harf de
 * basamıyor — 4 plakanın 4'ünde uydurma manşet çıktı ("YOOLNI IIILNIIRIGLLLID").
 *
 * Yani bu öğeleri modelden istemek iki kere yanlış: model onları yapamıyor, ve
 * kod onları KUSURSUZ yapabiliyor — üstelik gerçek tarihle, gerçek yer adıyla,
 * deterministik. AGENTS.md zaten bunu söylüyordu: "kod çizer: harita, rota,
 * zaman çizelgesi, tipografi". Eksik olan kural değil, bu üç bileşendi.
 */

/** Zımba deliği sırası — takvim yaprağının üst kenarı. */
const PunchHoles: React.FC<{count: number; width: number}> = ({count, width}) => (
  <>
    {Array.from({length: count}, (_, i) => {
      const step = width / (count + 1);
      return (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: step * (i + 1) - 13,
            top: 16,
            width: 26,
            height: 26,
            borderRadius: '50%',
            background: 'rgba(70,58,40,0.30)',
            boxShadow: 'inset 0 3px 5px rgba(24,18,8,0.45)',
          }}
        />
      );
    })}
  </>
);

/**
 * DEV TARİH YAPRAĞI.
 *
 * Referans karenin en büyük öğesi ve tek başına kompozisyonun omurgası: gün
 * numarası kocaman, altında ince kural çizgileri arasında ay ve yıl.
 *
 * Gün/ay/yıl DIŞARIDAN geliyor — anlatının kendi tarihinden. Modelden istenen
 * "1971 görünümlü bir takvim" değil, anlatının SÖYLEDİĞİ tarih.
 */
export const DateTear: React.FC<{
  day: string;
  month: string;
  year: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotate?: number;
  opacity?: number;
  transform?: string;
  seed?: number;
  zIndex?: number;
}> = ({day, month, year, x, y, width, height, rotate = -2, opacity = 1, transform, seed = 9, zIndex}) => {
  // Alt kenar yırtık, üst kenar düz (zımbadan koparılmış yaprak böyle durur).
  const teeth = 18;
  const pts: string[] = ['0% 0%', '100% 0%'];
  for (let i = teeth; i >= 0; i -= 1) {
    const px = (i / teeth) * 100;
    const py = 100 - 3.2 * rand(seed * 17 + i);
    pts.push(`${px.toFixed(2)}% ${py.toFixed(2)}%`);
  }

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width,
        height,
        opacity,
        zIndex,
        transform: [transform, rotate ? `rotate(${rotate}deg)` : ''].filter(Boolean).join(' ') || undefined,
        transformOrigin: 'center center',
        filter: 'drop-shadow(0 14px 20px rgba(24,18,8,0.28))',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: PALETTE.paper,
          clipPath: `polygon(${pts.join(', ')})`,
        }}
      />
      <PunchHoles count={3} width={width} />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          paddingTop: height * 0.06,
          fontFamily: FONTS.display,
          color: PALETTE.ink,
        }}
      >
        <div style={{fontSize: height * 0.42, fontWeight: 700, lineHeight: 0.86, letterSpacing: '-0.02em'}}>
          {day}
        </div>
        <div style={{width: width * 0.52, height: 5, background: PALETTE.ink, margin: `${height * 0.05}px 0`}} />
        <div style={{fontSize: height * 0.11, fontWeight: 700, letterSpacing: '0.22em'}}>{month}</div>
        <div style={{width: width * 0.52, height: 5, background: PALETTE.ink, margin: `${height * 0.04}px 0`}} />
        <div style={{fontSize: height * 0.11, fontWeight: 700, letterSpacing: '0.14em'}}>{year}</div>
      </div>
    </div>
  );
};

/**
 * POSTA DAMGASI HALKASI.
 *
 * `Type.tsx`teki `Stamp` DİKDÖRTGEN bir çerçeve ve o başka bir şey ("EVIDENCE"
 * gibi kaşeler için doğru). Referanstaki damga posta damgası: iki eş merkezli
 * halka, üstte yer adı yayı, ortada tarih satırları.
 */
export const PostmarkRing: React.FC<{
  place: string;
  lines: string[];
  x: number;
  y: number;
  size: number;
  rotate?: number;
  opacity?: number;
  transform?: string;
  zIndex?: number;
}> = ({place, lines, x, y, size, rotate = -9, opacity = 1, transform, zIndex}) => {
  const ink = 'rgba(30,34,44,0.62)';
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: size,
        height: size,
        // Damga mürekkebi kağıda tam oturmaz; 0.86 o soluğu verir.
        opacity: opacity * 0.86,
        zIndex,
        transform: [transform, `rotate(${rotate}deg)`].filter(Boolean).join(' '),
        transformOrigin: 'center center',
      }}
    >
      <svg width={size} height={size} viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="47" fill="none" stroke={ink} strokeWidth="2.6" />
        <circle cx="50" cy="50" r="41" fill="none" stroke={ink} strokeWidth="1.4" />
        <path id="pm-arc" d="M 50,50 m -33,0 a 33,33 0 1,1 66,0" fill="none" />
        <text
          fontFamily={FONTS.display}
          fontSize="11"
          fontWeight={700}
          letterSpacing="2.4"
          fill={ink}
        >
          <textPath href="#pm-arc" startOffset="50%" textAnchor="middle">
            {place.toUpperCase()}
          </textPath>
        </text>
        {lines.map((t, i) => (
          <text
            key={i}
            x="50"
            y={50 + (i - (lines.length - 1) / 2) * 13}
            textAnchor="middle"
            dominantBaseline="middle"
            fontFamily={FONTS.display}
            fontSize="12"
            fontWeight={700}
            letterSpacing="1.4"
            fill={ink}
          >
            {t.toUpperCase()}
          </text>
        ))}
      </svg>
    </div>
  );
};

/**
 * TARİFE / KAYIT KUPÜRÜ.
 *
 * Referanstaki L.N.W.R. tarifesi. İzleyici satırları okumaz; okuduğu şey
 * "burada bir KAYIT var" bilgisidir. Ama satırlar GERÇEK olmalı — uydurma
 * rakam yazmak bu deponun "uydurma nesne çizmek yalan görseldir" kuralının
 * tipografik hâli olurdu. O yüzden satırlar dışarıdan, anlatının verisinden
 * geliyor; veri yoksa bileşen çağrılmaz.
 */
export const RecordClip: React.FC<{
  heading: string;
  subheading?: string;
  rows: string[][];
  x: number;
  y: number;
  width: number;
  rotate?: number;
  opacity?: number;
  transform?: string;
  seed?: number;
  zIndex?: number;
}> = ({heading, subheading, rows, x, y, width, rotate = 1, opacity = 1, transform, seed = 4, zIndex}) => {
  const teeth = 16;
  const pts: string[] = ['0% 0%', '100% 0%'];
  for (let i = teeth; i >= 0; i -= 1) {
    pts.push(`${((i / teeth) * 100).toFixed(2)}% ${(100 - 2.4 * rand(seed * 23 + i)).toFixed(2)}%`);
  }
  const cols = rows[0]?.length ?? 2;

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width,
        opacity,
        zIndex,
        transform: [transform, rotate ? `rotate(${rotate}deg)` : ''].filter(Boolean).join(' ') || undefined,
        transformOrigin: 'center center',
        background: PALETTE.paper,
        clipPath: `polygon(${pts.join(', ')})`,
        padding: `${width * 0.05}px ${width * 0.07}px ${width * 0.09}px`,
        fontFamily: FONTS.display,
        color: 'rgba(24,32,44,0.88)',
        filter: 'drop-shadow(0 10px 15px rgba(24,18,8,0.22))',
      }}
    >
      <div
        style={{
          textAlign: 'center',
          fontWeight: 700,
          fontSize: width * 0.062,
          letterSpacing: '0.08em',
          lineHeight: 1.25,
        }}
      >
        {heading.toUpperCase()}
      </div>
      {subheading && (
        <div
          style={{
            textAlign: 'center',
            fontSize: width * 0.042,
            letterSpacing: '0.18em',
            marginTop: width * 0.02,
          }}
        >
          {subheading.toUpperCase()}
        </div>
      )}
      <div style={{height: 2, background: 'rgba(24,32,44,0.55)', margin: `${width * 0.035}px 0`}} />
      {rows.map((r, i) => (
        <div
          key={i}
          style={{
            display: 'grid',
            gridTemplateColumns: cols === 3 ? '1fr auto auto' : '1fr auto',
            columnGap: width * 0.05,
            fontSize: width * 0.05,
            lineHeight: 1.7,
            // Noktalı dolgu: gerçek tarifelerde satır adı noktalarla uzar.
            borderBottom: i < rows.length - 1 ? '1px dotted rgba(24,32,44,0.28)' : 'none',
          }}
        >
          {r.map((cell, k) => (
            <span key={k} style={{textAlign: k === 0 ? 'left' : 'right', whiteSpace: 'nowrap'}}>
              {cell}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
};
