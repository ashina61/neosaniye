/**
 * Reklam-dostu (para kazanma) dil güvenlik ağı.
 *
 * YouTube 2026: BAŞLIK + küçük resim + ilk saniyelerdeki açık şiddet/ölüm/uyuşturucu
 * kelimeleri reklamı "sınırlı" (sarı $) yapar. Gövdede (eğitim bağlamı) genelde sorun
 * değil. Bu yüzden yumuşatma YALNIZCA başlık ve hook'a uygulanır — anlatım/altyazı
 * doğruluğu korunur. Asıl iş prompt'ta yapılır; bu, kaçanları yakalayan yedektir.
 */

// Anlamı büyük ölçüde koruyan, başlık/hook için güvenli takaslar.
const SOFTEN = {
  killed: 'wiped out',
  kills: 'wipes out',
  killing: 'wiping out',
  kill: 'wipe out',
  slaughtered: 'wiped out',
  slaughter: 'massacre-free', // nadiren geçer; genelde WARN listesine düşer
  suicide: 'tragic end',
  suicidal: 'deeply troubled',
};
// slaughter için kötü takas olmasın: haritadan çıkar, WARN'a bırak.
delete SOFTEN.slaughter;

// Değiştirilmez ama loglanır (elle gözden geçirmek için) — çoğu özel isimde de
// geçebildiğinden otomatik takas riskli (Dead Sea, Killer Whale vb.).
const WARN = [
  'murder', 'murdered', 'blood', 'bloody', 'gun', 'guns', 'shooting', 'shot',
  'rape', 'terror', 'terrorist', 'nazi', 'corpse', 'corpses', 'execute',
  'executed', 'execution', 'drug', 'drugs', 'dead', 'death',
];

/** Orijinal kelimenin büyük/küçük harf desenini yeni kelimeye taşır. */
function matchCase(orig, repl) {
  if (orig === orig.toUpperCase()) return repl.toUpperCase();
  if (orig[0] === orig[0].toUpperCase()) return repl[0].toUpperCase() + repl.slice(1);
  return repl;
}

/**
 * Başlık/hook gibi YÜKSEK riskli yüzeyleri reklam-dostu hale getirir.
 * @param {string} text
 * @param {string} [label] - log için etiket ('başlık' | 'hook')
 * @returns {string}
 */
export function softenAdText(text, label = 'metin') {
  if (!text) return text;
  let out = String(text);

  for (const [bad, good] of Object.entries(SOFTEN)) {
    const re = new RegExp(`\\b${bad}\\b`, 'gi');
    if (re.test(out)) {
      out = out.replace(re, (m) => matchCase(m, good));
      console.warn(`[adsafe] ${label}: "${bad}" -> "${good}" (reklam-dostu)`);
    }
  }

  const hits = WARN.filter((w) => new RegExp(`\\b${w}\\b`, 'i').test(out));
  if (hits.length) {
    console.warn(`[adsafe] ${label}: riskli kelime(ler) var (elle gözden geçir): ${hits.join(', ')}`);
  }
  return out;
}
