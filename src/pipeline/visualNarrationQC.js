/**
 * GÖRSEL ANLATIM KALİTE KAPISI — "bu video slayt mı, anlatım mı?"
 *
 * Gerçek bir başarısızlığı yakalamak için yazıldı: 39 saniyelik bir video
 * 10-11 sahne içeriyordu ama tüm sahneler aynı seed + aynı prompt ile
 * üretildiği için TEK bir görselin üstünde zoom yapan slayta dönüşmüştü
 * (ffmpeg 0.05 eşiğinde bile sıfır sahne kesmesi buldu). Hiçbir mevcut kapı
 * bunu görmedi: kaynak sayısı, süre, ses, altyazı hepsi "geçti".
 *
 * Bu modül iki ayrı şeyi AYRI ölçer (kullanıcı şartı):
 *   DEKORATİF : kamera hareketi (zoom/pan) — güzellik, bilgi taşımaz
 *   SEMANTİK  : anlatımı ekranda gerçekleştiren kompozisyon — bilgi taşır
 * "Sessizde anlaşılır mı?" sorusunun cevabı SADECE semantik katmandır.
 */
import { hammingDistance } from '../media/imageHash.js';

/**
 * @param {object} input
 * @param {Array}  input.items      generateImages çıktısı (visualHash taşıyabilir)
 * @param {Array}  input.beats      semanticDirector beat listesi
 * @param {Array}  input.motionPlan selectSceneMotion sonuçları (dekoratif katman)
 * @param {number} input.duration   video süresi (sn)
 * @param {object} [input.thresholds]
 * @returns {object} rapor (skor + ihlaller + öneriler)
 */
