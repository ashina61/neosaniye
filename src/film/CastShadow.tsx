import React from 'react';

/**
 * CUTOUT'UN KENDİSİNDEN GÖLGE
 *
 * Rehberin tarifi kelimesi kelimesine şu: "aynı cutout'u kopyala, saf siyaha
 * boya, ayaklarından aşağı doğru çevir ve zemine yatması için yaklaşık -53°
 * skew ver; 7px bulanıklaştır ve %55 opaklığa düşür. Ayrı gölge görseli YOK."
 *
 * NEDEN BU KADAR ÖNEMLİ
 *
 * Cutout'un ALTINDA duran yumuşak drop-shadow (Cutout.tsx'teki LAYER_SHADOW)
 * öğeyi kağıttan bir milim kaldırır — sticker hissi verir, doğrudur, kalır.
 * Ama zemine UZANAN gölge başka bir şey söyler: öznenin bir ZEMİNDE, bir ışık
 * altında durduğunu. Kolajı "kesilmiş kağıt yığını"ndan "sahne"ye çeviren fark
 * bu tek katman.
 *
 * Ve bedava: yeni görsel üretilmiyor, aynı alfa maskesi ikinci kez çiziliyor.
 * Bu hattaki en pahalı kaynak görsel üretimi olduğu için önemli.
 *
 * TEKNİK NOT — brightness(0) neden çalışıyor:
 * Alfa kanallı PNG'de brightness(0) tüm renk kanallarını sıfırlar ama ALFAYI
 * korur. Sonuç: maskenin birebir siyah kopyası. Prosedürel siluetlerde de
 * çalışır (zaten siyah). filter zincirinin sırası önemli: brightness ÖNCE,
 * blur SONRA — ters sırada bulanık kenarlar da siyaha boyanır ve gölge sert
 * kenarlı çıkar.
 */

export interface CastShadowProps {
  /** Alfa kanallı görsel. Yoksa children ile siluet verilir. */
  src?: string;
  /**
   * Öznenin kutusu — gölge bunun ALT kenarından başlar.
   *
   * TAMAMEN VERİLMEZSE bileşen "ebeveynin ayak hattı" kipine geçer: konumu
   * yüzdeyle alır ve kendisini saran öğenin altına oturur. Cutout bunu böyle
   * kullanıyor; o sayede gölge, öznenin giriş/sürüklenme transformunu ekstra
   * bir kopya hesap olmadan MİRAS ALIR. Gölgeyi elle konumlandırmak, hareketi
   * iki yerde tutmak demekti ve iki yerde tutulan sayı bu projede daha önce
   * uyumsuzluğa yol açtı.
   */
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  /** Zemine yatma açısı. Rehberdeki ölçü -53°. */
  skew?: number;
  /** Gölgenin boyu, özne yüksekliğinin katı. 1 = birebir uzunluk. */
  length?: number;
  blur?: number;
  opacity?: number;
  /** enter()/drift() transformu — gölge özneyle BİRLİKTE hareket etmeli. */
  transform?: string;
  zIndex?: number;
  children?: React.ReactNode;
}

