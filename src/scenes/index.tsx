import React from 'react';
import {Img, staticFile, useCurrentFrame} from 'remotion';
import {CANVAS, PALETTE, SAFE, SAFE_BOX, TYPE, VERTICAL_BANDS, FONTS} from '../design/tokens';
import {enter, drift, breathe, rand, HOLD_FROM} from '../motion/stepped';
import {cue, curlAmount, focusHunt, holdJitter, negationCue, parallax, peel, zoomThrough, compose} from '../film/choreography';
import {LightLeak} from '../film/Plate';
import {PaperBase} from '../paper/PaperBase';
import {Cutout, TornCard, HALFTONE_CSS} from '../paper/Cutout';
import {Headline, PullQuote, LabelCard, Stamp, TypewriterStrip} from '../paper/Type';
import {DrawnArrow, DottedPath, MarkerCircle, MarkerCross, SparkleField, SeaBand, Sparkle} from '../paper/Marks';
import {StickFigure, ThoughtBubble, type Pose} from '../paper/StickFigure';
import {DateTear, PostmarkRing, RecordClip, FigureCard, PAPER_TONES, LIFT} from '../paper/Evidence';
import {LowerRegister} from '../paper/LowerRegister';
import {PaperStrata, OffsetStroke} from '../paper/Strata';
import {ArchiveMarks} from '../paper/ArchiveMarks';
import {Tape, BrassPin, RedString, CornerCurl} from '../paper/Fixings';
import {CastShadow, ContactShadow} from '../film/CastShadow';
import {ArchiveClip} from './ArchiveClip';
import {CollageBuild} from './CollageBuild';
import type {ScenePayload, SceneProps, SceneTemplate} from './types';

const B = VERTICAL_BANDS;

/**
 * SAHNE ŞABLONLARI
 *
 * Hepsi aynı iskelete oturur:
 *   1. PaperBase — boş kağıt zemin. Sahne açıldığında ekranda YALNIZCA bu var.
 *   2. Öğeler enter() ile arkadan öne, anlatı sırasıyla tek tek girer.
 *   3. En fazla İKİ katmana drift() verilir; gerisi çakılı durur.
 *
 * 3. kural en önemlisi: referans videoda ölçülen davranış tam bu. Her katmana
 * hareket verilirse kompozisyon kilidi kaybolur ve sonuç kayan slayt olur.
 */

/* ------------------------------------------------------------------ */
/* 1. HERO CUTOUT — tek özne, seed'e bağlı üç yerleşim varyantı        */
/* ------------------------------------------------------------------ */
/**
 * NEDEN VARYANT VAR
 *
 * İlk sürümde bu şablonun tek bir yerleşimi vardı: ortada yırtık kart, üstünde
 * cutout, altta etiket ve başlık. Render'ın kontakt sayfasında 19 sahnenin
 * 9'unda birebir aynı kompozisyon göründü — çeşitlilik metriği "9 ayrı şablon"
 * diyordu ama izleyici aynı kareyi tekrar tekrar görüyordu, çünkü ŞABLON
 * çeşitliliği KOMPOZİSYON çeşitliliği demek değil.
 *
 * Üç varyant, seed'den deterministik seçiliyor. Aynı şablon ikinci kez
 * kullanıldığında farklı bir kare veriyor.
 */
const HeroCutout: React.FC<SceneProps> = ({seconds, payload, seed, index, occurrence, era}) => {
  const f = useCurrentFrame();
  /**
   * Girişler cue() ile sahne süresine yayılıyor. Önceki sabit takvimde
   * (0.15/0.35/1.0/1.15/1.35) 2.8 saniyelik bir sahnenin son 1.4 saniyesinde
   * hiç olay yoktu; ölçümde bu sahnenin kuyruğunda üç donmuş aralık çıktı.
   */
  /**
   * BAŞLIK HER ŞEYDEN ÖNCE GİRER — kullanıcı raporu: "ekran takip edilemiyor
   * okunamıyor."
   *
   * ÖLÇÜLEN SEBEP süre değildi. Başlığın opaklığı `label` girişine bağlıydı,
   * yani cue(seconds, 2, 5): 3 saniyelik bir sahnede 1.36. saniye. Okumaya
   * 1.64 saniye kalıyordu ve 6 kelimelik büyük harf bir başlık ~1.5 saniye
   * okuma ister — yani izleyici cümleyi ancak bitirirken sahne kesiliyordu.
   *
   * Aynı hata dört şablonda vardı (hero_cutout, wide_establish, star_field,
   * stick_beat): başlık, kendisiyle ilgisi olmayan bir öğenin girişine
   * bağlanmıştı. Metin OKUNACAK şey; ilk giren o olmalı ve sahne boyunca
   * kalmalı.
   */
  const title = enter(f, {at: 0.1, duration: 0.35, kind: 'fade'});
  const card = enter(f, {at: cue(seconds, 0, 5), duration: 0.4, kind: 'fade'});
  const hero = enter(f, {at: cue(seconds, 1, 5), duration: 0.55, kind: 'slide', from: {x: -180}});
  const label = enter(f, {at: cue(seconds, 2, 5), duration: 0.3, kind: 'drop', from: {y: -90}});
  const mark = enter(f, {at: cue(seconds, 3, 5), duration: 0.35, kind: 'stamp'});
  const ring = enter(f, {at: cue(seconds, 4, 5), duration: 0.7, kind: 'draw'});

  /**
   * Varyant SIRAYA bağlı, saf seed hash'ine değil.
   *
   * NEDEN: ilk sürüm `rand(seed)` kullanıyordu, dağılım şansa kalıyordu ve
   * headline_card'ın dört kullanımından üçü aynı varyantı çekti. Sahne
   * SIRASINA (`index`) bağlamak da yetmedi: o sahneler 3, 7, 11, 16. sıralarda
   * ve `% 2` aynı pariteli sıraları çakıştırıyor.
   *
   * Üçüncü deneme `(occurrence + rand(seed))` idi ve o da bozuktu: her sahnenin
   * seed'i farklı olduğu için "sabit kaydırma" diye eklediğim şey sahne başına
   * değişiyor, yani rotasyon yine rastgeleye dönüyordu.
   *
   * Doğrusu en yalını: saf `occurrence % N`. Şablonun birinci kullanımı 0.
   * varyant, ikincisi 1., üçüncüsü 2. — çakışma matematiksel olarak imkânsız.
   */
  const variant = occurrence % 3;

  // 0: ortada büyük · 1: sağa kaçık, solda şerit · 2: küçük, damgalı
  const scale = variant === 2 ? 0.58 : variant === 1 ? 0.68 : 0.78;
  const heroW = Math.round(SAFE_BOX.width * scale);
  const heroH = Math.round(B.hero.height * (variant === 2 ? 0.78 : 0.94));
  const offset = variant === 1 ? Math.round(SAFE_BOX.width * 0.16) : 0;
  const heroX = SAFE.left + Math.round((SAFE_BOX.width - heroW) / 2) + offset;
  const tilt = (rand(seed * 5.1) - 0.5) * 2.4;

  /**
   * FİLM KOREOGRAFİSİ
   *
   * Bu şablonun ölçülen sorunu şuydu: iki olay (kart açılır, hero girer) sonra
   * dört saniye boyunca yalnızca sürüklenme. Fark haritasında ölü zaman.
   *
   * Üç primitif üç olay daha ekliyor, YENİ ÖĞE EKLEMEDEN:
   *   · focusHunt  — hero girdikten SONRA netlenir (ayrı bir olay)
   *   · peel       — alttaki kart perspektifte oturur
   *   · holdJitter — yerleşmiş katman ölü durmaz
   */
  /**
   * NESNE YOKSA KART DA YOK — kontakt sayfasında ölçüldü.
   *
   * Cümlede somut nesne bulunamayan sahnelerde şablon yine de kartı ve
   * cutout'u çiziyordu; sonuç ya ANLAMSIZ SİYAH KUTU (jenerik `object`
   * silueti) ya da BOŞ BEYAZ KART oluyordu. Üç sahnede bu göründü.
   *
   * Deponun kendi kuralı zaten şunu diyor: "uydurma nesne çizmek yalan
   * görseldir". Kural bir adım daha gidiyor — nesne yoksa nesnenin YERİ de
   * çizilmez. O sahne tipografiyle anlatılır ve bu, insan siluetinin beşinci
   * kez çıkmasını da engelliyor.
   */
  const hasSubject = Boolean(payload.shape || payload.images?.[0]);
  const focus = focusHunt(f, {at: cue(seconds, 1, 5) + 0.1, duration: 0.7, from: 11});
  const cardPeel = peel(f, {seconds, at: cue(seconds, 0, 5), duration: 0.8, deg: 11, edge: variant === 1 ? 'right' : 'left'});

  return (
    <PaperBase seed={seed}>
      {/* KAĞIT KATMANLARI — kareyi malzemeyle dolduruyor, uydurma bilgiyle
          değil. Ölçüm ve gerekçe: src/paper/Strata.tsx. */}
      <PaperStrata seed={seed} opacity={card.opacity} />
      {/* ARŞİV İŞARETLERİ — dönem damgası + dosya sekmesi. İkisi de gerçek
          veriden: yıl anlatıdan, numara sahne sırasından. Gerekçe ArchiveMarks. */}
      <ArchiveMarks era={era} index={index} seed={seed} opacity={card.opacity} />
      {/* DEV RAKAM — beat'in kendi sayısı. Kanıt masasındaki tarih yaprağının
          karşılığı; cümlede sayı/ad yoksa `figure` hiç yazılmaz. */}
      {payload.figure && (
        <FigureCard
          figure={payload.figure}
          x={Math.round(CANVAS.width * 0.05)}
          y={Math.round(CANVAS.height * 0.60)}
          width={Math.round(CANVAS.width * 0.42)}
          height={Math.round(CANVAS.height * 0.17)}
          opacity={card.opacity}
          seed={seed}
        />
      )}
      <OffsetStroke
        x={heroX - 40}
        y={B.hero.y - 30}
        width={heroW + 80}
        height={heroH + 60}
        opacity={card.opacity}
      />
      {/*
        Peel sarmalayıcısı KARTIN KUTUSU kadar olmak zorunda, tam ekran değil.
        Tam ekran bir düzleme rotateY vermek, 1080 px genişlikte düzlemi
        döndürür ve kart yüzlerce piksel savrulur — perspektif öğeye değil
        ekrana uygulanmış olur.
      */}
      {hasSubject && (
      <div
        style={{
          position: 'absolute',
          left: heroX - 40,
          top: B.hero.y - 30,
          width: heroW + 80,
          height: heroH + 60,
          transform: cardPeel.transform,
          transformOrigin: cardPeel.origin,
        }}
      >
        <TornCard
          x={0}
          y={0}
          width={heroW + 80}
          height={heroH + 60}
          color={variant === 1 ? PALETTE.sea : PALETTE.groundWarm}
          rotate={-0.7 + tilt * 0.3}
          opacity={card.opacity}
          seed={seed + 1}
        />
      </div>
      )}
      {hasSubject && (
      <Cutout
        /*
          ŞEKİL CÜMLEDEN GELİYOR, şablonun sabiti değil. Burada sabit "figure"
          yazıyordu ve "stepped onto a double-hulled canoe" cümlesine insan
          silueti çiziliyordu.
        */
        shape={payload.shape ?? 'figure'}
        src={payload.images?.[0]}
        x={heroX}
        y={B.hero.y}
        width={heroW}
        height={heroH}
        seed={seed}
        rotate={tilt}
        opacity={hero.opacity}
        /*
          castShadow BURADA KAPALI ve sebebi render'a bakınca anlaşıldı.
          Bu hero, KAĞIDA YAPIŞTIRILMIŞ bir fotoğraf — bir zeminde duran bir
          figür değil. Zemine uzanan gölge verildiğinde kartın sağ kenarından
          taşan, hiçbir şeye ait olmayan bir üçgen çıktı. Yapıştırılmış parçanın
          doğru gölgesi Cutout'un kendi katman gölgesi (LAYER_SHADOW), yani
          kağıdın bir milim üstünde durması.
          Uzanan gölge ZEMİNDE DURAN öznelere ait: stick_beat, wide_establish.
        */
        focus={focus}
        jitter={holdJitter(f, seed)}
        // Tek sürüklenen katman: hero. Yavaş, birkaç on piksel.
        transform={`${hero.transform} ${drift(f, {seconds, dx: 38, dy: -26, scale: 0.075})}`}
      />
      )}

      {/*
        Özne yoksa sahne TİPOGRAFİK olur: cümle hero bandına büyük punto ile
        yazılır. Boş kart çizmektense cümleyi göstermek hem dürüst hem okunur.
      */}
      {!hasSubject && payload.headline && (
        <Headline
          text={payload.headline}
          size={TYPE.hook}
          align="left"
          fit={{width: SAFE_BOX.width, height: Math.round(B.hero.height * 0.9)}}
          style={{
            position: 'absolute',
            left: SAFE.left,
            top: B.hero.y + 20,
            width: SAFE_BOX.width,
            opacity: hero.opacity,
          }}
          seed={seed}
        />
      )}

      {/* Varyant 1: solda dikey daktilo şeridi — boşluğu bilgiyle doldurur. */}
      {variant === 1 && payload.caption && (
        <TypewriterStrip
          text={payload.caption}
          x={SAFE.left - 10}
          y={B.hero.y + Math.round(heroH * 0.2)}
          width={Math.round(SAFE_BOX.width * 0.2)}
          opacity={label.opacity}
        />
      )}

      {/* Varyant 2: tarih damgası — kağıt üstünde arşiv izi. */}
      {variant === 2 && payload.label && /^\d{4}$/.test(payload.label) && (
        <Stamp text={payload.label} x={heroX + heroW - 60} y={B.hero.y - 40} opacity={mark.opacity} transform={mark.transform} />
      )}

      {payload.label && !(variant === 2 && /^\d{4}$/.test(payload.label)) && (
        <LabelCard
          text={payload.label}
          x={SAFE.left + (variant === 1 ? Math.round(SAFE_BOX.width * 0.30) : 20)}
          y={B.bottom.y + 30}
          rotate={-1.4}
          opacity={label.opacity}
          transform={label.transform}
        />
      )}
      {hasSubject && payload.headline && (
        <Headline
          text={payload.headline}
          size={TYPE.subhead}
          align={variant === 1 ? 'center' : 'left'}
          style={{
            position: 'absolute',
            left: SAFE.left,
            top: B.bottom.y + 130,
            width: SAFE_BOX.width,
            opacity: title.opacity,
          }}
          seed={seed}
        />
      )}

      {/*
        Marker dairesi: ÖNCE `payload.label` şartına bağlıydı ve etiketi olmayan
        sahnelerde hiç çizilmiyordu — render'da tek bir daire göremedim. Oysa
        işaretlemenin sebebi etiket değil, gösterilecek bir özne olması.
        Varyant 0'da hero'yu işaretler.
      */}
      {/*
        OLUMSUZLAMA: nesne çizilir ve ÜSTÜ ÇİZİLİR.
        "He carried no compass" cümlesinde pusulayı öylece çizmek cümlenin
        tersini söyler. Çarpı, nesneyi tanınır bırakıp reddedildiğini gösterir —
        Vox dilinin olumsuzlama cihazı.
      */}
      {payload.negated ? (
        <MarkerCross
          cx={heroX + heroW * 0.5}
          cy={B.hero.y + heroH * 0.45}
          size={Math.min(heroW, heroH) * 0.82}
          // Zamanlama negationCue()'dan: aynı sayıyı iki şablonda elle tutmak
          // ikisinde de aynı hatayı üretti (bkz. choreography.ts yorumu).
          progress={enter(f, {...negationCue(seconds), kind: 'draw'}).progress}
          seed={seed}
          width={16}
        />
      ) : (
        variant === 0 &&
        index > 0 && (
          <MarkerCircle
            cx={heroX + heroW * 0.5}
            cy={B.hero.y + heroH * 0.34}
            rx={heroW * 0.3}
            progress={ring.progress}
            seed={seed}
          />
        )
      )}
      <SparkleField count={variant === 2 ? 4 : 2} seed={seed} progress={ring.progress} />
    </PaperBase>
  );
};