export function assessVisualNarration({
  items = [],
  beats = [],
  motionPlan = [],
  duration = 0,
  scenes = [],               // V3: story_template / viewer_task taşır
  actorStats = null,         // V3: planActors çıktısı {actorScenes, cardScenes}
  thresholds = {},
} = {}) {
  const th = {
    minUniqueVisuals: 10,      // kullanıcı şartı: en az 10-12 benzersiz plan
    minSemanticBeats: 4,
    minHashDistance: 10,
    maxBlockSeconds: 3.0,      // her ~3sn'lik blok kendi kompozisyonunu almalı
    hookWindow: 3.0,
    // --- V3 SESSİZ ANLAŞILIRLIK EŞİKLERİ ---
    minMicroShots: 18,         // mikro plan merdiveni hedefi (20-25 bandı)
    minActorRatio: 0.60,       // aktörlü (durum değiştiren) sahne oranı
    maxDecorativeRatio: 0.25,  // sadece kamera hareketi olan sahne oranı
    minViewerTasks: 4,         // izleyiciye verilen görev sayısı
    ...thresholds,
  };
  const failures = [];
  const warnings = [];
  const fixes = [];

  // ---------- 1) BENZERSİZ GÖRSEL PLAN SAYISI ----------
  // Aynı görselin tekrar kullanılması = slayt. Algısal hash varsa gerçek
  // benzersizliği ölçeriz; yoksa varlık kimliğine (assetId) düşeriz.
  // HAREKET DİZİSİ kareleri hariç tutulur: onlar KASITLI olarak birbirine
  // benzer (aynı özne, değişen tek şey eylemin anı). Diziyi "kopya" saymak,
  // düzeltilmek istenen hatayı ödüllendirip doğru davranışı cezalandırırdı.
  const sequenceFrames = items.filter((it) => it?.sequence && it?.part > 0).length;
  // loopEcho: son plan KASITLI olarak ilk görseli tekrar eder (döngü kapanışı).
  // Onu "kopya" saymak, istenen davranışı cezalandırırdı.
  const loopEchoes = items.filter((it) => it?.loopEcho).length;
  const countable = items.filter((it) => !(it?.sequence && it?.part > 0) && !it?.loopEcho);
  const hashed = countable.filter((it) => it?.visualHash);
  let uniqueVisuals;
  let duplicatePairs = 0;
  if (hashed.length >= 2) {
    const kept = [];
    for (const it of hashed) {
      const h = BigInt(`0x${it.visualHash}`);
      const dup = kept.some((k) => hammingDistance(h, k) < th.minHashDistance);
      if (dup) duplicatePairs += 1;
      else kept.push(h);
    }
    // Hash'i olmayan varlıklar (stok/arşiv/gfx) kimlikleriyle sayılır.
    const others = new Set(countable.filter((it) => !it?.visualHash)
      .map((it) => it?.assetId || it?.sourceUrl || it?.path).filter(Boolean));
    uniqueVisuals = kept.length + others.size;
  } else {
    uniqueVisuals = new Set(countable.map((it) => it?.assetId || it?.sourceUrl || it?.path)
      .filter(Boolean)).size;
  }
  if (uniqueVisuals < th.minUniqueVisuals) {
    failures.push(`VISUAL_VARIETY_TOO_LOW: ${uniqueVisuals} benzersiz plan (hedef ≥${th.minUniqueVisuals})`);
    fixes.push('Aynı görsel tekrar ediyor: sahne başına farklı seed + farklı kadraj zorla (IMAGE_FIXED_SEED=1 açık olabilir).');
  }
  if (duplicatePairs > 0) {
    warnings.push(`${duplicatePairs} sahne algısal olarak önceki bir sahneyle neredeyse aynı`);
  }

  // ---------- 2) SEMANTİK ANLATIM (sessizde anlaşılırlık) ----------
  const kinds = beats.map((b) => b.kind);
  const kindCounts = kinds.reduce((a, k) => ({ ...a, [k]: (a[k] || 0) + 1 }), {});
  if (beats.length < th.minSemanticBeats) {
    failures.push(`SEMANTIC_NARRATION_TOO_THIN: ${beats.length} semantik kompozisyon (hedef ≥${th.minSemanticBeats})`);
    fixes.push('Anlatım cümlelerinde gösterilebilir yapı yok: süreç/karşılaştırma/sayı/konum içeren cümleler yazdır.');
  }
  const distinctKinds = new Set(kinds).size;
  if (beats.length >= th.minSemanticBeats && distinctKinds < 2) {
    warnings.push(`semantik kompozisyonların hepsi aynı tip (${kinds[0]}) — görsel monotonluk`);
  }

  // ---------- 3) İLK 3 SANİYEDE GÖRSEL OLAY ----------
  const hookBeat = beats.find((b) => b.start < th.hookWindow);
  if (!hookBeat) {
    warnings.push(`ilk ${th.hookWindow}sn'de semantik görsel olay yok — hook zayıf`);
    fixes.push('Hook cümlesini gösterilebilir yaz (bir süreç başlasın, bir sayı sayılsın, iki şey karşılaşsın).');
  }

  // ---------- 4) DEKORATİF-ONLY ORANI (zoom/pan'dan ibaret sahneler) ----------
  // Semantik kompozisyon almayan ve sadece kamera hareketi olan sahneler.
  const beatScenes = new Set(beats.map((b) => b.index));
  const decorativeOnly = motionPlan.filter((_, i) => !beatScenes.has(i)).length;
  const decorativeRatio = motionPlan.length
    ? +(decorativeOnly / motionPlan.length).toFixed(2) : 0;
  if (decorativeRatio > 0.7 && motionPlan.length >= 5) {
    warnings.push(`sahnelerin %${Math.round(decorativeRatio * 100)}'i yalnızca kamera hareketi (dekoratif)`);
  }

  // ---------- 5) BLOK BAŞINA KOMPOZİSYON ----------
  // ~3sn'lik her anlatım bloğu kendi görsel kompozisyonunu almalı.
  const expectedBlocks = duration > 0 ? Math.floor(duration / th.maxBlockSeconds) : 0;
  const compositionsPerBlock = expectedBlocks
    ? +(uniqueVisuals / expectedBlocks).toFixed(2) : null;
  if (expectedBlocks && uniqueVisuals < expectedBlocks * 0.8) {
    warnings.push(`${duration}sn için ${uniqueVisuals} plan — ~${expectedBlocks} blok beklenirken plan başına ${(duration / Math.max(1, uniqueVisuals)).toFixed(1)}sn düşüyor`);
  }

  // ---------- 6) V3: SESSİZ ANLAŞILIRLIK ----------
  // Audit'in yeni başarı kriteri: "Ses tamamen kapalıyken bile izleyici
  // videonun ne anlattığını anlayabiliyor mu?" Bunun ölçüsü efekt SAYISI
  // değil, ekranda GERÇEKLEŞEN olayın oranıdır.
  const microShots = items.length;
  if (microShots && microShots < th.minMicroShots) {
    warnings.push(`${microShots} mikro plan — hedef ≥${th.minMicroShots} (aynı görselden farklı kadraj alınabilir)`);
  }

  // Aktörlü sahne oranı: kadrajın İÇİNDE durum değiştiren eleman taşıyan
  // sahneler. Kart/panel bu sayıya girmez (onlar kadrajın üstünde durur).
  //
  // PAYDA SAHNE SAYISIDIR, KLİP SAYISI DEĞİL. Faz 4'ün mikro plan merdiveni
  // bir sahneyi 2-3 klibe bölüyor; aktörler ise sahne başına bir kez
  // planlanıyor. Klibe bölmek oranı yapay olarak üçte birine düşürüp her
  // videoda yanlış uyarı üretiyordu.
  const distinctScenes = new Set(
    items.map((it) => it?.scene).filter((n) => Number.isFinite(n)),
  ).size;
  const actorDenom = distinctScenes || scenes.length || motionPlan.length;
  let actorRatio = null;
  if (actorStats && actorDenom) {
    actorRatio = +(actorStats.actorScenes / actorDenom).toFixed(2);
    if (actorRatio < th.minActorRatio) {
      warnings.push(`aktörlü sahne oranı %${Math.round(actorRatio * 100)} — hedef ≥%${Math.round(th.minActorRatio * 100)}`);
      fixes.push('Sahneler kart yerine aktör alsın: anlatımda hareket/süreç/sayım geçen cümleler yazdır.');
    }
  }

  // İzleyiciye verilen görev sayısı (storyPlanner'ın viewer_task alanı).
  const viewerTasks = scenes.filter((s) => s?.viewer_task).length;
  if (scenes.length && viewerTasks < th.minViewerTasks) {
    warnings.push(`${viewerTasks} sahnede izleyici görevi var — hedef ≥${th.minViewerTasks}`);
  }

  // Hikâye şablonu dağılımı: hepsi 'atmosphere' ise video hikâye anlatmıyor.
  const templates = scenes.map((s) => s?.story_template).filter(Boolean);
  const atmosphereOnly = templates.filter((t) => t === 'atmosphere').length;
  if (templates.length >= 5 && atmosphereOnly / templates.length > 0.6) {
    failures.push(`STORY_TEMPLATES_TOO_THIN: sahnelerin %${Math.round((atmosphereOnly / templates.length) * 100)}'i hikâyesiz (atmosphere)`);
    fixes.push('Anlatım cümleleri gösterilebilir yapı taşımıyor: süreç/karşılaştırma/sayı/hareket içeren cümleler yazdır.');
  }

  const passed = failures.length === 0;
  return {
    passed,
    failures,
    warnings,
    fixes,
    metrics: {
      uniqueVisuals,
      duplicatePairs,
      // Eylemi gösteren ek kareler (benzersizlik sayımının DIŞINDA).
      sequenceFrames,
      loopEchoes,
      semanticBeats: beats.length,
      semanticKinds: kindCounts,
      distinctKinds,
      hookEvent: Boolean(hookBeat),
      hookEventKind: hookBeat?.kind || null,
      decorativeOnlyScenes: decorativeOnly,
      decorativeRatio,
      expectedBlocks,
      compositionsPerBlock,
      // --- V3 sessiz anlaşılırlık ---
      microShots,
      actorRatio,
      actorScenes: actorStats?.actorScenes ?? null,
      actorDenom,
      viewerTasks,
      storyTemplates: templates.reduce((a, t) => ({ ...a, [t]: (a[t] || 0) + 1 }), {}),
      atmosphereOnly,
    },
  };
}
