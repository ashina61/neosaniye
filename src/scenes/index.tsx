import React from 'react';
import {useCurrentFrame} from 'remotion';
import {CANVAS, PALETTE, SAFE, SAFE_BOX, TYPE, VERTICAL_BANDS, FONTS} from '../design/tokens';
import {enter, drift, breathe, rand} from '../motion/stepped';
import {PaperBase} from '../paper/PaperBase';
import {Cutout, TornCard} from '../paper/Cutout';
import {Headline, PullQuote, LabelCard, Stamp, TypewriterStrip} from '../paper/Type';
import {DrawnArrow, DottedPath, MarkerCircle, SparkleField, SeaBand, Sparkle} from '../paper/Marks';
import {StickFigure, ThoughtBubble, type Pose} from '../paper/StickFigure';
import type {SceneProps, SceneTemplate} from './types';

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
/* 1. HERO CUTOUT — tek özne, gerekirse marker dairesi                */
/* ------------------------------------------------------------------ */
const HeroCutout: React.FC<SceneProps> = ({seconds, payload, seed, index}) => {
  const f = useCurrentFrame();
  const card = enter(f, {at: 0.15, duration: 0.4, kind: 'fade'});
  const hero = enter(f, {at: 0.35, duration: 0.55, kind: 'slide', from: {x: -180}});
  const label = enter(f, {at: 1.0, duration: 0.3, kind: 'drop', from: {y: -90}});
  const ring = enter(f, {at: 1.35, duration: 0.7, kind: 'draw'});

  const heroW = Math.round(SAFE_BOX.width * 0.78);
  const heroH = Math.round(B.hero.height * 0.94);
  const heroX = SAFE.left + Math.round((SAFE_BOX.width - heroW) / 2);

  return (
    <PaperBase seed={seed}>
      <TornCard
        x={heroX - 40}
        y={B.hero.y - 30}
        width={heroW + 80}
        height={heroH + 60}
        color={PALETTE.groundWarm}
        rotate={-0.7}
        opacity={card.opacity}
        seed={seed + 1}
      />
      <Cutout
        shape="figure"
        src={payload.images?.[0]}
        x={heroX}
        y={B.hero.y}
        width={heroW}
        height={heroH}
        seed={seed}
        opacity={hero.opacity}
        // Tek sürüklenen katman: hero. Yavaş, birkaç on piksel.
        transform={`${hero.transform} ${drift(f, {seconds, dx: 14, dy: -10, scale: 0.03})}`}
      />
      {payload.label && (
        <LabelCard
          text={payload.label}
          x={SAFE.left + 20}
          y={B.bottom.y + 30}
          rotate={-1.4}
          opacity={label.opacity}
          transform={label.transform}
        />
      )}
      {payload.headline && (
        <Headline
          text={payload.headline}
          size={TYPE.subhead}
          style={{
            position: 'absolute',
            left: SAFE.left,
            top: B.bottom.y + 130,
            width: SAFE_BOX.width,
            opacity: label.opacity,
          }}
          seed={seed}
        />
      )}
      {/* Marker dairesi yalnızca vurgulanacak bir şey varsa çizilir. */}
      {payload.label && index > 0 && (
        <MarkerCircle
          cx={heroX + heroW * 0.5}
          cy={B.hero.y + heroH * 0.34}
          rx={heroW * 0.30}
          progress={ring.progress}
          seed={seed}
        />
      )}
      <SparkleField count={3} seed={seed} progress={ring.progress} />
    </PaperBase>
  );
};

