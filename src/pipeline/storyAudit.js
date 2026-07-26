/**
 * HİKÂYE DENETİMİ — "ekranda gerçekten bir olay oldu mu?"
 *
 * 26 Tem dersi: "aktör var mı?" sorusu yetersiz. Statik bir hayvan fotoğrafının
 * üstüne "ORGANS → ESCAPE" yazmak bir çizgi ve iki kutu üretir; metrik bunu
 * "aktörlü sahne" sayar, izleyici hiçbir şey görmez. Bu modül dört ayrı şeyi
 * ölçer ve hiçbirini ortalamayla maskelemez:
 *
 *   1. semantik eylem tamamlama  (özne + kaynak + hareket + sonuç)
 *   2. liste yapısı              (5 diyorsan 5 tane olacak)
 *   3. CTA yerleşimi             (final açıklamayı kesemez)
 *   4. tekrar                    (aynı cümle/kadraj/etiket iki kez)
 */

/* ------------------------------------------------------------------ *
 * 1) SEMANTİK EYLEM TAMAMLAMA
 * ------------------------------------------------------------------ */

/** Hareket/dönüşüm gösteren aktörler (sadece işaret koyanlar sayılmaz). */
const MOTION_ACTORS = new Set([
  'trail', 'walker', 'flow_arrow', 'chain', 'fill_meter', 'spread',
  'signal_wave', 'axis', 'build_up',
]);
/** Yalnızca İŞARET koyan aktörler — tek başına eylem değildir. */
const MARKER_ACTORS = new Set(['ring', 'readout']);

/**
 * Tek sahnenin eylem tamamlama raporu.
 *
 * @param {object} input
 * @param {string} input.narration
 * @param {Array}  input.actors      o sahnede çizilen aktörler
 * @param {object|null} input.focus  ölçülmüş özne konumu (varsa)
 * @param {boolean} input.hasSequence hareket dizisi kareleri var mı
 * @param {string|null} input.template hikâye şablonu
 */
export function scoreSemanticAction({
  narration = '', actors = [], focus = null, hasSequence = false, template = null,
} = {}) {
  const types = new Set(actors.map((a) => a?.type).filter(Boolean));
  const motion = [...types].some((t) => MOTION_ACTORS.has(t));
  const marker = [...types].some((t) => MARKER_ACTORS.has(t));

  // Eylemi YAPAN özne görünür mü? Konum ölçüldüyse evet; ölçülmediyse
  // ekranda neyin eylediğini gösteremiyoruz demektir.
  const actorVisible = Boolean(focus) || hasSequence;
  // Eylemin BAŞLADIĞI yer: yol/ok/zincirin bir çıkış noktası vardır.
  const sourceVisible = Boolean(
    focus || hasSequence
    || actors.some((a) => a?.from || a?.path?.length || a?.nodes?.length || a?.at),
  );
  // HAREKET veya DÖNÜŞÜM: ya animasyonlu aktör ya ardışık kareler.
  const motionOrTransformationVisible = motion || hasSequence;
  // SONUÇ: varış noktası, dolan ölçek, tetiklenen düğüm, biriken katman.
  const destinationOrEffectVisible = actors.some((a) => (
    (a?.type === 'trail' || a?.type === 'walker') && a?.path?.length > 1)
    || a?.type === 'fill_meter' || a?.type === 'build_up' || a?.type === 'spread'
    || (a?.type === 'chain' && (a.nodes || []).length >= 2)
    || (a?.type === 'flow_arrow' && a?.to)
    || (a?.type === 'signal_wave' && a?.to));
  const causeEffectReadable = motionOrTransformationVisible && destinationOrEffectVisible;

  const flags = [actorVisible, sourceVisible, motionOrTransformationVisible,
    destinationOrEffectVisible];
  let completionScore = +(flags.filter(Boolean).length / flags.length).toFixed(2);
  // YALNIZCA İŞARET: halka/sayaç var, hareket yok → dekorasyondur, 0 puan.
  if (!motionOrTransformationVisible && marker) completionScore = 0;

  return {
    actionType: template || null,
    narration: narration.slice(0, 90),
    actorVisible,
    sourceVisible,
    motionOrTransformationVisible,
    destinationOrEffectVisible,
    causeEffectReadable,
    completionScore,
  };
}

