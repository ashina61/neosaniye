const MOTIONS = ['slow-push-in', 'slow-pull-out', 'pan-left-to-right', 'pan-right-to-left', 'top-to-bottom-reveal', 'detail-zoom', 'slow-pan-up', 'slow-pan-down', 'zoom-to-detail'];

export function selectSceneMotion(scene = {}, item = {}, { previous = [], index = 0 } = {}) {
  if (item.type === 'video') return { type: 'native-motion', maxZoom: 1, reason: 'live-footage' };
  // HAREKET DİZİSİ kareleri SABİT durur: hareket ardışık karelerin arasındaki
  // sert kesmeden gelir. Üstüne bir de zoom binerse iki hareket çakışır ve
  // eylem okunmaz olur.
  if (item.sequence) return { type: 'static-hold', maxZoom: 1, reason: 'action-sequence-frame' };
  const text = `${scene.image_prompt || ''} ${scene.narration || ''}`.toLowerCase();
  const textHeavy = item.source === 'gfx' || /\b(diagram|map|timeline|label|chart|text)\b/.test(text);
  if (textHeavy) return { type: 'static-hold', maxZoom: 1, reason: 'text-heavy-or-explanatory' };

  // TEMPO alt-çekimi (punch-in): part1 gerçekten yakın kadraj → belirgin kesme.
  if (item.motionHint && MOTIONS.includes(item.motionHint)) {
    return { type: item.motionHint, maxZoom: item.motionHint === 'detail-zoom' ? 1.14 : 1.1, reason: 'sub-shot-framing' };
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
