#!/usr/bin/env node
/**
 * Bir kerelik YouTube OAuth refresh token üretici (bilgisayarda çalıştırmak için).
 * Telefondan yapacaksan bunun yerine OAuth Playground yöntemini kullan:
 * bkz. docs/youtube-oauth-setup.md.
 *
 * Kullanım:
 *   1) .env içine YOUTUBE_CLIENT_ID ve YOUTUBE_CLIENT_SECRET ekle.
 *   2) Google Cloud'da OAuth client'ının izinli redirect URI'lerine şunu ekle:
 *      http://localhost:4319/oauth2callback
 *   3) node scripts/youtube-auth.js
 *   4) Yazdırılan URL'yi aç, izin ver, sonra REFRESH TOKEN terminalde belirir.
 */
import http from 'node:http';
import { google } from 'googleapis';
import { config } from '../src/config.js';

const { clientId, clientSecret } = config.youtube;
if (!clientId || !clientSecret) {
  console.error('Önce .env içine YOUTUBE_CLIENT_ID ve YOUTUBE_CLIENT_SECRET ekleyin.');
  process.exit(1);
}

const PORT = 4319;
const redirectUri = `http://localhost:${PORT}/oauth2callback`;
const oauth2 = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

const authUrl = oauth2.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent', // refresh_token'ın her seferinde dönmesini garanti eder
  scope: [
    'https://www.googleapis.com/auth/youtube.upload',
    'https://www.googleapis.com/auth/youtube.force-ssl',
    'https://www.googleapis.com/auth/yt-analytics.readonly',
  ],
});

const server = http.createServer(async (req, res) => {
  if (!req.url.startsWith('/oauth2callback')) {
    res.writeHead(404);
    res.end();
    return;
  }
  const code = new URL(req.url, redirectUri).searchParams.get('code');
  res.end('Yetkilendirme alındı. Terminale dönebilirsin.');
  try {
    const { tokens } = await oauth2.getToken(code);
    console.log('\n==== REFRESH TOKEN (GitHub Secret: YOUTUBE_REFRESH_TOKEN) ====\n');
    console.log(tokens.refresh_token || '(refresh_token gelmedi — prompt=consent ve access_type=offline olduğundan emin ol)');
    console.log('\n=============================================================\n');
  } catch (err) {
    console.error('Token değişimi hatası:', err.message);
  } finally {
    server.close();
    process.exit(0);
  }
});

server.listen(PORT, () => {
  console.log('1) Şu URL\'yi tarayıcıda aç ve izin ver:\n');
  console.log(authUrl);
  console.log(`\n2) İzin sonrası ${redirectUri} adresine yönlenince token yazdırılır.`);
});
