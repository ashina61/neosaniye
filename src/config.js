import dotenv from 'dotenv';

dotenv.config();

export const config = {
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY,
    // Varsayılan model: kaliteli hook + makul maliyet. Ucuz alternatif: claude-haiku-4-5
    model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5',
  },
  niche: {
    language: process.env.CONTENT_LANGUAGE || 'tr',
    theme: process.env.CONTENT_THEME || 'ilginç bilgiler, nasıl çalışır, nasıl yapılır',
  },
  firebase: {
    // GitHub Secret'ta tek satır JSON string olarak tutulur.
    serviceAccountJson: process.env.FIREBASE_SERVICE_ACCOUNT,
    projectId: process.env.FIREBASE_PROJECT_ID,
  },
  pexels: {
    apiKey: process.env.PEXELS_API_KEY,
  },
};

export function assertAnthropic() {
  if (!config.anthropic.apiKey) {
    throw new Error(
      'ANTHROPIC_API_KEY tanımlı değil. .env dosyasına ekleyin (bkz. .env.example).',
    );
  }
}
