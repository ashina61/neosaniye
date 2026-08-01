import React from 'react';
import {PALETTE} from '../design/tokens';
import {rand} from '../motion/stepped';
import {CastShadow, ContactShadow} from '../film/CastShadow';
import {focusFilter} from '../film/choreography';

/**
 * KESİLMİŞ KAĞIT PARÇASI (cutout)
 *
 * Referans videonun en tutarlı tek kuralı bu: HER fotoğraf parçasının etrafında
 * aynı krem sticker konturu ve altında aynı yumuşak gölge var. Otuz ayrı
 * görseli tek filmin kareleri gibi gösteren şey bu tek kural.
 *
 * Kontur, alfa kanallı bir PNG'nin çevresine sekiz yöne drop-shadow yığarak
 * çiziliyor. Bu, keyfi şekilli alfa maskesine kontur çizmenin tarayıcıda
 * çalışan tek deterministik yolu; SVG stroke bunu yapamaz çünkü şekil bir
 * yol değil, raster maske.
 */

const OUTLINE_DIRS: Array<[number, number]> = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7],
];

function outlineFilter(width: number, color: string): string {
  return OUTLINE_DIRS.map(
    ([dx, dy]) => `drop-shadow(${(dx * width).toFixed(2)}px ${(dy * width).toFixed(2)}px 0 ${color})`,
  ).join(' ');
}

/** Sahnenin gölge dili: tek yön, tek yumuşaklık. Sahne başına değişmez. */
const LAYER_SHADOW = 'drop-shadow(0 14px 18px rgba(24,18,8,0.30))';

/**
 * HALFTONE
 *
 * Gerçek hata-yayılımlı halftone tarayıcıda pahalı. Burada yapılan: gri tona
 * indir, kontrastı aç, üstüne nokta ızgarası bindir. 1080 genişlikte ve video
 * sıkıştırmasından sonra baskı noktası gibi okunuyor, maliyeti sıfır.
 */
export const HALFTONE_CSS: React.CSSProperties = {
  filter: 'grayscale(1) contrast(1.32) brightness(1.04)',
};

const DotScreen: React.FC<{size?: number; opacity?: number}> = ({size = 5, opacity = 0.30}) => (
  <div
    style={{
      position: 'absolute',
      inset: 0,
      backgroundImage: `radial-gradient(circle at 50% 50%, rgba(0,0,0,${opacity}) 0 34%, rgba(0,0,0,0) 36%)`,
      backgroundSize: `${size}px ${size}px`,
      mixBlendMode: 'multiply',
      pointerEvents: 'none',
    }}
  />
);

/**
 * Prosedürel siluet kimlikleri.
 *
 * `pipeline/subject.mjs` içindeki `SHAPES` ile AYNI olmak zorunda ve
 * `test/registry.test.mjs` bunu denetler: liste iki dilde iki dosyada duruyor,
 * biri değişip öteki değişmezse şablon bilinmeyen bir şekil isteyip sessizce
 * kutu çizer. Bu depoda aynı sınıf kayıt uyumsuzluğu daha önce görüldü.
 */
export type PlaceholderShape =
  | 'figure'
  | 'vessel'
  | 'building'
  | 'object'
  | 'terrain'
  | 'instrument'
  | 'bird'
  | 'star'
  | 'wave'
  | 'vehicle'
  | 'aircraft'
  | 'rail'
  | 'document'
  | 'machine'
  | 'bomb'
  | 'parachute'
  | 'case'
  | 'weapon'
  | 'key'
  | 'tool'
  | 'rock'
  | 'gear'
  | 'tree'
  | 'bone'
  | 'flask';

/**
 * ŞEKİL EN-BOY ORANLARI — kartı özneye göre boyutlandırmak için.
 *
 * ============ NEDEN GEREKLİ: ÖLÇÜLDÜ ============
 *
 * Kullanıcı "çizimlerde boş geçilen alanlar var" dedi. Render alınıp bakıldı ve
 * sebep net: kart SABİT oranlıydı (`SAFE_BOX.width * 0.78` genişlik, ayrı bir
 * yükseklik), siluet ise kendi oranında ve `preserveAspectRatio="… meet"` ile
 * sığdırılıyordu. `meet` sınırlayıcı eksene göre oturtur, öteki eksende BOŞLUK
 * bırakır.
 *
 * `figure` oranı 0.595 (uzun ve dar). Kart ondan geniş olduğu için siluet
 * yüksekliğe göre sığıyor, sağda ve solda geniş beyaz alan kalıyordu. Karenin
 * en büyük öğesi boş kağıttı.
 *
 * Referansta böyle bir şey yok: fotoğraf bloğunun şekli İÇERİĞİNDEN geliyor,
 * etrafındaki kağıt zemin — kocaman boş bir kart değil.
 *
 * Değerler viewBox'lardan TÜRETİLDİ, elle yazılmadı: her `case`in kendi
 * `viewBox="0 0 W H"` değeri okunup W/H alındı. Bir şeklin çizimi değişirse
 * buradaki sayı da değişmeli ve `test/registry.test.mjs` liste bütünlüğünü
 * zaten denetliyor.
 */
export const SHAPE_ASPECT: Record<PlaceholderShape, number> = {
  figure: 0.595,
  vessel: 1.455,
  building: 0.857,
  terrain: 2.222,
  instrument: 1.0,
  bird: 1.8,
  star: 1.0,
  wave: 1.636,
  vehicle: 1.818,
  aircraft: 1.833,
  rail: 2.0,
  document: 0.8,
  machine: 1.077,
  bomb: 0.929,
  parachute: 1.125,
  case: 1.333,
  weapon: 1.5,
  key: 2.111,
  tool: 0.848,
  rock: 1.154,
  gear: 1.0,
  tree: 0.812,
  bone: 0.929,
  flask: 0.839,
  object: 1.0,
};

