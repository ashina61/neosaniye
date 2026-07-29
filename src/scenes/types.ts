/**
 * SAHNE SÖZLEŞMESİ
 *
 * Her sahne şablonu aynı `SceneProps`'u alır. Şablonlar konuya değil, BEAT
 * TÜRÜNE bağlıdır: "trafik lambası sahnesi" diye bir bileşen yoktur, çünkü
 * konu başına bileşen yazmak (eski repoda olan hata) her yeni konuyu elle
 * kodlama demekti.
 */

/** Vox stil taksonomisindeki kimlikler. Şablon adları buradan türer. */
export type SceneTemplate =
  | 'hero_cutout'       // 1  cutout collage: tek hero, gerekirse marker/ok
  | 'wide_establish'    // yer kurma: küçük özne, geniş boşluk, zemin bandı
  | 'headline_card'     // 14 kinetic typography: büyük başlık + isim kartı
  | 'pull_quote'        // italik serif alıntı
  | 'split_compare'     // iki panel karşılaştırma (üst/alt, dikeyde)
  | 'labeled_diagram'   // 18/3 etiketli diyagram: özne + ok + hedef + caption
  | 'archival_timeline' // 5  noktalı çizgi üstünde tarihler
  | 'map_route'         // 10/11 harita + rota
  | 'grid_scale'        // 16 tekrarlı ikon ızgarası, birkaçı vurgulu
  | 'data_annotate'     // 4  minimal grafik + tek kırmızı çizgi + elle daire
  | 'stick_beat'        // soyut/duygusal beat: çöp adam
  | 'star_field';       // gece zemin, eş merkezli halkalar, portre

/** Anlatının bu beat'te ne YAPTIĞI. Şablon seçimi buna dayanır. */
export type BeatKind =
  | 'cold_open'   // tarih + yer + tek somut eylem
  | 'fact'        // olgusal bildirim
  | 'place'       // yer/coğrafya
  | 'person'      // kişi tanıtımı
  | 'compare'     // iki şeyi karşılaştırma
  | 'sequence'    // sıralı olay / rota
  | 'scale'       // büyüklük/oran
  | 'data'        // sayı/eğilim
  | 'abstract'    // soyut fikir, izleyiciye dönük
  | 'quote'       // alıntı / en duygusal cümle
  | 'cliffhanger';

export interface SceneSide {
  label: string;
  detail?: string;
}

/** Şablonların okuduğu içerik. Tümü opsiyonel: şablon eksiğini tolere eder. */
export interface ScenePayload {
  /** 1-4 kelime kural: LabelCard bunu zorlar. */
  label?: string;
  /** Büyük başlık. *yıldız* ile vurgu işaretlenir. */
  headline?: string;
  /** Alıntı metni. */
  quote?: string;
  /** Küçük alt bilgi şeridi. */
  caption?: string;
  /** Karşılaştırma tarafları. */
  sides?: [SceneSide, SceneSide];
  /** Zaman çizelgesi girdileri. */
  timeline?: Array<{year: string; text?: string}>;
  /** Rota durakları (normalize 0..1 koordinat). */
  route?: Array<{x: number; y: number; label?: string}>;
  /** grid_scale: toplam ve vurgulanan sayı. */
  ratio?: {total: number; highlighted: number; unit?: string};
  /** data_annotate: seri değerleri 0..1. */
  series?: number[];
  /** Alfa kanallı cutout yolları (varsa). */
  images?: string[];
}

export interface SceneProps {
  /** Sahnenin süresi, saniye. Beat süresinden gelir. */
  seconds: number;
  payload: ScenePayload;
  /** Deterministik varyasyon için. Aynı seed → aynı kare. */
  seed: number;
  /** Sahne sırası — 0 ise hook, farklı davranır. */
  index: number;
}
