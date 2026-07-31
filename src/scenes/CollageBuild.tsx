import React from 'react';
import {useCurrentFrame, Img, staticFile} from 'remotion';
import {CANVAS, PALETTE, SAFE, SAFE_BOX, TYPE, VERTICAL_BANDS} from '../design/tokens';
import {enter, drift, rand} from '../motion/stepped';
import {cue, focusHunt, holdJitter} from '../film/choreography';
import {PaperBase} from '../paper/PaperBase';
import {Cutout} from '../paper/Cutout';
import {Headline, LabelCard, TypewriterStrip} from '../paper/Type';
import type {SceneProps} from './types';

const B = VERTICAL_BANDS;

/**
 * PARÇA BAZLI KOLAJ — B YOLU
 *
 * NEDEN BU ŞABLON VAR
 *
 * Sahneye tek bitmiş kolaj karesi verilirse Remotion onu AYIRAMAZ: öğeler
 * piksele gömülüdür. Yapılabilecek tek şey kareyi bütün olarak kaydırmak, ki o
 * da "düz animasyon" demek — kullanıcının şikâyeti tam olarak buydu.
 *
 * Parçalar ayrı gelirse bu deponun hareket motoru devreye giriyor ve
 * kullanıcının hareket promtunun 0-7 saniyede tarif ettiği "build-on assembly"
 * KODDA oluyor: sahne boş plakayla açılır, öğeler arkadan öne anlatı sırasıyla
 * girer, her biri kendi gölgesini bırakır, yerleşen bir daha oynamaz.
 *
 * Flow'dan istenip ÖLÇÜMLE alınamayan üç şey burada bedava:
 *   · kamera GERÇEKTEN kilitli (kod kaydırmıyorsa kaymaz)
 *   · tarih ve sayı DEĞİŞMEZ (metni Remotion çiziyor, model değil)
 *   · çıktı deterministik (aynı girdi → aynı kare)
 *
 * KATMAN SIRASI, arkadan öne:
 *   1. plaka        — opak zemin görseli; yoksa PaperBase
 *   2. destekler    — küçük parçalar, köşelerde
 *   3. hero         — büyük parça, hero bandında
 *   4. metin        — başlık İLK girer ve sahne boyunca kalır
 * Film katmanı (gren, vinyet, titreme) Short.tsx'te hepsinin üstünde.
 */

/**
 * PARÇA YERLEŞİM YUVALARI.
 *
 * Konumu KOD belirler, prompt değil. Sebep: güvenli alanı (üst 150, alt 330,
 * yan 70/150 px) yalnızca kod biliyor ve modelden "şuraya koy" istemek bu
 * projede zaten denendi — Flow yerleşimi tutmuyor.
 *
 * `x` ve `y` GÜVENLİ KUTUYA göre 0..1, hero bandına göre değil.
 *
 * İlk sürümde `y` hero bandına göreydi (-0.10 … 0.70) ve kanıt karesinde sonucu
 * görüldü: üç parçanın üçü de karenin orta şeridinde toplandı, ALT %35 tamamen
 * boş krem kağıt kaldı. Bu, kullanıcının "detay bişey yok" dediği boşluğun ta
 * kendisi — üstelik kolajın kendi mantığına da aykırı: gerçek bir masa
 * kolajında parçalar kareye YAYILIR, tek bir banda dizilmez.
 *
 * Alt banda düşen yuvalar metnin altına girmiyor: `bottomTaken` ile o yuvalar
 * eleniyor (aşağıda), yani caption/label varsa parça oraya konmuyor.
 *
 * `occurrence` ile döndürülüyor ki aynı şablon ikinci kez kullanıldığında aynı
 * kare çıkmasın. Rotasyon saf `occurrence % N`: bu depoda seed hash'i ve parite
 * hileleri üç kez çakıştı.
 */
type Slot = {x: number; y: number; w: number; rot: number; low?: boolean};

