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
  | 'star_field'        // gece zemin, eş merkezli halkalar, portre
  | 'archive_clip'      // Google Flow'dan dönen kompoze kolaj klibi
  | 'collage_build';    // parça parça üretilmiş kolaj: plaka + N alfa parça

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
  /**
   * CÜMLENİN ÇİZİLECEK NESNESİ.
   *
   * `pipeline/subject.mjs` cümleden çıkarır; `pipeline/build-storyboard.mjs`
   * buraya yazar. Şablon bunu KENDİ VARSAYILANININ ÖNÜNDE kullanır.
   *
   * Bu alan olmadan şekil şablonun sabitiydi: `hero_cutout` her zaman insan
   * silueti, `wide_establish` her zaman tekne. Yani "He carried no compass"
   * cümlesine çöp adam, "stepped onto a canoe" cümlesine insan çiziliyordu.
   * Şablon beat TÜRÜNÜ doğru seçiyordu; içine hangi nesnenin çizileceği kararı
   * hiç verilmemişti.
   */
  shape?:
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
    | 'key';
  /**
   * İKİNCİ nesne — yalnızca iki nesne çizen şablonlar okur (labeled_diagram,
   * split_compare). Cümlede ikinci somut nesne varsa o çizilir; yoksa şablon
   * kendi varsayılanına döner. Bu alan olmadan iki kutulu şablonlar SABİT bir
   * insan + yelkenli çiziyordu ve render'da "the swell, and the flight of
   * birds" cümlesine tam olarak o ikili çizildi.
   */
  shape2?: ScenePayload['shape'];
  /**
   * Cümle nesnenin YOKLUĞUNU söylüyor mu ("no compass", "without charts").
   * Doğruysa şablon nesneyi çizer ve ÜSTÜNÜ ÇİZER (`MarkerCross`). Nesneyi
   * olduğu gibi çizmek cümlenin tersini söylerdi.
   */
  negated?: boolean;
  /**
   * Flow'dan dönen klip. `ingest-clips.mjs` yazar; şablonu da `archive_clip`'e
   * çevirir. `trimBefore` klibin SONUNU beat'in sonuna hizalar.
   */
  clip?: {
    src: string;
    trimBefore: number;
    clipFrames: number;
    width: number;
    height: number;
    audio: boolean;
  };
  /**
   * PARÇA BAZLI KOLAJ MALZEMESİ — B yolu.
   *
   * `ingest-collage.mjs` yazar, şablonu da `collage_build`'e çevirir.
   *
   * NEDEN AYRI BİR ALAN, `images` YETMİYOR MU: yetmiyor, çünkü burada
   * parçaların ROLÜ var. `images` sırasız bir liste ve şablonlar ondan
   * yalnızca [0] ve [1]'i okuyor; hangisinin sahnenin kahramanı hangisinin
   * köşede duran leke olduğu bilgisi yok. Bu şablonun bütün işi katman
   * sırası kurmak, o yüzden rol veriyi taşımak zorunda.
   *
   * `plate` OPAK bir zemin görseli (alfa yok, tam kare); `pieces` alfa
   * kanallı kesikler ve İLKİ hero'dur — sıra `piecePrompts()`'un ürettiği
   * a/b/c/d sırasıdır, orada da ilk sıra hero.
   */
  layers?: {
    plate?: string;
    pieces: Array<{
      src: string;
      role: 'hero' | 'support';
      /**
       * PARÇANIN KENDİ YERİ — kanvasa göre normalize (0..1).
       *
       * Yoksa şablon kendi yuvalarına dağıtır; bu, parçaların TEK TEK
       * üretildiği normal akış (her parça ayrı bir görsel, aralarında
       * kompozisyon ilişkisi yok, yerleşimi kod kurmalı).
       *
       * Varsa AYNEN KULLANILIR. Sebep: parçalar TASARLANMIŞ bir kareden
       * ayrıştırıldığında konum bilginin kendisidir — atın altına sıkışmış
       * harita, sol kenardan taşan sancak, sağ alta çakılı etiket. Bunları
       * yuvalara dağıtmak kompozisyonu yok eder ve hareket promtunun
       * "preserve the final composition exactly" şartını çiğner.
       */
      box?: {x: number; y: number; w: number; h: number};
    }>;
  };
}

export interface SceneProps {
  /** Sahnenin süresi, saniye. Beat süresinden gelir. */
  seconds: number;
  payload: ScenePayload;
  /** Deterministik varyasyon için. Aynı seed → aynı kare. */
  seed: number;
  /** Sahne sırası — 0 ise hook, farklı davranır. */
  index: number;
  /**
   * Bu şablonun kaçıncı kullanımı (0 tabanlı). Yerleşim varyantı buna göre
   * döner; sahne sırasına göre dönmek aynı pariteli sıraları çakıştırıyordu.
   */
  occurrence: number;
}
