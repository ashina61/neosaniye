#!/usr/bin/env node
/**
 * AUDIT — score every asset in an episode against the role it plays.
 *
 *   npm run assets:audit -- --episode=<id> [--template]
 *
 * Prints the technical axes for each file and, where the ledger has been
 * filled in, the combined verdict. `--template` writes a skeleton
 * `assets.review.json` with the measurements baked in and the semantic fields
 * left blank, so reviewing an episode is filling in three numbers per file
 * while looking at `npm run assets:review`'s contact sheet.
 *
 * WHY A HUMAN-OR-MODEL LEDGER RATHER THAN A CLEVERER SCRIPT. Whether a cabinet
 * is a MUSEUM cabinet is not in the histogram. Every measurable axis in here
 * was green for the Victorian sideboard that shipped as museum storage: sharp,
 * well exposed, high resolution, plenty of structure. The only thing wrong with
 * it was what it was a photograph OF, and that is a question about the world,
 * not about the file.
 */
import {readdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {ROOT, episodeDir, loadConfig, parseArgs} from './lib/episode.mjs';
import {
  colourAxis,
  colourCentre,
  judge,
  loadReview,
  measureAsset,
  technicalAxes,
} from './lib/assetdirector.mjs';

/** role -> kind, read off the recipes the episode already carries. */
async function kindsOf(dir) {
  const recipes = await import(path.join(dir, 'assets.json'), {with: {type: 'json'}}).catch(() => null);
  const table = recipes?.default?.assets ?? {};
  const out = {};
  for (const [file, recipe] of Object.entries(table)) out[file] = recipe.kind ?? 'backdrop';
  return out;
}

async function main() {
  const args = parseArgs();
  const episodeId = typeof args.episode === 'string' ? args.episode : null;
  if (!episodeId) {
    console.error('Usage: npm run assets:audit -- --episode=<episode-id> [--template]');
    process.exit(1);
  }

  const dir = episodeDir(episodeId);
  const assetDir = path.join(dir, 'assets');
  const files = (await readdir(assetDir)).filter((f) => /\.(png|jpe?g|webp)$/i.test(f)).sort();
  if (!files.length) {
    console.error(`no assets under ${path.relative(ROOT, assetDir)}`);
    process.exit(1);
  }

  const kinds = await kindsOf(dir);
  const review = await loadReview(dir);

  // WHICH ROLE EACH FILE ACTUALLY PLAYS, read off the cut rather than guessed:
  // the same file can be a backdrop in one scene and a subject in another, and
  // it is only wrong relative to a role.
  const roles = {};
  const {config} = await loadConfig(episodeId).catch(() => ({config: null}));
  for (const scene of config?.scenes ?? []) {
    for (const [role, file] of Object.entries(scene.assets ?? {})) {
      const base = path.basename(String(file));
      (roles[base] ??= new Set()).add(role.replace(/^\?/, ''));
    }
  }

  const measurements = {};
  for (const file of files) {
    measurements[file] = await measureAsset(sharp, path.join(assetDir, file), {
      width: config?.width ?? 1080,
      height: config?.height ?? 1920,
    });
  }
  const centre = colourCentre(measurements);

  console.log(`\n${episodeId} — ${files.length} asset(s), colour centre ${JSON.stringify(centre)}\n`);
  const report = [];
  for (const file of files) {
    const m = measurements[file];
    const kind = kinds[file] ?? 'backdrop';
    const role = [...(roles[file] ?? ['(unused)'])].join('/');
    const verdict = judge({
      file,
      role,
      kind,
      measured: m,
      reviewed: review[file],
      episodeColour: centre,
    });
    report.push(verdict);

    const tech = technicalAxes(m, kind);
    const flag =
      verdict.verdict === 'reject' ? '✗ REJECT' : verdict.verdict === 'recast' ? '→ RECAST' : verdict.verdict === 'warn' ? '⚠ WEAK  ' : '✓ USE   ';
    console.log(`${flag} ${file}`);
    console.log(
      `         role=${role} kind=${kind} ${m.width}x${m.height} ` +
        `keptInCrop=${m.keptInCrop} bright=${m.brightness} contrast=${m.contrast}`,
    );
    console.log(
      `         res ${tech.resolution} · exposure ${tech.exposure} · quality ${tech.quality} · ` +
        `composition ${tech.composition} · animatable ${tech.animationPotential} · ` +
        `colour ${colourAxis(m, centre)}`,
    );
    if (verdict.reviewed) {
      console.log(
        `         DEPICTS "${verdict.depicts}" — relevance ${verdict.axes.relevance} accuracy ` +
          `${verdict.axes.accuracy} subject ${verdict.axes.subject} → SCORE ${verdict.score}`,
      );
      if (verdict.recastAs) console.log(`         recast as: ${verdict.recastAs}`);
      if (verdict.note) console.log(`         note: ${verdict.note}`);
    } else {
      console.log(`         UNREVIEWED — semantic axes unknown, technical score only`);
    }
    if (verdict.brief) {
      console.log(`         ASSET_REQUIRED: ${verdict.brief.subject}`);
    }
    console.log('');
  }

  if (args.template) {
    const skeleton = {};
    for (const file of files) {
      skeleton[file] = review[file] ?? {
        depicts: '',
        relevance: null,
        accuracy: null,
        subject: null,
        recastAs: null,
        needed: '',
        note: '',
      };
    }
    const out = path.join(dir, 'assets.review.json');
    await writeFile(out, `${JSON.stringify(skeleton, null, 2)}\n`);
    console.log(`wrote ${path.relative(ROOT, out)} — fill in depicts/relevance/accuracy/subject`);
  }

  const rejected = report.filter((r) => r.verdict === 'reject');
  const recast = report.filter((r) => r.verdict === 'recast');
  const unreviewed = report.filter((r) => !r.reviewed);
  console.log(
    `${report.length} asset(s): ${rejected.length} rejected, ${recast.length} to recast, ` +
      `${unreviewed.length} unreviewed`,
  );
}

main().catch((error) => {
  console.error(error?.stack || error?.message || error);
  process.exit(1);
});