/* ------------------------------------------------------------------ */
/* 2. WIDE ESTABLISH — küçük özne, geniş boşluk, zemin bandı           */
/* ------------------------------------------------------------------ */
const WideEstablish: React.FC<SceneProps> = ({seconds, payload, seed}) => {
  const f = useCurrentFrame();
  const band = enter(f, {at: 0.1, duration: 0.6, kind: 'draw'});
  const subject = enter(f, {at: 0.6, duration: 0.7, kind: 'slide', from: {x: -260}});
  const cap = enter(f, {at: 1.4, duration: 0.35, kind: 'fade'});

  const bandY = Math.round(CANVAS.height * 0.56);
  const w = Math.round(SAFE_BOX.width * 0.42);

  return (
    <PaperBase seed={seed}>
      <SeaBand y={bandY} height={CANVAS.height - bandY} progress={band.progress} seed={seed} />
      <Cutout
        shape="vessel"
        src={payload.images?.[0]}
        x={SAFE.left + Math.round(SAFE_BOX.width * 0.10)}
        y={bandY - Math.round(w * 0.42)}
        width={w}
        height={Math.round(w * 0.7)}
        seed={seed}
        opacity={subject.opacity}
        transform={`${subject.transform} ${drift(f, {seconds, dx: 46, dy: 0})}`}
      />
      {payload.headline && (
        <Headline
          text={payload.headline}
          size={TYPE.headline}
          style={{position: 'absolute', left: SAFE.left, top: B.top.y, width: SAFE_BOX.width, opacity: cap.opacity}}
          seed={seed}
        />
      )}
      {payload.caption && (
        <TypewriterStrip
          text={payload.caption}
          x={SAFE.left}
          y={B.bottom.y + 180}
          width={SAFE_BOX.width - 60}
          opacity={cap.opacity}
        />
      )}
      <SparkleField count={2} seed={seed + 4} progress={cap.progress} bounds={{x: 120, y: 300, width: 800, height: 500}} />
    </PaperBase>
  );
};