const SUPPORT_SLOTS: Slot[][] = [
  [
    {x: 0.00, y: 0.14, w: 0.34, rot: -4.5},
    {x: 0.58, y: 0.72, w: 0.40, rot: 3.2, low: true},
    {x: 0.68, y: 0.20, w: 0.28, rot: -2.0},
  ],
  [
    {x: 0.62, y: 0.16, w: 0.34, rot: 4.0},
    {x: 0.02, y: 0.70, w: 0.42, rot: -3.0, low: true},
    {x: 0.10, y: 0.24, w: 0.26, rot: 2.4},
  ],
  [
    {x: 0.54, y: 0.74, w: 0.38, rot: -3.6, low: true},
    {x: 0.01, y: 0.18, w: 0.32, rot: 2.8},
    {x: 0.64, y: 0.26, w: 0.30, rot: -1.6},
  ],
];

export const CollageBuild: React.FC<SceneProps> = ({seconds, payload, seed, occurrence}) => {
  const f = useCurrentFrame();
  const layers = payload.layers;
  const pieces = layers?.pieces ?? [];

  /**
   * BAŞLIK HER ŞEYDEN ÖNCE. Dört şablonda başlık ilgisiz bir öğenin girişine
   * bağlıydı ve 3 saniyelik sahnede 1.36. saniyede beliriyordu; okumaya 1.6
   * saniye kalıyordu. Kullanıcının "okunamıyor" raporunun ölçülmüş sebebi.
   */
  const title = enter(f, {at: 0.1, duration: 0.35, kind: 'fade'});

  // Plaka sahnenin ilk karesinde YOK: build-on kuralı boş zeminden başlamayı
  // istiyor, ama plaka zeminin KENDİSİ olduğu için hemen ve yumuşak girer.
  const plate = enter(f, {at: 0.05, duration: 0.4, kind: 'fade'});

  /**
   * ALT BANT METNE AİTSE ORAYA PARÇA KONMAZ.
   *
   * Bu deponun ölçülmüş hatalarından biri metin ile görselin üst üste
   * binmesiydi (üç sahnede başlık cutout kartının altında kaldı). Aynı çakışma
   * burada alt bantta olurdu: caption/label varsa `low` yuvaları eleniyor ve
   * parça üst yuvalara kayıyor. Caption yoksa alt bant boş demek, orası parçanın.
   */
  const bottomTaken = Boolean(payload.caption || payload.label);
  const all = SUPPORT_SLOTS[occurrence % SUPPORT_SLOTS.length];
  const slots = bottomTaken ? all.filter((s) => !s.low) : all;
  const heroW = Math.round(SAFE_BOX.width * 0.62);
  const heroH = Math.round(B.hero.height * 0.86);
  const heroX = SAFE.left + Math.round((SAFE_BOX.width - heroW) / 2);
  const tilt = (rand(seed * 5.1) - 0.5) * 2.6;

  // Girişler: 0 plaka, 1 hero, 2.. destekler, son etiket.
  const n = Math.max(3, pieces.length + 2);

  return (
    <PaperBase seed={seed} stains={!layers?.plate}>
      {/* 1. PLAKA — opak zemin görseli. Yoksa PaperBase'in kağıdı kalır. */}
      {layers?.plate && (
        <Img
          src={staticFile(layers.plate)}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: CANVAS.width,
            height: CANVAS.height,
            objectFit: 'cover',
            opacity: plate.opacity,
            // Plaka da ağır ağır sürüklenir: sahnenin en büyük nesnesi o ve
            // "her sahnede büyük bir katman hareket eder" kuralı buna da işler.
            transform: drift(f, {seconds, dx: 14, dy: -10, scale: 0.03}),
          }}
        />
      )}

      {/* 2. DESTEKLER — arkadan öne, hero'dan ÖNCE girerler. */}
      {pieces.slice(1).map((piece, i) => {
        const slot = slots[i % slots.length];
        // Parça kendi yerini biliyorsa o kullanılır; bilmiyorsa yuvaya düşer.
        // Gerekçe `types.ts`'te `box` alanının belgesinde.
        const placed = piece.box
          ? {
              x: Math.round(CANVAS.width * piece.box.x),
              y: Math.round(CANVAS.height * piece.box.y),
              w: Math.round(CANVAS.width * piece.box.w),
              h: Math.round(CANVAS.height * piece.box.h),
              rot: 0,
            }
          : {
              x: SAFE.left + Math.round(SAFE_BOX.width * slot.x),
              y: SAFE.top + Math.round(SAFE_BOX.height * slot.y),
              w: Math.round(SAFE_BOX.width * slot.w),
              h: Math.round(SAFE_BOX.width * slot.w * 0.82),
              rot: slot.rot,
            };
        const e = enter(f, {
          at: cue(seconds, 2 + i, n),
          duration: 0.4,
          kind: i % 2 === 0 ? 'drop' : 'slide',
          from: i % 2 === 0 ? {y: -120} : {x: -140},
        });
        return (
          <Cutout
            key={piece.src}
            src={staticFile(piece.src)}
            x={placed.x}
            y={placed.y}
            width={placed.w}
            height={placed.h}
            rotate={placed.rot}
            seed={seed + i * 3}
            opacity={e.opacity}
            transform={e.transform}
            jitter={holdJitter(f, seed + i)}
            // Yerleşimi kareden gelen parçanın konturu İNCE: kalın kontur
            // orijinaldeki kesim kenarının üstüne ikinci bir kenar bindirir.
            outline={piece.box ? 0 : 7}
            // Halftone KAPALI: parça zaten halftone olarak üretildi. İkinci kez
            // uygulamak nokta üstüne nokta bindirir ve gri bir bulanıklık yapar.
            halftone={false}
          />
        );
      })}

      {/* 3. HERO — en son ve en büyük giren parça. */}
      {pieces[0] && (
        <Cutout
          src={staticFile(pieces[0].src)}
          x={pieces[0].box ? Math.round(CANVAS.width * pieces[0].box.x) : heroX}
          y={pieces[0].box ? Math.round(CANVAS.height * pieces[0].box.y) : B.hero.y}
          width={pieces[0].box ? Math.round(CANVAS.width * pieces[0].box.w) : heroW}
          height={pieces[0].box ? Math.round(CANVAS.height * pieces[0].box.h) : heroH}
          rotate={pieces[0].box ? 0 : tilt}
          seed={seed}
          opacity={enter(f, {at: cue(seconds, 1, n), duration: 0.55, kind: 'slide', from: {x: -170}}).opacity}
          transform={`${enter(f, {at: cue(seconds, 1, n), duration: 0.55, kind: 'slide', from: {x: -170}}).transform} ${drift(f, {seconds, dx: 26, dy: -18, scale: 0.05})}`}
          focus={focusHunt(f, {at: cue(seconds, 1, n) + 0.1, duration: 0.7, from: 11})}
          jitter={holdJitter(f, seed)}
          halftone={false}
          outline={pieces[0].box ? 0 : 9}
        />
      )}

      {/* 4. METİN — kod çiziyor, model değil: tarih ve sayı bozulmaz. */}
      {payload.headline && (
        <Headline
          text={payload.headline}
          size={TYPE.subhead}
          fit={{width: SAFE_BOX.width, height: B.hero.y - B.top.y - 24}}
          color={layers?.plate ? PALETTE.ink : PALETTE.ink}
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
      {payload.label && (
        <LabelCard
          text={payload.label}
          x={SAFE.left + 20}
          y={B.bottom.y + 30}
          rotate={-1.4}
          opacity={enter(f, {at: cue(seconds, n - 1, n), duration: 0.3, kind: 'stamp'}).opacity}
          transform={enter(f, {at: cue(seconds, n - 1, n), duration: 0.3, kind: 'stamp'}).transform}
        />
      )}
      {payload.caption && (
        <TypewriterStrip
          text={payload.caption.replace(/\*/g, '')}
          x={SAFE.left}
          y={B.bottom.y + 130}
          width={SAFE_BOX.width - 40}
          opacity={enter(f, {at: cue(seconds, n - 1, n), duration: 0.35, kind: 'fade'}).opacity}
        />
      )}
    </PaperBase>
  );
};
