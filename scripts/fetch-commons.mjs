#!/usr/bin/env node
/**
 * REAL PICTURES OF REAL THINGS — Wikimedia Commons.
 *
 * A diffusion model asked for "a medieval illuminated map" invents one, and it
 * invents it badly: the lettering is nonsense and the thing it draws never
 * existed. But the Catalan Atlas DOES exist, it is photographed, and it is out
 * of copyright. Same for the Djinguereber Mosque, the Sahara, a 1969 police
 * bulletin. For anything with a NAME, fetching beats generating — it is more
 * accurate, it is free, and it is the same picture every run.
 *
 * So a recipe may say `commons` instead of, or as well as, `prompt`:
 *
 *   "s06-atlas-photo.png": {
 *     "kind": "photo",
 *     "commons": "Catalan Atlas Mansa Musa",
 *     "prompt": "a detail of a medieval illuminated map on vellum"
 *   }
 *
 * Commons is tried first; the prompt is the fallback when nothing free and
 * suitable comes back. Generation stays for scenery that has no name — an empty
 * dune, a foggy corner — which is exactly what it is good at.
 *
 * LICENSING IS NOT OPTIONAL. Commons hosts free files, not public ones: much of
 * it is CC BY or CC BY-SA, which REQUIRE credit wherever the work is published.
 * So anything that is not clearly free is refused rather than downloaded, and
 * every file that is kept writes its author, licence and source into
 * assets/CREDITS.md. Publishing without that is a licence breach, not an
 * oversight — and the credit has to travel with the reel, not sit in a repo.
 *
 *   node scripts/fetch-commons.mjs --episode=mansa-musa
 */
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import sharp from 'sharp';
import {ROOT, episodeDir, exists, parseArgs} from './lib/episode.mjs';
import {clearPlaceholders} from './lib/placeholders.mjs';

const API = 'https://commons.wikimedia.org/w/api.php';
/** Commons asks that automated clients identify themselves. */
const UA = 'crime-reels/1.0 (episode asset fetcher; https://github.com/ashina61/neosaniye)';

/**
 * Licences we may actually use.
 *
 * Public domain and CC0 need nothing. CC BY and CC BY-SA need credit, which is
 * why CREDITS.md exists. NC (non-commercial) and ND (no-derivatives) are
 * refused outright: a reel is a derivative work, and it may well be monetised.
 */
const FREE = /^(public domain|pd[- ]|cc0|cc[- ]by([- ]sa)?([- ]\d)?|attribution)/i;
const REFUSED = /(non[- ]?commercial|no ?derivat|fair ?use|copyright|all rights)/i;
/**
 * The same two refusals as abbreviations, which is how Commons actually writes
 * them: "CC BY-NC 4.0", "CC BY-NC-SA 3.0", "cc-by-nd-4.0". Spelling them out is
 * the rarer form, and without this they slip past on CC BY and get downloaded.
 * Bounded on both sides so it stays a licence token — "2nd", "and", "landscape"
 * are not licences.
 */
const REFUSED_TOKEN = /(?:^|[\s-])n[cd](?=$|[\s-])/i;

export function isFree(meta) {
  const short = meta?.LicenseShortName?.value ?? '';
  const terms = meta?.UsageTerms?.value ?? '';
  const id = meta?.License?.value ?? '';
  const text = `${short} ${terms} ${id}`;
  if (REFUSED.test(text) || REFUSED_TOKEN.test(short) || REFUSED_TOKEN.test(id)) return false;
  return FREE.test(short) || FREE.test(id) || FREE.test(terms);
}