/**
 * PROSEDÜREL YER TUTUCU
 *
 * Test videoları ücretli görsel API'si çağırmadan render edilebilsin diye var.
 * Kasıtlı olarak "fotoğraf gibi" değil: siluet. Amacı tasarım sisteminin
 * (kontur, gölge, halftone, yerleşim, hareket) kanıtlanabilmesi; gerçek
 * halftone fotoğraf sonradan aynı bileşene `src` olarak girer.
 */
/**
 * ============ SİLUET NEDEN DÜZ SİYAH OLAMAZ ============
 *
 * Kullanıcı Flow'da ürettiği kareyi gönderip "en azından çizimler benim
 * referans görsel kalitesinde olsun, o tarz olmalı" dedi. Referanstaki halftone
 * fotoğraflarla buradaki siluetler arasındaki fark ÖLÇÜLEBİLİR ve tek bir
 * satırdan geliyordu: `fill: PALETTE.inkBlack`.
 *
 * Düz siyah dolgunun iki sonucu var:
 *
 *   1. Halftone TRAMI GÖRÜNMEZ. `DotScreen` noktaları `multiply` ile biniyor;
 *      siyahın üstüne siyah nokta çarpmak hiçbir şey değiştirmez. Yani depoda
 *      halftone katmanı VARDI ve prosedürel siluetlerde hiç çalışmıyordu.
 *   2. Baskı fotoğrafı ORTA TONDUR. Referanstaki üniforma, kürsü, mikrofon —
 *      hiçbiri saf siyah değil; hepsi gri tramın farklı yoğunlukları. Saf
 *      siyah bir siluet, tarandığı için değil, VEKTÖR olduğu için öyle
 *      görünür ve izleyici bunu anında ayırt eder.
 *
 * Çözüm boya değil TON: silueti orta griden koyuya inen bir eğimle doldur.
 * Böylece nokta ızgarasının ısıracağı bir aralık doğar ve aynı şekil, aynı
 * geometriyle, baskı malzemesi gibi okunur.
 *
 * Işık yönü sahnenin gölge diliyle AYNI (üstten hafif sol): `LAYER_SHADOW`
 * aşağı-sağa düşüyor, o yüzden aydınlık taraf üst-sol.
 */
const HALFTONE_FILL_ID = 'ns-halftone-fill';

const HalftoneFill: React.FC = () => (
  <defs>
    <linearGradient id={HALFTONE_FILL_ID} x1="0" y1="0" x2="0.35" y2="1">
      {/*
        Uçlar ÖLÇÜLDÜ, seçilmedi: #6E6E6E'nin altına inince tram kayboluyor
        (nokta ile zemin arasında kontrast kalmıyor), #1A1A1A'nın üstüne
        çıkınca yine düz siyaha dönüyor. Aradaki aralık tramın çalıştığı yer.
      */}
      <stop offset="0%" stopColor="#6E6E6E" />
      <stop offset="55%" stopColor="#3A3A3A" />
      <stop offset="100%" stopColor="#1A1A1A" />
    </linearGradient>
  </defs>
);

