import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import type {SceneProps} from '../../../engine/sceneTypes/types';
import {BODY_ARTERIES, BODY_VEINS, BRONCHI, Figure, LUNG_FISSURES, LUNG_LEFT, LUNG_RIGHT, Skeleton} from './Body';
import {
  BLUE,
  BLUE_DARK,
  ENDO,
  LA_CAVITY,
  LV_CAVITY,
  MYO,
  MYO_DARK,
  MYO_LIGHT,
  OUTLINE,
  RA_CAVITY,
  RED,
  RED_DARK,
  AORTIC_ROOT,
  AV_RING_L,
  CORONARIES,
  LEFT_AURICLE,
  MODERATOR_BAND,
  RIGHT_AURICLE,
  AV_RING_R,
  LEFT_LUMEN,
  PULM_ROOT,
  RIGHT_LUMEN,
  RV_CAVITY,
  SEPTUM,
  TRABECULAE_LV,
  TRABECULAE_RV,
  chordae,
  leaflet,
  papillary,
  semilunar,
} from './HeartAnatomy';

const W = 1080;
const H = 1920;
type Pt = [number, number];

/**
 * GÖVDE KALP UZAYINA NASIL OTURUR.
 *
 * Kalp kendi 1080x1920 alanında çizilmiştir. Gövde de kendi alanında. İkisi
 * TEK bir ölçekle bağlanır, çünkü giriş bir kesme değil bir yaklaşmadır: aynı
 * kalp, önce göğüs kafesinin arkasında küçücük, sonra kareyi dolduruyor. Ayrı
 * çizimler olsaydı kamera içeri girerken kalp yerinden sıçrardı.
 */
const BODY_SCALE = 3.78;
const BODY_TX = 571 - 575 * BODY_SCALE;
const BODY_TY = 918 - 700 * BODY_SCALE;
const BODY_TRANSFORM = `translate(${BODY_TX} ${BODY_TY}) scale(${BODY_SCALE})`;
/** Bütün gövdenin kadraja sığdığı yakınlık. */
export const WHOLE_BODY_ZOOM = 1 / BODY_SCALE;

/** Kübik Bezier — nokta damarın İÇİNDE yürüsün diye, DOM ölçümü olmadan. */
function bezier(p: Pt[], t: number): Pt {
  const [a, b, c, d] = p;
  const u = 1 - t;
  return [
    u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * d[0],
    u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * d[1],
  ];
}
/** Çok parçalı yol: uçtan uca tek bir t ile yürünür. */
function along(segments: Pt[][], t: number): Pt {
  const n = segments.length;
  const i = Math.min(n - 1, Math.floor(t * n));
  return bezier(segments[i], t * n - i);
}
const d = (p: Pt[]) => `M ${p[0][0]} ${p[0][1]} C ${p[1][0]} ${p[1][1]}, ${p[2][0]} ${p[2][1]}, ${p[3][0]} ${p[3][1]}`;

/**
 * KANIN YOLU, ANATOMİNİN İÇİNDEN.
 *
 * Her yol gerçekten geçtiği boşluklardan geçer: vena kava → sağ kulakçık →
 * triküspit → sağ karıncık → pulmoner kapak → akciğer. Soyut bir boru değil,
 * çizilen odanın içi.
 */
const ROUTES: Record<string, Pt[][]> = {
  venaCava: [
    [[224, 250], [228, 380], [244, 470], [268, 560]],
    [[268, 560], [286, 640], [300, 700], [312, 780]],
  ],
  ivc: [
    [[172, 1520], [186, 1260], [214, 1030], [252, 900]],
    [[252, 900], [272, 862], [292, 830], [312, 800]],
  ],
  toRV: [
    [[312, 800], [330, 856], [352, 892], [372, 926]],
    [[372, 926], [378, 1010], [372, 1130], [396, 1250]],
  ],
  toLung: [
    [[396, 1250], [400, 1120], [420, 1010], [470, 930]],
    [[470, 930], [492, 880], [492, 850], [490, 820]],
    [[490, 820], [462, 640], [400, 440], [246, 320]],
  ],
  fromLung: [
    [[960, 620], [900, 640], [870, 680], [852, 730]],
    [[852, 730], [820, 800], [770, 850], [716, 878]],
    [[716, 878], [700, 900], [692, 920], [688, 940]],
  ],
  toLV: [
    [[688, 940], [696, 1000], [700, 1100], [690, 1210]],
    [[690, 1210], [676, 1290], [660, 1330], [648, 1352]],
  ],
  toBody: [
    [[648, 1352], [664, 1200], [660, 1050], [640, 940]],
    [[640, 940], [630, 890], [628, 860], [630, 826]],
    [[630, 826], [660, 620], [740, 440], [846, 452]],
    [[846, 452], [896, 560], [900, 1000], [890, 1560]],
  ],
};

