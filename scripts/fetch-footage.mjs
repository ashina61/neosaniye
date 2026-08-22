#!/usr/bin/env node
/**
 * MOVING PICTURES THAT ARE NOT SOMEBODY ELSE'S.
 *
 * This engine stacks stills and draws over them, and that is still what it is
 * best at. But a shot may now carry a CLIP in the same slot — same anchor, same
 * depth, same grade — and the moment that exists, the question is where the
 * clip comes from. There is exactly one wrong answer and it is the obvious one:
 *
 *   DOWNLOADING A VIDEO SOMEBODY POSTED AND NARRATING OVER IT IS A REUPLOAD.
 *
 * Not a grey area, not a matter of how much you changed: a repair clip lifted
 * off a feed is the creator's work, Content ID finds it, and the strike lands
 * on the channel doing the uploading. The pipeline must not make that easy, so
 * this script cannot do it — it talks to libraries that license reuse, and to
 * nothing else:
 *
 *   PEXELS   free to use and to modify, no attribution required (given anyway).
 *            Needs a free key in PEXELS_API_KEY.
 *   COMMONS  the same licence check the still fetcher runs: public domain, CC0,
 *            CC BY and CC BY-SA in, NC and ND refused. Credit is mandatory and
 *            it is written where the publisher can find it.
 *
 * Your own recording needs none of this: drop it in the episode's assets folder
 * under the name the brief gave it and this step has nothing to do.
 *
 *   node scripts/fetch-footage.mjs --episode=<id>
 *
 * A recipe asks for footage by saying `stock` instead of `prompt`:
 *
 *   "s02-bench.mp4": {"kind": "footage", "stock": ["hands repairing a watch"]}
 */
import {mkdir, readFile, writeFile, stat} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {ROOT, episodeDir, exists, parseArgs} from './lib/episode.mjs';
import {isFree} from './fetch-commons.mjs';

const UA = 'crime-reels/1.0 (episode footage fetcher; https://github.com/ashina61/neosaniye)';
/** Vertical reel. A landscape clip in a 1080x1920 frame is letterboxed or cropped to mush. */
const WANT_PORTRAIT = true;
/** Below this a clip is a thumbnail once it fills the frame. */
const MIN_HEIGHT = 900;

/**
 * PEXELS. The response carries several encodings of one clip; take the smallest
 * that is still big enough, because a 4K file is thirty seconds of download and
 * a 1080-wide frame throws all of it away.
 */
async function fromPexels(query) {
  const key = process.env.PEXELS_API_KEY;
  // SAY WHICH DOOR WAS LOCKED. Returning null here let the run fall through to
  // Commons, find nothing there either, and report "nothing licensed came
  // back" — which reads as "your searches are bad" when the truth is that the
  // biggest library was never asked.
  if (!key) throw new Error('no PEXELS_API_KEY — the largest free library was not asked');
  const url =
    `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}` +
    `&per_page=15${WANT_PORTRAIT ? '&orientation=portrait' : ''}`;
  const response = await fetch(url, {headers: {Authorization: key, 'User-Agent': UA}, signal: AbortSignal.timeout(60_000)});
  if (!response.ok) throw new Error(`Pexels HTTP ${response.status}`);
  const body = await response.json();
  for (const video of body?.videos ?? []) {
    const files = (video.video_files ?? [])
      .filter((f) => (f.height ?? 0) >= MIN_HEIGHT && /mp4/i.test(f.file_type ?? ''))
      .sort((a, b) => (a.height ?? 0) - (b.height ?? 0));
    if (!files.length) continue;
    return {
      url: files[0].link,
      credit: `${video.user?.name ?? 'unknown'} — Pexels (free to use), ${video.url}`,
      seconds: video.duration ?? 0,
    };
  }
  return null;
}