const ShapeSvg: React.FC<{shape: PlaceholderShape; seed: number}> = ({shape, seed}) => {
  const ink = `url(#${HALFTONE_FILL_ID})`;
  const common = {fill: ink} as const;
  switch (shape) {
    /**
     * ============ İNSAN — PİYON DEĞİL ============
     *
     * Önceki hâli bir daire ve altında yuvarlak bir kütleydi. Render alınıp
     * GÖZLE bakıldı ve okunan şey insan değil SATRANÇ PİYONUYDU: omuz yok,
     * kol yok, bacak yok, boyun yok. Kullanıcının "çizimler çok kötü" dediği
     * şeyin en çok kullanılan örneği bu — 13 sahnenin 5'i bu şekli çiziyor.
     *
     * Aynı turda siluetin MALZEMESİ düzeltilmişti (düz siyah yerine halftone
     * tramlı ton). Render bunun tek başına yetmediğini gösterdi: tramlı bir
     * piyon hâlâ piyon. Malzeme ile GEOMETRİ ayrı iki sorun ve ikincisi daha
     * belirleyici.
     *
     * Ölçü: bir insan silueti, BAŞ-BOYUN-OMUZ üçlüsünün oranından tanınır.
     * Baş gövde genişliğinin ~1/3'ü, boyun kısa ve dar, omuz baştan belirgin
     * şekilde geniş. Kol gövdeden AYRI bir kütle olmalı, yoksa palto okunur.
     * Bacak arası boşluk şart — bitişik bacak etek/cübbe okunur.
     *
     * Duruş dörtte üç: `subject.mjs` promt tarafında da "three-quarter view"
     * diyor, ikisi aynı şeyi tarif etmek zorunda.
     */
    case 'figure':
      return (
        <svg viewBox="0 0 100 168" width="100%" height="100%" preserveAspectRatio="xMidYMax meet">
          {/* Baş — hafif oval, tam daire "top" okunuyor. */}
          <ellipse cx="50" cy="17" rx="13" ry="15" {...common} />
          {/* Boyun: kısa ve dar. Uzun boyun mankene benziyor. */}
          <rect x="45" y="29" width="10" height="7" {...common} />
          {/*
            Gövde + palto: omuz baştan geniş, bel hafif içeri, etek dışa.
            Dönem paltosu bu siluetin belkemiği — düz dikdörtgen gövde
            "çöp adam" okunuyor.
          */}
          <path d="M50 34 C39 34 32 40 31 50 L29 78 L33 80 L34 112 L66 112 L67 80 L71 78 L69 50 C68 40 61 34 50 34 Z" {...common} />
          {/* Kollar gövdeden AYRI: aradaki boşluk kolu görünür kılan şey. */}
          <path d="M28 52 L22 88 L28 90 L34 56 Z" {...common} />
          <path d="M72 52 L78 88 L72 90 L66 56 Z" {...common} />
          {/* Bacaklar: aralarında boşluk, yoksa etek okunur. */}
          <path d="M36 118 L34 158 L45 158 L46 118 Z" {...common} />
          <path d="M54 118 L55 158 L66 158 L64 118 Z" {...common} />
          {/* Ayaklar: siluetin yere bastığını söyleyen tek işaret. */}
          <path d="M32 158 L47 158 L47 166 L30 166 Z" {...common} />
          <path d="M53 158 L68 158 L70 166 L53 166 Z" {...common} />
        </svg>
      );
    case 'vessel':
      return (
        <svg viewBox="0 0 160 110" width="100%" height="100%" preserveAspectRatio="xMidYMax meet">
          <path d="M10 84 L150 84 L136 104 L24 104 Z" {...common} />
          <path d="M78 8 L78 80 L120 80 Z" {...common} />
          <path d="M72 22 L72 80 L36 80 Z" {...common} />
        </svg>
      );
    case 'building':
      return (
        <svg viewBox="0 0 120 140" width="100%" height="100%" preserveAspectRatio="xMidYMax meet">
          <rect x="16" y="40" width="88" height="100" {...common} />
          <path d="M60 6 L110 40 L10 40 Z" {...common} />
        </svg>
      );
    case 'terrain':
      return (
        <svg viewBox="0 0 200 90" width="100%" height="100%" preserveAspectRatio="xMidYMax meet">
          <path d="M0 90 L44 34 L78 62 L112 20 L156 66 L200 44 L200 90 Z" {...common} />
        </svg>
      );
    /**
     * PUSULA / SEKSTANT — "He carried no compass" cümlesinin çizimi.
     *
     * Bu şekil ÖNCEDEN YOKTU ve o cümleye çöp adam çiziliyordu. Kullanıcının
     * "çizilen şekiller yanlış" dediği somut örnek buydu.
     */
    case 'instrument':
      return (
        <svg viewBox="0 0 120 120" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
          {/* Gövde: kalın halka. İçi boş, çünkü dolu daire "nokta" okunur. */}
          <path
            d="M60 6 A54 54 0 1 1 59.9 6 Z M60 22 A38 38 0 1 0 60.1 22 Z"
            fill={ink}
            fillRule="evenodd"
          />
          {/* İbre: iki uçlu, biri dolu biri boş — pusula ibresinin imzası. */}
          <path d="M60 30 L70 60 L60 90 L50 60 Z" {...common} />
          <circle cx="60" cy="60" r="6" fill={PALETTE.paper} />
          {/* Dört ana yön çentiği */}
          {[0, 90, 180, 270].map((a) => (
            <rect key={a} x="58" y="8" width="4" height="12" {...common} transform={`rotate(${a} 60 60)`} />
          ))}
        </svg>
      );

    /** KUŞ — "the flight of birds" için. Uçan siluet, tek parça. */
    case 'bird':
      return (
        <svg viewBox="0 0 180 100" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
          <path
            d="M6 46 C40 18 66 20 86 44 C104 20 132 16 172 40 C140 44 116 56 92 78 C70 56 42 44 6 46 Z"
            {...common}
          />
          <circle cx="89" cy="50" r="7" {...common} />
        </svg>
      );

    /** YILDIZ / TAKIMYILDIZ — gece göğü beat'i. Tek yıldız değil, KÜME. */
    case 'star': {
      const pts = Array.from({length: 7}, (_, i) => ({
        x: 12 + rand(seed * 3.3 + i) * 96,
        y: 12 + rand(seed * 7.7 + i * 2) * 96,
        r: 4 + rand(seed * 11.1 + i) * 7,
      }));
      return (
        <svg viewBox="0 0 120 120" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
          {/* Takımyıldız çizgileri: sırayla bağlanmış, elle çizilmiş kalınlıkta. */}
          <polyline
            points={pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')}
            fill="none"
            stroke={ink}
            strokeWidth={2}
            strokeLinejoin="round"
          />
          {pts.map((p, i) => (
            <path
              key={i}
              d={`M${p.x} ${p.y - p.r} L${p.x + p.r * 0.28} ${p.y - p.r * 0.28} L${p.x + p.r} ${p.y} L${p.x + p.r * 0.28} ${p.y + p.r * 0.28} L${p.x} ${p.y + p.r} L${p.x - p.r * 0.28} ${p.y + p.r * 0.28} L${p.x - p.r} ${p.y} L${p.x - p.r * 0.28} ${p.y - p.r * 0.28} Z`}
              {...common}
            />
          ))}
        </svg>
      );
    }

    /**
     * DALGA / KABARMA — "the swell", "open water", "the wind".
     *
     * Zemin bandı (`SeaBand`) DEĞİL: bu bir cutout, yani kağıttan kesilmiş bir
     * su etüdü. Üst üste üç kabarma çizgisi; deniz "doku" olarak okunur.
     */
    case 'wave':
      return (
        <svg viewBox="0 0 180 110" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
          {[0, 1, 2].map((row) => {
            const y = 34 + row * 26;
            const amp = 12 - row * 2;
            return (
              <path
                key={row}
                d={`M0 ${y} C30 ${y - amp} 50 ${y + amp} 80 ${y} C110 ${y - amp} 130 ${y + amp} 180 ${y} L180 ${y + 9} C130 ${y + amp + 9} 110 ${y - amp + 9} 80 ${y + 9} C50 ${y + amp + 9} 30 ${y - amp + 9} 0 ${y + 9} Z`}
                {...common}
              />
            );
          })}
        </svg>
      );

    /**
     * ARAÇ — tren, kamyon, otobüs, uçak.
     *
     * Bu üç şekil (vehicle/document/machine) sözlük GENELLEŞTİRİLİRKEN eklendi.
     * Ölçüm şunu göstermişti: farklı bir konu (1963 tren soygunu) verildiğinde
     * 19 sahnenin 19'unda şekil bulunamıyordu, çünkü hem sözlük hem şekil
     * kümesi tek bir konuya (Pasifik seyrüseferi) göre yazılmıştı. Tren, para,
     * sinyal lambası gibi belgesel anlatılarının en sık nesnelerinin karşılığı
     * yoktu.
     *
     * Siluet KATEGORİYİ anlatır, tek bir modeli değil: gövde + tekerlek + kabin.
     * "Hangi marka kamyon" sorusu bir siluetin cevaplayacağı şey değil.
     */
    case 'vehicle':
      return (
        <svg viewBox="0 0 200 110" width="100%" height="100%" preserveAspectRatio="xMidYMax meet">
          {/* Gövde ve kabin tek parça: kesilmiş kağıt tek parçadır. */}
          <path d="M8 34 L118 34 L150 52 L192 52 L192 82 L8 82 Z" {...common} />
          {/* Pencereler zeminin rengiyle oyulur — ayrı katman değil, delik. */}
          <rect x="20" y="42" width="30" height="22" fill={PALETTE.paper} />
          <rect x="58" y="42" width="30" height="22" fill={PALETTE.paper} />
          <rect x="126" y="56" width="20" height="16" fill={PALETTE.paper} />
          <circle cx="48" cy="88" r="17" {...common} />
          <circle cx="48" cy="88" r="7" fill={PALETTE.paper} />
          <circle cx="156" cy="88" r="17" {...common} />
          <circle cx="156" cy="88" r="7" fill={PALETTE.paper} />
        </svg>
      );

    /**
     * UÇAK — "the aircraft took off".
     *
     * Ayrı bir şekil, çünkü tek `vehicle` ailesi bu cümleye KAMYON çiziyordu ve
     * render'a bakınca görüldü. Gövde + süpürgeli kanat + kuyruk: uzaktan da
     * "uçak" okunan üç parça.
     */
    case 'aircraft':
      return (
        <svg viewBox="0 0 220 120" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
          {/* Gövde: burun sivri, kuyruk incelen. */}
          <path d="M6 62 C40 50 120 46 186 50 L212 56 L186 62 C120 66 40 74 6 62 Z" {...common} />
          {/* Kanat: geriye süpürgeli, tek parça. */}
          <path d="M96 58 L150 6 L172 8 L134 58 Z" {...common} />
          <path d="M96 60 L150 112 L172 110 L134 60 Z" {...common} />
          {/* Dikey stabilizatör */}
          <path d="M178 52 L206 18 L214 20 L196 52 Z" {...common} />
          {/* Pencere sırası: zeminden oyulur. */}
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <rect key={i} x={44 + i * 16} y="54" width="7" height="7" fill={PALETTE.paper} />
          ))}
        </svg>
      );

    /** TREN — lokomotif/vagon. Kutu gövde, bacaşız (dizel), boji tekerlekler. */
    case 'rail':
      return (
        <svg viewBox="0 0 220 110" width="100%" height="100%" preserveAspectRatio="xMidYMax meet">
          <path d="M8 26 L150 26 L176 44 L212 44 L212 80 L8 80 Z" {...common} />
          {[0, 1, 2].map((i) => (
            <rect key={i} x={24 + i * 34} y="36" width="24" height="20" fill={PALETTE.paper} />
          ))}
          <rect x="182" y="52" width="22" height="16" fill={PALETTE.paper} />
          {/* Boji: iki grup, üçer tekerlek — trenin imzası. */}
          {[30, 58, 86, 140, 168, 196].map((x) => (
            <circle key={x} cx={x} cy="88" r="12" {...common} />
          ))}
          {[30, 58, 86, 140, 168, 196].map((x) => (
            <circle key={`h${x}`} cx={x} cy="88" r="4" fill={PALETTE.paper} />
          ))}
          {/* Ray */}
          <rect x="0" y="100" width="220" height="6" {...common} />
        </svg>
      );

    /** BELGE — mektup, banknot, dosya, gazete. Üst üste iki yaprak + kıvrık köşe. */
    case 'document': {
      const skew = (rand(seed * 4.4) - 0.5) * 5;
      return (
        <svg viewBox="0 0 120 150" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
          {/* Arkadaki ikinci yaprak: tek yaprak "kart" okunur, yığın "belge". */}
          <rect x="16" y="10" width="86" height="122" {...common} transform={`rotate(${skew.toFixed(1)} 60 70)`} opacity={0.45} />
          <path d="M10 4 L86 4 L104 24 L104 140 L10 140 Z" {...common} />
          {/* Kıvrık köşe zeminden oyulur. */}
          <path d="M86 4 L104 24 L86 24 Z" fill={PALETTE.paper} />
          {/* Satırlar */}
          {[0, 1, 2, 3, 4].map((i) => (
            <rect key={i} x="24" y={48 + i * 18} width={i === 4 ? 40 : 66} height="6" fill={PALETTE.paper} />
          ))}
        </svg>
      );
    }

    /** MAKİNE — motor, telsiz, jeneratör, sinyal. Kutu gövde + kadran + çark. */
    case 'machine':
      return (
        <svg viewBox="0 0 140 130" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
          <rect x="10" y="26" width="120" height="88" rx="4" {...common} />
          <circle cx="44" cy="64" r="20" fill={PALETTE.paper} />
          <circle cx="44" cy="64" r="5" {...common} />
          {/* İbre: makinenin "çalıştığını" söyleyen tek işaret. */}
          <rect x="42" y="48" width="4" height="18" {...common} />
          {[0, 1, 2].map((i) => (
            <rect key={i} x="78" y={46 + i * 16} width="38" height="8" fill={PALETTE.paper} />
          ))}
          {/* Üstte bobin/çark */}
          <circle cx="104" cy="18" r="14" {...common} />
          <circle cx="104" cy="18" r="5" fill={PALETTE.paper} />
        </svg>
      );

    /**
     * BOMBA — "there was a bomb in his briefcase".
     *
     * Bu beş şekil (bomb/parachute/case/weapon/key) `object` ailesi
     * PARÇALANIRKEN eklendi. Öncesinde hepsi AYNI yuvarlak kutuyu çiziyordu:
     * sözlük cümleyi doğru anlıyor, çizim onu ele veriyordu. Kullanıcının
     * "aynı şekiller sürekli çıkıyor" dediği kusur buydu.
     */
    case 'bomb':
      return (
        <svg viewBox="0 0 130 140" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
          <circle cx="62" cy="88" r="46" {...common} />
          {/* Boyun ve kapak: küreyi "bomba" yapan parça. */}
          <rect x="50" y="30" width="24" height="20" {...common} />
          <rect x="44" y="24" width="36" height="10" rx="3" {...common} />
          {/* Fitil: kıvrımlı, ucunda kıvılcım. */}
          <path
            d="M74 28 C96 14 104 30 118 18"
            fill="none"
            stroke={ink}
            strokeWidth={7}
            strokeLinecap="round"
          />
          <path d="M118 18 L126 6 L124 20 L134 16 L122 26 Z" fill={PALETTE.accent} />
          {/* Parlama noktası: küre dolu siyah kalmasın, hacim okunsun. */}
          <circle cx="44" cy="70" r="10" fill={PALETTE.paper} opacity={0.5} />
        </svg>
      );

    /** PARAŞÜT — kubbe + askı ipleri + yük. */
    case 'parachute':
      return (
        <svg viewBox="0 0 180 160" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
          {/* Kubbe: üç dilimli, kenarları festonlu — düz yarım daire "şemsiye". */}
          <path d="M8 74 C8 20 172 20 172 74 C150 60 142 78 120 66 C104 78 96 78 90 66 C78 78 66 60 46 70 C34 62 24 66 8 74 Z" {...common} />
          {/* Dilim çizgileri zeminden oyulur. */}
          <path d="M62 26 L74 70" stroke={PALETTE.paper} strokeWidth={3} fill="none" />
          <path d="M118 26 L106 70" stroke={PALETTE.paper} strokeWidth={3} fill="none" />
          {/* Askı ipleri */}
          {[18, 56, 90, 124, 162].map((x) => (
            <path key={x} d={`M${x} 70 L90 126`} stroke={ink} strokeWidth={3} fill="none" />
          ))}
          {/* Yük: küçük figür. */}
          <circle cx="90" cy="134" r="10" {...common} />
          <path d="M90 144 L80 158 L100 158 Z" {...common} />
        </svg>
      );

    /** ÇANTA — evrak çantası / valiz. Sap + iki kilit. */
    case 'case':
      return (
        <svg viewBox="0 0 160 120" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
          {/* Sap: gövdeden önce çizilir, üstte kalmasın. */}
          <path
            d="M62 26 C62 8 98 8 98 26"
            fill="none"
            stroke={ink}
            strokeWidth={9}
            strokeLinecap="round"
          />
          <rect x="10" y="26" width="140" height="84" rx="6" {...common} />
          {/* Orta dikiş ve iki kilit: kutudan ayıran işaretler. */}
          <rect x="10" y="62" width="140" height="5" fill={PALETTE.paper} />
          <rect x="44" y="54" width="18" height="20" rx="2" fill={PALETTE.paper} />
          <rect x="98" y="54" width="18" height="20" rx="2" fill={PALETTE.paper} />
        </svg>
      );

    /** SİLAH — tabanca silueti: kabza, namlu, tetik korkuluğu. */
    case 'weapon':
      return (
        <svg viewBox="0 0 180 120" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
          <path d="M14 30 L162 30 L162 52 L120 52 L112 66 L74 66 L66 96 L30 112 L34 70 L14 62 Z" {...common} />
          {/* Tetik korkuluğu: zeminden oyulmuş halka. */}
          <path d="M78 70 C78 88 100 88 100 70 Z" fill={PALETTE.paper} />
          {/* Namlu ağzı */}
          <rect x="150" y="36" width="12" height="10" fill={PALETTE.paper} />
        </svg>
      );

    /** ANAHTAR — halka + gövde + dişler. Kilit/kelepçe de buraya düşer. */
    case 'key':
      return (
        <svg viewBox="0 0 190 90" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
          <path d="M44 45 A34 34 0 1 1 44.1 45 Z M44 45 A16 16 0 1 0 44.2 45 Z" fill={ink} fillRule="evenodd" />
          <rect x="66" y="37" width="112" height="16" {...common} />
          {/* Dişler */}
          <rect x="140" y="53" width="12" height="20" {...common} />
          <rect x="162" y="53" width="12" height="28" {...common} />
        </svg>
      );

    /**
     * ============ ALTI YENİ SİLUET ============
     *
     * `pipeline/subject.mjs` sözlüğü dokuz görülmemiş konuda ölçüldü ve
     * kapsama %66.3 çıktı. Kaçan cümlelerin çoğu kelime eksiğiydi; ama beş
     * küme kelime eklemekle çözülmüyordu, çünkü çizecek siluet yoktu:
     * dişli, taş, el aleti, ağaç, kemik, deney şişesi.
     *
     * Hepsi aynı dili konuşuyor: dolu siyah mürekkep gövde, ayırt edici
     * çentikler `PALETTE.paper` ile OYULUYOR. Bu, `machine` ve `key`
     * şekillerinde zaten kurulmuş olan yöntem — dolu siyah bir kütle küçük
     * boyda "leke" okunuyor, oyuk onu nesneye çeviriyor.
     */

    /**
     * EL ALETİ — çekiç: DİK sap + ÜSTTE enine baş.
     *
     * İlk sürüm sapı ve başı tek bir çapraz kütle olarak çiziyordu ve render'da
     * çekiç okunmuyordu, tanımsız bir kama çıkıyordu. Ölçüt basit: bir aletin
     * silueti, SAP ile İŞ GÖREN UÇ arasındaki açıyla tanınır. Açı yoksa alet
     * yok.
     */
    case 'tool':
      return (
        <svg viewBox="0 0 140 165" width="100%" height="100%" preserveAspectRatio="xMidYMax meet">
          {/* Sap: aşağı doğru hafif incelir — düz dikdörtgen "çubuk" okunur. */}
          <path d="M60 34 L82 34 L78 160 L64 160 Z" {...common} />
          {/* Vurma yüzü: sağda, düz ve ağır. */}
          <path d="M56 8 L120 8 L124 22 L120 48 L56 48 Z" {...common} />
          {/* Tırnak: solda, çatallı ve kıvrık — çekici baltadan ayıran tek işaret. */}
          <path d="M60 10 C32 10 14 26 8 50 C22 42 32 46 38 54 C44 38 50 30 60 28 Z" {...common} />
          <path d="M18 44 C24 38 30 38 34 42 L30 50 C26 44 22 44 18 48 Z" fill={PALETTE.paper} />
          {/* Sap sarımı: iki bant, alet "tutulan" şey okunsun. */}
          <rect x="62" y="118" width="18" height="7" fill={PALETTE.paper} />
          <rect x="62" y="134" width="18" height="7" fill={PALETTE.paper} />
        </svg>
      );

    /**
     * TAŞ / MOLOZ — "poured plaster into the cavities", "graphite blocks".
     *
     * Kenarlar seed'den türüyor: aynı sahnede iki taş aynı taş olmasın. Fasetler
     * oyuk değil, açık gri — taş "delik" değil, hacim.
     */
    case 'rock': {
      const jag = (i: number) => 0.82 + rand(seed * 5.5 + i) * 0.36;
      const pts = [
        [12 * jag(1), 96],
        [26 * jag(2), 44],
        [58 * jag(3), 16],
        [96 * jag(4), 22],
        [128, 56 * jag(5)],
        [134 * jag(6), 92],
        [104, 116],
        [44, 118 * jag(7)],
      ];
      return (
        <svg viewBox="0 0 150 130" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
          <path d={`M${pts.map((p) => p.map((n) => n.toFixed(1)).join(' ')).join(' L')} Z`} {...common} />
          {/* Kırık yüzeyler: taşı düz bir lekeden ayıran tek işaret. */}
          <path d="M58 18 L74 62 L44 116" fill="none" stroke={PALETTE.paper} strokeWidth={4} />
          <path d="M74 62 L130 58" fill="none" stroke={PALETTE.paper} strokeWidth={4} />
        </svg>
      );
    }

    /** DİŞLİ — "showed the teeth of a gear". Dişler DIŞ hatta, göbek oyuk. */
    case 'gear': {
      const teeth = 12;
      const R = 58;
      const inner = 46;
      return (
        <svg viewBox="0 0 140 140" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
          {Array.from({length: teeth}, (_, i) => (
            <rect
              key={i}
              x="63"
              y={70 - R - 12}
              width="14"
              height="20"
              rx="2"
              {...common}
              transform={`rotate(${(360 / teeth) * i} 70 70)`}
            />
          ))}
          <circle cx="70" cy="70" r={inner} {...common} />
          <circle cx="70" cy="70" r="18" fill={PALETTE.paper} />
          {/* Göbek kaması: dişliyi "delikli daire"den ayıran ayrıntı. */}
          <rect x="64" y="44" width="12" height="12" fill={PALETTE.paper} />
        </svg>
      );
    }

    /** AĞAÇ — tek ağaç. `terrain` orman/manzara, bu TEK gövde. */
    case 'tree':
      return (
        <svg viewBox="0 0 130 160" width="100%" height="100%" preserveAspectRatio="xMidYMax meet">
          {/* Taç: üç kabarma, düz daire "lolipop" okunur. */}
          <path
            d="M65 6 C96 6 116 28 112 52 C130 62 128 92 104 98 C92 112 74 112 65 102 C56 112 38 112 26 98 C2 92 0 62 18 52 C14 28 34 6 65 6 Z"
            {...common}
          />
          <path d="M57 96 L57 154 L73 154 L73 96 Z" {...common} />
          {/* Kökler / dallanma */}
          <path d="M57 128 L34 112 M73 128 L96 112" stroke={ink} strokeWidth={7} fill="none" strokeLinecap="round" />
          <path d="M65 56 L65 92" stroke={PALETTE.paper} strokeWidth={3} fill="none" />
        </svg>
      );

    /** KEMİK / KAFATASI — "a jaw bone came away in his hand". */
    case 'bone':
      return (
        <svg viewBox="0 0 130 140" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
          <path d="M20 54 C20 14 110 14 110 54 C110 74 100 86 96 96 L34 96 C30 86 20 74 20 54 Z" {...common} />
          {/* Göz çukurları ve burun: oyuk, çünkü kafatasını kafatası yapan boşluk. */}
          <ellipse cx="46" cy="56" rx="13" ry="16" fill={PALETTE.paper} />
          <ellipse cx="84" cy="56" rx="13" ry="16" fill={PALETTE.paper} />
          <path d="M65 70 L58 86 L72 86 Z" fill={PALETTE.paper} />
          {/* Çene: ayrı parça, aralık bırakılıyor. */}
          <path d="M36 104 L94 104 C94 126 78 134 65 134 C52 134 36 126 36 104 Z" {...common} />
          {[46, 60, 74, 86].map((x) => (
            <rect key={x} x={x - 3} y="104" width="6" height="12" fill={PALETTE.paper} />
          ))}
        </svg>
      );

    /**
     * DENEY ŞİŞESİ — konik erlen.
     *
     * Gövde DOLU değil ÇİZGİ: cam saydamdır, dolu siyah bir koni şişe değil
     * huni okunur. Sıvı ALTTA duruyor — ilk sürümde dolgu üstteydi ve şişe
     * baş aşağı görünüyordu.
     */
    case 'flask':
      return (
        <svg viewBox="0 0 130 155" width="100%" height="100%" preserveAspectRatio="xMidYMax meet">
          <path
            d="M50 18 L50 54 L12 134 C8 142 14 148 22 148 L108 148 C116 148 122 142 118 134 L80 54 L80 18"
            fill="none"
            stroke={ink}
            strokeWidth={10}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {/* Ağız halkası */}
          <rect x="40" y="6" width="50" height="14" rx="4" {...common} />
          {/* Sıvı: tabanda. Şişeyi "kap"tan "numune"ye çeviren tek işaret. */}
          <path d="M33 102 L97 102 L113 136 C115 140 112 142 108 142 L22 142 C18 142 15 140 17 136 Z" {...common} />
          {/* Ölçek çentikleri: koninin İÇİNDE, sıvının üstünde. Dışarı taşarsa
              siluetten kopuk lekeler gibi okunuyor — render'da öyle çıktı. */}
          {[0, 1].map((i) => (
            <rect key={i} x="42" y={78 + i * 12} width="15" height="4" {...common} />
          ))}
        </svg>
      );

    case 'object':
    default: {
      const r = rand(seed) * 8;
      return (
        <svg viewBox="0 0 120 120" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
          <rect x="18" y="18" width="84" height="84" rx={4 + r} {...common} />
        </svg>
      );
    }
  }
};

