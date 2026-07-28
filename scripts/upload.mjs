import {readFile, writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const VIDEO = path.join(ROOT, 'out', 'neosaniye-short.mp4');
const MANIFEST = path.join(ROOT, 'out', 'manifest.json');
const REPORT = path.join(ROOT, 'out', 'upload-report.json');
const HISTORY = path.join(ROOT, 'data', 'published.json');
const META_VERSION = process.env.META_GRAPH_VERSION || 'v25.0';
const GRAPH = `https://graph.facebook.com/${META_VERSION}`;
const uploadEnabled = /^(1|true|yes)$/i.test(process.env.UPLOAD_ENABLED || 'false');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function readJson(file, fallback = null) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch {
    return fallback;
  }
}

async function parseResponse(response) {
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {raw: text};
  }
  if (!response.ok) {
    const error = new Error(`HTTP ${response.status}: ${JSON.stringify(data).slice(0, 800)}`);
    error.status = response.status;
    error.payload = data;
    throw error;
  }
  return {data, headers: response.headers};
}

async function request(url, options = {}, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, options);
      if ((response.status === 429 || response.status >= 500) && attempt < attempts) {
        await sleep(1500 * attempt);
        continue;
      }
      return await parseResponse(response);
    } catch (error) {
      lastError = error;
      if (attempt >= attempts || (error.status && error.status < 500 && error.status !== 429)) {
        throw error;
      }
      await sleep(1500 * attempt);
    }
  }
  throw lastError;
}

async function getYouTubeAccessToken() {
  const body = new URLSearchParams({
    client_id: process.env.YOUTUBE_CLIENT_ID,
    client_secret: process.env.YOUTUBE_CLIENT_SECRET,
    refresh_token: process.env.YOUTUBE_REFRESH_TOKEN,
    grant_type: 'refresh_token',
  });
  const {data} = await request('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {'content-type': 'application/x-www-form-urlencoded'},
    body,
  });
  if (!data.access_token) throw new Error('Google token response did not include access_token.');
  return data.access_token;
}

async function uploadYouTube(video, manifest) {
  const accessToken = await getYouTubeAccessToken();
  const resource = {
    snippet: {
      title: manifest.title,
      description: manifest.description,
      tags: manifest.tags,
      categoryId: process.env.YOUTUBE_CATEGORY_ID || '27',
      defaultLanguage: 'en',
      defaultAudioLanguage: 'en',
    },
    status: {
      privacyStatus: process.env.YOUTUBE_PRIVACY || manifest.privacyStatus || 'public',
      selfDeclaredMadeForKids: false,
      containsSyntheticMedia: true,
    },
  };

  const start = await fetch(
    'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status&notifySubscribers=true',
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json; charset=UTF-8',
        'x-upload-content-length': String(video.length),
        'x-upload-content-type': 'video/mp4',
      },
      body: JSON.stringify(resource),
    },
  );
  if (!start.ok) await parseResponse(start);
  const location = start.headers.get('location');
  if (!location) throw new Error('YouTube resumable upload did not return a Location header.');

  const {data} = await request(location, {
    method: 'PUT',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'video/mp4',
      'content-length': String(video.length),
    },
    body: video,
  }, 4);
  if (!data.id) throw new Error('YouTube upload response did not include a video ID.');
  return {id: data.id, url: `https://www.youtube.com/shorts/${data.id}`};
}

function metaToken() {
  return process.env.META_PAGE_TOKEN || '';
}

