const SHORTS_MIN_SECONDS = 15;
const SHORTS_MAX_SECONDS = 65;

function usableCaptionWords(words = []) {
  return words.filter((w) =>
    String(w?.word || '').trim() && Number.isFinite(w?.start) && Number.isFinite(w?.end) && w.end > w.start,
  );
}

function hasRightsEvidence(asset) {
  return Boolean(
    asset &&
    String(asset.license || '').trim() &&
    String(asset.licenseEvidence || asset.sourceUrl || '').trim(),
  );
}

/**
 * Emergency fail-closed checks using only data already present in the pipeline.
 * This does not inspect pixels or claim semantic visual understanding.
 */
export function evaluateEmergencyQualityGate({
  script = {}, wordTimings = [], mediaItems = [], music = null, ambience = null,
  technical = {}, duration = 0, p0Contradictions = [], musicRequired = false,
} = {}) {
  const failures = [];
  const reasons = [];
  const add = (code, reason) => {
    if (!failures.includes(code)) failures.push(code);
    if (!reasons.includes(reason)) reasons.push(reason);
  };

  const captions = usableCaptionWords(wordTimings);
  const captionChars = captions.reduce((n, w) => n + String(w.word).trim().length, 0);
  if (captions.length < 3 || captionChars < 6) {
    add('CAPTIONS_MISSING_OR_EMPTY', 'Altyazı zamanlaması yok veya etkili biçimde boş.');
  }

  const hook = String(script.hook_text || '').trim();
  const firstNarration = String(script.scenes?.[0]?.narration || '').trim();
  const firstVisual = mediaItems.find((item) => Number(item?.scene) === 0) || mediaItems[0];
  const firstWord = captions[0];
  if (!hook || !firstNarration || !firstVisual?.path || !firstVisual?.source || !firstWord || firstWord.start > 1) {
    add(
      'OPENING_ALIGNMENT_DATA_MISSING',
      'Hook metni, ilk anlatım, ilk görsel ve ilk konuşma zamanını birlikte doğrulayacak veri eksik.',
    );
  }

  if (technical.videoStreamPresent !== true) add('VIDEO_STREAM_MISSING', 'Final çıktıda video akışı doğrulanmadı.');
  if (technical.audioStreamPresent !== true) add('AUDIO_STREAM_MISSING', 'Final çıktıda ses akışı doğrulanmadı.');
  const seconds = Number(duration || technical.durationSeconds || 0);
  if (seconds < SHORTS_MIN_SECONDS || seconds > SHORTS_MAX_SECONDS) {
    add('SHORTS_DURATION_OUT_OF_RANGE', `Final süre ${seconds}s; kabul edilen aralık ${SHORTS_MIN_SECONDS}-${SHORTS_MAX_SECONDS}s.`);
  }

  for (let i = 0; i < mediaItems.length; i += 1) {
    const asset = mediaItems[i];
    if (!hasRightsEvidence(asset)) {
      add(
        `ASSET_RIGHTS_EVIDENCE_MISSING:${i}`,
        `Görsel asset #${i + 1} (${asset?.source || 'unknown'}) için lisans/provenance kanıtı eksik.`,
      );
    }
  }
  if (musicRequired && !hasRightsEvidence(music)) {
    add('MUSIC_RIGHTS_EVIDENCE_MISSING', 'Seçilen/prosedürel müzik için lisans kanıtı eksik.');
  }
  if (ambience && !hasRightsEvidence(ambience)) {
    add('AMBIENCE_RIGHTS_EVIDENCE_MISSING', 'Ambiyans için lisans/provenance kanıtı eksik.');
  }

  if (script.duplicate === true) add('DUPLICATE_SCRIPT', 'Script üreticisi içeriği duplicate olarak işaretledi.');
  const explicit = [
    ...(Array.isArray(p0Contradictions) ? p0Contradictions : []),
    ...(Array.isArray(script.p0_contradictions) ? script.p0_contradictions : []),
    ...(Array.isArray(script.production_failures)
      ? script.production_failures.filter((x) => String(x?.severity || '').toUpperCase() === 'P0')
      : []),
  ];
  for (const contradiction of explicit) {
    const text = typeof contradiction === 'string'
      ? contradiction
      : contradiction?.reason || contradiction?.message || contradiction?.code;
    add('P0_CONTRADICTION', `Açık P0 olgusal/görsel çelişki: ${text || 'ayrıntı yok'}`);
  }

  return { ok: failures.length === 0, block: failures.length > 0, failures, reasons };
}
