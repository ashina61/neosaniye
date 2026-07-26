const MOTIONS = ['slow-push-in', 'slow-pull-out', 'pan-left-to-right', 'pan-right-to-left', 'top-to-bottom-reveal', 'detail-zoom', 'slow-pan-up', 'slow-pan-down', 'zoom-to-detail'];

/**
 * KAMERA DİLİ — her hikâye şablonunun kendi hareketi (V3 Faz 3).
 *
 * storyPlanner'ın verdiği camera_plan.motivation, kameranın NEDEN hareket
 * ettiğini söyler. Kritik olan yarısı: bazı şablonlarda kamera BİLİNÇLİ
 * OLARAK DURUR. Okunması gereken bir şey varken (adım zinciri, iki tarafın
 * karşılaştırılması, kalabalıkta hedef arama) kamera hareketi okumayla
 * yarışır ve izleyici ikisini de kaçırır.
 */
const CAMERA_BY_MOTIVATION = {
  // Mekanizmanın İÇİNE gir — kesitte akışı takip etmek yakınlaşmaktır.
  'follow-the-flow': { type: 'slow-push-in', maxZoom: 1.08 },
  // Özneyi takip et — yatay hareket izin yönünü destekler (yön indekse göre
  // dönüşümlü, aynı şablon tekrarlandığında kamera monotonlaşmasın).
  'follow-the-subject': { type: 'pan-left-to-right', maxZoom: 1.05, alternate: 'pan-right-to-left' },
  // Boyutu ortaya çıkar — geri çekilmek büyüklüğü hissettirir.
  'pull-back-to-reveal-size': { type: 'slow-pull-out', maxZoom: 1.12 },
  'reveal-the-amount': { type: 'slow-pull-out', maxZoom: 1.10 },
  // İnşayı takip et — yukarı doğru yükselen kadraj.
  'rise-with-the-build': { type: 'slow-pan-up', maxZoom: 1.07 },
  // Yere yakınlaş.
  'zoom-to-place': { type: 'detail-zoom', maxZoom: 1.12 },
  // Tara, sonra kilitlen — hafif içeri girme "buldum" hissi verir.
  'scan-then-lock': { type: 'slow-push-in', maxZoom: 1.09 },
  // Sinyali izle — kaynaktan alıcıya doğru yatay kayma.
  'trace-the-signal': { type: 'pan-left-to-right', maxZoom: 1.05, alternate: 'pan-right-to-left' },
  // Tetikte sıkı, sonuçta geniş — sebebin sonucu doğurduğunu kadraj söyler.
  'tight-then-wide': { type: 'slow-pull-out', maxZoom: 1.12 },
  'tight-then-open': { type: 'slow-pull-out', maxZoom: 1.10 },
  // Yayılım büyüdükçe kadraj da genişler.
  'widen-with-the-spread': { type: 'slow-pull-out', maxZoom: 1.12 },
  // Rotayı takip et.
  'follow-the-route': { type: 'pan-left-to-right', maxZoom: 1.06, alternate: 'pan-right-to-left' },
  // --- KAMERANIN DURDUĞU DURUMLAR (okuma > hareket) ---
  'hold-both-sides': { type: 'static-hold', maxZoom: 1 },   // karşılaştırma
  'step-to-step': { type: 'static-hold', maxZoom: 1 },      // adım zinciri
  // Zaman ekseni okunacak: imleç zaten hareket ediyor, kamera de kaymasın.
  'hold-the-timeline': { type: 'static-hold', maxZoom: 1 },
  'let-it-breathe': { type: 'slow-push-in', maxZoom: 1.05 }, // sakin, çok hafif
};

