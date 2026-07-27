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
  'src/motion/ctaEngine.js',
  'src/visual/semanticShots.js',
  'src/visual/beatToActors.js',
  'src/visual/fallbackLadder.js',
  'src/visual/actors.js',
  'src/visual/focusDetect.js',
  'src/visual/effects.js',
  'src/visual/coords.js',
];

test('tek render giriş noktası premium Remotion adaptörüne delegasyon yapar', async () => {
  const source = await readFile('src/video/renderVideo.js', 'utf8');
  assert.match(source, /renderRemotion/);
  assert.doesNotMatch(source, /filter_complex|xfade|libass|drawtext|buildOutro|selectSceneMotion/);
});

test('eski renderer, router, CTA ve ASS katmanları repodan kaldırılmıştır', async () => {
  const found = [];
  for (const filePath of removedPaths) if (await exists(filePath)) found.push(filePath);
  assert.deepEqual(found, [], `eski yollar hâlâ mevcut:\n${found.join('\n')}`);
});

test('Remotion final görüntüde dış medya ve subtitle renderer kullanmaz', async () => {
  const source = await readFile('remotion/src/DynamicShort.tsx', 'utf8');
  const schema = await readFile('remotion/src/schema.ts', 'utf8');
  assert.doesNotMatch(source, /\bImg\b|OffthreadVideo|<video|<img|scene\.assets|staticFile\([^)]*media/i);
  assert.doesNotMatch(source, /caption|subtitle|wordTimings|narration\s*\}/i);
  assert.doesNotMatch(schema, /SceneAsset|assets\??:/);
  assert.match(schema, /visualPolicy:\s*'procedural-only'/);
  assert.match(schema, /captionPolicy:\s*'none'/);
});

test('orkestratör görsel sağlayıcı veya video içi altyazı yolu taşımaz', async () => {
  const source = await readFile('src/pipeline/run.js', 'utf8');
  assert.doesNotMatch(source, /generateImages|directVisuals|applyShotList|fetchAmbienceTrack|buildSrtFromWords|uploadCaptions|analyzeCaptionLayout|validateCaptionIntegrity/);
  assert.match(source, /procedural-remotion/);
  assert.match(source, /captionPolicy:\s*'none'/);
});

test('günlük workflow yalnız premium procedural üretimi çalıştırır', async () => {
  const workflow = await readFile('.github/workflows/daily-short.yml', 'utf8');
  assert.match(workflow, /Premium Procedural/);
  assert.match(workflow, /VISUAL_POLICY:\s*procedural-only/);
  assert.match(workflow, /CAPTION_POLICY:\s*none/);
  assert.match(workflow, /npm run test:remotion/);
  assert.doesNotMatch(workflow, /VIDEO_STYLE|PEXELS_API_KEY|PIXABAY_API_KEY|HUGGINGFACE_API_KEY|TOGETHER_API_KEY|FREESOUND_API_KEY|subs\.srt|style:/);
});

test('package komutlarında eski media üretim girişi yoktur', async () => {
  const pkg = JSON.parse(await readFile('package.json', 'utf8'));
  const scripts = JSON.stringify(pkg.scripts);
  assert.equal(pkg.engines.node, '>=20');
  assert.match(pkg.description, /Premium procedural/i);
  assert.match(scripts, /remotion:typecheck/);
  assert.doesNotMatch(scripts, /fetch-media|motion:preview|motion:sfx|motion:rollout|bee:regression/);
});

test('Remotion package bağımsız ve sürümleri sabitlenmiştir', async () => {
  const pkg = JSON.parse(await readFile('remotion/package.json', 'utf8'));
  assert.equal(pkg.dependencies.remotion, '4.0.499');
  assert.equal(pkg.dependencies['@remotion/cli'], '4.0.499');
  assert.equal(pkg.dependencies.react, '19.1.1');
  assert.ok(pkg.scripts.typecheck);
});
