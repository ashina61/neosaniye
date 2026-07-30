import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {CANVAS} from '../design/tokens';
import {rand} from '../motion/stepped';

/**
 * FİLM-LOOK MOTORU — BİR KEZ KURULUR, TÜM SAHNELERE UYGULANIR
 *
 * Rehberin tek cümlelik kuralı: "Build the film-look engine once." Altı sahnenin
 * üstüne aynı iki doku + dört kod efekti seriliyor ve otuz ayrı görseli tek
 * filmin kareleri gibi gösteren şey büyük ölçüde bu.
 *
 * NEDEN SAHNE İÇİNDE DEĞİL, ÜSTÜNDE
 * Kolajı tutarlı kılan şey öğelerin benzemesi değil, HEPSİNİN AYNI FİLMDEN
 * geçmesi. Efekt sahne başına ayarlanabilir olursa 19 sahnede 19 farklı film
 * çıkar ve tutarlılık kaybolur. Bu yüzden burada tek bir bileşen var ve
 * Short.tsx'te tek bir yere konuyor.
 *
 * DOĞRULAYICIYLA ÇATIŞMA — ÖNEMLİ
 * Bu projenin ölçülmüş kuralı "KOMPOZİSYON KİLİTLİ": doğrulayıcı sahne başına
 * sabit piksel oranını tol=6 ile ölçüyor ve ortalama %80 istiyor. Kare geneline
 * uygulanan her ANİMASYONLU efekt bu ölçümü doğrudan aşağı çeker. O yüzden:
 *
 *   · dokular, çizgiler, jaluzi, vinyet, köşe bulanıklığı → TAMAMEN STATİK
 *   · yalnızca pozlama titremesi animasyonlu, genliği ölçülerek seçildi
 *   · gate weave (kare geneli 1px sallanma) KASITLI OLARAK YOK — o gerçek bir
 *     kamera kaymasıdır, kamera testi haklı olarak yakalar ve bu projede
 *     "kamera diye bir şey yok" kuralı ölçümle konulmuştu
 *
 * Yani rehberin listesinden bir teknik eksik bırakıldı ve sebebi bu.
 */

/* ------------------------------------------------------------------ */
/* DOKU 1 — FİLM GRENİ                                                 */
/* ------------------------------------------------------------------ */
/**
 * PaperBase'teki lif dokusundan farklı: o KAĞIDIN dokusu (multiply, sıcak,
 * kaba), bu FİLMİN greni (overlay, nötr, ince). İkisi üst üste durur çünkü
 * gerçekte de öyle: kağıt kolaj filme çekilmiş.
 *
 * Gren STATİK. Gerçek filmde gren her karede yeniden dağılır ama:
 *   1. referans videonun ölçümü kompozisyonun TAMAMEN donduğunu gösterdi —
 *      o videoda da gren kaymıyor
 *   2. kayan gren her pikseli her karede değiştirir; kompozisyon kilidi ölçümü
 *      %80'in çok altına düşer
 * Ödünç: hareketli gren yerine ince statik gren + adımlı pozlama titremesi.
 */
const FILM_GRAIN_ID = 'nf-film-grain';

export const FilmGrain: React.FC<{opacity?: number}> = ({opacity = 0.24}) => (
  <>
    <svg width={0} height={0} style={{position: 'absolute'}}>
      <filter id={FILM_GRAIN_ID} x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="1.35" numOctaves={2} seed={19} result="n" />
        {/* Nötr gri gren: renk kanalları eşit, alfa gürültüden gelir. */}
        <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 1.1 -0.1" />
      </filter>
    </svg>
    <AbsoluteFill
      style={{filter: `url(#${FILM_GRAIN_ID})`, opacity, mixBlendMode: 'overlay', pointerEvents: 'none'}}
    />
  </>
);

/* ------------------------------------------------------------------ */
/* DOKU 2 — GRUNGE YIKAMA                                              */
/* ------------------------------------------------------------------ */
/**
 * Alçak frekanslı leke haritası: emülsiyon kiri, arşiv kutusunda geçirilmiş
 * altmış yıl. Grenden farkı ÖLÇEK — gren piksel boyutunda, bu on-yüz piksel.
 * İkisi bir arada olmadan "eski" değil "gürültülü" durur.
 */
const GRUNGE_ID = 'nf-grunge';