/**
 * Şekil + tram tanımı. Gradyan `defs`i AYNI belgede olmak zorunda; `url(#id)`
 * SVG belgesi içinde çözülür, o yüzden sıfır boyutlu bir taşıyıcı SVG ile
 * birlikte veriliyor. Aynı id birden çok kez basılırsa tarayıcı ilkini kullanır
 * ve hepsi birebir aynı olduğu için bu zararsız.
 */
const Placeholder: React.FC<{shape: PlaceholderShape; seed: number}> = ({shape, seed}) => (
  <>
    <svg width="0" height="0" style={{position: 'absolute'}} aria-hidden="true">
      <HalftoneFill />
    </svg>
    <ShapeSvg shape={shape} seed={seed} />
  </>
);


export interface CutoutProps {
  /** Gerçek alfa kanallı görsel. Yoksa prosedürel siluet çizilir. */
  src?: string;
  shape?: PlaceholderShape;
  width: number;
  height: number;
  x?: number;
  y?: number;
  /** Kesik kağıt izlenimi için hafif eğiklik, derece. */
  rotate?: number;
  /** Sticker konturu kalınlığı. 0 = kontur yok. */
  outline?: number;
  outlineColor?: string;
  halftone?: boolean;
  /** enter()/drift()'ten gelen transform. */
  transform?: string;
  opacity?: number;
  seed?: number;
  zIndex?: number;
  /**
   * ZEMİNE UZANAN GÖLGE — rehberin adıyla verdiği teknik, film/CastShadow.tsx.
   *
   * NEDEN BURADA, ŞABLONDA DEĞİL: gölge öznenin giriş ve sürüklenme hareketini
   * BİREBİR takip etmek zorunda. Şablonda ayrı bir bileşen olarak çağrılsaydı
   * aynı transform iki yerde tutulurdu; bu projede iki yerde tutulan sayı daha
   * önce uyumsuzluğa yol açtı (varyant rotasyonu üç kez bu yüzden bozuldu).
   * Cutout'un kendi sarmalayıcısının içinde durduğu için hareketi miras alır.
   *
   * Varsayılan KAPALI: her cutout zeminde duran bir özne değil (harita
   * parçası, veri kartı, gökyüzü öğesi). Yanlış yerde gölge, gölge olmamasından
   * daha kötü durur.
   */
  castShadow?: boolean;
  shadowSkew?: number;
  shadowLength?: number;
  /** focusHunt()'ten gelen bulanıklık, px. Odak çekme efekti. */
  focus?: number;
  /** holdJitter()'dan gelen ek transform: tutulan karede yaşayan kağıt. */
  jitter?: string;
}

