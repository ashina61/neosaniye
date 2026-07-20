/**
 * GERÇEK ÇIKTI KAPILARI (HARD GATE) — warning-mod override BUNU AŞAMAZ.
 *
 * retention/preflight mod politikaları "hazır olmasa bile yayınla" diyebilir
 * (policyOverride). Bu kapı ondan BAĞIMSIZDIR: aşağıdaki ihlaller final MP4'ün
 * kendisinden ölçülür ve tespit edilirse upload HER MODDA durur, productionReady
 * false olur. Amaç: rapor "başarılı" derken kusurlu videonun yayınlanmasını
 * (bee-honeycomb regresyonu) imkânsız kılmak.
 *
 * Sert ihlaller:
 *   - İngilizce içerikte Türkçe (yanlış dil) CTA
 *   - Final videoda doğrulanamayan SFX (miks yok / duyulmaz / ölçüm hatası)
 *   - CTA SFX duyulmaz
 *   - Müzik daima aynı fallback (havuz tükendi + sessiz fallback)
 *   - Kanal metadata gerçeği yanlış (ffprobe ile çelişki)
 *   - CTA altyazı/UI çakışması
 *   - CTA güvenli kenar payı dışında
 *   - Metadata ile MP4 arasında kritik çelişki
 */

/**
 * @param {object} o {
 *   sfxVerification: {ok, failures[]} | null,   (verifySfxInOutput sonucu)
 *   ctaVerification: {ok, failures[]} | null,   (verifyCtaOutput sonucu)
 *   ctaApplied: boolean,
 *   ctaLanguageMatch: boolean | null,           (motion raporu)
 *   music: {repeatedFallback, poolExhausted, silentFallback} | null,
 *   channelTruth: {expectedChannels, actualChannels, layoutExpected, layoutActual} | null,
 * }
 * @returns {{block:boolean, failures:string[], reasons:string[]}}
 */
export function evaluateHardGate(o = {}) {
  const failures = [];
  const reasons = [];

  // --- CTA dil kapısı (İngilizce içerikte Türkçe CTA = kesin blok) ---
  if (o.ctaApplied && o.ctaLanguageMatch === false) {
    failures.push('CTA_WRONG_LANGUAGE');
    reasons.push('CTA yanlış dilde (İngilizce içerikte yerel olmayan etiket) — tüm platformlarda upload engellendi.');
  }

  // --- CTA yerleşim/katman doğrulaması ---
  if (o.ctaApplied && o.ctaVerification && !o.ctaVerification.ok) {
    for (const f of o.ctaVerification.failures || []) {
      if (!failures.includes(f)) failures.push(f);
    }
    reasons.push(`CTA çıktı doğrulaması başarısız: ${(o.ctaVerification.failures || []).join(', ')}.`);
  }

  // --- SFX gerçek-çıktı doğrulaması ---
  if (o.sfxVerification && !o.sfxVerification.ok) {
    for (const f of o.sfxVerification.failures || []) {
      if (!failures.includes(f)) failures.push(f);
    }
    reasons.push(`SFX final videoda doğrulanamadı: ${(o.sfxVerification.failures || []).join(', ')}.`);
  }

  // --- Müzik daima aynı fallback (çeşitlilik çökmesi) ---
  if (o.music) {
    if (o.music.silentFallback) {
      failures.push('MUSIC_SILENT_FALLBACK');
      reasons.push('Müzik sessiz/aynı fallback ile dolduruldu — yayınlanmaz.');
    } else if (o.music.poolExhausted && o.music.repeatedFallback) {
      failures.push('MUSIC_POOL_EXHAUSTED');
      reasons.push('Müzik havuzu tükendi ve aynı parça tekrar seçildi — çeşitlilik kapısı.');
    }
  }

  // --- Kanal metadata gerçeği (ffprobe ile ölçülen ile beklenen çelişkisi) ---
  if (o.channelTruth) {
    const { expectedChannels, actualChannels } = o.channelTruth;
    if (expectedChannels != null && actualChannels != null && expectedChannels !== actualChannels) {
      failures.push('CHANNEL_METADATA_MISMATCH');
      reasons.push(`Kanal sayısı çelişkisi: beklenen ${expectedChannels}, ölçülen ${actualChannels} (ffprobe gerçeği).`);
    }
  }

  return { block: failures.length > 0, failures, reasons };
}
