/**
 * SEMANTİK OTOMATİK DÜZELTME — "QC cellat değil editördür."
 *
 * ================== NEDEN VAR ==================
 * Eski davranış: semantik eylem ortalaması düşükse yayın engellenir. Sonuç,
 * hiç yayın olmamasıydı; sistem hiç öğrenmiyordu. Yeni davranış: QC sorunu
 * BULDUĞUNDA cron'u durdurmaz, RENDER'DAN ÖNCE düzeltmeye çalışır.
 *
 * Düzeltme turu şunu yapar ve yalnızca şunu:
 *   1. Skoru düşüren sahneleri bulur (atmosphere kalmış ya da aktörsüz).
 *   2. Anlatımdan gerçek bir eylem sinyali çıkarabiliyorsa şablonu yükseltir.
 *   3. Şablonun kompozisyon kısıtını image_prompt'un BAŞINA ekler ki üretici
 *      "güzel manzara" değil, anlatılan olayı barındıran bir kadraj üretsin.
 *
 * ================== SINIRLAR ==================
 * • EN FAZLA BİR TUR. İkinci tur, birincinin ürettiği planı yeniden yorumlayıp
 *   sonsuz kendini onarma denemesine dönüşürdü; kazanç yok, süre çok.
 * • ANLATIMDA GERÇEKTEN EYLEM YOKSA DOKUNULMAZ. "Silence." cümlesine filtreleme
 *   şablonu atamak skoru yükseltir ama videoyu YALAN hâle getirir: ekranda
 *   anlatılmayan bir olay gösterilir. Skoru kurtarmak için uydurma yapılmaz.
 * • Düzeltme başarısız olabilir ve bu bir arıza DEĞİLDİR: `repaired:false` +
 *   `qualityDegraded:true` ile mevcut güvenli plan yayınlanmaya devam eder.
 */

import { activeTemplateFor, actionDensity, STORY_TEMPLATE_SPECS } from '../crew/storyPlanner.js';

/** Bu eşiğin altında düzeltme turu tetiklenir. */
export const REPAIR_TRIGGER_AVERAGE = 0.60;

/**
 * Tek turluk semantik düzeltme.
 *
 * Sahneleri YERİNDE değiştirir (planVisualStory ile aynı sözleşme) ve ne
 * yaptığını döndürür. Çağıran, dönen `changedScenes` boş değilse render planını
 * yeniden kurmalıdır.
 *
 * @param {object} script  {scenes:[{narration, image_prompt, story_template…}]}
 * @param {object} semanticActions assessSemanticActions çıktısı
 * @param {object} [opts]
 * @param {number} [opts.triggerAverage]
 * @returns {{attempted:boolean, repaired:boolean, qualityDegraded:boolean,
 *            before:number, changedScenes:Array, skipped:Array, reason:string}}
 */
export function repairSemanticActions(script = {}, semanticActions = null, opts = {}) {
  const { triggerAverage = REPAIR_TRIGGER_AVERAGE } = opts;
  const scenes = script.scenes || [];
  const before = Number.isFinite(semanticActions?.average) ? semanticActions.average : null;

  if (before == null) {
    return { attempted: false, repaired: false, qualityDegraded: false, before,
      changedScenes: [], skipped: [], reason: 'semantik ölçüm yok — düzeltilecek şey bilinmiyor' };
  }
  if (before >= triggerAverage) {
    return { attempted: false, repaired: false, qualityDegraded: false, before,
      changedScenes: [], skipped: [], reason: `ortalama ${before} ≥ ${triggerAverage} — düzeltme gereksiz` };
  }

  const changedScenes = [];
  const skipped = [];
  const perScene = semanticActions.perScene || [];

  scenes.forEach((scene, i) => {
    const score = perScene[i]?.completionScore ?? 0;
    // Zaten iyi puan alan sahneye dokunulmaz: çalışanı bozma.
    if (score >= triggerAverage) return;

    const narration = scene.narration || '';
    const forced = activeTemplateFor(narration);
    if (!forced) {
      // GERÇEKTEN sakin cümle. Skoru yükseltmek için şablon uydurulmaz.
      skipped.push({ scene: i, reason: 'anlatımda eylem sinyali yok', density: actionDensity(narration) });
      return;
    }
    if (scene.story_template === forced) {
      // Şablon doğru ama puan düşük: sorun sınıflandırmada değil, render
      // katmanında (aktör üretilememiş). Bu tur onu çözemez, dürüstçe söyler.
      skipped.push({ scene: i, reason: `şablon zaten ${forced} — eksik olan aktör/odak ölçümü` });
      return;
    }

    const spec = STORY_TEMPLATE_SPECS[forced];
    if (!spec) { skipped.push({ scene: i, reason: `bilinmeyen şablon ${forced}` }); return; }

    const from = scene.story_template || null;
    scene.story_template = forced;
    scene.viewer_task = spec.viewerTask;
    scene.camera_plan = spec.camera;
    scene.story_beat = { kind: 'story', payload: {}, template: forced };
    // KOMPOZİSYON ŞART: şablon adını değiştirip prompt'a dokunmamak hiçbir şey
    // çözmez, üretici yine aynı kadrajı üretir.
    if (spec.composition && scene.image_prompt) {
      scene.image_prompt = `${spec.composition}. ${scene.image_prompt}`;
    }
    changedScenes.push({ scene: i, from, to: forced });
  });

  const repaired = changedScenes.length > 0;
  return {
    attempted: true,
    repaired,
    // Düzeltme yapılamadıysa video YİNE yayınlanır — ama raporda dürüstçe
    // "kalitesi düşük" işaretiyle.
    qualityDegraded: !repaired,
    before,
    changedScenes,
    skipped,
    reason: repaired
      ? `${changedScenes.length} sahne aktif şablona yükseltildi`
      : 'düzeltilebilir sahne bulunamadı — mevcut plan korunuyor (quality_degraded)',
  };
}