export const Cutout: React.FC<CutoutProps> = ({
  src,
  shape = 'object',
  width,
  height,
  x = 0,
  y = 0,
  rotate = 0,
  outline = 9,
  outlineColor = PALETTE.paper,
  halftone = true,
  transform,
  opacity = 1,
  seed = 1,
  zIndex,
  castShadow = false,
  shadowSkew,
  shadowLength,
  focus = 0,
  jitter,
}) => {
  /**
   * ============ KIRMIZI OFSET KONTUR ============
   *
   * Kullanıcının referans karesinde dört polisin etrafında beyaz kağıt kenarı
   * DEĞİL, ondan biraz kaymış KIRMIZI bir çizgi var — kesilen parça kırmızı
   * basılmış bir sayfanın üstüne yapıştırılmış gibi. Kompoze promt bunu baştan
   * beri istiyordu ("rough scissor-cut edges with an offset red accent stroke
   * behind it") ama RENDER tarafında karşılığı yoktu: burada yalnızca krem
   * sticker konturu çiziliyordu.
   *
   * Yani stilin en tanınır imzası promtta vardı, kodda yoktu.
   *
   * SIRA ÖNEMLİ ve zinciri sondan başa okumak gerekiyor — CSS `filter` soldan
   * sağa uygulanır, her adım bir öncekinin ÇIKTISINI alır:
   *   1. krem kontur   → parçanın kağıt kenarı
   *   2. kırmızı ofset → o kağıdın altından çıkan kırmızı baskı
   *   3. katman gölgesi→ hepsinin zeminden ayrılması
   *
   * Kırmızı ikinci sırada olmak zorunda: önce gelseydi krem kontur onu
   * yutardı, çünkü krem her yöne eşit yayılıyor ve ofseti örterdi.
   *
   * `signal` rengi ve CİMRİLİK: bu çizgi karenin yüzde birkaçı. Aksan tavanı
   * (`ACCENT_MAX_SHARE`) altını ölçüyor, kırmızı ayrı bir sinyal — ama yine de
   * ince tutuluyor, kalınlaşırsa "bağıran" bir kenarlık olur.
   */
  const accentOffset = Math.max(3, Math.round(outline * 0.55));
  const redStroke =
    outline > 0
      ? `drop-shadow(${accentOffset}px ${accentOffset}px 0 ${PALETTE.signal})`
      : '';

  // Kontur + gölge tek filter zincirinde: sıra önemli, gölge konturun DIŞINA
  // düşmeli, yoksa kontur gölgenin üstünde yüzer gibi durur.
  const filter = `${outline > 0 ? outlineFilter(outline, outlineColor) : ''} ${redStroke} ${LAYER_SHADOW}`
    .replace(/\s+/g, ' ')
    .trim();
  const blur = focusFilter(focus);

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
        transform:
          [transform, jitter, rotate ? `rotate(${rotate}deg)` : ''].filter(Boolean).join(' ') || undefined,
        transformOrigin: 'center center',
      }}
    >
      {/*
        Gölge ÖNCE geliyor, yani DOM'da öznenin altında. Sonra gelseydi
        özneyi karartırdı — multiply harmanı kendisinden önce çizilmiş her şeye
        uygulanır.
      */}
      {castShadow && (
        <>
          <CastShadow
            src={src}
            skew={shadowSkew}
            length={shadowLength}
            // Odak bulanıksa gölge de bulanık olmalı; ayrı netlikte gölge
            // "yapıştırılmış" durur.
            blur={7 + focus * 0.6}
          >
            {!src && <Placeholder shape={shape} seed={seed} />}
          </CastShadow>
          <ContactShadow />
        </>
      )}
      <div style={{position: 'relative', width: '100%', height: '100%', filter}}>
        {src ? (
          <img
            src={src}
            width={width}
            height={height}
            style={{
              display: 'block',
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              // Halftone ve odak bulanıklığı AYNI filter zincirinde olmak
              // zorunda: iki ayrı `filter` ataması birbirini ezer.
              filter: [halftone ? HALFTONE_CSS.filter : undefined, blur].filter(Boolean).join(' ') || undefined,
            }}
          />
        ) : (
          <div style={{width: '100%', height: '100%', filter: blur}}>
            <Placeholder shape={shape} seed={seed} />
          </div>
        )}
        {halftone && <DotScreen />}
      </div>
    </div>
  );
};

/**
 * YIRTIK KAĞIT KARTI — cutout'un altına konan renkli/dokulu zemin parçası.
 * Referansta portreler hep böyle bir kartın üstünde duruyor, doğrudan zeminde
 * değil; kartın yırtık kenarı derinlik veriyor.
 */
export const TornCard: React.FC<{
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
  rotate?: number;
  transform?: string;
  opacity?: number;
  seed?: number;
  zIndex?: number;
  children?: React.ReactNode;
}> = ({x, y, width, height, color = PALETTE.sea, rotate = 0, transform, opacity = 1, seed = 5, zIndex, children}) => {
  // Yırtık kenar: üst kenarda deterministik zikzak clip-path.
  const teeth = 14;
  const pts: string[] = [];
  for (let i = 0; i <= teeth; i += 1) {
    const px = (i / teeth) * 100;
    const py = 1.6 * rand(seed * 31 + i);
    pts.push(`${px.toFixed(2)}% ${py.toFixed(2)}%`);
  }
  pts.push('100% 100%', '0% 100%');

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
        filter: 'drop-shadow(0 10px 14px rgba(24,18,8,0.24))',
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          background: color,
          clipPath: `polygon(${pts.join(', ')})`,
        }}
      />
      {children}
    </div>
  );
};