/** LUB-DUB. Sinüs verirsen kalp atmaz, nefes alır. */
function beat(frame: number, fps: number, bpm: number) {
  const period = (60 / bpm) * fps;
  const t = (frame % period) / period;
  const pulse = (start: number, len: number) => {
    if (t < start || t > start + len) return 0;
    return Math.sin(((t - start) / len) * Math.PI);
  };
  return {atria: pulse(0.0, 0.15), ventricles: pulse(0.17, 0.28), t};
}

const Flow: React.FC<{route: Pt[][]; colour: string; frame: number; lit: number; count?: number; speed?: number; r?: number}> = ({
  route,
  colour,
  frame,
  lit,
  count = 9,
  speed = 0.009,
  r = 13,
}) => {
  if (lit <= 0) return null;
  return (
    <g opacity={lit}>
      {Array.from({length: count}).map((_, i) => {
        const t = (((frame * speed + i / count) % 1) + 1) % 1;
        const [x, y] = along(route, t);
        return <circle key={i} cx={x} cy={y} r={r} fill={colour} opacity={0.95} />;
      })}
    </g>
  );
};

const numOf = (scene: SceneProps['scene'], key: string, fallback: number) => {
  const v = Number((scene.params as Record<string, unknown> | undefined)?.[key]);
  return Number.isFinite(v) ? v : fallback;
};
const strOf = (scene: SceneProps['scene'], key: string, fallback = '') => {
  const v = (scene.params as Record<string, unknown> | undefined)?.[key];
  return typeof v === 'string' ? v : fallback;
};
const listOf = (scene: SceneProps['scene'], key: string): string[] => {
  const v = (scene.params as Record<string, unknown> | undefined)?.[key];
  return Array.isArray(v) ? (v as string[]) : [];
};

