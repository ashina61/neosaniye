#!/usr/bin/env node
/**
 * THE LAST STEP, AND THE ONLY ONE THAT CANNOT BE RE-RUN.
 *
 * Everything before this writes files. A file can be looked at, thrown away and
 * made again. This hands the reel to a platform, and from that second it has
 * been seen: an unlisted link gets forwarded, a private video still lives in
 * the channel's history, and a public one is indexed within minutes. So the
 * shape of this file is not "upload a video" — it is a LIST OF REFUSALS with an
 * upload at the end of it.
 *
 *   node scripts/publish-episode.mjs --episode=<id> --dry-run
 *   node scripts/publish-episode.mjs --episode=<id>                  # private
 *   node scripts/publish-episode.mjs --episode=<id> --privacy=public
 *
 * WHAT IT REFUSES, AND WHY EACH ONE IS HERE:
 *
 *   STAND-INS      the reel is six grey labelled boxes. This is the failure
 *                  this repo keeps paying for: it validates, it renders, it
 *                  produces a real mp4, and it looks like success in every way
 *                  except the one that matters. A placeholder ledger with
 *                  anything in it is the machine already knowing, in writing,
 *                  that the artwork is not finished. Publishing past that note
 *                  is the whole mistake, automated.
 *   AN ESTIMATED   the durations came from a word count instead of the
 *   CLOCK          narration, so the cuts do not land on the pauses. Law zero:
 *                  a reel cut to a guess is a draft, and a draft that gets
 *                  posted is not a draft any more.
 *   NO CREDIT      Commons hosts FREE files, not public ones. CC BY and CC BY-SA
 *                  require attribution wherever the work is published, and a
 *                  CREDITS.md sitting in a repo is not where it was published.
 *                  The credit travels in the description or the upload does not
 *                  happen.
 *
 * PRIVACY DEFAULTS TO PRIVATE and nothing infers otherwise. A pipeline that can
 * post to a channel on its own must not be one keystroke away from posting to
 * the world; --privacy=public is a thing a person types.
 */
import {readFile, readdir, stat} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {ROOT, episodeDir, exists, loadConfig, parseArgs} from './lib/episode.mjs';
import {readPlaceholders} from './lib/placeholders.mjs';

const PRIVACY = ['private', 'unlisted', 'public'];
/** YouTube's own limits. Exceeding either is a 400 after the bytes are uploaded. */
const TITLE_MAX = 100;
const DESCRIPTION_MAX = 5000;

/**
 * THE TITLE IS THE HOOK, NOT THE FILE NAME.
 *
 * The episode's own title is written to sit over the first shot — it is short
 * because it is typography. A feed title is doing a different job: it is the
 * second thing after the first frame that decides whether the thumb keeps
 * moving. So it is the title AND the line that was written to stop a scroll.
 */
export function titleFor(brief) {
  const hook = String(brief?.lines?.[0]?.vo ?? '').trim().replace(/\s+/g, ' ');
  const name = String(brief?.title ?? brief?.id ?? '').trim();
  const tag = '#Shorts';
  const full = `${name} — ${hook} ${tag}`.replace(/\s+/g, ' ').trim();
  if (full.length <= TITLE_MAX) return full;
  const room = TITLE_MAX - name.length - tag.length - 5;
  if (room < 20) return `${name} ${tag}`.slice(0, TITLE_MAX).trim();
  return `${name} — ${hook.slice(0, room).replace(/[\s,;:.]+\S*$/, '')}… ${tag}`;
}

/**
 * The description carries three things and they are not decoration: the script
 * (which is what the platform reads to work out what this is about), the
 * credit (which is a licence condition), and nothing else. No "subscribe", no
 * link farm — this is a file that has to be correct, not a page.
 */
export function describe(brief, credits = '') {
  const script = (brief?.lines ?? []).map((line) => String(line.vo ?? '').trim()).filter(Boolean).join('\n');
  const parts = [script];
  if (credits.trim()) {
    parts.push(
      'Images: Wikimedia Commons, used under the licences below. Everything else is drawn.',
      credits.trim(),
    );
  } else {
    parts.push('Every frame in this reel is drawn.');
  }
  const body = parts.join('\n\n');
  return body.length <= DESCRIPTION_MAX ? body : `${body.slice(0, DESCRIPTION_MAX - 1)}…`;
}