/**
 * Tüm sahneler için eylem tamamlama.
 * @param {Array} scenes [{narration, actors, focus, hasSequence, template}]
 */
export function assessSemanticActions(scenes = []) {
  const perScene = scenes.map((s) => scoreSemanticAction(s));
  const scored = perScene.filter((p) => p.actionType || p.actorVisible
    || p.motionOrTransformationVisible);
  const average = scored.length
    ? +(scored.reduce((a, p) => a + p.completionScore, 0) / scored.length).toFixed(2)
    : 0;
  return {
    average,
    scenesScored: scored.length,
    decorativeOnly: perScene.filter((p) => p.completionScore === 0
      && (p.actorVisible || p.sourceVisible)).length,
    perScene,
  };
}

/* ------------------------------------------------------------------ *
 * 2) LİSTE YAPISI
 * ------------------------------------------------------------------ */

const NUM_WORDS = {
  two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
};

/** Hook/başlık "N şey" vaat ediyor mu? */
export function declaredListCount(text = '') {
  const t = String(text).toLowerCase();
  const digit = t.match(/\b(\d{1,2})\s+(?:incredible\s+|amazing\s+|weird\s+|crazy\s+|surprising\s+)?(facts?|things?|reasons?|ways?|secrets?|powers?|tricks?)\b/);
  if (digit) return Number(digit[1]);
  const word = t.match(/\b(two|three|four|five|six|seven|eight|nine|ten)\s+(?:incredible\s+|amazing\s+|weird\s+|crazy\s+|surprising\s+)?(facts?|things?|reasons?|ways?|secrets?|powers?|tricks?)\b/);
  if (word) return NUM_WORDS[word[1]] || null;
  return null;
}

/**
 * Liste iddiası ile gerçek yapı uyuşuyor mu?
 *
 * Canlı hata: video "5 incredible facts" diye açıldı ama ne beş ayrı madde
 * vardı ne de ekranda numara. İzleyici saymaya başlıyor ve karşılığını
 * bulamıyor — vaat edilen yapı teslim edilmiyor.
 *
 * @param {object} script
 * @param {Array} [renderedMarkers] ekranda GERÇEKTEN basılan numaralar
 */
export function assessListStructure(script = {}, renderedMarkers = null) {
  const declaredItemCount = declaredListCount(script.hook_text)
    || declaredListCount(script.title);
  if (!declaredItemCount) {
    return { declared: false, valid: true, declaredItemCount: null, detectedItemCount: null,
      renderedMarkers: [] };
  }
  // Sahnelerdeki ayrı madde sayısı: script bunu işaretlediyse onu kullan,
  // yoksa numara/sıralama ipuçlarını say.
  const scenes = script.scenes || [];
  const marked = scenes.filter((s) => Number.isFinite(s?.list_index)).length;
  const cued = scenes.filter((s) => /\b(first|second|third|fourth|fifth|next|finally|number \d)\b/i
    .test(s?.narration || '')).length;
  const detectedItemCount = marked || cued;
  const markers = renderedMarkers || scenes
    .map((s) => s?.list_index).filter(Number.isFinite);
  const sequential = markers.length === declaredItemCount
    && markers.every((m, i) => m === i + 1);
  return {
    declared: true,
    declaredItemCount,
    detectedItemCount,
    renderedMarkers: markers,
    valid: detectedItemCount === declaredItemCount && sequential,
  };
}

/**
 * LİSTE İŞARETLERİNİ ATA — ya gerçekten numarala, ya iddiayı KALDIR.
 *
 * Canlı hata: video "5 incredible facts" diye açıldı, ekranda tek bir numara
 * yoktu ve anlatım beş ayrı maddeye bölünmüyordu. İzleyiciye verilen söz
 * tutulmadı. Kural: vaadi teslim edemiyorsan vaat etme.
 *
 * @param {object} script (yerinde değiştirilir)
 * @returns {{declared:number|null, assigned:number, strippedClaim:boolean}}
 */
