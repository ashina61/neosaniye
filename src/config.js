import dotenv from 'dotenv';

dotenv.config();

export const config = {
  gemini: {
    apiKey: process.env.GEMINI_API_KEY,
    // Ücretsiz tier, kart gerektirmez. Alternatif: gemini-2.5-flash-lite (daha ucuz/hızlı)
    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
  },
  niche: {
    language: process.env.CONTENT_LANGUAGE || 'en',
    theme:
      process.env.CONTENT_THEME ||
      'interesting facts, how it works, how to',
  },
  firebase: {
    // GitHub Secret'ta tek satır JSON string olarak tutulur.
    serviceAccountJson: process.env.FIREBASE_SERVICE_ACCOUNT,
    projectId: process.env.FIREBASE_PROJECT_ID,
  },
  tts: {
    // auto = önce edge-tts, başarısız olursa Piper. Zorlamak için: 'edge' | 'piper'
    engine: process.env.TTS_ENGINE || 'auto',

    // -- edge-tts (ana) -- Popüler, doğal erkek US sesi. Alternatifler:
    // en-US-BrianNeural, en-US-GuyNeural, en-US-ChristopherNeural, en-US-EricNeural
    voice: process.env.TTS_VOICE || 'en-US-AndrewNeural',
    rate: process.env.TTS_RATE || '+0%', // ör. "+10%" Shorts için biraz hızlı
    pitch: process.env.TTS_PITCH || '+0Hz',

    // -- Piper (çevrimdışı yedek) -- Doğal erkek ses. Alternatif: en_US-lessac-medium
    piperVoice: process.env.PIPER_VOICE || 'en_US-ryan-high',
    piperDataDir: process.env.PIPER_DATA_DIR || 'models/piper',

    // -- whisper (yalnızca Piper yolunda kelime zamanlaması için) --
    whisperModel: process.env.WHISPER_MODEL || 'base',
  },
  video: {
    // Altyazı fontu (repoya gömülü). Aile adı ttf ile eşleşmeli.
    fontName: process.env.VIDEO_FONT || 'Montserrat Black',
    fontsDir: process.env.VIDEO_FONTS_DIR || 'assets/fonts',
    // Kelime başına otomatik boyut: kısa kelime büyük, uzun kelime sığacak kadar küçülür.
    fontSizeMax: Number(process.env.VIDEO_FONT_SIZE || 130),
    fontSizeMin: Number(process.env.VIDEO_FONT_SIZE_MIN || 46),
    // Sol üst köşe logosu: bu dosya varsa görsel logo, yoksa yazı-logo kullanılır
    logoPath: process.env.LOGO_PATH || 'assets/logo.png',
    logoText: process.env.LOGO_TEXT || 'neosaniye',

    // Klipler arası geçiş efektleri (xfade). 0 = kapalı.
    transitionDuration: Number(process.env.VIDEO_TRANSITION || 0.4),
    transitions: (process.env.VIDEO_TRANSITIONS ||
      'fade,slideleft,wipeup,circleopen').split(','),

    // Vurucu kelime vurgusu (sayılar ve uzun kelimeler) rengi (ASS &HBBGGRR&). Sarı.
    accentColor: process.env.VIDEO_ACCENT || '&H00E6FF&',
    emphasis: process.env.VIDEO_EMPHASIS !== '0',

    // Kapanış kartı (outro): FOLLOW FOR MORE + ikonlar.
    outro: process.env.VIDEO_OUTRO !== '0',
    outroDuration: Number(process.env.VIDEO_OUTRO_SECONDS || 3),

    // Ses efektleri (geçiş whoosh + outro abone chime). Varsayılan açık.
    sfx: process.env.VIDEO_SFX !== '0',
    transitionSoundVolume: Number(process.env.VIDEO_TRANSITION_SOUND_VOL || 0.2),

    // Arka plan müziği (narrasyon altında 'ducking' ile kısılır).
    // assets/music/bed.mp3 varsa o kullanılır; yoksa yumuşak bir pad sentezlenir.
    music: process.env.VIDEO_MUSIC !== '0',
    musicPath: process.env.VIDEO_MUSIC_PATH || 'assets/music/bed.mp3',
    musicVolume: Number(process.env.VIDEO_MUSIC_VOL || 0.14),
  },
  pexels: {
    apiKey: process.env.PEXELS_API_KEY,
    perKeyword: Number(process.env.PEXELS_PER_KEYWORD || 1),
    orientation: process.env.PEXELS_ORIENTATION || 'portrait', // Shorts = 9:16
    preferType: process.env.PEXELS_PREFER_TYPE || 'video', // 'video' | 'photo'
    size: process.env.PEXELS_SIZE || 'medium',
  },
  youtube: {
    clientId: process.env.YOUTUBE_CLIENT_ID,
    clientSecret: process.env.YOUTUBE_CLIENT_SECRET,
    refreshToken: process.env.YOUTUBE_REFRESH_TOKEN,
    privacyStatus: process.env.YOUTUBE_PRIVACY || 'public', // public|unlisted|private
    categoryId: process.env.YOUTUBE_CATEGORY_ID || '27', // 27 = Education
  },
};

export function assertYouTube() {
  const { clientId, clientSecret, refreshToken } = config.youtube;
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      'YouTube OAuth eksik. YOUTUBE_CLIENT_ID / YOUTUBE_CLIENT_SECRET / ' +
        'YOUTUBE_REFRESH_TOKEN gerekli (bkz. docs/youtube-oauth-setup.md).',
    );
  }
}

export function assertPexels() {
  if (!config.pexels.apiKey) {
    throw new Error(
      'PEXELS_API_KEY tanımlı değil. .env dosyasına ekleyin (ücretsiz: pexels.com/api).',
    );
  }
}

export function assertGemini() {
  if (!config.gemini.apiKey) {
    throw new Error(
      'GEMINI_API_KEY tanımlı değil. .env dosyasına ekleyin (bkz. .env.example). ' +
        'Ücretsiz anahtar: https://aistudio.google.com/apikey',
    );
  }
}
