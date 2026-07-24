#!/usr/bin/env node
/**
 * TOKEN SCOPE KONTROLÖRÜ — mevcut YOUTUBE_REFRESH_TOKEN'ın hangi izinlere
 * sahip olduğunu KESİN gösterir (tahmin yok). "Insufficient Permission" derdinde
 * hangi scope'un eksik olduğunu anında söyler.
 *
 * Çalıştır (yerelde, .env dolu olmalı):  node scripts/check-token-scopes.js
 */
import { config } from '../src/config.js';

const { clientId, clientSecret, refreshToken } = config.youtube;
if (!clientId || !clientSecret || !refreshToken) {
  console.error('❌ .env eksik: YOUTUBE_CLIENT_ID / SECRET / REFRESH_TOKEN gerekli.');
  process.exit(1);
}

// 1) Refresh token → access token.
const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  headers: { 'content-type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    client_id: clientId, client_secret: clientSecret,
    refresh_token: refreshToken, grant_type: 'refresh_token',
  }),
});
const tok = await tokenRes.json();
if (!tok.access_token) {
  console.error('❌ Access token alınamadı:', tok.error || tok, '\n(Token geçersiz/iptal olabilir — yeniden üret.)');
  process.exit(1);
}

// 2) tokeninfo → verilen scope'lar.
const info = await (await fetch('https://oauth2.googleapis.com/tokeninfo?access_token=' + tok.access_token)).json();
const scopes = String(info.scope || '');
console.log('\nToken scope\'ları:\n  ' + (scopes.split(/\s+/).join('\n  ') || '(yok)'));

const NEED = {
  'youtube.upload': 'Video yükleme',
  'youtube.force-ssl': 'Otomatik yorum + altyazı',
  'yt-analytics.readonly': 'Retention analitiği (öğrenme döngüsü)',
};
console.log('\nGerekli izinler:');
let missing = 0;
for (const [s, desc] of Object.entries(NEED)) {
  const ok = scopes.includes(s);
  if (!ok) missing += 1;
  console.log(`  ${ok ? '✅' : '❌ EKSİK'} ${s}  — ${desc}`);
}
console.log(missing
  ? `\n${missing} izin eksik → token'ı bu scope'larla yeniden üret (bkz. docs/youtube-oauth-setup.md).`
  : '\n✅ Tüm izinler var — yorum/analitik çalışmalı.');
process.exit(missing ? 1 : 0);
