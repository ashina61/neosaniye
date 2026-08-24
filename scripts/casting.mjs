#!/usr/bin/env node
/**
 * THE CASTING DESK — five commands, one question each.
 *
 *   npm run assets:briefs   -- --episode=baalbek   what has to be supplied, and why
 *   npm run assets:list                            what is in the inbox and what became of it
 *   npm run assets:match                           score the inbox against every open brief
 *   npm run assets:validate -- --id=…              can this be accepted, and what is missing
 *   npm run assets:report                          one page: what is still needed
 *
 * The whole point is that a person can answer "what do I have to go and find"
 * without reading any code, any config or any of the machine's own reports.
 */
import {readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

import {
  CASTING_FILE,
  INBOX_DIR,
  PROVENANCE_FIELDS,
  castingFor,
  countsOf,
  loadCasting,
  saveCasting,
} from '../acquire/casting.mjs';
import {inboxFiles, matchFile, provenanceVerdict} from '../acquire/ingest.mjs';
import {normalise} from '../acquire/normalise.mjs';
import {briefPlate, compositionPreview} from '../acquire/preview.mjs';
import {episodeDir, exists, parseArgs} from './lib/episode.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const rel = (p) => path.relative(ROOT, p);

const BAR = '─'.repeat(78);

/* ------------------------------------------------------------------ briefs */

async function cmdBriefs(args) {
  const ids = typeof args.episode === 'string' ? args.episode.split(',').map((s) => s.trim()) : [];
  if (!ids.length) {
    console.error('Usage: npm run assets:briefs -- --episode=<id>[,<id>…] [--plates]');
    process.exit(1);
  }
  let all = [];
  for (const id of ids) {
    const dir = episodeDir(id);
    if (!(await exists(path.join(dir, 'assets.required.json')))) {
      console.error(`✗ ${id} — no assets.required.json; run scripts/asset-manifest.mjs first`);
      continue;
    }
    all = all.concat(await castingFor(id, {episodeDir: dir}));
  }
  const doc = await saveCasting(all, {episodes: ids});

  /** Optional: the empty plate a person can take out with a camera. */
  if (args.plates === true || args.plates === 'true') {
    for (const brief of doc.briefs) {
      const {plate} = await briefPlate(sharp, brief);
      console.log(`  plate → ${rel(plate)}`);
    }
  }

  printBriefs(doc);
  console.log(`\nwritten → ${rel(CASTING_FILE)}`);
}

function printBriefs(doc) {
  console.log(`\n${BAR}\nASSET REQUEST LIST — ${doc.episodes.join(', ')}\n${BAR}`);
  const c = doc.counts;
  console.log(
    `${c.total} asset(s) requested · ${c.blocking} BLOCKING · ${c.wouldStrengthen} would strengthen · ` +
      `${c.optional} optional · ${c.stillNeeded} still needed\n`,
  );

  for (const [i, b] of doc.briefs.entries()) {
    const shot = b.shotRequirements;
    console.log(`${BAR}`);
    console.log(`${String(i + 1).padStart(2)}. ${b.id}    [${b.status}]  ${b.priority.toUpperCase()}`);
    console.log(`    line says   “${b.says}”`);
    console.log(`    subject     ${b.subject}  (${b.domain})`);
    console.log(`    purpose     ${b.purpose}`);
    console.log(`    currently   ${b.currently}`);
    console.log(`    shots       ${b.shot.join(', ')}`);
    console.log(`\n    MUST SHOW`);
    for (const m of b.must_show) console.log(`      • ${m}`);
    console.log(`\n    MUST NOT SHOW`);
    for (const r of b.reject_if) console.log(`      ✗ ${r}`);
    console.log(`\n    ORIENTATION ${b.preferred_orientation}`);
    console.log(`    COMPOSITION ${b.preferred_composition}`);
    if (shot) {
      console.log(`\n    THE SHOT DEMANDS`);
      for (const d of shot.demands) console.log(`      → ${d}`);
    }
    const constraints = [
      b.historical_constraints ? `historical: ${b.historical_constraints}` : null,
      b.scientific_constraints ? `scientific: ${b.scientific_constraints}` : null,
    ].filter(Boolean);
    if (constraints.length) {
      console.log(`\n    CONSTRAINTS`);
      for (const c2 of constraints) console.log(`      ! ${c2}`);
    }
    console.log(`\n    SUBSTITUTE   ${b.acceptable_substitutes}`);
    console.log(`    LICENCE      ${b.license_requirements}`);
    console.log(`    PROVENANCE   ${PROVENANCE_FIELDS.join(', ')} — source and license are mandatory`);
    if (b.searchTerms?.length) console.log(`    TRY SEARCHING ${b.searchTerms.map((s) => `“${s}”`).join('  ')}`);
    console.log('');
  }
}

/* -------------------------------------------------------------------- list */

async function cmdList() {
  const doc = await loadCasting();
  const files = await inboxFiles();
  console.log(`\nINBOX  ${rel(INBOX_DIR)}\n${BAR}`);
  if (!files.length) console.log('  (empty — drop candidate images here; filenames carry no authority)');
  for (const f of files) {
    const known = (doc.briefs ?? []).flatMap((b) => b.candidates ?? []).find((c) => c.file === f.name);
    const state = known ? `${known.status ?? 'CANDIDATE'} → ${known.briefId ?? 'unassigned'}` : 'not yet matched';
    console.log(`  ${f.name.padEnd(44)} ${(f.bytes / 1024).toFixed(0).padStart(6)} KB   ${state}`);
  }
  console.log(`\nBRIEFS\n${BAR}`);
  for (const b of doc.briefs ?? []) {
    const mark = {OPEN: '○', CANDIDATE: '◐', PROVENANCE_REQUIRED: '◑', ACCEPTED: '●', REJECTED: '✗'}[b.status] ?? '?';
    console.log(`  ${mark} ${b.status.padEnd(20)} ${b.id.padEnd(28)} ${b.subject}`);
  }
  console.log('');
}

/* ------------------------------------------------------------------- match */

async function cmdMatch(args) {
  const doc = await loadCasting();
  const open = (doc.briefs ?? []).filter((b) => b.status === 'OPEN' || b.status === 'CANDIDATE');
  const files = await inboxFiles();
  if (!files.length) {
    console.log(`\nNothing in ${rel(INBOX_DIR)}. Drop candidate images there and run this again.`);
    return;
  }
  if (!open.length) {
    console.log('\nNo open briefs. Run `npm run assets:briefs -- --episode=<id>` first.');
    return;
  }
  const describe = typeof args.describe === 'string' ? args.describe : null;

  console.log(`\nMATCHING ${files.length} file(s) against ${open.length} open brief(s)\n${BAR}`);
  for (const file of files) {
    const result = await matchFile({sharp, file, briefs: open, describe});
    console.log(`\n${file.name}`);
    console.log(`  kept as   ${result.original}${result.reused ? '  (already held)' : ''}`);
    console.log(`  decision  ${result.decision.kind}${result.decision.briefId ? ` → ${result.decision.briefId}` : ''}`);
    if (result.decision.why) console.log(`            ${result.decision.why}`);
    console.log(`\n  ${'brief'.padEnd(28)}${'rank'.padStart(6)}${'sem'.padStart(6)}${'qual'.padStart(6)}${'comp'.padStart(6)}  gate`);
    for (const a of result.alternatives) {
      console.log(
        `  ${a.briefId.padEnd(28)}${String(a.rank).padStart(6)}${String(a.semantic).padStart(6)}` +
          `${String(a.quality).padStart(6)}${String(a.composition).padStart(6)}  ${a.passesSemanticGate ? 'pass' : 'REJECT'}`,
      );
      if (!a.passesSemanticGate && a === result.alternatives[0]) console.log(`      ${a.why}`);
    }
    if (result.needsConfirmation) {
      console.log(`\n  ⚠ A PERSON DECIDES. Confirm with:`);
      for (const id of result.decision.between) {
        console.log(`      npm run assets:validate -- --file=${file.name} --id=${id}`);
      }
    } else if (result.decision.kind === 'SUGGEST') {
      console.log(`\n  → npm run assets:validate -- --file=${file.name} --id=${result.decision.briefId}`);
    }

    /** Record the candidate so `list` and `report` can see it. */
    const brief = open.find((b) => b.id === (result.best?.briefId ?? null));
    if (brief) {
      brief.candidates = [
        ...(brief.candidates ?? []).filter((c) => c.file !== file.name),
        {
          file: file.name,
          hash: result.hash,
          original: result.original,
          rank: result.best?.rank ?? null,
          semantic: result.best?.semantic ?? null,
          quality: result.best?.quality ?? null,
          composition: result.best?.composition ?? null,
          status: result.needsConfirmation ? 'NEEDS_CONFIRMATION' : 'CANDIDATE',
          alternatives: result.alternatives.slice(0, 3).map((a) => ({briefId: a.briefId, rank: a.rank})),
        },
      ];
      if (brief.status === 'OPEN') brief.status = 'CANDIDATE';
    }
  }
  await saveCasting(doc.briefs, {episodes: doc.episodes ?? []});
  console.log(`\nupdated → ${rel(CASTING_FILE)}\n`);
}

/* ---------------------------------------------------------------- validate */

async function cmdValidate(args) {
  const doc = await loadCasting();
  const id = typeof args.id === 'string' ? args.id : null;
  const fileName = typeof args.file === 'string' ? args.file : null;
  if (!id || !fileName) {
    console.error('Usage: npm run assets:validate -- --file=<inbox file> --id=<episode/line> [--source=… --license=… --creator=… --sourceUrl=… --licenseUrl=… --notes=…]');
    process.exit(1);
  }
  const brief = (doc.briefs ?? []).find((b) => b.id === id);
  if (!brief) {
    console.error(`✗ no brief with id "${id}" — run \`npm run assets:briefs\` to see the list`);
    process.exit(1);
  }
  const files = await inboxFiles();
  const file = files.find((f) => f.name === fileName);
  if (!file) {
    console.error(`✗ "${fileName}" is not in ${rel(INBOX_DIR)}`);
    process.exit(1);
  }

  const {preserve} = await import('../acquire/ingest.mjs');
  const {hash, original, buffer} = await preserve(file);
  const {scoreQuality, qualityVerdict} = await import('../acquire/score/quality.mjs');
  const {compositionVerdict} = await import('../acquire/score/composition.mjs');
  const {scoreAgainst} = await import('../acquire/ingest.mjs');

  const describe = typeof args.describe === 'string' ? args.describe : null;
  const withText = describe ? {...brief, humanDescription: describe} : brief;
  const quality = await scoreQuality(sharp, buffer, withText);
  const scored = await scoreAgainst({sharp, buffer, brief: withText, quality});

  /** Provenance from the command line — never inferred from the file. */
  const provenance = {...brief.provenance};
  for (const field of PROVENANCE_FIELDS) {
    if (typeof args[field] === 'string') provenance[field] = args[field];
  }
  if (!provenance.retrievalDate && (provenance.source || provenance.license)) {
    provenance.retrievalDate = new Date().toISOString().slice(0, 10);
  }

  console.log(`\n${BAR}\nVALIDATING ${fileName}  →  ${id}\n${BAR}`);
  const gates = [
    ['semantic', scored.verdict.ok, scored.verdict.why, `relevance ${scored.semantic.relevance}/10, accuracy ${scored.semantic.accuracy}/10`],
    ['quality', qualityVerdict(quality).ok, qualityVerdict(quality).why, `${quality.score}/10 (worst axis ${quality.worst})`],
    ['composition', compositionVerdict(scored.composition).ok, compositionVerdict(scored.composition).why, `${scored.composition.score}/10`],
  ];
  const prov = provenanceVerdict(provenance);
  gates.push(['provenance', prov.ok, prov.why, prov.ok ? `${prov.family}${prov.needsCredit ? ', credit required' : ''}` : null]);

  for (const [name, ok, why, detail] of gates) {
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(12)} ${detail ?? ''}`);
    if (!ok && why) console.log(`        ${why}`);
  }
  for (const note of [...scored.semantic.notes, ...quality.notes, ...scored.composition.notes]) {
    console.log(`        · ${note}`);
  }

  /** The preview goes out whatever the verdict: it is how a person checks. */
  const {preview} = await compositionPreview(sharp, {buffer, brief, hash});
  console.log(`\n  preview → ${rel(preview)}   (open it: scores cannot see composition)`);

  const passed = gates.every(([, ok]) => ok);
  const semanticOk = gates[0][1] && gates[1][1] && gates[2][1];

  if (passed) {
    const processed = await normalise(sharp, {
      buffer,
      brief,
      hash,
      options: {alpha: args.alpha === true, removeBackground: args.removeBackground === true, focus: focusFrom(args)},
    });
    brief.status = 'ACCEPTED';
    brief.provenance = provenance;
    brief.accepted = {
      assetId: hash,
      briefId: brief.id,
      episode: brief.episode,
      shot: brief.shot,
      originalFile: rel(original),
      processedFile: rel(processed.processed),
      previewFile: rel(preview),
      source: provenance.source,
      sourceUrl: provenance.sourceUrl,
      creator: provenance.creator,
      license: provenance.license,
      licenseUrl: provenance.licenseUrl,
      semanticScore: scored.semantic.relevance,
      qualityScore: quality.score,
      compositionScore: scored.composition.score,
      acceptedAt: new Date().toISOString(),
      normalisation: processed.steps,
    };
    console.log(`\n  ACCEPTED`);
    console.log(`  processed → ${rel(processed.processed)}`);
    for (const s of processed.steps) console.log(`      · ${s}`);
    console.log(`  the original at ${rel(original)} was not modified`);
  } else if (semanticOk && !prov.ok && prov.status === 'PROVENANCE_REQUIRED') {
    brief.status = 'PROVENANCE_REQUIRED';
    brief.provenance = provenance;
    console.log(`\n  PROVENANCE_REQUIRED — the picture is right and we do not know where it came from.`);
    console.log(`  Supply it and run again:`);
    console.log(`      npm run assets:validate -- --file=${fileName} --id=${id} \\`);
    console.log(`        --source="Wikimedia Commons" --sourceUrl="https://…" \\`);
    console.log(`        --creator="…" --license="CC BY-SA 4.0" --licenseUrl="https://…"`);
    console.log(`\n  No licence will be inferred from the file.`);
  } else {
    brief.status = 'REJECTED';
    console.log(`\n  REJECTED — see the failing gate above.`);
  }

  await saveCasting(doc.briefs, {episodes: doc.episodes ?? []});
  await writeManifest(doc);
  console.log(`\nupdated → ${rel(CASTING_FILE)}\n`);
}

function focusFrom(args) {
  if (typeof args.focus !== 'string') return undefined;
  const [x, y] = args.focus.split(',').map(Number);
  return Number.isFinite(x) && Number.isFinite(y) ? {x, y} : undefined;
}

/* ------------------------------------------------------------------ report */

async function cmdReport() {
  const doc = await loadCasting();
  const briefs = doc.briefs ?? [];
  if (!briefs.length) {
    console.log('\nNo casting manifest yet. Run `npm run assets:briefs -- --episode=<id>`.\n');
    return;
  }
  const c = countsOf(briefs);
  console.log(`\n${BAR}\nWHAT IS STILL MISSING — ${(doc.episodes ?? []).join(', ')}\n${BAR}`);
  console.log(`${c.total} requested · ${c.total - c.stillNeeded} accepted · ${c.stillNeeded} still needed · ${c.blocking} BLOCKING\n`);

  const groups = {
    BLOCKING: briefs.filter((b) => b.status !== 'ACCEPTED' && b.priority === 'BLOCKING'),
    'WOULD STRENGTHEN': briefs.filter((b) => b.status !== 'ACCEPTED' && b.priority !== 'BLOCKING'),
    ACCEPTED: briefs.filter((b) => b.status === 'ACCEPTED'),
  };
  for (const [heading, list] of Object.entries(groups)) {
    if (!list.length) continue;
    console.log(`${heading}  (${list.length})`);
    for (const b of list) {
      console.log(`  ${b.status.padEnd(20)} ${b.id.padEnd(26)} ${b.subject.padEnd(14)} ${(b.must_show[0] ?? '').slice(0, 42)}`);
      if (b.status === 'PROVENANCE_REQUIRED') {
        const missing = ['source', 'license'].filter((f) => !b.provenance?.[f]);
        console.log(`  ${' '.repeat(20)} needs: ${missing.join(', ')}`);
      }
    }
    console.log('');
  }
  console.log(`full detail → ${rel(CASTING_FILE)}\n`);
}

/**
 * The accepted set, in the shape the acquisition manifest already uses, so a
 * hand-cast asset and a fetched one are the same kind of record downstream.
 */
async function writeManifest(doc) {
  const byEpisode = new Map();
  for (const brief of doc.briefs ?? []) {
    if (brief.status !== 'ACCEPTED' || !brief.accepted) continue;
    if (!byEpisode.has(brief.episode)) byEpisode.set(brief.episode, []);
    byEpisode.get(brief.episode).push(brief.accepted);
  }
  for (const [episode, assets] of byEpisode) {
    const file = path.join(episodeDir(episode), 'ASSET_MANIFEST.json');
    let existing = {episode, assets: []};
    try {
      existing = JSON.parse(await readFile(file, 'utf8'));
    } catch {
      /* first write */
    }
    const fetched = (existing.assets ?? []).filter((a) => !a.briefId);
    await writeFile(
      file,
      `${JSON.stringify(
        {
          ...existing,
          episode,
          generatedAt: new Date().toISOString(),
          castByHand: assets.length,
          assets: [...fetched, ...assets],
        },
        null,
        2,
      )}\n`,
      'utf8',
    );
  }
}

/* --------------------------------------------------------------------- run */

const COMMANDS = {briefs: cmdBriefs, list: cmdList, match: cmdMatch, validate: cmdValidate, report: cmdReport};

async function main() {
  const args = parseArgs();
  const command = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : args._?.[0];
  const run = COMMANDS[command];
  if (!run) {
    console.error(`Usage: node scripts/casting.mjs <${Object.keys(COMMANDS).join('|')}> [options]`);
    process.exit(1);
  }
  await run(args);
}

await main();