/* ------------------------------------------------------------------ */
/* 2. WIDE ESTABLISH — küçük özne, geniş boşluk, zemin bandı           */
/* ------------------------------------------------------------------ */
/**
 * VARYANT EKSİKLİĞİ GİDERİLDİ
 *
 * Bu şablon bir render'da üç kez kullanıldı ve üçünde birebir aynı kare çıktı:
 * bant hep %56'da, özne hep solda, başlık hep üstte. Diğer şablonlara varyant
 * eklerken bu atlanmıştı.
 *
 * Üç varyant, `occurrence % 3` ile — saf sıra, çünkü seed hash'i ve parite
 * hilelerinin ikisi de bu projede çakışma üretti:
 *   0: bant alçak, özne solda, başlık üstte      (geniş ufuk)
 *   1: bant yüksek, özne sağda, başlık altta     (yakın kıyı)
 *   2: bant ortada, özne küçük ve ortada, ışık sızması (uzaklık/yalnızlık)
 */
const WideEstablish: React.FC<SceneProps> = ({seconds, payload, seed, occurrence, era, index}) => {
  const f = useCurrentFrame();
  // Başlık ilk girer ve sahne boyunca kalır — bkz. hero_cutout'taki gerekçe.
  const title = enter(f, {at: 0.1, duration: 0.35, kind: 'fade'});
  const band = enter(f, {at: cue(seconds, 0, 3), duration: 0.6, kind: 'draw'});
  const subject = enter(f, {at: cue(seconds, 1, 3), duration: 0.7, kind: 'slide', from: {x: -260}});
  const cap = enter(f, {at: cue(seconds, 2, 3), duration: 0.35, kind: 'fade'});

  const variant = occurrence % 3;
  const bandY = Math.round(CANVAS.height * (variant === 1 ? 0.44 : variant === 2 ? 0.50 : 0.56));
  const w = Math.round(SAFE_BOX.width * (variant === 2 ? 0.26 : 0.42));
  const sx =
    variant === 1
      ? SAFE.left + Math.round(SAFE_BOX.width * 0.48)
      : variant === 2
        ? SAFE.left + Math.round((SAFE_BOX.width - w) / 2)
        : SAFE.left + Math.round(SAFE_BOX.width * 0.10);

  const focus = focusHunt(f, {at: cue(seconds, 1, 3) + 0.15, duration: 0.8, from: 13});
  /**
   * ZOOM-THROUGH: sahnenin son yarım saniyesinde özne büyüyerek kesmeye
   * hazırlanır. Sert kesme (bu stilin tek geçişi) hareketin doruğunda gelir.
   *
   * BEDELİ BİLİNİYOR: doğrulayıcı kompozisyon kilidini sahne süresinin %92'sinde
   * örnekliyor, yani tam bu pencerede. O sahnede "sabit piksel" oranı düşecek ve
   * ortalama bir-iki puan aşağı gidecek. Bilinçli takas: doğrulayıcı EDİTÖR,
   * cellat değil — uyarı verir, run'ı kırmaz. Bu yüzden tek şablonda ve dar
   * pencerede kullanılıyor; her sahneye konsa kompozisyon kilidi diye bir şey
   * kalmazdı.
   */
  const zoom = zoomThrough(f, {seconds, duration: 0.5, to: 1.26});

  return (
    <PaperBase seed={seed}>
      {/* KAĞIT KATMANLARI — kare ölçümde alt dilimlerde boştu.
          Malzeme ekliyor, uydurma bilgi değil: gerekçe src/paper/Strata.tsx. */}
      <PaperStrata seed={seed} opacity={title.opacity} />
      {/* ARŞİV İŞARETLERİ — dönem damgası + dosya sekmesi. İkisi de gerçek
          veriden: yıl anlatıdan, numara sahne sırasından. Gerekçe ArchiveMarks. */}
      <ArchiveMarks era={era} index={index} seed={seed} opacity={title.opacity} />
      {/* DEV RAKAM — beat'in kendi sayısı. Kanıt masasındaki tarih yaprağının
          karşılığı; cümlede sayı/ad yoksa `figure` hiç yazılmaz. */}
      {payload.figure && (
        <FigureCard
          figure={payload.figure}
          x={Math.round(CANVAS.width * 0.05)}
          y={Math.round(CANVAS.height * 0.60)}
          width={Math.round(CANVAS.width * 0.42)}
          height={Math.round(CANVAS.height * 0.17)}
          opacity={title.opacity}
          seed={seed}
        />
      )}
      <SeaBand y={bandY} height={CANVAS.height - bandY} progress={band.progress} seed={seed} />
      <Cutout
        shape={payload.shape ?? 'vessel'}
        src={payload.images?.[0]}
        x={sx}
        y={bandY - Math.round(w * 0.42)}
        width={w}
        height={Math.round(w * 0.7)}
        seed={seed}
        opacity={subject.opacity * zoom.opacity}
        castShadow
        // Su üstünde gölge değil YANSIMA olur: skew 0 (dümdüz aşağı), daha
        // bulanık, daha uzun. Aynı primitif, farklı parametre.
        shadowSkew={0}
        shadowLength={0.55}
        focus={focus}
        jitter={holdJitter(f, seed + 2)}
        transform={compose(
          subject.transform,
          // PARALLAX: özne ön katman (depth 0), tam hızda kayar.
          parallax(f, {seconds, dx: 96, dy: -8, depth: 0}),
          `scale(${zoom.scale.toFixed(3)})`,
        )}
      />
      {payload.headline && (
        <Headline
          text={payload.headline}
          size={TYPE.headline}
          // Üst banda sığmayan başlık cutout kartının altında kalıyordu.
          fit={{width: SAFE_BOX.width, height: B.hero.y - B.top.y - 24}}
          style={{
            position: 'absolute',
            left: SAFE.left,
            top: variant === 1 ? B.bottom.y + 40 : B.top.y,
            width: SAFE_BOX.width,
            opacity: title.opacity,
          }}
          seed={seed}
        />
      )}
      {payload.caption && (
        <TypewriterStrip
          text={payload.caption}
          x={SAFE.left}
          y={variant === 1 ? B.top.y + 20 : B.bottom.y + 180}
          width={SAFE_BOX.width - 60}
          opacity={cap.opacity}
        />
      )}
      {variant === 2 && <LightLeak corner="tr" opacity={0.18} />}
      <SparkleField count={2} seed={seed + 4} progress={cap.progress} bounds={{x: 120, y: 300, width: 800, height: 500}} />
    </PaperBase>
  );
};

