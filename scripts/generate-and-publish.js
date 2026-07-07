#!/usr/bin/env node
/**
 * Faz 7 — Ana orkestrasyon script'i.
 * Tüm fazları sırayla çalıştırır: script -> ses -> görsel -> montaj -> loglama
 * ve (kredensiyel varsa) YouTube upload.
 *
 * Kullanım:
 *   node scripts/generate-and-publish.js            # tam boru hattı
 *   node scripts/generate-and-publish.js --no-upload# upload'ı atla (yerel test)
 *
 * Gerekli anahtarlar (.env / GitHub Secrets):
 *   GEMINI_API_KEY, PEXELS_API_KEY,
 *   (upload için) YOUTUBE_CLIENT_ID / SECRET / REFRESH_TOKEN,
 *   (kalıcı state için) FIREBASE_SERVICE_ACCOUNT.
 */
import { runPipeline } from '../src/pipeline/run.js';

const args = process.argv.slice(2);
const upload = args.includes('--no-upload') ? false : undefined;

try {
  const result = await runPipeline({ upload });
  console.log('\n✅ Tamamlandı.');
  if (result.youtube) console.log('   YouTube:', result.youtube.url);
  else console.log('   Video:', result.videoPath);
  process.exit(0);
} catch (err) {
  console.error('\n❌ Boru hattı başarısız:', err.message);
  process.exit(1);
}