/** Proper nouns out of the script, which is where the searchable words are. */
export function tagsFor(brief) {
  const text = (brief?.lines ?? []).map((l) => l.vo ?? '').join(' ');
  const names = [...new Set((text.match(/\b[A-Z][a-z]{2,}\b/g) ?? []).filter((w) => !/^(The|And|But|Two|Twenty|January|It)$/.test(w)))];
  const years = [...new Set(text.match(/\b1[0-9]{3}\b/g) ?? [])];
  return ['documentary', 'history', 'shorts', ...names.slice(0, 8), ...years].map((t) => t.toLowerCase());
}

/**
 * EVERYTHING THAT MUST BE TRUE BEFORE THE BYTES MOVE.
 *
 * Pure, so it can be tested without a channel, a key or a network — the
 * refusals are the part worth being sure about.
 */
export function problemsWithRelease({video, placeholders = [], measured, credits, commons, privacy}) {
  const problems = [];

  if (!video || !(video.size > 0)) problems.push('there is no rendered mp4 — run npm run render first');
  else if (video.size < 100_000) problems.push(`${path.basename(video.file ?? 'the mp4')} is ${video.size} bytes — that is not a reel`);

  if (placeholders.length) {
    problems.push(
      `${placeholders.length} asset(s) are still stand-ins (${placeholders.slice(0, 3).join(', ')}${placeholders.length > 3 ? '…' : ''})` +
        ' — this reel is grey labelled boxes with narration over them',
    );
  }

  if (!measured) {
    problems.push('the cut came from a word count, not the narration — run npm run voice, then npm run plan');
  }

  // The licence condition, checked where it can still be met.
  if (commons && !String(credits ?? '').trim()) {
    problems.push('assets came from Commons but assets/CREDITS.md is missing — the credit has to travel with the reel');
  }

  if (privacy && !PRIVACY.includes(privacy)) problems.push(`privacy "${privacy}" is not one of ${PRIVACY.join(', ')}`);

  return problems;
}

/** OAuth for a machine: a refresh token the channel's owner granted once. */
async function accessToken() {
  const client_id = process.env.YOUTUBE_CLIENT_ID;
  const client_secret = process.env.YOUTUBE_CLIENT_SECRET;
  const refresh_token = process.env.YOUTUBE_REFRESH_TOKEN;
  if (!client_id || !client_secret || !refresh_token) return null;

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {'Content-Type': 'application/x-www-form-urlencoded'},
    body: new URLSearchParams({client_id, client_secret, refresh_token, grant_type: 'refresh_token'}),
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) throw new Error(`token exchange failed — HTTP ${response.status}: ${(await response.text()).slice(0, 200)}`);
  const body = await response.json();
  if (!body.access_token) throw new Error('the token endpoint answered without an access_token');
  return body.access_token;
}

/**
 * Resumable upload, because a phone-sized mp4 over a CI runner's network is
 * exactly the size where a single POST fails halfway and tells you nothing.
 * Two calls: metadata for a session URL, then the bytes.
 */
async function upload({file, size, metadata, token}) {
  const start = await fetch(
    'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Length': String(size),
        'X-Upload-Content-Type': 'video/mp4',
      },
      body: JSON.stringify(metadata),
      signal: AbortSignal.timeout(120_000),
    },
  );
  if (!start.ok) throw new Error(`YouTube refused the upload session — HTTP ${start.status}: ${(await start.text()).slice(0, 300)}`);
  const session = start.headers.get('location');
  if (!session) throw new Error('YouTube accepted the metadata but gave no upload URL');

  const sent = await fetch(session, {
    method: 'PUT',
    headers: {'Content-Type': 'video/mp4', 'Content-Length': String(size)},
    body: createReadStream(file),
    duplex: 'half',
    signal: AbortSignal.timeout(30 * 60_000),
  });
  if (!sent.ok) throw new Error(`the upload failed — HTTP ${sent.status}: ${(await sent.text()).slice(0, 300)}`);
  return sent.json();
}

/** Did any asset actually come off Commons? The credits file is written per fetch. */
async function usedCommons(dir) {
  try {
    const recipes = JSON.parse(await readFile(path.join(dir, 'assets.json'), 'utf8'));
    return Object.values(recipes ?? {}).some((recipe) => recipe?.commons);
  } catch {
    return false;
  }
}

