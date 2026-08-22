import React from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import type {SceneProps} from '../../../engine/sceneTypes/types';
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
  RV_CAVITY,
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
    [[248, 250], [248, 380], [252, 470], [286, 560]],
    [[286, 560], [316, 630], [330, 700], [340, 790]],
  ],
  ivc: [
    [[236, 1560], [236, 1300], [252, 1080], [300, 940]],
    [[300, 940], [330, 890], [340, 850], [345, 810]],
  ],
  toRV: [
    [[345, 810], [360, 870], [372, 900], [392, 946]],
    [[392, 946], [400, 1010], [400, 1120], [420, 1220]],
  ],
  toLung: [
    [[420, 1220], [400, 1080], [396, 940], [418, 860]],
    [[418, 860], [440, 760], [430, 620], [408, 470]],
    [[408, 470], [372, 380], [300, 330], [232, 316]],
  ],
  fromLung: [
    [[858, 300], [900, 360], [906, 470], [880, 560]],
    [[880, 560], [850, 640], [800, 700], [730, 742]],
    [[730, 742], [700, 790], [680, 830], [668, 880]],
  ],
  toLV: [
    [[668, 880], [672, 920], [676, 940], [686, 968]],
    [[686, 968], [700, 1060], [694, 1200], [662, 1300]],
  ],
  toBody: [
    [[662, 1300], [690, 1140], [700, 1010], [676, 906]],
    [[676, 906], [660, 800], [660, 660], [700, 520]],
    [[700, 520], [760, 380], [880, 360], [944, 470]],
    [[944, 470], [980, 640], [968, 1100], [946, 1580]],
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

const Heart: React.FC<SceneProps> = ({scene}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const bpm = numOf(scene, 'bpm', 66);
  const {atria, ventricles} = beat(frame, fps, bpm);

  const on = listOf(scene, 'lit');
  const lit = (k: string) => (on.length === 0 || on.includes(k) ? 1 : 0.2);
  const flows = listOf(scene, 'flow');
  const flowing = (k: string) => (flows.includes(k) ? 1 : 0);

  const zoom = numOf(scene, 'zoom', 1);
  const panX = numOf(scene, 'panX', 0);
  const panY = numOf(scene, 'panY', 0);
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
          {/* ── BÜYÜK DAMARLAR, kasın ARKASINDA başlayıp önünden çıkanlar ── */}
          <g opacity={lit('vessels')}>
            {/* Vena kava superior ve inferior — kirli kanın döndüğü yer */}
            <path d="M 214 236 L 282 236 L 300 560 L 262 590 Z" fill="url(#blueTube)" stroke={BLUE_DARK} strokeWidth={5} />
            <path d="M 206 1600 L 268 1600 L 306 1120 L 250 1090 Z" fill="url(#blueTube)" stroke={BLUE_DARK} strokeWidth={5} />
            {/* Pulmoner trunkus: sağ karıncıktan çıkar, ikiye ayrılır */}
            <path
              d="M 372 880 C 350 720, 356 560, 400 452 C 430 384, 470 356, 520 352 L 520 300 C 430 300, 350 356, 316 452 C 282 552, 288 740, 316 892 Z"
              fill="url(#blueTube)"
              stroke={BLUE_DARK}
              strokeWidth={5}
            />
            <path d="M 316 300 L 520 300 L 520 352 L 316 352 Z" fill="url(#blueTube)" stroke={BLUE_DARK} strokeWidth={5} />
            {/* Aort: sol karıncıktan çıkar, kavis yapar, aşağı iner */}
            <path
              d="M 646 880 C 636 700, 660 560, 730 470 C 800 382, 906 396, 944 500 C 968 700, 962 1120, 946 1600 L 884 1600 C 900 1120, 906 700, 886 528 C 866 456, 800 452, 762 512 C 720 580, 706 720, 716 890 Z"
              fill="url(#redTube)"
              stroke={RED_DARK}
              strokeWidth={5}
            />
            {/* Arkus dalları: brakiyosefalik, sol karotis, sol subklavyen */}
            <path d="M 766 300 L 800 300 L 806 452 L 772 452 Z" fill="url(#redTube)" stroke={RED_DARK} strokeWidth={4} />
            <path d="M 826 300 L 858 300 L 862 424 L 830 428 Z" fill="url(#redTube)" stroke={RED_DARK} strokeWidth={4} />
            <path d="M 884 300 L 916 300 L 926 430 L 894 436 Z" fill="url(#redTube)" stroke={RED_DARK} strokeWidth={4} />
            {/* Pulmoner venler — akciğerden sol kulakçığa, dört tane */}
            {[
              'M 900 560 C 840 566, 812 596, 806 636 L 862 648 C 878 618, 900 604, 940 600 Z',
              'M 908 700 C 852 700, 818 720, 806 752 L 860 772 C 878 744, 904 736, 946 738 Z',
            ].map((path, i) => (
              <path key={i} d={path} fill="url(#redTube)" stroke={RED_DARK} strokeWidth={4} />
            ))}
          </g>

          {/* ── MİYOKARD ── */}
          <g transform={`translate(560 1440) scale(${vSq}) translate(-560 -1440)`}>
            <path d={OUTLINE} fill="url(#myo)" stroke={MYO_DARK} strokeWidth={7} />
          </g>

          {/* ── BOŞLUKLAR ── */}
          <g opacity={lit('ra')} transform={`translate(360 900) scale(${aSq}) translate(-360 -900)`}>
            <path d={RA_CAVITY} fill="#2c4a68" stroke={ENDO} strokeWidth={5} />
          </g>
          <g opacity={lit('la')} transform={`translate(720 900) scale(${aSq}) translate(-720 -900)`}>
            <path d={LA_CAVITY} fill="#6d2b28" stroke={ENDO} strokeWidth={5} />
          </g>
          <g opacity={lit('rv')} transform={`translate(430 1440) scale(${vSq}) translate(-430 -1440)`}>
            <path d={RV_CAVITY} fill="#2f5170" stroke={ENDO} strokeWidth={5} />
            {TRABECULAE_RV.map((t, i) => (
              <path key={i} d={t} fill="none" stroke={MYO_LIGHT} strokeWidth={9} strokeLinecap="round" opacity={0.75} />
            ))}
            <path d={papillary(392, 1300, 92, 150, ventricles)} fill={MYO} stroke={MYO_DARK} strokeWidth={5} />
            {chordae(392, 1150, 400, 986, 4, 60).map((c, i) => (
              <path key={i} d={c} fill="none" stroke={ENDO} strokeWidth={3.5} opacity={0.85} />
            ))}
          </g>
          <g opacity={lit('lv')} transform={`translate(660 1440) scale(${vSq}) translate(-660 -1440)`}>
            <path d={LV_CAVITY} fill="#7c2b27" stroke={ENDO} strokeWidth={5} />
            {TRABECULAE_LV.map((t, i) => (
              <path key={i} d={t} fill="none" stroke={MYO_LIGHT} strokeWidth={8} strokeLinecap="round" opacity={0.7} />
            ))}
            <path d={papillary(676, 1280, 88, 140, ventricles)} fill={MYO} stroke={MYO_DARK} strokeWidth={5} />
            {chordae(676, 1140, 668, 990, 4, 56).map((c, i) => (
              <path key={i} d={c} fill="none" stroke={ENDO} strokeWidth={3.5} opacity={0.85} />
            ))}
          </g>

          {/* ── KAPAKLAR: kasılmada AV kapanır, yarım aylar açılır ── */}
          <g opacity={lit('valve')} stroke={ENDO} strokeWidth={7} fill="none" strokeLinecap="round">
            {/* Triküspit — üç yaprakçık */}
            <path d={leaflet(330, 930, 130, 120, 1 - ventricles, 1)} />
            <path d={leaflet(470, 930, 120, 120, 1 - ventricles, -1)} />
            <path d={leaflet(400, 934, 70, 100, 1 - ventricles, 1)} opacity={0.9} />
            {/* Mitral — iki yaprakçık */}
            <path d={leaflet(600, 930, 130, 130, 1 - ventricles, 1)} />
            <path d={leaflet(760, 930, 130, 130, 1 - ventricles, -1)} />
            {/* Pulmoner ve aort yarım ay kapakları */}
            {semilunar(372, 876, 62, ventricles).map((p, i) => (
              <path key={`p${i}`} d={p} />
            ))}
            {semilunar(672, 876, 62, ventricles).map((p, i) => (
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

      {big ? (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 300,
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

      {title ? (
        <div
          style={{
            position: 'absolute',
            left: 58,
            right: 58,
            bottom: 168,
            color: '#fbf6ee',
            font: '800 72px/1.12 Helvetica, Arial, sans-serif',
            textShadow: '0 6px 30px rgba(0,0,0,0.95)',
            opacity: arrive,
            transform: `translateY(${(1 - arrive) * 14}px)`,
          }}
        >
          {title}
        </div>
      ) : null}
      {note ? (
        <div
          style={{
            position: 'absolute',
            left: 58,
            right: 58,
            bottom: 96,
            color: '#ffcf3d',
            font: '700 42px/1.2 Helvetica, Arial, sans-serif',
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