/* ------------------------------------------------------------------ */
/* 3. HEADLINE CARD — büyük condensed başlık + portre + isim kartı     */
/* ------------------------------------------------------------------ */
const HeadlineCard: React.FC<SceneProps> = ({seconds, payload, seed, occurrence, era, index}) => {
  const f = useCurrentFrame();
  const head = enter(f, {at: cue(seconds, 0, 4), duration: 0.4, kind: 'drop', from: {y: -70}});
  const bar = enter(f, {at: cue(seconds, 1, 4), duration: 0.45, kind: 'draw'});
  const port = enter(f, {at: cue(seconds, 2, 4), duration: 0.55, kind: 'slide', from: {y: 120}});
  const name = enter(f, {at: cue(seconds, 3, 4), duration: 0.3, kind: 'stamp'});

  /**
   * İki yerleşim: 0 = portre ortada (klasik isim kartı), 1 = portre yana
   * kaçık ve yanında dikey daktilo şeridi. Aynı sebeple: bu şablon dört kez
   * kullanılınca dört kez aynı kare olmasın.
   */
  // Aynı gerekçe: rotasyon garanti, başlangıç noktası seed'den.
  const variant = occurrence % 2;
  const pw = Math.round(SAFE_BOX.width * (variant === 1 ? 0.52 : 0.66));
  const ph = Math.round(B.hero.height * 0.9);
  const px =
    variant === 1 ? SAFE.left + Math.round(SAFE_BOX.width * 0.40) : SAFE.left + Math.round((SAFE_BOX.width - pw) / 2);

  return (
    <PaperBase seed={seed}>
      {/* KAĞIT KATMANLARI — kare ölçümde alt dilimlerde boştu.
          Malzeme ekliyor, uydurma bilgi değil: gerekçe src/paper/Strata.tsx. */}
      <PaperStrata seed={seed} opacity={head.opacity} />
      {/* ARŞİV İŞARETLERİ — dönem damgası + dosya sekmesi. İkisi de gerçek
          veriden: yıl anlatıdan, numara sahne sırasından. Gerekçe ArchiveMarks. */}
      <ArchiveMarks era={era} index={index} seed={seed} opacity={head.opacity} />
      {/* DEV RAKAM — beat'in kendi sayısı. Kanıt masasındaki tarih yaprağının
          karşılığı; cümlede sayı/ad yoksa `figure` hiç yazılmaz. */}
      {payload.figure && (
        <FigureCard
          figure={payload.figure}
          x={Math.round(CANVAS.width * 0.05)}
          y={Math.round(CANVAS.height * 0.60)}
          width={Math.round(CANVAS.width * 0.42)}
          height={Math.round(CANVAS.height * 0.17)}
          opacity={head.opacity}
          seed={seed}
        />
      )}
      {payload.headline && (
        <Headline
          text={payload.headline}
          size={TYPE.headline}
          // Üst banda sığmayan başlık cutout kartının altında kalıyordu.
          fit={{width: SAFE_BOX.width, height: B.hero.y - B.top.y - 24}}
          align={variant === 1 ? 'left' : 'center'}
          reveal={bar.progress}
          style={{
            position: 'absolute',
            left: SAFE.left,
            top: B.top.y + 20,
            width: SAFE_BOX.width,
            opacity: head.opacity,
            transform: head.transform,
          }}
          seed={seed}
        />
      )}
      <TornCard
        x={px - 26}
        y={B.hero.y + 10}
        width={pw + 52}
        height={ph}
        color={variant === 1 ? PALETTE.groundWarm : PALETTE.sea}
        rotate={variant === 1 ? -1.1 : 0.6}
        opacity={port.opacity}
        seed={seed + 2}
      />
      {/* Varyant 1: portrenin solundaki boşlukta dikey künye şeridi. */}
      {variant === 1 && (
        <TypewriterStrip
          text={payload.caption ?? payload.label ?? ''}
          x={SAFE.left}
          y={B.hero.y + Math.round(ph * 0.34)}
          width={Math.round(SAFE_BOX.width * 0.34)}
          opacity={name.opacity}
        />
      )}
      <Cutout
        shape={payload.shape ?? 'figure'}
        src={payload.images?.[0]}
        x={px}
        y={B.hero.y}
        width={pw}
        height={ph}
        seed={seed}
        opacity={port.opacity}
        // Portre kartın üstüne yapıştırılmış: uzanan gölge YOK (hero_cutout'ta
        // aynı denendi ve kartın dışına taşan bir üçgen üretti). Katman gölgesi
        // yeter; buradaki film katkısı odak çekme.
        focus={focusHunt(f, {at: cue(seconds, 2, 4) + 0.1, duration: 0.65, from: 12})}
        jitter={holdJitter(f, seed + 5)}
        transform={`${port.transform} ${drift(f, {seconds, dy: -34, scale: 0.06})}`}
      />
      {payload.negated && (
        <MarkerCross
          cx={px + pw * 0.5}
          cy={B.hero.y + ph * 0.5}
          size={Math.min(pw, ph) * 0.78}
          progress={enter(f, {...negationCue(seconds), kind: 'draw'}).progress}
          seed={seed + 3}
          width={16}
        />
      )}
      {payload.label && (
        <LabelCard
          text={payload.label}
          x={SAFE.left + Math.round(SAFE_BOX.width * 0.18)}
          y={B.bottom.y + 40}
          opacity={name.opacity}
          transform={name.transform}
          rotate={-1}
        />
      )}
      {payload.caption && (
        <TypewriterStrip text={payload.caption} x={SAFE.left} y={B.bottom.y + 150} opacity={name.opacity} />
      )}
      {/* ALT KAYIT — alt bant ölçümde %0.0 doluydu. Gerekçe LowerRegister.
          `showCaption` kapalı: şerit yukarıda zaten çiziliyor. */}
      <LowerRegister payload={payload} seed={seed} opacity={name.opacity} showCaption={false} />
    </PaperBase>
  );
};

