import dotenv from 'dotenv';

dotenv.config();

export const config = {
  gemini: {
    apiKey: process.env.GEMINI_API_KEY,
    // Ücretsiz tier, kart gerektirmez. VARSAYILAN: 2.5-flash (hızlı + KARARLI).
    // NOT: 3.5-flash de ücretsiz ve daha güçlü AMA launch döneminde sürekli 503
    // UNAVAILABLE dönüyor → generateScript retry'ları tükenip pipeline'ı kırdı
    // (13 Tem run #29 bu yüzden patladı). 3.5'in 503 fırtınası dinince tek
    // hamleyle geç: Actions → Variables → GEMINI_MODEL=gemini-3.5-flash.
    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
  },
  groq: {
    // Ücretsiz yedek beyin (console.groq.com) — Gemini kota/503'te devreye girer.
    apiKey: process.env.GROQ_API_KEY,
    model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
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
        'historically accurate period details, no futuristic or sci-fi elements, ' +
        'no astronauts, no modern devices in historical scenes, ' +
        'no text, no watermark, no subtitles',
    // "Animasyonlu hikâye kitabı" stili: bazı videolar illüstrasyon görünümünde
    // çıkar (run.js karar verir; VIDEO_STYLE=animated|photo ile zorlanır).
    animatedStyleSuffix:
      process.env.IMAGE_ANIMATED_STYLE ||
      'cinematic 2D storybook illustration, painterly digital art, rich textured ' +
        'brush strokes, dramatic warm lighting, subject clearly lit and readable, ' +
        'consistent character design across scenes, detailed atmospheric background, ' +
        'historically accurate period details, no futuristic or sci-fi elements, ' +
        'vertical composition, no text, no watermark, no speech bubbles',
    retries: Number(process.env.IMAGE_RETRIES || 2),
    timeoutMs: Number(process.env.IMAGE_TIMEOUT_MS || 90000),
    // Görsel üretimi başarısızsa Pexels'ten stok görsele düş.
    pexelsFallback: process.env.IMAGE_PEXELS_FALLBACK !== '0',
    // Slayt hissini kırmak için her N. sahne GERÇEK stok video dener
    // (Pexels, dikey). 0 = kapalı. Video bulunamazsa o sahne AI görsel olur.
    motionEvery: Number(process.env.IMAGE_MOTION_EVERY || 3),
  },
  retention: {
    // Yayın öncesi deterministik editoryal kalite kapısı (retentionQC.js).
    // disabled | warning (VARSAYILAN: raporlar, asla engellemez) | strict
    // (skor < minScore → upload engellenir). Günlük yayın akışını bozmamak
    // için strict yalnızca bilinçli olarak açılmalı.
    mode: process.env.RETENTION_QC_MODE || 'warning',
    // minScore: SERT upload kapısı (strict modda). Cron güvenliği için 85'te
    // kalır — bunu değiştirmek gece yayınını kilitleyebilir.
    minScore: Number(process.env.RETENTION_MIN_SCORE || 85),
    // qualityTarget: EDİTORYAL hedef (upload kapısı DEĞİL). Skor bu hedefin
    // altındaysa video yine yayınlanabilir ama rapor bir iyileştirme planı
    // (improvementPlan) + acımasız oto-eleştiri üretir. "İyi değil, harika" barı.
    qualityTarget: Number(process.env.RETENTION_QUALITY_TARGET || 90),
    // TEMPO (Viking videosu düzeltmesi: 5.79s ort / 7.26s statik → sıkılaştırıldı).
    maxStaticSegmentSeconds: Number(process.env.QC_MAX_STATIC_SECONDS || 4.0),
    targetVisualEventInterval: Number(process.env.QC_TARGET_EVENT_INTERVAL || 3.2),
    // 30-35sn videoda anlamlı görsel olay ve pattern interrupt hedefleri.
    minVisualEvents: Number(process.env.QC_MIN_VISUAL_EVENTS || 10),
    minPatternInterrupts: Number(process.env.QC_MIN_PATTERN_INTERRUPTS || 3),
    idealPatternInterrupts: Number(process.env.QC_IDEAL_PATTERN_INTERRUPTS || 5),
    firstSpeechDeadlineMs: Number(process.env.QC_FIRST_SPEECH_MS || 900),
    maxHookChars: Number(process.env.QC_MAX_HOOK_CHARS || 30),
    maxHookWords: Number(process.env.QC_MAX_HOOK_WORDS || 7),
    minCaptionPx: Number(process.env.QC_MIN_CAPTION_PX || 50),
    maxCaptionWords: Number(process.env.QC_MAX_CAPTION_WORDS || 4),
    // SES: 30-35sn bilgi videosu için duyulur sfx min/ideal/max + aralık.
    minAudibleSfx: Number(process.env.QC_MIN_SFX || 3),
    maxAudibleSfx: Number(process.env.QC_MAX_SFX || 6),
    minSfxGapSeconds: Number(process.env.QC_MIN_SFX_GAP || 3.0),
    // CTA/abone kartı en erken bu orandan sonra görünebilir (payoff öncesi yasak).
    ctaEarliestRatio: Number(process.env.QC_CTA_EARLIEST_RATIO || 0.7),
    // Semantik alaka: bu eşiğin altındaki asset o sahne için reddedilir.
    minSemanticRelevance: Number(process.env.QC_MIN_RELEVANCE || 0.34),
    // Mobil okunabilirlik: 360x640 ön izlemede görünür minimum piksel yüksekliği
    // (fontSize≥52 tek başına yetmez — asıl ölçü telefondaki gerçek boyut).
    hookMinPreviewPx: Number(process.env.QC_HOOK_MIN_PREVIEW_PX || 20),
    captionMinPreviewPx: Number(process.env.QC_CAPTION_MIN_PREVIEW_PX || 15),
    // Altyazı güvenli alanı: alt kenardan en az bu kadar boşluk (YouTube
    // Shorts UI başlık/açıklama bandı alt ~220px'i kapatır) ve altyazı bloğu
    // ekranın üst yarısına taşmamalı.
    captionBottomSafePx: Number(process.env.QC_CAPTION_BOTTOM_SAFE_PX || 220),
    captionTopSafeRatio: Number(process.env.QC_CAPTION_TOP_SAFE_RATIO || 0.5),
  },
  preflight: {
    // TEKNİK kapı modu — retention QC'den BAĞIMSIZ ayar:
    //   strict  (VARSAYILAN): teknik sert hata (decode, akış yok, çözünürlük,
    //           süre penceresi, loudness...) uploadı durdurur ve run fail olur.
    //   warning : teknik sorunlar raporlanır ama upload engellenmez (bilinçli
    //           riskli mod; yalnızca elle debug için).
    mode: process.env.TECHNICAL_PREFLIGHT_MODE || 'strict',
    // Final MP4 üzerindeki ffmpeg-tabanlı teknik kontrollerin eşikleri.
    blackMinSeconds: Number(process.env.PF_BLACK_MIN_SECONDS || 0.8),
    blackPixThreshold: Number(process.env.PF_BLACK_PIX_TH || 0.08),
    freezeMinSeconds: Number(process.env.PF_FREEZE_MIN_SECONDS || 3.0),
    silenceMinSeconds: Number(process.env.PF_SILENCE_MIN_SECONDS || 2.5),
    silenceNoiseDb: Number(process.env.PF_SILENCE_NOISE_DB || -45),
    clippingPeakDb: Number(process.env.PF_CLIPPING_PEAK_DB || -0.05),
    avSyncToleranceSeconds: Number(process.env.PF_AV_SYNC_TOLERANCE || 0.8),
    durationDeltaTolerance: Number(process.env.PF_DURATION_DELTA_TOLERANCE || 1.5),
    trailingSilenceMaxSeconds: Number(process.env.PF_TRAILING_SILENCE_MAX || 3.0),
  },
  crew: {
    // Orkestra: Görüntü Yönetmeni + Kurgucu/Ses Yönetmeni geçişleri.
    // Kapatmak için CREW_ENABLED=0 (mekanik varsayılanlara dönülür).
    enabled: process.env.CREW_ENABLED !== '0',
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
    tailSeconds: Number(process.env.VIDEO_TAIL_SECONDS || 0.4),

    // Altyazı stili: 'caption' = sinematik alt kısa ifade (ekranı kaplamaz),
    // 'word' = tek kelime punchy, 'pop' = eski büyük karaoke. Shorts için 'caption'.
    captionStyle: process.env.VIDEO_CAPTION_STYLE || 'caption',
    // Grup üst sınırı; asıl bölme konuşmadaki doğal duraklara göre yapılır.
    captionWordsPerLine: Number(process.env.VIDEO_CAPTION_WORDS || 3),
    captionSize: Number(process.env.VIDEO_CAPTION_SIZE || 52),
    // Sığdırma tabanları: normal altyazı ve vurgu bu boyutun altına ASLA inmez
    // (önce bölme denenir — split-before-shrink, bkz. captionLayout.js).
    captionMinPx: Number(process.env.VIDEO_CAPTION_MIN_PX || 30),
    captionEmphMinPx: Number(process.env.VIDEO_CAPTION_EMPH_MIN_PX || 40),
    // Grup bu orandan fazla küçülecekse fontu ezmek yerine grup ikiye bölünür.
    captionSplitRatio: Number(process.env.VIDEO_CAPTION_SPLIT_RATIO || 0.72),
    // Alt bölge (ekranı kaplamasın): büyük marginV = daha yukarı. Shorts UI'dan uzak.
    captionMarginV: Number(process.env.VIDEO_CAPTION_MARGIN || 460),

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

    // Ses efektleri: gerçek geçişlerde, NET duyulur seviyede.
    sfx: process.env.VIDEO_SFX !== '0',
    transitionSoundVolume: Number(process.env.VIDEO_TRANSITION_SOUND_VOL || 0.6),
    // A 35-58s Short needs setup → reveal → payoff audio punctuation. The
    // renderer fills a weak editor plan to this floor while respecting spacing.
    minSfxPerVideo: Number(process.env.VIDEO_SFX_MIN || 3),
    maxSfxPerVideo: Number(process.env.VIDEO_SFX_MAX || 5),
    minSfxGapSeconds: Number(process.env.VIDEO_SFX_MIN_GAP || 4),

    // Arka plan müziği (narrasyon altında 'ducking' ile kısılır).
    // assets/music/ içindeki telifsiz parçalardan her video için rastgele biri
    // seçilir; klasör boşsa musicPath, o da yoksa sentetik pad kullanılır.
    music: process.env.VIDEO_MUSIC !== '0',
    musicDir: process.env.VIDEO_MUSIC_DIR || 'assets/music',
    musicPath: process.env.VIDEO_MUSIC_PATH || 'assets/music/bed.mp3',
    // Müzik NET duyulur (referans kurgulardaki gibi önde); yumuşak ducking
    // konuşurken sadece hafifçe kısar, susturmaz.
    musicVolume: Number(process.env.VIDEO_MUSIC_VOL || 0.55),

    // Ambiyans katmanı: sahnenin ortam sesi (Freesound, CC0) müziğin altına
    // çok düşük seviyede serilir. FREESOUND_API_KEY yoksa otomatik atlanır.
    ambience: process.env.VIDEO_AMBIENCE !== '0',
    ambienceVolume: Number(process.env.VIDEO_AMBIENCE_VOL || 0.18),

    // MOTION GRAPHICS (template tabanlı, saf ffmpeg — yeni bağımlılık yok).
    // Şimdilik tek template: "stat card" (animasyonlu sayı sayacı). Görüntü
    // Yönetmeni bir sahnenin çekirdeği ÇARPICI bir SAYIYSA stat verir; o sahne
    // sayı kartına döner. Kapatmak için VIDEO_GFX=0. Video başına üst sınır.
    gfx: process.env.VIDEO_GFX !== '0',
    gfxMaxPerVideo: Number(process.env.VIDEO_GFX_MAX || 1),
    // Marka stil sabitleri (ANIMATION_BIBLE.md'nin makine karşılığı) — tüm
    // template'ler bunu okur, böylece üretilen her sahne aynı kanal hissini taşır.
    styleBible: {
      // Palet (16 Tem revizyon): lacivert+altın "AI belgesel" kalıbı yerine
      // MARKA paleti — kömür-siyah zemin + logonun turkuazı + temiz beyaz.
      bg0: process.env.GFX_BG0 || '0f1113', // kömür zemin (üst)
      bg1: process.env.GFX_BG1 || '1a1f24', // grafit zemin (alt)
      ink: process.env.GFX_INK || 'F0F4F4', // temiz beyaz tipografi
      accent: process.env.GFX_ACCENT || '3BD0C8', // logo turkuazı (vurgu)
      red: process.env.GFX_RED || 'C0392B', // derin kırmızı (yedek vurgu)
    },
  },
  pexels: {
    apiKey: process.env.PEXELS_API_KEY,
    perKeyword: Number(process.env.PEXELS_PER_KEYWORD || 1),
    orientation: process.env.PEXELS_ORIENTATION || 'portrait', // Shorts = 9:16
    preferType: process.env.PEXELS_PREFER_TYPE || 'video', // 'video' | 'photo'
    size: process.env.PEXELS_SIZE || 'medium',
  },
  pixabay: {
    // İkinci stok kaynağı (ücretsiz, ~sınırsız): Pexels video bulamayınca
    // buradan denenir. Key yoksa sessizce atlanır. https://pixabay.com/api/docs/
    apiKey: process.env.PIXABAY_API_KEY,
  },
  freesound: {
    // Sahne ambiyansı (ortam sesi) kaynağı — CC0 filtreli arama.
    // Key yoksa ambiyans katmanı sessizce atlanır. https://freesound.org/apiv2/
    apiKey: process.env.FREESOUND_API_KEY,
  },
  meta: {
    // SAYFASIZ Instagram yolu (Instagram Login API) — Sayfa/keşif gerektirmez.
    igLoginToken: process.env.META_IG_LOGIN_TOKEN,
    // Instagram Reels + Facebook Reels cross-post (bkz. docs/meta-setup.md).
    // Tek zorunlu değer: userToken (uzun ömürlü kullanıcı token'ı). Sayfa,
    // sayfa token'ı ve Instagram ID'si run sırasında OTOMATİK keşfedilir.
    // pageToken/pageId/igUserId isteğe bağlı elle geçersiz kılma değerleridir.
    userToken: process.env.META_USER_TOKEN,
    pageToken: process.env.META_PAGE_TOKEN,
    pageId: process.env.META_PAGE_ID,
    igUserId: process.env.META_IG_USER_ID,
  },
  // İçerik dili — CTA localization + dil kapısı bunu kullanır. Kanal İngilizce/ABD.
  content: {
    language: process.env.CONTENT_LANGUAGE || 'en', // 'en' | 'tr'
    // A full short story, not a 15-second fragment. Validated at script and TTS stages.
    minNarrationWords: Number(process.env.CONTENT_MIN_WORDS || 105),
    maxNarrationWords: Number(process.env.CONTENT_MAX_WORDS || 135),
    minDurationSeconds: Number(process.env.CONTENT_MIN_SECONDS || 35),
    maxDurationSeconds: Number(process.env.CONTENT_MAX_SECONDS || 58),
  },
  youtube: {
    clientId: process.env.YOUTUBE_CLIENT_ID,
    clientSecret: process.env.YOUTUBE_CLIENT_SECRET,
    refreshToken: process.env.YOUTUBE_REFRESH_TOKEN,
    privacyStatus: process.env.YOUTUBE_PRIVACY || 'public', // public|unlisted|private
    categoryId: process.env.YOUTUBE_CATEGORY_ID || '27', // 27 = Education
  },
  // NEO MOTION ENGINE v1 — video üstüne özgün CTA animasyonları (ASS/libass,
  // tek ffmpeg post-pass, sıfır bağımlılık, tamamen bize ait tasarım).
  motion: {
    enabled: process.env.MOTION_ENABLED !== '0',
    cta: {
      enabled: process.env.MOTION_CTA_ENABLED !== '0',
      // Her uygun videoda tek, payoff-sonrası subscribe CTA. "editorial" yalnızca
      // bilinçli A/B testi için kullanılmalı; varsayılan görünürlük garantilidir.
      mode: process.env.MOTION_CTA_MODE || 'always',
      probability: Number(process.env.MOTION_CTA_PROB || 1),
      allowedTypes: (process.env.MOTION_CTA_TYPES || 'subscribe').split(','),
      maxPerVideo: Number(process.env.MOTION_CTA_MAX || 1),
      minVideoDurationSec: Number(process.env.MOTION_CTA_MIN_DUR || 20),
      earliestStartSec: Number(process.env.MOTION_CTA_EARLIEST || 8),
      latestEndBufferSec: Number(process.env.MOTION_CTA_END_BUFFER || 2),
      durationRangeSec: [
        Number(process.env.MOTION_CTA_DUR_MIN || 1.8),
        Number(process.env.MOTION_CTA_DUR_MAX || 2.8),
      ],
      position: process.env.MOTION_CTA_POSITION || 'auto',
      avoidCaptions: process.env.MOTION_CTA_AVOID_CAPTIONS !== '0',
      avoidHook: process.env.MOTION_CTA_AVOID_HOOK !== '0',
      avoidOutro: process.env.MOTION_CTA_AVOID_OUTRO !== '0',
      seededRandom: process.env.MOTION_CTA_SEEDED !== '0',
      sfx: process.env.MOTION_CTA_SFX !== '0',
      // CTA 'pop' NET duyulur olmalı: taban ses cue anında DERİN kısılır (ducking) +
      // pop bu seviyede biner. Gerçek koşuda 0.7 hâlâ gömüldü (+0.4 dB) → 1.1.
      sfxVolume: Number(process.env.MOTION_CTA_SFX_VOL || 1.1),
      assetsDir: process.env.MOTION_ASSETS_DIR || 'assets/motion',
    },
    // Marka stil sabitleri (styleBible ile uyumlu) — tüm CTA'lar bunu okur.
    style: {
      accent: process.env.MOTION_ACCENT || '3BD0C8', // logo turkuazı
      ink: process.env.MOTION_INK || 'F0F4F4',
      card: process.env.MOTION_CARD || '141A1E', // koyu cam kart
      font: process.env.MOTION_FONT || 'Montserrat SemiBold',
      fontFallback: process.env.MOTION_FONT_FALLBACK || 'DejaVu Sans',
    },
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
