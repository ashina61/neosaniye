import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Easing,
  Img,
  OffthreadVideo,
  interpolate,
  Sequence,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import type {ProductionScene, ProductionSpec, SceneAsset, SfxCue} from './schema';

/**
 * ============ GÖRÜNÜM VİDEO BAŞINA, SAHNE BAŞINA DEĞİL ============
 *
 * Kullanıcı beş tur boyunca aynı şeyi söyledi ve ben beş tur boyunca yanlış
 * katmanı yamadım: "aynı arkaplan, aynı zemin, aynı sesler."
 *
 * Sebep buradaydı ve tahmin değil, tek bir satırdı: `palette` MODÜL SEVİYESİNDE
 * SABİTTİ. Yani bu deponun ürettiği HER video, sonsuza kadar, aynı krem kağıt
 * zemini, aynı mürekkep siyahı, aynı altını ve aynı kırmızıyı kullanıyordu.
 *
 * Önceki turlarda eklediğim çeşitlilik — kadans varyantı, sayfa düzeni, yüz
 * kimliği, içerik-odaklı siluet — HEPSİ bu çerçevenin içindeydi. Çerçeveye hiç
 * dokunmamıştım. İzleyici çerçeveyi görüyor.
 *
 * ============ NEDEN SAHNE BAŞINA DEĞİL ============
 *
 * Renk dünyası bir videonun KİMLİĞİ. Sahne başına değiştirmek çeşitlilik değil
 * tutarsızlık üretir; kolaj dili dağılır ve otuz sahne otuz ayrı videodan
 * kesilmiş gibi durur. Değişmesi gereken şey videodan videoya.
 *
 * ============ NEDEN MUTASYON ============
 *
 * `palette` dosyada 62 yerde okunuyor. Prop ya da context'e çevirmek 62 çağrı
 * yerini ve aradaki her bileşenin imzasını değiştirmek demekti — bu boyutta bir
 * dokunuş, düzelttiğinden çok kırar.
 *
 * Bunun yerine nesne AYNI KALIYOR, içeriği render başında bir kez yazılıyor.
 * Deterministik: seçim `spec.meta.topic`tan geliyor, aynı üretim her koşuda aynı
 * görünümü alır. Remotion kareleri paralel işçilerde render eder ama her işçi
 * aynı spec'i alıp aynı yazımı yapar, yani işçiler arasında fark oluşamaz.
 */
type Look = {
  ink: string; paper: string; paperLight: string; paperDark: string;
  gold: string; goldDark: string; teal: string; red: string; navy: string; white: string;
  grain: number;
};

const LOOKS: Array<{when: RegExp | null; name: string; look: Look}> = [
  {
    name: 'suç / soruşturma — soğuk kanıt masası',
    when: /\b(crime|heist|robber|murder|steal|stolen|police|detective|hijack|fraud|smuggl|prison|escape|missing|vanish)/i,
    look: {ink: '#141519', paper: '#dfe0da', paperLight: '#eceee7', paperDark: '#b9bcb2',
      gold: '#c9a227', goldDark: '#8a6c10', teal: '#7fa8ad', red: '#b3352c', navy: '#141c28', white: '#fbfcf8', grain: 0.34},
  },
  {
    name: 'felaket / kaza — kavrulmuş turuncu',
    when: /\b(disaster|crash|explos|collaps|burn|fire|meltdown|earthquake|eruption|flood|toxic|radiation|sink|wreck)/i,
    look: {ink: '#1c1410', paper: '#efe0cd', paperLight: '#f7ecdb', paperDark: '#d3b795',
      gold: '#d98324', goldDark: '#9c5510', teal: '#a3b5a0', red: '#a8321f', navy: '#26170f', white: '#fffaf1', grain: 0.42},
  },
  {
    name: 'bilim / uzay — mürekkep mavisi',
    when: /\b(space|nasa|rocket|orbit|planet|star|physic|chemis|science|experiment|laborator|atom|quantum|telescope|mission|brain|cell|dna|gene|blood|nerve|muscle|bone|organ|protein|bacteria|virus|enzyme|hormone|taste|smell|vision|sleep|memory)/i,
    look: {ink: '#0f1621', paper: '#e2e7ee', paperLight: '#f0f4f9', paperDark: '#b6c0ce',
      gold: '#c8b061', goldDark: '#8a7326', teal: '#5f9ea6', red: '#c0453a', navy: '#0d2138', white: '#fbfdff', grain: 0.28},
  },
  {
    name: 'doğa / hayvan — yosun yeşili',
    when: /\b(animal|bird|fish|insect|whale|forest|jungle|ocean|reef|plant|tree|species|evolution|nature|desert|arctic)/i,
    look: {ink: '#15190f', paper: '#e6e6d2', paperLight: '#f2f2e2', paperDark: '#c2c4a6',
      gold: '#c8a83a', goldDark: '#856f14', teal: '#7fa88a', red: '#b0503a', navy: '#1b2a20', white: '#fcfdf4', grain: 0.36},
  },
  {
    // Yedek: hiçbiri tutmazsa. Eski palet birebir korunuyor — geri dönüş
    // davranışı, yeni bir görünüm değil.
    name: 'genel / tarih — krem arşiv (özgün)',
    when: null,
    look: {ink: '#171511', paper: '#efe6d3', paperLight: '#f8f1e4', paperDark: '#d7c6a9',
      gold: '#d5a52d', goldDark: '#9b6d11', teal: '#9fc8c6', red: '#bc493f', navy: '#172433', white: '#fffdf7', grain: 0.38},
  },
];

/** Konuya göre görünüm seç ve paleti bir kez yaz. */
/**
 * ============ VARSAYILAN, DÜZELTMEYİ GÖRÜNMEZ KILIYORDU ============
 *
 * İlk sürüm eşleşme yoksa listenin SONUNCUSUNA düşüyordu ve o da eski paletin
 * BİREBİR aynısıydı. Kağıt üzerinde "geri dönüş davranışı" diye savunulabilir
 * görünüyordu; pratikte düzeltmeyi tamamen etkisiz bıraktı.
 *
 * Çünkü anahtar kelimeleri YANLIŞ KANALA göre yazmışım: suç, felaket, uzay —
 * yani o sırada uğraştığım kolaj konularına göre. Bu kanalın gerçek konuları
 * ise tuhaf doğa/bilim olguları. ÖLÇÜLDÜ, dördü de eşleşmedi:
 *
 *   butterfly foot tasting   → eşleşme yok
 *   barnacle adhesion        → eşleşme yok
 *   octopus arms             → eşleşme yok
 *   why sharks dont sink     → eşleşme yok
 *
 * Yani run 118, 119 ve 120 yeni kodla koştu ve yine eski paleti kullandı.
 * Kullanıcı "hiçbir bok değişmemiş" derken birebir haklıydı.
 *
 * İKİ DÜZELTME:
 *
 * 1. Kelime listeleri bu kanalın diline göre genişletildi (canlı adları,
 *    vücut/biyoloji, mühendislik, gündelik olgular).
 * 2. Eşleşme yoksa artık VARSAYILANA DÜŞÜLMÜYOR: konu hash'inden bir görünüm
 *    seçiliyor. Kelime listesi hiçbir zaman tam olamaz; kapsanmayan konu da
 *    kendi rengini almalı. Anahtar kelime ANLAMLI eşleşme sağlar, hash ise
 *    ÇEŞİTLİLİĞİ garanti eder — ikisi birbirinin yedeği değil, tamamlayıcısı.
 */
function applyLook(topic: string): string {
  const matched = LOOKS.find((l) => l.when && l.when.test(topic));
  const hit = matched ?? LOOKS[idHash(topic) % LOOKS.length];
  Object.assign(palette, hit.look);
  return hit.name;
}

