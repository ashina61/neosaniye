import path from 'node:path';
import { writeFile } from 'node:fs/promises';
import { expandTimelineForMedia } from '../pipeline/canonicalTimeline.js';
import { verifyFinalMedia, writeVerification, makeContactSheet } from '../pipeline/finalMediaVerification.js';
import { renderVideo } from './renderVideo.js';
import { buildVariantEditPlan, inspectProductionPlan, orderVariantMedia, VARIANT_PROFILES } from './productionPlan.js';

export async function renderProductionVariants(job, { outDir, width = 1080, height = 1920, fps = 30 } = {}) {
  const basePlan = inspectProductionPlan(job.media, job.timeline);
  if (!basePlan.ok) throw new Error(`VIEWER_MEDIA_PLAN_FAILED:${basePlan.failures.join(',')}`);
  const results = [];
  for (const name of Object.keys(VARIANT_PROFILES)) {
    const media = orderVariantMedia(job.media, name);
    const timeline = expandTimelineForMedia(job.timeline, media);
    const editPlan = buildVariantEditPlan(media, name);
    const outPath = path.join(outDir, `${name}.mp4`);
    const renderJob = {
      ...job, media, mediaScene: media.map((x) => x.scene), timeline, editPlan, outPath,
      musicSeed: `${job.musicSeed || 'neo'}:${VARIANT_PROFILES[name].musicSeedSuffix}`,
    };
    let rendered = await renderVideo(renderJob, { width, height, fps, workDir: path.join(outDir, `.render-${name}`) });
    let verification = await verifyFinalMedia({
      file: outPath, cues: rendered.sfxCues,
      plan: { ...rendered.renderPlan, sourceMovingSegments: basePlan.movingSegments, maxConsecutiveStatic: basePlan.maxConsecutiveStatic, captionsSafeArea: true },
      outDir, name, createEvidence: name === 'balanced',
    });
    if (verification.sfx.audibleCount < 2) {
      rendered = await renderVideo({ ...renderJob, sfxGain: 5 }, { width, height, fps, workDir: path.join(outDir, `.render-${name}-boost`) });
      verification = await verifyFinalMedia({
        file: outPath, cues: rendered.sfxCues,
        plan: { ...rendered.renderPlan, sourceMovingSegments: basePlan.movingSegments, maxConsecutiveStatic: basePlan.maxConsecutiveStatic, captionsSafeArea: true },
        outDir, name, createEvidence: name === 'balanced',
      });
    }
    results.push({ name, outPath, render: rendered, verification });
  }
  const report = { createdAt: new Date().toISOString(), variants: results.map((x) => ({ name: x.name, outPath: x.outPath, verification: x.verification })) };
  report.ok = report.variants.every((x) => x.verification.ok);
  await writeVerification(path.join(outDir, 'final-media-verification.json'), report);
  await writeFile(path.join(outDir, 'variant-comparison.json'), JSON.stringify(report.variants.map((x) => ({ name: x.name, duration: x.verification.duration, sceneChanges: x.verification.sceneChanges, audibleSfx: x.verification.sfx.audibleCount })), null, 2));
  await makeContactSheet(path.join(outDir, 'balanced.mp4'), path.join(outDir, 'contact-sheet.jpg'));
  if (!report.ok) throw new Error(`FINAL_MEDIA_VERIFICATION_FAILED:${report.variants.flatMap((x) => x.verification.failures).join(',')}`);
  return { ...report, results };
}
