import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');

/**
 * KAYIT TUTARLILIĞI (statik koruma)
 *
 * `pipeline/beats.mjs` bir şablon adı döndürür, `src/scenes/index.tsx` o adı
 * bileşene çevirir. İkisi ayrı dosya ve ayrı dil (mjs / tsx), yani biri
 * değişip öteki değişmezse TypeScript bunu YAKALAMAZ: `Short.tsx` içinde
 * `SCENES[scene.template]` undefined döner ve sahne SESSİZCE boş çizilir.
 *
 * Bu test o boşluğu kapatır: üç kaynak (beats eşlemesi, SceneTemplate tipi,
 * SCENES kaydı) aynı adları taşımak zorunda.
 *
 * Aynı sınıf hata eski repoda görülmüştü: doğru düzeltme yanlış katmana
 * yazılınca üretimde hiç etkisi olmuyordu.
 */

async function read(rel) {
  return readFile(path.join(ROOT, rel), 'utf8');
}

/** `SCENES: Record<SceneTemplate, ...> = { a: X, b: Y }` içinden anahtarlar. */
function scenesRegistryKeys(src) {
  const block = src.match(/export const SCENES[^{]*\{([\s\S]*?)\n\};/);
  assert.ok(block, 'SCENES kaydı bulunamadı');
  return [...block[1].matchAll(/^\s*([a-z_]+):/gm)].map((m) => m[1]);
}

/** `export type SceneTemplate = | 'a' | 'b'` içinden birlik üyeleri. */
function sceneTemplateUnion(src) {
  const block = src.match(/export type SceneTemplate =([\s\S]*?);/);
  assert.ok(block, 'SceneTemplate tipi bulunamadı');
  return [...block[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
}

/** `const PRIMARY = { kind: ['tpl', ...] }` içinden şablon adları. */
function primaryTemplates(src) {
  const block = src.match(/const PRIMARY = \{([\s\S]*?)\n\};/);
  assert.ok(block, 'PRIMARY eşlemesi bulunamadı');
  return [...new Set([...block[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]))];
}

/** `const PRIMARY = { ... }` içinden beat türleri (anahtarlar). */
function primaryKinds(src) {
  const block = src.match(/const PRIMARY = \{([\s\S]*?)\n\};/);
  return [...block[1].matchAll(/^\s*([a-z_]+):/gm)].map((m) => m[1]);
}

test('beats.mjs yalnızca SCENES kaydında var olan şablonları seçer', async () => {
  const registry = scenesRegistryKeys(await read('src/scenes/index.tsx'));
  const used = primaryTemplates(await read('pipeline/beats.mjs'));
  const missing = used.filter((t) => !registry.includes(t));
  assert.deepEqual(
    missing,
    [],
    `beats.mjs bu şablonları seçebiliyor ama SCENES'te yok (sahne sessizce boş çizilir): ${missing.join(', ')}`,
  );
});

test('SceneTemplate tipi ile SCENES kaydı birebir aynı', async () => {
  const scenes = await read('src/scenes/index.tsx');
  const registry = scenesRegistryKeys(scenes).sort();
  const union = sceneTemplateUnion(await read('src/scenes/types.ts')).sort();
  assert.deepEqual(registry, union, 'SceneTemplate birliği ile SCENES anahtarları uyuşmuyor');
});

test('her beat türünün bir şablon seçeneği var', async () => {
  const beats = await read('pipeline/beats.mjs');
  const kinds = primaryKinds(beats);
  // classifyBeat'in döndürebildiği türler: RULES içindeki `kind`'lar + sabitler.
  const fromRules = [...beats.matchAll(/\{\s*kind:\s*'([a-z_]+)'/g)].map((m) => m[1]);
  const all = [...new Set([...fromRules, 'cold_open', 'fact', 'cliffhanger'])];
  const orphans = all.filter((k) => !kinds.includes(k));
  assert.deepEqual(orphans, [], `bu beat türleri PRIMARY'de yok, sessizce fact'e düşerler: ${orphans.join(', ')}`);
});

test('storyboard şeması: her sahne render edilebilir', async () => {
  const sb = JSON.parse(await read('content/storyboard.json'));
  const registry = scenesRegistryKeys(await read('src/scenes/index.tsx'));
  assert.ok(Array.isArray(sb.scenes) && sb.scenes.length > 0, 'storyboard boş');
  let sum = 0;
  for (const [i, s] of sb.scenes.entries()) {
    assert.ok(registry.includes(s.template), `sahne ${i + 1}: bilinmeyen şablon ${s.template}`);
    assert.ok(Number.isInteger(s.durationInFrames) && s.durationInFrames > 0, `sahne ${i + 1}: geçersiz süre`);
    assert.ok(Number.isInteger(s.seed), `sahne ${i + 1}: seed tamsayı değil (determinizm bozulur)`);
    assert.ok(s.payload && typeof s.payload === 'object', `sahne ${i + 1}: payload yok`);
    sum += s.durationInFrames;
  }
  assert.equal(sum, sb.totalFrames, 'totalFrames sahne sürelerinin toplamına eşit değil');
});

/**
 * Yorumları ve dize sabitlerini sök.
 *
 * Gerekli, çünkü ilk sürüm ham metinde `Math.random` arıyordu ve
 * `stepped.ts` içindeki "Math.random YASAK" yorumunu ihlal sanıyordu. Bir
 * kuralı kendi belgelendirmesi yüzünden ihlal saymak testi işe yaramaz kılar.
 */
function stripCommentsAndStrings(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1 ')
    .replace(/'(?:[^'\\]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/`(?:[^`\\]|\\.)*`/g, '``');
}

test('Math.random hiçbir kaynakta ÇAĞRILMIYOR (determinizm)', async () => {
  const files = [
    'src/motion/stepped.ts',
    'src/scenes/index.tsx',
    'src/paper/PaperBase.tsx',
    'src/paper/Cutout.tsx',
    'src/paper/Marks.tsx',
    'src/paper/Type.tsx',
    'src/paper/StickFigure.tsx',
    'src/Short.tsx',
    'src/StyleSheet.tsx',
    'pipeline/beats.mjs',
    'pipeline/build-storyboard.mjs',
  ];
  for (const f of files) {
    const code = stripCommentsAndStrings(await read(f));
    assert.doesNotMatch(code, /Math\s*\.\s*random\s*\(/, `${f} Math.random() çağırıyor — render deterministik olmaz`);
  }
});

test('etiket kelime sınırı tek yerde tanımlı ve 4', async () => {
  const src = await read('src/paper/Type.tsx');
  const m = src.match(/export const LABEL_MAX_WORDS = (\d+)/);
  assert.ok(m, 'LABEL_MAX_WORDS bulunamadı');
  assert.equal(Number(m[1]), 4, 'referans metin yasası: etiket en fazla 4 kelime');
});