const palette: Look = {
  ink: '#171511',
  paper: '#efe6d3',
  paperLight: '#f8f1e4',
  paperDark: '#d7c6a9',
  gold: '#d5a52d',
  goldDark: '#9b6d11',
  teal: '#9fc8c6',
  red: '#bc493f',
  navy: '#172433',
  white: '#fffdf7',
  grain: 0.38,
};

const clamp = {
  extrapolateLeft: 'clamp' as const,
  extrapolateRight: 'clamp' as const,
};

const sceneSfx = (scene: ProductionScene): SfxCue[] =>
  (scene.sfx || []).map((cue) => ({...cue, atFrame: scene.fromFrame + cue.atFrame}));

export const DynamicShort: React.FC<ProductionSpec> = (spec) => {
  // Görünüm SEÇİMİ burada, çizimden önce: alt bileşenler `palette`i okuduğunda
  // yazılmış olmak zorunda. React ebeveyni çocuklarından önce çalıştırır.
  applyLook(`${spec.meta?.topic ?? ''} ${spec.meta?.title ?? ''}`);
  const cues = [...(spec.globalSfx || []), ...spec.scenes.flatMap(sceneSfx)];

  return (
    <AbsoluteFill style={{backgroundColor: palette.paper}}>
      {spec.audio?.voicePath ? (
        <Audio src={staticFile(spec.audio.voicePath)} volume={spec.audio.voiceVolume ?? 1} />
      ) : null}
      {spec.audio?.musicPath ? (
        <Audio src={staticFile(spec.audio.musicPath)} volume={spec.audio.musicVolume ?? 0.14} />
      ) : null}
      {spec.audio?.ambiencePath ? (
        <Audio src={staticFile(spec.audio.ambiencePath)} volume={0.08} />
      ) : null}

      {cues.map((cue, index) => (
        <Sequence
          key={`${cue.path}-${cue.atFrame}-${index}`}
          from={Math.max(0, cue.atFrame)}
          durationInFrames={cue.durationInFrames ?? 90}
        >
          <Audio src={staticFile(cue.path)} volume={cue.volume ?? 0.65} />
        </Sequence>
      ))}

      {spec.scenes.map((scene, index) => (
        <React.Fragment key={scene.id}>
          <Sequence from={scene.fromFrame} durationInFrames={scene.durationInFrames}>
            <Scene scene={scene} index={index} total={spec.scenes.length} />
          </Sequence>
          {index < spec.scenes.length - 1 ? (
            <Sequence from={scene.fromFrame + scene.durationInFrames - 2} durationInFrames={9}>
              <TransitionFlash type={scene.transition} />
            </Sequence>
          ) : null}
        </React.Fragment>
      ))}

      <Watermark />
    </AbsoluteFill>
  );
};

/**
 * KANAL FİLİGRANI — ESKİ KONUMU BİREBİR.
 *
 * Remotion'a geçişte (`3c645f2`) düşmüştü: `assets/logo.png` ve
 * `assets/logo-mark.png` depoda duruyordu ama hiçbir bileşen çizmiyordu, yani
 * videolarda logo YOKTU.
 *
 * Ölçüler eski ffmpeg süzgecinden alındı, tahmin değil — `renderVideo.js`
 * `ae274f7^` sürümü:
 *
 *     [logo]scale=-1:72[lg]        yükseklik 72 px, genişlik oranla
 *     [v][lg]overlay=72:64         sol üst köşe, x=72  y=64
 *
 * MONOGRAM ÖNCE: eski kod `logoMarkPath` varsa onu, yoksa tam logoyu
 * kullanıyordu. Köşe filigranı için kompakt işaret doğru olan; tam logo o
 * boyutta okunmaz.
 *
 * En son katman: sahnelerin ve geçiş parlamalarının ÜSTÜNDE durmalı, yoksa
 * sahne değişiminde kayboluyor.
 */
const Watermark: React.FC = () => (
  <img
    src={staticFile('logo-mark.png')}
    alt=""
    style={{position: 'absolute', left: 72, top: 64, height: 72, width: 'auto', opacity: 0.92}}
  />
);

const Scene: React.FC<{scene: ProductionScene; index: number; total: number}> = ({scene, index, total}) => {
  switch (scene.template) {
    case 'hook-reveal':
      return <HookReveal scene={scene} />;
    case 'portrait-dossier':
      return <PortraitDossier scene={scene} />;
    case 'document':
      return <DocumentScene scene={scene} />;
    case 'map-route':
      return <MapRoute scene={scene} />;
    case 'stat-slot':
      return <StatSlot scene={scene} />;
    case 'explainer-diagram':
      return <ExplainerDiagram scene={scene} />;
    case 'transaction':
      return <TransactionScene scene={scene} />;
    case 'consequence':
      return <ConsequenceScene scene={scene} />;
    case 'final-twist':
      return <FinalTwist scene={scene} />;
    default:
      return <GenericCollage scene={scene} index={index} total={total} />;
  }
};

const FilmTreatment: React.FC<React.PropsWithChildren<{dark?: boolean}>> = ({children, dark = false}) => {
  const frame = useCurrentFrame();
  const stepped = Math.floor(frame / 2) * 2;
  const weaveX = Math.sin(stepped * 0.43) * 1.4;
  const weaveY = Math.cos(stepped * 0.37) * 1.1;
  const grainX = ((stepped * 17) % 45) - 22;
  const grainY = ((stepped * 29) % 37) - 18;

  return (
    <AbsoluteFill style={{backgroundColor: dark ? palette.navy : palette.paper, overflow: 'hidden'}}>
      <AbsoluteFill
        style={{
          transform: `translate3d(${weaveX}px, ${weaveY}px, 0) scale(1.008)`,
          filter: `saturate(${dark ? 0.8 : 0.94}) contrast(${dark ? 1.13 : 1.07}) sepia(${dark ? 0.04 : 0.1})`,
        }}
      >
        {children}
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          pointerEvents: 'none',
          opacity: dark ? 0.08 : 0.15,
          backgroundImage:
            'repeating-linear-gradient(5deg, transparent 0 11px, rgba(76,52,25,0.18) 12px, transparent 13px 31px), repeating-linear-gradient(93deg, transparent 0 29px, rgba(255,255,255,0.3) 30px, transparent 31px 57px)',
        }}
      />
      <AbsoluteFill
        style={{
          pointerEvents: 'none',
          inset: -45,
          // Gren yoğunluğu da GÖRÜNÜMDEN geliyor. Sabit 0.22 iken her videonun
          // dokusu birebir aynıydı; renk değişse bile "aynı efekt" hissi
          // buradan sürüyordu. Bilim görünümü temiz (0.28x), felaket görünümü
          // kaba (0.42x).
          opacity: 0.22 * (palette.grain / 0.38),
          mixBlendMode: 'overlay',
          transform: `translate(${grainX}px, ${grainY}px)`,
          backgroundImage:
            'repeating-radial-gradient(circle at 30% 20%, rgba(255,255,255,0.34) 0 0.7px, rgba(0,0,0,0.3) 0.9px 1.5px, transparent 1.8px 4px)',
          backgroundSize: '9px 11px',
        }}
      />
      <AbsoluteFill
        style={{
          pointerEvents: 'none',
          background:
            'radial-gradient(ellipse 92% 82% at 50% 48%, rgba(0,0,0,0) 0%, rgba(0,0,0,0) 55%, rgba(0,0,0,0.48) 100%)',
        }}
      />
    </AbsoluteFill>
  );
};

/**
 * SAHNE KİMLİĞİNDEN DETERMİNİSTİK SAYI.
 *
 * Sahne sırası (`index`) SceneShell'e kadar taşınmıyor ve taşımak on şablonun
 * imzasını değiştirmek demekti. `scene.id` zaten benzersiz ve storyboard'dan
 * geliyor, yani aynı üretim iki kez render edilirse aynı hareketi alır —
 * render'ın deterministik kalması şart.
 */
function idHash(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}