async function discoverMetaTargets() {
  let pageToken = metaToken();
  let pageId = process.env.META_PAGE_ID || '';
  let igUserId = process.env.META_IG_USER_ID || '';
  const userToken = process.env.META_USER_TOKEN || '';

  if ((!pageToken || !pageId) && userToken) {
    const params = new URLSearchParams({
      fields: 'id,name,access_token',
      access_token: userToken,
    });
    const {data} = await request(`${GRAPH}/me/accounts?${params}`);
    const pages = Array.isArray(data.data) ? data.data : [];
    if (!pages.length) {
      throw new Error('META_USER_TOKEN did not expose an accessible Facebook Page.');
    }
    const page = pageId ? pages.find((item) => item.id === pageId) || pages[0] : pages[0];
    pageId = page.id;
    pageToken = page.access_token;
    console.log(`[meta] discovered Facebook Page ${page.name || pageId} (${pageId})`);
  }

  if (pageToken && pageId && !igUserId) {
    try {
      const params = new URLSearchParams({
        fields: 'instagram_business_account',
        access_token: pageToken,
      });
      const {data} = await request(`${GRAPH}/${pageId}?${params}`);
      igUserId = data.instagram_business_account?.id || '';
      if (igUserId) console.log(`[meta] discovered Instagram account ${igUserId}`);
    } catch (error) {
      console.warn(`[meta] Instagram discovery failed: ${error.message}`);
    }
  }

  return {pageToken, pageId, igUserId};
}

async function uploadInstagram(video, manifest, targets) {
  const token = targets.pageToken;
  const igUserId = targets.igUserId;
  const createBody = new URLSearchParams({
    media_type: 'REELS',
    upload_type: 'resumable',
    caption: `${manifest.title}\n\n${manifest.description}`.slice(0, 2200),
    share_to_feed: 'true',
    access_token: token,
  });
  const {data: created} = await request(`${GRAPH}/${igUserId}/media`, {
    method: 'POST',
    headers: {'content-type': 'application/x-www-form-urlencoded'},
    body: createBody,
  });
  if (!created.id) throw new Error(`Instagram container creation failed: ${JSON.stringify(created)}`);

  const uploadUrl = created.uri || `https://rupload.facebook.com/ig-api-upload/${META_VERSION}/${created.id}`;
  await request(uploadUrl, {
    method: 'POST',
    headers: {
      authorization: `OAuth ${token}`,
      offset: '0',
      file_size: String(video.length),
      'content-type': 'application/octet-stream',
      'content-length': String(video.length),
    },
    body: video,
  }, 4);

  let status;
  for (let poll = 0; poll < 40; poll += 1) {
    const params = new URLSearchParams({
      fields: 'status_code,status',
      access_token: token,
    });
    const {data} = await request(`${GRAPH}/${created.id}?${params}`);
    status = data.status_code || data.status;
    if (status === 'FINISHED') break;
    if (status === 'ERROR' || status === 'EXPIRED') {
      throw new Error(`Instagram container processing failed: ${JSON.stringify(data)}`);
    }
    await sleep(7500);
  }
  if (status !== 'FINISHED') throw new Error(`Instagram container timed out with status ${status}.`);

  const publishBody = new URLSearchParams({
    creation_id: created.id,
    access_token: token,
  });
  const {data: published} = await request(`${GRAPH}/${igUserId}/media_publish`, {
    method: 'POST',
    headers: {'content-type': 'application/x-www-form-urlencoded'},
    body: publishBody,
  });
  if (!published.id) throw new Error(`Instagram publish failed: ${JSON.stringify(published)}`);
  return {id: published.id};
}

async function uploadFacebook(video, manifest, targets) {
  const token = targets.pageToken;
  const pageId = targets.pageId;
  const startBody = new URLSearchParams({
    upload_phase: 'start',
    access_token: token,
  });
  const {data: started} = await request(`${GRAPH}/${pageId}/video_reels`, {
    method: 'POST',
    headers: {'content-type': 'application/x-www-form-urlencoded'},
    body: startBody,
  });
  if (!started.video_id || !started.upload_url) {
    throw new Error(`Facebook Reels start failed: ${JSON.stringify(started)}`);
  }

  await request(started.upload_url, {
    method: 'POST',
    headers: {
      authorization: `OAuth ${token}`,
      offset: '0',
      file_size: String(video.length),
      'content-type': 'application/octet-stream',
      'content-length': String(video.length),
    },
    body: video,
  }, 4);

  const finishBody = new URLSearchParams({
    upload_phase: 'finish',
    video_id: started.video_id,
    video_state: 'PUBLISHED',
    description: `${manifest.title}\n\n${manifest.description}`.slice(0, 5000),
    access_token: token,
  });
  const {data: finished} = await request(`${GRAPH}/${pageId}/video_reels`, {
    method: 'POST',
    headers: {'content-type': 'application/x-www-form-urlencoded'},
    body: finishBody,
  });
  return {id: started.video_id, response: finished};
}

