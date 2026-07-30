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

/**
 * Kaynak dosyalarını TARAYARAK bulur, elle yazılmış listeden değil.
 *
 * NEDEN: liste elle tutuluyordu ve `src/film/` altına eklenen dört yeni dosya
 * kapsam dışında kaldı — yani kural, korumasını en çok gerektiren yeni koda
 * uygulanmıyordu. Elle tutulan kapsam listesi, sessizce eskiyen bir listedir.
 */
async function sourceFiles() {
  const {readdir} = await import('node:fs/promises');
  const out = [];
  for (const dir of ['src', 'pipeline']) {
    const entries = await readdir(path.join(ROOT, dir), {recursive: true, withFileTypes: true});
    for (const e of entries) {
      if (!e.isFile()) continue;
      if (!/\.(ts|tsx|mjs)$/.test(e.name)) continue;
      out.push(path.relative(ROOT, path.join(e.parentPath ?? e.path, e.name)));
    }
  }
  return out.sort();
}

test('Math.random hiçbir kaynakta ÇAĞRILMIYOR (determinizm)', async () => {
  const files = await sourceFiles();
  // Tarama gerçekten çalışıyor mu: dosya sayısı beklenenin altına düşerse
  // test sessizce "hiçbir şeyi kontrol etmedim" durumuna geçer.
  assert.ok(files.length >= 15, `kaynak taraması az dosya buldu: ${files.length}`);
  assert.ok(files.some((f) => f.startsWith('src/film/')), 'src/film taranmıyor');
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

/**
 * ŞEKİL KAYDI — ÜÇ DOSYA, İKİ DİL, TEK LİSTE
 *
 * Çizilecek nesnenin kimliği üç yerde geçiyor:
 *   · pipeline/subject.mjs      → SHAPES (üretici)
 *   · src/paper/Cutout.tsx      → PlaceholderShape (çizen)
 *   · src/scenes/types.ts       → ScenePayload.shape (sözleşme)
 *
 * Biri değişip ötekiler değişmezse TypeScript bunu YAKALAMAZ, çünkü değer
 * .mjs tarafından JSON olarak geliyor. Sonuç sessiz: `Placeholder` bilinmeyen
 * şekle `default` dalıyla yanıt verir ve cümlede kano geçerken ekrana KUTU
 * çizilir. Tam olarak "çizilen şekiller yanlış" kusurunun geri gelme yolu.
 */
test('şekil listesi üç dosyada birebir aynı', async () => {
  const shapesOf = (src, re, msg) => {
    const m = src.match(re);
    assert.ok(m, msg);
    return [...m[1].matchAll(/'([a-z]+)'/g)].map((x) => x[1]).sort();
  };

  const producer = shapesOf(
    await read('pipeline/subject.mjs'),
    /export const SHAPES = \[([\s\S]*?)\];/,
    'subject.mjs SHAPES bulunamadı',
  );
  const drawer = shapesOf(
    await read('src/paper/Cutout.tsx'),
    /export type PlaceholderShape =([\s\S]*?);/,
    'PlaceholderShape bulunamadı',
  );
  const contract = shapesOf(
    await read('src/scenes/types.ts'),
    /shape\?:([\s\S]*?);/,
    'ScenePayload.shape bulunamadı',
  );

  assert.ok(producer.length >= 8, `şekil listesi beklenenden kısa: ${producer.length}`);
  assert.deepEqual(drawer, producer, 'Cutout.tsx ile subject.mjs şekil listesi ayrışmış');
  assert.deepEqual(contract, producer, 'types.ts ile subject.mjs şekil listesi ayrışmış');
});

/**
 * Somut nesne sözlüğünün TEK kaynağı olduğunu denetler.
 *
 * Bu liste bir kez iki yerde vardı: generate-cutouts.mjs görsel modeline "kano"
 * tarif ediyordu, render tarafı aynı sahneye insan silueti çiziyordu. İki taraf
 * aynı cümleden farklı sonuç çıkarıyordu ve kimse fark etmiyordu.
 */
test('somut nesne sözlüğü yalnızca subject.mjs içinde', async () => {
  const files = (await sourceFiles()).filter((f) => f !== 'pipeline/subject.mjs');
  for (const f of files) {
    const code = stripCommentsAndStrings(await read(f));
    assert.doesNotMatch(
      code,
      /\bconst CONCRETE\b/,
      `${f} ikinci bir somut nesne sözlüğü tanımlıyor — tek kaynak pipeline/subject.mjs`,
    );
  }
});

/**
 * UÇTAN UCA: hiçbir başlık bozuk bir noktada bitmiyor.
 *
 * Yukarıdaki birim testler kuralın kendisini denetliyor; bu test kuralın
 * GERÇEKTEN UYGULANDIĞINI denetliyor. Aradaki fark bu depoda dört kez fark
 * yarattı: kural doğruydu, yanlış katmandaydı ve üretimde hiç etkisi yoktu.
 */
test('storyboard başlıkları bozuk noktada bitmiyor', async () => {
  const {danglesBetween} = await import('../pipeline/beats.mjs');
  const sb = JSON.parse(await read('content/storyboard.json'));
  for (const [i, s] of sb.scenes.entries()) {
    const headline = s.payload?.headline;
    if (!headline) continue;
    const words = headline.replace(/\*/g, '').split(/\s+/);
    const last = words[words.length - 1];

    // 1. Sarkan işlev kelimesiyle bitmiyor.
    assert.equal(
      danglesBetween(last, 'x'),
      false,
      `sahne ${i + 1}: başlık sarkan kelimeyle bitiyor — ${JSON.stringify(headline)}`,
    );

    // 2. Kaynak cümledeki sayı/tarih zincirini ortadan kesmiyor.
    const src = (s._beat?.text ?? '').replace(/\s+/g, ' ').split(/\s+/);
    const at = src.findIndex((w, k) => k >= words.length - 1 && w.replace(/[^A-Za-z0-9]/g, '') === last.replace(/[^A-Za-z0-9]/g, ''));
    if (at >= 0 && at + 1 < src.length) {
      assert.equal(
        danglesBetween(src[at], src[at + 1]),
        false,
        `sahne ${i + 1}: başlık zinciri kesiyor — ${JSON.stringify(headline)} (devamı: ${src[at + 1]})`,
      );
    }
  }
});