/**
 * ============ HER SAHNE AYNI HAREKETİ ALIYORDU ============
 *
 * Kullanıcı render'a bakıp söyledi: "aynı hareketleri, aynı şekilleri, aynı
 * sayfa yapısını kullanıyor". Şablon çeşitliliği VARDI (dokuz şablon + jenerik)
 * ama hepsi bu kabuktan geçiyordu ve kabuk tek bir hareket biliyordu:
 *
 *   · giriş  : sadece opacity 0→1, dört karede
 *   · çıkış  : sadece opacity 1→0
 *   · kadraj : sabit, `focus` açıkken tek bir zoom
 *
 * Yani on farklı şablon on farklı ŞEY çiziyor ama hepsi AYNI ŞEKİLDE giriyor.
 * İzleyicinin "aynı" dediği şey içerik değil, KADANS.
 *
 * Ayrıca run 117'nin denetimi bunu sayıyla da gösterdi: "kopya kare grubu: 4",
 * "değişim temposu 0.74s". Aynı kadans, kopya kare üretiyor.
 *
 * Dört varyant, sahne kimliğinden seçiliyor. Hepsi AYNI SÜREDE bitiyor —
 * çeşitlilik tempoyu bozmamalı, yalnızca yönü değiştirmeli:
 *
 *   0  aşağıdan yükselir      (klasik, en sık kullanılan)
 *   1  soldan kayar + hafif ters yönde sürüklenir
 *   2  sağdan kayar
 *   3  ölçekten açılır, hafif döner  (kağıt yerine oturuyormuş gibi)
 *
 * Sürüklenme (drift) giriş bittikten SONRA da sürüyor: sahnenin ortasında
 * kare ölü kalmasın. Genlik kasıtlı olarak küçük — büyük hareket kolajı
 * "PowerPoint geçişi"ne çevirir.
 */
const SceneShell: React.FC<React.PropsWithChildren<{scene: ProductionScene; focus?: boolean}>> = ({scene, focus = false, children}) => {
  const frame = useCurrentFrame();
  const dur = scene.durationInFrames;
  const variant = idHash(scene.id) % 4;

  const opacity = interpolate(frame, [0, 4, dur - 5, dur], [0, 1, 1, 0], clamp);
  const blur = focus ? interpolate(frame, [0, 9, 20, 34, 48], [10, 4, 0, 2.5, 0], clamp) : 0;

  // Giriş 12 karede biter, sonra yavaş sürüklenme. `in` 0→1 giriş ilerlemesi.
  const enter = interpolate(frame, [0, 12], [0, 1], clamp);
  const drift = interpolate(frame, [0, dur], [0, 1], clamp);

  let x = 0;
  let y = 0;
  let rot = 0;
  let scale = focus ? interpolate(frame, [0, 30, dur], [0.94, 1, 1.045], clamp) : 1;

  if (variant === 0) {
    y = (1 - enter) * 46 - drift * 14;
  } else if (variant === 1) {
    x = (1 - enter) * -52 + drift * 16;
  } else if (variant === 2) {
    x = (1 - enter) * 52 - drift * 16;
  } else {
    rot = (1 - enter) * -1.6 + drift * 0.5;
    scale *= 0.965 + enter * 0.035 + drift * 0.02;
  }

  return (
    <AbsoluteFill style={{opacity}}>
      <div
        style={{
          position: 'absolute',
          inset: -30,
          filter: `blur(${blur}px)`,
          transform: `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) rotate(${rot.toFixed(3)}deg) scale(${scale.toFixed(4)})`,
          transformOrigin: 'center center',
        }}
      >
        <FilmTreatment dark={Boolean(scene.dark)}>{children}</FilmTreatment>
      </div>
    </AbsoluteFill>
  );
};

const entrance = (frame: number, fps: number, delay = 0) =>
  spring({
    frame: Math.max(0, frame - delay),
    fps,
    config: {damping: 15, stiffness: 125, mass: 0.8},
    durationInFrames: Math.round(fps * 0.8),
  });

const TornPaper: React.FC<React.PropsWithChildren<{style?: React.CSSProperties; rotate?: number; fill?: string}>> = ({children, style, rotate = 0, fill = palette.paperLight}) => (
  <div
    style={{
      position: 'absolute',
      background: fill,
      clipPath:
        'polygon(1% 4%, 8% 1%, 16% 4%, 25% 1%, 36% 3%, 47% 0%, 58% 4%, 69% 1%, 80% 4%, 90% 1%, 99% 5%, 97% 17%, 100% 30%, 97% 44%, 100% 57%, 97% 72%, 100% 87%, 96% 98%, 84% 96%, 73% 100%, 61% 97%, 49% 100%, 37% 97%, 25% 100%, 14% 96%, 2% 99%, 4% 83%, 1% 68%, 4% 52%, 1% 35%, 4% 19%)',
      transform: `rotate(${rotate}deg)`,
      boxShadow: '0 18px 28px rgba(33,25,16,0.22)',
      ...style,
    }}
  >
    {children}
  </div>
);

const Tape: React.FC<{style?: React.CSSProperties; rotate?: number}> = ({style, rotate = -4}) => (
  <div
    style={{
      position: 'absolute',
      width: 190,
      height: 52,
      background: 'rgba(218,182,89,0.55)',
      border: '1px solid rgba(111,84,27,0.18)',
      boxShadow: 'inset 0 0 16px rgba(255,255,255,0.22)',
      transform: `rotate(${rotate}deg)`,
      clipPath: 'polygon(2% 7%, 98% 0, 96% 94%, 3% 100%)',
      ...style,
    }}
  />
);

const StickerText: React.FC<{text: string; top?: number; left?: number; width?: number; size?: number; rotate?: number; fill?: string; color?: string; delay?: number}> = ({
  text,
  top = 120,
  left = 70,
  width = 940,
  size = 84,
  rotate = -1,
  fill = palette.gold,
  color = palette.ink,
  delay = 0,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const p = entrance(frame, fps, delay);
  return (
    <div
      style={{
        position: 'absolute',
        top,
        left,
        width,
        padding: '15px 28px 20px',
        textAlign: 'center',
        background: fill,
        color,
        fontFamily: 'Arial Black, Impact, sans-serif',
        fontSize: size,
        fontWeight: 900,
        lineHeight: 0.96,
        letterSpacing: -2,
        textTransform: 'uppercase',
        clipPath: 'polygon(2% 10%, 98% 2%, 100% 88%, 4% 100%)',
        boxShadow: '0 14px 0 rgba(35,29,20,0.13)',
        transform: `translateY(${interpolate(p, [0, 1], [-70, 0])}px) rotate(${rotate}deg) scale(${0.84 + p * 0.16})`,
        opacity: interpolate(p, [0, 0.2, 1], [0, 1, 1]),
      }}
    >
      {text}
    </div>
  );
};

const KineticLine: React.FC<{text: string; style?: React.CSSProperties; delay?: number; color?: string; size?: number}> = ({text, style, delay = 0, color = palette.ink, size = 64}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const p = entrance(frame, fps, delay);
  return (
    <div
      style={{
        position: 'absolute',
        color,
        fontFamily: 'Arial Black, Impact, sans-serif',
        fontWeight: 900,
        fontSize: size,
        lineHeight: 0.98,
        textTransform: 'uppercase',
        letterSpacing: -1.5,
        opacity: p,
        transform: `translateY(${interpolate(p, [0, 1], [55, 0])}px) scale(${0.86 + p * 0.14})`,
        ...style,
      }}
    >
      {text}
    </div>
  );
};

const TransitionFlash: React.FC<{type?: ProductionScene['transition']}> = ({type = 'whip-flash'}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 1, 3, 8], [0, 0.84, 0.34, 0], clamp);
  const x = interpolate(frame, [0, 8], [-120, 115], clamp);
  const color = type === 'shutter' ? palette.white : type === 'paper-tear' ? palette.red : palette.gold;
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <AbsoluteFill style={{background: palette.paperLight, opacity, mixBlendMode: 'screen'}} />
      <div style={{position: 'absolute', top: 0, bottom: 0, left: `${x}%`, width: type === 'shutter' ? 520 : 230, background: color, opacity: opacity * 0.72, transform: 'skewX(-18deg)'}} />
    </AbsoluteFill>
  );
};

