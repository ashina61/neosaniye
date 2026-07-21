const TOKEN_RE = /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu;

function tokens(text) {
  return String(text || '').match(TOKEN_RE) || [];
}

function validWords(wordTimings = []) {
  return wordTimings
    .map((w) => ({ word: String(w?.word || '').trim(), start: Number(w?.start), end: Number(w?.end) }))
    .filter((w) => w.word && Number.isFinite(w.start) && Number.isFinite(w.end) && w.start >= 0 && w.end > w.start)
    .sort((a, b) => a.start - b.start);
}

function allocateFallback(scenes, duration) {
  const weights = scenes.map((s) => Math.max(1, tokens(s.narration).length));
  const sum = weights.reduce((a, b) => a + b, 0) || 1;
  let cursor = 0;
  return scenes.map((scene, index) => {
    const end = index === scenes.length - 1 ? duration : cursor + (duration * weights[index]) / sum;
    const rec = { scene: index, start: cursor, end, duration: end - cursor, source: 'estimated', narration: scene.narration || '' };
    cursor = end;
    return rec;
  });
}

/**
 * One timing authority for scenes, captions, cuts, motion and cue placement.
 * Observed TTS timings win. Word-count allocation is an explicit fallback only.
 */
export function buildCanonicalTimeline({ scenes = [], segmentTexts = null, wordTimings = [], duration = 0, timingSource = 'unknown' } = {}) {
  if (!scenes.length) throw new Error('CANONICAL_TIMELINE_SCENES_MISSING');
  const words = validWords(wordTimings);
  const measuredDuration = Math.max(Number(duration) || 0, words.at(-1)?.end || 0);
  if (!(measuredDuration > 0)) throw new Error('CANONICAL_TIMELINE_DURATION_MISSING');

  let sceneTimings;
  const expectedCounts = scenes.map((s, i) => tokens(segmentTexts?.[i] ?? s.narration).length);
  const expectedTotal = expectedCounts.reduce((a, b) => a + b, 0);
  const usedObserved = words.length >= expectedTotal * 0.7 && expectedTotal > 0;
  if (usedObserved) {
    let offset = 0;
    let priorEnd = 0;
    sceneTimings = scenes.map((scene, index) => {
      const count = expectedCounts[index];
      const slice = words.slice(offset, offset + count);
      const start = index === 0 ? 0 : (slice[0]?.start ?? priorEnd);
      const rawEnd = slice.at(-1)?.end ?? start;
      const nextStart = words[offset + count]?.start;
      const end = index === scenes.length - 1
        ? measuredDuration
        : Math.max(start, Number.isFinite(nextStart) ? nextStart : rawEnd);
      offset += count;
      priorEnd = end;
      return { scene: index, start, end, duration: end - start, source: timingSource, narration: scene.narration || '' };
    });
  } else {
    sceneTimings = allocateFallback(scenes, measuredDuration);
  }

  // Make boundaries contiguous and monotonic; the final scene owns the tail.
  sceneTimings[0].start = 0;
  for (let i = 1; i < sceneTimings.length; i += 1) {
    sceneTimings[i].start = sceneTimings[i - 1].end;
    sceneTimings[i].duration = sceneTimings[i].end - sceneTimings[i].start;
  }
  sceneTimings.at(-1).end = measuredDuration;
  sceneTimings.at(-1).duration = measuredDuration - sceneTimings.at(-1).start;

  const boundaries = sceneTimings.slice(0, -1).map((s) => s.end);
  const captions = words.map((w) => ({ ...w, end: Math.min(w.end, measuredDuration) })).filter((w) => w.start < measuredDuration);
  const issues = validateCanonicalTimeline({ duration: measuredDuration, scenes: sceneTimings, captions });
  return {
    version: 1,
    source: usedObserved ? timingSource : 'estimated-word-count-fallback',
    duration: measuredDuration,
    words: captions,
    captions,
    scenes: sceneTimings,
    boundaries,
    fallbackUsed: !usedObserved,
    issues,
  };
}

export function expandTimelineForMedia(timeline, mediaItems = []) {
  const byScene = new Map();
  mediaItems.forEach((item, index) => {
    const scene = Number.isInteger(item.scene) ? item.scene : index;
    if (!byScene.has(scene)) byScene.set(scene, []);
    byScene.get(scene).push(index);
  });
  const items = [];
  for (const scene of timeline.scenes) {
    const indices = byScene.get(scene.scene) || [];
    if (!indices.length) continue;
    const span = scene.duration / indices.length;
    indices.forEach((mediaIndex, part) => {
      const start = scene.start + span * part;
      const end = part === indices.length - 1 ? scene.end : scene.start + span * (part + 1);
      items.push({ mediaIndex, scene: scene.scene, start, end, duration: end - start, source: scene.source });
    });
  }
  return { ...timeline, items, itemBoundaries: items.slice(0, -1).map((x) => x.end) };
}

export function validateCanonicalTimeline(timeline) {
  const issues = [];
  const duration = Number(timeline?.duration) || 0;
  const scenes = timeline?.scenes || [];
  if (!scenes.length) issues.push('TIMELINE_SCENES_MISSING');
  scenes.forEach((s, i) => {
    if (s.start < 0 || s.end <= s.start || s.duration <= 0) issues.push(`TIMELINE_INVALID_SCENE:${i}`);
    if (i && Math.abs(s.start - scenes[i - 1].end) > 0.01) issues.push(`TIMELINE_SCENE_GAP_OR_OVERLAP:${i}`);
  });
  if (scenes.length && Math.abs(scenes.at(-1).end - duration) > 0.02) issues.push('TIMELINE_FINAL_SCENE_INCOMPLETE');
  for (const [i, c] of (timeline?.captions || []).entries()) {
    if (c.start < 0 || c.end <= c.start || c.end > duration + 0.02) issues.push(`TIMELINE_CAPTION_OUT_OF_RANGE:${i}`);
  }
  return issues;
}
