import React from 'react';
import {CANVAS, SAFE, SAFE_BOX, VERTICAL_BANDS, PALETTE, FONTS, TYPE} from '../design/tokens';
import {rand} from '../motion/stepped';
import {Cutout} from './Cutout';
import {Tape} from './Fixings';
import type {ScenePayload} from '../scenes/types';

/**
 * ALT KAYIT — karenin alt üçte biri BOŞ KALIYORDU.
 *
 * ============ ÖLÇÜM ============
 *
 * Kullanıcı "tüm sayfaları yapmamışsınız ki, sadece hook çizilmiş" dedi ve
 * haklıydı. Kare beş yatay dilime bölünüp doluluk ölçüldü:
 *
 *   headline_card ("found three bundles")  15.7  39.7  29.9   0.0  13.7
 *   hero_cutout   ("there was a bomb")      1.6  26.0  33.8   5.3  15.4
 *   evidence_board (kanıt masası)          12.6  17.4  32.0  42.3  50.4
 *
 * Dördüncü dilim: eski şablonlarda %0.0 ve %5.3, kanıt masasında %42.3.
 * `VERTICAL_BANDS.bottom` güvenli alanın %30'u ve HİÇ KULLANILMIYORDU —
 * şablonlar hero'yu orta banda koyup altını bırakıyordu.
 *
 * ============ DEKORASYON DEĞİL, ANLAM ============
 *
 * Bu deponun kuralı "dekoratif vs semantik" ayrımı: boşluğu süsle doldurmak
 * yasak. O yüzden alt kayıt beat'in KENDİ bilgisini taşıyor:
 *
 *   · `shape2` — cümlenin İKİNCİ somut nesnesi, küçük çizilmiş
 *   · `caption` — kaynak/bağlam şeridi (zaten payload'da duruyordu)
 *   · bant — kağıdı masaya tutturan şey, ikisi de yoksa tek başına konmaz
 *
 * İkisi de yoksa bileşen HİÇBİR ŞEY çizmez. Boş bant, uydurma öğeden iyidir.
 */
export const LowerRegister: React.FC<{
  payload: ScenePayload;
  seed?: number;
  opacity?: number;
  transform?: string;
  /** Koyu zeminli sahneler (star_field) için metin rengi. */
  dark?: boolean;
  /**
   * Şerit ÇİZİLSİN Mİ. `headline_card` gibi bazı şablonlar `caption`'ı zaten
   * kendisi çiziyor; iki kez çizmek aynı bilgiyi üst üste bindirir.
   */
  showCaption?: boolean;
}> = ({payload, seed = 3, opacity = 1, transform, dark = false, showCaption = true}) => {
  const B = VERTICAL_BANDS.bottom;
  const second = payload.shape2;
  const caption = showCaption ? payload.caption : undefined;
  if (!second && !caption) return null;

  const r = rand(seed * 37);
  // Nesne solda ya da sağda; şerit karşı tarafa yaslanır. Deterministik.
  const objLeft = r < 0.5;
  const objW = Math.round(SAFE_BOX.width * 0.30);
  const objH = Math.round(B.height * 0.62);
  const objX = objLeft ? SAFE.left + Math.round(SAFE_BOX.width * 0.04) : SAFE.left + Math.round(SAFE_BOX.width * 0.62);
  const objY = B.y + Math.round(B.height * 0.10);

  return (
    <>
      {second && (
        <>
          <Cutout
            shape={second}
            width={objW}
            height={objH}
            x={objX}
            y={objY}
            rotate={objLeft ? -3 : 3}
            seed={seed * 7}
            opacity={opacity}
            transform={transform}
          />
          <Tape
            x={objX + Math.round(objW * 0.5) - 70}
            y={objY - 18}
            width={140}
            rotate={objLeft ? 9 : -9}
            opacity={opacity}
          />
        </>
      )}
      {caption && (
        <div
          style={{
            position: 'absolute',
            left: second && objLeft ? SAFE.left + Math.round(SAFE_BOX.width * 0.40) : SAFE.left,
            top: B.y + Math.round(B.height * (second ? 0.34 : 0.30)),
            width: second ? Math.round(SAFE_BOX.width * 0.56) : SAFE_BOX.width,
            opacity,
            transform,
            background: dark ? 'rgba(240,237,226,0.10)' : PALETTE.paper,
            padding: '14px 20px',
            fontFamily: FONTS.display,
            fontSize: TYPE.stamp,
            letterSpacing: '0.05em',
            color: dark ? 'rgba(240,237,226,0.82)' : 'rgba(24,36,48,0.86)',
            filter: 'drop-shadow(0 8px 12px rgba(24,18,8,0.20))',
          }}
        >
          {caption}
        </div>
      )}
    </>
  );
};

/** Alt bandın kanvas koordinatı — şablonlar hero yüksekliğini buna göre büyütür. */
export const LOWER_BAND_TOP = VERTICAL_BANDS.bottom.y;
export const CANVAS_BOTTOM = CANVAS.height - SAFE.bottom;
