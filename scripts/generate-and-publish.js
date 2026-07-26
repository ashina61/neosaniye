#!/usr/bin/env node
/**
 * Faz 7 — Ana orkestrasyon script'i.
 * Tüm fazları sırayla çalıştırır: script -> ses -> görsel -> montaj -> loglama
 * ve (kredensiyel varsa) YouTube upload.
 *
 * YAYIN VARSAYILAN OLARAK KAPALIDIR. Bayrak yokken boru hattı videoyu üretir,
 * QC'yi çalıştırır, artifact'leri yazar ve upload YAPMAZ. Eskiden bayrak yoksa
 * `undefined` gönderiliyor, run.js de bunu "kimlik bilgisi varsa yükle" diye
 * yorumluyordu; cron'un onaysız yayın yapmasının üç sebebinden biri buydu.
 *
 * Kullanım:
 *   node scripts/generate-and-publish.js             # üret, YÜKLEME
 *   node scripts/generate-and-publish.js --upload    # üret ve (kapılar geçilirse) yükle
 *   node scripts/generate-and-publish.js --no-upload # kesin yükleme
 *
 * Gerekli anahtarlar (.env / GitHub Secrets):
 *   GEMINI_API_KEY, PEXELS_API_KEY,
 *   (upload için) YOUTUBE_CLIENT_ID / SECRET / REFRESH_TOKEN,
 *   (kalıcı state için) FIREBASE_SERVICE_ACCOUNT.
 */
import { runPipeline } from '../src/pipeline/run.js';

const args = process.argv.slice(2);
// --no-upload en yüksek öncelik (kesin hayır), sonra --upload (talep).
// Hiçbiri yoksa karar AUTO_UPLOAD ortam değişkenine bırakılır; o da yoksa
// varsayılan KAPALIdır (bkz. src/pipeline/uploadPolicy.js).
const upload = args.includes('--no-upload') ? false
  : args.includes('--upload') ? true
    : undefined;

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