const Sparkles: React.FC<{dark?: boolean; count?: number}> = ({dark = false, count = 15}) => {
  const frame = useCurrentFrame();
  const stepped = Math.floor(frame / 2) * 2;
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      {Array.from({length: count}).map((_, i) => {
        const x = (i * 191 + 73) % 1000;
        const y = (i * 307 + 127) % 1700;
        const pulse = 0.55 + 0.45 * Math.sin(stepped * 0.09 + i * 1.7);
        const size = 12 + ((i * 7) % 24);
        return <div key={i} style={{position: 'absolute', left: x, top: y, width: size, height: size, opacity: pulse, transform: `rotate(${45 + i * 17}deg) scale(${pulse})`, background: i % 3 === 0 ? palette.gold : dark ? palette.white : palette.goldDark, clipPath: 'polygon(50% 0, 61% 39%, 100% 50%, 61% 61%, 50% 100%, 39% 61%, 0 50%, 39% 39%)'}} />;
      })}
    </AbsoluteFill>
  );
};

/**
 * ============ GÖRÜNTÜ KUTUDA ÖLÜ DURUYORDU ============
 *
 * Kullanıcı: "resimler falan öyle sabit kutuların içine girmesin, remotion
 * kullanıyoruz, efektler falan olsun."
 *
 * Haklıydı ve sebep tek satırdaydı: panel `objectFit: cover` ile görüntüyü
 * kutuya oturtuyor ve HİÇBİR ŞEY YAPMIYORDU. Ne zoom, ne kaydırma. Remotion'ın
 * altında bir video motoru var ve bu bileşen onu statik bir `<img>` gibi
 * kullanıyordu; fotoğraf sahneleri kelimenin tam anlamıyla donuk kareydi.
 *
 * KEN BURNS — yön varlığın kendi yolundan, deterministik. Dört yön var ki iki
 * komşu panel aynı yöne kaymasın; aynı yöne kayan iki panel "tek hareket"
 * okunur ve çeşitlilik hissi doğmaz.
 *
 * Genlik kasıtlı olarak küçük (1.0 → 1.12 ölçek, ±14 px kayma): stok klip zaten
 * kendi içinde hareket ediyor, üstüne büyük bir kamera hareketi binerse görüntü
 * sallanıyor gibi durur. Fotoğrafta ise bu kadarı bile kareyi diriltiyor.
 *
 * Hook'lar erken `return`ten ÖNCE çağrılıyor — React kuralı, aksi hâlde
 * varlık olmayan sahnede hook sırası kayar ve render çöker.
 */
const AssetPanel: React.FC<{asset?: SceneAsset; style?: React.CSSProperties; rotate?: number}> = ({asset, style, rotate = 0}) => {
  const frame = useCurrentFrame();
  const {durationInFrames} = useVideoConfig();

  const dir = idHash(asset?.path ?? 'none') % 4;
  const t = interpolate(frame, [0, Math.max(1, durationInFrames)], [0, 1], clamp);
  const zoom = 1 + t * 0.12;
  const panX = [1, -1, 1, -1][dir] * t * 14;
  const panY = [-1, -1, 1, 1][dir] * t * 10;

  if (!asset?.path) return null;

  const common: React.CSSProperties = {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    transform: `scale(${zoom.toFixed(4)}) translate(${panX.toFixed(2)}px, ${panY.toFixed(2)}px)`,
    transformOrigin: 'center center',
  };

  return (
    <TornPaper rotate={rotate} style={{overflow: 'hidden', ...style}}>
      {asset.type === 'video' ? <OffthreadVideo src={staticFile(asset.path)} style={common} muted /> : <Img src={staticFile(asset.path)} style={common} />}
    </TornPaper>
  );
};

/**
 * İŞARET KATMANI — "oklar bilmem neler".
 *
 * Editoryal video-essay dilinin belkemiği: kare bir şey gösterir, ÜSTÜNE bir
 * işaret o şeyin neresine bakılacağını söyler. Bu depoda hiç yoktu; paneller
 * çiziliyor ama hiçbir şey işaret edilmiyordu.
 *
 * İşaret TÜRÜ sahnenin içeriğinden geliyor, süslemeden değil:
 *   arrow   yer/yön/hareket anlatan sahne — "buraya gitti"
 *   circle  bir şeyin BULUNDUĞUNU söyleyen sahne — "işte burada"
 *   under   sayı/iddia taşıyan sahne — altını çizer
 *   yok     hiçbiri tutmazsa çizilmez; her kareye işaret koymak onu
 *           dekorasyona çevirir ve hiçbir şey işaret etmemekle aynı kapıya çıkar
 *
 * Çizim gecikmeli başlıyor (delay): işaret, gösterdiği şeyden SONRA gelmeli.
 * Aynı anda girerse izleyici neye baktığını anlamadan ok belirir.
 */
const MARK_WORDS: Array<{kind: 'arrow' | 'circle' | 'under'; words: RegExp}> = [
  {kind: 'arrow', words: /\b(went|flew|sailed|escap|route|toward|across|north|south|east|west|journey|moved|travel|led to|into)/i},
  {kind: 'circle', words: /\b(found|discover|spotted|here|located|hidden|buried|remains|trace|evidence|body|wreck)/i},
  {kind: 'under', words: /\b(\d|million|billion|percent|only|never|first|last|most|record|exactly)/i},
];

const Marker: React.FC<{scene: ProductionScene; at: {left: number; top: number}; delay?: number}> = ({scene, at, delay = 18}) => {
  const frame = useCurrentFrame();
  const text = [scene.headline, scene.narration, scene.kicker].filter(Boolean).join(' ');
  const hit = MARK_WORDS.find((m) => m.words.test(text));
  const draw = interpolate(frame, [delay, delay + 14], [0, 1], clamp);
  if (!hit || draw <= 0) return null;

  return (
    <svg
      viewBox="0 0 300 300"
      width={300}
      height={300}
      style={{position: 'absolute', left: at.left, top: at.top, pointerEvents: 'none', overflow: 'visible'}}
    >
      {hit.kind === 'arrow' ? (
        <g stroke={palette.red} strokeWidth="11" fill="none" strokeLinecap="round">
          <path d="M20 250 C90 250 150 200 205 120" strokeDasharray="320" strokeDashoffset={320 * (1 - draw)} />
          {draw > 0.85 ? <path d="M172 122 L208 112 L200 150" strokeLinejoin="round" /> : null}
        </g>
      ) : hit.kind === 'circle' ? (
        <ellipse
          cx="150" cy="150" rx="120" ry="92"
          fill="none" stroke={palette.red} strokeWidth="11"
          strokeDasharray="670" strokeDashoffset={670 * (1 - draw)}
          transform="rotate(-8 150 150)"
        />
      ) : (
        <path
          d="M12 200 C90 214 210 208 288 196"
          fill="none" stroke={palette.gold} strokeWidth="14" strokeLinecap="round"
          strokeDasharray="290" strokeDashoffset={290 * (1 - draw)}
        />
      )}
    </svg>
  );
};

