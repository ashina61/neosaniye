import React from 'react';
import {AbsoluteFill, OffthreadVideo, staticFile, useCurrentFrame} from 'remotion';
import {CANVAS, PALETTE, SAFE, SAFE_BOX, TYPE} from '../design/tokens';
import {enter} from '../motion/stepped';
import {FontFaces, PaperTexture, PaperVignette} from '../paper/PaperBase';
import {Headline, LabelCard} from '../paper/Type';
import type {SceneProps} from './types';

/**
 * ARŞİV KLİBİ
 *
 * Google Flow'dan dönen 5 saniyelik kolaj klibini oynatır. Bu şablon,
 * kullanıcının hedef gösterdiği görünümün taşıyıcısı: kare bir görsel
 * modelinin ürettiği yoğun arşiv kompozisyonu, hareketi i2v modeli veriyor.
 *
 * ==================== NE OYNATILIYOR ====================
 *
 * Klip beat'ten uzun (5 s klip, ~2.4 s beat) ve iç yapısı 0→3.5 s kurulum,
 * 3.5→5 s tutuş. `trimBefore` yutucuda hesaplanıyor ve klibin SONUNU beat'in
 * sonuna hizalıyor, böylece kare mutlaka oturuyor. Gerekçe ingest-clips.mjs
 * dosya başında.
 *
 * ==================== KOD NE YAPMAYA DEVAM EDİYOR ====================
 *
 * Kağıt zemin dokusu, vinyet ve ETİKETLER kodda kalıyor:
 *   · Flow metni yeniden yazıyor (ölçüldü: tarife içeriği değişti, tarih
 *     kaydı). Anlam taşıyan etiketi modele bırakmak yanlış bilgi riski.
 *   · Etiket güvenli alanın içinde durmak zorunda; modelin nereye yazacağı
 *     kontrol edilemez.
 * Yani klip görsel malzeme, kimlik katmanı kod. Bölüşüm bu.
 */
export const ArchiveClip: React.FC<SceneProps> = ({payload, seed, index}) => {
  const f = useCurrentFrame();
  const clip = payload.clip;
  const label = enter(f, {at: 0.9, duration: 0.35, kind: 'drop', from: {y: -70}});
  const head = enter(f, {at: 0.35, duration: 0.4, kind: 'fade'});

  if (!clip) {
    // Klip yoksa boş kare çizmek yerine belirgin bir uyarı bırak: sessiz
    // bozulma en kötü hata türü.
    return (
      <AbsoluteFill style={{backgroundColor: PALETTE.ground, alignItems: 'center', justifyContent: 'center'}}>
        <FontFaces />
        <div style={{fontSize: 44, color: PALETTE.ink, fontFamily: 'sans-serif', textAlign: 'center', padding: 80}}>
          {`archive_clip: sahne ${index + 1} için klip yok`}
        </div>
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill style={{backgroundColor: PALETTE.ground}}>
      <FontFaces />

      {/*
        Klip tam kare. `objectFit: cover` — Flow 720x1280 verdi, oran doğru ama
        çözünürlük hedefin altında; kırpma değil ölçekleme oluyor. Oranı bozuk
        bir klip gelirse cover kırpar ve yutucu bunu uyarı olarak basar.
      */}
      <OffthreadVideo
        src={staticFile(clip.src)}
        trimBefore={clip.trimBefore}
        // Flow klipleri kağıt ASMR taşıyor. Tamamen kısmak yazık olur, ama
        // 16 klibin sesi üst üste binince çamur olur ve anlatımı bastırır.
        volume={clip.audio ? 0.18 : 0}
        style={{width: CANVAS.width, height: CANVAS.height, objectFit: 'cover'}}
      />

      {/* Kağıt dokusu klibin ÜSTÜNE biner: klip ile kod-çizimli sahneler aynı
          malzemeden görünsün. Bu, iki kaydı tek filme bağlayan tek kural. */}
      <PaperTexture opacity={0.16} />
      <PaperVignette />

      {payload.headline && (
        <Headline
          text={payload.headline}
          size={TYPE.subhead}
          style={{
            position: 'absolute',
            left: SAFE.left,
            top: CANVAS.height - SAFE.bottom + 40,
            width: SAFE_BOX.width,
            opacity: head.opacity,
            // Klibin üstünde okunurluk: metnin arkasına hafif kağıt yaprağı.
            background: 'rgba(240,237,226,0.86)',
            padding: '18px 22px',
            boxShadow: '0 10px 18px rgba(24,18,8,0.22)',
          }}
          seed={seed}
        />
      )}

      {payload.label && (
        <LabelCard
          text={payload.label}
          x={SAFE.left}
          y={SAFE.top}
          rotate={-1.2}
          opacity={label.opacity}
          transform={label.transform}
          accent
        />
      )}
    </AbsoluteFill>
  );
};
