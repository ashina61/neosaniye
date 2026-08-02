/**
 * VİRAL ŞABLONLAR — kanıtlanmış kısa-video (Shorts/Reels/TikTok) kalıpları.
 *
 * Her şablon, script motoruna "bu videoyu hangi viral çatıya oturtalım?"
 * yönlendirmesi verir. FORMATS rotasyonunu (story / howworks / process ...)
 * EZMEZ; onun ÜSTÜNE hafif bir sunum/paketleme katmanı ekler. Böylece aynı
 * gerçek hikâye farklı viral ambalajlarla sunulabilir.
 *
 * Her şablon alanları:
 *  - key             : dahili anahtar (İngilizce, kod içi).
 *  - name            : kullanıcıya/loga görünen Türkçe ad.
 *  - hookTemplate    : hook için örnek kalıp (yer tutucularla).
 *  - exampleHook     : kalıbın somut örneği.
 *  - promptHint      : script promptuna eklenecek İngilizce yönlendirme
 *                      (model İngilizce yazıyor; anlatım dili ayrı ayarlanır).
 *  - retentionWeights: retentionQC kategori ağırlık ÇARPANLARI — bu kalıpta
 *                      hangi retention sinyali daha kritik (1.0 = nötr).
 *                      Kategoriler: hook, visualPacing, curiosity, captions,
 *                      visualVariety, audioDesign, payoffAndLoop.
 */

export const VIRAL_TEMPLATES = [
  {
    key: 'didnt_know',
    name: 'X şeyi bilmiyordun',
    hookTemplate: '{konu} hakkında bilmediğin {sayı} şey',
    exampleHook: '5 things about octopuses you never knew',
    promptHint:
      'Package the story as a "things you never knew about {subject}" reveal. The hook must promise ' +
      'a specific COUNT of surprising unknowns (e.g. "5 things about octopuses you never knew"). Each ' +
      'beat delivers ONE genuinely little-known true fact, escalating from mildly surprising to jaw-dropping. ' +
      'Keep the promised count honest and land the most shocking item last.',
    retentionWeights: { hook: 1.2, curiosity: 1.15, visualPacing: 1.1, visualVariety: 1.05, payoffAndLoop: 1.0 },
  },
  {
    key: 'science_explains',
    name: 'Bilim bunu açıklıyor',
    hookTemplate: '{olay} — bilim bunu şöyle açıklıyor',
    exampleHook: 'Why does this happen? Science finally explains',
    promptHint:
      'Package the story as "here is the strange phenomenon — and the SCIENCE that explains it". Open with a ' +
      'vivid, almost unbelievable observation, then reveal the real, well-documented mechanism step by step ' +
      '(cause → process → effect). At least one beat must state the actual working principle so it can be ' +
      'shown as a 2-4 step visual. End on the satisfying "so THAT\'s why" payoff.',
    retentionWeights: { hook: 1.1, curiosity: 1.2, visualPacing: 1.05, payoffAndLoop: 1.15, captions: 1.05 },
  },
  {
    key: 'versus',
    name: 'X vs Y',
    hookTemplate: '{X} vs {Y}: hangisi kazanır?',
    exampleHook: 'Lion vs Tiger: who actually wins?',
    promptHint:
      'Package the story as a head-to-head "{X} vs {Y}" comparison. The hook poses the matchup as a question ' +
      'the viewer instantly wants settled. Alternate beats between the two contenders, comparing them on ' +
      'concrete, surprising true metrics, building tension toward a clear, evidence-based verdict in the ' +
      'finale. Stay accurate — never fabricate the winner.',
    retentionWeights: { hook: 1.15, curiosity: 1.1, visualVariety: 1.2, visualPacing: 1.1, payoffAndLoop: 1.1 },
  },
  {
    key: 'hidden_truth',
    name: 'Gizli gerçek',
    hookTemplate: '{konu} hakkındaki gizli gerçek',
    exampleHook: 'The hidden truth about your morning coffee',
    promptHint:
      'Package the story as the "hidden truth nobody tells you about {subject}". The hook promises a concealed ' +
      'or counter-intuitive reality behind something familiar. Build with a curiosity gap: hint that the ' +
      'common belief is incomplete, reveal evidence piece by piece, then deliver the real, documented truth ' +
      'as the twist. Keep claims factual and hedge anything debated.',
    retentionWeights: { hook: 1.2, curiosity: 1.25, payoffAndLoop: 1.15, visualPacing: 1.0 },
  },
  {
    key: 'shock_stat',
    name: 'Şok istatistik',
    hookTemplate: 'Şok istatistik: {sayı}',
    exampleHook: '90% of people get this completely wrong',
    promptHint:
      'Package the story around a SHOCKING TRUE STATISTIC. The hook leads with the number itself (a jarring ' +
      'percentage, count, scale or comparison) in the first 3 seconds. Use the stat as a pattern interrupt, ' +
      'then unpack what it really means and why it is true, with each beat adding a supporting concrete number. ' +
      'Only use well-documented figures; hedge or drop any uncertain number.',
    retentionWeights: { hook: 1.3, curiosity: 1.1, visualPacing: 1.05, captions: 1.1, payoffAndLoop: 1.0 },
  },
];

/** Ağırlıklı rastgele viral şablon seçer (hepsi eşit ağırlıkta; sade tutuldu). */
export function pickViralTemplate(rand = Math.random()) {
  const i = Math.min(VIRAL_TEMPLATES.length - 1, Math.floor(rand * VIRAL_TEMPLATES.length));
  return VIRAL_TEMPLATES[i];
}

/** Anahtardan viral şablon bulur (FORCE_VIRAL_TEMPLATE testleri için). */
export function findViralTemplate(key) {
  const k = String(key || '').trim();
  if (!k) return null;
  return VIRAL_TEMPLATES.find((t) => t.key === k) || null;
}

/** Bir şablonun retention ağırlık çarpanını verir (yoksa 1.0 = nötr). */
export function viralWeight(template, category) {
  return template?.retentionWeights?.[category] ?? 1.0;
}