/* ------------------------------------------------------------------ */
/* 4. PULL QUOTE — italik serif, en duygusal cümle                     */
/* ------------------------------------------------------------------ */
const PullQuoteScene: React.FC<SceneProps> = ({seconds, payload, seed, era, index}) => {
  const f = useCurrentFrame();
  const q = enter(f, {at: cue(seconds, 0, 3), duration: 0.5, kind: 'fade'});
  const hl = enter(f, {at: cue(seconds, 1, 3), duration: 0.5, kind: 'draw'});
  const side = enter(f, {at: cue(seconds, 2, 3), duration: 0.5, kind: 'slide', from: {x: 140}});

  const cw = Math.round(SAFE_BOX.width * 0.46);

  /**
   * DOĞRULAYICI BU SAHNEYİ %100.0 SABİT ÖLÇTÜ.
   *
   * Tam video doğrulamasında 19 sahnenin sabit piksel oranları %74-95
   * arasındaydı; bu sahne birebir 100.0 çıktı — yani ölçüm penceresinde
   * TEK PİKSEL bile değişmiyor. Sebebi: alıntı metni girip duruyor, sürüklenen
   * hiçbir katman yok, cutout ise yalnızca `payload.images` ya da `label`
   * varsa çiziliyor ve bu beat'te ikisi de yok.
   *
   * "Her sahnede büyük bir katman hareket eder" kuralı buraya uygulanmamıştı.
   * En büyük nesne METNİN KENDİSİ, o yüzden sürüklenen o: çok yavaş, çok az —
   * alıntı sakin durmalı, ama ölü durmamalı.
   */
  /**
   * GENLİK ÖLÇÜLEREK ARTIRILDI. İlk denemede dy -26 / ölçek %3 verdim ve
   * doğrulayıcı sahneyi hâlâ %99.0 sabit ölçtü — yani düzeltme sayısal olarak
   * neredeyse hiçbir şey değiştirmemişti. Ölçüm penceresi sahnenin %55'i ile
   * %92'si arası, orada kosinüs yumuşatması hareketin en yavaş kısmına denk
   * geliyor ve 26 pikselin ancak bir kısmı gerçekleşiyor.
   */
  const quoteDrift = drift(f, {seconds, dy: -52, scale: 0.06});
  // Arkada duran büyük tırnak işareti: ikinci hareketli katman ve tipografik
  // olarak alıntının imzası. Metnin arkasında, ondan bağımsız kayar.
  const markDrift = drift(f, {seconds, dx: 64, dy: 38, scale: 0.09, phase: 0.25});

  return (
    <PaperBase seed={seed} ground="warm">
      {/* KAĞIT KATMANLARI — kare ölçümde alt dilimlerde boştu.
          Malzeme ekliyor, uydurma bilgi değil: gerekçe src/paper/Strata.tsx. */}
      <PaperStrata seed={seed} opacity={q.opacity} />
      {/* ARŞİV İŞARETLERİ — dönem damgası + dosya sekmesi. İkisi de gerçek
          veriden: yıl anlatıdan, numara sahne sırasından. Gerekçe ArchiveMarks. */}
      <ArchiveMarks era={era} index={index} seed={seed} opacity={q.opacity} />
      <div
        style={{
          position: 'absolute',
          left: SAFE.left - 30,
          top: B.top.y - 40,
          fontFamily: FONTS.quote,
          fontSize: 520,
          lineHeight: 0.7,
          color: PALETTE.accent,
          opacity: 0.22 * q.opacity,
          transform: markDrift,
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        {'\u201C'}
      </div>
      <PullQuote
        text={payload.quote ?? payload.headline ?? ''}
        size={TYPE.quote}
        reveal={hl.progress}
        style={{
          position: 'absolute',
          left: SAFE.left,
          top: B.top.y + 60,
          width: SAFE_BOX.width,
          opacity: q.opacity,
          transform: quoteDrift,
        }}
        seed={seed}
      />
      {payload.images?.[0] || payload.label ? (
        <>
          <Cutout
            shape={payload.shape ?? 'figure'}
            src={payload.images?.[0]}
            x={SAFE.left + Math.round((SAFE_BOX.width - cw) / 2)}
            y={B.hero.y + 120}
            width={cw}
            height={Math.round(cw * 1.25)}
            seed={seed}
            opacity={side.opacity}
            // Alıntı sahnesinde özne zeminde durmuyor, kağıdın üstünde yüzüyor:
            // uzanan gölge YOK, yalnızca odak çekme. Yanlış yerde gölge, gölge
            // olmamasından kötü durur.
            focus={focusHunt(f, {at: cue(seconds, 2, 3) + 0.15, duration: 0.7, from: 10})}
            jitter={holdJitter(f, seed + 9)}
            transform={`${side.transform} ${drift(f, {seconds, dx: -30, scale: 0.055})}`}
          />
          {payload.label && (
            <LabelCard
              text={payload.label}
              x={SAFE.left + Math.round(SAFE_BOX.width * 0.24)}
              y={B.bottom.y + 120}
              opacity={side.opacity}
              rotate={1.2}
            />
          )}
        </>
      ) : null}
      <SparkleField count={2} seed={seed + 7} progress={hl.progress} />
    </PaperBase>
  );
};

/* ------------------------------------------------------------------ */
/* 5. SPLIT COMPARE — dikeyde ÜST/ALT, yan yana değil                  */
/* ------------------------------------------------------------------ */
const SplitCompare: React.FC<SceneProps> = ({seconds, payload, seed}) => {
  const f = useCurrentFrame();
  const top = enter(f, {at: cue(seconds, 0, 3), duration: 0.45, kind: 'slide', from: {x: -240}});
  const bot = enter(f, {at: cue(seconds, 1, 3), duration: 0.45, kind: 'slide', from: {x: 240}});
  const rule = enter(f, {at: cue(seconds, 2, 3), duration: 0.4, kind: 'draw'});

  const sides = payload.sides;
  // Taraf etiketi yoksa karşılaştırma sahnesi kurulamaz: sessizce boş panel
  // çizmek yerine hero_cutout'a düşülür (kayıt registry'de yapılır).
  if (!sides) return <HeroCutout seconds={4} payload={payload} seed={seed} index={1} occurrence={0} />;

  const panelH = Math.round(SAFE_BOX.height * 0.40);
  const mid = SAFE.top + Math.round(SAFE_BOX.height * 0.5);

  const Panel: React.FC<{
    y: number;
    side: {label: string; detail?: string};
    op: number;
    tr: string;
    ground: string;
    shape: NonNullable<ScenePayload['shape']>;
    s: number;
  }> = ({y, side, op, tr, ground, shape, s}) => (
    <>
      <TornCard
        x={SAFE.left}
        y={y}
        width={SAFE_BOX.width}
        height={panelH}
        color={ground}
        opacity={op}
        seed={s}
        rotate={0}
      />
      <Cutout
        shape={shape}
        x={SAFE.left + 60}
        y={y + 40}
        width={Math.round(panelH * 0.62)}
        height={panelH - 130}
        seed={s}
        opacity={op}
        transform={tr}
        outline={7}
        // Panel fotoğrafı da yapıştırılmış parça: uzanan gölge yok, odak var.
        focus={focusHunt(f, {at: cue(seconds, 0, 3) + 0.2, duration: 0.6, from: 8})}
        jitter={holdJitter(f, s)}
      />
      <div
        style={{
          position: 'absolute',
          left: SAFE.left + Math.round(panelH * 0.62) + 110,
          top: y + 60,
          width: SAFE_BOX.width - Math.round(panelH * 0.62) - 160,
          opacity: op,
          transform: tr,
        }}
      >
        <div
          style={{
            fontFamily: FONTS.display,
            fontWeight: 700,
            fontSize: TYPE.subhead,
            lineHeight: 1.0,
            textTransform: 'uppercase',
            color: PALETTE.ink,
          }}
        >
          {side.label}
        </div>
        {side.detail && (
          <div
            style={{
              fontFamily: FONTS.display,
              fontWeight: 400,
              fontSize: TYPE.label,
              marginTop: 16,
              lineHeight: 1.25,
              color: 'rgba(24,36,48,0.82)',
            }}
          >
            {side.detail}
          </div>
        )}
      </div>
    </>
  );

  return (
    <PaperBase seed={seed}>
      <Panel
        y={SAFE.top + 30}
        side={sides[0]}
        op={top.opacity}
        tr={top.transform}
        ground={PALETTE.paper}
        shape={payload.shape ?? 'figure'}
        s={seed + 1}
      />
      <Panel
        y={mid + 40}
        side={sides[1]}
        op={bot.opacity}
        tr={bot.transform}
        ground={PALETTE.sea}
        // Karşılaştırmanın ikinci tarafı: cümlenin ikinci nesnesi. Birincil
        // şekille AYNI olamaz, yoksa "karşılaştırma" iki aynı resim olur.
        shape={payload.shape2 && payload.shape2 !== payload.shape ? payload.shape2 : 'object'}
        s={seed + 2}
      />
      {/* Ayırıcı: iki panel arasına çizilen tek çizgi. */}
      <div
        style={{
          position: 'absolute',
          left: SAFE.left,
          top: mid - 4,
          height: 8,
          width: SAFE_BOX.width * rule.progress,
          background: PALETTE.accent,
        }}
      />
    </PaperBase>
  );
};

/* ------------------------------------------------------------------ */
/* 6. LABELED DIAGRAM — özne + ok + hedef + caption kartı              */
/* ------------------------------------------------------------------ */
const LabeledDiagram: React.FC<SceneProps> = ({seconds, payload, seed, era, index}) => {
  const f = useCurrentFrame();
  const a = enter(f, {at: cue(seconds, 0, 4), duration: 0.45, kind: 'drop', from: {y: -140}});
  const b = enter(f, {at: cue(seconds, 1, 4), duration: 0.45, kind: 'drop', from: {y: -140}});
  const arrow = enter(f, {at: cue(seconds, 2, 4), duration: 0.6, kind: 'draw'});
  const cap = enter(f, {at: cue(seconds, 3, 4), duration: 0.35, kind: 'stamp'});

  /**
   * KOMPOZİSYON ÖLÇÜLEREK BÜYÜTÜLDÜ.
   *
   * Render'da bu şablonun ALT %55'i tamamen boş krem kağıt çıkıyordu: iki kutu
   * hero bandının üst kenarına yapışmış, alt bant hiç kullanılmamış. 9:16
   * kompozisyon yasası üst %18 / hero %52 / alt %30 diyor ve alt bandın işi
   * caption/etiket taşımak; bu beat'lerde ikisi de olmayınca bant boş kalıyordu.
   *
   * İki düzeltme: kutular büyütüldü ve hero bandının OPTİK MERKEZİNE oturtuldu;
   * caption yoksa alt banda cümlenin tamamı daktilo şeridi olarak konuyor —
   * başlık zaten kırpılmış hâli, şerit tam hâli veriyor.
   */
  /**
   * GENİŞLİK 0.52'DEN 0.47'YE — İKİ KUTU ÇAKIŞIYORDU.
   *
   * 0.52 × 2 = güvenli alanın %104'ü. Render'da uçak kutusu ile hedef kutusu
   * üst üste bindi. Boşluğu doldurmak isterken kompozisyonu bozmak; ölçü
   * basitti ve bakmadan yazdım.
   */
  const boxW = Math.round(SAFE_BOX.width * 0.47);
  const boxH = Math.round(boxW * 1.05);
  const leftX = SAFE.left;
  const rightX = SAFE.left + SAFE_BOX.width - boxW;
  const rowY = B.hero.y + Math.round((B.hero.height - boxH) * 0.34);

  return (
    <PaperBase seed={seed}>
      {/* KAĞIT KATMANLARI — kare ölçümde alt dilimlerde boştu.
          Malzeme ekliyor, uydurma bilgi değil: gerekçe src/paper/Strata.tsx. */}
      <PaperStrata seed={seed} opacity={a.opacity} />
      {/* ARŞİV İŞARETLERİ — dönem damgası + dosya sekmesi. İkisi de gerçek
          veriden: yıl anlatıdan, numara sahne sırasından. Gerekçe ArchiveMarks. */}
      <ArchiveMarks era={era} index={index} seed={seed} opacity={a.opacity} />
      {/* DEV RAKAM — beat'in kendi sayısı. Kanıt masasındaki tarih yaprağının
          karşılığı; cümlede sayı/ad yoksa `figure` hiç yazılmaz. */}
      {payload.figure && (
        <FigureCard
          figure={payload.figure}
          x={Math.round(CANVAS.width * 0.05)}
          y={Math.round(CANVAS.height * 0.60)}
          width={Math.round(CANVAS.width * 0.42)}
          height={Math.round(CANVAS.height * 0.17)}
          opacity={a.opacity}
          seed={seed}
        />
      )}
      {payload.headline && (
        <Headline
          text={payload.headline}
          size={TYPE.subhead}
          fit={{width: SAFE_BOX.width, height: B.hero.y - B.top.y - 24}}
          style={{position: 'absolute', left: SAFE.left, top: B.top.y, width: SAFE_BOX.width, opacity: a.opacity}}
          seed={seed}
        />
      )}
      {/* Alt bant: caption varsa o, yoksa cümlenin tam hâli. Boş bırakmak
          kompozisyonu yarım gösteriyordu. */}
      {(payload.caption ?? payload.headline) && (
        <TypewriterStrip
          text={(payload.caption ?? payload.headline ?? '').replace(/\*/g, '')}
          x={SAFE.left}
          y={B.bottom.y + 40}
          width={SAFE_BOX.width - 40}
          opacity={cap.opacity}
        />
      )}
      <Cutout
        shape={payload.shape ?? 'figure'}
        src={payload.images?.[0]}
        x={leftX}
        y={rowY}
        width={boxW}
        height={boxH}
        seed={seed}
        opacity={a.opacity}
        transform={a.transform}
        rotate={-1.2}
      />
      <Cutout
        /*
          İkinci kutu cümlenin İKİNCİ somut nesnesi. Sabit "vessel" yazdığında
          "the swell, and the flight of birds" cümlesine yelkenli çiziliyordu.
          İkinci nesne yoksa terrain'e düşer: ok "bir yere doğru" anlamı taşır,
          hedefin bir yer olması en az yanıltıcı varsayım.
        */
        shape={payload.shape2 ?? (payload.shape === 'terrain' ? 'figure' : 'terrain')}
        src={payload.images?.[1]}
        x={rightX}
        y={rowY + 90}
        width={boxW}
        height={Math.round(boxW * 0.72)}
        seed={seed + 3}
        opacity={b.opacity}
        transform={`${b.transform} ${drift(f, {seconds, dx: 34, dy: 18})}`}
        rotate={1.4}
      />
      <DrawnArrow
        from={{x: leftX + boxW - 10, y: rowY + boxH * 0.55}}
        to={{x: rightX + 20, y: rowY + 90 + boxW * 0.3}}
        progress={arrow.progress}
        curve={-0.22}
      />
      {payload.sides && (
        <>
          <LabelCard text={payload.sides[0].label} x={leftX + 10} y={rowY + boxH + 20} opacity={b.opacity} rotate={-1} />
          <LabelCard
            text={payload.sides[1].label}
            x={rightX + 10}
            y={rowY + 90 + Math.round(boxW * 0.72) + 20}
            opacity={cap.opacity}
            rotate={1}
            accent
          />
        </>
      )}
      {payload.caption && (
        <TypewriterStrip
          text={payload.caption}
          x={SAFE.left}
          y={B.bottom.y + 160}
          width={SAFE_BOX.width - 40}
          opacity={cap.opacity}
        />
      )}
      {payload.label && <Stamp text={payload.label} x={SAFE.left + 40} y={B.bottom.y + 40} opacity={cap.opacity} transform={cap.transform} />}
    </PaperBase>
  );
};

/* ------------------------------------------------------------------ */
/* 7. ARCHIVAL TIMELINE — noktalı çizgi üstünde büyük tarihler         */
/* ------------------------------------------------------------------ */
const ArchivalTimeline: React.FC<SceneProps> = ({seconds, payload, seed}) => {
  const f = useCurrentFrame();
  const line = enter(f, {at: cue(seconds, 0, 2), duration: Math.max(0.8, seconds * 0.4), kind: 'draw'});
  const items = payload.timeline ?? [];

  const cx = SAFE.left + 130;
  const startY = B.top.y + 90;
  const gap = items.length > 1 ? Math.min(300, Math.round((SAFE_BOX.height - 260) / (items.length - 1))) : 0;

  return (
    <PaperBase seed={seed}>
      {/* Dikeyde zaman çizelgesi YUKARIDAN AŞAĞI akar; yatay şablonun 90 derece
          döndürülmüş hâli değil, dikey için yeniden kurulmuş hâli. */}
      <DottedPath
        points={[
          {x: cx, y: startY},
          {x: cx, y: startY + gap * Math.max(items.length - 1, 1)},
        ]}
        progress={line.progress}
        color={PALETTE.ink}
        width={7}
        dash={18}
      />
      {items.map((it, i) => {
        // Zaman çizelgesi maddeleri sahnenin %86'sına kadar yayılıyor.
        const st = enter(f, {at: cue(seconds, 1 + i, 1 + items.length), duration: 0.4, kind: 'slide', from: {x: -120}});
        const y = startY + gap * i;
        return (
          <React.Fragment key={i}>
            <div
              style={{
                position: 'absolute',
                left: cx - 22,
                top: y - 22,
                width: 44,
                height: 44,
                borderRadius: '50%',
                background: PALETTE.accent,
                opacity: st.opacity,
                filter: 'drop-shadow(0 6px 8px rgba(24,18,8,0.3))',
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: cx + 60,
                top: y - 58,
                width: SAFE_BOX.width - 190,
                opacity: st.opacity,
                transform: st.transform,
              }}
            >
              <div
                style={{
                  fontFamily: FONTS.display,
                  fontWeight: 700,
                  fontSize: 92,
                  lineHeight: 0.9,
                  color: PALETTE.accent,
                  letterSpacing: '-0.02em',
                }}
              >
                {it.year}
              </div>
              {it.text && (
                <div
                  style={{
                    fontFamily: FONTS.display,
                    fontWeight: 400,
                    fontSize: TYPE.label,
                    marginTop: 8,
                    color: PALETTE.ink,
                    lineHeight: 1.24,
                  }}
                >
                  {it.text}
                </div>
              )}
            </div>
          </React.Fragment>
        );
      })}
      {payload.headline && (
        <Headline
          text={payload.headline}
          size={TYPE.subhead}
          // ÖLÇÜLDÜ: burada `CANVAS.height - SAFE.bottom + 20` yazıyordu, yani
          // başlık tam olarak Shorts arayüzünün yediği alt banda düşüyordu.
          style={{position: 'absolute', left: SAFE.left, top: B.bottom.y + 150, width: SAFE_BOX.width}}
          seed={seed}
        />
      )}
    </PaperBase>
  );
};

/* ------------------------------------------------------------------ */
/* 8. MAP ROUTE — harita zemini + noktalı rota + duraklar              */
/* ------------------------------------------------------------------ */
/**
 * BU ŞABLON ÖLÇÜMDE EN KÖTÜ ÇIKANDI — ve neden olduğu tam olarak biliniyor.
 *
 * 12 saniyelik dilimin kare-kare analizinde bu sahnenin (2.8 sn) son 2.25
 * saniyesinde değişim %0.00 ölçüldü. Videodaki 20 donmuş aralığın 9'u buradan
 * geliyordu. İki ayrı sebep vardı ve ikisi de düzeltildi:
 *
 * 1. TAKVİM SAHNE SÜRESİNİ BİLMİYORDU — her şey ilk 1.9 saniyede bitiyordu.
 *    Çözüm: cue() ile girişler sahnenin %86'sına kadar yayılıyor.
 *
 * 2. HAREKET EDEN ŞEYLER ÇOK KÜÇÜKTÜ — 8px kalınlığında rota çizgisi ve 36px
 *    duraklar. 1080 genişlikte bunlar karenin binde birini kaplıyor; teknik
 *    olarak "hareket var" ama izleyici için yok. Bu, kullanıcının "çok yavaş
 *    hareketlenmeler" şikâyetinin ölçülmüş hâli.
 *    Çözüm: SAHNENİN EN BÜYÜK NESNESİ hareket ediyor — harita plakasının
 *    kendisi sürükleniyor ve ölçekleniyor. Duraklar da büyütüldü.
 *
 * Genel kural olarak çıkarılan sonuç: her sahnede BÜYÜK bir katman hareket
 * etmek zorunda. Cutout'u olmayan şablonlarda bu unutulmuştu.
 */
const MapRoute: React.FC<SceneProps> = ({seconds, payload, seed}) => {
  const f = useCurrentFrame();
  const base = enter(f, {at: cue(seconds, 0, 5), duration: 0.4, kind: 'fade'});
  const path = enter(f, {at: cue(seconds, 1, 5), duration: Math.max(0.9, seconds * 0.42), kind: 'draw'});

  const mapX = SAFE.left;
  const mapY = B.hero.y - 120;
  const mapW = SAFE_BOX.width;
  const mapH = Math.round(SAFE_BOX.height * 0.52);

  const stops = payload.route ?? [
    {x: 0.16, y: 0.72},
    {x: 0.5, y: 0.42},
    {x: 0.84, y: 0.24},
  ];
  const pts = stops.map((s) => ({x: mapX + s.x * mapW, y: mapY + s.y * mapH}));

  return (
    <PaperBase seed={seed} ground="warm">
      {/* Harita zemini: kod çizimi. Bir görsel modeli doğru coğrafya çizemez;
          burada gereken şey doğru coğrafya değil, OKUNUR şema.

          Bu plaka sahnenin en büyük nesnesi ve artık SÜRÜKLENEN katman o.
          Rotanın çizildiği yöne doğru ağır ağır kayıyor — harita üstünde
          ilerleyen bir parmak izlenimi. */}
      <div
        style={{
          position: 'absolute',
          left: mapX,
          top: mapY,
          width: mapW,
          height: mapH,
          opacity: base.opacity,
          background: PALETTE.sea,
          filter: 'drop-shadow(0 12px 16px rgba(24,18,8,0.22))',
          transform: drift(f, {seconds, dx: -46, dy: 28, scale: 0.085}),
          transformOrigin: '30% 70%',
        }}
      >
        <svg width={mapW} height={mapH} style={{display: 'block'}}>
          {/* Enlem/boylam ızgarası */}
          {Array.from({length: 7}, (_, i) => (
            <line
              key={`h${i}`}
              x1={0}
              y1={(i * mapH) / 6}
              x2={mapW}
              y2={(i * mapH) / 6}
              stroke="rgba(24,36,48,0.16)"
              strokeWidth={2}
            />
          ))}
          {Array.from({length: 5}, (_, i) => (
            <line
              key={`v${i}`}
              x1={(i * mapW) / 4}
              y1={0}
              x2={(i * mapW) / 4}
              y2={mapH}
              stroke="rgba(24,36,48,0.16)"
              strokeWidth={2}
            />
          ))}
          {/* Kara kütleleri: deterministik, seed'e bağlı */}
          {Array.from({length: 3}, (_, i) => {
            const r1 = rand(seed * 13 + i * 5);
            const r2 = rand(seed * 17 + i * 9);
            const w = mapW * (0.18 + r1 * 0.2);
            return (
              <ellipse
                key={`l${i}`}
                cx={mapW * (0.14 + r1 * 0.7)}
                cy={mapH * (0.16 + r2 * 0.68)}
                rx={w}
                ry={w * (0.42 + r2 * 0.3)}
                fill={PALETTE.groundWarm}
                opacity={0.92}
              />
            );
          })}
        </svg>
      </div>
      {/* Rota çizgisi kalınlaştırıldı: 8px, 1080 genişlikte karenin binde
          yedisi. Ölçümde "hareket var ama görünmüyor" çıkan şeylerden biriydi. */}
      <DottedPath points={pts} progress={path.progress} color={PALETTE.accent} width={13} dash={26} />
      {stops.map((s, i) => {
        // Duraklar sahnenin sonuna kadar yayılıyor: son durak ~%86'da damgalanır.
        const st = enter(f, {at: cue(seconds, 2 + i, 2 + stops.length), duration: 0.3, kind: 'stamp'});
        const p = pts[i];
        const r = 30; // 18 → 30: damga artık uzaktan da bir olay
        return (
          <React.Fragment key={i}>
            <div
              style={{
                position: 'absolute',
                left: p.x - r,
                top: p.y - r,
                width: r * 2,
                height: r * 2,
                borderRadius: '50%',
                background: PALETTE.accent,
                border: `6px solid ${PALETTE.paper}`,
                boxShadow: '0 8px 12px rgba(24,18,8,0.28)',
                opacity: st.opacity,
                transform: st.transform,
              }}
            />
            {s.label && (
              <LabelCard text={s.label} x={p.x + 38} y={p.y - 30} opacity={st.opacity} size={30} />
            )}
          </React.Fragment>
        );
      })}
      {/*
        KAPANIŞ OLAYI: son durağın etrafına çizilen daire, sahnenin %88'inde
        başlar. Ölü kuyruğu kapatan şey bu — sahnenin son yarım saniyesinde de
        ekranda bir şey OLUYOR.
      */}
      <MarkerCircle
        cx={pts[pts.length - 1].x}
        cy={pts[pts.length - 1].y}
        rx={116}
        ry={92}
        progress={enter(f, {at: Math.max(0.4, seconds * 0.62), duration: Math.max(0.5, seconds * 0.3), kind: 'draw'}).progress}
        seed={seed}
        width={9}
      />
      {payload.headline && (
        <Headline
          text={payload.headline}
          size={TYPE.subhead}
          style={{position: 'absolute', left: SAFE.left, top: B.bottom.y + 90, width: SAFE_BOX.width}}
          seed={seed}
        />
      )}
    </PaperBase>
  );
};

/* ------------------------------------------------------------------ */
/* 9. GRID SCALE — tekrarlı ikon ızgarası, birkaçı vurgulu             */
/* ------------------------------------------------------------------ */
const GridScale: React.FC<SceneProps> = ({seconds, payload, seed}) => {
  const f = useCurrentFrame();
  const total = Math.max(1, Math.min(payload.ratio?.total ?? 10, 60));
  const hi = Math.max(0, Math.min(payload.ratio?.highlighted ?? 3, total));
  const cols = total <= 12 ? Math.min(total, 5) : total <= 30 ? 6 : 10;
  const rows = Math.ceil(total / cols);

  const cellW = Math.floor(SAFE_BOX.width / cols);
  const cellH = Math.min(cellW * 1.3, Math.floor((SAFE_BOX.height * 0.55) / rows));
  const gridW = cellW * cols;
  const gridX = SAFE.left + Math.round((SAFE_BOX.width - gridW) / 2);
  const gridY = B.hero.y - 60;

  const bar = enter(f, {at: cue(seconds, 1, 2), duration: 0.5, kind: 'draw'});

  /**
   * DOĞRULAYICI BU SAHNEYİ %99.8 SABİT ÖLÇTÜ — pratikte donmuş.
   *
   * Izgara ilk yarım saniyede tamamen beliriyor (ikon başına 0.028 sn) ve
   * sonrasında hiçbir şey olmuyor. İki düzeltme:
   *
   * 1. Izgaranın DOLMASI sahne süresine yayılıyor. Sayının büyüklüğü zamanla
   *    hissedilmeli; bu şablonun bütün işi bu. 60 ikonu yarım saniyede basmak
   *    "çok" hissi vermiyor, tek bir doku olarak okunuyor.
   * 2. Izgara plakası bir bütün olarak ağır ağır sürükleniyor — sahnenin en
   *    büyük nesnesi o.
   */
  const fillSpan = Math.max(0.9, seconds * 0.62);
  const gridDrift = drift(f, {seconds, dy: -22, scale: 0.05});

  return (
    <PaperBase seed={seed}>
      {payload.headline && (
        <Headline
          text={payload.headline}
          size={TYPE.subhead}
          align="center"
          style={{position: 'absolute', left: SAFE.left, top: B.top.y, width: SAFE_BOX.width}}
          seed={seed}
        />
      )}
      {Array.from({length: total}, (_, i) => {
        // İkonlar sırayla belirir — sayının büyüklüğü ZAMANLA hissedilir.
        // Yayılma sahne süresinden geliyor, sabit 0.028 sn'den değil.
        const st = enter(f, {at: cue(seconds, 0, 2) + (i / total) * fillSpan, duration: 0.22, kind: 'stamp'});
        const on = i < hi;
        const c = i % cols;
        const r = Math.floor(i / cols);
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: gridX + c * cellW,
              top: gridY + r * cellH,
              width: cellW,
              height: cellH,
              opacity: st.opacity,
              transform: compose(gridDrift, st.transform),
            }}
          >
            <svg viewBox="0 0 100 140" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
              <circle cx="50" cy="30" r="20" fill={on ? PALETTE.accent : 'rgba(24,36,48,0.72)'} />
              <path
                d="M50 56 C30 56 22 72 20 100 L20 132 L80 132 L80 100 C78 72 70 56 50 56 Z"
                fill={on ? PALETTE.accent : 'rgba(24,36,48,0.72)'}
              />
            </svg>
          </div>
        );
      })}
      {/* Oranı yazıyla da söyle: görsel sayma işini izleyiciye bırakmak riskli. */}
      <div
        style={{
          position: 'absolute',
          left: SAFE.left,
          top: gridY + rows * cellH + 60,
          width: SAFE_BOX.width,
          textAlign: 'center',
          fontFamily: FONTS.display,
          fontWeight: 700,
          fontSize: 76,
          color: PALETTE.ink,
          opacity: bar.opacity,
        }}
      >
        <span style={{color: PALETTE.accent}}>{hi}</span>
        <span style={{fontSize: 48, opacity: 0.7}}>{` / ${total} ${payload.ratio?.unit ?? ''}`}</span>
      </div>
    </PaperBase>
  );
};

