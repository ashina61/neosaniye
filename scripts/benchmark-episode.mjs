#!/usr/bin/env node
/**
 * THE BENCHMARK — what the pipeline actually produced, as numbers plus a verdict.
 *
 * Two halves, kept apart on purpose.
 *
 * MEASURED is computed from the finished config and the director's log: the
 * representation mix, the cut mix, the camera distribution, the densities, the
 * temporal result, the defects still standing. Nothing here is an opinion and
 * nothing here can be argued with.
 *
 * JUDGED is a person looking at the rendered frames and scoring thirteen
 * things out of ten. It lives in `episodes/<id>/benchmark-notes.json`, written
 * by whoever did the looking, and it is kept separate because it is exactly the
 * part the measurements cannot reach. Every reel this repo has shipped broken
 * passed the measurements.
 *
 * The final score is the JUDGED professionalism, not an average of the two.
 * Averaging a technical pass into a visual verdict is how "seven photographs
 * being slowly scaled" scored well enough to ship.
 *
 *   node scripts/benchmark-episode.mjs --episode=baalbek
 */
import {readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {episodeDir, exists, loadConfig, parseArgs} from './lib/episode.mjs';
import {cameraFamily, critiqueDirection, critiqueEpisode, clippingProblems, endingProblems, qualityGates, representationMix} from './lib/critique.mjs';
import {temporalProblems} from './lib/temporal.mjs';
import {editReel, informationDensity, motionDensity} from './lib/editor.mjs';
import {cutMix} from './lib/cut.mjs';

const round = (n, p = 2) => Number(Number(n).toFixed(p));

async function readJson(file) {
  return (await exists(file)) ? JSON.parse(await readFile(file, 'utf8')) : null;
}

export async function benchmark(episodeId) {
  const dir = episodeDir(episodeId);
  const {config} = await loadConfig(episodeId);
  const report = await readJson(path.join(dir, 'director-report.json'));
  const brief = await readJson(path.join(dir, 'brief.json'));
  const notes = await readJson(path.join(dir, 'benchmark-notes.json'));

  const fps = config.fps ?? 30;
  const scenes = config.scenes ?? [];
  const frames = scenes.reduce((n, s) => n + s.durationInFrames, 0);

  const assets = Object.fromEntries((report?.assets?.decisions ?? []).map((d) => [d.file, d]));
  const gates = qualityGates(config, {assets});
  const edit = editReel(config);
  const temporal = temporalProblems(config);
  const critique = critiqueEpisode(config);
  const direction = critiqueDirection(config, {assets, story: report?.beats ?? []});
  const clipped = clippingProblems(config);
  const ending = endingProblems(config);

  /** How each shot chose to show its idea. The headline of the whole exercise. */
  const mix = representationMix(config);

  /** Cameras, counted by what the director RECORDED choosing. */
  const camera = {};
  for (const scene of scenes) {
    const kind = cameraFamily(scene) ?? 'none';
    camera[kind] = (camera[kind] ?? 0) + 1;
  }

  /** Arrivals, counted by what the viewer sees rather than what was asked for. */
  const arrivals = {};
  for (const scene of scenes.slice(1)) {
    const kind = scene.transition?.kind ?? 'cut';
    arrivals[kind] = (arrivals[kind] ?? 0) + 1;
  }

  const cuts = cutMix((report?.shots ?? []).map((s) => s.cut).filter(Boolean));

  const density = motionDensity(scenes, {fps});
  const info = informationDensity(scenes, {fps});

  /**
   * ASSETS ASKED FOR, AND ASSETS REFUSED.
   *
   * A line that named a picture and did not get one is a REJECTION, whether it
   * was refused for being the wrong picture or was never obtainable. Both end
   * at the same place in the ladder, and counting only the first would report
   * an episode with no supply at all as having rejected nothing.
   */
  const requested = (brief?.lines ?? []).filter((l) => l.image || l.imageCommons?.length || l.shot?.layers?.length).length;
  const scored = report?.assets?.decisions ?? [];
  const refusedByScore = scored.filter((d) => d.verdict === 'reject' || d.verdict === 'REJECT').length;
  const used = new Set(scenes.flatMap((s) => Object.values(s.assets ?? {}).map((f) => String(f).split('/').pop())));

  const measured = {
    shots: scenes.length,
    seconds: round(frames / fps),
    averageShotSeconds: round(frames / fps / Math.max(1, scenes.length)),
    representationMix: mix,
    proceduralVisuals: scenes.filter((s) => s.diagram && !Object.keys(s.assets ?? {}).length).length,
    hybridVisuals: scenes.filter((s) => s.diagram && Object.keys(s.assets ?? {}).length).length,
    diagramKinds: [...new Set(scenes.map((s) => s.diagram?.type).filter(Boolean))],
    assets: {
      linesRequestingAPicture: requested,
      picturesOnScreen: used.size,
      rejectedOnScore: refusedByScore,
      unavailable: requested - used.size - refusedByScore,
      rejectionCount: requested - used.size,
    },
    editorial: {
      hardCutRatio: cuts.hardRatio,
      cutKinds: cuts.tally,
      arrivals,
      transitionRatio: round(Object.entries(arrivals).reduce((n, [k, v]) => (k === 'cut' ? n : n + v), 0) / Math.max(1, scenes.length - 1)),
    },
    cameraDistribution: camera,
    motionDensity: {
      events: density.reduce((n, d) => n + d.events, 0),
      perSecond: round(density.reduce((n, d) => n + d.events, 0) / Math.max(1, frames / fps)),
      deadShots: density.filter((d) => d.events === 0).length,
      busiestMoment: density.reduce((n, d) => Math.max(n, d.busiest), 0),
    },
    informationDensity: {
      words: info.reduce((n, i) => n + i.words, 0),
      wordsPerSecond: round(info.reduce((n, i) => n + i.words, 0) / Math.max(1, frames / fps)),
      unreadableCaptions: info.filter((i) => !i.readable).length,
    },
    rhythm: edit.rhythm,
    imageKindChangesPerCut: edit.variety,
    temporalConsistency: {
      errors: temporal.errors.length,
      warnings: temporal.warnings.length,
      clean: temporal.errors.length === 0,
    },
    gates: gates.gates,
    gatesFailed: gates.failed,
  };

  const remaining = [
    ...critique.errors.map((m) => ({severity: 'error', where: 'shot', what: m})),
    ...direction.errors.map((m) => ({severity: 'error', where: 'direction', what: m})),
    ...clipped.errors.map((m) => ({severity: 'error', where: 'geometry', what: m})),
    ...ending.errors.map((m) => ({severity: 'error', where: 'ending', what: m})),
    ...temporal.errors.map((m) => ({severity: 'error', where: 'temporal', what: m})),
    ...edit.errors.map((m) => ({severity: 'error', where: 'edit', what: m})),
    ...critique.warnings.map((m) => ({severity: 'warning', where: 'shot', what: m})),
    ...direction.warnings.map((m) => ({severity: 'warning', where: 'direction', what: m})),
    ...clipped.warnings.map((m) => ({severity: 'warning', where: 'geometry', what: m})),
    ...ending.warnings.map((m) => ({severity: 'warning', where: 'ending', what: m})),
    ...temporal.warnings.map((m) => ({severity: 'warning', where: 'temporal', what: m})),
    ...edit.warnings.map((m) => ({severity: 'warning', where: 'edit', what: m})),
    ...(notes?.remainingDefects ?? []).map((d) => ({severity: 'observed', where: 'inspection', ...d})),
  ];

  return {
    episode: episodeId,
    title: brief?.title ?? null,
    question: notes?.question ?? null,
    generatedAt: new Date().toISOString().slice(0, 10),
    /**
     * THE FINAL SCORE IS THE ONE A PERSON GAVE AFTER LOOKING.
     *
     * Not an average with the measurements. Everything this repo has shipped
     * broken passed the measurements; folding them in would only dilute the
     * one number that has ever caught anything.
     */
    finalScore: notes?.scores?.professionalism ?? null,
    scoredBy: notes ? 'inspection of rendered frames at 0/33/66/94 per shot' : 'NOT YET INSPECTED',
    judged: notes?.scores ?? null,
    verdict: notes?.verdict ?? null,
    whatWorked: notes?.whatWorked ?? [],
    whatFailed: notes?.whatFailed ?? [],
    measured,
    remainingDefects: remaining,
  };
}

async function main() {
  const args = parseArgs();
  const ids = typeof args.episode === 'string' ? args.episode.split(',') : [];
  if (!ids.length) {
    console.error('Usage: node scripts/benchmark-episode.mjs --episode=<id>[,<id>…]');
    process.exit(1);
  }
  for (const id of ids) {
    const out = await benchmark(id.trim());
    await writeFile(path.join(episodeDir(id.trim()), 'benchmark-report.json'), `${JSON.stringify(out, null, 2)}\n`, 'utf8');
    const m = out.measured;
    console.log(
      `✓ ${id.trim()} — ${m.shots} shots, ${m.seconds}s · ` +
        `${Object.entries(m.representationMix).filter(([, v]) => v).map(([k, v]) => `${v} ${k.toLowerCase()}`).join(' · ')} · ` +
        `plain cuts ${Math.round(m.editorial.hardCutRatio * 100)}% · ` +
        `${m.temporalConsistency.clean ? 'temporally clean' : `${m.temporalConsistency.errors} temporal error(s)`} · ` +
        `final ${out.finalScore ?? '—'}`,
    );
  }
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