export const GrungeWash: React.FC<{opacity?: number}> = ({opacity = 0.13}) => (
  <>
    <svg width={0} height={0} style={{position: 'absolute'}}>
      <filter id={GRUNGE_ID} x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.006 0.011" numOctaves={3} seed={41} result="n" />
        {/* Kontrastı aç: yumuşak gürültü değil, ayrık lekeler istiyoruz. */}
        <feComponentTransfer in="n" result="c">
          <feFuncA type="gamma" exponent={2.4} amplitude={1.5} offset={-0.25} />
        </feComponentTransfer>
        <feColorMatrix in="c" type="matrix" values="0 0 0 0 0.42  0 0 0 0 0.36  0 0 0 0 0.28  0 0 0 0.85 0" />
      </filter>
    </svg>
    <AbsoluteFill
      style={{filter: `url(#${GRUNGE_ID})`, opacity, mixBlendMode: 'multiply', pointerEvents: 'none'}}
    />
  </>
);

/* ------------------------------------------------------------------ */
/* KOD EFEKTİ 1 — TARAMA ÇİZGİLERİ                                     */
/* ------------------------------------------------------------------ */
/**
 * Periyot 4px, opaklık düşük. NEDEN 4 VE NEDEN DÜŞÜK: 1080 genişlikte 2-3px
 * periyot h264'ün 4:2:0 renk altörneklemesinde çınlama üretiyor ve çizgi
 * "titreyen moiré"ye dönüşüyor. 4px periyot sıkıştırmadan sağ çıkıyor.
 */
export const ScanLines: React.FC<{opacity?: number; period?: number}> = ({opacity = 0.055, period = 4}) => (
  <AbsoluteFill
    style={{
      backgroundImage: `repeating-linear-gradient(180deg, rgba(0,0,0,0.9) 0px, rgba(0,0,0,0.9) 1px, rgba(0,0,0,0) 1px, rgba(0,0,0,0) ${period}px)`,
      opacity,
      mixBlendMode: 'multiply',
      pointerEvents: 'none',
    }}
  />
);

/* ------------------------------------------------------------------ */
/* KOD EFEKTİ 2 — JALUZİ IŞIĞI                                         */
/* ------------------------------------------------------------------ */
/**
 * Rehberin "venetian blinds" dediği şey: pencereden sızan ışığın geniş, yumuşak
 * bantları. Tarama çizgisiyle karıştırılmamalı — o mekanik ve ince, bu OPTİK ve
 * geniş. İşi mekâna ışık kaynağı iması koymak; kolaj o zaman "içinde bir yer"
 * olur.
 *
 * Hafif eğik (-7°) çünkü tam yatay bant çerçeveyi ikiye böler ve grafik durur.
 */
export const VenetianLight: React.FC<{opacity?: number; angle?: number}> = ({opacity = 0.07, angle = -7}) => (
  <AbsoluteFill
    style={{
      /**
       * ÖLÇÜLDÜ (render'a bakarak): burada `angle + 90` yazıyordu ve bantlar
       * DİKEY çıkıyordu. repeating-linear-gradient'te açı gradyanın YÖNÜdür;
       * bantlar ona diktir. Yani 0deg → yatay bant. Jaluzi yatay olmak zorunda,
       * yoksa "pencereden sızan ışık" değil "çubuklu duvar kağıdı" olur.
       */
      backgroundImage: `repeating-linear-gradient(${angle}deg, rgba(255,246,224,0.95) 0px, rgba(255,246,224,0.95) 26px, rgba(255,246,224,0) 62px, rgba(255,246,224,0) 148px)`,
      opacity,
      mixBlendMode: 'screen',
      pointerEvents: 'none',
      // Bant her yere değil, üst-sol çeyrekten girer: ışık kaynağı YÖNLÜ olmalı.
      maskImage: 'radial-gradient(140% 110% at 12% 6%, rgba(0,0,0,1) 0%, rgba(0,0,0,0.45) 42%, rgba(0,0,0,0) 78%)',
      WebkitMaskImage:
        'radial-gradient(140% 110% at 12% 6%, rgba(0,0,0,1) 0%, rgba(0,0,0,0.45) 42%, rgba(0,0,0,0) 78%)',
    }}
  />
);

/* ------------------------------------------------------------------ */
/* KOD EFEKTİ 3 — KÖŞE BULANIKLIĞI                                     */
/* ------------------------------------------------------------------ */
/**
 * Ucuz eski objektiflerin kenar keskinliği merkezden belirgin şekilde düşük.
 * Bunu taklit etmek kareyi "lensten geçmiş" gösterir; keskin kenar "ekran
 * görüntüsü" gösterir.
 *
 * backdrop-filter kullanılıyor: ALTINDAKİ her şeyi bulanıklaştırır, yani
 * sahneye dokunmadan çalışır. Maske merkezi tamamen açık bırakır.
 *
 * DİKKAT: bu projede filtreli katmanların YANLIŞ TARAYICIDA sessizce düştüğü
 * ÖLÇÜLDÜ (19 sahnenin 14'ü boş çıkmıştı). backdrop-filter da o sınıfa girer.
 * Render sonrası göz kontrolü şart; düşerse kare bozulmaz, sadece efekt yok
 * olur — o yüzden buna kritik hiçbir şey bağlı değil.
 */