/* ------------------------------------------------------------------ */
/* 10. DATA ANNOTATE — minimal grafik + tek aksan çizgi + elle daire   */
/* ------------------------------------------------------------------ */
const DataAnnotate: React.FC<SceneProps> = ({seconds, payload, seed}) => {
  const f = useCurrentFrame();
  const axes = enter(f, {at: cue(seconds, 0, 4), duration: 0.4, kind: 'draw'});
  const line = enter(f, {at: cue(seconds, 1, 4), duration: Math.max(0.8, seconds * 0.34), kind: 'draw'});
  const ring = enter(f, {at: cue(seconds, 2, 4), duration: 0.6, kind: 'draw'});
  const note = enter(f, {at: cue(seconds, 3, 4), duration: 0.3, kind: 'fade'});

  const series = payload.series?.length ? payload.series : [0.12, 0.2, 0.18, 0.34, 0.46, 0.62, 0.94];
  const cw = SAFE_BOX.width - 80;
  const ch = Math.round(SAFE_BOX.height * 0.42);
  const cx0 = SAFE.left + 60;
  const cy0 = B.hero.y - 40;

  const pts = series.map((v, i) => ({
    x: cx0 + (i / Math.max(series.length - 1, 1)) * cw,
    y: cy0 + ch - v * ch,
  }));
  const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  let len = 0;
  for (let i = 1; i < pts.length; i += 1) len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  const last = pts[pts.length - 1];

  return (
    <PaperBase seed={seed}>
      {payload.headline && (
        <Headline
          text={payload.headline}
          size={TYPE.subhead}
          style={{position: 'absolute', left: SAFE.left, top: B.top.y, width: SAFE_BOX.width}}
          seed={seed}
        />
      )}
      <svg
        width={CANVAS.width}
        height={CANVAS.height}
        style={{position: 'absolute', left: 0, top: 0, pointerEvents: 'none'}}
      >
        {/* Eksenler: iki çizgi, ızgara yok. Referans stil "minimal chart". */}
        <path
          d={`M ${cx0} ${cy0} L ${cx0} ${cy0 + ch} L ${cx0 + cw} ${cy0 + ch}`}
          fill="none"
          stroke="rgba(24,36,48,0.5)"
          strokeWidth={5}
          strokeDasharray={ch + cw}
          strokeDashoffset={(ch + cw) * (1 - axes.progress)}
        />
        <path
          d={d}
          fill="none"
          stroke={PALETTE.accent}
          strokeWidth={11}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={len}
          strokeDashoffset={len * (1 - line.progress)}
        />
      </svg>
      <MarkerCircle cx={last.x} cy={last.y} rx={92} ry={74} progress={ring.progress} seed={seed} width={9} />
      {payload.label && (
        <LabelCard
          text={payload.label}
          x={Math.min(last.x - 60, CANVAS.width - SAFE.right - 300)}
          y={last.y - 190}
          opacity={note.opacity}
          accent
          rotate={-2}
        />
      )}
      {payload.caption && (
        <TypewriterStrip text={payload.caption} x={SAFE.left} y={B.bottom.y + 140} opacity={note.opacity} />
      )}
    </PaperBase>
  );
};

