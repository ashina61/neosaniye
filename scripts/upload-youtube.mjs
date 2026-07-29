import {readFile, access} from 'node:fs/promises';
import path from 'node:path';

const required = ['YOUTUBE_CLIENT_ID', 'YOUTUBE_CLIENT_SECRET', 'YOUTUBE_REFRESH_TOKEN'];
for (const key of required) {
  if (!process.env[key]) throw new Error(`Missing required secret: ${key}`);
}

const videoPath = path.resolve(process.env.VIDEO_PATH || 'out/neosaniye-vox.mp4');
await access(videoPath);

let story = {};
try {
  story = JSON.parse(await readFile('content/generated/current-story.json', 'utf8'));
} catch {
  story = {};
}

const rawTitle = process.env.YOUTUBE_TITLE || story.title || process.env.VIDEO_TOPIC || 'NeoSaniye';
const title = String(rawTitle).replace(/\s+/g, ' ').trim().slice(0, 100);
const summary = story.summary || story.description || '';
const description = String(process.env.YOUTUBE_DESCRIPTION || `${summary}\n\n#shorts #belgesel #tarih`).trim().slice(0, 5000);
const privacyStatus = process.env.YOUTUBE_PRIVACY || 'public';
const categoryId = process.env.YOUTUBE_CATEGORY_ID || '27';
const madeForKids = String(process.env.YOUTUBE_MADE_FOR_KIDS || 'false') === 'true';

const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  headers: {'content-type': 'application/x-www-form-urlencoded'},
  body: new URLSearchParams({
    client_id: process.env.YOUTUBE_CLIENT_ID,
    client_secret: process.env.YOUTUBE_CLIENT_SECRET,
    refresh_token: process.env.YOUTUBE_REFRESH_TOKEN,
    grant_type: 'refresh_token',
  }),
});
if (!tokenResponse.ok) throw new Error(`OAuth refresh failed (${tokenResponse.status}): ${await tokenResponse.text()}`);
const token = await tokenResponse.json();
if (!token.access_token) throw new Error('OAuth refresh returned no access token');

const metadata = {
  snippet: {
    title,
    description,
    categoryId,
    defaultLanguage: process.env.VIDEO_LANGUAGE || 'tr',
    tags: ['shorts', 'belgesel', 'NeoSaniye'],
  },
  status: {
    privacyStatus,
    selfDeclaredMadeForKids: madeForKids,
  },
};

const init = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', {
  method: 'POST',
  headers: {
    authorization: `Bearer ${token.access_token}`,
    'content-type': 'application/json; charset=UTF-8',
    'x-upload-content-type': 'video/mp4',
  },
  body: JSON.stringify(metadata),
});
if (!init.ok) throw new Error(`YouTube upload init failed (${init.status}): ${await init.text()}`);
const uploadUrl = init.headers.get('location');
if (!uploadUrl) throw new Error('YouTube did not return a resumable upload URL');

const video = await readFile(videoPath);
const upload = await fetch(uploadUrl, {
  method: 'PUT',
  headers: {
    authorization: `Bearer ${token.access_token}`,
    'content-type': 'video/mp4',
    'content-length': String(video.byteLength),
  },
  body: video,
});
if (!upload.ok) throw new Error(`YouTube upload failed (${upload.status}): ${await upload.text()}`);
const result = await upload.json();
if (!result.id) throw new Error(`YouTube returned no video id: ${JSON.stringify(result)}`);
console.log(`YOUTUBE_VIDEO_ID=${result.id}`);
console.log(`YOUTUBE_VIDEO_URL=https://youtube.com/shorts/${result.id}`);
// VOX upload pipeline trigger: 2026-07-29
