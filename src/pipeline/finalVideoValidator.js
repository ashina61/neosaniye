/**
 * FINAL VIDEO VALIDATOR — tek gerçek kaynak ÇIKAN MP4'tür.
 *
 * ================== NEDEN VAR ==================
 * Bugüne kadar bütün QC katmanları PLANI okuyordu: scene plan, render plan,
 * timeline JSON. Plan doğru olabiliyor, çıkan video yanlış olabiliyordu ve
 * hiçbir rapor bunu göremiyordu. Somut kanıt (26 Tem, kolibri koşusu):
 *
 *   - production report "CTA uygulanmadı" diyordu; videoda 40.0-42.6s arasında
 *     bir SUBSCRIBE pili vardı. Rapor yalan söylemiyordu — YANLIŞ KATMANA
 *     bakıyordu. `motion.cta` gerçekten çalışmamıştı; pili renderVideo'nun
 *     bambaşka bir kod yolu çizdi ve o yol hiçbir rapora kendini bildirmiyordu.
 *   - retention 92/100 ile "production-ready" yazarken altında yayın engelleri
 *     listeleniyordu.
 *
 * ================== YÖNTEM (kör eşik YOK) ==================
 * Bindirme tespiti, mutlak renk/parlaklık eşiğiyle YAPILMAZ. Denetim sırasında
 * bunu deneyip başarısız olduk: hook bandındaki "parlak piksel sayısı" ölçütü,
 * kolibrinin BEYAZ GÖĞÜS TÜYLERİNİ hook yazısı sandı (11.5s ve 34.8s'te sahte
 * pozitif). Kırmızı+beyaz arayan CTA ölçütü kırmızı çiçeği pil sandı.
 *
 * Çalışan yöntem YAPISAL ve KENDİNE GÖNDERMELİ:
 *   1. Bindirmenin PLANLANDIĞI pencereden bir referans kare alınır.
 *   2. O bindirmenin bölgesi için 64-bit dHash hesaplanır (kenar deseni —
 *      yazı ile tüy taban tabana farklı desen üretir).
 *   3. Videonun tamamı bu referansa hamming mesafesiyle taranır.
 * Ölçülen ayırt ediciliği (gerçek video): hook referansına mesafe t=1.0s'te 0,
 * sahte pozitiflerde 78 ve 64. CTA referansına mesafe pil anında 13, başka
 * yerlerde 48-78. Eşik 12 ile ikisi de temiz ayrışıyor.
 *
 * ================== İKİ AYRI SORU ==================
 * Piksel taraması "planlanan dışında TEKRAR var mı?" sorusunu cevaplar.
 * Referansı olmayan, hiç bildirilmemiş bir bindirmeyi piksel sihriyle bulmak
 * güvenilir değildir; onun için ikinci ve deterministik bir kontrol var:
 * BİLDİRİM TAMLIĞI (renderVideo eklediği her katmanı declaredOverlays'e
 * yazmalı). Pilin raporlarda hiç görünmemesinin sebebi buydu.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';

const run = promisify(execFile);

/** Bölge tanımları — normalize (0..1) kırpma pencereleri. */
export const REGIONS = {
  // Hook kartı: \pos y=384, fs~104 → y 300..500 bandı.
  hook: { x: 0, y: 0.156, w: 1, h: 0.104 },
  // Video içi abone pili / CTA: kadrajın üst şeridi (canlıda y~150-230).
  cta: { x: 0, y: 0.062, w: 1, h: 0.083 },
  // Liste numarası: sol üst güvenli alan.
  listMarker: { x: 0, y: 0.22, w: 0.22, h: 0.07 },
  // Altyazı bandı.
  caption: { x: 0, y: 0.80, w: 1, h: 0.14 },
};

const HASH_W = 17;
const HASH_H = 9;

/** İki 64-bit hash arası hamming mesafesi. */
export function hamming(a, b) {
  let x = a ^ b;
  let c = 0;
  while (x) { c += Number(x & 1n); x >>= 1n; }
  return c;
}

function dhashFromGray(px, w = HASH_W, h = HASH_H) {
  let bits = 0n;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w - 1; x += 1) {
      bits = (bits << 1n) | (px[y * w + x] < px[y * w + x + 1] ? 1n : 0n);
    }
  }
  return bits;
}