/* ------------------------------------------------------------------ */
/* 11. STICK BEAT — soyut/duygusal beat, çöp adam kaydı                */
/* ------------------------------------------------------------------ */
const POSE_BY_SEED: Pose[] = ['stand', 'point', 'slump', 'overwhelmed', 'sit-desk', 'sleep'];

const StickBeat: React.FC<SceneProps> = ({seconds, payload, seed}) => {
  const f = useCurrentFrame();
  // Girişler sahne süresine yayılıyor (cue), sabit saniyeye çakılı değil.
  const fig = enter(f, {at: cue(seconds, 1, 4), duration: 0.5, kind: 'drop', from: {y: -120}});
  // Başlık ilk girer — bkz. hero_cutout'taki gerekçe.
  const title = enter(f, {at: 0.1, duration: 0.35, kind: 'fade'});
  const head = enter(f, {at: cue(seconds, 2, 4), duration: 0.4, kind: 'fade'});
  const hl = enter(f, {at: cue(seconds, 3, 4), duration: 0.5, kind: 'draw'});

  const pose = POSE_BY_SEED[Math.floor(rand(seed) * POSE_BY_SEED.length)];
  const h = Math.round(B.hero.height * 0.82);
  const wobble = breathe(f, seed) * 0.6;
  const figX = SAFE.left + Math.round(SAFE_BOX.width / 2) - Math.round(((h / 150) * 100) / 2);
  const figW = Math.round((h / 150) * 100);
  const figY = B.hero.y + 40;

  return (
    <PaperBase seed={seed} stains={false}>
      {/*
        ZEMİN PLAKASI — ölçümle eklendi.

        Bu sahne 12 saniyelik analizde tek bir "olay" üretmedi: en yüksek
        değişim %4.46, eşik %6. Sebep çöp adamın çizgi resmi olması — 9px
        kalınlığında çizgiler karenin binde birini kaplar, yani giriş
        animasyonu teknik olarak var ama izleyicinin gördüğü bir OLAY değil.
        Kullanıcının "çok yavaş hareketlenmeler" şikâyeti bunun ölçülmüş hâli.
        Çözüm çizgileri kalınlaştırmak değil (o çöp adamı bozar), altına BÜYÜK
        bir kağıt plaka koymak: giren şey artık ekranın üçte biri.
      */}
      <TornCard
        x={SAFE.left - 20}
        y={figY - 40}
        width={SAFE_BOX.width + 40}
        height={h + 120}
        color={PALETTE.groundWarm}
        opacity={enter(f, {at: cue(seconds, 0, 4), duration: 0.42, kind: 'fade'}).opacity}
        transform={enter(f, {at: cue(seconds, 0, 4), duration: 0.42, kind: 'slide', from: {x: -140}}).transform}
        seed={seed + 11}
        rotate={-0.6}
      />
      {/*
        Çöp adamın zemin gölgesi. Cutout'un içine gömülü kolaylıktan
        yararlanamıyor çünkü StickFigure bir SVG, bir raster maske değil —
        CastShadow'a children olarak İKİNCİ bir kopya veriliyor ve brightness(0)
        onu siyaha indiriyor. Aynı teknik, aynı sonuç: ayrı gölge varlığı yok.

        NEDEN ÖNEMLİ: gölgesiz çöp adam kağıdın üstünde YÜZER. Referans videoda
        çöp adamların hepsi bir zemine basıyor.
      */}
      <CastShadow
        x={figX}
        y={figY}
        width={figW}
        height={h}
        // ÖLÇÜLDÜ: -53°/0.55 ile gölge kartın dışına, karenin sağ kenarına
        // kadar uzanıyordu. Rehberdeki -53° 16:9 bir kare için yazılmış; 9:16'da
        // aynı açı figür boyunun 1.3 katı yatay kayma üretiyor.
        skew={-30}
        length={0.4}
        opacity={0.42 * fig.opacity}
        transform={fig.transform}
      >
        <StickFigure pose={pose} x={0} y={0} height={h} outline={0} />
      </CastShadow>
      <ContactShadow x={figX} y={figY + h} width={figW} opacity={0.3 * fig.opacity} transform={fig.transform} />
      <StickFigure
        pose={pose}
        x={figX}
        y={figY}
        height={h}
        opacity={fig.opacity}
        transform={`${fig.transform} rotate(${wobble.toFixed(2)}deg)`}
      />
      {payload.images?.[0] && (
        <ThoughtBubble
          x={SAFE.left + Math.round(SAFE_BOX.width * 0.42)}
          y={B.hero.y - 200}
          width={Math.round(SAFE_BOX.width * 0.56)}
          height={Math.round(SAFE_BOX.width * 0.36)}
          opacity={head.opacity}
        >
          <Cutout src={payload.images[0]} width={200} height={110} x={0} y={0} outline={0} seed={seed} />
        </ThoughtBubble>
      )}
      {payload.headline && (
        <Headline
          text={payload.headline}
          size={TYPE.headline}
          // Üst banda sığmayan başlık cutout kartının altında kalıyordu.
          fit={{width: SAFE_BOX.width, height: B.hero.y - B.top.y - 24}}
          align="center"
          reveal={hl.progress}
          style={{
            position: 'absolute',
            left: SAFE.left,
            top: B.top.y,
            width: SAFE_BOX.width,
            opacity: title.opacity,
          }}
          seed={seed}
        />
      )}
      {payload.caption && (
        <div
          style={{
            position: 'absolute',
            left: SAFE.left,
            top: B.bottom.y + 60,
            width: SAFE_BOX.width,
            textAlign: 'center',
            fontFamily: FONTS.display,
            fontWeight: 700,
            fontSize: TYPE.caption,
            lineHeight: 1.2,
            textTransform: 'uppercase',
            color: PALETTE.ink,
            opacity: hl.opacity,
          }}
        >
          {payload.caption}
        </div>
      )}
      <SparkleField count={3} seed={seed + 11} progress={hl.progress} />
    </PaperBase>
  );
};

