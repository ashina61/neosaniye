/**
 * ŞABLON GÖRSEL KAPISI — her şablonu render et, ÖLÇ, geçmezse durdur.
 *
 * ============ NEDEN VAR ============
 *
 * Bu oturumda beş şablon elle düzeltildi ve her turda aynı sınıf hata çıktı:
 *
 *   · alt bant boş kaldı (doluluk 4. dilimde %0.0)
 *   · kırmızı aksan tavanı aştı (%25.9, tavan %8)
 *   · nesne büyük kartın altında kalıp hiç görünmedi
 *   · kağıt katmanları zemini örtüp kareyi soldurdu
 *
 * Dördü de tiplerden görünmüyor ve `npm test` yakalamıyor — yalnızca render'a
 * BAKINCA fark ediliyor. Statik kapı (`test/registry.test.mjs`) yapıyı
 * denetliyor; bu kapı SONUCU ölçüyor.
 *
 * ============ NEDEN AYRI KOMUT ============
 *
 * Şablon başına bir still render'ı gerekiyor ve bu konteynerde kare başına
 * ~1.2 sn. 15 şablon ≈ 20 sn — `npm test`in içine koymak her testi yavaşlatır.
 * `npm run gate:templates` ile istendiğinde, workflow'da render'dan ÖNCE.
 *
 * ============ EŞİKLER ÖLÇÜMDEN ============
 *
 * doluluk  ≥ %8   — altı "kare boş" demek (ölçülen en kötü hâl %2.4)
 * aksan    ≤ %8   — AGENTS.md tavanı, referansta ölçülen %3.6
 *
 * Hedef 31.0 (kanıt masası) ama eşik ORAYA konmuyor: bir kapı, ulaşılmamış bir
 * hedefe göre kurulursa her koşuda kırmızı yanar ve okunmaz hâle gelir. Eşik
 * "kabul edilemez"i keser; hedefi rapor satırı gösterir.
 */

import {execFile} from 'node:child_process';
import {mkdir, writeFile, readFile, rm} from 'node:fs/promises';
import {promisify} from 'node:util';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const run = promisify(execFile);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'out', 'template-gate');

const MIN_FILL = 8;
const MAX_ACCENT = 8;
/** Kanıt masasında ölçülen doluluk — hedef, eşik DEĞİL. */
const TARGET_FILL = 31;

/**
 * TEK BİR SENTETİK BEAT, HER ŞABLONA.
 *
 * Şablonlar aynı veriyi görmeli, yoksa karşılaştırma anlamsız olur: biri
 * zengin payload alıp öteki boş alırsa doluluk farkı şablondan değil veriden
 * gelir. Bu payload her şablonun okuduğu alanı taşıyor.
 */
const PAYLOAD = {
  headline: 'He asked for two hundred *thousand* dollars',
  label: 'SEATTLE',
  caption: 'Northwest Orient Flight 305, 1971',
  quote: 'Nobody ever found the man or the parachute.',
  shape: 'document',
  shape2: 'case',
  figure: '200,000',
  route: [
    {x: 0.28, y: 0.72, label: 'PORTLAND'},
    {x: 0.7, y: 0.26, label: 'SEATTLE'},
  ],
  timeline: [
    {year: '1971', text: 'the jump'},
    {year: '1980', text: 'the money'},
  ],
  sides: [{label: 'BEFORE'}, {label: 'AFTER'}],
  ratio: {total: 20, highlighted: 3},
  series: [0.2, 0.5, 0.35, 0.8],
  evidence: {
    date: {day: '24', month: 'NOV', year: '1971'},
    postmark: {place: 'Portland Ore', lines: ['24 NOV 1971', '2-50 PM']},
    record: {
      heading: 'Northwest Orient 305',
      subheading: 'Portland to Seattle',
      rows: [
        ['Portland', '2 50'],
        ['Seattle', '3 15'],
      ],
    },
  },
};

/** Dış malzeme isteyen şablonlar ölçülmez: malzemesiz zaten boş olurlar. */
const SKIP = new Set(['archive_clip', 'collage_build']);

