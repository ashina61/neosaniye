const punctuation = /^[,.;:!?)]$/u;

export function measureText(text, fontSize = 42) {
  let units = 0;
  for (const char of text) units += /[MWĞŞÖÜÇ]/u.test(char) ? 0.82 : /[ilıİ.,:;!']/u.test(char) ? 0.3 : 0.57;
  return units * fontSize;
}

export function layoutCaption(text, {maxWidth = 936, maxLines = 2, maxChars = 30} = {}) {
  const clean = String(text || '').trim().replace(/\s+/gu, ' ');
  if (!clean) throw new Error('Caption boş olamaz.');
  const tokens = clean.split(' ');
  const lines = [];
  let line = '';
  for (const token of tokens) {
    const candidate = line ? `${line} ${token}` : token;
    if (candidate.length <= maxChars && measureText(candidate) <= maxWidth) line = candidate;
    else {
      if (!line || measureText(token) > maxWidth) throw new Error(`Caption kelimesi safe-area genişliğini aşıyor: ${token}`);
      lines.push(line);
      line = token;
    }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) throw new Error(`Caption ${lines.length} satır gerektiriyor; maksimum ${maxLines}.`);
  return {lines, lineCount: lines.length, fontSize: 42, measuredWidth: Math.max(...lines.map((value) => measureText(value)))};
}

export function makeCaptions(beats, safeArea) {
  const captions = [];
  for (const beat of beats.beats) {
    const tokens = beat.narration.split(/\s+/u);
    for (let i = 0; i < tokens.length; i += 5) {
      let group = tokens.slice(i, i + 5).join(' ');
      if (punctuation.test(tokens[i + 5] || '')) group += tokens[i + 5];
      const layout = layoutCaption(group, {maxWidth: 1080-safeArea.left-safeArea.right, maxChars:safeArea.maxCharacters});
      const startFrame = beat.startFrame + Math.round((beat.durationInFrames * i) / tokens.length);
      const endFrame = beat.startFrame + Math.round((beat.durationInFrames * Math.min(tokens.length, i + 5)) / tokens.length);
      captions.push({id:`caption-${String(captions.length+1).padStart(3,'0')}`,startFrame,endFrame:Math.max(startFrame+1,endFrame),text:group,lines:layout.lines,kind:'narration-caption'});
    }
  }
  validateCaptions(captions);
  return captions;
}

export function validateCaptions(captions) {
  for (let i=0;i<captions.length;i++) {
    if (!captions[i].text.trim()) throw new Error('Caption boş olamaz.');
    if (captions[i].lines.length > 2) throw new Error('Caption iki satırı aşamaz.');
    if (captions[i].endFrame <= captions[i].startFrame) throw new Error('Caption zaman aralığı geçersiz.');
    if (i && captions[i].startFrame < captions[i-1].endFrame) throw new Error('Caption zamanları çakışıyor.');
  }
}