/** Videodan fps hızında, verilen bölgenin dHash dizisi. */
async function regionHashes(videoPath, region, fps) {
  const crop = region
    ? `crop=iw*${region.w}:ih*${region.h}:iw*${region.x}:ih*${region.y},`
    : '';
  const { stdout } = await run('ffmpeg', ['-v', 'error', '-i', videoPath,
    '-vf', `fps=${fps},${crop}scale=${HASH_W}:${HASH_H}`,
    '-pix_fmt', 'gray', '-f', 'rawvideo', '-'],
  { encoding: 'buffer', maxBuffer: 1 << 28 });
  const per = HASH_W * HASH_H;
  const out = [];
  for (let o = 0; o + per <= stdout.length; o += per) {
    out.push(dhashFromGray(stdout.subarray(o, o + per)));
  }
  return out;
}

/** Ortalama parlaklık dizisi (koyu gfx kartını kendi kendine kalibre eder). */
async function meanLuma(videoPath, fps) {
  const { stdout } = await run('ffmpeg', ['-v', 'error', '-i', videoPath,
    '-vf', `fps=${fps},scale=16:28`, '-pix_fmt', 'gray', '-f', 'rawvideo', '-'],
  { encoding: 'buffer', maxBuffer: 1 << 26 });
  const per = 16 * 28;
  const out = [];
  for (let o = 0; o + per <= stdout.length; o += per) {
    let s = 0;
    for (let k = 0; k < per; k += 1) s += stdout[o + k];
    out.push(+(s / per / 255).toFixed(4));
  }
  return out;
}

/** SHA-256 — run integrity zinciri için. */
export function sha256File(file) {
  return new Promise((resolve, reject) => {
    const h = createHash('sha256');
    createReadStream(file).on('error', reject).on('data', (d) => h.update(d))
      .on('end', () => resolve(h.digest('hex')));
  });
}

/** Ardışık indeks aralıklarını [start,end] listesine çevir. */
function toRuns(indices) {
  const out = [];
  let s = null; let p = null;
  for (const i of indices) {
    if (s === null) { s = i; p = i; continue; }
    if (i === p + 1) { p = i; continue; }
    out.push([s, p]); s = i; p = i;
  }
  if (s !== null) out.push([s, p]);
  return out;
}

/**
 * Bir bindirmenin GERÇEK görünme aralıkları.
 *
 * @param {Array<bigint>} hashes bölge hash dizisi
 * @param {Array<[number,number]>} plannedWindows saniye cinsinden planlanan pencereler
 * @param {number} fps
 * @param {number} threshold hamming eşiği
 */
export function findOccurrences(hashes, plannedWindows, fps, threshold = 12) {
  if (!plannedWindows?.length) return { planned: [], unplanned: [], reference: null };
  // Referans: ilk planlanan pencerenin ORTASI (giriş animasyonu bitmiş olur).
  const [ps, pe] = plannedWindows[0];
  const refIdx = Math.min(hashes.length - 1, Math.round(((ps + pe) / 2) * fps));
  const ref = hashes[refIdx];
  if (ref === undefined) return { planned: [], unplanned: [], reference: null };

  const inPlanned = (i) => plannedWindows.some(([a, b]) => {
    const t = i / fps;
    return t >= a - 0.5 && t <= b + 0.5;
  });

  const hits = [];
  for (let i = 0; i < hashes.length; i += 1) {
    if (hamming(hashes[i], ref) <= threshold) hits.push(i);
  }
  const runs = toRuns(hits).map(([a, b]) => ({
    start: +(a / fps).toFixed(2), end: +((b + 1) / fps).toFixed(2),
    planned: inPlanned(a) || inPlanned(b),
  }));
  return {
    planned: runs.filter((r) => r.planned),
    unplanned: runs.filter((r) => !r.planned),
    reference: { atSeconds: +(refIdx / fps).toFixed(2), threshold },
  };
}