export const CornerBlur: React.FC<{px?: number}> = ({px = 5}) => (
  <AbsoluteFill
    style={{
      backdropFilter: `blur(${px}px)`,
      WebkitBackdropFilter: `blur(${px}px)`,
      maskImage:
        'radial-gradient(66% 58% at 50% 46%, rgba(0,0,0,0) 58%, rgba(0,0,0,0.55) 82%, rgba(0,0,0,1) 100%)',
      WebkitMaskImage:
        'radial-gradient(66% 58% at 50% 46%, rgba(0,0,0,0) 58%, rgba(0,0,0,0.55) 82%, rgba(0,0,0,1) 100%)',
      pointerEvents: 'none',
    } as React.CSSProperties}
  />
);

/* ------------------------------------------------------------------ */
/* KOD EFEKTİ 4 — FİLM VİNYETİ                                         */
/* ------------------------------------------------------------------ */
/**
 * PaperBase'te zaten bir vinyet var (kağıdın ışık düşüşü, sıcak). Bu ondan
 * ayrı: OBJEKTİFİN vinyeti — nötr, daha güçlü, köşelere kadar iner.
 *
 * Genlik doğrulayıcıya bakılarak seçildi: güvenli alan testi zeminden 110
 * seviyeden fazla sapan pikselleri "taşan içerik" sayıyor. Krem zemin ~215;
 * buradaki en koyu köşe onu ~160'a indiriyor, eşiğin rahat üstünde.
 */
export const LensVignette: React.FC<{strength?: number}> = ({strength = 0.19}) => (
  <AbsoluteFill
    style={{
      background: `radial-gradient(78% 62% at 50% 47%, rgba(0,0,0,0) 44%, rgba(8,6,4,${(strength * 0.42).toFixed(3)}) 76%, rgba(8,6,4,${strength.toFixed(3)}) 100%)`,
      pointerEvents: 'none',
    }}
  />
);

/* ------------------------------------------------------------------ */
/* KOD EFEKTİ 5 — POZLAMA TİTREMESİ (tek animasyonlu katman)           */
/* ------------------------------------------------------------------ */
/**
 * Film projektöründe kare başına ışık miktarı birebir aynı olmaz. O küçük
 * dalgalanma, donmuş bir kompozisyonu bile "oynuyor" gösteren şeydir — ve bizim
 * videonun ölçülen sorunu tam olarak donmuş aralıklardı (47 aralığın 19'unda
 * %1'in altında değişim).
 *
 * GENLİK ÖLÇÜLEREK SEÇİLDİ, tahminle değil:
 * kompozisyon kilidi tol=6 ile çalışıyor, yani iki kare arasında kanal başına
 * 6 seviyeden fazla sapan piksel "oynadı" sayılıyor. Krem zemin 228 seviyede;
 * A opaklıkta siyah bindirme onu 228·A kadar indirir. A=0.018 → 4.1 seviye,
 * eşiğin altında. A=0.03 seçilse kilit ölçümü kırılırdı.
 *
 * 12fps ADIMINDA: sürekli titreme kadans ölçümünü bozar (her kare farklı olur,
 * tutulan kare payı sıfıra düşer). Adıma oturtulunca titreme, hareketin geri
 * kalanıyla AYNI ızgarada yaşar.
 */
const FLICKER_AMPLITUDE = 0.018;

export const ExposureFlicker: React.FC<{amplitude?: number}> = ({amplitude = FLICKER_AMPLITUDE}) => {
  const frame = useCurrentFrame();
  const step = Math.floor(frame / (CANVAS.fps / CANVAS.posterizeFps));
  // İki farklı periyotta gürültü: tek sinüs "nabız" gibi okunur, film titremesi
  // düzensizdir. rand() deterministik, yani her render aynı titremeyi verir.
  const v = rand(step * 1.37) * 0.6 + rand(step * 0.53 + 11) * 0.4;
  const a = amplitude * (v - 0.5) * 2;
  const dark = Math.max(0, a);
  const light = Math.max(0, -a);
  return (
    <>
      <AbsoluteFill style={{background: '#000', opacity: dark, pointerEvents: 'none'}} />
      <AbsoluteFill style={{background: '#FFF8E8', opacity: light * 0.8, mixBlendMode: 'soft-light', pointerEvents: 'none'}} />
    </>
  );
};