export const CastShadow: React.FC<CastShadowProps> = ({
  src,
  x,
  y,
  width,
  height,
  skew = -38,
  length = 0.5,
  blur = 7,
  opacity = 0.45,
  transform,
  zIndex = 0,
  children,
}) => {
  const absolute = x !== undefined && y !== undefined && width !== undefined && height !== undefined;
  /**
   * Kutu özneyle AYNI boyutta; kısalma `scaleY(-length)` ile yapılıyor, kutuyu
   * küçültmekle DEĞİL.
   *
   * NEDEN: kutuyu kısaltmak yalnızca `objectFit` ile ölçeklenen raster görselde
   * çalışıyordu. children olarak verilen SVG (çöp adam) kendi yüksekliğini
   * taşıdığı için kutudan taşıyor ve gölge hiç kısalmıyordu. Ölçek dönüşümü
   * içerik türünden bağımsız çalışır.
   */
  const box: React.CSSProperties = absolute
    ? {left: x, top: (y as number) + (height as number), width, height} // alt kenar = ayak hattı
    : {left: 0, top: '100%', width: '100%', height: '100%'};

  return (
    <div
      style={{
        position: 'absolute',
        ...box,
        zIndex,
        opacity,
        pointerEvents: 'none',
        // Sıralama: dış sarmalayıcı öznenin hareketini alır, iç sarmalayıcı
        // yatırma dönüşümünü. Tek transform'da birleştirilirse skew, giriş
        // kaymasını da eğer ve gölge özneden kopar.
        transform,
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          /**
           * DÖNÜŞÜM SIRASI KRİTİK — ilk sürümde TERSİ yazılmıştı ve render'da
           * gölge, figürden 850 piksel uzağa uzanan dev bir diyagonal çubuk
           * olarak çıktı.
           *
           * CSS dönüşümleri SAĞDAN SOLA uygulanır:
           *   skewX(a) scaleY(-L)  → önce y sıkıştırılır (y' = -L·y), sonra
           *     yatay kayma SIKIŞTIRILMIŞ y ile hesaplanır: L·h·tan(a).
           *     640px figür, L=0.5, a=38° → 250px kayma. Zemine yatmış gölge.
           *   scaleY(-L) skewX(a)  → kayma TAM y ile hesaplanır (h·tan(a) =
           *     850px), scaleY yalnızca dikeyi sıkıştırır. Ekranı boydan boya
           *     geçen çubuk.
           *
           * Yani "gölge yatırma" tarifinin doğru çalışması sıraya bağlı ve bunu
           * ancak render'a bakınca gördüm.
           */
          transform: `skewX(${skew}deg) scaleY(${-length})`,
          transformOrigin: 'center top',
          // Gölge kağıdı KARARTIR, üstüne boya sürmez. multiply olmadan
          // krem zeminde gri bir leke gibi durur.
          mixBlendMode: 'multiply',
          filter: `brightness(0) blur(${blur}px)`,
        }}
      >
        {src ? (
          <img src={src} style={{display: 'block', width: '100%', height: '100%', objectFit: 'contain'}} />
        ) : (
          children
        )}
      </div>
    </div>
  );
};

/**
 * ZEMİN LEKESİ — gölgenin ayak dibindeki en koyu noktası.
 *
 * Uzanan gölge tek başına öznenin havada durduğu izlenimi bırakır, çünkü
 * temas noktasında koyulaşma yok. Bu, ışık fiziğinin en kolay taklit edilen
 * parçası: temas noktasında ambient occlusion.
 */
export const ContactShadow: React.FC<{
  /** CastShadow ile aynı kural: verilmezse ebeveynin ayak hattına oturur. */
  x?: number;
  y?: number;
  width?: number;
  opacity?: number;
  transform?: string;
  zIndex?: number;
}> = ({x, y, width, opacity = 0.34, transform, zIndex = 0}) => {
  const absolute = x !== undefined && y !== undefined && width !== undefined;
  const box: React.CSSProperties = absolute
    ? {
        left: (x as number) + (width as number) * 0.08,
        top: (y as number) - (width as number) * 0.045,
        width: (width as number) * 0.84,
        height: (width as number) * 0.11,
      }
    : {left: '8%', top: '97%', width: '84%', height: '9%'};
  return (
    <div
      style={{
        position: 'absolute',
        ...box,
        zIndex,
        opacity,
        transform,
        borderRadius: '50%',
        background: 'radial-gradient(ellipse at 50% 50%, rgba(20,14,6,0.85) 0%, rgba(20,14,6,0) 72%)',
        mixBlendMode: 'multiply',
        filter: 'blur(5px)',
        pointerEvents: 'none',
      }}
    />
  );
};