/**
 * FINAL MP4 DOĞRULAMASI.
 *
 * @param {string} videoPath
 * @param {object} plan
 * @param {number} plan.duration
 * @param {Array}  plan.clips  [{id, scene, sequence, renderOrder, start, end, assetId}]
 * @param {Array}  plan.hookWindows    [[s,e]]
 * @param {Array}  plan.diagramWindows [[s,e]]
 * @param {Array}  plan.ctaWindows     [[s,e]]
 * @param {Array}  plan.loopEchoWindows KASITLI tekrar (döngü kapanışı) — muaf
 * @param {Array}  plan.declaredOverlays renderVideo'nun BİLDİRDİĞİ katmanlar
 * @param {object} [opts]
 * @returns {Promise<object>} rapor
 */
export async function validateFinalVideo(videoPath, plan = {}, opts = {}) {
  const {
    fps = 2,
    shotDuplicateThreshold = 6,
    // TEKRAR SAYILMASI İÇİN ASGARİ BOŞLUK. 2fps'te ardışık örnekler 0.5s
    // arayla gelir; sıkıştırma gürültüsü tek bir kareyi eşiğin dışına itince
    // aynı klip iki bloğa ayrılıyor ve "0.5s sonra tekrar etti" gibi görünüyordu
    // (canlıda 07-motion.mp4 üzerinde üç sahte kopya böyle çıktı). Gerçek tekrar,
    // araya BAŞKA planlar girdikten sonra olur.
    minDuplicateGapSeconds = 2.0,
    staticStreakLimitSeconds = 5.0,
    overlayThreshold = 12,
  } = opts;

  const failures = [];
  const warnings = [];

  const analyzedVideoHash = await sha256File(videoPath).catch(() => null);

  // ---- ffprobe: gerçek süre ----
  let durationSeconds = null;
  try {
    const { stdout } = await run('ffprobe', ['-v', 'error', '-show_entries',
      'format=duration', '-of', 'csv=p=0', videoPath]);
    durationSeconds = +Number(String(stdout).trim()).toFixed(3);
  } catch { /* süre okunamadı */ }

  // Okunamayan/bozuk dosya "doğrulandı" sayılmaz: hata yutulup boş dizi
  // döndürülürse aşağıdaki kontrollerin hepsi sessizce geçer.
  const [frameHashes, luma, hookH, ctaH, capH] = await Promise.all([
    regionHashes(videoPath, null, fps),
    meanLuma(videoPath, fps),
    regionHashes(videoPath, REGIONS.hook, fps),
    regionHashes(videoPath, REGIONS.cta, fps),
    regionHashes(videoPath, REGIONS.caption, fps),
  ]).catch(() => [[], [], [], [], []]);
  const sampledFrames = frameHashes.length;
  if (!sampledFrames) {
    return {
      ok: false, analyzedVideoHash, durationSeconds, sampledFrames: 0,
      failures: ['FINAL_VIDEO_UNREADABLE'], warnings: [],
    };
  }

  // ---- 1) TEKRAR EDEN PLAN (shot) ----
  // KRİTİK KURAL: ardışık benzer kareler AYNI klibin kendisidir, kusur değil.
  // Kusur, bir görüntünün ARADAN SONRA yeniden belirmesidir. İlk denemede bu
  // ayrım yapılmadığı için 14 "kopya grubu" bulunmuştu; hepsi normal klipti.
  const loopWindows = plan.loopEchoWindows || [];
  const inLoop = (t) => loopWindows.some(([a, b]) => t >= a - 0.6 && t <= b + 0.6);

  // İMZA = dHash + ORTALAMA PARLAKLIK.
  // dHash tek başına DÜZ renk alanlarında kör: gradyan olmadığı için kırmızı,
  // yeşil ve mavi tam kare hepsi 0n hash'i verir ve birbirinin kopyası sanılır.
  // (Sentetik testte tam bu tuzağa düşüldü.) Parlaklık ikinci boyut olarak
  // eklenince düz alanlar da ayrışır.
  const sameFrame = (i, j) => hamming(frameHashes[i], frameHashes[j]) <= shotDuplicateThreshold
    && Math.abs((luma[i] ?? 0) - (luma[j] ?? 0)) <= 0.03;
  const groups = [];
  for (let i = 0; i < sampledFrames; i += 1) {
    const t = i / fps;
    const g = groups.find((gr) => sameFrame(gr.index, i));
    if (g) g.times.push(t); else groups.push({ index: i, hash: frameHashes[i], times: [t] });
  }
  const duplicateFrameGroups = [];
  const duplicateShots = [];
  for (const g of groups) {
    const runs = toRuns(g.times.map((t) => Math.round(t * fps)))
      .map(([a, b]) => [+(a / fps).toFixed(2), +((b + 1) / fps).toFixed(2)]);
    if (runs.length < 2) continue;               // tek blok = tek klip
    duplicateFrameGroups.push({ runs, frames: g.times.length });
    // Kasıtlı döngü kapanışı muaf: ilk blok başta, ikinci blok loop penceresinde.
    const nonLoop = runs.filter(([a]) => !inLoop(a));
    if (nonLoop.length >= 2) {
      const gap = +(nonLoop[1][0] - nonLoop[0][1]).toFixed(2);
      if (gap >= minDuplicateGapSeconds) duplicateShots.push({ runs: nonLoop, gapSeconds: gap });
    }
  }
  if (duplicateShots.length) {
    failures.push(`DUPLICATE_SHOT:${duplicateShots.length} ` +
      `(${duplicateShots.slice(0, 3).map((d) => d.runs.map((r) => r.join('-')).join(' ↔ ')).join(' | ')})`);
  }

  // ---- 2) BİNDİRMELER: planlanan dışında görünüyor mu? ----
  const hookOcc = findOccurrences(hookH, plan.hookWindows, fps, overlayThreshold);
  const ctaOcc = findOccurrences(ctaH, plan.ctaWindows, fps, overlayThreshold);
  // Diyagram: koyu gfx kartı, videonun KENDİ parlaklık dağılımına göre.
  const sorted = [...luma].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] || 0.3;
  const darkIdx = [];
  for (let i = 0; i < luma.length; i += 1) if (luma[i] < median * 0.45) darkIdx.push(i);
  const diagramRuns = toRuns(darkIdx).map(([a, b]) => ({
    start: +(a / fps).toFixed(2), end: +((b + 1) / fps).toFixed(2),
    planned: (plan.diagramWindows || []).some(([s, e]) => (a / fps) >= s - 0.6 && (b / fps) <= e + 0.6),
  }));

  const duplicateHooks = Math.max(0, hookOcc.planned.length + hookOcc.unplanned.length - 1);
  const duplicateCTA = Math.max(0, ctaOcc.planned.length + ctaOcc.unplanned.length - 1);
  const duplicateDiagrams = Math.max(0, diagramRuns.length - (plan.diagramWindows || []).length);

  if (hookOcc.unplanned.length) {
    failures.push(`HOOK_OUTSIDE_PLAN:${hookOcc.unplanned.map((r) => `${r.start}-${r.end}s`).join(',')}`);
  }
  if (ctaOcc.unplanned.length) {
    failures.push(`CTA_OUTSIDE_PLAN:${ctaOcc.unplanned.map((r) => `${r.start}-${r.end}s`).join(',')}`);
  }
  const unplannedDiagrams = diagramRuns.filter((r) => !r.planned);
  if (unplannedDiagrams.length) {
    failures.push(`DIAGRAM_OUTSIDE_PLAN:${unplannedDiagrams.map((r) => `${r.start}-${r.end}s`).join(',')}`);
  }

  // ---- 3) BİLDİRİM TAMLIĞI ----
  // Piksel taraması, referansı olmayan bir bindirmeyi bulamaz. Bu yüzden
  // render katmanı çizdiği HER şeyi bildirmek zorundadır. Kolibri koşusunda
  // abone pili hiçbir rapora kendini bildirmemişti.
  const declared = new Set(plan.declaredOverlays || []);
  const observed = [];
  if (hookOcc.planned.length || hookOcc.unplanned.length) observed.push('hook');
  if (ctaOcc.planned.length || ctaOcc.unplanned.length) observed.push('cta');
  if (diagramRuns.length) observed.push('diagram');
  const undeclared = observed.filter((o) => !declared.has(o));
  if (undeclared.length) {
    failures.push(`UNDECLARED_OVERLAY:${undeclared.join(',')}`);
  }

  // ---- 4) UZUN DURAĞAN AKIŞ ----
  let longestStaticStreakSeconds = 0;
  let streak = 1;
  for (let i = 1; i < sampledFrames; i += 1) {
    if (hamming(frameHashes[i], frameHashes[i - 1]) <= 2
        && Math.abs((luma[i] ?? 0) - (luma[i - 1] ?? 0)) <= 0.01) streak += 1;
    else { longestStaticStreakSeconds = Math.max(longestStaticStreakSeconds, streak / fps); streak = 1; }
  }
  longestStaticStreakSeconds = +Math.max(longestStaticStreakSeconds, streak / fps).toFixed(2);
  if (longestStaticStreakSeconds > staticStreakLimitSeconds) {
    warnings.push(`LONG_STATIC_STREAK:${longestStaticStreakSeconds}s`);
  }

  // ---- 5) ALTYAZI SIRASI ----
  // Aynı altyazı bloğu ARADAN SONRA tekrar belirmemeli.
  const capGroups = [];
  for (let i = 0; i < capH.length; i += 1) {
    const g = capGroups.find((gr) => hamming(gr.hash, capH[i]) <= 4);
    if (g) g.times.push(i / fps); else capGroups.push({ hash: capH[i], times: [i / fps] });
  }
  const duplicateCaptions = capGroups.filter((g) => {
    const runs = toRuns(g.times.map((t) => Math.round(t * fps)));
    return runs.length >= 2 && g.times.length >= 3;
  }).length;

  // ---- 6) TIMELINE BÜTÜNLÜĞÜ (plan tarafı, MP4 süresiyle çapraz kontrol) ----
  const timelineIntegrity = verifyTimelineOrder(plan.clips || []);
  if (!timelineIntegrity.valid) {
    failures.push(`TIMELINE_ORDER_INVALID:${timelineIntegrity.problems.slice(0, 3).join(',')}`);
  }
  if (durationSeconds != null && plan.duration != null
      && Math.abs(durationSeconds - plan.duration) > 0.5) {
    failures.push(`DURATION_MISMATCH: plan ${plan.duration}s / mp4 ${durationSeconds}s`);
  }

  return {
    ok: failures.length === 0,
    analyzedVideoHash,
    durationSeconds,
    sampledFrames,
    fps,
    duplicateFrameGroups,
    duplicateShots,
    duplicateHooks,
    duplicateDiagrams,
    duplicateCTA,
    duplicateCaptions,
    hookOccurrences: [...hookOcc.planned, ...hookOcc.unplanned],
    ctaOccurrences: [...ctaOcc.planned, ...ctaOcc.unplanned],
    diagramOccurrences: diagramRuns,
    undeclaredOverlays: undeclared,
    observedOverlays: observed,
    longestStaticStreakSeconds,
    sceneOrderValid: timelineIntegrity.valid,
    timelineIntegrity,
    failures,
    warnings,
  };
}