/** Strip the HTML Commons puts in its metadata fields. */
const plain = (value) =>
  (value ?? '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();

async function search(query, limit = 20) {
  const url =
    `${API}?action=query&format=json&origin=*` +
    `&generator=search&gsrsearch=${encodeURIComponent(query)}` +
    `&gsrnamespace=6&gsrlimit=${limit}` +
    `&prop=imageinfo&iiprop=url|size|mime|extmetadata&iiurlwidth=2400`;

  const response = await fetch(url, {headers: {'User-Agent': UA}, signal: AbortSignal.timeout(60_000)});
  if (!response.ok) throw new Error(`Commons search failed: HTTP ${response.status}`);
  const body = await response.json();
  return Object.values(body?.query?.pages ?? {});
}

/**
 * Which candidate to take.
 *
 * Big enough to fill a 1080-wide frame without softening, and closest in shape
 * to the slot it has to fill — a panorama dropped into a portrait plate is
 * cropped to a stripe of its own middle, which is usually the least interesting
 * part of it.
 */
export function best(pages, targetRatio) {
  const scored = [];
  for (const page of pages) {
    const info = page?.imageinfo?.[0];
    if (!info) continue;
    if (!/^image\/(jpeg|png|webp)$/.test(info.mime ?? '')) continue;
    if ((info.width ?? 0) < 900) continue;
    if (!isFree(info.extmetadata)) continue;

    const ratio = info.width / info.height;
    const shape = Math.abs(Math.log(ratio / targetRatio));
    const size = Math.min(1, info.width / 2400);
    scored.push({page, info, score: size - shape * 1.4});
  }
  scored.sort((a, b) => b.score - a.score);
  return scored[0] ?? null;
}

async function main() {
  const args = parseArgs();
  const episodeId = typeof args.episode === 'string' ? args.episode : null;
  if (!episodeId) {
    console.error('Usage: node scripts/fetch-commons.mjs --episode=<episode-id> [--force]');
    process.exit(1);
  }

  const dir = episodeDir(episodeId);
  const recipes = JSON.parse(await readFile(path.join(dir, 'assets.json'), 'utf8'));
  const outDir = path.join(dir, 'assets');
  await mkdir(outDir, {recursive: true});

  const wanted = Object.entries(recipes.assets ?? {}).filter(([, r]) => r.commons);
  if (!wanted.length) {
    console.log(`${episodeId}: no recipes ask for Commons.`);
    return;
  }

  const fetched = [];
  const credits = [];
  const missed = [];

  for (const [name, recipe] of wanted) {
    const target = path.join(outDir, name);
    if (!args.force && (await exists(target)) && !recipe.$standIn) {
      // Same rule the generator uses: a stand-in is a hole, real artwork is not.
      const stubs = await readFile(path.join(outDir, '.placeholders.json'), 'utf8')
        .then((raw) => JSON.parse(raw).placeholders ?? [])
        .catch(() => []);
      if (!stubs.includes(name)) continue;
    }

    const kind = recipes.kinds?.[recipe.kind] ?? {width: 1080, height: 1920};
    const width = recipe.width ?? kind.width;
    const height = recipe.height ?? kind.height;
    process.stdout.write(`  ${name} ← "${recipe.commons}" … `);

    try {
      const pages = await search(recipe.commons);
      const choice = best(pages, width / height);
      if (!choice) {
        // Not an error: it means nothing free and large enough exists for that
        // search, and the recipe's prompt will draw it instead.
        console.log('nothing free found — leaving it to the generator');
        missed.push(name);
        continue;
      }

      const source = choice.info.thumburl ?? choice.info.url;
      const response = await fetch(source, {headers: {'User-Agent': UA}, signal: AbortSignal.timeout(120_000)});
      if (!response.ok) throw new Error(`download HTTP ${response.status}`);
      const raw = Buffer.from(await response.arrayBuffer());

      await writeFile(
        target,
        await sharp(raw).resize(width, height, {fit: 'cover', position: 'attention'}).png().toBuffer(),
      );

      const meta = choice.info.extmetadata ?? {};
      credits.push({
        file: name,
        title: plain(choice.page.title),
        author: plain(meta.Artist?.value) || 'Unknown',
        licence: plain(meta.LicenseShortName?.value) || 'see source',
        source: choice.info.descriptionurl ?? choice.info.url,
      });
      fetched.push(name);
      console.log(`ok — ${plain(meta.LicenseShortName?.value) || 'free'}`);
    } catch (error) {
      console.log(`FAILED — ${error.message}`);
      missed.push(name);
    }
  }

  if (fetched.length) {
    await clearPlaceholders(dir, fetched);

    // Credits are appended, never rewritten: files fetched on an earlier run
    // are still in the reel and still need their attribution.
    const file = path.join(outDir, 'CREDITS.md');
    const existing = await readFile(file, 'utf8').catch(
      () =>
        `# Image credits — ${episodeId}\n\n` +
        `Files below come from Wikimedia Commons. CC BY and CC BY-SA require this\n` +
        `credit wherever the reel is published — in the description, not only here.\n`,
    );
    const lines = credits
      .filter((c) => !existing.includes(c.file))
      .map((c) => `\n## ${c.file}\n- **${c.title}**\n- Author: ${c.author}\n- Licence: ${c.licence}\n- Source: ${c.source}\n`);
    if (lines.length) await writeFile(file, existing + lines.join(''), 'utf8');
  }

  console.log(`\n${fetched.length} fetched, ${missed.length} left to the generator.`);
  if (fetched.length) console.log(`credits → ${path.relative(ROOT, path.join(outDir, 'CREDITS.md'))}`);
}

// Only when run as a command; the tests import the licence filter from here.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error?.stack || error?.message || error);
    process.exit(1);
  });
}