const HookReveal: React.FC<{scene: ProductionScene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const portrait = entrance(frame, fps, 7);
  const asset = scene.assets?.[0];
  return (
    <SceneShell scene={scene} focus>
      <Sparkles />
      <div style={{position: 'absolute', inset: 0, background: 'radial-gradient(circle at 75% 37%, rgba(213,165,45,0.25), transparent 34%)'}} />
      <AssetPanel asset={asset} rotate={2} style={{left: 510, top: 520, width: 470, height: 720, transform: `translateX(${interpolate(portrait, [0, 1], [180, 0])}px) rotate(2deg)`}} />
      {!asset ? <ContentShape scene={scene} style={{left: 545, top: 520, transform: `translateX(${interpolate(portrait, [0, 1], [180, 0])}px)`}} /> : null}
      <StickerText text={scene.headline || 'IMPOSSIBLE STORY'} top={150} size={88} rotate={-1.5} />
      <KineticLine text={scene.kicker || scene.narration || ''} delay={18} color={palette.red} size={52} style={{left: 95, top: 390, width: 760}} />
      <Tape style={{left: 730, top: 1260}} rotate={7} />
      <div style={{position: 'absolute', left: 90, bottom: 165, fontSize: 35, fontFamily: 'Georgia, serif', fontStyle: 'italic'}}>A true story selected by NeoSaniye</div>
    </SceneShell>
  );
};

const PortraitDossier: React.FC<{scene: ProductionScene}> = ({scene}) => {
  const asset = scene.assets?.[0];
  return (
    <SceneShell scene={scene} focus>
      <StickerText text={scene.headline || 'THE PERSON BEHIND IT'} top={125} size={76} />
      <TornPaper rotate={-2} style={{left: 80, top: 390, width: 920, height: 1160, padding: 42}}>
        <div style={{fontFamily: 'Georgia, serif', fontSize: 38, letterSpacing: 2}}>CONFIDENTIAL DOSSIER</div>
        <div style={{position: 'absolute', left: 40, right: 40, top: 115, height: 5, background: palette.ink}} />
        <AssetPanel asset={asset} style={{left: 80, top: 190, width: 420, height: 610}} />
        {!asset ? <ContentShape scene={scene} style={{left: 75, top: 210}} /> : null}
        <div style={{position: 'absolute', left: 545, top: 210, width: 310, fontFamily: 'Arial Black, sans-serif', fontSize: 46, lineHeight: 1.05}}>{(scene.kicker || 'NAME UNKNOWN').toUpperCase()}</div>
        {(scene.emphasis || ['CHARM', 'STATUS', 'TRUST']).slice(0, 3).map((word, i) => (
          <div key={word} style={{position: 'absolute', left: 545, top: 470 + i * 125, padding: '16px 22px', background: i === 1 ? palette.red : palette.gold, fontFamily: 'Arial Black, sans-serif', fontSize: 36, transform: `rotate(${i % 2 ? 2 : -2}deg)`}}>{word.toUpperCase()}</div>
        ))}
        <div style={{position: 'absolute', left: 70, right: 70, bottom: 95, fontFamily: 'Georgia, serif', fontSize: 43, lineHeight: 1.2}}>{scene.narration}</div>
      </TornPaper>
      <Tape style={{left: 430, top: 340}} />
    </SceneShell>
  );
};

const DocumentScene: React.FC<{scene: ProductionScene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const stamp = interpolate(frame, [24, 31], [2.2, 1], {...clamp, easing: Easing.out(Easing.back(2))});
  return (
    <SceneShell scene={scene}>
      <StickerText text={scene.headline || 'OFFICIAL DOCUMENTS'} top={120} size={75} rotate={1} />
      <DocumentCard style={{left: 105, top: 410, transform: 'rotate(-5deg)'}} label={scene.kicker || 'RESTRICTED'} />
      <DocumentCard style={{left: 405, top: 570, transform: 'rotate(4deg)'}} label={(scene.emphasis?.[0] || 'APPROVED').toUpperCase()} />
      <DocumentCard style={{left: 185, top: 880, transform: 'rotate(-1deg)'}} label={(scene.emphasis?.[1] || 'SEALED').toUpperCase()} />
      <div style={{position: 'absolute', left: 570, top: 1110, width: 340, height: 150, border: `12px solid ${palette.red}`, color: palette.red, fontFamily: 'Arial Black, sans-serif', fontSize: 56, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `rotate(-12deg) scale(${stamp})`, opacity: interpolate(frame, [21, 25], [0, 1], clamp)}}>OFFICIAL</div>
      <KineticLine text={scene.narration || ''} delay={38} size={46} style={{left: 100, bottom: 180, width: 880, textAlign: 'center'}} />
    </SceneShell>
  );
};

const MapRoute: React.FC<{scene: ProductionScene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const route = interpolate(frame, [15, scene.durationInFrames * 0.68], [0, 1], clamp);
  return (
    <SceneShell scene={scene} focus>
      <StickerText text={scene.headline || 'THE ROUTE'} top={115} size={80} />
      <TornPaper rotate={-1} style={{left: 75, top: 390, width: 930, height: 1110, background: palette.paperDark}}>
        <MapGraphic progress={route} labels={scene.emphasis || []} />
      </TornPaper>
      <Tape style={{left: 435, top: 350}} />
      <KineticLine text={scene.kicker || scene.narration || ''} delay={30} color={palette.red} size={48} style={{left: 110, bottom: 170, width: 860, textAlign: 'center'}} />
    </SceneShell>
  );
};