const Heart: React.FC<SceneProps> = ({scene, durationInFrames}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const bpm = numOf(scene, 'bpm', 66);
  const {atria, ventricles} = beat(frame, fps, bpm);

  const on = listOf(scene, 'lit');
  const lit = (k: string) => (on.length === 0 || on.includes(k) ? 1 : 0.2);
  const flows = listOf(scene, 'flow');
  const flowing = (k: string) => (flows.includes(k) ? 1 : 0);

  /**
   * KAMERA SAHNENİN İÇİNDE HAREKET EDER. `zoomTo` verilirse çekim boyunca
   * yaklaşır — girişin bütün numarası bu: insandan göğüs kafesine, oradan
   * kalbe tek bir kesintisiz iniş. Kesmeyle yapılırsa üç ayrı resim olur.
   */
  const ease = (u: number) => u * u * (3 - 2 * u);
  const progress = ease(Math.min(1, frame / Math.max(1, durationInFrames - 1)));
  const lerp = (a: number, b: number) => a + (b - a) * progress;
  const zoom = lerp(numOf(scene, 'zoom', 1), numOf(scene, 'zoomTo', numOf(scene, 'zoom', 1)));
  const panX = lerp(numOf(scene, 'panX', 0), numOf(scene, 'panXTo', numOf(scene, 'panX', 0)));
  const panY = lerp(numOf(scene, 'panY', 0), numOf(scene, 'panYTo', numOf(scene, 'panY', 0)));

  /** Hangi katman görünür. Boş bırakılırsa yalnız kalp — eski sahneler aynen çalışır. */
  const shown = listOf(scene, 'show');
  const layer = (k: string) => {
    const v = Number((scene.params as Record<string, unknown> | undefined)?.[`${k}Opacity`]);
    if (Number.isFinite(v)) return v;
    return shown.includes(k) ? 1 : 0;
  };
  const fade = (k: string) => {
    const from = layer(k);
    const toRaw = Number((scene.params as Record<string, unknown> | undefined)?.[`${k}To`]);
    return Number.isFinite(toRaw) ? from + (toRaw - from) * progress : from;
  };
  const title = strOf(scene, 'title');
  const note = strOf(scene, 'note');
  const big = strOf(scene, 'big');
  const arrive = Math.min(1, frame / 4);

  // Kasılma: karıncıklar apekse doğru küçülür, kulakçıklar tabana doğru.
  const vSq = 1 - ventricles * 0.075;
  const aSq = 1 - atria * 0.08;

  return (
    <AbsoluteFill style={{backgroundColor: '#0d0c0b'}}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{position: 'absolute', inset: 0}}>
        <defs>
          <radialGradient id="myo" cx="45%" cy="35%">
            <stop offset="0%" stopColor={MYO_LIGHT} />
            <stop offset="70%" stopColor={MYO} />
            <stop offset="100%" stopColor={MYO_DARK} />
          </radialGradient>
          <linearGradient id="blueTube" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={BLUE} />
            <stop offset="100%" stopColor={BLUE_DARK} />
          </linearGradient>
          <linearGradient id="redTube" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={RED} />
            <stop offset="100%" stopColor={RED_DARK} />
          </linearGradient>
        </defs>

        <g transform={`translate(${W / 2 + panX} ${H / 2 + panY}) scale(${zoom}) translate(${-W / 2} ${-H / 2})`}>
          {/* ── GÖVDE: deri, sonra iskelet, sonra akciğer. Kalbin ARKASINDA. ── */}
          <g transform={BODY_TRANSFORM}>
            <Figure opacity={fade('figure')} fill="#17161a" edge="#3d3a44" />
            {fade('arteries') > 0 ? (
              <g opacity={fade('arteries')}>
                {BODY_VEINS.map((route, i) => (
                  <path key={`v${i}`} d={route.map(d).join(' ')} fill="none" stroke={BLUE_DARK} strokeWidth={11} strokeLinecap="round" opacity={0.8} />
                ))}
                {BODY_ARTERIES.map((route, i) => (
                  <path key={`a${i}`} d={route.map(d).join(' ')} fill="none" stroke={RED_DARK} strokeWidth={13} strokeLinecap="round" />
                ))}
                {/* VE ÜSTÜNDE KAN YÜRÜR. Damar ağacı çizilip boş bırakılırsa
                    "bütün vücuda dağılır" cümlesi bir kroki olarak kalır. */}
                {flowing('body') > 0
                  ? BODY_ARTERIES.map((route, i) =>
                      Array.from({length: 6}).map((_, k) => {
                        const t = (((frame * 0.008 + k / 6 + i * 0.09) % 1) + 1) % 1;
                        const [x, y] = along(route, t);
                        return <circle key={`bf${i}-${k}`} cx={x} cy={y} r={13} fill={RED} />;
                      }),
                    )
                  : null}
                {flowing('bodyBack') > 0
                  ? BODY_VEINS.map((route, i) =>
                      Array.from({length: 5}).map((_, k) => {
                        const t = 1 - ((((frame * 0.007 + k / 5 + i * 0.11) % 1) + 1) % 1);
                        const [x, y] = along(route, t);
                        return <circle key={`bv${i}-${k}`} cx={x} cy={y} r={11} fill={BLUE} />;
                      }),
                    )
                  : null}
              </g>
            ) : null}
            <Skeleton opacity={fade('skeleton')} bone="#e6dccb" boneDim="#8d8474" />
          </g>

          {/* ── AKCİĞER: kalbin iki yanında, kesitte bronş ağacıyla ── */}
          {fade('lungs') > 0 ? (
            <g opacity={fade('lungs')} transform={BODY_TRANSFORM}>
              <path d={LUNG_RIGHT} fill="#2b3b46" stroke="#7f94a1" strokeWidth={4} opacity={0.92} />
              <path d={LUNG_LEFT} fill="#2b3b46" stroke="#7f94a1" strokeWidth={4} opacity={0.92} />
              {LUNG_FISSURES.map((f, i) => (
                <path key={`f${i}`} d={f} fill="none" stroke="#8fa3b0" strokeWidth={3.5} opacity={0.7} />
              ))}
              {BRONCHI.map((p, i) => (
                <path key={i} d={p} fill="none" stroke="#cfd9de" strokeWidth={i === 0 ? 12 : 7} strokeLinecap="round" opacity={0.75} />
              ))}
            </g>
          ) : null}

          {/* ── BÜYÜK DAMARLAR, kasın ARKASINDA başlayıp önünden çıkanlar ── */}
          <g opacity={lit('vessels')}>
            {/* Vena kava superior — sağ kulakçığın tavanına iner */}
            <path
              d="M 190 236 C 186 380, 210 500, 246 590 C 276 612, 306 606, 312 586 C 292 494, 270 372, 268 240 Z"
              fill="url(#blueTube)"
              stroke={BLUE_DARK}
              strokeWidth={5}
            />
            {/* Vena kava inferior — kulakçığın tabanına alttan girer */}
            <path
              d="M 148 1600 C 172 1300, 208 1050, 244 916 C 272 890, 300 900, 300 924 C 268 1050, 226 1300, 210 1600 Z"
              fill="url(#blueTube)"
              stroke={BLUE_DARK}
              strokeWidth={5}
            />
            {/* Pulmoner trunkus: SAĞ KARINCIĞIN çıkış ağzından doğar, sola kavis yapıp ikiye ayrılır */}
            <path
              d="M 452 838 C 440 700, 424 560, 380 470 C 336 380, 282 338, 222 328 L 222 262 
                 C 304 274, 376 324, 428 414 C 480 504, 504 666, 528 838 Z"
              fill="url(#blueTube)"
              stroke={BLUE_DARK}
              strokeWidth={5}
            />
            {/* Aort: SOL KARINCIĞIN çıkış ağzından doğar, kavis yapar, aşağı iner.
                Duvar kalınlığı boyunca sabit — iki kenar ayrı çizilir, tek bir
                kalın çizgi değil; damarın içi olmalı ki kan onun içinden aksın. */}
            <path
              d="M 600 834 C 604 690, 612 560, 664 468 C 720 366, 850 360, 902 452 
                 C 936 520, 950 700, 952 900 C 954 1200, 950 1450, 946 1600 
                 L 886 1600 C 890 1450, 894 1200, 892 900 C 890 700, 882 546, 856 502 
                 C 822 448, 754 452, 722 512 C 684 584, 664 700, 660 834 Z"
              fill="url(#redTube)"
              stroke={RED_DARK}
              strokeWidth={5}
            />
            {/* Arkus dalları */}
            <path d="M 700 268 C 700 340, 706 396, 716 442 L 754 424 C 744 384, 738 330, 738 268 Z" fill="url(#redTube)" stroke={RED_DARK} strokeWidth={4} />
            <path d="M 776 258 C 776 320, 778 366, 784 404 L 820 396 C 816 358, 814 314, 814 258 Z" fill="url(#redTube)" stroke={RED_DARK} strokeWidth={4} />
            <path d="M 848 268 C 850 322, 856 366, 866 404 L 900 424 C 890 382, 886 330, 886 268 Z" fill="url(#redTube)" stroke={RED_DARK} strokeWidth={4} />
            {/* Pulmoner venler — akciğerden sol kulakçığa, sağ kenardan */}
            <path d="M 964 596 C 906 600, 872 622, 858 656 L 862 700 C 890 664, 926 646, 972 642 Z" fill="url(#redTube)" stroke={RED_DARK} strokeWidth={4} />
            <path d="M 972 760 C 916 758, 878 772, 858 796 L 866 840 C 890 812, 926 800, 976 802 Z" fill="url(#redTube)" stroke={RED_DARK} strokeWidth={4} />
          </g>

          {/* ── MİYOKARD, kulakçıklarıyla ── */}
          <g transform={`translate(560 1440) scale(${vSq}) translate(-560 -1440)`}>
            <path d={RIGHT_AURICLE} fill={MYO_DARK} stroke={MYO_DARK} strokeWidth={6} opacity={0.95} />
            <path d={LEFT_AURICLE} fill={MYO_DARK} stroke={MYO_DARK} strokeWidth={6} opacity={0.95} />
            <path d={OUTLINE} fill="url(#myo)" stroke={MYO_DARK} strokeWidth={7} />
          </g>

          {/* ── SEPTUM ── */}
          <g transform={`translate(560 1440) scale(${vSq}) translate(-560 -1440)`}>
            {/* Septum bir ÇUBUK değil, kasın kendisi: aynı gradyan, aynı doku.
                Düz dolgu verilince kalbin ortasından geçen bir boru gibi
                okunuyordu — aortla karıştırılmasının sebebi buydu. */}
            <path d={SEPTUM} fill="url(#myo)" stroke={MYO_DARK} strokeWidth={6} />
            <path d={SEPTUM} fill="none" stroke={MYO_LIGHT} strokeWidth={2.5} opacity={0.5} />
          </g>

          {/* ── KORONERLER: kalbin kendi damarları, yüzeyin üstünde ── */}
          <g transform={`translate(560 1440) scale(${vSq}) translate(-560 -1440)`} opacity={lit('coronary') * 0.95}>
            {[CORONARIES.rca, CORONARIES.cx, CORONARIES.lad].map((p2, i) => (
              <path key={i} d={p2} fill="none" stroke="#7d1f1c" strokeWidth={i === 2 ? 13 : 12} strokeLinecap="round" opacity={0.75} />
            ))}
            {[CORONARIES.rca, CORONARIES.cx, CORONARIES.lad].map((p2, i) => (
              <path key={`i${i}`} d={p2} fill="none" stroke="#c4443c" strokeWidth={i === 2 ? 7 : 6} strokeLinecap="round" />
            ))}
            {CORONARIES.branches.map((p2, i) => (
              <path key={`b${i}`} d={p2} fill="none" stroke="#b03a34" strokeWidth={4} strokeLinecap="round" opacity={0.85} />
            ))}
          </g>

          {/* ── LÜMEN: her taraf TEK parça, kulakçıktan damar köküne ── */}
          <g transform={`translate(430 1440) scale(${vSq}) translate(-430 -1440)`} opacity={Math.max(lit('ra'), lit('rv'))}>
            <path d={RIGHT_LUMEN} fill="#2f5170" stroke={ENDO} strokeWidth={5} />
            {TRABECULAE_RV.map((t, i) => (
              <path key={i} d={t} fill="none" stroke={MYO_LIGHT} strokeWidth={9} strokeLinecap="round" opacity={0.6} />
            ))}
            <path d={MODERATOR_BAND} fill="none" stroke={MYO_LIGHT} strokeWidth={14} strokeLinecap="round" opacity={0.9} />
            <path d={papillary(392, 1300, 92, 150, ventricles)} fill={MYO} stroke={MYO_DARK} strokeWidth={5} />
            {chordae(392, 1150, 380, 986, 4, 60).map((c, i) => (
              <path key={i} d={c} fill="none" stroke={ENDO} strokeWidth={3.5} opacity={0.8} />
            ))}
          </g>
          <g transform={`translate(660 1440) scale(${vSq}) translate(-660 -1440)`} opacity={Math.max(lit('la'), lit('lv'))}>
            <path d={LEFT_LUMEN} fill="#7c2b27" stroke={ENDO} strokeWidth={5} />
            {TRABECULAE_LV.map((t, i) => (
              <path key={i} d={t} fill="none" stroke={MYO_LIGHT} strokeWidth={8} strokeLinecap="round" opacity={0.55} />
            ))}
            <path d={papillary(690, 1270, 84, 132, ventricles)} fill={MYO} stroke={MYO_DARK} strokeWidth={5} />
            {chordae(690, 1140, 706, 1000, 4, 52).map((c, i) => (
              <path key={i} d={c} fill="none" stroke={ENDO} strokeWidth={3.5} opacity={0.8} />
            ))}
          </g>

          {/* ── KAPAKLAR: kasılmada AV kapanır, yarım aylar açılır ── */}
          <g opacity={lit('valve')}>
            <path d={AV_RING_R} fill={MYO_DARK} stroke={ENDO} strokeWidth={4} />
            <path d={AV_RING_L} fill={MYO_DARK} stroke={ENDO} strokeWidth={4} />
          </g>
          <g opacity={lit('valve')} stroke={ENDO} strokeWidth={7} fill="none" strokeLinecap="round">
            {/* Triküspit — üç yaprakçık */}
            <path d={leaflet(300, 918, 104, 132, 1 - ventricles, 1)} />
            <path d={leaflet(430, 914, 100, 132, 1 - ventricles, -1)} />
            <path d={leaflet(364, 922, 54, 96, 1 - ventricles, 1)} opacity={0.9} />
            {/* Mitral — iki yaprakçık, halkanın iki ucundan sarkar */}
            <path d={leaflet(668, 916, 100, 142, 1 - ventricles, 1)} />
            <path d={leaflet(756, 912, 96, 142, 1 - ventricles, -1)} />
            {/* Yarım ay kapakları — çıkış ağızlarında */}
            {semilunar(PULM_ROOT.x, PULM_ROOT.y, PULM_ROOT.r, ventricles).map((p, i) => (
              <path key={`p${i}`} d={p} />
            ))}
            {semilunar(AORTIC_ROOT.x, AORTIC_ROOT.y, AORTIC_ROOT.r, ventricles).map((p, i) => (
              <path key={`a${i}`} d={p} />
            ))}
          </g>

          {/* ── AKIŞ ── */}
          <Flow route={ROUTES.venaCava} colour={BLUE} frame={frame} lit={flowing('venaCava')} />
          <Flow route={ROUTES.ivc} colour={BLUE} frame={frame} lit={flowing('ivc')} />
          <Flow route={ROUTES.toRV} colour={BLUE} frame={frame} lit={flowing('toRV')} />
          <Flow route={ROUTES.toLung} colour={BLUE} frame={frame} lit={flowing('toLung')} />
          <Flow route={ROUTES.fromLung} colour={RED} frame={frame} lit={flowing('fromLung')} />
          <Flow route={ROUTES.toLV} colour={RED} frame={frame} lit={flowing('toLV')} />
          <Flow route={ROUTES.toBody} colour={RED} frame={frame} lit={flowing('toBody')} speed={0.013} />
        </g>
      </svg>

      {/**
        * ETİKETLER — "burası atriyum, şurası açılıyor".
        *
        * Anatomi kendini adlandırmaz: kesit doğru olsa bile hangi boşluğun ne
        * olduğunu söylemeyen bir çizim, izleyene şekil gösterir, bilgi vermez.
        * Kılavuz çizgi noktadan yazıya gider, yazı kadrajın kenarında kalır.
        */}
      {listOf(scene, 'labels').length ? (
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{position: 'absolute', inset: 0}}>
          {listOf(scene, 'labels').map((raw, i) => {
            const [text, xs, ys, side, space] = String(raw).split('|');
            /**
             * ETİKET ANATOMİYE ÇAKILIDIR, KAREYE DEĞİL.
             *
             * Nokta kare oranı olarak veriliyordu; kamera yaklaşınca ya da
             * kayınca çizim gidiyor, etiket olduğu yerde kalıyordu — "AORT"
             * yazısının aortu göstermemesinin sebebi buydu. Artık nokta DÜNYA
             * koordinatında duruyor ve kameranın aynı dönüşümünden geçiyor;
             * gövde uzayındaki bir nokta (akciğer, bacak) önce gövde
             * dönüşümünden geçer.
             */
            const localX = Number(xs) * W;
            const localY = Number(ys) * H;
            const worldX = space === 'b' ? BODY_TX + localX * BODY_SCALE : localX;
            const worldY = space === 'b' ? BODY_TY + localY * BODY_SCALE : localY;
            const x = (worldX - W / 2) * zoom + W / 2 + panX;
            const y = (worldY - H / 2) * zoom + H / 2 + panY;
            // Kadraj dışındaki bir noktayı göstermeye çalışan kılavuz çizgi,
            // hiçbir şeyi göstermeyen bir çizgidir.
            if (x < -40 || x > W + 40 || y < -40 || y > H + 40) return null;

            const leftSide = side === 'l';
            // Sağ sütun oynatıcının düğmeleri için ayrılır; yazı oraya girmez.
            const tx = leftSide ? 62 : W - 128;
            /**
             * Raf bandı: üstte altyazı, altta oynatıcı arayüzü. Etiket ikisinin
             * arasında kalan güvenli banda iner ve her etiketin kendi rafı olur.
             */
            const railY = 1210 + i * 104;
            const show = Math.min(1, Math.max(0, (frame - 3 - i * 3) / 5));
            if (show <= 0) return null;
            const elbowX = leftSide ? Math.max(120, Math.min(x, 300) - 70) : Math.min(W - 170, Math.max(x, W - 320) + 70);
            return (
              <g key={i} opacity={show}>
                <circle cx={x} cy={y} r={10} fill="#ffcf3d" />
                <circle cx={x} cy={y} r={20} fill="none" stroke="#ffcf3d" strokeWidth={3} opacity={0.5} />
                <path
                  d={`M ${x} ${y} L ${elbowX} ${railY} L ${tx} ${railY}`}
                  fill="none"
                  stroke="#ffcf3d"
                  strokeWidth={4}
                  strokeDasharray={1400}
                  strokeDashoffset={1400 * (1 - show)}
                />
                <text
                  x={tx}
                  y={railY - 20}
                  fill="#ffcf3d"
                  fontSize={46}
                  fontWeight={800}
                  textAnchor={leftSide ? 'start' : 'end'}
                  fontFamily="Helvetica, Arial, sans-serif"
                >
                  {text}
                </text>
              </g>
            );
          })}
        </svg>
      ) : null}

      {big ? (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 560,
            textAlign: 'center',
            color: '#ffcf3d',
            font: '800 200px/1 Helvetica, Arial, sans-serif',
            letterSpacing: '-0.03em',
            opacity: arrive,
            textShadow: '0 10px 44px rgba(0,0,0,0.9)',
          }}
        >
          {big}
        </div>
      ) : null}

      {/**
        * YAZI YUKARIDA DURUR.
        *
        * Dikey akışta karenin ALT ÜÇTE BİRİ ölü alandır: oynatıcının kendi
        * arayüzü, hesap adı, ses etiketi ve sağdaki düğme sütunu oraya biner.
        * Altyazıyı oraya koymak, reel'in söylediği şeyi platformun kendi
        * arayüzüne yazdırmaktır. Üst bant güvenli: durum çubuğunun altı, ve
        * göz zaten oradan başlar.
        */}
      {title ? (
        <div
          style={{
            position: 'absolute',
            left: 56,
            right: 56,
            top: 210,
            color: '#fbf6ee',
            font: '800 76px/1.1 Helvetica, Arial, sans-serif',
            letterSpacing: '-0.015em',
            textShadow: '0 6px 34px rgba(0,0,0,0.98), 0 2px 10px rgba(0,0,0,0.9)',
            opacity: arrive,
            transform: `translateY(${(1 - arrive) * -12}px)`,
          }}
        >
          {title}
        </div>
      ) : null}
      {note ? (
        <div
          style={{
            position: 'absolute',
            left: 56,
            right: 56,
            top: 386,
            color: '#ffcf3d',
            font: '700 44px/1.2 Helvetica, Arial, sans-serif',
            textShadow: '0 4px 20px rgba(0,0,0,0.95)',
            opacity: arrive * Math.min(1, Math.max(0, (frame - 4) / 6)),
          }}
        >
          {note}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

/** Adı tırnaklı: doğrulayıcı bu dosyada sahne tipinin ADINI arıyor. */
export default {'heart': Heart};
