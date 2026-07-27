import test from 'node:test';
import assert from 'node:assert/strict';
import {access, readFile} from 'node:fs/promises';

async function exists(filePath) {
  return access(filePath).then(() => true).catch(() => false);
}

const removedPaths = [
  'src/video/renderRouter.js',
  'src/video/outro.js',
  'src/video/motionPlan.js',
  'scripts/patch-remotion-shadow-run.mjs',
  '.github/workflows/remotion-shadow.yml',
  'src/motion/ctaRenderer.js',
  'src/motion/ctaValidator.js',
  'src/motion/ctaSelector.js',
  'src/motion/ctaSafeArea.js',
  'src/motion/ctaTemplates.js',
  'src/visual/semanticShots.js',
  'src/visual/beatToActors.js',
  'src/visual/fallbackLadder.js',
  'src/visual/actors.js',
  'src/visual/focusDetect.js',
  'src/visual/effects.js',
  'src/visual/coords.js',
];

test('tek render giriş noktası Remotion adaptörüne delegasyon yapar', async () => {
  const source = await readFile('src/video/renderVideo.js', 'utf8');
  assert.match(source, /renderRemotion/);
  assert.doesNotMatch(source, /filter_complex|xfade|libass|drawtext|buildOutro|selectSceneMotion/);
});

test('eski renderer, router, CTA ve ASS katmanları repodan kaldırılmıştır', async () => {
  const found = [];
  for (const filePath of removedPaths) {
    if (await exists(filePath)) found.push(filePath);
  }
  assert.deepEqual(found, [], `eski yollar hâlâ mevcut:\n${found.join('\n')}`);
});

test('günlük workflow doğrudan Remotion kurar ve eski seçim bayraklarını taşımaz', async () => {
  const workflow = await readFile('.github/workflows/daily-short.yml', 'utf8');
  assert.match(workflow, /Install Remotion renderer/);
  assert.match(workflow, /npm run test:remotion/);
  assert.match(workflow, /production\.json/);
  assert.doesNotMatch(workflow, /RENDER_ENGINE|REMOTION_MODE|patch-remotion|motion:rollout|visual_fx/);
});

test('package komutları yalnız yeni motion sistemini gösterir', async () => {
  const pkg = JSON.parse(await readFile('package.json', 'utf8'));
  const scripts = JSON.stringify(pkg.scripts);
  assert.equal(pkg.engines.node, '>=22');
  assert.match(scripts, /remotion:typecheck/);
  assert.doesNotMatch(scripts, /motion:preview|motion:sfx|motion:rollout|bee:regression/);
});

test('eski post-render CTA çağrısı videoyu değiştirmeyen uyumluluk katmanıdır', async () => {
  const {applyCta} = await import('../src/motion/ctaEngine.js');
  const result = await applyCta({videoPath: '/tmp/final.mp4', language: 'en'});
  assert.equal(result.videoPath, '/tmp/final.mp4');
  assert.equal(result.report.ctaApplied, false);
  assert.equal(result.report.selectionReason, 'owned-by-remotion');
});

test('Remotion package bağımsız ve sürümleri sabitlenmiştir', async () => {
  const pkg = JSON.parse(await readFile('remotion/package.json', 'utf8'));
  assert.equal(pkg.dependencies.remotion, '4.0.499');
  assert.equal(pkg.dependencies['@remotion/cli'], '4.0.499');
  assert.equal(pkg.dependencies.react, '19.1.1');
  assert.ok(pkg.scripts.typecheck);
});