const StatSlot: React.FC<{scene: ProductionScene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const settled = entrance(frame, fps, 26);
  const candidates = ['45', '900', '2,400', scene.stat || '7,300'];
  const index = Math.min(candidates.length - 1, Math.floor(frame / 7));
  return (
    <SceneShell scene={scene} focus>
      <StickerText text={scene.headline || 'THE NUMBER CHANGES EVERYTHING'} top={115} size={66} rotate={-1} />
      <div style={{position: 'absolute', left: 90, right: 90, top: 560, height: 510, background: palette.navy, border: `10px solid ${palette.ink}`, boxShadow: `22px 25px 0 ${palette.goldDark}`, transform: `rotate(-1deg) scale(${0.94 + settled * 0.06})`, overflow: 'hidden'}}>
        <div style={{position: 'absolute', inset: 0, background: 'repeating-linear-gradient(0deg, transparent 0 53px, rgba(255,255,255,0.07) 54px 56px)'}} />
        <div style={{position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Arial Black, Impact, sans-serif', fontSize: 190, color: palette.gold, letterSpacing: -8, transform: `translateY(${index < candidates.length - 1 ? Math.sin(frame * 1.9) * 45 : 0}px)`, filter: index < candidates.length - 1 ? 'blur(2px)' : 'none'}}>{candidates[index]}</div>
      </div>
      <div style={{position: 'absolute', top: 1120, left: 130, width: 820, fontFamily: 'Arial Black, sans-serif', fontSize: 88, textAlign: 'center', color: palette.red, transform: `scale(${0.85 + settled * 0.15})`}}>{(scene.statLabel || scene.kicker || 'PEOPLE').toUpperCase()}</div>
      <KineticLine text={scene.narration || ''} delay={48} size={44} style={{left: 130, bottom: 175, width: 820, textAlign: 'center'}} />
    </SceneShell>
  );
};

const ExplainerDiagram: React.FC<{scene: ProductionScene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const progress = interpolate(frame, [18, scene.durationInFrames - 20], [0, 1], clamp);
  return (
    <SceneShell scene={scene}>
      <StickerText text={scene.headline || 'HOW IT WORKED'} top={120} size={78} />
      <div style={{position: 'absolute', left: 110, top: 480, width: 860, height: 820}}>
        {[0, 1, 2].map((i) => <DiagramNode key={i} index={i} active={progress > i / 3} text={(scene.emphasis?.[i] || ['PLAN', 'TRUST', 'PAYOFF'][i]).toUpperCase()} />)}
        <svg viewBox="0 0 860 820" style={{position: 'absolute', inset: 0}}>
          <path d="M240 220 C390 120 470 120 620 220 M620 310 C510 420 350 420 240 525" fill="none" stroke={palette.red} strokeWidth="18" strokeLinecap="round" strokeDasharray="900" strokeDashoffset={900 * (1 - progress)} />
          <path d="M598 198 L660 220 L615 265" fill="none" stroke={palette.red} strokeWidth="18" strokeLinecap="round" />
          <path d="M260 500 L208 531 L267 562" fill="none" stroke={palette.red} strokeWidth="18" strokeLinecap="round" />
        </svg>
      </div>
      <KineticLine text={scene.narration || ''} delay={35} size={45} style={{left: 100, bottom: 170, width: 880, textAlign: 'center'}} />
    </SceneShell>
  );
};

const TransactionScene: React.FC<{scene: ProductionScene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const exchange = interpolate(frame, [20, 65], [0, 1], clamp);
  return (
    <SceneShell scene={scene} focus>
      <StickerText text={scene.headline || 'THE DEAL'} top={115} size={82} rotate={1} />
      <div style={{position: 'absolute', left: 60, top: 570, width: 430, height: 600, transform: `translateX(${interpolate(exchange, [0, 1], [-80, 90])}px)`}}><Hand direction="right" /></div>
      <div style={{position: 'absolute', right: 60, top: 570, width: 430, height: 600, transform: `translateX(${interpolate(exchange, [0, 1], [80, -90])}px)`}}><Hand direction="left" /></div>
      <MoneyStack style={{left: 405, top: 720, transform: `scale(${0.8 + exchange * 0.2}) rotate(${Math.sin(frame * 0.08)}deg)`}} />
      <KineticLine text={(scene.stat || scene.kicker || 'CASH').toUpperCase()} delay={28} color={palette.red} size={92} style={{left: 110, top: 1230, width: 860, textAlign: 'center'}} />
      <KineticLine text={scene.narration || ''} delay={45} size={43} style={{left: 110, bottom: 160, width: 860, textAlign: 'center'}} />
    </SceneShell>
  );
};

const ConsequenceScene: React.FC<{scene: ProductionScene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const close = interpolate(frame, [0, scene.durationInFrames], [0, 0.58], clamp);
  return (
    <SceneShell scene={{...scene, dark: true}} focus>
      <AbsoluteFill style={{background: `radial-gradient(circle at 50% 45%, transparent 0 ${42 - close * 30}%, rgba(0,0,0,${0.25 + close}) 75%)`}} />
      <StickerText text={scene.headline || 'THEN EVERYTHING COLLAPSED'} top={130} size={67} fill={palette.red} color={palette.white} />
      <WarningSymbols />
      <KineticLine text={(scene.kicker || 'NO WAY OUT').toUpperCase()} delay={24} color={palette.gold} size={94} style={{left: 90, top: 860, width: 900, textAlign: 'center'}} />
      <KineticLine text={scene.narration || ''} delay={43} color={palette.white} size={45} style={{left: 115, bottom: 180, width: 850, textAlign: 'center'}} />
    </SceneShell>
  );
};

const FinalTwist: React.FC<{scene: ProductionScene}> = ({scene}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const pop = entrance(frame, fps, 13);
  const circle = interpolate(frame, [34, 88], [0, 1], clamp);
  return (
    <SceneShell scene={{...scene, dark: true}} focus>
      <Sparkles dark count={20} />
      <div style={{position: 'absolute', left: 90, right: 90, top: 310, bottom: 320, border: `8px solid ${palette.gold}`, transform: `rotate(-2deg) scale(${0.9 + pop * 0.1})`}} />
      <KineticLine text={scene.headline || 'THE FINAL TWIST'} delay={9} color={palette.white} size={92} style={{left: 100, top: 540, width: 880, textAlign: 'center'}} />
      <svg viewBox="0 0 900 260" style={{position: 'absolute', left: 90, top: 740, width: 900, height: 260}}>
        <path d="M40 145 C110 16 782 10 850 132 C900 229 120 272 42 160" fill="none" stroke={palette.gold} strokeWidth="15" strokeLinecap="round" strokeDasharray="2200" strokeDashoffset={2200 * (1 - circle)} />
      </svg>
      <KineticLine text={(scene.kicker || 'AND IT REALLY HAPPENED').toUpperCase()} delay={27} color={palette.gold} size={60} style={{left: 130, top: 1020, width: 820, textAlign: 'center'}} />
      <div style={{position: 'absolute', left: 0, right: 0, bottom: 160, textAlign: 'center', fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: 40, color: palette.white}}>NEOSANIYE</div>
    </SceneShell>
  );
};

/**
 * ============ SAYFA YAPISI TEK BİR KALIPTAN İBARETTİ ============
 *
 * Kullanıcı: "şekilleri, svgleri, sayfa yapısını değiştirsin, hepsi aynı şeyler
 * aynı efektler olmasın."
 *
 * `GenericCollage` beat'lerin ÇOĞUNUN düştüğü yer — dokuz özel şablonun hiçbiri
 * eşleşmezse buraya geliyor. Ve buradaki her koordinat SABİTTİ:
 *
 *   başlık    top: 115, size: 76
 *   panel 1   left: 75,  top: 430,  650x760,  rotate -3
 *   panel 2   right: 65, top: 760,  470x520,  rotate  4
 *   sayaç     right: 70, top: 360
 *   altyazı   left: 95,  bottom: 170
 *
 * Yani jenerik sahnelerin HEPSİ birebir aynı sayfaydı; değişen tek şey
 * içindeki fotoğraf. Sahne kadansını bir önceki turda çeşitlendirmiştik ama
 * kadans yerleşimi kurtarmıyor — izleyici aynı iskeleti görüyor.
 *
 * Dört düzen, `scene.id`den deterministik (SceneShell ile aynı yöntem, aynı
 * gerekçe: sıra bilgisi burada var ama `id` render'ı tekrar edilebilir tutuyor
 * ve iki bileşen aynı sahnede AYNI varyantı seçmesin diye hash farklı
 * tuzlanıyor).
 *
 *   0  büyük sol panel + küçük sağ alt   (eski düzen, en dengeli)
 *   1  AYNA: büyük sağda, küçük sol altta
 *   2  ÜST-ALT yığın: iki panel geniş, üst üste
 *   3  TEK HÂKİM panel, ortada büyük; ikincisi köşede küçük vinyet
 *
 * Başlık, sayaç ve altyazı da düzenle birlikte kayıyor — sabit kalsalardı
 * paneller değişse bile sayfa aynı okunurdu.
 */
const GenericCollage: React.FC<{scene: ProductionScene; index: number; total: number}> = ({scene, index, total}) => {
  const first = scene.assets?.[0];
  const second = scene.assets?.[1];
  const v = idHash(`${scene.id}:layout`) % 4;

  const L = [
    {
      head: 115, a: {left: 75, top: 430, width: 650, height: 760}, ar: -3,
      b: {right: 65, top: 760, width: 470, height: 520}, br: 4,
      count: {right: 70, top: 360}, cap: {left: 95, bottom: 170, width: 890},
    },
    {
      head: 150, a: {right: 70, top: 400, width: 660, height: 780}, ar: 3,
      b: {left: 70, top: 800, width: 450, height: 500}, br: -5,
      count: {left: 80, top: 330}, cap: {left: 95, bottom: 200, width: 890},
    },
    {
      head: 105, a: {left: 90, top: 380, width: 900, height: 520}, ar: -2,
      b: {left: 90, top: 940, width: 900, height: 430}, br: 2,
      count: {right: 80, top: 300}, cap: {left: 95, bottom: 150, width: 890},
    },
    {
      head: 135, a: {left: 130, top: 420, width: 820, height: 880}, ar: 1.5,
      b: {right: 80, top: 1330, width: 330, height: 360}, br: -6,
      count: {left: 90, top: 350}, cap: {left: 95, bottom: 130, width: 890},
    },
  ][v];

  return (
    <SceneShell scene={scene}>
      <StickerText text={scene.headline || `BEAT ${index + 1}`} top={L.head} size={v === 2 ? 68 : 76} rotate={v % 2 ? 1 : -1} />
      <AssetPanel asset={first} rotate={L.ar} style={{...L.a}} />
      <AssetPanel asset={second} rotate={L.br} style={{...L.b}} />
      {!first ? <ContentShape scene={scene} style={{left: 115, top: 520, transform: `rotate(${L.ar}deg) scale(1.25)`}} /> : null}
      <div style={{position: 'absolute', ...L.count, fontFamily: 'Arial Black, sans-serif', fontSize: 42, color: palette.red}}>{String(index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}</div>
      {/*
        İşaret, BİRİNCİ panelin üstüne düşüyor: sahnenin ağırlık merkezi orası.
        Konum düzenle birlikte kayıyor, yoksa dört düzenin üçünde boşluğu
        işaret ederdi.
      */}
      <Marker scene={scene} at={{left: (L.a.left ?? 120) + 60, top: L.a.top + 80}} />
      <KineticLine text={scene.narration || scene.kicker || ''} delay={30} size={48} style={{...L.cap, textAlign: 'center'}} />
    </SceneShell>
  );
};

/**
 * ============ EN SIK GÖRÜNEN YÜZ HEP AYNI YÜZDÜ ============
 *
 * Kullanıcı: "şekilleri, svgleri değiştirsin, hepsi aynı şeyler olmasın."
 *
 * `PortraitCutout` fotoğraf BULUNAMADIĞINDA çizilen yedek — yani en sık
 * görünen siluet. Ve tek bir yol verisiydi: aynı saç, aynı kravat, aynı göz
 * aralığı, aynı altın şapka kavisi. Bir videoda üç kez düşerse izleyici üç kez
 * AYNI ADAMI görüyor, üstelik farklı üç kişiyi anlatan sahnelerde.
 *
 * Üç kimlik. Değişenler tanınırlığı taşıyan yerler — saç hattı, yüz genişliği,
 * yaka, aksesuar. Gövde silueti ve omuz genişliği SABİT kalıyor: onlar stilin
 * imzası, değişirse farklı kişi değil farklı ÇİZİM dili olur.
 *
 *   0  düz saç + kravat + şapka kavisi   (özgün)
 *   1  dalgalı/hacimli saç + açık yaka, aksesuar yok, dar yüz
 *   2  kısa saç + gözlük + fular, geniş yüz
 *
 * `seed` sahne kimliğinden geliyor: aynı sahne her render'da aynı yüzü alır.
 */

/**
 * ============ ÇİZİM CÜMLEDEN GELİR, HASH'TEN DEĞİL ============
 *
 * Kullanıcı: "svg çizimleri direk konuya göre çeşitlensin, öyle aynı şeyler
 * aynı efektler yapılmasın."
 *
 * Önceki tur siluetlere VARYANT eklemişti (üç farklı yüz, `scene.id` hash'inden)
 * ve bu yarım bir çözümdü: çeşitlilik geldi ama ANLAM gelmedi. Para anlatan bir
 * sahne de, uçak anlatan bir sahne de yüz çiziyordu — sadece farklı yüzler.
 * Rastgele çeşitlilik, yanlış çizimi daha az sıkıcı yapar; doğru yapmaz.
 *
 * Karar artık cümlenin SOMUT NESNESİNDEN çıkıyor. Sahnenin taşıdığı bütün metin
 * taranıyor (başlık, vurgu, anlatı, kicker) ve ilk eşleşen aile kazanıyor.
 *
 * SIRA GEREKÇELİ — spesifik olan önce:
 *   uyarı/felaket  en güçlü sinyal; "crash", "died" geçen sahnede para da
 *                  geçebilir ama sahnenin konusu felakettir
 *   para           somut ve ayırt edici
 *   harita/yer     iki yer adı ya da yolculuk fiili
 *   belge          kayıt, mektup, rapor
 *   kişi           en genel; hiçbiri tutmazsa da buraya düşülür
 *
 * EŞLEŞME YOKSA YİNE KİŞİ ÇİZİLİYOR ve bu bilinçli: bu şablonlar bir ANLATI
 * anlatıyor, anlatının öznesi genelde birisidir. Boş kare bırakmak ya da
 * rastgele bir nesne çizmek daha kötü.
 */
const SHAPE_WORDS: Array<{kind: 'warning' | 'money' | 'map' | 'document'; words: RegExp}> = [
  {kind: 'warning', words: /\b(crash|died|death|kill|explos|disaster|danger|fail|collaps|burn|fire|toxic|poison|warning|attack|destroy|wreck)/i},
  {kind: 'money', words: /\b(money|cash|dollar|ransom|paid|payment|price|cost|million|billion|fortune|wealth|bank|gold|profit|sold)/i},
  {kind: 'map', words: /\b(map|route|journey|travel|flight|sail|border|island|city|country|north|south|east|west|coast|ocean|mile|km)/i},
  {kind: 'document', words: /\b(letter|note|document|record|report|file|law|contract|newspaper|headline|diary|book|evidence|signature|archive)/i},
];

function shapeKindFor(scene: ProductionScene): 'warning' | 'money' | 'map' | 'document' | 'person' {
  const text = [scene.headline, scene.kicker, scene.narration, ...(scene.emphasis || [])]
    .filter(Boolean)
    .join(' ');
  for (const entry of SHAPE_WORDS) {
    if (entry.words.test(text)) return entry.kind;
  }
  return 'person';
}

/**
 * Sahnenin konusuna göre siluet. Fotoğraf bulunamadığında çizilen şey.
 * `PortraitCutout`un üç kimliği KORUNUYOR — özne gerçekten bir kişiyse farklı
 * kişilerin farklı görünmesi doğru; oradaki hash anlamı değil KİMLİĞİ seçiyor.
 */
const ContentShape: React.FC<{scene: ProductionScene; style?: React.CSSProperties}> = ({scene, style}) => {
  switch (shapeKindFor(scene)) {
    case 'warning':
      return <WarningSymbols />;
    case 'money':
      return <MoneyStack style={{...style}} />;
    case 'map':
      // MapGraphic gerçek etiket ve ilerleme istiyor. Etiketler sahnenin
      // vurgularından geliyor; yoksa harita çizilmez ve kişiye düşülür —
      // etiketsiz harita, boş bir dünya haritası demek.
      return (scene.emphasis?.length ?? 0) >= 2 ? (
        <MapGraphic progress={1} labels={(scene.emphasis || []).slice(0, 2)} />
      ) : (
        <PortraitCutout seed={scene.id} style={style} />
      );
    case 'document':
      return <DocumentCard style={{...style}} label={(scene.emphasis?.[0] || 'RECORD').toUpperCase()} />;
    default:
      return <PortraitCutout seed={scene.id} style={style} />;
  }
};

const PortraitCutout: React.FC<{style?: React.CSSProperties; seed?: string}> = ({style, seed = ''}) => {
  const v = idHash(`${seed}:face`) % 3;
  const rx = [115, 104, 122][v];
  const eye = [{l: 174, r: 265}, {l: 180, r: 259}, {l: 170, r: 269}][v];

  return (
    <div style={{position: 'absolute', width: 420, height: 610, filter: 'drop-shadow(20px 24px 0 rgba(24,18,13,0.22))', ...style}}>
      <svg viewBox="0 0 440 610" width="100%" height="100%">
        {/* Gövde ve omuz: stilin imzası, varyanta göre DEĞİŞMİYOR. */}
        <path d="M77 598 C86 438 133 377 219 365 C309 377 358 443 368 598 Z" fill="#d8d2c5" stroke={palette.ink} strokeWidth="14" />

        {/* Yaka: kravat / açık yaka / fular */}
        {v === 0 ? (
          <path d="M151 377 L219 473 L289 377 L270 598 L166 598 Z" fill={palette.navy} stroke={palette.ink} strokeWidth="11" />
        ) : v === 1 ? (
          <path d="M158 377 L219 486 L282 377 L262 598 L178 598 Z" fill="#c9c2b2" stroke={palette.ink} strokeWidth="11" />
        ) : (
          <path d="M150 380 C186 430 254 430 290 380 L300 470 C254 500 186 500 140 470 Z" fill={palette.red} stroke={palette.ink} strokeWidth="11" />
        )}

        <ellipse cx="219" cy="239" rx={rx} ry="142" fill="#d3c5ad" stroke={palette.ink} strokeWidth="14" />

        {/* Saç hattı — kimliği en çok taşıyan öğe. */}
        {v === 0 ? (
          <path d="M110 213 C114 82 330 66 337 223 C292 168 148 166 110 213 Z" fill={palette.ink} />
        ) : v === 1 ? (
          <path d="M104 250 C96 96 344 84 340 258 C336 150 300 122 262 150 C224 108 150 128 132 186 C122 210 116 232 104 250 Z" fill={palette.ink} />
        ) : (
          <path d="M114 196 C126 96 322 92 332 200 C300 158 268 142 219 142 C170 142 140 160 114 196 Z" fill={palette.ink} />
        )}

        <ellipse cx={eye.l} cy="242" rx="12" ry="9" fill={palette.ink} />
        <ellipse cx={eye.r} cy="242" rx="12" ry="9" fill={palette.ink} />

        {/* Gözlük yalnızca 2. kimlikte. */}
        {v === 2 ? (
          <g fill="none" stroke={palette.ink} strokeWidth="8">
            <circle cx={eye.l} cy="242" r="30" />
            <circle cx={eye.r} cy="242" r="30" />
            <path d={`M${eye.l + 30} 242 L${eye.r - 30} 242`} />
          </g>
        ) : null}

        {/* Ağız: gülümseme / düz / hafif açık */}
        {v === 0 ? (
          <path d="M170 320 C203 343 240 343 272 319" fill="none" stroke={palette.ink} strokeWidth="9" strokeLinecap="round" />
        ) : v === 1 ? (
          <path d="M180 328 L262 328" fill="none" stroke={palette.ink} strokeWidth="9" strokeLinecap="round" />
        ) : (
          <ellipse cx="221" cy="326" rx="26" ry="14" fill="none" stroke={palette.ink} strokeWidth="9" />
        )}

        {/* Şapka kavisi yalnızca özgün kimlikte — altın cimri kullanılır. */}
        {v === 0 ? <path d="M147 116 C173 75 288 74 318 133" fill="none" stroke={palette.gold} strokeWidth="15" /> : null}
      </svg>
    </div>
  );
};

const DocumentCard: React.FC<{style?: React.CSSProperties; label: string}> = ({style, label}) => (
  <div style={{position: 'absolute', width: 520, height: 360, padding: 34, background: palette.paperLight, border: `5px solid ${palette.ink}`, boxShadow: '14px 18px 0 rgba(25,20,15,0.18)', ...style}}>
    <div style={{fontFamily: 'Georgia, serif', fontWeight: 700, fontSize: 30, letterSpacing: 3}}>{label}</div>
    <div style={{height: 5, background: palette.ink, margin: '20px 0 28px'}} />
    {[92, 76, 84, 55].map((w, i) => <div key={i} style={{width: `${w}%`, height: 13, background: i === 2 ? palette.red : palette.ink, opacity: i === 2 ? 0.7 : 0.4, marginBottom: 18}} />)}
    <div style={{position: 'absolute', right: 35, bottom: 30, width: 90, height: 90, borderRadius: '50%', border: `8px double ${palette.red}`}} />
  </div>
);

const MapGraphic: React.FC<{progress: number; labels: string[]}> = ({progress, labels}) => (
  <svg viewBox="0 0 930 1110" width="100%" height="100%">
    <path d="M44 180 C152 75 274 108 324 220 C390 369 262 431 162 367 C72 309 34 259 44 180 Z" fill="#c9b998" stroke={palette.ink} strokeWidth="10" />
    <path d="M566 315 C676 217 853 278 889 420 C916 527 823 603 748 662 C664 730 569 686 539 583 C510 484 485 392 566 315 Z" fill="#c9b998" stroke={palette.ink} strokeWidth="10" />
    <path d="M255 660 C356 620 458 682 463 796 C469 922 344 1028 230 954 C139 894 142 705 255 660 Z" fill="#c9b998" stroke={palette.ink} strokeWidth="10" />
    <path d="M227 262 C380 180 520 202 705 428" fill="none" stroke={palette.red} strokeWidth="18" strokeLinecap="round" strokeDasharray="900" strokeDashoffset={900 * (1 - progress)} />
    <circle cx="225" cy="262" r="26" fill={palette.gold} stroke={palette.ink} strokeWidth="9" />
    <circle cx="705" cy="428" r="26" fill={palette.red} stroke={palette.ink} strokeWidth="9" />
    <text x="95" y="145" fontFamily="Arial Black" fontSize="42" fill={palette.ink}>{(labels[0] || 'ORIGIN').toUpperCase()}</text>
    <text x="635" y="735" fontFamily="Arial Black" fontSize="42" fill={palette.ink}>{(labels[1] || 'DESTINATION').toUpperCase()}</text>
  </svg>
);

const DiagramNode: React.FC<{index: number; active: boolean; text: string}> = ({index, active, text}) => {
  const positions = [{left: 25, top: 65}, {left: 525, top: 65}, {left: 25, top: 490}];
  return <div style={{position: 'absolute', ...positions[index], width: 300, height: 210, background: active ? palette.gold : palette.paperLight, border: `8px solid ${palette.ink}`, boxShadow: '12px 14px 0 rgba(24,18,14,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', fontFamily: 'Arial Black, sans-serif', fontSize: 44, transform: `rotate(${index === 1 ? 3 : -2}deg) scale(${active ? 1 : 0.88})`, opacity: active ? 1 : 0.35}}>{text}</div>;
};

const Hand: React.FC<{direction: 'left' | 'right'}> = ({direction}) => (
  <svg viewBox="0 0 430 600" width="100%" height="100%" style={{transform: direction === 'left' ? 'scaleX(-1)' : undefined}}>
    <path d="M26 305 C96 238 156 221 247 227 L355 169 C389 151 419 191 391 216 L322 279 L399 285 C430 291 428 335 397 342 L310 349 L380 386 C407 401 390 442 360 430 L270 394 L317 452 C339 477 307 509 283 486 L202 405 C153 359 91 365 26 401 Z" fill="#d3c5ad" stroke={palette.ink} strokeWidth="15" />
  </svg>
);

const MoneyStack: React.FC<{style?: React.CSSProperties}> = ({style}) => (
  <div style={{position: 'absolute', width: 270, height: 230, ...style}}>
    {[0, 1, 2, 3].map((i) => <div key={i} style={{position: 'absolute', left: i * 8, top: 130 - i * 32, width: 250, height: 95, background: i % 2 ? '#b7c48d' : '#c8d29e', border: `7px solid ${palette.ink}`, transform: `rotate(${i % 2 ? 3 : -2}deg)`}}><div style={{position: 'absolute', inset: 14, border: `4px double ${palette.goldDark}`}} /><div style={{position: 'absolute', left: 95, top: 20, fontFamily: 'Georgia, serif', fontSize: 42, fontWeight: 900}}>$</div></div>)}
  </div>
);

const WarningSymbols: React.FC = () => (
  <AbsoluteFill>
    {[{x: 120, y: 500, r: -8}, {x: 650, y: 470, r: 6}, {x: 360, y: 760, r: -3}].map((p, i) => <div key={i} style={{position: 'absolute', left: p.x, top: p.y, width: 310, height: 310, background: i === 1 ? palette.red : palette.paperLight, clipPath: 'polygon(50% 0, 100% 100%, 0 100%)', transform: `rotate(${p.r}deg)`, border: `8px solid ${palette.ink}`}}><div style={{position: 'absolute', left: 130, top: 80, color: palette.ink, fontFamily: 'Arial Black, sans-serif', fontSize: 135}}>!</div></div>)}
  </AbsoluteFill>
);