/**
 * TIMELINE SIRASI — monoton artmalı ve sahne/klip sırası bozulmamalı.
 * scene_03_clip_02, scene_04_clip_00'dan ÖNCE gelmeli.
 */
export function verifyTimelineOrder(clips = []) {
  const problems = [];
  let prevEnd = -Infinity;
  let prevKey = null;
  clips.forEach((c, i) => {
    if (!c?.id) problems.push(`MISSING_ID:${i}`);
    if (!Number.isFinite(c?.start) || !Number.isFinite(c?.end)) {
      problems.push(`MISSING_TIME:${c?.id || i}`);
      return;
    }
    if (c.end <= c.start) problems.push(`NON_POSITIVE_SPAN:${c.id || i}`);
    if (c.start < prevEnd - 0.02) problems.push(`OVERLAP:${c.id || i}`);
    prevEnd = c.end;
    // Sahne+dizi sırası sözlüksel olarak artmalı.
    const key = [Number(c.scene ?? 0), Number(c.sequence ?? 0)];
    if (prevKey && (key[0] < prevKey[0] || (key[0] === prevKey[0] && key[1] < prevKey[1]))) {
      problems.push(`OUT_OF_ORDER:${c.id || i}`);
    }
    prevKey = key;
    if (Number.isFinite(c.renderOrder) && c.renderOrder !== i) {
      problems.push(`RENDER_ORDER_MISMATCH:${c.id || i}`);
    }
  });
  const ids = clips.map((c) => c?.id).filter(Boolean);
  if (new Set(ids).size !== ids.length) problems.push('DUPLICATE_CLIP_ID');
  return { valid: problems.length === 0, clipCount: clips.length, problems };
}