export function selectSceneMotion(scene = {}, item = {}, { previous = [], index = 0 } = {}) {
  if (item.type === 'video') return { type: 'native-motion', maxZoom: 1, reason: 'live-footage' };
  // HAREKET DİZİSİ kareleri SABİT durur: hareket ardışık karelerin arasındaki
  // sert kesmeden gelir. Üstüne bir de zoom binerse iki hareket çakışır ve
  // eylem okunmaz olur.
  if (item.sequence) return { type: 'static-hold', maxZoom: 1, reason: 'action-sequence-frame' };
  // LOOP KARESİ: son plan ilk görsele döner. Kareler GERÇEKTEN eşleşsin diye
  // hareket YOK (zoom 1) — ilk klip de zoom 1'den başlar. Aynı görseli koyup
  // üstüne zoom uygulamak, ilk kareyle son kareyi yine farklı gösteriyordu
  // (26 Tem: "yine loop yok").
  if (item.loopEcho) return { type: 'static-hold', maxZoom: 1, reason: 'loop-closure' };
  const text = `${scene.image_prompt || ''} ${scene.narration || ''}`.toLowerCase();
  const textHeavy = item.source === 'gfx' || /\b(diagram|map|timeline|label|chart|text)\b/.test(text);
  if (textHeavy) return { type: 'static-hold', maxZoom: 1, reason: 'text-heavy-or-explanatory' };

  // TEMPO alt-çekimi (punch-in): part1 gerçekten yakın kadraj → belirgin kesme.
  if (item.motionHint && MOTIONS.includes(item.motionHint)) {
    return { type: item.motionHint, maxZoom: item.motionHint === 'detail-zoom' ? 1.14 : 1.1, reason: 'sub-shot-framing' };
  }

  // KAMERANIN GEREKÇESİ (V3 Faz 3). Audit: "kamera hareket ediyor ama
  // hareketin amacı yok — hareket olsun diye hareket." Artık hikâye planı
  // varsa kamera ONDAN türer: ne anlatıldığına göre hareket eder ya da
  // BİLİNÇLİ OLARAK DURUR. Discovery/BBC farkı tam olarak budur.
  const motivated = CAMERA_BY_MOTIVATION[scene.camera_plan?.motivation];
  if (motivated) {
    // Aynı şablon arka arkaya gelirse yönü çevir (gerekçe korunur, monotonluk kırılır).
    let type = motivated.alternate && index % 2 === 1 ? motivated.alternate : motivated.type;
    // LOOP KAPANIŞI hikâye gerekçesinden ÖNCE gelir: ilk klip zoom 1'den
    // başlamak ZORUNDA, yoksa son karedeki sabit görselle dikiş tutmaz
    // (kullanıcı iki kez "loop yok" dedi). Geriye çekilme yalnızca burada
    // içeri girmeye çevrilir; gerekçe kaydı korunur.
    if (index === 0 && type === 'slow-pull-out') type = 'slow-push-in';
    return {
      type,
      maxZoom: type === 'slow-push-in' && motivated.type === 'slow-pull-out' ? 1.08 : motivated.maxZoom,
      reason: `story:${scene.camera_plan.motivation}`,
    };
  }

  let type = scene.motion_type;
  if (!MOTIONS.includes(type)) {
    // Sahne icäerigine göre aklılı cekim seçimi
    if (/\b(detail|macro|close-up|closeup|tiny|cell|mechanism)\b/.test(text)) type = 'detail-zoom';
    else if (/\b(tower|mountain|vertical|falls|descending|underground)\b/.test(text)) type = 'top-to-bottom-reveal';
    else if (/\b(wide|landscape|environment|panorama|map)\b/.test(text)) type = index % 2 ? 'pan-right-to-left' : 'pan-left-to-right';
    else if (/\b(sky|space|stars|galaxy|cosmic|upward|rising)\b/.test(text)) type = 'slow-pan-up';
    else if (/\b(deep|ocean|digging|below|underwater|sinking)\b/.test(text)) type = 'slow-pan-down';
    else if (index === 0) type = 'slow-push-in';  // Hook sahnesi için push-in
    else if (index % 4 === 1) type = 'slow-pull-out';
    else if (index % 4 === 2) type = 'pan-left-to-right';
    else if (index % 4 === 3) type = 'zoom-to-detail';
    else type = 'slow-push-in';
  }

  // İLK KLİP zoom 1'den BAŞLAMALI: loop karesi zoom 1'de sabit duruyor, ilk
  // klip yakın kadrajdan başlarsa dikiş tutmaz. renderVideo'da zoom'u YÜKSEKTEN
  // başlayan TEK hareket 'slow-pull-out' (pull); detail-zoom dahil diğerleri
  // zaten 1'den başlayıp içeri girer, onlara dokunma.
  if (index === 0 && type === 'slow-pull-out') type = 'slow-push-in';

  // Anti-tekrar: son 2 hareketi tekrar etme, açıkça devam et.
  const recent2 = previous.slice(-2);
  if (recent2.includes(type)) {
    const alts = MOTIONS.filter(m => !recent2.includes(m));
    if (alts.length) {
      // Belli bir seçim yap: önce sahne içerigine uygun alternatif
      const preferred = alts.find(m => 
        (m === 'detail-zoom' && /\b(detail|macro|close)\b/.test(text)) ||
        (m === 'top-to-bottom-reveal' && /\b(tower|mountain|vertical)\b/.test(text))
      );
      type = preferred || alts[0];
    }
  }

  return { type, maxZoom: type === 'detail-zoom' ? 1.12 : type === 'zoom-to-detail' ? 1.14 : 1.08, reason: scene.motion_type ? 'scene-metadata' : 'scene-content' };
}

export function validateMotionPlan(plan = [], durations = []) {
  const issues = [];
  plan.forEach((m, i) => {
    if (Number(m.maxZoom) > 1.14) issues.push(`MOTION_EXCESSIVE_ZOOM:${i}`);
    if (m.duration != null && Math.abs(m.duration - durations[i]) > 0.02) issues.push(`MOTION_DURATION_MISMATCH:${i}`);
    if (m.textHeavy && !['static-hold', 'native-motion'].includes(m.type)) issues.push(`TEXT_HEAVY_AGGRESSIVE_MOTION:${i}`);
    if (i >= 2 && plan[i - 1]?.type === m.type && plan[i - 2]?.type === m.type) issues.push(`MOTION_PATTERN_REPEATED:${i}`);
  });
  return issues;
}
