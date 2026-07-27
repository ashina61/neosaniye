/**
 * Remotion-only mimaride CTA ayrı bir FFmpeg post-pass'i değildir.
 *
 * Orkestratörün eski çağrı sözleşmesi geçiş süresince korunur; fonksiyon final
 * videoyu değiştirmeden geri döner. CTA yeniden kullanılacaksa Remotion
 * `ProductionSpec` içinde sahne/overlay olarak tanımlanmalıdır.
 */
export async function applyCta({videoPath, language = process.env.CONTENT_LANGUAGE || 'en'} = {}) {
  return {
    videoPath,
    report: {
      enabled: false,
      ctaRequested: false,
      ctaApplied: false,
      ctaId: null,
      ctaType: null,
      startSec: null,
      durationSec: null,
      position: null,
      selectionReason: 'owned-by-remotion',
      safeAreaPassed: true,
      sfxId: null,
      resolvedLanguage: language,
      label: null,
      languageMatch: true,
      warnings: [],
      failures: [],
      ctaVerification: null,
    },
  };
}
