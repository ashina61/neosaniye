const ABBREVIATIONS = new Map([
  ['km', 'kilometers'], ['kg', 'kilograms'], ['cm', 'centimeters'],
  ['Dr.', 'Doctor'], ['Mr.', 'Mister'], ['vs.', 'versus'],
]);

export function prepareNarrationForTts(text, { language = 'en' } = {}) {
  let out = String(text || '').replace(/\s+/g, ' ').trim();
  if (!out) return out;
  for (const [from, to] of ABBREVIATIONS) {
    out = out.replace(new RegExp(`\\b${from.replace('.', '\\.')}\\b`, 'gi'), to);
  }
  out = out.replace(/(\d{4})\s*[-–]\s*(\d{4})/g, '$1 to $2');
  out = out.replace(/([.!?])\s+(But|Yet|Then|Instead|However|Actually|Finally)\b/g, '$1 … $2');
  out = out.replace(/\s*([—–])\s*/g, ', ');
  if (!/[.!?]$/.test(out)) out += '.';
  // Turkish narration keeps native characters; no ASCII transliteration.
  return language === 'tr' ? out.replace(/\bve saire\b/gi, 'vesaire') : out;
}

export function validateNarrationPhrasing(text) {
  const sentences = String(text || '').split(/(?<=[.!?])\s+/).filter(Boolean);
  const issues = [];
  sentences.forEach((sentence, i) => {
    const count = sentence.trim().split(/\s+/).filter(Boolean).length;
    if (count > 22) issues.push(`TTS_SENTENCE_TOO_LONG:${i}`);
    if (!/[,.!?;:…]/.test(sentence)) issues.push(`TTS_SENTENCE_NO_PUNCTUATION:${i}`);
  });
  return issues;
}
