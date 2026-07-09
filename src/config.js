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
    // Genel konsept: tarih + bilim + doğa + uzay + gizem karışık "şaşırtıcı
    // gerçek hikâyeler". Anlatı (storytelling) formatı.
    theme:
      process.env.CONTENT_THEME ||
      'surprising true stories and mind-blowing facts from history, science, space, nature, and mystery',
  },
  images: {
    // AI görsel üretimi. Kapatmak için IMAGES_ENABLED=0 (Pexels'e düşer).
    enabled: process.env.IMAGES_ENABLED !== '0',
    // Sağlayıcı: 'pollinations' (ÜCRETSİZ, key yok, FLUX tabanlı, konuya bağlı görsel)
    //           'gemini' (gemini-2.5-flash-image; genelde ücretli/kotalı)
    //           'none' (doğrudan Pexels)
    provider: process.env.IMAGE_PROVIDER || 'pollinations',
    // Pollinations modeli: 'flux' (kaliteli) | 'turbo' (hızlı).
    pollinationsModel: process.env.POLLINATIONS_MODEL || 'flux',
    // Gemini görsel modeli (provider=gemini iken).
    model: process.env.IMAGE_MODEL || 'gemini-2.5-flash-image',
    // Üretilen görsel çözünürlüğü (9:16). Tam 1080x1920 = büyütme yok, net.
    width: Number(process.env.IMAGE_WIDTH || 1080),
    height: Number(process.env.IMAGE_HEIGHT || 1920),
    // Her sahne promptuna eklenen ortak sinematik stil (tutarlı "look").
    styleSuffix:
      process.env.IMAGE_STYLE ||
      'cinematic documentary photograph, shot on 35mm film, natural realistic ' +
        'textures and skin, dramatic practical lighting, subject clearly lit with ' +
        'bright key light, warm filmic color grade, shallow depth of field, ' +
        'subtle motion blur, imperfect natural framing, vertical composition, ' +
        'no text, no watermark, no subtitles',
    retries: Number(process.env.IMAGE_RETRIES || 2),
    timeoutMs: Number(process.env.IMAGE_TIMEOUT_MS || 90000),
    // Görsel üretimi başarısızsa Pexels'ten stok görsele düş.
    pexelsFallback: process.env.IMAGE_PEXELS_FALLBACK !== '0',
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
    rate: process.env.TTS_RATE || '+8%', // Shorts retention için biraz hızlı tempo
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
    // Tam logo (outro'da büyük, ortada). Bu dosya varsa görsel, yoksa yazı-logo.
    logoPath: process.env.LOGO_PATH || 'assets/logo.png',
    // Köşe filigranı için kompakt monogram (varsa). Yoksa logoPath'e düşer.
    logoMarkPath: process.env.LOGO_MARK_PATH || 'assets/logo-mark.png',
    logoText: process.env.LOGO_TEXT || 'neosaniye',

    // Klipler arası geçişler (xfade). Pro kurgu: sade ve kısa — gösterişli
    // wipe'lar (radial/circleopen vb.) şablon/AI hissi verdiği için çıkarıldı.
    transitionDuration: Number(process.env.VIDEO_TRANSITION || 0.35),
    transitions: (process.env.VIDEO_TRANSITIONS ||
      'fade,slideleft,zoomin,slideup,smoothleft,fade,slideright,wipeup')
      .split(','),

    // Film greni: AI görsellerin "fazla temiz" parlaklığını kırar (0 = kapalı).
    grain: process.env.VIDEO_GRAIN !== '0',
    // Anlatım bittikten sonra son sahnenin nefes payı (müzik burada söner).
    tailSeconds: Number(process.env.VIDEO_TAIL_SECONDS || 0.9),

    // Altyazı stili: 'caption' = sinematik alt kısa ifade (ekranı kaplamaz),
    // 'word' = tek kelime punchy, 'pop' = eski büyük karaoke. Shorts için 'caption'.
    captionStyle: process.env.VIDEO_CAPTION_STYLE || 'caption',
    // Grup üst sınırı; asıl bölme konuşmadaki doğal duraklara göre yapılır.
    captionWordsPerLine: Number(process.env.VIDEO_CAPTION_WORDS || 3),
    captionSize: Number(process.env.VIDEO_CAPTION_SIZE || 46),
    // Alt bölge (ekranı kaplamasın): küçük marginV = daha aşağı. Shorts UI üstünde kalır.
    captionMarginV: Number(process.env.VIDEO_CAPTION_MARGIN || 300),

    // Vurucu kelime vurgusu (sayılar ve uzun kelimeler) rengi (ASS &HBBGGRR&). Sarı.
    accentColor: process.env.VIDEO_ACCENT || '&H00E6FF&',
    emphasis: process.env.VIDEO_EMPHASIS !== '0',

    // Kapanış kartı (outro): Shorts'ta loop'u kırdığı için VARSAYILAN KAPALI.
    // Açmak için VIDEO_OUTRO=1. Yerine video-içi abone uyarısı kullanılır.
    outro: process.env.VIDEO_OUTRO === '1',
    outroDuration: Number(process.env.VIDEO_OUTRO_SECONDS || 3),

    // Video-içi abone/beğen uyarısı: ortalarda kısa süre belirir (loop'u bozmaz).
    subPrompt: process.env.VIDEO_SUBPROMPT !== '0',
    // İlk karede büyük hook yazısı (Shorts "kapağı").
    hookOverlay: process.env.VIDEO_HOOK !== '0',
    hookDuration: Number(process.env.VIDEO_HOOK_SECONDS || 2.8),

    // Ses efektleri: her geçişte DEĞİL, atlamalı ve kısık (pro kurgu hissi).
    sfx: process.env.VIDEO_SFX !== '0',
    transitionSoundVolume: Number(process.env.VIDEO_TRANSITION_SOUND_VOL || 0.12),

    // Arka plan müziği (narrasyon altında 'ducking' ile kısılır).
    // assets/music/ içindeki telifsiz parçalardan her video için rastgele biri
    // seçilir; klasör boşsa musicPath, o da yoksa sentetik pad kullanılır.
    music: process.env.VIDEO_MUSIC !== '0',
    musicDir: process.env.VIDEO_MUSIC_DIR || 'assets/music',
    musicPath: process.env.VIDEO_MUSIC_PATH || 'assets/music/bed.mp3',
    // Referans kurgulardaki gibi müzik biraz daha önde (ducking yine korur).
    musicVolume: Number(process.env.VIDEO_MUSIC_VOL || 0.19),
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