/** COMMONS, with the same licence refusal the still fetcher runs. */
async function fromCommons(query) {
  const api =
    'https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*' +
    `&generator=search&gsrsearch=${encodeURIComponent(`filetype:video ${query}`)}` +
    '&gsrnamespace=6&gsrlimit=15&prop=imageinfo&iiprop=url|size|mime|extmetadata';
  const response = await fetch(api, {headers: {'User-Agent': UA}, signal: AbortSignal.timeout(60_000)});
  if (!response.ok) throw new Error(`Commons HTTP ${response.status}`);
  const pages = Object.values((await response.json())?.query?.pages ?? {});
  for (const page of pages) {
    const info = page?.imageinfo?.[0];
    if (!info || !/^video\//.test(info.mime ?? '')) continue;
    if (!isFree(info.extmetadata)) continue;
    if ((info.height ?? 0) < MIN_HEIGHT) continue;
    const author = String(info.extmetadata?.Artist?.value ?? 'unknown').replace(/<[^>]+>/g, '').trim();
    const licence = info.extmetadata?.LicenseShortName?.value ?? 'see source';
    return {url: info.url, credit: `${author} — ${licence}, ${info.descriptionurl ?? info.url}`, seconds: 0};
  }
  return null;
}

async function download(url, target) {
  const response = await fetch(url, {headers: {'User-Agent': UA}, signal: AbortSignal.timeout(15 * 60_000)});
  if (!response.ok) throw new Error(`download HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  // A politely-failed download is an HTML page with a 200 on it. A clip is not
  // fifty kilobytes, and finding that out here beats finding it out in a render.
  if (bytes.length < 100_000) throw new Error(`${bytes.length} bytes came back — that is not a clip`);
  await mkdir(path.dirname(target), {recursive: true});
  await writeFile(target, bytes);
  return bytes.length;
}

/** Credit travels with the reel: the publisher refuses an episode without it. */
async function addCredit(dir, entry) {
  const file = path.join(dir, 'assets', 'CREDITS.md');
  const existing = await readFile(file, 'utf8').catch(() => '# Credits\n\n');
  if (existing.includes(entry)) return;
  await writeFile(file, `${existing.trimEnd()}\n${entry}\n`, 'utf8');
}

async function main() {
  const args = parseArgs();
  const id = typeof args.episode === 'string' ? args.episode : null;
  if (!id) {
    console.error('✗ which episode? node scripts/fetch-footage.mjs --episode=<id>');
    process.exit(1);
  }
  const dir = episodeDir(id);
  const recipes = JSON.parse(await readFile(path.join(dir, 'assets.json'), 'utf8').catch(() => '{}'));
  const wanted = Object.entries(recipes?.assets ?? {}).filter(([, recipe]) => recipe?.kind === 'footage');

  if (!wanted.length) {
    console.log(`${id} asks for no footage — nothing to fetch.`);
    return;
  }

  let got = 0;
  let failed = 0;
  for (const [name, recipe] of wanted) {
    const target = path.join(dir, 'assets', name);
    if ((await exists(target)) && !args.force) {
      const {size} = await stat(target);
      console.log(`  = ${name} (${(size / 1e6).toFixed(1)} MB, already here)`);
      got += 1;
      continue;
    }
    let found = null;
    let why = '';
    let keyless = false;
    for (const query of [].concat(recipe.stock ?? [])) {
      for (const source of [fromPexels, fromCommons]) {
        try {
          found = await source(query);
        } catch (error) {
          why = String(error?.message ?? error);
          if (/PEXELS_API_KEY/.test(why)) keyless = true;
        }
        if (found) break;
      }
      if (found) break;
    }
    if (!found) {
      failed += 1;
      console.error(
        keyless
          ? `  ✗ ${name} — no PEXELS_API_KEY is set, and Commons has no free video for ${JSON.stringify(recipe.stock)}`
          : `  ✗ ${name} — nothing licensed came back for ${JSON.stringify(recipe.stock)}${why ? ` (${why})` : ''}`,
      );
      continue;
    }
    const size = await download(found.url, target);
    await addCredit(dir, `- \`${name}\` — ${found.credit}`);
    got += 1;
    console.log(`  ✓ ${name} (${(size / 1e6).toFixed(1)} MB) — ${found.credit}`);
  }

  console.log(`\n${got}/${wanted.length} clip(s) in place for ${id}.`);
  if (!process.env.PEXELS_API_KEY && got < wanted.length) {
    console.error(
      '\n   PEXELS_API_KEY is not set on this run. A free key from pexels.com/api,\n' +
        '   saved as a repository secret, is what the stock half of this step needs.',
    );
  }
  if (failed) {
    console.error(
      '\n   What is missing has to be supplied, not invented: drop your own recording into\n' +
        `   ${path.relative(ROOT, path.join(dir, 'assets'))} under the name the brief gave it.\n` +
        '   Do NOT reach for a clip off a feed — narrating over somebody\'s upload is a reupload,\n' +
        '   and the strike lands on the channel that posted it.',
    );
    process.exit(2);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`✗ ${error?.message ?? error}`);
    process.exit(1);
  });
}