/* ------------------------------------------------------------------ */
/* 12. STAR FIELD — gece zemin, eş merkezli halkalar, portre           */
/* ------------------------------------------------------------------ */
const StarField: React.FC<SceneProps> = ({seconds, payload, seed}) => {
  const f = useCurrentFrame();
  // Başlık ilk girer — bkz. hero_cutout'taki gerekçe.
  const title = enter(f, {at: 0.1, duration: 0.35, kind: 'fade'});
  const rings = enter(f, {at: cue(seconds, 0, 3), duration: Math.max(0.9, seconds * 0.4), kind: 'draw'});
  const port = enter(f, {at: cue(seconds, 1, 3), duration: 0.55, kind: 'fade'});
  const lab = enter(f, {at: cue(seconds, 2, 3), duration: 0.35, kind: 'stamp'});

  const cx = CANVAS.width / 2;
  const cy = B.hero.y + Math.round(B.hero.height * 0.42);
  const pw = Math.round(SAFE_BOX.width * 0.52);

  return (
    <PaperBase seed={seed} ground="night" stains={false}>
      <svg width={CANVAS.width} height={CANVAS.height} style={{position: 'absolute', left: 0, top: 0}}>
        {[0.42, 0.62, 0.84, 1.06].map((k, i) => {
          const r = pw * k;
          const c = 2 * Math.PI * r;
          const p = Math.max(0, Math.min(1, (rings.progress - i * 0.14) / 0.6));
          return (
            <circle
              key={i}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={PALETTE.accent}
              strokeWidth={3}
              opacity={0.5}
              strokeDasharray={c}
              strokeDashoffset={c * (1 - p)}
            />
          );
        })}
      </svg>
      {/* Yıldızlar: deterministik dağılım, sırayla parlar. */}
      {Array.from({length: 14}, (_, i) => {
        const r1 = rand(seed * 3 + i * 7);
        const r2 = rand(seed * 5 + i * 11);
        const r3 = rand(seed * 7 + i * 13);
        const own = Math.max(0, Math.min(1, (rings.progress - i * 0.05) / 0.25));
        return (
          <Sparkle
            key={i}
            x={80 + r1 * (CANVAS.width - 160)}
            y={SAFE.top + r2 * (SAFE_BOX.height * 0.9)}
            size={14 + r3 * 30}
            opacity={own * (0.4 + r3 * 0.6)}
            rotate={r3 * 50}
          />
        );
      })}
      <Cutout
        shape={payload.shape ?? 'figure'}
        src={payload.images?.[0]}
        x={cx - pw / 2}
        y={cy - Math.round(pw * 0.62)}
        width={pw}
        height={Math.round(pw * 1.24)}
        seed={seed}
        opacity={port.opacity}
        // Gece zemininde portre havada: uzanan gölge YOK, odak çekme var.
        focus={focusHunt(f, {at: cue(seconds, 1, 3) + 0.1, duration: 0.7, from: 12})}
        jitter={holdJitter(f, seed + 13)}
        transform={drift(f, {seconds, scale: 0.07, dy: -24})}
        outlineColor={PALETTE.paper}
      />
      {payload.headline && (
        <Headline
          text={payload.headline}
          size={TYPE.subhead}
          align="center"
          color={PALETTE.paper}
          fit={{width: SAFE_BOX.width, height: B.hero.y - B.top.y - 24}}
          style={{position: 'absolute', left: SAFE.left, top: B.top.y, width: SAFE_BOX.width, opacity: title.opacity}}
          seed={seed}
        />
      )}
      {payload.label && (
        <LabelCard
          text={payload.label}
          x={cx - 170}
          y={B.bottom.y + 60}
          opacity={lab.opacity}
          transform={lab.transform}
          accent
        />
      )}
    </PaperBase>
  );
};


/* ------------------------------------------------------------------ */
/* 15. EVIDENCE BOARD — kanıt masası                                  */
/* ------------------------------------------------------------------ */
/**
 * REFERANS KAREYE EN YAKIN ŞABLON — ve neden görsel modeliyle yapılamadığı.
 *
 * Kullanıcının kalite çıtası olarak verdiği Aylesbury karesi (8 AUG 1963)
 * öğelerine ayrıldığında karede TEK fotoğraf var (istasyon peronu) ve kabaca
 * alanın onda birini kaplıyor. Geri kalanı yazı, çizgi ve kağıt: dev tarih
 * yaprağı, posta damgası, altın etiket, gravür harita, tarife kupürü, bant,
 * raptiye, ip.
 *
 * Hattımız o karenin TAMAMINI görsel modelinden istiyordu ve iki kere
 * kaybediyordu: model takvim yerine manken çiziyor (6. tur, 5/5), ve okunur
 * harf hiç basamıyor (4 plakanın 4'ünde "YOOLNI IIILNIIRIGLLLID").
 *
 * Bu şablon o öğeleri koda alıyor. Fotoğraf yine dışarıdan gelir (`images` /
 * `layers`) ama artık karenin TAMAMI değil, referanstaki gibi bir köşesi.
 *
 * VERİ ANLATIDAN GELİR. `payload.evidence` yoksa ilgili öğe ÇİZİLMEZ —
 * uydurma tarih ya da uydurma tarife satırı yazmak, uydurma nesne çizmekle
 * aynı sınıf yalan olurdu.
 */