export function assignListMarkers(script = {}) {
  const declared = declaredListCount(script.hook_text) || declaredListCount(script.title);
  if (!declared) return { declared: null, assigned: 0, strippedClaim: false };
  const scenes = script.scenes || [];
  // Hook sahnesi (0) madde değildir; maddeler sonrasında başlar.
  const body = scenes.slice(1);
  // 1) Açık ipucu taşıyan sahneler madde başıdır.
  const cueIdx = [];
  body.forEach((s, i) => {
    if (/\b(first|second|third|fourth|fifth|next|another|finally|also|number \d)\b/i
      .test(s?.narration || '')) cueIdx.push(i + 1);
  });
  let starts = cueIdx.length === declared ? cueIdx : [];
  // 2) İpucu yoksa gövdeyi eşit böl — ama ancak yeterli sahne varsa.
  if (!starts.length && body.length >= declared) {
    const step = body.length / declared;
    starts = Array.from({ length: declared }, (_, k) => 1 + Math.floor(k * step));
    starts = [...new Set(starts)];
  }
  if (starts.length !== declared) {
    // Vaadi teslim edemiyoruz → SAYIYI HOOK'TAN KALDIR.
    const strip = (t) => String(t || '')
      .replace(/^\s*\d{1,2}\s+/, '')
      .replace(/^\s*(two|three|four|five|six|seven|eight|nine|ten)\s+/i, '')
      .trim();
    if (script.hook_text) script.hook_text = strip(script.hook_text);
    if (script.title) script.title = strip(script.title);
    return { declared, assigned: 0, strippedClaim: true };
  }
  starts.forEach((sceneIdx, k) => { scenes[sceneIdx].list_index = k + 1; });
  return { declared, assigned: starts.length, strippedClaim: false };
}

/* ------------------------------------------------------------------ *
 * 3) CTA YERLEŞİMİ
 * ------------------------------------------------------------------ */

/**
 * CTA final açıklamayı kesiyor mu?
 *
 * Canlı hata: "But here's the real kicker" → SUBSCRIBE kartı → reveal.
 * İzleyici tam merak doruğundayken araya reklam giriyor.
 *
 * @param {object} input
 * @param {number|null} input.ctaStart CTA saniyesi
 * @param {number} input.duration
 * @param {number|null} input.revealStart final açıklamanın başladığı saniye
 */
export function assessCta({ ctaStart = null, ctaDuration = 0, duration = 0, revealStart = null } = {}) {
  if (ctaStart == null) return { present: false, interruptsReveal: false };
  const interruptsReveal = revealStart != null && ctaStart >= revealStart - 0.2
    && ctaStart <= duration;
  return {
    present: true,
    ctaStart,
    ctaDuration,
    revealStart,
    interruptsReveal,
    tooLong: ctaDuration > 0.9,
  };
}

/* ------------------------------------------------------------------ *
 * 4) TEKRAR
 * ------------------------------------------------------------------ */

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ')
  .replace(/\s+/g, ' ').trim();

/**
 * Anlatım/altyazı/kadraj tekrarları.
 * @param {object} input
 * @param {Array} input.narrations sahne anlatımları
 * @param {Array} input.captionStarts altyazı bloğu başlangıçları
 * @param {Array} input.scenePlans   sahne planı imzaları (şablon+aktör)
 * @param {Array} input.visualHashes algısal hash'ler
 */
export function detectRepetition({
  narrations = [], captionStarts = [], scenePlans = [], labels = [],
} = {}) {
  const dup = (arr) => {
    const seen = new Set(); const out = [];
    for (const v of arr) {
      const k = norm(v);
      if (!k) continue;
      if (seen.has(k)) out.push(k); else seen.add(k);
    }
    return out;
  };
  // Anlatımda TAM tekrar + aynı 4 kelimelik başlangıç.
  const duplicateNarrationSpans = dup(narrations);
  const openings = narrations.map((n) => norm(n).split(' ').slice(0, 4).join(' '))
    .filter((s) => s.split(' ').length >= 3);
  const duplicateNarrationOpenings = dup(openings);
  const duplicateCaptionStarts = dup(captionStarts);
  const repeatedScenePlans = dup(scenePlans);
  const repeatedLabels = dup(labels);

  const status = duplicateNarrationSpans.length || duplicateCaptionStarts.length
    ? 'fail' : 'pass';
  return {
    duplicateNarrationSpans,
    duplicateNarrationOpenings,
    duplicateCaptionStarts,
    repeatedScenePlans,
    repeatedLabels,
    status,
  };
}
