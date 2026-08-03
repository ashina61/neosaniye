import test from 'node:test';
import assert from 'node:assert/strict';
import {access, readFile} from 'node:fs/promises';

async function exists(filePath) {
  return access(filePath).then(() => true).catch(() => false);
}

// Bu liste geçiş dönemindeki dosyaların yanlışlıkla yeniden üretim yoluna
// eklenmesini engeller; yeni motion özellikleri yalnız remotion/ altında yaşar.
//
// Kolaj şablon hattı (DynamicShort + buildRemotionSpec) da bu listeye eklendi:
// artık sahne türü "şablon" değil RIG'tir ve sahneyi seslendirme satırı seçer.
const removedPaths = [
  'remotion/src/DynamicShort.tsx',
  'src/video/buildRemotionSpec.js',
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
  assert.equal(pkg.engines.node, '>=20');
  assert.match(scripts, /remotion:typecheck/);
  assert.doesNotMatch(scripts, /motion:preview|motion:sfx|motion:rollout|bee:regression/);
});

test('orkestratör eski CTA motorunu ve config.motion ayarını taşımaz', async () => {
  const runSource = await readFile('src/pipeline/run.js', 'utf8');
  const configSource = await readFile('src/config.js', 'utf8');
  assert.doesNotMatch(runSource, /applyCta|getRecentCtaTypes|config\.motion/);
  assert.doesNotMatch(configSource, /\bmotion\s*:\s*\{/);
  assert.match(runSource, /integrated-in-remotion/);
});

test('motor tek yerde yaşar: posterize, film görünümü ve rig kütüphanesi', async () => {
  const motion = await readFile('remotion/src/engine/motion.ts', 'utf8');
  for (const helper of ['posterizeTime', 'boil', 'drift', 'pingpong', 'entrance', 'dampedWag', 'holdKeyframes']) {
    assert.match(motion, new RegExp(`export function ${helper}`), `motion motorunda ${helper} yok`);
  }

  const filmLook = await readFile('remotion/src/engine/FilmLook.tsx', 'utf8');
  for (const layer of ['scanlines', 'grain', 'grunge', 'vignette', 'weave']) {
    assert.match(filmLook, new RegExp(layer), `film görünümünde ${layer} katmanı yok`);
  }

  // Her rig kendi dosyasında; hiçbiri kendi film işlemesini yapmaz — görünüm
  // tek sarmalayıcıdan gelir, yoksa altı sahne altı ayrı videoya benzer.
  const rigFiles = [
    'PortalZoom', 'VillainPunch', 'PaperDrop', 'GroundedPunch', 'MoneyRoom', 'FinaleClone',
  ];
  for (const rig of rigFiles) {
    const source = await readFile(`remotion/src/rigs/${rig}.tsx`, 'utf8');
    assert.doesNotMatch(source, /FilmLook/, `${rig} kendi film işlemesini yapıyor`);
  }
});

test('render giriş noktası reel kompozisyonunu ve beat sheet artefaktını üretir', async () => {
  const source = await readFile('src/video/renderRemotion.js', 'utf8');
  assert.match(source, /NeoSaniyeReel/);
  assert.match(source, /buildReelSpec/);
  assert.match(source, /writeBeatSheet/);
  assert.doesNotMatch(source, /buildRemotionSpec|NeoSaniyeDynamicShort/);
});

test('fixture spec yeni beat şemasını taşır', async () => {
  const fixture = JSON.parse(await readFile('fixtures/remotion/production.json', 'utf8'));
  assert.equal(fixture.version, 2);
  assert.ok(Array.isArray(fixture.beats) && fixture.beats.length > 0);
  assert.equal(fixture.scenes, undefined, 'eski scenes alanı hâlâ duruyor');
  assert.equal(fixture.engine.posterizeFps, 12);
  for (const beat of fixture.beats) {
    assert.ok(beat.rig && beat.line, `${beat.id} rig veya seslendirme satırı taşımıyor`);
    for (const caption of beat.captions || []) {
      assert.ok(
        beat.line.toLowerCase().includes(caption.text.toLowerCase()),
        `fixture ${beat.id}: "${caption.text}" seslendirme satırında geçmiyor`,
      );
    }
  }
});

test('Remotion package bağımsız ve sürümleri sabitlenmiştir', async () => {
  const pkg = JSON.parse(await readFile('remotion/package.json', 'utf8'));
  assert.equal(pkg.dependencies.remotion, '4.0.499');
  assert.equal(pkg.dependencies['@remotion/cli'], '4.0.499');
  assert.equal(pkg.dependencies.react, '19.1.1');
  assert.ok(pkg.scripts.typecheck);
});
