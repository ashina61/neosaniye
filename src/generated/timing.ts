export type CaptionCue = {start: number; end: number; text: string};

export const CUES: CaptionCue[] = [
  {start: 12, end: 102, text: "Venüs'te bir gün, bir yıldan daha uzun."},
  {start: 102, end: 282, text: "Ama burada küçük bir ayrıntı var. Bu, Güneş'in gökyüzündeki turu değil; gezegenin kendi eksenindeki tam dönüşü."},
  {start: 282, end: 402, text: "Venüs bir kez dönmek için 243 Dünya günü harcıyor."},
  {start: 402, end: 522, text: "Güneş'in çevresindeki bir yılıysa yalnızca 225 Dünya günü sürüyor."},
  {start: 522, end: 672, text: "Yani Venüs, kendi etrafındaki dönüşünü tamamlayamadan yeni yılı geliyor."},
  {start: 672, end: 852, text: "Üstelik ters yönde döndüğü için Güneş batıdan doğup doğuda batıyor gibi görünür."},
  {start: 852, end: 1032, text: "Gün doğumundan gün doğumuna geçen güneş günü ise yaklaşık 117 Dünya günü. Venüs'te zaman gerçekten ters köşe."}
];

export const SCENES = {
  hook: 0,
  explain: 102,
  rotation: 282,
  orbit: 402,
  compare: 522,
  reverse: 672,
  solar: 852
} as const;

export const TOTAL_FRAMES = 1056;