const MEASURE = `
import sys, json
import numpy as np
from PIL import Image
a = np.asarray(Image.open(sys.argv[1]).convert("L")).astype(float)
c = np.asarray(Image.open(sys.argv[1]).convert("RGB")).astype(float)
bg = np.median(a)
h = a.shape[0]
slices = [float((np.abs(a[i*h//5:(i+1)*h//5] - bg) > 26).mean() * 100) for i in range(5)]
r, g, b = c[:, :, 0], c[:, :, 1], c[:, :, 2]
# Aksan: kırmızı sinyal VEYA altın. AGENTS.md ikisini de tek tavana sayıyor.
red = (r - np.maximum(g, b)) > 45
gold = (np.minimum(r, g) - b > 40) & (r > 120)
print(json.dumps({"slices": slices, "fill": float(np.mean(slices)),
                  "accent": float((red | gold).mean() * 100)}))
`;

async function main() {
  const src = await readFile(path.join(ROOT, 'src', 'scenes', 'index.tsx'), 'utf8');
  const block = src.match(/export const SCENES[^{]*\{([\s\S]*?)\n\};/)[1];
  const templates = [...block.matchAll(/(\w+):\s*\w+,/g)].map((m) => m[1]).filter((t) => !SKIP.has(t));

  await mkdir(OUT, {recursive: true});
  const probe = path.join(OUT, 'measure.py');
  await writeFile(probe, MEASURE);

  const sbPath = path.join(ROOT, 'content', 'storyboard.json');
  const backup = await readFile(sbPath, 'utf8');

  const rows = [];
  try {
    for (const template of templates) {
      /**
       * HER ŞABLON İÇİN TEK SAHNELİK STORYBOARD. Sahne 6 saniye ve kare
       * %85'te alınıyor: kurulum bitmiş, tutuş fazı başlamış olur.
       */
      const seconds = 6;
      const frames = seconds * 30;
      await writeFile(
        sbPath,
        `${JSON.stringify(
          {
            title: 'Template Gate',
            era: '1971',
            totalFrames: frames,
            scenes: [
              {
                template,
                payload: PAYLOAD,
                occurrence: 0,
                durationInFrames: frames,
                seed: 3,
                _beat: {text: 'He asked for two hundred thousand dollars.', kind: 'magnitude', start: 0},
              },
            ],
          },
          null,
          2,
        )}\n`,
      );

      const png = path.join(OUT, `${template}.png`);
      await run('npx', ['remotion', 'still', 'src/index.ts', 'Short', png, `--frame=${Math.round(frames * 0.85)}`], {
        cwd: ROOT,
      });
      const {stdout} = await run('python3', [probe, png], {cwd: ROOT});
      rows.push({template, ...JSON.parse(stdout)});
    }
  } finally {
    // Storyboard HER DURUMDA geri konur: kapı çöktüğü için depoyu bozuk
    // bırakmak, kapının kendisinden daha pahalı bir hata olurdu.
    await writeFile(sbPath, backup);
    await rm(probe, {force: true});
  }

  const fails = [];
  console.log('\nŞABLON GÖRSEL KAPISI');
  console.log(`  doluluk eşiği %${MIN_FILL}, aksan tavanı %${MAX_ACCENT}, hedef doluluk %${TARGET_FILL}\n`);
  console.log(`  ${'şablon'.padEnd(20)} ${'doluluk'.padStart(8)} ${'aksan'.padStart(7)}   dilimler`);
  for (const r of rows) {
    const bad = [];
    if (r.fill < MIN_FILL) bad.push('BOŞ');
    if (r.accent > MAX_ACCENT) bad.push('AKSAN TAŞTI');
    if (bad.length) fails.push(`${r.template}: ${bad.join(' + ')}`);
    const flag = bad.length ? `   >>> ${bad.join(' + ')} <<<` : r.fill >= TARGET_FILL ? '   hedefte' : '';
    console.log(
      `  ${r.template.padEnd(20)} ${r.fill.toFixed(1).padStart(8)} ${r.accent.toFixed(2).padStart(7)}   ` +
        r.slices.map((s) => s.toFixed(0).padStart(3)).join(' ') +
        flag,
    );
  }
  console.log(`\n  kareler: out/template-gate/`);

  if (fails.length) {
    console.error(`\nKAPI BAŞARISIZ:\n  ${fails.join('\n  ')}`);
    process.exit(2);
  }
  console.log('\n  kapı geçildi.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
