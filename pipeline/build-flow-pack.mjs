#!/usr/bin/env node
/**
 * GOOGLE FLOW DEVİR PAKETİ
 *
 * storyboard.json → out/flow-pack/ altında elle Flow'a atılacak her şey:
 *
 *   01-cold_open.txt … NN-kind.txt   beat başına kompoze kolaj prompt'u
 *   ALL-PROMPTS.txt                  hepsi tek dosyada, boş satırla ayrılmış
 *                                    (toplu görsel üretimi için)
 *   UNIVERSAL-VIDEO-PROMPT.txt       her görsele uygulanacak hareket talimatı
 *   README.txt                       hangi görselin hangi beat'e ait olduğu ve
 *                                    klipleri geri koyma talimatı
 *   manifest.json                    makine tarafı: beat ↔ dosya eşlemesi
 *
 * NEDEN VAR: kullanıcı i2v adımını elle Google Flow'da yapıyor. O adım
 * mekanik olmalı — hangi görselin hangi beat'e ait olduğu karışırsa montaj
 * sırası bozulur ve hata sessiz kalır. Bu yüzden dosya adları beat sırasını
 * taşıyor ve manifest geri okunabilir.
 *
 * AĞA ÇIKMAZ, ÜCRETLİ ÇAĞRI YAPMAZ. Yalnızca metin üretir.
 */

import {readFile, writeFile, mkdir, rm} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {composedCollagePrompt, UNIVERSAL_VIDEO_PROMPT} from './collage-prompt.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const PACK = path.join(ROOT, 'out', 'flow-pack');
const FPS = 30;

/**
 * Hangi beat'ler Flow'a gider, hangileri kodla çizilir?
 *
 * Kod-çizimli şablonlar veri anlarında görsel modelinden DAHA doğru: bir model
 * doğru bir rota oku ya da okunur bir 5/20 ızgarası çizemez. O sahneler
 * Remotion'da kalır. Gerisi — anlatının olgusal/arşiv anları — Flow'a gider.
 */
const CODE_DRAWN = new Set(['map_route', 'grid_scale', 'data_annotate', 'archival_timeline', 'split_compare', 'stick_beat']);

function pad(n) {
  return String(n).padStart(2, '0');
}

async function main() {
  const sbPath = path.join(ROOT, 'content', 'storyboard.json');
  if (!existsSync(sbPath)) {
    console.error('content/storyboard.json yok — önce `npm run beats`.');
    process.exit(1);
  }
  const sb = JSON.parse(await readFile(sbPath, 'utf8'));
  const story = JSON.parse(await readFile(path.join(ROOT, 'content', 'story.json'), 'utf8'));

  await rm(PACK, {recursive: true, force: true});
  await mkdir(PACK, {recursive: true});

  const flow = [];
  const code = [];
  let t = 0;

  for (const [i, scene] of sb.scenes.entries()) {
    const seconds = scene.durationInFrames / FPS;
    const row = {
      n: i + 1,
      template: scene.template,
      kind: scene._beat?.kind ?? 'fact',
      text: scene._beat?.text ?? '',
      start: Number(t.toFixed(2)),
      seconds: Number(seconds.toFixed(2)),
    };
    t += seconds;

    if (CODE_DRAWN.has(scene.template)) {
      code.push(row);
    } else {
      row.file = `${pad(row.n)}-${row.kind}`;
      row.prompt = composedCollagePrompt({text: row.text, kind: row.kind}, story);
      flow.push(row);
    }
  }

  // Beat başına ayrı dosya
  for (const r of flow) {
    await writeFile(path.join(PACK, `${r.file}.txt`), `${r.prompt}\n`);
  }

  // Toplu üretim beslemesi: numaralandırma YOK, bloklar boş satırla ayrılmış.
  // Referans PDF'in "Textify feed" biçimi bu; her blok tek başına çalışır.
  await writeFile(path.join(PACK, 'ALL-PROMPTS.txt'), `${flow.map((r) => r.prompt).join('\n\n')}\n`);
  await writeFile(path.join(PACK, 'UNIVERSAL-VIDEO-PROMPT.txt'), `${UNIVERSAL_VIDEO_PROMPT}\n`);

  const readme = [
    `NEOSANIYE — GOOGLE FLOW DEVİR PAKETİ`,
    `konu: ${sb.title}`,
    `video süresi: ${(sb.totalFrames / FPS).toFixed(1)} s · ${sb.scenes.length} sahne`,
    ``,
    `ADIMLAR`,
    `1. ALL-PROMPTS.txt içindeki blokları görsel modeline ver (her blok bir kare).`,
    `   Sıra korunmalı: birinci blok = ${flow[0]?.file}, ikinci = ${flow[1]?.file}, …`,
    `2. Dönen görselleri şu adlarla kaydet: ${flow.slice(0, 3).map((r) => r.file + '.png').join(', ')} …`,
    `3. Her görseli Google Flow'a ver, hareket talimatı olarak`,
    `   UNIVERSAL-VIDEO-PROMPT.txt içeriğini kullan.`,
    `4. Flow'dan dönen klipleri AYNI ADLA public/clips/ altına .mp4 olarak koy.`,
    `5. npm run beats && npm run render`,
    ``,
    `DİKKAT — ÖLÇÜLDÜ`,
    `Flow, "görseli birebir koru" talimatını tam tutmuyor. Bir denemede gravür`,
    `harita renkli bir haritayla değişti, tarife içeriği yeniden yazıldı ve`,
    `orijinalde olmayan sayfa kıvrımı eklendi. Bu estetikte genelde sorun değil,`,
    `AMA çıktıdaki TARİH ve SAYILARI gözle kontrol et; anlatımla çelişen bir`,
    `tarih yanlış bilgi demektir.`,
    ``,
    `FLOW'A GİDEN BEAT'LER (${flow.length})`,
    ...flow.map((r) => `  ${pad(r.n)}  ${r.start.toFixed(1)}s +${r.seconds.toFixed(1)}s  ${r.kind.padEnd(11)} ${JSON.stringify(r.text)}`),
    ``,
    `KODLA ÇİZİLEN BEAT'LER (${code.length}) — Flow'a GİTMEZ`,
    `Bu sahnelerde görsel modeli doğru olamıyor: rota oku, sayılabilir ızgara,`,
    `grafik, zaman çizelgesi. Remotion çiziyor.`,
    ...code.map((r) => `  ${pad(r.n)}  ${r.start.toFixed(1)}s +${r.seconds.toFixed(1)}s  ${r.template.padEnd(17)} ${JSON.stringify(r.text)}`),
    ``,
  ].join('\n');
  await writeFile(path.join(PACK, 'README.txt'), readme);

  await writeFile(
    path.join(PACK, 'manifest.json'),
    `${JSON.stringify({title: sb.title, fps: FPS, flow, code}, null, 2)}\n`,
  );

  console.log(`Flow paketi yazıldı: out/flow-pack/`);
  console.log(`  Flow'a giden        : ${flow.length} beat`);
  console.log(`  kodla çizilen       : ${code.length} beat (${[...new Set(code.map((c) => c.template))].join(', ')})`);
  console.log(`  dosyalar            : ${flow.length} prompt + ALL-PROMPTS + UNIVERSAL-VIDEO-PROMPT + README + manifest`);
  console.log(`\nÖrnek prompt (${flow[0]?.file}):\n`);
  console.log(flow[0]?.prompt);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