/* ------------------------------------------------------------------ */
/* TOZ VE ÇİZİK — statik, ama kare başına DEĞİL sahne başına değişir    */
/* ------------------------------------------------------------------ */
/**
 * Film üzerindeki çizikler ve toz. Konum deterministik (rand(seed)) ve SABİT:
 * her karede yeni toz üretmek kompozisyon kilidini kırar. Sahne başına farklı
 * seed vermek de yanlış olurdu — çizik FİLME ait, sahneye değil, ve tüm film
 * boyunca aynı yerde durması doğru davranış.
 */
export const DustAndScratches: React.FC<{seed?: number; scratches?: number; specks?: number}> = ({
  seed = 23,
  scratches = 2,
  specks = 14,
}) => (
  <AbsoluteFill style={{pointerEvents: 'none', mixBlendMode: 'multiply'}}>
    {Array.from({length: scratches}, (_, i) => {
      const x = rand(seed * 3.7 + i) * CANVAS.width;
      const top = rand(seed * 5.1 + i * 2) * 0.62;
      // ÖLÇÜLDÜ: 0.25-0.85 uzunlukta çizikler render'da kareyi boydan boya
      // geçen dikey teller gibi okunuyordu — haritanın ve figürün üstünden
      // geçiyordu. Gerçek film çiziği KISA ve kesintili olur.
      const len = 0.08 + rand(seed * 7.9 + i) * 0.16;
      const w = 1;
      return (
        <div
          key={`s${i}`}
          style={{
            position: 'absolute',
            left: x,
            top: `${(top * 100).toFixed(1)}%`,
            width: w,
            height: `${(len * 100).toFixed(1)}%`,
            background: `rgba(40,30,18,${(0.05 + rand(seed + i) * 0.05).toFixed(3)})`,
            transform: `rotate(${((rand(seed * 11 + i) - 0.5) * 2.4).toFixed(2)}deg)`,
          }}
        />
      );
    })}
    {Array.from({length: specks}, (_, i) => {
      const r = 1 + rand(seed * 13.3 + i) * 3.2;
      return (
        <div
          key={`d${i}`}
          style={{
            position: 'absolute',
            left: rand(seed * 17.7 + i * 3) * CANVAS.width,
            top: rand(seed * 19.1 + i * 5) * CANVAS.height,
            width: r,
            height: r * (0.7 + rand(seed + i * 2) * 0.8),
            borderRadius: '50%',
            background: `rgba(30,22,12,${(0.09 + rand(seed * 23 + i) * 0.10).toFixed(3)})`,
          }}
        />
      );
    })}
  </AbsoluteFill>
);

/* ------------------------------------------------------------------ */
/* MOTOR                                                               */
/* ------------------------------------------------------------------ */

export interface FilmTreatmentProps {
  /** Tümünü birden ölçekler. 0 = kapalı, 1 = tasarlandığı yoğunluk. */
  intensity?: number;
  /** backdrop-filter destekli olmayan ortamlarda kapatmak için. */
  cornerBlur?: boolean;
  flicker?: boolean;
}

/**
 * Katman sırası ÖNEMLİ ve aşağıdan yukarı şu mantıkta:
 *   1. grunge   — emülsiyonun kiri, görüntünün İÇİNDE
 *   2. gren     — emülsiyonun tanesi
 *   3. toz/çizik— filmin YÜZEYİNDE
 *   4. jaluzi   — sahnedeki ışık (screen: karartmaz, ışıtır)
 *   5. tarama   — mekanik çoğaltma izi
 *   6. köşe blur— objektif
 *   7. vinyet   — objektif
 *   8. titreme  — projektör, en üstte çünkü her şeyi birlikte etkiler
 */
export const FilmTreatment: React.FC<FilmTreatmentProps> = ({
  intensity = 1,
  cornerBlur = true,
  flicker = true,
}) => {
  if (intensity <= 0) return null;
  const k = Math.min(1.5, intensity);
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <GrungeWash opacity={0.13 * k} />
      <FilmGrain opacity={0.24 * k} />
      <DustAndScratches />
      <VenetianLight opacity={0.07 * k} />
      <ScanLines opacity={0.055 * k} />
      {cornerBlur && <CornerBlur px={5} />}
      <LensVignette strength={0.19 * k} />
      {flicker && <ExposureFlicker amplitude={FLICKER_AMPLITUDE * k} />}
    </AbsoluteFill>
  );
};