async function main() {
  const args = parseArgs();
  const id = typeof args.episode === 'string' ? args.episode : null;
  if (!id) {
    console.error('✗ which episode? node scripts/publish-episode.mjs --episode=<id> [--dry-run] [--privacy=private|unlisted|public]');
    process.exit(1);
  }

  const dir = episodeDir(id);
  const file = typeof args.file === 'string' ? path.resolve(args.file) : path.join(ROOT, 'out', `${id}.mp4`);
  const privacy = typeof args.privacy === 'string' ? args.privacy : 'private';

  const video = (await exists(file)) ? {file, size: (await stat(file)).size} : null;
  const brief = JSON.parse(await readFile(path.join(dir, 'brief.json'), 'utf8'));
  const placeholders = await readPlaceholders(dir);
  // The clock is the narration or it is a guess, and vo.json IS the measurement.
  const measured = await exists(path.join(dir, 'audio', 'vo.json'));
  const credits = await readFile(path.join(dir, 'assets', 'CREDITS.md'), 'utf8').catch(() => '');
  const commons = await usedCommons(dir);

  const problems = problemsWithRelease({video, placeholders, measured, credits, commons, privacy});
  /**
   * A DRY RUN IS NOT A PUBLISH, so the refusals do not gate it — they are
   * printed and it carries on. The first version exited here, which meant the
   * one moment you actually want to see what would go up (before it is ready)
   * was the one moment it would not show you.
   */
  if (problems.length && !args['dry-run']) {
    console.error(`✗ ${id} is not ready to publish — nothing was uploaded:\n`);
    for (const problem of problems) console.error(`   · ${problem}`);
    console.error('\n   These are the states that render happily and are not finished reels.');
    process.exit(1);
  }

  const {config} = await loadConfig(id);
  const seconds = ((config.scenes ?? []).reduce((t, s) => t + (s.durationInFrames ?? 0), 0) / (config.fps ?? 30)).toFixed(1);
  const metadata = {
    snippet: {title: titleFor(brief), description: describe(brief, credits), tags: tagsFor(brief), categoryId: '27'},
    status: {privacyStatus: privacy, selfDeclaredMadeForKids: false},
  };

  if (args['dry-run']) {
    console.log(`— dry run, nothing uploaded —\n`);
    if (problems.length) {
      console.log('would be REFUSED as it stands:');
      for (const problem of problems) console.log(`   · ${problem}`);
      console.log('');
    }
    console.log(`file      ${video ? `${path.relative(ROOT, video.file)}  ${(video.size / 1e6).toFixed(1)} MB` : 'not rendered yet'}  ${seconds}s`);
    console.log(`privacy   ${privacy}`);
    console.log(`title     ${metadata.snippet.title}  (${metadata.snippet.title.length}/${TITLE_MAX})`);
    console.log(`tags      ${metadata.snippet.tags.join(', ')}`);
    console.log(`\ndescription\n${metadata.snippet.description.replace(/^/gm, '  ')}`);
    return;
  }

  const token = await accessToken();
  if (!token) {
    console.error(
      '✗ no channel credentials — nothing was uploaded.\n\n' +
        '   Publishing needs three secrets, granted once by the channel owner:\n' +
        '     YOUTUBE_CLIENT_ID · YOUTUBE_CLIENT_SECRET · YOUTUBE_REFRESH_TOKEN\n\n' +
        '   Create an OAuth client (type: Desktop) in a Google Cloud project with the\n' +
        '   YouTube Data API v3 enabled, consent once to the youtube.upload scope, and\n' +
        '   keep the refresh token. Until then: --dry-run prints exactly what would go up.',
    );
    process.exit(1);
  }

  console.log(`${id} → YouTube, ${privacy}, ${(video.size / 1e6).toFixed(1)} MB…`);
  const result = await upload({file: video.file, size: video.size, metadata, token});
  console.log(`✓ https://youtu.be/${result.id}  (${privacy})`);
  console.log(`  ${metadata.snippet.title}`);
}

// Only when run as a command; the tests import the refusals.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`✗ ${error?.message ?? error}`);
    process.exit(1);
  });
}