async function recordPublished(manifest, outcomes) {
  const history = await readJson(HISTORY, []);
  history.push({
    slug: manifest.slug,
    title: manifest.title,
    slot: manifest.slot,
    contentDate: manifest.contentDate,
    publishedAt: new Date().toISOString(),
    platforms: Object.fromEntries(
      Object.entries(outcomes).map(([key, value]) => [key, value.status]),
    ),
  });
  await writeFile(HISTORY, `${JSON.stringify(history.slice(-120), null, 2)}\n`, 'utf8');
}

async function main() {
  if (!existsSync(VIDEO) || !existsSync(MANIFEST)) {
    throw new Error('Rendered video or manifest is missing.');
  }
  const manifest = await readJson(MANIFEST);
  const video = await readFile(VIDEO);
  const report = {
    uploadEnabled,
    slug: manifest.slug,
    slot: manifest.slot,
    startedAt: new Date().toISOString(),
    platforms: {},
  };

  if (!uploadEnabled) {
    report.status = 'dry-run';
    await writeFile(REPORT, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    console.log('Upload disabled; render-only run completed.');
    return;
  }

  let metaTargets = {pageToken: metaToken(), pageId: process.env.META_PAGE_ID || '', igUserId: process.env.META_IG_USER_ID || ''};
  if (metaTargets.pageToken || process.env.META_USER_TOKEN) {
    try {
      metaTargets = await discoverMetaTargets();
    } catch (error) {
      console.warn(`[meta] target discovery failed: ${error.message}`);
    }
  }

  const configured = {
    youtube: Boolean(process.env.YOUTUBE_CLIENT_ID && process.env.YOUTUBE_CLIENT_SECRET && process.env.YOUTUBE_REFRESH_TOKEN),
    instagram: Boolean(metaTargets.pageToken && metaTargets.igUserId),
    facebook: Boolean(metaTargets.pageToken && metaTargets.pageId),
  };

  if (!Object.values(configured).some(Boolean)) {
    throw new Error('UPLOAD_ENABLED is true, but no platform credentials are configured.');
  }

  const jobs = {};
  if (configured.youtube) jobs.youtube = uploadYouTube(video, manifest);
  if (configured.instagram) jobs.instagram = uploadInstagram(video, manifest, metaTargets);
  if (configured.facebook) jobs.facebook = uploadFacebook(video, manifest, metaTargets);

  const names = Object.keys(jobs);
  const results = await Promise.allSettled(Object.values(jobs));
  const outcomes = {};

  results.forEach((result, index) => {
    const name = names[index];
    if (result.status === 'fulfilled') {
      outcomes[name] = {status: 'published', result: result.value};
    } else {
      outcomes[name] = {
        status: 'failed',
        error: result.reason instanceof Error ? result.reason.message : String(result.reason),
      };
    }
  });

  for (const [name, isConfigured] of Object.entries(configured)) {
    if (!isConfigured) outcomes[name] = {status: 'skipped', error: 'credentials-not-configured'};
  }

  report.platforms = outcomes;
  report.finishedAt = new Date().toISOString();
  const publishedCount = Object.values(outcomes).filter((item) => item.status === 'published').length;
  report.status = publishedCount > 0 ? 'published' : 'failed';
  await writeFile(REPORT, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  if (publishedCount > 0) {
    await recordPublished(manifest, outcomes);
  }

  console.log(JSON.stringify(report, null, 2));
  if (publishedCount === 0) {
    throw new Error('All configured platform uploads failed.');
  }
}

main().catch(async (error) => {
  const failure = {
    status: 'failed',
    error: error instanceof Error ? error.message : String(error),
    finishedAt: new Date().toISOString(),
  };
  try {
    await writeFile(REPORT, `${JSON.stringify(failure, null, 2)}\n`, 'utf8');
  } catch {}
  console.error(error);
  process.exit(1);
});
