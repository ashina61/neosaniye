const MOTIONS = ['slow-push-in', 'slow-pull-out', 'pan-left-to-right', 'pan-right-to-left', 'top-to-bottom-reveal', 'detail-zoom'];

export function selectSceneMotion(scene = {}, item = {}, { previous = [], index = 0 } = {}) {
  if (item.type === 'video') return { type: 'native-motion', maxZoom: 1, reason: 'live-footage' };
  const text = `${scene.image_prompt || ''} ${scene.narration || ''}`.toLowerCase();
  const textHeavy = item.source === 'gfx' || /\b(diagram|map|timeline|label|chart|text)\b/.test(text);
  if (textHeavy) return { type: 'static-hold', maxZoom: 1, reason: 'text-heavy-or-explanatory' };
  let type = scene.motion_type;
  if (!MOTIONS.includes(type)) {
    if (/\b(detail|macro|close-up|closeup|tiny|cell|mechanism)\b/.test(text)) type = 'detail-zoom';
    else if (/\b(tower|mountain|vertical|falls|descending|underground)\b/.test(text)) type = 'top-to-bottom-reveal';
    else if (/\b(wide|landscape|environment|panorama|map)\b/.test(text)) type = index % 2 ? 'pan-right-to-left' : 'pan-left-to-right';
    else type = index === 0 ? 'slow-push-in' : index % 3 === 0 ? 'slow-pull-out' : 'slow-push-in';
  }
  if (previous.at(-1) === type) type = type === 'slow-push-in' ? 'slow-pull-out' : 'slow-push-in';
  return { type, maxZoom: type === 'detail-zoom' ? 1.12 : 1.08, reason: scene.motion_type ? 'scene-metadata' : 'scene-content' };
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