/* ------------------------------------------------------------------ */
/* 3. HEADLINE CARD — büyük condensed başlık + portre + isim kartı     */
/* ------------------------------------------------------------------ */
const HeadlineCard: React.FC<SceneProps> = ({seconds, payload, seed}) => {
  const f = useCurrentFrame();
  const head = enter(f, {at: 0.12, duration: 0.4, kind: 'drop', from: {y: -70}});
  const bar = enter(f, {at: 0.55, duration: 0.45, kind: 'draw'});
  const port = enter(f, {at: 0.75, duration: 0.55, kind: 'slide', from: {y: 120}});
  const name = enter(f, {at: 1.5, duration: 0.3, kind: 'stamp'});

  const pw = Math.round(SAFE_BOX.width * 0.66);
  const ph = Math.round(B.hero.height * 0.9);
  const px = SAFE.left + Math.round((SAFE_BOX.width - pw) / 2);

  return (
    <PaperBase seed={seed}>
      {payload.headline && (
        <Headline
          text={payload.headline}
          size={TYPE.headline}
          align="center"
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
        color={PALETTE.sea}
        rotate={0.6}
        opacity={port.opacity}
        seed={seed + 2}
      />
      <Cutout
        shape="figure"
        src={payload.images?.[0]}
        x={px}
        y={B.hero.y}
        width={pw}
        height={ph}
        seed={seed}
        opacity={port.opacity}
        transform={`${port.transform} ${drift(f, {seconds, dy: -12, scale: 0.025})}`}
      />
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
    </PaperBase>
  );
};

/* ------------------------------------------------------------------ */
/* 4. PULL QUOTE — italik serif, en duygusal cümle                     */
/* ------------------------------------------------------------------ */
const PullQuoteScene: React.FC<SceneProps> = ({seconds, payload, seed}) => {
  const f = useCurrentFrame();
  const q = enter(f, {at: 0.15, duration: 0.5, kind: 'fade'});
  const hl = enter(f, {at: 0.9, duration: 0.5, kind: 'draw'});
  const side = enter(f, {at: 1.3, duration: 0.5, kind: 'slide', from: {x: 140}});

  const cw = Math.round(SAFE_BOX.width * 0.46);

  return (
    <PaperBase seed={seed} ground="warm">
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
        }}
        seed={seed}
      />
      {payload.images?.[0] || payload.label ? (
        <>
          <Cutout
            shape="figure"
            src={payload.images?.[0]}
            x={SAFE.left + Math.round((SAFE_BOX.width - cw) / 2)}
            y={B.hero.y + 120}
            width={cw}
            height={Math.round(cw * 1.25)}
            seed={seed}
            opacity={side.opacity}
            transform={`${side.transform} ${drift(f, {seconds, dx: -10, scale: 0.02})}`}
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
const SplitCompare: React.FC<SceneProps> = ({payload, seed}) => {
  const f = useCurrentFrame();
  const top = enter(f, {at: 0.15, duration: 0.45, kind: 'slide', from: {x: -240}});
  const bot = enter(f, {at: 0.65, duration: 0.45, kind: 'slide', from: {x: 240}});
  const rule = enter(f, {at: 1.15, duration: 0.4, kind: 'draw'});

  const sides = payload.sides;
  // Taraf etiketi yoksa karşılaştırma sahnesi kurulamaz: sessizce boş panel
  // çizmek yerine hero_cutout'a düşülür (kayıt registry'de yapılır).
  if (!sides) return <HeroCutout seconds={4} payload={payload} seed={seed} index={1} />;

  const panelH = Math.round(SAFE_BOX.height * 0.40);
  const mid = SAFE.top + Math.round(SAFE_BOX.height * 0.5);

  const Panel: React.FC<{
    y: number;
    side: {label: string; detail?: string};
    op: number;
    tr: string;
    ground: string;
    shape: 'figure' | 'object';
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
        shape="figure"
        s={seed + 1}
      />
      <Panel
        y={mid + 40}
        side={sides[1]}
        op={bot.opacity}
        tr={bot.transform}
        ground={PALETTE.sea}
        shape="object"
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
const LabeledDiagram: React.FC<SceneProps> = ({seconds, payload, seed}) => {
  const f = useCurrentFrame();
  const a = enter(f, {at: 0.15, duration: 0.45, kind: 'drop', from: {y: -140}});
  const b = enter(f, {at: 0.7, duration: 0.45, kind: 'drop', from: {y: -140}});
  const arrow = enter(f, {at: 1.2, duration: 0.6, kind: 'draw'});
  const cap = enter(f, {at: 1.9, duration: 0.35, kind: 'stamp'});

  const boxW = Math.round(SAFE_BOX.width * 0.46);
  const boxH = Math.round(boxW * 1.1);
  const leftX = SAFE.left;
  const rightX = SAFE.left + SAFE_BOX.width - boxW;
  const rowY = B.hero.y + 40;

  return (
    <PaperBase seed={seed}>
      {payload.headline && (
        <Headline
          text={payload.headline}
          size={TYPE.subhead}
          style={{position: 'absolute', left: SAFE.left, top: B.top.y, width: SAFE_BOX.width, opacity: a.opacity}}
          seed={seed}
        />
      )}
      <Cutout
        shape="figure"
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
        shape="vessel"
        src={payload.images?.[1]}
        x={rightX}
        y={rowY + 90}
        width={boxW}
        height={Math.round(boxW * 0.72)}
        seed={seed + 3}
        opacity={b.opacity}
        transform={`${b.transform} ${drift(f, {seconds, dx: 12, dy: 6})}`}
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
const ArchivalTimeline: React.FC<SceneProps> = ({payload, seed}) => {
  const f = useCurrentFrame();
  const line = enter(f, {at: 0.2, duration: 0.9, kind: 'draw'});
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
        const st = enter(f, {at: 0.5 + i * 0.35, duration: 0.4, kind: 'slide', from: {x: -120}});
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
          style={{position: 'absolute', left: SAFE.left, top: CANVAS.height - SAFE.bottom + 20, width: SAFE_BOX.width}}
          seed={seed}
        />
      )}
    </PaperBase>
  );
};

/* ------------------------------------------------------------------ */
/* 8. MAP ROUTE — harita zemini + noktalı rota + duraklar              */
/* ------------------------------------------------------------------ */
const MapRoute: React.FC<SceneProps> = ({payload, seed}) => {
  const f = useCurrentFrame();
  const base = enter(f, {at: 0.1, duration: 0.4, kind: 'fade'});
  const path = enter(f, {at: 0.7, duration: 1.1, kind: 'draw'});

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
          burada gereken şey doğru coğrafya değil, OKUNUR şema. */}
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
      <DottedPath points={pts} progress={path.progress} color={PALETTE.accent} width={8} dash={20} />
      {stops.map((s, i) => {
        const st = enter(f, {at: 0.8 + i * 0.4, duration: 0.3, kind: 'stamp'});
        const p = pts[i];
        return (
          <React.Fragment key={i}>
            <div
              style={{
                position: 'absolute',
                left: p.x - 18,
                top: p.y - 18,
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: PALETTE.accent,
                border: `4px solid ${PALETTE.paper}`,
                opacity: st.opacity,
                transform: st.transform,
              }}
            />
            {s.label && (
              <LabelCard text={s.label} x={p.x + 26} y={p.y - 26} opacity={st.opacity} size={30} />
            )}
          </React.Fragment>
        );
      })}
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
const GridScale: React.FC<SceneProps> = ({payload, seed}) => {
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

  const bar = enter(f, {at: 0.9 + total * 0.03, duration: 0.5, kind: 'draw'});

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
        const st = enter(f, {at: 0.25 + i * 0.028, duration: 0.22, kind: 'stamp'});
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
              transform: st.transform,
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
const DataAnnotate: React.FC<SceneProps> = ({payload, seed}) => {
  const f = useCurrentFrame();
  const axes = enter(f, {at: 0.1, duration: 0.4, kind: 'draw'});
  const line = enter(f, {at: 0.55, duration: 1.0, kind: 'draw'});
  const ring = enter(f, {at: 1.7, duration: 0.6, kind: 'draw'});
  const note = enter(f, {at: 2.1, duration: 0.3, kind: 'fade'});

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
  const fig = enter(f, {at: 0.2, duration: 0.5, kind: 'drop', from: {y: -120}});
  const head = enter(f, {at: 0.75, duration: 0.4, kind: 'fade'});
  const hl = enter(f, {at: 1.2, duration: 0.5, kind: 'draw'});

  const pose = POSE_BY_SEED[Math.floor(rand(seed) * POSE_BY_SEED.length)];
  const h = Math.round(B.hero.height * 0.82);
  const wobble = breathe(f, seed) * 0.6;

  return (
    <PaperBase seed={seed} stains={false}>
      <StickFigure
        pose={pose}
        x={SAFE.left + Math.round(SAFE_BOX.width / 2) - Math.round((h / 150) * 100 / 2)}
        y={B.hero.y + 40}
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
          align="center"
          reveal={hl.progress}
          style={{
            position: 'absolute',
            left: SAFE.left,
            top: B.top.y,
            width: SAFE_BOX.width,
            opacity: head.opacity,
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
  const rings = enter(f, {at: 0.1, duration: 1.0, kind: 'draw'});
  const port = enter(f, {at: 0.7, duration: 0.55, kind: 'fade'});
  const lab = enter(f, {at: 1.5, duration: 0.35, kind: 'stamp'});

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
        shape="figure"
        src={payload.images?.[0]}
        x={cx - pw / 2}
        y={cy - Math.round(pw * 0.62)}
        width={pw}
        height={Math.round(pw * 1.24)}
        seed={seed}
        opacity={port.opacity}
        transform={drift(f, {seconds, scale: 0.03, dy: -8})}
        outlineColor={PALETTE.paper}
      />
      {payload.headline && (
        <Headline
          text={payload.headline}
          size={TYPE.subhead}
          align="center"
          color={PALETTE.paper}
          style={{position: 'absolute', left: SAFE.left, top: B.top.y, width: SAFE_BOX.width, opacity: port.opacity}}
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
};

export const SCENE_NAMES = Object.keys(SCENES) as SceneTemplate[];