const EvidenceBoard: React.FC<SceneProps> = ({seconds, payload, seed}) => {
  const f = useCurrentFrame();
  const ev = payload.evidence ?? {};

  // Sıra referanstaki okuma sırası: önce harita (bağlam), sonra tarih (olay),
  // sonra fotoğraf, damga, etiket, kayıt. Build-on: boş kağıttan tek tek.
  const title = enter(f, {at: 0.1, duration: 0.35, kind: 'fade'});
  const map = enter(f, {at: cue(seconds, 0, 6, HOLD_FROM), duration: 0.5, kind: 'fade'});
  const date = enter(f, {at: cue(seconds, 1, 6, HOLD_FROM), duration: 0.45, kind: 'drop', from: {y: -140}});
  const photo = enter(f, {at: cue(seconds, 2, 6, HOLD_FROM), duration: 0.45, kind: 'slide', from: {x: -160}});
  const mark = enter(f, {at: cue(seconds, 3, 6, HOLD_FROM), duration: 0.3, kind: 'stamp'});
  const tag = enter(f, {at: cue(seconds, 4, 6, HOLD_FROM), duration: 0.3, kind: 'drop', from: {y: -70}});
  const rec = enter(f, {at: cue(seconds, 5, 6, HOLD_FROM), duration: 0.4, kind: 'fade'});
  // İp çizilerek girer; son olay o, çünkü bağlantı kurmak son adımdır.
  const string = enter(f, {at: cue(seconds, 4, 6, HOLD_FROM), duration: Math.max(0.7, seconds * 0.25), kind: 'draw'});

  /**
   * YERLEŞİM REFERANSTAN ÖLÇÜLDÜ, göz kararı değil.
   *
   * Aylesbury karesinde kutuların kanvasa oranı (943x1650 üstünden okundu):
   *   harita   x 0.53-0.95   y 0.16-0.73     — sağ üstten sağ ortaya
   *   tarih    x 0.24-0.72   y 0.28-0.66     — solda, haritanın üstüne biner
   *   fotoğraf x 0.03-0.48   y 0.48-0.71     — sol alt
   *   kupür    x 0.24-0.58   y 0.69-0.87     — alt orta
   *   etiket   x 0.71-0.96   y 0.22-0.25     — sağ üst
   *
   * İlk sürümüm bunları SAFE_BOX'ın üst yarısına sıkıştırmıştı ve render'da
   * karenin alt %40'ı bomboş kaldı. Oranlar artık doğrudan kanvasa uygulanıyor;
   * güvenli alan yalnızca başlık ve altyazı bandını koruyor.
   */
  const W = CANVAS.width;
  const H = CANVAS.height;

  const mapX = Math.round(W * 0.50);
  const mapY = Math.round(H * 0.22);
  const mapW = Math.round(W * 0.47);
  const mapH = Math.round(H * 0.44);

  const dateW = Math.round(W * 0.44);
  const dateH = Math.round(H * 0.30);
  const dateX = Math.round(W * 0.20);
  const dateY = Math.round(H * 0.30);

  // Alt bant ölçüldü: ilk sürümde karenin son %25'i boştu. Fotoğraf ve kupür
  // büyütülüp aşağı alındı; altyazı bandı (SAFE.bottom) yine korunuyor.
  const photoW = Math.round(W * 0.46);
  const photoH = Math.round(photoW * 0.88);
  const photoX = Math.round(W * 0.04);
  const photoY = Math.round(H * 0.58);

  const src = payload.layers?.pieces?.[0]?.src ?? payload.images?.[0];

  return (
    <PaperBase seed={seed} ground="warm" aged>
      {/*
        BAŞLIK KENDİ BANDINDA. `Headline` konumlandırmıyor — saran kutu
        konumlandırır. İlk sürümde `PaperBase` içine çıplak konmuştu ve
        0,0'a oturup karenin üstünden taşıyordu ("ON THE" kesiliyordu).
      */}
      <div
        style={{
          position: 'absolute',
          left: SAFE.left,
          top: SAFE.top,
          width: SAFE_BOX.width,
          opacity: title.opacity,
        }}
      >
        <Headline
          text={payload.headline ?? ''}
          size={TYPE.subhead}
          fit={{width: SAFE_BOX.width, height: Math.round(H * 0.11)}}
        />
      </div>

      {/* HARİTA — gravür ilçe haritası. Sahnenin en büyük nesnesi, o yüzden
          sürüklenen katman bu (kural: her sahnede BÜYÜK bir katman oynar). */}
      <div
        style={{
          position: 'absolute',
          left: mapX,
          top: mapY,
          width: mapW,
          height: mapH,
          opacity: map.opacity * 0.92,
          transform: drift(f, {seconds, dx: -22, dy: 14, scale: 0.05}),
          transformOrigin: '40% 60%',
          filter: LIFT(0.9),
        }}
      >
        <svg width={mapW} height={mapH} style={{display: 'block'}}>
          {/* Yırtık kenarlı kağıt: gravür harita bir SAYFADAN koparılmış. */}
          <defs>
            <clipPath id={`ev-map-${seed}`}>
              <polygon
                points={Array.from({length: 26}, (_, i) => {
                  const t = i / 25;
                  const edge = 0.04 * rand(seed * 7 + i);
                  return t <= 0.5
                    ? `${(t * 2 * mapW).toFixed(1)},${(edge * mapH).toFixed(1)}`
                    : `${((2 - t * 2) * mapW).toFixed(1)},${((1 - edge) * mapH).toFixed(1)}`;
                }).join(' ')}
              />
            </clipPath>
          </defs>
          <g clipPath={`url(#ev-map-${seed})`}>
            <rect width={mapW} height={mapH} fill={PAPER_TONES.map} />
            {/* GRAVÜR TARAMA — harita ortası boş kalıyordu.
                Referansta harita yoğun: kontur, tarama, ikincil isimler.
                Yatay ince tarama arazi hissini tek başına kuruyor. */}
            {Array.from({length: 46}, (_, i) => (
              <line
                key={`h${i}`}
                x1={0}
                y1={(i * mapH) / 45}
                x2={mapW}
                y2={(i * mapH) / 45}
                stroke="rgba(60,54,40,0.055)"
                strokeWidth={1}
              />
            ))}
            {/*
              KONTUR EĞRİLERİ — düzgün elips DEĞİL.
              İlk sürüm `<ellipse>` kullanıyordu ve render'da mekanik, iç içe
              daireler gibi çıktı; yükselti eğrisi öyle görünmez. Her halka
              artık 14 noktadan geçen kapalı bir eğri ve her nokta yarıçapı
              deterministik olarak sapıyor.
            */}
            {Array.from({length: 4}, (_, i) => {
              const cx = mapW * (0.30 + rand(seed * 3 + i) * 0.5);
              const cy = mapH * (0.18 + rand(seed * 9 + i) * 0.62);
              return Array.from({length: 3}, (_, k) => {
                const rx = mapW * (0.05 + k * 0.032);
                const ry = mapH * (0.028 + k * 0.02);
                const n = 14;
                const d = Array.from({length: n + 1}, (_, j) => {
                  const a = ((j % n) / n) * Math.PI * 2;
                  const w = 0.78 + rand(seed * 7 + i * 13 + (j % n)) * 0.44;
                  return `${(cx + Math.cos(a) * rx * w).toFixed(1)},${(cy + Math.sin(a) * ry * w).toFixed(1)}`;
                }).join(' L ');
                return (
                  <path
                    key={`c${i}-${k}`}
                    d={`M ${d} Z`}
                    fill="none"
                    stroke="rgba(60,54,40,0.15)"
                    strokeWidth={1}
                  />
                );
              });
            })}
            {/*
              GRAVÜR YOL AĞI — rastgele eğri DEĞİL.

              İlk sürüm 22 rastgele Bézier çiziyordu ve render'da sonuç
              karalama gibi çıktı, harita gibi değil. Gerçek bir ilçe
              haritasının okunma sebebi düzensizliği değil YAPISI: yollar
              kasabalardan RADYAL çıkar, kasabalar birbirine bağlanır.

              Burada önce kasaba düğümleri konuluyor (rota durakları varsa
              onların yerinde), sonra her düğümden komşularına birer yol
              çekiliyor ve kenarlardan çıkan kısa kollar ekleniyor.
            */}
            {(() => {
              const towns = (payload.route?.length ? payload.route : [
                {x: 0.28, y: 0.66},
                {x: 0.62, y: 0.30},
                {x: 0.46, y: 0.52},
              ]).map((t) => ({x: t.x * mapW, y: t.y * mapH}));
              const roads: React.ReactNode[] = [];
              for (let i = 0; i < towns.length; i += 1) {
                for (let k = i + 1; k < towns.length; k += 1) {
                  const a = towns[i];
                  const b = towns[k];
                  // Hafif kavis: gerçek yollar düz gitmez.
                  const bend = (rand(seed * 5 + i * 7 + k) - 0.5) * 0.22;
                  const mx = (a.x + b.x) / 2 + (b.y - a.y) * bend;
                  const my = (a.y + b.y) / 2 - (b.x - a.x) * bend;
                  roads.push(
                    <path
                      key={`r${i}-${k}`}
                      d={`M ${a.x.toFixed(1)},${a.y.toFixed(1)} Q ${mx.toFixed(1)},${my.toFixed(1)} ${b.x.toFixed(1)},${b.y.toFixed(1)}`}
                      fill="none"
                      stroke="rgba(40,44,54,0.42)"
                      strokeWidth={2.1}
                    />,
                  );
                }
              }
              // Kasabadan dışarı giden kollar: haritayı kenara kadar doldurur.
              towns.forEach((t, i) => {
                for (let k = 0; k < 4; k += 1) {
                  const ang = (rand(seed * 13 + i * 11 + k) * 2 - 0.4) * Math.PI;
                  const len = mapW * (0.18 + rand(seed * 23 + i + k) * 0.3);
                  roads.push(
                    <line
                      key={`s${i}-${k}`}
                      x1={t.x}
                      y1={t.y}
                      x2={t.x + Math.cos(ang) * len}
                      y2={t.y + Math.sin(ang) * len}
                      stroke="rgba(40,44,54,0.24)"
                      strokeWidth={1.2}
                    />,
                  );
                }
              });
              // Kasaba noktaları
              towns.forEach((t, i) =>
                roads.push(
                  <circle key={`t${i}`} cx={t.x} cy={t.y} r={4.5} fill="rgba(30,34,44,0.72)" />,
                ),
              );
              return roads;
            })()}
          </g>
        </svg>
        {/* Yer adları — rota duraklarından. Uydurma yer adı yazılmaz. */}
        {/*
          Etiketler haritanın SOL şeridine düşerse tarih kartının altında kalır
          ve kesilir — render'da "PORTLAND" yerine "ND" göründü. Kart haritanın
          soldan yaklaşık %38'ini örtüyor; etiket o şeride düşerse sağa itilir.
          Yolun kendisi yerinde kalır, taşınan yalnızca YAZI.
        */}
        {(payload.route ?? []).map((s, i) =>
          s.label ? (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: Math.max(s.x, 0.34) * mapW,
                top: s.y * mapH,
                /**
                 * Etiket ORTALANDIĞI için genişliğinin yarısı kadar sola
                 * taşıyor: 0.42'ye itilen "PORTLAND" yine kartın altında
                 * kaldı ve "RTLAND" göründü. Sol bölgedeki etiket artık
                 * ortalanmıyor, SOLA yaslanıyor — böylece taşma yok.
                 */
                transform: s.x < 0.42 ? 'translate(0,-50%)' : 'translate(-50%,-50%)',
                fontFamily: FONTS.display,
                fontSize: TYPE.stamp * 0.8,
                letterSpacing: '0.06em',
                color: 'rgba(24,32,44,0.9)',
                whiteSpace: 'nowrap',
              }}
            >
              {s.label}
            </div>
          ) : null,
        )}
      </div>

      {/* FOTOĞRAF — referanstaki gibi karenin bir köşesi, tamamı değil. */}
      {src && (
        <div
          style={{
            position: 'absolute',
            left: photoX,
            top: photoY,
            width: photoW,
            height: photoH,
            opacity: photo.opacity,
            transform: `${photo.transform ?? ''} rotate(-2deg)`,
            background: PALETTE.paper,
            padding: 14,
            filter: 'drop-shadow(0 12px 16px rgba(24,18,8,0.26))',
          }}
        >
          <Img
            src={staticFile(src)}
            style={{width: '100%', height: '100%', objectFit: 'cover', ...HALFTONE_CSS}}
          />
        </div>
      )}

      {/* DEV TARİH YAPRAĞI — kompozisyonun omurgası. */}
      {ev.date && (
        <DateTear
          day={ev.date.day}
          month={ev.date.month}
          year={ev.date.year}
          x={dateX}
          y={dateY}
          width={dateW}
          height={dateH}
          opacity={date.opacity}
          transform={date.transform}
          seed={seed}
        />
      )}

      {ev.postmark && (
        <PostmarkRing
          place={ev.postmark.place}
          lines={ev.postmark.lines}
          x={dateX + Math.round(dateW * 0.72)}
          y={dateY - Math.round(H * 0.045)}
          size={Math.round(W * 0.17)}
          opacity={mark.opacity}
          transform={mark.transform}
        />
      )}

      {payload.label && (
        <LabelCard
          text={payload.label}
          x={Math.round(W * 0.66)}
          y={Math.round(H * 0.175)}
          opacity={tag.opacity}
          transform={tag.transform}
        />
      )}

      {ev.record && ev.record.rows.length > 0 && (
        <RecordClip
          heading={ev.record.heading}
          subheading={ev.record.subheading}
          rows={ev.record.rows}
          x={Math.round(W * 0.46)}
          y={Math.round(H * 0.695)}
          width={Math.round(W * 0.40)}
          opacity={rec.opacity}
          seed={seed}
        />
      )}

      {/*
        KIRMIZI İP — karenin TEK sinyal aksanı.
        Referansta ip tarih yaprağını haritadaki iğneye bağlıyor ve karedeki
        tek sıcak renk o. Bizim karede hiç yoktu; altın raptiye tek başına
        aksan yükünü taşıyamıyordu.
        İp bir ŞEYİ bir ŞEYE bağlar: tarihi olayın geçtiği yere.
      */}
      <RedString
        from={{x: dateX + Math.round(dateW * 0.5), y: dateY + dateH - 12}}
        to={{x: mapX + Math.round(mapW * 0.34), y: mapY + Math.round(mapH * 0.62)}}
        progress={string.progress ?? 1}
        sag={0.16}
        width={6}
        // İki uçta da iğne: ilk sürümde ipin takvim ucu boşlukta bitiyordu.
        // İp bir yere ÇAKILI olmadan asılamaz.
        pins
      />

      {/* Bant ve raptiye: kağıdı masaya tutturan şey. */}
      <Tape x={dateX - 24} y={dateY - 26} width={210} rotate={-18} opacity={date.opacity} />
      <BrassPin cx={mapX + Math.round(mapW * 0.34)} cy={mapY + Math.round(mapH * 0.62)} opacity={mark.opacity} />

      {payload.caption && (
        <TypewriterStrip
          text={payload.caption}
          x={SAFE.left}
          y={CANVAS.height - SAFE.bottom - 20}
          opacity={rec.opacity}
        />
      )}

      {/*
        YAŞAYAN POSTER FAZI — evrensel hareket promtunun 7-10. saniyesi.

        "everything holds position. Only subtle life remains: paper corners
        lift a millimeter in a draft ... shadows breathe."

        Bu faz sahnede HİÇ YOKTU: kurulum bitince kare tamamen donuyordu.
        `curlAmount` zaten tutuş fazında (%70) başlıyor ve `drift` de artık
        aynı oranda kilitleniyor — ikisinin AYNI eşiği kullanması şart, yoksa
        köşe kalkarken katman hâlâ kayıyor olur.

        İki köşe, ters fazda: hava akımı gelir gider, ikisi aynı anda kalkmaz.
      */}
      {ev.date && (
        <CornerCurl
          x={dateX}
          y={dateY}
          width={dateW}
          height={dateH}
          corner="br"
          amount={curlAmount(f, seconds, CANVAS.fps)}
          size={58}
        />
      )}
      <CornerCurl
        x={mapX}
        y={mapY}
        width={mapW}
        height={mapH}
        corner="tr"
        amount={curlAmount(f, seconds, CANVAS.fps, undefined, 0.5)}
        size={64}
      />
    </PaperBase>
  );
};

/* ------------------------------------------------------------------ */
/* KAYIT                                                              */
/* ------------------------------------------------------------------ */
export const SCENES: Record<SceneTemplate, React.FC<SceneProps>> = {
  hero_cutout: HeroCutout,
  wide_establish: WideEstablish,
  headline_card: HeadlineCard,
  pull_quote: PullQuoteScene,
  split_compare: SplitCompare,
  labeled_diagram: LabeledDiagram,
  archival_timeline: ArchivalTimeline,
  map_route: MapRoute,
  grid_scale: GridScale,
  data_annotate: DataAnnotate,
  stick_beat: StickBeat,
  star_field: StarField,
  archive_clip: ArchiveClip,
  collage_build: CollageBuild,
  evidence_board: EvidenceBoard,
};

export const SCENE_NAMES = Object.keys(SCENES) as SceneTemplate[];
