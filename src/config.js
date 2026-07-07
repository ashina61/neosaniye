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
    // Popüler, doğal erkek US sesi. Alternatifler: en-US-BrianNeural,
    // en-US-GuyNeural, en-US-ChristopherNeural, en-US-EricNeural
    voice: process.env.TTS_VOICE || 'en-US-AndrewNeural',
    rate: process.env.TTS_RATE || '+0%', // ör. "+10%" Shorts için biraz hızlı
    pitch: process.env.TTS_PITCH || '+0Hz',
  },
  pexels: {
    apiKey: process.env.PEXELS_API_KEY,
  },
};

export function assertGemini() {
  if (!config.gemini.apiKey) {
    throw new Error(
      'GEMINI_API_KEY tanımlı değil. .env dosyasına ekleyin (bkz. .env.example). ' +
        'Ücretsiz anahtar: https://aistudio.google.com/apikey',
    );
  }
}
