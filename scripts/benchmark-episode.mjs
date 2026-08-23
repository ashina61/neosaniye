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
import {representationProblems} from './lib/semantics.mjs';

const round = (n, p = 2) => Number(Number(n).toFixed(p));

/** Which material each drawing is treated with, for the report's roll-call. */
const MATERIAL_OF = {
  scaleHaulage: 'stone + wood',
  process: 'metal',
  crossSection: 'concrete + water',
  anatomyFlow: 'flesh',
  map: 'water + stone',
};

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
  const semantic = representationProblems(config);
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
    /**
     * THE LINE THE VOCABULARY EXPANSION IS JUDGED ON.
     *
     * Counted by KIND, because "procedural: 15" hides the whole question. The
     * benchmark asked whether the engine can show a place, a process, a body,
     * the inside of a material and the size of a thing, and this is where the
     * answer is either five numbers or five zeroes.
     */
    byRepresentation: {
      map: scenes.filter((s) => s.diagram?.type === 'map').length,
      process: scenes.filter((s) => s.diagram?.type === 'process').length,
      crossSection: scenes.filter((s) => s.diagram?.type === 'crossSection').length,
      anatomyFlow: scenes.filter((s) => s.diagram?.type === 'anatomyFlow').length,
      scaleHaulage: scenes.filter((s) => s.diagram?.type === 'scaleHaulage').length,
      olderDiagrams: scenes.filter((s) => ['gearSystem', 'timeline', 'measurement', 'orbit', 'scan'].includes(s.diagram?.type)).length,
      typographyOnly: scenes.filter((s) => !s.diagram && !Object.keys(s.assets ?? {}).length).length,
    },
    /** Every drawing's declared contract, so the claims can be argued with. */
    semanticContracts: scenes
      .filter((s) => s.diagram)
      .map((s) => ({shot: s.id, type: s.diagram.type, subject: s.diagram.subject ?? null, depicts: s.diagram.depicts ?? null, claims: s.diagram.claims ?? []})),
    semanticFailures: semantic.errors.length,
    representationRequired: semantic.warnings.filter((m) => m.includes('REPRESENTATION_REQUIRED')).length,
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
    /**
     * THE EXECUTION-LAYER NUMBERS.
     *
     * Added after the visual-quality phase, and deliberately counted from the
     * config rather than judged: how many planes a drawing is built on, which
     * materials appear, how many causal links exist, how many transformations,
     * how much of the camera work is a real move rather than a nominal one.
     * None of them is a score. They are the things a person would otherwise
     * have to count by hand while watching.
     */
    depth: {
      /** Drawings built on more than one plane. Every new primitive is. */
      layeredDrawings: scenes.filter((s) => ['map', 'process', 'crossSection', 'anatomyFlow', 'scaleHaulage'].includes(s.diagram?.type)).length,
      averagePlanes: round(
        scenes.reduce((n, s) => n + (['scaleHaulage', 'map'].includes(s.diagram?.type) ? 4 : s.diagram ? 2 : Object.keys(s.assets ?? {}).length ? (s.layers ?? []).length || 1 : 1), 0) /
          Math.max(1, scenes.length),
      ),
    },
    materials: [...new Set(scenes.map((s) => MATERIAL_OF[s.diagram?.type] ?? null).filter(Boolean))],
    causalAnimations: edit.causal.length,
    transformations: scenes.reduce((n, s) => n + Math.max(0, (s.diagram?.stages?.length ?? 1) - 1), 0),
    microMotion: scenes.filter((s) => ['scaleHaulage', 'process', 'map'].includes(s.diagram?.type)).length,
    meaningfulCameraMoves: scenes.filter((s) => {
      const kind = cameraFamily(s);
      const travel = Math.abs((Number(s.params?.pushTo) || 1) - (Number(s.params?.pushFrom) || 1));
      return kind && kind !== 'hold' && (travel > 0.08 || Math.abs(Number(s.params?.panX) || 0) > 60 || Math.abs(Number(s.params?.panY) || 0) > 80);
    }).length,
    payoff: edit.payoff,
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
    ...semantic.errors.map((m) => ({severity: 'error', where: 'semantic', what: m})),
    ...semantic.warnings.map((m) => ({severity: 'warning', where: 'semantic', what: m})),
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
        `${m.semanticFailures} semantic failure(s) · ` +
        `final ${out.finalScore ?? '—'}`,
    );
  }
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
